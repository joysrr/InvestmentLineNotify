#!/usr/bin/env python3
"""
index-drift-validator.py — Python port of index-drift-validator.sh
PROPOSAL_502_025 Sprint A T-3a。

驗證 INDEX 類檔案與 generator 輸出同步（依 PROPOSAL_20260423_012 Phase D 建立）。

檢查項目：
    1. PROPOSAL_INDEX.md: gen-proposal-index.mjs --check（4 blocks）
    2. RULES_VERSION_INDEX.md: gen-rules-version-index.mjs --check（1 block）

退出碼：
    0 = 所有 index 檔案同步
    1 = 有 drift（含缺標記）
    2 = 執行錯誤
"""
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
GENERATORS_DIR = SCRIPT_DIR.parent / "scripts" / "generators"


def run_check(generator_name: str, label: str, fix_hint: str) -> int:
    print()
    print(f"→ {generator_name} --check")
    result = subprocess.run(
        ["python3", str(GENERATORS_DIR / f"{generator_name}.py"), "--check"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"  ✅ {label}: IN_SYNC")
        return 0
    print(f"  ❌ {label}: DRIFT")
    for line in (result.stdout + result.stderr).splitlines():
        print(f"     {line}")
    print(f"     修復：{fix_hint}")
    return 1


def main():
    print("🔍 Running INDEX Drift Validator (PROPOSAL_20260423_012; Python port PROPOSAL_502_025)...")

    errors = 0
    errors += run_check(
        "gen-proposal-index",
        "PROPOSAL_INDEX.md",
        "python3 .agents/scripts/generators/gen-proposal-index.py --write",
    )
    errors += run_check(
        "gen-rules-version-index",
        "RULES_VERSION_INDEX.md",
        "python3 .agents/scripts/generators/gen-rules-version-index.py --write",
    )

    print()
    if errors == 0:
        print("✅ INDEX Drift Validator: 全通過（0 drift）")
        sys.exit(0)
    print(f"❌ INDEX Drift Validator: {errors} 個檔案 drift；請跑對應 generator --write 後重試")
    sys.exit(1)


if __name__ == "__main__":
    main()
