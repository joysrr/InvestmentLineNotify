---
drawer_id: drawer_memory_debug_graveyard_4fd4f5b4529e8c37d0cd5db2
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.049Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

---

room: debug_graveyard
incident_id: DG-20260427-002
date: 2026-04-27
category: concurrency
severity: major
agents_involved: [@Backend]
related_proposal: PROPOSAL_20260425_002
related_files:

- poc/langgraph-mcp/progress.py
  fix_commit: 40b3058

---

# progress.py module-level 全域 state 在並發 MCP call 互踩

## 症狀

- 修完 DG-20260427-001 後，`progress.py` 用 module-level `_session` / `_loop` 暫存 RequestContext
- 單一 tool call 沒問題；但若 MCP server 同時處理多個 tool call（Antigravity 並發呼叫）
- 後者 `set_mcp_context(...)` 覆蓋前者的全域變數
- → 前一個 task 寫 log 時送到後者的 session（log 通知串接錯）

## 根因

- Python module 級變數是「全 process 共用」
- async tool handler 雖各自有 task context，但 module 變數不隨 task 切換
- `asyncio.run_coroutine_threadsafe` 用的是被覆寫後的 `_loop` → 通知到錯誤目的地

## 解法
