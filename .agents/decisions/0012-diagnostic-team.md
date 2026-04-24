---
adr_id: ADR-0012
title: 診斷組機制（D1-D4 條件式雙眼診斷）
status: Accepted
date: 2026-04-23
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_003
referenced_by:
  - skills/diagnostic-playbook.md
  - tasks/emergency-shutdown-playbook.md §3.2.B Step 1
  - RULES_DESIGN_GUIDE.QUALITY §十九.B
---

# ADR-0012: 診斷組機制（D1-D4 條件式雙眼診斷）

## Status

**Accepted** (2026-04-23)

## Context

Hotfix 事故診斷若由單一 Agent（@Backend 或 @Frontend）執行，複雜事故易有**單點盲點**（同一開發者原本可能遺漏的邏輯，修復時仍可能遺漏）。需要「雙眼診斷」機制，但不是所有事故都需要（避免過度）。

## Decision

定義 **D1-D4 四項觸發條件**；任一觸發 → 組「診斷組」（實作者 + @Reviewer 雙眼）：

| D | 觸發條件 | 邏輯 |
|---|---------|------|
| **D1** | 跨 ≥ 2 模組 | 單人難掌握跨模組互動 |
| **D2** | 疑似 race condition / memory leak | 非線性 bug；需多視角 |
| **D3** | 24h 內同模組第 2 次 Hotfix | 前次修復可能未達根因；需補漏 |
| **D4** | User 明示「複雜」/「跨層」 | User 經驗判斷 |

**診斷組成員**：`@Backend` 或 `@Frontend`（實作者）+ `@Reviewer`（第二視角）

**五步 SOP**（`skills/diagnostic-playbook.md`）：
1. 收集現象（錯誤訊息 / 日誌 / 重現步驟）
2. 最小重現
3. 二分法定位（git log / git bisect）
4. 根因假設驗證（**≥ 2 假設** + 證據比對）
5. 影響範圍評估（同樣根因是否在其他模組 / 是否 SC 敏感）

**產出**：`docs/plans/diagnosis/<事故名稱>.md`；診斷組**雙簽**（實作者 + @Reviewer）。

## Consequences

### 正面

- 複雜 Hotfix 單點盲點降低
- 機械觸發（D1-D4 明確）避免主觀漏組
- 雙簽機制提供審計軌跡
- D3 觸發暗示根因未達 → 自動帶入 @Retro queue

### 負面 / Tradeoffs

- 診斷組組成本（@Reviewer 介入時間）
- D4 主觀（User 判定「複雜」）
- 診斷組 vs @Security 仍可能有職責交錯（見 ADR-0010 衝突仲裁）

## Alternatives Considered

### Alternative A: 所有 Hotfix 都組診斷組

**為何不採用**：簡單事故過度；違反 ADR-0008 light 路徑設計。

### Alternative B: 完全由 @Lead 判斷

**為何不採用**：主觀；違反機械化原則。

## Related Proposals

- PROPOSAL_20260423_003（原始提案：Hotfix 三支柱之診斷組）

## Referenced By

- `skills/diagnostic-playbook.md`（五步 SOP）
- `tasks/emergency-shutdown-playbook.md §3.2.B Step 1`（heavy 路徑）
- `RULES_DESIGN_GUIDE.QUALITY §十九.B`（D1-D4 規範）
- `tasks/hotfix-checklist.md`（Step 0 D 評估）

## Notes

- 與 ADR-0011（SC 條件式介入）共同構成 Hotfix heavy 路徑的「三支柱」完整機制
- D3 觸發後 @Retro 根因分析為 `force_complex_scenarios`（必 opus + heavy）
