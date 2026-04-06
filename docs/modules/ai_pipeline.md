# AI 決策管線 / AI Pipeline

## 1. 模組定位
`src/modules/ai/` 是本專案的 decision intelligence layer，負責把量化訊號、新聞、總經資料與歷史報告轉成結構化 AI 輸出。除了每日投資建議，這一層也涵蓋新聞治理、週期報告與品質評估。

目前 AI 模組的角色可以分成三類：
- **Main decision agents**：每日決策相關的 search queries、news filter、macro analyst、investment coach。
- **Governance agents**：`ruleOptimizerAgent.mjs`、`llmJudge.mjs`，負責治理與品質評估。
- **Period agents**：`periodReportAgent.mjs`，負責週報 / 月報統計運算、訊號準確率計算與 AI 摘要生成。

---

## 2. 核心檔案
| Path | 說明 |
|---|---|
| `src/modules/ai/aiClient.mjs` | 共用 AI client，負責 provider dispatch、Langfuse trace、模型呼叫與共用防護。 |
| `src/modules/ai/aiCoach.mjs` | 每日主 AI orchestration，產生 search queries、macro analysis、investment advice。 |
| `src/modules/ai/aiDataPreprocessor.mjs` | 將市場資料、總經資料與新聞結果轉為低 token、可讀的 AI context。 |
| `src/modules/ai/prompts.mjs` | 所有 system prompts、schema、judge config 與 prompt 常數集中處。 |
| `src/modules/ai/ruleOptimizerAgent.mjs` | 根據近期新聞與 blacklist 情況，提出候選規則供治理流程檢查。 |
| `src/modules/ai/llmJudge.mjs` | 對 Investment Advice 結果執行條件式品質評分，至少包含 `Actionability` 與 `Tone_and_Empathy`。 |
| `src/modules/ai/periodReportAgent.mjs` | 從 `data/reports/` 載入近 7 / 30（或 50）天報告，執行純統計、訊號準確率計算，再呼叫 AI 產出週報 / 月報摘要。 |

---

## 3. 每日主決策 Agent Flow

### 3.1 Search Queries Generator
此角色會依市場狀況產生台股與美股搜尋關鍵字，輸出 `twQueries` 與 `usQueries`。在目前版本中，關鍵字不是隨意字串，而是結構化的 `KeywordEntry`：

```js
{ keyword: "TSMC earnings guidance", searchType: "intitle" }
```

已整合的規則包含：
- 輸出 6–8 組為主，不超過 8 組。
- 避免只輸出單字縮寫，例如單獨 `CPI`。
- 盡量避免與靜態 `baseTwQueries` / `baseUsQueries` 重複。
- `searchType` 明確區分 `intitle` 與 `broad`。

這一段對 AI Agent 很重要，因為後續若新聞品質下降，第一個要檢查的不是 `newsFetcher`，而是 search query prompt 與 schema 驗收條件。

### 3.2 News Filter
News filter 不只做語意摘要，也扮演 quality gate。除了 AI 過濾，本專案還有程式層的 `validateDynamicKeyword()`、`mergeKeywords()`、來源黑名單與 regex 過濾，因此 AI filter 並不是唯一防線。

### 3.3 Macro Analyst
`analyzeMacroNewsWithAI()` 會將整理後的新聞摘要轉成多空分析結果，並輸出市場方向，例如 `BULLISH`、`BEARISH`、`NEUTRAL`。這個方向值會回注到 `strategyEngine` 的輸入，成為量化訊號之外的情緒補充。

### 3.4 Investment Coach
`getAiInvestmentAdvice()` 是每日主建議輸出。其輸入同時包含：
- strategy result，
- portfolio state，
- VIX / US risk，
- macro analysis，
- news summary，
- preprocessed macro & chip context。

**持倉成本與損益資訊（自 2026-04-04）**

`aiDataPreprocessor.mjs` 的 `formatQuantDataForCoach()` 現已包含「持倉成本與損益」段落，將 `avgCost0050` / `avgCostZ2` 與即時價格對比計算未實現損益率後注入 `quantTextForCoach`：

```
【持倉成本與損益】
0050：均價 79.5，現價 82.3，未實現損益 +3.52%
00675L：均價 12.1，現價 11.8，未實現損益 -2.48%
```

Coach AI 可直接參考持倉成本與目前價格差距，進行加碼 / 減碼建議。如果 Google Sheet 均價欄位為空，則顯示「(未設均價)」，不中斷主流程。

這代表 Coach 並不是直接看原始資料，而是站在「已整理上下文」上產出最終建議。若未來要調整建議品質，優先檢查 `aiDataPreprocessor.mjs` 與 `prompts.mjs`。

---

## 4. Governance Agents

### 4.1 Rule Optimizer
`ruleOptimizerAgent.mjs` 是背景治理流程的一部分，通常由 `src/runOptimizer.mjs` 單獨觸發。它不直接改寫正式結論，而是提出候選規則，之後再經過程式側驗證與寫入。

### 4.2 LLM Judge
`llmJudge.mjs` 並不是每次都執行，而是由 `shouldRunJudge()` 依環境變數條件判斷：
- `weekly`：每週指定星期幾執行。
- `random`：依 sample rate 抽樣執行。
- `always`：每次都執行。

當 `dailyCheck.mjs` 取得有效 `adviceTraceId` 且 `aiAdvice` 為物件時，會條件式呼叫 `runJudge()`。Judge 目前至少評估兩個面向：
- `Actionability`
- `Tone_and_Empathy`

這一段屬於 **主流程中的條件式背景評估**。它不是主要決策產生器，但仍屬 daily pipeline 的一部分，且被設計成 non-blocking score writeback。

---

## 5. Period Report Agent

`periodReportAgent.mjs` 的流程分成三段：

1. **Pure stats stage**：`loadRecentReports(days)` 從 `data/reports/` 讀取近 N 天 JSON，`buildPeriodStats()` 計算指標統計、過熱持續天數、冷卻期阻擋、策略一致性、總經方向，以及月報額外的 signal quality。

2. **Signal accuracy stage**：`buildSignalAccuracyStats(targetReports, priceSeriesReports, period)` 對同一批報告進行訊號準確率分析，不依賴外部資料來源，完全使用 `data/reports/` 中已存入的 `signals.currentPrice`。

3. **AI summary stage**：`generatePeriodAiSummary()` 將統計結果與過去 `risk_warnings` 聚合後送入 AI，最後由 `periodReportBuilder.mjs` 組出 Telegram 週報 / 月報訊息。

這代表週報與月報不是重跑一次 daily pipeline，而是以 **daily report archives 為資料來源的 second-order analysis**。

### 5.1 訊號分類邏輯

訊號分類集中在 `periodReportAgent.mjs` 內，以結構化欄位為主要判斷依據：

| 函式 | 判斷依據 | 說明 |
|---|---|---|
| `isBuySignal(signals)` | `signals.suggestedLeverage > 0` 或 `signals.targetAllocation.leverage > 0`；備用：`target` 字串包含「破冰加碼」或「買進訊號」 | 實際觸發買進建議 |
| `isCooldownBlocked(signals)` | `cooldownStatus.inCooldown === true` 且 `weightScore >= minWeightScoreToBuy` | 分數達標但被冷卻期擋住，計入準確率分母 |

風控攔截（維持率低、估值泡沫、再平衡）與中性觀望不計入分母，這些屬於一票否決的前置條件。

### 5.2 `buildSignalAccuracyStats()` 輸出結構

```js
{
  buySignalCount: 5,           // 觸發買進訊號次數
  cooldownBlockedCount: 2,     // 冷卻期封鎖次數
  totalEligibleDays: 7,        // 合計計入分母天數
  cooldownBlockRate: 0.29,     // 冷卻封鎖比率
  signalDetails: [             // 各筆訊號明細（月報才含 returnN 欄位）
    {
      date: "2026-03-15",
      type: "buy",
      returnD5: 2.3,            // +5 日報酬率（月報）
      returnD10: -0.8,          // +10 日報酬率（月報）
      returnD20: 4.1,           // +20 日報酬率（月報）
    }
  ],
  avgReturn: { d5: 1.8, d10: 0.6, d20: 2.9 },  // 月報平均報酬率（null for 週報）
  winRate: { d5: 0.6, d10: 0.4, d20: 0.8 },    // 月報勝率（null for 週報）
  dataNote: "部分天數距今不足 20 日，d20 樣本 3/5"  // 說明文字（null for 週報）
}
```

### 5.3 Langfuse 觀測機制

`generatePeriodAiSummary()` 呼叫 AI 後，會透過 `safeLangfuseScore()` 寫入以下兩個 score（任一寫入失敗只 `console.warn`，不阻斷主流程）：

| Score 名稱 | 類型 | 寫入時機 | 說明 |
|---|---|---|---|
| `Schema_Validation` | Boolean | AI 回傳 JSON parse 成功後 | 驗證 JSON 能正確解析，value = 1 表示成功 |
| `Format_Compliance` | Boolean | Schema 驗證通過後 | 驗證 `topRiskEvents` 為非空陣列、`consistencyComment` 與 `periodOutlook` 為非空字串，value = 1 / 0 |

score 寫入後，`generatePeriodAiSummary()` 會輸出 CI 觀測用 log：

```
🤖 [PeriodReport] AI 摘要產出完成 (過去 5)
  ⚠️  風險事件: 2 項
  📝 一致性評語: ...前 30 字...
  🔭 展望: ...前 30 字...
```

### 5.4 AI 軌跡持久化

AI 呼叫成功後，會非同步呼叫 `archiveManager.saveAiLog()` 將以下內容寫入 `data/ai_logs/`：

```js
{
  type: "PeriodReport",
  periodLabel,          // "過去 5" 或 "過去 30"
  promptVariables,      // 送入 AI 的統計摘要與風險警告
  schema: PERIOD_REPORT_SCHEMA,
  rawResult: aiSummary  // AI 回傳物件
}
```

寫入失敗只 `console.warn`，不阻斷報告發送。

---

## 6. 技術注意事項：`callAI` 回傳格式

`callAI()` 回傳 `{ text: string, traceId: string }`，**不是**直接回傳物件。`text` 為 AI 回傳的原始 JSON 字串，必須經 `JSON.parse(text)` 才能使用。`periodReportAgent.mjs` 的 `generatePeriodAiSummary()` 已正確處理此流程。若未來新增其他 period 類 agent，請比照此模式。
