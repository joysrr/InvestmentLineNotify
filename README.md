# InvestmentLineNotify

> 🤖 **AI 驅動的台灣 ETF 投資決策與通知系統**
> 專為 0050 / 00675L 生命周期投資法設計，每日自動分析市場、產出行動建議並推播至 Telegram。

---

## 目錄

- [專案簡介](#專案簡介)
- [核心特色](#核心特色)
- [系統架構](#系統架構)
- [快速上手](#快速上手)
- [環境變數設定](#環境變數設定)
- [排程總覽](#排程總覽)
- [常用指令](#常用指令)
- [專案結構](#專案結構)
- [文件索引](#文件索引)

---

## 專案簡介

本專案是一套以 **Node.js** 為核心的投資決策自動化系統，整合市場資料抓取、多重 AI 代理分析、量化風控計算與 Telegram 推播，涵蓋：

- 📅 每日盤前 / 盤中 / 午盤 / 收盤後 / 夜間美股觀測報告
- 📰 每 4 小時自動更新的新聞池與 AI 新聞治理
- 📊 每週 / 每月 AI 週報與月報生成
- 💬 Telegram Bot 即時互動指令（`/daily`、`/status`、`/weekly` 等）
- 📱 Telegram Mini App 儀表板（總覽 / 雷達 / 多空 / 圖表 / 報告 / 新聞 / 設定 / **模擬器**）

---

## 核心特色

| 特色                    | 說明                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **無資料庫設計**        | 以 `data/` 檔案庫 + Google Sheets 取代傳統 DB，降低維護成本                                                      |
| **多階段 AI 管線**      | 新聞過濾器 → 總經多空分析師 → 投資教練 → LLM Judge，結構化輸出防幻覺                                             |
| **動態量化風控**        | 維持率斷頭計算、RSI/KD/MACD 過熱閥値、冷卻期與極端恐慰破冰機制                                                   |
| **帳戶快照加密**        | 持倉數字以 AES-256-GCM 加密存儲，`.env` 金鑰本地管理                                                             |
| **全面 VM 排程**        | 所有定時任務已統一由 Oracle VM crontab 執行，避免 GitHub Actions schedule 延遲                                   |
| **Telegram Mini App**   | Fastify API Server + Vue 3 前端，即時瀏覽資產趨勢、市場雷達與新聞池                                              |
| **0050 雙向模擬器**     | 正向股價→策略分數、反向目標→股價推導，支援 9 種目標類型（維持率、RSI、MA、KD、MACD、策略分數、Portfolio Health） |
| **Provider 架構抽象化** | `dataSourceConfig.mjs` + `providerRegistry.mjs` Slot-based 設計，抽換資料來源只需改 config，不動上層程式碼       |

---

## 系統架構

```
Telegram 使用者 ──→ bot.mjs (grammY Long-Polling)
                          │
Mini App (Vue 3) ──→ api/server.mjs (Fastify, Port 3000)
                          │
VM crontab / CLI ─→ Runner Layer
    ├── runDailyCheck.mjs      ← 每日主流程
    ├── runNewsFetch.mjs       ← 新聞池更新
    ├── runOptimizer.mjs       ← 新聞治理規則優化
    ├── runWeeklyReport.mjs    ← AI 週報
    └── runMonthlyReport.mjs   ← AI 月報
              │
    ┌─────────┴──────────┐
    │  Core Modules      │
    │  providers/        │  ← 市場資料（TWSE / Yahoo / FRED / CNN / KGI / NDC）
    │                    │    含大盤指數收盤、成交金額（FMTQIK）、VIX、PE/PB、匯率等
    │  strategy/         │  ← 量化指標計算
    │  ai/               │  ← Gemini AI 決策管線
    │  notifications/    │  ← Telegram 推播
    └─────────┬──────────┘
              │
    ┌─────────┴──────────┐
    │  Persistence       │
    │  data/             │  ← 本地 JSON 快取
    │  Google Sheets     │  ← 持股狀態 / 每日紀錄
    │  Langfuse          │  ← AI 決策追蹤（選填）
    └────────────────────┘
```

> 完整 Mermaid 架構圖請見 [`docs/modules/_index.md`](docs/modules/_index.md)

---

## 快速上手

### 1. 環境需求

- **Node.js** v18 以上（需支援 ESM）
- **Oracle VM**（或任意 Linux 伺服器）用於部署 PM2 長駐程序與 crontab
- **Google Sheets** 服務帳號（用於讀寫持股狀態）
- **Telegram Bot Token**（透過 @BotFather 申請）
- **Gemini API Key**（至少一把，建議三把輪替）

### 2. 安裝

```bash
git clone https://github.com/joysrr/InvestmentLineNotify.git
cd InvestmentLineNotify
npm install
```

### 3. 設定環境變數

在根目錄建立 `.env`，填入所有必要金鑰（詳見[環境變數設定](#環境變數設定)）：

```bash
cp .env.example .env   # 若無範本，手動建立 .env
```

### 4. 手動執行每日檢查

```bash
# 完整執行（含 Telegram 推播 + AI 分析）
node src/runDailyCheck.mjs

# 開發模式（不推播、不消耗 AI Token）
node src/runDailyCheck.mjs --telegram=false --aiAdvisor=false
```

### 5. 啟動長駐服務（VM 部署）

```bash
# 啟動 Telegram Bot
pm2 start src/bot.mjs --name bot-daemon --max-memory-restart 200M

# 啟動 API Server（供 Mini App 使用）
pm2 start src/api/server.mjs --name api-server --max-memory-restart 300M

# 開機自動啟動
pm2 save && pm2 startup
```

> ⚠️ `bot-daemon` 啟動時自動帶入 `drop_pending_updates: true`，避免 Bot 重啟後吹送舊指令積塊。詳見 [`docs/modules/presentation/_index.md`](docs/modules/presentation/_index.md)。

### 6. 設定 VM crontab

```bash
crontab -e
```

加入以下內容（時區需為 `Asia/Taipei`）：

```cron
# ── DuckDNS IP 自動更新 ─────────────────────────────────
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=YOUR_DOMAIN&token=YOUR_TOKEN&ip=" > /dev/null

# ── runDailyCheck（每日 5 次）────────────────────────────
# 盤前報告 07:30
30 7  * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# 盤中觀測 10:30
30 10 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# 午盤 12:00
0  12 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# 收盤後總結 13:45
45 13 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
# 夜間美股觀測 21:30
30 21 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh

# ── runNewsFetch（每 4 小時）─────────────────────────────
0  */4 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-news-fetch.sh

# ── runOptimizer（每日 02:00）────────────────────────────
0  2  * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-optimizer.sh

# ── runWeeklyReport（每週一 09:30）──────────────────────
30 9  * * 1 /bin/bash /home/ubuntu/investnotify/scripts/vm-weekly-report.sh

# ── runMonthlyReport（每月 1 日 09:00）──────────────────────
0  9  1 * * /bin/bash /home/ubuntu/investnotify/scripts/vm-monthly-report.sh

# ── Log 輪替（每週日 03:00 清理 30 天前的 log）──────────────
0  3  * * 0 find /home/ubuntu/investnotify/logs -name "*.log" -mtime +30 -delete
```

---

## 環境變數設定

> 完整說明請見 [`docs/modules/operations/env_vars.md`](docs/modules/operations/env_vars.md)

### 必填項目

| 分類              | 變數名稱                              | 說明                                   |
| ----------------- | ------------------------------------- | -------------------------------------- |
| **Telegram**      | `TELEGRAM_API_TOKEN`                  | 主 Bot Token（每日 / 週 / 月報告推播） |
| **Telegram**      | `TELEGRAM_LOG_API_TOKEN`              | Log Bot Token（Workflow 異常告警）     |
| **Telegram**      | `TELEGRAM_USER_ID`                    | 接收訊息的使用者 ID                    |
| **Telegram**      | `TELEGRAM_WEBAPP_URL`                 | Mini App URL                           |
| **Google Sheets** | `GOOGLE_SERVICE_ACCOUNT_EMAIL`        | GCP 服務帳號 Email                     |
| **Google Sheets** | `GOOGLE_PRIVATE_KEY`                  | GCP 服務帳號私鑰（PEM 格式）           |
| **Google Sheets** | `GOOGLE_SHEET_ID`                     | 持股記錄試算表 ID                      |
| **Gemini AI**     | `GEMINI_API_KEY1` ~ `GEMINI_API_KEY3` | Gemini API 金鑰（三把輪替）            |
| **Gemini AI**     | `GEMINI_MODEL`                        | 模型名稱，如 `gemini-2.0-flash`        |
| **市場資料**      | `FRED_API_KEY`                        | FRED 聯準會資料庫 API                  |
| **市場資料**      | `BASE_PRICE_URL`                      | 0050 基準價外部服務端點                |
| **VM 部署**       | `VM_HOST`                             | Oracle VM IP 或 Domain                 |
| **VM 部署**       | `VM_USER`                             | SSH 登入使用者名稱                     |
| **VM 部署**       | `VM_SSH_PRIVATE_KEY`                  | SSH 私鑰（供 Actions 連線 VM）         |
| **快照加密**      | `SNAPSHOT_ENCRYPT_KEY`                | AES-256-GCM 金鑰（64 位 hex 字元）     |

**產生快照加密金鑰：**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 選填項目

| 變數名稱              | 說明                                 |
| --------------------- | ------------------------------------ |
| `LANGFUSE_SECRET_KEY` | Langfuse AI 決策追蹤（未設定時略過） |
| `LANGFUSE_PUBLIC_KEY` | Langfuse 前端金鑰                    |
| `LANGFUSE_BASE_URL`   | Langfuse 服務端點                    |

---

## 排程總覽

> 完整說明請見 [`docs/modules/operations/schedules.md`](docs/modules/operations/schedules.md)

### Oracle VM crontab（所有定時任務）

| 台灣時間        | 用途                |
| --------------- | ------------------- |
| 每 5 分鐘       | DuckDNS IP 更新     |
| 07:30 每日      | 🔴 盤前完整報告     |
| 10:30 每日      | 🟡 盤中觀測         |
| 12:00 每日      | 🟡 午盤回報         |
| 13:45 每日      | 🟡 收盤後總結       |
| 21:30 每日      | 🌙 夜間美股觀測     |
| 每 4 小時       | 📰 新聞池更新       |
| 02:00 每日      | ⚙️ Rule Optimizer   |
| 週一 09:30      | 📊 AI 週報生成      |
| 每月 1 日 09:00 | 📅 AI 月報生成      |
| 週日 03:00      | 🧹 清理 30 天前 log |

### Oracle VM PM2 長駐程序

| 程序名稱     | 說明                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| `api-server` | Fastify HTTP API（Port 3000），供 Mini App 呼叫                                               |
| `bot-daemon` | Telegram Bot Long-Polling，處理即時指令；帶 `drop_pending_updates: true` 防止重啟後消化舊指令 |

> 目前所有定時任務已全面移轉至 Oracle VM，`README` 不再將 GitHub Actions 視為主要排程平台。

---

## 常用指令

```bash
# 每日主流程（完整）
node src/runDailyCheck.mjs

# 開發模式（不推播，不消耗 AI Token）
node src/runDailyCheck.mjs --telegram=false --aiAdvisor=false

# 更新新聞池
node src/runNewsFetch.mjs

# 執行 Rule Optimizer
node src/runOptimizer.mjs

# 生成週報
node src/runWeeklyReport.mjs

# 生成月報
node src/runMonthlyReport.mjs

# 啟動 API Server（Mini App 後端）
npm run api

# 前端開發模式
cd webapp && npm run dev

# 前端 Build
cd webapp && npm run build

# 查看 PM2 服務狀態
pm2 list
pm2 monit

# 查看 VM cron 執行 log
tail -f logs/vm-cron.log
```

---

## 測試與驗證指令

> 詳細測試策略請見 [`docs/TESTING.md`](docs/TESTING.md)

### 本地開發 (頻繁執行)

```bash
# 後端單元/整合測試 (~15s)
npm run test

# 前端單元測試 (~10s)
cd webapp && npm run test

# Playwright E2E 測試 (~35s，含自動啟動伺服器)
cd webapp && npm run test:e2e

# Playwright 有頭模式除錯
cd webapp && npm run test:e2e:headed

# 觀看覆蓋率報告
npx vitest run --coverage
```

### Commit 前 (強制)

```bash
# 完整 pipeline (測試 + 建置 + OpenAPI)
npm run verify
```

### 部署前 (必要)

```bash
# 完整 pipeline (含 E2E)
npm run pre-deploy
```

### 部署

```bash
# 完整部署 (含 pre-deploy 驗證)
npm run deploy

# 只跑驗證不部署 (二次確認)
npm run deploy:dry

# 緊急部署 (跳過 pre-deploy，謹慎使用)
npm run deploy -- --skip-pre
```

---

## 專案結構

```
InvestmentLineNotify/
├── src/
│   ├── runDailyCheck.mjs        ← 每日主流程 CLI 入口
│   ├── runNewsFetch.mjs         ← 新聞抓取流程
│   ├── runOptimizer.mjs         ← 新聞治理規則優化
│   ├── runWeeklyReport.mjs      ← AI 週報
│   ├── runMonthlyReport.mjs     ← AI 月報
│   ├── bot.mjs                  ← Telegram Bot 長駐程序
│   ├── api/
│   │   ├── server.mjs           ← Fastify API Server（Port 3000）
│   │   ├── middleware/          ← initDataGuard（HMAC-SHA256 驗證）
│   │   └── routes/              ← /api/status, /api/reports, /api/news, /api/snapshots, /api/v1/simulate
│   ├── modules/
│   │   ├── providers/           ← 市場資料（TWSE / Yahoo / FRED / CNN / KGI / NDC）
│   │   │                           含大盤指數收盤與成交金額（FMTQIK）、VIX、PE/PB、匯率等 8 個 Slot
│   │   │                           架構：dataSourceConfig.mjs + providerRegistry.mjs（Slot-based）
│   │   ├── strategy/            ← RSI / KD / MACD 量化指標 + 風控引擎
│   │   ├── simulator/           ← 0050 雙向模擬器（正向/反向/掃描器）
│   │   ├── ai/                  ← Gemini AI 決策管線（新聞過濾 / 總經分析 / 投資教練）
│   │   ├── notifications/       ← Telegram HTML 訊息排版與推播
│   │   ├── data/
│   │   │   ├── newsPoolManager.mjs  ← 新聞池 CRUD + TTL 清理
│   │   │   └── archiveManager.mjs   ← 本地 JSON 讀寫管理
│   │   ├── bot/                 ← runnerLock / adminGuard
│   │   └── storage.mjs          ← Google Sheets 同步
│   ├── utils/
│   │   ├── snapshotCrypto.mjs   ← AES-256-GCM 快照加解密
│   │   ├── coreUtils.mjs        ← TwDate / fetchWithTimeout 等工具
│   │   └── envGuard.mjs         ← 啟動時環境變數驗證
│   └── test/                    ← 手動測試與回測腳本
├── webapp/                       ← Vite + Vue 3 Telegram Mini App
│   └── src/views/                ← 7 個 Tab（總覽 / 雷達 / 多空 / 圖表 / 報告 / 新聞 / 設定 / 模擬器）
├── scripts/
│   ├── vm-daily-check.sh        ← VM daily runner
│   ├── vm-news-fetch.sh         ← VM news fetch runner
│   ├── vm-optimizer.sh          ← VM optimizer runner
│   ├── vm-weekly-report.sh      ← VM weekly report runner
│   └── vm-monthly-report.sh     ← VM monthly report runner
├── data/                         ← 本地 JSON 快取（.gitignore，不進版本控制）
├── docs/                         ← 系統文件
└── .github/workflows/            ← GitHub Actions（保留手動/非主要用途）
```

---

## 文件索引

> 本 README 為專案快速上手指南，完整架構設計、模組規格與單一真理源請查閱 [`docs/README.md`](docs/README.md)。

| 文件                                                                                                 | 說明                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [`docs/README.md`](docs/README.md)                                                                   | **文件總導航中心**（架構、模組規格、決策 ADR、真理之源與 Wiki 地圖）                                                                 |
| [`docs/modules/_index.md`](docs/modules/_index.md)                                                   | 系統總覽、Mermaid 架構圖、目錄責任對照                                                                                               |
| [`docs/modules/operations/env_vars.md`](docs/modules/operations/env_vars.md)                         | 完整環境變數清單與 SOP                                                                                                               |
| [`docs/modules/strategy/providers.md`](docs/modules/strategy/providers.md)                           | 市場資料 Provider 層：各 provider 欄位、快取策略、Slot-based 架構說明（`dataSourceConfig` / `providerRegistry`）、8 個資料 Slot 詳解 |
| [`docs/modules/ai_news/ai_pipeline.md`](docs/modules/ai_news/ai_pipeline.md)                         | AI 決策管線詳細設計                                                                                                                  |
| [`docs/modules/strategy/_index.md`](docs/modules/strategy/_index.md)                                 | 策略引擎 / 技術指標 / 新聞治理                                                                                                       |
| [`docs/modules/infrastructure/_index.md`](docs/modules/infrastructure/_index.md)                     | storage / archiveManager / snapshotCrypto                                                                                            |
| [`docs/modules/presentation/_index.md`](docs/modules/presentation/_index.md)                         | Runner / Bot / 通知層設計                                                                                                            |
| [`docs/modules/operations/deployment_oracle_vm.md`](docs/modules/operations/deployment_oracle_vm.md) | Oracle VM 完整部署手冊                                                                                                               |
| [`docs/plans/`](docs/plans/)                                                                         | 實作計畫管理（進行中計畫 `active/` 與已驗收計畫 `completed/`）                                                                       |

---

## 給 AI 代理的提示

如果你是維護此專案的 AI 代理，**請勿在 README 中尋找程式碼細節**。
架構設計與模組說明均已整理至 `docs/`，請直接查閱對應文件。
