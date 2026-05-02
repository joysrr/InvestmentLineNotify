---
skill_id: memory-palace-schema
file_type: skill
version: v2.0
last_modified: 2026-05-02
last_proposal: PROPOSAL_20260502_001
purpose: |
  MemPalace（github.com/MemPalace/mempalace v3.3.4 MIT）為 framework Memory primary backend；
  本 schema 定義 Wings/Rooms/Drawers 對應 + framework vs workspace 分層 + 既有 markdown SoT 互通。
  原 PROPOSAL_20260430_002 markdown 三房保留為 source-of-truth backup（git audit + re-mine 來源）。
references:
  related_rule: rules/lead.md §s_memory_palace
  related_decision: decisions/0039-mempalace-memory-backend.md
  iron_theme: iron-rules/lead-state-anchor.md # 派發鐵律#3 含 Memory Palace 引用
related_decisions:
  - ADR-0039
  - ADR-0001 # stateless routing；Memory Palace 是 anchor 補位
  - ADR-0034 # MCP 整合
---

# Memory Palace Schema (v2.0; MemPalace primary backend)

> v2.0 變更（PROPOSAL_20260502_001 + ADR-0039）：從手工 markdown 三房升級為 MemPalace（vector + MCP）primary；markdown 降為 backup SoT。

## 1. 設計原則

1. **MemPalace primary**：派發前查 / 跨 session wake-up 走 MemPalace MCP tools
2. **Markdown SoT backup**：`.agents/memory/` + `workspaces/<ws>/memory/` 仍是 git 可審計來源；用於 re-mine 還原
3. **Local-first**：ChromaDB embedded；無 API key
4. **Hybrid fallback**：MCP server down → markdown grep（短期 emergency）

## 2. Wings/Rooms/Drawers 對應（v2.0 schema）

### 2.1 Framework-level

```
Framework Wing：framework
  Rooms：
    architecture        — 模組 ↔ 實體檔案 + Owner
    strategy_context    — 參數調整脈絡（不存當前值；指針 + 變更歷史）
    debug_graveyard     — 框架級踩坑教訓（API / 套件 / Concurrency）
    general             — MemPalace auto-classified；未明確分類

  Markdown SoT (backup):
    .agents/memory/debug_graveyard/  ← 框架級踩坑（git audit）
    [framework 級 architecture / strategy_context 預設不建；schema 設計如此]
```

### 2.2 Workspace-level

```
Per-Workspace Wing：<workspace_id>（如 agent_framework / investment-line / 等）
  Rooms：
    architecture        — 本 workspace 模組地圖
    strategy_context    — 本 workspace 參數變更脈絡
    debug_graveyard     — 本 workspace 踩坑
    [User 可加自訂 rooms：如 finance / api / ux 等]

  Markdown SoT (backup):
    .agents/workspaces/<ws>/memory/architecture/INDEX.md + entries
    .agents/workspaces/<ws>/memory/strategy_context/INDEX.md + entries
    .agents/workspaces/<ws>/memory/debug_graveyard/INDEX.md + entries
```

### 2.3 Drawers（單一條目）

每 drawer 採源自：

- **Auto-mined**：`mempalace mine <markdown>` 自動採礦（chunk + embed）
- **Manual**：手寫 markdown 後 `mempalace mine` 重採（增量）

不直接以 mempalace API 寫 drawer；以 markdown 檔為 SoT，mempalace 為查詢層。

## 3. 操作流程

> **完整操作流程交由** `skills/memory-operations.md`（PROPOSAL_502_004 D-3 整併；本 schema 只保 shape + INDEX 契約）：
>
> - §2.1 派發前查上下文（情境 A）
> - §2.2 跨 session wake-up（情境 B）
> - §2.3 新增 debug_graveyard 條目（情境 C；含 emergency 路徑）
> - §2.4 strategy_context 變更紀錄（情境 D）
> - §2.5 MCP fail → fallback markdown grep（情境 E；本檔原 §6 已併入）
> - §6 Compress 流程（drawer count > 1000/5000 防護）

## 4. INDEX.md 最小規範（markdown SoT 仍須維護）

雖 MemPalace 自動 indexing，markdown INDEX 仍是 git audit 入口：

### 4.1 architecture/INDEX.md（per workspace）

```markdown
# <ws> Architecture INDEX

| 模組           | 實體路徑    | Owner    | 詳細條目                       |
| -------------- | ----------- | -------- | ------------------------------ |
| budget-control | src/budget/ | @Backend | architecture/budget-control.md |
```

### 4.2 strategy_context/INDEX.md（per workspace）

```markdown
# <ws> Strategy Context INDEX

| 參數                | 值的位置                    | 最近調整   | 詳細條目                                |
| ------------------- | --------------------------- | ---------- | --------------------------------------- |
| position_size_limit | src/config/risk-params.yaml | 2026-04-15 | strategy_context/position-size-limit.md |
```

### 4.3 debug_graveyard/INDEX.md（framework + workspace 共用 schema）

```markdown
# Debug Graveyard INDEX

| ID              | 日期       | Category      | Severity | 一句話                  | 條目                             |
| --------------- | ---------- | ------------- | -------- | ----------------------- | -------------------------------- |
| DG-20260427-001 | 2026-04-27 | serialization | critical | LangGraph state msgpack | DG-20260427-001-msgpack-state.md |
```

## 5. 與 ADR 對應

- **ADR-0001（Stateless Routing）**：MemPalace wake-up 補 cross-session 上下文；不存 routing state（仍由 PENDING_ACTIONS 管）
- **ADR-0034（MCP 整合）**：MemPalace 29 MCP tools 直接接入；統一介面
- **ADR-0037（Iron Themes）**：Memory 機制升級不影響 immutable 治理；正交
- **ADR-0038（Tier Budget）**：Memory 是查詢層；不計入 rule budget
- **ADR-0039（本 backend 採納）**：本 schema 為其執行手冊

## 6. 撰寫禮儀（markdown 條目）

- 條目寫**事實**（症狀 / 根因 / 解法），不寫**情緒**
- 引用 commit / proposal / file path 確保可追溯
- 教訓條目用「✅ / ❌」對照便於快速掃讀
- 條目長度建議 ≤ 200 行；超過拆多個條目
- frontmatter 必填 `room` / `incident_id`（debug）/ `module`（architecture）/ `parameter`（strategy_context）

## 7. 與舊版 v1.0（純 markdown 三房）的相容

- v1.0 markdown 結構完整保留（git history）
- mempalace mine 自動採礦舊條目進 vector store
- 舊 INDEX.md 表格格式不變
- 唯一變更：派發查詢路徑（從 grep markdown → MCP search vector）
