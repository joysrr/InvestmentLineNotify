# Strategy.json 參數審計文件

> 建立日期：2026-04-16  
> 對應版本：`2.4`（本地化升級版）  
> 審計目的：盤點所有欄位的實際引用狀況，清除幽靈參數，防止維護者誤改無效欄位。

---

## 審計說明

- ✅ **正常引用**：欄位有被程式碼直接讀取並影響行為
- ⚠️ **部分引用**：欄位存在但引用方式間接或有歧義
- ❌ **幽靈參數**：欄位未被任何模組引用，修改無效
- 🔧 **已修正**：本版本已調整或清除
- 📋 **保留待議**：尚有討論空間，暫時保留

---

## `leverage`

### `leverage.targetMultiplier` 🔧 已移除（2026-04-16）

- **舊值**：`1.8`
- **設計意圖**：目標槓桿倍數
- **實際引用**：僅 `telegramHtmlBuilder.mjs` UI 顯示標籤，不影響 allocation 決策邏輯
- **移除原因**：純 UI 顯示用途的幽靈參數；allocation 各檔位已自行定義 leverage 比例，`targetMultiplier` 語意重疊且無實質計算引用
- **移除內容**：
  - `Strategy.json`：刪除 `leverage.targetMultiplier` 欄位
  - `signalRules.mjs`：移除 `validateStrategyConfig()` 中 `assertNumber(config.leverage.targetMultiplier, ...)` 驗證行
- **狀態**：✅ 已移除（commit: refactor: 移除幽靈參數）

---

## `reserve`

### `reserve.allocationRatio` 🔧 已移除（2026-04-16）

- **舊值**：`0.5`
- **設計意圖**：預備金配置比例
- **實際引用**：`riskManagement.mjs` 中 `getReserveStatus()` 未直接讀取此欄位，邏輯已由 `reserve.tiers` 完整承擔
- **移除原因**：純幽靈參數，`tiers` 已完全取代其功能，保留只會造成維護者誤改
- **移除內容**：
  - `Strategy.json`：刪除 `reserve.allocationRatio` 欄位
  - `signalRules.mjs`：移除 `validateStrategyConfig()` 中 `assertNumber(config.reserve.allocationRatio, ...)` 驗證行
- **狀態**：✅ 已移除（commit: refactor: 移除幽靈參數）

### `reserve.tiers`

- **當前值**：3 層（100萬 / 300萬 / 無上限，比例 5% / 8% / 10%）
- **實際引用**：`riskManagement.mjs` → `getReserveStatus()` 依 `netAsset` 對照 tiers 計算 `currentReserve`
- **狀態**：✅ 正常引用

---

## `maintenance`

### `maintenance.protectTrigger`

- **當前值**：`160`
- **實際引用**：`strategyEngine.mjs` → `getMarginLayer()` 4 層狀態機分界（Layer 2/3 分界）
- **狀態**：✅ 正常引用

### `maintenance.protectTarget`

- **當前值**：`180`
- **實際引用**：`strategyEngine.mjs` → `buildDecision()` Layer 2（protect）計算補足目標維持率
- **狀態**：✅ 正常引用

### `maintenance.marginCallThreshold`

- **當前值**：`135`
- **實際引用**：`strategyEngine.mjs` → `getMarginLayer()` Layer 0（critical）分界
- **狀態**：✅ 正常引用

### `maintenance.frozenZone` 🔧

- **當前值**：`145`（2.4 版新增）
- **設計意圖**：高危凍結區上界，Layer 1（frozen）/ Layer 2（protect）分界
- **實際引用**：`strategyEngine.mjs` → `getMarginLayer()` Layer 1 分界，`buildDecision()` Layer 1 文案
- **狀態**：✅ 正常引用
- **備注**：舊版本以 hardcode `145` 寫入程式，現已提升為可設定欄位

---

## `trading`

| 欄位                               | 當前值   | 引用位置                                                                     | 狀態        |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------- | ----------- |
| `minAction`                        | 10000    | `strategyEngine.mjs` → 未直接引用（由 `threshold.minActionableAmount` 承擔） | ⚠️ 部分引用 |
| `cooldownDays`                     | 20       | `strategyEngine.mjs` → `evaluateInvestmentSignal()` → `checkCooldown()`      | ✅          |
| `transFee`                         | 0.001425 | `scripts/testOptimizer.mjs` → 交易成本計算                                   | ✅          |
| `transFeeDiscount`                 | 0.6      | `scripts/testOptimizer.mjs`                                                  | ✅          |
| `taxRate`                          | 0.003    | `scripts/testOptimizer.mjs`                                                  | ✅          |
| `loanInterestRate`                 | 0.025    | `scripts/testOptimizer.mjs`                                                  | ✅          |
| `budget.maxDailyLoanIncreasePct`   | 0.05     | `strategyEngine.mjs` → 單日撥款上限                                          | ✅          |
| `budget.maxRollingLoanIncreasePct` | 0.15     | `strategyEngine.mjs` → 10 日滾動上限                                         | ✅          |
| `budget.rollingDays`               | 10       | `strategyEngine.mjs` → 滾動計算天數                                          | ✅          |

> **注意**：`trading.minAction` 與 `threshold.minActionableAmount` 語意重疊，建議統一為一個欄位。

---

## `buy`

### `buy.minDropPercentToConsider` 🔧

- **修改前**：`0`（等同無效過濾）
- **修改後**：`5`（2.4 版調整）
- **實際引用**：`strategyEngine.mjs` → `buildDecision()` `dropOk` 判斷
- **狀態**：✅ 正常引用（現已與 entryGate tier[0] 語意對齊）

### `buy.minWeightScoreToBuy`

- **當前值**：`4`
- **實際引用**：`strategyEngine.mjs` → `buildDecision()` `scoreOk` 判斷
- **狀態**：✅ 正常引用

### `buy.dropScoreRules` 🔧

- **實際引用**：`signalRules.mjs` → `computeEntryScore()` 依跌幅對照 score
- **狀態**：✅ 正常引用
- **2.4 修正**：`minDrop: 25` 的 label 由「大跌 >= 20%」修正為「大跌 >= 25%」（與數值對齊）

### `buy.rsi`

- **當前值**：`{ oversold: 50, score: 3 }`
- **實際引用**：`signalRules.mjs` → `computeEntryScore()` → `rsiRebound` 判斷，`strategyEngine.mjs` → 極端恐慌 `extremeRsiThreshold` 計算
- **狀態**：✅ 正常引用
- **設計備注**：`oversold: 50` 為加分條件門檻，非技術分析標準超賣定義（30），單獨觸發 +3 分不足達門檻，設計合理。已由 `entryGate` 補充左側過濾。

### `buy.macd`

- **當前值**：`{ score: 2 }`
- **實際引用**：`signalRules.mjs` → `computeEntryScore()` → `macdBull` 判斷
- **狀態**：✅ 正常引用

### `buy.kd`

- **當前值**：`{ oversoldK: 20, score: 2 }`
- **實際引用**：`signalRules.mjs` → `computeEntryScore()` → `kdBullLow` 判斷
- **狀態**：✅ 正常引用

### `buy.panic`

- **實際引用**：`strategyEngine.mjs` → `buildDecision()` 極端恐慌分支
- **狀態**：✅ 正常引用

### `buy.entryGate` 🔧

- **當前值**：4 層矩陣（2.4 版新增）
- **設計意圖**：進場前置過濾層，依跌幅決定允許操作的上限
- **實際引用**：`strategyEngine.mjs` → `buildDecision()` Pre-Entry Gate 前置過濾邏輯（批次二實作）
- **狀態**：✅ 正常引用（批次二完成後生效）

---

## `sell`

| 欄位                               | 當前值 | 引用位置                                          | 狀態 |
| ---------------------------------- | ------ | ------------------------------------------------- | ---- |
| `postAllocationIndexFromEnd`       | 2      | `riskManagement.mjs` → `getPostSellAllocation()`  | ✅   |
| `minUpPercentToSell`               | 80     | `strategyEngine.mjs` → `buildDecision()` 停利條件 | ✅   |
| `minSignalCountToSell`             | 2      | `strategyEngine.mjs` → `buildDecision()` 停利條件 | ✅   |
| `rsi.overbought`                   | 75     | `signalRules.mjs` → `computeSellSignals()`        | ✅   |
| `kd.overboughtK`                   | 80     | `signalRules.mjs` → `computeSellSignals()`        | ✅   |
| `trailingStop.enabled`             | true   | `strategyEngine.mjs` → 開啟動態停利               | ✅   |
| `trailingStop.anchorType`          | `atr`  | `strategyEngine.mjs` → 停利算法 (ma20/atr)        | ✅   |
| `trailingStop.activationProfitPct` | 0.1    | `strategyEngine.mjs` → 啟動獲利門檻 (10%)         | ✅   |
| `trailingStop.atrMultiplier`       | 2.5    | `strategyEngine.mjs` → ATR 停損倍數               | ✅   |
| `trailingStop.stopLossBuffer`      | 0.02   | `strategyEngine.mjs` → MA20 緩衝空間              | ✅   |

---

## `allocation`

- **實際引用**：`riskManagement.mjs` → `getTargetLeverageByScore()` 依 weightScore 對照 leverage/cash
- **狀態**：✅ 正常引用
- **備注**：`leverage.targetMultiplier` 已移除，allocation 各檔位 leverage 為唯一槓桿定義來源。

---

## `threshold`

| 欄位                   | 當前值 | 引用位置                                                      | 狀態        |
| ---------------------- | ------ | ------------------------------------------------------------- | ----------- |
| `z2TargetRatio`        | 0.4    | `strategyEngine.mjs` → 再平衡計算                             | ✅          |
| `reversalTriggerCount` | 3      | `strategyEngine.mjs` → 轉弱判斷                               | ✅          |
| `mmDanger`             | 140    | 未在 `strategyEngine.mjs` 找到直接引用（已由 4 層狀態機取代） | ❌ 幽靈參數 |
| `z2RatioHigh`          | 45     | `strategyEngine.mjs` → 再平衡門檻                             | ✅          |
| `minActionableAmount`  | 10000  | `strategyEngine.mjs` → 再平衡最小執行金額                     | ✅          |
| `overheatCount`        | 2      | `signalRules.mjs` → `computeOverheatState()`                  | ✅          |
| `rsiOverheatLevel`     | 82     | `signalRules.mjs` / `telegramHtmlBuilder.mjs`                 | ✅          |
| `dOverheatLevel`       | 85     | `signalRules.mjs` / `telegramHtmlBuilder.mjs`                 | ✅          |
| `bias240OverheatLevel` | 35     | `signalRules.mjs` / `telegramHtmlBuilder.mjs`                 | ✅          |
| `rsiReversalLevel`     | 60     | `signalRules.mjs` → `computeReversalTriggers()`               | ✅          |
| `kReversalLevel`       | 75     | `signalRules.mjs` → `computeReversalTriggers()`               | ✅          |
| `wAggressive`          | 10     | `strategyEngine.mjs` → `buildDecision()` 分數檔位             | ✅          |
| `wActive`              | 8      | `strategyEngine.mjs` → `buildDecision()` 分數檔位             | ✅          |
| `vixLowComplacency`    | 12     | `telegramHtmlBuilder.mjs` → VIX 標籤顯示                      | ✅          |
| `vixHighFear`          | 20     | `telegramHtmlBuilder.mjs` → VIX 標籤顯示                      | ✅          |
| `vixPanic`             | 28     | `strategyEngine.mjs` → 極端恐慌判斷                           | ✅          |
| `vixExtreme`           | 35     | `strategyEngine.mjs` → 極端恐慌強化                           | ✅          |
| `usVixPanic`           | 30     | `telegramHtmlBuilder.mjs` / 日報顯示                          | ✅          |

> ⚠️ **幽靈參數確認**：`threshold.mmDanger` 值為 `140`，舊版本 2 層邏輯的痕跡，4 層狀態機升級後已由 `maintenance.marginCallThreshold`、`maintenance.frozenZone`、`maintenance.protectTrigger` 完整取代。建議下一版移除。

---

## `macroSentiment`

| 欄位                        | 當前值 | 引用位置                                            | 狀態 |
| --------------------------- | ------ | --------------------------------------------------- | ---- |
| `enabled`                   | true   | `strategyEngine.mjs` → `resolveMacroSentiment()`    | ✅   |
| `bullishBonus`              | 3      | `signalRules.mjs` → `computeEntryScore()`           | ✅   |
| `bearishPenalty`            | 5      | `signalRules.mjs` → `computeEntryScore()`           | ✅   |
| `bearishCooldownMultiplier` | 1.5    | `strategyEngine.mjs` → `evaluateInvestmentSignal()` | ✅   |

---

## `scoringMatrix`

| 欄位                         | 當前值 | 引用位置                               | 狀態 |
| ---------------------------- | ------ | -------------------------------------- | ---- |
| `enabled`                    | true   | `strategyEngine.mjs`                   | ✅   |
| `categories`                 | {}     | `signalGenerator.mjs` → 權重與類組定義 | ✅   |
| `thresholds.buyTactical`     | 4      | `strategyEngine.mjs` → 戰術加碼門檻    | ✅   |
| `thresholds.sellTactical`    | -4     | `strategyEngine.mjs` → 戰術減碼門檻    | ✅   |
| `normalization.lookbackDays` | 20     | `signalGenerator.mjs` → 標準化回顧期   | ✅   |

---

## 待清除幽靈參數彙整

| 參數                        | 建議動作                                         | 時程       | 狀態      |
| --------------------------- | ------------------------------------------------ | ---------- | --------- |
| `reserve.allocationRatio`   | 已移除                                           | 2026-04-16 | ✅ 已完成 |
| `leverage.targetMultiplier` | 已移除                                           | 2026-04-16 | ✅ 已完成 |
| `threshold.mmDanger`        | 移除（已由 4 層狀態機欄位取代）                  | 下一版     | ⏳ 待執行 |
| `trading.minAction`         | 統一為 `threshold.minActionableAmount`，移除重複 | 下一版     | ⏳ 待執行 |

---

## 命名規範（防止未來幽靈化）

1. **新增欄位前**先確認有對應的程式讀取點（`grep -r "欄位名" src/`）
2. **棄用欄位**在審計文件標注 `legacy`，並在下一個版本正式移除
3. **語意相似欄位**（如 `minAction` vs `minActionableAmount`）在 PR 時需說明差異或合併
4. **驗證函式 `validateStrategyConfig`** 應與欄位生命週期同步更新
