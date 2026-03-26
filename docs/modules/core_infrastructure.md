# 底層工具與儲存機制 (Core Infrastructure) 架構說明

## 1. 模組職責
`src/utils/`、`src/modules/providers/` 與 `src/modules/storage.mjs` (包含 `src/modules/data/`) 共同構成了系統穩固的基礎設施層。由於本專案為無傳統資料庫架構，且高度依賴外部 API，這三者的綜合職責包含：
1. **資料獲取與整合**：負責與台股（TWSE、凱基）、美股（FRED、Yahoo）、總經指標（國發會）與市場情緒（CNN）等第三方 API 進行通訊並取得行情與數據。
2. **狀態快取與防護**：利用本地檔案系統管理快取，大幅降低頻繁存取第三方 API 所造成的限流風險與延遲。
3. **雲端狀態同步**：透過 Google Sheets 作為用戶端的輸入介面（讀取資產現況）與輸出紀錄（寫入每日戰報）。
4. **基礎運算支援**：提供全域共用的基礎功能，如日期時間轉換、網路請求防護、字串與數字的安全解析等。

## 2. 核心檔案與介面
### 核心工具 (`src/utils/coreUtils.mjs`)
提供基礎的資料與網路處理能力：
- `TwDate(input)`: 統一產生維持在台灣時區 (Asia/Taipei) 的日期時間物件，為資料快取生命週期提供一致的時間錨點。
- `fetchWithTimeout(url, options, timeout)`: 具備 Timeout 功能的 fetch 封裝，為全系統對外請求加上保險絲。
- `parseNumberOrNull(v)`: 安全的數字剖析器，處理空字串、逗號、"-" 或 "--" 等異常輸入。

### 資料提供者 (`src/modules/providers/`)
特定領域的 API 抓取模組，並統一由 `marketData.mjs` 調度：
- `marketData.mjs`: 提供 `fetchAllMacroData()`，整合各 provider 資訊，並配合 `archiveManager` 管理快取狀態。
- `twseProvider.mjs`: 取得台股個股月歷史資料、MIS 即時盤價與期交所台指 VIX。
- `usMarketProvider.mjs` & `yahooProvider.mjs`: 從 FRED 取得美股標普與 VIX 歷史資料，並進行風險分析；從 Yahoo Finance 抓取美元兌台幣最新匯率。
- `cnnProvider.mjs` & `kgiProvider.mjs` & `ndcProvider.mjs`: 分別抓取 CNN 恐懼貪婪指數、凱基大盤融資餘額與國發會景氣對策信號。

### 儲存與快取 (`src/modules/storage.mjs` & `src/modules/data/archiveManager.mjs`)
負責資料持久化與外部狀態同步：
- `storage.mjs`:
  - `fetchLastPortfolioState()`: 從 Google Sheets 倒序尋找最後一筆有日期的有效個人持股紀錄（包含 0050、00675L 股數及借貸總額等）。
  - `logDailyToSheet(data)`: 在 Google Sheets 自動建立或尋找「通知紀錄」分頁，並將每日運算完畢的資產變動與建議防呆寫入。
- `archiveManager.mjs`:
  - `getLatestMarketData() / saveMarketData()`: 讀寫 `market/latest.json` 以儲存當日市場指標總覽。
  - `saveStockHistory() / getStockHistory()`: 針對過往無變動的台股交易月份，進行永久性的 JSON 備份以避免重複抓取。
  - `cleanOldArchives()`: 定期清理舊備份，防止硬碟空間無限擴張。

## 3. 資料持久化機制 (File-based Database)
本系統仰賴本機 `data/` 資料夾作替代型資料庫，領域切割如下：
1. **`market/`**: 存放當前市場快照 (`latest.json`) 與歷史每日備份 (`history/`)。根據各項指標的更新頻率設定快取規則，例如「國發會」每日只需檢查一次；「融資餘額」在每日 16:30 過後才捨棄舊快取。新資料抓到後，統一透過 `saveMarketData()` 覆寫本地狀態。
2. **`stock_history/`**: 存放台股個股（如 0050 等）的歷史「月」股價。策略上將歷史不變的檔案永久快取，與每日滾動的指標快取脫鉤。
3. **`ai_logs/` & `reports/`**: 追蹤每日最終產出的報告 (`reports/`) 以及送往 Google Gemini 的 prompt/response 紀錄 (`ai_logs/`)，供後續排錯與覆盤。

## 4. 已知限制與防禦機制
- **連線防護與逾時重試 (Timeouts)**：所有的外部查詢全面使用 `fetchWithTimeout` 避免單點卡死。若某 Provider 超時或失敗時，皆設有 `try-catch` 保護，會主動切換回覆本地的 `cache` (如 `cachedData.rawFx`) 或使用防呆預設值。
- **針對性連線優化**：針對 TWSE 與 Yahoo 提供專屬的 `https.Agent` (開啟 `keepAlive`, 綁定 IPv4)，主動繞過 TWSE 時常失敗的 IPv6 解析問題並節省交握時間。針對有防爬蟲機制的網站（CNN、TWSE、KGI），特別設定 `User-Agent`、`Referer` 或動態攔截並寫入 `Set-Cookie`。
- **數值防呆 (Null Defense)**：因應第三方 API 在假日或無交易日時常回傳 `.` 或 `--`，系統全程捨棄簡單的 `isNaN` 檢查，改為使用 `parseNumberOrNull()` 即時過濾空值為 `null`，避免後續數學運算出現 `NaN` 的崩潰。這也包含解讀 Google Sheets 的數值時的空值防護。
- **防禦失效日期**：呼叫 `TwDate` 收到無效日期時，會因為防呆機制回傳 `isValid: false` 與安全空值物件，防止全系統出錯。
- **安全格式處理**：自動處理 `process.env.GOOGLE_PRIVATE_KEY` 換行符號斷裂與引號包裹的情況。
- **跨日同步與寫入防護**：`logDailyToSheet` 在寫入前會檢查最後一筆資料的日期，若今日已有紀錄則執行「更新所在列」而非新增，防止排程重試時產生重複行。同時 `cleanOldArchives()` 每日自動刪除超過 30 天以上的過期日誌副本防止磁碟滿載。
