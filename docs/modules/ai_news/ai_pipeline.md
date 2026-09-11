---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
related_code:
  - src/modules/ai/aiClient.mjs
  - src/modules/ai/aiCircuitBreaker.mjs
  - src/modules/ai/aiDataPreprocessor.mjs
  - src/modules/ai/aiCoach.mjs
  - src/modules/ai/llmJudge.mjs
  - src/modules/ai/periodReportAgent.mjs
  - src/modules/ai/ruleOptimizerAgent.mjs
  - src/modules/ai/langfuseClient.mjs
related_docs:
  - docs/modules/ai_news/integrations/langfuse_prompt_management_v5.md
  - docs/modules/ai_news/integrations/langfuse_score_analytics.md
  - docs/modules/ai_news/integrations/langfuse_score_configs.md
  - docs/modules/ai_news/integrations/agent_prompts.md
  - docs/modules/strategy/strategy_engine.md
dependencies:
  - "@langfuse/tracing@5.11.0"
  - "google-gemini-api@latest"
tags:
  - ai
  - gemini
  - langfuse
  - circuit-breaker
  - pipeline
---

# AI 管線架構 (`src/modules/ai/`)

> **摘要**: 系統所有的 LLM 呼叫集中在此模組，依賴 Gemini API 和 [[Langfuse]] v5 進行觀測

本文件說明 AI 管線的架構、組件和 [[Langfuse]] 整合方式。

## 概念關係

- [[Langfuse Prompt Management]] - Prompt 管理
- [[Langfuse Score Analytics]] - 評分分析
- [[LLM Judge]] - 評分系統
- [[AI News]] - 模組概覽
- [[Strategy Engine]] - 投資策略
- [[Period Report]] - 週期性報告

---

## 🔄 管線架構總覽

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Pipeline (src/modules/ai/)           │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            Langfuse v5 (Observability)                  ││
│  │  traceId, sessionId, observe()                         ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                              │
│  ┌───────────────────────┐ │ ┌─────────────────────┐        │
│  │ aiCircuitBreaker       │ │ │ aiDataPreprocessor  │        │
│  │ (5xx / Timeout → 跳脫)│ │ │ (格式化 → 降低幻覺)   │        │
│  └──────────┬────────────┘ │ └─────────┬───────────┘        │
│             │                            │                    │
│             ├───────────┐             │                    │
│             ▼           ▼             ▼                    │
│  ┌─────────────────────────────────────────────┐           │
│  │ aiClient.mjs                                  │           │
│  │  - Gemini API 呼叫                            │           │
│  │  - withRetry / Timeout                        │           │
│  │  - Langfuse 自動追蹤                            │           │
│  └─────────────────────────────────────────────┘           │
│                              │                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Application Agents                                        ││
│  │  - aiCoach.mjs (戰報生成 + 新聞過濾)                     ││
│  │  - llmJudge.mjs (LLM-as-a-Judge 品質評估)                ││
│  │  - periodReportAgent.mjs (週報/月報生成)                 ││
│  │  - ruleOptimizerAgent.mjs (策略參數優化)                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 核心組件

### 1. `aiClient.mjs` - AI 客戶端

**職責**: 與 Gemini API 通訊的底層封裝

**主要功能**:

- ✅ 封裝 Gemini API 呼叫
- ✅ 實作重試機制 (`withRetry`)
- ✅ Timeout 防護
- ✅ Langfuse 自動追蹤 (v5 `observe()`)
- ✅ 統一錯誤處理

**關鍵 API**:

```javascript
// 呼叫 AI (自動追踹 Langfuse)
const response = await callGemini(prompt, {
  temperature: 0.7,
  maxTokens: 4000,
});

// 批次呼叫 (並發控制)
const responses = await callGeminiBatch([prompt1, prompt2], {
  maxConcurrent: 2,
  temperature: 0.5,
});
```

**Langfuse 整合**:

- 每次呼叫自動建立 Observation
- Trace 透過 `observe()` 自動關聯
- 支援 `traceId` 傳遞 (來自 `getActiveTraceId()`)

### 2. `aiCircuitBreaker.mjs` - 斷路器

**職責**: 當 AI API 連續發生 5xx 錯誤或 Timeout，跳脫以避免阻塞

**機制**:

- 連續 3 次 5xx → 跳脫 (Trip)
- 跳脫後 30 秒 → 半開 (Half-Open)
- 半開測試通過 → 關閉 (Close)

**使用方式**:

```javascript
// aiCircuitBreaker 會自動包裝 AI 呼叫
const result = await circuitBreaker.execute(() => callGemini(prompt));

// 跳脫時回傳 fallback
if (!result.success) {
  return generateFallbackResponse(prompt);
}
```

### 3. `aiDataPreprocessor.mjs` - 資料前處理

**職責**: 在將 MarketData 傳給 LLM 前，格式化為易讀字串

**主要功能**:

- 數字格式化 (千分位、百分比)
- 日期標準化 (YYYY-MM-DD)
- 過長資料截斷
- 關鍵資訊強調

**使用範例**:

```javascript
// Before (原始數據冗長)
const raw = { open: 12345.6789, change: 0.123456 };

// After (預處理)
const formatted = preprocessData(marketData);
// { price: "12,345.68 TWD", change: "+12.3%" }
```

---

## 🤖 應用 Agent

### 1. `aiCoach.mjs` - 主戰報生成 Agent

**職責**:

- 統整 `strategyEngine` 决策 + 技術指標
- 產出「市場總結」與「投資心態建議」
- 執行 `filterAndCategorizeAllNewsWithAI()` 第二層新聞過濾

**關鍵流程**:

```
marketData → strategyEngine → signalData → AI Coach
                                           → generateAdvice()
                                           → generateNewsSummary()
                                           → filterNews()
```

**主要函數**:

- `generateInvestmentAdvice(ctx)` - 生成每日投資建議
- `generateNewsSummary(news)` - 總結新聞重點
- `filterAndCategorizeAllNewsWithAI(news)` - 新聞過濾

### 2. `llmJudge.mjs` - LLM-as-a-Judge

**職責**: 評估 AI 輸出品質

**評估項目**:

- `Schema_Validation` - JSON schema 驗證
- `Actionability` - 新聞可操作性
- `Tone_Empathy` - 語氣同理心
- `Format_Compliance` - 格式合規性

**使用方式**:

```javascript
const judge = new LLMJudge();
const result = await judge.evaluate(aiOutput, criteria);
await createLangfuseScore(traceId, "Actionability", result.score);
```

### 3. 週期性 Agent

- `periodReportAgent.mjs` - 週報/月報生成
  - 使用 `PeriodReport` prompt
  - 生成結構化報告

- `ruleOptimizerAgent.mjs` - 策略參數優化
  - 分析歷史績效
  - 建議參數調整

---

## 🔬 Langfuse v5 整合

### 追踙架構

```
Trace (dailyCheck-123456)
├── Observation: getInvestmentSignal (AI Coach)
│   ├── LLM Call: GenerateSearchQuery
│   ├── LLM Call: FilterAndCategorize
│   └── LLM Call: InvestmentAdvice
├── Observation: aiJudge
│   ├── LLM Call: JudgeActionability
│   └── LLM Call: JudgeToneEmpathy
└── Scores:
    ├── Schema_Validation = 1
    ├── Actionability = 0.8
    └── Tone_Empathy = 0.9
```

### 核心 API (v5)

| 功能          | v3 API                         | v5 API                                        |
| ------------- | ------------------------------ | --------------------------------------------- |
| 觀測 AI 呼叫  | `langfuse.observe()`           | `observe()` from `@langfuse/tracing`          |
| 取得 Trace ID | `langfuse.getCurrentTraceId()` | `getActiveTraceId()` from `@langfuse/tracing` |
| 記錄 Score    | `langfuse.score()`             | `langfuseClient.score.create()`               |
| 取得 Prompt   | `langfuse.getPrompt()`         | `langfuseClient.prompts.get()`                |
| 關閉客戶端    | `langfuse.shutdown()`          | `langfuseClient.shutdownAsync()`              |
| 刷新緩衝      | `langfuse.flush()`             | `langfuseClient.flushAsync()`                 |

### 代碼實例

```javascript
// src/modules/ai/aiClient.mjs (簡化範例)
import { observe } from "@langfuse/tracing";

export const callGemini = observe(async (prompt, options) => {
  // Langfuse 會自動追蹤
  const response = await gemini.generateContent({
    contents: prompt,
    ...options,
  });
  return response;
});
```

---

## 📊 觀測指標

### 關鍵指標

| 指標                 | 來源                     | 目標       |
| -------------------- | ------------------------ | ---------- |
| AI 回應時間          | Langfuse Trace           | < 5 秒     |
| Schema 驗證通過率    | Score: Schema_Validation | > 95%      |
| 斷路器觸發次數       | Circuit Breaker          | < 1%/day   |
| Token 消耗量         | Langfuse Usage           | < 100k/day |
| Actionability 平均分 | Score: Actionability     | > 0.6      |

### 在 Langfuse UI 中查看

1. **Trace 查看**: Traces → 選擇 trace → 查看 Observation 樹
2. **Score 分析**: Dashboard → Scores → 聚合分析
3. **Prompt 效果**: Dashboard → Prompts → A/B Test
4. **Token 追蹤**: Dashboard → Usage → 成本分析

---

## ⚠️ 故障排除

### AI 呼叫失敗

**檢查清單**:

1. Gemini API Key 是否設定 (`GOOGLE_API_KEY`)
2. 網路連線是否正常
3. 斷路器是否跳脫
4. 提示詞是否超出 token 限制

### Langfuse 追蹤失敗

**檢查清單**:

1. 環境變數 (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`)
2. `langfuseEnabled` 是否為 `true`
3. 網路是否可連到 `cloud.langfuse.com`

### 斷路器頻繁跳脫

**可能原因**:

- Gemini API 超出配額
- Prompt 過長
- 系統過載

**解決方式**:

- 檢查 Gemini 控制台配額
- 優化 Prompt 長度
- 增加 Circuit Breaker 閥值

---

## 相關文件

- [[Langfuse Prompt Management]] - Prompt 配置管理
- [[Langfuse Score Analytics]] - Score 使用與分析
- [[Langfuse Score Configs]] - Score 配置清單
- [[Agent Prompts]] - Prompt 模版與範例
- [[Strategy Engine]] - 投資策略引擎
- [[AI News]] - AI 新聞模組概覽

---

**最後更新**: 2026-09-10  
**最後驗證**: 2026-09-10（Langfuse v5.11.0, Gemini API）  
**維護者**: AI Team
