# Pre-plan Features (待評估與實作功能池)

本文件放置尚未進入正式開發階段的功能規劃草案。
未來將由 `AI Agent` 分析目前 Node.js 專案的實際結構（包含檔案路徑、現有模組架構、Langfuse 封裝層等）後，補齊細節並搬移至 `upcoming_features.md`。

---

### 1. 自動化格式與結構驗證機制 (Schema & Format Validation)

**1. 功能目標**
透過程式規則（Rule-based）自動攔截並評估 AI 輸出的結構穩定度，包含驗證 JSON 解析是否成功，以及特定 Markdown 區塊（如：投資教練的必要區塊）的完整性。結果將回傳至 Langfuse 的 `Schema_Validation` 與 `Format_Compliance`。

**2. 影響範圍**
- `[待補齊：專案內呼叫 LLM 的核心 Service 或 Utility 路徑]`
- `[待補齊：Langfuse SDK 初始化的檔案路徑]`

**3. 實作步驟草案 (Step-by-Step)**
1. **建立 Validator 邏輯：** 建立針對 AI 回傳字串的清理函式（去除 markdown code block 標記）與驗證函式。
2. **解析與攔截：** 使用 `try-catch` 搭配 `JSON.parse()` 測試解析能力；或針對純文字輸出使用 Regex 驗證。
3. **錯誤處理與評分：** 
   - `[待分析：要將評分邏輯寫在攔截器 (Interceptor) 層，還是各個 Prompt 的 Output Parser 中？]`
4. **非同步寫入：** 透過 Langfuse Node.js SDK，將對應的 Score 綁定至該次 `traceId` 進行非同步回寫。

**4. 潛在挑戰與防禦機制**
- **挑戰：** AI 輸出 JSON 時可能帶有無效字元或遺漏括號，導致 `JSON.parse` 拋出例外中斷主流程。
- **防禦：** 評估機制絕對不可阻塞主業務邏輯。發生解析錯誤時，應靜默捕捉例外（Catch Exception），給予 `Schema_Validation = 0`，再決定是否進入重試 (Retry) 機制。

**5. 資料流設計**
`Raw LLM Response` ➔ `String Cleaner` ➔ `JSON.parse / Regex` ➔ `Generate Boolean/Numeric Score` ➔ `Langfuse Client (.score)` ➔ `Return Parsed Object or Fallback`

---

### 2. 關鍵字搜尋良率計算 (Keyword Yield Rate)

**1. 功能目標**
建立搜尋生成器（Search Queries Generator）的量化指標，計算「實際抓取到有效新聞的 Query 數」與「總生成 Query 數」的比例，藉此評估關鍵字是否精準。

**2. 影響範圍**
- `[待補齊：處理搜尋關鍵字生成的模組路徑]`
- `[待補齊：執行實際新聞檢索 / 爬蟲的檔案路徑]`

**3. 實作步驟草案 (Step-by-Step)**
1. **計數器實作：** 在生成關鍵字陣列時，紀錄 `totalQueries = queries.length`。
2. **有效回傳判定：** 
   - `[待分析：目前新聞獲取的 API 或資料庫檢索邏輯為何？如何定義「有效」的標準（如：回傳結果 > 0）？]`
3. **計算良率：** `validQueries / totalQueries`。
4. **綁定 Generation：** 將計算結果非同步寫入 Langfuse，建議綁定到生成關鍵字的 `generationId` 而非最外層的 `traceId`。

**4. 潛在挑戰與防禦機制**
- **挑戰：** 若外部新聞 API 限流（Rate Limit）或網路超時，會導致良率被誤判為 0。
- **防禦：** 需區分「找不到新聞（正常邏輯）」與「API 請求失敗（系統異常）」。若為系統異常，應跳過此次打分，避免污染 Langfuse 數據。

**5. 資料流設計**
`Keyword Array` ➔ `News Fetcher (Promise.all / for-of)` ➔ `Count Valid Results` ➔ `Math: valid / total` ➔ `Langfuse Client (.score)`

---

### 3. 新聞維度多樣性評估 (Diversity Score)

**1. 功能目標**
驗證雜訊過濾器（News Filter）輸出的 15 篇新聞，是否涵蓋了預設的宏觀維度（如總經、半導體、地緣等），並計算覆蓋率上傳至 Langfuse。

**2. 影響範圍**
- `[待補齊：負責 News Filter 資料處理的模組路徑]`

**3. 實作步驟草案 (Step-by-Step)**
1. **提取維度屬性：** 從過濾後的新聞 JSON 陣列中，使用 `map()` 提取出 AI 標註的 `dimension`。
2. **計算不重複維度：** 
   - `[待分析：確認目前 Prompt 要求輸出的維度名稱有哪些？並實作 Set 或 lodash.uniq 來計算不重複的維度數量]`
3. **計算覆蓋率與上傳：** `uniqueDimensions.size / expectedDimensionsCount`，結果回寫 Langfuse。

**4. 潛在挑戰與防禦機制**
- **挑戰：** LLM 可能會產生幻覺，發明不在標準列表內的維度名稱。
- **防禦：** 需在程式中定義一份維度白名單（Array / Enum）。在放進 `Set` 計算前，先過濾掉不在白名單內的無效字串。

**5. 資料流設計**
`Filtered News Array` ➔ `.map(article => article.dimension)` ➔ `Filter by Whitelist` ➔ `new Set()` ➔ `Calculate Coverage Ratio` ➔ `Langfuse Client (.score)`

---

### 4. 多空邏輯一致性自動檢測 (Logic Consistency)

**1. 功能目標**
自動比對總經分析師（Macro Analyst）給出的新聞評分總和，與最終得出的 BULL/BEAR/NEUTRAL 結論方向是否一致，以檢測 AI 推論邏輯是否矛盾。

**2. 影響範圍**
- `[待補齊：處理 Macro Analyst 解析的檔案路徑]`

**3. 實作步驟草案 (Step-by-Step)**
1. **分數聚合：** 使用 `reduce()` 累加 15 篇新聞的影響力評分（區分利多正分、利空負分）。
2. **門檻定義與比對：** 
   - `[待分析：決定正負分的閥值區間（Threshold）對應 BULL/BEAR 的邏輯]`
3. **結論檢驗：** 將聚合結果與 AI 的文字結論交叉比對。完全一致給 5 分，反向給 1 分，些微偏差給 3 分。上傳至 Langfuse。

**4. 潛在挑戰與防禦機制**
- **挑戰：** 遇到極端重大事件（如核戰爆發）時，單一事件的分數可能不足以翻轉總分，但 AI 的結論會優先考量重大事件。
- **防禦：** 在 `reduce()` 聚合時加入極端值權重（例如滿分 5 分的利空事件直接覆寫總分為 BEAR），減少系統誤判 AI 邏輯矛盾的機率。

**5. 資料流設計**
`Analyst Result (Scores + Conclusion)` ➔ `Array.reduce (Sum Net Score)` ➔ `Threshold Matching Logic` ➔ `Score Mapping (1/3/5)` ➔ `Langfuse Client (.score)`

---

### 5. LLM-as-a-Judge: 建議可執行性與語氣評估 (Actionability & Tone)

**1. 功能目標**
建立一個背景非同步機制，使用較低成本的 LLM（如 GPT-4o-mini）作為裁判，評估投資教練（Investment Coach）輸出的建議是否具體且符合教練語氣。

**2. 影響範圍**
- `[待補齊：Node.js 背景任務排程器 (如 BullMQ/Agenda) 或非同步事件總線 (EventEmitter) 的路徑]`
- `[待補齊：Judge Prompt 管理位置]`

**3. 實作步驟草案 (Step-by-Step)**
1. **抽樣機制：** 實作 `Math.random()` 控制抽樣比例（如 20%），避免每次都觸發 Judge 導致 API 成本過高。
2. **觸發背景任務：** 
   - `[待分析：目前專案架構適合直接使用 setTimeout / Promise.catch 脫離主執行緒，還是需要引入 Message Queue 系統？]`
3. **執行 Judge Prompt：** 將 Coach 輸出連同評分標準丟給輕量級 LLM。
4. **回寫評分：** 將解析出的 1~5 分綁定回原始的 `traceId` 寫入 Langfuse。

**4. 潛在挑戰與防禦機制**
- **挑戰：** Judge 本身也是 LLM，可能回傳無法解析的格式，或是延遲過高拖累系統效能。
- **防禦：** Judge 的 API 呼叫必須設定較短的 Timeout，且不依賴其回傳值作任何主流程的阻斷（Fire-and-Forget）。

**5. 資料流設計**
`Coach Output Text + TraceId` ➔ `Sampling Logic` ➔ `Event Emitter / Background Queue` ➔ `LLM Judge Request` ➔ `Langfuse Client (.score)`

---

### 6. 導入自動化單元測試與 Mock 機制 (Automated Testing Framework)

**1. 功能目標**
為專案導入 Node.js 主流測試框架（建議使用 Jest 或 Vitest），建立測試目錄結構，並針對既有的資料解析（Parser）、字串清理（String Cleaner）等純邏輯函式撰寫第一批單元測試，確保未來 AI Agent 修改程式碼時不會破壞既有邏輯。

**2. 影響範圍**
- `package.json` (新增開發依賴與 test script)
- `[待分析/補齊：專案根目錄是否需要建立 /__tests__/ 或採用 *.test.js 同層目錄規範]`
- `[待分析/補齊：目前專案中最適合作為首批測試對象的 Utility / Helper function 檔案路徑]`

**3. 實作步驟草案 (Step-by-Step)**
1. **環境建置：** 配置測試套件與設定檔（如 `jest.config.js`）。
2. **目錄規劃與 Mock 準備：** 建立標準測試資料夾結構，並準備測試用的假資料。
   - `[待分析：請從現有 Langfuse 或 LLM 回傳格式中，萃取出常見的畸形 JSON 字串作為 Mock Data]`
3. **撰寫首批測試：** 挑選沒有外部 API 依賴的純函式（Pure Functions），撰寫基礎的單元測試（涵蓋正常情境與極端情境）。
4. **整合 NPM Script：** 確保可以透過 `npm run test` 順利執行並產出報表。

**4. 潛在挑戰與防禦機制**
- **挑戰：** 專案高度依賴外部 LLM API 與 Langfuse，若測試直接呼叫會消耗真實 Token 並拉長測試時間。
- **防禦：** 嚴格規範單元測試中「不可發起真實網路請求」。
   - `[待分析/補齊：請規劃實作 Mock 機制 (如 jest.mock) 攔截 HTTP 請求的具體作法]`

**5. 資料流設計**
`Test Runner (npm run test)` ➔ `載入 *.test.js` ➔ `Mock 外部 API (Langfuse/LLM)` ➔ `執行業務邏輯函式` ➔ `斷言 (Expect/Assert)` ➔ `輸出測試成功/失敗報表`