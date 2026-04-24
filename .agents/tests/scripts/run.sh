#!/bin/bash
# run.sh — scripts/ 測試統一入口
# 依 PROPOSAL_20260423_006 Part 4 建立
#
# 使用：bash .agents/tests/scripts/run.sh
#
# 退出碼：
#   0 = L1 + L3 全通過
#   1 = 任一層失敗

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🧪 Running scripts/ Tests (PROPOSAL_20260423_006)"
echo ""

# -------- L1: Unit Tests --------
echo "--- L1: Unit Tests（node:test）---"
node --test "$SCRIPT_DIR/unit.test.mjs" 2>&1 | tail -15
L1_CODE=${PIPESTATUS[0]}

echo ""

# -------- L3: Smoke Tests --------
echo "--- L3: Smoke Tests（bash）---"
bash "$SCRIPT_DIR/smoke.test.sh"
L3_CODE=$?

echo ""
echo "========================================"
if [ $L1_CODE -eq 0 ] && [ $L3_CODE -eq 0 ]; then
  echo "✅ All scripts tests passed (L1 + L3)"
  exit 0
elif [ $L1_CODE -ne 0 ] && [ $L3_CODE -ne 0 ]; then
  echo "❌ Both L1 unit + L3 smoke failed (l1=$L1_CODE, l3=$L3_CODE)"
  exit 1
elif [ $L1_CODE -ne 0 ]; then
  echo "❌ L1 unit tests failed (exit $L1_CODE)"
  exit 1
else
  echo "❌ L3 smoke tests failed (exit $L3_CODE)"
  exit 1
fi
