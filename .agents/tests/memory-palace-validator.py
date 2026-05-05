#!/usr/bin/env python3
"""memory-palace-validator.py — MemPalace health validator (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of memory-palace-validator.mjs
(PROPOSAL_20260502_001 + ADR-0039).

檢查項：
  1. mempalace 套件已安裝（pip show mempalace ≥ 3.3.4）
  2. mempalace-mcp 命令可達
  3. mempalace status 可成功（palace 已 init）
  4. 至少 1 drawer 已採礦（避免空 palace）
  5. .mcp.json 含 mempalace server 註冊
  6. markdown SoT 結構完整（.agents/memory/debug_graveyard/INDEX.md 存在）

退出碼：
  0 = 全 PASS（MemPalace 健康 + markdown SoT 完整）
  1 = warning（部分 stub；可降級為 markdown fallback mode）
  2 = error（MemPalace 完全不可用且 markdown 也缺；阻斷）
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
REPO_ROOT = AGENTS_ROOT.parent
MEMORY_DIR = AGENTS_ROOT / "memory"
MCP_JSON = REPO_ROOT / ".mcp.json"

errors = 0
warnings = 0


def err(msg: str) -> None:
    global errors
    print(f"❌ [ERROR] {msg}", file=sys.stderr)
    errors += 1


def warn(msg: str) -> None:
    global warnings
    print(f"⚠️  [WARN]  {msg}", file=sys.stderr)
    warnings += 1


def info(msg: str) -> None:
    print(f"ℹ️  {msg}")


def ok(msg: str) -> None:
    print(f"✅ {msg}")


def safe_run(cmd, timeout=10):
    """Run command and return stdout (str) or None on failure."""
    try:
        res = subprocess.run(
            cmd,
            shell=isinstance(cmd, str),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        # Combine stdout + stderr for tools writing to stderr
        out = (res.stdout or "") + (res.stderr or "")
        if res.returncode == 0:
            return out.strip()
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def main() -> int:
    global errors, warnings
    print("🔍 Memory Palace Validator (PROPOSAL_20260502_001 + ADR-0039)\n")

    # 1. mempalace 套件版本
    mempalace_version = None
    if shutil.which("mempalace"):
        mempalace_version = safe_run("mempalace --version 2>&1")

    if mempalace_version:
        if "3.3.4" in mempalace_version or re.search(r"3\.[3-9]\.", mempalace_version):
            ok(f"mempalace 安裝：{mempalace_version}")
        else:
            warn(f"mempalace 版本可能過舊：{mempalace_version}（要求 ≥ 3.3.4）")
    else:
        err("mempalace 命令不可達；安裝：pip install mempalace>=3.3.4")

    # 2. mempalace-mcp 命令
    if shutil.which("mempalace-mcp"):
        ok("mempalace-mcp 命令可達")
    else:
        err("mempalace-mcp 命令缺；MCP server 無法啟動")

    # 3. mempalace status + drawer count thresholds（PROPOSAL_502_003 C-2）
    drawer_count = 0
    COMPRESS_WARN_THRESHOLD = 1000
    COMPRESS_ERROR_THRESHOLD = 5000
    if mempalace_version:
        status = safe_run("mempalace status 2>&1")
        if status is not None:
            m = re.search(r"(\d+)\s+drawers", status)
            if m:
                drawer_count = int(m.group(1))
            if drawer_count > 0:
                ok(f"palace 已 init；{drawer_count} drawers indexed")
            else:
                warn("palace 已 init 但 0 drawers；建議跑 mempalace mine .agents/memory/")
            if drawer_count > COMPRESS_ERROR_THRESHOLD:
                err(
                    f"drawer count {drawer_count} > {COMPRESS_ERROR_THRESHOLD}；必跑 mempalace compress"
                    "（影響 retrieval 速度；AAAK Dialect 30x 壓縮）"
                )
            elif drawer_count > COMPRESS_WARN_THRESHOLD:
                warn(
                    f"drawer count {drawer_count} > {COMPRESS_WARN_THRESHOLD}；建議 mempalace compress"
                    "（skills/memory-operations.md §6）"
                )
        else:
            warn("mempalace status 失敗（可能未 init）")

    # 4. .mcp.json 註冊
    if MCP_JSON.exists():
        try:
            mcp = json.loads(MCP_JSON.read_text(encoding="utf-8"))
            if mcp.get("mcpServers", {}).get("mempalace"):
                ok(".mcp.json 含 mempalace server 註冊")
            else:
                warn(".mcp.json 缺 mempalace server block")
        except Exception as e:
            err(f".mcp.json parse 失敗：{e}")
    else:
        warn(".mcp.json 不存在；MCP server 無法被 Claude Code 載入")

    # 5. markdown SoT 結構
    sot_paths = [
        (MEMORY_DIR / "debug_graveyard" / "INDEX.md", True, "framework debug_graveyard INDEX"),
        (MEMORY_DIR / "debug_graveyard", True, "framework debug_graveyard 目錄"),
    ]
    for path, required, label in sot_paths:
        if path.exists():
            ok(f"SoT: {label}")
        elif required:
            err(f"SoT 缺：{label}（{path}）")
        else:
            warn(f"SoT 選用缺：{label}")

    # 6. workspace memory（若 active workspace）
    current_ws_path = AGENTS_ROOT / "CURRENT_WORKSPACE"
    if current_ws_path.exists():
        ws_name = current_ws_path.read_text(encoding="utf-8").strip()
        ws_name = re.sub(r"^['\"]|['\"]$", "", ws_name)
        if ws_name and ws_name != "default_env":
            ws_mem_path = AGENTS_ROOT / "workspaces" / ws_name / "memory"
            if ws_mem_path.exists():
                rooms = []
                for f in ws_mem_path.iterdir():
                    if f.is_dir():
                        rooms.append(f.name)
                info(
                    f"Active workspace {ws_name}：{len(rooms)} memory rooms"
                    f"（{', '.join(rooms)}）"
                )
                arch_idx = ws_mem_path / "architecture" / "INDEX.md"
                if not arch_idx.exists():
                    warn(
                        f"workspace {ws_name} 缺 architecture/INDEX.md"
                        "（lead.md §s_memory_palace 派發鐵律）"
                    )
            else:
                warn(f"Active workspace {ws_name} 無 memory/ 目錄；建議跑 init-workspace 補建")

    # 7. SoT vs vector store drift 偵測（PROPOSAL_502_015 O-3；解 Sim-D S16）
    if mempalace_version and drawer_count > 0:
        md_count = 0
        dg_dir = MEMORY_DIR / "debug_graveyard"
        if dg_dir.exists():
            try:
                md_count = sum(
                    1 for f in dg_dir.iterdir()
                    if f.is_file() and f.name.endswith(".md") and f.name != "INDEX.md"
                )
            except OSError:
                pass

        if current_ws_path.exists():
            ws_name = current_ws_path.read_text(encoding="utf-8").strip()
            ws_name = re.sub(r"^['\"]|['\"]$", "", ws_name)
            if ws_name and ws_name != "default_env":
                ws_mem_path = AGENTS_ROOT / "workspaces" / ws_name / "memory"
                if ws_mem_path.exists():
                    for room in ("architecture", "strategy_context", "debug_graveyard"):
                        room_path = ws_mem_path / room
                        if room_path.exists():
                            try:
                                md_count += sum(
                                    1 for f in room_path.iterdir()
                                    if f.is_file() and f.name.endswith(".md") and f.name != "INDEX.md"
                                )
                            except OSError:
                                pass

        if md_count > 0:
            ratio = drawer_count / md_count
            if ratio > 10:
                warn(
                    f"SoT drift 警示：drawer count ({drawer_count}) / markdown ({md_count}) "
                    f"= {ratio:.1f}x；過度 mining 或 markdown SoT 流失"
                )
            elif ratio < 0.5 and md_count > 5:
                warn(
                    f"SoT drift 警示：markdown ({md_count}) >> drawer count ({drawer_count})；"
                    "可能漏 mine（建議 mempalace mine .agents/memory/）"
                )
            else:
                info(
                    f"SoT vs vector store drift OK：drawer {drawer_count} / "
                    f"markdown {md_count} (ratio {ratio:.1f})"
                )

    # 摘要
    print("\n─────────────────────────────")
    print(f"Summary: {errors} errors, {warnings} warnings")
    if errors == 0 and warnings == 0:
        print("✅ Memory Palace Validator: 全 PASS")
    elif errors == 0:
        print("🟡 部分功能 stub；hybrid fallback 可運作")
    else:
        print("🔴 MemPalace 不可用；請依錯誤訊息修復")
    print("─────────────────────────────")
    if errors > 0:
        return 2
    if warnings > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
