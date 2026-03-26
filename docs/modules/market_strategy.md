# 市場數據與策略引擎模組 (Market & Strategy) 架構說明

## 1. 模組職責
`src/modules/strategy/` 與 `src/modules/newsFetcher.mjs` 共同組成了系統的「感知與量化運算層」。這兩部分負責接收基礎設施層提供的報價或抓取特定市場動態，並將其轉換成可量化的技術指標、市場狀態與買賣評分。
1. **策略引擎 (Strategy Engine)**：依據遠端的 JSON 設定檔，處理技術指標（RSI、MACD、KD）、維持率風險與乖離率，計算出每日的「建議投資部位與槓桿水位」。
2. **財經新聞收報機 (News Fetcher)**：針對台灣及美國市場，動態組合關鍵字抓取 Google News RSS，嚴格剔除與總經/大盤無關的雜訊，並篩選出最近 24 小時的重大動向。

## 2. 核心檔案與介面
### 策略邏輯 (`src/modules/strategy/`)
- **`indicators.mjs`**：
  - `calculateIndicators(history)`: 利用 TA-Lib (technicalindicators) 計算收盤價的 RSI(14)、MACD(12,26,9) 與 Slow KD。
  - `fellBelowAfterAbove()` / `roseAboveAfterBelow()`: 用於判斷指標跌落或突破的「轉弱/轉強」過濾器。
- **`signalRules.mjs`**：
  - `fetchStrategyConfig()` / `validateStrategyConfig()`: 從外部 URL 讀取 `Strategy.json`，並驗證所有閥值格式。
  - `computeEntryScore()`, `computeReversalTriggers()`, `computeOverheatState()`, `computeSellSignals()`: 各別計算進場加權分數、轉弱條件、過熱狀態與停利條件。
- **`riskManagement.mjs`**：
  - `getTargetLeverageByScore()`: 根據分數分配槓桿級距。
  - `getReserveStatus()`: 給定當前總資產，檢驗備用現金水位是否健康。
- **`strategyEngine.mjs`**：
  - `evaluateInvestmentSignal()`: 彙整所有風險因子（維持率、槓桿比例、冷卻期等）與指標，依照優先級別輸出對應的 `marketStatus` 與 `targetSuggestion`。

### 新聞快訊 (`src/modules/newsFetcher.mjs`)
- `getRawNews(queries)`: 結合靜態「基礎查詢」（如：通膨、升降息、大盤）與「AI 動態生成」關鍵字，批次向 Google 呼叫 RSS，並附有嚴格的正負面排除條件。
- `getNewsTelegramMessages()`: 將剛抓取的 Raw News 送交到 AI 模組進行過濾與重點翻譯，再產出可用於 Telegram 的格式化排版字串。

## 3. 策略計算與業務規則
### 技術特徵與量化評分
- **轉強進場評分**：不僅看價格跌幅，若搭配 RSI 低檔反彈、MACD 黃金交叉或 KD 剛黃金交叉，則會疊加 `weightScore` 分數，進一步推升建議的進場槓桿成數。
- **過熱與轉弱機制 (Overheat & Reversal)**：
  - 若 RSI、KD(%D) 與 240 日乖離率同時超標，判定為「🔥極度過熱」，將鎖定 00675L 的新規撥款。
  - 當 RSI 跌破門檻、KD 死叉，累積命中一定數量視為「📡轉弱監控」，暫停加碼直到訊號解除。
- **極端恐慌破冰 (Panic Buy)**：
  - 當發生「深跌」＋「RSI極端超賣」＋「VIX 飆升至危險水位」時，系統會無視任何冷卻期，建議執行逆勢破冰加碼。
- **停利與動態冷卻期 (Cooldowns)**：
  - 常規買入後會啟動冷卻期保護，且該冷卻倒數據實排除週末與 `TWSE` 國定休假日，計算出真實的「交易日」。
  - 結合維持率保護（例如追繳風險警告或再平衡自動降槓桿），嚴守風控底線。

### 新聞抓取的頻率與限制
- **白名單與防呆排除**：內建長串的黑名單正規表達式 (`usExcludeKeywords`、`twExcludedSources`)，主動濾除個股財報發布、目標價調整文章及特定內容農場（如 Stock Traders Daily）。
- **流量限制防護**：
  - 過濾條件限縮至「最近 24 小時內 (`when:1d`)」。
  - 同一媒體來源 (`source`) 避免主導所有版面（上限 2 篇），並強制剔除字數過短的防呆標題。
  - 先去重、降噪後，最多只將台/美各前 N 筆重要新聞傳入 AI，確保其 Token 消耗與 Rate Limit 處於安全範圍。

## 4. 資料傳遞 (Data Routing)
這些模組屬於處理中介層，其計算完的決策與市場資料打包方式：
1. **策略物件打包**：`strategyEngine.mjs` 會吐出一個包含如 `marketStatus`、`weightScore` 與具體的 `suggestion` 建議文案的龐大狀態物件（包含維持率狀態、過熱因子追蹤等）。
2. **傳遞至 AI 決策層**：打包好的狀態物件會做為上下文，連同 `newsFetcher` 初步過濾後的高品質 RSS 新聞，一併送交給下一層 `src/modules/ai/` 內的「決策大腦 (AI Coach)」。
3. **產出最終指引**：AI 大腦觀察這些「已經轉換好的人類可讀指標與中文建議」後，便會以此為準則進行寫作，發布當日的 Telegram AI 投資備忘錄。
