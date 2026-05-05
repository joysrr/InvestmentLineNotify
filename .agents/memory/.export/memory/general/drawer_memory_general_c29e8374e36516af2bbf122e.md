---
drawer_id: drawer_memory_general_c29e8374e36516af2bbf122e
wing: memory
room: general
exported_at: 2026-05-04T03:03:00.077Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

動 resolve refs；空也能跑

- **依賴 SqliteSaver**：HITL resume 跨進程持久化；無此套件退化 MemorySaver

## 為何在這個位置（POC 設計選擇）

- 放 `poc/`：表明非生產組件；不混入專案核心程式碼
- 與 `.agents/` 並列：可獨立 import；同時透過 `AGENTS_DIR` 環境變數連結
- 命名 `langgraph-mcp`（短橫）：跟 npm 慣例對齊；user 端可 rename `langgraph_mcp` 給 Python import

## 關鍵設計決策

- WorkflowState 用 TypedDict total=False —— 但所有欄位**必先宣告**（見 DG-20260426-002）
- Checkpoint 不存 RequestContext —— side-channel via contextvars（見 DG-20260427-001 + 002）
- 13 agent rule + 引用 artifacts 透過 context_loader 統一注入（PROPOSAL_002 第二輪 Code Review）

## 相關 ADR / Proposal

- PROPOSAL_20260425_002 — POC 主提案（已 ACCEPTED）
- ADR-0034 — LangGraph dual-env integration

<!-- END: architecture/langgraph-poc -->
