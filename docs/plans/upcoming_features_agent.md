# [實作計畫] Langfuse 評分機制整合 (InvestmentLineNotify)

## 🎯 Context & Goal
本專案 (InvestmentLineNotify) 是一個 Node.js 基礎的自動化推播系統。
目前已深度整合 Langfuse 與 Gemini，但 `callGemini` 尚未將 `traceId` 暴露給外部，導致無法在 AI 呼叫完成後回寫 Score。

本任務的目標是：
1. **最小解耦**：讓 `callGemini` 回傳 `traceId`，使外部呼叫方能透過 `langfuse.score()` 進行評分。
2. **實作 Rule 類評分**：在解析 AI 輸出後，透過程式自動打分，監控 JSON Schema、關鍵字良率與新聞分佈等指標。
3. **預留 Human/Judge 類評分入口**：為無法程式自動判斷的項目建立標記，以便未來抽查與擴充。

⚠️ **核心原則**：
- 分數寫入必須包在 `try/catch` 中，**絕對不可以**因為 Langfuse 錯誤而中斷或拋錯影響主流程 (`dailyCheck.mjs`)。
- 分數定義一律以 `langfuse-score-configs.md` 的描述為主。

---

## 📂 預估修改檔案清單 (Files to Edit)

| 檔案路徑 | 負責內容 |
|---|---|
| `src/modules/ai/aiClient.mjs` | 調整 `callGemini` 回傳格式，返回 `{ text, traceId }` |
| `src/modules/ai/aiCoach.mjs` | 調整各 API 的解構方式；在 parse 與邏輯執行後新增 `langfuse.score()` 呼叫 |
| `src/modules/newsFetcher.mjs` | 協助計算 `Keyword_Yield_Rate` 等指標，並傳遞 traceId |
| `src/modules/ai/prompts.mjs` | (若有需要) 確保 prompt config 內無衝突參數 |
| `src/runOptimizer.mjs` | (若有使用 callGemini) 同步調整解構方式 |

---

## 🛠️ Step-by-Step Implementation

### Phase 0: 最小解耦與全域替換
**目標**：讓所有的 `callGemini` 呼叫都能取得 `traceId`，且不破壞現有流程。

1. **修改 `aiClient.mjs`**：
   - 找到 `callGemini` 函數，在成功 return 與失敗 throw 之前。
   - 原始：`return text;`
   - 改為：`return { text, traceId: trace.id };`
2. **全域替換呼叫方**：
   - 搜尋專案內所有呼叫 `callGemini` 的地方。
   - 原始：`const aiResponseText = await callGemini(...);`
   - 改為：`const { text: aiResponseText, traceId } = await callGemini(...);`
3. **驗證點**：
   - 執行 `npm start` (或 dry-run 模式)，確認新聞抓取與推播流程未被破壞。

---

### Phase 1: 基礎 Rule 類評分上線
**目標**：實作可 100% 透過程式自動判斷的 Score。
*(注意：所有的 `langfuse.score()` 都要非同步執行且包裝在 try/catch 內)*

1. **實作 `Schema_Validation`** (於 `aiCoach.mjs`):
   - 在每個有做 `JSON.parse` 的地方（如 `generateDailySearchQueries`、`filterAndCategorizeAllNewsWithAI` 等）。
   - 解析成功：寫入 `langfuse.score({ traceId, name: "Schema_Validation", value: 1 /* True */ })`
   - 解析失敗：寫入 `value: 0` 並帶上 `comment: 錯誤訊息`。
2. **實作 `Format_Compliance`** (於 `aiCoach.mjs`):
   - 在 `getAiInvestmentAdvice` 中。
   - 檢查回傳字串是否包含特定區塊標記（如 `<市場總結>`、`<具體動作>`，請依實際 prompt 判斷）。
   - 完整則 value=1，缺漏則 value=0。
3. **實作 `Diversity_Score`** (於 `aiCoach.mjs`):
   - 在 `filterAndCategorizeAllNewsWithAI` 內。
   - **建立白名單常數**：`const VALID_DIMENSIONS = ["總經", "地緣政治", "資金流向", "半導體", "台股大盤", "全球市場"]`
   - 讀取每篇保留新聞的 `dimension_check`，過濾出在白名單內的。
   - 計算不重複維度數量。
   - 分數 = `涵蓋數量 / VALID_DIMENSIONS.length`，寫入 Score。
4. **實作 `Score_Distribution_Spread`** (於 `aiCoach.mjs`):
   - 在 `analyzeMacroNewsWithAI` 內。
   - 取得所有新聞的 1-5 分影響力分數。
   - 計算標準差 (Standard Deviation)。
   - 分數 = `stdDev / 2` (限制在 0~1 之間)，寫入 Score。
5. **實作 Yield Rate (關鍵字良率)** (跨模組):
   - `aiCoach.mjs` 的 `generateDailySearchQueries` 需要回傳 `{ queries, traceId }` 給 `newsFetcher.mjs`。
   - `newsFetcher.mjs` 執行完抓取後，計算：
     - `Keyword_Yield_Rate`: 有抓到新聞的 query 數 / 總 query 數。
     - `Dynamic_Keyword_Yield_Rate`: 僅計算 AI 動態生成的 query 良率。
   - 利用傳遞過來的 `traceId` 寫入這兩個 Score。

---

### Phase 2: Human / LLM 類評分準備
**目標**：為目前尚不打算完全自動化的評估項目，留下關聯與註記。

1. **預留環境變數**：
   - 在 `.env.example` 新增以下變數：
     ```env
     LLM_JUDGE_MODE=weekly # weekly, random, always, off
     LLM_JUDGE_WEEKDAY=1   # 1=Monday
     LLM_JUDGE_SAMPLE_RATE=0.2
     ```
2. **建立背景任務佇列** (於 `dailyCheck.mjs` 或類似的進入點)：
   - 建立 `global.asyncTasks = []`。
   - 在流程結尾 (推播完成後) 加入 `await Promise.allSettled(global.asyncTasks)`。
3. **實作 Actionability & Tone_and_Empathy 的空殼** (於 `aiCoach.mjs`):
   - 在 `getAiInvestmentAdvice` 尾部，加入抽樣判斷邏輯 (根據 LLM_JUDGE_MODE)。
   - 如果觸發，將一個「未來將呼叫 LLM Judge」的 Promise 放進 `global.asyncTasks`。
   - *(初期此 Promise 可以直接 resolve，僅記錄 "Judge tasks triggered for traceId: xxx")*

---

## 🧪 驗收與檢查清單 (Agent Checklist)

- [ ] `callGemini` 回傳值已變更，且沒有破壞現有的 `await callGemini()` 解構。
- [ ] 所有 `langfuse.score()` 都有 `try/catch` 保護，不會阻斷主流程。
- [ ] `Schema_Validation` 使用 Numeric/Boolean 表示 (依舊文件，Boolean 需轉為 1/0)。
- [ ] `Diversity_Score` 計算前有使用白名單過濾，避免 LLM 幻覺污染維度分母。
- [ ] `dailyCheck.mjs` 等主流程檔案可以正常執行完畢並退出，沒有被 unhandled promise rejection 卡住。