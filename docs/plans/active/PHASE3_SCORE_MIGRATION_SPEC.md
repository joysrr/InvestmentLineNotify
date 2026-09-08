# Phase 3: Score API 遷移 (13 處)

> **前置**: Phase 2 完成（aiClient.mjs 已使用 v5 API）
> **範圍**: 將所有 13 處 `langfuse.score()` 呼叫改為 `writeLangfuseScore()`
> **依賴**: `langfuseClient.mjs`

---

## 目標

確保所有 score 記錄（Schema_Validation、Quality_Check、Diversity 等）在 v5 下正確寫入，且**商業邏輯不變**。

## 搜尋語法（找到所有呼叫點）

```bash
grep -r "langfuse.score\|safeLangfuseScore" /src --include="*.mjs"
```

## 需遷移的檔案（13 處）

| 檔案                      | 位置                      | 呼叫點 | 說明                                |
| :------------------------ | :------------------------ | :----- | :---------------------------------- |
| `aiCoach.mjs`             | constructor / callAI 全部 | ~7     | Schema validation、quality check 等 |
| `llmJudge.mjs`            | callAI 完畢後             | ~2     | Quality 評分                        |
| `periodReportAgent.mjs`   | callAI 後 score record    | ~1     | Report 生成                         |
| `ruleOptimizerAgent.mjs`  | generateRuleSuggestions   | ~1     | Opitimizer Score                    |
| `scheduler/newsFetch.mjs` | fetch 後 score record     | ~1     | 新聞 fetch quality                  |
| `runNewsFetch.mjs`        | fetch 後 score record     | ~1     | 新聞 fetch quality                  |

## 替換程式碼

**Before**:

```javascript
await langfuse.score({
  traceId,
  name: "Schema_Validation",
  value: 1,
  comment: "FilterAndCategorizeNews JSON parse success",
});
```

**After**:

```javascript
import { writeLangfuseScore } from "./langfuseClient.mjs";

await writeLangfuseScore({
  traceId,
  name: "Schema_Validation",
  value: 1,
  comment: "FilterAndCategorizeNews JSON parse success",
});
```

## 驗證清單

- [ ] 所有 13 處 `safeLangfuseScore()` 包覆移除（直接使用 `writeLangfuseScore`）
- [ ] 測試檔案 `*.test.mjs` mock 更新（統一使用 mock）
- [ ] 執行 `npm test src/modules/ai/aiCoach.test.mjs` 確認 score mentor功能

## 預計工時２－３Ｈ
