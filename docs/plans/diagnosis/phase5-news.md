# Phase 5: 新聞系統 (RSS, 去重, 新聞池容量) 審查與修復計畫

## 診斷結果

### P1 — 中度

- **[P1-15]** `loadBlacklist()` 無 fallback 機制，檔案缺失時會引發 `ENOENT` 並阻斷整個新聞抓取管線。已追加 `try/catch`，在讀取失敗時安全回傳空黑名單陣列。
- **[P1-16]** `prepareNewsForAI` 中單一來源篇數限制（`<= 100`）過於寬鬆。已下調為 `MAX_PER_SOURCE = 5`，強制分散來源，提升 AI 訓練池多樣性。
- **[P1-17]** `runNewsFetch` 中 `updatePool()` 之後重複執行 `purgeExpiredFromPool()` 造成多餘的 I/O 與雙次歸檔風險。已將多餘的 `purgeExpiredFromPool()` 移除。

### P2 — 低度

- **[P2-18]** `filterNewsByDate` 的 6 小時雙重過濾機制未有註解說明。已補充設計原意註解：防禦 RSS 引擎偶發回傳的異常時間戳（舊聞重上架）。
- **[P2-19]** `generateDailySearchQueries` 依賴寫死的市況 `"暫無即時市況"` 生成關鍵字。已改為讀取 `latest.json` 取得 `vix` 及市場快取狀態，使動態搜尋關鍵字能正確反映現況。
- **[P2-20]** `newsConflictGrouper` 的 Jaccard 相似度閾值對英文新聞 (`0.3`) 太寬鬆，容易把跨事件誤分群。已改採分國設定：台灣維持 `0.3`，美國拉高至 `0.45`。

## 實作修復

由 @Backend 完成所有修正，並由 @Reviewer 審查其異常處理與過濾邏輯的安全性，確保新聞排程穩定可用。
