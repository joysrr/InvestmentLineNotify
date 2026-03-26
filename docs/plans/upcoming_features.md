# 🚀 未來功能實作評估與規劃 (Upcoming Features)

本文件紀錄未來預計替「00675L 槓桿 ETF 投資決策系統」擴充的 4 項核心功能藍圖，包含大盤基本面指標的整合，以及 AI 新聞管線的持續進化。

---

## 📌 【指標擴充類】1. 加入大盤 PB（股價淨值比）指標
### 功能目標
加入 PB (Price-to-Book Ratio) 作為大盤「位階」的防護網。技術指標如 RSI 或乖離率僅能反映短中期的動能過熱，而大盤 PB 則能提供長線的「左側便宜基期」與「右側極度泡沫」判定，進一步強化 00675L 槓桿調降與破冰加碼的信心點位。

### 影響範圍
- `src/modules/providers/twseProvider.mjs` (或新增 `valuationProvider.mjs`)
- `src/modules/data/archiveManager.mjs` (快取更新)
- `src/modules/ai/aiDataPreprocessor.mjs` (格式化為 AI Context)
- `src/modules/strategy/strategyEngine.mjs` (決策邏輯)

### 實作步驟草案 (Step-by-Step)
1. **API 實作**：於 Provider 撰寫向 TWSE 證交所 API (或證期局公開資料) 獲取「大盤股價淨值比」的非同步函式。
2. **快取整合**：將回傳的 PB 數值整合進 `marketData.mjs` 的 `fetchAllMacroData()` 中，並利用 `archiveManager` 存入 `data/market/latest.json` 以便每日呼叫不觸發限流。
3. **風控邏輯納入**：於 `strategyEngine.mjs` 中加入基於 PB 的強而有力的風控限制。例如：當大盤 PB > 2.2（歷史極高點）就算技術面轉多，也強制降級為觀望或限制最高槓桿。
4. **教練脈絡與 UI**：在 `aiDataPreprocessor` 組合字串，並在 `telegramHtmlBuilder.mjs` 的「🌐 市場概況」區塊中顯示 `PB: 2.15 (昂貴)` 標籤。

### 潛在挑戰與防禦機制
- **爬蟲不穩定性**：證交所網站可能有改版或短暫鎖 IP 的風險。必須使用 `fetchWithTimeout` 包裝。
- **容錯Fallback**：萬一抓取失敗，PB 數值設為 `null`，策略判斷（`if PB > 2.2`）需具備空值防護，直接忽略該風控條件，絕不能讓主排程中斷。

### 資料流設計
`TWSE API` ➔ `rawPbData` ➔ `archiveManager` (寫入快取) ➔ `dailyCheck.mjs` (讀出) ➔ 交給 `strategyEngine` 評估風控 ➔ `aiDataPreprocessor` (結構化文字) ➔ `Investment Coach (AI)` 輔助判定。

---

## 📌 【指標擴充類】2. 加入大盤 PE（本益比）指標
### 功能目標
搭配 PB 一同服用。PE 能捕捉「大盤獲利是否有跟上估值」，主要用來防範無基之彈（資金行情推升但企業獲利衰退）。當市場位處高點但 PE 處於相對低檔時，可能代表企業獲利爆發（如 AI 浪潮），此時教練代理人就不會過早要求持有者下車。

### 影響範圍
完全疊合 PB 增加的路徑：`providers` ➔ `archiveManager` ➔ `preprocessor` ➔ `aiCoach`。

### 實作步驟草案 (Step-by-Step)
1. 在實作 PB 抓取函式的同時，一併將 PE (Price-to-Earnings Ratio) 欄位解析回來。
2. 於 `aiDataPreprocessor.mjs` 中，結合 PE 與 PB 產出一段 **「大盤估值綜合狀態」**（例如：`PB 2.1 高估 / PE 15 合理 ➔ 有基之彈，無需極度恐慌`）。
3. 修改 prompt 裡的 `<Macro_And_Chip_Status>` 說明，讓 AI 教練能在思考區塊 (`coach_internal_thinking`) 正確解析這兩項數字的連動關係。
4. 在 Telegram 戰報介面上，與 PB 放於同一行呈現。

### 潛在挑戰與防禦機制
- **EPS 空窗期的失真**：由於企業獲利為季報遞遲公布，而在景氣谷底時，EPS 若大崩盤會導致 PE 在低檔反而看起來暴增（假性昂貴）。
- **防禦機制**：系統不該將 PE 單獨寫死為量化引擎的「絕對賣出訊號」，而是僅作為**「供 AI 教練參考的總體經濟 Context」**。將判讀失真的責任交由 AI 大腦搭配國發會燈號進行統合判定。

### 資料流設計
與 PB 相同，在 `marketData.mjs` 打包出 `valuationInfo: { PB, PE }` ➔ 存入 `latest.json` ➔ `formatMacroChipForCoach()` 轉成人類易讀文案 ➔ 推給 `Investment Coach`。

---

## 📌 【AI 管線優化類】3. 新聞關鍵字（Keywords）優化
### 功能目標
提高 RSS 新聞搜尋的精準度，減少「無關痛癢的地方社會新聞」或「農場 SEO 文章」，讓 AI 大腦 `Search Queries Generator` 能更敏銳地隨著市場波動產出長尾、高價值的查詢陣列。

### 影響範圍
- `src/modules/ai/prompts.mjs` (修改 Prompt)
- `src/modules/newsFetcher.mjs` (優化權重分配)

### 實作步驟草案 (Step-by-Step)
1. **Few-Shot Prompting 導入**：在 `NEWS_KEYWORD_SYSTEM_PROMPT` 中，加入 3-4 個「好的關鍵字 vs 壞的關鍵字」的實作範例，讓 AI 直接模仿高手的搜尋技巧（例如嚴禁給出單字 "CPI" 而是要組合 "CPI inflation data"）。
2. **靜態與動態分離 (Base vs Dynamic)**：在 `newsFetcher.mjs` 內定好不可動搖的「底層靜態關鍵字池」（例如必定要查 Fed、PCE、台積電），並與 AI 生成的「動態關鍵字」做組合。
3. **RSS 標題過濾強化**：拿到關鍵字的 RSS 回傳後，使用更嚴格的正規表達式 (Regex)，先由純程式碼將不包含關鍵字原意的垃圾標題剃除。

### 潛在挑戰與防禦機制
- **AI 幻出無用關鍵字**：AI 可能創造過於冷門的關鍵字，導致 RSS 回傳 0 筆新聞。
- **防禦機制**：在 `newsFetcher.mjs` 中實作**回退機制**。如果動態關鍵字群總計找到的新聞數量過低（例如少於 5 篇），自動回退 (Fallback) 載入預設備份用的靜態熱門關鍵字清單，確保最終資料管線不會「斷流」。

### 資料流設計
`marketStatus` ➔ `GenerateSearchQueries (AI)` ➔ `newsFetcher` (合併 Base 關鍵字) ➔ 批次呼叫 Google News RSS ➔ 若新聞總數 < 5 啟用預設關鍵字補充 ➔ 去重管線。

---

## 📌 【AI 管線優化類】4. 新聞過濾機制優化（自動反向優化黑名單）
### 功能目標
打造具備「自我進化能力 (Self-Healing)」的新聞濾網機制。讓系統像真人一樣，若昨天被特定農場來源或假新聞騙了，今天能自動檢討，並生成新的 Regex 黑名單供未來防禦。

### 影響範圍
- `src/modules/newsFetcher.mjs` (切離 config)
- `src/config/blacklist.json` (新增此動態設定檔)
- `src/modules/ai/` (新增 `ruleOptimizerAgent.mjs`)
- `src/runDailyCheck.mjs` (或建立非同步/半夜運作的維護排程)

### 實作步驟草案 (Step-by-Step)
1. **設定檔外部化**：將 `twExcludedSources`（如 Yahoo、Yahoo奇摩理財）與 `usExcludeKeywords` 的黑名單字串從程式碼死區抽出，移至 `config/blacklist.json`。
2. **建立 Optimizer Agent**：設計一個全新的 Agent。將「昨日被 Filter Agent 放行的所有新聞」交給 Optimizer Agent 審核，Prompt：_「請嚴格審查這批新聞，揪出裡頭隱藏的農場文或個股無用新聞，並提煉出能通殺這類標題的 Regex 語法或來源名稱。」_
3. **新舊規則合併**：將 Optimizer Agent 輸出的新 Regex 附加回 `blacklist.json` 中。
4. **管線掛載**：隔日的 `newsFetcher.mjs` 啟動時動態 `import` 或讀取 `blacklist.json`，讓新規則自動生效。

### 潛在挑戰與防禦機制
- **AI 寫錯 Regex 導致大誤殺**：若 AI 寫出 `.*` 或是過於廣泛的關鍵字（如「台灣」），會導致整個新聞管線癱瘓，什麼重磅新聞都抓不到。
- **針對性的沙盒防護 (Sandbox Validation)**：
  1. AI 產出的新 Regex，在存寫進 `blacklist.json` 之前，必須經過 JavaScript 原生防呆編譯測試 `try { new RegExp(aiRule) } catch { 忽略 }`。
  2. 設計一組固定不變的「黃金標準新聞清單 (Golden DataSet)」（例如 Fed 升息報告、台積電法說會）。新 Regex 必須先套用於此清單，若**誤殺**了黃金清單的任何一條新聞，該新規則將被強制作廢，拒絕寫入。

### 資料流設計
今日被放行上榜的新聞記錄 ➔ 傳送給 `Rule Optimizer (AI)` ➔ 揪出漏網之魚農場文 ➔ 生成對應 `<New_Regex>` ➔ **沙盒驗證環境 (Sandbox)** 用黃金資料集碰撞 ➔ 若無誤殺則 `fs.writeFileSync` 更新 `blacklist.json` ➔ 隔日 `newsFetcher` 讀取並應用更強的防護罩。
