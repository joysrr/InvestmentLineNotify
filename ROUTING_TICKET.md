# Routing Ticket (RT-20260505-001)

## 📌 任務基本資訊

- **建立時間**：2026-05-05
- **任務名稱**：修正 VIX 歷史資料的競爭條件與寫入原子性 (modify-existing)
- **分配給**：`@Backend`
- **緊急程度**：Normal
- **task_class**: modify-existing
- **touched_files**: src/domain/dailyRunContext.mjs, src/modules/data/archiveManager.mjs

## 🎯 任務目標

1. **修復 Race Condition**：修改 `src/domain/dailyRunContext.mjs` 中的 `buildDailyRunContext`，將 `_fetchVix()` 和 `_fetchVixHistory()` 的執行順序解耦或序列化，確保 `vixArr` 正確包含當日最新寫入的 VIX 值。
2. **實作原子寫入防護 (TOCTOU)**：修改 `src/modules/data/archiveManager.mjs` 的 `saveVixHistory`，採用 `.tmp` 暫存檔寫入搭配 `fs.rename` 覆寫機制，確保檔案寫入的原子性，避免進程中斷導致 JSON 損毀。

## 📝 執行準則

- `saveVixHistory`：必須使用 `await fs.writeFile(FILES.VIX_HISTORY + ".tmp", ...)` 接著 `await fs.rename(...)`。
- `buildDailyRunContext`：可考慮 `_fetchVixHistory()` 純粹回傳檔案內容，再手動把今天的 VIX (`vixData.value`) 加入記憶體陣列末尾，或是讓 `Promise.allSettled` 不平行執行這兩者。
- 此任務被歸類為 `modify-existing`，因此跳過 Stage 1~4，直接進入 Stage 5 實作。
