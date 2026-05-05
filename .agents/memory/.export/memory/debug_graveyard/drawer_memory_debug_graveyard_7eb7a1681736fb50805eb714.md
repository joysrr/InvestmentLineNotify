---
drawer_id: drawer_memory_debug_graveyard_7eb7a1681736fb50805eb714
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.020Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

ool`：在 tool handler 進入時 `set_mcp_context(session, loop, ctx)`、結束時 `clear_mcp_context()`

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
