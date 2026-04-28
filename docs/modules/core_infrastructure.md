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

| Path                                   | 說明                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/coreUtils.mjs`              | 共用 utilities，例如 `TwDate`、`fetchWithTimeout`、`parseNumber`、`stepTimer`。                                                        |
| `src/utils/snapshotCrypto.mjs`         | AES-256-GCM 對稱加密工具模組。提供 `encrypt(obj)` / `decrypt(str)` 兩支函式，金鑰來自 `SNAPSHOT_ENCRYPT_KEY`（32 bytes hex）環境變數。 |
| `src/modules/storage.mjs`              | Google Sheets 讀寫層，負責持股狀態繼承與每日紀錄同步。                                                                                 |
| `src/modules/data/archiveManager.mjs`  | 市場資料、歷史報告、AI log 等檔案存取與清理；`saveReport()` 支援寫入 `snapshot` 加密欄位。                                             |
| `src/modules/data/newsPoolManager.mjs` | 新聞池維護，包括 active pool、filtered pool、archive、TTL 與 fuzzy dedupe。                                                            |
| `src/modules/providers/*.mjs`          | 各資料來源 provider，對上提供一致介面，對下隔離外部 API 細節。                                                                         |
| `src/modules/keywordConfig.mjs`        | 關鍵字與 blacklist 設定讀取入口，屬於基礎設定的一部分。                                                                                |

---

## 3. Providers Layer

目前 `src/modules/providers/` 至少包含以下角色：

| Path                    | 說明                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `basePriceProvider.mjs` | 取得策略基準價。                                                 |
| `twseProvider.mjs`      | 台股歷史資料、即時價格、VIX、開市判斷等。                        |
| `marketData.mjs`        | 聚合 macro / market providers，作為 `fetchAllMacroData()` 入口。 |
| `yahooProvider.mjs`     | Yahoo Finance 相關市場資料。                                     |
| `usMarketProvider.mjs`  | 美股風險與指數資料處理。                                         |
| `cnnProvider.mjs`       | CNN Fear & Greed 指標。                                          |
| `kgiProvider.mjs`       | 凱基相關市場資料。                                               |
| `ndcProvider.mjs`       | 國發會景氣燈號等總經資料。                                       |
| `quoteProvider.mjs`     | 每日一句 / quote 類資料。                                        |

對 AI Agent 而言，provider 層原則上不應直接承擔策略判斷；它們的責任是把外部資料整理成穩定、可被 strategy / AI 消費的格式。

---

## 4. File-based Persistence

### 4.1 `archiveManager.mjs`

此模組負責：

- market cache 的讀寫與 history 保存，
- stock history 快取，
- daily reports 歷檔，
- AI log 清理。

**`saveReport()` 快照欄位**：若環境變數 `SNAPSHOT_ENCRYPT_KEY` 已設定且呼叫方傳入 `snapshot` 欄位，此欄位將包含由 `snapshotCrypto.encrypt()` 加密的持倉快照字串（AES-256-GCM，Base64 封裝）。API 層讀取時需經同一金鑰解密才能取得原始持倉數據。

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
- 單檔損壞不應拖広整個 pool 流程

這讓新聞治理不再是 stateless 抓取，而是具備可維護、可回顾、可歸檔的持久化基礎。

### 4.3 Google Sheets State Sync

`storage.mjs` 主要提供：

- `fetchLastPortfolioState()`：讀取昨日狀態作為今天的持股起點。
- `logDailyToSheet()`：把每日結果寫回試算表，避免排程重跑造成重複列。

#### `fetchLastPortfolioState()` 回傳欄位說明

| 欄位          | 說明                                            | 容錯規則                                                                    |
| ------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `qty0050`     | 0050 持股數量                                   | 空白回傳 `null`                                                             |
| `qtyZ2`       | 00675L 持股數量                                 | 空白回傳 `null`                                                             |
| `totalLoan`   | 目前借款總額                                    | 空白回傳 `null`                                                             |
| `cash`        | 可用現金                                        | 空白回傳 `null`                                                             |
| `lastBuyDate` | 最近一次買進日期                                | 雙來源容錯：Sheet 異常時 fallback 至 `last_buy.json`；兩者均無效回傳 `null` |
| `avgCost0050` | **0050 持倉均價**（手動維護）                   | Sheet 欄位空白或非數字 → `null`，不影響主流程                               |
| `avgCostZ2`   | **00675L 持倉均價**（手動維護）                 | Sheet 欄位空白或非數字 → `null`，不影響主流程                               |
| `price0050`   | **0050 当日收盤市價**（自 twseProvider 讀入）   | 提供給 `saveReport()` 快照寫入，看盤後取得、非交易日為 `null`               |
| `priceZ2`     | **00675L 当日收盤市價**（自 twseProvider 讀入） | 提供給 `saveReport()` 快照寫入，看盤後取得、非交易日為 `null`               |

> **市價字段說明**：`price0050` / `priceZ2` 是本次新增於 `saveReport()` 快照中的市價字段。`dailyCheck.mjs` 在收盤後將實際市價寫入快照，供 `ChartView` 市價法淨值計算使用。非交易日 / 看盤前執行的快照此欄位為 `null`，圖表層已做 null 保護。

**Google Sheet 欄位對映**

`avgCost0050` 讀取「資產紀錄」工作表的 `0050均價` 欄；`avgCostZ2` 讀取 `00675L均價` 欄。兩者均使用 `parseNumber()` 轉換，空白或非數字時回傳 `null` 而不中斷流程。

這層是 daily system state 的唯一外部 user-facing persistence，功能上接近小型帳戶狀態資料庫。

---

## 5. `snapshotCrypto.mjs` 加密工具

`src/utils/snapshotCrypto.mjs` 提供 AES-256-GCM 對稱加密，用於將持倉快照加密寫入 JSON 報告檔。

| 函式           | 說明                                                                 |
| -------------- | -------------------------------------------------------------------- |
| `encrypt(obj)` | 將 JS 物件序列化後加密，回傳 `iv:tag:ciphertext`（均 hex）拼接字串。 |
| `decrypt(str)` | 解析 `iv:tag:ciphertext` 字串並解密，回傳原始 JS 物件。              |

**環境變數**：`SNAPSHOT_ENCRYPT_KEY`（32 bytes hex，共 64 字元）。

**使用方式**：

- `dailyCheck.mjs` 寫入快照時：`encrypt(lastState)` 後寫入 `snapshot` 欄位。
- `src/api/routes/reports.mjs` 寫入快照讀取快照時：`decrypt(report.snapshot)` 後回傳。

**安全考量**：

- 金鑰必須於所有部署環境（GitHub Actions Secrets、Oracle VM `.env`）中設定相同的值。
- `SNAPSHOT_ENCRYPT_KEY` 未設定時，`dailyCheck.mjs` 不寫入 `snapshot` 欄位，API 回傳 `{ hasEncryption: false }`，`ChartView` 顯示「快照功能未啟用」狀態。

---

## 6. Keyword / Blacklist 基礎設定

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

## 7. `coreUtils.mjs` 工具函式一覽

| 函式                                      | 說明                                                   |
| ----------------------------------------- | ------------------------------------------------------ |
| `sleep(ms)`                               | 等待指定毫秒                                           |
| `rocDateToIso(rocYMD)`                    | 民國日期轉 ISO 格式                                    |
| `isoDateToROC(isoText)`                   | ISO 日期轉民國格式                                     |
| `enumerateMonths(startISO, endISO)`       | 產生起込間所有月份清單                                 |
| `toTwseStockNo(symbol)`                   | symbol 轉 TWSE 代號                                    |
| `parseNumber(v)`                          | 含逗號/空字串的數字字串轉 number                       |
| `escapeHTML(text)`                        | HTML 特殊字元跳脇                                      |
| `parseMisTimeToDate(dStr, tStr)`          | MIS 時間字串轉 Date                                    |
| `TwDate(input)`                           | 台北時間處理模組（格式化、判斷季末等）                 |
| `fetchWithTimeout(url, options, timeout)` | 具 Timeout 的 fetch 封裝                               |
| `stepTimer(label)`                        | **執行步驟計時器**，回傳 `done()` 函式，呼叫時印出耗時 |

### `stepTimer` 使用方式

```js
import { stepTimer } from "./utils/coreUtils.mjs";

const done = stepTimer("fetchMacroData");
const macroData = await fetchAllMacroData();
done(); // ⏱ [fetchMacroData] 1234ms
```

`done()` 同時回傳耗時 ms 數，可供後續邏輯使用（例如超時警告）。目前已在 `dailyCheck.mjs` 的所有主要步驟中插入計時，方便在 GitHub Actions log 中快速定位耗時瓶須。

---

## 8. AI Agent 維護指引

當 Agent 遇到以下問題時，應優先定位到 infrastructure 層：

- 某 provider timeout 或回傳格式變更。
- cache 過期或歷史檔讀不到。
- Google Sheets 狀態讀寫失敗。
- 新聞池 archive / dedupe 行為異常。
- blacklist / keyword 設定載入失敗。
- **`avgCost0050` / `avgCostZ2` 為 `null`**：檢查 Google Sheet 「資產紀錄」工作表的 `0050均價` / `00675L均價` 欄位是否填入數字。
- **`price0050` / `priceZ2` 為 `null`**：檢查 `twseProvider` 市價取得是否正常，或確認是否為非交易日執行。
- **`snapshot` 微等快照無資料**：檢查 `SNAPSHOT_ENCRYPT_KEY` 環境變數是否在 GitHub Actions Secrets 與 Oracle VM `.env` 均已設定，且兩處值相同。
- **GitHub Actions 執行超時或中途失敗**：查看 log 中的 `⏱ [stepName] Xms` 輸出，定位耗時異常的步驟後再深入該 provider 或 AI 呼叫。

也就是說，若問題出現在資料來源不穩、快取不一致、持久化失敗，通常先查 `providers`、`storage.mjs`、`archiveManager.mjs`、`newsPoolManager.mjs`，而不是直接懷疑 strategy 或 AI prompt。
