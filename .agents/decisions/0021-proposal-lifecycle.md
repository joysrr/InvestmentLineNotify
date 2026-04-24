---
adr_id: ADR-0021
title: 提案生命週期（OPEN → IN_PROGRESS → DONE → ARCHIVED）
status: Accepted
date: 2026-04-21
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL-016
referenced_by:
  - rules/retro.md §s06 提案生命週期
  - proposals/{active,completed,archived}/
  - scripts/generators/gen-proposal-index.mjs
---

# ADR-0021: 提案生命週期（OPEN → IN_PROGRESS → DONE → ARCHIVED）

## Status

**Accepted** (2026-04-21)

## Context

提案從產出到歸檔需經歷多個狀態；若狀態不標準化，索引 / 審計 / 搬運時無法區分「當前待辦」vs「近期完成」vs「歷史歸檔」。早期僅有 OPEN/DONE 二元狀態，不足表達「已採納但執行中」「拒絕但保留」「廢棄佔位」等情境。

## Decision

建立 **六狀態 + 三目錄** 生命週期：

```
OPEN（待審）
  ├─ User 採納 → IN_PROGRESS（@Lead 執行中）
  │     ├─ @Lead 執行完成 → DONE（近期紀錄）
  │     │     └─ 超過 2 個審計週期 → ARCHIVED（歷史歸檔）
  │     └─ 逾時未完成 → ⚠️ 逾時標注
  └─ User 拒絕（附原因）→ REJECTED（永久保留，納入歷史比對計數）

任何階段可人工標記 CANCELLED（提案廢棄，保留編號佔位）
```

| 狀態 | 目錄 | 下一步 |
|------|------|--------|
| `OPEN` | `active/` | User 採納或拒絕 |
| `IN_PROGRESS` | `active/` | @Lead 完成後 → DONE |
| `DONE` | `completed/` | 超過 2 審計週期 → ARCHIVED |
| `CANCELLED` | `completed/` | 終態；編號佔位不可重用 |
| `ARCHIVED` | `archived/` | 終態 |
| `REJECTED` | `completed/` | 終態；納入再發計數 |

**User 採納指令格式**：
```
採納提案 PROPOSAL_YYYYMMDD_NNN
```

**User 拒絕指令格式**：
```
拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<一句話說明>
```

**編號佔位鐵律**：CANCELLED / REJECTED 編號**永久保留**，不可重用（避免歷史參照斷鏈）。

## Consequences

### 正面

- 狀態 / 目錄雙重標示，降低索引錯誤
- 反覆問題可透過 REJECTED 計數偵測
- ARCHIVED 後的審計軌跡仍可搜尋
- 與 ADR-0020（§🔗）協同記錄演進鏈

### 負面 / Tradeoffs

- 6 狀態需記憶（vs 簡單的 open/done 二態）
- `git mv` 於 active/ → completed/ / archived/ 為人工操作（可由 generator 輔助）
- CANCELLED 佔位可能令編號不連續

## Alternatives Considered

### Alternative A: 只用 frontmatter status 欄位

**為何不採用**：目錄隔離讓「當前工作區」vs「歷史」一目瞭然；物理隔離增強。

### Alternative B: 編號可重用（CANCELLED 釋放）

**為何不採用**：歷史引用可能指向已廢棄編號；需保留佔位。

## Related Proposals

- PROPOSAL-016（原始提案：提案目錄規模管理；生命週期雛形）

## Referenced By

- `rules/retro.md §s06`（完整規範）
- `proposals/{active,completed,archived}/`（物理目錄）
- `scripts/generators/gen-proposal-index.mjs`（狀態統計）

## Notes

- 與 ADR-0019（scope 分層）協同：6 狀態 × 2 scope（framework/project）各自有目錄
- 審計週期門檻 `PROPOSAL_UNARCHIVED_WARN` 見 RULES_DESIGN_GUIDE.QUALITY §十四
