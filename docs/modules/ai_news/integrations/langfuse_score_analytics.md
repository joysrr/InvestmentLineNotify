---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
related_code:
  - src/modules/ai/langfuseClient.mjs
  - src/modules/ai/aiCoach.mjs
  - src/modules/ai/llmJudge.mjs
related_docs:
  - docs/modules/ai_news/integrations/langfuse_prompt_management_v5.md
  - docs/modules/ai_news/integrations/langfuse_score_configs.md
  - docs/modules/ai_news/ai_pipeline.md
dependencies:
  - "@langfuse/tracing@5.11.0"
  - "@langfuse/client@5.11.0"
tags:
  - langfuse
  - observability
  - scoring
  - analytics
  - ai
---

# Langfuse Score 分析與追蹤（v5）

> **摘要**: 使用 Langfuse v5 追蹤和分析 AI 模型輸出品質評分

本文件說明如何使用 [[Langfuse]] v5 的 Score API 記錄和分析 AI 評分指標。

---

## 概念關係

- [[Langfuse Prompt Management]] - Prompt 管理
- [[AI Pipeline]] - 整體 AI 流程
- [[LLM Judge]] - 評分來源
- [[Environment Variables]] - 環境變數設定

---

## 🔄 從 v3 遷移

### v3 API (已淘汰)

```javascript
langfuse.score({
  traceId,
  name: "quality",
  value: 0.95,
});
```

### v5 API (當前)

```javascript
await langfuseClient.score.create({
  traceId,
  name: "quality",
  value: 0.95,
  comment: "可選的評論",
});
```

**主要變更**:

- `langfuse.score()` → `langfuseClient.score.create()`
- 返回 Promise (需要 await)
- 新增 `comment` 欄位

---

## API 參考

### 建立 Score

**代碼位置**: `src/modules/ai/langfuseClient.mjs` (line 75-82)

```javascript
/**
 * 建立 Langfuse score (v5)
 */
export async function createLangfuseScore(traceId, name, value, options = {}) {
  if (!langfuseEnabled) return;

  const { comment, observationId } = options;

  try {
    await langfuseClient.score.create({
      traceId,
      name,
      value,
      ...(comment && { comment }),
      ...(observationId && { observationId }),
    });
    logger.debug({ traceId, name, value }, "Langfuse score 已記錄");
  } catch (err) {
    logger.warn(
      { traceId, name, error: err.message },
      "Langfuse score 寫入失敗",
    );
  }
}
```

### Score 參數

```typescript
{
  traceId: string;          // 必須：Trace ID
  name: string;             // 必須：Score 名稱
  value: number;            // 必須：評分值
  observationId?: string;   // 可選：特定 Observation ID
  comment?: string;         // 可選：評論說明
}
```

---

## Score 配置

參見 [[Langfuse Score Configs]] 完整配置說明。

### 系統使用的 Scores

#### 1. LLM Judge Scores

**Schema_Validation** (0 或 1)

- **用途**: 驗證 AI 輸出是否符合 JSON schema
- **代碼**: `src/modules/ai/llmJudge.mjs`
- **值**: 0 = 失敗, 1 = 通過

**Actionability** (0-1)

- **用途**: 評估新聞可操作性
- **代碼**: `src/modules/ai/llmJudge.mjs`
- **值**: 0 = 不可操作, 1 = 高度可操作

**Tone_Empathy** (0-1)

- **用途**: 評估回覆語氣同理心
- **代碼**: `src/modules/ai/llmJudge.mjs`
- **值**: 0 = 冷漠, 1 = 高度同理

#### 2. AI Coach Scores

**Investment_Confidence** (0-1)

- **用途**: 投資建議信心度
- **代碼**: `src/modules/ai/aiCoach.mjs`
- **值**: 0 = 低信心, 1 = 高信心

**News_Relevance** (0-1)

- **用途**: 新聞相關性評分
- **代碼**: `src/modules/ai/aiCoach.mjs`
- **值**: 0 = 不相關, 1 = 高度相關

---

## 使用範例

### 範例 1: 記錄 Schema 驗證結果

```javascript
import { createLangfuseScore } from "./modules/ai/langfuseClient.mjs";

// AI 呼叫後驗證 schema
const result = await callAI(prompt);
const isValid = validateSchema(result);

await createLangfuseScore(traceId, "Schema_Validation", isValid ? 1 : 0, {
  comment: isValid ? "Valid JSON" : "Schema mismatch",
});
```

### 範例 2: LLM Judge 評分

```javascript
import { createLangfuseScore } from "./modules/ai/langfuseClient.mjs";

// 使用 LLM Judge 評估品質
const score = await llmJudge.evaluate(content, criteria);

await createLangfuseScore(traceId, "Tone_Empathy", score.value, {
  comment: score.reasoning,
  observationId: generationId,
});
```

### 範例 3: 批次記錄多個 Scores

```javascript
const scores = [
  { name: "Schema_Validation", value: 1 },
  { name: "Actionability", value: 0.8 },
  { name: "Tone_Empathy", value: 0.9 },
];

await Promise.all(
  scores.map((s) => createLangfuseScore(traceId, s.name, s.value)),
);
```

---

## 在 Langfuse UI 中分析

### 1. 查看 Trace Scores

1. 登入 [Langfuse Cloud](https://cloud.langfuse.com)
2. 選擇專案
3. Traces → 選擇一個 Trace
4. 查看 "Scores" 標籤

### 2. 聚合分析

**Dashboard → Scores**:

- 依 Score 名稱過濾
- 查看平均值、分佈
- 時間趨勢圖表

### 3. 匯出資料

**Export → CSV/JSON**:

```json
{
  "traceId": "abc123",
  "name": "Schema_Validation",
  "value": 1,
  "timestamp": "2026-09-10T12:00:00Z",
  "comment": "Valid JSON"
}
```

---

## 分析 Prompts

### 通用分析模板

```
角色：你是一位熟悉 Langfuse、LLM pipeline 與評估方法的資深 AI 系統工程師。

任務：分析以下 Langfuse traces 和 scores，提供優化建議。

資料：
[從 Langfuse 匯出的 JSON/CSV]

請分析：
1. Score 分佈和趨勢
2. 低分案例的共同特徵
3. Prompt 改進建議
4. 系統性問題識別
```

### InvestmentAdvice 專用分析

```
分析 InvestmentAdvice prompt 的表現：

關注指標：
- Schema_Validation 通過率
- Investment_Confidence 平均分
- 輸出格式一致性

低分案例特徵：
- 市場條件
- 新聞類型
- Prompt 變數

建議：
- Prompt 改進方向
- 額外的驗證邏輯
- Few-shot 範例優化
```

---

## 最佳實踐

### 1. Score 命名規範

- 使用 PascalCase: `Schema_Validation`
- 清楚描述評估內容
- 與 Langfuse UI 配置一致

### 2. 值域標準化

- **布林評分**: 0 或 1
- **百分比評分**: 0.0 - 1.0
- **避免**: 任意範圍 (如 1-10)

### 3. 添加 Comment

```javascript
// ✅ 好：提供上下文
await createLangfuseScore(traceId, "Quality", 0.6, {
  comment: "缺少關鍵資訊：投資金額建議",
});

// ❌ 差：沒有說明
await createLangfuseScore(traceId, "Quality", 0.6);
```

### 4. 錯誤處理

```javascript
// Score 失敗不應阻斷主流程
try {
  await createLangfuseScore(traceId, name, value);
} catch (err) {
  logger.warn("Score 記錄失敗，但繼續執行");
  // 主流程繼續
}
```

### 5. 效能考量

```javascript
// ✅ 好：非同步並行
await Promise.all([
  createLangfuseScore(traceId, "score1", v1),
  createLangfuseScore(traceId, "score2", v2),
]);

// ❌ 差：序列化執行
await createLangfuseScore(traceId, "score1", v1);
await createLangfuseScore(traceId, "score2", v2);
```

---

## 環境變數

與 [[Langfuse Prompt Management]] 相同，需要：

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL` (選用)

---

## 疑難排解

### Score 未顯示在 UI

**症狀**: `createLangfuseScore()` 執行成功，但 UI 看不到

**可能原因**:

1. ❌ `traceId` 不正確或不存在
2. ❌ Score 名稱與 UI 配置不符
3. ❌ 值超出預期範圍
4. ❌ 網路延遲（等待數秒後刷新）

**解決方式**:

```javascript
// 驗證 traceId
import { getActiveTraceId } from "@langfuse/tracing";
const traceId = getActiveTraceId();
console.log("Current trace:", traceId);

// 檢查 score 是否成功
try {
  await createLangfuseScore(traceId, name, value);
  logger.info(`✓ Score ${name} 已記錄`);
} catch (err) {
  logger.error(`✗ Score ${name} 失敗:`, err);
}
```

### Score API 錯誤

**症狀**: `createLangfuseScore()` 拋出錯誤

**檢查清單**:

- [ ] 環境變數是否設定
- [ ] `langfuseEnabled` 是否為 true
- [ ] 網路連線是否正常
- [ ] API key 是否有效

---

## 相關文件

- [[Langfuse Prompt Management]] - Prompt 管理
- [[Langfuse Score Configs]] - Score 配置清單
- [[AI Pipeline]] - 整體 AI 處理流程
- [[LLM Judge]] - 評分系統實作
- [[Environment Variables]] - 環境變數設定

---

**最後更新**: 2026-09-10  
**最後驗證**: 2026-09-10（Langfuse v5.11.0）  
**維護者**: AI Team
