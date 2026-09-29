#!/bin/bash
# =============================================================
# scripts/vm-daily-check.sh  v2.1
# VM crontab：執行 runDailyCheck（本地寫入 data/，不再 git push）
# =============================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/investnotify}"
TASK_NAME="runDailyCheck"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/daily.log"
LOCK_DIR="${LOCK_DIR:-/tmp/investnotify-daily.lock.d}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-2700}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
NOTIFY_SCRIPT="$REPO_DIR/scripts/notify-error.sh"

mkdir -p "$LOG_DIR"

# ── 原子並發鎖：防止同時執行 ─────────────────────────────────
acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_DIR/pid"
    printf '%s\n' "$TIMESTAMP" > "$LOCK_DIR/started_at"
    return 0
  fi

  local owner_pid=""
  if [ -r "$LOCK_DIR/pid" ]; then
    owner_pid=$(cat "$LOCK_DIR/pid")
  fi

  if [ -n "$owner_pid" ] && kill -0 "$owner_pid" 2>/dev/null; then
    echo "[$TIMESTAMP] [${TASK_NAME}] ⚠️  Lock 存在，略過本次 (pid=${owner_pid})" >> "$LOG_FILE"
    exit 0
  fi

  echo "[$TIMESTAMP] [${TASK_NAME}] ⚠️  清理失效 lock，重新取得" >> "$LOG_FILE"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
  printf '%s\n' "$TIMESTAMP" > "$LOCK_DIR/started_at"
}
acquire_lock

# ── 錯誤 trap：失敗時發 Telegram 通知 ────────────────────────
on_error() {
  local exit_code="$?"
  local line="$1"
  local err_snippet
  err_snippet=$(tail -20 "$LOG_FILE" 2>/dev/null || echo "（無法讀取 log）")
  echo "[$TIMESTAMP] [${TASK_NAME}] ❌ 執行失敗於 Line ${line}，exit=${exit_code}" >> "$LOG_FILE"
  bash "$NOTIFY_SCRIPT" "$TASK_NAME" "Line ${line} exit=${exit_code}\n---\n${err_snippet}" "$exit_code" || true
  return "$exit_code"
}
trap 'on_error $LINENO' ERR
trap 'rm -rf "$LOCK_DIR"' EXIT

echo "" >> "$LOG_FILE"
echo "[$TIMESTAMP] [${TASK_NAME}] ========== 開始執行 ==========" >> "$LOG_FILE"

cd "$REPO_DIR"

# ── 執行 Runner（--env-file 讓 Node.js 自行解析 .env，--dns-result-order=ipv4first 避免 IPv6 路由黑洞延遲）────────
echo "[$TIMESTAMP] [${TASK_NAME}] node --dns-result-order=ipv4first --env-file=$REPO_DIR/.env src/runDailyCheck.mjs" >> "$LOG_FILE"
timeout --signal=TERM --kill-after=30 "$TIMEOUT_SECONDS" \
  node --dns-result-order=ipv4first --env-file="$REPO_DIR/.env" src/runDailyCheck.mjs >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] [${TASK_NAME}] ✅ 執行完畢" >> "$LOG_FILE"
