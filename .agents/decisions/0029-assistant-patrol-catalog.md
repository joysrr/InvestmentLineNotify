---
adr_id: ADR-0029
title: @Assistant 巡邏規則目錄（P-01 ~ P-23）
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_004
  - PROPOSAL_20260422_028
  - PROPOSAL_20260422_029
  - PROPOSAL_20260422_030
  - PROPOSAL_20260423_008
  - PROPOSAL_20260423_015
referenced_by:
  - rules/assistant.md §巡邏
  - skills/patrol-notification-catalog.md
  - docs/agents-overview §4.2
---

# ADR-0029: @Assistant 巡邏規則目錄（P-01 ~ P-23）

## Status

**Accepted** (2026-04-22；持續擴充)

## Context

系統需要定期掃描狀態偏離 / 規則違反 / 超時等事件，但不適合由主要 workflow Agent（Lead/Backend/Frontend 等）負擔。`@Assistant` 作為 **AlwaysOn 層** 每次對話末執行巡邏，蒐集 🟡/🔴 通知後由 @Lead 處理。

## Decision

建立 **巡邏規則編號目錄**：

### 編號規則

`P-NN` 兩位數字；永久保留不可重用。當前 P-01 ~ P-23。

### 目錄結構（`skills/patrol-notification-catalog.md`）

| P-ID      | 名稱                       | 偵測條件                                         | 通知級別                     |
| --------- | -------------------------- | ------------------------------------------------ | ---------------------------- |
| P-01~P-08 | 初期基礎偵測               | REVIEW/QA/CONSULTANT 等相關                      | 🔴/🟡                        |
| P-10      | SECURITY_AUDIT_FAIL        | 資安審查失敗                                     | 🔴                           |
| P-11      | REVIEW_CYCLE_LIMIT 超限    | 複審次數超門檻                                   | 🔴                           |
| P-12      | WORKSPACE_MISSING          | workspace 未配置                                 | 🔴                           |
| P-14      | PROPOSAL_INTENT_REGRESSION | 設計意圖回退                                     | 🔴                           |
| P-15      | AUDIT_QUALITY              | 審計分數低                                       | 🟡                           |
| P-16~P-20 | 擴充偵測                   | 各類事件                                         | -                            |
| P-21      | HOTFIX_LIGHT_MISUSE        | light 路徑後 24h 內 SC 事故                      | 🟡                           |
| P-22      | LITE_OVERUSE               | Lite 提案 LOC > 50 或 phases > 2                 | 🟡                           |
| P-23      | TECH_STACK_AUDIT_OVERDUE   | workspace `last_audit_date` 過期（PROPOSAL_018） | 🟢（PROPOSAL_004 修正自 💡） |

（詳完整 P-XX 表見 `skills/patrol-notification-catalog.md`）

### 違規偵測流程

1. @Assistant 每次對話末執行巡邏
2. 掃相關檔案（PENDING_ACTIONS / proposals / AUDIT_HISTORY 等）
3. 發現匹配 P-XX 條件 → 產通知（🔴/🟡）
4. 寫入 PENDING_ACTIONS.md §通知
5. @Lead 下次對話處理（依通知分級；見 ADR-0030）

### 新 P-XX 擴充流程

1. @Retro 透過 RULE_UPDATE_PROPOSAL 新增
2. 更新 `skills/patrol-notification-catalog.md`
3. 更新 `rules/assistant.md §巡邏` 清單
4. 更新 `docs/agents-overview §4.2`

## Consequences

### 正面

- 主 workflow Agent 不需負擔偵測工作
- 巡邏規則可機械化測試（單元測試 per P-XX）
- 編號目錄提供統一命名空間
- 新偵測規則加入成本低（新增 P-XX）

### 負面 / Tradeoffs

- 巡邏週期非即時（每對話末）
- P-XX 增長（23 個；需 periodic-design-review §7 監控）
- 部分 P-XX 跨多提案（如 P-14 涉意圖繼承 ADR-0020）

## Alternatives Considered

### Alternative A: 即時偵測（每個操作都檢）

**為何不採用**：成本過高；多數偵測不需即時。

### Alternative B: 分散偵測（每 Agent 自己偵測）

**為何不採用**：職責混雜；@Assistant AlwaysOn 職責統一適合此任務。

## Related Proposals

- PROPOSAL_20260422_004（HCI 全局摘要機制）
- PROPOSAL_20260422_028（agents-overview 同步 validator；P-XX 清單對齊）
- PROPOSAL_20260422_029（!ref 自動驗證；ref-validator）
- PROPOSAL_20260422_030（examples 補充）
- PROPOSAL_20260423_008（run-all.sh 並行；觸發 P-XX 改善）
- PROPOSAL_20260423_015（P-XX 新增 SCOPE 驗證）

## Referenced By

- `rules/assistant.md §巡邏`
- `skills/patrol-notification-catalog.md`（完整 P-XX 清單）
- `docs/agents-overview §4.2`

## Notes

- 當前 P-XX 覆蓋：22 個（已達 periodic-design-review §7 警示維度 #5 門檻 25 近值）
- 若 P-XX > 25 → 評估合併重複偵測
- 與 ADR-0030（通知分級）協同：P-XX 觸發後依分級處理
