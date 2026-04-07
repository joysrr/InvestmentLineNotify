# InvestmentLineNotify - Telegram Bot 系統整合與升級計劃書

**文件版本**：v1.4  
**專案名稱**：InvestmentLineNotify  
**目標敘述**：將現有的單向推播系統，轉型為具備雙向互動、數據視覺化及個人化 AI 服務的全方位 Telegram 投資助理。

本計劃書將升級藍圖拆分為三個主要階段項目，依序由淺入深進行系統改造，並於文末附上適用於此專案的免費基礎設施推薦清單。

---

## 目前進度（2026-04-07 更新）

### ✅ 已完成

- [x] **項目一：Telegram Bot 長駐層整合**
  - `src/bot.mjs` 建立完成，grammY Long-Polling 長駐執行
  - `adminGuard` middleware 白名單保護實作完成
  - `runnerLock` 防止指令與排程重複觸發
  - 六個 Bot 指令封裝完成（`/daily`、`/news`、`/weekly`、`/monthly`、`/optimize`、`/status`）
- [x] **Pre-A（文件先行）**
  - `docs/architecture.md` 更新：補充 Bot Layer（5.8）、Mermaid flow 新增 Bot 節點、補齊 `data/cache`、`data/config`、`data/news_logs`、`data/last_buy.json` 說明
- [x] **技術選型確認**
  - API Server：Fastify
  - 前端框架：Vite + Vue 3 + ECharts
  - Mini App 展示優先順序：`(a) 收益率趨勢折線` → `(b) 報告摘要列表` → `(d) 新聞池列表`，不實作 `(c)`
- [x] **Cache 整理**
  - 移除已完成任務 cache（`impl_phase1.md`、`telegram_plan_review.md`）
  - 保留 `docs/.agent_cache/impl_phase2.md`（Phase 2 實作待辦）
- [x] **項目二 Phase 2-A：Fastify API Server**
  - `src/api/server.mjs` 建立完成（Fastify 主程式、CORS、initDataGuard 整合）
  - `src/api/middleware/initDataGuard.mjs`：Telegram HMAC-SHA256 驗證，`dev` 模式可 bypass
  - `src/api/routes/status.mjs`：`GET /api/status`
  - `src/api/routes/reports.mjs`：`GET /api/reports?limit=N`、`GET /api/report/:date`
  - `src/api/routes/news.mjs`：`GET /api/news`
  - `package.json` 新增 `fastify`、`@fastify/cors` deps 與 `api` script

### 🔄 進行中（待執行）

- [ ] **項目二 Phase 2-B**：Vite + Vue 3 前端 Mini App（`webapp/`）
- [ ] **項目二 Phase 2-C**：Bot 整合（指令選單、Menu Button、Inline Button）
- [ ] **項目二 Phase 2-D**：文件更新（`architecture.md`、`entry_and_notifications.md`）

### ⏸️ 延後處理（外移至後續計劃）

- [ ] **Oracle Cloud VM 正式部署**
  - 原因：目前尚未有 domain，Telegram Mini App 需強制 HTTPS
  - 已移至 `docs/plans/preplan_features.md`，待取得 domain 後啟動
  - 現階段 Phase 2 聚焦應用層，可透過 ngrok 本機驗證

---

## 項目一：基礎雙向互動升級 (Bot API 深度整合)

> **狀態：✅ 已完成**

### 1. 目標
打破現有「排程觸發 -> 單向廣播」的限制，透過引入 Telegram Bot 框架（如 `grammY` 或 `telegraf`），實作 Inline Keyboards（按鈕互動）與 On-Demand Commands（隨選指令，如 `/daily`, `/analyze`），並提供關注清單的管理功能。

### 2. 效益分析報告
- **操作直覺性**：用戶可直接點擊推播訊息下方的按鈕（如：摘要新聞、查看線圖），無須跳出 App。
- **即時性**：無需等待 Cron Job，隨時透過指令獲取當下市場快照與 AI 分析。
- **維護成本**：將關注標的管理從修改 `.json` 設定檔，轉移至聊天室對話完成，降低操作門檻。

### 3. 難易度
⭐⭐ (低) - 邏輯多數已存在，主要工作為封裝與串接。

### 4. 推薦執行程度
⭐⭐⭐⭐⭐ (極高) - CP 值最高的第一步。

### 5. 前置條件與目前狀態
- **[已達成]** 具備 Telegram 訊息發送能力與 HTML 排版模組 (`telegramClient.mjs`, `telegramHtmlBuilder.mjs`)。
- **[已達成]** 具備獨立的資料獲取與 AI 分析模組（`dailyCheck`, `quoteProvider`）。
- **[已達成]** `src/bot.mjs` 建立完成，grammY Long-Polling 長駐執行。
- **[已達成]** `adminGuard` middleware 實作，白名單限制指令執行權限。
- **[已達成]** `runnerLock` 防止 Bot 指令與 GitHub Actions 排程重複觸發。

### 6. 影響架構範圍
- 新增 `src/bot.mjs` 作為新的長駐入口點。
- 修改 `src/modules/notifications/templates` 以支援附帶 `reply_markup`（按鈕）。
- 現有 `run*.mjs` 腳本已重構封裝匯出函數，可被 Bot 路由呼叫。

### 7. 資料流程
```text
User 傳送指令 (/analyze AAPL) 或點擊按鈕
  -> Telegram API
  -> Node.js Bot (Polling/Webhook) 監聽器
  -> 觸發 `quoteProvider` 獲取資料
  -> 觸發 `llmJudge` 進行分析
  -> `telegramClient` 回傳結果給 User
```

### 8. 潛在挑戰與防禦機制
- 挑戰：長駐進程可能因為意外錯誤崩潰。
- 防禦機制：使用 PM2 或 Docker Restart Policy 進行行程守護與崩潰自動重啟。
- 挑戰：任何人只要知道 Bot 帳號就能觸發指令，消耗你的 API 額度。
- 防禦機制：在 Bot 中繼介面（Middleware）實作「白名單機制」，僅允許配置好的 ADMIN_CHAT_ID 執行耗能指令。

---

## 項目二：視覺化投資儀表板 (Telegram Mini App 整合)

> **狀態：🔄 進行中 — Phase 2-A ✅ 完成，Phase 2-B 待開始實作**

### 技術選型（已確認）

| 項目 | 決定 | 說明 |
|---|---|---|
| API Server | ✅ Fastify | ESM 原生、比 Express 快 3-5 倍 |
| 前端框架 | ✅ Vite + Vue 3 + ECharts | Composition API、HMR、vue-echarts 整合 |
| 前端目錄 | ✅ `webapp/` | build 產物輸出至 `webapp/dist/` |
| 圖表優先順序 | ✅ (a)→(b)→(d) | 不實作 (c) 訊號次數長條圖 |
| 部署方案 | ⏸️ Oracle VM（下個計劃） | 尚無 domain，HTTPS 前提未達成，外移至 preplan_features |

### 1. 目標
利用 Telegram Mini App (Web App) 技術，在對話框內嵌網頁。將枯燥的 JSON 報表與歷史回測數據 (backtest.mjs)，轉化為可互動的圖表（如收益率折線圖）。同時提供報告摘要列表與新聞池瀏覽，讓用戶在不離開 Telegram 的情況下獲得完整資訊。

### 2. 效益分析報告
- 極致體驗：文字無法呈現的趨勢線與回測績效，可透過前端圖表庫（ECharts）完美展示。
- 產品化：系統從「開發者工具」升級為現代化的「SaaS 產品」雛形。
- 效率提升：動態調整策略參數並立即儲存生效，加速 ruleOptimizer 的調校過程。

### 3. 難易度
⭐⭐⭐⭐ (高) - 需具備全端開發能力（前端 UI + 後端 API）。

### 4. 推薦執行程度
⭐⭐⭐⭐ (高) - 專案成熟後升級體驗的必經之路。

### 5. 前置條件與目前狀態
- **[已達成]** 完善的本地 JSON 資料儲存架構 (data/market, data/reports)。
- **[已達成]** 技術選型確認：Fastify + Vite + Vue 3 + ECharts。
- **[已達成]** `src/api/server.mjs` 建立完成（Fastify，唯讀 API）。
- **[未達成]** 需開發前端專案（`webapp/`，Vite + Vue 3）。
- **[未達成]** 部署層（HTTPS domain）待下個計劃解決，開發期可用 ngrok 本機驗證。

### 6. Phase 實作清單

#### Phase 2-A：Fastify API Server ✅ 已完成

**已建立檔案**：
- `src/api/server.mjs` — Fastify 主程式（CORS、initDataGuard 整合，Port 3000）
- `src/api/middleware/initDataGuard.mjs` — Telegram initData HMAC-SHA256 驗證
- `src/api/routes/status.mjs` — `GET /api/status`
- `src/api/routes/reports.mjs` — `GET /api/reports?limit=N`、`GET /api/report/:date`
- `src/api/routes/news.mjs` — `GET /api/news`
- `package.json` — 新增 `fastify`、`@fastify/cors` 與 `api` script

| 路由 | 說明 |
|---|---|
| `GET /api/status` | 讀取 `data/market/latest.json`，回傳市場快取 |
| `GET /api/reports?limit=N` | 讀取 `data/reports/` 最新 N 份報告（預設 30） |
| `GET /api/report/:date` | 讀取指定日期報告（`YYYY-MM-DD`） |
| `GET /api/news` | 讀取 `data/news/pool_filtered_active.json` |

其他機制：
- Telegram `initData` HMAC-SHA256 驗證 middleware（`dev` 模式可 bypass）
- CORS 設定（開發期允許 localhost:5173，可透過 `CORS_ORIGIN` env 覆蓋）
- 一律唯讀，不允許透過 API 寫入 `data/`
- Port 3000，可透過 `PORT` env 覆蓋

#### Phase 2-B：Vite + Vue 3 前端 Mini App

**目標目錄**：`webapp/`

| 模組 | 圖表 / 功能 | 資料來源 |
|---|---|---|
| (a) 收益率趨勢折線 | ECharts LineChart，變動幅度 ± 色差異 | `/api/reports` |
| (b) 報告摘要列表 | 日期 + AI 決策摘要，可點擊展開詳細 | `/api/reports` |
| (d) 新聞池列表 | 標題 + 來源 + 時間，可點連結 | `/api/news` |

其他要求：
- Telegram Web App SDK：`expand()`、`MainButton`、`themeParams` 主題色同步
- 頁面切換使用 Vue Router（`hash` 模式，Mini App 不支援 history mode）
- `vite build` 輸出至 `webapp/dist/`

**待建立檔案**：
- `webapp/package.json`
- `webapp/vite.config.js`
- `webapp/src/main.js`
- `webapp/src/App.vue`
- `webapp/src/router/index.js`
- `webapp/src/views/ChartView.vue` — (a) 收益率折線
- `webapp/src/views/ReportsView.vue` — (b) 報告摘要列表
- `webapp/src/views/NewsView.vue` — (d) 新聞池列表
- `webapp/src/composables/useTelegram.js` — Telegram Web App SDK 封裝
- `webapp/src/api/index.js` — API client

#### Phase 2-C：Bot 整合

在現有 `src/bot.mjs` 新增：
- `bot.api.setMyCommands([...])` — Telegram 左下角指令選單
- `bot.api.setChatMenuButton({ type: "web_app", ... })` — Menu Button 指向 Mini App URL
- `/status` 指令附加 Inline Button「開啟儀表板」

> 注意：Mini App URL 需待取得 HTTPS domain 後才能配置，此步驟於部署計劃完成後實作。

#### Phase 2-D：文件更新（實作結束後執行）

- `docs/architecture.md`：補充 API 層與 webapp 層說明
- `docs/modules/entry_and_notifications.md`：更新 Bot 指令選單與 Mini App 整合說明

### 7. 影響架構範圍
- 新增 `src/api/server.mjs` 提供唯讀 HTTP API。
- 新增前端目錄 `webapp/`，Vite 獨立建置。
- 在 Telegram Bot 中配置 Menu Button 或 Inline Button 開啟 Web App URL。

### 8. 資料流程
```text
User 點擊 [開啟儀表板]
  -> 彈出半版 Webview (Mini App)
  -> 前端帶著 Telegram InitData 向 Fastify API 請求資料
  -> API 驗證 InitData 成功，讀取 `data/` 下的 JSON 檔案
  -> 回傳 JSON 給前端渲染圖表（ECharts）
```

### 9. 潛在挑戰與防禦機制
- 挑戰：Mini App 的身分驗證問題，如何確保 API 不被外部惡意呼叫。
- 防禦機制：嚴格實作 Telegram 官方提供的 initData Hash 驗證邏輯。
- 挑戰：跨域資源共用 (CORS) 限制。
- 防禦機制：Fastify 正確配置 CORS middleware，前端與 API 最終部署於同一網域。
- 挑戰：`data/` 並發讀寫安全性。
- 防禦機制：API 設計為唯讀，寫入仍由 runner 集中管理，避免與 GitHub Actions 產生競爭條件。

---

## 項目三：進階 AI 教練與社群化 (語音/遊戲/變現)

> **狀態：⏳ 等待項目二完成後評估**

### 1. 目標
將系統打造為具有「靈魂」的投資助理。整合語音轉文字 (Speech-to-Text) 讓用戶能用語音詢問盤勢；開發群組內的「多空預測投票」遊戲；甚至為未來的商業化鋪路，結合 Telegram Stars 實作付費解鎖進階 AI 報告的功能。

### 2. 效益分析報告
- 使用場景擴充：語音功能大幅提升在通勤、非辦公環境下的使用便利性。
- 社群擴散：預測遊戲能增加群組互動，讓機器人具備社交屬性。
- 商業價值：Telegram Stars 的無縫支付體驗，為系統維護與 API 成本提供變現可能。

### 3. 難易度
⭐⭐⭐⭐⭐ (極高) - 涉及複雜的狀態管理、第三方串接與金流驗證。

### 4. 推薦執行程度
⭐⭐⭐ (中) - 屬於 Nice-to-have 的進階擴充，建議前兩項完成後再行評估。

### 5. 前置條件與目前狀態
- **[已達成]** 模組化的 AI Pipeline (aiCoach.mjs, llmJudge.mjs)。
- **[未達成]** 需串接 OpenAI Whisper 等語音辨識 API。
- **[未達成]** 將基於檔案的系統 (.json) 遷移或擴充為真正的資料庫 (MongoDB / PostgreSQL) 以應付多用戶與交易紀錄。

### 6. 影響架構範圍
- 需引入真實資料庫來管理 User Sessions、Stars 交易紀錄、群組積分榜。
- 新增音檔處理模組 (接收 .ogg，轉檔並打 API)。
- 新增支付驗證與權限控制 (Paywall) 中繼介面。

### 7. 資料流程
(以語音互動為例)

```text
User 傳送語音訊息
  -> Bot 獲取 FileID 並下載音檔
  -> 呼叫 Whisper API 轉換為文字 ("台積電還能買嗎？")
  -> 觸發 `aiDataPreprocessor` 整理台積電相關籌碼/新聞
  -> 進入 `aiCoach` 產出對話式建議
  -> 文字 (或 Text-to-Speech 語音) 回傳給 User
```

### 8. 潛在挑戰與防禦機制
- 挑戰：群組中訊息量龐大，Bot 如果每句話都處理會導致 API 費用破表。
- 防禦機制：群組模式下，強制規定僅處理帶有指令 (/ask) 或是 Reply @bot 的訊息。
- 挑戰：語音處理延遲過高，導致 UX 不佳。
- 防禦機制：收到語音時先回傳「🎧 正在聆聽與分析中...」，並考慮實作 AI 回覆的文字串流 (Streaming) 輸出，減少體感等待時間。
- 挑戰：多用戶併發讀寫原本的 .json 檔案造成資料損毀。
- 防禦機制：在進入此階段前，必須將核心狀態管理從 JSON 檔案遷移至關聯式或 NoSQL 資料庫系統。

---

## 附錄：免費基礎設施與雲端服務推薦清單

為了實現上述計畫，系統會需要長駐的主機、資料庫以及前端代管服務。以下針對各項需求推薦免費的解決方案，幫助您在零成本的狀態下完成概念驗證 (POC) 與初期上線。

### 1. 後端主機與長駐進程 (Bot Server / API Server)

要讓 Telegram Bot 24 小時在線接收訊息，需要一個穩定的運算資源。

- **選項 A：Oracle Cloud 終身免費方案 (Always Free)**
  - 特色：提供最高 4 核心 ARM 處理器 + 24GB RAM 的超大規格。
  - 優點：規格極度大方，完全可以把整個 Node.js 專案全部塞進去，並使用 PM2 常駐，不須修改現有架構。
  - 缺點：註冊難度極高，常遇到信用卡驗證失敗。
  - 推薦程度：⭐⭐⭐⭐⭐ (若申請成功)
  - **注意**：詳細部署步驟已整理至 `docs/plans/preplan_features.md`
- **選項 B：Render (Web Service 免費方案)**
  - 特色：現代化的雲端代管平台，連接 GitHub 自動部署。
  - 優點：部署簡單，內建免費 HTTPS，適合 Webhook Server。
  - 缺點：閒置 15 分鐘後會休眠，需設定外部 Cronjob 每 14 分鐘 Ping 一次喚醒。
  - 推薦程度：⭐⭐⭐⭐
- **選項 C：Vercel / Netlify (Serverless Functions)**
  - 優點：零維護成本，速度快。
  - 缺點：不支援長駐進程 (Long-Polling)，且有執行時間限制，僅適合 Webhook。
  - 推薦程度：⭐⭐⭐

### 2. 雲端資料庫 (Database)

進入項目三時，必須將本地 JSON 替換為真正的資料庫。

- **選項 A：MongoDB Atlas (M0 Free Cluster)**
  - 優點：與您現有的 JSON 資料結構契合度最高 (Document-based)，在 Node.js 中轉換成本極低，提供 512 MB 空間。
  - 推薦程度：⭐⭐⭐⭐⭐
- **選項 B：Supabase (免費版)**
  - 優點：提供 500 MB PostgreSQL 資料庫與 1GB 檔案儲存，內建強大的身分驗證系統。
  - 缺點：需將 JSON 邏輯重構為關聯式資料表。
  - 推薦程度：⭐⭐⭐⭐

### 3. 前端網頁代管 (Mini App UI)

針對項目二的視覺化儀表板。

- **選項 A：Vercel / Netlify / Cloudflare Pages**
  - 優點：提供頂級的 CDN 與幾乎無限的免費流量，綁定 GitHub 後一鍵部署。
  - 推薦程度：⭐⭐⭐⭐⭐
- **選項 B：GitHub Pages**
  - 優點：直接利用 GitHub Actions 部署，架構最集中。
  - 缺點：不支援動態路由或 SSR。
  - 推薦程度：⭐⭐⭐⭐

### 4. 進階 AI 語音與模型 API

- **選項 A：Groq API (免費額度)**
  - 優點：主打極速推論，生成速度極快，非常適合即時對話機器人，解決對話延遲問題。提供 Llama 3 等開源模型。
  - 推薦程度：⭐⭐⭐⭐⭐
- **選項 B：Groq Whisper API 或 Hugging Face API**
  - 優點：可作語音轉文字 (Speech-to-Text)。
  - 缺點：免費額度有速率限制，需做好重試機制。
  - 推薦程度：⭐⭐⭐⭐

💡 **總結建議組合 (零成本啟動)**
- 主機：Oracle Cloud (首選) 或 Render + 定時喚醒。
- 資料庫：MongoDB Atlas (無痛搬遷 JSON 邏輯)。
- 前端 (Mini App)：Vercel。
- 快速對話 AI：Groq API。

---

## 計劃補充說明（基於現有系統架構分析）

> 此章節為 v1.2 新增，根據 `docs/architecture.md` 與 `docs/modules/` 的現有架構進行補充，確保計劃與現有系統整合時不遺漏關鍵細節。

### 補充一：雙 Token 路由策略（與現有架構整合）

現有系統已使用兩個 Telegram Bot Token：
- **主頻道 Token**（`TELEGRAM_API_TOKEN`）：用於每日報告、週報、月報推播。
- **Log 頻道 Token**（`TELEGRAM_LOG_API_TOKEN`）：用於 `runOptimizer.mjs` 靜默推播。

**補充建議**：`src/bot.mjs` 的指令路由設計時需明確界定兩個 Token 的職責邊界。建議 Bot Daemon 僅掛載主頻道 Token，Log 頻道維持現有的靜默推播模式，避免指令路由衝突。

### 補充二：GitHub Actions 與 Bot Daemon 的共存策略

現有的 GitHub Actions / Cron 排程機制是系統的核心觸發方式。引入長駐 Bot Daemon 後，需明確以下決策：
- **排程功能是否保留？** 建議保留 GitHub Actions 排程，Bot Daemon 僅負責接收即時指令，兩者互不干擾。
- **避免重複觸發**：若 Bot 的 `/daily` 指令與排程的 `runDailyCheck` 可能同時執行，需加入 lock 機制（如 `data/` 下的 flag 檔）。

### 補充三：Runner 封裝為 Bot Command 的對應清單

根據現有 runner 分流架構，以下指令封裝建議供項目一實作參考：

| 指令 | 對應 Runner / 模組 | 說明 |
|---|---|---|
| `/daily` | `runDailyCheck.mjs` | 手動觸發每日報告 |
| `/news` | `runNewsFetch.mjs` | 手動更新新聞池 |
| `/weekly` | `runWeeklyReport.mjs` | 手動觸發週報 |
| `/monthly` | `runMonthlyReport.mjs` | 手動觸發月報 |
| `/optimize` | `runOptimizer.mjs` | 手動觸發規則優化 |
| `/status` | 讀取 `data/market/latest.json` | 快速查看最新市場快取 |

### 補充四：data/ 目錄並發讀取安全性（項目二前置評估）

現有 `data/` 目錄為 file-based JSON，設計上為 **單一 runner 執行、非並發寫入**。Mini App API Server 引入後，需評估：
- API Server 的讀取操作是否與 runner 的寫入操作有時間窗口衝突。
- 建議項目二的 API 設計為**唯讀**，不允許透過 Mini App 寫入 `data/`，寫入操作仍由 runner 集中管理。

### 補充五：Google Sheets 整合在項目三的處置

現有 `storage.mjs` 從 Google Sheets 讀取持倉成本（`avgCost0050` / `avgCostZ2`）。項目三若引入資料庫，需明確 Google Sheets 的角色：
- **保留 Google Sheets 作為人工輸入介面**（低頻寫入，如手動更新持倉成本），資料庫作為高頻讀取快取。
- 避免在引入資料庫後直接廢棄 Google Sheets，以免破壞現有的手動管理流程。
