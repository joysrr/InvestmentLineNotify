---
adr_id: ADR-0038
title: Tier-based Rule Budget — Mutable budget 量化機制（meta / worker / orchestrator 三層）
status: Accepted
date: 2026-05-01
supersedes: []
superseded_by: []
extends: [ADR-0022, ADR-0036]
related_proposals:
  - PROPOSAL_20260501_003
  - PROPOSAL_20260501_002 # Iron Themes（解決 immutable；本 ADR 補完 mutable budget 第三軸）
  - PROPOSAL_20260501_001 # rule slim-down（exception flag 引入處）
referenced_by:
  - tests/schema-validator.mjs
  - tests/rule-token-budget-validator.mjs
  - rules/*.md # 全 13 rules 加 rule_category 欄位
---

# ADR-0038: Tier-based Rule Budget

## Status

**Accepted** (2026-05-01)

## Context

PROPOSAL_20260501_001 完成 13 rules slim-down 後，11 個 rules 仍超 schema-validator agent_rule budget=1000，靠 `token_budget_exception` flag 補。PROPOSAL_20260501_002（ADR-0037 Iron Themes）解決跨切 immutable 問題（架構面），但**mutable budget 量化問題仍在**。

### 三軸框架

PROPOSAL_002 評估後揭露 rules 治理需三軸正交：

| 軸              | 範圍                    | ADR        | 狀態                          |
| --------------- | ----------------------- | ---------- | ----------------------------- |
| Mutable 縮減    | rule 內容如何 slim-down | ADR-0036   | ✅                            |
| Immutable 治理  | 跨切不可變鐵律          | ADR-0037   | ✅                            |
| **Budget 量化** | rule 該佔多少 token     | **本 ADR** | **缺；exception flag 補位中** |

第 3 軸缺位導致：

- exception flag 是補丁（自由文字 reason；無強制 schema）
- worker（單一職能）vs orchestrator（跨 Agent 協調）密度不同但 budget 相同 1000；強行套用反映工程不現實
- exception 機制可被濫用（無治理）

### 與 ADR-0006 對偶

ADR-0006 模型分層（haiku / sonnet / opus）依複雜度分配運算資源。本 ADR 套同類概念於 rule context 資源分配。

## Decision

訂立 **rule_category** 維度（必填 frontmatter 欄位；3 層 enum）+ tier-based budget table。schema-validator + rule-token-budget-validator 改為 tier-aware；exception flag 機制廢止。

### 判定 5 原則（PROPOSAL_502_011 amend；任一滿足即 orchestrator；額外滿足 #5 升 central_orchestrator）

1. **Cross-Agent 派發職責**：rule 內含派發 / Gate Check / 收斂等多 Agent 協調動作
2. **多階段流程管理**：rule 規範 ≥ 3 個工作流階段或狀態流轉
3. **跨時序整合**：rule 跨多個工作對話 / Sprint 累積分析（如 retro 審計）
4. **Hub 性質**：成為其他 Agent 訊息流的中介點（如 PENDING_ACTIONS 集散）
5. **Central orchestrator 升等**（PROPOSAL_502_011）：**User-facing entry point** 同時聚合 **≥ 3 個其他 orchestrator iron-law 指針** → 升 `central_orchestrator` tier；否則保留 `orchestrator`

不滿足 1-4 任一 → **worker**（單一職能；單一 artifact 產出 / 單一審查維度）。

`file_type=always_on` 自動 **meta**；無例外。

### Tier Budget Table（PROPOSAL_502_011 amend；4 層）

| Category                   | warn     | block    | file_type      |
| -------------------------- | -------- | -------- | -------------- |
| `meta`                     | 500      | 1000     | always_on      |
| `worker`                   | 1500     | 2500     | agent_rule     |
| `orchestrator`             | 1800     | 3000     | agent_rule     |
| **`central_orchestrator`** | **2500** | **3500** | **agent_rule** |

### 13 Rules 分類（PROPOSAL_502_011 amend）

**meta（1）**：

- system-prompt（file_type=always_on）

**central_orchestrator（1；PROPOSAL_502_011 新類）**：

- lead（User 入口 + 聚合 5 orchestrator iron-laws：state-anchor / parallel-review / data-deletion-zero-tolerance / memory-palace / prior-art-verify；唯一符合準則 #5）

**orchestrator（4；lead 移出至 central_orchestrator）**：

- retro（跨時序審計 / 提案管理）
- assistant（PENDING_ACTIONS hub / 巡邏集散；非 User-facing entry point 不符 #5）
- qa（test spec + execution 雙介入點 / 多 Agent 整合測試）
- planner（Sprint 多狀態管理 / Prior Art Hint / 退件雙路徑）

**worker（7）**：

- architect（單一產出：API spec）
- backend（單一域：API + 排程）
- frontend（單一域：UI）
- reviewer（單一審查維度：程式碼品質）
- security（單一審查維度：SC-XX）
- consultant（單一產出：ADVICE）
- auditor（單一產出：5 維度評分）

### Frontmatter Schema 升級

```yaml
# rules/<agent>.md frontmatter 必填
agent_id: <id>
file_type: agent_rule|always_on
rule_category: meta|worker|orchestrator # 新欄位（必填）
# ...其他既有欄位
# 移除：token_budget_exception / exception_reason / exception_proposal /
#       exception_baseline / exception_target
```

### Validator 配套

#### schema-validator

- 讀 `rule_category`；無 → error（必填）
- 套對應 tier budget 比對 token estimate
- block budget 觸發 → error；warn budget 觸發 → warning（不阻斷）

#### rule-token-budget-validator

- 升級為 tier-aware；移除原有固定 warn=3000 / block=4000
- 對齊 schema-validator tier 值（單一 SoT）

## Alternatives Considered

| 方案                                                                                 | 為何不採                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **A: 維持 exception flag**（PROPOSAL_001 引入）                                      | 補丁機制；無治理；可被濫用；schema 雜訊                         |
| **B: 統一 budget 拉到 1500/2500**（不分 tier）                                       | 不反映 orchestrator vs worker 真實密度差；orchestrator 仍卡邊緣 |
| **C: 5 層 tier**（meta / worker-light / worker / orchestrator / orchestrator-heavy） | 過度設計；判定原則複雜；當前 13 rules 不需要                    |
| **D: Schema-validator 排除 immutable bytes**（PROPOSAL_002 v1 Option C）             | 已被 ADR-0037 取代（iron themes 已不計入 rule budget）          |
| **E: tier-based budget**（本決策）                                                   | 反映實際密度；judgment 4 原則明文；演化路徑清晰                 |

## Consequences

### Positive

- **exception flag 退場**：11 處 → 0；schema 純淨
- **真實密度反映**：orchestrator-class 自然容納 1800；不需藉口
- **與 ADR-0006 對偶**：3 層分類 mirrors 模型分層 mirrors 車道分層（haiku/sonnet/opus；fast/standard/heavy）
- **三軸完整**：ADR-0036（mutable 縮減）+ ADR-0037（immutable 治理）+ **本 ADR（budget 量化）**= 完整治理
- **演化路徑清晰**：未來新 rule 加入時只需判定 category；不需新提案

### Negative / Trade-offs

- **概念新增**：rule_category 是又一個維度（13 個欄位 → 14）
- **判定爭議**：邊角情境（如 qa 是 worker 還是 orchestrator？）需 4 原則判定；爭議 @Retro 仲裁
- **修改路徑**：rule_category 欄位變動需提案流程（commit-time validator 偵測；對齊 ADR-0022）
- **未來 5+ tier 風險**：若 framework 大幅成長，3 層可能不足；但目前夠用

### 與 ADR-0037 完全正交

| 軸          | ADR        | 對 rule budget 影響                                                |
| ----------- | ---------- | ------------------------------------------------------------------ |
| Iron Themes | ADR-0037   | rule budget 只算 mutable（theme 內容由 iron-theme-validator 另算） |
| Tier Budget | **本 ADR** | mutable budget 套 tier 值（meta/worker/orchestrator）              |

兩者結合：rule budget = 「mutable bytes」依「rule_category tier」判定。

## Validation

- 首次套用：PROPOSAL_20260501_003 Phase B-C
- 量測：schema-validator warning 11→0；rule-token-budget warning 0
- drift_score 不退化（baseline 0.883）

## Notes

- 本 ADR 終結 PROPOSAL_001 Phase A-G 引入的 11 個 `token_budget_exception` flag
- 與 ADR-0036（4 patterns）完全相容：4 patterns 仍是 mutable 縮減的執行手段；本 ADR 規範終點
- exception flag 機制完全廢止；rule_category 是強制欄位；所有未來 rules 必填
- 後續若 worker 自然漲到 1500+ → 重新評估 tier 值（lite 提案調整）；不再用 exception flag 補
