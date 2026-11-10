---
type: reference
status: current
last_updated: 2026-11-11
last_verified: 2026-09-11
related_code:
  - src/modules/data/newsPoolManager.mjs
  - src/modules/data/newsPoolManager.test.mjs
related_docs:
  - docs/modules/infrastructure/data_manager.md
  - docs/modules/ai_news/news_fetcher.md
tags:
  - infrastructure
  - news-pool
  - persistence
  - deduplication
  - caching
wiki_links:
  - "[[Infrastructure]]"
  - "[[AI News]]"
  - "[[News Fetcher]]"
---

# 新聞池管理 (`newsPoolManager.mjs`)

> **摘要**: 負責本地端主動新聞池（Active News Pool）與過濾新聞池（Filtered Pool）的持久化儲存、標題指紋去重、時間帶分級（Age Band）與滾動生命週期封存。

---

## 1. 核心職責與架構定位

`src/modules/data/newsPoolManager.mjs` 是新聞資料流（News Ingestion Pipeline）中的儲存守門員與快取中心：

1. **去重過濾 (Deduplication)**：接收採集器抓取的文章，利用標準化標題指紋防止重複文章湧入後續 AI 摘要管線。
2. **生命週期控管 (TTL & Lifecycle)**：維持 24 小時滑動視窗（Active Window），逾時文章自動移轉至每日歷檔封存。
3. **容量上限防護 (Hard Cap)**：防止未預期的大量新聞衝擊記憶體與儲存，設有硬上限防護機制。
4. **兩階段池結構 (Two-Tier Pools)**：
   - **Active Pool (`pool_active.json`)**：存放未過濾但已去重的原始抓取新聞。
   - **Filtered Pool (`pool_filtered_active.json`)**：存放經由 AI 篩選、分類並具備 `summary` 的高價值決策新聞。

---

## 2. 儲存路徑與目錄架構

所有檔案皆儲存於專案根目錄之 `data/news/`：

```text
data/news/
├── pool_active.json           # 24 小時內活躍原始新聞池 (MAX 200 篇)
├── pool_filtered_active.json  # 經 AI 篩選過的高價值決策新聞池
└── archive/                   # 逾期新聞滾動封存目錄
    ├── archive_2026-04-14.json
    └── archive_2026-04-15.json
```

---

## 3. 關鍵機制與演算法

### 3.1 標題指紋演算法 (`buildFingerprint`)

為了消除不同媒體轉載或格式排版微小差異造成的重複，實作 5 階段正規化：

1. **剝除來源後綴**：去除常見媒體標籤（如 `- Reuters`, `| 經濟日報`, `| Yahoo奇摩股市` 等）。
2. **小寫轉化**：英文字元全部轉為小寫。
3. **字元過濾**：去除標點符號與空白，僅保留中英文字元與數字 (`/[^\w\u4e00-\u9fff]/g`)。
4. **截斷取樣**：取正規化後的前 80 個字元。
5. **雜湊取樣**：計算 SHA-256 雜湊值，取前 16 位元 hex 字串作為指紋 ID。

```javascript
// 指紋鍵值區分市場區域，避免跨國碰撞
const regionKey = `${region}:${fingerprint}`;
```

### 3.2 時間帶分級 (`getAgeBand`)

根據文章的 `fetched_at` 判定其時效等級：

| 等級     | 時間區間     | 用途                                    |
| -------- | ------------ | --------------------------------------- |
| `fresh`  | 0 ~ 6 小時   | 具備最高時效性，優先送交即時分析與通知  |
| `recent` | 6 ~ 12 小時  | 次級時效，保留於 active pool 供日報彙整 |
| `stale`  | 12 ~ 24 小時 | 保留備查，接近生命週期尾聲              |

### 3.3 殭屍文章防護 (`isZombieArticle`)

若文章缺失 `fetched_at` 或日期字串無法解析，視為「殭屍文章」，在進行更新或維護時直接清除，不寫入 `archive/`。

### 3.4 滾動清理與容量限制

- **`TTL_HOURS = 24`**：超過 24 小時的文章自 `pool_active.json` 移出，按當日日期（`archive_YYYY-MM-DD.json`）追加封存。
- **`MAX_POOL_SIZE = 200`**：活躍新聞池容量上限。當文章數超過上限時，強制按時間排序僅保留最新 200 篇。
- **歷檔保留天數**：`cleanOldNewsArchives(daysToKeep = 30)` 預設清理超過 30 天的歷史封存檔。

---

## 4. 匯出介面與 API

| 函數名稱               | 參數                                      | 說明                                                      |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `buildFingerprint`     | `(title: string)`                         | 計算標題 16 碼正規化指紋                                  |
| `updatePool`           | `(newArticles: Array<Article>)`           | 批次合併新文章至 `pool_active.json`（執行去重與容量上限） |
| `purgeExpiredFromPool` | `()`                                      | 清理 >24 小時新聞並將過期新聞追加至 `archive/` 歷檔       |
| `loadPoolWithFallback` | `()`                                      | 讀取目前活躍新聞池，若讀取異常則回傳安全空結構            |
| `saveFilteredPool`     | `(filteredArticles, sourcePoolUpdatedAt)` | 將 AI 過濾後的摘要新聞寫入 `pool_filtered_active.json`    |
| `cleanOldNewsArchives` | `(daysToKeep = 30)`                       | 清理 `data/news/archive/` 中超過指定天數的封存檔案        |

---

## 5. 相關測試

- `src/test/unit/newsPoolManager.test.mjs`：涵蓋指紋生成、去重隔離、逾時歸檔與容量截斷之單元測試。
