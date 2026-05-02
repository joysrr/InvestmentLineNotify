---
adr_id: ADR-0001
title: Stateless @Lead Routing 三鐵律
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_001
  - PROPOSAL_20260422_016
referenced_by:
  - rules/lead.md §s_state_anchor
  - rules/assistant.md §巡邏機制
  - skills/stateless-routing-pattern.md
---

# ADR-0001: Stateless @Lead Routing 三鐵律

## Status

**Accepted** (2026-04-22)

## Context

LLM 對話跨 session 無狀態；@Lead 若自行「記憶」當前任務狀態或預測多步後續行為，跨 session 會 drift（不同 session 對同一情境產生不同判斷），導致工作流混亂。歷史觀察發現：無明確狀態錨點時，@Lead 易複製貼上 REVIEW/SECURITY_REPORT 原文進行文本合併，違反「僅傳遞狀態」的派發職責。

## Decision

@Lead 遵守三鐵律：

1. **強制狀態讀取**：每次對話第一動作讀取 `PENDING_ACTIONS.md §🎯` 的 `[CURRENT_STAGE]`；**絕對禁止**預測超過 1 步
2. **禁止文本合併**：僅 grep 符號（🔴 / ✅ / [BLOCKER]）判斷狀態，不讀報告原文；**絕對禁止**複製貼上 REVIEW/SECURITY_REPORT 內容
3. **短指令交接**：僅傳 `PROJECT_CONTEXT` 路徑 + Artifact Paths + ≤ 5 行下一步指令

違反處理：累積 ≥ 3 次違反 → 觸發全局緊急阻斷條件一（協調失敗）。

## Consequences

### 正面

- 跨 session 行為一致；drift_score 維持 ~0.95
- @Lead 職責聚焦「派發」而非「分析」
- 狀態錨點檔案（PENDING_ACTIONS.md）成為單一事實來源
- 為未來 LangGraph / 外部 orchestrator 遷移奠基

### 負面 / Tradeoffs

- 每次對話多 1 次 file read（PENDING_ACTIONS.md）
- 短指令要求降低了派發訊息豐富度；子 Agent 需自行透過 artifact paths 補上下文

## Alternatives Considered

### Alternative A: 允許 @Lead 自行記憶狀態

**為何不採用**：跨 session 無持久記憶；LLM 實際上無法可靠「記憶」→ 假象導致 drift。

### Alternative B: 每次對話重建完整上下文

**為何不採用**：token 成本過高；狀態錨點機制以最小成本達成相同效果。

## Related Proposals

- PROPOSAL_20260422_001（原始提案：@Lead 狀態錨點與無狀態路由限制）
- PROPOSAL_20260422_016（stateless-routing-pattern skill 外部化；token 優化）

## Referenced By

- `rules/lead.md` §s_state_anchor（三鐵律摘要 + Gate Check 格式）
- `rules/assistant.md` §巡邏（違反偵測機制）
- `skills/stateless-routing-pattern.md`（完整規範 + LangGraph 遷移對應）
- `rules/system-prompt.md` §全局緊急阻斷（條件一）

## Notes

- 本決策為**不可變**（immutable）；透過 section `priority="critical" immutable="true"` 標記
- 若未來遷移至 stateful orchestrator（如 LangGraph），三鐵律可簡化但不可廢除（因 LLM 本質仍無跨 session 記憶）
