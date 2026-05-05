---
theme_id: lead-state-anchor
file_type: iron_theme
version: v1.0
last_modified: 2026-05-01
last_proposal: PROPOSAL_20260501_002
audit_baseline: v1.0
immutable: true
applies_to:
  - project_lead
modification_policy: |
  本檔變動必經提案流程；commit-time iron-theme-validator 檢查 diff；
  違反觸發 system-prompt.md §全局緊急阻斷條件一（@Lead 連續派發失敗）。
  本 theme 為 ADR-0001 stateless routing 的核心鐵律 first-class 化；
  變動需審視 @Lead 派發行為穩定性 + drift_score 影響。
---

# Iron Theme: Lead State Anchor

> 跨切不可變鐵律；@Lead 專用（applies_to: project_lead）。
> 由 PROPOSAL_20260501_002 Phase H 從 `rules/lead.md §s_state_anchor` 抽出。
> ADR-0001 Stateless Routing 三鐵律 first-class artifact。

---

## 三大鐵律（不可改詞；ADR-0001 核心）

### 1. 強制狀態讀取

第一動作讀 `PENDING_ACTIONS.md §🎯 [CURRENT_STAGE]`；**禁止**預測超 1 步。

### 2. 禁止文本合併

僅 grep 符號；**禁止**複製貼上 REVIEW/SECURITY_REPORT 原文。

### 3. ROUTING_TICKET 機讀化（PROPOSAL_023）

派發前**必先**寫 `ROUTING_TICKET.md`；訊息僅作通知；**禁止**派發訊息含 ticket 以外細節。

---

## 違反處理

- 累積 ≥ 3 次違反 → 觸發 `system-prompt.md §全局緊急阻斷` 條件一
- `CURRENT_WORKSPACE` 缺 → `skills/lead-orchestration-guide.md §1.3` Fallback
- 多 Phase 提案 → `skills/checklists/dual-tracking-checklist.md`

完整細則 + 實作協議：`skills/lead-orchestration-guide.md §一` + `skills/stateless-routing-pattern.md` + `skills/routing-ticket-protocol.md`。

**CONVERSATION_COUNTER 跨 session 策略**（PROPOSAL_502_023 C-4）：PENDING_ACTIONS.md git-tracked 為 primary；fresh init 時 @Assistant 依 `LAST_CONVERSATION_ISO` wall-clock 推估補位；audit 週期（每 10 對話）對齊由 @Auditor 接觸發時讀 git log 推估補齊。絕對禁止手動清 counter 不通知 User。

---

## Applies_to Rules

| Agent   | Rule Section                    | 角色責任（rule 保留）                              |
| ------- | ------------------------------- | -------------------------------------------------- |
| `@Lead` | `rules/lead.md §s_state_anchor` | 1-行入口 + 引用本 theme（三大鐵律 canonical 來源） |

---

## Related Decisions

ADR-0001（Stateless Routing；本 theme 為 ADR-0001 三鐵律 first-class 化）/ ADR-0037（Iron Themes；抽出依據）— 在 `decisions/`。
