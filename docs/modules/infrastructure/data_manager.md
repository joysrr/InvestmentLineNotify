---
type: reference
status: current
last_updated: 2026-10-01
last_verified: 2026-10-01
related_code:
  - src/modules/data/archiveManager.mjs
  - src/modules/storage.mjs
tags:
  - data
  - storage
  - json
wiki_links:
  - [[AI News]]
  - [[History Provider]]
---

# 檔案快取與歷檔管理 (`data/`)

專案所有的持久化狀態（除了帳戶餘額儲存於 Google Sheets 外）皆儲存於本地端的 `data/` 目錄中。主要由 `archiveManager.mjs` 與 `newsPoolManager.mjs` 負責讀寫。

## 1. 核心資料夾配置 (由 `archiveManager` 自動建立)

| 目錄                   | 說明                                            | 清理策略           |
| ---------------------- | ----------------------------------------------- | ------------------ |
| `data/market/`         | 最新市場數據快取 (`latest.json`)。              | 不清理，持續覆寫   |
| `data/market/history/` | 每日市場數據歷史快照。                          | 預設保留 30 天     |
| `data/ai_logs/`        | 每次與 LLM 互動的完整 Request/Response 紀錄。   | 不限天數（可設定） |
| `data/reports/`        | 每日最終輸出的戰報檔案。                        | 預設保留 30 天     |
| `data/stock_history/`  | 透過 TWSE API 抓取的歷史 K 線快取，按月份儲存。 | 永久保留           |
| `data/news/`           | 由 `newsPoolManager.mjs` 管理的新聞池。         | TTL 24 小時後歸檔  |
| `data/news_logs/`      | 新聞篩選器 (Filter) 通過文章的歷史紀錄。        | 預設保留 30 天     |
| `data/vixHistory.json` | 台指 VIX 歷史數值紀錄 (用於策略動能計算)。      | 保留最近 90 天     |

## 2. 新聞池管理 (`newsPoolManager.mjs`)

- **Active Pool (`pool_active.json`)**：儲存 24 小時內的最新新聞，並設有上限 (`MAX_POOL_SIZE = 200`)。
- **Filtered Pool (`pool_filtered_active.json`)**：儲存經過 AI 篩選過後，具備 `summary` 的高價值新聞。
- **去重機制**：實作了針對新聞標題的 fingerprint 與模糊去重 (fuzzy dedupe)，避免重複新聞轟炸 AI 處理管線。

## 3. 自動清理 (Retention Policy)

系統提供 `archiveManager.cleanOldArchives(daysToKeep)`，可於每日排程結束後自動刪除超過 30 天的市場快取、戰報與新聞，避免磁碟空間無限增長。

## 4. 戰報加密機制 (`snapshotCrypto.mjs`)

在寫入 `data/reports/` 時，若環境變數配置了 `SNAPSHOT_ENCRYPT_KEY`（必須為 32 bytes hex，共 64 字元），系統會自動透過 AES-256-GCM 將持有部位的私密資訊加密寫入 JSON 的 `snapshot` 欄位。API 取用時需使用同把金鑰解密，確保即便機器遭入侵，靜態 JSON 檔案也無法洩漏個人持股明細。

## 5. 歷史 K 線快取與資料量契約

`data/stock_history/` 的檔案以 `{stockNo}_YYYYMM.json` 按月份保存 TWSE STOCK_DAY 歷史資料。月份是外部 API 的查詢批次，不是歷史資料是否可用的成功條件。

`historyProvider.mjs` 會從結束日期所在月份開始，逐月往前查詢並合併資料，直到達到呼叫端要求的最低筆數（目前 dailyCheck 為 60 筆）或用盡回補月份。合併時會依日期去重並排序。

- 當月尚未開市或尚無成交資料，TWSE 可能回覆「很抱歉，沒有符合條件的資料!」。這是可預期的空月份，會略過並繼續往前回補。
- 真正的連線逾時、HTTP/JSON 異常或非預期來源錯誤，會記錄失敗月份；若最後仍不足最低筆數，才會回報來源不可用或歷史資料不足。
- 即使某個月份為空，只要累積資料達到最低筆數，整體結果仍為 `available`，不得因空的當月資料中止 dailyCheck。
- 非當月且取得有效資料的月份會寫入 `archiveManager` 快取；當月資料不永久寫入月份快取，避免將未完成月份視為完整歷史。

這個契約同時適用於 00675L 與 0050，實際程式入口為 `src/modules/providers/historyProvider.mjs`，TWSE 月資料與快取實作位於 `src/modules/providers/twseProvider.mjs`。
