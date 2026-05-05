---
drawer_id: drawer_memory_general_90c6354dc6acbc537a364d4c
wing: memory
room: general
exported_at: 2026-05-04T03:03:00.069Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

# agent_framework Debug Graveyard INDEX

對齊 `skills/memory-palace-schema.md` Room 3 規範。

本目錄記錄**本 workspace（framework 自身）特有**的踩坑；跨專案通用的請寫進 `.agents/memory/debug_graveyard/`。

## 條目（依日期倒序）

| ID                                                                                 | 日期 | Category | Severity | 一句話 | 條目 |
| ---------------------------------------------------------------------------------- | ---- | -------- | -------- | ------ | ---- |
| _(無；POC 期所有踩坑都在 framework-level；本目錄保留供未來 workspace-only 的問題)_ |      |          |          |        |      |

## 與 framework-level 的分工

| 在 framework-level（`.agents/memory/`）           | 在 workspace-level（這裡）            |
| ------------------------------------------------- | ------------------------------------- |
| LangGraph / msgpack / Qwen3 thinking 等通用框架坑 | workspace 自身的 generator script bug |
| Python 套件相容性                                 | workspace 自身的 PROPOSAL flow 邏輯坑 |
| MCP 協議互通問題                                  | workspace 自身的 audit 流程踩坑       |

<!-- END: agent_framework debug graveyard index -->
