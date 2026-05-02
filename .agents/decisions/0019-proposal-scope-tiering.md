---
adr_id: ADR-0019
title: Proposal Scope 分層治理（framework vs project）
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_023
  - PROPOSAL_20260423_015
referenced_by:
  - RULES_DESIGN_GUIDE.SCOPE §十七
  - rules/retro.md §s06 Scope 判定 SOP
  - tests/proposal-scope-validator.mjs
  - proposals/PROPOSAL_INDEX.md
  - workspaces/*/proposals/PROPOSAL_INDEX.md
---

# ADR-0019: Proposal Scope 分層治理（framework vs project）

## Status

**Accepted** (2026-04-22；執行層強制於 2026-04-24 完成)

## Context

提案混雜「框架通用改善」與「專案特定調整」：

- 框架提案（如規則重構）為跨專案資產；搬運新專案時應保留
- 專案提案（如特定業務邏輯修補）僅該專案適用；搬運時應清除

若混儲同一目錄，搬運時需逐份判斷 scope，易誤留或誤清。

## Decision

建立 **二元分層 + 獨立儲存位置**：

| Scope       | 儲存位置                                                           | 編號格式                         | 搬運處置 |
| ----------- | ------------------------------------------------------------------ | -------------------------------- | -------- |
| `framework` | `.agents/proposals/{active,completed,archived}/`                   | `PROPOSAL_YYYYMMDD_NNN`          | ✅ 帶走  |
| `project`   | `.agents/workspaces/<name>/proposals/{active,completed,archived}/` | `<PREFIX>_PROPOSAL_YYYYMMDD_NNN` | ❌ 清除  |

**判定 3 步機械化流程**：

1. 列出所有修改檔案路徑
2. 取 path prefix 分類：
   - `.agents/` 下（排除 `workspaces/<project>.md` 實值）→ framework
   - `src/` / `data/` / `docs/` / `workspaces/<project>.md` 實值 → project
3. 跨兩類 → **強制拆為 2 份獨立提案**（禁止混合）

**機械性強制**：`tests/proposal-scope-validator.mjs` 掃描：

- `.agents/proposals/` 下所有 frontmatter `scope: framework`
- `workspaces/*/proposals/` 下所有 `scope: project`
- 違規 exit 1（阻斷 commit）

**Generator 雙區支援**：`gen-proposal-index.mjs --workspace <name>` 獨立掃 project 提案區。

## Consequences

### 正面

- 搬運新專案機械化（framework 帶 / project 清）
- 提案編號空間獨立（跨 scope 不衝突）
- scope 設計從「設計先行」升級為「執行層強制」
- 與 ADR-0015/0016/0017 構成完整跨專案純淨體系

### 負面 / Tradeoffs

- 提案撰寫前需判定 scope（多一個心智步驟）
- 跨 scope 提案需拆分（看似單一變更 → 實為雙份）
- workspace 獨立 PROPOSAL_INDEX 需維護（generator 支援）

## Alternatives Considered

### Alternative A: 單一儲存 + frontmatter 標記

**為何不採用**：搬運時仍需逐份讀 frontmatter；機械化優勢失去。

### Alternative B: 合併 scope（一律 framework）

**為何不採用**：專案特定提案會污染 framework 歷史；搬運負擔。

## Related Proposals

- PROPOSAL_20260422_023（原始提案：scope 分層治理；設計先行）
- PROPOSAL_20260423_015（執行層強制：validator + 雙區 generator + 歷史摘要）

## Referenced By

- `RULES_DESIGN_GUIDE.SCOPE §十七`（完整規範）
- `rules/retro.md §s06 Scope 判定 SOP`
- `tests/proposal-scope-validator.mjs`（run-all.sh 第 11 個）
- `proposals/PROPOSAL_INDEX.md`（framework 索引）
- `workspaces/<project>/proposals/PROPOSAL_INDEX.md`（project 索引）

## Notes

- 當前 framework proposals: 71（含 016）；project proposals: 0（機制就位待用）
- 歷史 68 份完成稽核：全 `scope: framework` 正確
