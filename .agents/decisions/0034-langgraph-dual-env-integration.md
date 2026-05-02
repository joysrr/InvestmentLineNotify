---
adr_id: ADR-0034
title: LangGraph + MCP 雙環境整合（Qwen / Antigravity）
status: Accepted
date: 2026-04-26
accepted_at: 2026-04-27
supersedes: []
superseded_by: []
extends:
  - ADR-0010 # 平行審查（@Reviewer + @Security）
  - ADR-0020 # 提案意圖繼承
  - ADR-0033 # Orchestrator + Policies/Core 模式
related_proposals:
  - PROPOSAL_20260425_002
referenced_by:
  - poc/langgraph-mcp/graph.py
  - poc/langgraph-mcp/server.py
---

# ADR-0034: LangGraph + MCP 雙環境整合

## Status

**Accepted** (2026-04-27) — PROPOSAL_20260425_002 Phase B 13/13 nodes 跑通；7/13 自我進化驗證通過；HITL #1/#2 跨進程 round-trip 完整驗證。
**升級觸發**：framework v6.10 → **v6.11**（hybrid_minor；POC 列為 framework 資產，既有 13-agent rules 並行保留）。

## Context

### 既有問題

13 agents + ~50 skills + 33 ADRs 框架已成熟，但**跨平台規則執行率不一致**：

- Claude Code（公司）：規則遵守率 ≈ 95%
- Antigravity / Cursor（家用）：≈ 70%
- 主要落差來自「LLM 自由詮釋 system prompt」+「無強制執行流程」

### 環境差異

- **公司**：自建 Qwen API + 自架 GitLab；無法用 Anthropic / OpenAI 公開 LLM
- **家用**：Antigravity（Vertex AI / Gemini-3-pro）；支援 Agent Skills + 專屬 MCP store
- 兩環境**獨立使用**（依 PROPOSAL_002 §3.4 Q3 confirmed）；不執行同一專案

### 既有方案不足

- 純 prompt 工程：~50 skills 已是上限；token 經濟反而下降（v6.10 audit 顯示 1.4 子維度 3.8 / 滿分 5.0）
- 純 ADR：知識沉澱可，但無法「強制執行」流程順序

## Decision

採用 **LangGraph 流程化 + MCP 包裝 + Sampling 跨 LLM** 三位一體方案。

### 核心設計

#### 1. LangGraph 框架化 13 agents 流程（70% static + 30% conditional）

```
START → lead → [conditional 4-way: planner / auditor / assistant / retro]
  planner → consultant → [conditional: 🔴 退回 / architect 前進]
  architect → [conditional: Prior Art Gate HITL / qa_test_spec]
  qa_test_spec → [conditional: backend / frontend]
  backend|frontend → reviewer → [conditional 5-way: violation / security / qa_verification / 退回 implementer]
  security → [conditional: fail / qa_verification]
  qa_verification → assistant → retro → END

Auditor sub-flow（target_agent="@Auditor" 時）：
  auditor_dispatch → [5 並行 dim_1..5] → auditor_aggregate → END
```

**70% static**：核心階段順序鎖死（規則執行率↑）
**30% conditional**：保留判斷彈性（force_complex / Prior Art / REVIEW_CYCLE / SC 觸發 / Consultant 🔴）

#### 2. WorkflowState = ROUTING_TICKET schema v1（PROPOSAL_023 對齊）

LangGraph state 與 ROUTING_TICKET.md 同源；流程跑完自動序列化。

#### 3. LLM 抽象層（`llm_factory.py`）

```python
def get_llm(state, complexity_tier=None):
    backend = state["llm_backend"]  # qwen / gemini / sampling
    tier = complexity_tier or state["complexity_tier"]
    # 依 tier 取 simple/medium/complex 對應 model（Qwen 三層 / Gemini 三層 / sampling 委派）
    return _get_qwen_llm(tier) | _get_gemini_llm(tier) | _get_sampling_llm(tier)
```

**抽象效益**：13 agents 程式碼**不知道用哪個 LLM**；只透過 `state.llm_backend` 切換。

#### 4. MCP 包裝（`server.py` 雙模）

- **CLI 模式**（公司）：直跑 `python -m server cli run "..."`；無需 MCP runtime
- **MCP stdio 模式**（家用）：被 Antigravity 自動拉起；暴露 3 tools + 2 resources

#### 5. HITL Interrupt 4 點（保留人類審核權）

| 觸發點              | 機制                                  | 決策內容                      |
| ------------------- | ------------------------------------- | ----------------------------- |
| Prior Art Gate      | `interrupt_before=["prior_art_gate"]` | 採納 / 換選型 / 自建 / bypass |
| Proposal Adoption   | retro_node 設 `pending_hitl`          | 採納 / 修改 / 拒絕            |
| strategyWeight 異動 | consultant 偵測 + pending_hitl        | 確認權重值                    |
| Hotfix tier         | lead 模糊時 + pending_hitl            | light / heavy                 |

#### 6. 跨 client 紀錄（PROPOSAL_002 §4.4）

每筆 AUDIT_DECISION_LOG record notes 欄含 `env=company; llm=qwen/qwen-max` 或 `env=home; llm=gemini/gemini-3-pro`，可獨立統計兩環境評分差異。

### 9 項自我進化機制保留方式

| 機制                    | 在 LangGraph 中位置                                                   |
| ----------------------- | --------------------------------------------------------------------- |
| §1 @Retro 提案          | `retro_node`                                                          |
| §2 @Auditor 5 維度      | `auditor_*` 3 sub-nodes                                               |
| §3 drift_score          | `tools.audit_tools.run_drift_check()`                                 |
| §4 意圖繼承（ADR-0020） | `proposal_tools.get_proposal_intent_inheritance()` 注入 retro prompt  |
| §5 反覆問題偵測         | `proposal_tools.read_proposals(status="completed")` 注入 retro prompt |
| §6 rule_token           | `audit_tools.run_validators("token")`                                 |
| §7 decision_log         | `_base.run_agent_node()` 內 `decision_path` add reducer               |
| §8 索引同步             | `audit_tools.regen_index()`                                           |
| §9 Hotfix tier          | lead force_complex_scenarios + HITL 4                                 |

## Consequences

### 正面

- **規則執行率**：預期家用 70% → 90%+（流程強制 + state 約束）
- **跨 LLM 公平比較**：dim_avg 跨 Qwen / Gemini 統一刻度（同 prompt + 同 tier）
- **HITL 不喪失**：4 個 interrupt 點完整保留，符合 user 「最終決策權在我」要求
- **可擴展**：未來加 13th agent 只需 add_node + 1 conditional edge；不必動其他 12 agents

### 負面

- **新增 ~3000 lines POC**：增複雜度；學習曲線（LangGraph + MCP）
- **依賴增加**：langgraph + langchain-{openai,google-genai} + mcp + pyyaml
- **stateful**：MemorySaver 需持久化決定（POC 用記憶體；生產需 SQLite/PostgreSQL）

### 風險與緩解

- **風險 R1**：Qwen API 不穩 → CLI 模式自動 retry；或暫時切 sampling 模式（家用接手）
- **風險 R2**：MCP sampling capability 在 Antigravity 不完整 → 預設 LLM_BACKEND=gemini（API key 模式）為 fallback
- **風險 R3**：LangGraph state 過大（decision_path 累積） → 設 `max_decision_steps` 上限 + 寫檔時 trim

## Alternatives Considered

### A1：純 prompt 強化（不引入 LangGraph）

- ❌ 已試 v6.4-v6.10；audit 結果改善有限（4.59 → 4.59 持平）
- ❌ 規則執行率天花板 ≈ 95%（公司）；家用無法突破 70%

### A2：自寫狀態機（不用 LangGraph）

- ❌ 重造輪子；LangGraph 已有 checkpointer / interrupt / conditional edges
- ❌ 失去未來整合 LangSmith 觀測性的優勢

### A3：跨環境共享 state（PostgreSQL checkpointer）

- ❌ 違反 Q3 確認的「兩環境獨立」原則
- ❌ 公司網路安全限制

## References

- PROPOSAL_20260425_002：本 ADR 的提案來源
- PROPOSAL_20260424_023：ROUTING_TICKET schema v1
- PROPOSAL_20260424_024：ADR-0033 Orchestrator + Policies/Core
- PROPOSAL_20260422_026：Hub-and-Spoke + Blackboard 模式
- LangGraph docs: https://langchain-ai.github.io/langgraph/
- MCP spec: https://spec.modelcontextprotocol.io/

---

> **Status**: Draft — 待 POC Phase B/C 通過後升 Accepted
> **下一步**：執行 `tests/self-evolution-test.md` + `tests/dual-env-workflow.md` 全綠 → 升狀態
