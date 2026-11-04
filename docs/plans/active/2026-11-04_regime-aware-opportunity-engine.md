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

# 計畫書：Regime-Aware Opportunity Engine（危機加碼引擎）v2.0

---

## 1. 問題陳述

### 1.1 現象

2026-11-04，台股單日大跌 -6.3%，VIX 飆至 41.18。
使用者（Han）的投資策略明確要求「趁恐慌分批加碼 00675L」，但系統給出以下輸出：

| 模組                  | 觸發邏輯                  | 輸出                              | 實際效果                 |
| --------------------- | ------------------------- | --------------------------------- | ------------------------ |
| `RegimePolicyRule`    | VIX=41 ≥ 35 → CRISIS      | `sell_only`，建議賣出 00675L 100% | 阻止加碼                 |
| `extremePanicRadar`   | VIX 超門檻觸發            | radarTriggered 清單非空           | 傳入 cashExposureAdvisor |
| `cashExposureAdvisor` | radarTriggered.length > 0 | `DEFER`，suggestedDcaAmt=0        | 暫緩一切加速             |
| `theoreticalShadow`   | Kelly=0.31x < 當前 0.78x  | UI 紅燈警示                       | 顯示超出上限             |

**四層機制同時亮紅燈，系統在使用者最想加碼的時刻全面封鎖。**

### 1.2 根本矛盾

現行系統的設計前提是：**使用者有融資借款，VIX 飆高代表斷頭風險**。

但使用者的真實狀況是：

- `totalDebt = 0`（無借款，2026-11 增貸已全數還清或投入，無流動負債）
- `cash = 600,000 TWD`（自有現金，非保證金）
- 00675L 持倉僅 51,010 TWD（佔淨資產 2.1%）
- 目標：**主動將金融槓桿從 0.78x 分批調整至 1.2x**

**系統在用「防止爆倉」邏輯管理一個根本不會爆倉的帳戶。**

---

## 2. 佐證與學術根據

### 2.1 VIX>40 的歷史加碼勝率（實證）

> 來源：FinLab 量化研究，1990–2026 回測（36 年、S&P 500，2026-06 更新）
> URL: https://finlab.finance/blog/vix-us-stock-crash-investing-python

| 策略                                 | 樣本      | 持有 250 日平均報酬 | 勝率    | 最差一次          |
| ------------------------------------ | --------- | ------------------- | ------- | ----------------- |
| **訊號 A：VIX 收盤突破 40 當天買進** | **12 次** | **+22.1%**          | **83%** | -14.3%（2001 年） |
| 訊號 B：VIX 曾破 40、降至 30 再買    | 10 次     | +16.8%              | 90%     | -18.5%            |
| 任意時點買進（基準）                 | 8,900+ 天 | +10.0%              | 81%     | —                 |

**結論**：VIX>40 當天進場，250 日報酬是任意進場的 **2.2 倍**。恐慌優勢在「報酬幅度」，不在勝率。
「等 VIX 降溫再買」的策略在全樣本不成立，訊號 A 更優。

> 來源：第一金投信，30 年歷史數據
> URL: https://www.fsitc.com.tw/ManagerEDM.aspx?ID=1938&Type=2

| 進場 VIX  | 6M 平均報酬 | 1Y 平均報酬 | 2Y 平均報酬 | 3Y 勝率 |
| --------- | ----------- | ----------- | ----------- | ------- |
| VIX 40~50 | +14.2%      | +28.9%      | +45.7%      | 99.4%   |
| VIX >50   | 更高        | 更高        | 更高        | 100%    |

**台股數據也同樣支持：VIX 越高、長期勝率越高。**

### 2.2 Kelly Criterion 在無借款情境的正確用法

> 來源：Frontiers in Applied Mathematics and Statistics (2020)
> URL: https://doi.org/10.3389/fams.2020.577050

原論文結論：

- Kelly 最大化長期幾何報酬，但 Full Kelly 在短期波動極大
- 實務上採 **Half Kelly（0.5×Kelly）** 可大幅降低 drawdown，同時保留 75% 的長期報酬
- **無借款情境下**，Kelly 是「加碼速度的節流器」，而非「強制減倉訊號」

當前系統誤用：Kelly < 當前槓桿 → 警告 → 建議賣出。
正確解讀：Kelly < 當前槓桿 → **新資金每批金額放慢，但現有部位不強制賣出。**

### 2.3 Regime Switching 文獻

> 來源：Predictive Signals from VIX Spikes (Preprints, 2026-02)
> URL: https://www.preprints.org/manuscript/202602.1048

核心發現：

- VIX 急漲後（regime shift），後續 1~3 個月的「局部戰術配置」(tactical allocation) 有顯著正期望值
- 高 VIX 環境是**採購機會**（opportunity window），而非單純的風險訊號
- **Regime 與部位大小應分離**：高風險期可降低「每批」金額，但不應封鎖方向

### 2.4 Antifragile Portfolio 理論

> 來源：CFA Institute Enterprising Investor (2020)
> URL: https://rpc.cfainstitute.org/blogs/enterprising-investor/2020/creating-anti-fragile-portfolios

Nassim Taleb 的 Antifragile 概念在投資組合的應用：

- 核心資產（0050）充當穩定錨，不因恐慌賣出
- 衛星資產（00675L）在市場極端壓力時**小批量進場**，利用高波動率創造非對稱報酬
- 關鍵：**每批金額受限（例如：自有現金 × 10%）**，而非方向封鎖

---

## 3. 現行問題深度分析

### 3.1 決策鏈全貌（現行，VIX=41 情境）

```
dailyCheckTheoreticalAdapter.mjs
  └─ leadingIndicatorEvaluator.mjs
       ├─ [Step 1] evaluateLeadingIndicators()
       │    └─ extremePanicRadar 觸發 → triggeredRadars 非空
       │
       ├─ [Step 2] RegimePolicyRule.evaluate() [Priority 0]
       │    └─ determineRegime(VIX=41, ...) → state="CRISIS"
       │         └─ 立即 return sell_only 決策 ← 阻斷所有後續規則
       │
       └─ [Step 3] evaluateCashExposure()
            └─ radarTriggered.length > 0
                 └─ return { status: "DEFER", suggestedDcaAmt: 0 }
```

### 3.2 三個根本設計問題（對應到原始碼）

#### 問題 A：`regimePolicy.mjs` 第 50–65 行

```javascript
// 現行：CRISIS 無條件 return sell_only，不感知 totalDebt
if (vixValue >= vixAbsoluteOverride) {   // vixAbsoluteOverride = 35
  return {
    state: "CRISIS",
    leverageMultiplier: 0,
    mode: "sell_only",          // ← 無論 totalDebt=0 或 500萬，行為相同
    reason: `VIX ${vixValue.toFixed(1)} ≥ 絕對門檻 ${vixAbsoluteOverride} → 危機模式`,
    context: { vix: vixValue, ... },
  };
}
```

#### 問題 B：`RegimePolicyRule.mjs` 第 59–78 行

```javascript
// 現行：CRISIS 立即 return，阻斷所有後續規則
if (regimeResult.state === "CRISIS") {
  const deleverageCfg = strategy.dynamicDeleverage || { sellRatio: 1.0 };
  const sellPercent = Math.round(deleverageCfg.sellRatio * 100);

  return createDecisionResult({
    marketStatus: "🚨【VIX 危機模式】",
    target: "🔴 局部減碼 / 強制賣出",
    targetSuggestion: `建議賣出 00675L 當前持股之 ${sellPercent}%`,
    // ← totalDebt=0 時這段邏輯毫無必要
  });
}
```

#### 問題 C：`cashExposureAdvisor.mjs` 第 71–81 行

```javascript
// 現行：所有雷達觸發一律 DEFER，不區分恐慌型/基本面型
if (radarTriggered && radarTriggered.length > 0) {
  return {
    status: "DEFER",
    suggestedDcaAmt: 0,
    message: `市場雷達異常：${radarTriggered.join("，")}，暫緩加速，維持基礎 DCA`,
    // ← extremePanicRadar（恐慌型）和 creditSpreadRadar（基本面型）獲得完全相同處理
  };
}
```

#### 問題 D：`leadingIndicatorEvaluator.mjs` 第 188–194 行

```javascript
// 現行：呼叫 evaluateCashExposure 時未傳入 totalDebt
const cashExposureAnalysis = evaluateCashExposure({
  cash: portfolio.cash ?? 0,
  grossExposure: portfolio.currentExposure ?? 0,
  accountNetAsset: portfolio.accountNetAsset,
  kellyConservative: marketData.kellyConservative,
  radarTriggered: triggeredRadars.map((r) => r.radarId).filter(Boolean),
  // ← 沒有 totalDebt，cashExposureAdvisor 無從判斷債務狀態
});
```

### 3.3 受影響檔案清單

| 優先級 | 檔案路徑                                                   | 問題                           | 改動範圍                                |
| ------ | ---------------------------------------------------------- | ------------------------------ | --------------------------------------- |
| 🔴 P0  | `src/modules/strategy/regimePolicy.mjs`                    | CRISIS = sell_only，不感知債務 | 新增 `debtMode` 參數，約 +20 行         |
| 🔴 P0  | `src/modules/strategy/decision/rules/RegimePolicyRule.mjs` | CRISIS 直接 return，阻斷後續   | 第 59–78 行改寫，約 +10 行              |
| 🟠 P1  | `src/modules/strategy/cashExposureAdvisor.mjs`             | 雷達一律 DEFER                 | 第 71–81 行改寫 + 新增 `totalDebt` 參數 |
| 🟠 P1  | `src/modules/strategy/leadingIndicatorEvaluator.mjs`       | 未傳 totalDebt                 | 第 188–194 行補傳一個參數               |
| 🟡 P2  | `src/modules/strategy/strategyDefaults.mjs`                | 缺乏恐慌加碼常數               | 尾端追加 3 個常數                       |

---

## 4. 設計方案：Debt-Aware Dual Mode

### 4.1 核心原則

```
帳戶狀態判定（由 leadingIndicatorEvaluator 計算後傳遞）：

  portfolio.totalDebt === 0
    → debtMode = "OPPORTUNITY"（機會型模式，本計畫新增）

  portfolio.totalDebt > 0
    → debtMode = "DEFENSE"（防禦型模式，現行邏輯 100% 保留）
```

**DEFENSE 模式** = 現有邏輯 100% 不變
**OPPORTUNITY 模式** = 本計畫新增邏輯

**若未來復借（totalDebt > 0），自動切回 DEFENSE，零人工介入。**

### 4.2 OPPORTUNITY 模式的 Regime 重定義

| Regime     | VIX 範圍 | DEFENSE 模式（維持不變）   | OPPORTUNITY 模式（新增）                 |
| ---------- | -------- | -------------------------- | ---------------------------------------- |
| NORMAL     | < 28     | 允許加碼                   | 允許加碼（同左）                         |
| CAUTIOUS   | 28–35    | 減速 25%                   | 減速 25%（同左）                         |
| **CRISIS** | **≥ 35** | **sell_only，建議賣出 X%** | **`crisis_accumulate`，每批限速 ≤ 5 萬** |

### 4.3 最終使用者看到的輸出變化

**改動前（VIX=41，totalDebt=0）**：

```
🚨【VIX 危機模式】
目標：🔴 局部減碼 / 強制賣出
建議：依生命週期投資法實行減碼，建議賣出 00675L 當前持股之 100%
• 禁止新增戰術部位
• 允許操作：0050 DCA 照常執行 + 依比例減倉 100%
```

**改動後（VIX=41，totalDebt=0）**：

```
⚡【恐慌加碼視窗】無借款帳戶 · VIX 危機模式
目標：📈 分批限速加碼（CRISIS_ACCUMULATE）
建議：VIX=41，歷史 36 年實證勝率 83%（250 日均報酬 +22.1%）
• 建議本批加碼 00675L：50,000 TWD（現金 10% 上限）
• 目標槓桿：1.2x，當前：0.78x，缺口需累計約 52 萬 TWD
• ✅ P0 DCA 每月 3 萬照常執行（鐵律，不受任何 Regime 影響）
• ⚠️ P1 條件加碼：每批 5 萬，VIX 仍高時控制路徑損耗
```

---

## 5. 逐檔改動說明（精確到行號）

### 5.1 `strategyDefaults.mjs`（尾端追加，不改動現有常數）

**位置**：第 218 行之後（`ALL_DEFAULTS` 之後）新增

```javascript
// ─────────────────────────────────────────────────────────────
// 危機加碼（Crisis Accumulate）相關常數
// 僅在 debtMode = "OPPORTUNITY"（totalDebt=0）時生效
// ─────────────────────────────────────────────────────────────

/**
 * 恐慌型雷達清單
 * 這些雷達在無借款帳戶中代表「加碼機會」而非封鎖訊號
 * @type {string[]}
 */
export const PANIC_RADARS = ["extremePanicRadar", "vixSpike"];

/**
 * 危機加碼批次比例（佔可用現金）
 * OPPORTUNITY 模式下，每批加碼金額上限 = cash × 此比例
 * @type {number}
 */
export const CRISIS_ACCUMULATE_BATCH_RATIO = 0.1; // 10%

/**
 * 危機加碼單批最大金額（TWD）
 * 避免路徑損耗過大，即使現金充裕每批也不超過此金額
 * @type {number}
 */
export const CRISIS_ACCUMULATE_MAX_BATCH = 50000; // 5 萬
```

---

### 5.2 `regimePolicy.mjs`（修改 `determineRegime` 函式簽名與 CRISIS 分支）

**位置**：第 36–65 行（`determineRegime` 函式）

```javascript
// 函式簽名：新增第四個參數（預設 "DEFENSE"，確保向後相容）
export function determineRegime(vix, sentiment, config = {}, debtMode = "DEFENSE") {
  // ...（前處理完全不變）...

  if (vixValue >= vixAbsoluteOverride) {
    // OPPORTUNITY 模式（totalDebt=0）：改為限速加碼，不強制賣出
    if (debtMode === "OPPORTUNITY") {
      return {
        state: "CRISIS",
        leverageMultiplier: 0,
        mode: "crisis_accumulate",     // ← 新 mode
        reason: `VIX ${vixValue.toFixed(1)} ≥ ${vixAbsoluteOverride}，無借款帳戶 → 恐慌加碼視窗`,
        context: { vix: vixValue, debtMode: "OPPORTUNITY", ... },
      };
    }

    // DEFENSE 模式（totalDebt>0 或未傳參數）：原邏輯完整保留
    return {
      state: "CRISIS",
      leverageMultiplier: 0,
      mode: "sell_only",
      reason: `VIX ${vixValue.toFixed(1)} ≥ 絕對門檻 ${vixAbsoluteOverride} → 危機模式`,
      context: { vix: vixValue, debtMode: "DEFENSE", ... },
    };
  }

  // CAUTIOUS / NORMAL：完全不變
}
```

---

### 5.3 `RegimePolicyRule.mjs`（修改 CRISIS 分支，第 59–78 行）

```javascript
// 取得 totalDebt 並計算 debtMode
const totalDebt = ctx.totalDebt ?? portfolio?.totalDebt ?? 0;
const debtMode = totalDebt === 0 ? "OPPORTUNITY" : "DEFENSE";

// 判定 Regime 狀態（傳入 debtMode）
const regimeResult = determineRegime(vix, sentiment, regimeCfg, debtMode);

// CRISIS 模式：依 debtMode 分流
if (regimeResult.state === "CRISIS") {
  if (regimeResult.mode === "sell_only") {
    // DEFENSE 模式：原邏輯 100% 保留
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
    // OPPORTUNITY 模式：注入狀態到 engineState，不 return，繼續下一規則
    engineState.crisisAccumulateMode = true;
    engineState.debtMode = "OPPORTUNITY";
    // 不 return → cashExposureAdvisor 繼續執行，給出具體加碼金額
  }
}
```

---

### 5.4 `cashExposureAdvisor.mjs`（修改雷達分流，第 71–81 行）

**新增 import**（檔案頂端）：

```javascript
import {
  PANIC_RADARS,
  CRISIS_ACCUMULATE_BATCH_RATIO,
  CRISIS_ACCUMULATE_MAX_BATCH,
} from "./strategyDefaults.mjs";
```

**函式簽名**：新增 `totalDebt = 0` 參數。

**雷達判定段改動**：

```javascript
if (radarTriggered && radarTriggered.length > 0) {
  const panicRadars = radarTriggered.filter((r) => PANIC_RADARS.includes(r));
  const fundamentalRadars = radarTriggered.filter(
    (r) => !PANIC_RADARS.includes(r),
  );

  // 1. 基本面雷達 → 無論借款狀態，一律 DEFER
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

  // 2. 純恐慌型雷達 + 無借款 → 限速加碼（CRISIS_ACCUMULATE）
  if (panicRadars.length > 0 && totalDebt === 0) {
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
      batchRationale: `VIX 恐慌視窗，每批限速 ${batchLimit.toLocaleString()} TWD（現金 10% 上限）`,
      message: `⚡ 恐慌加碼模式：無借款帳戶，VIX 歷史勝率 83%。建議本批加碼 00675L ${batchLimit.toLocaleString()} TWD`,
      disclaimer: "P0 DCA（每月 3 萬）維持不變，本建議僅影響 P1 條件加碼",
    };
  }

  // 3. 有借款 → 原邏輯 DEFER
  return {
    status: "DEFER",
    suggestedDcaAmt: 0,
    exposureGap,
    targetExposure,
    cashAdequacy,
    message: `市場雷達異常：${radarTriggered.join("，")}，暫緩加速，維持基礎 DCA`,
  };
}
```

---

### 5.5 `leadingIndicatorEvaluator.mjs`（補傳 totalDebt，第 188–194 行）

```javascript
const cashExposureAnalysis = evaluateCashExposure({
  cash: portfolio.cash ?? 0,
  grossExposure: portfolio.currentExposure ?? 0,
  accountNetAsset: portfolio.accountNetAsset,
  kellyConservative: marketData.kellyConservative,
  radarTriggered: triggeredRadars.map((r) => r.radarId).filter(Boolean),
  totalDebt: portfolio.totalDebt ?? 0, // ← 新增一行
});
```

---

## 6. 不變更項目（Frozen）

| 項目                          | 原因                                   |
| ----------------------------- | -------------------------------------- |
| P0 DCA 每月 3 萬 0050         | 鐵律，任何 Regime 不干預               |
| `hardCap` 強制降槓邏輯        | totalDebt > 0 時的爆倉防線             |
| DEFENSE 模式全部現有邏輯      | 有借款時原邏輯 100% 保留               |
| `maintenanceRatio` 維持率計算 | 未來復借時仍需要                       |
| 00675L 停利 +80% 設定         | 策略紀律不變                           |
| Kelly 在 UI 的顯示警告        | 資訊透明，紅燈維持，但不再觸發賣出建議 |

---

## 7. 分階段執行計畫（TDD 優先）

### Phase 1 — 測試骨架 + strategyDefaults（1 天）

1. 在 `strategyDefaults.mjs` 尾端追加 3 個常數
2. 撰寫 RED 測試：
   - `regimePolicy.test.mjs`（OPPORTUNITY vs DEFENSE 分流測試）
   - `cashExposureAdvisor.test.mjs`（恐慌雷達 vs 基本面雷達分流測試）
3. 執行 `npm test`：確認舊測試全部 GREEN，新測試全部 RED（確認 RED 才算就緒）

### Phase 2 — `regimePolicy.mjs` + `RegimePolicyRule.mjs`（1~2 天）

1. 修改 `determineRegime` 函式簽名，新增 `debtMode` 分流
2. 修改 `RegimePolicyRule.evaluate()`：計算 `debtMode`，crisis_accumulate 不 return
3. 執行 `npm test`：regimePolicy 新測試 GREEN，現有測試不受影響

### Phase 3 — `cashExposureAdvisor.mjs` + `leadingIndicatorEvaluator.mjs`（1 天）

1. 修改 `evaluateCashExposure` 函式簽名，新增 `totalDebt` 參數
2. 實作恐慌型雷達分流邏輯
3. 在 `leadingIndicatorEvaluator.mjs` 補傳 `totalDebt`
4. 執行 `npm test`：cashExposureAdvisor 新測試 GREEN

### Phase 4 — Telegram 報告模板（0.5 天）

1. 新增 `CRISIS_ACCUMULATE` 狀態的 Telegram 卡片模板（⚡ 恐慌加碼視窗）
2. 確保 P0 DCA 區塊顯示 `✅ 綠色無條件執行`，不受 CRISIS_ACCUMULATE 影響

### Phase 5 — 整合驗收（0.5 天）

1. 以 `data/reports/2026-11-04.json`（VIX=41, totalDebt=0）為輸入跑完整 engine
2. 驗證輸出：`CRISIS_ACCUMULATE`，建議本批加碼 50,000 TWD
3. 驗證 P0 DCA 維持 GREEN
4. `git commit` + `git push`

**估計總工時：3~5 天（不急上線，可分批推進）**

---

## 8. 風險與緩解

| 風險                             | 機率 | 影響 | 緩解措施                                                             |
| -------------------------------- | ---- | ---- | -------------------------------------------------------------------- |
| 未來復借後 OPPORTUNITY 誤判      | 低   | 高   | `totalDebt > 0` 自動切回 DEFENSE，零人工介入                         |
| CRISIS_ACCUMULATE 金額設定不合理 | 中   | 中   | `CRISIS_ACCUMULATE_MAX_BATCH = 50000` 硬上限，常數集中管理可快速調整 |
| 修改破壞現有 1929 個測試         | 低   | 高   | 所有新參數有預設值（向後相容），Phase 1 先驗證舊測試仍 GREEN         |
| 市場繼續崩跌，00675L 損失擴大    | 中   | 中   | 每批 5 萬上限保護現金底線；VIX>40 歷史 83% 勝率作為進場依據          |
| `ctx.totalDebt` 在呼叫鏈不存在   | 低   | 低   | Phase 3 步驟 4 明確驗證，`data/reports` 已確認欄位存在               |

---

## 9. 成功標準

- [ ] 所有 1929 個現有測試繼續 GREEN（Phase 1 驗證）
- [ ] 新增 7 個測試全部 GREEN（Phase 2、3 完成後）
- [ ] VIX=41、totalDebt=0 輸入 → `cashExposureAnalysis.status = "CRISIS_ACCUMULATE"`
- [ ] VIX=41、totalDebt=0 輸入 → `regimeResult.mode = "crisis_accumulate"`（不再是 `sell_only`）
- [ ] VIX=41、totalDebt=500000 輸入 → 維持原輸出 `sell_only` / `DEFER`（DEFENSE 模式不受影響）
- [ ] P0 DCA（每月 3 萬）區塊在任何 Regime 下維持 GREEN 無條件執行
- [ ] Telegram 卡片正確顯示 `⚡ 恐慌加碼模式` + 批次金額 + P0 免責聲明

---

## 10. 參考資料

| 來源                  | 內容摘要                                                                          | URL                                                                                            |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| FinLab（2026）        | VIX>40 買進 S&P 500，12 次樣本，250 日平均 +22.1%，勝率 83%                       | https://finlab.finance/blog/vix-us-stock-crash-investing-python                                |
| 第一金投信            | VIX 40~50 進場，1Y 報酬 +28.9%，3Y 勝率 99.4%（30 年台股數據）                    | https://www.fsitc.com.tw/ManagerEDM.aspx?ID=1938&Type=2                                        |
| Frontiers FAMS (2020) | Kelly：無借款時為加碼速度節流器，非強制砍倉訊號                                   | https://doi.org/10.3389/fams.2020.577050                                                       |
| Preprints (2026-02)   | VIX 急漲後局部戰術配置有顯著正期望值，Regime 與部位大小應分離                     | https://www.preprints.org/manuscript/202602.1048                                               |
| CFA Institute (2020)  | Antifragile Portfolio：衛星資產在市場極端壓力時小批進場，每批金額受限而非方向封鎖 | https://rpc.cfainstitute.org/blogs/enterprising-investor/2020/creating-anti-fragile-portfolios |

---

_計畫書版本：v2.0 | 建立：2026-11-04 | 最後更新：2026-11-04 | 負責人：Han_
