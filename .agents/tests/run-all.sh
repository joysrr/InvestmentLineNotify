#!/bin/bash
# Run all validation scripts
# 由 PROPOSAL_20260422_019 建立
# 由 PROPOSAL_20260423_008 升級為並行 + --fast + --validator 三模式
# 使用：bash .agents/tests/run-all.sh [--fast | --validator <name>]

set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# -------- Mode parsing --------
MODE="full"
SINGLE_NAME=""
case "${1:-}" in
  --fast)               MODE="fast" ;;
  --validator)          MODE="single"; SINGLE_NAME="${2:-}" ;;
  --regenerate-indexes) MODE="regen" ;;  # 預留 PROPOSAL_007；現階段提示未實作
  --full|"")            MODE="full" ;;
  --help|-h)
    cat <<HELP
run-all.sh — Validator 執行入口（PROPOSAL_20260422_019 + 20260423_008）

USAGE:
  bash .agents/tests/run-all.sh                    # full（預設；8 並行 + scripts 序列）
  bash .agents/tests/run-all.sh --fast             # fast（依 git diff 只跑相關 validators）
  bash .agents/tests/run-all.sh --validator <name> # 單一（schema/intent/workspace/drift/ref/sync/loc/scripts）
  bash .agents/tests/run-all.sh --help             # 顯示說明

VALIDATORS:
  schema     - Schema validator (rules/*.md frontmatter + token budget)
  intent     - Proposal intent consistency
  workspace  - WORKSPACE_SCHEMA validator + skills/tasks F2 references
  drift      - Agent drift simulator (Mode A static)
  ref        - !ref anchor validator + cycle detection
  sync       - agents-overview.md sync (5 cross-references)
  loc        - docs location (framework vs project)
  scripts    - scripts/ tests (L1 unit + L3 smoke; 序列因 workspace 競爭)

EXIT CODES:
  0 = all pass
  1 = warnings only (commit allowed)
  2 = errors (commit blocked)
HELP
    exit 0 ;;
  *)
    echo "❌ Unknown mode: ${1}"
    echo "Try: bash .agents/tests/run-all.sh --help"
    exit 2 ;;
esac

# -------- Validator runner（背景作業 + log 暫存）--------
declare -A VALIDATOR_CMD=(
  [schema]="node $SCRIPT_DIR/schema-validator.mjs"
  [intent]="node $SCRIPT_DIR/proposal-intent-consistency.mjs"
  [workspace]="node $SCRIPT_DIR/workspace-schema-validator.mjs"
  [drift]="node $SCRIPT_DIR/agent-drift-simulator.mjs --mode static"
  [ref]="node $SCRIPT_DIR/ref-validator.mjs"
  [sync]="node $SCRIPT_DIR/agents-overview-sync-validator.mjs"
  [loc]="node $SCRIPT_DIR/docs-location-validator.mjs"
  [index_drift]="bash $SCRIPT_DIR/index-drift-validator.sh"
  [proposal_scope]="node $SCRIPT_DIR/proposal-scope-validator.mjs"
  [tech_stack]="node $SCRIPT_DIR/tech-stack-validator.mjs"
)

declare -A VALIDATOR_TITLE=(
  [schema]="Schema Validator"
  [intent]="Proposal Intent Consistency"
  [workspace]="Workspace Schema Validator"
  [drift]="Agent Drift Simulator (Mode A, static)"
  [ref]="!ref Validator"
  [sync]="agents-overview Sync Validator"
  [loc]="docs Location Validator"
  [index_drift]="INDEX Drift Validator (PROPOSAL_20260423_012)"
  [proposal_scope]="Proposal Scope Validator (PROPOSAL_20260423_015)"
  [tech_stack]="Tech-Stack Validator (PROPOSAL_20260423_017)"
)

# 並行執行傳入的 validator 名稱清單；輸出寫入 /tmp 暫存後串聯
run_parallel_validators() {
  local -a names=("$@")
  local -a logs=()
  local -a pids=()

  # 啟動所有並行作業
  for name in "${names[@]}"; do
    local logfile="/tmp/validator-${name}-$$.log"
    logs+=("$logfile")
    bash -c "${VALIDATOR_CMD[$name]}" > "$logfile" 2>&1 &
    pids+=($!)
  done

  # 等待 + 收集 exit codes
  local -a codes=()
  for pid in "${pids[@]}"; do
    wait "$pid"
    codes+=($?)
  done

  # 串聯輸出 + 設定 RESULT_<name>=<code> 全域變數
  local i=0
  for name in "${names[@]}"; do
    local code="${codes[$i]}"
    local logfile="${logs[$i]}"
    echo ""
    echo "🔍 Running ${VALIDATOR_TITLE[$name]}..."
    cat "$logfile"
    rm -f "$logfile"
    eval "RESULT_${name}=${code}"
    i=$((i + 1))
  done
}

# -------- Single mode --------
if [ "$MODE" = "single" ]; then
  if [ -z "$SINGLE_NAME" ] || [ -z "${VALIDATOR_CMD[$SINGLE_NAME]:-}" ] && [ "$SINGLE_NAME" != "scripts" ]; then
    echo "❌ Unknown validator: '$SINGLE_NAME'"
    echo "Available: schema intent workspace drift ref sync loc scripts"
    exit 2
  fi
  if [ "$SINGLE_NAME" = "scripts" ]; then
    bash "$SCRIPT_DIR/scripts/run.sh"
    exit $?
  fi
  echo "🔍 Running ${VALIDATOR_TITLE[$SINGLE_NAME]} (single mode)..."
  eval "${VALIDATOR_CMD[$SINGLE_NAME]}"
  exit $?
fi

# -------- Regen mode（依 PROPOSAL_20260423_007 啟用）--------
if [ "$MODE" = "regen" ]; then
  GENERATORS_DIR="$SCRIPT_DIR/../scripts/generators"
  echo "🔧 Regenerating indexes (PROPOSAL_20260423_007)..."
  echo ""

  echo "→ gen-rules-version-index.mjs --write"
  node "$GENERATORS_DIR/gen-rules-version-index.mjs" --write
  REGEN_RVI=$?

  echo ""
  echo "→ gen-proposal-index.mjs（dry-run；markdown 替換需手動或後續啟用）"
  node "$GENERATORS_DIR/gen-proposal-index.mjs"
  REGEN_PI=$?

  echo ""
  echo "ℹ️  CHANGELOG / FRAMEWORK_VERSION 仍需 @Lead 配合提案執行；參考："
  echo "    node .agents/scripts/generators/gen-changelog.mjs --proposal <path> --write"
  echo "    node .agents/scripts/generators/gen-framework-version.mjs --bump minor --proposal <id> --write"

  if [ $REGEN_RVI -ne 0 ] || [ $REGEN_PI -ne 0 ]; then
    echo ""
    echo "❌ Regenerate 部分失敗（rvi=$REGEN_RVI, pi=$REGEN_PI）"
    exit 2
  fi
  echo ""
  echo "✅ Indexes regenerate 完成"
  exit 0
fi

# -------- Fast mode（依 git diff）--------
RELEVANT_VALIDATORS=()
RELEVANT_SCRIPTS=0
if [ "$MODE" = "fast" ]; then
  if [ ! -f "$SCRIPT_DIR/lib/git-diff-detector.sh" ]; then
    echo "⚠️  --fast 模式需要 .agents/tests/lib/git-diff-detector.sh（PROPOSAL_20260423_008 Phase B 提供）"
    echo "    fallback 為 full 模式"
    MODE="full"
  else
    source "$SCRIPT_DIR/lib/git-diff-detector.sh"
    RELEVANT=$(detect_relevant_validators)
    if [ -z "$RELEVANT" ]; then
      echo "ℹ️  Fast mode: 無 framework 變更；跳過所有 validators"
      exit 0
    fi
    echo "ℹ️  Fast mode: 偵測到相關 validators: $RELEVANT"
    for v in $RELEVANT; do
      if [ "$v" = "scripts" ]; then
        RELEVANT_SCRIPTS=1
      else
        RELEVANT_VALIDATORS+=("$v")
      fi
    done
  fi
fi

# -------- Full mode（並行 8 + 序列 scripts）--------
if [ "$MODE" = "full" ]; then
  RELEVANT_VALIDATORS=(schema intent workspace drift ref sync loc index_drift proposal_scope tech_stack)
  RELEVANT_SCRIPTS=1
fi

# 執行並行段
if [ ${#RELEVANT_VALIDATORS[@]} -gt 0 ]; then
  echo "🚀 Running ${#RELEVANT_VALIDATORS[@]} validators in parallel: ${RELEVANT_VALIDATORS[*]}"
  run_parallel_validators "${RELEVANT_VALIDATORS[@]}"
fi

# 執行 scripts 序列段（避免 workspace 競爭）
RESULT_scripts=0
if [ "$RELEVANT_SCRIPTS" -eq 1 ]; then
  echo ""
  echo "🔍 Running scripts/ Tests (PROPOSAL_20260423_006; serial)..."
  bash "$SCRIPT_DIR/scripts/run.sh" >/dev/null 2>&1
  RESULT_scripts=$?
  if [ $RESULT_scripts -eq 0 ]; then
    echo "ℹ️  scripts/ tests: ✅ 全通過（L1 單元 + L3 smoke）"
  else
    echo "⚠️  scripts/ tests: ❌ 部分失敗（詳見 bash .agents/tests/scripts/run.sh）"
  fi
fi

# -------- Policy 判斷（依 PROPOSAL_20260422_019 + 025 + 028 + 029 + 20260423_004 + 006 + 008）--------
# - 僅 error (exit 2) 阻斷 commit
# - warning (exit 1) 只提示，不阻斷
# - scripts tests fail (exit 1) 為 warning level（工具層非規範層；不 block commit）
# - User 可透過修改本段改為嚴格模式（warning 也阻斷）

# 收集所有 RELEVANT_VALIDATORS 的 exit code
HAS_ERROR=0
HAS_WARN=0
declare -A RESULTS=()
for v in "${RELEVANT_VALIDATORS[@]}"; do
  code_var="RESULT_${v}"
  code="${!code_var:-0}"
  RESULTS[$v]=$code
  if [ "$code" -eq 2 ]; then HAS_ERROR=1; fi
  if [ "$code" -eq 1 ]; then HAS_WARN=1; fi
done
if [ "$RELEVANT_SCRIPTS" -eq 1 ]; then
  RESULTS[scripts]=$RESULT_scripts
  if [ "$RESULT_scripts" -eq 2 ]; then HAS_ERROR=1; fi
  if [ "$RESULT_scripts" -eq 1 ]; then HAS_WARN=1; fi
fi

# 組摘要字串
SUMMARY=""
for k in "${!RESULTS[@]}"; do
  SUMMARY+="$k=${RESULTS[$k]}, "
done
SUMMARY="${SUMMARY%, }"

echo ""
if [ "$HAS_ERROR" -eq 1 ]; then
  echo "❌ Validation FAILED ($SUMMARY) — commit blocked"
  exit 2
elif [ "$HAS_WARN" -eq 1 ]; then
  echo "⚠️  Validation has warnings ($SUMMARY) — commit allowed"
  echo "    Review warnings above; fix when possible"
  exit 0
else
  echo "✅ All validation passed ($SUMMARY)"
  exit 0
fi
