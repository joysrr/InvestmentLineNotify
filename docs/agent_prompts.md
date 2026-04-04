# Agent Prompts 導覽 / Prompt Map

## 1. 文件目的
本文件不是逐字複製 `src/modules/ai/prompts.mjs`，而是提供 AI Agent / 開發者一份 prompt responsibility map，幫助快速定位每個 prompt 負責哪一段流程、對應哪些 schema、修改時可能影響哪些功能。

若未來 prompt 行為異常，請先看這份文件決定要改哪一類 prompt，再回到 `src/modules/ai/prompts.mjs` 實作。

---

## 2. Prompt 類型分組

### 2.1 Daily Decision Prompts
這一組服務每日主流程：
- Search query generation
- News filtering
- Macro analysis
- Investment advice

典型影響檔案：
- `src/modules/ai/aiCoach.mjs`
- `src/modules/ai/aiDataPreprocessor.mjs`
- `src/modules/newsFetcher.mjs`
- `src/dailyCheck.mjs`

### 2.2 Governance Prompts
這一組服務背景治理：
- Rule optimizer
- LLM judge

典型影響檔案：
- `src/modules/ai/ruleOptimizerAgent.mjs`
- `src/modules/ai/llmJudge.mjs`
- `src/runOptimizer.mjs`

### 2.3 Period Report Prompts
這一組服務週報 / 月報：
- Period report analysis

典型影響檔案：
- `src/modules/ai/periodReportAgent.mjs`
- `src/runWeeklyReport.mjs`
- `src/runMonthlyReport.mjs`
- `src/modules/notifications/templates/periodReportBuilder.mjs`

---

## 3. Search Query Prompt 維護重點
Search query prompt 是目前新聞品質的第一層入口。它必須與 `KeywordEntry` schema 配套工作：

```js
{ keyword: string, searchType: "intitle" | "broad" }
```

目前文件確認的設計要求包括：
- 輸出 6–8 組，不超過 8 組。
- 盡量避免單字縮寫與過度泛化字詞。
- 避免重複靜態基礎關鍵字。
- `intitle` 用於事件主角必須明確的 query，`broad` 用於市場情緒與廣泛議題。

若修改這段 prompt，請同步檢查：
- `src/modules/newsFetcher.mjs` 的 `validateDynamicKeyword()`
- `src/modules/newsFetcher.mjs` 的 `mergeKeywords()`
- `src/modules/keywordConfig.mjs` 的 base query coverage

---

## 4. News / Macro / Coach Prompt 維護重點
這三類 prompt 串起 daily AI 主流程：

1. **News Filter**：控制哪些文章會進入高價值摘要。
2. **Macro Analyst**：把新聞摘要轉成總經方向與權重判斷。
3. **Investment Coach**：將量化訊號、macro context、portfolio 狀態寫成最終建議。

修改時請記得：
- News filter 改太鬆，會讓 macro 與 coach 被低品質新聞污染。
- Macro analyst 的輸出若改欄位，會影響 `dailyCheck.mjs` 對 `macroMarketDirection` 的取值。
- Coach prompt 的輸出格式若改動，會影響 Telegram builder 與 `llmJudge` 的評估輸入。

---

## 5. Governance Prompt 維護重點

### Rule Optimizer
Rule optimizer prompt 的輸出不是直接上線規則，而是「候選規則」。因此修改時要注意：
- 生成內容要適合程式端 sandbox 驗證。
- 不要讓 prompt 產出過度寬泛、難以驗證的 regex 建議。
- 任何 schema 變更都可能影響 `runOptimizer.mjs` 與後續 blacklist 寫入流程。

### LLM Judge
Judge prompt 目前用來評估 `Actionability` 與 `Tone_and_Empathy`。這類 prompt 的重點不是產生使用者可讀內容，而是穩定、可比較、可回寫分數。

若修改 judge prompt，請一併檢查：
- score name 是否仍與 Langfuse config 對齊。
- `llmJudge.mjs` 解析欄位是否仍正確。
- daily pipeline 是否仍能在 judge 失敗時保持 non-blocking。

---

## 6. Period Report Prompt 維護重點
`PeriodReportAnalysis` 類型的 prompt 與 daily coach 最大差異在於：
- 它吃的是統計摘要，不是即時市場上下文。
- 它要輸出的是 period-level risk summary，而不是當日操作指令。

因此調整 period prompt 時，應優先檢查：
- `periodReportAgent.mjs` 中 `buildPeriodReportVariables()` 的資料是否足夠。
- `periodReportBuilder.mjs` 是否仍能正確呈現輸出欄位。
- Weekly / monthly 的用語是否需要分開。

---

## 7. AI Agent 快速定位指南
當 AI Agent 要修改 prompt，建議先問自己是哪一種問題：

- 關鍵字品質差 → search query prompt
- 新聞摘要品質差 → news filter prompt
- 多空方向不合理 → macro analyst prompt
- 建議語氣或行動性不足 → investment coach prompt 或 judge prompt
- blacklist 治理失效 → rule optimizer prompt
- 週報 / 月報摘要空泛 → period report prompt

這份文件的目的，就是讓後續開發者先定位 prompt 類別，再進入 `src/modules/ai/prompts.mjs`，避免在大型 prompt 檔中盲改。
