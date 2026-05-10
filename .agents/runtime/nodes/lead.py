"""
@Lead supervisor node — Phase 2 完整 (PROPOSAL_502_051 B-1)

實作 ADR-0042 Hybrid LLM Classifier 三層判定：
- Layer 1: 結構訊號（無 CURRENT_WORKSPACE / git rename / all_new_files / existing_files_majority）
- Layer 2: closed-list keyword 7-priority + §C.5 4+1 條件
- Layer 3: LLM fallback (confidence parsing)

派發前 batch 5 探測（PROPOSAL_502_045 R4-B4）：
1. PENDING_ACTIONS §🔴 §📥
2. grep strategyWeight|金融
3. mempalace.search (skip if hotfix-light / config-adjust)
4. ROUTING_TICKET 既存
5. 結構訊號 (CURRENT_WORKSPACE / git status / git rename)
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Any

# V86-B-4: 移除 unused load_decision / load_skill imports
from .. import gitnexus_helper  # V90-A-8: state-level GitNexus integration
from ..state import AutonomyMode, GitNexusHint, TaskClass, TaskClassSource, WorkflowState
from ._base import append_decision, call_agent_llm, parse_llm_json


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
AGENTS_ROOT = PROJECT_ROOT / ".agents"


# ============================================================
# Layer 1: 結構訊號偵測
# ============================================================


def _detect_structural_signals(state: WorkflowState) -> tuple[TaskClass | None, str]:
    """ADR-0042 layer 1；回 (task_class, evidence) 或 (None, "")"""
    # 1. CURRENT_WORKSPACE 不存在 → 強制 onboarding
    cw = AGENTS_ROOT / "CURRENT_WORKSPACE"
    if not cw.exists():
        return ("onboarding", "missing_workspace")

    request = state.get("original_request", "")
    touched = state.get("touched_files", [])

    # 2. git rename detected → 強制 refactor (modify-existing)
    try:
        result = subprocess.run(
            ["git", "diff", "--diff-filter=R", "--find-renames=50%", "--name-only"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.returncode == 0 and result.stdout.strip():
            return ("modify-existing", "git_rename_detected")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 3. existing_files_majority + additive 動詞 → modify-existing
    if touched:
        existing_count = sum(1 for f in touched if (PROJECT_ROOT / f).exists())
        ratio = existing_count / len(touched)
        additive_words = ["加", "新增", "補上", "加上", "擴充"]
        if ratio >= 0.8 and any(w in request for w in additive_words):
            return ("modify-existing", "existing_files_majority")

    # 4. all_new_files → 強烈傾向 feature
    if touched:
        new_count = sum(1 for f in touched if not (PROJECT_ROOT / f).exists())
        if new_count == len(touched) and len(touched) > 0:
            return ("feature", "all_new_files")

    return (None, "")


# ============================================================
# Layer 2: closed-list keyword 7-priority
# ============================================================


_KEYWORD_PRIORITIES: list[tuple[int, list[str], TaskClass]] = [
    (1, ["建 workspace", "新 repo", "onboarding", "啟動專案", "拉了 repo", "PROJECT_CONTEXT 建立", "接入 codebase", "init project"], "onboarding"),
    (2, ["hotfix", "急修", "生產事故", "線上掛", "urgent fix"], "hotfix"),
    (3, ["改名", "rename", "refactor", "重新命名", "統一命名", "同步調整", "整合呼叫", "影響分析", "找出所有", "重構", "拆分", "合併", "砍掉", "拿掉", "幹掉", "合一", "收斂", "整理", "清乾淨", "對齊"], "modify-existing"),
    # H-5/V8-I-3 修：priority 4 移除 "加" "新增" 與 priority 7 重疊
    # H-1/V81-B-1 修：移除 "修 " 尾空白（"急修" 命中 priority 2 也會誤命中 priority 4 → ≥3 priority 假象）
    (4, ["fix ", "patch ", "update ", "修改", "補上", "擴充"], "modify-existing"),
    (5, ["文件", "docs", "README", "architecture", "API spec"], "doc-sync"),
    (6, ["config", "配置", "常數", "threshold", "timeout 值"], "config-adjust"),
    (7, ["新增", "加 ", "new ", "add ", "實作", "加上"], "feature"),  # 加 / 新增 / 加上 移到 priority 7
]


def _detect_keyword_priority(request: str) -> tuple[TaskClass | None, int]:
    """ADR-0042 layer 2；回 (task_class, priority_num) 或 (None, 0)；多命中取最低 priority"""
    matched: list[tuple[int, TaskClass]] = []
    for prio, words, cls in _KEYWORD_PRIORITIES:
        if any(w in request for w in words):
            matched.append((prio, cls))

    if not matched:
        return (None, 0)

    matched.sort()  # 取最低 priority 編號
    return (matched[0][1], matched[0][0])


def _detect_multi_signal_priorities(request: str) -> list[int]:
    """ADR-0043；偵測 priority 命中數量；回 priority 編號 list（已去重）

    V8-I-7 修：priority 4/7 重疊已去除（H-5）；本函式正常 set 去重即可。
    """
    matched_prios = set()
    for prio, words, _ in _KEYWORD_PRIORITIES:
        if any(w in request for w in words):
            matched_prios.add(prio)
    return sorted(matched_prios)


# ============================================================
# Layer 3: LLM fallback (confidence parsing)
# ============================================================


async def _llm_classify(state: WorkflowState) -> tuple[TaskClass, bool]:
    """ADR-0042 layer 3；回 (task_class, intent_ambiguous)"""
    extra = (
        "## 任務：分類 user 指令 task_class\n\n"
        "依下面 enum 決定：\n"
        "- feature / modify-existing / hotfix / doc-sync / config-adjust / onboarding\n\n"
        "**請於回應結尾以 `confidence: <high|medium|low>` 結尾（必填結構化欄位）**\n"
        "若無法判定 → 回 `unsure` + `confidence: low`\n\n"
        '回 JSON: {"task_class": "...", "is_refactor": bool, "is_cross_stack": bool}'
    )
    response = await call_agent_llm(state, "lead", extra_system=extra)
    parsed = parse_llm_json(response) or {}

    # confidence 解析（M-2 修：含 JSON 引號形式 "confidence":"high"；含 dict get fallback）
    confidence = "low"
    if isinstance(parsed.get("confidence"), str):
        confidence = parsed["confidence"].lower()
    else:
        conf_match = re.search(r'confidence["\s:]*\s*["\']?(high|medium|low)', response, re.IGNORECASE)
        if conf_match:
            confidence = conf_match.group(1).lower()

    # unsure 同義詞
    unsure_terms = ["unsure", "unclear", "ambiguous", "不確定", "看不出", "not sure", "can't tell", "hard to say"]
    has_unsure = any(t in response.lower() for t in unsure_terms)

    intent_ambiguous = confidence == "low" or has_unsure
    task_class = parsed.get("task_class", "feature")

    if task_class not in {"feature", "modify-existing", "hotfix", "doc-sync", "config-adjust", "onboarding"}:
        task_class = "feature"
        intent_ambiguous = True

    return (task_class, intent_ambiguous)


# ============================================================
# autonomy_mode smart default per task_class
# ============================================================


_AUTONOMY_DEFAULTS: dict[str, AutonomyMode] = {
    "feature": "gate-at-design",
    "modify-existing": "gate-at-impl",
    "doc-sync": "auto",
    "config-adjust": "auto",
    "hotfix": "auto",  # tier=light default; tier=heavy 由 hotfix 邏輯後置覆寫
    "onboarding": "gate-at-design",
}


def _smart_autonomy(task_class: TaskClass, hotfix_tier: str | None = None) -> AutonomyMode:
    """PROPOSAL_502_039 GR-D1：hotfix-heavy 改 gate-at-impl"""
    if task_class == "hotfix":
        return "auto" if hotfix_tier == "light" else "gate-at-impl"
    return _AUTONOMY_DEFAULTS.get(task_class, "gate-at-design")


# ============================================================
# B-1 偵測：4+1 觸發條件 (gitnexus_hint)
# ============================================================


def _detect_gitnexus_hint(state: WorkflowState) -> GitNexusHint | None:
    """§C.5 4+1 觸發條件 + hotfix-light short-circuit"""
    # Hotfix-light 短路（PROPOSAL_502_035 鐵律）
    hf = state.get("hotfix") or {}
    if hf.get("hotfix_tier") == "light":
        return None

    request = state.get("original_request", "")
    touched = state.get("touched_files", [])
    triggered: list[str] = []

    # cross-stack
    if len(touched) >= 3:
        exts = set()
        for f in touched:
            ext = Path(f).suffix
            if ext in {".test.ts", ".spec.ts", ".d.ts"}:
                ext = ".ts"
            if ext:
                exts.add(ext)
        # 排除 noise
        non_config_exts = exts - {".json", ".toml", ".yaml", ".yml", ".md", ".txt", ".lock", ".env"}
        if len(non_config_exts) >= 2:
            triggered.append("cross-stack")

    # large-file
    for f in touched:
        try:
            p = PROJECT_ROOT / f
            if p.exists() and p.stat().st_size > 0:
                line_count = sum(1 for _ in p.open(encoding="utf-8", errors="ignore"))
                if line_count > 800:
                    triggered.append("large-file")
                    break
        except Exception:
            pass

    # refactor-keyword (擴充清單)
    refactor_words = [
        "refactor", "rename", "impact", "restructure", "consolidate", "extract", "inline",
        "改名", "重新命名", "重構", "統一命名", "同步調整", "同步更新引用", "整合呼叫",
        "影響分析", "拆分", "合併", "移到", "跨檔", "找出所有",
        "砍掉", "拿掉", "幹掉", "合一", "收斂", "整理", "清乾淨", "對齊",
    ]
    if any(w in request for w in refactor_words):
        triggered.append("refactor-keyword")

    # frontend-backend-pair
    fe_keywords = ["frontend/", "web/", "client/", "ui/", "src/components/", "src/views/", "pages/", "widgets"]
    be_keywords = ["backend/", "server/", "api/", "src/api/", "src/services/", "Controllers", "Services", "Repository", "Models", "Domain"]
    has_fe = any(any(k in t for k in fe_keywords) for t in touched)
    has_be = any(any(k in t for k in be_keywords) for t in touched)
    if has_fe and has_be:
        triggered.append("frontend-backend-pair")

    # onboarding-scenario (forced if task_class=onboarding)
    if state.get("task_class") == "onboarding":
        triggered.append("onboarding-scenario")

    if not triggered:
        return None

    # suggested_query 抽取（fallback chain）
    symbol_match = re.search(r"\b([a-zA-Z_]\w{2,})\b", request)
    if symbol_match and any(symbol_match.group(1) in t for t in touched):
        suggested = f"gitnexus impact {symbol_match.group(1)}"
    elif touched:
        suggested = f"gitnexus context {touched[0]}"
    else:
        suggested = "gitnexus analyze ."

    return GitNexusHint(
        triggered_by=triggered,
        suggested_query=suggested,
        fallback="Prior Art Phase B (user 自跑 + 回填)",
        optional=("onboarding-scenario" in triggered),
    )


# ============================================================
# Lead supervisor main
# ============================================================


async def lead_node(state: WorkflowState) -> dict[str, Any]:
    """@Lead supervisor — Phase 2 三層判定 + B-1 hint + autonomy default"""

    # Layer 1: structural signals
    layer1_class, layer1_evidence = _detect_structural_signals(state)
    if layer1_class:
        task_class = layer1_class
        source: TaskClassSource = "structural"
        intent_ambiguous = False

    else:
        # Layer 2: keyword priority
        layer2_class, layer2_prio = _detect_keyword_priority(state.get("original_request", ""))
        if layer2_class:
            task_class = layer2_class
            source = "keyword"
            intent_ambiguous = False
        else:
            # Layer 3: LLM fallback
            try:
                task_class, intent_ambiguous = await _llm_classify(state)
                source = "llm_classifier" if not intent_ambiguous else "llm_failed_fallback"
            except Exception:
                task_class = "feature"
                intent_ambiguous = True
                source = "llm_failed_fallback"

    # Hotfix tier detection (M-1 V8-D-6 修：括號 + 預設 heavy；touched_files=[] 不視同 light)
    # V86-A-4 修：request 內含 path-like token (如 src/foo.py) → 自動填 touched_files
    hotfix_tier: str | None = None
    if task_class == "hotfix":
        request = state.get("original_request", "")
        touched = list(state.get("touched_files", []))
        if not touched:
            # 抓 src/foo.py / app/bar.tsx / lib/baz.ts 樣式 path token
            import re
            path_tokens = re.findall(r"[\w./-]+\.(?:py|tsx?|jsx?|md|json|yaml|yml|sh|css|html)", request)
            touched = path_tokens[:3]  # 最多 3 個避免過寬
        # 預設 heavy；只有「touched_files 1 檔 + 純 typo + 無高風險詞」才 light
        has_high_risk = any(k in request for k in ["data", "刪除", "金鑰", "strategyWeight", "rollback", "fee", "計算", "支付", "payment"])
        is_light = (
            "typo" in request.lower()
            and (len(touched) == 1)
            and not has_high_risk
        )
        hotfix_tier = "light" if is_light else "heavy"

    # autonomy default
    autonomy = _smart_autonomy(task_class, hotfix_tier)

    # B-1 gitnexus_hint (only if not hotfix-light)
    state_with_class: WorkflowState = {**state, "task_class": task_class, "hotfix": ({"hotfix_tier": hotfix_tier} if hotfix_tier else None)}  # type: ignore
    gnx_hint = _detect_gitnexus_hint(state_with_class)

    # Lane / model
    lane = "fast" if task_class in {"hotfix", "doc-sync", "config-adjust"} and hotfix_tier != "heavy" else ("heavy" if hotfix_tier == "heavy" else "standard")
    model_tier = "haiku" if lane == "fast" else ("opus" if lane == "heavy" else "sonnet")

    # target_agent
    # H-2 V81-X-2 修：hotfix-heavy fast lane (跳 planner→consultant；直入 architect 設計)
    if task_class == "onboarding":
        target = "@Architect"
    elif task_class == "hotfix" and hotfix_tier == "light":
        target = "@Backend"
    elif task_class == "hotfix" and hotfix_tier == "heavy":
        target = "@Architect"  # heavy 跳 planner → 直入 architect 走 design + qa_test_spec + impl
    elif task_class == "doc-sync":
        target = "@Architect"
    else:
        target = "@Planner"

    updates: dict[str, Any] = {
        **append_decision(
            state, "@Lead", "classify",
            task_class=task_class, source=source, layer=source,
        ),
        "task_class": task_class,
        "task_class_source": source,
        "task_class_source_evidence": layer1_evidence if layer1_evidence else None,
        "intent_ambiguous": intent_ambiguous,
        "assigned_lane": lane,
        "model_tier": model_tier,
        "complexity_tier": "complex" if lane == "heavy" else ("simple" if lane == "fast" else "medium"),
        "tier_reason": f"@Lead supervisor classified via layer={source}",
        "target_agent": target,
        "autonomy_mode": autonomy,
    }

    if hotfix_tier:
        updates["hotfix"] = {
            "enabled": True,
            "hotfix_tier": hotfix_tier,
            "sc_evaluation": {"triggered": False, "sc_codes": []},
            "diagnostic_team_required": hotfix_tier == "heavy",
        }
        # V86-A-4: 把自動抽出的 path token 寫進 touched_files
        if touched and not state.get("touched_files"):
            updates["touched_files"] = touched
        # hotfix-light 三機制全關
        if hotfix_tier == "light":
            updates["skip_memory_search"] = True
            # gnx_hint 被 _detect_gitnexus_hint 短路為 None

    if gnx_hint:
        updates["gitnexus_hint"] = gnx_hint

    # V90-A-8: 進入時 pre-fetch GitNexus context（state-level integration）
    # hotfix-light 跳過（避免拖慢急修 path）；其餘 task_class 全部 pre-fetch touched_files impact
    final_touched = updates.get("touched_files") or list(state.get("touched_files", []))
    if hotfix_tier != "light" and final_touched:
        try:
            ctx = gitnexus_helper.prefetch_for_lead(
                final_touched, repo_root=str(PROJECT_ROOT)
            )
            updates["gitnexus_context"] = ctx
        except Exception as e:  # graceful degrade；不阻 dispatch
            import logging
            logging.getLogger(__name__).warning("lead gitnexus prefetch failed: %s", e)

    # H-6 V8-B-8 修：multi_signal_secondary 寫入 state（避免 route_after_lead retroactive 重算）
    # V83-A-4: hotfix 路徑由 hotfix_tier 唯一決定；不寫 secondary 避免後續 retroactive 誤判
    if task_class != "hotfix":
        multi_prios = _detect_multi_signal_priorities(state.get("original_request", ""))
        if len(multi_prios) >= 2:
            # 第一個 priority = 主；其餘 = secondary
            updates["multi_signal_secondary"] = [str(p) for p in multi_prios[1:]]

    return updates
