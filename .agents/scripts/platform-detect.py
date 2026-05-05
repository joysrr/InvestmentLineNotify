#!/usr/bin/env python3
"""platform-detect.py — Auto detect harness + capabilities (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of platform-detect.mjs (PROPOSAL_502_019 T-3).

使用：
  python3 .agents/scripts/platform-detect.py              # 標準輸出
  python3 .agents/scripts/platform-detect.py --json       # 純 JSON 給 script 消費
  python3 .agents/scripts/platform-detect.py --verbose    # 詳細偵測過程

輸出（JSON 或文字格式）：
  harness: 'claude_code_cli' | 'claude_code_web' | 'antigravity' | 'qwen_agent' | 'unknown'
  capabilities: { ... 12 維度旗標 ... }
  fallbacks: 自動建議的降級策略
  warnings: 限制提示
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = AGENTS_ROOT.parent

verbose = "--verbose" in sys.argv
json_only = "--json" in sys.argv


def vlog(msg: str) -> None:
    if verbose:
        print(f"[detect] {msg}", file=sys.stderr)


def safe_which(cmd: str):
    return shutil.which(cmd)


def safe_run(cmd: str, timeout=3):
    try:
        res = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if res.returncode == 0:
            return (res.stdout or "").strip() or None
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def detect_capabilities():
    cap = {}
    # runtime
    cap["node_version"] = safe_run("node --version")
    cap["bash_available"] = bool(safe_which("bash"))
    cap["python3_available"] = bool(safe_which("python3"))
    cap["git_available"] = bool(safe_which("git"))

    # MemPalace
    cap["mempalace_cli"] = bool(safe_which("mempalace"))
    cap["mempalace_mcp"] = bool(safe_which("mempalace-mcp"))
    cap["mempalace_status_ok"] = False
    cap["mempalace_status_via"] = None  # 'cli' | 'mcp' | None
    if cap["mempalace_cli"]:
        status = safe_run("mempalace status 2>&1")
        if status and "drawers" in status:
            cap["mempalace_status_ok"] = True
            cap["mempalace_status_via"] = "cli"
    if not cap["mempalace_status_ok"] and cap["mempalace_mcp"]:
        cap["mempalace_status_via"] = "mcp_assumed_available"

    # MCP / Claude Code 設定
    cap["mcp_json_exists"] = (PROJECT_ROOT / ".mcp.json").exists()
    cap["claude_settings_exists"] = (PROJECT_ROOT / ".claude" / "settings.local.json").exists()

    # Antigravity / Qwen-Agent env signals
    cap["env_antigravity"] = bool(
        os.environ.get("ANTIGRAVITY")
        or os.environ.get("WINDSURF_USER")
        or os.environ.get("CASCADE_SESSION_ID")
    )
    cap["env_qwen_agent"] = bool(
        os.environ.get("DASHSCOPE_API_KEY") or os.environ.get("QWEN_AGENT")
    )

    # Framework files
    cap["agents_dir_exists"] = AGENTS_ROOT.exists()
    cap["current_workspace_set"] = (AGENTS_ROOT / "CURRENT_WORKSPACE").exists()
    cap["pending_actions_exists"] = (PROJECT_ROOT / "PENDING_ACTIONS.md").exists()
    cap["routing_ticket_exists"] = (PROJECT_ROOT / "ROUTING_TICKET.md").exists()

    # Env signals
    cap["env_anthropic_key"] = bool(os.environ.get("ANTHROPIC_API_KEY"))
    cap["env_claude_code"] = bool(os.environ.get("CLAUDE_CODE"))
    cap["env_in_container"] = (
        Path("/.dockerenv").exists() or Path("/run/.containerenv").exists()
    )

    # Filesystem writable test
    test_path = PROJECT_ROOT / ".platform-detect-test"
    try:
        test_path.write_text("test", encoding="utf-8")
        test_path.unlink()
        cap["fs_writable"] = True
    except Exception:
        cap["fs_writable"] = False

    return cap


def infer_harness(cap):
    if cap["env_claude_code"] is True:
        return {"harness": "claude_code_cli", "confidence": "high"}
    if cap["env_antigravity"]:
        return {"harness": "antigravity", "confidence": "high"}
    if cap["env_qwen_agent"]:
        return {"harness": "qwen_agent", "confidence": "high"}
    if cap["env_anthropic_key"] and cap["env_in_container"]:
        return {"harness": "claude_code_web", "confidence": "medium"}
    if cap["env_anthropic_key"] and not cap["env_in_container"]:
        return {"harness": "claude_code_cli", "confidence": "medium"}
    if cap["mcp_json_exists"] and cap["claude_settings_exists"]:
        return {"harness": "claude_code_cli", "confidence": "medium"}
    if cap["mcp_json_exists"] and not cap["claude_settings_exists"]:
        return {"harness": "antigravity_or_custom", "confidence": "low"}
    if (
        cap["mempalace_cli"]
        and cap["mempalace_mcp"]
        and not cap["mcp_json_exists"]
        and not cap["claude_settings_exists"]
    ):
        return {"harness": "antigravity_or_custom", "confidence": "medium"}
    return {"harness": "unknown", "confidence": "low"}


def compute_fallbacks(harness, c):
    fallbacks = []
    if not c["mempalace_cli"]:
        fallbacks.append(
            "mempalace 套件不可達 → 純 markdown grep filesystem fallback"
            "（hybrid mode；ADR-0039）"
        )
    if not c["mempalace_mcp"]:
        fallbacks.append("mempalace-mcp 不可達 → 改用 mempalace CLI 直呼（不依 MCP）")
    if not c["mcp_json_exists"] and c["mempalace_cli"]:
        fallbacks.append(".mcp.json 不存在 → 跳過 MCP server 註冊；走 CLI 路徑")
    if not c["claude_settings_exists"] and harness != "claude_code_cli":
        fallbacks.append(
            ".claude/settings.local.json 不存在或非 Claude Code → 手動 trigger auto-mine"
            "（commit 後派 @Assistant 巡邏 + 手動 mempalace mine）"
        )
    if not c["fs_writable"]:
        fallbacks.append(
            "專案根不可寫 → PENDING_ACTIONS / ROUTING_TICKET 無法持久；考慮改寫 .agents/state/"
        )
    return fallbacks


def compute_warnings(harness, c):
    w = []
    if harness == "unknown":
        w.append("未能明確判定 harness；建議手動讀 docs/PLATFORM_COMPATIBILITY.md 對照支援度")
    if harness == "antigravity_or_custom":
        w.append(
            "推論為 Antigravity / 自建環境；尚未驗證；建議先做 hello-world dispatch "
            "+ 重測 drift baseline"
        )
    if not c["python3_available"]:
        w.append(
            "Python 3 不可達 → mempalace 安裝失敗；framework runtime requirement 違反"
            "（FRAMEWORK_REQUIREMENTS §1）"
        )
    if c["mempalace_cli"] and not c["mempalace_status_ok"]:
        w.append("mempalace 套件存在但 status 失敗 → palace 可能未 init；先跑 `mempalace init`")
    if c["agents_dir_exists"] and not c["current_workspace_set"]:
        w.append(
            "framework 已部署但 CURRENT_WORKSPACE 未設定 → "
            "先跑 `python3 .agents/scripts/init-workspace.py`"
        )
    return w


def read_framework_version() -> str:
    path = AGENTS_ROOT / "FRAMEWORK_VERSION"
    try:
        v = path.read_text(encoding="utf-8")
        m = re.search(r"framework_version:\s*(v\S+)", v)
        return m.group(1) if m else "unknown"
    except Exception:
        return "unknown"


def main() -> int:
    cap = detect_capabilities()
    inferred = infer_harness(cap)
    fallbacks = compute_fallbacks(inferred["harness"], cap)
    warnings = compute_warnings(inferred["harness"], cap)

    result = {
        "harness": inferred["harness"],
        "confidence": inferred["confidence"],
        "capabilities": cap,
        "fallbacks": fallbacks,
        "warnings": warnings,
        "framework_version": read_framework_version(),
        "detected_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") +
            f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z",
    }

    if json_only:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    print("🔍 Platform Detection Report")
    print("───────────────────────────────────")
    print(f"Harness:           {result['harness']} ({result['confidence']} confidence)")
    print(f"Framework:         {result['framework_version']}")
    print(f"Detected at:       {result['detected_at']}")
    print("")
    print("Runtime capabilities:")
    print(f"  Node:            {cap['node_version'] or '❌ missing'}")
    print(f"  Bash:            {'✅' if cap['bash_available'] else '❌'}")
    print(f"  Python3:         {'✅' if cap['python3_available'] else '❌'}")
    print(f"  Git:             {'✅' if cap['git_available'] else '❌'}")
    print("")
    print("MemPalace:")
    print(f"  CLI:             {'✅' if cap['mempalace_cli'] else '❌'}")
    print(f"  MCP server:      {'✅' if cap['mempalace_mcp'] else '❌'}")
    print(f"  Status OK:       {'✅' if cap['mempalace_status_ok'] else '❌'}")
    print("")
    print("Framework state:")
    print(f"  .agents/:        {'✅' if cap['agents_dir_exists'] else '❌'}")
    print(f"  .mcp.json:       {'✅' if cap['mcp_json_exists'] else '⚠️ '}")
    print(f"  .claude/local:   {'✅' if cap['claude_settings_exists'] else '⚠️ '}")
    print(f"  CURRENT_WS:      {'✅' if cap['current_workspace_set'] else '⚠️  未設定'}")
    print(f"  PENDING_ACTIONS: {'✅' if cap['pending_actions_exists'] else '⚠️  fresh init'}")
    print(f"  ROUTING_TICKET:  {'✅' if cap['routing_ticket_exists'] else '⚠️  fresh'}")
    print("")

    if fallbacks:
        print("🔄 Fallbacks 自動建議：")
        for f in fallbacks:
            print(f"  - {f}")
        print("")

    if warnings:
        print("⚠️  Warnings：")
        for w in warnings:
            print(f"  - {w}")
        print("")

    print("🧭 部署建議：")
    deploy_map = {
        "claude_code_cli": "INSTALL.md 直接照走 100%",
        "claude_code_web": "INSTALL.md §一~§六（§四 MCP 視 sandbox 而定）",
        "antigravity": "INSTALL_ANTIGRAVITY.md（IDE 自有 MCP 註冊；無 sub-agent 限制）",
        "qwen_agent": "INSTALL_QWEN_AGENT.md（sub-agent / dispatch adapter 必寫）",
        "antigravity_or_custom":
            "INSTALL.md §一~§三 + 自寫 adapter（依 tasks/harness-adapter-pattern.md）",
        "unknown": "先讀 docs/PLATFORM_COMPATIBILITY.md 對照",
    }
    print(f"  {deploy_map.get(result['harness'], deploy_map['unknown'])}")
    print("")
    print("完整 capability 對照：docs/PLATFORM_COMPATIBILITY.md")
    print("Adapter 設計指南：tasks/harness-adapter-pattern.md")

    if result["harness"] == "unknown":
        return 1
    if any("FRAMEWORK_REQUIREMENTS 違反" in w for w in warnings):
        return 2
    return 0


if __name__ == "__main__":
    if "--help" in sys.argv or "-h" in sys.argv:
        print(__doc__)
        sys.exit(0)
    sys.exit(main())
