<!-- MACHINE_READABLE
type: artifact-protocol
category: F1
id: lead-artifact-protocols
related_proposals: [PROPOSAL_20260425_001, PROPOSAL_20260424_023]
related_decisions: [ADR-0005, ADR-0013]
-->

# Skill: Lead Artifact Protocols（@Lead 產出物確認與 Gate Check 完整協定）

> 由 PROPOSAL_20260425_001 Phase C 建立；F1 類（純通用 Gate Check 協定）。
> `rules/lead.md §s09` 保留 Gate Check 短指令格式 + 4 條鐵律 + skill pointer；本文為**完整 Gate Check 條件 + DoD Auto-Audit + Hotfix 變體**。
> 對齊 ADR-0005（@Auditor 定期統計 DoD 達成率）+ ADR-0013（DoD Self-Audit）。

---

## 一、職責分工

- **各 Agent**：負責**細節 DoD 自評**（見各自 `## 產出物 (Artifacts)` 章節 + `skills/templates/dod-audit-template.md`）
- **@Lead**：只執行 **Gate Check** 確認**階段轉移關鍵條件**；通過後等 User 確認
- @Lead **不**重複驗證 Agent 細節（避免越權與重工）

---

## 二、Gate Check 條件表（11 階段轉移；對齊 `rules/lead.md §s05` + `lead-orchestration-guide §6.2`）

> **Stage 編號 SoT**：本表階段 1-9 與 `rules/lead.md §s05`（Workflow Engine）+ `lead-orchestration-guide §6.2`（10 階段條件分支）統一；前置 stage 0（接案）+ 後置 stage 9→歸檔屬流程外掛步驟，不入主編號。

| 階段轉移                           | Gate 條件                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0. 接案 → 1. 需求                  | User 提供初始需求；@Lead 已讀取 `PENDING_ACTIONS.md §🎯`                                                                       |
| 1. 需求 → 2. 戰略審查              | `draft_features.md` 版本號已更新，AC 完整；含 `existing_solution_hint`（feature/major_enhancement 時）                         |
| 2. 戰略審查 → 3. 設計              | `ADVICE_*.md` 已產出 + `ADVICE_RESPONSE_*.md` 三層分類完整；**無**未處理 🔴 高風險建議                                         |
| 3. 設計 → 3.5. Prior Art（條件式） | `RULES_DESIGN_GUIDE §十八.A C1/C2/C3` 任一觸發 → 進 3.5；否則跳 4                                                              |
| 3.5. Prior Art → 4. 測試規格       | User 已於 `PRIOR_ART_REPORT.md § User 驗證` 填結論（或明示 `verified_method: bypass` + 豁免記錄）                              |
| 3 / 3.5 → 4. 測試規格              | **`docs/api/<模組>_api.md` 已產**（@Architect Stage 3 完成）+ `TEST_SPEC_<功能>.md` 已產出（@QA 介入點一）+ TC 含執行者+優先級 |
| 4. 測試規格 → 5. 實作              | `TEST_SPEC` 通過 @Lead 形式檢查（依 `qa.md §s_output_strict_ref`）+ 無未處理 🔴 阻斷                                           |
| 5. 實作 → 6. 審查                  | PR/commit 已開；Agent DoD 自評完成（`backend.md §s09` / `frontend.md §s08`）                                                   |
| 6. 審查 → 6.5 平行資安（條件式）   | 若 SC 觸發（`security-audit.md §1` SC-01~10）→ 平行進 6.5；否則跳 7                                                            |
| 6 / 6.5 → 7. 驗證                  | `REVIEW_REPORT.md` 結論「✅ 通過」（必）+ `SECURITY_REPORT.md` 結論「✅ 通過」（SC 觸發時必）                                  |
| 7. 驗證 → 8. 收斂                  | `TEST_REPORT.md` 結論「✅ 通過」+ 達 `QA_RETEST_LIMIT` 內無未解 Bug                                                            |
| 8a. 收斂（@Architect）             | `docs/architecture.md` + `docs/modules/` 已更新；Mermaid 同步                                                                  |
| 8b. 收斂確認 → 9. 進化             | **User 確認 @Architect 收斂 Checklist ✅**（`planner.md §s08` 強制等待點）+ `PENDING_ACTIONS.md §🔴` 區塊為空                  |
| 9. 進化 → 結束                     | @Retro `PROPOSAL_*.md` 已產出（若觸發）；User 已收提示                                                                         |
| 結束 → 歸檔                        | active/ → completed/；INDEX 重生（`gen-proposal-index --write`）                                                               |

---

## 三、Gate Check 輸出格式

### 3.1 標準格式

```
✅ Gate Check 通過：<當前階段> → <下一階段>
確認條件：<對應 Gate 條件一句話>
下一步：呼叫 <@Agent> 執行 <階段名稱>
Ticket: ROUTING_TICKET.md（PROPOSAL_023 必填）
```

### 3.2 短指令版（對齊 §s_state_anchor）

```
✅ Gate Check ✔ S<當前>→S<下一>
Next: @<Agent> | Ticket: ROUTING_TICKET.md | Artifacts: <paths>
```

等 User 回覆「確認」後繼續派發。

---

## 四、Hotfix Gate Check（4 關鍵條件；PROPOSAL_021 強化）

PROPOSAL_20260423_003 + PROPOSAL_20260424_021 強化後：

1. `@Backend` 修復說明已產出，修改範圍已限縮（依 `hotfix-checklist Step 0` `hotfix_tier`）
2. `@Reviewer` 快速審查結論「通過」
3. `@QA` 核心路徑驗證通過，事後補文件已排入下一任務收斂階段
4. **若 SC 觸發** → `@Security` 平行審查通過（PROPOSAL_20260423_003）

**hotfix_tier 一致性檢查**（PROPOSAL_021）：派發訊息的 `Complexity-Tier` 必與 `hotfix-checklist Step 0` 的 `hotfix_tier` 完全一致。

---

## 五、Gate Check Auto-Audit 條款

@Lead 執行 Gate Check **前必須**：

1. **讀取**被派發 Agent 的 **DoD 自評回報**（格式依 `.agents/skills/templates/dod-audit-template.md`）
2. **確認**「通用核心」與「Agent 擴充」均為 **✅ 全數達成**
3. **任一項未達成** → **拒絕 Gate Check 通過**，退回 Agent 補齊
4. **全數達成** → **Append 一行**至 `docs/DoD_AUDIT_LOG.md`
5. **輸出**標準 Gate Check 短指令（依 §三.2）

此機制支撐 `@Auditor`（ADR-0005）定期統計 DoD 達成率（5 維度評分維度 5.2 自動化評測支柱）。

---

## 六、與 ROUTING_TICKET.md 整合（PROPOSAL_023）

- Gate Check 通過後 @Lead 寫 `ROUTING_TICKET.md` → 派發下一階段子 Agent
- ROUTING_TICKET schema 必含 `target_agent` / `complexity_tier` / `assigned_lane` / `model_tier` / `tech_stacks` / `touched_files` / `artifact_paths`
- 詳細規範：`skills/routing-ticket-protocol.md`
- **派發後** 子 Agent **首讀 ROUTING_TICKET.md**（依各子 agent §s01 派發接收鐵律）

---

## 七、禁止行為

- **絕對禁止** 跳過 DoD 自評讀取直接 Gate Check（依 ADR-0013）
- **絕對禁止** 任一 DoD 項未達成仍 Gate Check 通過（必退回補齊）
- **絕對禁止** Gate Check 後不寫 ROUTING_TICKET.md 即派發（PROPOSAL_023）
- **絕對禁止** Hotfix Gate 4 條件未全綠仍宣告完成
- **絕對禁止** SC 觸發但 @Security 未審就過 Hotfix Gate（PROPOSAL_20260423_003 鐵律）
- **絕對禁止** @Lead 重複驗證子 Agent 細節 DoD（職責邊界；屬越權）

---

## 八、關聯

- `rules/lead.md §s09` — 摘要 + 短指令格式 + 本 skill pointer
- `skills/templates/dod-audit-template.md` — DoD 自評格式
- `skills/routing-ticket-protocol.md` — ROUTING_TICKET schema（PROPOSAL_023）
- `skills/lead-orchestration-guide.md §五` — Hotfix 派發完整 SOP
- `tasks/hotfix-checklist.md` Step 0 — `hotfix_tier` 必填欄位（PROPOSAL_021）
- `docs/DoD_AUDIT_LOG.md` — Gate Check 歷史記錄（projects-scope 黑板節點）
- ADR-0005 — @Auditor 定期評分
- ADR-0013 — DoD Self-Audit + Gate Check Auto-Audit

---

**維護紀錄**：

- 2026-04-25：PROPOSAL_20260425_001 Phase C 建立（F1 類）
