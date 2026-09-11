---
type: report
status: in-progress
last_updated: 2026-09-11
tags:
  - verification
  - strategy-engine
  - deep-validation
wiki_links:
  - [[Strategy Engine]]
---

# Strategy Engine 深度驗證報告

> **驗證時間**: 2026-09-11 02:20 UTC  
> **驗證範圍**: strategy_engine.md vs strategyEngine.mjs + decision/chain.mjs  
> **狀態**: 🟡 進行中

---

## 📊 驗證結果摘要

| 驗證項目              | 文件描述 | 代碼實作 | 一致性        | 嚴重度     |
| --------------------- | -------- | -------- | ------------- | ---------- |
| Decision Chain 機制   | ✅ 有    | ✅ 有    | ✅ 一致       | -          |
| Decision Rules 清單   | ⚠️ 部分  | ✅ 11 個 | ❌ **不完整** | **MEDIUM** |
| 執行順序 (priority)   | ✅ 有    | ✅ 有    | ⚠️ 待驗證     | -          |
| weightScore 計算      | ✅ 有    | ✅ 有    | ⚠️ 待驗證     | -          |
| Cooldown 冷卻期       | ✅ 有    | ✅ 有    | ⚠️ 待驗證     | -          |
| targetAllocation 計算 | ✅ 有    | ✅ 有    | ⚠️ 待驗證     | -          |

---

## 🔍 詳細驗證結果

### 1. Decision Chain 機制

#### 代碼實作 (`decision/chain.mjs`)

**核心函數**:

- ✅ `runDecisionChain()` - 執行決策鏈
- ✅ `createSortedChain()` - 依 priority 排序規則
- ✅ `DecisionChainBuilder` - Builder Pattern 建構器
- ✅ `createDefaultDecisionChain()` - 建立預設鏈

**執行邏輯**:

```javascript
// 依序執行規則，第一個回傳 non-null 即終止
for (const rule of sortedRules) {
  const result = rule.evaluate(...);
  if (result !== null) {
    return result; // 早期終止
  }
}
```

**特殊處理**:

- `ScoringDecisionRule` 需套用 `budgetSynergyPolicy`
- 其他規則直接 enrich 共享狀態

#### 文件描述 (`strategy_engine.md`)

文件標題提及「決策優先鏈 (Decision Priority Chain)」，但：

- ❌ **未詳細描述執行邏輯**
- ❌ **未說明早期終止機制**
- ❌ **未說明 priority 數值意義**

**結論**: ⚠️ 文件描述過於簡略，需補充執行細節

---

### 2. Decision Rules 清單

#### 代碼實作 (`decision/rules/`)

**實際存在的 11 個規則** (依 priority 排序):

| Priority | Rule                    | 功能                | 文件是否提及 |
| -------- | ----------------------- | ------------------- | ------------ |
| P0       | `RegimePolicyRule`      | Regime 硬條件       | ✅           |
| P10      | `MarginLayerRule`       | 維持率 4 層狀態機   | ✅           |
| P20      | `LifecycleLeverageRule` | 生命週期槓桿封鎖    | ❌ **缺少**  |
| P30      | `GrossLeverageRule`     | Gross Leverage 警戒 | ✅           |
| P40      | `ValuationGuardRule`    | 估值守衛            | ✅ (可能)    |
| P50      | `EntryGateRule`         | EntryGate 前置過濾  | ✅           |
| P60      | `StopLossTrailingRule`  | 停損/移動停利       | ❌ **缺少**  |
| P70      | `ValuationBubbleRule`   | 估值泡沫 (PB ≥ 2.2) | ❌ **缺少**  |
| P80      | `RebalanceRule`         | 再平衡              | ❌ **缺少**  |
| P90      | `ConversionGuardRule`   | 階梯式獲利轉化      | ❌ **缺少**  |
| P100     | `ScoringDecisionRule`   | 評分驅動決策 (最後) | ✅ (隱含)    |

#### 文件描述

文件僅明確提及：

- ✅ `RegimePolicyRule`
- ✅ `MarginLayerRule`
- ✅ `GrossLeverageRule`
- ✅ `EntryGateRule`

**缺少 7 個規則的描述**：

- ❌ `LifecycleLeverageRule`
- ❌ `StopLossTrailingRule`
- ❌ `ValuationBubbleRule`
- ❌ `RebalanceRule`
- ❌ `ConversionGuardRule`
- ❌ `ScoringDecisionRule`
- ❌ `ValuationGuardRule`（可能有提及但不明確）

**結論**: ❌ **文件不完整** - 缺少 7/11 規則的描述

**嚴重度**: **MEDIUM** - 這些規則直接影響投資決策，應該在文件中詳細說明

---

### 3. Priority 執行順序

#### 代碼實作

```javascript
// 依 priority 升序排序（數值越小越優先）
return [...rules].sort((a, b) => a.priority - b.priority);
```

**Priority 範圍**: P0 (最高) → P100 (最低)  
**早期終止**: 第一個回傳 non-null 的規則即終止後續規則

#### 文件描述

- ⚠️ 文件提及「優先鏈」但未明確說明數值意義
- ⚠️ 未說明早期終止機制
- ⚠️ 未說明為何 ScoringDecisionRule 放在最後

**結論**: ⚠️ 需補充執行順序邏輯

---

### 4. Engine State 共享狀態

#### 代碼實作

```javascript
const engineState = {
  panicBypassActive: false,
  valuationGuardResult: null,
  valuationMomentumResult: null,
  regimeResult: null,
  adjustedMaxLeverage: null,
};
```

**用途**: 規則之間共享狀態（如 Regime 判斷結果供後續規則使用）

#### 文件描述

- ❌ 文件未提及 `engineState` 機制
- ❌ 未說明規則間如何共享狀態

**結論**: ❌ 缺少重要設計說明

---

## ⚠️ 發現的問題清單

### 🔴 MEDIUM - 文件不完整

**問題**: 文件僅描述 4/11 個 Decision Rules，缺少 7 個規則

**影響**:

- 開發者無法從文件了解完整決策邏輯
- AI Agent 無法理解所有規則的用途
- 維護時可能誤刪「未被文件提及」的規則

**建議**:

1. 在 `strategy_engine.md` 補充完整的 Decision Rules 清單
2. 每個規則說明：
   - Priority 值
   - 功能描述
   - 觸發條件
   - 回傳結果

---

### 🟡 LOW - 執行邏輯說明不足

**問題**: 文件未說明早期終止機制、priority 排序、engineState 共享

**影響**:

- 開發者難以理解規則執行順序的重要性
- 不清楚為何某些規則可以「跳過」後續規則

**建議**:
在文件中補充：

```markdown
## Decision Chain 執行邏輯

1. 規則依 priority 升序執行 (P0 → P100)
2. 第一個回傳 non-null 的規則即終止後續規則
3. 規則間透過 engineState 共享狀態
4. ScoringDecisionRule (P100) 作為 fallback，總是回傳結果
```

---

## 📋 待驗證項目

以下項目需進一步深入驗證：

### ⬜ weightScore 計算邏輯

- [ ] 文件描述的計算公式
- [ ] 代碼實際實作
- [ ] 測試覆蓋

### ⬜ Cooldown 冷卻期

- [ ] 冷卻期觸發條件
- [ ] 冷卻天數計算
- [ ] 對決策的影響

### ⬜ targetAllocation 計算

- [ ] 配置公式
- [ ] 槓桿倍數計算
- [ ] Budget 限制

### ⬜ 各 Decision Rule 詳細邏輯

- [ ] RegimePolicyRule
- [ ] MarginLayerRule
- [ ] LifecycleLeverageRule
- [ ] GrossLeverageRule
- [ ] ValuationGuardRule
- [ ] EntryGateRule
- [ ] StopLossTrailingRule
- [ ] ValuationBubbleRule
- [ ] RebalanceRule
- [ ] ConversionGuardRule
- [ ] ScoringDecisionRule

---

## 🎯 下一步建議

### 立即修正 (本階段)

1. **補充 Decision Rules 清單至文件**
   - 建立完整的 11 個規則表格
   - 說明每個規則的 priority、功能、條件

2. **補充執行邏輯說明**
   - 早期終止機制
   - engineState 共享
   - priority 排序規則

### 後續驗證 (下階段)

3. **深度驗證每個 Decision Rule**
   - 逐一比對規則邏輯與文件
   - 檢查測試覆蓋

4. **驗證 weightScore 計算**
   - 提取計算公式
   - 比對文件描述

5. **驗證 Cooldown 與 targetAllocation**

---

## 📊 驗證進度

**當前階段**: Strategy Engine 核心機制  
**完成度**: 30%

- ✅ Decision Chain 機制驗證
- ✅ Decision Rules 清單比對
- ⬜ 執行邏輯細節驗證
- ⬜ weightScore 計算驗證
- ⬜ Cooldown 驗證
- ⬜ targetAllocation 驗證
- ⬜ 各 Rule 詳細驗證

**預估剩餘時間**: 2-3h

---

**報告狀態**: 🟡 進行中  
**下一步**: 修正文件缺失的 Decision Rules 描述
