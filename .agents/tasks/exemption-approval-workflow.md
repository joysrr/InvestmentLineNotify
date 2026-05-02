---
task_id: exemption-approval-workflow
file_type: workflow
owner: @Lead
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  豁免授權 4 步 SOP（申請 → 評估 → 記錄 → 標注）+ 邊界 + 累積警示
referenced_by:
  - rules/lead.md
  - rules/consultant.md
  - skills/examples/reviewer-security-boundary-examples.md
  - docs/Reports/AUDIT_HISTORY.md
  - docs/agents-overview.md
---

# Task: Exemption Approval Workflow（豁免授權與記錄機制）

> **縱深防禦中間層**：規則禁止 → **豁免記錄** → 全局緊急阻斷。處理「臨時性規則例外」。

---

## 4 步驟流程

1. **申請**：Agent 說明豁免規則 / 原因 / 影響範圍
2. **評估**：`@Lead` 決策：

- **核准**（說明授權範圍與有效期）
- **拒絕**（附理由）

3. **記錄**（核准時）：依 EXEMPTION_LOG 標準格式寫入 `PENDING_ACTIONS.md` §「豁免記錄」
4. **標注**：豁免完成後 `@Lead` 標注「已執行」

---

## 豁免授權邊界（`@Lead` 無權單獨授權，必升級 User）

| #   | 條件                                                                                |
| --- | ----------------------------------------------------------------------------------- |
| 1   | `strategyWeight` 任何數值異動（workspace `CRITICAL_PATHS.strategyWeight` 異動路徑） |
| 2   | `.agents/` 原始 Rules 直接修改（採納提案例外除外）                                  |
| 3   | 任何金鑰 / Token 相關操作（對齊 `skills/security-audit.md` SC-01 / SC-02）          |
| 4   | 破壞性架構變更（見 `architect.md §現有架構錨點`）                                   |

**違反**：若 `@Lead` 單獨核准觸及以上四條件 → 視同未授權；觸發 `system-prompt.md §全局緊急阻斷` 條件三。

---

## EXEMPTION_LOG 標準格式

```
【豁免記錄】
豁免編號：EX-{YYYYMMDD}-{序號}
豁免時間：{時間戳 / 對話序號}
申請 Agent：@{Agent}
豁免規則：{被豁免條文來源，如 backend.md §HITL 升級條件}
豁免原因：{業務原因}
授權來源：@Lead / User 明確授權
授權記錄：「{授權語句}」
影響範圍：{資料 / 系統範圍}
有效期：單次有效 / 本次 Sprint 有效
```

**編號規則**：

- 全系統唯一，不重用
- 寫入位置：`PENDING_ACTIONS.md`（依 `assistant.md §s10 PENDING_ACTIONS 標準格式` 區塊定義）

---

## 豁免累積警示

未歸檔記錄 **≥ `EXEMPTION_AUDIT_THRESHOLD`**（依 `RULES_DESIGN_GUIDE §十四`，預設 5 筆）時：

1. `@Lead` 通知 `@Retro` 執行豁免審計（評估是否納入 Rules 更新，避免影子規則）
2. `@Assistant` 巡邏 P-10 自動偵測產 🟡 `EXEMPTION_ACCUMULATED`
3. User 可下令 `@Retro 執行豁免審計` 觸發批次檢視

---

## 禁止行為

- **絕對禁止** 未執行 EXEMPTION_LOG 記錄即核准豁免（視同未授權）
- **絕對禁止** `@Lead` 單獨核准觸及「豁免授權邊界」四條件，必須升級 User
- **絕對禁止** 豁免編號重用（即使舊豁免已結案）
- **絕對禁止** 於同一對話中執行多個豁免卻只留一筆 EXEMPTION_LOG

---

## 與其他規則對齊

- `lead.md §s10 行為準則`：豁免授權為 @Lead 唯一授權例外
- `backend.md §s07 執行豁免申請規範`：@Backend 申請端流程
- `system-prompt.md §全局緊急阻斷`：豁免授權邊界違反 → 條件三觸發
- `retro.md §s_exemption_audit`：EXEMPTION_ACCUMULATED 後的根因分析 + 4 步流程 + 歸檔執行者鐵律（@Retro；PROPOSAL_502_014 N-6 補）
- `skills/security-audit.md §1` SC-04：資料刪除零容忍（不接受豁免）

---

## 溯源

本檔案抽出自：`lead.md §s11 豁免授權與記錄機制`（priority: critical, immutable: true）

**修訂限制**：本 task 內容繼承 lead.md 原 §s11 的 `critical + immutable` 屬性；修改需透過 RULE_UPDATE_PROPOSAL 提案；本 task 本體保持與 `lead.md` 引用同步。

---

## Related Decisions

- [ADR-0030](../decisions/0030-notification-classification.md) — 通知分級標準
