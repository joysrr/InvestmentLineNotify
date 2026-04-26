# Phase 3: 資料提供層 (Providers + ArchiveManager) 審查與修復計畫

## 診斷結果

### P0 — 嚴重

- **[P0-5]** `rawMargin` KGI / FinMind 無備援自動切換機制（本次依指示暫不新增備援，僅列入未來規劃）
- **[P0-6]** `fetchAllMacroData` 中 `appendPbHistory` 未 `await` 且無 `catch`，導致資料序列偶發性遺失

### P1 — 中度

- **[P1-7]** `rawFx` 快取保護時間（30 分鐘）短於 `SLOT_CRITICALITY`（4 小時），已修正邏輯一致性
- **[P1-8]** `getHistoricalLoan` 取 N 筆而非 N 天前，已改為自然日反推
- **[P1-9]** `providerRegistry` 的 ticker 硬編碼問題，已改為預設參數傳入
- **[P1-10]** `cleanOldArchives` 依賴 `mtime`，已修正為優先解析檔名日期 (`YYYY-MM-DD.json`)

### P2 — 輕度

- **[P2-7]** `saveMarketData` 寫入失敗不拋錯，已追加 `try/catch` 與 `throw`
- **[P2-8]** `getHighsSince` 僅回溯 3 個月，已改為動態依據買入日回推月數
- **[P2-9]** `SLOT_CRITICALITY` 不一致，已集中移至 `dataSourceConfig.mjs` 管理

## 實作修復

由 @Backend 針對上述核心邏輯（P0-6, P1-7, P1-8, P1-9, P1-10, P2-7, P2-8, P2-9）完成修復，暫緩新增資料來源以維持系統穩定性。
