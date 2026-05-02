#!/bin/bash
# smoke.test.sh — scripts/ E2E 煙霧測試
# 依 PROPOSAL_20260423_006 Part 3 建立
#
# 使用：bash .agents/tests/scripts/smoke.test.sh
#
# 退出碼：
#   0 = 全通過
#   1 = 任一失敗

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMP_DIR=""
PASS_COUNT=0
FAIL_COUNT=0
declare -a FAILED_TESTS=()

# -------- Helpers --------
setup() {
  TEMP_DIR="$(mktemp -d /tmp/agents-scripts-test.XXXXXX)"
  # 備份 CURRENT_WORKSPACE
  if [ -f "$AGENTS_ROOT/CURRENT_WORKSPACE" ]; then
    cp "$AGENTS_ROOT/CURRENT_WORKSPACE" "$TEMP_DIR/CURRENT_WORKSPACE.backup"
  fi
}

cleanup() {
  # 還原 CURRENT_WORKSPACE
  if [ -f "$TEMP_DIR/CURRENT_WORKSPACE.backup" ]; then
    cp "$TEMP_DIR/CURRENT_WORKSPACE.backup" "$AGENTS_ROOT/CURRENT_WORKSPACE"
  fi
  # 清除所有測試 workspace（防測試殘留）
  rm -rf "$AGENTS_ROOT/workspaces/smoke_"* 2>/dev/null || true
  # 清除 workspaces/README.md 內 smoke_* 條目
  if [ -f "$AGENTS_ROOT/workspaces/README.md" ]; then
    sed -i '/| `smoke_.*`/d' "$AGENTS_ROOT/workspaces/README.md"
  fi
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

pass() { echo "✅ PASS: $1"; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { echo "❌ FAIL: $1 — $2"; FAIL_COUNT=$((FAIL_COUNT+1)); FAILED_TESTS+=("$1"); }

# 產生 41 行最小輸入序列（對齊 WORKSPACE_SCHEMA v1.2）
# 欄位順序：PROJECT_CONTEXT(5) + TECH_STACK(7) + PATHS(8) + DEPLOYMENT_CONSTRAINTS(9)
#          + DEPLOYMENT_SOP(3) + BUSINESS_DOMAINS(2) + 6 single-fields + 1 confirm = 41
generate_minimal_input() {
  local display_name="$1"
  local lines=(
    "$display_name"              # 1  PROJECT_CONTEXT.display_name (required)
    "示範專案"                    # 2  PROJECT_CONTEXT.business_domain (required)
    ""                           # 3  core_entities (optional)
    ""                           # 4  user_role (optional)
    ""                           # 5  proposal_prefix (optional)
    "nodejs"                     # 6  TECH_STACK.language (required; fuzzy match nodejs-esm-backend)
    ""                           # 7  frontend
    ""                           # 8  backend
    ""                           # 9  storage
    ""                           # 10 testing_framework
    ""                           # 11 external_dependency
    ""                           # 12 deployment
    "./data"                     # 13 PATHS.data_root (required)
    ""                           # 14 project_root
    ""                           # 15 frontend_root
    ""                           # 16 docs_root
    ""                           # 17 test_root
    ""                           # 18 env_example
    ""                           # 19 source_modules (sub-block)
    ""                           # 20 schedulers (sub-block)
    ""                           # 21 DEPLOYMENT_CONSTRAINTS.target
    ""                           # 22 cpu
    ""                           # 23 memory
    ""                           # 24 storage_limit
    ""                           # 25 network_limit
    ""                           # 26 runtime
    ""                           # 27 watchdog
    ""                           # 28 process_naming
    ""                           # 29 nginx_config_path
    ""                           # 30 DEPLOYMENT_SOP.deploy_steps
    ""                           # 31 env_sync
    ""                           # 32 rollback
    ""                           # 33 BUSINESS_DOMAINS.core
    ""                           # 34 realtime
    ""                           # 35 FUNCTIONAL_DOMAINS (single-field)
    ""                           # 36 CRITICAL_PATHS
    ""                           # 37 SECURITY_SCOPE_EXTENSIONS
    ""                           # 38 QA_MANDATORY_TESTS
    ""                           # 39 BUSINESS_RULES
    ""                           # 40 EVALUATED_PACKAGES
    "y"                          # 41 確認執行
  )
  printf '%s\n' "${lines[@]}"
}

# -------- 測試案例 --------

# Test 1: init-workspace --help
test_help() {
  local out
  out=$(node "$AGENTS_ROOT/scripts/init-workspace.mjs" --help 2>&1)
  if echo "$out" | grep -q "Interactive workspace initialization"; then
    pass "init-workspace --help 正常輸出"
  else
    fail "init-workspace --help" "缺少預期 --help 輸出"
  fi
}

# Test 2: init-workspace --dry-run 不寫檔
test_dry_run_no_write() {
  local before after name="smoke_dry_test"
  before=$(ls "$AGENTS_ROOT/workspaces/" | sort)
  local input
  input=$(generate_minimal_input "Demo Project")
  # dry-run + force；應顯示預覽但不寫檔
  echo "$input" | timeout 10 node "$AGENTS_ROOT/scripts/init-workspace.mjs" --name "$name" --dry-run --force >/dev/null 2>&1 || true
  after=$(ls "$AGENTS_ROOT/workspaces/" | sort)
  if [ "$before" = "$after" ]; then
    pass "init-workspace --dry-run（不寫檔）"
  else
    fail "init-workspace --dry-run" "workspaces/ 目錄狀態變更"
  fi
}

# Test 3: init-workspace 完整成功路徑
test_success_path() {
  local name="smoke_success"
  local input
  input=$(generate_minimal_input "Demo Project")
  echo "$input" | timeout 15 node "$AGENTS_ROOT/scripts/init-workspace.mjs" --name "$name" --force >/dev/null 2>&1
  local exit_code=$?

  if [ $exit_code -ne 0 ]; then
    fail "完整成功路徑" "CLI exit $exit_code"
    return
  fi
  if [ ! -f "$AGENTS_ROOT/workspaces/$name.md" ]; then
    fail "完整成功路徑" "workspaces/$name.md 未建立"; return
  fi
  if [ ! -d "$AGENTS_ROOT/workspaces/$name/proposals/active" ]; then
    fail "完整成功路徑" "proposals/active 目錄未建立"; return
  fi
  if [ ! -d "$AGENTS_ROOT/workspaces/$name/proposals/completed" ]; then
    fail "完整成功路徑" "proposals/completed 目錄未建立"; return
  fi
  if [ ! -d "$AGENTS_ROOT/workspaces/$name/proposals/archived" ]; then
    fail "完整成功路徑" "proposals/archived 目錄未建立"; return
  fi
  if [ ! -f "$AGENTS_ROOT/workspaces/$name/proposals/PROPOSAL_INDEX.md" ]; then
    fail "完整成功路徑" "proposals/PROPOSAL_INDEX.md 未建立"; return
  fi
  if ! grep -q "^$name$" "$AGENTS_ROOT/CURRENT_WORKSPACE"; then
    fail "完整成功路徑" "CURRENT_WORKSPACE 未更新為 $name"; return
  fi
  pass "完整成功路徑（8 檔案/目錄建立 + CURRENT_WORKSPACE 更新）"
}

# Test 4: rollback 路徑（預建檔案佔位觸發 mkdirSync fail）
test_rollback_path() {
  local name="smoke_rollback"
  # 預建同名檔案佔位讓 mkdir 失敗（ENOTDIR）
  touch "$AGENTS_ROOT/workspaces/$name"
  local input
  input=$(generate_minimal_input "Demo Project")
  echo "$input" | timeout 15 node "$AGENTS_ROOT/scripts/init-workspace.mjs" --name "$name" --force >/dev/null 2>&1

  # 驗證 rollback：workspace.md 與 proposals/ 子樹都不該殘留
  local failed=0
  if [ -f "$AGENTS_ROOT/workspaces/$name.md" ]; then
    fail "rollback" "workspaces/$name.md 未被 rollback 清除"
    failed=1
  fi
  if [ -d "$AGENTS_ROOT/workspaces/$name/proposals" ]; then
    fail "rollback" "proposals 子樹未被 rollback 清除"
    failed=1
  fi
  # 清除佔位檔
  rm -f "$AGENTS_ROOT/workspaces/$name"
  if [ $failed -eq 0 ]; then
    pass "rollback 路徑（mkdirSync fail → 完整回退）"
  fi
}

# Test 5: framework-diff self-diff exit 0
test_framework_diff_self() {
  node "$AGENTS_ROOT/scripts/framework-diff.mjs" --target "$AGENTS_ROOT" >/dev/null 2>&1
  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    pass "framework-diff self-diff exit 0"
  else
    fail "framework-diff self-diff" "非零退出碼 $exit_code"
  fi
}

# Test 10: run-all.sh --regenerate-indexes 模式（PROPOSAL_20260423_007）
test_regenerate_indexes() {
  local out
  out=$(bash "$AGENTS_ROOT/tests/run-all.sh" --regenerate-indexes 2>&1)
  if echo "$out" | grep -q "Indexes regenerate 完成"; then
    pass "run-all.sh --regenerate-indexes 模式正確執行（PROPOSAL_007）"
  else
    fail "run-all.sh --regenerate-indexes" "未顯示完成標記"
  fi
}

# Test 11: gen-rules-version-index dry-run 不寫檔
test_gen_rules_version_index_dry_run() {
  local before after
  before=$(stat -c %Y "$AGENTS_ROOT/RULES_VERSION_INDEX.md" 2>/dev/null || echo 0)
  node "$AGENTS_ROOT/scripts/generators/gen-rules-version-index.mjs" >/dev/null 2>&1
  after=$(stat -c %Y "$AGENTS_ROOT/RULES_VERSION_INDEX.md" 2>/dev/null || echo 0)
  if [ "$before" = "$after" ]; then
    pass "gen-rules-version-index dry-run 不寫檔"
  else
    fail "gen-rules-version-index dry-run" "RULES_VERSION_INDEX 被修改（mtime 變化）"
  fi
}

# Test 12: gen-framework-version dry-run 不寫檔
test_gen_framework_version_dry_run() {
  local before after
  before=$(stat -c %Y "$AGENTS_ROOT/FRAMEWORK_VERSION" 2>/dev/null || echo 0)
  node "$AGENTS_ROOT/scripts/generators/gen-framework-version.mjs" --bump minor --proposal TEST_DRY >/dev/null 2>&1
  after=$(stat -c %Y "$AGENTS_ROOT/FRAMEWORK_VERSION" 2>/dev/null || echo 0)
  if [ "$before" = "$after" ]; then
    pass "gen-framework-version dry-run 不寫檔"
  else
    fail "gen-framework-version dry-run" "FRAMEWORK_VERSION 被修改"
  fi
}

# Test 13: tech-stack-manage audit --dry-run（PROPOSAL_20260424_018 Phase C）
# 驗證：dry-run 模式輸出正確分級；不改 MANIFEST；不刪檔
test_tech_stack_audit_dry_run() {
  local manifest="$AGENTS_ROOT/tech-stacks/MANIFEST.yaml"
  local before
  before=$(stat -c %Y "$manifest" 2>/dev/null || echo 0)
  local out
  out=$(node "$AGENTS_ROOT/scripts/tech-stack-manage.mjs" audit --dry-run 2>&1)
  local after
  after=$(stat -c %Y "$manifest" 2>/dev/null || echo 0)

  # 驗證 1：輸出包含必要標記（標題 + 初步篩選 + DRY-RUN 結尾）
  if ! echo "$out" | grep -q "Tech-Stack Audit"; then
    fail "tech-stack-manage audit --dry-run" "輸出缺 'Tech-Stack Audit' 標題"
    return
  fi
  if ! echo "$out" | grep -q "初步篩選"; then
    fail "tech-stack-manage audit --dry-run" "輸出缺 '初步篩選' 段落"
    return
  fi
  if ! echo "$out" | grep -q "DRY-RUN"; then
    fail "tech-stack-manage audit --dry-run" "輸出缺 '[DRY-RUN]' 結尾標記"
    return
  fi
  # 驗證 2：MANIFEST 未被修改
  if [ "$before" != "$after" ]; then
    fail "tech-stack-manage audit --dry-run" "MANIFEST 被修改（mtime 變化）"
    return
  fi
  pass "tech-stack-manage audit --dry-run 正確（分級輸出 + 不改 MANIFEST）"
}

# Test 7: run-all.sh --validator <name> 單一模式（PROPOSAL_20260423_008 Part 3）
test_run_all_single_mode() {
  local out
  out=$(bash "$AGENTS_ROOT/tests/run-all.sh" --validator schema 2>&1)
  if echo "$out" | grep -q "Schema Validator"; then
    pass "run-all.sh --validator schema 單一模式"
  else
    fail "run-all.sh --validator" "未顯示 schema validator 輸出"
  fi
}

# Test 8: git-diff-detector.sh 函式單獨驗證（PROPOSAL_20260423_008 Part 2）
# 注意：避免直接呼叫 run-all.sh --fast 造成遞迴（smoke→run-all→scripts→smoke）
test_git_diff_detector() {
  local detector="$AGENTS_ROOT/tests/lib/git-diff-detector.sh"
  if [ ! -f "$detector" ]; then
    fail "git-diff-detector.sh 存在性" "$detector 不存在"
    return
  fi
  # source 並呼叫函式
  source "$detector"
  local result
  result=$(detect_relevant_validators)
  # 預期至少含一個 validator name（fast mode 從不返回空字串；無變更時 fallback 跑全部）
  if [ -n "$result" ]; then
    pass "git-diff-detector.sh detect_relevant_validators 正確輸出"
  else
    fail "git-diff-detector" "回傳空（應 fallback 跑全部）"
  fi
}

# Test 9: run-all.sh --help 顯示說明（PROPOSAL_20260423_008）
test_run_all_help() {
  local out
  out=$(bash "$AGENTS_ROOT/tests/run-all.sh" --help 2>&1)
  if echo "$out" | grep -q "Validator 執行入口"; then
    pass "run-all.sh --help 顯示說明"
  else
    fail "run-all.sh --help" "未顯示說明文字"
  fi
}

# Test 6: CURRENT_WORKSPACE 保護（已存在 + 無 --force + 回 "n" 取消）
test_current_workspace_guard() {
  local before
  before=$(cat "$AGENTS_ROOT/CURRENT_WORKSPACE" 2>/dev/null || echo "")
  local out
  out=$(echo "n" | timeout 5 node "$AGENTS_ROOT/scripts/init-workspace.mjs" --name smoke_cancel 2>&1)
  local after
  after=$(cat "$AGENTS_ROOT/CURRENT_WORKSPACE" 2>/dev/null || echo "")

  if [ "$before" = "$after" ] && echo "$out" | grep -q "使用者取消"; then
    pass "CURRENT_WORKSPACE 保護（無 --force + 回 n 正確取消）"
  else
    fail "CURRENT_WORKSPACE 保護" "取消流程異常（before=$before / after=$after）"
  fi
}

# -------- Main --------
setup
echo "🧪 Running scripts/ smoke tests (PROPOSAL_20260423_006 Part 3)"
echo ""
test_help
test_dry_run_no_write
test_success_path
test_rollback_path
test_framework_diff_self
test_current_workspace_guard
test_run_all_single_mode
test_git_diff_detector
test_run_all_help
test_regenerate_indexes
test_gen_rules_version_index_dry_run
test_gen_framework_version_dry_run
test_tech_stack_audit_dry_run

echo ""
echo "========================================"
echo "Smoke Tests: $PASS_COUNT passed / $FAIL_COUNT failed"
if [ $FAIL_COUNT -gt 0 ]; then
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do echo "  - $t"; done
  exit 1
fi
echo "========================================"
exit 0
