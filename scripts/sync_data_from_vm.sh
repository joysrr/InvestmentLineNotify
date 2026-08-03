#!/usr/bin/env bash
# Sync Data from Oracle VM to Local Development Environment
# Usage: ./scripts/sync_data_from_vm.sh [--dry-run]

set -euo pipefail

# =============================================================================
# 設定區域
# =============================================================================

VM_HOST="132.145.113.137"
VM_USER="ubuntu"
SSH_KEY="~/.ssh/oracle_vm.pem"
VM_PROJECT_DIR="/home/ubuntu/investnotify"
LOCAL_PROJECT_DIR="/Users/han/Project/InvestmentLineNotify"

# 要同步的資料目錄
DATA_DIRS=(
  "data/market"
  "data/market/history"
  "data/reports"
  "data/stock_history"
  "data/ai_logs"
  "data/news_logs"
  "data/cache"
)

# 排除的檔案模式
EXCLUDE_PATTERNS=(
  "*.log"
  "*.tmp"
  ".gitkeep"
)

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# =============================================================================
# 輔助函式
# =============================================================================

run_ssh() {
  local cmd="$1"
  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    log_info "[DRY-RUN] ssh $VM_USER@$VM_HOST \"$cmd\""
  else
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VM_USER@$VM_HOST" "$cmd"
  fi
}

run_local() {
  local cmd="$1"
  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    log_info "[DRY-RUN] $cmd"
  else
    eval "$cmd"
  fi
}

build_rsync_excludes() {
  local excludes=""
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    excludes="$excludes --exclude='$pattern'"
  done
  echo "$excludes"
}

# =============================================================================
# 主流程
# =============================================================================

main() {
  local dry_run=false
  if [[ "${1:-}" == "--dry-run" ]]; then
    dry_run=true
    export DRY_RUN=true
    log_warn "=== DRY RUN 模式：不會實際同步資料 ==="
  fi

  log_info "開始從 VM 同步資料至本機開發環境"
  log_info "來源: $VM_USER@$VM_HOST:$VM_PROJECT_DIR/data/"
  log_info "目標: $LOCAL_PROJECT_DIR/data/"

  # 確保本機目錄存在
  for dir in "${DATA_DIRS[@]}"; do
    run_local "mkdir -p $LOCAL_PROJECT_DIR/$dir"
  done

  # 同步各目錄
  local excludes=$(build_rsync_excludes)
  
  for dir in "${DATA_DIRS[@]}"; do
    log_info "同步 $dir ..."
    
    # 檢查 VM 上目錄是否存在
    if run_ssh "test -d $VM_PROJECT_DIR/$dir"; then
      if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY-RUN] rsync -avz --progress -e \"ssh -i $SSH_KEY -o StrictHostKeyChecking=no\" $excludes $VM_USER@$VM_HOST:$VM_PROJECT_DIR/$dir/ $LOCAL_PROJECT_DIR/$dir/"
      else
        rsync -avz --progress -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" $excludes "$VM_USER@$VM_HOST:$VM_PROJECT_DIR/$dir/" "$LOCAL_PROJECT_DIR/$dir/"
      fi
      log_success "  $dir 同步完成"
    else
      log_warn "  VM 上 $dir 不存在，跳過"
    fi
  done

  # 顯示同步後統計
  log_info "同步完成，本機資料統計:"
  for dir in "${DATA_DIRS[@]}"; do
    if [[ -d "$LOCAL_PROJECT_DIR/$dir" ]]; then
      local count=$(find "$LOCAL_PROJECT_DIR/$dir" -type f -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
      local size=$(du -sh "$LOCAL_PROJECT_DIR/$dir" 2>/dev/null | cut -f1)
      log_info "  $dir: $count 個 JSON 檔案, $size"
    fi
  done

  log_success "資料同步完成！"
}

main "$@"