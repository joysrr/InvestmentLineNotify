---
adr_id: ADR-0005
title: @Auditor 定期 5 維度評分機制
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_008
  - PROPOSAL_20260422_027
  - PROPOSAL_20260422_031
referenced_by:
  - rules/auditor.md
  - rules/retro.md §定期 Judge 派遣
  - skills/auditor-rubric-prompts.md
  - tasks/audit-retro-coordination.md
---

# ADR-0005: @Auditor 定期 5 維度評分機制

## Status

**Accepted** (2026-04-22)

## Context

`@Retro` 負責**內視**（根因分析 + 提案改善）；但缺乏**外視**（系統品質量化評分 + 趨勢監控）機制。歷史 rules 演進快速時，缺乏客觀指標判斷「框架整體健康度是否下降」。需要獨立第三方 Agent 執行定期評分，產出可追蹤數據。

## Decision

新增 `@Auditor` Agent（框架 13 Agent 之一）：

1. **5 維度評分**（各維度 15 細項；1-5 分）：
   - D1：架構設計（模組化 / 邊界清晰 / 耦合度）
   - D2：功能正確性（DoD 落實 / scope 管理 / 規則一致性）
   - D3：效能（token 預算 / 執行延遲 / I/O 成本）
   - D4：安全性（SC-01~10 覆蓋 / 密鑰管理 / 授權邊界）
   - D5：測試覆蓋（validator / 單元測試 / 整合測試）

2. **觸發頻率**：每 `AUDIT_INTERVAL`（預設 10 工作對話）自動派遣

3. **低分警示**：任一維度 < 3.0 → 🟡 `AUDIT_QUALITY` 通知 `@Retro` 提案改善

4. **協作流程**：`@Retro` 走 `tasks/audit-retro-coordination.md` 5 步驟接手（不手動派遣避免重複）

5. **Prompt Fragment**：5 × 15 = 75 題評分 Prompt 外部化至 `skills/auditor-rubric-prompts.md`（token 優化）

## Consequences

### 正面

- 外視 / 內視雙軌：Auditor 量化 + Retro 定性
- 趨勢可追蹤（AUDIT_HISTORY.md）
- 低分維度自動觸發改善循環
- 新 Agent 加入不壓縮既有 Agent token 預算（外部化 prompt）

### 負面 / Tradeoffs

- 新增 1 個 Agent（13 Agents 生態）
- 評分標準需持續校準（初期主觀性較高）
- `AUDIT_INTERVAL` 10 對話為經驗值；可能需調整

## Alternatives Considered

### Alternative A: 讓 @Retro 兼任量化評分

**為何不採用**：違反「內視 / 外視互斥」設計；Retro 已負擔重。

### Alternative B: 手動每月 review

**為何不採用**：難維持紀律；錯過介入時機。

## Related Proposals

- PROPOSAL_20260422_008（原始提案：@Auditor + 定期評分）
- PROPOSAL_20260422_027（Judge Fragment 完整性驗證；16→18 fragments）
- PROPOSAL_20260422_031（audit-retro-coordination SOP）

## Referenced By

- `rules/auditor.md`（Agent 定義）
- `rules/retro.md §定期 Judge 派遣`（雙軌協作）
- `skills/auditor-rubric-prompts.md`（75 題 Prompt Fragment）
- `tasks/audit-retro-coordination.md`（5 步協作 SOP）

## Notes

- 當前 drift_score baseline 0.957 即為 Auditor 機制產出
- 未來可擴充至 6+ 維度（如可觀測性 / 可搬運性）
