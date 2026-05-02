---
room: debug_graveyard
incident_id: DG-20260427-001
date: 2026-04-27
category: serialization
severity: critical
agents_involved: [@Backend, @Lead]
related_proposal: PROPOSAL_20260425_002
related_files:
  - poc/langgraph-mcp/state.py
  - poc/langgraph-mcp/progress.py
  - poc/langgraph-mcp/llm_factory.py
  - poc/langgraph-mcp/server.py
fix_commit: fc1d306
---

# RequestContext 放進 LangGraph state 導致 msgpack 序列化失敗

## 症狀

- Qwen Code 呼叫 `mcp__agentic-framework__run_agentic_workflow` tool
- workflow 跑到第一個 node（@Lead）完成寫 checkpoint 時爆
- Error message：`Type is not msgpack serializable: RequestContext`
- 全流程死當；MCP tool 回 error；Qwen Code 退化到 Shell 工具
- 即使清掉整個 checkpoints.db 仍復發（每次 MCP tool 進入都會把 RequestContext 重新塞進 state）

## 根因

- LangGraph `SqliteSaver` 用 msgpack 序列化整個 `WorkflowState`，每個 node 結束都寫 checkpoint
- 為支援 sampling 模式（MCP server 反向呼叫 client LLM），把 `mcp_context: RequestContext` 加進 state
- `RequestContext` 內含 socket / asyncio handle / queue 等不可序列化物件 → msgpack 直接拋

## 解法

1. `state.py`：移除 `mcp_context` 欄位
2. `progress.py`：用 module-level singleton 暫存（後改 `contextvars.ContextVar` 解 race）
3. `llm_factory._get_sampling_llm`：改從 `progress.get_request_context()` 取
4. `server.py call_tool`：在 tool handler 進入時 `set_mcp_context(session, loop, ctx)`、結束時 `clear_mcp_context()`

## 教訓（避免再犯）

- ❌ **不要**把任何含 socket / asyncio handle / file descriptor 的物件放進 LangGraph state
- ❌ **不要**為了「方便傳參數」就加進 state（state 會被序列化）
- ✅ 不可序列化的 runtime context 用 **side-channel**：`contextvars` / module-level singleton
- ✅ 加 `assert_checkpoint_safe(state)` runtime 守門（commit `40b3058`；poc/langgraph-mcp/state.py）
- ✅ 加 unit test 用 socket 物件試 dump 確保再爆會被 CI 攔下

## 相似 pattern 警示

任何「LangGraph / 任何 checkpoint-based 框架」皆同：

- DB connection 物件不能放 state
- HTTP client / aiohttp `ClientSession` 不能放
- Lock / Semaphore / asyncio.Event 不能放
- 任何 `__reduce__` 自訂或 C-extension 物件需先測

**判斷簡則**：「這東西能 `pickle.dumps()` 嗎？」不能 → 也不能放 state。

<!-- END: DG-20260427-001 -->
