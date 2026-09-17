---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
related_code:
  - src/modules/ai/langfuseClient.mjs
  - src/modules/ai/aiClient.mjs
related_docs:
  - docs/modules/ai_news/integrations/langfuse_score_analytics.md
  - docs/modules/ai_news/ai_pipeline.md
dependencies:
  - "@langfuse/tracing@5.11.0"
  - "@langfuse/client@5.11.0"
tags:
  - langfuse
  - ai
  - prompts
  - observability
---

# Langfuse Prompt 管理（v5）

> **摘要**: 使用 Langfuse v5 REST API Client 管理和取得 AI prompts

本文件說明 InvestmentLineNotify 所有 AI prompt 在 [[Langfuse]] 的管理方式與設定規範。

---

## 架構概述

所有 AI prompts 統一在 [[Langfuse Web UI]] 管理，透過 `langfuseClient.prompt.get(name, options)` 取得。

```
┌─────────────────────────────────────────────────────────────┐
│                    Langfuse Prompt Management               │
│                                                             │
│  promptName (key)    │ messages[]          │ config{}        │
│  ─────────────────── │ ─────────────────── │ ─────────────── │
│  GenerateSearchQ...  │ system + user       │ temp/mime/token │
│  FilterAndCateg...   │ system + user       │ temp/mime/think │
│  AnalyzeMacroNews    │ system + user       │ temp/mime/think │
│  InvestmentAdvice    │ system + user       │ temp/mime/think │
│  RuleOptimizer       │ system + user       │ temp/mime/token │
│  PeriodReport        │ system + user       │ temp/mime/think │
│  JudgeActionability  │ system + user       │ temp/mime/token │
│  JudgeToneEmpathy    │ system + user       │ temp/mime/token │
└─────────────────────────────────────────────────────────────┘
                              │
                    Langfuse SDK getPrompt()
                    type: 'chat'
                              │
┌─────────────────────────────┴───────────────────────────────┐
│  aiClient.mjs :: resolveChatPrompt()                        │
│                                                             │
│  → 載入 prompt template                                      │
│  → 填充 variables                                            │
│  → 回傳 messages[] + config                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 從 Langfuse v3 遷移

**v3 API (已淘汰)**:

```javascript
const prompt = await langfuse.getPrompt(name, { cacheTtlSeconds: 60 });
```

**v5 API (當前)**:

```javascript
const prompt = await langfuseClient.prompt.get(promptName, {
  label: "production", // 或 'latest'
  version: 2, // 可選，指定版本
});
```

## API 參考

### 取得 Prompt

**代碼位置**: `src/modules/ai/langfuseClient.mjs` (line 58-65)

```javascript
/**
 * 取得 Langfuse prompt (v5)
 */
export async function getLangfusePrompt(name, options = {}) {
  if (!langfuseEnabled) return null;

  const { label = "production", version } = options;

  try {
    const prompt = await langfuseClient.prompt.get(name, {
      label,
      ...(version !== undefined && { version }),
    });
    return prompt;
  } catch (err) {
    logger.warn({ name, error: err.message }, "Langfuse prompt 取得失敗");
    return null;
  }
}
```

### Prompt 格式

Langfuse v5 prompt 物件結構：

```typescript
{
  name: string;
  version: number;
  labels: string[];
  type: 'chat' | 'text';
  prompt: {
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
  };
  config: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    [key: string]: any;
  };
}
```

## Prompt 列表

### 新聞採集相關

#### GenerateSearchQuery

- **用途**: 生成 PTT/Bluesky 搜尋關鍵字
- **代碼**: `src/scheduler/newsFetch.mjs`
- **配置**: temp=0.7, max_tokens=500

#### FilterAndCategorize

- **用途**: 過濾與分類新聞
- **代碼**: `src/modules/ai/aiCoach.mjs`
- **配置**: temp=0.5, thinking_budget=medium

### 投資分析相關

#### AnalyzeMacroNews

- **用途**: 分析總經新聞對投資影響
- **代碼**: `src/modules/ai/aiCoach.mjs`
- **配置**: temp=0.3, thinking_budget=high

#### InvestmentAdvice

- **用途**: 生成每日投資建議
- **代碼**: `src/dailyCheck.mjs`
- **配置**: temp=0.4, thinking_budget=high

### 週報/月報

#### PeriodReport

- **用途**: 生成週報和月報
- **代碼**: `src/scheduler/weeklyReport.mjs`, `src/scheduler/monthlyReport.mjs`
- **配置**: temp=0.5, thinking_budget=medium

### 策略優化

#### RuleOptimizer

- **用途**: 優化投資策略規則
- **代碼**: `src/modules/ai/ruleOptimizerAgent.mjs`
- **配置**: temp=0.6, max_tokens=2000

### LLM Judge

#### JudgeActionability

- **用途**: 評估新聞的可操作性
- **代碼**: `src/modules/ai/llmJudge.mjs`
- **配置**: temp=0, max_tokens=50

#### JudgeToneEmpathy

- **用途**: 評估回覆的語氣同理心
- **代碼**: `src/modules/ai/llmJudge.mjs`
- **配置**: temp=0, max_tokens=50

## 最佳實踐

### 1. 使用 Label 管理版本

```javascript
// 生產環境使用穩定版本
const prompt = await getLangfusePrompt("InvestmentAdvice", {
  label: "production",
});

// 開發測試使用最新版本
const prompt = await getLangfusePrompt("InvestmentAdvice", {
  label: "latest",
});
```

### 2. 錯誤處理

所有 `getLangfusePrompt()` 呼叫都應處理 `null` 回傳：

```javascript
const prompt = await getLangfusePrompt("MyPrompt");
if (!prompt) {
  // Fallback: 使用硬編碼的預設 prompt
  logger.warn("使用預設 prompt (Langfuse 不可用)");
  return DEFAULT_PROMPT;
}
```

### 3. 變數替換

Langfuse prompt 支援變數 `{{variable}}`：

```javascript
// Langfuse UI 中定義:
// "分析以下新聞：{{news_content}}"

// 代碼中替換:
const prompt = await getLangfusePrompt("AnalyzeMacroNews");
const messages = prompt.prompt.messages.map((msg) => ({
  ...msg,
  content: msg.content.replace("{{news_content}}", actualNews),
}));
```

## 環境變數

參見 [[Environment Variables]] 文件。

必要變數：

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL` (選用，預設 cloud.langfuse.com)

## 相關文件

- [[Langfuse Score Analytics]] - 評分與分析
- [[AI Pipeline]] - 整體 AI 處理流程
- [[Environment Variables]] - 環境變數設定

## 疑難排解

### Prompt 取得失敗

**症狀**: `getLangfusePrompt()` 回傳 `null`

**可能原因**:

1. ❌ 環境變數未設定
2. ❌ Prompt 在 Langfuse UI 中不存在
3. ❌ Label 或 Version 不正確
4. ❌ 網路連線問題

**解決方式**:

```bash
# 檢查環境變數
echo $LANGFUSE_PUBLIC_KEY

# 檢查 Langfuse UI
# 登入 https://cloud.langfuse.com
# 確認 prompt 名稱和 label

# 檢查日誌
tail -f logs/app.log | grep "Langfuse"
```

---

**最後更新**: 2026-09-10  
**最後驗證**: 2026-09-10（Langfuse v5.11.0）
