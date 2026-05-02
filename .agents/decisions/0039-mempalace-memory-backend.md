---
adr_id: ADR-0039
title: Memory Backend Migration — MemPalace as Primary Memory Layer (取代 markdown filesystem)
status: Accepted
date: 2026-05-02
supersedes: []
superseded_by: []
extends: [ADR-0001, ADR-0024, ADR-0034]
related_proposals:
  - PROPOSAL_20260502_001
  - PROPOSAL_20260430_002 # 原始 Memory Palace 設計
  - PROPOSAL_20260425_002 # LangGraph + MCP POC（ADR-0034）
referenced_by:
  - rules/lead.md
  - iron-rules/lead-state-anchor.md
  - skills/memory-palace-schema.md
  - skills/memory-operations.md
  - tests/memory-palace-validator.mjs
  - .mcp.json
---

# ADR-0039: MemPalace as Primary Memory Backend

## Status

**Accepted** (2026-05-02)

## Context

PROPOSAL_20260430_002 建立的 markdown filesystem Memory Palace 三房（architecture / strategy_context / debug_graveyard）為自訂設計，特性：

- 純 markdown + INDEX 表
- 手工維護
- 無 vector retrieval
- 無 cross-session 持久化

Pre-Launch Audit（PROPOSAL_20260501_004）發現該機制有強耦合風險：

- lead.md §s_memory_palace「派發前必查 architecture/INDEX」為**絕對禁止**鐵律
- 但 INDEX 損毀 / 缺失 / 漂移無 fallback 機制
- 手工維護易遺漏（特別是 strategy_context 變更歷史）

User 評估後採納 **MemPalace**（github.com/MemPalace/mempalace；MIT；v3.3.4+）作為主 backend。

### 為何 MemPalace？

| 維度             | markdown filesystem | **MemPalace**                |
| ---------------- | ------------------- | ---------------------------- |
| Retrieval 準確率 | 手工 grep           | **96.6% R@5 LongMemEval**    |
| 自動化           | 全手工              | `mempalace mine` 自動採礦    |
| 跨 session       | ❌                  | ✅ wake-up                   |
| MCP 整合         | ❌                  | ✅ 內建 29 tools             |
| 隱喻彈性         | 3 fixed rooms       | Wings/Rooms/Drawers 三層彈性 |
| Local-first      | ✅                  | ✅（ChromaDB embedded）      |
| License          | 自有                | MIT 兼容                     |

### 與 ADR-0034 的契合

ADR-0034（LangGraph + MCP）已建立 MCP 整合 POC；MemPalace 內建 29 MCP tools 直接接入；**不需新基礎設施**。

## Decision

採 **MemPalace** 為 framework Memory 主 backend；markdown filesystem 降為「source-of-truth backup」（git audit 用；不再為主要查詢路徑）。

### 核心設計

1. **Primary backend**: MemPalace（透過 MCP server 整合）
2. **Backup SoT**: `.agents/memory/` markdown 仍保留作 git audit 與 re-mine 來源
3. **Hybrid fallback**: MCP server down → fallback markdown grep（短期）
4. **Wings/Rooms/Drawers 對應**：
   - Wings = Workspace（per project / per active workspace）
   - Rooms = 概念分類（沿用既有 architecture / strategy_context / debug_graveyard）
   - Drawers = 原始 entries（採礦自對話 + 手動補入）

### Framework 棧升級（FRAMEWORK_REQUIREMENTS）

新增依賴：

- Python 3.9+
- `pip install mempalace>=3.3.4`
- ChromaDB（mempalace 自帶 embedded）
- 約 300MB 磁碟空間

ADR-0024 零外部依賴原則**部分修訂**：

- Python runtime 不算「外部 API」（local-first）
- ChromaDB embedded（同等本地檔案）
- 仍堅守：無雲端 API / 無付費 SaaS / 無網路依賴

## Alternatives Considered

| 方案                            | 為何不採                                                         |
| ------------------------------- | ---------------------------------------------------------------- |
| **A: 維持 markdown filesystem** | 手工維護 / 無 retrieval 機制 / 強耦合風險                        |
| **B: mem0**                     | 需 LLM API（非 local-first）/ 無 verbatim                        |
| **C: Letta（前 MemGPT）**       | 需深度 integration / framework heavyweight                       |
| **D: Zep**                      | 雲端 API                                                         |
| **E: Cognee**                   | Knowledge graph 過度 / 不需                                      |
| **F: MemPalace**（本決策）      | ✅ Local-first / MCP 內建 / 96.6% R@5 / 三層 metaphor 彈性 / MIT |

## Consequences

### Positive

- **跨 session 持久記憶**：解決 ADR-0001 stateless routing 失憶痛點
- **自動採礦**：手工維護負擔歸零
- **MCP 統一介面**：與 LangGraph POC 整合
- **96.6% retrieval**：派發精度提升
- **Wings/Rooms/Drawers** 隱喻彈性 > 3-room（multi-project / multi-topic 自然支援）

### Negative / Trade-offs

- **新棧依賴**：Python 3.9+ runtime
- **ChromaDB binary**：不能直接 git diff（緩解：markdown SoT 仍 git）
- **Vector embedding 黑箱**：debug 較難（緩解：mempalace 提供 search trace）
- **首次採礦時間**：依現有 memory 量；估 < 5 min
- **MCP server 啟動依賴**：新失敗模式（緩解：hybrid fallback）

### 套用範圍

| 場景                   | 採用 MemPalace               | 保留 markdown      |
| ---------------------- | ---------------------------- | ------------------ |
| 派發前查 touched_files | ✅ MCP query                 | ❌                 |
| 跨 session wake-up     | ✅                           | ❌                 |
| 新增 debug 條目        | ✅ `mine` 自動 + 手寫 backup | ✅ markdown 同步寫 |
| Git audit              | ❌（vector 不易 review）     | ✅ markdown SoT    |
| Cold start 重建        | re-mine from markdown        | ✅ 來源            |

## Validation

- 安裝：`pip install mempalace==3.3.4`
- MCP 啟動：`.mcp.json` 註冊 + Claude Code restart
- 採礦：`mempalace mine` 既有 4 debug_graveyard + workspace memory
- 測試：query 任一既有條目 → R@5 命中 / 內容正確
- Validators：memory-palace-validator.mjs 通過

## Notes

- 與 ADR-0001 stateless routing 兼容：MemPalace 不存 routing state；只存知識記憶
- 與 ADR-0037 iron themes 正交：iron themes 是 immutable 鐵律；memory 是 mutable 知識；不重疊
- 與 ADR-0038 tier budget 正交：rule budget 是 prompt 注入量；memory 是查詢層；不重疊
- 後續若 MemPalace 棄用 / 改授權：可 re-mine 至替代套件（markdown SoT 為 fallback 來源）
