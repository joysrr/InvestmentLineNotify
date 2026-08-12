# 優化與技術債清單 (Draft Optimizations)

> 本文件記錄於 2026-04-29 的 `docs/` 混合式架構重構過程中，透過程式碼與文件一致性驗證所發掘的系統痛點與優化建議。
> 這些項目將做為下一個階段系統優化 (Evolution) 的 Backlog。

## 🔍 已發現的優化項目

### 1. `storage.mjs` 欄位與特定標的 (Ticker) 高度耦合

- **現況**：在 `fetchLastPortfolioState()` 與 `logDailyToSheet()` 中，硬編碼了 `"0050 股數"`、`"00675L 股數"`、`"0050 均價"` 等 Google Sheets 欄位名稱，且變數命名直接為 `qty0050`, `qtyZ2`。
- **痛點**：這使得「底層基礎設施」被特定市場策略綁架。若未來策略改變，決定不持有 0050 或 00675L，我們必須修改 Google Sheets 欄位與 `storage.mjs` 的底層程式碼。
- **優化建議**：應將資產定義抽象化，改由 `strategyEngine` 傳入 Portfolio Schema，讓 `storage.mjs` 變成泛用的讀寫器，或是建立對映表 (Mapping table) 進行動態轉換。
