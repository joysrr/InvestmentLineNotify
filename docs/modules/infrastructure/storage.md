---
type: reference
status: needs-review
last_updated: 2026-09-10
related_code:
  - src/modules/infrastructure/storage.mjs
tags:
  - storage
  - persistence
  - news-pool
wiki_links:
  - [[AI News]]
---

# 雲端儲存與帳戶狀態同步 (`storage.mjs`)

`src/modules/storage.mjs` 負責將 Google Sheets 作為輕量級的帳戶狀態資料庫。

## 1. 核心功能

1. **`fetchLastPortfolioState()`**：從「資產紀錄」讀取最新的持股水位、均價、現金等，做為今日運算的起點。
2. **`logDailyToSheet()`**：將每日產生的戰報寫回「通知紀錄」，作為歷史追蹤，並避免同一天重複執行造成的紀錄污染（相同日期執行會採 `assign` 覆寫）。

## 2. 欄位容錯機制

為了避免使用者手動編輯 Sheet 時發生格式錯誤，程式內建防護：

- **`lastBuyDate` 雙來源容錯**：若 Sheet 的日期格式錯誤或留空，系統將會 fallback 到本地 `data/last_buy.json` 的備份；兩者皆無效才會視為冷卻期歸零。
- **均價處理**：`avgCost0050` 與 `avgCostZ2` 若為空值或非數字，將安全回傳 `null`，不阻斷主流程。

## 3. 依賴環境變數

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`

> [!NOTE]
> 讀寫操作已透過 `withRetry` 封裝，遭遇網路不穩或 API Rate Limit 時將自動重試 3 次，增加排程穩定度。
