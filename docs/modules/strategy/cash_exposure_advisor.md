---
type: reference
status: current
last_updated: 2026-11-04
last_verified: 2026-11-04
related_code:
  - src/modules/strategy/cashExposureAdvisor.mjs
  - src/modules/strategy/leadingIndicatorEvaluator.mjs
  - src/modules/strategy/riskManagement.mjs
  - src/modules/strategy/lifecycleEngine.mjs
  - src/scheduler/dailyCheck.mjs
tags:
  - strategy
  - cash-exposure
  - crisis-accumulate
  - leverage-resolution
  - dynamic-batching
wiki_links:
  - [[Regime Policy]]
  - [[Leading Indicator Radars]]
  - [[Strategy Engine]]
---

# 現金曝險建議系統（Cash Exposure Advisor）

本模組提供**帳戶淨資產驗證**與**危機加碼視窗**的現金曝險建議，實現債務感知的雙模式加碼引擎，並透過階層式目標槓桿解析與動態批次計算，消除硬編碼數值，達成全自適應配置。

## 1. 核心原則

1. **淨資產門檻守護**：僅在 `portfolio.accountNetAsset` 驗證通過時提供建議；未驗證帳戶回傳 `UNAVAILABLE` 狀態，避免基於不完整資料的誤導性建議。
2. **債務感知雙軌分流**：
   - **OPPORTUNITY_MODE** (`totalDebt === 0`)：危機時啟用分批加碼 00675L，目標將當前槓桿從崩盤低點拉回策略目標。
   - **DEFENSE_MODE** (`totalDebt > 0`)：保留既有防爆倉邏輯（sell_only），優先保護借款帳戶安全。
3. **P0 DCA 最高豁免**：所有現金曝險建議僅影響 P1 條件加碼（已移除）或手動操作，P0 定期定額（每月 3 萬）具有最高豁免權，任何市場暴跌或雷達警報均無條件正常執行。
4. **三層雷達路由**：根據市場狀態與雷達觸發情況，分流至 `DEFER`（推遲加速）、`CRISIS_ACCUMULATE`（恐慌加碼視窗）、`CAUTION`（靜默）三種狀態。

## 2. 狀態定義

| 狀態                | 觸發條件                                       | 輸出內容                                                      | Telegram 行為 |
| :------------------ | :--------------------------------------------- | :------------------------------------------------------------ | :------------ |
| `UNAVAILABLE`       | `portfolio.accountNetAsset` 為 `null` 或未驗證 | `{status, message: "帳戶淨資產未驗證，現金曝險建議暫不提供"}` | 靜默          |
| `DEFER`             | `OVERNIGHT_SHOCK` 或 `MARGIN_SETTLING` 觸發    | `{status, message: "隔夜衝擊或融資斷頭訊號，建議推遲加速"}`   | 警示卡        |
| `CRISIS_ACCUMULATE` | VIX ≥ 35 且 `totalDebt === 0` 且無 DEFER 雷達  | `{status, batchLimit, batchRationale, disclaimer, reason}`    | 獨立高醒目卡  |
| `CAUTION`           | 其他情況                                       | `{status, message: "當前無極端訊號"}`                         | 靜默          |

## 3. 階層式目標槓桿解析（Zero Hardcoding）

`resolveTargetLeverage()` 透過 4 層優先順序消除硬編碼，動態取得危機加碼的目標槓桿：

```javascript
// 優先順序（由高至低）
1. portfolio.targetLeverage       // 用戶明確指定（最高權威）
2. strategy.buy.panic.suggestedLeverage + 1  // 恐慌檔位建議（0.3 → 1.3x total）
3. getTargetLeverageByScore(marketScore, strategy) + 1  // 評分階梯（0.15→1.15x, 0.2→1.2x, ...）
4. lifecycleContext.profile.maxLeverageForNewZ2  // 生命週期天花板（MID 階段 1.5x）

**Ceiling 條件**：所有層級的結果均透過 `ceiling` 上限封頂，
`ceiling = lifecycleContext?.profile?.maxLeverageForNewZ2 || 1.5`（預設 1.5x）。
程式碼中每層均套用 `Math.min(層級結果, ceiling)`，確保槓桿不超過生命週期天花板。
```

**設計理念**：

- **用戶主權優先**：若用戶明確設定 `portfolio.targetLeverage`，系統無條件遵守。
- **恐慌檔位次之**：策略設定檔中 `strategy.buy.panic.suggestedLeverage = 0.3`（代表 1.3x 總槓桿），是針對系統性恐慌設計的保守建議。
- **評分階梯作為常態基準**：`riskManagement.getTargetLeverageByScore()` 根據市場評分（0-1）映射至配置檔 `strategy.allocation` 的槓桿階梯（1.15x～1.8x）。
- **生命週期天花板兜底**：當所有參數缺失時，回傳 `lifecycleContext.profile.maxLeverageForNewZ2`（預設 1.5x），提供保守上限。

**實際範例**（2026-11-04 大跌案例）：

- 用戶未設定 `portfolio.targetLeverage`
- `strategy.buy.panic.suggestedLeverage = 0.3` → 目標 1.3x
- 市場評分 0.15（極低） → 映射至 1.15x
- 生命週期天花板 1.5x
- **最終取得**：1.3x（恐慌檔位優先於評分階梯）

## 4. 動態批次計算（三路最小值）

消除硬編碼 `CRISIS_ACCUMULATE_MAX_BATCH = 50000`，改為全自適應公式：

```javascript
// Step 1: 計算曝險缺口
TargetExposure = AccountNetAsset × TargetLeverage  // 目標總曝險
CurrentExposure = GrossExposure                    // 當前市值總和
ExposureGap = max(0, TargetExposure - CurrentExposure)

// Step 2: 轉換為 00675L 資本需求（2x 槓桿 ETF）
CapitalGap = ExposureGap / 2

// Step 3: 三路最小值 + 智慧圓整
batchLimit = smartRound(
  min(
    CapitalGap / CRISIS_ACCUMULATE_BATCH_COUNT,  // 均攤 10 批
    Cash × CRISIS_ACCUMULATE_BATCH_RATIO,        // 現金 10% 上限
    CapitalGap                                    // 總缺口上限
  )
)

// smartRound: ≥1000 → 千位圓整；<1000 → 百位圓整
```

**設計理念**：

- **均攤紀律**：將資本缺口分為 10 批（`CRISIS_ACCUMULATE_BATCH_COUNT = 10`），避免單筆過大暴露於反彈失敗風險。
- **現金安全墊**：單批不超過現金的 10%（`CRISIS_ACCUMULATE_BATCH_RATIO = 0.1`），保留流動性應對後續波動。
- **總缺口上限**：絕不超過計算出的資本缺口，避免過度加碼。

**實際範例**（2026-11-04）：

- 帳戶淨資產 2,493,725 TWD
- 目標槓桿 1.3x → 目標曝險 3,241,842 TWD
- 當前曝險 1,946,778 TWD → 曝險缺口 1,295,064 TWD
- 00675L 資本缺口 = 1,295,064 / 2 = 647,532 TWD
- 三路計算：
  - 均攤 10 批：647,532 / 10 = 64,753 TWD
  - 現金 10%：600,000 × 0.1 = 60,000 TWD ✓（最小值）
  - 總缺口：647,532 TWD
- **最終批次限額**：60,000 TWD（千位圓整）

## 5. 輸出契約

### 5.1 CRISIS_ACCUMULATE 輸出結構

```javascript
{
  status: "CRISIS_ACCUMULATE",
  batchLimit: 60000,  // 單批加碼建議金額（TWD）
  batchRationale: "目標槓桿 1.3x（恐慌檔位）；資本缺口 64.8 萬分 10 批 = 6.48 萬，現金 10% = 6 萬，取最小值 6 萬",
  disclaimer: "⚠️ 00675L 為 2x 槓桿 ETF，長期持有存在複利耗損（Volatility Decay）。建議僅於短期反彈行情使用，並嚴格遵守分批紀律。",
  reason: "VIX 35.6 ≥ 35，無借款帳戶 → 恐慌加碼視窗"
}
```

### 5.2 三層卡片輸出（Telegram）

1. **主卡片（message）**：簡潔行動指令，包含 P0 DCA 狀態、00675L 限速加碼提示。
2. **批次說明（batchRationale）**：可摺疊詳細計算過程，提供透明度。
3. **風險提示（disclaimer）**：槓桿 ETF 複利耗損警告，強調短期使用原則。

## 6. 資料管線整合

### 6.1 淨資產 Fallback 機制

`dailyCheck.mjs` 實作動態兜底邏輯（Phase 7.3）：

```javascript
// 當 Google Sheets portfolio.accountNetAsset 為 null 時
const netAssetForAdvisor = portfolio.accountNetAsset ?? totalValue;
```

**設計理念**：

- Google Sheets 可能因手動維護延遲導致 `accountNetAsset` 欄位空白。
- `totalValue` 是 `theoreticalShadow` 即時價格計算的市值總和，可作為合理替代。
- 此 fallback 確保 `cashExposureAdvisor` 不會因上游資料缺失而失效。

### 6.2 參數完整性傳遞

`leadingIndicatorEvaluator.mjs` 現在接收並轉發完整參數集（Phase 7.4）：

```javascript
evaluateLeadingIndicators(
  ctx,
  totalDebt,
  portfolio, // 新增：含 targetLeverage
  strategy, // 新增：含 panic/allocation 配置
  lifecycleContext, // 新增：含 maxLeverageForNewZ2
  marketScore, // 新增：用於評分階梯映射
);
```

## 7. 測試覆蓋

### 7.1 單元測試（`cashExposureAdvisor.test.mjs`）

- ✅ 4-tier leverage resolution：用戶指定 > 恐慌檔位 > 評分階梯 > 生命週期天花板
- ✅ Dynamic batching 3-way min：均攤、現金比例、總缺口取最小值
- ✅ Smart rounding：≥1000 千位圓整，<1000 百位圓整
- ✅ UNAVAILABLE guard：`accountNetAsset` 為 null 時早期回傳
- ✅ DEFER routing：`OVERNIGHT_SHOCK` 或 `MARGIN_SETTLING` 觸發推遲
- ✅ Legacy compatibility：所有既有測試遷移至新簽章

### 7.2 整合測試（`regimeAwareOpportunityEngine.test.mjs`）

- ✅ End-to-end flow：`determineRegime` → `evaluateCashExposure` → `formatCrisisAccumulateCard`
- ✅ OPPORTUNITY mode verification：`totalDebt = 0` 啟用 `crisis_accumulate`
- ✅ DEFENSE mode preservation：`totalDebt > 0` 保留 `sell_only`

## 8. 與 Regime Policy 協作

- **Regime Policy** 負責判定市場狀態（CRISIS/CAUTIOUS/NORMAL）與帳戶模式（OPPORTUNITY/DEFENSE）。
- **Cash Exposure Advisor** 負責在 CRISIS + OPPORTUNITY 組合下，計算具體加碼金額與批次。
- **Leading Indicator Evaluator** 負責整合兩者輸出，生成 Telegram 卡片與 Mini App 顯示內容。

## 9. 歷史脈絡

- **2026-10-28**：P1 條件加碼移除，現金曝險建議系統接手提供動態建議（見 `docs/plans/completed/2026-10-28-p1-removal-cash-exposure-plan.md`）。
- **2026-11-04**：系統性大跌暴露 `regimePolicy` 硬編碼 VIX≥35 → sell_only 的設計前提不符（假設有融資負債，實際 `totalDebt=0`）。
- **2026-11-04 Phase 7**：完成債務感知雙模式引擎，消除所有硬編碼槓桿與批次數值，實現全自適應配置。

## 10. 參考資料

- 計畫文件：`docs/plans/active/2026-11-04_regime-aware-opportunity-engine.md`（v2.4）
- 相關模組：`[[Regime Policy]]`、`[[Leading Indicator Radars]]`、`[[Risk Management]]`、`[[Lifecycle Engine]]`
