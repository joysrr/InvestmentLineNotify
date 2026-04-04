# 核心基礎設施 / Core Infrastructure

## 1. 模組定位
本層負責專案最底層的 data access、cache、file persistence、external integration 與共用 utilities。對本專案而言，`Core Infrastructure` 不只是 helper collection，而是整個系統能穩定跑排程的基礎。

由於本專案不使用傳統資料庫，因此 infrastructure 的重點是：
- 盡量把外部依賴失敗的風險吸收在邊界層。
- 用 `data/` 實作 file-based persistence。
- 用 Google Sheets 補足個人持股狀態同步。
- 用可恢復、可清理的 cache 降低 API 震盪影響。

---

## 2. 核心檔案
| Path | 說明 |
|---|---|
| `src/utils/coreUtils.mjs` | 共用 utilities，例如 `TwDate`、`fetchWithTimeout`、`parseNumberOrNull`。 |
| `src/modules/storage.mjs` | Google Sheets 讀寫層，負責持股狀態繼承與每日紀錄同步。 |
| `src/modules/data/archiveManager.mjs` | 市場資料、歷史報告、AI log 等檔案存取與清理。 |
| `src/modules/data/newsPoolManager.mjs` | 新聞池維護，包括 active pool、filtered pool、archive、TTL 與 fuzzy dedupe。 |
| `src/modules/providers/*.mjs` | 各資料來源 provider，對上提供一致介面，對下隔離外部 API 細節。 |
| `src/modules/keywordConfig.mjs` | 關鍵字與 blacklist 設定讀取入口，屬於基礎設定的一部分。 |

---

## 3. Providers Layer
目前 `src/modules/providers/` 至少包含以下角色：

| Path | 說明 |
|---|---|
| `basePriceProvider.mjs` | 取得策略基準價。 |
| `twseProvider.mjs` | 台股歷史資料、即時價格、VIX、開市判斷等。 |
| `marketData.mjs` | 聚合 macro / market providers，作為 `fetchAllMacroData()` 入口。 |
| `yahooProvider.mjs` | Yahoo Finance 相關市場資料。 |
| `usMarketProvider.mjs` | 美股風險與指數資料處理。 |
| `cnnProvider.mjs` | CNN Fear & Greed 指標。 |
| `kgiProvider.mjs` | 凱基相關市場資料。 |
| `ndcProvider.mjs` | 國發會景氣燈號等總經資料。 |
| `quoteProvider.mjs` | 每日一句 / quote 類資料。 |

對 AI Agent 而言，provider 層原則上不應直接承擔策略判斷；它們的責任是把外部資料整理成穩定、可被 strategy / AI 消費的格式。

---

## 4. File-based Persistence

### 4.1 `archiveManager.mjs`
此模組負責：
- market cache 的讀寫與 history 保存，
- stock history 快取，
- daily reports 歸檔，
- AI log 清理。

### 4.2 `newsPoolManager.mjs`
這是近期新增、但舊文件未完整覆蓋的基礎模組。它管理：
- `data/news/pool_active.json`
- `data/news/pool_filtered_active.json`
- `data/news/archive/YYYY-MM-DD.json`

其主要規則：
- TTL = 24 hours
- MAX_POOL_SIZE = 200
- 支援標題 fingerprint 與 fuzzy dedupe
- 過期文章自動 archive
- 單檔損壞不應拖垮整個 pool 流程

這讓新聞治理不再是 stateless 抓取，而是具備可維護、可回顧、可歸檔的持久化基礎。

### 4.3 Google Sheets State Sync
`storage.mjs` 主要提供：
- `fetchLastPortfolioState()`：讀取昨日狀態作為今天的持股起點。
- `logDailyToSheet()`：把每日結果寫回試算表，避免排程重跑造成重複列。

這層是 daily system state 的唯一外部 user-facing persistence，功能上接近小型帳戶狀態資料庫。

---

## 5. Keyword / Blacklist 基礎設定
本次已整合的 keyword system 重構，雖然主要服務新聞抓取，但其設定面其實屬於 infrastructure：

- `KeywordEntry` schema 統一靜態與動態關鍵字格式。
- `loadBlacklist()` 使 blacklist 不再硬寫在程式邏輯內。
- `twExcludeKeywords` / `usExcludeKeywords` 提供 RSS query 層過濾設定。
- blacklist source 與 regex pattern 提供 article validation 層過濾設定。

對未來維護來說，這代表：
- 調整 query coverage → 看 keyword config。
- 調整誤殺 / 漏網 → 看 blacklist loading 與 validation。
- 調整 AI 輸出格式 → 看 prompt + schema validation。

---

## 6. AI Agent 維護指引
當 Agent 遇到以下問題時，應優先定位到 infrastructure 層：

- 某 provider timeout 或回傳格式變更。
- cache 過期或歷史檔讀不到。
- Google Sheets 狀態讀寫失敗。
- 新聞池 archive / dedupe 行為異常。
- blacklist / keyword 設定載入失敗。

也就是說，若問題出現在資料來源不穩、快取不一致、持久化失敗，通常先查 `providers`、`storage.mjs`、`archiveManager.mjs`、`newsPoolManager.mjs`，而不是直接懷疑 strategy 或 AI prompt。
