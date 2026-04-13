#!/bin/bash
# =============================================================
# scripts/vm-monthly-report.sh  v1.0
# VM crontab：執行 runMonthlyReport（每月1日 09:00）
# =============================================================
set -euo pipefail

REPO_DIR="/home/ubuntu/investnotify"
TASK_NAME="runMonthlyReport"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/monthly.log"
LOCK_FILE="/tmp/investnotify-monthly.lock"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
NOTIFY_SCRIPT="$REPO_DIR/scripts/notify-error.sh"

mkdir -p "$LOG_DIR"

if [ -f "$LOCK_FILE" ]; then
  echo "[$TIMESTAMP] [${TASK_NAME}] ⚠️  Lock 存在，略過本次" >> "$LOG_FILE"
  exit 0
fi
touch "$LOCK_FILE"

on_error() {
  local exit_code="$?"
  local line="$1"
  local err_snippet
  err_snippet=$(tail -20 "$LOG_FILE" 2>/dev/null || echo "（無法讀取 log）")
  echo "[$TIMESTAMP] [${TASK_NAME}] ❌ 執行失敗於 Line ${line}，exit=${exit_code}" >> "$LOG_FILE"
  bash "$NOTIFY_SCRIPT" "$TASK_NAME" "Line ${line} exit=${exit_code}\n---\n${err_snippet}" "$exit_code"
}
trap 'on_error $LINENO' ERR
trap "rm -f $LOCK_FILE" EXIT

echo "" >> "$LOG_FILE"
echo "[$TIMESTAMP] [${TASK_NAME}] ========== 開始執行 ==========" >> "$LOG_FILE"

cd "$REPO_DIR"


echo "[$TIMESTAMP] [${TASK_NAME}] node --env-file="$REPO_DIR/.env" src/runMonthlyReport.mjs" >> "$LOG_FILE"
node --env-file="$REPO_DIR/.env" src/runMonthlyReport.mjs >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] [${TASK_NAME}] ✅ 執行完畢" >> "$LOG_FILE"
