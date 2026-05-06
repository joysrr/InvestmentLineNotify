# Phase 7: 前端 Mini App (API 錯誤處理、loading/error 狀態) 審查與修復計畫

## 診斷結果

### P1 — 中度

- **[P1-27]** `apiFetch` 中的 retry 邏輯在 Telegram SDK 未就緒（`initData` 為空）且達到最大重試次數時，仍會強制送出請求，造成必然的 403 錯誤。已補上判斷，若耗盡 retry 仍無 `initData`，會直接拋出「Telegram SDK 未就緒」的明確錯誤，阻止無效的請求發送。
- **[P1-28]** `DashboardView` 在 `onMounted` 階段直接呼叫 `loadAll`，未等待 SDK 初始化。已匯入並加入 `await waitReady()` 確保 `initData` 已產生後才觸發請求，將 retry 從原本的「後備補救」升級為「第二道防線」。
- **[P1-29]** `apiFetch` 原本將 400/403/404 等用戶端錯誤與 500/網路超時視為相同，一律重試並浪費多餘的等待時間。已修正為讀取 `err.status`，若是 `4xx` 錯誤則直接 `break` 放棄重試，顯著提升前端出錯時的 UI 反應速度。

### P2 — 低度

- **[P2-30]** `DashboardView.vue` 內的 `topNews` 在同一個 `age_band` 下缺乏穩定排序機制。已追加 `publishedAt` 作為第二順位（tiebreaker）排序依據，確保越新的新聞會穩定排在前面。
- **[P2-31]** VIX 卡片的數值顯示來自即時快取，但顏色等級卻來自昨日的 `latestReport`。已將等級判斷的優先順序改為優先讀取即時快取的 `status.data.rawUsMarket.vix`，使卡片顏色與數值同步。
- **[P2-32]** `usePortfolioSnapshots` 捕捉錯誤時一律回報固定的中文字串，使錯誤追蹤困難。已改為根據 API 回傳的 `HTTP status` 組裝訊息（如 `載入失敗 (403)` vs `網路異常`），提升除錯體驗。

## 實作修復

由 @Frontend 完成所有重構與狀態修復，@Reviewer 與 @QA 經確認 API 生命週期及防呆機制均已生效，前端體驗獲得改善。
