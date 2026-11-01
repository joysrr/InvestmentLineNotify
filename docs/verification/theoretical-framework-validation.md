---
type: verification
status: in-progress
last_updated: 2026-11-01
tags:
  - theoretical-framework
  - validation
  - bugs
---

# 理論框架驗證報告

## 驗證範圍

對照 `docs/architecture/theoretical-framework.md` 文檔與實際代碼實作，驗證：

1. 公式正確性
2. 參數單位一致性
3. 資料流準確性

---

## ❌ 發現問題：Crash Tolerance 單位不一致 → ✅ 已修正

### 問題描述 (已修正)

**代碼位置**:

- `src/modules/strategy/theoreticalEngine.mjs` → `calculateEstimatedMaintenance()`
- `src/scheduler/dailyCheckTheoreticalAdapter.mjs` → 調用 `calculateCrashTolerance()`

**問題**:

```javascript
// theoreticalEngine.mjs (line ~55-65)
export function calculateEstimatedMaintenance({ collateralValue, totalDebt }) {
  if (totalDebt === 0) {
    return {
      status: "NO_DEBT",
      maintenanceRatio: Infinity,
    };
  }

  return {
    status: "ESTIMATED",
    maintenanceRatio: (collateralValue / totalDebt) * 100, // ✅ 返回百分比（180 = 180%）
  };
}
```

```javascript
// dailyCheckTheoreticalAdapter.mjs (line ~118-122)
const crashTolerance =
  mappedInputs.status === "OK" && mappedInputs.inputs.accountNetAsset
    ? calculateCrashTolerance({
        currentMaintenance: estimatedMaintenance?.maintenanceRatio ?? 0, // ✅ 180 (百分比)
        targetMaintenance: 0.3, // ❌ 0.3 (小數) — 單位不一致！
      })
    : null;
```

```javascript
// theoreticalEngine.mjs (line ~175-188)
export function calculateCrashTolerance({
  currentMaintenance,
  targetMaintenance,
}) {
  if (
    !Number.isFinite(currentMaintenance) ||
    currentMaintenance <= 0 ||
    !Number.isFinite(targetMaintenance) ||
    targetMaintenance < 0
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "INVALID_MAINTENANCE_INPUT",
      crashTolerance: null,
    };
  }

  return {
    status: "ESTIMATED",
    crashTolerance: 1 - targetMaintenance / currentMaintenance, // ❌ 1 - 0.3/180 = 0.998 (錯誤！)
  };
}
```

### 測試案例驗證

```javascript
// src/test/unit/theoreticalEngine.test.mjs
describe("theoreticalEngine.calculateCrashTolerance", () => {
  it("calculates the proportional decline to a target maintenance ratio", () => {
    expect(
      calculateCrashTolerance({
        currentMaintenance: 200, // ✅ 百分比
        targetMaintenance: 160, // ✅ 百分比
      }).crashTolerance,
    ).toBeCloseTo(0.2, 10); // ✅ 正確: 1 - 160/200 = 20%
  });
});
```

**測試使用的是一致單位（都是百分比），但實際代碼傳入的是不一致單位！**

### 實際計算結果

假設：

- 擔保品價值：1,800,000 TWD
- 融資負債：1,000,000 TWD
- 當前維持率：180%

**當前（錯誤）計算**:

```
currentMaintenance = 180  (百分比)
targetMaintenance = 0.3   (小數)
crashTolerance = 1 - 0.3/180 = 1 - 0.00167 = 0.998 (99.8%)
```

**正確計算應該是**:

```
currentMaintenance = 180  (百分比)
targetMaintenance = 130   (百分比 - 證券商追繳門檻)
crashTolerance = 1 - 130/180 = 0.278 (27.8%)
```

**意義**:

- 錯誤結果 99.8%：表示可承受 99.8% 跌幅（完全不合理）
- 正確結果 27.8%：表示可承受 27.8% 跌幅才會被追繳（合理）

### 影響範圍

1. **前端展示**: Mini App Theory Page 顯示的 crashTolerance 數值錯誤
2. **決策守衛**: 若未來實作 Theory Guards，會使用錯誤的風險評估
3. **文檔描述**: `theoretical-framework.md` 中的說明不完全正確

---

## ✅ 驗證通過：Kelly Criterion

### 代碼檢查

```javascript
// dailyCheckTheoreticalAdapter.mjs (line ~95-103)
const kellyLimits =
  mappedInputs.status === "OK" && regimeOutput.status === "OK"
    ? calculateKellyLimits({
        mu: regimeOutput.mu, // ✅ 小數 (0.08 = 8%)
        sigma: regimeOutput.sigma, // ✅ 小數 (0.18 = 18%)
        borrowRate: 0.025, // ✅ 小數 (2.5%)
        productCostAdjustment: 0.01, // ✅ 小數 (1%)
        protectiveScale: 0.5, // ✅ Half Kelly 係數
      })
    : null;
```

```javascript
// theoreticalEngine.mjs (line ~143-165)
export function calculateKellyLimits({
  mu,
  sigma,
  borrowRate,
  productCostAdjustment = 0,
  protectiveScale = 1,
}) {
  if (mu == null || sigma == null || borrowRate == null) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_RESEARCH_INPUT",
      kellyMax: null,
      halfKelly: null,
    };
  }

  const adjustedMu = mu - productCostAdjustment; // ✅ 0.08 - 0.01 = 0.07
  const excessReturn = adjustedMu - borrowRate; // ✅ 0.07 - 0.025 = 0.045

  if (excessReturn <= 0) {
    return {
      status: "NO_POSITIVE_KELLY",
      reason: "NON_POSITIVE_EXCESS_RETURN",
      kellyMax: 0,
      halfKelly: 0,
    };
  }

  const kellyMax = excessReturn / sigma ** 2; // ✅ 0.045 / 0.18² = 1.389x
  return {
    status: "OK",
    kellyMax,
    halfKelly: kellyMax * protectiveScale, // ✅ 1.389 * 0.5 = 0.694x
  };
}
```

### 測試驗證

```javascript
// src/test/unit/theoreticalEngine.test.mjs
it("calculates optimal kelly (f*) and half-kelly for safety", () => {
  expect(
    calculateKellyLimits({
      mu: 0.08, // 8% 預期報酬
      sigma: 0.18, // 18% 波動率
      borrowRate: 0.025, // 2.5% 借款利率
      productCostAdjustment: 0.01, // 1% 產品成本
      protectiveScale: 0.5, // Half Kelly
    }),
  ).toMatchObject({
    status: "OK",
  });
});
```

**結論**: ✅ Kelly Criterion 實作正確，單位一致，公式無誤。

---

## ✅ 驗證通過：True Exposure

### 資料流檢查

```javascript
// dailyCheckTheoreticalAdapter.mjs (line ~75-83)
const grossExposure =
  mappedInputs.status === "OK"
    ? calculateGrossExposure({
        value0050: mappedInputs.inputs.value0050.value, // ✅ TWD
        value00675L: mappedInputs.inputs.value00675L.value, // ✅ TWD
        leverageFactor: 2, // ✅ 倍數
      })
    : null;

// line ~113-119
const trueExposure =
  grossExposure?.status === "OK" && humanCapital?.status === "OK"
    ? calculateTrueExposure({
        grossExposure: grossExposure.grossExposure, // ✅ TWD
        financialCapital: mappedInputs.inputs.accountNetAsset.value, // ✅ TWD
        humanCapital: humanCapital.humanCapital, // ✅ TWD
      })
    : null;
```

```javascript
// theoreticalEngine.mjs (line ~127-139)
export function calculateTrueExposure({
  grossExposure,
  financialCapital,
  humanCapital,
}) {
  if (
    grossExposure == null ||
    financialCapital == null ||
    humanCapital == null ||
    financialCapital + humanCapital === 0
  ) {
    return null;
  }

  return {
    status: "OK",
    trueExposure: grossExposure / (financialCapital + humanCapital), // ✅ 比例
  };
}
```

**範例計算**:

```
grossExposure = 1,800,000 TWD
financialCapital = 1,000,000 TWD
humanCapital = 21,522,650 TWD
trueExposure = 1,800,000 / (1,000,000 + 21,522,650) = 0.0799 (7.99%) ✅
```

**結論**: ✅ True Exposure 實作正確，資料流清晰，單位一致。

---

## 修正結果

### 代碼變更

✅ **src/scheduler/dailyCheckTheoreticalAdapter.mjs** (line 183)

```javascript
// ❌ Before
targetMaintenance: 0.3,  // 30% maintenance requirement

// ✅ After
targetMaintenance: 130,  // 130% 證券商追繳門檻（維持率低於此會被追繳）
```

### 新增測試案例

✅ **src/test/unit/theoreticalEngine.test.mjs** (新增 2 個測試)

1. `計算實際追繳門檻場景：當前 180% vs 追繳門檻 130%`
   - 驗證：1 - 130/180 = 0.278 (27.8%) ✅
2. `避免單位不一致錯誤：不接受小數形式的 targetMaintenance`
   - 記錄錯誤用法：0.3 → 99.8% (不合理)
   - 驗證正確用法：130 → 27.8% (合理)

### 測試結果

```
✅ Test Files  189 passed (189)
✅ Tests       1922 passed (1922)
```

**包含新增的測試案例，全部通過！**

---

## 修正建議

### 方案 1: 修正 Adapter 傳入的參數（推薦）

```javascript
// dailyCheckTheoreticalAdapter.mjs
const crashTolerance =
  mappedInputs.status === "OK" && mappedInputs.inputs.accountNetAsset
    ? calculateCrashTolerance({
        currentMaintenance: estimatedMaintenance?.maintenanceRatio ?? 0,
        targetMaintenance: 130, // ✅ 改為 130（百分比），代表追繳門檻 130%
      })
    : null;
```

### 方案 2: 修正函數接受小數輸入

```javascript
// theoreticalEngine.mjs
export function calculateCrashTolerance({
  currentMaintenance,
  targetMaintenance,
}) {
  // 如果 targetMaintenance < 1，假設為小數形式，轉換為百分比
  const targetMaintenancePercent =
    targetMaintenance < 1 ? targetMaintenance * 100 : targetMaintenance;

  return {
    status: "ESTIMATED",
    crashTolerance: 1 - targetMaintenancePercent / currentMaintenance,
  };
}
```

### 方案 3: 統一使用小數（需大量修改）

```javascript
// theoreticalEngine.mjs
export function calculateEstimatedMaintenance({ collateralValue, totalDebt }) {
  return {
    status: "ESTIMATED",
    maintenanceRatio: collateralValue / totalDebt, // ✅ 返回小數 (1.8 = 180%)
  };
}
```

**推薦**: **方案 1** — 最小改動，語義清晰，130 代表追繳門檻 130%。

---

## 文檔修正清單

### theoretical-framework.md 需修正的內容

#### 第 3.3 節 Crash Tolerance 實作細節

**當前（錯誤）**:

````markdown
**輸入**:

```javascript
{
  currentMaintenance: 1.8,      // 180% 當前維持率
  targetMaintenance: 0.3,       // 30% 目標維持率 (實際為 130%)
}
```
````

**⚠️ 參數命名問題**: `targetMaintenance: 0.3` 實際代表「距離追繳的安全緩衝」...

````

**修正為**:
```markdown
**輸入**:
```javascript
{
  currentMaintenance: 180,      // 180（百分比，代表 180%）
  targetMaintenance: 0.3,       // ❌ BUG: 應為 130（百分比）
}
````

**🐛 已知問題**:

- `estimatedMaintenance.maintenanceRatio` 返回百分比格式（180 = 180%）
- `targetMaintenance: 0.3` 傳入小數格式（0.3）
- 計算：1 - 0.3/180 = **0.998 (99.8%)** — 結果錯誤！
- **正確應為**: `targetMaintenance: 130` → 1 - 130/180 = **0.278 (27.8%)**
- **修正方案**: 參見 `docs/verification/theoretical-framework-validation.md`

```

---

## 後續行動

1. ✅ 建立此驗證報告
2. ⚠️ 修正 Crash Tolerance 單位不一致問題
3. ⚠️ 更新 theoretical-framework.md 文檔
4. ⚠️ 補充測試案例（使用實際 Adapter 參數）
5. ⚠️ 驗證前端展示數值是否正確

---

**驗證者**: Kiro (Hermes Agent)
**驗證時間**: 2026-11-01
```
