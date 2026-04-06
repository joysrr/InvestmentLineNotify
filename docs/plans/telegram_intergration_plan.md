# InvestmentLineNotify - Telegram Bot 系統整合與升級計劃書

**文件版本**：v1.1
**專案名稱**：InvestmentLineNotify
**目標敘述**：將現有的單向推播系統，轉型為具備雙向互動、數據視覺化及個人化 AI 服務的全方位 Telegram 投資助理。

本計劃書將升級藍圖拆分為三個主要階段項目，依序由淺入深進行系統改造，並於文末附上適用於此專案的免費基礎設施推薦清單。

---

## 項目一：基礎雙向互動升級 (Bot API 深度整合)

### 1. 目標
打破現有「排程觸發 -> 單向廣播」的限制，透過引入 Telegram Bot 框架（如 `grammY` 或 `telegraf`），實作 Inline Keyboards（按鈕互動）與 On-Demand Commands（隨選指令，如 `/daily`, `/analyze`），並提供關注清單的管理功能。

### 2. 效益分析報告
* **操作直覺性**：用戶可直接點擊推播訊息下方的按鈕（如：摘要新聞、查看線圖），無須跳出 App。
* **即時性**：無需等待 Cron Job，隨時透過指令獲取當下市場快照與 AI 分析。
* **維護成本**：將關注標的管理從修改 `.json` 設定檔，轉移至聊天室對話完成，降低操作門檻。

### 3. 難易度
⭐⭐ (低) - 邏輯多數已存在，主要工作為封裝與串接。

### 4. 推薦執行程度
⭐⭐⭐⭐⭐ (極高) - CP 值最高的第一步。

### 5. 前置條件與目前狀態
* **[已達成]** 具備 Telegram 訊息發送能力與 HTML 排版模組 (`telegramClient.mjs`, `telegramHtmlBuilder.mjs`)。
* **[已達成]** 具備獨立的資料獲取與 AI 分析模組（`dailyCheck`, `quoteProvider`）。
* **[未達成]** 需要一個長駐進程 (Daemon) 來監聽 Telegram Webhook 或 Polling。
* **[未達成]** 需要引入成熟的 Telegram Bot Node.js 框架。

### 6. 影響架構範圍
* 新增 `src/bot.mjs` 作為新的長駐入口點。
* 修改 `src/modules/notifications/templates` 以支援附帶 `reply_markup`（按鈕）。
* 現有 `run*.mjs` 腳本需重構或封裝匯出函數，以便被 Bot 路由呼叫。

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
• 挑戰：長駐進程可能因為意外錯誤崩潰。
• 防禦機制：使用 PM2 或 Docker Restart Policy 進行行程守護與崩潰自動重啟。
• 挑戰：任何人只要知道 Bot 帳號就能觸發指令，消耗你的 API 額度。
• 防禦機制：在 Bot 中繼介面（Middleware）實作「白名單機制」，僅允許配置好的 ADMIN_CHAT_ID 執行耗能指令。
項目二：視覺化投資儀表板 (Telegram Mini App 整合)
1. 目標
利用 Telegram Mini App (Web App) 技術，在對話框內嵌網頁。將枯燥的 JSON 報表與歷史回測數據 (backtest.mjs)，轉化為可互動的圖表（如 K 線圖、圓餅圖）。同時提供「策略參數視覺化調整器」，讓用戶透過滑桿調整 AI Prompt 權重或停損利參數。
2. 效益分析報告
• 極致體驗：文字無法呈現的趨勢線與回測績效，可透過前端圖表庫（如 ECharts, Chart.js）完美展示。
• 產品化：系統從「開發者工具」升級為現代化的「SaaS 產品」雛形。
• 效率提升：動態調整策略參數並立即儲存生效，加速 ruleOptimizer 的調校過程。
3. 難易度
⭐⭐⭐⭐ (高) - 需具備全端開發能力（前端 UI + 後端 API）。
4. 推薦執行程度
⭐⭐⭐⭐ (高) - 專案成熟後升級體驗的必經之路。
5. 前置條件與目前狀態
• [已達成] 完善的本地 JSON 資料儲存架構 (data/market, data/reports)。
• [未達成] 需建立一個輕量級 Web 伺服器 (如 Express / Fastify) 提供 RESTful API。
• [未達成] 需開發前端網頁專案（React / Vue 或 Vanilla JS）。
6. 影響架構範圍
• 新增 src/api/server.mjs 提供唯讀或受限寫入的 HTTP API。
• 新增前端目錄（如 webapp/），獨立打包與部署。
• 在 Telegram Bot 中配置 Menu Button 或 Inline Button 開啟 Web App URL。
7. 資料流程
``` text
User 點擊 [開啟儀表板] 
  -> 彈出半版 Webview (Mini App) 
  -> 前端帶著 Telegram InitData 向 Node.js API 請求資料 
  -> API 驗證 InitData 成功，讀取 `data/` 下的 JSON 檔案 
  -> 回傳 JSON 給前端渲染圖表
```

8. 潛在挑戰與防禦機制
• 挑戰：Mini App 的身分驗證問題，如何確保 API 不被外部惡意呼叫。
• 防禦機制：嚴格實作 Telegram 官方提供的 initData Hash 驗證邏輯，確保請求確實來自你的 Telegram App。
• 挑戰：跨域資源共用 (CORS) 限制。
• 防禦機制：在 Express/Fastify 中正確配置 CORS 中介軟體，或將前端與 API 部署在同一個網域下。
項目三：進階 AI 教練與社群化 (語音/遊戲/變現)
1. 目標
將系統打造為具有「靈魂」的投資助理。整合語音轉文字 (Speech-to-Text) 讓用戶能用語音詢問盤勢；開發群組內的「多空預測投票」遊戲；甚至為未來的商業化鋪路，結合 Telegram Stars 實作付費解鎖進階 AI 報告的功能。
2. 效益分析報告
• 使用場景擴充：語音功能大幅提升在通勤、非辦公環境下的使用便利性。
• 社群擴散：預測遊戲能增加群組互動，讓機器人具備社交屬性。
• 商業價值：Telegram Stars 的無縫支付體驗，為系統維護與 API 成本提供變現可能。
3. 難易度
⭐⭐⭐⭐⭐ (極高) - 涉及複雜的狀態管理、第三方串接與金流驗證。
4. 推薦執行程度
⭐⭐⭐ (中) - 屬於 Nice-to-have 的進階擴充，建議前兩項完成後再行評估。
5. 前置條件與目前狀態
• [已達成] 模組化的 AI Pipeline (aiCoach.mjs, llmJudge.mjs)。
• [未達成] 需串接 OpenAI Whisper 等語音辨識 API。
• [未達成] 將基於檔案的系統 (.json) 遷移或擴充為真正的資料庫 (MongoDB / PostgreSQL) 以應付多用戶與交易紀錄。
6. 影響架構範圍
• 需引入真實資料庫來管理 User Sessions、Stars 交易紀錄、群組積分榜。
• 新增音檔處理模組 (接收 .ogg，轉檔並打 API)。
• 新增支付驗證與權限控制 (Paywall) 中介軟體。
7. 資料流程
(以語音互動為例)

``` text
User 傳送語音訊息 
  -> Bot 獲取 FileID 並下載音檔 
  -> 呼叫 Whisper API 轉換為文字 ("台積電還能買嗎？")
  -> 觸發 `aiDataPreprocessor` 整理台積電相關籌碼/新聞
  -> 進入 `aiCoach` 產出對話式建議
  -> 文字 (或 Text-to-Speech 語音) 回傳給 User
```

8. 潛在挑戰與防禦機制
• 挑戰：群組中訊息量龐大，Bot 如果每句話都處理會導致 API 費用破表。
• 防禦機制：群組模式下，強制規定僅處理帶有指令 (/ask) 或是 Reply @bot 的訊息。
• 挑戰：語音處理延遲過高，導致 UX 不佳。
• 防禦機制：收到語音時先回傳「🎧 正在聆聽與分析中...」，並考慮實作 AI 回覆的文字串流 (Streaming) 輸出，減少體感等待時間。
• 挑戰：多用戶併發讀寫原本的 .json 檔案造成資料損毀。
• 防禦機制：在進入此階段前，必須將核心狀態管理從 JSON 檔案遷移至關聯式或 NoSQL 資料庫系統。
附錄：免費基礎設施與雲端服務推薦清單
為了實現上述計畫，系統會需要長駐的主機、資料庫以及前端代管服務。以下針對各項需求推薦免費的解決方案，幫助您在零成本的狀態下完成概念驗證 (POC) 與初期上線。
1. 後端主機與長駐進程 (Bot Server / API Server)
要讓 Telegram Bot 24 小時在線接收訊息，需要一個穩定的運算資源。
• 選項 A：Oracle Cloud 終身免費方案 (Always Free)
• 特色：提供最高 4 核心 ARM 處理器 + 24GB RAM 的超大規格。
• 優點：規格極度大方，完全可以把整個 Node.js 專案全部塞進去，並使用 PM2 常駐，不須修改現有架構。
• 缺點：註冊難度極高，常遇到信用卡驗證失敗。
• 推薦程度：⭐⭐⭐⭐⭐ (若申請成功)
• 選項 B：Render (Web Service 免費方案)
• 特色：現代化的雲端代管平台，連接 GitHub 自動部署。
• 優點：部署簡單，內建免費 HTTPS，適合 Webhook Server。
• 缺點：閒置 15 分鐘後會休眠，需設定外部 Cronjob 每 14 分鐘 Ping 一次喚醒。
• 推薦程度：⭐⭐⭐⭐
• 選項 C：Vercel / Netlify (Serverless Functions)
• 優點：零維護成本，速度快。
• 缺點：不支援長駐進程 (Long-Polling)，且有執行時間限制，僅適合 Webhook。
• 推薦程度：⭐⭐⭐
2. 雲端資料庫 (Database)
進入項目三時，必須將本地 JSON 替換為真正的資料庫。
• 選項 A：MongoDB Atlas (M0 Free Cluster)
• 優點：與您現有的 JSON 資料結構契合度最高 (Document-based)，在 Node.js 中轉換成本極低，提供 512 MB 空間。
• 推薦程度：⭐⭐⭐⭐⭐
• 選項 B：Supabase (免費版)
• 優點：提供 500 MB PostgreSQL 資料庫與 1GB 檔案儲存，內建強大的身分驗證系統。
• 缺點：需將 JSON 邏輯重構為關聯式資料表。
• 推薦程度：⭐⭐⭐⭐
3. 前端網頁代管 (Mini App UI)
針對項目二的視覺化儀表板。
• 選項 A：Vercel / Netlify / Cloudflare Pages
• 優點：提供頂級的 CDN 與幾乎無限的免費流量，綁定 GitHub 後一鍵部署。
• 推薦程度：⭐⭐⭐⭐⭐
• 選項 B：GitHub Pages
• 優點：直接利用 GitHub Actions 部署，架構最集中。
• 缺點：不支援動態路由或 SSR。
• 推薦程度：⭐⭐⭐⭐
4. 進階 AI 語音與模型 API
• 選項 A：Groq API (免費額度)
• 優點：主打極速推論，生成速度極快，非常適合即時對話機器人，解決對話延遲問題。提供 Llama 3 等開源模型。
• 推薦程度：⭐⭐⭐⭐⭐
• 選項 B：Groq Whisper API 或 Hugging Face API
• 優點：可作語音轉文字 (Speech-to-Text)。
• 缺點：免費額度有速率限制，需做好重試機制。
• 推薦程度：⭐⭐⭐⭐
💡 總結建議組合 (零成本啟動)
• 主機：Oracle Cloud (首選) 或 Render + 定時喚醒。
• 資料庫：MongoDB Atlas (無痛搬遷 JSON 邏輯)。
• 前端 (Mini App)：Vercel。
• 快速對話 AI：Groq API。