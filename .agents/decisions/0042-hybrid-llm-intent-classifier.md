---
adr_id: ADR-0042
title: Hybrid LLM Intent Classifier — closed-list 快車道 + LLM fallback + 結構訊號優先
status: Accepted
date: 2026-05-07
supersedes: []
superseded_by: []
amends: []
related_proposals:
  - PROPOSAL_20260502_044
  - PROPOSAL_20260502_041 # task_class detection 表（被本 ADR 重構）
  - PROPOSAL_20260502_042 # refactor-keyword heuristic（被本 ADR 補層 3 fallback）
referenced_by:
  - skills/lead-orchestration-guide.md §6.3.1
  - skills/code-graph-exploration.md §C.5
  - skills/routing-ticket-protocol.md §schema task_class_source
  - rules/lead.md §s_complexity_lane
---

# ADR-0042: Hybrid LLM Intent Classifier

## Status

**Accepted** (2026-05-07)

## Context

Round 3 simulation 報告（`docs/Reports/SIMULATION_GITNEXUS_MEMPALACE_R3_2026-05-07.md`）揭露 closed-list keyword paradigm 結構性 SPOF：

- task_class detection priority 4 中文清單缺「加/新增」additive 動詞 → 「在既有 endpoint 加 filter param」誤推 feature
- onboarding priority 1 closed-list miss 「弄成可以管理 / 整理一下」口語
- refactor-keyword 中文清單缺極口語「砍掉 / 混在一起 / 不對勁」
- path 白名單字面詞表 miss business-domain 命名（Acme.Accounting/）+ kebab-case 自定（bi-dashboard/）

**問題本質**：每補一個關鍵字 → user 又能想出 10 種同義表達。三輪模擬 GR 數量 48→32→33 不收斂；keyword grep 永遠追不上中文/口語/業務命名變體。

**user 決策**：選項 C Hybrid（closed-list 快車道 + LLM fallback + 結構訊號優先）。

## Decision

### 三層判定機制（順序短路；每 dispatch 最多走 1 層 LLM call）

```
判定 task_class / refactor-keyword 觸發 / cross-stack 等：

層 1：結構訊號優先（最高 priority；零 LLM 成本）
  - 無 .agents/CURRENT_WORKSPACE → 強制 task_class=onboarding
  - touched_files 全為新檔（git status -u "??") → 強烈傾向 feature
  - touched_files 含 git rename detection (git diff -M50%) → 強制觸發 refactor-keyword
  - 命中 → 直接決定；ROUTING_TICKET 寫 task_class_source: structural

層 2：closed-list keyword 快車道（中 priority；零 LLM 成本）
  - lead-orchestration-guide §6.3.1 priority 1-7 list（v7.14 既有）
  - code-graph-exploration §C.5 4+1 觸發條件（v7.15 既有）
  - 命中 → 直接決定；task_class_source: keyword

層 3：LLM-classifier fallback（layer 1+2 全 miss 時觸發）
  - @Lead 派發前呼叫 inline llm（haiku 等小型 model；單 call ~50ms + ~$0.0001）
  - prompt：「user 指令：<original_request>；touched_files：<list>。
     依下面 5 enum 決定 task_class：feature / modify-existing / hotfix / doc-sync / config-adjust / onboarding
     另判：是否 refactor 性質 (bool) / cross-stack 性質 (bool)」
  - 結果寫 ROUTING_TICKET frontmatter task_class_source: llm_classifier
  - LLM 仍模糊（confidence < 0.7）→ fallback feature + 標 intent_ambiguous: true 提示 user 確認
```

### 結構訊號（層 1）規則表

| 訊號                    | 條件                                                                                                                                                                                                                   | 強制決定                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------ |
| missing_workspace       | 無 `.agents/CURRENT_WORKSPACE`                                                                                                                                                                                         | task_class = onboarding              |
| all_new_files           | touched_files 全為新檔（`git status --porcelain                                                                                                                                                                        | grep "^??"`）                        | 強烈傾向 feature；validator 推 |
| git_rename_detected     | `git diff --diff-filter=R --find-renames=50%` 非空（**user 已執行 git mv 才命中；user 僅口頭講「rename」尚未 git mv → 此訊號 false 為正常**；落到層 2 priority 3 keyword「rename」命中；PROPOSAL_502_046 R5-6 修描述） | 強制 refactor-keyword 觸發           |
| existing_files_majority | touched_files 既有比例 ≥80% AND user 指令含「加 / 新增 / 補上」                                                                                                                                                        | 強烈傾向 modify-existing（解 R3-A1） |

### 層 3 LLM fallback 觸發條件

僅以下情境呼叫 LLM（避免每 dispatch 浪費 token）：

- 層 1 + 層 2 全 miss
- task_class 無法從 keyword 推得（fallback feature 但 user 意圖明顯非 feature）
- §C.5 refactor-keyword 全 miss 但 layer 1 git_rename_detected miss（非 git rename 但意圖 refactor）

### task_class_source 欄位（ROUTING_TICKET schema）

```yaml
task_class: feature | modify-existing | doc-sync | hotfix | config-adjust | onboarding
task_class_source: explicit | structural | keyword | llm_classifier | llm_failed_fallback # PROPOSAL_502_045 R4-A2 加 5th enum
intent_ambiguous: false # LLM confidence: low 或 unsure 字樣 → true 並提示 user 確認
task_class_source_evidence: <string> # PROPOSAL_502_045 R4-G optional；source=structural 時填觸發訊號名（missing_workspace/git_rename_detected/...）
```

### LLM Prompt 模板（PROPOSAL_502_045 R4-A1+A3 amendment v2）

**標準 prompt 模板**：

```
依下面指令推導：
- task_class（5 enum: feature / modify-existing / doc-sync / hotfix / config-adjust / onboarding）
- is_refactor（bool）
- is_cross_stack（bool）

User 指令：<original_request>
touched_files：<list>

請於回應結尾以 `confidence: <high|medium|low>` 結束（必填結構化欄位）。
若無法判定 → 任何欄位回答 "unsure" 並 confidence: low。
```

**parser 規則**：

- 抽 `confidence: <value>` regex `(?i)confidence:\s*(high|medium|low)`
- low 或回應含 unsure 同義詞（unsure / unclear / ambiguous / 不確定 / 看不出 / not sure / can't tell / hard to say）→ `intent_ambiguous: true` + fallback feature
- parser 失敗（無 confidence 欄位）→ 保守 `intent_ambiguous: true`

**LLM call 失敗（network / quota / 限流）fallback**（R4-A2）：

- task_class: feature（最保守 default）
- task_class_source: **llm_failed_fallback**（**非** llm_classifier；audit 區分 LLM 跑了但失敗 vs 真用 LLM 結果）
- intent_ambiguous: true（提示 user 確認）
- 不阻斷 dispatch；繼續走 feature 流程

## Consequences

### 正向

- **根治 R3-A 6 GR**：closed-list miss 由 LLM fallback 承接
- **Audit 完備**：task_class_source 可分析 keyword 命中率 / LLM 觸發率
- **效能可控**：層 1+2 短路；多數 dispatch 仍快車道（預估 80-90%）；僅 10-20% 走 LLM
- **Round 4 預估 GR**：< 15（顯著收斂）

### 負向 / 風險

- **LLM call 成本**：每 layer 3 dispatch +1 haiku call（~$0.0001 + ~50ms）；累積 100 dispatch/月 ≈ $0.01；可忽略
- **violates v7.0 Python-only milestone 邊界**：agent 呼 LLM 不算「自寫腳本」（屬框架運行時）；ADR-0040 milestone 約束自寫腳本，不擴及 agent 行為
- **新增 dependency**：需 `mcp` LLM 呼叫機制存在（Claude Code 內建；Qwen 同理）
- **fallback chain 複雜度**：3 層判定 + audit；agent 需理解 priority 短路邏輯

### 中性

- **task_class_source 欄位**：純 audit；不影響行為；validator 可選驗證
- **「LLM 信心 <0.7」**：需 LLM tool 支援 confidence；當前 mcp tools 多數不直接給 confidence；fallback 用「LLM 回 'unsure' 字樣」啟發式判定

## Alternatives Considered

1. **A: 接受 + KI 登記**（保守）
   - 優：低風險；不變架構；無 LLM 成本
   - 缺：framework 永遠對中文/口語/業務命名 fragile；user 撞到才補
   - **拒絕原因**：Round 3 顯示趨勢不收斂；patch 邊際效益遞減

2. **B: 完全 LLM-based intent classifier**（重大變更）
   - 優：根治 closed-list；最準
   - 缺：每 dispatch +1 LLM call；高 latency + 成本
   - **拒絕原因**：典型 keyword 場景不需 LLM；浪費

3. **C: Hybrid（本 ADR；推薦）**
   - 優：常見 keyword 仍快；極口語/business-domain 走 LLM；audit 完整
   - 缺：兩套機制需維護；複雜度上升
   - **採納**

## Compliance / Validation

- routing-ticket-validator 加 `task_class_source` enum 4 值驗證
- 不強制 audit_source（optional；不寫不 fail）
- LLM call 失敗 → fallback feature + intent_ambiguous: true（不阻斷 dispatch）

## References

- PROPOSAL_502_044（本 ADR 建立提案）
- Round 3 SIMULATION 報告（structural SPOF 證據）
- ADR-0040（Script Language Policy；本 ADR 不違反；agent 行為非自寫腳本）
- ADR-0001（Stateless Routing；本 ADR 增強 @Lead 派發前 enrichment）
