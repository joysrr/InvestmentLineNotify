# 市場資料 Providers / Market Data Providers

## 1. 模組定位

`src/modules/providers/` 是本專案的 **外部資料封裝層（Data Abstraction Layer）**，負責隔離所有對外 API 的複雜細節，對上提供一致、穩定的資料介面供 strategy / AI 消費。

此層設計原則：
- **Provider 不承擔策略判斷**，只負責資料整理、格式轉換與防呆回傳。
- **所有 provider 均具備 Fallback 預設值**，外部 API 失敗時不中斷主流程。
- **快取策略因資料更新頻率而異**，統一由 `marketData.mjs` 的 `fetchAllMacroData()` 管理。
- 所有 HTTP 請求均透過 `coreUtils.mjs` 的 `fetchWithTimeout()` 封裝，具備 Timeout 防護。

---

## 2. 模組檔案總覽

```
src/modules/providers/
├── marketData.mjs          ← 統一入口（Orchestration + 快取排程）
├── twseProvider.mjs        ← 台股核心（歷史/即時/VIX/估值/假日判斷）
├── basePriceProvider.mjs   ← 策略基準價計算
├── usMarketProvider.mjs    ← 美股風險評估（VIX / S&P500 via FRED）
├── cnnProvider.mjs         ← CNN 恐懼貪婪指數
├── kgiProvider.mjs         ← 台股融資餘額與維持率（KGI / MoneyDJ）
├── yahooProvider.mjs       ← USD/TWD 匯率（Yahoo Finance）
├── ndcProvider.mjs         ← 國發會景氣對策信號（景氣燈號）
└── quoteProvider.mjs       ← 每日一句（Quotable / ZenQuotes）
```

---

## 3. 統一入口：`marketData.mjs`

### 3.1 職責
`marketData.mjs` 是 providers 層的 **唯一對外入口**，外部模組（如 `dailyCheck.mjs`）應透過此檔案取得所有總經資料，而不應直接呼叫個別 provider。

### 3.2 主要 Exports

```js
// 直接 re-export 自 twseProvider（不走快取）
export { fetchStockHistory, fetchRealTimePrice, getTwVix, isMarketOpenTodayTWSE }

// 直接 re-export 自 basePriceProvider
export { fetchLatestBasePrice }

// 整合快取的總經資料入口
export async function fetchAllMacroData()
```

### 3.3 `fetchAllMacroData()` 快取策略（A~F 六段）

此函式在每次呼叫時，先讀取 `archiveManager.getLatestMarketData()` 的快取，再依以下策略決定哪些 provider 需要重新抓取：

| 段落 | 資料 | Provider | 快取策略 |
|---|---|---|---|
| **A** | 國發會景氣燈號 | `ndcProvider` | 每天抓一次（比對 `lastFetch` 日期與今日相符則讀快取） |
| **B** | 台股融資餘額 | `kgiProvider` | 台北時間 16:00 前讀快取（台股收盤前無新資料）；16:00 後且距上次更新超過 2 小時則重抓 |
| **C** | CNN 恐懼貪婪 | `cnnProvider` | 台北時間 21:00~05:00（美股開盤）強制重抓；其餘時間若快取不超過 24 小時則讀快取 |
| **D** | 美股 FRED 數據 | `usMarketProvider` | 每天抓一次（比對 `lastFetch` 日期） |
| **E** | 大盤 PB/PE 估值 | `twseProvider.fetchMarketValuation` | 每天抓一次（比對 `lastFetch` 日期） |
| **F** | USD/TWD 匯率 | `yahooProvider` | 每次都重抓（無快取） |
| **F** | 每日一句 | `quoteProvider` | 委由 `quoteProvider` 內部邏輯處理（依賴 `archiveManager` 今日快取判斷） |

### 3.4 快取持久化
所有抓取結果統一由 `archiveManager.saveMarketData()` 持久化到 `data/market/latest.json`，下次排程啟動時可直接讀取，避免重複打 API。

---

## 4. 各 Provider 詳細說明

### 4.1 `twseProvider.mjs` — 台股核心

**資料來源**：TWSE OpenAPI、MIS 即時系統、TAIFEX（台灣期交所）

**主要 Exports 與回傳結構**：

| 函式 | 說明 | 回傳 |
|---|---|---|
| `fetchStockHistory(symbol, period1, period2)` | 抓取指定股票的歷史日 K（月份分批查詢，具 archiveManager 快取） | `[{ date, open, high, low, close, volume }]` |
| `fetchRealTimePrice(symbol)` | 取得即時股價，MIS 失敗時 fallback 至當月最後收盤 | `{ price, time }` |
| `fetchRealtimeFromMis(symbol)` | 直接呼叫 MIS 即時 API（`fetchRealTimePrice` 的底層） | `{ price, time, priceSource, rawTime }` |
| `getTwVix()` | 台灣 VIX（台期所）；嘗試三個 symbol candidates | `{ value, change, status, symbolUsed, date, time, dateTimeText }` |
| `isMarketOpenTodayTWSE()` | 判斷今日是否為 TWSE 開市日 | `boolean` |
| `loadHolidaySet(year)` | 載入 TWSE 年度休市日 Set（具記憶體快取） | `Set<string>` |
| `fetchStockHistory(symbol, p1, p2)` | 歷史股價查詢（月份分批 + 非當月 archive 快取） | `[{ date, open, high, low, close, volume }]` |
| `fetchMarketValuation()` | 計算 TWSE 全市場加權 PB / PE / 殖利率 | `{ pe, pb, yield, date }` |

**特殊機制**：
- **Cookie 快取（TTL 10 分鐘）**：MIS 即時系統需要先取得 Cookie，使用 Promise Lock 防止併發重複請求。
- **估值快取（TTL 4 小時）**：`fetchMarketValuation()` 結果記憶體快取，同一進程 4 小時內不重複計算。
- **股本快取（TTL 7 天）**：`fetchSharesMap()` 讀取 TWSE OpenAPI 股本資料，7 天才重抓一次。
- **歷史月份快取**：STOCK_DAY 非當月資料寫入 `archiveManager`，後續不重複打 API。
- **IPv4 強制**：`new https.Agent({ family: 4 })` 強制 IPv4 解析，繞過 TWSE 的 IPv6 路由問題。
- **雙 URL fallback**：STOCK_DAY 有 rwd 與舊版兩個 endpoint，依序嘗試。

**大盤估值計算方式（市值加權）**：
```
PE    = Σ(市值_i) / Σ(市值_i / PE_i)    （僅限 PE > 0 盈餘股）
PB    = Σ(市值_i) / Σ(市值_i / PB_i)    （僅限 PB > 0）
Yield = Σ(市值_i × Yield_i%) / Σ(所有普通股市值)
```
資料來源：`BWIBBU_ALL`（本益比）、`STOCK_DAY_ALL`（最新收盤）、`t187ap03_L`（股本）。

---

### 4.2 `usMarketProvider.mjs` — 美股風險評估

**資料來源**：FRED API（美聯儲聖路易分行）- 系列 `VIXCLS`（美股 VIX）與 `SP500`（標普 500）

**主要 Export**：`fetchUsMarketData()`

**回傳結構**：
```js
{
  success: boolean,
  vix: string,          // 例如 "18.50"
  spxChg: string,       // 例如 "-1.23%"
  riskLevel: string,    // "正常" | "風險升高" | "高風險" | "極高風險" | "過度安逸"
  riskIcon: string,     // "✅" | "📈" | "⚠️" | "🚨" | "🔥"
  suggestion: string,
  isHighRisk: boolean,
  meta: { vixDate, spxDate },
  source: "FRED"
}
```

**風險評級邏輯**（門檻從 `signalRules.mjs` 動態讀取）：

| 條件 | 風險等級 | `isHighRisk` |
|---|---|---|
| VIX ≥ 30 或 SPX 跌幅 ≥ 3% | 極高風險 🚨 | `true` |
| VIX ≥ 20 或 SPX 跌幅 ≥ 2% | 高風險 ⚠️ | `true` |
| SPX 跌幅 ≥ 1% | 風險升高 📈 | `false` |
| VIX < 13.5 | 過度安逸 🔥 | `false` |
| 其他 | 正常 ✅ | `false` |

門檻變數：`threshold.usVixPanic`、`threshold.vixHighFear`、`threshold.vixLowComplacency`

**注意**：FRED_API_KEY 為選配，未設定時仍可呼叫（有頻率限制），建議設定環境變數 `FRED_API_KEY` 提升穩定性。

---

### 4.3 `cnnProvider.mjs` — CNN 恐懼貪婪指數

**資料來源**：`https://production.dataviz.cnn.io/index/fearandgreed/graphdata`

**主要 Export**：`fetchFearAndGreedIndex()`

**回傳結構**：
```js
{
  score: number,          // 0~100，50 為中性
  rating: string,         // "extreme fear" | "fear" | "neutral" | "greed" | "extreme greed"
  previousClose: number,
  previous1Week: number,
  previous1Month: number,
  previous1Year: number,
  timestamp: Date
}
```

**Fallback 預設值**：全部為 `50`（中性），確保 API 失敗時不影響下游邏輯。

**防爬蟲**：請求帶偽裝 `User-Agent`、`Origin: https://edition.cnn.com`、`Referer: https://edition.cnn.com/`。

---

### 4.4 `kgiProvider.mjs` — 台股融資餘額

**資料來源**：KGI 凱基證券（背後由 MoneyDJ 提供）

**主要 Export**：`fetchTwseMarginData()`

**回傳結構**：
```js
{
  date: string,                  // 例如 "2026/03/20"
  marginBalance100M: number,     // 融資餘額（億元）
  marginBalanceChange100M: number, // 較前一日變化（億元）
  maintenanceRatio: number       // 大盤融資維持率（%）
}
```

**欄位對照**（MoneyDJ JSON）：
- `V1`：日期
- `V3`：融資餘額（單位仟元，除以 10000 轉為億）
- `V6`：融資維持率

**防呆**：若解析出的數值不合理（餘額 < 1000 億或維持率 < 100%），回傳預設值 `{ marginBalance100M: 3000, marginBalanceChange100M: 0, maintenanceRatio: 165 }`。

**防爬蟲**：需偽裝 `Referer: https://www.kgi.com.tw/`、`Origin: https://www.kgi.com.tw`。

---

### 4.5 `yahooProvider.mjs` — USD/TWD 匯率

**資料來源**：Yahoo Finance v8 API（`TWD=X`，1 個月區間，日線）

**主要 Export**：`fetchUsdTwdExchangeRate()`

**回傳結構**：
```js
{
  currentRate: number,         // 最新匯率（4 位小數）
  previousClose: number,       // 昨收匯率
  changePercent: number,       // 漲跌幅（%）
  historicalPrices: number[]   // 近 1 月每日收盤匯率
}
```

**昨收價三層防呆**：
1. 優先讀 `meta.previousClose`
2. 次之讀 `meta.chartPreviousClose`
3. 均無則取歷史陣列倒數第二筆

**連線優化**：使用 `https.Agent({ keepAlive: true, family: 4 })` 共用長連線並強制 IPv4。

---

### 4.6 `ndcProvider.mjs` — 國發會景氣對策信號

**資料來源**：主計總處/國發會 總體統計資料庫 JSON API (`nstatdb.dgbas.gov.tw`)

**主要 Export**：`fetchBusinessIndicator()`

**回傳結構**：
```js
{
  date: string,       // 例如 "2026-01"（ISO 格式）
  score: number,      // 景氣對策信號分數
  light: string,      // 例如 "綠燈 (穩定)"
  lightColor: string  // "red" | "yellow-red" | "green" | "yellow-blue" | "blue"
}
```

**燈號判斷規則**：
| 分數 | 燈號 | lightColor |
|---|---|---|
| ≥ 38 | 紅燈（過熱） | `red` |
| 32–37 | 黃紅燈（轉熱） | `yellow-red` |
| 23–31 | 綠燈（穩定） | `green` |
| 17–22 | 黃藍燈（轉弱） | `yellow-blue` |
| < 17 | 藍燈（低迷） | `blue` |

**民國/西元轉換**：查詢時間區間動態產生（當前月份往前推 2 年），使用 `coreUtils.isoDateToROC()` 轉換；回傳日期從「115年1月」反解為 ISO 格式。

**Fallback 預設值**：`{ date: "2024-01", score: 25, light: "綠燈 (穩定)", lightColor: "green" }`

---

### 4.7 `quoteProvider.mjs` — 每日一句

**資料來源**：Quotable API → ZenQuotes API → 內建 Fallback

**主要 Export**：`getDailyQuote()`

**回傳結構**：
```js
{
  date: string,    // 今日日期（YYYY-MM-DD，台北時間）
  quote: string,
  author: string,
  source: string   // "quotable" | "zenquotes" | "fallback"
}
```

**三層 Fallback**：
1. 優先讀今日 `archiveManager.getLatestMarketData()` 快取（避免 Rate Limit）
2. 向 Quotable API 抓取
3. Quotable 失敗改用 ZenQuotes
4. 兩者均失敗使用內建名言：「下跌是加碼的禮物，上漲是資產的果實。」

**快取策略**：每日一句以 `date` 欄位比對今日日期，同日不重複呼叫 API。

---

### 4.8 `basePriceProvider.mjs` — 策略基準價

此 provider 負責取得策略基準價（base price）供 `strategyEngine` 計算進場條件。具體邏輯見程式碼，此處不展開。

---

## 5. 共用工具：`src/utils/coreUtils.mjs`

所有 provider 均依賴 `coreUtils.mjs` 提供的工具函式，以下為完整清單：

| 函式 | 說明 | 主要使用 Provider |
|---|---|---|
| `fetchWithTimeout(url, options, timeout)` | 具備 `AbortController` 的 fetch 封裝，timeout 預設 8000ms | 全部 |
| `parseNumberOrNull(v)` | 安全數字轉換：處理逗號千分位、`--`、空字串；無效回傳 `null` | 全部 |
| `TwDate(input?)` | 台北時間 Factory，含 `formatDateKey()`、`formatMonthKey()` 等方法 | twse, quote, marketData |
| `rocDateToIso(rocYMD)` | 民國日期轉 ISO：`"106/08/01"` → `"2017-08-01"` | twseProvider |
| `isoDateToROC(isoText, withSlash)` | ISO 轉民國（支援純月份格式）：`"2026-03"` → `"11503"` | ndcProvider |
| `enumerateMonths(startISO, endISO)` | 產生月份清單供 TWSE STOCK_DAY 月查詢，回傳 `["YYYYMM01", ...]` | twseProvider |
| `toTwseStockNo(symbol)` | 去除 `.TW` 後綴：`"00675L.TW"` → `"00675L"` | twseProvider |
| `toExCh(symbol)` | 轉為 MIS 格式：`"00675L"` → `"tse_00675L.tw"` | twseProvider |
| `parseMisTimeToDate(dStr, tStr)` | MIS 時間字串（`"20260401"` + `"09:30:00"`）轉 Date | twseProvider |
| `parseEnglishDateToISO(dateText)` | 英文日期（`"January 1, 2026"`）轉 ISO | twseProvider (假日解析) |
| `sleep(ms)` | 等待指定毫秒，避免 TWSE 頻率限制 | twseProvider |
| `stepTimer(label)` | 步驟計時器，回傳 `done()` 函式，執行後印出耗時 ms | dailyCheck（跨層使用） |
| `escapeHTML(text)` | HTML 特殊字元跳脫，供 Telegram 訊息建構使用 | notifications 層 |

---

## 6. AI Agent 維護指引

### 何時進入 providers 層排查
- **某類市場資料空白或異常**：依資料類型對應到具體 provider（參考第 4 節）。
- **快取資料過舊**：查看 `data/market/latest.json` 的 `_meta.sources` 欄位，找到對應 provider 的 `lastFetch` 與 `status`。
- **API 呼叫失敗 / Timeout**：所有 provider 均有 `console.warn`，查 GitHub Actions log 的 `⚠️` 字頭輸出。

### 各 Provider 常見問題快速定位

| 症狀 | 優先查看 |
|---|---|
| VIX 資料空白 | `twseProvider.getTwVix()`：TAIFEX cookie 取得流程，三個 symbol candidates 是否全部失敗 |
| 融資餘額異常低 | `kgiProvider.fetchTwseMarginData()`：合理性驗證防呆是否誤觸（餘額 < 1000 或維持率 < 100） |
| 恐懼貪婪指數固定為 50 | `cnnProvider`：API 防爬蟲被擋，檢查 Referer/User-Agent 設定是否需要更新 |
| 匯率為 null | `yahooProvider`：Yahoo Finance API 結構是否有異動 |
| 景氣燈號停留在舊月份 | `ndcProvider`：民國年月轉換邏輯，或 DGBAS API 尚未更新 |
| 美股風險永遠顯示「正常」 | `usMarketProvider`：FRED API 是否需要 API Key（設定 `FRED_API_KEY` 環境變數） |
| 大盤 PE/PB 為 null | `twseProvider.fetchMarketValuation()`：TWSE OpenAPI `BWIBBU_ALL` 或 `STOCK_DAY_ALL` 結構異動 |

### 快取 metadata 結構
```js
// data/market/latest.json 的 _meta.sources 欄位
{
  ndcProvider:       { status: "SUCCESS" | "FAILED", lastFetch: "2026-04-05T10:00:00.000Z" },
  kgiProvider:       { status: "SUCCESS", lastFetch: "..." },
  cnnProvider:       { status: "SUCCESS", lastFetch: "..." },
  usMarketProvider:  { status: "SUCCESS", lastFetch: "..." },
  valuationProvider: { status: "SUCCESS", lastFetch: "..." },
  yahooProvider:     { status: "SUCCESS", lastFetch: "..." }
}
```

---

## 7. 對外依賴環境變數

| 環境變數 | 使用 Provider | 說明 |
|---|---|---|
| `FRED_API_KEY` | `usMarketProvider` | 選配；未設定時仍可呼叫，但有較嚴格的速率限制 |

其餘 provider（TWSE、CNN、KGI、Yahoo、NDC）均為**公開 API 或需偽裝 Referer 的資料來源**，不需 API Key。
