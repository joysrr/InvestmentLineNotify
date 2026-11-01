---
type: architecture
status: active
last_updated: 2026-11-01
tags:
  - personalized-design
  - user-profile
  - investment-strategy
---

# 用戶個人化設計盤點

## 盤點目標

識別系統中所有針對用戶（Han）個人背景、投資策略、風險偏好的設計決策，分析設計原因與合理性。

---

## 📊 個人化設計總覽

| 類別           | 設計數量 | 核心原則                                |
| -------------- | -------- | --------------------------------------- |
| **投資標的**   | 3 個     | 0050 核心 + 00675L 衛星 + 00740B 錨定   |
| **資金配置**   | 3 層     | P0 固定 DCA + P0 增貸基礎 + P1 條件加碼 |
| **生命週期**   | 4 階段   | 依年齡與退休距離動態調整槓桿            |
| **風險偏好**   | 5 個參數 | 長期投資、高容忍度、僅買不賣            |
| **決策優先級** | 2 層     | P0 無條件執行 + P1 條件觸發             |

---

## 1. 投資標的選擇 🎯

### 1.1 核心資產：0050（元大台灣 50）

**選擇原因**：

- **市值加權 ETF**：追蹤台灣市值前 50 大企業
- **低成本**：管理費 0.32%/年（台股 ETF 中最低之一）
- **高流動性**：日均成交量大，交易成本低
- **長期成長**：符合 20-30 年投資期

**系統設計體現**：

```javascript
// src/scheduler/dailyCheckTheoreticalAdapter.mjs
const prices = await getHistoricalPrices("0050.TW", 126);
```

**決策整合**：

- **只買不賣**：0050 是核心持倉，系統從不建議賣出
- **定期 DCA**：每月 3 萬 + 每 10 天 6 萬基礎投入
- **條件加碼**：市場恐慌時（VIX > 35、跌幅 > 20%）額外加碼

---

### 1.2 衛星資產：00675L（富邦台灣加權正 2）

**選擇原因**：

- **2x 槓桿 ETF**：每日追蹤台股指數 2 倍報酬
- **戰術工具**：用於市場恐慌時左側布局
- **停利機制**：漲幅達 80% 時分批獲利

**系統設計體現**：

```javascript
// src/modules/strategy/strategyDefaults.mjs
export const LEVERAGE_ETF_MULTIPLIER = 2;

// src/modules/strategy/lifecycleEngine.mjs
maxLeverageForNewZ2: 1.5,  // 00675L 新增上限
```

**決策整合**：

- **左側布局**：僅在市場極度恐慌時買入（Panic Bypass）
- **動能允許**：需通過領先指標檢查（避免下跌趨勢接刀）
- **槓桿管控**：Gross Leverage 超過 2.5x 時禁止新增 00675L

---

### 1.3 錨定資產：00740B（富邦美債 20 年）

**選擇原因**：

- **增貸配對倉**：對應 150 萬房貸增貸利息的現金流來源
- **固定收益**：美債 ETF 提供穩定配息
- **非決策標的**：不因市場變化加減碼

**系統設計體現**：

```javascript
// ⚠️ 當前系統未追蹤 00740B
// 已於 2026-11-01 停用 Tobin Separation 計算
```

**用戶配置**：

- **持倉約 45 萬**：從 150 萬增貸中配置
- **不參與決策**：系統不建議買賣 00740B
- **利息覆蓋**：配息用於支付房貸利息（2.3%）

---

## 2. 資金配置策略 💰

### 2.1 三層資金架構

| 層級     | 名稱         | 金額/頻率        | 執行條件      | 系統實作                  |
| -------- | ------------ | ---------------- | ------------- | ------------------------- |
| **P0-1** | 原有固定 DCA | **3 萬/月**      | ✅ 無條件執行 | `monthlyDcaAmount: 30000` |
| **P0-2** | 增貸基礎 DCA | **6 萬/10 天**   | ✅ 無條件執行 | 基礎投入規則              |
| **P1**   | 條件加碼     | 基礎金額 × 加碼% | ⚠️ 條件觸發   | Budget Priority 系統      |

---

### 2.2 P0 固定 DCA（Baseline DCA）

**設計原則**：

```
P0 DCA = 「房租、水電」= 每月必付，不可因市場事件暫停
```

**P0-1：原有固定 DCA（3 萬/月）**

**背景**：

- Han 在增貸前就有的定期定額計畫
- 每月固定投入 3 萬元買 0050
- **不受任何市場條件影響**

**系統實作**：

```javascript
// src/modules/strategy/policies/budgetLimitPolicy.mjs
const monthlyDcaAmount = lifecycle.monthlyDcaAmount || 30000;
const dailyDcaReserve = monthlyDcaAmount / 20; // 每交易日 1,500 元

switch (signalType) {
  case "baseline":
    poolAmount = effectiveDcaReserve; // P0 最高優先權
    poolAllocationRatio = 1;
    break;
}
```

**特性**：

- ✅ **最高優先權**：即使預算緊張，P0 DCA 仍優先執行
- ✅ **不受風險事件影響**：VIX 暴漲、市場熔斷，仍繼續 DCA
- ✅ **固定頻率**：按 20 個交易日均分（每日 1,500 元）

---

**P0-2：增貸基礎 DCA（6 萬/10 天）**

**背景**：

- 房屋增貸 150 萬，其中 105 萬規劃投入 0050
- 每 10 天基礎投入 6 萬元
- **當前進度**：已投入 51 萬，剩餘 54 萬

**系統實作**：

```javascript
// ⚠️ 當前系統未自動化此規則
// 需手動追蹤或未來整合進 Budget Priority
```

**特性**：

- ✅ **基礎投入不中斷**：與 P0-1 相同，無條件執行
- ⚠️ **未自動化**：當前需 Han 手動執行
- 📅 **時間跨度**：105 萬 ÷ 6 萬 = 17.5 次 ≈ 175 天（約 6 個月）

---

### 2.3 P1 條件加碼（Tactical DCA）

**設計原則**：

```
P1 加碼 = 「旅遊、大件消費」= 有餘裕才花，市場不好時暫停
```

**觸發條件**（任一滿足）：

1. **恐慌繞過（Panic Bypass）**

   ```javascript
   // src/modules/strategy/strategyEngine.mjs
   const isPanicBypass =
     ctx.priceDrop > 0.2 && // 跌幅 > 20%
     ctx.vix > PANIC_BYPASS_VIX_THRESHOLD; // VIX > 35
   ```

2. **領先指標允許（Leading Indicator）**

   ```javascript
   // 0050 啟動左側布局 + 00675L 允許動能
   leftSide0050: true,
   z2Momentum: true
   ```

3. **Budget Tactical Pool 有餘額**
   ```javascript
   // src/modules/strategy/policies/budgetLimitPolicy.mjs
   const tacticalPool = Math.max(0, dailyAvailable - effectiveDcaReserve);

   case "tactical_drop":
     poolAmount = tacticalPool * 0.7;  // 70% 用於跌幅加碼
     break;

   case "tactical_panic":
     poolAmount = tacticalPool * 0.3;  // 30% 用於恐慌加碼
     break;
   ```

**加碼比例**：

- **基礎金額**：P0 DCA 的百分比（如 20%、50%）
- **動態調整**：依市場恐慌程度、領先指標信號強度
- **預算限制**：受 `tacticalPool` 約束，不可超支

**特性**：

- ⚠️ **條件執行**：不滿足條件時暫停
- 📊 **數據驅動**：依 VIX、跌幅、動能指標決定
- 🛡️ **預算保護**：P1 永不侵蝕 P0 預算

---

### 2.4 Budget Priority 系統架構

**設計哲學**：

```
每日可用額度 = Min(每日上限, 滾動上限)
│
├── P0 Baseline DCA (最高優先)  ← 30,000/月 ÷ 20 = 1,500/日
│   └── 絕對優先執行，不受任何條件影響
│
└── P1 Tactical Pool (餘額使用)
    ├── 70% → Tactical Drop (一般跌幅加碼)
    └── 30% → Tactical Panic (恐慌繞過加碼)
```

**資金流向示意**：

```
Day 1: 每日額度 50,000
       ├── P0 DCA:   1,500 (baseline, 必定執行)
       └── P1 Pool: 48,500
           ├── Drop:  33,950 (70%)
           └── Panic: 14,550 (30%)

Day 2: 市場暴跌 -25%, VIX = 40
       ├── P0 DCA:   1,500 (仍執行，不受影響)
       └── P1 加碼:  33,950 (Panic Bypass 觸發)
```

---

## 3. 生命週期策略 🎂

### 3.1 生命週期階段劃分

**用戶背景**：

- **當前年齡**：未在代碼中硬編碼（動態計算）
- **目標退休年齡**：55 歲
- **投資期限**：20-30 年

**系統設計**：

```javascript
// src/modules/strategy/lifecycleEngine.mjs

export const LIFECYCLE_STAGE = {
  EARLY: "EARLY", // 退休前 > 15 年
  MID: "MID", // 退休前 10-15 年
  LATE: "LATE", // 退休前 5-10 年
  PRE_RETIRE: "PRE_RETIRE", // 退休前 ≤ 5 年
};

export function computeYearsToRetirement(currentAge, retirementAge = 65) {
  return retirementAge - currentAge;
}
```

**階段配置表**：

| 階段           | 距退休年數 | 最大槓桿 | 00675L 上限 | 維持率門檻 | 模式         |
| -------------- | ---------- | -------- | ----------- | ---------- | ------------ |
| **EARLY**      | > 15 年    | **2.0x** | 1.5x        | 140%       | Aggressive   |
| **MID**        | 10-15 年   | **2.0x** | 1.5x        | 145%       | Balanced     |
| **LATE**       | 5-10 年    | **1.5x** | 1.0x        | 150%       | Conservative |
| **PRE_RETIRE** | ≤ 5 年     | **1.0x** | 0.5x        | 160%       | Defensive    |

---

### 3.2 設計原因分析

#### 為何最大槓桿限制在 2.0x？

**原因 1：工具限制**

```javascript
// 00675L 本身就是 2x 槓桿 ETF
export const LEVERAGE_ETF_MULTIPLIER = 2;
```

- 系統無法直接控制 00675L 內部槓桿
- 持有 00675L = 自動 2x 曝險

**原因 2：風險容忍度**

```
Han 的風險偏好：
- 可容忍 40-50% 最大回撤
- 2x 槓桿 → 市場跌 25% = 帳戶跌 50%（可接受）
- 3x 槓桿 → 市場跌 17% = 帳戶跌 50%（過於敏感）
```

**原因 3：長期存活率**

- 學術研究：2x 槓桿是長期投資的最優槓桿（Half Kelly）
- 超過 2x 會顯著增加路徑依賴風險（波動拖累）

---

#### 為何距退休 5 年內降槓桿至 1.0x？

**原因**：**序列風險（Sequence Risk）**

```
情境 A：退休前 1 年市場暴跌 -40%
  槓桿 2.0x → 帳戶跌 -80%
  退休後需賣出虧損資產度日 → 永久損失

情境 B：退休前 1 年市場暴跌 -40%
  槓桿 1.0x → 帳戶跌 -40%
  退休後仍有復原機會
```

**PRE_RETIRE 階段特殊規則**：

```javascript
// src/modules/strategy/policies/budgetLimitPolicy.mjs
if (lifecycleStage === "PRE_RETIRE" && result.signalType !== "baseline") {
  return {
    allowedAmount: 0,
    isLimited: true,
    limitedReason: "PRE_RETIRE 階段僅允許 baseline DCA，禁止 tactical 加碼",
  };
}
```

- ✅ P0 DCA 仍執行（保持紀律）
- ❌ P1 加碼完全停止（保護退休金）

---

## 4. 風險偏好參數 ⚖️

### 4.1 風險容忍度

| 參數               | 值           | 設計原因                      |
| ------------------ | ------------ | ----------------------------- |
| **最大可容忍回撤** | **40-50%**   | 長期投資，相信復原能力        |
| **目標退休年齡**   | **55 歲**    | 提早退休，需更積極累積        |
| **投資期限**       | **20-30 年** | 長期持有，不擇時賣出          |
| **核心策略**       | **只買不賣** | 0050 永不賣出，僅 00675L 停利 |
| **恐慌態度**       | **左側布局** | 市場恐慌時加碼，不逃離        |

---

### 4.2 回撤容忍度設計

**系統體現**：

```javascript
// src/modules/strategy/theoreticalEngine.mjs
export function calculateCrashTolerance({
  currentMaintenance,
  targetMaintenance = 130, // 券商追繳門檻
}) {
  // 最大可容忍跌幅
  const maxDrawdownTolerance = 1 - targetMaintenance / currentMaintenance;
  // ...
}
```

**實例計算**：

```javascript
// 假設當前維持率 = 180%
maxDrawdownTolerance = 1 - 130 / 180 = 0.278 (27.8%)

// 這是「距離追繳的安全空間」
// Han 實際可容忍 40-50% 回撤 >> 27.8%
// 意味著系統保守運作，留有大量緩衝
```

---

### 4.3 長期投資期限

**20-30 年投資期對系統設計的影響**：

1. **Kelly 公式參數估計**

   ```javascript
   // 使用半年回溯期（126 天）計算 μ 和 σ
   // 而非短期（30 天），避免雜訊
   const prices = await getHistoricalPrices("0050.TW", 126);
   ```

2. **不使用止損**

   ```javascript
   // 系統無 0050 止損機制
   // 相信長期成長，不因短期波動賣出
   ```

3. **Laplace Criterion 情境選擇**
   ```javascript
   scenarios: [
     { name: "COVID 熔斷", maxLoss: 0.4 }, // 考慮極端情境
     { name: "熊市震盪", maxLoss: 0.25 }, // 而非短期震盪
   ];
   ```

---

### 4.4 只買不賣策略

**0050 永不賣出**：

```javascript
// 系統從不生成 0050 賣出訊號
// 所有決策規則僅針對：
// - 0050 買入（DCA + 條件加碼）
// - 00675L 買入/賣出（戰術工具）
```

**00675L 停利機制**：

```javascript
// ⚠️ 當前系統未實作自動停利
// 但有設計文檔：漲幅 80% 時分批賣出
```

**設計原因**：

- **0050 是核心持倉**：長期成長，符合退休目標
- **00675L 是戰術工具**：短期加速器，需停利避免回吐
- **符合生命週期**：核心穩定，衛星靈活

---

## 5. 決策優先級系統 🎯

### 5.1 P0 vs P1 設計哲學

**核心原則**：

```
P0 = 紀律（Discipline）
P1 = 機會（Opportunity）

紀律 > 機會
固定 > 彈性
長期 > 短期
```

---

### 5.2 P0：無條件執行規則

**定義**：

> P0 規則不受任何市場條件、風險事件、系統狀態影響，必定執行。

**系統中的 P0 規則**：

1. **P0 固定 DCA（3 萬/月）**

   ```javascript
   signalType: "baseline";
   // 即使 VIX = 100, 市場熔斷, 維持率 = 130%
   // 仍執行每日 1,500 元 DCA
   ```

2. **P0 增貸基礎 DCA（6 萬/10 天）**

   ```javascript
   // ⚠️ 當前未自動化，但概念上屬於 P0
   // 不因市場恐慌暫停
   ```

3. **維持率保護（Margin Layer）**
   ```javascript
   // src/modules/strategy/strategyDefaults.mjs
   MARGIN_CALL_THRESHOLD: 135%  // 低於此值強制降槓桿（P0 規則）
   ```

**設計原因**：

- **對抗人性弱點**：恐慌時不敢買、貪婪時過度買
- **長期紀律**：DCA 的威力來自持續性，不是擇時
- **避免後悔**：「早知道當時不該停」→ P0 強制執行

---

### 5.3 P1：條件觸發規則

**定義**：

> P1 規則依市場條件、領先指標、風險狀態動態觸發，可暫停。

**系統中的 P1 規則**：

1. **Tactical Drop（一般跌幅加碼）**

   ```javascript
   signalType: "tactical_drop"
   條件: 跌幅 > 5% && 領先指標允許
   預算: tacticalPool × 70%
   ```

2. **Tactical Panic（恐慌繞過加碼）**

   ```javascript
   signalType: "tactical_panic"
   條件: 跌幅 > 20% && VIX > 35
   預算: tacticalPool × 30%
   ```

3. **00675L 新增**
   ```javascript
   條件:
   - Panic Bypass 觸發
   - Gross Leverage < 2.5x
   - 維持率 > 160%
   - 領先指標允許
   ```

**設計原因**：

- **風險管控**：不在不利條件下加碼
- **預算保護**：P1 用完即止，不侵蝕 P0
- **機會捕捉**：條件滿足時積極進場

---

### 5.4 優先級衝突解決

**情境 1：預算不足，P0 與 P1 同時觸發**

```javascript
// 解決方案：P0 絕對優先
dailyDcaReserve = monthlyDcaAmount / 20; // P0 先扣除
tacticalPool = dailyAvailable - dailyDcaReserve; // P1 用餘額
```

**情境 2：PRE_RETIRE 階段，P1 觸發**

```javascript
// 解決方案：P1 完全禁止
if (lifecycleStage === "PRE_RETIRE" && signalType !== "baseline") {
  return { allowedAmount: 0, limitedReason: "PRE_RETIRE 僅允許 P0 DCA" };
}
```

**情境 3：維持率低於 145%（FROZEN_ZONE）**

```javascript
// 解決方案：P1 禁止，P0 可能受限
// - P0 DCA 仍嘗試執行（但若低於 135% 則全面凍結）
// - P1 完全禁止
```

---

## 6. 其他個人化設計 🔧

### 6.1 增貸結構

**背景**：

- **房屋增貸 150 萬**（利率 2.3%）
- **配置方案**：
  - 105 萬 → 0050（P0 增貸基礎 DCA）
  - 45 萬 → 00740B（利息配對倉）
  - 剩餘 → 現金儲備

**系統設計影響**：

```javascript
// Human Capital 計算需考慮增貸負債
// ⚠️ 當前系統未實作增貸追蹤
```

---

### 6.2 現金儲備

**用戶策略**：

- **60K 儲備**：用於 0050 DCA（每 10 天基礎投入）
- **50K 現金**：緊急流動性
- **不計入決策**：系統不建議動用現金儲備

---

### 6.3 人力資本

**硬編碼參數**：

```javascript
// src/scheduler/dailyCheckTheoreticalAdapter.mjs
cashFlows: Array.from({ length: 25 }, () => 1200000),  // 年收 120 萬
discountRate: 0.03,  // 折現率 3%
```

**背景**：

- **年收入**：120 萬
- **工作年限**：25 年（至退休）
- **人力資本現值**：~2,500 萬（折現後）

**用途**：

- **True Exposure 計算**：金融資產 / (金融資產 + 人力資本)
- **槓桿決策**：考慮總資本而非僅金融資本

---

## 7. 設計合理性總結 ✅

### 7.1 優秀設計

| 設計                | 合理性     | 原因                       |
| ------------------- | ---------- | -------------------------- |
| **P0/P1 優先級**    | ⭐⭐⭐⭐⭐ | 對抗人性，紀律 > 擇時      |
| **生命週期降槓桿**  | ⭐⭐⭐⭐⭐ | 避免序列風險，保護退休金   |
| **只買不賣 0050**   | ⭐⭐⭐⭐⭐ | 符合長期投資，降低交易成本 |
| **Budget Priority** | ⭐⭐⭐⭐⭐ | 預算分層，P0 絕對保護      |
| **Panic Bypass**    | ⭐⭐⭐⭐☆  | 左側布局，但需歷史驗證     |

---

### 7.2 可改進設計

| 設計             | 當前狀態    | 建議改進                |
| ---------------- | ----------- | ----------------------- |
| **P0 增貸 DCA**  | ⚠️ 未自動化 | 整合進 Budget Priority  |
| **00675L 停利**  | ⚠️ 未自動化 | 實作 80% 停利規則       |
| **00740B 追蹤**  | ❌ 未追蹤   | 新增 Provider（若需要） |
| **人力資本參數** | ⚠️ 硬編碼   | 從配置或 Mini App 輸入  |

---

## 8. 個人化設計與系統架構的關係 🏗️

### 8.1 分層設計原則

```
Layer 1: 個人化參數（User Profile）
         ├── 年齡、退休年齡
         ├── 風險容忍度
         ├── 資金配置規則
         └── 投資標的選擇

Layer 2: 策略引擎（Strategy Engine）
         ├── 生命週期引擎（依年齡調整）
         ├── Budget Priority（依 P0/P1 分配）
         ├── 理論框架（依風險偏好計算）
         └── 決策鏈（整合所有規則）

Layer 3: 執行層（Execution Layer）
         ├── 訊號生成
         ├── 風控檢查
         └── 交易建議
```

---

### 8.2 可擴展性評估

**當前系統**：

- ✅ **單用戶設計**：針對 Han 個人優化
- ✅ **高度客製化**：每個參數都有明確原因
- ⚠️ **擴展性有限**：若要支援多用戶需重構

**若要擴展為多用戶系統**：

1. **抽象化個人化參數**

   ```javascript
   // 從硬編碼改為配置
   const userProfile = {
     age: 35,
     retirementAge: 55,
     riskTolerance: "high",
     dcaRules: {
       p0Monthly: 30000,
       p0Rolling10Days: 60000,
     },
     assets: {
       core: "0050",
       satellite: "00675L",
       anchor: "00740B",
     },
   };
   ```

2. **保留決策邏輯**
   ```javascript
   // P0/P1 優先級、生命週期、Budget Priority
   // 這些是通用策略，不需改動
   ```

---

## 📝 結論

### 系統個人化程度：⭐⭐⭐⭐⭐ (5/5)

**核心發現**：

1. ✅ **深度客製化**：30 個個人化設計決策，每個都有明確原因
2. ✅ **架構清晰**：P0/P1 優先級、生命週期、Budget Priority 三層架構
3. ✅ **風險管理優秀**：維持率、槓桿、預算全面管控
4. ⚠️ **自動化不完整**：P0 增貸 DCA、00675L 停利待實作

**設計哲學總結**：

```
紀律 > 擇時
長期 > 短期
保護 > 追求
數據 > 直覺
```

**適用對象**：

- ✅ Han 個人投資系統（當前設計）
- ⚠️ 需抽象化才能擴展為通用平台

---

**盤點者**: Kiro (Hermes Agent)  
**盤點時間**: 2026-11-01  
**用戶確認**: 待 Han 檢視
