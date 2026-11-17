# Agent UI Verification Kit (v2.0)

給 AI Agent 用的前端改動自驗證系統。

**v2.0 起驗證基線 = GitHub `origin/main` + production build**，不再依賴本地像素截圖
（容器記憶體不足，Chromium 啟動即 OOM）。完整說明見上層 `AGENT-UI-HANDBOOK.md`。

## 日常用法

```bash
cd /root/work/InvestmentLineNotify/webapp

npm run ui:verify    # 對比 origin/main + 跑 production build
npm run ui:report    # 看 .agent-report/latest/REPORT.md
npm run ui:push      # 驗證通過 → commit → push origin main
npm run ui:rollback  # 回滾 webapp/src
```

## 檔案結構

```
scripts/agent/
├── verify-git.mjs     ★ v2.0 主驗證（git 基線 + build 門禁）
├── push-git.sh        ★ v2.0 交付（驗證 → commit → push）
├── install-deps.sh    環境安裝（像素模式才需要）
├── run.sh             舊像素流程入口（pull/push/rollback/baseline/verify）
├── baseline.mjs       拍基準（像素模式）
├── verify.mjs         像素比對（像素模式）
└── lib/
    ├── routes.mjs     7 頁清單
    ├── fixtures.mjs   API mock
    ├── browser.mjs    Chromium + Telegram mock
    ├── capture.mjs    截圖 + error 收集
    └── diff.mjs       pixelmatch
```

## 三個必知陷阱

### 1. root node_modules 軟鏈丟失（最常踩）

沙箱重啟後 `/root/work/InvestmentLineNotify/node_modules` 軟鏈會消失，
導致 build 報 `Rollup failed to resolve import "pino"`。

```bash
cd /root/work/InvestmentLineNotify
ln -sfn webapp/node_modules node_modules
ls -la node_modules    # 應顯示 -> webapp/node_modules
```

### 2. 像素驗證 OOM

`npm run ui:verify:pixel` 需要 Chromium。目前 available ~3GB，第一頁截圖就被 `Killed`。
**日常一律用 `npm run ui:verify`（git 基線）**。

若真要跑像素模式，先清殘留進程（注意 pattern 別太寬，會殺到自己 shell）：

```bash
pkill -9 -f "chromium.*playwright" ; pkill -9 -f "chrome_crashpad" ; pkill -9 -f esbuild
```

### 3. CJK 字體（僅像素模式相關）

Alpine 預設無 CJK 字體，截圖中文會全空白。`install-deps.sh` 已處理。

## 完整手冊

見 `webapp/AGENT-UI-HANDBOOK.md`。

## 探針腳本（v2.2 新增）

| 腳本 | 用途 |
|---|---|
| `diag-ep-tokens.mjs` | EP → M3 token 雙模式探針（light + dark），改 overrides.css 後必跑 |
| `diag-collapse.mjs` | el-collapse 高度/樣式，EP CSS 疑似裸奔時 |
| `diag-strategy.mjs` | strategy-config 頁 loader/empty/error 三態 |
| `dom-style-assert.mjs` | 7 頁 DOM + 關鍵樣式斷言 |
| `img2ascii.mjs` | 截圖 → ASCII（記憶體不足時的視覺替代） |
| `visual-assert.mjs` | 視覺斷言（自訂閾值） |

**chromium 必需**：`--use-gl=angle --use-angle=gl-egl`（缺則 SIGABRT）。

### EP 主題問題 6 步排查

詳見 `AGENT-UI-HANDBOOK.md` 第 11 節。要點：alias isTest 守衛 → main.js import 順序 → 派生色階 light-9/dark-2 → 組件級 !important → dark 獨立覆蓋 → diag-ep-tokens 雙段驗證。

**注意**：`check-no-raw-color.mjs` 不掃 `.css`，overrides.css 已入 whitelist。

## Boot 時序探針（v2.3 新增）

| 腳本 | 用途 |
|---|---|
| `debug-bridge.mjs` | 讀 `window.__TELEGRAM_BRIDGE__` 快照 + 計算 mount/ready/goto 耗時 + DOM 狀態 + console errors |

**用法**：