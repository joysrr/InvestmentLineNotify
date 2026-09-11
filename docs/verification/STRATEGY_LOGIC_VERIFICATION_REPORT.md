---
type: report
status: in-progress
last_updated: 2026-09-11
tags:
  - verification
  - strategy
  - budget-priority
  - validation
wiki_links:
  - [[Strategy Engine]]
  - [[Budget Priority]]
---

# 核心策略邏輯驗證報告 (進行中)

> **驗證時間**: 2026-09-11  
> **驗證範圍**: Budget Priority 系統、Strategy Engine、新聞行動建議

---

## 📊 驗證發現摘要

### ⚠️ 關鍵發現：Budget Priority 設計文檔與代碼實作存在差異

**狀態**: 🔴 文檔描述了完整的 P0/P1 分層系統，但代碼中**尚未找到對應實作**

---

## 🔍 詳細驗證結果

### 1. Budget Priority 系統驗證

#### 📄 文檔描述

**文件**: `docs/design/BUDGET_PRIORITY_DESIGN.md`

**核心設計**:

- ✅ **P0 固定 DCA (無條件執行)**
  - 每月 3 萬元 (原有固定投入)
  - 每 10 天 6 萬元 (增貸基礎 DCA，共 105 萬額度)
  - **不受新聞事件影響，無條件執行**

- ✅ **P1 條件加碼 (市場條件允許)**
  - 在 P0 基礎上，根據市場條件加碼
  - 依百分比加碼 (如 +20%, +50%)
  - **受新聞風險事件影響，可暫停**

- ✅ **資金分層邏輯**
  - 105 萬增貸：P0 基礎 DCA (6萬/10天)
  - 剩餘資金：P1 條件加碼池
  - 45 萬：00740B 債券 (不加碼)

#### 💻 代碼實作

**檢查範圍**:

- ✅ `src/modules/strategy/strategyEngine.mjs`
- ✅ `src/modules/strategy/strategyDefaults.mjs`
- ✅ `src/modules/strategy/policies/*.mjs`
- ✅ `data/config/Strategy.default.json`
- ✅ `src/modules/ai/periodReportAgent.mjs`

**發現**:

- ❌ **未找到 P0/P1 優先級分層邏輯**
- ❌ **未找到 "3萬/月" 或 "6萬/10天" 的硬編碼值**
- ❌ **未找到區分 "固定DCA" vs "條件加碼" 的代碼**
- ✅ 找到預算管控邏輯 (Budget):
  - `MAX_DAILY_LOAN_INCREASE_PCT = 0.15` (15%)
  - `MAX_ROLLING_LOAN_INCREASE_PCT = 0.2` (20%)
  - `BUDGET_ROLLING_DAYS = 10`
- ✅ 找到策略決策鏈 (Decision Chain):
  - `RegimePolicyRule`, `ValuationGuardRule`, `MarginLayerRule` 等
  - 但**未見 BudgetPriorityRule**

#### 🧪 測試覆蓋

**檢查範圍**:

- `src/test/integration/strategyEngine.test.mjs`
- `src/test/unit/strategyEngine.test.mjs`

**發現**:

- ❓ 未檢查 (需進一步驗證)

---

### 2. 新聞行動建議驗證

#### 📄 文檔要求

根據 Han 的記憶與文檔:

- 新聞行動建議須**嚴格區分** P0 與 P1
- P0 (綠色卡片): 固定 DCA，無條件執行
- P1 (琥珀色卡片): 條件加碼，觀望或暫停
- 新聞風險事件**僅影響 P1**，不可建議暫停 P0

#### 💻 代碼實作

**檢查範圍**:

- `src/modules/ai/periodReportAgent.mjs`

**發現**:

- ✅ 找到行動建議相關代碼
- ❌ **未找到 P0/P1 區分邏輯**
- ❓ 需檢查 LLM Prompt 是否包含 P0/P1 指引

---

### 3. Strategy Engine 核心邏輯驗證

#### 💻 代碼架構

**已確認存在**:

- ✅ `strategyDefaults.mjs` - 策略常數 (維持率、槓桿上限、預算限制)
- ✅ `strategyEngine.mjs` - 策略引擎主邏輯
- ✅ `regimePolicy.mjs` - 市場狀態政策
- ✅ `decision/chain.mjs` - 決策鏈
- ✅ `policies/budgetLimitPolicy.mjs` - 預算限制政策
- ✅ Decision Rules:
  - `RegimePolicyRule` - 市場狀態規則
  - `ValuationGuardRule` - 估值守衛
  - `MarginLayerRule` - 維持率分層
  - `GrossLeverageRule` - 綜合槓桿控制

**預期但未找到**:

- ❌ `budgetPriority.mjs` - P0/P1 優先級邏輯
- ❌ `BudgetPriorityRule` - 優先級決策規則
- ❌ P0/P1 配置 (在 Strategy.json 中)

---

## 🎯 驗證結論

### 一致性評估

| 功能模組                  | 文檔    | 代碼      | 測試    | 一致性        | 嚴重度   |
| ------------------------- | ------- | --------- | ------- | ------------- | -------- |
| **Budget Priority P0/P1** | ✅ 完整 | ❌ 未實作 | ❓ 未知 | 🔴 **不一致** | **HIGH** |
| Budget Limit (日/10天)    | ✅ 有   | ✅ 有     | ❓ 未知 | ✅ 一致       | -        |
| Regime Policy             | ✅ 有   | ✅ 有     | ❓ 未知 | ⚠️ 待驗證     | MEDIUM   |
| Valuation Guard           | ✅ 有   | ✅ 有     | ❓ 未知 | ⚠️ 待驗證     | MEDIUM   |
| Margin Layer              | ✅ 有   | ✅ 有     | ❓ 未知 | ⚠️ 待驗證     | MEDIUM   |
| 新聞行動建議 P0/P1        | ✅ 要求 | ❌ 未實作 | ❓ 未知 | 🔴 **不一致** | **HIGH** |

---

## 📋 下一步行動建議

### 🔴 HIGH Priority (必須確認)

1. **確認 Budget Priority 是否真的未實作**
   - 可能在 LLM Prompt 中實作 (而非硬編碼)
   - 可能在配置文件中 (需檢查實際 Strategy.json，非 default)
   - 可能在新聞報告生成的 System Prompt 中

2. **檢查新聞行動建議的 LLM Prompt**
   - `periodReportAgent.mjs` 的 AI 呼叫
   - 確認 Prompt 是否包含 P0/P1 指引
   - 驗證輸出格式是否區分優先級

3. **詢問 Han 確認**
   - P0/P1 分層是**設計意圖**還是**已實作功能**？
   - 如果已實作，在哪個模組？
   - 新聞報告是否已經在輸出中區分 P0/P1？

### 🟡 MEDIUM Priority (建議驗證)

4. **完整測試覆蓋驗證**
   - 執行現有測試套件
   - 檢查測試案例是否覆蓋關鍵邏輯
   - 識別測試缺口

5. **其他策略模組深度驗證**
   - Regime Policy 詳細邏輯
   - Lifecycle Engine 狀態機
   - Valuation Guard 估值守衛

---

## 🤔 假設與待驗證

### 假設 A: P0/P1 在 LLM Prompt 中實作

**可能性**: 高  
**原因**:

- 未找到硬編碼的分層邏輯
- Han 明確要求新聞報告區分 P0/P1
- 可能透過 Prompt 指導 LLM 生成建議

**驗證方法**:

- 檢查 `periodReportAgent.mjs` 的 AI Prompt
- 檢查 `aiCoach.mjs` 或其他新聞相關 AI 模組
- 搜尋包含 "P0" 或 "優先級" 的 Prompt 文件

### 假設 B: P0/P1 是設計意圖，尚未實作

**可能性**: 中  
**原因**:

- BUDGET_PRIORITY_DESIGN.md 是設計文檔
- 可能是未來功能規劃
- 代碼中確實未見相關實作

**驗證方法**:

- 直接詢問 Han
- 檢查 Git 歷史，確認設計文檔建立時間

### 假設 C: P0/P1 在實際配置文件中

**可能性**: 低  
**原因**:

- `Strategy.default.json` 中未見
- 但可能在生產環境的實際配置中

**驗證方法**:

- 檢查 `data/config/Strategy.json` (非 default)
- 檢查環境變數或其他配置來源

---

## ⏸️ 驗證暫停點

**當前進度**: 40%  
**已完成**: 文檔審查、代碼架構掃描  
**待完成**: Prompt 檢查、測試驗證、Han 確認

**暫停原因**: 需要 Han 確認以下關鍵問題後再繼續深入驗證

---

## ❓ 需要 Han 回答的問題

1. **P0/P1 Budget Priority 系統目前的實作狀態是？**
   - [ ] 已實作 (請指出在哪個模組)
   - [ ] 設計中，尚未實作
   - [ ] 在 LLM Prompt 中實作 (軟性規則)

2. **新聞報告目前是否已經在輸出中區分 P0/P1？**
   - [ ] 是，有綠色/琥珀色卡片區分
   - [ ] 否，尚未實作
   - [ ] 部分實作，僅在文字描述中提及

3. **如果 P0/P1 已實作，能否提供一個實際的新聞報告範例？**
   - 以便驗證輸出格式

4. **"3萬/月" 和 "6萬/10天" 的固定 DCA 金額在哪裡配置？**
   - [ ] 硬編碼在代碼中
   - [ ] 在配置文件中
   - [ ] 手動執行，非系統自動

---

**報告狀態**: 🟡 進行中 - 等待 Han 確認  
**下一步**: 根據 Han 回答決定驗證方向  
**預估剩餘時間**: 2-3h (取決於發現的問題數量)
