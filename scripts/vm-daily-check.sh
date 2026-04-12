#!/bin/bash
# =============================================================
# scripts/vm-daily-check.sh
# VM crontab 排程腳本：執行 dailyCheck 並自動 commit/push data/
#
# 呼叫方式（crontab，需已設 TZ=Asia/Taipei）：
#   30 7  * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
#   45 13 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# =============================================================

set -euo pipefail

REPO_DIR="/home/ubuntu/investnotify"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/vm-cron.log"
LOCK_FILE="/tmp/investnotify-daily.lock"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── log 目錄確保存在 ──────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── 執行鎖：防止並發衝突 ─────────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
  echo "[$TIMESTAMP] [vm-cron] ⚠️  已有執行中的任務（lock 存在），略過本次" >> "$LOG_FILE"
  exit 0
fi
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

echo "" >> "$LOG_FILE"
echo "[$TIMESTAMP] [vm-cron] ========== 開始執行 dailyCheck ==========" >> "$LOG_FILE"

cd "$REPO_DIR"

# ── Step 1：拉取最新 code（Actions 可能先 push） ──────────────
echo "[$TIMESTAMP] [vm-cron] Step 1: git pull" >> "$LOG_FILE"
git fetch origin main >> "$LOG_FILE" 2>&1
git reset --hard origin/main >> "$LOG_FILE" 2>&1

# ── Step 2：執行 dailyCheck ───────────────────────────────────
echo "[$TIMESTAMP] [vm-cron] Step 2: node src/runDailyCheck.mjs" >> "$LOG_FILE"
node src/runDailyCheck.mjs >> "$LOG_FILE" 2>&1

# ── Step 3：若 data/ 有變更，自動 commit & push ───────────────
echo "[$TIMESTAMP] [vm-cron] Step 3: git commit & push" >> "$LOG_FILE"
git add data/
if ! git diff --cached --quiet; then
  COMMIT_MSG="chore(data): [vm-cron] $(date '+%Y-%m-%d %H:%M') dailyCheck auto-update [skip ci]"
  git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1
  git push origin main >> "$LOG_FILE" 2>&1
  echo "[$TIMESTAMP] [vm-cron] ✅ data/ commit & push 完成" >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] [vm-cron] ℹ️  data/ 無變更，略過 commit" >> "$LOG_FILE"
fi

echo "[$TIMESTAMP] [vm-cron] ========== 執行完畢 ==========" >> "$LOG_FILE"
