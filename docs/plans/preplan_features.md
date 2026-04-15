# Pre-plan Features (待評估與實作功能池)

---

## 📌【策略與績效】策略訊號回測與績效統計

### 狀態與目標摘要

- 目前僅有回測概念與資料來源分析，尚未實作 runner。
- 計劃新增獨立 runner（例如 `src/runBacktest.mjs`）並與週/月報的統計結果整合。

### 動機

`strategyEngine.mjs` 目前依據 RSI、KD、MACD、VIX、MA240、`macroMarketDirection` 計算買賣訊號，但系統內無法驗證：

- 歷史上當「訊號 = 買進」時，後續 N 天的實際報酬率如何？
- 哪個指標對最終决策貢獻最大？

目前 `archiveManager` 已存 `signals` 快照，資料基礎存在，缺的是分析邏輯。

### 建議方向

新增一個 `runBacktest.mjs` runner，讀取 `data/archives/` 歷史快照 + Google Sheet 歷史價格，計算每次訊號後的 5/10/20 日報酬率，輸出 CSV 或 Telegram 月報附件。

此功能可與現有 `runMonthlyReport.mjs` 整合（月報時一併輸出回測摘要）。

### 影響範圍

- 新增 `src/runBacktest.mjs`（新 runner）
- `src/modules/data/archiveManager.mjs`（新增讀取歷史快照 API）
- `src/modules/storage.mjs`（讀取 Google Sheet 歷史收盤價）
- 可能新增 `src/modules/strategy/backtestEngine.mjs`

### 難度

⭐⭐⭐ 高（需設計回測邏輯與資料對齊）

### 討論狀態

⚪ 待確認

---

## 📌【AI 管線強化類】每日摘要語音化推播（Gemini TTS × Telegram Audio）

### 狀態與目標摘要

- 已有較完整的技術草案（Gemini TTS + ffmpeg + Telegram sendAudio），尚未落實為實際模組。
- 實作時需確認 AI pipeline、Langfuse 追蹤與每日推播流程的整合方式。

### 🎯 功能目標

將每日由 LLM 產生的市場摘要文字（AI 教練洞察、總經多空分析等），透過 Gemini TTS API（`gemini-2.5-flash-preview-tts`）轉換為語音音訊檔，再經由 Telegram Bot API 的 `sendAudio` 方法推播至指定頻道。

此功能定位為現有文字報告的「語音附件」，與三則文字訊息並列發送，不取代原有推播邏輯。

---

### 📁 影響範圍

| 模組 / 職責          | 預計異動                                                   | 路徑                                                          |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 語音合成服務（新增） | 新增 `ttsService.mjs`，封裝 Gemini TTS 呼叫與 PCM→MP3 轉換 | `src/modules/ai/`                                             |
| 摘要文字組裝邏輯     | 需擷取純文字版本（去除 HTML tag）供 TTS 使用               | `src/modules/notifications/templates/telegramHtmlBuilder.mjs` |
| Telegram 推播模組    | 新增 `sendAudio` 呼叫，於三則文字訊息後附加語音            | `src/modules/notifications/transports/telegramClient.mjs`     |
| 暫存音訊目錄         | 需於執行期間建立 `/tmp/tts/` 暫存目錄，流程結束後清除      | 專案根目錄下的 `/tmp/`                                        |

### 待確認清單

- 確認 aiAdvice / macroAnalysis 的實際資料結構與來源模組。
- 確認 TTS service 檔案最佳放置路徑。
- 確認每日推播流程中負責三則訊息發送的函式名稱與插入點。
- 確認 Gemini API key 分配策略與 Langfuse span wrapper 的使用方式。

---

## 📌【穩定性強化】Providers 統一 retry / timeout 機制

### 狀態與目標摘要

- 各 Provider 目前錯誤處理策略不一，網路抖動時可能導致整條 daily pipeline 中斷。
- 計劃統一透過 helper（例如 `fetchWithRetry`）包裝 `fetchWithTimeout`，逐步於 Providers 層導入。

### 動機

目前各 provider（`twseProvider`, `yahooProvider`, `cnnProvider` 等）各自處理錯誤，有些有 try/catch，有些直接拋出。`coreUtils.mjs` 已有 `fetchWithTimeout`，但未被所有 provider 統一使用。

### 建議方向

在 `src/utils/coreUtils.mjs` 或新增 `src/utils/fetchUtils.mjs` 中實作 `fetchWithRetry(url, options, retries=2)`，並在各 provider 統一引用。

### 影響範圍

- `src/utils/coreUtils.mjs`（新增 helper）
- `src/modules/providers/*.mjs`（逐步替換 fetch 呼叫）

### 難度

⭐⭐ 中（工具本身簡單，但需逐一審查各 provider 的 fetch 呼叫）

### 討論狀態

⚪ 待確認

---

## 📌【風控邏輯】維持率與追繳風險判斷重構

### 狀態與目標摘要

- `strategyEngine.mjs` 目前先以 `maintenance.protectTrigger` 觸發「預備金防禦」，再以 `threshold.mmDanger` 判斷「追繳風險」。 [cite:11]
- 在現有參數配置下（protectTrigger=160、mmDanger=140），追繳分支實務上會被前一層防禦邏輯遮蔽。

### 動機

維持率風控邏輯的原則應為「越危險的情境越先被檢出」，避免在真正接近斷頭區間時仍給出偏溫和的建議（例如僅提示動用預備金），而忽略「停止所有加碼、優先補保證金」的一票否決訊號。 [cite:11]

### 建議方向

- 調整 `buildDecision()` 判斷順序，將「追繳風險」判斷移到 `protectTrigger` 之前：
  - 先檢查 `maintenanceMargin < mmDanger` → 直接返回「🚨 追繳風險」決策。
  - 再檢查 `maintenanceMargin < protectTrigger` → 返回「🛡️ 預備金防禦」決策。
- 補充單元測試／回測樣本（模擬維持率 120、135、155 等情境），確保 refactor 後訊息與建議文案符合預期。
- 在每日報告中額外標註「風控層級（正常／防禦／追繳）」欄位，便於長期觀察策略遇到低維持率時的行為。

### 影響範圍

- `src/modules/strategy/strategyEngine.mjs`（`buildDecision()` 判斷順序與文案） [cite:11]
- `src/modules/notifications/templates/telegramHtmlBuilder.mjs`（如需新增風控層級展示）
- 週／月報統計可選擇新增「近 X 日觸發追繳風險次數」統計（未必為此階段必要）

### 難度

⭐⭐ 中（邏輯本身簡單，但需謹慎測試所有分支）

### 討論狀態

⚪ 待確認

---

## 📌【策略門檻】RSI / 跌幅與估值多階門檻優化

### 狀態與目標摘要

- Strategy.json 中 `buy.rsi.oversold` 目前設定為 50，`minDropPercentToConsider` 為 0。 [cite:9]
- 估值泡沫僅在 PB ≥ 2.2 時啟動硬停機，PB 1.8–2.2 區間尚未有漸進式降速設計。 [cite:11]

### 動機

- RSI 超賣門檻過高會造成「只要 RSI 穿越 50 就視為反轉」的現象，使策略在多頭震盪中也頻繁加分。
- 跌幅門檻為 0 代表技術分數一旦達標就可能觸發加碼，與「至少修正一定幅度才啟動左側加碼」的直覺不符。
- PB 僅在極端值時硬停，可能忽略高估但尚未進入泡沫區間的漸進式風險。

### 建議方向

- **RSI 與跌幅門檻調整**
  - 將 `buy.rsi.oversold` 往下調整到 40–45 區間，集中在真正偏弱時才給加分。
  - 將 `buy.minDropPercentToConsider` 提升至 5–10%，強制要求至少出現小幅修正才啟動撥款判斷。
  - 規劃兩組以上參數（例如 conservative / aggressive profile），透過 `Strategy.json` 版本號或環境變數切換，並用 backtest 驗證差異。

- **估值多階門檻**
  - 新增一組估值區間（例如 PB 1.8–2.2），在此區間内降低最大可用槓桿檔位或提高進場分數門檻。
  - 將 PB 與 VIX / RSI 過熱判斷整合成「高估但未泡沫」狀態，提示使用者以較低節奏執行 DCA。

### 影響範圍

- `Strategy.json`（調整 `buy.rsi.oversold`、`buy.minDropPercentToConsider`、新增估值區間參數）
- `src/modules/strategy/signalRules.mjs`（如需支援多 profile 或新的估值條件） [cite:9]
- `src/test/backtest.mjs`（回測不同門檻組合並輸出簡要比較報告） [cite:12]

### 難度

⭐⭐⭐ 高（涉及行為改變，需回測與長期觀察）

### 討論狀態

⚪ 待確認

---

## 📌【停利機制】BasePrice 管理與動態停利邏輯

### 狀態與目標摘要

- 停利條件建立在 `priceUpPercent >= sell.minUpPercentToSell`，其中 `priceUpPercent` 是相對 BasePrice 的漲幅，目前門檻為 80%。 [cite:11][cite:13]
- BasePrice 來自外部 `BasePrice.txt`，尚未明文化更新頻率與規則。 [cite:13]

### 動機

- 若 BasePrice 長期不更新，實務上停利條件可能多年都無法被觸發。
- 若 BasePrice 更新過於頻繁，停利會過度敏感，導致槓桿在短期內被頻繁拉低。
- 目前停利錨點無法自動對應技術結構（例如相對 MA240 或近 N 日低點）。

### 建議方向

- **BasePrice 管理策略**
  - 在 docs 中定義 BasePrice 更新規則（例如每季、或當 MA240 改變超過某比例時重置）。
  - 規劃 `scripts/update-base-price.sh`，由人工觸發或特定條件下自動寫入新 BasePrice（搭配 Git 記錄）。

- **動態停利設計**
  - 增加可選模式：以相對 MA240 / 近 N 日低點 / 前一波恐慌加碼點位作為停利錨點。
  - 在 `strategyEngine.mjs` 中加入參數選項，允許在 Strategy.json 指定 `sell.anchorType = basePrice | ma240 | swingLow`。 [cite:11]

- **報告與監控**
  - 於日報中顯示目前停利錨點來源與數值（例如「錨點 = BasePrice 75 元，+80% 為 135 元」）。
  - 於月報統計過去 N 次觸發停利的平均報酬率與後續回檔幅度，幫助調整門檻。

### 影響範圍

- `src/modules/providers/basePriceProvider.mjs`（BasePrice 來源與錯誤處理） [cite:13]
- `src/modules/strategy/strategyEngine.mjs`（停利 anchor 設計與分支邏輯） [cite:11]
- 文件：新增 BasePrice 管理章節於 `docs/modules/market_strategy.md` 或 `docs/architecture.md`。 [cite:2][cite:5]

### 難度

⭐⭐⭐ 高（需要兼顧易用性與可解釋性）

### 討論狀態

⚪ 待確認

---

## 📌【冷卻期與情緒】MacroSentiment 交互與回測驗證

### 狀態與目標摘要

- BEARISH 環境下同時存在分數扣分（`bearishPenalty`）與冷卻期延長（`bearishCooldownMultiplier`）。 [cite:9][cite:11]
- 目前尚未有系統性回測顯示「長期偏空新聞」情境下的實際加碼行為。

### 動機

- 雙重抑制有利於在壞環境中減少加碼，但在估值已偏低時可能過度保守。
- 若 AI Macro 長期判定偏空（例如景氣循環谷底），策略可能長時間停留在觀望狀態。

### 建議方向

- 在 `backtest.mjs` 內加入 macroSentiment 維度回測：
  - 比較「有 sentimentScore + 冷卻延長」與「僅 sentimentScore 或僅冷卻延長」三種模式的績效。
  - 觀察 BEARISH 區間內的平均進場次數、勝率與最大回撤。 [cite:12]
- 考慮增加上限：
  - 例如在估值低於某 PB 或 PE 閾值時，關閉冷卻延長效果但保留分數扣分。
  - 或在連續 N 天 BEARISH 卻持續大跌時，強制允許恐慌加碼通道。

### 影響範圍

- `Strategy.json`（調整 `macroSentiment.bearishPenalty`、`bearishCooldownMultiplier` 或新增「估值例外」參數）
- `src/modules/strategy/strategyEngine.mjs`（冷卻天數計算與 message 註記） [cite:11]
- `src/test/backtest.mjs`（新增 macroSentiment 模式回測） [cite:12]

### 難度

⭐⭐⭐ 高（涉及行為層調整與回測）

### 討論狀態

⚪ 待確認

---

## 📌【資料完整性】lastBuyDate 與策略欄位一致性檢查

### 狀態與目標摘要

- 冷卻期依賴 `portfolio.lastBuyDate`，來源為 Google Sheet 持股紀錄。 [cite:11][cite:14]
- 若該欄位缺失或格式錯誤，冷卻期會被視為「無歷史買入紀錄」，等同關閉。

### 動機

冷卻期是防止短期內頻繁加碼與槓桿快速堆疊的關鍵機制，必須確保資料來源可靠，否則策略會默默退化成「無冷卻限制」的版本。

### 建議方向

- 在 `fetchLastPortfolioState()` 中增加 `lastBuyDate` 的格式驗證：
  - 若無法解析為合法日期，應在日報中顯示警告並回寫 log。
- 在每日實際觸發買入（特別是恐慌加碼）後，確保 `logDailyToSheet()` 有寫入當日為最新 lastBuyDate。 [cite:14]
- 於 `AccountView.vue` 或 Mini App 新增一個小卡片顯示：
  - 最後一次買入日期。
  - 冷卻期剩餘交易日。

### 影響範圍

- `src/modules/storage.mjs`（lastBuyDate 讀寫與驗證）
- `src/dailyCheck.mjs`（呼叫 `logDailyToSheet` 的欄位確認） [cite:14]
- `webapp/src/views/AccountView.vue`（新增展示冷卻期資訊） [cite:5]

### 難度

⭐⭐ 中（資料流確認為主）

### 討論狀態

⚪ 待確認

---

## 📌【策略欄位清理】未使用欄位與 label 一致性

### 狀態與目標摘要

- `Strategy.json` 中 `leverage.targetMultiplier` 與 `reserve.allocationRatio` 目前尚未被策略引擎實際使用。 [cite:9][cite:10][cite:11]
- `buy.dropScoreRules` 中存在 label 與 minDrop 不一致的情形（例如 minDrop=25, label「大跌 >= 20%」）。 [cite:9]

### 動機

保持策略配置檔與程式邏輯的一致性，有助於未來調參與除錯，也避免日後忘記原意造成誤用。

### 建議方向

- 欄位用途決策：
  - 若 `leverage.targetMultiplier` 只是註解性描述，建議移除。
  - 若預計未來用來推導 allocation 槓桿值，可在 `getTargetLeverageByScore` 中正式引入計算公式。
  - 同理，若 `reserve.allocationRatio` 不再使用，可刪除或在文件中明示為 legacy 欄位。
- 修正 label：
  - 將所有 `dropScoreRules` 的 label 與 minDrop 對齊，避免文案與邏輯不一致。

### 影響範圍

- `Strategy.json`（欄位調整與 label 修正）
- `docs/modules/market_strategy.md`（如有描述相關欄位需同步更新） [cite:2]

### 難度

⭐ 低（主要是配置清理與文件同步）

### 討論狀態

⚪ 待確認

---

## 📌【策略演化】生命週期風險預算與槓桿曲線

### 狀態與目標摘要

- 目前策略 implicitly 假設使用者風險承受度固定，未顯式納入「年齡 / 投資年限 / 距離目標年」等生命週期參數。
- allocation 槓桿檔位主要依 weightScore 決定，與投資年齡無關。 [cite:11]

### 動機

生命週期投資法通常會在投資早期容忍較高風險與槓桿，接近目標年份時逐步降低風險曝險。現有設計在工程上已具備彈性，但缺少這個 explicit 維度。

### 建議方向

- 定義生命週期 Profile：
  - 例如「早期累積期」「中期平衡期」「後期保守期」，每個 profile 各自對應 allocation 表（不同最大 leverage 與底倉槓桿）。
- 生命週期參數來源：
  - 初期可先在 `.env` 或 Google Sheet 設定「目標年份」「出生年份」等，後續再考慮在 Mini App 做 UI 調整。
- 策略引擎整合：
  - 在 `fetchStrategyConfig()` 或 `evaluateInvestmentSignal()` 中讀取當前 profile，動態選用對應的 allocation 陣列或調整分數檔位。 [cite:9][cite:11]

### 影響範圍

- `Strategy.json`（新增 lifecycleProfiles 區段）
- `src/modules/strategy/riskManagement.mjs`（依 profile 選擇 allocation） [cite:10]
- `webapp` Mini App 未來可新增生命週期設定頁面

### 難度

⭐⭐⭐ 高（牽涉策略設計與 UX）

### 討論狀態

⚪ 待確認

---

## 📌【策略拆分】Baseline DCA 與戰術加碼雙層架構

### 狀態與目標摘要

- 目前「底倉 DCA」與「顯著修正或恐慌時的戰術加碼」共同由同一分數機制與 allocation 表驅動。 [cite:11]
- 使用者在閱讀報告時較難分辨當日建議是屬於「持續佈局」還是「特殊戰術」。 [cite:5]

### 動機

將日常 DCA（例如穩定買入 0050 + 少量質押）與戰術性大幅加碼（例如恐慌加碼、左側大跌加碼）拆成兩條明確路徑，有助於解釋策略行為，也方便分別調整其風控參數。

### 建議方向

- 策略層拆分：
  - 新增一個 `baselineAllocation` 與 `tacticalAllocation` 概念，baseline 只受輕度技術與估值因素影響；tactical 則要求更嚴格的大跌／恐慌條件。
  - 在 `evaluateInvestmentSignal` 結果中明確標示 `signalType = baseline | tactical_drop | tactical_panic`。
- 報告與回測：
  - 周/月報在統計訊號準確率時分開統計 baseline 與 tactical 的勝率與平均報酬。
  - 在 Telegram 報告文案中以標題或 emoji 區分兩者（例如「🌱 常態布局」vs「⚡ 戰術加碼」）。

### 影響範圍

- `Strategy.json`（新增 baseline / tactical 配置）
- `src/modules/strategy/strategyEngine.mjs`（輸出 signalType 標籤） [cite:11]
- `src/modules/ai/periodReportAgent.mjs`（訊號分類與統計） [cite:6]
- Notifications 模板（加上清楚標籤） [cite:7]

### 難度

⭐⭐⭐ 高（涉及策略定義與報表）

### 討論狀態

⚪ 待確認

---

## 📌【報告強化】訊號類型分類與月報統計

### 狀態與目標摘要

- 現有週報、月報已統計買進訊號次數、冷卻封鎖比例與 +5/+10/+20 日報酬，但尚未標示訊號類型。 [cite:6]
- 使用者只能看到 aggregate 的績效，無法得知哪一種訊號（恐慌、一般大跌、常態進場）效果最好。 [cite:7]

### 動機

以「訊號類型」為維度分析績效，可以用來調整各檔位權重與門檻，例如：若恐慌加碼勝率高但樣本少，可考虑略放寬條件；若某種一般加碼長期績效不佳，可適度調高分數門檻。

### 建議方向

- 在每日 `signals` 中加入 `signalCategory` 欄位：
  - 例如 `baseline`, `deep_drop`, `panic`, `take_profit`, `rebalance` 等。
- 在 `periodReportAgent.mjs` 的統計邏輯中：
  - 針對每一類訊號計算觸發次數、平均報酬率與勝率。
  - 月報中新增一節「各類訊號績效概覽」。

### 影響範圍

- `src/modules/strategy/strategyEngine.mjs`（標註 signalCategory） [cite:11]
- `src/modules/ai/periodReportAgent.mjs`（統計維度擴充） [cite:6]
- Telegram 月報模板（新增一段簡潔表格或列表） [cite:7]

### 難度

⭐⭐ 中（需要調整資料結構與報告模板）

### 討論狀態

⚪ 待確認

---

## 📌【前端體驗】Mini App 策略狀態與解釋視覺化

### 狀態與目標摘要

- 現有 Mini App 已提供市場雷達、資產淨值曲線、報告列表與新聞池。 [cite:5]
- 尚未有專門頁面集中展示「當前策略評分構成」、「所在分數檔位」與「冷卻期狀態」。

### 動機

在手機上快速理解「今天為何建議加碼／觀望／停利」，對實際使用體驗非常重要，也方便你自己 debug 策略行為。

### 建議方向

- 新增「策略狀態」區塊（可放在 Dashboard 或 Account 頁）：
  - 顯示 weightScore 以及構成（跌幅分數、RSI 分數、MACD 分數、KD 分數、情緒分數）。
  - 顯示目前對應的 allocation 檔位與目標槓桿比例。
  - 顯示冷卻期剩餘交易日與 lastBuyDate 摘要。
- UI / UX：
  - 可以用簡單的條形圖或小型雷達圖呈現各因子分數。
  - 點擊後顯示詳細文案，對應 daily report 的文字說明。

### 影響範圍

- `webapp/src/views/DashboardView.vue` 或 `AccountView.vue`（新增策略狀態卡片） [cite:5]
- `/api/status` 或 `/api/reports` 若尚未回傳 weightDetails，需後端擴充。 [cite:5][cite:14]

### 難度

⭐⭐ 中（主要是前端 UI 與 API 結構調整）

### 討論狀態

⚪ 待確認

---

## 📌【資金管控】單日 / 區間撥款上限控制

### 狀態與目標摘要

- 現有設計已透過冷卻期與再平衡控制槓桿節奏，但尚未顯式限制「單日最大新增撥款金額」與「區間累積加碼上限」。 [cite:11]
- 在極端行情下，多個訊號同時達標時仍有可能短期內大額放大槓桿。

### 動機

即使策略在邏輯上判斷「值得加碼」，仍有必要從資金管理角度限制一次性槓桿拉升的幅度，以降低人為執行失誤或黑天鵝的衝擊。

### 建議方向

- 新增風控參數：
  - `trading.maxDailyNetLoanIncrease`：單日最大淨新增借款金額。
  - `trading.maxRollingLoanIncreaseDays` / `trading.maxRollingLoanIncreaseAmount`：N 日內累計最大新增借款上限。
- 在 daily pipeline 中：
  - 根據當前 totalLoan 與建議 targetLeverage，計算預期新增借款額，若超出上限，將建議降檔（例如從「強勢進攻」改為「一般加碼」）或僅執行 baseline DCA。
- 可於月報中簡單列出「本月加碼資金節奏」摘要，幫助調整參數。

### 影響範圍

- `Strategy.json`（新增資金上限相關參數）
- `src/modules/strategy/strategyEngine.mjs`（加入資金上限判斷並調整 targetAllocation） [cite:11]
- `src/modules/storage.mjs`（若需要讀取過去 N 日借款變化）

### 難度

⭐⭐⭐ 高（需設計與現有冷卻／再平衡邏輯的相容性）

### 討論狀態

⚪ 待確認