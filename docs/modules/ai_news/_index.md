---
type: reference
status: current
last_updated: 2026-11-11
last_verified: 2026-09-10
related_code:
  - src/modules/ai/aiClient.mjs
  - src/modules/ai/aiCoach.mjs
  - src/modules/ai/llmJudge.mjs
  - src/modules/ai/aiCircuitBreaker.mjs
  - src/modules/ai/aiDataPreprocessor.mjs
  - src/modules/ai/langfuseClient.mjs
  - src/modules/ai/periodReportAgent.mjs
  - src/modules/ai/ruleOptimizerAgent.mjs
  - src/scheduler/newsFetch.mjs
related_docs:
  - docs/modules/ai_news/ai_pipeline.md
  - docs/modules/ai_news/news_fetcher.md
  - docs/modules/ai_news/keyword_config.md
  - docs/modules/ai_news/integrations/agent_prompts.md
  - docs/modules/ai_news/integrations/ai_coach_checklist.md
  - docs/modules/ai_news/integrations/langfuse_prompt_management.md
  - docs/modules/ai_news/integrations/langfuse_score_analytics.md
  - docs/modules/ai_news/integrations/langfuse_score_configs.md
dependencies:
  - "@langfuse/tracing@5.11.0"
  - "@langfuse/client@5.11.0"
  - "google-gemini-api@latest"
tags:
  - ai
  - news
  - pipeline
  - langfuse
  - gemini
  - observability
---

# AI 管線與新聞處理 (AI & News Pipeline)

> **摘要**: 負責專案所有的自然語言處理，包含新聞採集、AI 分析與 Langfuse 觀測

## 概念關係

- [[AI Pipeline]] - 管線架構詳解
- [[Langfuse Prompt Management]] - Prompt 管理
- [[Langfuse Score Analytics]] - 評分分析
- [[News Fetcher]] - 新聞掃揚
- [[Keyword Config]] - 關鍵字設定
- [[Agent Prompts]] - Prompt 導覽

---

## 模組列表

| 文件                                                     | 作用                                | 代碼                               |
| -------------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| [AI Pipeline](ai_pipeline.md)                            | LLM 呼叫封裝、斷路器、Langfuse 整合 | `src/modules/ai/`                  |
| [News Fetcher](news_fetcher.md)                          | RSS 抓取、物理過濾                  | `src/scheduler/newsFetch.mjs`      |
| [Keyword Config](keyword_config.md)                      | 靜態/動態關鍵字、黑名單             | `src/modules/ai/keywordConfig.mjs` |
| [Agent Prompts](integrations/agent_prompts.md)           | Prompt Map & 範例                   | `[[Langfuse]]`                     |
| [AI Coach Checklist](integrations/ai_coach_checklist.md) | AI 生成品質檢查                     | `src/modules/ai/aiCoach.mjs`       |
| [LLM Judge](integrations/llm_judge.mjs)                  | LLM-as-Judge 評分                   | `src/modules/ai/llmJudge.mjs`      |

## Langfuse 整合

| 文件                                                            | 作用                 |
| --------------------------------------------------------------- | -------------------- |
| [Prompt Management](integrations/langfuse_prompt_management.md) | Prompt 配置管理 (v5) |
| [Score Analytics](integrations/langfuse_score_analytics.md)     | Score 使用與分析     |
| [Score Configs](integrations/langfuse_score_configs.md)         | Score 配置清單       |

---

## 核心設計理念

### 1. 多層過濾漏斗

```
RSS 搜尋 → 關鍵字過濾 → 指紋去重 → 來源黑名單 → AI 過濾
   ↓          ↓           ↓           ↓          ↓
數百篇    排除噪聲      去重熱門    過濾農場    語意篩選
```

每天有數百篇新聞，先透過 Keyword 排除、指紋去重 (Fingerprint)、來源過濾，最後才送入 AI，大幅節省 Token 花費。

### 2. AI 不是神

AI 僅做「資訊萃取」與「摘要」，絕不賦予其直接操作資金或決定買賣訊號的權限，嚴守「演算法主導、AI 輔助」的界線。

### 3. 可觀測性

所有 AI 呼叫都會透過 [[Langfuse]] v5 進行追蹤：

- Trace: 每次 dailyCheck / newsFetch
- Observation: 每次 LLM 呼叫 (aiCoach, llmJudge, periodReportAgent)
- Score: 品質評估 (Schema_Validation, Actionability, Tone_Empathy)

---

## 執行流程

```
┌─────────────┐
│ News Fetch  │ ← [[News Fetcher]], [[Keyword Config]]
│ (RSS)       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ AI Pipeline │ ← [[AI Pipeline]]
│ (Filter &   │   - aiClient.mjs
│  Categorize) │   - llmJudge.mjs
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ News Pool   │ ← data/newsPool.json
│ (Storage)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ AI Coach   │ ← aiCoach.mjs, [[Agent Prompts]]
│ (Analysis) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Daily Check │ ← [[Strategy Engine]]
│ (Signals)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Telegram   │ ← Bot, [[Notification]]
│ (Notify)   │
└─────────────┘
```

---

## 文件導航

### 新手入門

1. [AI Pipeline 架構](ai_pipeline.md) - 了解整個 AI 管線
2. [News Fetcher](news_fetcher.md) - 了解新聞採集
3. [Agent Prompts](integrations/agent_prompts.md) - 了解 AI prompts

### 深入學習

- [Langfuse 整合](integrations/langfuse_prompt_management.md)
- [Score 分析](integrations/langfuse_score_analytics.md)
- [Score 配置](integrations/langfuse_score_configs.md)

### 故障排除

- [AI Coach Checklist](integrations/ai_coach_checklist.md)
- 環境變數: [[Environment Variables]]

---

## 相關模組

- [[Strategy Engine]] - 投資策略
- [[Telegram Bot]] - 通知與互動
- [[Infrastructure]] - 資料管理
