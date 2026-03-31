## 📌 【AI 管線優化類】任務 3：新聞關鍵字（Keywords）優化(已完成待驗證)

> **版本：** v2.2（含 Plan 4 架構預留）  
> **目標讀者：** AI Agent antigravity

---

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
| `src/config/keywordConfig.mjs` | **新增** | 靜態關鍵字池 + 動態黑名單讀取接口 |
| `src/config/blacklist.json` | **新增** | 黑名單設定檔（seed 初始化，供任務 4 動態寫入） |

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

### ⚙️ Step 1：建立 keywordConfig.mjs（新增檔案）

此檔案分為兩個區塊：

1. **靜態關鍵字池**（`baseTwQueries`、`baseUsQueries`、`excludeKeywords`）— 寫死在 JS，人工維護
2. **動態黑名單讀取接口**（`loadBlacklist()`）— 從 `blacklist.json` 讀取，預留給任務 4 的 AI 寫入

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
  { keyword: "GDP",             searchType: "broad" },          // 成長率直接指標
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

#### 1-4 動態黑名單讀取接口（預留給任務 4）

> ⚠️ `loadBlacklist()` 從 `blacklist.json` 讀取，任務 3 開發時就應使用此接口，**不可**將黑名單 `export const` 寫死在此檔案中，確保任務 4 開發時無需重構。

```js
import { readFileSync } from "fs";
import { resolve } from "path";

export function loadBlacklist() {
  const filePath = resolve("src/config/blacklist.json");
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  return {
    titlePatterns:     data.titlePatterns.map(r => new RegExp(r.pattern, r.flags)),
    twExcludedSources: data.twExcludedSources,
    usExcludedSources: data.usExcludedSources,
  };
}
```

---

### ⚙️ Step 2：建立 blacklist.json（seed 初始化）

> 此檔案由任務 3 **建立並初始化**，由任務 4 負責後續的 AI 動態 append。任務 3 只負責將現有黑名單以 `addedBy: "seed"` 寫入，不實作寫入邏輯。

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-03-28T00:00:00Z",
  "titlePatterns": [
    { "pattern": "Liquidity (Pulse|Mapping) .*(Institutional|Price Events)", "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "\\bon Thin Liquidity,? Not News\\b",                   "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "Powell Industries",                                         "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "ISM.*(University|Saddle|Bike|Supermarket|Rankings|Dhanbad)", "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "India.*(GDP|growth forecast|economy)",                      "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "GDP.*(India|FY2[67]|FY'2[67])",                            "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "\\b(RBA|Reserve Bank of Australia|ASX 200|Australian (stocks?|shares?|economy))\\b", "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "\\b(fiancé|engagement|wedding ring|jealous)\\b",        "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "recession-proof stock",                                      "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "FTSE 100",                                                   "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "\\d+ inflation-resistant stock",                           "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "\\bBrexit\\b",                                           "flags": "i", "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "小資.{0,10}入場.{0,15}(ETF|[A-Z0-9]{4,6}[AB]?)",           "flags": "",  "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "盤[前中後]分析",                                             "flags": "",  "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "處置股.{0,10}(誕生|關到|今日起)",                            "flags": "",  "addedBy": "seed", "addedAt": "2026-03-28" },
    { "pattern": "(最高價|漲停板).{0,10}處置",                                 "flags": "",  "addedBy": "seed", "addedAt": "2026-03-28" }
  ],
  "twExcludedSources": [
    "富聯網", "Bella.tw儂儂", "信報網站",
    "Sin Chew Daily", "AASTOCKS.com",
    "FXStreet", "Exmoo", "facebook.com"
  ],
  "usExcludedSources": [
    "Stock Traders Daily", "baoquankhu1.vn",
    "International Supermarket News", "AASTOCKS.com",
    "The Economic Times", "Devdiscourse", "Tribune India",
    "ANI News", "India TV News", "The Financial Express",
    "Moneycontrol.com", "The Hans India", "Mint",
    "NZ Herald", "Otago Daily Times", "Finimize",
    "investordaily.com.au", "The Australian",
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
    "agoranotizia.it", "facebook.com"
  ]
}
```

---

### 🤖 Step 3：Few-Shot Prompt 優化（prompts.mjs）

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

### ⚙️ Step 4：newsFetcher.mjs 流程整合

#### 4-1 buildRssUrl()（整合 excludeKeywords 進 query string）

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

#### 4-2 AI 動態關鍵字 Schema 驗收

```js
function validateDynamicKeyword(entry) {
  if (!entry?.keyword || !entry?.searchType) return false;
  if (!["intitle", "broad"].includes(entry.searchType)) return false;
  const words = entry.keyword.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (words.length === 1 && /^[A-Z]{2,5}$/.test(words[0])) return false;
  return true;
}
```

#### 4-3 Static ∪ Dynamic 合併策略

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

#### 4-4 文章有效性過濾（雙層）

```js
// 呼叫前先載入最新黑名單
import { loadBlacklist } from "../config/keywordConfig.mjs";
const { titlePatterns, twExcludedSources, usExcludedSources } = loadBlacklist();

function isArticleValid(article, excludedSources, blacklistPatterns) {
  // Layer 1：來源黑名單（來自 blacklist.json）
  if (excludedSources.some(s => article.source?.includes(s))) return false;
  // Layer 2：標題 Regex 黑名單（來自 blacklist.json）
  if (blacklistPatterns.some(re => re.test(article.title))) return false;
  return true;
}
```

#### 4-5 Fallback 機制

```js
const FALLBACK_THRESHOLD = 5; // 可依 fallbackLog 歷史資料調整

if (validArticles.length < FALLBACK_THRESHOLD) {
  fallbackLog.push({
    timestamp:       new Date().toISOString(),
    dynamicKeywords: dynamicEntries.map(e => e.keyword),
    validCount:      validArticles.length,
    triggered:       true,
  });
  // Fallback：直接復用完整 base 清單，不另建清單
  const fallbackArticles = await fetchWithQueries(baseQueries, excludes);
  validArticles = dedup([...validArticles, ...fallbackArticles]);
}
```

#### 4-6 passedArticlesLog（預留給任務 4）

> ⚠️ 任務 3 必須實作此日誌，任務 4 的 Optimizer Agent 依賴此輸出作為審查輸入。

```js
// 每次管線執行結束後，將放行的文章記錄至 passedArticlesLog
const passedArticlesLog = {
  date:     new Date().toISOString().slice(0, 10),
  articles: validArticles.map(a => ({ title: a.title, source: a.source, url: a.url })),
};
// 寫入 logs/passedArticles-YYYY-MM-DD.json
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
isArticleValid 過濾（黑名單來自 blacklist.json）
  Layer 1：excludedSources
  Layer 2：titlePatterns（Regex）
  ↓
有效新聞數 < 5？
  是 → 記錄 fallbackLog，補充 base 清單重跑一輪
  否 → 繼續
  ↓
去重管線（key：URL 主 + 標題 hash 副）
  ↓
寫入 passedArticlesLog（供任務 4 使用）
  ↓
輸出乾淨新聞陣列 → 進入摘要 AI 管線
```

---

### 📝 開發注意事項（給 antigravity）

1. **黑名單不可寫死在 `keywordConfig.mjs`**，必須全部放入 `blacklist.json`，透過 `loadBlacklist()` 讀取，這是任務 4 能夠無縫接軌的關鍵。

2. **`baseTwQueries` / `baseUsQueries` / `excludeKeywords` 維持靜態**，這三者由人工維護，不參與任務 4 的 AI 動態寫入流程。

3. **`passedArticlesLog` 是任務 4 的唯一輸入來源**，格式需固定（`title`、`source`、`url`），任何格式變動都需同步通知任務 4 的 Prompt。

4. **`excludeKeywords` 優先整合進 RSS URL**，而不是抓取後再過濾，可節省 HTTP 請求次數。

5. **批次呼叫間距設 300ms**，Google News RSS 在連續 10+ 次請求後容易回傳空結果。

6. **`blacklist.json` 需加入 Git 版控**，任務 4 的每次 AI 寫入都應是可追蹤的 commit。
