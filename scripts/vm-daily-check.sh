#!/bin/bash
# =============================================================
# scripts/vm-daily-check.sh  v2.1
# VM crontab：執行 runDailyCheck（本地寫入 data/，不再 git push）
# =============================================================
set -euo pipefail

REPO_DIR="/home/ubuntu/investnotify"
TASK_NAME="runDailyCheck"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/daily.log"
LOCK_FILE="/tmp/investnotify-daily.lock"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
NOTIFY_SCRIPT="$REPO_DIR/scripts/notify-error.sh"

mkdir -p "$LOG_DIR"

# ── 並發鎖：防止同時執行 ─────────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
  echo "[$TIMESTAMP] [${TASK_NAME}] ⚠️  Lock 存在，略過本次" >> "$LOG_FILE"
  exit 0
fi
touch "$LOCK_FILE"

# ── 錯誤 trap：失敗時發 Telegram 通知 ────────────────────────
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

# ── 執行 Runner（--env-file 讓 Node.js 自行解析 .env）────────
echo "[$TIMESTAMP] [${TASK_NAME}] node --env-file=$REPO_DIR/.env src/runDailyCheck.mjs" >> "$LOG_FILE"
node --env-file="$REPO_DIR/.env" src/runDailyCheck.mjs >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] [${TASK_NAME}] ✅ 執行完畢" >> "$LOG_FILE"
