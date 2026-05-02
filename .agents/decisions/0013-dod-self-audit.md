---
adr_id: ADR-0013
title: DoD 自評框架 + Gate Check Auto-Audit
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260421_012
  - PROPOSAL_20260422_012
referenced_by:
  - skills/templates/dod-audit-template.md
  - rules/lead.md §s09 Gate Check
  - rules/qa.md / backend.md / frontend.md
---

# ADR-0013: DoD 自評框架 + Gate Check Auto-Audit

## Status

**Accepted** (2026-04-22)

## Context

Definition of Done（DoD）依各 Agent 職責不同而異（如 @Backend 需測試通過 + 型別正確 + 無 Memory Leak；@Frontend 需 UI 可用 + 無 console warning）。初版無統一自評機制，各 Agent 標注「完成」時品質參差。Gate Check 需客觀依據。

## Decision

建立 **DoD 自評框架** + **Gate Check Auto-Audit** 雙層：

1. **DoD Checklist 模板**（`skills/templates/dod-audit-template.md`）：
   - 每個 Agent 的 rules 含 §DoD 章節
   - 執行任務結束時必填 self-audit（每項✅/❌ + 理由）
   - 產出 `DoD_AUDIT.md` 附於 artifact

2. **Gate Check Auto-Audit**：
   - @Lead 收到子 Agent 回報時，依 `SYSTEM_THRESHOLDS.yaml#LANE_ROUTING.gate_matrix` 確認 Gate 項完成
   - 未達 Gate 自動退回；不進入下一階段
   - standard/heavy 車道強制 Auto-Audit；fast 車道略過（符合 ADR-0007 分級）

3. **質化 vs 機械化邊界**：
   - 機械化：測試通過 / 型別正確 / Token 預算 / validator exit code
   - 質化（保留 LLM 判斷）：可讀性 / 架構合理性 / 文檔完整度

## Consequences

### 正面

- DoD 標準化（跨 Agent 一致）
- Gate Check 客觀（退回有依據）
- 審計軌跡（DoD_AUDIT.md 永久保留）
- fast 車道豁免避免過度 overhead

### 負面 / Tradeoffs

- 每次任務多一份產出物（DoD_AUDIT.md）
- DoD Checklist 維護成本（每個 Agent rules 需 §DoD）
- 質化項目仍有主觀性（非完全機械化）

## Alternatives Considered

### Alternative A: 無自評（單純靠 @Reviewer）

**為何不採用**：@Reviewer 負擔重；DoD 屬執行者自評責任。

### Alternative B: 完全機械化（所有項目都自動驗證）

**為何不採用**：可讀性 / 架構等無法量化；保留 LLM 判斷空間。

## Related Proposals

- PROPOSAL_20260421_012（DoD 自評機制補充）
- PROPOSAL_20260422_012（DoD 統一化 + Gate Check Auto-Audit）

## Referenced By

- `skills/templates/dod-audit-template.md`（統一模板）
- `rules/lead.md §s09 Gate Check`
- `rules/qa.md` / `backend.md` / `frontend.md`（各自 DoD 章節）
- `SYSTEM_THRESHOLDS.yaml#LANE_ROUTING.gate_matrix`

## Notes

- 與 ADR-0007（Lane Routing）協同：不同 Lane 觸發不同 Gate 深度
- 未來可擴充至 per-Agent validator（現由 periodic-design-review §7 追蹤）
