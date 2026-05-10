---
adr_id: ADR-0045
title: Design Audit Dimension（@Auditor 升級 5→6 維度；新增 Design Coherence）
status: Accepted
date: 2026-05-07
amends: [ADR-0005]
related_proposals: [PROPOSAL_20260502_048]
referenced_by:
  - rules/auditor.md
  - skills/auditor-design-audit.md
  - tasks/integration-walkthrough-protocol.md
---

# ADR-0045: Design Audit Dimension（dim 6 新建）

## Status

**Accepted** (2026-05-07)；amends ADR-0005（@Auditor 評分機制）

## Context

@Auditor 既有 5 維度評分機制（ADR-0005 + PROPOSAL_20260422_008 建立）：

- dim 1: Persona / 指令遵循 / Few-Shot / Token Economy
- dim 2: 模組化 / 可觀察性 / MCP 符合度 / Orchestration
- dim 3: 自我優化 / Cost Efficiency
- dim 4: HITL 干預 / 操作完備
- dim 5: 評分指令遵循度

**Round 1-6 simulation 揭露 5 dim 不覆蓋的盲點**：

- 條文-實作 drift（R5/R6 主訴；C-1 validator 處理）
- Schema gap（R5-3 hotfix_tier 5 輪累積；C-2 validator 處理）
- 跨 module 邏輯一致性（如 hotfix 鐵律 vs autonomy default 衝突）
- 設計意圖偏移（ADR vs 實際 framework 行為）
- Governance feedback loop 健康（P-38 觸發率 / KI 累積）

→ **既有 5 dim 偏行為層；新增 dim 6 Design Coherence 補設計層**。

## Decision

### dim 6: Design Coherence（5 子項；每項 1 分；總 5 分）

| 子項                              | 規則                                                                     | 評分依據                 |
| --------------------------------- | ------------------------------------------------------------------------ | ------------------------ |
| 6.1 條文-實作一致性               | 與 C-1 condition-claim validator 對齊（audit 視角；不只 mechanic）       | warn 數量 / drift 修補率 |
| 6.2 跨 module 邏輯一致            | hotfix 鐵律 vs autonomy default vs B-1 hint vs mempalace skip 等是否衝突 | 跨檔 grep 分析           |
| 6.3 設計意圖偏移                  | ADR 列舉的 Decision vs 實際 skill/rule 行為條文                          | random sample 5 ADR 對照 |
| 6.4 Schema completeness           | 與 C-2 validator 對齊；audit 視角                                        | warn 數量 / gap 修補率   |
| 6.5 Governance feedback loop 健康 | P-38 觸發率（LLM fallback 比例）/ KI 累積率 / Round walkthrough 收斂趨勢 | 數據 trend               |

### 跑頻

- **定期 audit**（既有觸發點；如 user 明示）+ **stabilization milestone 凍結前必跑**
- **Walkthrough 後**：integration-walkthrough-protocol Step 4 達凍結門檻 → 跑 dim 6 audit；通過才凍結
- 不每次 dispatch 跑（成本太高；audit 是定期非高頻）

### 評分結果處理

- dim 6 < 3.0 → P-15 🟡 AUDIT_QUALITY 升 dim 6 觸發
- dim 6 < 2.0 → 🔴 阻斷凍結 milestone（不可凍）
- 既有 dim 1-5 規則不變

## Consequences

### 正向

- 設計層問題納入定期 audit；不只靠 simulation rounds
- 凍結 milestone 有設計層門檻（不只機械層）
- @Auditor 升級為「行為 + 設計」雙視角

### 負向

- @Auditor 評分時間 +20%（5 dim → 6 dim）
- dim 6.3 random sample 主觀性高；需 LLM-based audit 輔助
- 既有 dim 1-5 評分歷史保留；dim 6 新建 baseline

### 中性

- ADR-0005 amend；既有 5 dim 不變；只加 dim 6
- AUDIT_HISTORY.md 表加 dim6 欄位（schema 演進）

## References

- ADR-0005（@Auditor 評分；amends）
- ADR-0044（Integration Walkthrough；協同）
- PROPOSAL_502_048（本 ADR 建立）
- skills/auditor-design-audit.md（評分 rubric 細則）
