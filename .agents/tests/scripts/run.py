#!/usr/bin/env python3
"""
run.py — scripts/ 測試統一入口（PROPOSAL_502_025 + 502_027 全 Python 化）

使用：python3 .agents/tests/scripts/run.py

退出碼：
    0 = L1 + L3 全通過
    1 = 任一層失敗
"""
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
TESTS_DIR = SCRIPT_DIR.parent


def run_python(*args) -> int:
    return subprocess.run(["python3", *args]).returncode


def main():
    print("🧪 Running scripts/ Tests (PROPOSAL_20260423_006; Python full PROPOSAL_502_027)")
    print()

    # ---- L1: Unit Tests（純 Python；unittest）----
    print("--- L1: Unit Tests（unittest）---")

    print("  → auto-generated-block.test.py")
    l1_agb = run_python(str(TESTS_DIR / "auto-generated-block.test.py"))

    print()
    print("  → gen-proposal-index.test.py")
    l1_gpi = run_python(str(TESTS_DIR / "gen-proposal-index.test.py"))

    l1_code = 0 if l1_agb == 0 and l1_gpi == 0 else 1
    print()

    # ---- L3: Smoke Tests ----
    print("--- L3: Smoke Tests（Python）---")
    l3_code = run_python(str(SCRIPT_DIR / "smoke_test.py"))

    # ---- Final ----
    print()
    print("=" * 40)
    if l1_code == 0 and l3_code == 0:
        print("✅ All scripts tests passed (L1 + L3)")
        sys.exit(0)
    if l1_code != 0 and l3_code != 0:
        print(f"❌ Both L1 unit + L3 smoke failed (l1={l1_code}, l3={l3_code})")
    elif l1_code != 0:
        print(f"❌ L1 unit tests failed (exit {l1_code})")
    else:
        print(f"❌ L3 smoke tests failed (exit {l3_code})")
    sys.exit(1)


if __name__ == "__main__":
    main()
