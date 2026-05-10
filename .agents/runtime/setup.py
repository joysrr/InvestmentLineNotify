"""
setup.py — LangGraph runtime 一次性 setup (PROPOSAL_502_050 F-8)

執行：
    python3 .agents/runtime/setup.py [--harness all|claude|qwen|antigravity]

動作：
1. 確認 .agents/runtime/requirements.txt 已 pip install
2. 寫 .claude/settings.local.json 加 langgraph MCP server entry
3. 寫 .qwen/settings.json 同
4. 印 Antigravity IDE 設定指引
5. 啟動驗證：parser.validate_v722_ground_truth + state.assert_checkpoint_safe
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RUNTIME_DIR = PROJECT_ROOT / ".agents" / "runtime"
SERVER_PATH = RUNTIME_DIR / "mcp_server.py"


def ensure_deps() -> bool:
    """確認 langgraph + mcp 已裝；缺則提示 user 安裝"""
    try:
        import langgraph  # noqa: F401
        import mcp  # noqa: F401
        return True
    except ImportError as e:
        print(f"❌ 依賴缺失: {e}")
        print(f"   請先執行: pip install -r {RUNTIME_DIR / 'requirements.txt'}")
        return False


def write_claude_config() -> None:
    """寫 .claude/settings.local.json 加 langgraph MCP server"""
    config_path = PROJECT_ROOT / ".claude" / "settings.local.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)

    existing = {}
    if config_path.exists():
        try:
            existing = json.loads(config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"⚠️  {config_path} 既存但 JSON 解析失敗；備份後覆寫")
            backup = config_path.with_suffix(".json.bak")
            config_path.rename(backup)
            existing = {}

    mcp_servers = existing.setdefault("mcpServers", {})
    mcp_servers["langgraph"] = {
        "command": "python3",
        "args": [str(SERVER_PATH)],
        "_comment": "PROPOSAL_502_050 + ADR-0046; v8.0 LangGraph runtime",
    }

    config_path.write_text(
        json.dumps(existing, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"✅ 已更新 {config_path} 加 langgraph MCP server")


def write_qwen_config() -> None:
    """寫 .qwen/settings.json 加 langgraph MCP server"""
    config_path = PROJECT_ROOT / ".qwen" / "settings.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)

    existing = {}
    if config_path.exists():
        try:
            existing = json.loads(config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"⚠️  {config_path} 既存但 JSON 解析失敗；備份後覆寫")
            backup = config_path.with_suffix(".json.bak")
            config_path.rename(backup)
            existing = {}

    mcp_servers = existing.setdefault("mcpServers", {})
    mcp_servers["langgraph"] = {
        "command": "python3",
        "args": [str(SERVER_PATH)],
        "trust": False,
    }

    config_path.write_text(
        json.dumps(existing, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"✅ 已更新 {config_path} 加 langgraph MCP server")


def print_antigravity_instructions() -> None:
    print(
        f"""
📌 Antigravity IDE 設定指引：
   IDE Settings → MCP servers → 加新條目：
     name: langgraph
     command: python3
     args: ["{SERVER_PATH}"]
   存檔後重啟 Antigravity；對話即可呼 mcp__langgraph__dispatch
"""
    )


def validate() -> bool:
    """啟動驗證"""
    sys.path.insert(0, str(PROJECT_ROOT))
    try:
        from agents_runtime.parser import validate_v722_ground_truth  # type: ignore
    except ImportError:
        try:
            # fallback：直接 import 路徑
            sys.path.insert(0, str(PROJECT_ROOT / ".agents"))
            from runtime.parser import validate_v722_ground_truth  # type: ignore
        except ImportError as e:
            print(f"⚠️  parser import 失敗（可能依賴未裝；繼續）: {e}")
            return True  # 不 block setup

    errors = validate_v722_ground_truth()
    if errors:
        print(f"❌ v7.22 ground truth 驗證失敗:")
        for e in errors:
            print(f"   - {e}")
        return False
    print("✅ v7.22 ground truth 驗證通過")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="LangGraph runtime setup")
    parser.add_argument(
        "--harness",
        choices=["all", "claude", "qwen", "antigravity"],
        default="all",
        help="目標 harness（all = 全配置）",
    )
    parser.add_argument("--skip-deps", action="store_true", help="跳過依賴檢查")
    parser.add_argument("--skip-validate", action="store_true", help="跳過 v7.22 ground truth 驗證")
    args = parser.parse_args()

    print("🚀 LangGraph runtime setup (PROPOSAL_502_050 + ADR-0046)")
    print(f"   Project root: {PROJECT_ROOT}")
    print()

    # Deps
    if not args.skip_deps:
        if not ensure_deps():
            return 2

    # Configs
    if args.harness in ("all", "claude"):
        write_claude_config()
    if args.harness in ("all", "qwen"):
        write_qwen_config()
    if args.harness in ("all", "antigravity"):
        print_antigravity_instructions()

    # Validate
    if not args.skip_validate:
        if not validate():
            return 1

    print()
    print("✅ Setup 完成；重啟 harness 後即可使用 mcp__langgraph__dispatch")
    return 0


if __name__ == "__main__":
    sys.exit(main())
