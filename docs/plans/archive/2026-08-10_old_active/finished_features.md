# Finished-plan Features (已完成功能歸檔)

## ✅【P0 已完成】Decision Chain of Responsibility 重構

> **Commit:** `76972b9` / `59afc2b` — feat(strategy): implement Decision Chain of Responsibility pattern + replace buildDecision with Decision Chain delegation
> **完成日期：** 2026-08-02

### 重構摘要

將 `strategyEngine.mjs` 中 500+ 行的 `buildDecision` 單體函式重構為 Chain of Responsibility 模式，拆分為 11 個獨立決策規則，並建立統一的 Chain Runner 執行引擎。

### 架構變更

| 變更項目           | 修改前                      | 修改後                                                   |
| ------------------ | --------------------------- | -------------------------------------------------------- |
| 檔案數             | 1 個 (`strategyEngine.mjs`) | 17 個 (1 runner + 11 rules + 1 base + 1 index + 3 tests) |
| buildDecision 行數 | ~500 行                     | ~10 行 (委派器)                                          |
| 單元測試覆蓋       | 僅整合測試                  | 25 單元測試 + 18 整合測試                                |
| 決策鏈優先級       | 硬編碼順序                  | 靜態排序 (priority 數值)                                 |

### 決策規則清單 (依優先級)

| Priority | 規則類別              | 檔案                      | 功能                                               |
| -------- | --------------------- | ------------------------- | -------------------------------------------------- |
| P0       | RegimePolicyRule      | RegimePolicyRule.mjs      | VIX/Regime 硬條件 (CRISIS/CAUTIOUS/NORMAL)         |
| P10      | MarginLayerRule       | MarginLayerRule.mjs       | 維持率 4 層狀態機 (critical/frozen/caution/normal) |
| P20      | LifecycleLeverageRule | LifecycleLeverageRule.mjs | 生命週期槓桿上限檢查                               |
| P30      | GrossLeverageRule     | GrossLeverageRule.mjs     | Gross Leverage 警戒 + panicBypass                  |
| P40      | ValuationGuardRule    | ValuationGuardRule.mjs    | 估值守衛 (PR 分位數 + Latch + Momentum)            |
| P50      | EntryGateRule         | EntryGateRule.mjs         | 進場前置過濾 (跌幅 + RSI)                          |
| P60      | StopLossTrailingRule  | StopLossTrailingRule.mjs  | MA20 停損 + 移動停利                               |
| P70      | ValuationBubbleRule   | ValuationBubbleRule.mjs   | 估值泡沫保護 (PB ≥ 2.2)                            |
| P80      | RebalanceRule         | RebalanceRule.mjs         | 再平衡 (z2Ratio 過高)                              |
| P90      | ConversionGuardRule   | ConversionGuardRule.mjs   | 階梯式獲利轉化                                     |
| P100     | ScoringDecisionRule   | ScoringDecisionRule.mjs   | 評分驅動決策 (戰術加碼/減倉/中性)                  |

### 關鍵設計決策

1. **介面設計**: ES6 Class 繼承 `DecisionRule` 基底類別，強制契約
2. **變異控制**: ctx/strategy 唯讀，engineState 為單一可變邊界
3. **優先級排序**: 模組載入時靜態排序一次 (O(1) 執行期)
4. **測試策略**: 保留既有 5 支整合測試 + 新增 43 支單元/整合測試
5. **相容性**: 共享狀態 (regimeResult, valuationGuardResult 等) 由 runner 自動同步回決策結果

### 移除的舊邏輯

- `computeTrailingStop()` → 已移至 `StopLossTrailingRule._computeTrailingStop()`
- 未使用的 imports: `getMarginLayer`, `evaluateMarginLayer`, `evaluateGrossLeverage`, `resolveValuationGuard`, `resolveTrendConfirmation`, `evaluateValuationGuard`, `resolveValuationMomentum`, `determineRegime`, `applyRegimeLeverage`, `allowsTacticalEntry`, `requiresForcedReduction`, `formatRegimeStatus`, `computeLifecycleContext` 等

### 保留的輔助函式 (供 evaluateInvestmentSignal 使用)

- `applyBudgetSynergy()` - 預算協同分析
- `buildEngineContext()` - ctx 組裝
- `formatSignalOutput()` - 輸出格式化

### 測試驗證

- **全專案測試**: 376 passed / 6 todo
- **新增測試**: 25 單元測試 (各規則獨立驗證) + 18 整合測試 (完整鏈條流程、優先級攔截、早期終止、排序)
- **既有整合測試**: `strategyEngine.test.mjs` 5 支關鍵測試全部通過 (CRISIS、Frozen、EntryGate、ValuationGuard、Neutral)

---

## ✅【P0 已完成】技術訊號 lookback window 統一修正

> **Commit:** `fc4897c` — fix(strategy): 修正 signalRules lookback window 與 rsiRebound requireCrossToday
> **完成日期：** 2026-04-16

### 修正摘要

`signalRules.mjs` 中所有使用 `wasBelowLevel` / `roseAboveAfterBelow` / `fellBelowAfterAbove` 的指標，lookback 原本一律 hardcode 為 10 天，且 `rsiRebound` 使用 `requireCrossToday: false`，導致過去 10 天內只要曾跌破 oversold，後續每天 RSI > 50 都會持續觸發 +3 分的虛假加分。

### 已完成修改清單

| 指標                 | 修改前 lookback | 修改後 lookback | requireCrossToday 修改           |
| -------------------- | --------------- | --------------- | -------------------------------- |
| `rsiRebound`         | 10              | **14**          | `false` → **`true`** ⚠️ 核心修正 |
| `kdBullLow`          | 10              | **18**          | —                                |
| `rsiDrop`（轉弱）    | 10              | **14**          | 維持 `false`                     |
| `kdDrop`（轉弱）     | 10              | **15**          | 維持 `false`                     |
| `rsiSell`            | 10              | **15**          | 維持 `true`                      |
| `macdSell`           | 10              | **20**          | 維持 `true`                      |
| `kdSell dropBelow80` | 10              | **20**          | 維持 `true`                      |

### 後續建議（未強制）

- `rsiDrop` / `kdDrop` 轉弱訊號仍使用 `requireCrossToday: false`，在震盪盤中仍可能連續計數。建議未來於 `computeReversalTriggers` 加入「當日已計入則略過」的冷卻保護。
- 建議搭配回測驗證修改前後訊號觸發次數差異（可於 backtest runner 完成後驗證）。

---

## ✅【P0 已完成】維持率狀態機 4 層重構

> **Commit:** `98a6cdb` — refactor(strategy): strategyEngine 維持率 4 層狀態機重構 + telegramHtmlBuilder mmTag 同步
> **完成日期：** 2026-04-16

### 修正摘要

`buildDecision()` 維持率邏輯由 2 層重構為 4 層狀態機，確保「越危險越先被檢出」，並在追繳危機區間執行一票否決。`Strategy.json` 同步新增 `frozenZone: 145`，`telegramHtmlBuilder.mjs` 同步更新 4 層 mmTag 文案與 emoji。

### 4 層狀態機規格

| 層級          | 門檻     | 行動                                 | Strategy.json 對應         |
| ------------- | -------- | ------------------------------------ | -------------------------- |
| 🔴 斷頭危機   | < 135%   | 強制市價降槓桿警示，一票否決所有加碼 | `marginCallThreshold: 135` |
| 🟠 高危凍結   | 135–145% | 禁止所有新進場，強烈通知補足保證金   | `frozenZone: 145`          |
| 🟡 預備金防禦 | 145–160% | 暫停高槓桿加碼，允許 baseline DCA    | `protectTrigger: 160`      |
| 🟢 常態運行   | >= 160%  | 允許策略引擎完整運作                 | `protectTarget: 180`       |

---

## ✅【P0 已完成】左側進擊矩陣：階層式進場前置過濾層

> **Commit（Strategy.json + entryGate 設計）:** `229c0be` — feat(strategy): Strategy.json 本地化 + entryGate 4 層矩陣 + minDropPercentToConsider:5 + docs/strategy-param-audit.md
> **Commit（signalRules 本地優先 + validateStrategyConfig）:** `8ca76ee` — fix(signal): fetchStrategyConfig 改為本地優先 + validateStrategyConfig 補齊 frozenZone 與 entryGate 驗證
> **Commit（strategyEngine Pre-Entry Gate 邏輯接入）:** `035541a` — feat(strategy): strategyEngine buildDecision() 插入 Pre-Entry Gate 前置過濾邏輯 + resolveEntryGate()
> **Commit（telegramHtmlBuilder entryGateLevel 標示）:** `9a268f3` — feat(notify): telegramHtmlBuilder 新增 entryGateLevel 通道標示
> **完成日期：** 2026-04-16

### 修正摘要

`strategyEngine.mjs` 的 `buildDecision()` 常態段前新增 `resolveEntryGate()` 前置過濾，依跌幅層級與 RSI 決定是否封鎖槓桿操作，並在所有買入回傳結果中附帶 `entryGateLevel / entryGateLabel / entryGateBlocked` 欄位。`telegramHtmlBuilder.mjs` 同步在訊息中標示進場通道層級。

### entryGate 4 層矩陣

| Tier | 跌幅區間 | RSI 門檻 | 允許槓桿 | 說明                  |
| ---- | -------- | -------- | -------- | --------------------- |
| 0    | 0–5%     | —        | ❌       | 底倉 DCA only         |
| 1    | 5–15%    | RSI < 45 | ❌       | 淺層修正，禁 00675L   |
| 2    | 15–30%   | RSI < 35 | ✅       | 深度回撤，開放 00675L |
| 3    | 30%+     | RSI < 30 | ✅       | 極端恐慌，一票通行    |

---

## ✅【P1 已完成】Strategy.json 幽靈參數審計與清除

> **Commit（審計文件產出）:** `229c0be` — docs/strategy-param-audit.md 新增
> **Commit（strategy-param-changes.md 建立）:** `1302be8` — docs: 新增 strategy-param-changes.md — Strategy.json 本次異動說明
> **Commit（幽靈參數實際移除）:** `103be3d` — refactor: 移除幽靈參數 leverage.targetMultiplier + reserve.allocationRatio
> **完成日期：** 2026-04-16

### 完成摘要

- `Strategy.json`：移除 `leverage.targetMultiplier`（值 1.8）、`reserve.allocationRatio`（值 0.5）
- `signalRules.mjs`：同步移除 `validateStrategyConfig()` 中對應的 `assertNumber` 驗證行
- `docs/strategy-param-audit.md`：兩參數狀態更新為 ✅ 已移除（2026-04-16）
- `docs/strategy-param-changes.md`：新增 frozenZone、entryGate、minDropPercentToConsider 完整異動說明

---

## ✅【P1 已完成】VIX 情緒短路機制

> **Commit（節一 Strategy.json 新增參數）:** `feat(config): Strategy.json v2.5 — 新增 macroSentiment.vixOverrideTrigger / vixAbsoluteOverride`
> **Commit（節二 validateStrategyConfig 補齊驗證）:** `feat(signal): signalRules validateStrategyConfig 補齊 vixOverrideTrigger / vixAbsoluteOverride 驗證`
> **Commit（節三 resolveVixOverride 函式）:** `feat(strategy): strategyEngine 新增 resolveVixOverride() 函式`
> **Commit（節四 macroSentiment 整合）:** `feat(strategy): strategyEngine buildDecision() macroSentiment 整合 VIX Override 短路邏輯`
> **Commit（節五 Telegram 通知標示）:** `71c1ca5` — feat(notify): telegramHtmlBuilder 新增 VIX 情緒短路標示（vixOverrideActive）
> **Commit（節六 文件更新）:** `docs(plans): 更新 preplan_features.md — VIX 情緒短路機制標記為已完成`
> **完成日期：** 2026-04-16

### 完成摘要

AI 新聞情緒為落後指標，在崩盤底部必定輸出 `BEARISH`，原本 `bearishPenalty`（扣分）與 `bearishCooldownMultiplier`（冷卻延長）同時觸發，導致左側進場最佳時機反而策略癱瘓。本次實作 VIX 情緒短路機制，以 VIX 即時恐慌指數覆蓋 AI 情緒的抑制效果。

### 實作節點總覽

| 節   | 內容                                                                    | 涉及檔案                                          |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| 節一 | Strategy.json 新增 `vixOverrideTrigger: 28` / `vixAbsoluteOverride: 35` | `Strategy.json`、`docs/strategy-param-changes.md` |
| 節二 | `validateStrategyConfig()` 補齊兩欄位驗證                               | `signalRules.mjs`                                 |
| 節三 | 新增 `resolveVixOverride()` 函式                                        | `strategyEngine.mjs`                              |
| 節四 | macroSentiment 段落整合 VIX Override，BEARISH 時先判斷短路              | `strategyEngine.mjs`                              |
| 節五 | Telegram 全版與精簡卡新增 `⚡ VIX 情緒短路` 標示                        | `telegramHtmlBuilder.mjs`                         |
| 節六 | 文件更新，preplan_features.md 狀態更新                                  | `docs/plans/backlog/preplan_features.md`          |

### VIX 情緒短路規格

| VIX 狀態                                       | 行為                                          |
| ---------------------------------------------- | --------------------------------------------- |
| VIX < 28                                       | 正常融合，AI BEARISH 正常扣分與冷卻延長       |
| VIX >= 28 且 VIX 開始回落（`trend = falling`） | 情緒短路：忽略 bearishPenalty，解除冷卻期延長 |
| VIX >= 35（絕對值）                            | 強制情緒短路，無論 VIX 趨勢                   |

### 人工驗收測試清單

| 情境                                    | 預期結果                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `vix=40`（絕對值短路）                  | `overrideActive: true`，bearishPenalty = 0，冷卻延長不觸發，Telegram 出現 `⚡ VIX 情緒短路` |
| `vix=30, trend=falling`（趨勢短路）     | `overrideActive: true`，同上                                                                |
| `vix=30, trend=rising`（趨勢不符）      | `overrideActive: false`，bearishPenalty 正常扣，冷卻延長正常觸發                            |
| `vix=20`（無觸發）                      | `overrideActive: false`，行為與修改前完全一致                                               |
| 舊版資料（缺 `vixOverrideActive` 欄位） | Telegram 靜默略過，不拋錯                                                                   |

---

## 📋 P0 完成狀態總覽

| Commit    | 內容                                                                   | 狀態      |
| --------- | ---------------------------------------------------------------------- | --------- |
| `fc4897c` | signalRules lookback window 統一修正 + rsiRebound requireCrossToday    | ✅ 已完成 |
| `98a6cdb` | strategyEngine 維持率 4 層狀態機重構 + telegramHtmlBuilder mmTag       | ✅ 已完成 |
| `229c0be` | Strategy.json 本地化 + entryGate 4 層矩陣 + strategy-param-audit.md    | ✅ 已完成 |
| `8ca76ee` | signalRules fetchStrategyConfig 本地優先 + validateStrategyConfig 補齊 | ✅ 已完成 |
| `035541a` | strategyEngine buildDecision() Pre-Entry Gate resolveEntryGate()       | ✅ 已完成 |
| `9a268f3` | telegramHtmlBuilder entryGateLevel 通道標示                            | ✅ 已完成 |
| `1302be8` | docs/strategy-param-changes.md 建立（異動說明）                        | ✅ 已完成 |
| `103be3d` | 幽靈參數移除：leverage.targetMultiplier + reserve.allocationRatio      | ✅ 已完成 |

---

## 📌【風控邏輯】維持率與追繳風險判斷重構（已升級為上方 P0 4層狀態機）

> ⚠️ 此項目已升級為【P0 已完成】維持率狀態機 4 層重構，請參閱上方對應條目。commit: `98a6cdb`

---

## 📌【策略門檻】RSI / 跌幅與估值多階門檻優化（已升級為上方 P0 左側進擊矩陣）

> ⚠️ 此項目已升級為【P0 已完成】左側進擊矩陣：階層式進場前置過濾層，請參閱上方對應條目。commit: `229c0be` / `8ca76ee` / `035541a` / `9a268f3`

---

## 📌【策略欄位清理】未使用欄位與 label 一致性（已整合為上方 P1 幽靈參數審計）

> ⚠️ 此項目已整合升級為【P1 高優先】Strategy.json 幽靈參數審計與清除，✅ 已完成（commit `103be3d`）。
> 原 label 一致性修正（`dropScoreRules` 文案對齊）已於 commit `229c0be` 一併完成。

---

## ✅【已完成】📌【穩定性強化】Providers 統一 retry / timeout 機制

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

---

## ✅【已完成】📌【P1 高優先】lastBuyDate 本地 fallback 快取（SQLite/JSON）

### 狀態與目標摘要

- 冷卻期依賴 `portfolio.lastBuyDate`，來源為 Google Sheet 持股紀錄。
- 若 Google Sheet API 失敗、欄位缺失或格式錯誤，冷卻期會被視為「無歷史買入紀錄」，等同關閉冷卻保護。
- 此問題在網路不穩或 Sheets API 限流時具有實際發生風險。

### 動機

冷卻期是防止短期內頻繁加碼與槓桿快速堆疊的關鍵機制。資料來源單點故障不應導致風控靜默失效。

### 建議方向

- 在每次成功讀取 `lastBuyDate` 後，同步寫入本地 JSON 檔（`data/cache/lastBuyDate.json`）或 SQLite。
- `fetchLastPortfolioState()` 失敗時，優先讀取本地快取作為 fallback，並在日報中標示「使用快取資料」。
- 每次實際觸發買入後，立即更新本地快取（不依賴下次 Sheets 讀取）。
- 在 `fetchLastPortfolioState()` 中增加 `lastBuyDate` 格式驗證，無法解析時顯示警告並 log。

---

## ✅【P1 已完成】Gross Leverage Ratio 總體曝險倍數監控

> **完成日期：** 2026-04-17

### 完成摘要

實作 `leverageMonitor.mjs`，計算包含質押負債與槓桿 ETF 內含期貨後的「真實綜合曝險倍數」。提供雙層天花板：主動禁止加碼（2.5x）與被動強制砍倉（3.0x），並在 Telegram 報告中即時顯示 Gross Leverage 數值。

### 核心計算邏輯

```javascript
grossLeverage = (市值0050 + 市值00675L * 2) / 帳戶淨值;
```

### 監控規格

| 曝險區間 | 行為             | Strategy.json 門檻                 |
| -------- | ---------------- | ---------------------------------- |
| > 3.0x   | **強制降槓桿**   | `grossLeverageCeiling: 3.0`        |
| > 2.5x   | **一票否決加碼** | `activeDeleverageThreshold: 2.5`   |
| 降回目標 | 砍倉至 2.2x      | `grossLeverageRecoveryTarget: 2.2` |

---

## ✅【P1 已完成】計畫 A：歷史 PB 時間序列快取 (整合至 archiveManager)

功能原由 `pbHistoryProvider.mjs` 實作，後為簡化架構已整合至 `archiveManager.mjs`。實作每日自動追加與去重排序功能，提供計畫 B 所需的 PB 序列。完全不依賴 FinMind，直接從 TWSE API 進行市值加權計算，儲存於 `data/pbHistory.json`。

### 資料流設計

1.  **歷史補齊**：逐月抓取 TWSE `BWIBBU_ALL` 資料，補齊過去 1260 個交易日的 PB 數值。
2.  **每日追加**：`marketData.mjs` 計算完當日 PB 後，自動呼叫 `appendToday()` 寫入快取。

---

## ✅【P1 已完成】計畫 B：PB 歷史分位數動態防護層 (valuationGuard)

> **完成日期：** 2026-04-17

### 完成摘要

實作 `resolveValuationGuard()`，將「絕對 PB 門檻」升級為「相對 PR 分位數」。新增 4 段壓縮乘數與 **DefenseLatch 鎖定機制**（防死貓反彈重入）。在高估值（PR >= 90）情境下啟動 **MA20 / ATR 趨勢雙重確認**，避免過早離場。

### PR 分位數壓縮規格

| PR 區間 | 行為     | 乘數  | 說明                               |
| ------- | -------- | ----- | ---------------------------------- |
| < 70    | 常態運行 | ×1.0  | 無壓縮                             |
| 70–80   | 輕度壓縮 | ×0.85 | 降低槓桿幅度                       |
| 80–90   | 中度壓縮 | ×0.65 | 禁止新增 00675L                    |
| >= 90   | 極度壓縮 | ×0.3  | 啟動 MA20/ATR 趨勢確認，破位則清算 |

### 狀態管理

- **DefenseLatch**：觸發 ×0.0 清算後進入鎖定，需滿足「估值降溫 (PR < 85)」、「極端恐慌破冰」或「強勢趨勢反轉」其一才解鎖。
- **快取檔案**：`data/valuationGuardState.json`。

---

## ✅【P1 已完成】計畫 C + 極端恐慌破冰 (valuationMomentum & panicBypass)

> **完成日期：** 2026-04-17

### 完成摘要

1.  **計畫 C (valuationMomentum)**：感知 PR 分位數的「變化方向」。若 PR 快速上升（+10% 以上）疊加壓縮；若從高位快速回落，提前解除壓縮。併入 **VIX 波動率感知補正**，在 PR 85–90 敏感區間，若 VIX 單日暴升 > 20% 或 VIX > 30 絕對值，強制啟動保守補正。
2.  **極端恐慌破冰 (panicBypass)**：定義 Priority 3 路由。當跌幅 > 20% 且 VIX > 35 時，全域 Bypass 估值防禦（計畫 B/C），強行進入恐慌加碼通道，捕捉左側底部機會。

### 決策路由優先級 (buildDecision)

| Priority | 層級名稱                   | 行為                                   |
| -------- | -------------------------- | -------------------------------------- |
| P1       | 維持率危機                 | 一票否決，最優先保命                   |
| **P3**   | **極端恐慌破冰**           | **Bypass 計畫 B/C，解鎖 DefenseLatch** |
| P4       | 估值防禦鎖定 (Latch)       | 禁止重入，防死貓反彈                   |
| P5       | 計畫 B (valuationGuard)    | 套用 PR 分位數乘數                     |
| P6       | 計畫 C (valuationMomentum) | 套用動量與 VIX 補正                    |
| P7       | 常態策略                   | weightScore DCA 決策                   |

---

## ✅【P1 已完成】生命週期風險預算與槓桿曲線 (核心引擎)

> **完成日期：** 2026-07
> **相關 Commit：** lifecycleEngine 整合、LifecycleLeverageRule (P20) 加入決策鏈

### 完成摘要

實作 `lifecycleEngine.mjs` 核心計算引擎與 `LifecycleLeverageRule.mjs` (Priority 20)，將生命週期參數整合至決策鏈。Strategy.json 新增 `lifecycleProfiles` 區段支援四階段槓桿上限配置。

### 核心功能

- **四階段 Profile**：EARLY (>15年, 2.0x)、MID (10-15年, 2.0x)、LATE (5-10年, 1.5x)、PRE_RETIRE (≤5年, 1.0x)
- **優先級定位**：Priority 1.5 (介於維持率危機 P1 與 Gross Leverage P30 之間)
- **後期保守模式**：Sell-only Mode (禁止新增 00675L/質押)、Activation Cushion 強制 Bypass (MA20/ATR 即時生效)
- **決策鏈整合**：`LifecycleLeverageRule` 在 `engineState.adjustedMaxLeverage` 寫入 Regime CAUTIOUS 調整後的上限

### 影響範圍

- `src/modules/strategy/lifecycleEngine.mjs` (核心計算)
- `src/modules/strategy/decision/rules/LifecycleLeverageRule.mjs` (P20 規則)
- `Strategy.json` (lifecycleProfiles 配置)
- 決策鏈 `createDefaultDecisionChain()` 自動載入

---

## ✅【P2 已完成】回測核心框架

> **完成日期：** 2026-07
> **相關 Commit：** backtest 模組新增

### 完成摘要

建立 `src/modules/backtest/` 獨立模組，包含 `AccountSimulator` (虛擬券商) 與 `BacktestRunner` (主迴圈)，支援完整歷史回測流程。

### 核心功能

- **資金架構對齊生產**：0050 底倉 DCA、00675L 質押槓桿、現金流、利息結算
- **動態去槓桿守衛**：`deleverage()` 依 `triggerRatio`/`targetRatio` 自動減碼
- **策略引擎複用**：直接呼叫 `evaluateInvestmentSignal` + `buildDecision` 確保邏輯一致
- **股票分割處理**：0050 1拆4 自動調整
- **彈性配置**：`disableGuards` 觀察純計分矩陣效果、可覆寫買入門檻

### 檔案結構

```
src/modules/backtest/
├── accountSimulator.mjs   # Virtual Broker (帳戶模擬、交易執行、利息、去槓桿)
└── backtestRunner.mjs     # 主迴圈 (Timeline 載入、每日決策、快照輸出)
```

### 現況缺口 (後續 Phase 處理)

- ❌ `archiveManager.getArchiveRecords(dateRange)` API 缺失
- ❌ `runBacktest.mjs` CLI runner 缺失
- ❌ `signalCategory` / `signalType` 欄位缺失 (Phase 2 依賴)
- ❌ Google Sheet 歷史價格讀取缺失

---

## ✅【獨立功能已完成】Simulator Phase A: 正向模擬與 Mini App UX

> **完成日期：** 2026-08-09
> **相關 Commit：** simulator 模組、API 路由、Mini App 元件

### 完成摘要

0050 雙向模擬器 Phase A 完整交付：正向模擬 API、快取隔離、輸入驗證、Mini App Mode A/B 介面。

### 核心功能

- **POST /api/v1/simulate**：正向模擬完整流程 (驗證 → 戰報 → 模擬輸入 → 指標重算 → 策略計算)
- **POST /api/v1/simulate/reverse**：反向推導 API 就緒 (Phase B/C 回傳 not_implemented)
- **資料隔離**：`dataAdapter.buildSimulationInput` 深層複製 + 完整指標重算
- **Mini App**：`SimulatorView.vue` + `ForwardPanel`/`ReversePanel` + `DataQualityBadges` + `DisclaimerBanner`
- **測試**：`apiContract.test.mjs` 34/34 通過 (mock simulateRoute)

### 檔案結構

```
src/modules/simulator/
├── dataAdapter.mjs           # 戰報驗證、模擬輸入建構
├── forwardSimulator.mjs      # 正向模擬核心
├── analyticalSolvers.mjs     # 解析型反推 (Phase B)
├── rsiSolver.mjs             # RSI 反推
├── scanner.mjs               # 掃描器 (Phase C)
├── reverseEngine.mjs         # 反向引擎註冊表
├── validator.mjs             # 輸入驗證
├── constants.mjs             # 錯誤碼、模式定義
└── *.test.mjs                # 完整單元測試

src/api/routes/v1/simulate.mjs  # API 路由 (含錯誤處理)
webapp/src/views/SimulatorView.vue  # Mini App 入口
```

### 待實作 (Phase B/C)

- 🟡 Phase B: 接線 `analyticalSolvers` (RSI/維持率/MA 解析解)
- 🟡 Phase C: 接線 `scanner` + `reverseEngine` (KD/MACD/策略總分掃描)
- 需先確認 `pending-decisions.md` 36 項決策 (DEC-01/05/08 等)
