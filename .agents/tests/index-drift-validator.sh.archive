#!/bin/bash
# index-drift-validator.sh
# 驗證 INDEX 類檔案與 generator 輸出同步（依 PROPOSAL_20260423_012 Phase D 建立）
#
# 檢查項目：
#   1. PROPOSAL_INDEX.md: gen-proposal-index.mjs --check（3 blocks）
#   2. RULES_VERSION_INDEX.md: gen-rules-version-index.mjs --check（1 block）
#
# 退出碼：
#   0 = 所有 index 檔案同步
#   1 = 有 drift（含缺標記）
#   2 = 執行錯誤

set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATORS_DIR="$SCRIPT_DIR/../scripts/generators"

errors=0

echo "🔍 Running INDEX Drift Validator (PROPOSAL_20260423_012)..."

# -------- PROPOSAL_INDEX --------
echo ""
echo "→ gen-proposal-index --check"
OUT_PI=$(node "$GENERATORS_DIR/gen-proposal-index.mjs" --check 2>&1)
RC_PI=$?
if [ $RC_PI -eq 0 ]; then
  echo "  ✅ PROPOSAL_INDEX.md: IN_SYNC"
else
  echo "  ❌ PROPOSAL_INDEX.md: DRIFT"
  echo "$OUT_PI" | sed 's/^/     /'
  echo "     修復：node .agents/scripts/generators/gen-proposal-index.mjs --write"
  errors=$((errors + 1))
fi

# -------- RULES_VERSION_INDEX --------
echo ""
echo "→ gen-rules-version-index --check"
OUT_RVI=$(node "$GENERATORS_DIR/gen-rules-version-index.mjs" --check 2>&1)
RC_RVI=$?
if [ $RC_RVI -eq 0 ]; then
  echo "  ✅ RULES_VERSION_INDEX.md: IN_SYNC"
else
  echo "  ❌ RULES_VERSION_INDEX.md: DRIFT"
  echo "$OUT_RVI" | sed 's/^/     /'
  echo "     修復：node .agents/scripts/generators/gen-rules-version-index.mjs --write"
  errors=$((errors + 1))
fi

echo ""
if [ $errors -eq 0 ]; then
  echo "✅ INDEX Drift Validator: 全通過（0 drift）"
  exit 0
fi
echo "❌ INDEX Drift Validator: $errors 個檔案 drift；請跑對應 generator --write 後重試"
exit 1
