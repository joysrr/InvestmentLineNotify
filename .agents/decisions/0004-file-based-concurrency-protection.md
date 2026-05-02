---
adr_id: ADR-0004
title: File-based 並行防護 + PM2 身份管理
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_010
referenced_by:
  - skills/concurrency-guard-pattern.md
  - skills/pm2-management.md
  - rules/backend.md
---

# ADR-0004: File-based 並行防護 + PM2 身份管理

## Status

**Accepted** (2026-04-22)

## Context

Node.js 單進程 + cron / PM2 生態下，多個行程可能同時寫入同一資料檔（如策略權重 / notification log），造成 race condition / 資料損毀。傳統解法（DB / Redis 鎖）對小型專案過重。需要純檔案系統的輕量並行防護模式。

## Decision

採用 **File-based 並行防護**：

1. **Lock 檔模式**：操作前建立 `<data>.lock` 檔（含 PID + timestamp）；結束刪除
2. **Stale lock 檢測**：超過 `LOCK_TIMEOUT` 視為死鎖；結合 PM2 process list 判斷 PID 是否存活
3. **PM2 身份**：以 PM2 `name` 作為 lock 持有者身份（跨 PM2 restart 仍可辨識）
4. **重試策略**：最多 3 次指數退避（100ms → 400ms → 1600ms）
5. **違規偵測**：`@Assistant` 巡邏 P-10 掃描 stale locks；`@Security` SC-08 併發原子性審查

具體實作規範見 `skills/concurrency-guard-pattern.md`。

## Consequences

### 正面

- 零外部依賴（無需 Redis / DB）
- PM2 重啟場景清晰處理
- 符合「小工具夠用」的架構精神
- Hotfix 時可快速排除死鎖

### 負面 / Tradeoffs

- 效能瓶頸：高併發（>10 進程）時 lock 檔 I/O 成本上升
- Lock 檔可能遺留於磁碟（stale detection 依賴時間戳判斷）
- 跨機器（若未來分散式）不適用；需遷移至 Redis 等

## Alternatives Considered

### Alternative A: Redis / Redlock

**為何不採用**：引入外部服務；本專案規模不需要。

### Alternative B: SQLite + transaction

**為何不採用**：引入 SQL 依賴；多數資料為 JSON 已存於檔案系統。

### Alternative C: 無鎖（依賴原子寫入 `rename`）

**為何不採用**：部分場景需多步驟交易（讀-改-寫）；單次 rename 不足。

## Related Proposals

- PROPOSAL_20260422_010（原始提案：File-based 並行防護 + PM2 身份）

## Referenced By

- `skills/concurrency-guard-pattern.md`（完整實作 pattern）
- `skills/pm2-management.md`（PM2 身份管理）
- `rules/backend.md`（並行場景 DoD）
- `@Security` SC-08 併發原子性審查項

## Notes

- Lock 檔放 `data/_locks/` 子目錄以便清理與 .gitignore
- 若未來遷移至分散式架構，需重新評估
