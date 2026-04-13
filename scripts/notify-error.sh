#!/bin/bash
# scripts/notify-error.sh — Telegram 錯誤通知
# 使用方式：bash notify-error.sh "任務名稱" "錯誤訊息"

TASK_NAME="${1:-未知任務}"
ERROR_MSG="${2:-未知錯誤}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 從 .env 讀取 token
TELEGRAM_TOKEN=$(grep '^TELEGRAM_LOG_API_TOKEN=' /home/ubuntu/investnotify/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
TELEGRAM_USER_ID=$(grep '^TELEGRAM_USER_ID=' /home/ubuntu/investnotify/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$TELEGRAM_TOKEN" ] || [ -z "$TELEGRAM_USER_ID" ]; then
  echo "[$TIMESTAMP] [notify-error] ❌ 無法讀取 Telegram 設定" >&2
  exit 1
fi

MESSAGE="🚨 *\[VM Cron 錯誤\]*
任務：\`${TASK_NAME}\`
時間：\`${TIMESTAMP}\`
最後錯誤：
\`\`\`
$(echo "${ERROR_MSG}" | head -20)
\`\`\`"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_USER_ID}" \
  --data-urlencode "parse_mode=Markdown" \
  --data-urlencode "text=${MESSAGE}" \
  > /dev/null 2>&1

echo "[$TIMESTAMP] [notify-error] 📨 通知已發送：${TASK_NAME}"
EOF