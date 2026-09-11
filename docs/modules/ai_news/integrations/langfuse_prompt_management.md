---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
related_code:
  - src/modules/ai/langfuseClient.mjs
  - src/modules/ai/aiClient.mjs
  - src/modules/ai/aiCoach.mjs
  - src/modules/ai/llmJudge.mjs
  - src/modules/ai/periodReportAgent.mjs
  - src/modules/ai/ruleOptimizerAgent.mjs
related_docs:
  - docs/modules/ai_news/integrations/langfuse_score_analytics.md
  - docs/modules/ai_news/integrations/langfuse_score_configs.md
  - docs/modules/ai_news/ai_pipeline.md
  - docs/modules/operations/env_vars.md
dependencies:
  - "@langfuse/client@5.11.0"
tags:
  - langfuse
  - prompts
  - gemini
  - ai
---

# Langfuse Prompt 管理（v5）

> **摘要**: 使用 Langfuse v5 REST API Client 管理和取得 AI prompts

本文件說明如何在 [[Langfuse]] v5 中管理 prompts，以及在代碼中使用的方式。

## 概念關係

- [[Langfuse Score Analytics]] - 評分分析
- [[Langfuse Score Configs]] - 評分配置
- [[AI Pipeline]] - 整體 AI 處理流程

---

## 🔄 從 v3 遷移

### v3 API (已淘汰)

```javascript
// v3: 使用 langfuse SDK 直接取得
const prompt = await langfuse.getPrompt("MyPrompt", {
  cacheTtlSeconds: 60,
});
```

### v5 API (當前)

```javascript
// v5: 使用 langfuseClient 取得
const prompt = await langfuseClient.prompts.get({
  name: "MyPrompt",
  label: "production", // 或 'latest'
  version: 2, // 可選，指定版本
});

// 取得 messages 陣列
const messages = prompt.prompt; // 或 prompt.messages
```

### 主要變更

| 項目     | v3                               | v5                                                     |
| -------- | -------------------------------- | ------------------------------------------------------ |
| 取得方式 | `langfuse.getPrompt(name, opts)` | `langfuseClient.prompts.get({ name, label, version })` |
| 回傳格式 | `prompt`                         | `{ name, version, prompt: [], config: {} }`            |
| 快取     | `cacheTtlSeconds`                | 不支援 (Langfuse 內部處理)                             |
| 版本管理 | 限異動                           | `label` + `version`                                    |

---

## API 參考

### `langfuseClient.prompts.get()`

**代碼位置**: `src/modules/ai/langfuseClient.mjs`

```javascript
/**
 * 取得 Langfuse prompt (v5)
 */
export async function getLangfusePrompt(name, options = {}) {
  if (!langfuseEnabled) return null;

  const { label = "production", version } = options;

  try {
    const prompt = await langfuseClient.prompts.get({
      name,
      label,
      ...(version && { version }),
    });
    return prompt;
  } catch (err) {
    logger.warn({ name, error: err.message }, "Langfuse prompt 取得失敗");
    return null;
  }
}
```

### 參數說明

```typescript
{
  name: string;      // 必須：Prompt 名稱
  label?: string;    // 可選：'production' | 'latest' | 'draft'
  version?: number;  // 可選：指定版本
}
```

### 回傳格式

```typescript
{
  name: string;           // Prompt 名稱
  version: number;         // 版本號
  labels: string[];        // 標籤列表
  type: 'chat' | 'text';   // 類型
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

---

## Prompt 列表

以下是系統中在 Langfuse UI 配置的所有 prompts。

### 新聞採集相關

#### 1. GenerateSearchQuery ✅

- **類型**: chat
- **用途**: 生成 PTT/Bluesky 搜尋關鍵字
- **代碼**: `src/scheduler/newsFetch.mjs`
- **配置**: temp=0.7, max_tokens=500
- **Label**: production

```javascript
// 使用範例
const prompt = await getLangfusePrompt("GenerateSearchQuery");
const messages = prompt.prompt;
// [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
```

#### 2. FilterAndCategorize ✅

- **類型**: chat
- **用途**: 過濾與分類新聞
- **代碼**: `src/modules/ai/aiCoach.mjs`
- **配置**: temp=0.5, thinking_budget=medium
- **Label**: production

### 投資分析相關

#### 3. AnalyzeMacroNews ✅

- **類型**: chat
- **用途**: 分析總經新聞對投資影響
- **代碼**: `src/modules/ai/aiCoach.mjs`
- **配置**: temp=0.3, thinking_budget=high
- **Label**: production

#### 4. InvestmentAdvice ✅

- **類型**: chat
- **用途**: 生成每日投資建議
- **代碼**: `src/dailyCheck.mjs`
- **配置**: temp=0.4, thinking_budget=high
- **Label**: production

### 週報/月報

#### 5. PeriodReport ✅

- **類型**: chat
- **用途**: 生成週報和月報
- **代碼**: `src/modules/ai/periodReportAgent.mjs`
- **配置**: temp=0.5, thinking_budget=medium
- **Label**: production

### 策略優化

#### 6. RuleOptimizer ✅

- **類型**: chat
- **用途**: 優化投資策略規則
- **代碼**: `src/modules/ai/ruleOptimizerAgent.mjs`
- **配置**: temp=0.6, max_tokens=2000
- **Label**: production

### LLM Judge

#### 7. JudgeActionability ✅

- **類型**: chat
- **用途**: 評估新聞的可操作性
- **代碼**: `src/modules/ai/llmJudge.mjs`
- **配置**: temp=0, max_tokens=50
- **Label**: production

#### 8. JudgeToneEmpathy ✅

- **類型**: chat
- **用途**: 評估回覆的語氣同理心
- **代碼**: `src/modules/ai/llmJudge.mjs`
- **配置**: temp=0, max_tokens=50
- **Label**: production

---

## 在 Langfuse UI 中管理

### 建立新 Prompt

1. 登入 [Langfuse Cloud](https://cloud.langfuse.com)
2. 選擇專案 → Prompts
3. 點擊 "Create prompt"
4. 填寫:

```
Name: MyNewPrompt
Type: Chat
Label: production
Version: 1
```

5. 添加 messages:

```json
[
  {
    "role": "system",
    "content": "你是一位專業的投資顧問..."
  },
  {
    "role": "user",
    "content": "請分析以下新聞：{{news_content}}"
  }
]
```

6. 保存並發布

### 版本管理

```
Prompt: InvestmentAdvice
├── v1 (label: latest) ← 開發中版本
├── v2 (label: production) ← 當前使用版本
└── v3 (label: latest) ← 新版本測試中
```

**部署新版本**:

1. 建立 v3
2. 標記為 `latest`
3. 測試 AI Pipeline
4. 驗收通過後重新標記 `v2` 為 `latest` (非 production)
5. 等待 `production` 標籤自動指向

### A/B 測試

```javascript
// 在代碼中指定版本進行 A/B 測試
const v1 = await getLangfusePrompt("InvestmentAdvice", { version: 1 });
const v2 = await getLangfusePrompt("InvestmentAdvice", { version: 2 });

// 比較結果
const result1 = await callGemini(v1);
const result2 = await callGemini(v2);

// 記錄比較結果
await createLangfuseScore(
  traceId,
  "Prompt_Version_Comparison",
  v2.quality - v1.quality,
);
```

---

## 使用範例

### 範例 1: 基本使用

```javascript
import { getLangfusePrompt } from "./modules/ai/langfuseClient.mjs";

// 取得 production prompt
const prompt = await getLangfusePrompt("InvestmentAdvice");
if (!prompt) {
  // Fallback
  return DEFAULT_ADVICE;
}

// 使用 prompt
const messages = prompt.prompt;
const config = prompt.config;
const response = await callGemini(messages, config);
```

### 範例 2: 使用特定版本

```javascript
// A/B 測試
const prompt = await getLangfusePrompt("MyPrompt", {
  version: 3,
  label: "latest",
});
```

### 範例 3: 變數替換

```javascript
// 在 Langfuse UI 中定義:
// "分析以下新聞：{{news_content}}"

const prompt = await getLangfusePrompt("AnalyzeMacroNews");
const messages = prompt.prompt.map((msg) => ({
  ...msg,
  content: msg.content.replace("{{news_content}}", actualNews),
}));
```

### 範例 4: 在 observe() 中使用

```javascript
import { observe } from "@langfuse/tracing";

const generateAdvice = observe(async (context) => {
  const prompt = await getLangfusePrompt("InvestmentAdvice");
  return await callGemini(prompt, {
    temperature: prompt.config?.temperature,
    maxTokens: prompt.config?.max_tokens,
  });
});
```

---

## 最佳實踐

### 1. Prompt 命名規範

✅ **好**:

- `InvestmentAdvice` - 清楚描述功能
- `AnalyzeMacroNews` - 具體動作

❌ **差**:

- `prompt1` - 無意義
- `advice` - 過於模糊

### 2. Label 使用

- **`production`**: 用於生產環境，必須穩定
- **`latest`**: 用於開發/測試，可能不穩定
- **勿在生產環境使用 `latest`**

### 3. 版本發佈流程

```
1. 開發 → v3 (label: latest)
2. 測試 → A/B 測試 v2 vs v3
3. 驗收 → v3 升為 production
4. 歸檔 → v2 變為 archived
```

### 4. 配置管理

在 `config/` 中建立 prompt 版本 mapping：

```json
{
  "InvestmentAdvice": {
    "production": 2,
    "staging": 3
  }
}
```

### 5. 錯誤處理

```javascript
const prompt = await getLangfusePrompt("MyPrompt");
if (!prompt) {
  logger.warn("Prompt 不可用，使用 fallback");
  return fallbackResponse();
}
```

---

## 環境變數

參見 [[Environment Variables]]。

必要變數：

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL` (選用，預設 cloud.langfuse.com)

---

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
echo $LANGFUSE_SECRET_KEY

# 檢查 Langfuse UI
# 登入 https://cloud.langfuse.com
# 確認 Prompt 名稱和 Label
```

### Prompt 返回空白

**症狱**: API 呼叫成功，但 `prompt.prompt` 為空

**可能原因**:

- Langfuse UI 提示詞格式錯誤
- 版本號不正確
- 選擇了錯誤的 Label

### 版本管理混亂

**建議**:

- 每次更新提示詞都建立新版本
- 永遠不要修改舊版本
- 發佈前在 staging 測試
- production 只使用已驗證的版本

---

## 相關文件

- [[Langfuse Score Analytics]] - Score 使用與分析
- [[Langfuse Score Configs]] - Score 配置清單
- [[AI Pipeline]] - 整體 AI 處理流程
- [[Environment Variables]] - 環境變數設定

---

**最後更新**: 2026-09-10  
**最後驗證**: 2026-09-10（Langfuse v5.11.0）  
**維護者**: AI Team
