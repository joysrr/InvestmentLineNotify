---
adr_id: ADR-0046
title: LangGraph Runtime Architecture (v8.0)
status: Accepted
date: 2026-05-08
amends: []
related_proposals:
  - PROPOSAL_20260502_050 # Phase 1 Foundation
  - PROPOSAL_20260502_049 # Stabilization milestone v2
  - PROPOSAL_20260425_002 # POC（部分參考）
referenced_by:
  - .agents/runtime/state.py
  - .agents/runtime/graph.py
  - .agents/runtime/llm_adapter.py
  - .agents/runtime/mcp_server.py
  - rules/lead.md
  - AGENT_BOOTSTRAP.md
extends:
  - ADR-0001 # Stateless Routing
  - ADR-0027 # Hub-and-Spoke
  - ADR-0042 # Hybrid LLM Classifier
  - ADR-0044 # Integration Walkthrough
  - ADR-0045 # Design Audit dim 6
---

# ADR-0046: LangGraph Runtime Architecture (v8.0)

## Status

**Accepted** (2026-05-08)

## Context

v7.7 → v7.22 共 11 stabilization proposals + 6 governance ADRs + 7 simulation rounds 後達 stabilization milestone v2。v7.22 為 markdown-based prompt engineering framework + MCP tools；user 與 4 個 harness（Claude Code CLI / Web / Qwen Code / Antigravity）對話；harness LLM 自我扮演 11 agent personas 序列演出。

**v7.22 局限性**：

- 行為依賴 user 紀律 + LLM 自律執行 markdown 規則（drift 風險）
- 跨 dispatch state 靠 ROUTING_TICKET 文字協定（fragility）
- governance（C-1/C-2/dim 6/walkthrough）為事後 audit 而非 mechanically enforce

**v8.0 目標**：

- 行為層 mechanically enforced（Q4 100%）
- UX 不變（Q1 對話保留）
- LLM 不另計費（Q3 預設 sampling；API optional）
- 4 harness 全支援（CLI / Web / Qwen / Antigravity）
- v7.22 文件層保為 ground truth（Q3' A）→ LangGraph 解析執行

## Decision

採 **Option β'（混合 + LangGraph as MCP server）**：

### 1. 架構分層

```
Layer 1: User
  └─ 對話於 4 harness 之一（不變；UX 保留）

Layer 2: Harness LLM（chat interface + intent parser + result presenter）
  ├─ Claude Code CLI/Web → Anthropic Claude
  ├─ Qwen Code → Qwen
  └─ Antigravity → 視 IDE 設定
  讀 v7.22 文件層為「對話風格 + 工具熟悉度」（Q6 A 雙讀）

Layer 3: LangGraph Runtime (MCP server)
  ├─ 解析 v7.22 文件層為 graph behavior（Q3' A）
  ├─ 11 agent nodes + sub-graphs + supervisor pattern
  ├─ HITL via interrupt() + Command resume
  └─ governance native (C-1/C-2/dim 6/walkthrough)

Layer 4: LLM Adapter
  ├─ Mode A (default): MCP sampling 反向呼 Harness LLM（Q1' A）
  └─ Mode B (optional): Direct API（per-workspace 配置）

Layer 5: Memory / Tools (既有)
  ├─ mempalace MCP（primary memory；29 tools）
  └─ GitNexus MCP（disabled by default；16 tools）
```

### 2. 核心設計原則

1. **v7.22 文件層 = ground truth**（Q3' A）
   - LangGraph runtime 啟動時 parser.py 讀 `.agents/rules/*.md` + `.agents/skills/*.md` + `.agents/decisions/*.md` → 抽 frontmatter MACHINE_READABLE 區塊 + 結構化 sections → 形成各 agent system prompt + behavior config
   - 規則變更 → 改 markdown → restart runtime → graph 自動 reflect
   - Hardcode behavior 禁止（除性能必要 e.g. parser 本身）

2. **Mechanical enforcement**（Q4 100%）
   - 所有 dispatch 必透過 `mcp__langgraph__dispatch` tool
   - harness 偵測到 dispatch 意圖 → 必呼此 tool（不自行 role-play）
   - v8.0 啟用後 manual workflow 禁用（Q5 B；harness 系統 prompt 加鐵律）

3. **LLM 雙模可切換**（Q1' A + Q3）
   - Default: MCP sampling（不另計費）
   - Optional: API（user per-workspace 配置）
   - Per-node override（如 dim 6 audit 用更強 model）

4. **HITL via LangGraph 1.x interrupt**
   - autonomy_mode 4 enum → interrupt 觸發
   - Multi-signal ambiguous → interrupt
   - Hotfix tier upgrade revert decision → interrupt
   - User 回應 → MCP elicitation → Command resume

5. **Sub-graphs 三大**：
   - `auditor_6dim`: @Auditor 6 dim 並行（dim 1-5 既有 + dim 6 ADR-0045）
   - `hotfix_tier_upgrade`: paused → @Lead 接手 → 派新 heavy ticket
   - `multi_signal_dispatch`: ≥2 priority fan-out / ≥3 ambiguous interrupt

### 3. 4 Harness 啟動

| Harness         | 啟用方式                                            | LangGraph runtime 跑於  |
| --------------- | --------------------------------------------------- | ----------------------- |
| Claude Code CLI | `python3 .agents/scripts/langgraph-setup.py` (手動) | user 本機（stdio MCP）  |
| Claude Code Web | `.devcontainer/post-create.sh` 自動跑               | cloud sandbox container |
| Qwen Code       | 手動 setup（同 CLI）                                | user 本機               |
| Antigravity     | IDE Settings → MCP servers 加                       | user 本機               |

### 4. Persistence

#### 4.1 Entrypoint Constraint (V88-A-2)

所有 graph invoke 必走 `runtime/mcp_server.py`（dispatch / dispatch_resume）；
非 mcp_server entrypoint（如測試直接 `await graph.ainvoke()`）**不會** 觸發
`archive_routing_ticket`，因為 archive 在 mcp_server 收尾邏輯內呼。

- **生產**：4 harness 全走 mcp_server stdio；本約束 100% 滿足
- **測試**：integration test 若需 archive 行為須手動呼 `archive_routing_ticket(state)`
- **狀態**：V87-B-6 known-issue；不阻凍結 milestone v3

#### 4.2 Checkpointer Storage

- **本機 fs 可用**：AsyncSqliteSaver `~/.langgraph/checkpoints.db`（CLI / Qwen / Antigravity）
- **fs 不可用退化**（v8.0.6 V86-A-1/A-2 解）：偵測 `Path.home()` / `PROJECT_ROOT` 不可寫或 `LANGGRAPH_INMEMORY=1` env → 改用 `langgraph.checkpoint.memory.InMemorySaver`；同時 `persistence.write_routing_ticket / archive_routing_ticket` skip fs；Web harness 走此路徑
  - trade-off：thread_id 不跨 invoke 持久化；單次 dispatch 內 HITL resume 仍 work（同進程 in-memory checkpoint）
  - 用 ROUTING_TICKET 持久化的 sub-agent skill / 跨 session 續跑 在 Web harness 不可用；dispatch_resume 偵測到 thread state 不存在會回友善 error（V87-B-5）
- Future: AsyncPostgresSaver（雲端；Phase 3 評估；同時可解 Web harness 持久化問題）

#### 4.3 Safety Net

- `assert_checkpoint_safe` 防 RequestContext / socket / asyncio 物件污染 state
  - 在 `create_initial_state` 一次（init 時 fail-fast）
  - 在 `safe_node_return` wrapper 每 node 出口一次（v8.0.6 V86-A-6 加 helper；v8.0.7 V87-B-3 接進 backend / frontend / reviewer 三 hot node）

### 5. 與既有 ADR 關係

- **ADR-0001 Stateless Routing**: v8.0 graph node state = LangGraph state（既有 ROUTING_TICKET 為持久化 artifact）
- **ADR-0027 Hub-and-Spoke**: @Lead supervisor pattern 對應；不變
- **ADR-0042 Hybrid LLM Classifier**: Layer 1+2+3 在 supervisor node 內實作（Phase 2 落地）
- **ADR-0044 Walkthrough**: walkthrough subgraph 為 LangGraph 原生（Phase 3）
- **ADR-0045 Design Audit dim 6**: auditor_6dim subgraph 並行跑（Phase 3）

## Consequences

### 正向

- v7.22 governance 100% mechanical enforce
- UX 不變（user 4 harness 對話模式不動）
- LLM 不另計費（sampling default）
- 文件層為 SoT；演化彈性最大
- 21 validators + 40 patrol entries 仍跑（commit hook + LangGraph subgraph 雙軌）

### 負向 / 風險

- LangGraph 1.x 學習曲線（POC 寫於 0.x；需重學）
- Sampling latency（每 node LLM call 反向 IPC）
- 11 nodes × N rounds × multi-agent → checkpoint state 大（SQLite 容量需監測）
- markdown parser 對 frontmatter / sections 結構化要求高（既有 rules 已有 MACHINE_READABLE 但需驗證 100% 覆蓋）

### 中性

- POC 內容大幅重寫；保留 mcp_sampling_adapter / llm_factory 設計概念
- v7.22 manual workflow 廢止（Q5 B）但文件層保留為 ground truth

## Alternatives Considered

1. **Option α (LangGraph 後端 + harness thin wrapper)**
   - 拒絕：UX 顯著改變；不符 Q1
2. **Option γ (LangGraph 取代 harness)**
   - 拒絕：失去 4 harness 整合投資
3. **Option δ (LangGraph 純 validation layer)**
   - 拒絕：行為層不 enforce；不符 Q4
4. **Hardcode behavior in Python**
   - 拒絕：失去文件層演化彈性；不符 Q3' A

## Compliance / Validation

- LangGraph runtime structural validator（22nd validator；新加；Phase 1 F-9）
- 5 情境 integration test（Phase 1 F-9）
- C-1/C-2 對 runtime 程式碼 + parsed behavior 雙驗
- dim 6 design audit 含 LangGraph runtime 一致性

## References

- PROPOSAL_502_050（本 ADR 建立）
- v7.22 stabilization milestone v2 凍結報告（`docs/Reports/STABILIZATION_MILESTONE_V2_2026-05-07.md`）
- LangGraph 1.x 官方 docs (langchain-ai.github.io/langgraph/)
- 既有 POC `poc/langgraph-mcp/`（部分參考；不直接 fork）
