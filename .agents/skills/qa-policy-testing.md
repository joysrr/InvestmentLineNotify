---
skill_id: qa-policy-testing
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @QA Policy 模組（純函數）100% 覆蓋率測試規範 + 邊界值強制清單。
  自 rules/qa.md §s03 搬入。
referenced_by:
  - rules/qa.md §s03
related_skill:
  - domains/math-quant.md（除零防護對齊）
  - rules/reviewer.md §s07（路徑 2 投資訊號計算）
---

# Skill: Policy 模組測試規範（純函數 100% 覆蓋率 + 邊界值）

> 與 `qa.md §s02 系統必測功能清單` 互補：前者為**系統層**功能必測；本節為**模組層**純函數必測。

## 適用範圍

`<workspace>/policies/*.mjs`（或 workspace 指定路徑）下所有算分 / 計分 / 策略判定**純函數**（無 Disk I/O / 無網路 Fetch / 無外部副作用）。

典型範圍（非窮盡）：

- 訊號規則模組（如 `signalRules.mjs` 拆分後）
- 風險管理模組（如 `marginManager.mjs` 拆分後）
- 結構驗證器（如 `strategySchema.mjs`）
- 任何未來新增的 `policies/*.mjs`

## 100% 覆蓋率要求（零容忍）

- **絕對禁止** `policies/*.mjs` 任一純函數未被單元測試覆蓋
- 以 `c8` 或等效工具驗證；**語句 / 分支 / 函數**三項覆蓋率均須達 100%
- 缺覆蓋的 PR → `@Reviewer` 標 🔴 `[BLOCKER]` 退件

## 邊界值測試強制清單

`policies/*.mjs` 變更前，`@Backend` / `@QA` **必先**補齊以下邊界（TDD 保護）：

| 邊界類型       | 測試情境                                               |
| -------------- | ------------------------------------------------------ |
| 數值下限       | 價格 ≤ 0 / 成交量 = 0                                  |
| 數值上限       | 超大數值（防 `Infinity` / overflow）                   |
| 空輸入         | 空陣列 / `null` / `undefined`                          |
| NaN / 型別誤用 | `NaN` 傳入數學運算 / 字串傳入數值欄位                  |
| 極端指標值     | RSI = 0 / RSI = 100 / KD 鈍化 / 波動率 ≈ 0（除零防護） |

對齊 `domains/math-quant.md §防呆` 的除零與極端值防護 + `rules/reviewer.md §s07 路徑 2 投資訊號計算` checklist。

## 回報整合

`@QA` `s12` DoD 自評 Checklist 新增隱含條目（當 Sprint 涉及 `policies/` 變更時）：

- [ ] 變更的 `policies/*.mjs` 達成 100% 三項覆蓋率
- [ ] 邊界值測試強制清單（5 類）全數補齊

## 禁止行為（保留於 rule）

- **絕對禁止** 以「純函數很簡單不會錯」為由跳過邊界測試
- **絕對禁止** 在覆蓋率不足時標注「✅ 通過」回報

<!-- END: qa-policy-testing -->
