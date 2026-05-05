---
drawer_id: drawer_memory_general_792adac954f975441c30d834
wing: memory
room: general
exported_at: 2026-05-04T03:03:00.073Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

wners: [@Backend]
last_audit: 2026-04-30

---

# LangGraph POC（MCP server + 13 agent workflow）

## 職責

把 framework 的 13 agent rule 落地為 LangGraph StateGraph；
雙模 entry：CLI（公司 Qwen）、MCP stdio（家用 Antigravity / Qwen Code）。

## 進入點

| Mode  | 命令                                                            | 用途                             |
| ----- | --------------------------------------------------------------- | -------------------------------- |
| CLI   | `python -m langgraph_mcp.server cli run "請新增 X"`             | 公司端直跑                       |
| MCP   | `python -m langgraph_mcp.server mcp`                            | Antigravity / Qwen Code 自動拉起 |
| Test  | `python -m unittest langgraph_mcp.tests.<module>`               | 單元測試                         |
| Debug | `python -m langgraph_mcp.server cli context-check --agent lead` | 看 agent 載入概況                |

## 子模組
