---
adr_id: ADR-0039
title: Memory Backend Migration — MemPalace as Primary SoT (markdown 降為 cold export artifact)
status: Accepted
date: 2026-05-02
amended: 2026-05-04 # PROPOSAL_502_020 Plan G + PROPOSAL_502_023（B-4 compress retry/escalate；B-5 .pending/ lock；B-6 memory_hint diff）
supersedes: []
superseded_by: []
extends: [ADR-0001, ADR-0024, ADR-0034]
related_proposals:
  - PROPOSAL_20260502_001
  - PROPOSAL_20260502_020 # Plan G amend：MCP-direct 寫入 + cold export
  - PROPOSAL_20260430_002 # 原始 Memory Palace 設計
  - PROPOSAL_20260425_002 # LangGraph + MCP POC（ADR-0034）
referenced_by:
  - rules/lead.md
  - iron-rules/lead-state-anchor.md
  - skills/memory-palace-schema.md
  - skills/memory-operations.md
  - tests/memory-palace-validator.mjs
  - .mcp.json
  - scripts/mempalace-export.mjs # Plan G cold export
---

# ADR-0039: MemPalace as Primary Memory Backend

## Status

**Accepted** (2026-05-02) → **Amended** (2026-05-04 by PROPOSAL_502_020 Plan G)

### v2 (2026-05-04) Amendment Summary

原 v1 設計：markdown SoT → mempalace mine（雙寫；mempalace 為查詢層）。

User 反饋：雙寫成本高 + 無法 zip 帶走完整記憶。經 Plan E/F/G/H 評估後採 **Plan G**：

- **SoT 方向反轉**：mempalace = primary write target（MCP-direct）；markdown 降為 cold export artifact
- **不再雙寫**：高頻 rules（lead/architect/backend/qa/retro）直接呼叫 `mcp__mempalace__mempalace_add_drawer` / `update_drawer`
- **Cold export**：`scripts/mempalace-export.mjs` 透過 MCP RPC dump 至 `.agents/memory/.export/<wing>/<room>/<drawer>.md`；commit 進 git；zip 帶走時自動同行
- **既有 markdown SoT**（`.agents/memory/debug_graveyard/`、INDEX）降為「seed docs」：cold-start re-mine 用；不再每次 dev 寫入

詳見下方「Decision (v2)」章節；v1 章節保留作 ADR 演化紀錄。

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

## Decision (v2 — Plan G; 2026-05-04 起生效)

採 **MemPalace MCP** 為 framework Memory 唯一 SoT（單寫）；markdown 拆兩類：

- `.agents/memory/*.md`、`.agents/memory/debug_graveyard/*.md`：seed docs（cold-start re-mine 用；不再活躍寫入）
- `.agents/memory/.export/<wing>/<room>/<drawer>.md`：cold export artifact（由 `scripts/mempalace-export.mjs` 自動生成；commit 進 git；zip 帶走）

### 核心設計（v2）

1. **Single write target**: MCP `mempalace_add_drawer` / `update_drawer` / `delete_drawer`（rules 直呼）
2. **Cold export**: 每次 commit 後（或週期性）執行 `node .agents/scripts/mempalace-export.mjs`；輸出到 `.agents/memory/.export/`；確保 zip 帶走
3. **Hybrid fallback**: MCP server down → fallback `.agents/memory/.export/` 目錄 grep（短期；功能等價）
4. **Cold-start 重建路徑**: 新環境 → `mempalace mine .agents/memory/.export/` → 重建 vector DB
5. **Wings/Rooms/Drawers 對應**（不變）：
   - Wings = Workspace（per project / per active workspace）
   - Rooms = 概念分類（沿用既有 architecture / strategy_context / debug_graveyard）
   - Drawers = 原始 entries（rules 自動寫 + 採礦補入）

### v1 → v2 差異對照

| 維度          | v1（雙寫）                  | **v2（Plan G 單寫）**                        |
| ------------- | --------------------------- | -------------------------------------------- |
| Write 路徑    | markdown → `mempalace mine` | rules → `mcp__mempalace__add_drawer`（直呼） |
| Markdown 角色 | primary SoT                 | seed + cold export artifact                  |
| 自動化        | 半自動（手 mine）           | 全自動（rules-triggered MCP）                |
| Zip 帶走      | ❌（vector DB user-global） | ✅（`.export/` 跟 git 走）                   |
| 雙寫成本      | 高                          | 零（單寫）                                   |

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

### 套用範圍（v2 Plan G 後）

| 場景                   | MemPalace MCP                                 | `.agents/memory/.export/`               |
| ---------------------- | --------------------------------------------- | --------------------------------------- |
| 派發前查 touched_files | ✅ MCP query                                  | fallback grep（MCP down 時）            |
| 跨 session wake-up     | ✅                                            | —                                       |
| 新增 debug 條目        | ✅ `mcp__mempalace__add_drawer`（rules 直呼） | ❌ 不直接寫；下次 export 時自動同步     |
| Git audit              | ❌（vector 不易 review）                      | ✅（每 drawer 一檔；diff-friendly）     |
| Cold start 重建        | re-mine from `.export/`                       | ✅ 來源（取代原 `.agents/memory/*.md`） |
| Zip 帶走               | ❌（user-global ChromaDB 不跟）               | ✅ commit 進 git；zip 自動帶走          |

## Validation

- 安裝：`pip install mempalace==3.3.4`
- MCP 啟動：`.mcp.json` 註冊 + Claude Code restart（Antigravity 走 IDE 自有 MCP 註冊；參 INSTALL_ANTIGRAVITY.md）
- 採礦（cold start）：`mempalace mine .agents/memory/.export/`（v2 後改用 `.export/` 為來源）
- Cold export：`node .agents/scripts/mempalace-export.mjs`；應產出 `.agents/memory/.export/<wing>/<room>/*.md`
- 測試：query 任一既有條目 → R@5 命中 / 內容正確
- Validators：memory-palace-validator.mjs 通過

## Notes

- 與 ADR-0001 stateless routing 兼容：MemPalace 不存 routing state；只存知識記憶
- 與 ADR-0037 iron themes 正交：iron themes 是 immutable 鐵律；memory 是 mutable 知識；不重疊
- 與 ADR-0038 tier budget 正交：rule budget 是 prompt 注入量；memory 是查詢層；不重疊
- 後續若 MemPalace 棄用 / 改授權：可 re-mine 至替代套件（v2 後 `.agents/memory/.export/` 為 fallback 來源）

### v2 補充（Plan G 限制揭露）

- **mempalace 3.3.4 user-global**：ChromaDB + KG 在 `~/.mempalace/`；強行 per-project palace 會 KG 漂移（已實證；參 PROPOSAL_502_020 §三）
- **mempalace 3.3.4 無 native export**：唯一 export 路徑是 MCP `mempalace_list_drawers` + `mempalace_get_drawer`；`scripts/mempalace-export.mjs` 即此實作
- **Export 落差**：current snapshot 是 best-effort cold backup；不是 transactional sync。若 mempalace 寫入後未跑 export 即環境消失，該 drawer 在新環境重建時會缺；緩解：post-write hook 自動跑 export（Batch 5）
