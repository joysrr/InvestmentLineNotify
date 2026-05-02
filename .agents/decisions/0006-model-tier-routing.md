---
adr_id: ADR-0006
title: 模型分層路由（haiku/sonnet/opus）
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_024
referenced_by:
  - rules/lead.md §s_complexity_lane
  - SYSTEM_THRESHOLDS.yaml MODEL_ROUTING
  - skills/lead-dispatch-patterns.md
---

# ADR-0006: 模型分層路由（haiku/sonnet/opus）

## Status

**Accepted** (2026-04-22)

## Context

Claude 家族三檔模型（haiku / sonnet / opus）成本與能力差距顯著（~1:3:15）。若所有任務一律用 opus → 成本爆炸；若一律用 haiku → 複雜任務失敗。需要依任務**真實複雜度**自動路由到合適模型。

## Decision

建立 **三步複雜度評估** → 模型選擇規則：

1. **估算 input tokens**（子 Agent prompt + workspace 欄位 + tech-stacks 引用）
2. **判定推理層數**（單檔修改 = 1；跨檔重構 = 3+；新架構設計 = 4+）
3. **計算 artifact paths 數**（本次任務涉及讀寫的檔案數）

依 `SYSTEM_THRESHOLDS.yaml#complexity_thresholds` 對照分類：

| complexity | Model    |
| ---------- | -------- |
| simple     | `haiku`  |
| medium     | `sonnet` |
| complex    | `opus`   |

**強制升等場景**（`force_complex_scenarios`）：不論評估結果，以下任務強制 `opus`：

- `strategyWeight` 異動評估
- 資安審查（任何 `@Security` 任務）
- Hotfix 緊急通道（heavy 路徑）
- 提案根因分析（`@Retro`）
- 定期 5 維度評分（`@Auditor`）

派發訊息格式必含 `Model:` 欄位。

## Consequences

### 正面

- 成本可控；大量 simple 任務由 haiku 處理
- 複雜決策保證 opus 品質（強制升等場景）
- 客觀評估取代「憑感覺」選模型
- 派發訊息明文化（可審計）

### 負面 / Tradeoffs

- 評估 3 步驟本身是 LLM 工作（需 @Lead 自行判斷）
- complexity_thresholds 為經驗值；需定期校準
- haiku 有時能力不足需中途升等 → 有額外成本

## Alternatives Considered

### Alternative A: 一律用 sonnet（折衷）

**為何不採用**：浪費 opus 的必要性 + haiku 的成本優勢。

### Alternative B: 成本優先（一律 haiku，失敗才升）

**為何不採用**：失敗後重跑成本比升等高；且部分任務（如資安）不可試錯。

## Related Proposals

- PROPOSAL_20260422_024（原始提案：模型分層路由解 P-15）

## Referenced By

- `rules/lead.md §s_complexity_lane`（評估 + 派發規則）
- `SYSTEM_THRESHOLDS.yaml#MODEL_ROUTING`（門檻數值 SSOT）
- `skills/lead-dispatch-patterns.md §6`（派發範例）
- `@Assistant` 巡邏 P-19（缺 `Model:` 欄位偵測）

## Notes

- 與 ADR-0007（Lane Routing）協同：同一 complexity 評估產兩個決策（model × lane）
- `force_complex_scenarios` 清單擴充需提 Lite Proposal
