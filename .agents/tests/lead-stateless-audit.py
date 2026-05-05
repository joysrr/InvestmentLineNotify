#!/usr/bin/env python3
"""lead-stateless-audit.py — Port of lead-stateless-audit.mjs (PROPOSAL_502_027 Sprint B).

驗證 @Lead §s_state_anchor 三鐵律（PROPOSAL_20260422_001）。
使用：python3 .agents/tests/lead-stateless-audit.py [--file PENDING_ACTIONS.md]

退出碼：
  0 = OK
  1 = file missing（warning）
  2 = errors（state anchor 缺失）
"""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_PATH = SCRIPT_DIR.parent.parent / "PENDING_ACTIONS.md"


def audit_state_anchor(file_path: Path) -> int:
    if not file_path.exists():
        print(
            f"⚠️  PENDING_ACTIONS.md not found at {file_path}", file=sys.stderr
        )
        print(
            "    系統尚未初始化 PENDING_ACTIONS.md；這是正常情況如果是首次啟用",
            file=sys.stderr,
        )
        return 1

    content = file_path.read_text(encoding="utf-8")
    print("🔍 Auditing @Lead State Anchor Compliance\n")

    errors = 0

    # 1. [CURRENT_STAGE] 欄位存在
    if not re.search(r"\[CURRENT_STAGE\][：:]\s*\S+", content):
        print("❌ [CURRENT_STAGE] field missing or empty", file=sys.stderr)
        errors += 1
    else:
        print("✅ [CURRENT_STAGE] present")

    # 2. [LAST_UPDATED] 時間戳
    if not re.search(r"\[LAST_UPDATED\][：:]\s*\d{4}-\d{2}-\d{2}", content):
        print("❌ [LAST_UPDATED] missing or malformed", file=sys.stderr)
        errors += 1
    else:
        print("✅ [LAST_UPDATED] present")

    # 3. [ARTIFACT_PATHS] 欄位
    if not re.search(r"\[ARTIFACT_PATHS\]", content):
        print("⚠️  [ARTIFACT_PATHS] section missing", file=sys.stderr)
    else:
        print("✅ [ARTIFACT_PATHS] section present")

    # 4. 🔴 區塊為空
    red_section = re.search(r"## 🔴[\s\S]*?(?=##\s|$)", content)
    if red_section:
        has_red_items = re.search(r"\|\s*BLOCK_\d+", red_section.group(0))
        if has_red_items:
            print(
                "⚠️  🔴 blocked items present — @Lead should refuse new features",
                file=sys.stderr,
            )
        else:
            print("✅ 🔴 section empty (no blockers)")

    print("\n─────────────────────────────")
    print(f"Summary: {errors} errors")
    print("─────────────────────────────")
    return 2 if errors > 0 else 0


def main():
    args = sys.argv[1:]
    target = DEFAULT_PATH
    if "--file" in args:
        idx = args.index("--file")
        if idx + 1 < len(args):
            target = Path(args[idx + 1])
    sys.exit(audit_state_anchor(target))


if __name__ == "__main__":
    main()
