---
type: reference
status: current
last_updated: 2026-09-11
last_verified: 2026-09-11
related_code:
  - src/modules/newsFetcher.mjs
  - src/runNewsFetch.mjs
  - src/modules/news/newsConflictGrouper.mjs
related_docs:
  - docs/modules/ai_news/keyword_config.md
  - docs/modules/ai_news/ai_pipeline.md
  - docs/modules/operations/schedules.md
tags:
  - news
  - rss
  - fetching
  - filtering
  - conflict-grouper
---

# 新聞採集器 (`newsFetch.mjs`)

> **摘要**: 從 Google News RSS 批量抓取新聞，進行物理層篩選

## 概念關係

- [[Keyword Config]] - 關鍵字設定
- [[AI Pipeline]] - AI 過濾
- [[AI News]] - 模組概覽

---

## 1. 抓取流程 (Pipeline)

```
┌─────────────────────┐
│ Keyword Config      │ ← 靜態 + 動態關鍵字
│ (keywordConfig.mjs) │
└──────────┬──────────┘
           │ 組合搜尋指令
           ▼
┌─────────────────────┐
│ Google News RSS     │ ← intitle:xxx +when:6h
└──────────┬──────────┘
           │ RSS 回應
           ▼
┌─────────────────────┐
│ 物理過濾             │
│ - 時間過濾 (<6h)     │
│ - 來源黑名單         │
│ - 指紋去重 (SHA-256) │
└──────────┬──────────┘
           │ 高品質新聞
           ▼
┌─────────────────────┐
│ News Pool           │ ← data/newsPool.json
└─────────────────────┘
```

### 1.1 關鍵字組裝

將 `keywordConfig.mjs` 的靜態與動態關鍵字合併，組合為 Google News 的進階搜尋指令 (`intitle:xxx +when:6h`)。

### 1.2 批次併發抓取

使用 `Promise.allSettled` 平行抓取，避免單一 Keyword 的 RSS 異常阻塞全域。

**併發控制**：`maxConcurrent=3`

```javascript
// src/scheduler/newsFetch.mjs
const results = await Promise.allSettled(
  queries.map((q) => fetchWithTimeout(rssUrl, { timeout: 15000 })),
);
```

### 1.3 時間過濾

排除發布時間超過 6 小時的舊聞。

---

## 1.6 衝突事件分群 (Conflict Grouper)

抓取完成後，呼叫 `newsConflictGrouper.mjs` 的 `assignConflictGroups` 進行衝突分群預處理。

**演算法**:

- 使用 **Jaccard 相似度** 比較標題相似度
- 中文閾值: 0.3, 英文閾值: 0.45
- 使用 **Union-Find** 將相似文章歸為同一群組
- 群組大小 ≥ 2 才標記 ID (G1, G2...)

```javascript
// src/modules/news/newsConflictGrouper.mjs
const tagged = assignConflictGroups(fetchedNews);
```

**目的**: 將不同媒體對同一事件的多篇報導歸組，便於後續 AI 進行事件摘要。

---

## 2. AI 過濾與摘要

讀取黑名單 (`blacklist.json`) 排除農場內容。

**來源**：`src/data/config/blacklist.json`

### 1.5 指紋去重 (Fingerprinting)

呼叫 `newsPoolManager.mjs` 的 `buildFingerprint`。將標題轉為小寫、移除標點與來源後，計算 SHA-256 前 16 碼，確保不同媒體發布的同一篇通稿不會重複。

```javascript
function buildFingerprint(title, source) {
  const clean = title
    .toLowerCase()
    .replace(/[「」『』【】，。！？、：；："']/g, "")
    .replace(source, "");
  return crypto.createHash("sha256").update(clean).digest("hex").slice(0, 16);
}
```

---

## 2. 降級容錯 (Fallback)

若上述層層篩選後，留下來的高品質新聞數量極低（`< FALLBACK_THRESHOLD`），系統將會放棄動態關鍵字，只用最核心的「靜態關鍵字池」重新抓取一次，以確保戰報至少有基本資訊可看。

**配置**: `FALLBACK_THRESHOLD` in `src/scheduler/newsFetch.mjs`

---

## 3. 排程運作

### Cron 設定

- **頻率**: 每 3 小時
- **時間**: 07:00, 10:00, 13:00, 16:00, 19:00, 22:00 (台灣時間)
- **限制**: 僅在清醒時段執行

**配置**: `config/crontab.json` → `newsCollector`

### 環境變數

- `NEWS_RSS_TIMEOUT` (預設: 15000ms)
- `NEWS_FETCH_CONCURRENCY` (預設: 3)

---

## 4. 輸出格式

抓取的新聞存入 `data/newsPool.json`：

```json
{
  "id": "sha256_fingerprint",
  "title": "新聞標題",
  "url": "https://...",
  "source": "媒體名稱",
  "publishedAt": "2026-09-10T08:51:00Z",
  "category": "macro|stock|technology",
  "fetchMethod": "rss",
  "contentSnippet": "..."
}
```

---

## 5. 故障排除

### RSS 抓取失敗

**症狀**: `Promise.allSettled` 回傳大多失敗

**可能原因**:

- Google News 封鎖
- 網路連線問題
- 關鍵字過多導致 URL 過長

**解決**:

- 減少併發數
- 檢查關鍵字長度
- 增加 Timeout

### 重複新聞

**症狱**: 相同新聞多次出現

**檢查**:

- Fingerprint 算法是否正常
- News Pool 是否正常去重

### 過濾過嚴

**症狀**: 高品質新聞被過濾

**檢查**:

- 黑名單是否封殺了正常來源
- 指紋算法是否有誤判

---

## 相關文件

- [[Keyword Config]] - 關鍵字設定
- [[AI Pipeline]] - AI 過濾管線
- [[AI News]] - 模組概覽
- [[Schedule]] - Cron 排程

---

**最後更新**: 2026-09-10  
**最後驗證**: 2026-09-10
