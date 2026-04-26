#!/bin/bash
# scripts/notify-error.sh — VM Cron 錯誤通知（對齊 GitHub Actions 通知格式）
# 使用方式：bash notify-error.sh "任務名稱" "錯誤訊息" ["exit_code"]

TASK_NAME="${1:-未知任務}"
ERROR_MSG="${2:-未知錯誤}"
EXIT_CODE="${3:-1}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')

# 從 .env 讀取 token（使用 LOG bot，與 Actions 通知一致）
TELEGRAM_TOKEN=$(grep '^TELEGRAM_LOG_API_TOKEN=' /home/ubuntu/investnotify/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
TELEGRAM_USER_ID=$(grep '^TELEGRAM_USER_ID=' /home/ubuntu/investnotify/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$TELEGRAM_TOKEN" ] || [ -z "$TELEGRAM_USER_ID" ]; then
  echo "[$TIMESTAMP] [notify-error] ❌ 無法讀取 Telegram LOG 設定" >&2
  exit 1
fi

# 判斷 icon（對齊 Actions 的 case 邏輯）
case "$EXIT_CODE" in
  124) ICON="⏱️" ; CONCLUSION="timed_out" ;;
  130) ICON="⚠️" ; CONCLUSION="cancelled" ;;
  *)   ICON="❌" ; CONCLUSION="failure"   ;;
esac

MESSAGE="${ICON} VM Cron 排程異常

📋 任務：${TASK_NAME}
📌 狀態：${CONCLUSION}
🕹️ 觸發：VM crontab 自動觸發
⏰ 時間：${TIMESTAMP}
📦 主機：$(hostname)
📄 最後 log：
$(echo "${ERROR_MSG}" | head -20)"

curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_USER_ID}" \
  --data-urlencode text="${MESSAGE}" \
  > /dev/null 2>&1

echo "[$TIMESTAMP] [notify-error] 📨 通知已發送：${TASK_NAME} (${CONCLUSION})"
