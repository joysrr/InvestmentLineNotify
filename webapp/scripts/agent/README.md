# Agent UI Verification Kit

給 AI Agent 用的前端改動自驗證系統。**不影響正式部署**：只跑本機 dev server + mock API，不碰生產後端。

## 首次安裝（容器重建 / 新機器必跑）

```bash
sh scripts/agent/install-deps.sh
```

它會做這幾件事：

1. `apk add chromium rsync git nodejs npm font-noto-cjk fontconfig`
2. 寫 `/root/.config/fontconfig/fonts.conf` —— **讓 CJK 字體真正生效**（沒這步截圖裡看不到中文）
3. `npm install`（playwright/pixelmatch/pngjs/pino）
4. 自檢：fc-match + 4 個 npm 套件

## 日常用法

```bash
cd /root/work/InvestmentLineNotify/webapp

# 一次性：拍基準
setsid npx vite --config vite.config.mjs --port 5174 --strictPort < /dev/null > /tmp/vite.log 2>&1 &
disown 2>/dev/null || true
sleep 8
TMPDIR=/tmp CHROMIUM_PATH=/usr/bin/chromium node scripts/agent/baseline.mjs

# 改動後：驗證
TMPDIR=/tmp CHROMIUM_PATH=/usr/bin/chromium node scripts/agent/verify.mjs
cat .agent-report/latest/REPORT.md

# 或直接用 run.sh（內部已用 setsid + trap 處理生命週期）
sh scripts/agent/run.sh baseline
sh scripts/agent/run.sh verify
```

## 三個關鍵陷阱

### 1. CJK 字體

Alpine 預設無 CJK 字體，Chromium 用 Open Sans 渲染中文 → 全部空白。
- 診斷：`fc-match "sans-serif:lang=zh"` 應顯示 Noto Sans CJK，否則 `fc-list | grep -ic cjk` 看是否為 0
- 修復：`scripts/agent/install-deps.sh` 已包含
- 驗證：截圖中間調像素（亮度 80-200）應占 2%-5%，接近 0% = 無字體

### 2. vite 生命週期

App 每條 bash 命令獨立 shell，`npx vite &` 會被 shell 退出帶走。
- 修復：`setsid npx vite ... < /dev/null &`
- 驗證：下一條命令 `node -e "fetch(...)"` 應返回 200

### 3. 截圖 hash 唯一性

7 張截圖 hash 必須全不相同。如果相同（且都是 ~50-60KB），說明抓的都是同一個錯誤頁。
```bash
node -e "const m=require('./.agent-baseline/manifest.json'); console.log('unique:', new Set(m.routes.map(r=>r.screenshotHash)).size, '/', m.routes.length);"
# 必須 7/7
```

## 檔案結構

```
scripts/agent/
├── install-deps.sh       一次性環境安裝
├── run.sh                入口（pull/push/rollback/baseline/verify）
├── baseline.mjs          拍基準
├── verify.mjs            驗證
└── lib/
    ├── routes.mjs        頁面清單
    ├── fixtures.mjs      API mock
    ├── browser.mjs       Chromium + Telegram mock
    ├── capture.mjs       截圖 + error 收集
    └── diff.mjs          pixelmatch
```

## 完整手冊

見 `docs/AGENT-UI-HANDBOOK.md`（含架構 / 陷阱 / 安全邊界 / 從零重建 / GitHub 同步）。
