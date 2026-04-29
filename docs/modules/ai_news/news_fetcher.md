# 新聞採集器 (`newsFetcher.mjs`)

負責從 Google News RSS 大量抓取新聞，並進行物理層級的初步篩洗。

## 1. 抓取流程 (Pipeline)

1. **關鍵字組裝**：將 `keywordConfig.mjs` 的靜態與動態關鍵字合併，組合為 Google News 的進階搜尋指令 (`intitle:xxx +when:6h`)。
2. **批次併發抓取**：使用 `Promise.allSettled` 平行抓取，避免單一 Keyword 的 RSS 異常阻塞全域。
3. **時間過濾**：排除發布時間超過 6 小時的舊聞。
4. **來源過濾**：讀取黑名單 (`blacklist.json`) 排除農場內容。
5. **指紋去重 (Fingerprinting)**：呼叫 `newsPoolManager.mjs` 的 `buildFingerprint`。將標題轉為小寫、移除標點與來源後，計算 SHA-256 前 16 碼，確保不同媒體發布的同一篇通稿不會重複。

## 2. 降級容錯 (Fallback)

若上述層層篩選後，留下來的高品質新聞數量極低（`< FALLBACK_THRESHOLD`），系統將會放棄動態關鍵字，只用最核心的「靜態關鍵字池」重新抓取一次，以確保戰報至少有基本資訊可看。
