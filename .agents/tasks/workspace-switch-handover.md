---
task_id: workspace-switch-handover
file_type: workflow
owner: "@Lead"
version: v1.0
last_modified: 2026-05-02
last_proposal: PROPOSAL_20260502_014
purpose: |
  workspace 切換時 PENDING_ACTIONS / ROUTING_TICKET 狀態 snapshot/restore SOP。
  解決 Sim-E S20 發現的 per-workspace state isolation 缺失。
referenced_by:
  - rules/lead.md §s_state_anchor
  - tasks/session-start-checklist.md
  - skills/templates/pending-actions-template.md
related_decisions:
  - ADR-0001 # Stateless Routing；本 SOP 補位 cross-workspace state
  - ADR-0002 # Workspace 注入；workspace 為唯一 active 概念
---

# Task: Workspace Switch Handover（mid-task workspace 切換交接 SOP）

> PROPOSAL_502_014 N-2 補建；解決 27 情境模擬 Sim-E S20「workspace switch mid-task 無 SOP」。
> 對齊 `lead.md §s_state_anchor` 三鐵律 + `iron-rules/lead-state-anchor.md`。

---

## 觸發條件

任一情況觸發本 SOP：

1. User 下令「切換 workspace 至 `<new_ws>`」
2. User 下令「從 `<new_ws>` 切回 `<old_ws>`」
3. `@Lead` 偵測 `PENDING_ACTIONS.md §🏠 ACTIVE_WORKSPACE` ≠ `.agents/CURRENT_WORKSPACE`（漂移；可能手動編輯造成）
4. `init-workspace.mjs` 切換 CURRENT_WORKSPACE 完成後（自動觸發）

---

## 5 步 SOP（PROPOSAL_502_014 N-2）

### Step 1：Snapshot 當前 workspace 狀態

```bash
OLD_WS=$(cat PENDING_ACTIONS.md | grep "🏠 ACTIVE_WORKSPACE:" | sed 's/.*: //')
mkdir -p .agents/workspaces/$OLD_WS/state-snapshots/
cp PENDING_ACTIONS.md .agents/workspaces/$OLD_WS/state-snapshots/PENDING_ACTIONS.snapshot.md
[ -f .agents/ROUTING_TICKET.md ] && cp .agents/ROUTING_TICKET.md .agents/workspaces/$OLD_WS/state-snapshots/ROUTING_TICKET.snapshot.md
```

snapshot 加 timestamp header：「Snapshot at `<ISO>` from active session」。

### Step 2：驗證 snapshot 完整

```bash
test -f .agents/workspaces/$OLD_WS/state-snapshots/PENDING_ACTIONS.snapshot.md
diff -q PENDING_ACTIONS.md .agents/workspaces/$OLD_WS/state-snapshots/PENDING_ACTIONS.snapshot.md  # 應同
```

snapshot 失敗 → 阻斷切換；通知 User。

### Step 3：寫 CURRENT_WORKSPACE 至新 workspace

```bash
echo "$NEW_WS" > .agents/CURRENT_WORKSPACE
```

### Step 4：Restore 新 workspace 狀態（如有歷史 snapshot）

```bash
NEW_SNAP=.agents/workspaces/$NEW_WS/state-snapshots/PENDING_ACTIONS.snapshot.md
if [ -f "$NEW_SNAP" ]; then
  cp "$NEW_SNAP" PENDING_ACTIONS.md
  # 將 §🏠 ACTIVE_WORKSPACE 修為 $NEW_WS（snapshot 內可能還是舊的）
else
  # 第一次切換至新 workspace；依 pending-actions-template 建立空殼（fresh init；PROPOSAL_502_013 M-2）
  # 由 @Assistant 首次巡邏觸發；@Lead 通知
  echo "fresh init for $NEW_WS"
fi
```

### Step 5：mempalace wake-up（新 workspace 上下文）

```bash
mempalace wake-up   # 自動取新 workspace Wing 的 L0+L1 上下文
```

對齊 `init-workspace.mjs runMempalaceWakeup()`（PROPOSAL_502_003 C-3）；mempalace 不可達 → 靜默降級（hybrid fallback；ADR-0039）。

---

## Decision Tree

| 情境                                      | 動作                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| ✅ 切到新 workspace 且有歷史 snapshot     | Step 1 + 2 + 3 + 4（restore）+ 5                                               |
| ✅ 切到新 workspace 且**無**歷史 snapshot | Step 1 + 2 + 3 + 4（fresh init；@Assistant 首次巡邏建空殼）+ 5                 |
| 🟡 偵測 ACTIVE_WORKSPACE 漂移（不一致）   | 通知 User → 確認方向（保留當前 / 對齊 CURRENT_WORKSPACE）→ 走對應流程          |
| 🔴 snapshot 失敗（磁碟錯 / 寫入失敗）     | 阻斷切換；通知 User；修復後重試                                                |
| 🔴 mid-task 🔴 PENDING 未解               | 通知 User：「當前 workspace 有 🔴 阻斷項；切換將 snapshot 該狀態。是否繼續？」 |

---

## 禁止行為

- **絕對禁止** snapshot 前直接覆蓋 CURRENT_WORKSPACE（會丟失當前狀態）
- **絕對禁止** 跳過 snapshot Step（即使切回剛離開的 workspace）
- **絕對禁止** restore snapshot 時不更新 §🏠 ACTIVE_WORKSPACE 標頭
- **絕對禁止** mid-task 🔴 PENDING 切換時不通知 User

---

## 與其他規則對齊

- `rules/lead.md §s_state_anchor`：三鐵律狀態錨點
- `iron-rules/lead-state-anchor.md`：派發鐵律（不可變主題）
- `tasks/session-start-checklist.md` Step 2：ACTIVE_WORKSPACE 標頭驗證觸發本 SOP
- `skills/templates/pending-actions-template.md`：§🏠 ACTIVE_WORKSPACE 標頭定義
- `scripts/init-workspace.mjs runMempalaceWakeup()`：Step 5 wake-up 共用

---

## 溯源

- 建立提案：PROPOSAL_20260502_014 N-2
- 立檔背景：27 情境模擬 Sim-E S20「PENDING_ACTIONS / ROUTING_TICKET 在 root；workspace 切換污染狀態；無 SOP」
- 觸發 Agent：`@Lead`（自動觸發）+ `init-workspace.mjs`（CURRENT_WORKSPACE 變更後）

**修訂方式**：透過 `RULE_UPDATE_PROPOSAL`。

---

## Related Decisions

- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless Routing；本 SOP 為 cross-workspace state 補位
- [ADR-0002](../decisions/0002-workspace-context-injection.md) — Workspace 注入；workspace 為唯一 active 概念
- [ADR-0039](../decisions/0039-mempalace-memory-backend.md) — Memory Palace；wake-up Step 5 對齊
