# 🚀 未來功能實作評估與規劃 (Upcoming Features)

本文件紀錄未來預計替「00675L 槓桿 ETF 投資決策系統」擴充的 4 項核心功能藍圖，包含大盤基本面指標的整合，以及 AI 新聞管線的持續進化。

---

## 📌 【指標擴充類】1. 加入大盤 PB（股價淨值比）指標（已完成尚未人工驗證）
### 功能目標
加入 PB (Price-to-Book Ratio) 作為大盤「位階」的防護網。技術指標如 RSI 或乖離率僅能反映短中期的動能過熱，而大盤 PB 則能提供長線的「左側便宜基期」與「右側極度泡沫」判定，進一步強化 00675L 槓桿調降與破冰加碼的信心點位。

### 影響範圍
- `src/modules/providers/twseProvider.mjs` (或新增 `valuationProvider.mjs`)
- `src/modules/data/archiveManager.mjs` (快取更新)
- `src/modules/ai/aiDataPreprocessor.mjs` (格式化為 AI Context)
- `src/modules/strategy/strategyEngine.mjs` (決策邏輯)

### 實作步驟草案 (Step-by-Step)
1. **API 實作**：於 Provider 撰寫向 TWSE 證交所 API (或證期局公開資料) 獲取「大盤股價淨值比」的非同步函式。
2. **快取整合**：將回傳的 PB 數值整合進 `marketData.mjs` 的 `fetchAllMacroData()` 中，並利用 `archiveManager` 存入 `data/market/latest.json` 以便每日呼叫不觸發限流。
3. **風控邏輯納入**：於 `strategyEngine.mjs` 中加入基於 PB 的強而有力的風控限制。例如：當大盤 PB > 2.2（歷史極高點）就算技術面轉多，也強制降級為觀望或限制最高槓桿。
4. **教練脈絡與 UI**：在 `aiDataPreprocessor` 組合字串，並在 `telegramHtmlBuilder.mjs` 的「🌐 市場概況」區塊中顯示 `PB: 2.15 (昂貴)` 標籤。

### 潛在挑戰與防禦機制
- **爬蟲不穩定性**：證交所網站可能有改版或短暫鎖 IP 的風險。必須使用 `fetchWithTimeout` 包裝。
- **容錯Fallback**：萬一抓取失敗，PB 數值設為 `null`，策略判斷（`if PB > 2.2`）需具備空值防護，直接忽略該風控條件，絕不能讓主排程中斷。

### 資料流設計
`TWSE API` ➔ `rawPbData` ➔ `archiveManager` (寫入快取) ➔ `dailyCheck.mjs` (讀出) ➔ 交給 `strategyEngine` 評估風控 ➔ `aiDataPreprocessor` (結構化文字) ➔ `Investment Coach (AI)` 輔助判定。

---

## 📌 【指標擴充類】2. 加入大盤 PE（本益比）指標（已完成尚未人工驗證）
### 功能目標
搭配 PB 一同服用。PE 能捕捉「大盤獲利是否有跟上估值」，主要用來防範無基之彈（資金行情推升但企業獲利衰退）。當市場位處高點但 PE 處於相對低檔時，可能代表企業獲利爆發（如 AI 浪潮），此時教練代理人就不會過早要求持有者下車。

### 影響範圍
完全疊合 PB 增加的路徑：`providers` ➔ `archiveManager` ➔ `preprocessor` ➔ `aiCoach`。

### 實作步驟草案 (Step-by-Step)
1. 在實作 PB 抓取函式的同時，一併將 PE (Price-to-Earnings Ratio) 欄位解析回來。
2. 於 `aiDataPreprocessor.mjs` 中，結合 PE 與 PB 產出一段 **「大盤估值綜合狀態」**（例如：`PB 2.1 高估 / PE 15 合理 ➔ 有基之彈，無需極度恐慌`）。
3. 修改 prompt 裡的 `<Macro_And_Chip_Status>` 說明，讓 AI 教練能在思考區塊 (`coach_internal_thinking`) 正確解析這兩項數字的連動關係。
4. 在 Telegram 戰報介面上，與 PB 放於同一行呈現。

### 潛在挑戰與防禦機制
- **EPS 空窗期的失真**：由於企業獲利為季報遞遲公布，而在景氣谷底時，EPS 若大崩盤會導致 PE 在低檔反而看起來暴增（假性昂貴）。
- **防禦機制**：系統不該將 PE 單獨寫死為量化引擎的「絕對賣出訊號」，而是僅作為**「供 AI 教練參考的總體經濟 Context」**。將判讀失真的責任交由 AI 大腦搭配國發會燈號進行統合判定。

### 資料流設計
與 PB 相同，在 `marketData.mjs` 打包出 `valuationInfo: { PB, PE }` ➔ 存入 `latest.json` ➔ `formatMacroChipForCoach()` 轉成人類易讀文案 ➔ 推給 `Investment Coach`。

---

## 📌 【AI 管線優化類】3. 新聞關鍵字（Keywords）優化
### 🎯 功能目標

提高 RSS 新聞搜尋精準度，過濾地方社會新聞與農場 SEO 文章，讓 Search Queries Generator 能產出長尾、高價值的查詢陣列。

**量化驗收標準：**

- 每次執行有效新聞數（過濾後）≥ 10 篇
- Fallback 觸發率（可從 `fallbackLog` 追蹤）< 20%
- AI 動態關鍵字格式驗證通過率 = 100%（不合格直接捨棄，不觸發 Error）

---

### 📁 影響檔案

| 檔案 | 異動類型 | 說明 |
|---|---|---|
| `src/modules/ai/prompts.mjs` | 修改 | Few-Shot Prompt 優化 |
| `src/modules/newsFetcher.mjs` | 修改 | 流程整合、Fallback 邏輯 |
| `src/config/keywordConfig.mjs` | **新增** | 集中管理所有關鍵字清單 |

---

### 📐 關鍵字資料結構（Schema 定義）

所有關鍵字（靜態 + 動態）必須統一格式：

```typescript
type SearchType = "intitle" | "broad";

interface KeywordEntry {
  keyword: string;        // 查詢字串，可含空格（多字詞）
  searchType: SearchType; // "intitle" = 標題必含；"broad" = 廣泛匹配
}
```

**Google News RSS 轉換規則：**

- `searchType === "intitle"` → URL 加上 `intitle:` 前綴
- `searchType === "broad"` → 直接使用 keyword 原文

---

### 📦 Step 1：建立 keywordConfig.mjs（新增檔案）

將以下所有靜態資料集中到 `src/config/keywordConfig.mjs`，避免分散在 `newsFetcher.mjs` 中難以維護。

#### 1-1 台灣市場靜態基礎關鍵字池

```js
export const baseTwQueries = [
  // ── 核心標的（intitle 確保主角是它們）──────────────────
  { keyword: "台股",        searchType: "intitle" },
  { keyword: "大盤",        searchType: "intitle" },
  { keyword: "台積電 法說", searchType: "intitle" }, // 法說才有訊息量
  { keyword: "台積電 ADR",  searchType: "intitle" }, // 美股夜盤訊號
  { keyword: "台積電 外資", searchType: "intitle" }, // 籌碼訊號

  // ── 資金與籌碼面 ─────────────────────────────────────
  { keyword: "外資",        searchType: "broad" },
  { keyword: "三大法人",    searchType: "broad" }, // 投信+自營+外資綜合
  { keyword: "融資 融券",   searchType: "broad" }, // 散戶槓桿水位
  { keyword: "集中度 籌碼", searchType: "broad" }, // 主力控盤觀察
  { keyword: "國安基金",    searchType: "broad" }, // 護盤訊號

  // ── 貨幣政策與流動性 ─────────────────────────────────
  { keyword: "央行",        searchType: "broad" },
  { keyword: "升息 降息",   searchType: "broad" }, // 利率方向
  { keyword: "新台幣",      searchType: "broad" }, // 匯率 = 外資動向指標

  // ── 基本面與經濟環境 ─────────────────────────────────
  { keyword: "通膨",        searchType: "broad" },
  { keyword: "出口",        searchType: "broad" },
  { keyword: "外銷訂單",    searchType: "broad" }, // 台灣領先指標
  { keyword: "景氣燈號",    searchType: "broad" }, // 官方景氣判斷
  { keyword: "PMI",         searchType: "broad" }, // 製造業景氣
];
```

#### 1-2 美國市場靜態基礎關鍵字池

```js
export const baseUsQueries = [
  // ── 核心指數（intitle）────────────────────────────────
  { keyword: "S&P 500",         searchType: "intitle" },
  { keyword: "Nasdaq",          searchType: "intitle" },
  { keyword: "CPI",             searchType: "intitle" },
  { keyword: "Dow Jones",       searchType: "intitle" }, // 道瓊代表傳產

  // ── 貨幣政策與重要人物 ───────────────────────────────
  { keyword: "Federal Reserve", searchType: "broad" },
  { keyword: "Fed",             searchType: "broad" },
  { keyword: "Powell",          searchType: "broad" },
  { keyword: "FOMC",            searchType: "broad" }, // 利率會議直接觸發

  // ── 資金流動性 ───────────────────────────────────────
  { keyword: "Treasury yields", searchType: "broad" }, // 殖利率是股市之錨
  { keyword: "dollar index",    searchType: "broad" }, // 美元強弱 = 新興市場資金
  { keyword: "credit spread",   searchType: "broad" }, // 信用風險溫度計
  { keyword: "liquidity",       searchType: "broad" }, // 流動性危機偵測

  // ── 總經指標 ─────────────────────────────────────────
  { keyword: "inflation",       searchType: "broad" },
  { keyword: "payrolls",        searchType: "broad" },
  { keyword: "recession",       searchType: "broad" },
  { keyword: "GDP",             searchType: "broad" },           // 成長率直接指標
  { keyword: "jobless claims",  searchType: "broad" }, // 每週就業先行指標
  { keyword: "ISM",             searchType: "broad" }, // 製造業/服務業景氣
];
```

#### 1-3 RSS Query 層級排除關鍵字

> 這些關鍵字在 `buildRssUrl()` 時直接加入 `-keyword` 或 `-intitle:keyword`，在 RSS 回傳前就排除，減少無效 API 呼叫。

```js
export const twExcludeKeywords = [
  { keyword: "排行",     searchType: "intitle" }, // 各類排行文
  { keyword: "日法人",   searchType: "intitle" }, // 每日法人買賣超
  { keyword: "即時新聞", searchType: "intitle" }, // 即時新聞整理
  { keyword: "買超個股", searchType: "intitle" }, // 個股買超整理
  { keyword: "賣超個股", searchType: "intitle" }, // 個股賣超整理
  { keyword: "前十大",   searchType: "intitle" },
];

export const usExcludeKeywords = [
  { keyword: "Q1 Earnings",       searchType: "intitle" }, // 個股財報
  { keyword: "Q2 Earnings",       searchType: "intitle" },
  { keyword: "Q3 Earnings",       searchType: "intitle" },
  { keyword: "Q4 Earnings",       searchType: "intitle" },
  { keyword: "price target",      searchType: "broad" },   // 個股目標價調整
  { keyword: "stock forecast",    searchType: "broad" },   // 個股預測文
  { keyword: "Liquidity Pulse",   searchType: "broad" },   // Stock Traders Daily 垃圾文
  { keyword: "Liquidity Mapping", searchType: "broad" },   // 同上
  { keyword: "Powell Industries", searchType: "intitle" }, // 個股誤抓 Fed Powell
];
```

#### 1-4 來源黑名單（在 RSS 結果層過濾）

```js
export const twExcludedSources = [
  "富聯網", "Bella.tw儂儂", "信報網站",
  "Sin Chew Daily", "AASTOCKS.com",
  "FXStreet", "Exmoo", "facebook.com",
];

export const usExcludedSources = [
  "Stock Traders Daily", "baoquankhu1.vn",
  "International Supermarket News", "AASTOCKS.com",
  // 印度媒體
  "The Economic Times", "Devdiscourse", "Tribune India",
  "ANI News", "India TV News", "The Financial Express",
  "Moneycontrol.com", "The Hans India", "Mint",
  // 澳洲/紐西蘭媒體
  "NZ Herald", "Otago Daily Times", "Finimize",
  "investordaily.com.au", "The Australian",
  // 非相關地區媒體
  "Economy Middle East", "LEADERSHIP Newspapers",
  "Punch Newspapers", "Joburg ETC", "Eunews",
  "European Commission", "BusinessToday Malaysia",
  "Human Resources Online", "Tornos News",
  "Royal Gazette | Bermuda", "AD HOC NEWS",
  "simplywall.st", "MarketBeat", "parameter.io",
  "Stock Titan", "Truthout", "inkorr.com", "ANSA",
  "Yahoo! Finance Canada", "صحيفة مال", "Arab News PK",
  "Investing.com UK", "Yahoo Finance UK",
  "markets.businessinsider.com", "ruhrkanal.news",
  "agoranotizia.it", "facebook.com",
];
```

#### 1-5 標題 Regex 黑名單（最後一層防線）

```js
export const titleBlackListPatterns = [
  /Liquidity (Pulse|Mapping) .*(Institutional|Price Events)/i,
  /\bon Thin Liquidity,? Not News\b/i,
  /Powell Industries/i,
  /ISM.*(University|Saddle|Bike|Supermarket|Rankings|Dhanbad)/i,
  /India.*(GDP|growth forecast|economy)/i,
  /GDP.*(India|FY2[67]|FY'2[67])/i,
  /(Belize|Oman|Estonia|Bulgaria|Romania|Nigeria|Uzbekistan|Scotland|Portugal|UAE|Bahrain|Gisborne|Otago|Italy|Pakistan|Caricom|South Africa|SA's GDP).*(GDP|\beconomy\b)/i,
  /GDP.*(Belize|Oman|Estonia|Bulgaria|Romania|Nigeria|Uzbekistan|Scotland|Portugal|UAE|Bahrain|Gisborne|Otago|Italy|Pakistan)/i,
  /\b(RBA|Reserve Bank of Australia|ASX 200|Australian (stocks?|shares?|economy))\b/i,
  /\b(fiancé|engagement|wedding ring|jealous)\b/i,
  /recession-proof stock/i,
  /FTSE 100/i,
  /\d+ inflation-resistant stock/i,
  /(Fed Watch|Fed Meeting|Fed Impact|Treasury Yields:|Volatility Watch|Aug Action|Aug Fed Impact):.*stock.*(–|-)/i,
  /\bBrexit\b/i,
  /小資.{0,10}入場.{0,15}(ETF|[A-Z0-9]{4,6}[AB]?)/,
  /統一推|推出.{0,5}(ETF|[A-Z0-9]{4,6}[AB]?).{0,10}(升級|布局|主動)/,
  /盤[前中後]分析/,
  /盤[前中後]》?[\s\S]{0,5}分析/,
  /處置股.{0,10}(誕生|關到|今日起)/,
  /(最高價|漲停板).{0,10}處置/,
];
```

---

### 🤖 Step 2：Few-Shot Prompt 優化（prompts.mjs）

#### AI 輸出格式要求

AI 必須輸出 JSON array，每個元素遵循 `KeywordEntry` schema：

```json
[
  { "keyword": "Fed rate cut expectations", "searchType": "broad" },
  { "keyword": "TSMC revenue guidance",     "searchType": "intitle" }
]
```

**限制條件（寫入 Prompt）：**

- 每組 `keyword`：2–4 個單字，**禁止單一縮寫詞**（不得輸出 `"CPI"`，要輸出 `"CPI data release"`）
- `searchType` 選擇原則：
  - `"intitle"`：當你要確保標題主角是該事件（如法說、財報）
  - `"broad"`：當你要廣泛捕捉市場輿論（如通膨、流動性）
- 輸出數量：**6–8 組，不可超過 8 組**
- 禁止重複 `baseTwQueries` / `baseUsQueries` 已有的關鍵字

#### Few-Shot 範例對照表（寫入 NEWS_KEYWORD_SYSTEM_PROMPT）

```
❌ 壞範例（禁止輸出）：
  { "keyword": "CPI",            "searchType": "broad" }   // 單字縮寫，雜訊極高
  { "keyword": "stocks",         "searchType": "broad" }   // 過於泛用
  { "keyword": "market",         "searchType": "broad" }   // 無任何訊息量
  { "keyword": "Powell",         "searchType": "intitle" } // 重複靜態池
  { "keyword": "降息概念股 推薦", "searchType": "broad" }  // 農場 SEO 特徵

✅ 好範例（模仿此風格）：
  { "keyword": "CPI data release market reaction",   "searchType": "broad" }
  { "keyword": "Fed balance sheet reduction",        "searchType": "broad" }
  { "keyword": "TSMC earnings guidance",             "searchType": "intitle" }
  { "keyword": "Taiwan export orders semiconductor", "searchType": "intitle" }
  { "keyword": "dollar index emerging market risk",  "searchType": "broad" }
  { "keyword": "yield curve inversion recession",    "searchType": "broad" }
```

---

### ⚙️ Step 3：newsFetcher.mjs 流程整合

#### 3-1 buildRssUrl()（整合 excludeKeywords 進 query string）

```js
function buildRssUrl(entry, excludes) {
  const q = entry.searchType === "intitle"
    ? `intitle:"${entry.keyword}"`
    : entry.keyword;

  // 將 excludeKeywords 整合進 RSS query（-keyword 語法，減少無效請求）
  const excludePart = excludes
    .map(e => e.searchType === "intitle"
      ? `-intitle:"${e.keyword}"`
      : `-"${e.keyword}"`)
    .join(" ");

  const fullQuery = `${q} ${excludePart}`.trim();
  return `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
}
```

#### 3-2 AI 動態關鍵字 Schema 驗收

```js
function validateDynamicKeyword(entry) {
  if (!entry?.keyword || !entry?.searchType) return false;
  if (!["intitle", "broad"].includes(entry.searchType)) return false;
  const words = entry.keyword.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;          // 強制多字詞
  if (words.length === 1 && /^[A-Z]{2,5}$/.test(words[0])) return false; // 禁純縮寫
  return true;
}
```

#### 3-3 Static ∪ Dynamic 合併策略

```js
function mergeKeywords(baseQueries, dynamicEntries) {
  const baseSet = new Set(baseQueries.map(e => e.keyword.toLowerCase()));
  const valid = dynamicEntries
    .filter(validateDynamicKeyword)
    .filter(e => !baseSet.has(e.keyword.toLowerCase())) // 去重複
    .slice(0, 8);                                        // 動態上限 8 組
  return [...baseQueries, ...valid];
}
// 合併後最大數量：baseTW(18) + baseUS(18) + dynamic(≤8) = 上限 44 組
```

#### 3-4 文章有效性過濾（雙層）

```js
function isArticleValid(article, excludedSources, blacklistPatterns) {
  // Layer 1：來源黑名單
  if (excludedSources.some(s => article.source?.includes(s))) return false;
  // Layer 2：標題 Regex 黑名單
  if (blacklistPatterns.some(re => re.test(article.title))) return false;
  return true;
}
```

#### 3-5 Fallback 機制

```js
const FALLBACK_THRESHOLD = 5; // 可依 fallbackLog 歷史資料調整

if (validArticles.length < FALLBACK_THRESHOLD) {
  // 記錄觸發日誌（方便追蹤 AI 品質）
  fallbackLog.push({
    timestamp: new Date().toISOString(),
    dynamicKeywords: dynamicEntries.map(e => e.keyword),
    validCount: validArticles.length,
    triggered: true,
  });

  // Fallback 策略：直接復用完整 base 清單，不另建清單
  // 若 TW/US 分開不足，則針對不足的市場單獨補抓
  const fallbackArticles = await fetchWithQueries(baseQueries, excludes);
  validArticles = dedup([...validArticles, ...fallbackArticles]);
}
```

---

### 🔁 完整資料流

```
marketStatus
  { regime: "bull" | "bear" | "neutral", vixLevel: number, date: string }
  ↓
GenerateSearchQueries（AI）
  輸出：KeywordEntry[]（JSON array）
  ↓
Schema 驗收（validateDynamicKeyword）
  不合格 → 靜默捨棄，不 throw Error
  ↓
mergeKeywords（baseTwQueries + baseUsQueries ∪ validDynamic）
  ↓
buildRssUrl（excludeKeywords 已整合進 query string）
  批次呼叫：每批 5 組，間隔 300ms（防 Google News rate limit）
  ↓
isArticleValid 過濾
  Layer 1：excludedSources（來源黑名單）
  Layer 2：titleBlackListPatterns（Regex 標題過濾）
  ↓
有效新聞數 < 5？
  是 → 記錄 fallbackLog，補充 base 清單重跑一輪
  否 → 繼續
  ↓
去重管線
  Key：URL（主）+ 標題 hash（副）
  ↓
輸出乾淨新聞陣列 → 進入摘要 AI 管線
```

---

### 📝 開發注意事項（給 antigravity）

1. **不要重新發明 Schema**：所有關鍵字物件統一使用 `{ keyword: string, searchType: "intitle" | "broad" }`，AI 輸出、靜態池、Fallback 全部遵循同一格式。

2. **`excludeKeywords` 優先整合進 RSS URL**，而不是抓取後再過濾，可節省 HTTP 請求次數。

3. **Fallback 不另建清單**，直接復用 `baseTwQueries` / `baseUsQueries`，避免日後維護兩份清單造成語義漂移。

4. **`titleBlackListPatterns` 放在 `keywordConfig.mjs`**，未來新增黑名單規則只需改一個檔案。

5. **`fallbackLog` 格式固定**，方便後續用 log 分析調整 `FALLBACK_THRESHOLD`。

6. **批次呼叫間距設 300ms**，Google News RSS 在連續 10+ 次請求後容易回傳空結果。

---

## 📌 【AI 管線優化類】4. 新聞過濾機制優化（自動反向優化黑名單）
### 功能目標
打造具備「自我進化能力 (Self-Healing)」的新聞濾網機制。讓系統像真人一樣，若昨天被特定農場來源或假新聞騙了，今天能自動檢討，並生成新的 Regex 黑名單供未來防禦。

### 影響範圍
- `src/modules/newsFetcher.mjs` (切離 config)
- `src/config/blacklist.json` (新增此動態設定檔)
- `src/modules/ai/` (新增 `ruleOptimizerAgent.mjs`)
- `src/runDailyCheck.mjs` (或建立非同步/半夜運作的維護排程)

### 實作步驟草案 (Step-by-Step)
1. **設定檔外部化**：將 `twExcludedSources`（如 Yahoo、Yahoo奇摩理財）與 `usExcludeKeywords` 的黑名單字串從程式碼死區抽出，移至 `config/blacklist.json`。
2. **建立 Optimizer Agent**：設計一個全新的 Agent。將「昨日被 Filter Agent 放行的所有新聞」交給 Optimizer Agent 審核，Prompt：_「請嚴格審查這批新聞，揪出裡頭隱藏的農場文或個股無用新聞，並提煉出能通殺這類標題的 Regex 語法或來源名稱。」_
3. **新舊規則合併**：將 Optimizer Agent 輸出的新 Regex 附加回 `blacklist.json` 中。
4. **管線掛載**：隔日的 `newsFetcher.mjs` 啟動時動態 `import` 或讀取 `blacklist.json`，讓新規則自動生效。

### 潛在挑戰與防禦機制
- **AI 寫錯 Regex 導致大誤殺**：若 AI 寫出 `.*` 或是過於廣泛的關鍵字（如「台灣」），會導致整個新聞管線癱瘓，什麼重磅新聞都抓不到。
- **針對性的沙盒防護 (Sandbox Validation)**：
  1. AI 產出的新 Regex，在存寫進 `blacklist.json` 之前，必須經過 JavaScript 原生防呆編譯測試 `try { new RegExp(aiRule) } catch { 忽略 }`。
  2. 設計一組固定不變的「黃金標準新聞清單 (Golden DataSet)」（例如 Fed 升息報告、台積電法說會）。新 Regex 必須先套用於此清單，若**誤殺**了黃金清單的任何一條新聞，該新規則將被強制作廢，拒絕寫入。

### 資料流設計
今日被放行上榜的新聞記錄 ➔ 傳送給 `Rule Optimizer (AI)` ➔ 揪出漏網之魚農場文 ➔ 生成對應 `<New_Regex>` ➔ **沙盒驗證環境 (Sandbox)** 用黃金資料集碰撞 ➔ 若無誤殺則 `fs.writeFileSync` 更新 `blacklist.json` ➔ 隔日 `newsFetcher` 讀取並應用更強的防護罩。

## 📌 【系統巡檢與測試類】5. 自動化格式與結構驗證機制 (Schema & Format Validation)
### 功能目標
透過程式規則（Rule-based）自動攔截並評估 AI 輸出的結構穩定度，包含驗證 JSON 解析是否成功，以及特定 Markdown 區塊的完整性。結果將回傳至 Langfuse 的 `Schema_Validation` 與 `Format_Compliance`。

### 影響範圍
- `src/modules/ai/aiClient.mjs` (負責呼叫 Google GenAI 與 Langfuse SDK 初始化的檔案)

### 實作步驟草案 (Step-by-Step)
1. **建立 Validator 邏輯**：在 `aiClient.mjs` 的 `callGemini` 函式中，整合針對 AI 回傳字串的清理函式與驗證機制。
2. **攔截與解析**：目前 `callGemini` 已有基礎字串清理，我們將利用 `try-catch` 包覆 `JSON.parse()`。
3. **錯誤處理與評分**：將評分邏輯寫在 `aiClient.mjs` 統一攔截層中（若 `options.responseMimeType` 為 JSON）。成功則不處理，失敗則給予 Score = 0。
4. **非同步寫入**：利用現有的 `generation.score()` 將對應的結果綁定至該次執行，並使用不被 await 的 Promise (Fire-and-Forget) 進行異步寫入以避免延遲主流程。

### 潛在挑戰與防禦機制
- **挑戰**：AI 輸出 JSON 時可能帶有無效字元，導致 `JSON.parse` 拋出例外中斷主流程。
- **防禦**：評估機制絕對不可阻塞主業務邏輯。發生解析錯誤時，應靜默捕捉例外 (Catch Exception)，標記評分為 0 後再觸發原有的 Retry 機制。

### 資料流設計
`Raw LLM Response` ➔ `String Cleaner` ➔ `JSON.parse` ➔ `Generate boolean/numeric Score` ➔ `generation.score()` ➔ `Return Parsed Object`

---

## 📌 【系統巡檢與測試類】6. 關鍵字搜尋良率計算 (Keyword Yield Rate)
### 功能目標
建立搜尋生成器（Search Queries Generator）的量化指標，計算「實際抓取到有效新聞的 Query 數」與「總生成 Query 數」的比例，藉此評估關鍵字是否精準。

### 影響範圍
- `src/modules/ai/aiCoach.mjs` (`generateDailySearchQueries` 函式)
- `src/modules/newsFetcher.mjs` (`getRawNews` 函式)

### 實作步驟草案 (Step-by-Step)
1. **計數器實作**：在 `generateDailySearchQueries` 產出關鍵字陣列時，紀錄生成的 Query 總數。
2. **有效回傳判定**：在 `getRawNews` 中，比對 `batch` 查詢條件送入 `rss-parser` 抓取後，經由 `prepareNewsForAI` 放行的新聞數量。若有抓到新聞，則將對應的 Query 記為「有效」。
3. **計算良率**：`有效 Query 的數量 / 總生成 Query 數量`。
4. **綁定 Generation**：運用 Langfuse Client，將算出的良率非同步寫回對應 `generateDailySearchQueries` 的 `generationId` 做數據追蹤。

### 潛在挑戰與防禦機制
- **挑戰**：若 Google News RSS 限流（Rate Limit）或網路超時，會導致良率被誤判為 0。
- **防禦**：需區分「找不到新聞（正常）」與「請求失敗（系統異常）」。若發生 `fetchRssFeed` 例外錯誤，應排除該分母，跳過該次良率打分，避免數據污染。

### 資料流設計
`Keyword Array` ➔ `newsFetcher` (批次打 Google News RSS) ➔ `Count Valid Results` ➔ `Math: valid / total` ➔ `Langfuse Client (.score)`

---

## 📌 【系統巡檢與測試類】7. 新聞維度多樣性評估 (Diversity Score)
### 功能目標
驗證雜訊過濾器（News Filter）輸出的 15 篇新聞，是否涵蓋了預設的宏觀維度（如總經、半導體、地緣等），並計算覆蓋率上傳至 Langfuse。

### 影響範圍
- `src/modules/ai/aiCoach.mjs` (`filterAndCategorizeAllNewsWithAI` 函式)

### 實作步驟草案 (Step-by-Step)
1. **提取維度屬性**：利用該函式中 `aiResult.think.dimension_check` 或直接 map 每篇保留新聞的維度。
2. **計算不重複維度**：使用 `new Set()` 蒐集目前陣列內不重複的維度名稱。
3. **計算覆蓋率與上傳**：計算 `Set().size / Expected_Dimension_Count`（例如規劃 5 種維度即除以 5），結果透過 `generation.score()` 非同步回寫。

### 潛在挑戰與防禦機制
- **挑戰**：LLM 可能會產生幻覺，發明不在標準列表內的錯誤維度名稱。
- **防禦**：在程式內定義嚴格的維度白名單，放入 Set 前先濾除非白名單字串。

### 資料流設計
`Filtered News Array` ➔ `map(article => article.dimension)` ➔ `Filter by Whitelist` ➔ `new Set()` ➔ `Calculate Coverage Ratio` ➔ `Langfuse Client (.score)`

---

## 📌 【系統巡檢與測試類】8. 多空邏輯一致性自動檢測 (Logic Consistency)
### 功能目標
自動比對總經分析師（Macro Analyst）給出的新聞評分總和，與最終得出的 BULL/BEAR/NEUTRAL 結論方向是否一致，以檢測 AI 推論邏輯是否矛盾。

### 影響範圍
- `src/modules/ai/aiCoach.mjs` (`analyzeMacroNewsWithAI` 函式)

### 實作步驟草案 (Step-by-Step)
1. **分數比對**：擷取生成的 `total_bull_score` 和 `total_bear_score`。
2. **門檻定義**：定義基本判讀邏輯，例如 `total_bull_score > total_bear_score` 偏向 BULL，反之 BEAR；極為接近時為 NEUTRAL。
3. **結論檢驗**：將比對結果與 `conclusion.market_direction` 交叉檢驗。完全吻合給 5 分，反向給 1 分，些微偏差（例如分數偏牛但結論是中立）給 3 分。
4. **寫入評分**：將邏輯檢測結果上傳至 Langfuse。

### 潛在挑戰與防禦機制
- **挑戰**：遇到極端重大事件時，單一事件的極高權重影響可能無法單純用語意上的加總數字來反映，導致 AI 給出的結論與總分相悖。
- **防禦**：判斷機制不影響原有決策，僅做 Langfuse 打分參考；若頻繁出現矛盾，可修改 Agent 的 Prompt 以優化打分權重，或透過紀錄後續修正算分邏輯。

### 資料流設計
`analyzeMacroNewsWithAI Result` ➔ `Compare (total_bull_score & total_bear_score)` ➔ `Check vs conclusion.market_direction` ➔ `Score Mapping (1/3/5)` ➔ `Langfuse Client (.score)`

---

## 📌 【AI 管線優化類】9. LLM-as-a-Judge: 建議可執行性與語氣評估 (Actionability & Tone)
### 功能目標
建立一個背景非同步機制，使用較低成本的 LLM 作為裁判，評估投資教練輸出的建議是否具體且符合教練語氣。

### 影響範圍
- `src/modules/ai/aiCoach.mjs` (`getAiInvestmentAdvice` 函式)
- `src/modules/ai/prompts.mjs` (Judge Prompt 管理)

### 實作步驟草案 (Step-by-Step)
1. **抽樣機制**：為了控制 API 成本，使用 `Math.random() < 0.2` (20% 機率) 控制呼叫 Judge 的頻率。
2. **觸發背景任務**：因專案為定期執行（`dailyCheck.mjs` 會在主流程執行完後結束 Promise），建議在 `dailyCheck.mjs` 最外層加上背景任務等待佇列 (Promise List)，或直接掛載非阻擋式 Promise，但在 `process.exit` 之前確保它們完成 (如 `Promise.allSettled`)。
3. **執行 Judge Prompt**：將教練輸出結果丟給輕量模型評估語氣標準。
4. **回寫評分**：將得到的評分綁定回原始的 `traceId` 寫入 Langfuse。

### 潛在挑戰與防禦機制
- **挑戰**：背景非同步任務如果在主流程立刻終止時被系統砍掉，會導致打分遺失。且 Judge 本身 API 呼叫如果過慢會拖累甚至報錯。
- **防禦**：Judge 的 API 呼叫必須給予嚴苛的 Timeout；主流程可透過一個全域的全非同步陣列 (`global.asyncTasks = []`) 來蒐集這些 Promise，並在退出前 `await Promise.allSettled(global.asyncTasks)`。

### 資料流設計
`getAiInvestmentAdvice Output` ➔ `Sampling Check` ➔ `Push to global.asyncTasks` ➔ `LLM Judge Request` ➔ `Langfuse Client (.score)`

---

## 📌 【系統巡檢與測試類】10. 導入自動化單元測試與 Mock 機制 (Automated Testing Framework)
### 功能目標
導入主流測試框架（建議 Jest 或 Vitest），針對既有的資料解析與字串清理等函式撰寫首批單元測試，確保未來大幅修改程式時不會破壞既有邏輯。

### 影響範圍
- `package.json` (新增 `test` 與依賴)
- `src/test/` (新增測試目錄與檔案，如 `src/test/utils.test.js`)
- `src/utils/coreUtils.mjs`, `src/modules/ai/aiDataPreprocessor.mjs` (測試標的)

### 實作步驟草案 (Step-by-Step)
1. **環境建置**：安裝 Jest/Vitest 並設定測試環境。
2. **Mock 資料蒐集**：收集過去錯誤的畸形 JSON 與特殊的 Prompt 回傳字串，當作 Mock payload。
3. **撰寫首批測試**：針對純函式撰寫測試，驗證邊界條件轉換是否正確。
4. **Mock 機制攔截 API**：使用 `jest.mock("@google/genai")` 攔截 `aiClient.mjs` 對外的網路請求。

### 潛在挑戰與防禦機制
- **挑戰**：對既有高耦合模組測試可能無意間戳到對外 API。
- **防禦**：於測試環境下嚴格禁用 `process.env.GEMINI_API_KEY1` 系列變數（改用假金鑰），若 Mock 失敗就會立刻阻擋真正的 HTTP 請求，確保測試不出錯且完全免費。

### 資料流設計
`Test Runner (npm run test)` ➔ `載入 src/test/*.test.js` ➔ `Mock 外部 API Module` ➔ `傳遞 Mock payload 至核心函式` ➔ `Assert 輸出正確性`
