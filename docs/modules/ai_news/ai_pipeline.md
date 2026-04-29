# AI 管線架構 (`src/modules/ai/`)

系統所有的 LLM 呼叫皆集中於此目錄，主要依賴 Gemini API 進行推論。

## 1. 核心組件

- **`aiClient.mjs`**：負責與 Gemini API 溝通的底層封裝。實作了重試機制 (`withRetry`)、Timeout 防護，以及 Langfuse 觀測平台的追蹤 (Tracing)。
- **`aiCircuitBreaker.mjs`**：斷路器機制。當 AI API 連續發生 5xx 錯誤或 Timeout 時，自動跳脫 (Trip)，改以純文字備用輸出，避免阻斷主程式生成戰報。
- **`aiDataPreprocessor.mjs`**：在把 MarketData 丟給 LLM 之前，負責把數字格式化為易讀字串，降低 LLM 產生幻覺 (Hallucination) 的機率。

## 2. 應用 Agent

- **`aiCoach.mjs`**：主戰報生成 Agent，負責統整 `strategyEngine` 的決策、技術指標，產出「市場總結」與「投資心態建議」。同時也負責 `filterAndCategorizeAllNewsWithAI()` 執行新聞第二層過濾。
- **`llmJudge.mjs`**：用於評鑑 AI 產出的內容品質 (LLM-as-a-Judge)。
- **`periodReportAgent.mjs`** / **`ruleOptimizerAgent.mjs`**：用於週期性回顧與策略參數優化建議。

## 3. Langfuse 整合

所有的 AI 生成請求都會綁定 `sessionId` 與 `traceId`，並上傳至 Langfuse 儀表板，以便後續分析 Prompt 的效果與 Token 消耗量。若 Langfuse 服務無回應，會安全失敗 (fail-safe)，不影響主程式運行。
