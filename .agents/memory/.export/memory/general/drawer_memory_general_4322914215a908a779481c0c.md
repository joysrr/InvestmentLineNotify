---
drawer_id: drawer_memory_general_4322914215a908a779481c0c
wing: memory
room: general
exported_at: 2026-05-04T03:03:00.071Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

---

room: architecture
module: langgraph-poc
physical_path: poc/langgraph-mcp/
entry_files:

- poc/langgraph-mcp/server.py # CLI / MCP entry
- poc/langgraph-mcp/graph.py # StateGraph 組裝
- poc/langgraph-mcp/state.py # WorkflowState schema
- poc/langgraph-mcp/context_loader.py # rule + refs 注入
- poc/langgraph-mcp/llm_factory.py # qwen / gemini / sampling 切換
  dependencies:
  external: - langgraph - langgraph-checkpoint-sqlite - langchain-openai - langchain-google-genai - mcp
  internal: - .agents/rules/_ (read via context_loader) - .agents/skills/_ (read via context_loader) - .agents/memory/\*\* (read via context_loader)
  owners: [@Backend]
  last_audit: 2026-04-30

---

# LangGraph POC（MCP server + 13 agent workflow）

## 職責
