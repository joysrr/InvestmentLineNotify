---
type: verification
status: critical
last_updated: 2026-11-01
tags:
  - theoretical-framework
  - validation
  - critical-bugs
  - data-consistency
---

# 理論框架驗證報告 V2 - 全面驗證

## 驗證範圍

對照 `docs/architecture/theoretical-framework.md` 文檔與實際代碼實作，進行**全面驗證**：

1. 參數傳遞一致性
2. 資料來源正確性
3. 計算邏輯驗證
4. 文檔描述準確性

---

## ✅ 已修正問題（V1）

### Crash Tolerance 單位不一致 → 已修正

**問題**: targetMaintenance 傳入 0.3（小數）而非 130（百分比）
**修正**: 已改為 130
**驗證**: ✅ 測試通過（1922/1922）

---

## ❌ 新發現問題（V2）

### 問題 1: Tobin Separation 計算邏輯錯誤 🔴 嚴重

#### 文檔聲稱的資料來源（錯誤）

`docs/architecture/theoretical-framework.md` (line 585):

```markdown
| 參數                 | Slot/Provider     | 計算路徑                                |
| -------------------- | ----------------- | --------------------------------------- |
| `riskyAssetValue`    | PortfolioSnapshot | `qty0050 × price0050 + qtyZ2 × priceZ2` |
| `riskFreeAssetValue` | PortfolioSnapshot | `qty00740B × price00740B`               | ❌ 不存在！ |
```

#### 實際代碼實作

**src/modules/strategy/theoreticalInputMapper.mjs**:

```javascript
// ❌ 系統根本沒有追蹤 00740B 債券
export function mapTheoreticalInputs({ snapshot, source, asOf }) {
  // 只檢查 qty0050, qtyZ2, price0050, priceZ2
  // 完全沒有 qty00740B, price00740B 的欄位

  const value0050 = snapshot.qty0050 * snapshot.price0050;
  const value00675L = snapshot.qtyZ2 * snapshot.priceZ2;

  return {
    status: "OK",
    inputs: {
      value0050: createInput(value0050, ...),
      value00675L: createInput(value00675L, ...),
      // ❌ 沒有 value00740B
    },
  };
}
```

**src/scheduler/dailyCheckTheoreticalAdapter.mjs** (line 203-211):

```javascript
const tobinSeparation =
  mappedInputs.status === "OK"
    ? calculateTobinSeparation({
        riskyAssetValue:
          (mappedInputs.inputs.value0050?.value ?? 0) +
          (mappedInputs.inputs.value00675L?.value ?? 0), // ✅ 正確

        riskFreeAssetValue:
          (mappedInputs.inputs.accountNetAsset?.value ?? 0) -
          (mappedInputs.inputs.value0050?.value ?? 0) -
          (mappedInputs.inputs.value00675L?.value ?? 0), // ❌ 邏輯錯誤！
      })
    : null;
```

#### 問題分析

**當前計算假設**:

```
accountNetAsset = 0050 + 00675L + 其他
其他 = accountNetAsset - 0050 - 00675L
```

**實際情況**:

```
accountNetAsset = 證券總值 - 融資負債
證券總值 = 0050 + 00675L + 00740B + 現金
```

**錯誤範例**:

```javascript
// 假設實際持倉
accountNetAsset = 1,000,000 TWD (淨值)
value0050 = 500,000 TWD
value00675L = 300,000 TWD
value00740B = 460,000 TWD (實際持有，但未追蹤)
cash = 50,000 TWD

// ❌ 當前計算（錯誤）
riskFreeAssetValue = 1,000,000 - 500,000 - 300,000 = 200,000

// ✅ 正確應該是
riskFreeAssetValue = 460,000 (00740B 市值)

// 誤差: 200,000 vs 460,000 = 相差 130%！
```

#### 影響

1. **前端展示錯誤**: Mini App 顯示的 Tobin Separation 比例完全不正確
2. **決策誤導**: 若整合到決策引擎，會誤判風險資產配置
3. **文檔誤導**: 開發者會以為系統追蹤了 00740B，但實際沒有

---

### 問題 2: 系統未追蹤 00740B 債券資產 🔴 嚴重

#### 發現證據

**Portfolio 資料結構** (`data/reports/*.json`):

```javascript
{
  "portfolio": {
    "totalValue": 1200000,
    "qty0050": 12000,      // ✅ 有
    "qtyZ2": 6000,         // ✅ 有
    "cash": 80000,         // ✅ 有
    "totalLoan": 900000,   // ✅ 有
    // ❌ 沒有 qty00740B
    // ❌ 沒有 price00740B
  }
}
```

**theoreticalInputMapper** 檢查清單:

```javascript
if (snapshot.price0050 == null || snapshot.priceZ2 == null) {  ✅ 檢查
  return { status: "UNAVAILABLE", reason: "MISSING_PRICE" };
}

// ❌ 完全沒有檢查 price00740B
```

#### 影響

- **Tobin Separation 計算不準確**: 無法正確計算風險/無風險資產比例
- **真實資產配置不透明**: 系統不知道實際持有多少債券
- **文檔虛假承諾**: 文檔聲稱計算來自 `qty00740B × price00740B`，但系統根本沒有這些欄位

---

## ✅ 驗證通過的理論

### Kelly Criterion (凱莉公式) ✅

**代碼檢查**:

```javascript
// dailyCheckTheoreticalAdapter.mjs
calculateKellyLimits({
  mu: regimeOutput.mu, // ✅ 動態來自 regime 分析
  sigma: regimeOutput.sigma, // ✅ 動態來自 regime 分析
  borrowRate: 0.025, // ✅ 硬編碼，文檔已標註
  productCostAdjustment: 0.01, // ✅ 硬編碼，文檔已標註
  protectiveScale: 0.5, // ✅ Half Kelly
});
```

**文檔描述**:

```markdown
| 參數                    | 資料來源      | 當前實作              |
| ----------------------- | ------------- | --------------------- |
| `mu` (預期報酬)         | RegimeMetrics | ✅ regimeOutput.mu    |
| `sigma` (波動率)        | RegimeMetrics | ✅ regimeOutput.sigma |
| `borrowRate`            | 系統設定      | ❌ 硬編碼 0.025       |
| `productCostAdjustment` | 系統設定      | ❌ 硬編碼 0.01        |
```

**結論**: ✅ **完全一致**，文檔正確標註了硬編碼參數

---

### True Exposure (真實曝險) ✅

**代碼檢查**:

```javascript
// dailyCheckTheoreticalAdapter.mjs
calculateTrueExposure({
  grossExposure: grossExposure.grossExposure, // ✅ 來自 calculateGrossExposure()
  financialCapital: mappedInputs.inputs.accountNetAsset.value, // ✅ 來自 portfolioSnapshot
  humanCapital: humanCapital.humanCapital, // ✅ 來自 calculateHumanCapital()
});
```

**資料流驗證**:

```
Price0050Snapshot → calculateGrossExposure() → grossExposure ✅
PriceZ2Snapshot   →                          ↗
PortfolioSnapshot → accountNetAsset ✅
HumanCapital      → humanCapital ✅
                          ↓
                  calculateTrueExposure()
```

**結論**: ✅ **完全一致**，資料流清晰

---

### Human Capital (人力資本) ⚠️ 部分正確

**代碼檢查**:

```javascript
// dailyCheckTheoreticalAdapter.mjs
calculateHumanCapital({
  cashFlows: Array.from({ length: 25 }, () => 1200000), // ❌ 硬編碼
  growthRate: 0, // ❌ 硬編碼
  discountRate: 0.03, // ❌ 硬編碼
});
```

**文檔描述**:

```markdown
| 參數           | 資料來源       | 當前實作        | 未來改進            |
| -------------- | -------------- | --------------- | ------------------- |
| `cashFlows`    | 使用者輸入     | ❌ 硬編碼固定值 | ✅ 從 Mini App 輸入 |
| `growthRate`   | 產業薪資成長率 | ❌ 硬編碼 0%    | ⚠️ 可保持保守       |
| `discountRate` | 無風險利率     | ❌ 硬編碼 3%    | ✅ 動態從台灣公債   |
```

**結論**: ✅ **文檔正確標註了硬編碼狀況**，明確說明「未來改進」

---

### Laplace Criterion (拉普拉斯準則) ⚠️ 部分正確

**代碼檢查**:

```javascript
// dailyCheckTheoreticalAdapter.mjs
calculateLaplaceCriterion({
  scenarios: [
    { name: "COVID 熔斷", maxLoss: 0.4 }, // ❌ 硬編碼
    { name: "熊市震盪", maxLoss: 0.25 }, // ❌ 硬編碼
    { name: "閃崩", maxLoss: 0.35 }, // ❌ 硬編碼
    { name: "估值回歸", maxLoss: 0.2 }, // ❌ 硬編碼
  ],
});
```

**文檔描述**:

```markdown
| 參數        | 資料來源     | 當前實作          | 未來改進              |
| ----------- | ------------ | ----------------- | --------------------- |
| `scenarios` | 歷史數據分析 | ❌ 硬編碼固定情境 | ✅ 從歷史價格動態計算 |
```

**結論**: ✅ **文檔正確標註了硬編碼狀況**

---

## 修正建議

### 方案 A: 快速修正（最小改動）

**修正 Tobin Separation 計算邏輯**，放棄區分風險/無風險資產：

```javascript
// dailyCheckTheoreticalAdapter.mjs
const tobinSeparation = null; // 暫時停用，等待 00740B 追蹤實作

// 或者改為簡化版本（僅計算槓桿資產比例）
const tobinSeparation = calculateTobinSeparation({
  riskyAssetValue: grossExposure.grossExposure, // 總曝險
  riskFreeAssetValue: 0, // 暫時不追蹤
});
```

**優點**: 最快速，不需要修改資料結構  
**缺點**: 功能不完整，無法真正計算 Tobin Separation

---

### 方案 B: 完整修正（推薦）

**階段 1: 追蹤 00740B 債券**

1. 擴充 `portfolio` 資料結構:

```javascript
// src/strategyState.mjs 或 portfolio 定義處
{
  portfolio: {
    qty0050: 12000,
    qtyZ2: 6000,
    qty00740B: 20,      // ✅ 新增
    cash: 80000,
    totalLoan: 900000,
  }
}
```

2. 新增 `Price00740BSnapshot` Provider:

```javascript
// src/modules/providers/priceProviders.mjs
export async function getPrice00740BSnapshot() {
  const price = await fetchPrice("00740B");
  return {
    status: "OK",
    price00740B: price,
    source: "Yahoo Finance",
    asOf: new Date().toISOString(),
  };
}
```

3. 更新 `theoreticalInputMapper`:

```javascript
// src/modules/strategy/theoreticalInputMapper.mjs
const value00740B = snapshot.qty00740B * snapshot.price00740B;

return {
  inputs: {
    value0050: ...,
    value00675L: ...,
    value00740B: createInput(value00740B, { source, asOf, unit: "TWD" }),  // ✅ 新增
  },
};
```

4. 修正 `dailyCheckTheoreticalAdapter`:

```javascript
const tobinSeparation = calculateTobinSeparation({
  riskyAssetValue:
    (mappedInputs.inputs.value0050?.value ?? 0) +
    (mappedInputs.inputs.value00675L?.value ?? 0),
  riskFreeAssetValue: mappedInputs.inputs.value00740B?.value ?? 0, // ✅ 直接使用
});
```

**階段 2: 更新文檔**

修正 `docs/architecture/theoretical-framework.md` 中所有關於 Tobin Separation 的描述。

---

### 方案 C: 暫時性修正（折衷）

**使用 portfolio.cash 作為無風險資產**（不完美但可用）:

```javascript
const tobinSeparation = calculateTobinSeparation({
  riskyAssetValue:
    (mappedInputs.inputs.value0050?.value ?? 0) +
    (mappedInputs.inputs.value00675L?.value ?? 0),
  riskFreeAssetValue: portfolio.cash ?? 0, // ⚠️ 暫時用現金代替債券
});
```

**註記**: 現金不完全等同於債券，但至少是「低風險資產」的一部分。

---

## 修正文檔清單

### theoretical-framework.md 需修正的內容

#### 第 6.4 節 Tobin Separation 資料來源

**當前（錯誤）**:

```markdown
| 參數                 | Slot/Provider     | 計算路徑                                |
| -------------------- | ----------------- | --------------------------------------- |
| `riskyAssetValue`    | PortfolioSnapshot | `qty0050 × price0050 + qtyZ2 × priceZ2` |
| `riskFreeAssetValue` | PortfolioSnapshot | `qty00740B × price00740B`               |
```

**修正為（方案 A: 停用）**:

```markdown
| 參數                 | Slot/Provider     | 計算路徑                                |
| -------------------- | ----------------- | --------------------------------------- |
| `riskyAssetValue`    | PortfolioSnapshot | `qty0050 × price0050 + qtyZ2 × priceZ2` |
| `riskFreeAssetValue` | ❌ **未實作**     | 系統當前未追蹤 00740B 債券              |

**🐛 已知問題**:

- 當前使用 `accountNetAsset - riskyAsset` 推算無風險資產，但此計算包含現金且可能為負
- 需實作 00740B 債券追蹤才能正確計算 Tobin Separation
- **建議**: 暫時停用此指標，或使用 `portfolio.cash` 作為臨時替代
```

**修正為（方案 B: 完整實作）**:

```markdown
| 參數                 | Slot/Provider                           | 計算路徑                                |
| -------------------- | --------------------------------------- | --------------------------------------- |
| `riskyAssetValue`    | PortfolioSnapshot                       | `qty0050 × price0050 + qtyZ2 × priceZ2` |
| `riskFreeAssetValue` | PortfolioSnapshot + Price00740BSnapshot | `qty00740B × price00740B`               |

**實作狀態**:

- ✅ 已新增 `qty00740B` 追蹤
- ✅ 已新增 `Price00740BSnapshot` Provider
- ✅ 計算正確
```

---

## 後續行動

### 緊急（本次修正）

1. ✅ 建立此驗證報告
2. ⚠️ **決策點**: 選擇修正方案（A/B/C）
3. ⚠️ 修正 Tobin Separation 計算或停用
4. ⚠️ 更新 theoretical-framework.md 文檔

### 中期（未來迭代）

5. ⚠️ 實作 00740B 債券追蹤（如選擇方案 B）
6. ⚠️ 動態化 Human Capital 參數（從 Mini App 輸入）
7. ⚠️ 動態化 Laplace Criterion 情境（從歷史價格計算）

### 長期（決策整合）

8. ⚠️ 實作 Theory Guards
9. ⚠️ 整合到決策鏈
10. ⚠️ 壓力測試與回測驗證

---

## 驗證結論

### 文檔準確度評分

| 理論模組          | 文檔準確度 | 問題                         |
| ----------------- | ---------- | ---------------------------- |
| Crash Tolerance   | ✅ 已修正  | 單位不一致（已修正）         |
| Kelly Criterion   | ✅ 100%    | 無問題                       |
| True Exposure     | ✅ 100%    | 無問題                       |
| Human Capital     | ✅ 95%     | 正確標註硬編碼               |
| Laplace Criterion | ✅ 95%     | 正確標註硬編碼               |
| Tobin Separation  | ❌ 20%     | **嚴重錯誤：資料來源不存在** |

### 整體評估

- **Critical Issues**: 1 個（Tobin Separation）
- **Resolved Issues**: 1 個（Crash Tolerance）
- **Documentation Accuracy**: 85%（5/6 正確，1/6 錯誤）

---

**驗證者**: Kiro (Hermes Agent)  
**驗證時間**: 2026-11-01  
**驗證版本**: V2 (全面驗證)
