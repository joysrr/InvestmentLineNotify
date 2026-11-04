---
type: plan
status: active
created: 2026-11-04
last_updated: 2026-11-04
tags:
  - regime-policy
  - crisis-buying
  - kelly-criterion
  - leverage
  - strategy-redesign
  - debt-aware
wiki_links:
  - modules/strategy/leading_indicator_radars.md
  - verification/personalized-design-inventory.md
---

# 計畫書：Regime-Aware Opportunity Engine（危機加碼引擎）v2.2

---

## 1. 問題陳述

### 1.1 現象

市場發生極端恐慌大跌（如 VIX 飆破 40）時，無借款投資者的策略意圖為「趁恐慌分批建立低成本衛星槓桿」，但系統卻給出以下全面封鎖輸出：

| 模組                  | 觸發邏輯                  | 現行輸出                          | 實際副作用               |
| --------------------- | ------------------------- | --------------------------------- | ------------------------ |
| `RegimePolicyRule`    | VIX ≥ 35 → CRISIS         | `sell_only`，建議賣出 00675L 100% | 阻止加碼並要求清倉       |
| `extremePanicRadar`   | VIX 超門檻觸發            | radarTriggered 清單非空           | 傳入 cashExposureAdvisor |
| `cashExposureAdvisor` | radarTriggered.length > 0 | `DEFER`，suggestedDcaAmt=0        | 暫緩一切加速加碼         |
| `theoreticalShadow`   | 當前槓桿 > Kelly 數值     | UI 紅燈警示                       | 顯示超出上限，誤導決策   |

**四層機制同時亮紅燈，系統在市場出現高期望值恐慌折價時全面封鎖。**

### 1.2 根本矛盾

現行系統的設計隱含假設為：**投資人帳戶存在保證金借款／融資負債，VIX 飆高即代表斷頭與追繳風險**。

但在**無借款帳戶（`Number(totalDebt) === 0`）**的情境下：

- 帳戶無流動性負債，無追繳斷頭壓力（`maintenanceRatio` 為 N/A）
- 現金為純自有防禦資金，非保證金
- 槓桿 ETF（如 00675L）**不會因追繳而被迫平倉（最大損失以持倉本金為限，無負債風險），但存在每日再平衡造成的波動耗損，此風險已於 §2.4 與 Telegram 卡片提示。**

**系統以「防止爆倉」的防禦性邏輯，過度干預並阻斷了無斷頭風險帳戶的「危機採購機會」。**

_(註：具體帳戶數值請參閱「附錄 A：設計案例與驗收 Fixture」，非每日輸出文案)_

---

## 2. 佐證與理論校正

### 2.1 VIX>40 的歷史加碼勝率與路徑風險

> 來源：FinLab 量化研究，1990–2026 回測（36 年、S&P 500，2026-06 更新）  
> URL: https://finlab.finance/blog/vix-us-stock-crash-investing-python

| 策略                                 | 樣本      | 持有 250 日平均報酬 | 勝率    | 最差一次（250日最終報酬） |
| ------------------------------------ | --------- | ------------------- | ------- | ------------------------- |
| **訊號 A：VIX 收盤突破 40 當天買進** | **12 次** | **+22.1%**          | **83%** | -14.3%（2001 年）         |
| 訊號 B：VIX 曾破 40、降至 30 再買    | 10 次     | +16.8%              | 90%     | -18.5%                    |
| 任意時點買進（基準）                 | 8,900+ 天 | +10.0%              | 81%     | —                         |

> 來源：第一金投信，30 年歷史數據  
> URL: https://www.fsitc.com.tw/ManagerEDM.aspx?ID=1938&Type=2

| 進場 VIX  | 6M 平均報酬 | 1Y 平均報酬 | 2Y 平均報酬 | 3Y 勝率 |
| --------- | ----------- | ----------- | ----------- | ------- |
| VIX 40~50 | +14.2%      | +28.9%      | +45.7%      | 99.4%   |
| VIX >50   | 更高        | 更高        | 更高        | 100%    |

**理論校正與路徑風險防禦**：

- **指標口徑說明**：表格中「最差一次 -14.3%」為 **250 日持有期最終報酬**；而 2008 年金融海嘯 VIX 首破 40 後指數仍續跌約 30% 則為 **期間最大回撤（Drawdown）**。兩者為不同口徑指標，共同說明「長期賠率極有利、但短期路徑仍可能惡化」。
- **限速意義**：因此，加碼必須嚴格採「限速分批（Batch Limit）」，限速的目的就是**控制續跌時的路徑損耗**，絕不可單筆重壓。

### 2.2 Kelly Criterion 的語義分流（Debt-Aware）

> 來源：Frontiers in Applied Mathematics and Statistics (2020)  
> URL: https://doi.org/10.3389/fams.2020.577050

原論文指出實務上應採 Half Kelly（0.5×Kelly）降低回撤。在工程設計上，UI 紅燈與警告需依據 `debtMode` 進行**語義分流**：

- **DEFENSE 模式（有借款）**：當前槓桿 > Kelly → **「優先降槓」**（防範斷頭風險）。
- **OPPORTUNITY 模式（無借款）**：當前槓桿 > Kelly → **「限制新資金加碼速度」**，現有持倉部位不強制賣出，作為分批節流閥。

### 2.3 Regime Switching 的區間強度與降噪

> 來源：Predictive Signals from VIX Spikes (Preprints, 2026-02)  
> URL: https://www.preprints.org/manuscript/202602.1048

- 歷史實證中，最強烈的反轉訊號通常出現在 **VIX > 45** 的極端區間；在 VIX 35~45 區間，市場震盪可能延長。
- **降噪處理**：將此類學術區間細節放入 `batchRationale` 或展開式說明中，主通知卡片保持精簡，避免干擾日常決策。

### 2.4 Antifragile 理論邊界修正與 00675L 複利耗損

- **Antifragile 正確歸位**：Nassim Taleb 原則嚴格反對負債與金融槓桿。因此，**Antifragile 僅適用於「核心資產 0050 不因恐慌賣出」**的抗脆弱防守，不可用作加碼 2x 槓桿 ETF（00675L）的理論背書。
- **00675L 波動度耗損（Volatility Decay）**：2x 槓桿 ETF 採每日平衡機制，在盤整或高波動震盪市存在複利損耗。系統必須在風險免責聲明與主卡片中明確提示「震盪市存在複利損耗」，並以此作為單批加碼金額上限（`MAX_BATCH`）的工程防護理由。

---

## 3. 現行問題深度分析

### 3.1 決策鏈全貌（現行）

```
dailyCheckTheoreticalAdapter.mjs
  └─ leadingIndicatorEvaluator.mjs
       ├─ [Step 1] evaluateLeadingIndicators()
       │    └─ extremePanicRadar 觸發 → triggeredRadars 非空
       │
       ├─ [Step 2] RegimePolicyRule.evaluate() [Priority 0]
       │    └─ determineRegime(VIX, ...) → state="CRISIS"
       │         └─ 立即 return sell_only 決策 ← 阻斷所有後續規則
       │
       └─ [Step 3] evaluateCashExposure()
            └─ radarTriggered.length > 0
                 └─ return { status: "DEFER", suggestedDcaAmt: 0 }
```

### 3.2 程式碼層級問題診斷

#### 問題 A：`regimePolicy.mjs` 第 50–65 行

`determineRegime` 於 VIX ≥ 35 時無條件回傳 `mode: "sell_only"`，缺乏帳戶負債狀態維度。

#### 問題 B：`RegimePolicyRule.mjs` 第 59–78 行

CRISIS 狀態直接執行 `return createDecisionResult`，終止決策流，後續規則（含部位評估）完全無法運行。

#### 問題 C：`cashExposureAdvisor.mjs` 第 71–81 行

`radarTriggered` 不分青紅皂白一律 `DEFER`。未區分「恐慌型雷達（價格超跌折價）」與「基本面/流動性雷達（總經衰退/信用違約）」。

#### 問題 D：`leadingIndicatorEvaluator.mjs` 第 188–194 行

呼叫 `evaluateCashExposure` 時未傳遞 `totalDebt`，下游無法獲知債務邊界。

---

## 4. 設計方案：Debt-Aware Dual Mode

### 4.1 核心原則

```
帳戶狀態判定：
  Number(portfolio.totalDebt) === 0
    → debtMode = "OPPORTUNITY"（機會型模式：無斷頭風險，恐慌時限速加碼）

  Number(portfolio.totalDebt) > 0
    → debtMode = "DEFENSE"（防禦型模式：現行降槓與防斷頭邏輯 100% 完整保留）
```

### 4.2 OPPORTUNITY 模式的 Regime 重定義

| Regime     | VIX 範圍 | DEFENSE 模式（維持不變）   | OPPORTUNITY 模式（新增）              |
| ---------- | -------- | -------------------------- | ------------------------------------- |
| NORMAL     | < 28     | 允許加碼                   | 允許加碼（同左）                      |
| CAUTIOUS   | 28–35    | 減速 25%                   | 減速 25%（同左）                      |
| **CRISIS** | **≥ 35** | **sell_only，建議賣出 X%** | **`crisis_accumulate`，每批限速加碼** |

---

## 5. 不變更項目（Frozen - 範圍控制護欄）

為確保改動邊界明確，防止過度重構或破壞既有防禦底線，以下核心模組與紀律嚴禁更動：

| 項目                              | 理由                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| **P0 DCA（每月固定扣款）**        | 投資鐵律，任何市場 Regime 或恐慌雷達皆不可干預                      |
| **`hardCap` 強制降槓機制**        | `totalDebt > 0` 時防止爆倉的終極防線，不可放寬                      |
| **DEFENSE 模式全部現有邏輯**      | 有借款時的原有減碼與停看聽邏輯 100% 完整保留                        |
| **`maintenanceRatio` 維持率計算** | 未來若重啟融資/增貸時仍需實時監控斷頭風險                           |
| **00675L 停利 +80% 規則**         | 獲利了結與紀律保護原則不變                                          |
| **Kelly 在 UI 的紅燈警告顯示**    | 維持資訊透明，紅燈持續提醒，語義按 debtMode 進行分流解釋（依 §2.2） |

---

## 6. 系統輸出模板與降噪設計（避免案例數字寫死）

### 6.1 Telegram 通知卡片模板（純動態欄位）

```
⚡【恐慌加碼視窗】無借款帳戶 · VIX 危機模式
目標：📈 分批限速加碼（CRISIS_ACCUMULATE）
建議：本批加碼 00675L 上限 {batchLimit} TWD
• 目標槓桿：{targetLeverage}x，當前：{currentLeverage}x
• ✅ P0 DCA 照常執行（鐵律，不受 Regime 影響）
• ⚠️ P1 條件加碼：每批上限 {batchLimit}，VIX 仍高時控制路徑損耗
• ℹ️ 00675L 為 2x 槓桿產品，震盪市存在複利耗損
```

_(原則：卡片僅展示決策必要動態值，不顯示用戶總現金、總資產或固定缺口)_

### 6.2 cashExposureAdvisor 訊息降噪設計

```javascript
{
  status: "CRISIS_ACCUMULATE",
  suggestedDcaAmt: batchLimit,
  exposureGap,
  targetExposure,
  cashAdequacy,
  // 簡潔主訊息：
  message: `⚡ 恐慌加碼模式：無借款帳戶，建議本批加碼 00675L 上限 ${batchLimit.toLocaleString()} TWD`,
  // 展開式細節／分析依據：
  batchRationale: `VIX 恐慌視窗；每批上限 = min(現金×${CRISIS_ACCUMULATE_BATCH_RATIO * 100}%, ${CRISIS_ACCUMULATE_MAX_BATCH})；歷史實證 VIX>40 長期正期望值，限速控制路徑損耗`,
  // 風險提示：
  disclaimer: "P0 DCA 維持不變，本建議僅影響 P1 條件加碼；00675L 為槓桿產品，震盪市存在複利損耗"
}
```

---

## 7. 逐檔改動規格（精確到行號）

### 7.1 `src/modules/strategy/strategyDefaults.mjs`

**位置**：第 218 行後追加集中管理常數（SSOT）

```javascript
// ─────────────────────────────────────────────────────────────
// 危機加碼（Crisis Accumulate）相關常數
// ─────────────────────────────────────────────────────────────

/**
 * 恐慌型雷達清單
 * 在無借款帳戶中代表「市場情緒恐慌加碼機會」，非信用/基本面惡化封鎖訊號
 * @type {string[]}
 */
export const PANIC_RADARS = ["extremePanicRadar", "vixSpike"];

/**
 * 危機加碼批次比例（佔可用現金）
 * @type {number}
 */
export const CRISIS_ACCUMULATE_BATCH_RATIO = 0.1; // 10%

/**
 * 危機加碼單批最大金額（TWD）
 * 硬上限保護，避免高波動震盪下路徑損耗過大
 * @type {number}
 */
export const CRISIS_ACCUMULATE_MAX_BATCH = 50000; // 5 萬 TWD
```

---

### 7.2 `src/modules/strategy/regimePolicy.mjs`

**位置**：第 36–65 行（`determineRegime` 函式）

```javascript
// 函式簽名新增 debtMode（預設 DEFENSE 保持向後相容）
export function determineRegime(vix, sentiment, config = {}, debtMode = "DEFENSE") {
  // ... 前處理不變 ...

  if (vixValue >= vixAbsoluteOverride) {
    if (debtMode === "OPPORTUNITY") {
      return {
        state: "CRISIS",
        leverageMultiplier: 0,
        mode: "crisis_accumulate",     // ← OPPORTUNITY 模式輸出
        reason: `VIX ${vixValue.toFixed(1)} ≥ ${vixAbsoluteOverride}，無借款帳戶 → 恐慌加碼視窗`,
        context: { vix: vixValue, debtMode: "OPPORTUNITY", ... },
      };
    }

    // DEFENSE 模式：原防斷頭邏輯 100% 完整保留
    return {
      state: "CRISIS",
      leverageMultiplier: 0,
      mode: "sell_only",
      reason: `VIX ${vixValue.toFixed(1)} ≥ 絕對門檻 ${vixAbsoluteOverride} → 危機模式`,
      context: { vix: vixValue, debtMode: "DEFENSE", ... },
    };
  }

  // CAUTIOUS / NORMAL 邏輯不變
}
```

---

### 7.3 `src/modules/strategy/decision/rules/RegimePolicyRule.mjs`

**位置**：第 59–78 行（CRISIS 判定分支，新增型別防護）

```javascript
// 型別防護：確保從 JSON 或字串轉入的 "0" 能正確轉為 0
const totalDebt = Number(ctx.totalDebt ?? portfolio?.totalDebt ?? 0);
const debtMode = totalDebt === 0 ? "OPPORTUNITY" : "DEFENSE";

const regimeResult = determineRegime(vix, sentiment, regimeCfg, debtMode);

if (regimeResult.state === "CRISIS") {
  if (regimeResult.mode === "sell_only") {
    // DEFENSE 模式：立即 return 強制減碼
    const deleverageCfg = strategy.dynamicDeleverage || { sellRatio: 1.0 };
    const sellPercent = Math.round(deleverageCfg.sellRatio * 100);
    return createDecisionResult({
      marketStatus: "🚨【VIX 危機模式】",
      target: "🔴 局部減碼 / 強制賣出",
      targetSuggestion: `建議賣出 00675L 當前持股之 ${sellPercent}%`,
      regimeState: "CRISIS",
      regimeResult,
    });
  }

  if (regimeResult.mode === "crisis_accumulate") {
    // OPPORTUNITY 模式：注入狀態，不中斷決策鏈，交由後續 CashExposureAdvisor 計算具體金額
    engineState.crisisAccumulateMode = true;
    engineState.debtMode = "OPPORTUNITY";
  }
}
```

---

### 7.4 `src/modules/strategy/cashExposureAdvisor.mjs`

**位置**：函式簽名與第 71–81 行（新增型別防護與雷達分流優先序）

```javascript
import {
  PANIC_RADARS,
  CRISIS_ACCUMULATE_BATCH_RATIO,
  CRISIS_ACCUMULATE_MAX_BATCH,
} from "./strategyDefaults.mjs";

export function evaluateCashExposure({
  cash,
  grossExposure,
  accountNetAsset,
  kellyConservative,
  radarTriggered = [],
  totalDebt = 0, // ← 新增參數，預設 0
}) {
  // ... 前處理計算 ...

  const numericDebt = Number(totalDebt ?? 0);

  if (radarTriggered && radarTriggered.length > 0) {
    const panicRadars = radarTriggered.filter((r) => PANIC_RADARS.includes(r));
    const fundamentalRadars = radarTriggered.filter(
      (r) => !PANIC_RADARS.includes(r),
    );

    // 1. 若有任何基本面/信用雷達觸發 → 一律 DEFER（基本面優先於恐慌機會）
    if (fundamentalRadars.length > 0) {
      return {
        status: "DEFER",
        suggestedDcaAmt: 0,
        exposureGap,
        targetExposure,
        cashAdequacy,
        message: `基本面雷達觸發：${fundamentalRadars.join("，")}，暫緩加速，維持基礎 DCA`,
      };
    }

    // 2. 純恐慌型雷達觸發 + 無借款帳戶 → 限速加碼
    if (panicRadars.length > 0 && numericDebt === 0) {
      const batchLimit = Math.min(
        cash * CRISIS_ACCUMULATE_BATCH_RATIO,
        CRISIS_ACCUMULATE_MAX_BATCH,
      );
      return {
        status: "CRISIS_ACCUMULATE",
        suggestedDcaAmt: batchLimit,
        exposureGap,
        targetExposure,
        cashAdequacy,
        message: `⚡ 恐慌加碼模式：無借款帳戶，建議本批加碼 00675L 上限 ${batchLimit.toLocaleString()} TWD`,
        batchRationale: `VIX 恐慌視窗；每批上限 = min(現金×${CRISIS_ACCUMULATE_BATCH_RATIO * 100}%, ${CRISIS_ACCUMULATE_MAX_BATCH})；歷史實證 VIX>40 長期正期望值，限速控制路徑損耗`,
        disclaimer:
          "P0 DCA 維持不變，本建議僅影響 P1 條件加碼；00675L 為槓桿產品，震盪市存在複利損耗",
      };
    }

    // 3. 有借款帳戶 + 恐慌雷達 → DEFER（防斷頭）
    return {
      status: "DEFER",
      suggestedDcaAmt: 0,
      exposureGap,
      targetExposure,
      cashAdequacy,
      message: `市場雷達異常：${radarTriggered.join("，")}，暫緩加速，維持基礎 DCA`,
    };
  }

  // ... 正常 DCA 流程 ...
}
```

---

### 7.5 `src/modules/strategy/leadingIndicatorEvaluator.mjs`

**位置**：第 188–194 行

```javascript
const cashExposureAnalysis = evaluateCashExposure({
  cash: portfolio.cash ?? 0,
  grossExposure: portfolio.currentExposure ?? 0,
  accountNetAsset: portfolio.accountNetAsset,
  kellyConservative: marketData.kellyConservative,
  radarTriggered: triggeredRadars.map((r) => r.radarId).filter(Boolean),
  totalDebt: portfolio.totalDebt ?? 0, // ← 補傳 totalDebt
});
```

---

## 8. 分階段執行計畫（TDD 優先）

### Phase 1 — 測試骨架 + strategyDefaults（1 天）

1. 在 `strategyDefaults.mjs` 定義 3 個常數
2. 撰寫 RED 測試：
   - `regimePolicy.test.mjs`（OPPORTUNITY vs DEFENSE 分流測試）
   - `cashExposureAdvisor.test.mjs`（恐慌雷達 vs 基本面雷達分流測試，含同時觸發邊界測試）
3. 執行 `npm test`：驗證舊測試全數 GREEN，新測試明確 RED

### Phase 2 — `regimePolicy.mjs` + `RegimePolicyRule.mjs`（1~2 天）

1. 實作 `determineRegime` 之 `debtMode` 分流
2. 實作 `RegimePolicyRule.evaluate()` 注入狀態不中斷邏輯（含 `Number(totalDebt)` 型別防護）
3. 執行 `npm test`：regimePolicy 測試轉 GREEN

### Phase 3 — `cashExposureAdvisor.mjs` + `leadingIndicatorEvaluator.mjs`（1 天）

1. 實作 `evaluateCashExposure` 恐慌型雷達分流（含 `Number(totalDebt)` 型別防護）
2. `leadingIndicatorEvaluator.mjs` 補傳 `totalDebt`
3. 執行 `npm test`：cashExposureAdvisor 測試轉 GREEN

### Phase 4 — Telegram 報告模板格式化（0.5 天）

1. 實作 `CRISIS_ACCUMULATE` 狀態的動態卡片格式（含 `00675L 震盪市存在複利耗損` 風險提示）
2. 確保卡片無硬編碼數值，且 P0 DCA 區塊顯示綠色無條件執行

### Phase 5 — 整合驗收（0.5 天）

1. 執行「附錄 A：設計案例（2026-11-04 Fixture）」端到端測試
2. 驗收動態欄位計算正確性與 Telegram 卡片輸出

---

## 9. 風險管理表

| 風險項目                                   | 機率 | 影響 | 緩解措施                                                                                |
| ------------------------------------------ | ---- | ---- | --------------------------------------------------------------------------------------- |
| 未來復借後 OPPORTUNITY 誤判                | 低   | 高   | `Number(totalDebt) > 0` 自動強制切回 DEFENSE 模式，零人工介入                           |
| 高波動震盪下的複利損耗（Volatility Decay） | 高   | 中   | `CRISIS_ACCUMULATE_MAX_BATCH` 硬上限防護，避免單批過大；Telegram 卡片與 disclaimer 揭露 |
| 恐慌時市場續跌（如 2008 續跌約 30%）       | 中   | 中   | 限速加碼即為平攤進場成本，單批金額上限受可用現金比例限制                                |
| 修改影響既有 1929 個測試                   | 低   | 高   | 所有新參數設有相容預設值（`debtMode="DEFENSE"`），現有測試走既有路徑                    |

---

## 10. 成功標準（分層）

### 10.1 通用成功標準（軟體行為）

- [ ] 現有 1929 個既有測試 100% 保持 GREEN
- [ ] 新增單元測試完整覆蓋：
  - `Number(totalDebt) === 0` + 恐慌雷達 → `status = "CRISIS_ACCUMULATE"`
  - `Number(totalDebt) === 0` + 基本面雷達 → `status = "DEFER"`
  - `Number(totalDebt) === 0` + **同時觸發恐慌與基本面雷達 → `status = "DEFER"`（基本面優先，安全優先）**
  - `Number(totalDebt) > 0` + 恐慌雷達 → `status = "DEFER"`
  - 批次金額滿足公式：`batchLimit = min(cash * BATCH_RATIO, MAX_BATCH)`
- [ ] P0 DCA（每月固定扣款）在任何 Regime 與雷達觸發下均維持 GREEN 無條件執行
- [ ] Telegram 卡片模板完全參數化，無個人帳戶快照硬編碼，包含 2x 槓桿產品複利耗損提示

### 10.2 案例驗收標準（2026-11-04 Fixture）

- [ ] 以 `data/reports/2026-11-04.json` 執行時，輸出 `status = "CRISIS_ACCUMULATE"`
- [ ] 案例計算之 `batchLimit` 精確等於 50,000 TWD（因 600,000 × 10% = 60,000 > 50,000 上限）
- [ ] 決策建議不再包含「建議賣出 00675L」

---

## 11. 參考文獻

1. FinLab（2026）：VIX>40 買進實證回測（36 年，S&P 500）。
2. 第一金投信：台股 VIX 40~50 區間 3 年勝率 99.4% 統計研究。
3. Frontiers in Applied Mathematics and Statistics (2020)：Half Kelly 與投資組合節流應用。
4. Preprints (2026-02)：Predictive Signals from VIX Spikes 與 Regime-Aware 分批戰術配置。

---

## 附錄 A：設計案例與驗收 Fixture（2026-11-04 快照）

> **注意**：本附錄之數值僅用於重現問題背景、邊界條件測試與驗收 Fixture，**絕非系統日常執行的固定文案**。

- **快照日期**：2026-11-04
- **市場指標**：TAIEX VIX = 41.18（單日大跌 -6.3%）
- **帳戶狀態**：
  - `totalDebt` = 0（增貸已全數還清或投入，無流動負債）
  - `cash` = 600,000 TWD（自有防禦現金）
  - `00675L` 市值 = 51,010 TWD
  - `0050` 市值 = 1,798,768 TWD
  - 當前總槓桿 = 0.78x，目標槓桿 = 1.2x
- **驗收預期結果**：
  - `debtMode` = "OPPORTUNITY"
  - `regimeResult.mode` = "crisis_accumulate"
  - `cashExposureAnalysis.status` = "CRISIS_ACCUMULATE"
  - `suggestedDcaAmt` = 50,000 TWD（受 `MAX_BATCH` 5 萬硬上限截斷）
  - `P0 DCA` = 綠色無條件執行（不干預）

---

_計畫書版本：v2.2 | 建立：2026-11-04 | 最後更新：2026-11-04 | 負責人：Han_
