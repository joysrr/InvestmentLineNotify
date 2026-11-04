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

# 計畫書：Regime-Aware Opportunity Engine（危機加碼引擎）

## 1. 問題陳述

### 1.1 現象

2026-11-04，台股單日大跌 -6.3%，VIX 飆至 41.18。
使用者（Han）的投資策略明確要求「趁恐慌分批加碼 00675L」，但系統給出以下輸出：

| 模組                  | 輸出                                    | 實際效果                    |
| --------------------- | --------------------------------------- | --------------------------- |
| `RegimePolicyRule`    | CRISIS → `sell_only`，建議賣出 00675L   | 阻止加碼                    |
| `extremePanicRadar`   | 雷達觸發                                | cashExposureAdvisor → DEFER |
| `leverageCapManager`  | ceiling_breach（0.78x > ceiling）       | 一票否決                    |
| `cashExposureAdvisor` | radarTriggered → DEFER                  | 暫緩一切加速                |
| `theoreticalShadow`   | Kelly=0.31x < 當前 0.78x → 警告超出上限 | UI 紅燈警示                 |

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

> 來源：第一金投信，30 年歷史數據
> URL: https://www.fsitc.com.tw/ManagerEDM.aspx?ID=1938&Type=2

| 進場 VIX  | 6M 平均報酬 | 1Y 平均報酬 | 2Y 平均報酬 | 3Y 勝率 |
| --------- | ----------- | ----------- | ----------- | ------- |
| VIX 40~50 | +14.2%      | +28.9%      | +45.7%      | 99.4%   |
| VIX >50   | 更高        | 更高        | 更高        | 100%    |

**台股數據也同樣支持：VIX 越高、長期勝率越高。**

### 2.2 Kelly Criterion 在無槓桿情境的正確用法

> 來源：Frontiers in Applied Mathematics and Statistics (2020)
> URL: https://doi.org/10.3389/fams.2020.577050

原論文結論：

- Kelly 最大化長期幾何報酬，但 **Full Kelly 在短期波動極大**
- 實務上採 **Half Kelly（0.5×Kelly）** 可大幅降低 drawdown，同時保留 75% 的長期報酬
- **無借款情境下**，Kelly 是「加碼上限參考」，而非「強制減倉訊號」

當前系統誤用：Kelly < 當前槓桿 → 警告 → 建議賣出。
正確解讀：Kelly < 當前槓桿 → 新資金不適合加速加碼，但**不代表要砍現有部位**。

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

## 3. 現行問題分析

### 3.1 決策鏈結構（現行）

```
VIX=41 ≥ 35
  └─ RegimePolicyRule (Priority 0)
       └─ state = CRISIS
            └─ mode = sell_only
                 └─ 建議賣出 00675L 100%
                 └─ requiresForcedReduction() = true ← 阻斷所有後續規則

雷達觸發（extremePanicRadar）
  └─ cashExposureAdvisor
       └─ radarTriggered.length > 0
            └─ status = DEFER（暫緩加速，suggestedDcaAmt = 0）

Gross Leverage 0.78x > ceiling（假設 ceiling = 0.5x）
  └─ leverageCapManager
       └─ ceiling_breach → 禁止新增 00675L
```

### 3.2 三個根本設計問題

**問題 A：Regime 狀態未感知債務**
`regimePolicy.mjs` 的 CRISIS 判定是純 VIX 閾值（≥35），完全不考慮使用者是否有借款。
無借款時 VIX>35 的正確解讀應是「機會視窗」，而非「強制賣出訊號」。

**問題 B：Kelly 警告被誤用為賣出依據**
Kelly 是「最優加碼比例」，不是「帳戶現有部位的強制上限」。
當前槓桿 0.78x 超過 Kelly 0.31x，不代表要砍倉；代表的是「新資金分批進場速度放慢」。

**問題 C：所有雷達觸發一律 DEFER**
`cashExposureAdvisor` 把所有雷達（恐慌型、流動性型、基本面型）一視同仁地 DEFER。
恐慌型雷達（VIX 高）觸發，對無借款者而言恰好是加碼訊號，不應封鎖。

### 3.3 受影響的檔案清單

| 檔案                                                       | 問題                             | 影響層級 |
| ---------------------------------------------------------- | -------------------------------- | -------- |
| `src/modules/strategy/regimePolicy.mjs`                    | CRISIS = sell_only，不感知債務   | 🔴 核心  |
| `src/modules/strategy/decision/rules/RegimePolicyRule.mjs` | CRISIS 直接 return，後續規則全封 | 🔴 核心  |
| `src/modules/strategy/cashExposureAdvisor.mjs`             | radarTriggered → 一律 DEFER      | 🟠 重要  |
| `src/modules/strategy/strategyDefaults.mjs`                | CRISIS 閾值與加碼邏輯固定寫死    | 🟡 參數  |
| `src/modules/strategy/leverageMonitor.mjs`                 | 無 debtAware 旗標                | 🟡 參數  |

---

## 4. 設計方案

### 4.1 核心原則：債務感知雙模式（Debt-Aware Dual Mode）

```
帳戶狀態判定：
  totalDebt = 0 且 maintenanceRatio = N/A
    → 模式：OPPORTUNITY_MODE（機會型）
  totalDebt > 0 或 maintenanceRatio < FROZEN_ZONE
    → 模式：DEFENSE_MODE（防禦型，現行邏輯完整保留）
```

**DEFENSE_MODE** = 現有邏輯完全不變（VIX≥35 → sell_only，雷達 → DEFER）
**OPPORTUNITY_MODE** = 新增邏輯（VIX≥35 → 分批加碼機會，雷達 → 警示但不封鎖）

### 4.2 OPPORTUNITY_MODE 下的 Regime 重定義

| Regime   | VIX 範圍 | 現行行為      | 改後行為（無借款）                              |
| -------- | -------- | ------------- | ----------------------------------------------- |
| NORMAL   | < 28     | 允許加碼      | 允許加碼（不變）                                |
| CAUTIOUS | 28–35    | 減速 25%      | 減速 25%（不變）                                |
| CRISIS   | ≥ 35     | **sell_only** | **限速加碼**（每批上限：現金 × 10%，最高 5 萬） |

**CRISIS 在 OPPORTUNITY_MODE 下不觸發強制賣出。**
改為輸出 `mode: "crisis_accumulate"`，建議每批小金額進場。

### 4.3 cashExposureAdvisor 修改

新增 `debtAware` 參數：

```javascript
// 現行：radarTriggered → 一律 DEFER
if (radarTriggered && radarTriggered.length > 0) {
  return { status: "DEFER", suggestedDcaAmt: 0, ... };
}

// 修改後：區分雷達類型
if (radarTriggered && radarTriggered.length > 0) {
  const panicOnlyRadars = radarTriggered.filter(r => PANIC_RADARS.includes(r));
  const fundamentalRadars = radarTriggered.filter(r => !PANIC_RADARS.includes(r));

  if (fundamentalRadars.length > 0) {
    // 基本面/流動性雷達 → 無論是否有借款，一律 DEFER
    return { status: "DEFER", suggestedDcaAmt: 0, ... };
  }

  if (panicOnlyRadars.length > 0 && totalDebt === 0) {
    // 純恐慌型雷達 + 無借款 → 限速加碼（CRISIS_ACCUMULATE）
    const batchLimit = Math.min(cash * 0.10, 50000);
    return { status: "CRISIS_ACCUMULATE", suggestedDcaAmt: batchLimit, ... };
  }

  // 有借款 → 一律 DEFER（現行邏輯）
  return { status: "DEFER", suggestedDcaAmt: 0, ... };
}
```

**恐慌型雷達（PANIC_RADARS）**定義：

```javascript
const PANIC_RADARS = [
  "extremePanicRadar", // VIX 極端恐慌
  "vixSpike", // VIX 急漲
];
// 基本面雷達（不在此列）：creditSpreadRadar, liquidityRadar, yieldCurveRadar...
```

### 4.4 Kelly 建議修正

將 Kelly 的角色從「警告 / 建議賣出」改為「分批速度節流」：

| Kelly vs 當前槓桿            | 現行解讀                    | 修正後解讀                             |
| ---------------------------- | --------------------------- | -------------------------------------- |
| 當前 < HalfKelly             | 允許加碼                    | 允許加碼（不變）                       |
| HalfKelly ≤ 當前 < FullKelly | 警示但允許                  | 警示但允許（不變）                     |
| 當前 > FullKelly             | ⚠️ 警告（現行觸發賣出建議） | **新資金禁止加速，現有部位不強制賣出** |

UI 紅燈維持（提醒資訊），但系統不再以此為由輸出 `sell 00675L` 建議。

### 4.5 新狀態輸出格式

```javascript
// CRISIS_ACCUMULATE 新狀態
{
  status: "CRISIS_ACCUMULATE",
  suggestedDcaAmt: 50000,          // 本批限速金額
  batchRationale: "VIX=41，恐慌加碼視窗，每批上限 5 萬（現金 10%）",
  exposureGap: 1038946,
  targetExposure: 2939734,
  cashAdequacy: true,
  message: "⚡ 恐慌加碼模式：無借款帳戶，VIX=41 歷史勝率 83%。建議本批加碼 00675L 5 萬，分批執行至目標槓桿 1.2x",
  disclaimer: "P0 DCA（每月 3 萬）維持不變，本建議僅影響 P1 條件加碼"
}
```

---

## 5. 實作範圍與不變更項目

### 5.1 明確不變更（Frozen）

| 項目                          | 原因                       |
| ----------------------------- | -------------------------- |
| P0 DCA 每月 3 萬 0050         | 鐵律，任何 Regime 不干預   |
| `hardCap` 強制降槓邏輯        | totalDebt > 0 時的爆倉防線 |
| DEFENSE_MODE 全部現有邏輯     | 有借款時原邏輯完整保留     |
| `maintenanceRatio` 維持率計算 | 未來復借時仍需要           |
| 00675L 停利 +80% 設定         | 策略紀律不變               |

### 5.2 需要修改的檔案（最小範圍）

| 優先級 | 檔案                      | 改動內容                                                                                          |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------- |
| **P0** | `regimePolicy.mjs`        | 新增 `debtMode` 參數；CRISIS + 無借款 → `crisis_accumulate` mode                                  |
| **P0** | `RegimePolicyRule.mjs`    | CRISIS + OPPORTUNITY_MODE → 不 return，繼續下一規則，注入限速                                     |
| **P1** | `cashExposureAdvisor.mjs` | 新增 `totalDebt` 參數；恐慌型雷達 + 無借款 → CRISIS_ACCUMULATE                                    |
| **P1** | `strategyDefaults.mjs`    | 新增 `PANIC_RADARS` 常數、`CRISIS_ACCUMULATE_BATCH_RATIO = 0.10`、`CRISIS_ACCUMULATE_MAX = 50000` |
| **P2** | `leverageCapManager.mjs`  | ceiling_breach + OPPORTUNITY_MODE → 允許 00675L 小批量進場                                        |

### 5.3 新增測試範圍（TDD 優先）

```
regimePolicy.test.mjs
  ✦ CRISIS + debtMode=OPPORTUNITY → mode = "crisis_accumulate"
  ✦ CRISIS + debtMode=DEFENSE    → mode = "sell_only"（現有測試不變）

cashExposureAdvisor.test.mjs
  ✦ extremePanicRadar + totalDebt=0 → CRISIS_ACCUMULATE, suggestedDcaAmt=50000
  ✦ creditSpreadRadar + totalDebt=0 → DEFER（基本面雷達不受影響）
  ✦ extremePanicRadar + totalDebt>0 → DEFER（有借款維持原邏輯）

RegimePolicyRule.test.mjs（整合）
  ✦ VIX=41, totalDebt=0 → 繼續下一規則，不 return sell_only
  ✦ VIX=41, totalDebt>0 → return sell_only（現有邏輯）
```

---

## 6. 分階段執行計畫

### Phase 1 — 測試骨架 + strategyDefaults（1 天）

- 新增 `PANIC_RADARS`、`CRISIS_ACCUMULATE_BATCH_RATIO`、`CRISIS_ACCUMULATE_MAX` 至 `strategyDefaults.mjs`
- 寫 RED 測試（regimePolicy、cashExposureAdvisor）
- 確認所有現有測試仍為 GREEN

### Phase 2 — regimePolicy + RegimePolicyRule 核心修改（1~2 天）

- 修改 `regimePolicy.mjs`：新增 `debtMode` 參數，CRISIS + OPPORTUNITY → `crisis_accumulate`
- 修改 `RegimePolicyRule.mjs`：OPPORTUNITY_MODE 下 CRISIS 不 return，注入限速狀態
- 測試 GREEN

### Phase 3 — cashExposureAdvisor 恐慌型雷達分流（1 天）

- 新增 `totalDebt` 參數
- 實作 `PANIC_RADARS` 分流邏輯
- 新增 `CRISIS_ACCUMULATE` 輸出格式
- 測試 GREEN

### Phase 4 — UI 訊息調整（0.5 天）

- 修改 Telegram 報告模板：CRISIS_ACCUMULATE 狀態輸出綠色加碼建議
- 確保 P0 DCA 區塊不受影響
- 整合測試

### Phase 5 — 驗收（0.5 天）

- 以 `2026-11-04.json` 為輸入，跑完整 decision engine
- 確認輸出為 `CRISIS_ACCUMULATE`，suggestedDcaAmt = 50,000
- 確認 P0 DCA 建議不受影響

**估計總工時：3~5 天（不急上線，可分批推進）**

---

## 7. 風險與緩解

| 風險                             | 機率 | 影響 | 緩解措施                                                                 |
| -------------------------------- | ---- | ---- | ------------------------------------------------------------------------ |
| 未來復借後 OPPORTUNITY_MODE 誤判 | 低   | 高   | `totalDebt > 0` 自動切回 DEFENSE_MODE                                    |
| CRISIS_ACCUMULATE 金額設定不合理 | 中   | 中   | `CRISIS_ACCUMULATE_MAX = 50000` 硬上限，使用者可調                       |
| 修改破壞現有 1929 個測試         | 低   | 高   | 所有修改用 `debtMode` 參數控制，現有測試傳 `debtMode=DEFENSE` 保持 GREEN |
| 市場繼續崩跌，00675L 損失擴大    | 中   | 中   | Kelly 路徑損耗分析已確認；每批限額保護現金底線                           |

---

## 8. 成功標準

- [ ] 所有 1929 個現有測試繼續 GREEN
- [ ] 新增測試覆蓋三個核心場景（OPPORTUNITY / DEFENSE / 基本面雷達）
- [ ] VIX=41、totalDebt=0 輸入 → 系統輸出 `CRISIS_ACCUMULATE`，不再輸出 `sell_only`
- [ ] P0 DCA（每月 3 萬）區塊在任何 Regime 下維持 GREEN 無條件執行
- [ ] Telegram 報告卡片正確顯示分批加碼建議（含免責聲明）

---

## 9. 參考資料

| 資料來源              | 內容摘要                                                                | URL                                                                                            |
| --------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| FinLab（2026）        | VIX>40 買進 S&P 500，12 次樣本，250 日平均 +22.1%，勝率 83%             | https://finlab.finance/blog/vix-us-stock-crash-investing-python                                |
| 第一金投信            | VIX 40~50 進場，1Y 報酬 +28.9%，3Y 勝率 99.4%                           | https://www.fsitc.com.tw/ManagerEDM.aspx?ID=1938&Type=2                                        |
| Frontiers FAMS (2020) | Kelly Criterion 實務：Half Kelly 最優，無借款時為加碼上限非強制砍倉訊號 | https://doi.org/10.3389/fams.2020.577050                                                       |
| Preprints (2026-02)   | VIX 急漲後 Regime Shift，局部戰術配置有顯著正期望值                     | https://www.preprints.org/manuscript/202602.1048                                               |
| CFA Institute (2020)  | Antifragile Portfolio：衛星資產在市場極端壓力時小批進場                 | https://rpc.cfainstitute.org/blogs/enterprising-investor/2020/creating-anti-fragile-portfolios |

---

_計畫書版本：v1.0 | 建立：2026-11-04 | 負責人：Han_
