---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
related_code:
  - src/modules/ai/langfuseClient.mjs
  - src/modules/ai/llmJudge.mjs
  - src/modules/ai/aiCoach.mjs
related_docs:
  - docs/modules/ai_news/integrations/langfuse_score_analytics.md
  - docs/modules/ai_news/integrations/langfuse_prompt_management_v5.md
dependencies:
  - "@langfuse/tracing@5.11.0"
  - "@langfuse/client@5.11.0"
tags:
  - langfuse
  - configuration
  - scoring
  - metrics
---

# Langfuse Score 配置清單（v5）

> **摘要**: 系統中所有 Langfuse Score 的配置規範與說明

本文件列出所有在 [[Langfuse]] UI 中配置的 Score 項目，作為 AI pipeline 品質監控標準。

## 概念關係

- [[Langfuse Score Analytics]] - Score 使用與分析
- [[LLM Judge]] - 評分系統實作
- [[AI Pipeline]] - AI 處理流程

---

## Score 配置總覽

| Score 名稱            | 類型 | 值域 | 用途             | 代碼位置     |
| --------------------- | ---- | ---- | ---------------- | ------------ |
| Schema_Validation     | 布林 | 0/1  | JSON schema 驗證 | llmJudge.mjs |
| Actionability         | 數值 | 0-1  | 新聞可操作性     | llmJudge.mjs |
| Tone_Empathy          | 數值 | 0-1  | 回覆語氣同理心   | llmJudge.mjs |
| Investment_Confidence | 數值 | 0-1  | 投資建議信心度   | aiCoach.mjs  |
| News_Relevance        | 數值 | 0-1  | 新聞相關性       | aiCoach.mjs  |
| Format_Compliance     | 布林 | 0/1  | 格式合規性       | llmJudge.mjs |

---

## 詳細配置

### 1. Schema_Validation

**目的**: 驗證 AI 輸出是否符合預期的 JSON schema

**配置**:

```yaml
name: Schema_Validation
dataType: NUMERIC
categories: [0, 1]
description: "JSON schema 驗證結果"
```

**評分邏輯**:

```javascript
// src/modules/ai/llmJudge.mjs
const isValid = validateSchema(aiOutput, expectedSchema);
await createLangfuseScore(traceId, "Schema_Validation", isValid ? 1 : 0);
```

**使用場景**:

- InvestmentAdvice 輸出驗證
- PeriodReport 格式檢查
- RuleOptimizer 結果驗證

**分析建議**:

- 通過率應 > 95%
- 失敗案例需檢查 prompt 是否清楚
- 考慮添加 few-shot 範例

---

### 2. Actionability

**目的**: 評估新聞對投資決策的可操作性

**配置**:

```yaml
name: Actionability
dataType: NUMERIC
minValue: 0
maxValue: 1
description: "新聞可操作性評分（0=不可操作, 1=高度可操作）"
```

**評分邏輯**:

```javascript
// src/modules/ai/llmJudge.mjs
const prompt = `評估以下新聞的可操作性...`;
const score = await llmJudge(prompt, newsContent);
await createLangfuseScore(traceId, "Actionability", score.value);
```

**評分標準**:

- **0.0-0.3**: 資訊性，無明確操作建議
- **0.4-0.6**: 提供方向，但需更多資訊
- **0.7-1.0**: 明確可操作，建議清晰

**使用場景**:

- 新聞過濾
- 優先級排序
- 通知決策

**分析建議**:

- 追蹤平均分趨勢
- 高分新聞的特徵分析
- 低分新聞是否應過濾

---

### 3. Tone_Empathy

**目的**: 評估 AI 回覆的語氣同理心

**配置**:

```yaml
name: Tone_Empathy
dataType: NUMERIC
minValue: 0
maxValue: 1
description: "語氣同理心評分（0=冷漠, 1=高度同理）"
```

**評分邏輯**:

```javascript
// src/modules/ai/llmJudge.mjs
const criteria = {
  empathy: "是否理解用戶情緒",
  tone: "語氣是否溫和",
  helpfulness: "是否提供實質幫助",
};
const score = await llmJudge(criteria, aiResponse);
await createLangfuseScore(traceId, "Tone_Empathy", score.value);
```

**評分標準**:

- **0.0-0.3**: 冷漠、機械化
- **0.4-0.6**: 中性、禮貌
- **0.7-1.0**: 溫暖、同理、鼓勵

**使用場景**:

- InvestmentAdvice 回覆
- PeriodReport 敘述
- 用戶互動回應

**分析建議**:

- 目標平均分 > 0.7
- 低分案例人工審查
- 優化 prompt 語氣指引

---

### 4. Investment_Confidence

**目的**: AI 對投資建議的信心度

**配置**:

```yaml
name: Investment_Confidence
dataType: NUMERIC
minValue: 0
maxValue: 1
description: "投資建議信心度（0=低信心, 1=高信心）"
```

**評分邏輯**:

```javascript
// src/modules/ai/aiCoach.mjs
const confidence = calculateConfidence({
  dataQuality: signalData.quality,
  marketClarity: macroData.clarity,
  signalStrength: result.signals.strength,
});
await createLangfuseScore(traceId, "Investment_Confidence", confidence);
```

**計算因素**:

- 資料品質（30%）
- 市場清晰度（30%）
- 訊號強度（40%）

**使用場景**:

- 每日投資建議
- 策略決策輔助

**分析建議**:

- 按市場狀態分組分析
- 高信心案例特徵
- 信心度與實際表現相關性

---

### 5. News_Relevance

**目的**: 新聞與投資策略的相關性

**配置**:

```yaml
name: News_Relevance
dataType: NUMERIC
minValue: 0
maxValue: 1
description: "新聞相關性評分（0=不相關, 1=高度相關）"
```

**評分邏輯**:

```javascript
// src/modules/ai/aiCoach.mjs
const relevance = await evaluateRelevance(newsContent, {
  portfolio: ["0050", "00675L", "00740B"],
  strategy: "long-term-dca",
});
await createLangfuseScore(traceId, "News_Relevance", relevance);
```

**評分標準**:

- **0.0-0.3**: 無關（國際、其他產業）
- **0.4-0.6**: 間接相關（總經、市場情緒）
- **0.7-1.0**: 直接相關（持倉標的、ETF）

**使用場景**:

- 新聞過濾
- 通知優先級

---

### 6. Format_Compliance

**目的**: 輸出格式合規性檢查

**配置**:

```yaml
name: Format_Compliance
dataType: NUMERIC
categories: [0, 1]
description: "格式合規性（0=不符, 1=符合）"
```

**檢查項目**:

- Markdown 格式正確
- 必要區塊存在
- 字數範圍符合

**使用場景**:

- PeriodReport 產出
- 投資建議格式化

---

## 在 Langfuse UI 中配置

### 步驟

1. 登入 [Langfuse Cloud](https://cloud.langfuse.com)
2. 選擇專案
3. Settings → Scores
4. 點擊 "New Score Config"
5. 填寫配置（參考上方表格）
6. 儲存

### 範例配置（UI）

**Schema_Validation**:

```
Name: Schema_Validation
Data Type: Numeric
Categories: 0, 1
Description: JSON schema validation result
```

**Actionability**:

```
Name: Actionability
Data Type: Numeric
Min Value: 0
Max Value: 1
Description: News actionability score
```

---

## 分析查詢範例

### 1. Schema 驗證通過率

```sql
-- Langfuse SQL 查詢
SELECT
  DATE(timestamp) as date,
  AVG(value) as pass_rate,
  COUNT(*) as total
FROM scores
WHERE name = 'Schema_Validation'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### 2. Actionability 分佈

```sql
SELECT
  CASE
    WHEN value < 0.3 THEN 'Low'
    WHEN value < 0.7 THEN 'Medium'
    ELSE 'High'
  END as category,
  COUNT(*) as count
FROM scores
WHERE name = 'Actionability'
GROUP BY category;
```

### 3. Confidence vs Market Condition

```sql
SELECT
  traces.metadata->>'market_condition' as condition,
  AVG(scores.value) as avg_confidence
FROM scores
JOIN traces ON scores.trace_id = traces.id
WHERE scores.name = 'Investment_Confidence'
GROUP BY condition;
```

---

## 最佳實踐

### 1. Score 命名規範

✅ **好**:

- `Schema_Validation` - 清楚描述
- `Tone_Empathy` - 具體指標

❌ **差**:

- `quality` - 太模糊
- `score1` - 無意義

### 2. 值域標準化

所有數值 Score 統一使用 **0-1** 範圍：

- 便於比較
- 便於聚合
- 符合機率直覺

### 3. 持續校準

定期（每月）審查：

- Score 分佈是否合理
- 評分標準是否需調整
- 新增/移除 Score 項目

---

## 疑難排解

### Score 未生效

**症狀**: 代碼中記錄 Score，但 UI 不顯示

**檢查**:

1. Score 名稱與 UI 配置完全一致（區分大小寫）
2. 值在配置的範圍內
3. traceId 正確

### Score 分佈異常

**症狀**: 所有 Score 都集中在某個值

**可能原因**:

- 評分邏輯過於簡單
- 缺少區分度
- Prompt 不夠明確

**解決**:

- 優化評分 prompt
- 增加評分維度
- 使用 LLM Judge

---

## 相關文件

- [[Langfuse Score Analytics]] - Score 使用與分析
- [[Langfuse Prompt Management]] - Prompt 管理
- [[LLM Judge]] - 評分系統實作
- [[AI Pipeline]] - AI 處理流程

---

**最後更新**: 2026-09-10  
**最後驗證**: 2026-09-10（Langfuse v5.11.0）  
**維護者**: AI Team
