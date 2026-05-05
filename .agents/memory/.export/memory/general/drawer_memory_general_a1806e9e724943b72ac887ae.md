---
drawer_id: drawer_memory_general_a1806e9e724943b72ac887ae
wing: memory
room: general
exported_at: 2026-05-04T03:03:00.075Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

|
| Debug | `python -m langgraph_mcp.server cli context-check --agent lead` | 看 agent 載入概況 |

## 子模組

| 子模組         | 路徑              | 職責                                   |
| -------------- | ----------------- | -------------------------------------- |
| paths          | tools/paths.py    | .agents/ 路徑與 artifact 讀取 SoT      |
| context_loader | context_loader.py | rule + 引用 artifacts + token budget   |
| parsers        | parsers.py        | LLM 輸出 regex helpers（純函式）       |
| nodes/         | nodes/\*.py       | 13 agent 對應 node                     |
| tools/         | tools/\*.py       | file / audit / context / proposal 操作 |
| progress       | progress.py       | MCP runtime context（contextvars）     |

## 依賴關係

- **必依賴 .agents/**：所有 node system prompt 讀 `.agents/rules/<agent>.md`
- **可選依賴 memory palace**：context_loader 自動 resolve refs；空也能跑
- **依賴 SqliteSaver**：HITL resume 跨進程持久化；無此套件退化 MemorySaver

## 為何在這個位置（POC 設計選擇）
