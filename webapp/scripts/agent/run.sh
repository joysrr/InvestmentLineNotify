#!/bin/sh
# Agent UI verification runner (POSIX sh)
# Usage: scripts/agent/run.sh [pull|push|rollback|baseline|verify]

SDCARD_ROOT="/sdcard/Projects/InvestmentLineNotify"
WORK_ROOT="/root/work/InvestmentLineNotify"
WEBAPP="$WORK_ROOT/webapp"
PORT="${AGENT_PORT:-5174}"

export TMPDIR=/tmp
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pwbrowsers
export CHROMIUM_PATH=/usr/bin/chromium
export AGENT_BASE_URL="http://localhost:${PORT}"

RSYNC_COMMON="--no-perms --no-owner --no-group --no-links --no-devices --no-specials --omit-dir-times"

if [ ! -d "$WEBAPP" ]; then
  echo "[run] 錯誤：找不到工作區 $WEBAPP"
  exit 1
fi

CMD="${1:-verify}"
shift 2>/dev/null || true
EXTRA_ARGS="$@"

# ── 清理殘留進程（每次啟動前）──────────────────────
cleanup_procs() {
  # 陷阱 #14：chromium 有兩種 user-data-dir，舊版只殺 playwright profile，
  # 漏掉 --user-data-dir=/root/.config/chromium 的常駐實例（每輪累積 ~190MB）
  pkill -9 -f "chromium.*playwright_chromiumdev_profile" 2>/dev/null || true
  pkill -9 -f "chromium.*user-data-dir=/root/.config/chromium" 2>/dev/null || true
  pkill -9 -f "chrome_crashpad_handler" 2>/dev/null || true
  pkill -9 -f "node .*scripts/agent/(verify|baseline).mjs" 2>/dev/null || true
  pkill -9 -f "vite --config vite.config.mjs --port ${PORT}" 2>/dev/null || true
  pkill -9 -f "esbuild --service" 2>/dev/null || true
  rm -rf /tmp/playwright_chromiumdev_profile-* /tmp/.org.chromium.Chromium.* 2>/dev/null || true
  sleep 1
}

cleanup_procs
sleep 0.5

case "$CMD" in
  pull)
    echo "[pull] $SDCARD_ROOT → $WORK_ROOT"
    rsync -rlt $RSYNC_COMMON --delete \
      --exclude node_modules --exclude dist --exclude .git \
      --exclude .agent-baseline --exclude .agent-report \
      "$SDCARD_ROOT/" "$WORK_ROOT/"
    echo "[pull] 完成"
    exit 0
    ;;
  push)
    echo "[push] $WORK_ROOT/webapp/src → $SDCARD_ROOT/webapp/src"
    rsync -rlt $RSYNC_COMMON --delete "$WORK_ROOT/webapp/src/" "$SDCARD_ROOT/webapp/src/"
    echo "[push] scripts/agent → $SDCARD_ROOT/webapp/scripts/agent"
    mkdir -p "$SDCARD_ROOT/webapp/scripts/agent"
    rsync -rlt $RSYNC_COMMON "$WORK_ROOT/webapp/scripts/agent/" "$SDCARD_ROOT/webapp/scripts/agent/"
    echo "[push] package.json"
    cp -f "$WORK_ROOT/webapp/package.json" "$SDCARD_ROOT/webapp/package.json" 2>/dev/null || true
    echo "[push] 完成"
    exit 0
    ;;
  rollback)
    if [ ! -d "$WORK_ROOT/.git" ]; then
      echo "[rollback] 錯誤：$WORK_ROOT 尚未 git init"
      exit 1
    fi
    cd "$WORK_ROOT"
    git checkout -- webapp/src/ 2>/dev/null || true
    echo "[rollback] webapp/src/ 已還原至 git HEAD"
    exit 0
    ;;
  baseline)
    # 預設不同步 /sdcard：工作區是唯一真相，避免覆蓋未提交的改動。
    # 若要強制以生產源碼為基準（例如接手他人改動後重建），設 AGENT_BASELINE_SYNC=1。
    if [ "${AGENT_BASELINE_SYNC:-0}" = "1" ]; then
      echo "[baseline] 同步源碼 /sdcard → $WEBAPP（AGENT_BASELINE_SYNC=1）"
      rsync -rlt $RSYNC_COMMON \
        --exclude node_modules --exclude dist \
        "$SDCARD_ROOT/webapp/src/" "$WEBAPP/src/"
    else
      echo "[baseline] 使用工作區當前源碼（不同步 /sdcard）"
    fi
    SCRIPT_NAME="baseline.mjs"
    ;;
  verify)
    echo "[verify] 使用工作區當前源碼（不同步 /sdcard）"
    SCRIPT_NAME="verify.mjs"
    ;;
  *)
    echo "用法：$0 [pull|push|rollback|baseline|verify]"
    exit 1
    ;;
esac

cd "$WEBAPP"

# ── 啟動 vite（用 setsid 獨立進程組，方便一次殺死所有子進程）──────
echo "[$CMD] 啟動 vite (port $PORT)"
setsid npx vite --config vite.config.mjs --port "$PORT" --strictPort > /tmp/agent-vite.log 2>&1 &
VITE_PID=$!

# 退出時殺整個進程組
trap 'kill -9 -$VITE_PID 2>/dev/null; pkill -9 -f "chromium.*playwright" 2>/dev/null; rm -rf /tmp/playwright_chromiumdev_profile-* 2>/dev/null' EXIT INT TERM

# 等 vite 就緒
READY=0
for i in $(seq 1 80); do
  if node -e "fetch('http://localhost:$PORT/').then(r=>process.exit(r.ok||r.status===404?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    READY=1
    echo "[$CMD] vite 就緒"
    break
  fi
  sleep 0.25
done

if [ "$READY" != "1" ]; then
  echo "[$CMD] FAIL: vite 未在 20 秒內就緒"
  tail -30 /tmp/agent-vite.log
  exit 1
fi

# ── 跑 baseline/verify ───────────────────────────
node "scripts/agent/$SCRIPT_NAME" $EXTRA_ARGS
RC=$?

# 主動清理（trap 也會跑，但這裡提早釋放記憶體）
kill -9 -$VITE_PID 2>/dev/null || true
pkill -9 -f "chromium.*playwright" 2>/dev/null || true
rm -rf /tmp/playwright_chromiumdev_profile-* 2>/dev/null || true

trap - EXIT INT TERM
exit $RC
