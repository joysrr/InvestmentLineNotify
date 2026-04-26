# Phase 2: Core Business Logic 審查與修復計畫

## 診斷結果

### P0 — 嚴重

- **[P0-3]** `broadcastDailyReport` 未 `await`，導致靜默中斷的風險
- **[P0-4]** `history.length < 30` 提早 return 後，沒有通知機制

### P1 — 中度

- **[P1-4]** `dailyCheck` 未將 `closeArr`、`ma20Arr`、`atrArr` 注入 `signalData`，導致停損/停利失效
- **[P1-5]** `analyzeMacroNewsWithAI` 失敗時缺乏降級處理，可能阻斷整個 `dailyCheck`
- **[P1-6]** `strategyEngine.mjs` 中的 `ctx` 遺漏了 `macroSentiment` 欄位

### P2 — 輕度

- **[P2-4]** `valuationGuardState` 寫入失敗時只做 log，應發送告警
- **[P2-5]** `dailyCheck.mjs` 中全面改用 `logger` 以取代 `console.log`
- **[P2-6]** `dailyCheck.mjs` 中針對 `finalPriceZ2` 的 fallback 語意加入了註解

## 實作修復

已由 @Backend 完成以上 8 項修正，並統一了日誌輸出與非同步例外保護。
