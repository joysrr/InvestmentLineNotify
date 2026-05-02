---
adr_id: ADR-0036
title: Rule Decomposition Patterns — Rules slim-down 至 token budget 的可重複模式
status: Accepted
date: 2026-05-01
supersedes: []
superseded_by: []
extends: [ADR-0022, ADR-0018]
related_proposals:
  - PROPOSAL_20260501_001
  - PROPOSAL_20260430_002 # 第一階段執行（Memory Palace + 13 rules -38%）
  - PROPOSAL_20260423_011 # RULES_DESIGN_GUIDE 拆檔（先例）
referenced_by:
  - skills/rule-slim-down-playbook.md
  - rules/lead.md
---

# ADR-0036: Rule Decomposition Patterns

## Status

**Accepted** (2026-05-01)

## Context

PROPOSAL_20260430_002 完成第一階段 rules slim-down（13 rules total -38%）後，仍餘 12/13 rules 超 schema-validator 嚴格 budget（agent_rule=1000 / always_on=500）。第一階段以**直覺切割**為主（找最大段落抽出去），無系統化模式；繼續切下去會碰到「該抽什麼、不該抽什麼」的判斷困難。

PROPOSAL_20260501_001 採納時要求「ADR 必產」，目的是讓後續 11 個 rule 的瘦身工作可以**機械化套用**，並可外包給 subagent 並行執行（user 條件：「品質前提下可外包」）。

## Decision

訂定 4 個 rule decomposition pattern + 1 個量化決策矩陣。任何 rule slim-down 工作必依本 ADR 模式執行；違反者由 reviewer 退件。

### Pattern P-1: Reference Pull-up（細節下沉至 skill；rule 留 1-3 行入口）

**適用**：rule 內某 § 含 ≥ 5 行可離開現場的細節（list / 表格 / 多步流程）

**動作**：

1. 該細節整段移到對應 skill（已有則合併；無則新建 `skills/<agent>-<topic>.md`）
2. rule 內保留：
   - § 標題 + 1 行核心宣告（「**完整 X**：skills/Y.md §Z」）
   - 「絕對禁止」鐵律（不可下沉；屬規則本質）

**範例**：

```
原: §s_complexity_lane 24 行（含 force_complex_scenarios 列舉 + 派發訊息 5 欄位範例）
後: §s_complexity_lane 8 行（保留決策表 + 鐵律 + ref → skills/lead-orchestration-guide §二）
```

### Pattern P-2: Skeleton/Flesh Split（骨架/血肉分離）

**適用**：整個 rule 含 ≥ 30% 重複「為何如此設計」「歷史脈絡」「範例對話」段落

**動作**：

1. 「Why」段落 → 移至對應 ADR Note 段
2. 「歷史脈絡」 → 移至 `memory/Strategy_Context_Room.md`
3. 「範例對話」 → 移至 `skills/<agent>-examples.md`
4. rule 只保留：身份 / 行為準則 / 鐵律 / 派發 / 邊界

**禁區**：rule 必須**自足**（讀完能執行任務）；測試方法 = 假設讀者沒讀任何 skill。若拆完 rule 自足性破壞 → 該段視為**骨架**保留。

### Pattern P-3: Iron Rule Compression（鐵律壓縮）

**適用**：rule 含「絕對禁止」/「鐵律」清單長 ≥ 5 條

**動作**：

1. 表格化（Code Type | Trigger | Penalty）
2. 重複前綴消除（「絕對禁止 X」「絕對禁止 Y」→ 表 Type=禁止 / Action=X|Y）
3. 同質鐵律合併（例：3 個「禁止跳階段」合 1 個「禁止跳非條件式階段」+ 細項）

**禁區**：immutable section 的鐵律**保持原文**，僅做表格化（不刪不改詞）；違反者由 schema-validator 偵測 immutable section diff。

### Pattern P-4: Cross-Reference Deduplication（重複 ref 去重）

**適用**：rule 內 `對齊 decisions/0XXX-...` / `見 RULES_DESIGN_GUIDE §X` 出現 ≥ 3 次

**動作**：

1. 散落 ref 收斂至 footer §Related Decisions（已存）
2. inline ref 改用簡短形式（`ADR-0010`；不重複完整路徑）
3. 跨 § 重複的 skill ref → 在 §s01 統一聲明 owner skill

**禁區**：critical / immutable section 的 inline ref 保留（讀者必須在現場知道依據）。

---

## Decomposition Decision Matrix

決策由「該段內容性質」決定，非「該段長度」：

| 段落性質                   | Pattern  | 流向                         |
| -------------------------- | -------- | ---------------------------- |
| 流程細節（步驟 / SOP）     | P-1      | skill                        |
| 範例對話 / 完整 YAML       | P-2      | skill 或 examples            |
| 「為何如此設計」說明       | P-2      | ADR Note                     |
| 歷史脈絡（曾經 X，後改 Y） | P-2      | memory/Strategy_Context_Room |
| 失敗教訓                   | P-2      | memory/Debug_Graveyard_Room  |
| 鐵律清單 ≥ 5 條            | P-3      | rule 內表格化                |
| 重複 ref ≥ 3 次            | P-4      | footer 收斂                  |
| 身份宣告 / 邊界 / 鐵律本身 | **保留** | rule（骨架）                 |

## Self-Sufficiency Test（rule 拆完後驗收）

每 rule slim-down 後必通過：

1. **靜態**：
   - schema-validator: 0 warnings（token ≤ budget）
   - rule-token-budget: 0 warnings（token < warn=3000）
   - ref-validator: 所有新 ref 可解
2. **動態**（手動執行）：
   - **自足性測試**：要求新 LLM session 只注入此 rule（不讀 skill / ADR）→ 能否完成本 rule 描述的任務？若否 → 該被抽走的段落原來是**骨架**，回填
   - **drift 測試**：`agent-drift-simulator` drift_score ≥ 0.85（不退化現值）
3. **內容**：
   - immutable section 文字未被改（diff 比對）
   - 「絕對禁止」總條數不減（表格化但不刪）

## Alternatives Considered

| 替代                           | 為何不採                                                                   |
| ------------------------------ | -------------------------------------------------------------------------- |
| **直覺切割（無 pattern）**     | PROPOSAL_20260430_002 第一階段做法；第二階段仍超 budget；無法外包 subagent |
| **以行數切（每 rule ≤ X 行）** | 行數不等於 token；中文行短英文行長；指標失真                               |
| **完全外包（無 ADR pattern）** | 沒有共同決策框架，subagent 各自切法 → 後續維護災難                         |
| **放寬 budget（warn=3000）**   | 違背 PROPOSAL_20260501_001 採納決定（門檻不調整）                          |

## Consequences

### Positive

- subagent 並行可行（每 agent 執行單一 rule + 套 4 patterns + 自驗收）
- 拆檔結果**可解釋**（ADR 是唯一 source of truth）
- 未來新 rule 加入時遵循同 pattern，不需重新討論

### Negative / Trade-offs

- ADR 必讀：subagent 工作前必先讀本 ADR + playbook（增加每次任務 ~1500 token 注入）
- Pattern 偏剛性：可能存在邊角情境不適用 → 用 §例外處理（frontmatter `token_budget_exception: true`）

## Validation

- 首次套用：lead.md（PROPOSAL_20260501_001 Phase A）
- 量測：lead.md 2363 → ≤ 1000 token；drift_score 不退化
- 後續：subagent 執行 11 rules 並行；本 ADR 為共同設計準則

## Notes

- 與 ADR-0022（rules frontmatter）相容：本 ADR 規範 rule **內容**結構；frontmatter 結構維持 ADR-0022
- 與 ADR-0018（RULES_DESIGN_GUIDE 拆檔）為同源精神：套至 rules 層
- skills/rule-slim-down-playbook.md 為本 ADR 的執行手冊；subagent 必讀
