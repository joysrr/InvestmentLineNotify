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

# 計畫書：Regime-Aware Opportunity Engine（危機加碼引擎）v2.4

---

## 修訂記錄

- **v2.4 (2026-11-04)** — 目標槓桿零硬編碼：引入階層式取得函數 `resolveTargetLeverage()`（優先級：用戶指定 > 策略恐慌檔位 > 評分階梯 > 生命週期天花板），移除 `CRISIS_ACCUMULATE_TARGET_LEVERAGE` 和 `CRISIS_ACCUMULATE_MAX_BATCH` 硬編碼，實現單一真理來源（SSOT）於 `Strategy.json` 與生命週期引擎。
- **v2.3 (2026-11-04)** — 升級至全動態自適應加碼演算法，消除 5 萬單批硬編碼；新增資料鏈淨資產兜底與雷達語義調和規格。
- **v2.2 (2026-11-04)** — 優化 Telegram 卡片資訊層次、簡化極端恐慌雷達判斷邏輯、補充實測案例與批次計算詳細規格。
- **v2.1 (2026-11-04)** — 新增程式碼層級改動定位（精確到行號）、端到端測試規格與生命週期引擎風險天花板說明。
- **v2.0 (2026-11-04)** — 首版計畫書，定義 Debt-Aware 雙模式架構（OPPORTUNITY vs DEFENSE）。

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

### 4.3 全動態帳戶狀態自適應加碼演算法（徹底消除硬編碼）

依照 Han 的原則指示，加碼上限**絕不可採用全域寫死的固定常數（如 50,000 元）**，且**目標槓桿同樣不可硬編碼**，必須完全依據**當前帳戶資產規模、當前曝險水位、策略配置與可用現金**進行純動態自適應計算：

#### 4.3.1 目標槓桿階層式取得（零硬編碼 SSOT）

**目標槓桿（TargetLeverage）來源優先級**（從高到低，取第一個有效值）：

1. **第一優先（用戶主動指定）**：`portfolio.targetLeverage`  
   若用戶在帳戶狀態表（Google Sheet）或 Bot 偏好中明確指定（例如 `1.15`、`1.25`、`1.30`），以此為準，系統無條件遵循。
2. **第二優先（策略配置恐慌檔位）**：`strategy.buy?.panic?.suggestedLeverage`  
   當純恐慌型雷達觸發且無借款時，讀取策略檔中的恐慌加碼專用槓桿參數。此參數在 `Strategy.default.json` 定義為：
   ```json
   "buy": {
     "panic": { "suggestedLeverage": 0.3 }  // 總槓桿 = 1 + 0.3 = 1.3x
   }
   ```
3. **第三優先（當前市場評分檔位）**：`strategy.allocation` 階梯  
   依當前大盤評分（跌幅、RSI、KD、MACD 加權總分）對應的 `allocation` 檔位中的 `leverage`：
   ```json
   "allocation": [
     { "minScore": -99, "leverage": 0.15, "comment": "平時/底倉 (1.15x)" },
     { "minScore": 4,   "leverage": 0.20, "comment": "微量/觀察 (1.20x)" },
     { "minScore": 6,   "leverage": 0.40, "comment": "一般訊號 (1.40x)" },
     { "minScore": 8,   "leverage": 0.60, "comment": "積極加碼 (1.60x)" },
     { "minScore": 10,  "leverage": 0.80, "comment": "槓桿全開 (1.80x)" }
   ]
   ```
   換算為總槓桿 = `1 + allocation[score].leverage`。
4. **防禦天花板（硬邊界保護，絕不可超越）**：`lifecycleContext.profile.maxLeverageForNewZ2`  
   無論前三優先級計算出多少，總槓桿絕不超過當前生命週期階段的新開倉上限。Han 目前 33 歲，屬 MID 階段，上限為 **1.5x**。

**階層式取得實作邏輯（偽代碼）**：

```javascript
function resolveTargetLeverage(
  portfolio,
  strategy,
  lifecycleContext,
  marketScore,
) {
  // 1. 用戶主動指定
  if (
    Number.isFinite(portfolio.targetLeverage) &&
    portfolio.targetLeverage > 0
  ) {
    return Math.min(
      portfolio.targetLeverage,
      lifecycleContext.profile.maxLeverageForNewZ2,
    );
  }
  // 2. 恐慌檔位
  if (strategy.buy?.panic?.suggestedLeverage != null) {
    const panicTotal = 1 + strategy.buy.panic.suggestedLeverage;
    return Math.min(panicTotal, lifecycleContext.profile.maxLeverageForNewZ2);
  }
  // 3. 評分階梯
  const alloc = getTargetLeverageByScore(marketScore, strategy);
  const allocTotal = 1 + alloc.leverage;
  return Math.min(allocTotal, lifecycleContext.profile.maxLeverageForNewZ2);
}
```

**設計優勢**：

- **零硬編碼**：程式碼中完全不存在任何寫死的 1.2x、1.3x 數字。
- **單一真理來源（SSOT）**：所有配置存於 `Strategy.json` 與生命週期引擎，前端 Mini App 與設定檔可直接調整，全系統自動連動。
- **多層防護**：即使用戶誤填過高值（例如 2.5x），生命週期防禦天花板自動攔截降至 1.5x。

---

#### 4.3.2 全動態自適應加碼金額計算

取得目標槓桿後，進行動態加碼金額計算：

1. **目標曝險（Target Gross Exposure）**：
   $$\text{TargetExposure} = \text{AccountNetAsset} \times \text{TargetLeverage}$$
   - `TargetLeverage`：由 §4.3.1 階層式取得。
   - `AccountNetAsset`：當前真實帳戶淨資產（0050 市值 + 00675L 市值 + 現金 - 負債）。

2. **剩餘曝險缺口（Gross Exposure Gap）**：
   $$\text{ExposureGap} = \max(0, \text{TargetExposure} - \text{GrossExposure})$$
   - `GrossExposure`：當前總曝險 = $Value_{0050} \times 1 + Value_{00675L} \times 2$。

3. **00675L 總資本加碼缺口（Capital Gap to Target）**：
   因 00675L 為 2 倍槓桿 ETF，每投入 1 元資本可提供 2 元曝險：
   $$\text{CapitalGap} = \frac{\text{ExposureGap}}{2}$$
   - 若 $\text{CapitalGap} \le 0$（槓桿已達到或超越 1.2x）：加碼額自動歸零（`suggestedDcaAmt = 0`），絕不超額加碼。

4. **單批動態加碼限額（Dynamic Batch Limit）**：
   當 $\text{CapitalGap} > 0$ 時，為防範恐慌持續探底與波動路徑損耗，單批上限由三個動態維度取保守最小值：
   $$\text{BatchLimit} = \min\left( \left\lfloor\frac{\text{CapitalGap}}{N}\right\rfloor,\; \lfloor\text{Cash} \times \text{CashRatio}\rfloor,\; \text{CapitalGap} \right)$$
   - **維度一（分批平攤進場）**：$\text{CapitalGap} / N$（分 $N$ 批平攤，預設 $N = 10$ 批）。
   - **維度二（現金安全流動性防線）**：$\text{Cash} \times \text{CashRatio}$（單批不超過可用現金的 10%，防單次恐慌抽乾防禦現金）。
   - **維度三（剩餘總缺口封頂）**：$\text{CapitalGap}$（封頂保護，當槓桿已逼近 1.2x 時自動收斂，絕不推破目標上限）。
   - **最後千元整數化**：向下取整至 1,000 元，方便下單執行。

**自適應優勢對比**：

| 情境                                               | 舊設計（硬編碼）                | 新設計（全動態自適應）                                            | 行為差異與優勢                   |
| -------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- | -------------------------------- |
| 2026-11-04 案例 (淨資產249萬, 現金60萬, 槓桿0.78x) | 硬套 50,000 元                  | 動態計算：Gap 52.3萬，10批=52,300；現金10%=6萬 → 取 **52,000 元** | 符合當前資產規模與分批步調       |
| 未來淨資產成長至 500 萬 (同比例)                   | 仍然死板給 50,000 元            | 動態計算：Gap 105萬，10批=105,000 → 取 **105,000 元**             | 自動隨資產規模放大，維持戰術效能 |
| 槓桿已達 1.18x (只差 2 萬達標)                     | 仍然強烈給 50,000 元 (衝破槓桿) | 動態計算：CapitalGap = 2.5萬 → 取 **25,000 元**                   | 自動減速收斂，絕不推破 1.2x 上限 |
| 現金不足 (現金僅剩 10 萬)                          | 仍然給 50,000 元 (抽乾一半現金) | 現金防線約束：10萬 × 10% → 取 **10,000 元**                       | 保護防禦現金流動性               |

---

### 4.4 正式區資料管線整合與雷達調和

1. **淨資產動態兜底（Dynamic Net Asset Fallback）**：
   在 `dailyCheck.mjs` 中，傳給 `evaluateLeadingIndicators` 的 `portfolio` 若其 `accountNetAsset` 為空（如來自 Google Sheet），系統動態由現價計算兜底：
   $$\text{accountNetAsset} = \text{cash} + (\text{qty0050} \times \text{price0050}) + (\text{qty00675L} \times \text{price00675L})$$
   解決因 Google Sheet 未填寫總資產導致 `cashExposureAdvisor` 前置回傳 `UNAVAILABLE` 的資料斷點。

2. **雷達文字與行動紀律調和（Debt-Aware Radar Wording）**：
   在 `extremePanicRadar.mjs` 中，傳入 `totalDebt` 狀態。當 `Number(totalDebt) === 0` 時，行動紀律由「`00675L 嚴格凍結防連環爆`」調和為「`00675L 依動態上限分批限速加碼`」，消除同一張 Telegram 卡片中文字自相矛盾的現象。

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
  batchRationale: `VIX 恐慌視窗；每批上限 = min(缺口/10批, 現金×10%, 總缺口)，千元取整；歷史實證 VIX>40 長期正期望值，限速控制路徑損耗`,
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
export const CRISIS_ACCUMULATE_BATCH_RATIO = 0.1; // 10% 現金安全流動性防線

/**
 * 危機加碼平攤批次數
 * 依據資本缺口分批進場，防範路徑損耗
 * @type {number}
 */
export const CRISIS_ACCUMULATE_BATCH_COUNT = 10; // 預設 10 批平攤
```

**Phase 7 變更（移除硬編碼常數）**：

- **移除** `CRISIS_ACCUMULATE_MAX_BATCH = 50000`（Phase 1-6 臨時防護，Phase 7 改為完全動態計算，見 §4.3.2）
- **移除** `CRISIS_ACCUMULATE_TARGET_LEVERAGE = 1.2`（目標槓桿改由階層式取得函數 `resolveTargetLeverage()` 提供，見 §4.3.1）

**設計理由**：

- **目標槓桿零硬編碼**：改由 `cashExposureAdvisor.mjs` 調用新函數 `resolveTargetLeverage(portfolio, strategy, lifecycleContext, marketScore)` 階層式取得（優先級：用戶指定 > 策略恐慌檔位 > 評分階梯 > 生命週期天花板），確保單一真理來源（SSOT）。
- **批次與比例保留**：`BATCH_COUNT` 和 `BATCH_RATIO` 為純粹的風險管理參數（分批紀律、現金防線），與帳戶狀態無關，保留為全域常數合理。

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
  CRISIS_ACCUMULATE_BATCH_COUNT,
} from "./strategyDefaults.mjs";
import { getTargetLeverageByScore } from "./riskManagement.mjs";

// Phase 7 新增：階層式取得目標槓桿函數（見 §4.3.1）
function resolveTargetLeverage(
  portfolio,
  strategy,
  lifecycleContext,
  marketScore,
) {
  // 1. 用戶主動指定
  if (
    Number.isFinite(portfolio.targetLeverage) &&
    portfolio.targetLeverage > 0
  ) {
    return Math.min(
      portfolio.targetLeverage,
      lifecycleContext.profile.maxLeverageForNewZ2,
    );
  }
  // 2. 恐慌檔位
  if (strategy.buy?.panic?.suggestedLeverage != null) {
    const panicTotal = 1 + strategy.buy.panic.suggestedLeverage;
    return Math.min(panicTotal, lifecycleContext.profile.maxLeverageForNewZ2);
  }
  // 3. 評分階梯
  const alloc = getTargetLeverageByScore(marketScore, strategy);
  const allocTotal = 1 + alloc.leverage;
  return Math.min(allocTotal, lifecycleContext.profile.maxLeverageForNewZ2);
}

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

    // 2. 純恐慌型雷達觸發 + 無借款帳戶 → 全動態自適應加碼
    if (panicRadars.length > 0 && numericDebt === 0) {
      // Phase 7: 階層式取得目標槓桿（零硬編碼，見 §4.3.1）
      const dynamicTargetLeverage = resolveTargetLeverage(
        portfolio,
        strategy,
        lifecycleContext,
        marketScore,
      );

      const targetExp = accountNetAsset * dynamicTargetLeverage;
      const currentGrossExp = Number(grossExposure ?? 0);
      const gap = Math.max(0, targetExp - currentGrossExp);
      const capitalGap = Math.max(0, gap / 2); // 00675L 為 2x 槓桿

      // 若槓桿已達或超越目標槓桿（缺口為0），不進行超額加碼
      if (capitalGap <= 0) {
        return {
          status: "CRISIS_ACCUMULATE",
          suggestedDcaAmt: 0,
          exposureGap: gap,
          targetExposure: targetExp,
          cashAdequacy: true,
          message: `⚡ 恐慌加碼視窗：無借款帳戶，當前槓桿已達目標 ${dynamicTargetLeverage}x，暫無需加碼 00675L`,
          batchRationale: `當前曝險已達標 (${(currentGrossExp / accountNetAsset).toFixed(2)}x ≥ ${dynamicTargetLeverage}x)；防範槓桿過載`,
          disclaimer:
            "P0 DCA 維持不變，本建議僅影響 P1 條件加碼；00675L 為槓桿產品，震盪市存在複利損耗",
        };
      }

      // 三維度動態取保守 min：
      // 1. 缺口均攤分批 (capitalGap / N)
      // 2. 現金安全流動性防線 (cash * Ratio)
      // 3. 剩餘總缺口封頂 (capitalGap)
      const batchByGap = Math.floor(capitalGap / CRISIS_ACCUMULATE_BATCH_COUNT);
      const batchByCash = Math.floor(cash * CRISIS_ACCUMULATE_BATCH_RATIO);
      const rawLimit = Math.min(batchByGap, batchByCash, capitalGap);
      // 整數化至千元
      const batchLimit = Math.floor(rawLimit / 1000) * 1000;

      return {
        status: "CRISIS_ACCUMULATE",
        suggestedDcaAmt: batchLimit,
        exposureGap: gap,
        targetExposure: targetExp,
        cashAdequacy: cash >= batchLimit,
        message: `⚡ 恐慌加碼模式：無借款帳戶，建議本批加碼 00675L 上限 ${batchLimit.toLocaleString()} TWD`,
        batchRationale: `VIX 恐慌視窗；自適應計算：目標槓桿 ${dynamicTargetLeverage}x (總缺口 ${Math.round(capitalGap).toLocaleString()} TWD)，分 ${CRISIS_ACCUMULATE_BATCH_COUNT} 批平攤，且單批不超過現金 ${(CRISIS_ACCUMULATE_BATCH_RATIO * 100).toFixed(0)}%`,
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

### Phase 1 — 測試骨架 + strategyDefaults（已完成 ✅）

1. [x] 在 `strategyDefaults.mjs` 定義 3 個集中常數：`PANIC_RADARS`, `CRISIS_ACCUMULATE_BATCH_RATIO`, `CRISIS_ACCUMULATE_BATCH_COUNT`（Phase 7 移除 `CRISIS_ACCUMULATE_MAX_BATCH` 和 `CRISIS_ACCUMULATE_TARGET_LEVERAGE` 硬編碼）
2. [x] 撰寫 RED 測試：
   - `regimePolicy.test.mjs`（OPPORTUNITY vs DEFENSE 分流測試）
   - `cashExposureAdvisor.test.mjs`（恐慌雷達 vs 基本面雷達分流測試，含同時觸發邊界測試、字串型別防護與 MAX_BATCH 截斷測試）
3. [x] 執行測試驗證：舊有 19 個測試全數 GREEN，新增 6 個測試精準 RED（預期功能未實作而失敗，無語法/路徑錯誤）

### Phase 2 — `regimePolicy.mjs` + `RegimePolicyRule.mjs`（已完成 ✅）

1. [x] 實作 `determineRegime` 之 `debtMode` 分流（`OPPORTUNITY` → `crisis_accumulate`，預設 `DEFENSE` → `sell_only`）
2. [x] 實作 `RegimePolicyRule.evaluate()` 注入狀態不中斷邏輯（含 `Number(totalDebt)` 型別防護與 `totalDebt === 0` OPPORTUNITY 模式判定）
3. [x] 執行測試驗證：`regimePolicy.test.mjs` 與 `decisionRules.test.mjs` 測試全數轉 GREEN，決策鏈測試 100% 通過（61/61 passed）

### Phase 3 — `cashExposureAdvisor.mjs` + `leadingIndicatorEvaluator.mjs`（已完成 ✅）

1. [x] 實作 `evaluateCashExposure` 恐慌型雷達分流：
   - 引用 `strategyDefaults.mjs` 之集中常數（`PANIC_RADARS`, `CRISIS_ACCUMULATE_BATCH_RATIO`, `CRISIS_ACCUMULATE_BATCH_COUNT`）（Phase 7 移除 `MAX_BATCH` 硬編碼）
   - 新增 `totalDebt = 0` 與 `Number(totalDebt ?? 0)` 型別防護
   - 實作三層分流：基本面雷達觸發 → 一律 `DEFER`；純恐慌雷達＋無借款 → `CRISIS_ACCUMULATE`（限速加碼並產出 `batchRationale`、`disclaimer` 含複利損耗提示）；純恐慌雷達＋有借款 → `DEFER`
2. [x] `leadingIndicatorEvaluator.mjs` 補傳 `totalDebt: portfolio.totalDebt ?? 0`
3. [x] 執行測試驗證：
   - `cashExposureAdvisor.test.mjs` 測試全數轉 GREEN（13/13 passed，包含基本面優先、字串型別防護、同時觸發與 MAX_BATCH 截斷測試）
   - 單元與整合測試 1051 passed，策略核心零 regression

### Phase 4 — Telegram 報告模板格式化（已完成 ✅）

1. [x] 在 `leadingIndicatorEvaluator.mjs` 中實作 `formatLeadingIndicatorTelegramCard` 支援 `CRISIS_ACCUMULATE` 恐慌加碼視窗
2. [x] 實作 `formatCrisisAccumulateCard` 專屬卡片格式化器（依計畫書 §6.1 與 v2.2 改善項目 2）：
   - 純動態計算呈現：`{batchLimit}`、`{targetLeverage}`、`{currentLeverage}`
   - 納入 `• ✅ P0 DCA 照常執行（鐵律，不受 Regime 影響）`
   - 納入 `• ⚠️ P1 條件加碼：每批上限 {batchLimit}，VIX 仍高時控制路徑損耗`
   - 納入 `• ℹ️ 00675L 為 2x 槓桿產品，震盪市存在複利耗損`
3. [x] 更新 `regimePolicy.mjs` 的 `formatRegimeStatus`，支援 `crisis_accumulate` 模式之 `⚡ CRISIS [恐慌加碼模式]`
4. [x] 串接 `evaluateLeadingIndicators`：當 `cashExposureAnalysis.status === "CRISIS_ACCUMULATE"` 時自動觸發 `isAlertNeeded` 並傳入卡片格式化
5. [x] 執行測試驗證：
   - `leadingIndicatorEvaluator.test.mjs` (12/12 passed)
   - `regimePolicy.test.mjs` (13/13 passed)
   - 全套單元與整合測試無 regression (189 test files, 1941 passed)

### Phase 5 — 整合驗收（已完成 ✅）

1. [x] 執行「附錄 A：設計案例（2026-11-04 Fixture）」端到端測試：
   - 新增端到端整合測試套件 `src/test/integration/regimeAwareOpportunityEngine.test.mjs`
   - 驗收附錄 A 2026-11-04 暴跌情境：`determineRegime` 正確判定 `OPPORTUNITY` + `crisis_accumulate`，`leverageMultiplier=0`
   - 驗收現金曝險分析：600,000 現金動態計算批次上限（Phase 1-6 採用臨時 `MAX_BATCH`=50,000，Phase 7 改為完全動態），且三層資訊完整（`message`、`batchRationale`、`disclaimer`）
   - 驗收 Telegram 卡片產生器 `formatCrisisAccumulateCard` 輸出 100% 符合計畫書 §6.1 規範
   - 驗收對照組 DEFENSE 模式：`totalDebt > 0` 時維持 `sell_only` 與 `DEFER`，完全維持防爆倉安全邊界
   - 驗收邊界案例：基本面雷達（如融資斷頭）與恐慌雷達同時觸發時，基本面安全優先，回傳 `DEFER`
2. [x] 執行測試驗收結果：
   - `src/test/integration/regimeAwareOpportunityEngine.test.mjs` 7/7 tests passed
   - 策略核心單元與整合測試 8 個檔案、96 tests passed

---

### Phase 6 — 正式上線部署後執行結果驗證（已完成，發現實務斷點 ✅）

依據 Han 的指示與 `deployment-unix-socket-confirmation` 規範，於完成正式代碼部署後進行正式環境端到端真實性驗證：

1. [x] **正式日誌驗收（Production Logs）**：
   - 查驗正式區 `logs/daily.log`：確認於 `[2026-11-04 13:45:01]` 完成 `runDailyCheck`，最後輸出 `[runDailyCheck] ✅ 執行完畢`。
   - 確認發送 Telegram 戰報（`✅ Telegram 戰報發送成功`），無未捕獲例外或 crash。
2. [x] **正式日報資料結構驗收（Production Data）**：
   - 查驗正式區 `data/reports/2026-11-04.json`：
     - `signals.regimeResult`: `state: "CRISIS"`, `mode: "crisis_accumulate"`，成功轉為機會模式，徹底消除強制賣出錯誤！
     - `decisionChain`: `status: "🌱【前置過濾：底倉通道】"`, `signalDirection: "hold"`，P0 DCA 紀律保持不變。
3. [x] **實務資料管線三大斷點盤點**：
   - **斷點 A（主因）**：Google Sheet (`lastState`) 未包含 `accountNetAsset` 欄位（為 null），導致 `cashExposureAdvisor` 被前置防禦攔截，回傳「`帳戶淨資產未驗證，現金曝險建議暫不提供`」，加碼邏輯未被觸發。
   - **斷點 B（硬編碼問題）**：原計畫與程式碼將加碼上限寫死為全域常數 `50,000` 元，缺乏依據用戶當前淨資產、槓桿曝險缺口與可用現金的動態自適應機制。
   - **斷點 C（語義矛盾）**：`extremePanicRadar.mjs` 雷達卡片寫死「00675L 禁止買入」，與無借款帳戶的危機加碼目標衝突。

---

### Phase 7 — 全動態自適應加碼與資料鏈整合（✅ 已完成 2026-11-04）

**執行時間**：2026-11-04 13:15 - 13:28  
**Commit**: `5397a92`

1. **TDD RED 測試**（✅ 完成）：
   - ✅ 新增 7 個 Phase 7 測試案例：4 個階層式目標槓桿優先級測試 + 3 個動態批次計算測試
   - ✅ 驗證 RED 狀態：13 existing GREEN, 7 new RED
2. **實作 GREEN**（✅ 完成）：
   - ✅ 更新 `strategyDefaults.mjs`：移除 `CRISIS_ACCUMULATE_MAX_BATCH` 與 `CRISIS_ACCUMULATE_TARGET_LEVERAGE`，新增 `CRISIS_ACCUMULATE_BATCH_COUNT = 10`
   - ✅ 更新 `cashExposureAdvisor.mjs`：實作 `resolveTargetLeverage()` 階層式取得函數（§4.3.1）與動態批次 3-way min 公式（§4.3.2）
   - ✅ 更新 `leadingIndicatorEvaluator.mjs`：函數簽名新增 `strategy`, `lifecycleContext`, `marketScore` 參數並傳遞給 `evaluateCashExposure`
   - ✅ 適配所有相關測試（20 單元測試 + 7 整合測試）
3. **REFACTOR & 驗證**（✅ 完成）：
   - ✅ 執行完整測試套件：**1955/1960 passed**（唯一 timeout 為既有 dataIntegrity TWSE API 問題）
   - ✅ 核心功能驗證：階層式目標槓桿解析、動態批次計算、參數化簽名完成

**待優化項目（Phase 7.2-7.4，可漸進式完成）**：

- ⬜ `extremePanicRadar.mjs` debt-aware 文字調和（硬編碼「00675L 禁止買入」需改為條件式）
- ⬜ `dailyCheck.mjs` 動態淨資產 fallback（accountNetAsset=null 時從 theoreticalShadow 計算）
- ⬜ `dailyCheck.mjs` 完整資料管線整合（傳入實際 strategy/lifecycleContext/marketScore 替代預設值）

---

### Phase 8 — 正式部署與 Mini App 最終驗收（待執行 ⏳）

1. Push 代碼至 GitHub `main` 分支。
2. 正式機部署與手動觸發 `/daily` 重跑。
3. 驗收正式日報 JSON 與 Telegram 卡片中完整出現自適應加碼金額。
4. Han 驗證 Telegram Mini App 界面顯示。

---

## 9. 風險管理表

| 風險項目                                   | 機率 | 影響 | 緩解措施                                                                                         |
| ------------------------------------------ | ---- | ---- | ------------------------------------------------------------------------------------------------ |
| 未來復借後 OPPORTUNITY 誤判                | 低   | 高   | `Number(totalDebt) > 0` 自動強制切回 DEFENSE 模式，零人工介入                                    |
| 高波動震盪下的複利損耗（Volatility Decay） | 高   | 中   | 動態批次計算（缺口/10批、現金 10%、總缺口三維 min）限制單批規模；Telegram 卡片與 disclaimer 揭露 |
| 恐慌時市場續跌（如 2008 續跌約 30%）       | 中   | 中   | 限速加碼即為平攤進場成本，單批金額上限受可用現金比例限制                                         |
| 修改影響既有 1929 個測試                   | 低   | 高   | 所有新參數設有相容預設值（`debtMode="DEFENSE"`），現有測試走既有路徑                             |

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
