# 🚀 未來功能實作評估與規劃 (Upcoming Features)

本文件紀錄未來預計替「00675L 槓桿 ETF 投資決策系統」擴充的 4 項核心功能藍圖，包含大盤基本面指標的整合，以及 AI 新聞管線的持續進化。

---

## 📌 【指標擴充類】1. 加入大盤 PB（股價淨值比）指標（已完成尚未人工驗證）
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

## 📌 【指標擴充類】2. 加入大盤 PE（本益比）指標（已完成尚未人工驗證）
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

## 📌 【系統巡檢與測試類】6. 關鍵字搜尋良率計算 (Keyword Yield Rate)
### 功能目標
建立搜尋生成器（Search Queries Generator）的量化指標，計算「實際抓取到有效新聞的 Query 數」與「總生成 Query 數」的比例，藉此評估關鍵字是否精準。

### 影響範圍
- `src/modules/ai/aiCoach.mjs` (`generateDailySearchQueries` 函式)
- `src/modules/newsFetcher.mjs` (`getRawNews` 函式)

### 實作步驟草案 (Step-by-Step)
1. **計數器實作**：在 `generateDailySearchQueries` 產出關鍵字陣列時，紀錄生成的 Query 總數。
2. **有效回傳判定**：在 `getRawNews` 中，比對 `batch` 查詢條件送入 `rss-parser` 抓取後，經由 `prepareNewsForAI` 放行的新聞數量。若有抓到新聞，則將對應的 Query 記為「有效」。
3. **計算良率**：`有效 Query 的數量 / 總生成 Query 數量`。
4. **綁定 Generation**：運用 Langfuse Client，將算出的良率非同步寫回對應 `generateDailySearchQueries` 的 `generationId` 做數據追蹤。

### 潛在挑戰與防禦機制
- **挑戰**：若 Google News RSS 限流（Rate Limit）或網路超時，會導致良率被誤判為 0。
- **防禦**：需區分「找不到新聞（正常）」與「請求失敗（系統異常）」。若發生 `fetchRssFeed` 例外錯誤，應排除該分母，跳過該次良率打分，避免數據污染。

### 資料流設計
`Keyword Array` ➔ `newsFetcher` (批次打 Google News RSS) ➔ `Count Valid Results` ➔ `Math: valid / total` ➔ `Langfuse Client (.score)`

---

## 📌 【系統巡檢與測試類】7. 新聞維度多樣性評估 (Diversity Score)
### 功能目標
驗證雜訊過濾器（News Filter）輸出的 15 篇新聞，是否涵蓋了預設的宏觀維度（如總經、半導體、地緣等），並計算覆蓋率上傳至 Langfuse。

### 影響範圍
- `src/modules/ai/aiCoach.mjs` (`filterAndCategorizeAllNewsWithAI` 函式)

### 實作步驟草案 (Step-by-Step)
1. **提取維度屬性**：利用該函式中 `aiResult.think.dimension_check` 或直接 map 每篇保留新聞的維度。
2. **計算不重複維度**：使用 `new Set()` 蒐集目前陣列內不重複的維度名稱。
3. **計算覆蓋率與上傳**：計算 `Set().size / Expected_Dimension_Count`（例如規劃 5 種維度即除以 5），結果透過 `generation.score()` 非同步回寫。

### 潛在挑戰與防禦機制
- **挑戰**：LLM 可能會產生幻覺，發明不在標準列表內的錯誤維度名稱。
- **防禦**：在程式內定義嚴格的維度白名單，放入 Set 前先濾除非白名單字串。

### 資料流設計
`Filtered News Array` ➔ `map(article => article.dimension)` ➔ `Filter by Whitelist` ➔ `new Set()` ➔ `Calculate Coverage Ratio` ➔ `Langfuse Client (.score)`

---

## 📌 【系統巡檢與測試類】8. 多空邏輯一致性自動檢測 (Logic Consistency)
### 功能目標
自動比對總經分析師（Macro Analyst）給出的新聞評分總和，與最終得出的 BULL/BEAR/NEUTRAL 結論方向是否一致，以檢測 AI 推論邏輯是否矛盾。

### 影響範圍
- `src/modules/ai/aiCoach.mjs` (`analyzeMacroNewsWithAI` 函式)

### 實作步驟草案 (Step-by-Step)
1. **分數比對**：擷取生成的 `total_bull_score` 和 `total_bear_score`。
2. **門檻定義**：定義基本判讀邏輯，例如 `total_bull_score > total_bear_score` 偏向 BULL，反之 BEAR；極為接近時為 NEUTRAL。
3. **結論檢驗**：將比對結果與 `conclusion.market_direction` 交叉檢驗。完全吻合給 5 分，反向給 1 分，些微偏差（例如分數偏牛但結論是中立）給 3 分。
4. **寫入評分**：將邏輯檢測結果上傳至 Langfuse。

### 潛在挑戰與防禦機制
- **挑戰**：遇到極端重大事件時，單一事件的極高權重影響可能無法單純用語意上的加總數字來反映，導致 AI 給出的結論與總分相悖。
- **防禦**：判斷機制不影響原有決策，僅做 Langfuse 打分參考；若頻繁出現矛盾，可修改 Agent 的 Prompt 以優化打分權重，或透過紀錄後續修正算分邏輯。

### 資料流設計
`analyzeMacroNewsWithAI Result` ➔ `Compare (total_bull_score & total_bear_score)` ➔ `Check vs conclusion.market_direction` ➔ `Score Mapping (1/3/5)` ➔ `Langfuse Client (.score)`

---

## 📌 【AI 管線優化類】9. LLM-as-a-Judge: 建議可執行性與語氣評估 (Actionability & Tone)
### 功能目標
建立一個背景非同步機制，使用較低成本的 LLM 作為裁判，評估投資教練輸出的建議是否具體且符合教練語氣。

### 影響範圍
- `src/modules/ai/aiCoach.mjs` (`getAiInvestmentAdvice` 函式)
- `src/modules/ai/prompts.mjs` (Judge Prompt 管理)

### 實作步驟草案 (Step-by-Step)
1. **抽樣機制**：為了控制 API 成本，使用 `Math.random() < 0.2` (20% 機率) 控制呼叫 Judge 的頻率。
2. **觸發背景任務**：因專案為定期執行（`dailyCheck.mjs` 會在主流程執行完後結束 Promise），建議在 `dailyCheck.mjs` 最外層加上背景任務等待佇列 (Promise List)，或直接掛載非阻擋式 Promise，但在 `process.exit` 之前確保它們完成 (如 `Promise.allSettled`)。
3. **執行 Judge Prompt**：將教練輸出結果丟給輕量模型評估語氣標準。
4. **回寫評分**：將得到的評分綁定回原始的 `traceId` 寫入 Langfuse。

### 潛在挑戰與防禦機制
- **挑戰**：背景非同步任務如果在主流程立刻終止時被系統砍掉，會導致打分遺失。且 Judge 本身 API 呼叫如果過慢會拖累甚至報錯。
- **防禦**：Judge 的 API 呼叫必須給予嚴苛的 Timeout；主流程可透過一個全域的全非同步陣列 (`global.asyncTasks = []`) 來蒐集這些 Promise，並在退出前 `await Promise.allSettled(global.asyncTasks)`。

### 資料流設計
`getAiInvestmentAdvice Output` ➔ `Sampling Check` ➔ `Push to global.asyncTasks` ➔ `LLM Judge Request` ➔ `Langfuse Client (.score)`

---

## 📌 【系統巡檢與測試類】10. 導入自動化單元測試與 Mock 機制 (Automated Testing Framework)
### 功能目標
導入主流測試框架（建議 Jest 或 Vitest），針對既有的資料解析與字串清理等函式撰寫首批單元測試，確保未來大幅修改程式時不會破壞既有邏輯。

### 影響範圍
- `package.json` (新增 `test` 與依賴)
- `src/test/` (新增測試目錄與檔案，如 `src/test/utils.test.js`)
- `src/utils/coreUtils.mjs`, `src/modules/ai/aiDataPreprocessor.mjs` (測試標的)

### 實作步驟草案 (Step-by-Step)
1. **環境建置**：安裝 Jest/Vitest 並設定測試環境。
2. **Mock 資料蒐集**：收集過去錯誤的畸形 JSON 與特殊的 Prompt 回傳字串，當作 Mock payload。
3. **撰寫首批測試**：針對純函式撰寫測試，驗證邊界條件轉換是否正確。
4. **Mock 機制攔截 API**：使用 `jest.mock("@google/genai")` 攔截 `aiClient.mjs` 對外的網路請求。

### 潛在挑戰與防禦機制
- **挑戰**：對既有高耦合模組測試可能無意間戳到對外 API。
- **防禦**：於測試環境下嚴格禁用 `process.env.GEMINI_API_KEY1` 系列變數（改用假金鑰），若 Mock 失敗就會立刻阻擋真正的 HTTP 請求，確保測試不出錯且完全免費。

### 資料流設計
`Test Runner (npm run test)` ➔ `載入 src/test/*.test.js` ➔ `Mock 外部 API Module` ➔ `傳遞 Mock payload 至核心函式` ➔ `Assert 輸出正確性`
