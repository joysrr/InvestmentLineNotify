---
drawer_id: drawer_memory_debug_graveyard_352b58a0b4278b2504bb5b7c
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.010Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

en Code 退化到 Shell 工具

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
