---
type: plan
status: in-progress
last_updated: 2026-09-11
progress: 0%
tags:
  - verification
  - strategy
  - validation
wiki_links:
  - [[Strategy Engine]]
  - [[Budget Priority]]
---

# 核心策略邏輯驗證計畫

## 🎯 目標

驗證系統核心策略邏輯與文件的一致性，確保：

1. 文件描述與實際代碼行為一致
2. 設計文檔反映當前實作狀態
3. 關鍵邏輯有完整測試覆蓋

---

## 📋 驗證範圍

### 1. Budget Priority 系統

**文檔**:

- `docs/design/BUDGET_PRIORITY_DESIGN.md` - 設計文檔
- `docs/modules/strategy/strategy_engine.md` - 模組說明

**代碼**:

- `src/modules/strategy/strategyEngine.mjs` - 主邏輯
- `src/modules/strategy/budgetPriority.mjs` - 優先級邏輯

**驗證項目**:

- [ ] P0 基礎 DCA 規則（3萬/月 + 6萬/10天）
- [ ] P1 條件加碼規則
- [ ] 新聞事件對 P0/P1 的影響
- [ ] 資金分層邏輯
- [ ] 0050/00675L/00740B 配置規則

### 2. Regime Policy 市場狀態

**文檔**:

- `docs/modules/strategy/regime_policy.md`

**代碼**:

- `src/modules/strategy/regimePolicy.mjs`

**驗證項目**:

- [ ] 市場狀態判斷邏輯
- [ ] 狀態轉換條件
- [ ] 各狀態下的策略調整

### 3. Lifecycle Engine 生命週期

**文檔**:

- `docs/modules/strategy/lifecycle_engine.md`
- `docs/modules/strategy/maintenance_state_machine.md`

**代碼**:

- `src/modules/strategy/lifecycle/`
- `src/modules/strategy/maintenance/`

**驗證項目**:

- [ ] 持倉生命週期狀態
- [ ] 狀態轉換邏輯
- [ ] 自動化維護流程

---

## 🔍 驗證方法

### 階段 1: 文檔內容審查 (1h)

1. 閱讀所有策略相關文檔
2. 提取關鍵邏輯描述
3. 建立文檔-代碼映射表

### 階段 2: 代碼邏輯分析 (2h)

1. 閱讀核心策略代碼
2. 提取實際實作邏輯
3. 與文檔描述對比

### 階段 3: 測試覆蓋驗證 (1h)

1. 檢查相關測試文件
2. 驗證關鍵邏輯有測試覆蓋
3. 識別測試缺口

### 階段 4: 差異報告 (1h)

1. 列出文檔與代碼不一致處
2. 分類：文檔過時 vs 代碼未實作
3. 提出修正建議

---

## 📊 驗證矩陣

| 功能                      | 文檔 | 代碼 | 測試 | 一致性 | 備註   |
| ------------------------- | ---- | ---- | ---- | ------ | ------ |
| Budget Priority - P0 DCA  | ✅   | ?    | ?    | ?      | 待驗證 |
| Budget Priority - P1 加碼 | ✅   | ?    | ?    | ?      | 待驗證 |
| Regime Policy - 狀態判斷  | ✅   | ?    | ?    | ?      | 待驗證 |
| Lifecycle - 狀態機        | ✅   | ?    | ?    | ?      | 待驗證 |
| 0050 配置規則             | ✅   | ?    | ?    | ?      | 待驗證 |
| 00675L 槓桿策略           | ✅   | ?    | ?    | ?      | 待驗證 |
| 00740B 債券壓艙           | ✅   | ?    | ?    | ?      | 待驗證 |

---

## 🎯 預期產出

1. **驗證報告** (`docs/verification/STRATEGY_LOGIC_VERIFICATION_REPORT.md`)
   - 一致性分析
   - 差異清單
   - 修正建議

2. **更新文檔** (如需要)
   - 修正過時描述
   - 補充缺失細節
   - 更新代碼映射

3. **測試補強計畫** (如需要)
   - 識別測試缺口
   - 建議新增測試案例

---

## ⏱️ 預估時間

- 階段 1: 1h
- 階段 2: 2h
- 階段 3: 1h
- 階段 4: 1h
- **總計**: 5h

---

## 🚀 執行狀態

- [ ] 階段 1: 文檔審查
- [ ] 階段 2: 代碼分析
- [ ] 階段 3: 測試驗證
- [ ] 階段 4: 差異報告

**開始時間**: 2026-09-11 00:39 UTC  
**負責人**: Kiro (AI Agent)
