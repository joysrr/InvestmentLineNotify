---
task_id: auditor-dispatch-checklist
file_type: checklist
owner: @Auditor
version: v1.1
last_modified: 2026-05-04
last_proposal: PROPOSAL_20260502_021
purpose: |
  @Auditor 5 維度評估 DoD 檢核表（mode-aware：serial 通用；parallel Claude Code opt-in）
referenced_by:
  - rules/auditor.md
---

# Task: Auditor Dispatch Checklist (@Auditor 評估檢核表)

> **PROPOSAL_502_021 Sprint A-2** harness-neutral 改寫：5 維度評估 mode-aware；serial 通用，parallel opt-in。

## 評估前 DoD（每維度共用；serial / parallel 皆適用）

- [ ] **Prompt Fragment 已完整貼入**：對應維度的 3~4 份 Fragment 從 `skills/auditor-rubric-prompts.md` **完整複製**到 prompt（非「依手冊」模糊語句）
- [ ] **評分標準明文列出**：每個細項的 1~5 分標準在 prompt 明文列出
- [ ] **baseline 比對要求**：若 `AUDIT_HISTORY.md` 存在前次記錄，prompt 含 baseline 比對指令
- [ ] **輸出格式固定**：JSON（scores / rationales / baseline_comparison）+ 每項 rationale ≥ 100 字
- [ ] **讀取範圍明確**：prompt 明文列出必讀的檔案清單
- [ ] **絕對路徑強制**：所有檔案引用必用 **repo-root 前綴的絕對路徑**（如 `.agents/docs/Reports/AUDIT_HISTORY.md`）；**禁止裸檔名**

## Mode 選擇

| Mode                  | 適用                                                              | 機制                                                                                 |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **serial（default）** | 所有 harness（Claude Code Web / Antigravity / Qwen / 自建）       | @Auditor 同對話內依序處理 5 維度；每維度走完評估前 DoD；產 1 份 JSON；全部收齊後整合 |
| parallel（opt-in）    | Claude Code CLI（`platform-detect` 偵測 sub-agent dispatch 可用） | @Lead 派 5 並行 sub-agent；每個處理 1 維度；最後整合                                 |

> **harness-neutral 原則**：serial 是 baseline；parallel 是優化。任務 DoD 在兩 mode 下完全等價。

## 評估後彙整 DoD

- [ ] 5 份 JSON 全部收到（serial 5 輪 / parallel 5 sub-agent）
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
