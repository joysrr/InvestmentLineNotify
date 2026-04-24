---
adr_id: ADR-0010
title: 平行審查制度（@Reviewer + @Security）
status: Accepted
date: 2026-04-21
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260421_020
referenced_by:
  - rules/reviewer.md
  - rules/security.md
  - rules/lead.md §s06
  - skills/security-audit.md
---

# ADR-0010: 平行審查制度（@Reviewer + @Security）

## Status

**Accepted** (2026-04-21)

## Context

`@Reviewer` 做白箱程式碼審查（邏輯 / 架構 / 可維護性），但資安領域需專門知識（Token 時效 / 金鑰管理 / 授權邊界 / 併發原子性）。初版設計由 @Reviewer 兼任資安審查，造成兩個問題：
- 資安細節漏失（@Reviewer 非資安專職）
- 審查週期拉長（序列審查）

## Decision

建立 **@Security** 獨立 Agent 執行第 6.5 平行審查：

1. **職責分離**：
   - `@Reviewer`：程式碼品質（Memory Leak / 架構錯誤 / 可讀性）
   - `@Security`：SC-01~10 十項資安審查（條件式介入 → 見 ADR-0011）

2. **平行執行**：第 6 Review 與 6.5 Security 並行 → 縮短週期

3. **衝突仲裁四層防線**：
   1. 職責互斥（@Reviewer 不看資安；@Security 不看架構）
   2. 範圍明確（SC-01~10 列表）
   3. 時間軸並行（平行不序列）
   4. 衝突 → @Lead 仲裁（以更嚴為準）

4. **複審上限**：`REVIEW_CYCLE_LIMIT`（預設 2 次）兩方共用；超過 → 🔴 升級 User

## Consequences

### 正面

- 資安審查品質提升（專職）
- 並行縮短審查週期
- 職責邊界清晰（跨 session 行為一致）
- @Security 可外部化至 SecOps 團隊（若有）

### 負面 / Tradeoffs

- 多一個 Agent（14 Agents 生態；當前實為 13 因 @Auditor/Security 各自獨立）
- 衝突仲裁需 @Lead 介入
- 複審上限共用計數需同步維護

## Alternatives Considered

### Alternative A: @Reviewer 兼任

**為何不採用**：資安細節漏失；非專職。

### Alternative B: 序列審查（Reviewer → Security）

**為何不採用**：週期拉長；資安失敗退回 Reviewer 重做成本高。

## Related Proposals

- PROPOSAL_20260421_020（原始提案：@Security + SC-XX + 系統參數單點配置）

## Referenced By

- `rules/reviewer.md`
- `rules/security.md`
- `rules/lead.md §s06`（平行審查規範）
- `skills/security-audit.md §1`（SC-01~10 對應審查範疇）

## Notes

- 與 ADR-0011（SC 條件式介入）共同定義 @Security 完整邊界
- Hotfix heavy 路徑（ADR-0008）亦採用此並行模式
