#!/bin/bash
# Stable Playwright Verification Script
# Ensures clean environment before running tests

set -e

PROJECT_ROOT="/workspace/projects/InvestmentLineNotify"
WEBAPP_DIR="$PROJECT_ROOT/webapp"
PLAYWRIGHT_BROWSERS_PATH="/opt/hermes/.playwright"

echo "🧹 清理殘留進程..."
pkill -f "chromium" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true
sleep 2

echo "📡 啟動 API Server (3000)..."
cd "$PROJECT_ROOT"
export NODE_ENV=development
export BYPASS_INIT_DATA=true
export PORT=3000
node src/api/server.mjs > /tmp/api-server.log 2>&1 &
API_PID=$!
echo "API Server PID: $API_PID"

echo "💻 啟動 Vite Dev Server (5173)..."
cd "$WEBAPP_DIR"
export NODE_ENV=development
npx vite --port 5173 --strictPort > /tmp/vite.log 2>&1 &
VITE_PID=$!
echo "Vite PID: $VITE_PID"

cleanup() {
    echo "🧹 清理背景進程..."
    kill $API_PID $VITE_PID 2>/dev/null || true
    pkill -f "chromium" 2>/dev/null || true
}
trap cleanup EXIT

echo "⏳ 等待服務就緒..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null && curl -s http://localhost:5173 > /dev/null; then
        echo "✅ 服務就緒！"
        break
    fi
    sleep 1
done

if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ API Server 啟動失敗"
    cat /tmp/api-server.log
    exit 1
fi

if ! curl -s http://localhost:5173 > /dev/null; then
    echo "❌ Vite Dev Server 啟動失敗"
    cat /tmp/vite.log
    exit 1
fi

echo "🧪 執行 Playwright 測試..."
cd "$WEBAPP_DIR"
export PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH"

# Run specific test files with workers=2
npx playwright test \
    src/test/e2e/01-dashboard.spec.js \
    src/test/e2e/03-backtestReport.spec.js \
    src/test/e2e/04-account.spec.js \
    src/test/e2e/05-technical.spec.js \
    src/test/e2e/06-marketRadar.spec.js \
    src/test/e2e/07-macroBattle.spec.js \
    src/test/e2e/08-chartView.spec.js \
    src/test/e2e/09-reports.spec.js \
    src/test/e2e/10-news.spec.js \
    src/test/e2e/11-strategy.spec.js \
    --workers=2 \
    --reporter=line

echo "✅ 測試完成！"