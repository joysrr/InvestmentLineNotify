---
task_id: auditor-dispatch-checklist
file_type: checklist
owner: @Auditor
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  @Auditor 子 Agent 派遣 DoD 檢核表（5 並行 Explore；補入 §s03 強制要求對照）
referenced_by:
  - rules/auditor.md
---

# Task: Auditor Dispatch Checklist (@Auditor 派遣檢核表)

## 派遣前 DoD

- [ ] **Prompt Fragment 已完整貼入**：對應維度的 3~4 份 Fragment 從 `skills/auditor-rubric-prompts.md` **完整複製**到派遣 prompt（非「依手冊」模糊語句）
- [ ] **評分標準明文列出**：每個細項的 1~5 分標準在派遣 prompt 明文列出
- [ ] **baseline 比對要求**：若 `AUDIT_HISTORY.md` 存在前次記錄，要求子 Agent 進行 baseline 比對
- [ ] **輸出格式固定**：JSON（scores / rationales / baseline_comparison）+ 每項 rationale ≥ 100 字
- [ ] **5 個並行派遣**：一維度一個子 Agent，使用 Explore 類型
- [ ] **讀取範圍明確**：派遣 prompt 中明文列出子 Agent 必讀的檔案清單
- [ ] **絕對路徑強制**（PROPOSAL_022）：所有檔案引用必用 **repo-root 前綴的絕對路徑**（如 `.agents/docs/Reports/AUDIT_HISTORY.md`）；**禁止裸檔名**（如僅寫 `AUDIT_HISTORY.md`）；外部化產物（`patrol-notification-catalog.md` / `lead-orchestration-guide.md` 等）須明文註記實際位置

## 派遣後彙整 DoD

- [ ] 5 份 JSON 全部收到
- [ ] 計算整體分數（5 維度平均）
- [ ] 識別任一維度 < 3.0 → 觸發 P-15 `AUDIT_QUALITY` 🟡
- [ ] 識別新風險項（對齊 R-編號系統）
- [ ] 依 `.agents/docs/Reports/AUDIT_HISTORY.md` 格式 append 一行
- [ ] 若觸發 P-15，通知 `@Lead` 由 `@Retro` 接手起草改善提案

## 禁止行為

- **絕對禁止** 以個人知識評分（必須基於 Prompt Fragment）
- **絕對禁止** 修改 `AUDIT_HISTORY.md` 歷史行（append-only）
- **絕對禁止** 越權起草改善提案（`@Retro` 專屬）

---

## Related Decisions

- [ADR-0005](../decisions/0005-auditor-periodic-scoring.md) — @Auditor 5 維度評分
