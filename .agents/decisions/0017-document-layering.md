---
adr_id: ADR-0017
title: 文件分層三原則（.agents/docs/ vs docs/）
status: Accepted
date: 2026-04-23
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_004
referenced_by:
  - RULES_DESIGN_GUIDE.SCOPE §二十
  - tests/docs-location-validator.mjs
  - .agents/docs/README.md
---

# ADR-0017: 文件分層三原則（.agents/docs/ vs docs/）

## Status

**Accepted** (2026-04-23)

## Context

歷史上 `docs/` 混雜三類內容：

1. **框架通用說明**（如 agents-overview 概觀）→ 本應跨專案
2. **運作紀錄**（如 AUDIT_HISTORY / 決策日誌）→ 專案特有
3. **專案業務文件**（如需求規格 / 部署指南）→ 專案特有

三者混放導致搬運新專案時需人工逐檔判斷，易污染跨專案資產。

## Decision

建立 **位置層級三原則**（與 ADR-0015/0016 的內容層級互補）：

| 類別                     | 位置            | 用途                                                                        | 搬運處置 |
| ------------------------ | --------------- | --------------------------------------------------------------------------- | -------- |
| **類別 A**：框架通用說明 | `.agents/docs/` | agents-overview / quality-audit-checklist / quality-audit-automation-manual | ✅ 帶走  |
| **類別 B**：運作紀錄     | `docs/`         | AUDIT_HISTORY / AUDIT_DECISION_LOG / 專案進度紀錄                           | ❌ 不帶  |
| **類別 C**：專案業務文件 | `docs/`         | 需求 / 部署 / 業務規格                                                      | ❌ 不帶  |

**判定流程**：

1. 文件是否跨專案通用？
   - 是 → `.agents/docs/`
   - 否 → `docs/`

**違規偵測**（`tests/docs-location-validator.mjs`）：

- `docs/` 下含 framework 特徵（如「cross-project」「Agent 品質評鑑」）→ 🔴 應移至 `.agents/docs/`
- `.agents/docs/` 含專案特定命名（`InvestmentLineNotify` / 業務特定術語）→ 🟡 warn

## Consequences

### 正面

- 搬運新專案機械化（`.agents/` 全帶 / `docs/` 清除）
- 框架通用文件（如 agents-overview）不再被「看似專案相關」的檔名干擾
- 與 ADR-0015（tech-stacks）+ ADR-0016（F1/F2/F3）構成「位置 × 內容」雙軌純淨

### 負面 / Tradeoffs

- 需歷史清洗（PROPOSAL_004 執行已完成：3 份框架文件從 docs/ → .agents/docs/）
- 邊界案例（運作紀錄 vs 框架說明）偶需判斷
- validator 為啟發式偵測；需人工兜底

## Alternatives Considered

### Alternative A: 統一放 docs/（內容層區分）

**為何不採用**：搬運時仍需逐檔判斷；機械化優勢失去。

### Alternative B: 所有文件放 `.agents/`

**為何不採用**：運作紀錄本身是專案歷史；隨專案保留才合理。

## Related Proposals

- PROPOSAL_20260423_004（原始提案：文件分層三原則）

## Referenced By

- `RULES_DESIGN_GUIDE.SCOPE §二十`（完整規範）
- `tests/docs-location-validator.mjs`（3 規則偵測）
- `.agents/docs/README.md`（目錄說明）

## Notes

- 本 ADR 為 ADR-0018（RULES_DESIGN_GUIDE 拆檔）自我應用的指導原則
- 與 ADR-0015 / 0016 共同構成三軌純淨：tech-stacks 純淨 + skills/tasks F 分類 + 文件位置分層
