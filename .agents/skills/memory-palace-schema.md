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
    refactor_log        — refactor/rename/impact 事件摘要（PROPOSAL_502_036；ADR-0041 v3）
    index               — workspace 索引 drawer（PROPOSAL_502_035 onboarding Step 4.5）
    [User 可加自訂 rooms：如 finance / api / ux 等]

  Markdown SoT (backup):
    .agents/workspaces/<ws>/memory/architecture/INDEX.md + entries
    .agents/workspaces/<ws>/memory/strategy_context/INDEX.md + entries
    .agents/workspaces/<ws>/memory/debug_graveyard/INDEX.md + entries
```

### 2.2.0 Framework vs Workspace Wing 判定 Flowchart（PROPOSAL_502_038 G-E4 修補）

寫 drawer 時若不確定該入 `framework` wing 還是 `<workspace_id>` wing：

```
touched_files 主要在 .agents/ 內（rules / skills / tasks / decisions 等）？
  └─ Yes → framework wing
  └─ No → 進下一步

touched_files 主要在 src/ / docs/ / 業務碼 / workspace 設定？
  └─ Yes → <workspace_id> wing（CURRENT_WORKSPACE）
  └─ No → 混合 → 主要影響哪邊就歸哪邊

特殊：
  - 框架 API / 套件 / Concurrency 踩坑 → framework/debug_graveyard
  - 業務邏輯 / endpoint / UI 踩坑 → <ws>/debug_graveyard
  - 跨 workspace 通用 lesson → framework；單 workspace lesson → <ws>
```

模糊時 default 走 `<workspace_id>`（避免污染 framework wing）。

### 2.2.1 GitNexus Summary Drawer Template（PROPOSAL_502_036；ADR-0041 v3）

寫入 room=`refactor_log` 的標準 template：

```yaml
# Header（前 5 行；mempalace embedding index 前 ~256 token）
File: <event_topic> # 例 "rename getUserOrders"
Type: refactor | impact_analysis | debug_root_cause | onboarding_index
Wing: <workspace_id>
Tags: <comma-separated; 含 symbol 名稱>
Summary: <one-line takeaway; ≤80 chars>
---
# Body（≤200 chars 摘要 + 結構化欄位；caller list 永不寫死於此）
event_type: refactor | impact | debug | onboarding
symbol: <function or module name>
aliases: [] # PROPOSAL_502_042 GR-H3；rename 後舊名清單；search embedding 命中舊名亦可找到（如 [getUserOrders] for new fetchUserOrders drawer）
decision: <what was decided / done>
regenerate_via: "gitnexus impact <symbol>" # ← 鐵律 2-A：caller list 改用指針而非寫死
caller_count_at_write: 0 # PROPOSAL_502_042 GR-H1；數字快照（不寫 list；保 audit trail 時間切片）
commit_hash_at_write: <git rev-parse HEAD> # PROPOSAL_502_042 GR-H1；commit hash；audit 「當時影響面」+「現在影響面」雙視角
last_verified_at: <ISO8601>
related_drawers: [<list of drawer_id>] # 同 wing 相關 drawer
superseded_by_drawer_id: null # update 時填（解 G-E2 衝突仲裁；同 room 才可 supersede；見下方 R3-C2 鐵律）
split_into_symbols: [] # PROPOSAL_502_041 + PROPOSAL_502_043 R3-C1 拆 type；結構性 drift 1→N 拆分時填 symbol 名 list
split_into_drawer_ids: [] # 同上；新拆 drawer 的 id list（語意層；含跨 wing 但 cross-room 用此標）
merged_from_symbols: [] # PROPOSAL_502_043 R3-C1 拆 type；結構性 drift N→1 合併時填 symbol 名 list
superseded_drawer_ids: [] # 替代既有 merged_from 模糊；同 wing 可加；跨 wing/不同 room 改用 cross_referenced
cross_referenced_drawer_id: [] # PROPOSAL_502_043 R3-C2；跨 wing/room 性質不同 drawer 用此（不視為 supersede；保 lesson 不過期）
body: <事件摘要；≤200 chars>
```

**跨 wing/room supersede 鐵律**（PROPOSAL_502_043 R3-C2）：

- ❌ **絕對禁止** 跨 room 用 `superseded_by_drawer_id`（如 architecture room drawer 不該被 refactor_log room drawer supersede）
- ❌ **絕對禁止** debug_graveyard 條目被 supersede（lesson 不過期；race condition 教訓恆有效）
- ✅ 跨 wing/room 改用 `cross_referenced_drawer_id`（不切斷 search 鏈；保 lesson）
- ✅ debug_graveyard 條目隨 refactor 變化 → update_drawer 加 `last_verified_at` + `affected_symbol_renamed_to: <new>`（不 supersede）

**為何不寫死 caller list**：

- GitNexus per-repo `.gitnexus/` 索引可重建；每次 `gitnexus analyze` 結果 fresh
- 若 caller list 寫死進 drawer → 半年後 rename / refactor 後過期 → drawer 變死資料
- 鐵律 1「mempalace 永遠是 SoT」反讓 agent 信任過期資訊
- 改寫 `regenerate_via` 指針 → drawer 永遠 fresh；agent 需要 caller 時動態查 GitNexus

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
