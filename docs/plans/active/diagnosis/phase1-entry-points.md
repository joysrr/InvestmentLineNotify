# Phase 1: Entry Points 審查與修復計畫

## 診斷結果

### P0 — 嚴重

- **[P0-1]** `runDailyCheck` 的 `finally` 區塊中 Langfuse shutdown 未 `await`
- **[P0-2]** `runDailyCheck` 缺少 `dotenv/config` import

### P1 — 中度

- **[P1-1]** `runWeeklyReport` / `runMonthlyReport` 的 AI 失敗未被分離
- **[P1-2]** `runOptimizer` 的 Langfuse shutdown 在印出日誌前就離開了
- **[P1-3]** `runWeeklyReport` / `runMonthlyReport` 都缺少 Langfuse shutdown

### P2 — 輕度

- **[P2-1]** 五個 runner 的參數解析方式各自不同
- **[P2-2]** `runDailyCheck` 使用結構化 `logger`，其他 runner 全用 `console.log`
- **[P2-3]** `runMonthlyReport` 的 `reports = allReports.slice(-30)` 語意不直覺

## 實作修復

已由 @Backend 完成以上 8 項修正：

1. 確保各 runner 在 `finally` 中皆使用 `await langfuse.shutdownAsync()`。
2. 確保各 runner 第一行皆顯式引入 `dotenv/config`。
3. 在週報與月報中，將 `generatePeriodAiSummary` 以 `try/catch` 獨立包裹，AI 發生錯誤時降級發送純統計報告。
4. 全面將 `console.log` 替換為結構化 `logger` 確保日誌格式一致。
5. 補充了月報 `.slice(-30)` 的邏輯註解。
