# 關鍵字與黑名單設定 (`keywordConfig.mjs`)

統一管理新聞搜尋的關鍵字庫與排除條件，避免這些硬編碼散落在爬蟲邏輯中。

## 1. 靜態關鍵字 (Base Queries)

分為 `baseTwQueries` 與 `baseUsQueries`。
每一筆設定包含：

- `keyword`：如 `"台股"`, `"S&P 500"`
- `searchType`：
  - `"intitle"`：強制出現在標題（適合核心名詞）。
  - `"broad"`：出現在內文即可（適合大範圍總經名詞如 `"降息"`）。

## 2. 排除關鍵字 (Exclude Keywords)

分為 `twExcludeKeywords` 與 `usExcludeKeywords`。這是在發送 RSS 請求時，直接讓 Google News 引擎進行排除的條件，例如 `-"排行榜"`、`-intitle:"買超個股"`。

## 3. 動態黑名單 (`blacklist.json`)

透過 `loadBlacklist()` 於執行期間即時讀取 `data/config/blacklist.json`，包含：

- `twExcludedSources` / `usExcludedSources`：精確排除特定媒體來源。
- `titleBlackListPatterns`：使用 Regex (正規表達式) 過濾特定釣魚或無意義標題。
