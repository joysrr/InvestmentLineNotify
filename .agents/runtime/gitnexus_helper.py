"""
gitnexus_helper.py — V90-A-8 GitNexus state-level integration

LangGraph nodes 自動透過本 module pre-fetch GitNexus context（callers / callees /
impact / module_deps）；結果注入 LLM prompt + 累積到 state['gitnexus_context']。

設計（ADR-0041 兩層 SoT 實作層）：
- mempalace = 語意層 SoT（agent 寫 / read decisions / drawer / KG）
- GitNexus = 語法層 cache（per-repo .gitnexus/；可重建；不持久）
- 本 helper = 把 GitNexus 從 optional advisory 升 mandatory pre-fetch

雙路徑共存（V90-A-8 design）：
- harness 互動 query：走 MCP (mcp__gitnexus__*；user 在對話框直接呼)
- runtime nodes 自動 pre-fetch：走 CLI subprocess（本 module）— 不依賴 MCP cross-talk

CLI 解析策略：
- 優先 GITNEXUS_CMD env var（允許 user 指定絕對路徑）
- fallback 走 PATH 解析（Windows: gitnexus.cmd / *nix: gitnexus）
- 若都找不到 → return None；nodes graceful degrade（不阻 dispatch）

Cache staleness：
- 每 session 第一次 query 前比 git HEAD vs .gitnexus/last_indexed_head
- 不一致 → 觸發 detect_changes 增量 re-index
- 失敗（CLI 缺 detect_changes / git 不在 path）→ log warn + continue
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 預設 CLI 超時（秒）；env override
DEFAULT_TIMEOUT_S = float(os.environ.get("GITNEXUS_CLI_TIMEOUT", "15"))
# Windows 下 CLI 名稱
_CLI_NAME_WIN = "gitnexus.cmd"
_CLI_NAME_NIX = "gitnexus"


def _resolve_cli_path() -> Optional[str]:
    """找 gitnexus CLI 路徑；先看 env var；fallback PATH 解析。

    優先序：
    1. GITNEXUS_CMD env var（user 顯式指定；如 D:\\node-v22.12.0-win-x64\\gitnexus.cmd）
    2. shutil.which('gitnexus.cmd' on Windows / 'gitnexus' elsewhere)

    Returns:
        絕對路徑 str 或 None（CLI 不存在）
    """
    explicit = os.environ.get("GITNEXUS_CMD")
    if explicit and Path(explicit).is_file():
        return explicit

    name = _CLI_NAME_WIN if os.name == "nt" else _CLI_NAME_NIX
    found = shutil.which(name)
    if found:
        return found

    # Windows 環境下 PATH 可能無 .cmd → 試一般名
    if os.name == "nt":
        found = shutil.which("gitnexus")
        if found:
            return found

    return None


def is_available() -> bool:
    """CLI 可用 flag；mcp_server health probe 用"""
    return _resolve_cli_path() is not None


def _run_cli(
    args: list[str],
    *,
    cwd: Optional[str] = None,
    timeout: Optional[float] = None,
) -> Optional[dict]:
    """跑 gitnexus CLI 子命令；JSON output 返 dict；失敗返 None。

    所有 helper 都呼這支；統一 error handling。

    Args:
        args: CLI sub-command 與 flags（不含 cli 路徑本身）；如 ["query", "FuncName"]
        cwd: 工作目錄；預設當前 cwd（通常 repo root）
        timeout: 自訂 timeout；預設 DEFAULT_TIMEOUT_S
    """
    cli = _resolve_cli_path()
    if cli is None:
        logger.warning(
            "gitnexus CLI not found; skipping pre-fetch. "
            "Set GITNEXUS_CMD env or install gitnexus globally."
        )
        return None

    cmd = [cli, *args]
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout or DEFAULT_TIMEOUT_S,
            check=False,
            encoding="utf-8",
            errors="replace",
        )
    except subprocess.TimeoutExpired:
        logger.warning("gitnexus CLI timeout: %s", " ".join(cmd[1:5]))
        return None
    except OSError as e:
        logger.warning("gitnexus CLI OSError: %s; cmd=%s", e, cmd[:3])
        return None

    if result.returncode != 0:
        # 不報 error 級；CLI sub-command 可能只是 unknown / 該 entity 沒 indexed
        logger.debug(
            "gitnexus CLI rc=%d; stderr=%s",
            result.returncode,
            (result.stderr or "")[:200],
        )
        return None

    stdout = (result.stdout or "").strip()
    if not stdout:
        return None

    # 嘗試 JSON parse；非 JSON 包裝成 raw
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return {"_raw": stdout, "_format": "text"}


# ============================================================
# Cache staleness 偵測 + auto reindex
# ============================================================

# 同一 session 內只跑一次 stale check（避免每 helper call 都比對）
_STALE_CHECK_DONE: dict[str, bool] = {}


def ensure_index_fresh(repo_root: Optional[str] = None) -> bool:
    """確認 .gitnexus/ index 與 git HEAD 同步；不同步 → 跑 detect_changes 增量 re-index。

    一個 session 同 repo 只跑一次（記憶在 _STALE_CHECK_DONE）。

    Returns:
        True 若 index 新鮮（或 reindex 成功）；False 若失敗
    """
    repo = repo_root or os.getcwd()
    if _STALE_CHECK_DONE.get(repo):
        return True

    git_dir = Path(repo) / ".git"
    if not git_dir.exists():
        # 非 git repo；無從比對；直接 mark done
        _STALE_CHECK_DONE[repo] = True
        return True

    # 跑 detect_changes（gitnexus 內建）；失敗就 swallow
    result = _run_cli(["detect_changes"], cwd=repo, timeout=30.0)
    _STALE_CHECK_DONE[repo] = True
    return result is not None


# ============================================================
# Public helpers — nodes 直接呼
# ============================================================


def query_entity(name: str, *, repo_root: Optional[str] = None) -> Optional[dict]:
    """查 entity（class / function / module）定義位置 + meta。

    Args:
        name: entity 名（exact match；如 'WorkflowState' / 'call_agent_llm'）
        repo_root: repo 路徑；預設 cwd

    Returns:
        {entity_name, kind, file, line_start, line_end, ...} or None
    """
    if not name:
        return None
    ensure_index_fresh(repo_root)
    return _run_cli(["query", name], cwd=repo_root)


def get_callers(target: str, *, repo_root: Optional[str] = None) -> Optional[dict]:
    """誰呼用此 function / class（reverse call graph）。

    Args:
        target: function / class 名

    Returns:
        {target, callers: [{file, line, caller_name}, ...]} or None
    """
    if not target:
        return None
    ensure_index_fresh(repo_root)
    return _run_cli(["callers", target], cwd=repo_root)


def get_callees(source: str, *, repo_root: Optional[str] = None) -> Optional[dict]:
    """此 function / class 呼用了誰（forward call graph）。"""
    if not source:
        return None
    ensure_index_fresh(repo_root)
    return _run_cli(["callees", source], cwd=repo_root)


def get_impact(
    file_path: str, *, repo_root: Optional[str] = None
) -> Optional[dict]:
    """改此檔影響哪些其他檔（cross-file impact analysis）。

    Args:
        file_path: 相對或絕對檔案路徑

    Returns:
        {file, impacts: [{file, reason}, ...]} or None
    """
    if not file_path:
        return None
    ensure_index_fresh(repo_root)
    return _run_cli(["impact", file_path], cwd=repo_root)


def get_module_deps(
    module: str, *, repo_root: Optional[str] = None
) -> Optional[dict]:
    """module 級依賴（module imports / imported by）。"""
    if not module:
        return None
    ensure_index_fresh(repo_root)
    return _run_cli(["context", module], cwd=repo_root)


# ============================================================
# Stage-specific composite helpers — node 一次呼拿到該 stage 所需 context
# ============================================================


def prefetch_for_lead(
    touched_files: list[str], *, repo_root: Optional[str] = None
) -> dict:
    """@Lead supervisor 進入時 pre-fetch：每 touched file 抓 impact summary。

    Returns dict 結構（即使部分子查詢 None 也回 dict；node 寫進 state['gitnexus_context']）：
        {
            "stage": "lead",
            "touched_files_impact": {<file>: <impact_dict_or_None>, ...},
            "indexed_at": <iso8601 str>,
        }
    """
    from datetime import datetime, timezone

    impact_map = {}
    for f in (touched_files or [])[:10]:  # 最多前 10 檔；避免 lead pre-fetch 過慢
        impact_map[f] = get_impact(f, repo_root=repo_root)

    return {
        "stage": "lead",
        "touched_files_impact": impact_map,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
    }


def prefetch_for_architect(
    touched_files: list[str],
    target_entities: Optional[list[str]] = None,
    *,
    repo_root: Optional[str] = None,
) -> dict:
    """@Architect 設計時 pre-fetch：module deps + entity definitions。"""
    from datetime import datetime, timezone

    module_map: dict[str, Any] = {}
    for f in (touched_files or [])[:10]:
        module_map[f] = get_module_deps(f, repo_root=repo_root)

    entity_map: dict[str, Any] = {}
    for e in (target_entities or [])[:10]:
        entity_map[e] = query_entity(e, repo_root=repo_root)

    return {
        "stage": "architect",
        "module_deps": module_map,
        "entity_definitions": entity_map,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
    }


def prefetch_for_implementer(
    touched_files: list[str],
    target_entities: Optional[list[str]] = None,
    *,
    repo_root: Optional[str] = None,
) -> dict:
    """@Backend / @Frontend 實作前 pre-fetch：每檔 callers + 每 entity callees。

    避免改了 function signature 卻不知 caller 也要改（最常見的 backend bug source）。
    """
    from datetime import datetime, timezone

    callers_map: dict[str, Any] = {}
    callees_map: dict[str, Any] = {}
    for e in (target_entities or [])[:8]:
        callers_map[e] = get_callers(e, repo_root=repo_root)
        callees_map[e] = get_callees(e, repo_root=repo_root)

    return {
        "stage": "implementer",
        "callers_per_entity": callers_map,
        "callees_per_entity": callees_map,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
    }


def prefetch_for_reviewer(
    touched_files: list[str], *, repo_root: Optional[str] = None
) -> dict:
    """@Reviewer 審查時 pre-fetch：cross-file impact。

    讓 reviewer 看見 PR 改的檔對其他檔的 ripple effect；指出可能漏改的 caller / spec。
    """
    from datetime import datetime, timezone

    impact_map = {}
    for f in (touched_files or [])[:15]:
        impact_map[f] = get_impact(f, repo_root=repo_root)

    return {
        "stage": "reviewer",
        "cross_file_impact": impact_map,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# Prompt formatting — context dict → 注入 LLM extra_system 的 plain text
# ============================================================


def format_context_for_prompt(context: dict) -> str:
    """把 prefetch_for_* 回傳 dict 轉成 LLM-readable text block。

    Empty / None values 會 skip；不污染 prompt。
    """
    if not context:
        return ""

    stage = context.get("stage", "?")
    parts = [f"## GitNexus Pre-fetched Context (stage={stage})"]
    content_added = False

    for key, val in context.items():
        if key in ("stage", "indexed_at"):
            continue
        if not val:
            continue
        if isinstance(val, dict):
            non_empty = {k: v for k, v in val.items() if v}
            if not non_empty:
                continue
            parts.append(f"\n### {key}")
            for k, v in non_empty.items():
                summary = _summarize_value(v)
                if summary:
                    parts.append(f"- **{k}**: {summary}")
                    content_added = True

    if not content_added:
        return ""

    parts.append(
        "\n_Source: GitNexus syntactic SoT (per-repo .gitnexus/ cache; ADR-0041)._"
    )
    return "\n".join(parts)


def _summarize_value(v: Any, max_len: int = 200) -> str:
    """把 sub-result dict 轉一行 summary；不爆 prompt 長度"""
    if v is None:
        return ""
    if isinstance(v, dict):
        if "_raw" in v:
            return str(v["_raw"])[:max_len]
        # 抓常見 keys
        if "callers" in v and isinstance(v["callers"], list):
            return f"{len(v['callers'])} callers: " + ", ".join(
                str(c.get("caller_name") or c.get("file") or c)
                for c in v["callers"][:3]
            )
        if "impacts" in v and isinstance(v["impacts"], list):
            return f"{len(v['impacts'])} impacts: " + ", ".join(
                str(c.get("file") or c) for c in v["impacts"][:3]
            )
        if "file" in v and "line_start" in v:
            return f"{v.get('file')}:{v.get('line_start')}-{v.get('line_end', '?')} ({v.get('kind', '?')})"
        # fallback：頭幾個 key
        items = list(v.items())[:3]
        return "; ".join(f"{k}={str(val)[:60]}" for k, val in items)
    return str(v)[:max_len]


# ============================================================
# Test hook（單元測試 mock 用）
# ============================================================


def _reset_session_cache() -> None:
    """重置 session-level cache（測試專用）"""
    _STALE_CHECK_DONE.clear()
