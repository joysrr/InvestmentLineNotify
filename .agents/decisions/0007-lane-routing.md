---
adr_id: ADR-0007
title: 多車道路由架構（fast/standard/heavy）
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_032
referenced_by:
  - rules/lead.md §s_complexity_lane
  - SYSTEM_THRESHOLDS.yaml LANE_ROUTING
  - tasks/lane-routing-task-classification.md
---

# ADR-0007: 多車道路由架構（fast/standard/heavy）

## Status

**Accepted** (2026-04-22)

## Context

同一任務 complexity 評估可能對應到不同**工作流嚴謹度**需求：簡單 typo 可直接實作，無需審查；但同為 "simple complexity" 的密鑰處理即使小修也需完整資安審查。需要**工作流維度**獨立於模型維度的路由決策。

## Decision

引入 **三車道（Lane）** 決策維度，與 Model 正交：

| Lane          | Gate Check 深度                           | 適用                                         |
| ------------- | ----------------------------------------- | -------------------------------------------- |
| 🏎️ `fast`     | 派發前風險評估 + Artifact Paths           | typo / 樣式 / 設定常數（符合 20 項安全指標） |
| 🚗 `standard` | + Auto-Audit DoD + @Reviewer              | 一般功能實作                                 |
| 🚚 `heavy`    | + @Security 平行 + @Consultant 戰略 + @QA | 複雜 / 資安 / 架構重組                       |

**車道 × Gate Check 矩陣** 由 `SYSTEM_THRESHOLDS.yaml#LANE_ROUTING.gate_matrix` 定義。

**20 項安全指標**（`tasks/lane-routing-task-classification.md`）：fast 車道需全綠燈；任一紅燈強制升級：

- 資安 / 環境變數 / 併發（#10-12）紅燈 → 強制 heavy
- 架構 / 資料 / 基礎設施（#1-9, 14-17）紅燈 → heavy
- Lifecycle（#13）紅燈 → heavy
- 輕度偏離（#18-20）→ standard

**降級防護網**：fast 執行中觸發 compile/test 錯誤或發現需動 20 項外檔案 → 自動升 standard/heavy。

## Consequences

### 正面

- 工作流彈性：同為 simple model 但可 fast 或 heavy
- 敏捷性（fast 跳過大部分 Gate）
- 資安兜底（force_complex 場景強制 heavy）
- 降級防護網避免 fast 車道失控

### 負面 / Tradeoffs

- Model × Lane 二元決策增加 @Lead 判斷負擔
- 20 項安全指標需定期更新（避免漏洞）
- 降級事後偵測（P-20）非即時

## Alternatives Considered

### Alternative A: 只有 Model 維度

**為何不採用**：同一 Model 不同工作流需求不同；二維更精確。

### Alternative B: 用 complexity 直接決定 Lane

**為何不採用**：資安場景即使 simple 也要 heavy；需二元評估。

## Related Proposals

- PROPOSAL_20260422_032（原始提案：多車道架構）

## Referenced By

- `rules/lead.md §s_complexity_lane`（派發規則）
- `SYSTEM_THRESHOLDS.yaml#LANE_ROUTING`（gate_matrix + auto_escalation）
- `tasks/lane-routing-task-classification.md`（20 項安全指標）
- `skills/lead-dispatch-patterns.md`（派發範例）

## Notes

- 與 ADR-0006（Model Tier）共用 complexity 評估；正交維度
- 與 ADR-0008（Hotfix Dual-Track）區別：Hotfix 是事故情境；Lane 是日常任務
