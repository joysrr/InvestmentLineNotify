# AI 決策管線 / AI Pipeline

## 1. 模組定位

`src/modules/ai/` 是本專案的 decision intelligence layer，負責把量化訊號、新聞、總経資料與歷史報告轉成結構化 AI 輸出。除了每日投資建議，這一層也涵蓋新聞治理、週期報告與品質評估。

目前 AI 模組的角色可以分成三類：

- **Main decision agents**：每日決策相關的 search queries、news filter、macro analyst、investment coach。
- **Governance agents**：`ruleOptimizerAgent.mjs`、`llmJudge.mjs`，負責治理與品質評估。
- **Period agents**：`periodReportAgent.mjs`，負責週報 / 月報統計運算、訊號準確率計算與 AI 摘要生成。

---

## 2. 核心檔案

| Path                                    | 說明                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/modules/ai/aiClient.mjs`           | 共用 AI client，負責 provider dispatch、Langfuse trace、模型呼叫與共用防護。                                 |
| `src/modules/ai/aiCoach.mjs`            | 每日主 AI orchestration，產生 search queries、macro analysis、investment advice。                            |
| `src/modules/ai/aiDataPreprocessor.mjs` | 將市場資料、總経資料與新聞結果轉為低 token、可讀的 AI context。                                              |
| `src/modules/ai/prompts.mjs`            | 所有 system prompts、schema、judge config 與 prompt 常數集中處。                                             |
| `src/modules/ai/ruleOptimizerAgent.mjs` | 根據近期新聞與 blacklist 情況，提出候選規則供治理流程檢查。                                                  |
| `src/modules/ai/llmJudge.mjs`           | 對 Investment Advice 結果執行條件式品質評分，至少包含 `Actionability` 與 `Tone_and_Empathy`。                |
| `src/modules/ai/periodReportAgent.mjs`  | 從 `data/reports/` 載入近 7 / 30（或 50）天報告，執行純統計、訊號準確率計算，再呼叫 AI 產出週報 / 月報摘要。 |

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

`analyzeMacroNewsWithAI()` 會將整理後的新聞摘要轉成多空分析結果，並輸出市場方向，例如 `BULLISH`、`BEARISH`、`NEUTRAL`。這個方向値會回注到 `strategyEngine` 的輸入，成為量化訊號之外的情緒補充。

### 3.4 Investment Coach

`getAiInvestmentAdvice()` 是每日主建議輸出。其輸入同時包含：

- strategy result，
- portfolio state，
- VIX / US risk，
- macro analysis，
- news summary，
- preprocessed macro & chip context，
- `previousAdviceSummary`（前次建議摘要，由 `archiveManager.getPreviousAdviceSummary()` 載入）。

**函式簽名**

```js
export async function getAiInvestmentAdvice(
  marketData,
  portfolio,
  vixData,
  newsSummaryText,
  macroTextForCoach,
  macroAndChipStr,
  previousAdviceSummary = "",  // 前次建議摘要（第一次執行或無歷史時為空字串）
  onlyPrompt,                  // true 時直接回傳象徵字串，不呼叫 AI
)
```

> **Prompt 注入說明**：Langfuse 的 `Report/InvestmentAdvice` 模板需在適當位置加入 `{{previousAdviceSummary}}`，建議放在 quantText 與 macroText 之間。若前次建議為空字串，模板應對文字空白與缺欄位容錯處理。

**持仓成本與損益資訊（自 2026-04-04）**

`aiDataPreprocessor.mjs` 的 `formatQuantDataForCoach()` 現已包含「持仓成本與損益」段落，將 `avgCost0050` / `avgCostZ2` 與即時價格對比計算未實現損益率後注入 `quantTextForCoach`：

```
【持仓成本與損益】
0050：均價 79.5，現價 82.3，未實現損益 +3.52%
00675L：均價 12.1，現價 11.8，未實現損益 -2.48%
```

Coach AI 可直接參考持仓成本與目前價格差距，進行加碼 / 減碼建議。如果 Google Sheet 均價欄位為空，則顯示「(未設均價)」，不中斷主流程。

**大盤量價概覽（自 2026-04-14）**

`aiDataPreprocessor.mjs` 也會將 `marketData.mjs` 中的 `data.rawMarketOverview` 轉寫為「大盤量價概覽」段落，並合並進 `Macro_And_Chip_Status` 供 Coach 使用。核心內容包含：

- 加權指數收盤價與當日漲跌（點數與百分比）。
- 當日全市場成交金額（億元）。
- 相對近 20 個交易日平均成交金額的量能倍率。
- 近 20 日內最大成交金額的參考比例。
- 量價情境標籤（例如：放量大跌、放量大漲、量縮整理、放量整理⽯換手、量縮下跌等）。
- 一段給教練用的 AI 解讀提示文字。

範例（簡化示意）：

```
6. 大盤量價概覽：加權指數收盤 19,800 點，今日 -123 點（-0.6%）。
   成交金額：3,200 億元，約為近 20 日均量的 0.8 倍，量能顯著低於均値。
   情境：量縮下跌（非恐慡性殺盤）。
   解讀：短線賣壓存在但缺乏恐慡性爆量，搞配低 PB 與冷景氣時，可視為健康整理區間。
```

Coach 不需理解 FMTQIK API 細節，而是直接利用這段「已聳合的量價情境」來調整節奏建議。若未來要調整建議品質，優先檢查 `aiDataPreprocessor.mjs` 與 `prompts.mjs`。

**Langfuse 觀測指標**

`getAiInvestmentAdvice()` 內會寫入以下各項 Langfuse score：

| Score 名稱                 | 類型    | 說明                                                                                                                   |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Schema_Validation`        | Boolean | JSON parse 是否成功（1 = 成功）                                                                                        |
| `Format_Compliance`        | Boolean | `coach_internal_thinking` / `action_items` / `mindset_advice` 三欄共同満足才為 True                                    |
| `Risk_Coverage`            | Numeric | `risk_warnings` 數量佔比（上限 1.0，門滝 3 條）                                                                        |
| `Confidence_Field_Present` | Boolean | AI 是否回傳 `confidence` 或 `confidence_level` 欄位（1 = 有、値合法；0 = 缺少或値無效）                                |
| `Thinking_Depth`           | Numeric | `coach_internal_thinking` 的推理深度估算（0~1）：字數充足(≥8尀7字)→0.4、含數字量化→0.2、含因果推理→0.2、含反向思考→0.2 |

> `Confidence_Field_Present` 用於監測 Prompt 模板是否有要求信心度欄位；若持續為 0，表示 AI 漏填此欄位，可作為 prompt 優化依據。

---

## 4. Governance Agents

### 4.1 Rule Optimizer

`ruleOptimizerAgent.mjs` 是背景治理流程的一部分，通常由 `src/runOptimizer.mjs` 單獨觸發。它不直接改寫正式結論，而是提出候選規則，之後再經過程式側驗證與寫入。

### 4.2 LLM Judge

`llmJudge.mjs` 並不是每次都執行，而是由 `shouldRunJudge()` 依環境變數條件判斷：

- `weekly`：每週指定星期幾執行。
- `random`：依 sample rate 択樣執行。
- `always`：每次都執行。

當 `dailyCheck.mjs` 取得有效 `adviceTraceId` 且 `aiAdvice` 為物件時，會條件式呼叫 `runJudge()`。Judge 目前至少評估兩個面向：

- `Actionability`
- `Tone_and_Empathy`

這一段屬於 **主流程中的條件式背景評估**。它不是主要決策產生器，但仍屬 daily pipeline 的一部分，且被設計成 non-blocking score writeback。

### 4.3 LLM Judge 觸發策略 (自 2026-04-25)

Judge 採雙層觸發機制，確保品質監控資源集中在最高風險場景：

**Layer 1 — 排程觸發**（節省 Token）

- 由 `LLM_JUDGE_MODE` 環境變數控制：`weekly`（預設，由 `LLM_JUDGE_WEEKDAY` 指定）/ `random`（由 `LLM_JUDGE_SAMPLE_RATE` 指定） / `always`
- 適用於日常品質抽樣。

**Layer 2 — 高風險強制觸發**（保護財務決策）
滿足任一條件時，無視 Layer 1 排程，強制執行 Judge：
| 條件 | 說明 |
|---|---|
| `VIX ≥ 30` | 市場極端恐慌，AI 建議之穩健性最需驗證 |
| `action ≠ HOLD` | 有實際買賣動作建議，品質攸關資金安全 |
| `latch 狀態轉換` | 策略結構性變化日，須確認建議方向與策略意圖一致 |

**實作規範**：

- `shouldRunJudge(context)` 必須接受 `context.forceRun` 參數。
- `dailyCheck.mjs` 必須在呼叫前評估上述高風險條件並傳入 context。
- 高風險觸發時，系統日誌須明確輸出觸發原因供事後品質審計。

---

## 5. Period Report Agent

`periodReportAgent.mjs` 的流程分成三段：

1. **Pure stats stage**：`loadRecentReports(days)` 從 `data/reports/` 讀取近 N 天 JSON，`buildPeriodStats()` 計算指標統計、過熱持續天數、冷卻期阻擋、策略一致性、總経方向，以及月報額外的 signal quality。

2. **Signal accuracy stage**：`buildSignalAccuracyStats(targetReports, priceSeriesReports, period)` 對同一批報告進行訊號準確率分析，不依賴外部資料來源，完全使用 `data/reports/` 中已存入的 `signals.currentPrice`。

3. **AI summary stage**：`generatePeriodAiSummary()` 將統計結果與過去 `risk_warnings` 聳合後送入 AI，最後由 `periodReportBuilder.mjs` 組出 Telegram 週報 / 月報訊息。

這代表週報與月報不是重跟一次 daily pipeline，而是以 **daily report archives 為資料來源的 second-order analysis**。

### 5.1 訊號分類邏輯

訊號分類集中在 `periodReportAgent.mjs` 內，以結構化欄位為主要判斷依據：

| 函式                         | 判斷依據                                                                                                                      | 說明                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `isBuySignal(signals)`       | `signals.suggestedLeverage > 0` 或 `signals.targetAllocation.leverage > 0`；備用：`target` 字串包含「破冰加碼」或「買進訊號」 | 實際觸發買進建議                       |
| `isCooldownBlocked(signals)` | `cooldownStatus.inCooldown === true` 且 `weightScore >= minWeightScoreToBuy`                                                  | 分數達標但被冷卻期擋住，計入準確率分母 |

風控攔截（維持率低、估値泡沫、再平衡）與中性觀望不計入分母，這些屬於一票否決的前置條件。

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

| Score 名稱          | 類型    | 寫入時機                  | 說明                                                                                                         |
| ------------------- | ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Schema_Validation` | Boolean | AI 回傳 JSON parse 成功後 | 驗證 JSON 能正確解析，value = 1 表示成功                                                                     |
| `Format_Compliance` | Boolean | Schema 驗證通過後         | 驗證 `topRiskEvents` 為非空陣列、`consistencyComment` 與 `periodOutlook` 為非空字串，三者同時満足才為 True。 |

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

## 6. Langfuse Degradation Policy (自 2026-04-25)

為了確保 AI 管線在 Langfuse 服務不穩定時仍能安全運作，`aiClient.mjs` 實作了三層式降級策略：

### Prompt 可用性層級

| 層級     | 條件                                                        | 行為                                                                           | `promptSource` 標記    |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| **正常** | Langfuse 連線成功，prompt 拉取成功                          | 使用 Langfuse 雲端 prompt，支援完整版本管理與插值                              | `"langfuse"`           |
| **降級** | Langfuse 斷線，但 `PROMPT_HARDCODED_FALLBACK` 有對應 prompt | 使用內置硬編碼 prompt，繼續執行。輸出品質可能降低，AI 將感知到較簡略的角色定義 | `"hardcoded-fallback"` |
| **阻斷** | Langfuse 斷線，且無硬編碼 fallback                          | `callAI()` 拋出 `Error` 拋錯，阻斷本次 pipeline，避免產出無意義內容            | `"missing"`            |

### 執行規範

1.  **防護機制**：`callAI()` 會檢查 `promptSource`，若為 `missing` 則立即中斷，防止 AI 在無指令（裸跑）狀態下產出具誤導性的分析。
2.  **維護要求**：所有生產環境使用的 `promptName` 必須在 `aiClient.mjs` 的 `PROMPT_HARDCODED_FALLBACK` 中有對應條目。
3.  **過期感知 (Staleness Awareness)**：`aiDataPreprocessor.mjs` 會在傳遞給 AI 的 Context 中自動注入「【資料新鮮度告警】」區塊。若市場資料（如 PB/PE、融資等）已過期，AI Coach 會被明確告知資料年齡，並據此調整建議的信心度與語氣。

---

## 7. 技術注意事項：`callAI` 回傳格式

`callAI()` 回傳 `{ text: string, traceId: string }`，**不是**直接回傳物件。`text` 為 AI 回傳的原始 JSON 字串，必須經 `JSON.parse(text)` 才能使用。`periodReportAgent.mjs` 的 `generatePeriodAiSummary()` 已正確處理此流程。若未來新增其他 period 類 agent，請比照此模式。
