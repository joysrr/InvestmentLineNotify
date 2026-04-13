# InvestmentLineNotify

> 🤖 **AI 驅動的台灣 ETF 投資決策與通知系統**
> 專為 0050 / 00675L 生命週期投資法設計，每日自動分析市場、產出行動建議並推播至 Telegram。

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

- 📅 每日盤前 / 盤中 / 收盤後 / 夜間美股觀測報告
- 📰 每 4 小時自動更新的新聞池與 AI 新聞治理
- 📊 每週 / 每月 AI 週報與月報生成
- 💬 Telegram Bot 即時互動指令（`/daily`、`/status`、`/weekly` 等）
- 📱 Telegram Mini App 儀表板（總覽 / 雷達 / 多空 / 圖表 / 報告 / 新聞 / 設定）

---

## 核心特色

| 特色 | 說明 |
|---|---|
| **無資料庫設計** | 以 `data/` 檔案庫 + Google Sheets 取代傳統 DB，降低維護成本 |
| **多階段 AI 管線** | 新聞過濾器 → 總經多空分析師 → 投資教練 → LLM Judge，結構化輸出防幻覺 |
| **動態量化風控** | 維持率斷頭計算、RSI/KD/MACD 過熱閥值、冷卻期與極端恐慌破冰機制 |
| **帳戶快照加密** | 持倉數字以 AES-256-GCM 加密存儲，`.env` 金鑰本地管理 |
| **雙平台執行** | 時間敏感任務（盤前 / 收盤）由 Oracle VM crontab 執行；其餘由 GitHub Actions 排程 |
| **Telegram Mini App** | Fastify API Server + Vue 3 前端，即時瀏覽資產趨勢、市場雷達與新聞池 |

---

## 系統架構

```
Telegram 使用者 ──→ bot.mjs (grammY Long-Polling)
                          │
Mini App (Vue 3) ──→ api/server.mjs (Fastify, Port 3000)
                          │
VM crontab / GitHub Actions ──→ Runner Layer
    ├── runDailyCheck.mjs      ← 每日主流程
    ├── runNewsFetch.mjs        ← 新聞池更新
    ├── runOptimizer.mjs        ← 新聞治理規則優化
    ├── runWeeklyReport.mjs     ← AI 週報
    └── runMonthlyReport.mjs    ← AI 月報
              │
    ┌─────────┴──────────┐
    │  Core Modules      │
    │  providers/        │  ← 市場資料（TWSE / Yahoo / FRED / CNN）
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

> 完整 Mermaid 架構圖請見 [`docs/architecture.md`](docs/architecture.md)

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

### 6. 設定 VM crontab

```bash
crontab -e
```

加入以下內容（時區需為 `Asia/Taipei`）：

```cron
SHELL=/bin/bash
TZ=Asia/Taipei

# DuckDNS IP 更新（防 Oracle IP 漂移）
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=YOUR_DOMAIN&token=YOUR_TOKEN&ip=" > /dev/null

# 盤前報告（09:00 開盤前）
30 7 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh

# 收盤後總結（13:30 收盤後）
45 13 * * * /bin/bash /home/ubuntu/investnotify/scripts/vm-daily-check.sh
```

---

## 環境變數設定

> 完整說明請見 [`docs/env-vars.md`](docs/env-vars.md)

### 必填項目

| 分類 | 變數名稱 | 說明 |
|---|---|---|
| **Telegram** | `TELEGRAM_API_TOKEN` | 主 Bot Token（每日 / 週 / 月報告推播） |
| **Telegram** | `TELEGRAM_LOG_API_TOKEN` | Log Bot Token（Workflow 異常告警） |
| **Telegram** | `TELEGRAM_USER_ID` | 接收訊息的使用者 ID |
| **Telegram** | `TELEGRAM_WEBAPP_URL` | Mini App URL |
| **Google Sheets** | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | GCP 服務帳號 Email |
| **Google Sheets** | `GOOGLE_PRIVATE_KEY` | GCP 服務帳號私鑰（PEM 格式） |
| **Google Sheets** | `GOOGLE_SHEET_ID` | 持股記錄試算表 ID |
| **Gemini AI** | `GEMINI_API_KEY1` ~ `GEMINI_API_KEY3` | Gemini API 金鑰（三把輪替） |
| **Gemini AI** | `GEMINI_MODEL` | 模型名稱，如 `gemini-2.0-flash` |
| **市場資料** | `FRED_API_KEY` | FRED 聯準會資料庫 API |
| **市場資料** | `BASE_PRICE_URL` | 0050 基準價外部服務端點 |
| **VM 部署** | `VM_HOST` | Oracle VM IP 或 Domain |
| **VM 部署** | `VM_USER` | SSH 登入使用者名稱 |
| **VM 部署** | `VM_SSH_PRIVATE_KEY` | SSH 私鑰（供 Actions 連線 VM） |
| **快照加密** | `SNAPSHOT_ENCRYPT_KEY` | AES-256-GCM 金鑰（64 位 hex 字元） |

**產生快照加密金鑰：**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 選填項目

| 變數名稱 | 說明 |
|---|---|
| `LANGFUSE_SECRET_KEY` | Langfuse AI 決策追蹤（未設定時略過） |
| `LANGFUSE_PUBLIC_KEY` | Langfuse 前端金鑰 |
| `LANGFUSE_BASE_URL` | Langfuse 服務端點 |

---

## 排程總覽

> 完整說明請見 [`docs/schedules.md`](docs/schedules.md)

### Oracle VM crontab（時間敏感任務）

| 台灣時間 | 用途 |
|---|---|
| 07:30 每日 | 🔴 盤前完整報告（開盤前推播） |
| 13:45 每日 | 🟡 收盤後總結 |
| 每 5 分鐘 | DuckDNS IP 更新 |

### GitHub Actions（低時間敏感任務）

| 台灣時間 | 用途 |
|---|---|
| 10:30 每日 | 盤中觀測 |
| 12:00 每日 | 午盤回報 |
| 21:30 每日 | 夜間美股開盤觀測 |
| 每 4 小時 | 新聞池更新 |
| 02:00 每日 | Rule Optimizer |
| 週一 09:30 | AI 週報生成 |
| 每月 1 日 09:30 | AI 月報生成 |

### Oracle VM PM2 長駐程序

| 程序名稱 | 說明 |
|---|---|
| `api-server` | Fastify HTTP API（Port 3000），供 Mini App 呼叫 |
| `bot-daemon` | Telegram Bot Long-Polling，處理即時指令 |

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

## 專案結構

```
InvestmentLineNotify/
├── src/
│   ├── runDailyCheck.mjs        ← 每日主流程 CLI 入口
│   ├── runNewsFetch.mjs          ← 新聞抓取流程
│   ├── runOptimizer.mjs          ← 新聞治理規則優化
│   ├── runWeeklyReport.mjs       ← AI 週報
│   ├── runMonthlyReport.mjs      ← AI 月報
│   ├── bot.mjs                   ← Telegram Bot 長駐程序
│   ├── api/
│   │   ├── server.mjs            ← Fastify API Server（Port 3000）
│   │   ├── middleware/           ← initDataGuard（HMAC-SHA256 驗證）
│   │   └── routes/               ← /api/status, /api/reports, /api/news, /api/snapshots
│   ├── modules/
│   │   ├── providers/            ← 市場資料（TWSE / Yahoo / FRED / CNN / KGI / NDC）
│   │   ├── strategy/             ← RSI / KD / MACD 量化指標 + 風控引擎
│   │   ├── ai/                   ← Gemini AI 決策管線（新聞過濾 / 總經分析 / 投資教練）
│   │   ├── notifications/        ← Telegram HTML 訊息排版與推播
│   │   ├── data/
│   │   │   ├── newsPoolManager.mjs  ← 新聞池 CRUD + TTL 清理
│   │   │   └── archiveManager.mjs   ← 本地 JSON 讀寫管理
│   │   ├── bot/                  ← runnerLock / adminGuard
│   │   └── storage.mjs           ← Google Sheets 同步
│   ├── utils/
│   │   ├── snapshotCrypto.mjs    ← AES-256-GCM 快照加解密
│   │   ├── coreUtils.mjs         ← TwDate / fetchWithTimeout 等工具
│   │   └── envGuard.mjs          ← 啟動時環境變數驗證
│   └── test/                     ← 手動測試與回測腳本
├── webapp/                        ← Vite + Vue 3 Telegram Mini App
│   └── src/views/                 ← 7 個 Tab（總覽 / 雷達 / 多空 / 圖表 / 報告 / 新聞 / 設定）
├── scripts/
│   └── vm-daily-check.sh         ← VM crontab 執行腳本
├── data/                          ← 本地 JSON 快取（.gitignore，不進版本控制）
├── docs/                          ← 系統文件
└── .github/workflows/             ← GitHub Actions 排程
```

---

## 文件索引

> 本 README 為快速上手指南，詳細系統設計請查閱 `docs/`。

| 文件 | 說明 |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | 系統總覽、Mermaid 架構圖、目錄責任對照 |
| [`docs/env-vars.md`](docs/env-vars.md) | 完整環境變數清單與 SOP |
| [`docs/schedules.md`](docs/schedules.md) | 排程總覽（VM crontab + GitHub Actions） |
| [`docs/modules/ai_pipeline.md`](docs/modules/ai_pipeline.md) | AI 決策管線詳細設計 |
| [`docs/modules/market_strategy.md`](docs/modules/market_strategy.md) | 策略引擎 / 技術指標 / 新聞治理 |
| [`docs/modules/core_infrastructure.md`](docs/modules/core_infrastructure.md) | storage / archiveManager / snapshotCrypto |
| [`docs/modules/entry_and_notifications.md`](docs/modules/entry_and_notifications.md) | Runner / Bot / 通知層設計 |
| [`docs/appendix/deployment-oracle-vm.md`](docs/appendix/deployment-oracle-vm.md) | Oracle VM 完整部署手冊 |

---

## 給 AI 代理的提示

如果你是維護此專案的 AI 代理，**請勿在 README 中尋找程式碼細節**。
架構設計與模組說明均已整理至 `docs/`，請直接查閱對應文件。
