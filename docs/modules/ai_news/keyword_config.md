---
type: reference
status: current
last_updated: 2026-09-11
last_verified: 2026-09-11
related_code:
  - src/modules/keywordConfig.mjs
  - data/config/keywords.json
related_docs:
  - docs/modules/ai_news/news_fetcher.md
  - docs/modules/ai_news/ai_pipeline.md
tags:
  - keywords
  - configuration
  - filtering
  - news
---

# 關鍵字與黑名單設定 (`keywordConfig.mjs`)

> **摘要**: 統一管理新聞搜尋的靜態/動態關鍵字庫與排除條件

## 概念關係

- [[News Fetcher]] - 使用關鍵字抓取新聞
- [[AI News]] - 模組概覽
- [[Social Sentiment]] - 社群情緒關鍵字

---

## 1. 靜態關鍵字 (Base Queries)

分為 `baseTwQueries` 與 `baseUsQueries`。

### 配置檔案

- **台股**: `data/keywords/static_tw.json`
- **美股**: `data/keywords/static_us.json`

### 欄位說明

每一筆設定包含：

- `keyword`: 如 `"台股"`, `"S&P 500"`
- `searchType`:
  - `"intitle"`: 強制出現在標題（適合核心名詞）
  - `"broad"`: 出現在內文即可（適合大範圍總經名詞如 `"降息"`）
- `category`: 分類 (macro, stock, etf, etc.)
- `priority`: 優先順序 (1-5)

### 台股靜態關鍵字 (節選)

| Keyword | searchType | Category | Priority |
| ------- | ---------- | -------- | -------- |
| 台股    | intitle    | market   | 5        |
| S&P 500 | intitle    | market   | 5        |
| 降息    | broad      | macro    | 4        |
| 美股    | intitle    | market   | 4        |
| 0050    | intitle    | etf      | 5        |
| 00675L  | intitle    | etf      | 5        |

### 美股靜態關鍵字 (節選)

| Keyword | searchType | Category | Priority |
| ------- | ---------- | -------- | -------- |
| Fed     | intitle    | macro    | 5        |
| CPI     | intitle    | macro    | 4        |
| Nasdaq  | intitle    | market   | 4        |
| AAPL    | intitle    | stock    | 3        |

---

## 2. 排除關鍵字 (Exclude Keywords)

分為 `twExcludeKeywords` 與 `usExcludeKeywords`。這是在發送 RSS 請求時，直接讓 Google News 引擎進行排除的條件，例如 `-"排行榜"`，`-intitle:"買超個股"`。

### 配置檔案

- **台股**: `data/keywords/exclude_tw.json`
- **美股**: `data/keywords/exclude_us.json`

### 示例

```json
{
  "excludeKeywords": ["排行榜", "買超個股", "今日操盤", "短線交易"]
}
```

---

## 3. 動態關鍵字 (Dynamic Keywords)

動態關鍵字由 [[Social Sentiment]] 分析生成，反映市場關注的熱點主題。

### 管理方式

- **來源**: `data/keywords/dynamic_keywords.json`
- **更新頻率**: 每 3 小時 (social sentiment cron)
- **最大數量**: 50 個
- **過期時間**: 7 天

### 格式

```json
[
  {
    "keyword": "NVIDIA",
    "category": "stock",
    "priority": 4,
    "source": "bluesky",
    "addedAt": "2026-09-10T08:00:00Z",
    "confidence": 0.85
  }
]
```

### 注意事項

⚠️ **動態關鍵字僅供 newsFetch 使用，不能 merge 到 social sentiment 收集中**

---

## 4. 動態黑名單 (`blacklist.json`)

透過 `loadBlacklist()` 於執行期間即時讀取 `data/config/blacklist.json`，包含：

### 配置檔案

`data/config/blacklist.json`

### 欄位說明

```json
{
  "twExcludedSources": ["自由台灣", "闢遠-point"],
  "usExcludedSources": ["Benzinga", "Seeking Alpha"],
  "titleBlackListPatterns": [".*公告$", ".*除息$", "^【公告】.*"],
  "contentBlackListPatterns": ["點擊量", "轉發獲獎"]
}
```

### 運作方式

1. **來源過濾**: RSS 回應中的 `source` 字段與 `excludedSources` 列表比對
2. **標題黑名單**: 使用 Regex 匹配標題
3. **內容黑名單**: 在 AI 過濾前，移除匹配內容的文章

---

## 5. 配置管理

### 環境變數

| 變數                  | 預設                         | 說明         |
| --------------------- | ---------------------------- | ------------ |
| `KEYWORD_CONFIG_PATH` | `data/keywords/`             | 配置文件目錄 |
| `BLACKLIST_PATH`      | `data/config/blacklist.json` | 黑名單路徑   |

### 更新方式

```bash
# 手動更新
vim data/keywords/static_tw.json

# 程式更新
node scripts/update-dynamic-keywords.mjs

# 驗證
node scripts/verify-keywords.mjs
```

---

## 6. 使用範例

### 在 newsFetch.mjs 中使用

```javascript
import { keywordConfig } from "../modules/ai/keywordConfig.mjs";

// 取得所有關鍵字
const keywords = keywordConfig.getAllActiveKeywords();

// 組合 RSS URL
const rssUrl = `https://news.google.com/rss/search?q=${keywords
  .map((k) => (k.searchType === "intitle" ? `intitle:${k.keyword}` : k.keyword))
  .join(" ")}`;
```

### 新增關鍵字

```bash
# 編輯配置文件
vim data/keywords/static_tw.json

# 添加:
# {
#   "keyword": "量化交易",
#   "searchType": "intitle",
#   "category": "strategy",
#   "priority": 3
# }

# 驗證
node scripts/verify-keywords.mjs
```

---

## 7. 故障排除

### 關鍵字無效

**症狀**: RSS 回傳空結果

**可能原因**：

- 關鍵字過於模糊
- searchType 設定錯誤
- 過濾條件過嚴

### 黑名單過濾過多

**症狱**: 重要新聞被過濾

**檢查**:

- `titleBlackListPatterns` 是否匹配到正常標題
- `excludedSources` 是否封殘了可信媒體

---

## 相關文件

- [[News Fetcher]] - 抓取流程
- [[AI Pipeline]] - AI 過濾
- [[Social Sentiment]] - 動態關鍵字來源
- [[Blacklist Management]] - 黑名單策略

---

**最後更新**: 2026-09-10  
**最後驗證**: 2026-09-10
