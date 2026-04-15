# InvestmentLineNotify 槓桿質押策略 2.3-best 架構與邏輯檢視報告

## 一、執行摘要

InvestmentLineNotify 目前的槓桿質押策略（Strategy 2.3-best）是以「0050 現股 + 00675L 槓桿 ETF」為核心標的，結合技術指標、估值、槓桿結構、VIX 恐慌指標與 AI 總經情緒，形成一套具備多層風控與左側加碼、右側獲利了結邏輯的混合式決策引擎。策略配置與訊號計算完全外掛在 Strategy.json，可線上調參且具備 cache 與本地備援。整體架構在工程上相當穩健，風控層級清晰，但在部分判斷順序與參數設計上仍有可優化之處，例如追繳風險判斷被較寬鬆的保護門檻遮蔽、RSI 超賣門檻偏高、minDropPercentToConsider 設為 0 使跌幅條件失去實質過濾效果，以及 leverage.targetMultiplier 尚未在實際計算中發揮作用等。

---

## 二、整體架構

### 2.1 系統層級架構

系統採多 runner + 長駐 Bot + API Server + Mini App 的分層設計：

- Entry Layer 由 crontab 觸發 `runDailyCheck.mjs` 等 runner，Bot Layer 透過 `/daily` 等指令調用相同核心邏輯，API Layer 提供唯讀 HTTP 介面給 Mini App 使用，Frontend Layer 以 Vue 3 建構 7-tab 儀表板。整體決策與風控邏輯集中於 Decision Layer（`src/modules/strategy/` + `src/modules/ai/`），資料來源與快取由 Providers Layer 與 Persistence Layer 負責。
- Daily pipeline 的主 orchestrator 為 `src/dailyCheck.mjs`，依序完成持股狀態繼承、開市檢查、VIX / 基準價 / 總經資料抓取、技術指標計算、新聞摘要與 AI 總經分析，再呼叫策略引擎與 AI Coach，最後透過 Notifications 模組輸出到 Telegram 與報告檔案。

### 2.2 策略模組定位

策略與市場資料相關邏輯集中於 `src/modules/strategy/` 與 `src/modules/newsFetcher.mjs`，前者負責將價格／指標／帳戶狀態轉成可執行投資訊號，後者負責新聞收集與去噪，兩者共同構成 percepton + signal layer。

- `indicators.mjs` 計算 RSI / MACD / KD 以及交叉、反轉等 helper。
- `signalRules.mjs` 讀取並驗證 Strategy.json，計算 entry score、過熱狀態、轉弱觸發與賣出訊號。
- `riskManagement.mjs` 負責依分數決定目標槓桿、預備金達成率與極端恐慌跌幅門檻。
- `strategyEngine.mjs` 將指標、風控、冷卻期與總經情緒整合為最終決策（`marketStatus`、`targetSuggestion`、`weightScore` 等）。

### 2.3 AI 決策層與策略的關係

AI Pipeline 以 `src/modules/ai/aiCoach.mjs` 為核心，負責產生搜尋關鍵字、新聞過濾、macro analysis 與投資建議，並透過 `macroMarketDirection` 將總經方向（BULLISH / BEARISH / NEUTRAL）回灌至策略引擎。

- Daily pipeline 中，策略引擎輸出的量化訊號（`result`）與 portfolio state、VIX、macroAnalysis、news summary 等一起注入 `getAiInvestmentAdvice()`，由 AI Coach 生成最終文字建議與風險說明。
- 週報與月報則由 `periodReportAgent.mjs` 直接讀取 `data/reports/` 的歷史 daily signals 做 second-order 分析，不重跑 daily pipeline。

---

## 三、日內流程與策略決策流程

### 3.1 DailyCheck 主流程

DailyCheck 的主要步驟如下：

1. 從 Google Sheets 讀取前一日持股與借款狀態，若失敗則以全 0 預設值繼承。
2. 透過 `isMarketOpenTodayTWSE()` 判斷是否為開市日，若休市仍繼續抓資料但可以選擇不推播。
3. 取得台指 VIX、BasePrice（從 BasePrice.txt 取最後一行基準價）、總經與籌碼資料（含 CNN 恐慌、景氣燈號、匯率、美股風險、估值與大盤量價概覽）。
4. 抓取 00675L 一年歷史價量、0050 即時價或收盤價、00675L 即時價或收盤價，並呼叫 `calculateIndicators()` 計算 RSI、MACD、Slow KD 及 240MA 與乖離率。
5. 透過 `newsFetcher.mjs` 取得新聞集錦與矛盾分群摘要，交給 `analyzeMacroNewsWithAI()` 產出 macroAnalysis 與 `market_direction`。
6. 組合 `signalData`（包含 RSI、KD、currentPrice、basePrice、VIX、ma240、portfolio、指標陣列、macroMarketDirection 等），呼叫 `getInvestmentSignalAsync()` 取得量化決策結果。
7. 載入前次 AI 建議摘要，呼叫 `getAiInvestmentAdvice()` 生成當日 AI 分析與 action items。
8. 透過 `broadcastDailyReport()` 發送 Telegram 訊息，並寫入 Google Sheets 與 `data/reports/`，最後條件性執行 `llmJudge` 作為品質監控。

### 3.2 策略引擎內部流程

`getInvestmentSignalAsync()` 會先透過 `fetchStrategyConfig()` 從 `STRATEGY_URL` 讀取 Strategy.json，通過嚴格 schema 驗證後快取於記憶體並同步備份至本地。

1. `evaluateInvestmentSignal()` 依 BasePrice 計算 `priceChangePercent`、`priceUpPercent` 與 `priceDropPercent`，並推導 0050 與 00675L 現值、維持率、淨資產與 00675L 佔比（`z2Ratio`），同時計算 MA240 與 240 日乖離率 `bias240`，以及 portfolio 實際槓桿倍數。
2. 依 `strategy.macroSentiment` 與 `macroMarketDirection` 組出 macroSentiment 物件，並依 BEARISH 狀態以 `bearishCooldownMultiplier` 放大冷卻期交易日數。
3. 呼叫 `checkCooldown()` 以 TWSE 假日與週末計算自最後買入日至今的「交易日」數，推導是否仍在冷卻期與剩餘交易日。
4. 呼叫 `computeEntryScore()` 以跌幅、RSI 反彈、MACD 黃金交叉、KD 低檔交叉與 macroSentiment bonus/penalty 計算加碼評分 `weightScore`，並保留詳細構成於 `weightDetails`。
5. 呼叫 `computeOverheatState()` 以 RSI、KD(D)、240 乖離率判斷是否過熱與命中因子數；`computeReversalTriggers()` 判斷 RSI / KD / MACD 是否出現轉弱訊號；`computeSellSignals()` 統計 RSI / MACD / KD 賣出訊號數。
6. 將上述 context 交由 `buildDecision()`，依維持率、估值、槓桿結構、停利條件、極端恐慌、過熱與轉弱、進場條件與冷卻期順序，一路下判至最終 `marketStatus` 與 `targetSuggestion`。

---

## 四、交易策略與使用指標說明

### 4.1 技術與價格指標

1. **RSI (14)**
   - 使用 technicalindicators 套件的 14 日 RSI，運算基礎為歷史收盤價序列。
   - 入場邏輯透過 `roseAboveAfterBelow(rsiArr, oversold)` 判斷 RSI 曾跌破 `oversold` 後再回到其上方，即視為反轉訊號（RSI 反彈加分）。目前 Strategy.json 將 `buy.rsi.oversold` 設為 50，反轉門檻相對偏高。

2. **KD (Slow KD 9,3,3)**
   - 先用 Stochastic(9,3) 算出 Fast %K / %D，再對 Fast %K 取 3 日 SMA 得到 Slow K，再對 Slow K 取 3 日 SMA 得到 Slow D；策略中以 Slow KD 作為判斷基礎。
   - 入場部分透過 `kdCrossUp(kdArr)` 搭配 `wasBelowLevel(kdArr, oversoldK, 10)` 判斷低檔黃金交叉（K、D 曾 <= oversoldK，且近期出現黃金交叉），賣出部分則使用 KD 死叉與自高檔跌破 overboughtK 的條件。

3. **MACD (12,26,9)**
   - 使用 EMA(12) / EMA(26) 與 Signal(9) 計算 MACD 指標，入場以 `macdCrossUp` 判斷由空翻多的黃金交叉，賣出則以 histogram 或 MACD-Signal 差值跌破 0 的 `fellBelowAfterAbove` 判斷死叉。

4. **240 日乖離率與歷史位階**
   - 以近 240 日收盤價平均作為 MA240，計算 `bias240 = (currentPrice - ma240) / ma240 × 100`，並用來判斷歷史位階（極高位階 / 高位階 / 中位階 / 低位階），同時作為過熱判斷三因子之一。

### 4.2 槓桿與結構指標

1. **維持率與追繳風險**
   - 維持率以「0050 現值 / 融資餘額 × 100」計算，若無借款則給定 999 作為無風險狀態。
   - `maintenance.protectTrigger`（目前 160）以下會觸發「預備金防禦」模式，計算為達 `protectTarget` 所需的補充抵押金額與預備金是否足夠；`threshold.mmDanger`（目前 140）以下設計為「追繳風險，一票否決」，理應更嚴格。

2. **00675L 佔比與再平衡**
   - `z2Ratio = currentZ2Value / netAsset × 100`，`threshold.z2RatioHigh`（目前 45）以上視為槓桿 ETF 過度集中，若超過的金額大於 `threshold.minActionableAmount` 則建議賣出 00675L 還款，使 00675L 佔比回到 `threshold.z2TargetRatio`（目前 0.4，即 40%）。

3. **實際槓桿倍數**
   - `grossAsset = 現股 + 槓桿 ETF + 現金`，`actualLeverage = grossAsset / netAsset` 用於顯示整體槓桿倍數，但實際決策主要仍以 z2Ratio 與配置表中的 leverage 比例為主。

### 4.3 VIX 與總經情緒

1. **台指 VIX 與恐慌等級**
   - Daily pipeline 讀取台指 VIX，並透過 Strategy.json 的 `threshold.vixLowComplacency`、`vixHighFear`、`vixPanic`、`vixExtreme` 等參數定義自滿、恐慌、極端恐慌區間。目前極端恐慌買入條件採用 `vix >= vixPanic (28)`，且 `vix >= vixExtreme (35)` 時進一步放大建議槓桿。

2. **MacroSentiment 與冷卻期調整**
   - AI Macro Analyst 會輸出 `market_direction`，再透過 `buildMacroSentiment()` 與 Strategy.json 中的 `macroSentiment` 配置轉成 bonus/penalty：BULLISH 加分（目前 +3）、BEARISH 扣分（目前 -5），並在空頭情緒下用 `bearishCooldownMultiplier`（目前 1.5）延長冷卻期交易日數。

### 4.4 預備金與資金分層

1. **預備金目標**
   - `getReserveStatus()` 依淨資產對應 `reserve.tiers` 取得預備金目標比例（目前：≤100 萬 5%、≤300 萬 8%、以上 10%），計算預備金達成率與是否低於 80% 判定不足。
   - `reserve.allocationRatio`（目前 0.5）在現有程式中未被引用，僅 tiers 生效。

2. **策略配置與分數檔位**
   - Strategy.json 的 allocation 表以 `minScore` 作為分段閾值，對應目標 00675L 槓桿比與現金比重，例如分數 ≥10 時 `leverage=0.8, cash=0.2`（註解標記為「槓桿全開(1.8x)」），分數 8–9.9 對應 0.6，6–7.9 對應 0.4，4–5.9 對應 0.2，其餘回到底倉 0.15。

---

## 五、分數與進出場判定方式

### 5.1 Entry Weight Score 組成

`computeEntryScore()` 的加碼評分由以下項目累加：

- **跌幅得分 (`dropScore`)**：依 `priceDropPercent` 落在哪一個 `dropScoreRules` 檔位，例如跌幅 ≥40% 得 8 分、≥30% 得 6 分、≥25% 得 5 分、≥15% 得 4 分、≥10% 得 3 分；未達最低檔則為 0 分，並以文字描述實際跌幅。
- **RSI 反轉得分 (`rsiScore`)**：若近 10 根 RSI 曾 ≤ `buy.rsi.oversold`（目前 50），且現值已站回其上視為反轉，給予 `buy.rsi.score`（目前 3 分）。
- **MACD 黃金交叉得分 (`macdScore`)**：近期 MACD 從 MACD ≤ Signal 轉為 MACD > Signal，且 histogram > 0，則給 `buy.macd.score`（目前 2 分）。
- **KD 低檔交叉得分 (`kdScore`)**：KD 由低檔黃金交叉，且近 10 根 K 值曾低於 `buy.kd.oversoldK`（目前 20）時給予 `buy.kd.score`（目前 2 分）。
- **總經情緒加減分 (`sentimentScore`)**：若 macroSentiment 啟用且有方向，BULLISH 加 `macroSentiment.bullishBonus`（目前 3 分），BEARISH 扣 `macroSentiment.bearishPenalty`（目前 5 分），NEUTRAL 不加減；並寫入 `sentimentInfo` 供說明。

最終評分 `weightScore = dropScore + rsiScore + macdScore + kdScore + sentimentScore`，同時回傳詳細的 `weightDetails` 用於報告與除錯。

### 5.2 進場門檻與檔位對應

1. **進場門檻**
   - `dropOk`：`priceDropPercent >= buy.minDropPercentToConsider`，目前設定為 0，實務上等於永遠為真。
   - `scoreOk`：`weightScore >= buy.minWeightScoreToBuy`，目前為 4 分。
   - 在過熱與轉弱條件未觸發、非冷卻期且未被風控前置條件擋住時，只有同時滿足 `dropOk && scoreOk` 才會進入加碼或底倉邏輯。

2. **分數對應配置**
   - 在通過各風控與冷卻檢查後，以 `getTargetLeverageByScore(weightScore, strategy)` 查詢對應 allocation bracket。
   - 若 `weightScore >= threshold.wAggressive`（目前 10）則進入「強勢進攻」檔位，建議將槓桿提升至對應 leverage，例如 80%；若 `weightScore >= threshold.wActive`（目前 8）則為「轉多加碼」檔位；其餘達進場門檻但未達上述閾值則視為「常態布局」使用底倉設定。

3. **冷卻期邏輯**
   - `strategy.trading.cooldownDays`（目前 20 交易日）為基礎，若 macroMarketDirection 為 BEARISH 且 macroSentiment 啟用，則以 `bearishCooldownMultiplier`（目前 1.5）放大至 30 交易日，透過 `checkCooldown()` 以 TWSE 假日與週末計算已過交易日數。
   - 若已達進場分數與跌幅條件但仍在冷卻期，則回傳「冷卻期中」訊息，明確說明剩餘交易日與阻擋原因，避免頻繁加碼。

### 5.3 極端恐慌與右側賣出

1. **極端恐慌破冰加碼**
   - `getExtremeDropThreshold()` 以 `buy.panic.minDropRank`（目前 2）取第二高跌幅檔位（即 minDrop=30），作為極端恐慌所需的最小跌幅門檻。
   - 若同時滿足：
     - `priceDropPercent >= extremeDropThreshold`（約 >=30%）、
     - `rsi < extremeRsiThreshold`，其中 `extremeRsiThreshold = oversold / rsiDivider`（50 / 1.6 ≈ 31）、
     - `VIX >= threshold.vixPanic`（目前 28），
       則觸發恐慌加碼段落，不受一般冷卻期限制。
   - 建議槓桿 `suggestedLeverage` 預設為 0.3（即 30% 槓桿 ETF 佔比），若 VIX ≥ `vixExtreme`（35）則提高至最多 0.5，並附帶明確風險警示與分批執行建議。

2. **右側停利與降槓桿**
   - `computeSellSignals()` 以 RSI、MACD、KD 的右側訊號計算 `signalCount`，需至少觸發 `sell.minSignalCountToSell`（目前 2）項賣出訊號，且 `priceUpPercent >= sell.minUpPercentToSell`（目前 80%）才會進入停利邏輯。
   - 停利時使用 `getPostSellAllocation(strategy)` 取得 allocation 陣列倒數第 `postAllocationIndexFromEnd`（目前 2）個配置，作為降槓桿後的目標槓桿與現金比例，計算應賣出的 00675L 金額並建議還款，使槓桿降至該檔位的 leverage。

3. **過熱與轉弱防追高**
   - 當 `computeOverheatState()` 判斷命中因子數（RSI 高、KD 高、乖離率高）達 `threshold.overheatCount`（目前 2）時，直接進入「極度過熱：禁止撥款」狀態，限制 00675L 撥款但保留 0050 定期定額與質押。
   - 當 `computeReversalTriggers()` 命中項目數（RSI 跌破、KD 跌破、KD 死叉、MACD 死叉）達 `threshold.reversalTriggerCount`（目前 3）時，進入「轉弱監控：停止加碼」狀態，停止對 00675L 的撥款與加碼。

---

## 六、邏輯合理性檢視與風險分析

### 6.1 較佳設計與優點

1. **配置與策略解耦**
   - Strategy.json 透過 URL 外掛並經 `validateStrategyConfig()` 嚴格驗證，確保策略邏輯穩定且可熱更新，並具備記憶體 cache 與本地檔案備援，降低遠端配置故障時對決策的影響。

2. **多層風控與一票否決機制**
   - 決策順序由維持率與估值風險開始，再到槓桿結構再平衡、停利、極端恐慌加碼、過熱禁撥、轉弱停加碼與一般進場條件，明確遵守「風控優先於收益」的原則。
   - 追繳風險（mmDanger）、估值泡沫（PB>2.2）與再平衡條件均會在進場與加碼前被檢查，避免在高風險狀態下仍被常態訊號誤導。

3. **冷卻期與總經情緒交互作用**
   - 冷卻期以實際交易日計算，並透過 TWSE 假日 API 合併假日集合，避免跨假日被視為過多交易日；空頭情緒時延長冷卻期，有助於在壞環境中減少交易頻率與槓桿使用。

4. **極端恐慌與左側加碼的明確條件**
   - 恐慌加碼條件同時要求大跌、RSI 重度超賣與高 VIX，並限制建議槓桿上限，且明示「僅在維持率充足時執行，建議分批」，相對兼顧左側逆勢加碼與風險管理。

5. **歷史回測支援**
   - `src/test/backtest.mjs` 重用指標與策略引擎邏輯，可針對 Strategy.json 的各種參數組合做歷史回測，驗證不同檔位與門檻下的報酬與風險表現，減少主觀調參風險。

### 6.2 潛在邏輯問題與風險點

1. **維持率保護與追繳風險判斷順序互相遮蔽**
   - `buildDecision()` 中先檢查 `maintenanceMargin < maint.protectTrigger`（目前 160）並直接 return 預備金防禦建議，緊接著才檢查 `maintenanceMargin < th.mmDanger`（目前 140）進入追繳風險一票否決。
   - 在現有參數下，當維持率 <140 時必然也 <160，因此永遠先命中保護段落，追繳風險分支實際上無法被觸發，等同失效。
   - 建議：將追繳風險檢查提前到保護門檻之前，或將 `protectTrigger` 設為低於 `mmDanger`，以維持「最嚴格風控優先」的邏輯順序。

2. **RSI 超賣門檻偏高導致訊號過於頻繁**
   - 目前 `buy.rsi.oversold` 設為 50，`roseAboveAfterBelow()` 判斷只要 RSI 在 10 根內曾低於 50 並回到其上，即視為反轉給予 3 分；在多頭盤中 RSI 穿越 50 的情況相當常見，可能使評分在趨勢盤中經常被技術面加分。
   - 若配合較寬鬆的跌幅條件（甚至為 0）使用，容易讓策略偏向右側追多而非深度左側佈局，與「生命週期投資、左側加碼」的初衷稍有偏離。

3. **minDropPercentToConsider=0 使跌幅條件失去過濾效果**
   - `buy.minDropPercentToConsider` 目前為 0，導致 `dropOk` 幾乎無條件成立，實際進場門檻僅剩下 `weightScore >= minWeightScoreToBuy`。
   - 在此設定下，小幅震盪下只要 RSI / MACD / KD 組合分數達門檻就可能觸發「常態布局」或「加碼」訊號，與「至少修正 X% 才啟動撥款」的直覺有所落差。

4. **估值泡沫門檻硬停機但缺少漸進式降速區間**
   - 當 PB ≥2.2 時直接進入「估值泡沫：停止加碼、建議降槓桿」，屬於 hard stop；然而在 PB 自 1.8–2.2 區間內並沒有明確降速或降低目標槓桿的邏輯，僅能依靠技術與 VIX 等訊號自然降溫。
   - 若台股長期處於偏高 PB 區間，策略可能在 PB<2.2 時仍維持較高槓桿目標，與長期估值風險容忍度是否匹配，需要結合回測與主觀風險偏好進一步確認。

5. **停利門檻錨定在 BasePrice，條件偏高且高度依賴外部維護**
   - 停利須同時滿足 `priceUpPercent >= 80`（相對 BasePrice 上漲 80%）與至少兩項賣出訊號，才能觸發「停利/降槓桿」邏輯。
   - BasePrice 由外部 BasePrice.txt 提供，若更新頻率偏低，實際上可能長期不會觸發停利分支；反之若 BasePrice 過於接近當前價，也可能短期內就觸發停利。管理不當會使右側獲利邏輯失效或過於頻繁。

6. **macroSentiment 雙重抑制效果需注意在深度修正時的行為**
   - 在 BEARISH 環境下，同時有 (1) sentimentScore 扣分（目前 -5），(2) 冷卻期乘以 1.5 的延長效果；若行情已大跌且符合極端恐慌條件，但 AI Macro 仍判定 BEARISH，可能長時間阻擋一般加碼，只留下恐慌加碼通道。
   - 若外部新聞長期偏空，策略可能在估值合理甚至偏低時仍因情緒扣分與冷卻期過長而偏向「右側保守」，需要透過回測觀察實際行為。

7. **配置欄位與命名的潛在混淆與未使用欄位**
   - Strategy.json 中的 `leverage.targetMultiplier`（目前 1.8）並未在現有程式中被引用，實際槓桿控制完全由 allocation 中的 `leverage` 比率決定，註解中提到的「1.8x」只是描述而非程式運算結果。
   - 同樣地，`reserve.allocationRatio` 未被 `getReserveStatus()` 使用，實際生效的是 tiers。若未來需要以單一 allocationRatio 控制預備金比例，需補充整合邏輯。

8. **冷卻期依賴 lastBuyDate 欄位是否確實維護**
   - `checkCooldown()` 依 `portfolio.lastBuyDate` 計算交易日數，若 Google Sheets 未寫入或寫入格式不一致，則會被視為「無歷史買入紀錄」，冷卻期機制等同無效。
   - 必須確保每日實際執行加碼後能正確更新 lastBuyDate，否則冷卻期設計無法發揮抑制頻繁交易的效果。

9. **訊號描述 label 與邏輯不一致的小問題**
   - 在 `dropScoreRules` 中，`minDrop: 25, score: 5` 的 label 仍寫成「大跌 >= 20%」，文字描述與門檻不一致，雖不影響運算邏輯，但可能造成閱讀上的混淆。

---

## 七、風險控管建議與如何避免風險

1. **優先修正追繳風險判斷順序**
   - 調整 `buildDecision()` 中的條件順序，讓 `maintenanceMargin < mmDanger` 優先於 `protectTrigger`，確保真正進入追繳風險區間時能立即觸發「停止撥款、優先補保證金」訊息，而非僅顯示預備金防禦。

2. **調整 RSI 與跌幅門檻強化左側性質**
   - 將 `buy.rsi.oversold` 從 50 調降至 40 或 45，使 RSI 加分更專注於真正偏弱區間，減少在中性震盪時過度加分。
   - 將 `buy.minDropPercentToConsider` 從 0 調整至 5–10%，明確要求至少出現一定幅度的修正才啟動撥款判斷，以符合「左側交易」的直覺。

3. **在 PB 與 VIX 之間引入漸進式調整區間**
   - 在 PB 達到 1.8–2.2 區間時，降低 allocation 中的最大槓桿檔位或提高 `minWeightScoreToBuy`，使策略在估值偏貴但未到泡沫時漸進降速，而非僅依靠技術與 VIX。
   - 在 VIX 低於 `vixLowComplacency`（目前 12）時，可以適度降低技術分數權重或提高進場分數門檻，避免在過於平靜的高位震盪中用力加碼。

4. **重新檢視停利錨點 BasePrice 的維護策略**
   - 建議明確訂定 BasePrice 更新規則，例如每季或每次大幅回檔後重新設定，並在文件中記錄更新日與邏輯，避免停利邏輯長期失效或過於頻繁。
   - 亦可考慮將 `priceUpPercent` 改設為相對 MA240 或近 N 日低點的漲幅，而非單一 BasePrice 錨點，以提高自動化健壯度。

5. **MacroSentiment 負向影響的上限與回測驗證**
   - 目前 BEARISH 狀態同時有分數扣分與冷卻期延長兩層抑制，建議透過 `src/test/backtest.mjs` 在多種熊市樣本中驗證是否有「一直看空但估值已便宜」的情境，必要時可降低 penalty 或取消冷卻延長。

6. **強化 lastBuyDate 寫入與驗證**
   - 在每日實際執行加碼（特別是恐慌加碼）後，確保 Google Sheets 能正確寫入當日日期，並在 `logDailyToSheet` 或 storage 模組中加入簡單驗證，避免冷卻期被繞過。

7. **補上未使用欄位的實作或簡化配置**
   - 若 `leverage.targetMultiplier` 仍有設計意圖（例如用來自動推導 allocation 中的 leverage 檔位），可在 `getTargetLeverageByScore` 或評估邏輯中加入對 multiplier 的計算；否則建議自 Strategy.json 移除以降低認知負擔。
   - 同理，若未來預備金配置需要更動態的 allocationRatio，應補充其與 tiers 的關係（例如 tiers 為細緻 override），或移除 allocationRatio 以維持單一來源原則。

---

## 八、未來改善重點與可討論方向

1. **將生命週期投資維度顯性化**
   - 目前策略已隱含長期 DCA 與槓桿循環的設計，但未直接納入「年齡 / 投資年限 / 目標退休時點」等生命週期因子；未來可考慮將 lifecycle risk budget 明文化，如在接近目標年限時自動降低最大 leverage 檔位與恐慌加碼上限。

2. **拆分「常態 DCA」與「戰術加碼」兩條路徑**
   - 現有架構中，底倉與加碼均透過同一分數與 allocation 表驅動；可考慮將「0050 定期定額 + 小幅質押」視為 baseline，而大跌加碼與恐慌加碼使用獨立權重與風控（例如更嚴格的維持率與 VIX 條件），提升策略可解釋性與管控粒度。

3. **更細緻的左側 / 右側訊號拆解與報表呈現**
   - 週報與月報目前已提供 buy signal 數量與報酬率分析，但尚未明確標示哪些訊號屬於「左側大跌加碼」、「恐慌逆向」、「常態進場」或「右側停利」。
   - 可在 `periodReportAgent.mjs` 中納入訊號類型分類欄位，於月報中統計各類訊號的勝率與平均報酬率，協助調整各檔位權重與門檻。

4. **Mini App 與報告中的可視化說明**
   - 目前 Mini App 已顯示市場雷達、資產趨勢與報告列表，未來可新增「策略狀態頁」，直接展示當前 weightScore 構成（跌幅、RSI、MACD、KD、情緒）、當前所在 allocation 檔位與最近一次冷卻期狀態，有助於快速理解系統決策原因。

5. **加入單日最大撥款上限與累積加碼限額控制**
   - 雖然已有 `threshold.minActionableAmount`（避免太小金額）與冷卻期限制，但在極端行情下單次加碼金額仍可能偏大；可考慮在每日新增「單日最大新增借款金額」與「距上一次極端恐慌加碼的最小間隔」等約束，強化資金節奏控制。

---

## 九、結語

整體而言，InvestmentLineNotify 的槓桿質押策略在工程實作與風控設計上已相當完整，具備清楚的左側加碼條件、右側停利與多層風險防線，並透過 AI 總經情緒與冷卻期機制降低情緒化交易風險。主要需要關注的是部分判斷順序（追繳風險分支）、技術門檻與跌幅條件的設計是否與策略初衷一致，以及 BasePrice 維護與 macroSentiment 在長期偏空環境下的行為。透過 backtest 回測、週月報訊號分類與 Mini App 的可視化補強，可進一步調優分數與配置檔位，使策略在生命週期投資與左/右側交易的實務上更貼近預期。
