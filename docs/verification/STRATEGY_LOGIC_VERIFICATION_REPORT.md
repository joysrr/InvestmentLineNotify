---
type: report
status: current
last_updated: 2026-09-11
last_verified: 2026-09-11
tags:
  - verification
  - strategy
  - budget-priority
  - validation
wiki_links:
  - [[Strategy Engine]]
  - [[Budget Priority]]
---

# 核心策略邏輯驗證報告

> **驗證時間**: 2026-09-11  
> **驗證範圍**: `BUDGET_PRIORITY_DESIGN.md` vs `budgetLimitPolicy.mjs` + `Strategy.default.json`  
> **結論**: ✅ 文件與代碼整體一致，發現 2 個次要差異（`strategyDefaults.mjs` fallback 值偏高）

---

## 📊 整體驗證結果

| 驗證項目                                           | 文件描述                       | 代碼實作                                             | 一致性               |
| -------------------------------------------------- | ------------------------------ | ---------------------------------------------------- | -------------------- |
| `resolveBudgetLimit` 函數                          | ✅ 有                          | ✅ 有                                                | ✅ 一致              |
| `baseline` signalType                              | ✅ min(請求, dailyDcaReserve)  | ✅ 相同                                              | ✅ 一致              |
| `tactical_drop` signalType                         | ✅ min(請求, tacticalPool×0.7) | ✅ 相同                                              | ✅ 一致              |
| `tactical_panic` signalType                        | ✅ min(請求, tacticalPool×0.3) | ✅ 相同                                              | ✅ 一致              |
| `dailyDcaReserve = monthlyDcaAmount / 20`          | ✅ 有                          | ✅ 相同                                              | ✅ 一致              |
| `tacticalPool = dailyAvailable - dcaReserve`       | ✅ 有                          | ✅ 相同                                              | ✅ 一致              |
| `rollingAvailable` 10天滾動計算                    | ✅ 有                          | ✅ 相同                                              | ✅ 一致              |
| `dailyAvailable = min(dailyCap, rollingAvailable)` | ✅ 有                          | ✅ 相同                                              | ✅ 一致              |
| 風控覆寫：維持率 <160% → Tactical 全關             | ✅ 有                          | ✅ 相同                                              | ✅ 一致              |
| 風控覆寫：VIX >25 → 額度 ×0.5                      | ✅ 有                          | ✅ 相同                                              | ✅ 一致              |
| 風控覆寫：MA60 向下 → Tactical ×0.5                | ✅ 有                          | ✅ 相同                                              | ✅ 一致              |
| 風控覆寫：PRE_RETIRE → Tactical 全關               | ❌ 未提及                      | ✅ 有實作                                            | ⚠️ 文件缺少此條      |
| `maxDailyLoanIncreasePct` 預設值                   | 5%                             | Strategy.json: 5% ✅ / strategyDefaults.mjs: 15% ⚠️  | ⚠️ fallback 值不一致 |
| `maxRollingLoanIncreasePct` 預設值                 | 15%                            | Strategy.json: 15% ✅ / strategyDefaults.mjs: 20% ⚠️ | ⚠️ fallback 值不一致 |
| `monthlyDcaAmount` 預設值                          | 30000                          | Strategy.json: 30000 ✅                              | ✅ 一致              |

---

## 🔍 詳細說明

### ✅ 核心邏輯完全一致

`budgetLimitPolicy.mjs` 的實作完整對應文件描述的 6 步驟決策流程：

1. **步驟 1** `dailyCap = netAsset × maxDailyLoanIncreasePct` — 代碼完全相同
2. **步驟 2** `rollingAvailable = rollingCap - rollingUsed` — 代碼完全相同
3. **步驟 3** `dailyAvailable = min(dailyCap, rollingAvailable)` — 代碼完全相同
4. **步驟 4** `dailyDcaReserve = monthlyDcaAmount / 20` — 代碼完全相同
5. **步驟 5** `tacticalPool = max(0, dailyAvailable - dcaReserve)` — 代碼完全相同
6. **步驟 6** signalType 分配比例 (baseline:100%, drop:70%, panic:30%) — 代碼完全相同

---

## ⚠️ 發現的次要差異

### 差異 1：`strategyDefaults.mjs` 常數用途說明不清（已補充 JSDoc）

**背景釐清**：`strategyDefaults.mjs` 中的常數並非 fallback 預設值，而是**驗證用硬上限**，供 `validateStrategyConfig.mjs` 確保 Strategy.json 不超過安全邊界：

| 常數                                      | 用途                   | 值          |
| ----------------------------------------- | ---------------------- | ----------- |
| `MAX_DAILY_LOAN_INCREASE_PCT`             | 硬上限（validator 用） | 15%         |
| `MAX_ROLLING_LOAN_INCREASE_PCT`           | 硬上限（validator 用） | 20%         |
| `Strategy.json maxDailyLoanIncreasePct`   | 實際操作值             | 5%（保守）  |
| `Strategy.json maxRollingLoanIncreasePct` | 實際操作值             | 15%（保守） |

設計意圖：硬上限（15%/20%）是「絕對不可超過的安全邊界」，Strategy.json 的實際值（5%/15%）是「日常保守操作值」，兩者角色不同，不應對齊。

**修正**：原 JSDoc 說明誤導為 fallback 值，已更新為「驗證用硬上限」，並補充實際操作值說明。

---

### 差異 2：PRE_RETIRE 生命週期覆寫未記載於文件

**問題**：代碼中有 `lifecycleStage === "PRE_RETIRE"` 時禁止 Tactical 操作的邏輯，但文件 Section 5 的風控覆寫清單未提及。

**影響**：低。功能本身正確合理，只是文件缺少此條。

**建議**：在文件 Section 5「風控覆寫檢查」中補充此條。

---

## ✅ 初步驗證誤判說明

> 本報告先前版本（已作廢）錯誤標示「未找到 P0/P1 實作」。  
> **原因**：當時搜尋的是不存在的 `budgetPriority.mjs`，忽略了實際實作在 `budgetLimitPolicy.mjs`。  
> `baseline / tactical_drop / tactical_panic` 即為文件描述的分層機制，命名不同但語義完全一致。

---

## 📋 驗證結論

**`BUDGET_PRIORITY_DESIGN.md` 文件正確反映了現有代碼的實作邏輯，應保留。**

- 核心 6 步驟決策流程：✅ 完全一致
- signalType 分層分配：✅ 完全一致
- 風控覆寫邏輯：✅ 大致一致（1 條代碼有、文件未提）
- 預設參數值：✅ 以 `Strategy.json` 為準均正確，`strategyDefaults.mjs` fallback 有小差異

**建議的後續修正（非緊急）**：

1. 將 `strategyDefaults.mjs` 的 `MAX_DAILY_LOAN_INCREASE_PCT` 改為 `0.05`，`MAX_ROLLING_LOAN_INCREASE_PCT` 改為 `0.15`，與 `Strategy.json` 對齊
2. 在 `BUDGET_PRIORITY_DESIGN.md` Section 5 補上「PRE_RETIRE 生命週期 → Tactical 全關」這條風控覆寫規則
