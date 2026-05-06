# InvestmentLineNotify 投資設計評估與優化建議（0050 DCA + 00675L 槓桿 / 生命週期策略）

## 一、結論摘要

- 系統已明確區分「0050 Baseline DCA」與「00675L 槓桿戰術部位」，並以 `computeGrossLeverage`、`trading.maxDailyLoanIncreasePct`、`trading.maxRollingLoanIncreasePct`、`marginCallThreshold / frozenZone / protectTrigger` 等參數控制整體風險，方向符合生命週期投資法「長期穩健＋早期適度槓桿」的精神。
- 策略引擎已引入 RSI / KD / MACD / MA20 / ATR、VIX override、MacroSentiment、Baseline / Tactical allocation、BudgetSynergy 等模組，實作出「左側分批買進＋右側趨勢保護／減倉」的混合架構，投資方法上是合理且具可延展性的。
- 主要缺口在於：
  - 槓桿軌跡與生命週期（年齡／距離退休年）尚未完全收斂成統一的條件式；
  - 市場 regime（VIX、CPI、估值）對槓桿上限、00675L 持有區間與出場節奏的約束尚不夠強；
  - 風控模組（Margin / Survival / Decoupling / Budget Limit）對使用者的呈現仍偏技術化。  
    這些可以透過增強功能與導入計畫逐步補強，而不需要推翻現有架構。

## 二、現有投資框架總結

### 系統定位與架構

- 系統以 Node.js 為核心，搭配 Oracle VM crontab runner、Fastify API、Telegram Bot、Vue 3 Mini App，並採 file-based persistence（`data/` JSON + Google Sheets + Langfuse），對 0050 / 00675L 做日常監控、決策與通知。
- Runner 層（`runDailyCheck.mjs`, `runOptimizer.mjs`, `runWeeklyReport.mjs`, `runMonthlyReport.mjs`, `runNewsFetch.mjs`）負責調度 providers、strategy engine、AI 評估與通知；Decision Layer 由 `src/modules/strategy` 與 `src/modules/ai` 組成；Delivery Layer 透過 Telegram Bot 與 Mini App 呈現訊號與報告。

### 投資邏輯核心元件

- Baseline：以 0050 定期定額／逢低加碼為核心，透過 `lifecycle.monthlyDcaAmount`、`BudgetSynergyPolicy`（依發薪日前後加速 DCA）與 Baseline allocation 控制長期累積部位。
- 槓桿疊加：使用 00675L 作為 0050 的槓桿疊加，`computeGrossLeverage` 將 0050、00675L、淨資產整合成 `grossLeverage`，並套用 `ceiling / hardCap / recoveryTarget` 判斷是否可再加槓桿、需停止加碼或強制去槓桿。
- 生命週期：`Strategy.json` 中存在 `lifecycleProfiles`、`targetRetirementYear`、`birthYear` 等設定，並且設計了「早期可用較高槓桿（例如 2.0x）、中期降到 1.2–1.5x、接近退休改為 Sell-only Mode」的構想。
- 技術與情境指標：
  - Entry / Sell：`signalRules.mjs`、`entryScoringPolicy.mjs`、`sellScoringPolicy.mjs` 結合 RSI / KD / MACD / MA20 / ATR，以及 Entry Gate 的 RSI 分層（例：RSI < 30 為較激進的左側買點）。
  - 概率與 regime：`macroProvider.mjs`, `macroSentimentPolicy.mjs`, `resolveVixOverride`, `MacroDataHandler` 引入 VIX、CPI、利率與估值資訊，並有 `vixOverrideTrigger = 28`, `vixAbsoluteOverride = 35` 的參數設計。
- 風控模組：
  - 保證金與壓力測試：`analyzeMarginRisk` 對 -10/-20/-30/-40% 價格下跌進行模擬，使用 `marginCallThreshold 135`, `frozenZone 145`, `protectTrigger 160` 等門檻，產生 danger / warning 狀態。
  - 生存能力：`analyzeSurvival` 估計 `survivalDropLimit`、`refillRequirement`、`nextDayLimitDownMargin`，評估在隔日跌停或極端行情下的存活空間。
  - 資本結構：`analyzeCapitalDecoupling` 測量 0050（BaseWealth）與 00675L（TacticalWealth）的比例，避免 00675L 比例過高導致「投機大於基礎資產」。
  - 槓桿節奏控制：`trading.maxDailyLoanIncreasePct` 與 `trading.maxRollingLoanIncreasePct` 用來限制單日與滾動期間的淨借款增幅，避免短時間內暴衝加槓桿。

## 三、與生命週期投資法的契合度評估

- 生命週期投資法的精神是「早期用人力資本當隱含保險，可以適度提高股票或槓桿比重；越接近退休越應降低槓桿與風險資產比重」。現有設計透過 `lifecycleProfiles`、`grossLeverage` 計算與 Sell-only Mode 的構想，基本上有對齊這個方向。
- 文件中提到的範例如「距離退休 15 年，可接受 2.0x」、「距離退休 5–15 年降為 1.2–1.5x」、「最後 5 年採 Sell-only + 平滑去槓桿」等情境，已經是典型 lifecycle 槓桿軌跡的具體化，只是目前仍多停留在 pre-plan / backlog，而尚未完全程式化進入 `buildDecision` 的第一級條件。
- 風控側的 `analyzeMarginRisk`、`analyzeSurvival` 與 `computeGrossLeverage` 已提供足夠指標來實作「年齡 × 槓桿上限 × 生存空間」的聯合條件，若能釐清優先順序（例如：先看 margin / survival，再看 lifecycleProfile，再看技術指標），理論上可以支持一套穩健的生命週期策略。

## 四、主要投資機制檢視（0050 DCA 與 00675L 槓桿）

### 0050 Baseline DCA

- `storage.mjs` 及 Google Sheets 內維護 0050/00675L 持倉與交易紀錄，`BudgetSynergyPolicy` 使用 `lifecycle.monthlyDcaAmount`、`payDay` 與 `preInjectDays` 設計「發薪日前後 DCA 加速」機制，符合實務上薪資型投資人利用每月現金流進場的設計。
- 策略中將 0050 視為「基礎資產／保證金資產」，配合 margin 模組與 survival 分析，使 DCA 不只看價位，也看整體槓桿與風險承受度；這有利於避免在高槓桿、高估值時盲目加碼 0050。
- 建議：
  - 把「Baseline DCA 仍可執行」當成一個顯式條件，例如：
    - 條件：`grossLeverage <= lifecyclePhase.maxLeverage AND marginLayer.status < frozenZone`  
      → 動作：允許 0050 DCA 持續／小幅加碼。
    - 條件：`marginLayer.status >= frozenZone OR survivalDropLimit < X%`  
       → 動作：暫停 0050 DCA，僅保守還款或持現金。  
      這類條件目前在 `buildDecision` 中是透過多層 early return 間接達成，建議整理成更明確的 decision table。 s

### 00675L 槓桿與戰術配置

- `computeGrossLeverage` 模組清楚地用 0050 市值、00675L 市值、淨資產與槓桿 ETF 倍數（LEVERAGEETFMULTIPLIER = 2）計算總體槓桿，並用 `ceiling` 與 `hardCap` 分別界定「停止加碼」與「強制去槓桿」區間。
- `rebalancePolicy.buildSellBackToAllocation` 依照 `riskManagement.getPostSellAllocation` 產出的目標槓桿，把 00675L 部位賣回至目標槓桿倍率，並給出具體建議金額（例如：賣出多少 00675L 才能回到 1.5x）。
- `trading.maxDailyLoanIncreasePct` 與 `trading.maxRollingLoanIncreasePct` 限制一天與一段期間的槓桿速度，搭配 `Budget Priority`（Baseline vs Tactical），實務上可以避免一次性灌滿 2x，而改成「逐日／逐週滾動加槓桿」，這對風控來說是正向的。
- 從左側／右側交易角度看：
  - 左側：Entry gate 以 RSI 分層（RSI < 30 最激進，30–35 次之，45 以上僅 DCA 0050 不加 00675L），實際上在設計「跌深才開啟 00675L 加碼」，符合左側分段撿便宜的概念。
  - 右側：BasePrice / MA20 / ATR 與 Trailing Stop、sell anchor 型別設計，讓出場偏向趨勢追蹤與波動控管，這是典型右側賣出邏輯，可減少「左側撿便宜後太早賣掉」的問題。
- 建議：
  - 顯示性地把「00675L 允許加碼」寫成條件式（目前分散在 entryGate、grossLeverage、marginLayer、VIX override 中）：
    - 條件 A：`lifecyclePhase.allowsLeverage AND grossLeverage < lifecyclePhase.maxLeverage`
    - 條件 B：`marginLayer.status < frozenZone AND survivalDropLimit >= Y%`
    - 條件 C：`!vixOverrideActive AND macroSentiment != BEARISH_STRONG`
    - 條件 D：`EntryGateLevel >= LEVEL_1 (RSI <= 45)`
    - 結論：A、B、C、D 全部滿足 → 允許 00675L 新增戰術部位；任何一項不滿足 → 只允許減倉或觀望。  
      這樣有利於把整個策略抽象成一套可檢查的規則表，也方便後續回測與調整。

## 五、風險控管與穩定性評估

### 保證金與生存空間

- `analyzeMarginRisk` 以 10% 為階梯模擬 -10/-20/-30/-40% 價格跌幅下的保證金率，並用 `dangerThreshold`, `frozenZone`, `protectTrigger` 等門檻標示當前風險區間，這在風控上已經優於一般「只看當下保證金率」的做法。
- `analyzeSurvival` 專注在「若明天直接跌停」時的保證金率與補款需求（`nextDayLimitDownMargin`, `refillRequirement`），對台股保證金 + 槓桿 ETF 這種高波動組合來說非常關鍵，可以用來防範極端事件下的斷頭風險。
- 建議：
  - 在使用者層面暴露更簡單的指標，例如「生存空間：可以承受 X% 連續下跌才會觸及危險區」；
  - 將 `survivalDropLimit` 納入 lifecycle 槓桿軌跡條件，例如：
    - 條件：`survivalDropLimit < 20%`  
      → 動作：強制降低目標槓桿（例如從 1.8x 降到 1.2x），並停止所有 00675L 加碼。

### Regime 與 VIX override

- 系統透過 `macroProvider.mjs`、`macroSentimentPolicy.mjs`、`resolveVixOverride` 引入 VIX、CPI YoY、央行利率與估值，並在 `Strategy.json v2.5` 中設有 `vixOverrideTrigger = 28`, `vixAbsoluteOverride = 35` 等參數，代表在波動度高於某水準時啟動「熊市懲罰／冷卻」機制。
- 這部分設計方向正確，但目前主要以「懲罰分數／冷卻 multiplier」的方式間接影響 scoring；對高槓桿策略而言，建議將其升級為「硬條件」：
  - 條件：`VIX >= vixAbsoluteOverride`  
    → 動作：強制 Sell-only（禁止任何 00675L 加碼，僅允許減倉）；
  - 條件：`vixOverrideTrigger <= VIX < vixAbsoluteOverride`  
    → 動作：將 `grossLeverage` 上限壓到 lifecyclePhase.maxLeverage 的某個折扣（例如乘以 0.5），並提高 survival 所需安全邊際。

### 操作與系統穩定性（簡評）

- 架構上已透過 `runnerLock.mjs`、`adminGuard.mjs`、`initDataGuard.mjs` 以及 AES-256-GCM snapshot 加密確保 API 接口、Bot 操作與快照資料具一定安全性與一致性，對避免誤觸與資料錯亂是加分的。
- 但從投資角度來看，更關鍵的是：
  - Runner 與 Strategy engine 是否有完善的測試覆蓋（目前已有 `strategyEngine.test.mjs`、`marginStateMachine.test.mjs` 等，但槓桿／生命週期／regime 的整合測試仍可加強）。
  - `Strategy.json` 變更是否都經過 `strategy-param-audit.md`、`strategy-param-changes.md` 記錄與檢查，以避免手動調整槓桿 / 門檻導致風險大幅偏移。

## 六、具體功能增強建議（含條件式）

### 1. 生命週期槓桿軌跡引擎（LifeCycle Leverage Engine）

**目標**：把「年齡／距離退休年」真正變成所有槓桿相關決策的第一級條件。

**建議實作：**

- 在 `riskManagement.mjs` 或新的 `lifecycleEngine.mjs` 中集中定義：
  - `yearsToRetirement = targetRetirementYear - currentYear`；
  - 一組離散階段，例如：`EARLY ( >20 年)`, `MID (10–20 年)`, `LATE (5–10 年)`, `PRE_RETIRE (<=5 年)`。
- 為每個階段設定明確參數（可存於 `Strategy.json.lifecycleProfiles`）：
  - `maxLeverage`（整體 grossLeverage 上限）
  - `maxLeverageForNewZ2`（允許新增 00675L 的上限，通常略低於 maxLeverage）
  - `minSurvivalDropLimit`（至少要能承受的跌幅）
  - `mode`（`normal`, `reduced`, `sell_only`）
- 在 `buildDecision` 最前面加入條件式：

```text
條件：yearsToRetirement > 20 AND grossLeverage < lifecyclePhase.maxLeverage
  AND survivalDropLimit >= lifecyclePhase.minSurvivalDropLimit
→ 動作：允許 00675L 戰術加碼（受其他風控限制）。

條件：10 < yearsToRetirement <= 20
  → 動作：將 lifecyclePhase.maxLeverage 下調（例如 2.0x → 1.5x），並提高 survival 要求。

條件：5 < yearsToRetirement <= 10
  → 動作：嚴格限制 00675L 新增部位（只允許逢高減碼），Baseline 以 0050 DCA 為主。

條件：yearsToRetirement <= 5
  → 動作：啟用 Sell-only Mode，禁止任何 00675L 加碼；若 grossLeverage > 1.0x，啟動平滑去槓桿流程。
```

這些條件可以直接對應到 `lifecycleProfiles` 中已構想的數值設計，使生命週期投資真正落地。

### 2. Regime-aware 槓桿與持有區間控制

**目標**：讓高波動／高估值環境下的槓桿上限與持有邏輯明確收緊。

**建議實作：**

- 擴充 `MacroSentiment` 為更具體狀態（例如：`BULL`, `NEUTRAL`, `CORRECTION`, `BEAR`, `CRISIS`），並基於 VIX / PE / CPI 組合建立判斷規則（部分設計已在 pre-plan 文檔中）。
- 將 `macroSentiment` 納入槓桿條件式：

```text
條件：macroSentiment ∈ {BULL, NEUTRAL} AND VIX < vixOverrideTrigger
→ 動作：允許 lifecyclePhase.maxLeverage 的 100%。

條件：macroSentiment = CORRECTION OR (vixOverrideTrigger <= VIX < vixAbsoluteOverride)
→ 動作：將 maxLeverage 下修為 lifecyclePhase.maxLeverage × 0.5，
        並將 00675L 進出場頻率降低（例如只在 EntryGateLevel=3 才加碼）。

條件：macroSentiment ∈ {BEAR, CRISIS} OR VIX >= vixAbsoluteOverride
→ 動作：強制 Sell-only；若 grossLeverage > 1.0x，分期去槓桿。
```

- 在 Mini App 或報表中明確標示目前 regime 與對應槓桿政策，讓使用者知道「為什麼現在不給你加碼 00675L」。

### 3. 籌碼面資料的引入與量化（0050 / 00675L）

**目標**：將 TWSE 融資融券 / 三大法人買賣超 等籌碼資訊系統化納入 Scoring Matrix，而不是僅停留在 pre-plan。

**建議實作：**

- 已在 `twseProvider.mjs`、`kgiProvider.mjs` 設計 `fetchStockInstitutionalData(symbol)` 與 `fetchStockMarginData(symbol)`，建議完成實作並將資料寫入 `marketData.mjs` 及 canonical 正規化層。 ㄋ
- 在 `indicators.mjs` 中新增衍生指標：
  - 融資餘額變化率、融資使用率；
  - 法人連續買賣超天數；
  - 期貨未平倉量（若可取得）。
- 在 `entryScoringPolicy.mjs` 與 `sellScoringPolicy.mjs` 中將籌碼指標加入權重：

```text
條件：00675L 價格跌深（RSI < 30）且融資餘額持續下降（多殺多），法人賣超放緩
→ 動作：提高左側撿便宜分數，但同時要求 survivalDropLimit >= 25%。

條件：00675L 在高檔區間（RSI > 60）且融資／法人同步大舉買超
→ 動作：視為「過熱」，提高減碼優先級。
```

這樣可以把「籌碼面」從描述性資訊變成可量化的決策因子。

### 4. Portfolio Health Dashboard（整體健康度儀表板）

**目標**：把 Margin / Survival / Decoupling / Budget / Regime 這些技術指標整合成 2–3 個一眼可懂的燈號。

**建議實作：**

- 在 API 層新增一個 `/api/portfolio/health` 或在現有 `/api/status` 中嵌入一個 `healthSummary` 區塊，聚合：
  - `currentMargin`、`survivalDropLimit`、`refillRequirement`（來自 `analyzeMarginRisk` / `analyzeSurvival`）；
  - `grossLeverage` 與 lifecyclePhase 允許上限；
  - `tacticRatio`（00675L 相對淨資產比重）；
  - `macroSentiment` + VIX。
- 定義簡化燈號：

```text
條件：survivalDropLimit >= 30% AND grossLeverage <= lifecyclePhase.maxLeverage × 0.8 AND macroSentiment ∈ {BULL, NEUTRAL}
→ 健康度：綠燈（可接受的風險狀態）。

條件：survivalDropLimit ∈ [20%, 30%) OR grossLeverage 介於 [0.8, 1.0] × lifecyclePhase.maxLeverage
→ 健康度：黃燈（需要提高警覺，避免再加槓桿）。

條件：survivalDropLimit < 20% OR grossLeverage > lifecyclePhase.maxLeverage OR macroSentiment ∈ {BEAR, CRISIS}
→ 健康度：紅燈（應考慮減槓桿或減少風險部位）。
```

- 在 Mini App 的 Dashboard / Account 頁直接顯示這個燈號與簡短解釋，有助於一般使用者在不看全細節的情況下掌握大局。

### 5. Backtest 與參數校準 Pipeline 強化

**目標**：讓所有「條件式」不是拍腦袋，而是有回測與極端情境測試做支撐。

**建議實作：**

- 完成 `runBacktest.mjs` 與 `backtestEngine.mjs` 針對：
  - 不同 lifecycleProfiles（早期 2.0x／中期 1.5x／晚期 1.0x）；
  - 不同 regime policy（有／無 VIX override、高估值收斂）；
  - 不同 Budget Limit（maxDailyLoanIncreasePct／maxRollingLoanIncreasePct）  
    進行多組情境回測，尤其要包含疫情、升息循環、長期盤整等環境。
- 回測報表可透過 `archiveManager.mjs` 將結果輸出為 CSV / Google Sheet，並由 `periodReportAgent.mjs` 產生摘要（例如最大回撤、年化報酬、槓桿使用分佈、極端 drawdown 時槓桿水準分佈）。
- 建立「參數調整守則」：
  - 條件：某個參數（例如 marginCallThreshold, vixOverrideTrigger）要改動  
    → 動作：必須先跑指定的回測場景組合，並在 `strategy-param-audit.md` 中記錄變更與測試摘要，才能在實盤 config 生效。

### 6. 策略設定治理（Strategy Governance）

**目標**：防止 Strategy.json 被無意間調整到過於激進，破壞生命週期投資與槓桿上限。

**建議實作：**

- 完成 `maintenance-state-machine.md` → `Strategy.json` → `strategyEngine` 之間的對齊，並在 `validateStrategyConfig` 裡加入更多硬限制，例如：
  - `leverage.targetMultiplier` 不得超過 lifecycleProfiles 允許上限；
  - `trading.maxDailyLoanIncreasePct`、`trading.maxRollingLoanIncreasePct` 不得高於某絕對值（例如 10% 與 20%）。
- 將策略變更流程 formalize：
  - 每次修改 Strategy.json 必須產生一筆 PROPOSAL 檔案（目前在 `.agents/proposals` 中已有雛型流程），並由 AI Reviewer / Human Lead 雙重審查後才合併。

## 七、初步導入計畫（分階段）

以下假設你會逐步從「已有 0050/00675L 基礎策略」走向「完整生命週期／regime-aware 槓桿引擎」，以降低實盤風險。

### Phase 0：鞏固現況（1–2 週）

- 任務：
  - 確認目前 0050 DCA、00675L 加減碼、grossLeverage 計算與 margin / survival 分析在測試環境與小額實盤下運作正常（對照 broker 帳戶）。
  - 清理 `strategyEngine.mjs` 中與槓桿相關的 magic numbers，搬到 `strategyDefaults.mjs` 或 Strategy.json 中，並加上 `validateStrategyConfig` 檢查。
  - 補齊包含 `computeGrossLeverage`、`analyzeMarginRisk`、`analyzeSurvival`、`rebalancePolicy`、`BudgetSynergyPolicy` 的 unit / integration tests，確保未來 refactor 不會破壞核心風控。

### Phase 1：落地 LifeCycle Leverage Engine 與 Portfolio Health Dashboard（2–4 週）

- 任務：
  - 實作 `lifecyclePhase` 計算與對應的 `maxLeverage / minSurvivalDropLimit / mode` 設定（修改 Strategy.json + 新增 lifecycleEngine 模組）。
  - 在 `buildDecision` 開頭加入「生命週期 × 槓桿 × 生存空間」的第一級條件式，並將 00675L 加碼的所有邏輯繫結在這些條件上，不再只由 scoring matrix 或單一 indicator 決定。
  - 新增 Portfolio Health API 與前端儀表板，整合 margin / survival / grossLeverage / macroSentiment 狀態，使用紅黃綠燈呈現。

### Phase 2：Regime-aware Policy 與籌碼面引入（4–8 週）

- 任務：
  - 完成 TWSE / KGI 籌碼與融資資料 provider 實作，並在 canonical 正規化層加入相關指標；
  - 將籌碼指標納入 entry / sell scoring policy、MacroSentiment 與 regime classifier 中，形成實際影響槓桿與持有期的條件式；
  - 強化 VIX / MacroSentiment 與 lifecycle 槓桿條件的整合，並在報表中清楚說明每一日 decision 的原因（哪個條件阻擋了槓桿、為什麼改為 Sell-only）。

### Phase 3：回測與策略治理制度化（持續）

- 任務：
  - 完成標準化 backtest pipeline（多策略、多參數組合、多 regime 情境），定期對當前 Strategy.json 做壓力測試；
  - 將任何策略參數調整與 backtest 結果掛鉤，記錄於 `strategy-param-audit.md` 與 `.agents/proposals` 流程，形成可追溯的變更歷史。
  - 逐步將更多「經驗型規則」萃取為條件式，並用 backtest 與實盤資料做驗證與調整。

---

## 2026-05-06 追蹤：Phase 1.5 儀表板與 API 數據管線審核

### 1. 核心變更摘要

- **Smart Data Lookup**: `portfolioHealth.mjs` API 現已具備自動補全能力。若前端未帶入參數，後端將自動從 `data/reports/` 載入最新戰報資料，確保數據一致性。
- **In-Memory Cache**: 實作 TTL 60秒快取機制，減少 Disk I/O 負擔並提升高併發下的回應速度。
- **Premium UI Redesign**: `DashboardView.vue` 導入磨砂玻璃 (Glassmorphism) 與漸層藍視覺風格，優化移動端排版（雙欄 Grid），提升專業感。
- **數據邏輯修正**: 修正了生存空間 (Survival Drop Limit) 的正負評價邏輯（數值愈大代表愈抗跌，應為綠燈）。

### 2. 實作條件式驗證

- **健康度計算**: 嚴格遵循 `computePortfolioHealth` 聚合 Margin / Survival / Decoupling / Leverage / Lifecycle / Regime 六大維度。
- **數據來源優先序**: Query Params > Latest Report > Default Value。
- **生命週期對齊**: API 自動從 `Strategy.json` 讀取 `currentAge` 作為預設背景，確保生命週期槓桿封鎖邏輯生效。

### 3. 後續建議

- **Real-time Push**: 目前儀表板採 Pull 模式，未來可考慮透過 WebSocket 同步 `StrategyEngine` 的實時運算結果。
- **多維度雷達圖**: 雖然目前已有 Grid 呈現，但健康度六大維度的雷達圖 (Radar Chart) 能更直觀展現帳戶弱點。
