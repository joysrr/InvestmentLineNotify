#!/usr/bin/env bash
# Auto Deploy Script for InvestmentLineNotify to Oracle VM
# Usage: ./scripts/deploy_vm.sh [--dry-run]

set -euo pipefail

# =============================================================================
# 設定區域 (請依實際環境調整)
# =============================================================================

VM_HOST="132.145.113.137"
VM_USER="ubuntu"
SSH_KEY="~/.ssh/oracle_vm.pem"
PROJECT_DIR="/home/ubuntu/investnotify"  # VM 上專案路徑
BRANCH="main"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# =============================================================================
# 主流程
# =============================================================================

main() {
  local dry_run=false
  if [[ "${1:-}" == "--dry-run" ]]; then
    dry_run=true
    export DRY_RUN=true
    log_warn "=== DRY RUN 模式：不會實際執行遠端指令 ==="
  fi

  log_info "開始部署 InvestmentLineNotify 至 Oracle VM"
  log_info "目標: $VM_USER@$VM_HOST:$PROJECT_DIR"
  log_info "分支: $BRANCH"

  # 1. 本地確認狀態
  log_info "步驟 1/8: 檢查本地 Git 狀態..."
  run_local "git status --short"
  run_local "git log -1 --oneline"

  # 2. 推送最新代碼 (確保 VM 能 pull 到最新)
  log_info "步驟 2/8: 推送本地變更至 GitHub..."
  run_local "git push origin $BRANCH"

  # 3. VM: 進入專案目錄並拉取最新代碼
  log_info "步驟 3/8: VM 拉取最新代碼..."
  run_ssh "cd $PROJECT_DIR && git fetch origin && git reset --hard origin/$BRANCH"

  # 4. VM: 安裝根目錄依賴
  log_info "步驟 4/8: VM 安裝根目錄依賴 (npm install)..."
  run_ssh "cd $PROJECT_DIR && npm install"

  # 5. VM: 安裝 webapp 依賴
  log_info "步驟 5/8: VM 安裝 webapp 依賴..."
  run_ssh "cd $PROJECT_DIR/webapp && npm install"

  # 6. VM: 建構前端
  log_info "步驟 6/8: VM 建構前端 (npm run build)..."
  run_ssh "cd $PROJECT_DIR/webapp && npm run build"

  # 7. VM: 重啟 PM2 服務
  log_info "步驟 7/8: VM 重啟 PM2 服務..."
  run_ssh "cd $PROJECT_DIR && pm2 reload all"

  # 8. VM: 驗證部署
  log_info "步驟 8/8: 驗證部署狀態..."
  run_ssh "cd $PROJECT_DIR && pm2 list"
  run_ssh "curl -s http://localhost:3000/health"
  run_ssh "curl -s -X POST http://localhost:3000/api/v1/simulate -H 'Content-Type: application/json' -d '{\"price0050\": 180, \"priceZ2\": 120}' | head -c 200"

  log_success "部署完成！"
  log_info "後續可執行: ssh -i $SSH_KEY $VM_USER@$VM_HOST 'pm2 logs api-server --lines 50' 查看日誌"
}

main "$@"