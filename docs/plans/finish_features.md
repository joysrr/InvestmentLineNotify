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

---

## 📌 【AI 管線優化類】任務 4：新聞過濾機制優化（Self-Healing 黑名單）

> **版本：** v1.4（依實際專案結構與確認結果修訂）
> **目標讀者：** AI Agent antigravity
> **前置條件：** 任務 3 已完成，以下項目必須就緒：
> - `data/config/blacklist.json` 已建立，且欄位結構為：`twExcludedSources`、`usExcludedSources`、`titleBlackListPatterns`
> - `data/config/blacklist.json` 的 `titleBlackListPatterns` 為 **regex 字串陣列**，格式例如：`"/Powell Industries/i"`
> - `src/modules/keywordConfig.mjs` 已實作 `loadBlacklist()`，並會讀取 `data/config/blacklist.json`
> - `src/modules/data/archiveManager.mjs` 已實作 `saveNewsLog()`，每日由 `newsFetcher.mjs` 自動產生：
>   - `data/news_logs/passedArticles_TW_YYYY-MM-DD.json`
>   - `data/news_logs/passedArticles_US_YYYY-MM-DD.json`

---

### 🎯 功能目標

打造具備「自我進化能力（Self-Healing）」的新聞濾網機制。系統每日自動審查昨日放行的新聞，揪出漏網農場文，生成新 Regex 規則，通過沙盒驗證後寫入 `data/config/blacklist.json`，隔日透過 `loadBlacklist()` 自動生效。

本版本採用 **方案 A**：維持既有 `blacklist.json` 格式不變，不修改 `keywordConfig.mjs` 的解析方式；AI 新增規則的追蹤、回滾資訊改寫入獨立的 `optimizerHistory.json`。

**量化驗收標準：**

- AI 產出規則通過 Sandbox 驗證率 ≥ 80%
- 黃金清單誤殺率 = **0%**
- `blacklist.json` 規則總數增長速度 < 5 條/週
- 任一日新增規則可被完整回滾（依 `optimizerHistory.json` 還原）

---

### 📁 影響檔案

| 檔案 | 異動類型 | 說明 |
|---|---|---|
| `data/config/blacklist.json` | 修改（持續 append） | 維持既有格式，append regex 字串 |
| `data/config/goldenDataset.json` | 新增 | 黃金標準新聞清單，人工維護，AI 不可寫入 |
| `data/config/optimizerHistory.json` | 新增 | 記錄每次 Optimizer 寫入的規則字串與回滾資訊 |
| `src/modules/ai/prompts.mjs` | 修改 | 新增 `RULE_OPTIMIZER_SCHEMA` 與 `buildOptimizerPrompt()` |
| `src/modules/ai/ruleOptimizerAgent.mjs` | 新增 | Self-Healing AI Agent |
| `src/runOptimizer.mjs` | 新增 | 獨立排程入口 |
| `scripts/rollbackOptimizer.mjs` | 新增 | 依日期回滾當日 AI 新增規則 |
| `.github/workflows/optimizer.yml` | 新增 | Optimizer 專屬排程與執行流程 |

> `src/modules/keywordConfig.mjs`、`src/modules/newsFetcher.mjs`、`src/runDailyCheck.mjs` 原則上不修改；本任務以擴充方式接入既有流程。

---

### 📋 Step 1：建立 goldenDataset.json（人工維護）

黃金清單是沙盒驗證的硬性防線。`ruleOptimizerAgent.mjs` 不得寫入 `goldenDataset.json`。

建議至少 **30 筆**，涵蓋：
- 台股大盤、三大法人、外資、融資融券、景氣燈號、外銷訂單
- 美股指數（S&P 500、Nasdaq、Dow Jones）
- 總經數據（CPI、PCE、GDP、PMI、Payrolls、Jobless Claims）
- 央行政策（Fed、FOMC、Powell、台灣央行）
- 台積電 / TSMC / ADR 相關新聞

範例格式：

```json
[
  { "title": "Fed raises interest rates by 25bps in March FOMC meeting", "source": "Reuters" },
  { "title": "台積電法說會：Q2 營收指引優於預期，外資大幅買超", "source": "經濟日報" },
  { "title": "景氣燈號轉黃紅燈，PMI 連三月擴張", "source": "中央社" }
]
```

---

### 🧠 Step 2：ruleOptimizerAgent.mjs（Self-Healing AI Agent）

#### 輸入來源

讀取昨日由 `newsFetcher.mjs` 產生的兩份 passedArticles 日誌（TW / US 分開處理）：

- `data/news_logs/passedArticles_TW_YYYY-MM-DD.json`
- `data/news_logs/passedArticles_US_YYYY-MM-DD.json`

#### passedArticles 實際使用欄位

每筆文章至少使用以下欄位：
- `title`
- `source`
- `sourceUrl`
- `pubDate`

其中 `title` 可能包含 ` - 來源名稱` 後綴，因此送入 AI 前要先做標題清洗：

```js
function normalizeTitle(title) {
  return title.replace(/\s*-\s*[^-]{2,40}$/, "").trim();
}
```

#### Prompt 設計原則

- System prompt 由 **Langfuse 管理**
- `responseSchema`、prompt builder、前後處理維持在 `prompts.mjs`
- Prompt 語言採用 **繁體中文**，方便中文維護與除錯
- AI 仍可輸出英文 regex pattern，這不受 prompt 語言限制

#### prompts.mjs 新增 RULE_OPTIMIZER_SCHEMA

`RuleOptimizer` 比照既有結構化輸出設計，使用 `responseSchema` 限制輸出格式，避免模型輸出非 JSON、缺欄位或欄位型別錯誤。

```js
export const RULE_OPTIMIZER_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      pattern: { type: "string" },
      flags: { type: "string" },
      reason: { type: "string" }
    },
    required: ["pattern", "flags", "reason"]
  },
  maxItems: 5
};
```

#### AI 呼叫方式

```js
import { callGemini } from "./aiClient.mjs";
import { RULE_OPTIMIZER_SCHEMA } from "./prompts.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `optimizer-local-${Date.now()}`;

async function callOptimizerAI(articleTitles, region) {
  const userPrompt = buildOptimizerPrompt(articleTitles, region);

  try {
    const rawJson = await callGemini("RuleOptimizer", userPrompt, {
      sessionId,
      keyIndex: 2,
      responseMimeType: "application/json",
      responseSchema: RULE_OPTIMIZER_SCHEMA,
    });

    return JSON.parse(rawJson || "[]");
  } catch (err) {
    console.warn(`[Optimizer] AI 呼叫失敗 (${region}):`, err.message);
    return [];
  }
}
```

---

### 🈶 Prompt 語言策略

#### 結論

本任務採用 **繁體中文 system prompt + 繁體中文 user prompt**，不強制改用英文。

#### 設計原則

- Prompt 主體使用繁體中文，方便中文維護者閱讀、調整與除錯
- 保留必要英文技術術語，例如：`regex`、`flags`、`JSON array`、`golden dataset`
- `reason` 欄位固定以繁體中文輸出，利於人工審查與 rollback 判讀
- regex pattern 本身可同時涵蓋中英文，不受 prompt 語言限制

#### 補充判斷

英文 prompt 只有在以下情況才考慮改用：
- 未來主要優化對象轉向美股英文新聞
- 維護者改為英文為主的團隊
- 實測發現英文 prompt 在規則穩定性上顯著優於中文 prompt

在目前架構下，優先影響品質的是：
1. 黃金清單完整度
2. Schema 約束程度
3. Overbroad 規則限制
4. 重複規則檢查
而不是 prompt 使用中文或英文本身

---

### 🧾 Langfuse System Prompt（繁體中文）

Prompt 名稱：`RuleOptimizer`

建議 config：

```json
{
  "responseMimeType": "application/json",
  "temperature": 0.2,
  "maxOutputTokens": 1024
}
```

System Prompt：

```text
你是一個金融新聞黑名單優化代理（Rule Optimizer）。
你的任務是分析一批「已通過現有新聞過濾器」的新聞標題，找出其中應該被擋下但漏網的低品質新聞、農場文、SEO 點擊誘餌或與台股／美股主題無關的內容，並產生新的 regex 規則。

## 你的目標
產生精準、可維護、可驗證的 regex 規則，協助系統阻擋低品質新聞，同時絕對不能誤傷重要財經新聞。

## 輸出要求
1. 只輸出 JSON array
2. 每個元素格式必須為：
   {
     "pattern": "regex pattern",
     "flags": "i 或 空字串",
     "reason": "規則說明"
   }
3. 最多輸出 5 條規則
4. 不可輸出 markdown、註解、額外說明文字
5. 若沒有適合的新規則，輸出 []

## 規則設計限制
1. pattern 必須有具體語意錨點，不可只有模糊通配
2. 不可把 `.*`、`.+`、`\w+`、`\d+` 當成規則主體
3. 不可輸出與既有規則語意明顯重複的 pattern
4. 優先產生可重複利用的結構型規則，不要只為單一標題硬寫過度客製規則
5. reason 請用繁體中文，簡潔說明這條規則要擋的內容型態

## 應優先識別的低品質內容
- 個股推薦、選股清單、買進建議、價格預測
- 明顯 SEO 標題，例如「最強概念股」「飆股卡位」「這原因」「必看」「懶人包」等
- 與台股／美股無關的他國區域市場新聞
- 重複模板化內容農場
- 標題中混入奇怪品牌字、站名、非正規財經名詞的內容
- 不屬於核心財經主題的泛內容

## 不可誤殺的新聞類型
- 總經數據：CPI、PCE、GDP、PMI、Payrolls、Jobless Claims
- 央行政策：Fed、FOMC、Powell、央行、理監事會
- 主要指數：S&P 500、Nasdaq、Dow Jones、台股、大盤
- 台積電 / TSMC / ADR 相關新聞
- 資金流與籌碼：外資、三大法人、Treasury yields、dollar index
- 台灣出口、外銷訂單、景氣燈號等重要總經新聞

## 設計原則
- 寧可少產，也不要產生高風險規則
- 若無法確認是否安全，請不要輸出該規則
- 規則必須可被程式直接編譯成 RegExp
```

---

### 🛡️ Step 3：Sandbox 沙盒驗證（四關卡）

#### 關卡 1：語法合法性

```js
function isValidRegex(pattern, flags) {
  try {
    new RegExp(pattern, flags);
    return true;
  } catch {
    return false;
  }
}
```

#### 關卡 2：廣泛度防護

```js
const OVERBROAD_PATTERNS = [/^\.\*/, /^\.\+/, /^\\w\+/, /^\\d\+/, /^\.\{/];

function isOverbroad(pattern) {
  return OVERBROAD_PATTERNS.some((p) => p.test(pattern.trim()));
}
```

#### 關卡 3：重複規則檢查（字串格式）

由於 `titleBlackListPatterns` 是字串陣列，因此需先把 AI 輸出轉成 canonical string 再比對：

```js
function toRegexLiteral(pattern, flags = "") {
  return `/${pattern}/${flags}`;
}

function isDuplicate(pattern, flags, existingPatterns) {
  const candidate = toRegexLiteral(pattern, flags);
  return existingPatterns.includes(candidate);
}
```

#### 關卡 4：黃金清單碰撞測試

```js
import goldenDataset from "../../data/config/goldenDataset.json" assert { type: "json" };

function passesGoldenTest(newRegex) {
  return !goldenDataset.some((item) => newRegex.test(item.title));
}
```

#### 驗證與寫入主流程

```js
function validateAndPrepare(aiRules, blacklist) {
  const accepted = [];
  const rejected = [];

  for (const rule of aiRules) {
    if (!isValidRegex(rule.pattern, rule.flags)) {
      rejected.push({ ...rule, rejectReason: "invalid_regex" });
      continue;
    }

    if (isOverbroad(rule.pattern)) {
      rejected.push({ ...rule, rejectReason: "overbroad" });
      continue;
    }

    if (isDuplicate(rule.pattern, rule.flags, blacklist.titleBlackListPatterns)) {
      rejected.push({ ...rule, rejectReason: "duplicate" });
      continue;
    }

    const regex = new RegExp(rule.pattern, rule.flags);
    if (!passesGoldenTest(regex)) {
      rejected.push({ ...rule, rejectReason: "golden_dataset_kill" });
      continue;
    }

    accepted.push({
      regexLiteral: `/${rule.pattern}/${rule.flags}`,
      reason: rule.reason,
    });
  }

  return { accepted, rejected };
}
```

---

### 🧷 Step 4：optimizerHistory.json（方案 A 的回滾中樞）

#### 設計目的

因 `blacklist.json` 維持字串陣列，無法直接在每條規則上保存 `addedBy` / `addedAt`。因此新增 `optimizerHistory.json` 做為 **寫入紀錄與回滾依據**。

#### 建議格式

```json
{
  "lastUpdated": "2026-04-01T18:00:00.000Z",
  "history": [
    {
      "date": "2026-04-02",
      "region": "TW",
      "addedRules": [
        {
          "regexLiteral": "/最強.{0,5}(概念股|飆股).{0,10}(布局|卡位|搶先)/",
          "reason": "中文農場 SEO 特徵標題"
        }
      ],
      "rejectedRules": [
        {
          "pattern": "GDP.*",
          "flags": "i",
          "reason": "過度廣泛",
          "rejectReason": "golden_dataset_kill"
        }
      ],
      "savedAt": "2026-04-01T18:00:10.000Z"
    }
  ]
}
```

#### 寫入原則

- 每日每區（TW / US）各寫一筆 history record
- `addedRules` 記錄實際 append 到 `blacklist.json` 的字串規則
- `rejectedRules` 記錄被拒絕原因，方便後續調整 prompt
- `lastUpdated` 供觀察最後一次成功寫入時間

---

### 📅 Step 5：獨立排程入口（src/runOptimizer.mjs）

`runOptimizer.mjs` 統一放在 `src/`，與 `runDailyCheck.mjs` 同層；兩者職責分離。

```js
import { runRuleOptimizer } from "./modules/ai/ruleOptimizerAgent.mjs";
import { archiveManager } from "./modules/data/archiveManager.mjs";

async function main() {
  console.log("[Optimizer] Starting daily blacklist optimization...");

  try {
    const result = await runRuleOptimizer();

    console.log(`[Optimizer] TW — Accepted: ${result.tw.accepted.length}, Rejected: ${result.tw.rejected.length}`);
    console.log(`[Optimizer] US — Accepted: ${result.us.accepted.length}, Rejected: ${result.us.rejected.length}`);

    await archiveManager.saveAiLog({
      type: "RuleOptimizer",
      rawResult: result,
    });
  } catch (err) {
    console.error("[Optimizer] 執行失敗，不影響主要新聞流程:", err.message);
    process.exit(1);
  }
}

main();
```

---

### 🤖 Step 6：GitHub Actions 採用獨立 workflow 檔案

為避免與既有通知流程混在同一個 workflow 中，本任務改採 **獨立 workflow 檔案**：

- 既有通知流程維持：`.github/workflows/line_notify.yml`
- Optimizer 新增專屬流程：`.github/workflows/optimizer.yml`

#### optimizer.yml

```yaml
name: Rule Optimizer Scheduler

on:
  schedule:
    # 台灣 02:00 -> UTC 18:00
    - cron: "0 18 * * *"
  workflow_dispatch:

jobs:
  optimizer:
    runs-on: ubuntu-latest

    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run Rule Optimizer
        env:
          GEMINI_MODEL: ${{ secrets.GEMINI_MODEL }}
          GEMINI_API_KEY1: ${{ secrets.GEMINI_API_KEY1 }}
          GEMINI_API_KEY2: ${{ secrets.GEMINI_API_KEY2 }}
          GEMINI_API_KEY3: ${{ secrets.GEMINI_API_KEY3 }}
          LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
          LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
          LANGFUSE_BASE_URL: ${{ secrets.LANGFUSE_BASE_URL }}
          TZ: "Asia/Taipei"
        run: node src/runOptimizer.mjs

      - name: Commit and Push Data Changes
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "🤖 chore(blacklist): optimizer auto-update [skip ci]"
          commit_user_name: "github-actions[bot]"
          commit_user_email: "github-actions[bot]@users.noreply.github.com"
```

---

### 🔄 Step 7：緊急回滾工具（rollbackOptimizer.mjs）

#### 用法

```bash
node scripts/rollbackOptimizer.mjs --date 2026-04-02
```

#### 邏輯

1. 讀取 `data/config/optimizerHistory.json`
2. 找出指定日期的所有 `addedRules.regexLiteral`
3. 從 `data/config/blacklist.json` 的 `titleBlackListPatterns` 中移除相同字串
4. 將該日期的 history record 標記為 `rolledBack: true`
5. 寫回兩個檔案

#### 範例骨架

```js
import { readFileSync, writeFileSync } from "fs";

const BLACKLIST_PATH = "data/config/blacklist.json";
const HISTORY_PATH = "data/config/optimizerHistory.json";

// 解析 --date 參數後略

const blacklist = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
const history = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));

const records = history.history.filter((r) => r.date === targetDate && !r.rolledBack);
const toRemove = new Set(records.flatMap((r) => r.addedRules.map((x) => x.regexLiteral)));

blacklist.titleBlackListPatterns = blacklist.titleBlackListPatterns.filter((x) => !toRemove.has(x));

history.history = history.history.map((r) =>
  r.date === targetDate ? { ...r, rolledBack: true, rolledBackAt: new Date().toISOString() } : r
);

writeFileSync(BLACKLIST_PATH, JSON.stringify(blacklist, null, 2));
writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
```

---

### 🔁 完整資料流

```text
每日台灣 02:00 觸發（GitHub Actions UTC 18:00）
line_notify.yml 的 optimizer job
  ↓
node src/runOptimizer.mjs
  ↓
讀取昨日 passedArticles 日誌（TW / US 分開）
  ↓
抽取 articles[].title，去除 title 中的來源尾碼
  ↓
讀取 data/config/blacklist.json raw JSON（非 loadBlacklist()）
  ↓
呼叫 RuleOptimizer（keyIndex: 2）
  ↓
取得 [{ pattern, flags, reason }] 最多 5 條
  ↓
Sandbox 驗證：invalid_regex → overbroad → duplicate → golden_dataset_kill
  ↓
accepted 規則轉成 /pattern/flags 字串後 append 到 blacklist.json
  ↓
同步寫入 optimizerHistory.json
  ↓
archiveManager.saveAiLog({ type: "RuleOptimizer" })
  ↓
Git auto commit 推上 repo
  ↓
隔日 newsFetcher 啟動時 loadBlacklist() 自動讀取最新規則
```

---

### 🔑 API Key 使用策略

目前規劃：
- `keyIndex: 0` → SearchQueries
- `keyIndex: 1` → FilterNews
- `keyIndex: 2` → RuleOptimizer

在目前三組 key 架構下可行，且因 Optimizer 使用獨立 job 與獨立排程，實務上已可大幅降低碰撞風險。

只有在以下情況才考慮擴增第 4 組 key：
- 未來新增更多 AI 任務
- 常態性手動觸發 optimizer
- 出現明顯 rate limit / quota 壓力
- 想將 TW / US Optimizer 再拆成不同 key

---

### 📝 開發注意事項

1. 本任務 **不修改** `keywordConfig.mjs` 的 regex 解析方式。
2. `blacklist.json` 保持字串陣列格式，避免 breaking change。
3. 回滾安全閥改由 `optimizerHistory.json` 提供，而不是寫在 blacklist item 上。
4. `RuleOptimizer` 的 system prompt 由 Langfuse 維護；若 prompt 有改動，需同步保留版本註記。
5. 若 `golden_dataset_kill` 比例偏高，優先補強 prompt 與 golden dataset，而不是放寬驗證條件。
6. 新規則生效不需重啟服務，因 `loadBlacklist()` 在 `newsFetcher.mjs` 每次啟動時會重新讀取檔案。
7. `reason` 欄位是人工審核與 rollback 判讀的重要依據，請保留可讀性。

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
