---
drawer_id: drawer_memory_debug_graveyard_d6210a367d52667c895c6a2c
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:02:59.998Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

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
