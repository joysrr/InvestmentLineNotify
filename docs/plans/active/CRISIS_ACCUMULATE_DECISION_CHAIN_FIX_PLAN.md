---
type: plan
status: completed
created: 2026-11-10
last_updated: 2026-11-10
tags:
  - crisis-accumulate
  - entry-gate
  - decision-chain
  - debt-aware
  - zero-hardcoding
wiki_links:
  - [[Strategy Engine]]
  - [[Leading Indicator Radars]]
  - [[Cash Exposure Advisor]]
  - [[Regime Policy]]
---

# 計畫書：Crisis Accumulate 決策鏈修復與規格對齊

---

## 1. 背景與問題陳述

### 1.1 觸發情境

2026-11-09 收盤後，帳戶 `totalDebt = 0`、`cash = 600,000 TWD`、`VIX = 43.8`。依 `docs/modules/strategy/cash_exposure_advisor.md` 第 2 節狀態表，應觸發 `CRISIS_ACCUMULATE` 狀態；但實際 `data/reports/2026-11-10.json` 輸出為：

- `strategy.target = "🚧 槓桿封鎖"`
- `strategy.suggestion = "entryGate 底倉通道：底倉 DCA only，禁止加碼"`
- `strategy.regimeResult.state = "CRISIS"`（state 正確，但未被採用）

### 1.2 文件層面的三個前提

1. P1 條件加碼已於 2026-10-28 移除（`docs/plans/completed/2026-10-28-p1-removal-cash-exposure-plan.md`）。現行決策層只有「P0 DCA」與「現金驅動曝險建議」兩層，不存在 P1。
2. 00675L 採嚴格右側進場（`docs/modules/strategy/leading_indicator_radars.md` 第 1 節第 4 點）：暴跌時全面凍結，需「VIX ≤ 0.8 × Peak、收盤價 ≥ SMA5、20 日實現波動率 < 35%」三綠燈同時亮起才解鎖。
3. `cash_exposure_advisor.md` 已定義 `CRISIS_ACCUMULATE` 狀態，但強調「消除硬編碼數值，達成全自適應配置」。

**結論**：目前系統在 VIX 恐慌時輸出「槓桿封鎖」，程式碼上與 `EntryGateRule` 未感知 `crisisAccumulateMode` 有關；文件上與「00675L 嚴格右側進場」的紀律一致。要讓 `CRISIS_ACCUMULATE` 上線，程式碼與文件必須同步修訂，不能只改程式碼。

---

## 2. 已確認正確實作（不需改動）

| 項目                         | 檔案與位置                                                        | 驗證結果                                                                          |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `debtMode` 判定              | `src/modules/strategy/decision/rules/RegimePolicyRule.mjs` L15–18 | 已使用 `Number()` 防護，分流正確                                                  |
| `crisis_accumulate` 分支     | `src/modules/strategy/regimePolicy.mjs` L27–31                    | `debtMode === "OPPORTUNITY"` 時回傳 `mode: "crisis_accumulate"`                   |
| `DEFENSE` 模式保留           | `src/modules/strategy/regimePolicy.mjs`                           | `sell_only` 分支完整保留                                                          |
| 狀態注入                     | `src/modules/strategy/decision/rules/RegimePolicyRule.mjs` L27–30 | `engineState.crisisAccumulateMode = true`、`engineState.debtMode = "OPPORTUNITY"` |
| `CRISIS_ACCUMULATE` 文件定義 | `docs/modules/strategy/cash_exposure_advisor.md` 第 2 節          | 狀態表已列出觸發條件與輸出欄位                                                    |

---

## 3. 🔴 P0：EntryGateRule 未感知 crisisAccumulateMode

### 3.1 問題描述

`docs/modules/strategy/strategy_engine.md` 第 1 節明訂：「第一個回傳 non-null 的規則即終止後續規則」。

`RegimePolicyRule` 優先級 P0，在 `crisis_accumulate` 時只注入狀態、回傳 null，決策流繼續。`EntryGateRule` 優先級 P50，未檢查 `engineState.crisisAccumulateMode`，只要 `gateResult.blocked` 為真就回傳封鎖決策，決策鏈在此終止。

### 3.2 程式碼路徑與片段

檔案：`src/modules/strategy/decision/rules/EntryGateRule.mjs`

現況：

```javascript
class EntryGateRule extends DecisionRule {
  constructor() {
    super({ priority: 50, name: "EntryGateRule" });
  }

  evaluate(ctx, strategy, engineState, grossLeverageResult, ma60Slope) {
    const entryGateCfg = strategy.buy?.entryGate;
    if (!entryGateCfg?.enabled) {
      return null;
    }
    const gateResult = resolveEntryGate(
      ctx.priceDropPercent,
      ctx.rsi,
      entryGateCfg,
      ma60Slope,
    );
    if (gateResult.blocked) {
      return createDecisionResult({
        marketStatus: `〖前置過濾：${gateResult.tierLabel}〗`,
        target: "🚧 槓桿封鎖",
        targetSuggestion: `entryGate ${gateResult.tierLabel}通道：底倉 DCA only，禁止加碼`,
      });
    }
    return null;
  }
}
```

對照：`src/modules/strategy/decision/rules/RegimePolicyRule.mjs`

```javascript
if (regimeResult.mode === "crisis_accumulate") {
  engineState.crisisAccumulateMode = true;
  engineState.debtMode = "OPPORTUNITY";
  ctx.regimeState = "CRISIS";
  // 不 return，決策流繼續
}
```

### 3.3 建議調整方向

必須同步修訂程式碼與文件，不可只改程式碼：

**(A) 程式碼：`EntryGateRule.evaluate()` 開頭加入放行判斷**

```javascript
evaluate(ctx, strategy, engineState, grossLeverageResult, ma60Slope) {
  // P0：crisis_accumulate 時放行，交由後續規則與 CashExposureAdvisor 計算
  if (engineState?.crisisAccumulateMode === true) {
    return null;
  }

  // 以下為現行邏輯，不動
  const entryGateCfg = strategy.buy?.entryGate;
  // ...
}
```

**(B) 文件：`docs/modules/strategy/leading_indicator_radars.md` 新增例外條款**

現行文件第 1 節第 4 點的「00675L 嚴格右側進場」需新增一段：

> **例外：無借款帳戶恐慌加碼（CRISIS_ACCUMULATE）**  
> 當 `portfolio.totalDebt === 0` 且 `VIX ≥ 35` 時，00675L 的「全面凍結」改為「限速分批加碼」。每批金額由 `cashExposureAdvisor` 依 `resolveTargetLeverage()` 動態計算，不設固定上限。此例外僅適用於 OPPORTUNITY 模式（`debtMode = "OPPORTUNITY"`），有借款時仍維持嚴格右側進場。

**(C) 文件：`docs/modules/strategy/strategy_engine.md` 補充決策鏈說明**

在「第一個回傳 non-null 的規則即終止後續規則」段落後，新增：

> **例外：狀態注入規則**  
> `RegimePolicyRule` 在 `crisis_accumulate` 時只注入 `engineState.crisisAccumulateMode` 並回傳 null，不終止決策鏈。後續 `EntryGateRule` 等規則必須主動檢查此旗標並放行，否則 `crisis_accumulate` 狀態會被覆蓋。

### 3.4 驗收條件

- [ ] `totalDebt = 0` + `vix = 43.8` + entryGate 底倉通道 → 最終 `strategy.target` 不是「🚧 槓桿封鎖」
- [ ] `totalDebt > 0` + `vix = 43.8` → 維持 `sell_only`，`EntryGateRule` 行為不變
- [ ] `crisisAccumulateMode === false` 時，`EntryGateRule` 行為與改動前完全一致

---

## 4. 🟠 P1：批次金額公式與 Zero Hardcoding 原則衝突

### 4.1 問題描述

計畫書早期版本假設「CRISIS_ACCUMULATE_MAX_BATCH = 50000」為硬上限。但 `docs/modules/strategy/cash_exposure_advisor.md` 第 3 節明確要求：

> 消除硬編碼數值，達成全自適應配置。`resolveTargetLeverage()` 採四層優先序動態計算目標槓桿。

新增固定上限與文件原則相悖。

### 4.2 程式碼路徑與片段

檔案：`src/modules/strategy/cashExposureAdvisor.mjs`

現況：

```javascript
const capitalGap = Math.max(0, exposureGap / 2);
const batchByCount = Math.floor(capitalGap / CRISIS_ACCUMULATE_BATCH_COUNT);
const batchByCash = Math.floor(cash * CRISIS_ACCUMULATE_BATCH_RATIO);
const batchRaw = Math.min(batchByCount, batchByCash, capitalGap);
```

### 4.3 建議調整方向

採**方案 A（推薦）**：確認 `cashExposureAdvisor` 的 `batchLimit` 已完整遵循 `resolveTargetLeverage()` 的四層優先序。不新增 `CRISIS_ACCUMULATE_MAX_BATCH` 5 萬硬上限。

### 4.4 驗收條件

- [ ] `cashExposureAdvisor` 的 `batchLimit` 計算已對照 `resolveTargetLeverage()` 四層優先序
- [ ] 計畫書與程式碼中不再出現「5 萬硬上限」這類固定金額描述

---

## 5. 🟠 P1：PANIC_BYPASS 常數與雙軌風控衝突

### 5.1 問題描述

`strategyDefaults.mjs` 已定義 `PANIC_BYPASS_DROP_PCT = 0.2`、`PANIC_BYPASS_VIX_THRESHOLD = 35`，但 `EntryGateRule` 未引用。若直接接入，會與 `leading_indicator_radars.md` 的「00675L 嚴格右側進場」規則衝突。

### 5.2 建議調整方向

**不將 PANIC_BYPASS 接入 EntryGateRule**。改用第 3 節的 `crisisAccumulateMode` 放行機制。

處理方式：
在 `strategyDefaults.mjs` 的 `PANIC_BYPASS_*` 常數上方加註：

```javascript
// ⚠️ 保留供 0050 左側逆週期加碼使用，不可用於 00675L。
// 00675L 的恐慌放行請改用 engineState.crisisAccumulateMode（見 EntryGateRule）。
export const PANIC_BYPASS_DROP_PCT = 0.2;
export const PANIC_BYPASS_VIX_THRESHOLD = 35;
```

### 5.3 驗收條件

- [x] `EntryGateRule` 未直接引用 `PANIC_BYPASS_*` 常數
- [x] `strategyDefaults.mjs` 已加註使用範圍
- [x] `leading_indicator_radars.md` 已明確區分「0050 左側加碼」與「00675L 恐慌加碼例外」

---

## 6. 🟡 P2：actualLeverage 與 grossLeverage 定義差異

### 6.1 問題描述

`data/reports/2026-11-10.json` 中：

- `portfolio.actualLeverage = 1`
- `portfolio.grossLeverage ≈ 0.804`
- `theoreticalShadow.theory.currentLeverage ≈ 0.804`

在 `totalLoan = 0` 時，`actualLeverage` 原公式為 `grossAsset / netAsset = (netAsset + totalLoan) / netAsset = 1`，屬於「會計借貸資產槓桿」；而 `grossLeverage` 為「總有效曝險 / 淨值」，屬於「市場投資組合曝險槓桿」。

### 6.2 建議調整方向

1. 程式碼層：確認 `actualLeverage` 計算式與語意。
2. 文件層：在 `docs/modules/strategy/strategy_engine.md` 新增「槓桿欄位定義」：
   - `grossLeverage`：總市場有效曝險 / 帳戶淨資產（包含 00675L 2x 槓桿權重）
   - `actualLeverage`：總資產 / 淨資產（會計槓桿，反映借貸放大率）
   - `currentLeverage`（theoreticalShadow）：與 `grossLeverage` 同義（市場曝險倍數）
3. 輸出層：Telegram 卡片與 Mini App 顯示「當前槓桿」時，統一使用市場曝險槓桿（`grossLeverage`）。

---

## 7. 🟡 P2：全面對齊「P1 已移除」之事實

### 7.1 建議調整方向

- 將 `cashExposureAdvisor.mjs` 與各處註解/卡片之「P1 條件加碼」改為「現金驅動曝險建議」。
- P0 DCA（每月 3 萬）維持原措辭（唯一最高無條件執行層級）。

---

## 8. 分階段執行計畫

- **Phase 1 — 文件先行**：[COMPLETED]
  1. 修訂 `leading_indicator_radars.md`（新增無借款帳戶恐慌加碼例外）
  2. 修訂 `strategy_engine.md`（補充狀態注入規則不終止決策鏈、槓桿欄位定義）
  3. 執行 `node scripts/pre-commit-docs-check.mjs`、`node scripts/validate-wiki-index.mjs`
- **Phase 2 — 程式碼 P0 (TDD)**：[COMPLETED]
  1. 撰寫 RED 測試（`test/unit/strategy/entryGateRule.test.mjs` 或決策鏈整合測試）
  2. `EntryGateRule.evaluate()` 加入 `crisisAccumulateMode` 放行 (GREEN)
  3. 驗證現有 1929 個測試全數 GREEN
- **Phase 3 — 程式碼 P1**：[COMPLETED]
  1. 確認 `cashExposureAdvisor.mjs` 遵循 `resolveTargetLeverage()`，清理過時 P1 註解與文字
  2. `strategyDefaults.mjs` 的 `PANIC_BYPASS_*` 加註
  3. 單元測試驗證
- **Phase 4 — 程式碼 P2**：[COMPLETED]
  1. 確認並統一槓桿欄位呈現（`grossLeverage`）
  2. 更新相關通知與視圖
- **Phase 5 — 整合驗收**：[COMPLETED]
  1. 以完整決策鏈執行驗證（`totalDebt = 0`, `VIX = 43.8`）
  2. 驗證 `strategy.target` 擺脫「🚧 槓桿封鎖」並正確觸發危機加碼
  3. 執行完整驗證與 commit
