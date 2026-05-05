---
task_id: session-start-checklist
file_type: workflow
owner: "@Lead"
version: v1.0
last_modified: 2026-05-02
last_proposal: PROPOSAL_20260502_008
purpose: |
  跨 session 恢復 SOP：User 從靜默期返回 / 新 Claude Code session 開啟時，
  @Lead 啟動 5 步檢核避免讀 stale state 派錯階段。
  PROPOSAL_502_008 H-4 補 Phase B audit 點名缺口。
referenced_by:
  - rules/lead.md §s_state_anchor
  - rules/lead.md §s_memory_palace
  - skills/memory-operations.md §2.2
  - docs/PRODUCTION_READINESS.md
---

# Task: Session Start Checklist（跨 session 恢復 SOP）

> 對齊 ADR-0001 stateless routing；解 Phase D Risk #5（H × M）— 用戶數週靜默後返回時 PENDING_ACTIONS / ROUTING_TICKET / drawer 可能 stale，須有單一 SOP 重建上下文。

---

## 觸發條件

任一情況觸發本 SOP：

1. 新 Claude Code session 開啟（`/clear` 後第一個提示）
2. User 從 ≥ `PATROL_OVERDUE`(5) 工作對話靜默期返回
3. @Lead 偵測 `ROUTING_TICKET.md` / `PENDING_ACTIONS.md` 可能 stale（last_modified 異常老）
4. User 明示「重新開始 / 從哪裡接續」

---

## 5 步 SOP

### Step 1：讀 active workspace

```bash
cat .agents/CURRENT_WORKSPACE
# 確認：當前指向哪個 workspace（如 agent_framework）
# 缺失或無效 → 視為 P-12 WORKSPACE_MISSING；阻斷新功能；要求 User 執行 init-workspace 或切換
```

### Step 2：讀 PENDING_ACTIONS §🎯 [CURRENT_STAGE]

```bash
grep -A 10 "🎯\|CURRENT_STAGE" PENDING_ACTIONS.md | head -20
# 確認三鐵律 5 欄位：
#   - workflow_stage（10 階段中哪一階段）
#   - current_agent（哪個 sub-agent 在執行）
#   - last_artifact（最後產出物路徑）
#   - blocking_red_count（🔴 數）
#   - last_updated（時間戳）
# 若 blocking_red_count > 0 → 阻斷新指令；先處理 🔴
```

**結果分支**（PROPOSAL_502_013 M-1 + PROPOSAL_502_014 N-1 加 ACTIVE_WORKSPACE 校驗）：

- ✅ 檔案存在 + §🎯 完整 + **§🏠 ACTIVE_WORKSPACE = .agents/CURRENT_WORKSPACE** → 進 Step 3
- 🟡 檔案存在 + §🎯 缺/損毀 → 通知 User；走 P-12 like 修復流程
- 🟡 **§🏠 ACTIVE_WORKSPACE ≠ CURRENT_WORKSPACE 漂移**（PROPOSAL_502_014 N-1）→ 觸發 `tasks/workspace-switch-handover.md` 5 步 SOP
- 🟢 **檔案不存在** → 視為 **fresh init**（新專案 / @Assistant 尚未首跑）→ 跳 Step 3 + Step 4 → 進 Step 5 走 fresh init 路徑（不阻斷）

### Step 3：mempalace wake-up（跨 session 上下文）

```bash
mempalace wake-up
# L0+L1 上下文（~600-900 tokens）：最近活動 + 重要 entities
# 整合進 @Lead 對 User 新指令的初步判斷
# MCP unreachable → 降級 markdown grep（hybrid fallback；ADR-0039）
```

失敗處置：

- mempalace 套件不可達 → 通知 User + 降級 hybrid fallback
- wake-up 超時 → 跳 Step 4；Memory Palace 視為「降級可讀但不完整」

### Step 4：檢視 ROUTING_TICKET 是否 stale（dual check：工作對話 + wall-clock）

```bash
ls -lh .agents/ROUTING_TICKET.md   # 確認 last_modified
# Stale 判定（任一；PROPOSAL_502_014 N-4 加 wall-clock fallback）：
#   - last_modified 距今 > 5 工作對話（PENDING_ACTIONS §🎯 [CONVERSATION_COUNTER] 差值）
#   - **wall-clock 距今 > 7 天**（補工作對話 counter 失準場景；如數週靜默期）
#   - referenced_files 已不存在 / 已 git mv
#   - workflow_stage 與 PENDING_ACTIONS §🎯 [CURRENT_STAGE] 不一致
```

> **Dual check 設計理由**（PROPOSAL_502_014 N-4 解 Sim-D S17）：
> 「工作對話」counter 跨 session 持續累計但無檔案載體（直到 N-4 加 [CONVERSATION_COUNTER] 才解）；數週真實時間流逝在 counter 上反映為 0 對話 → 純依 counter 失準。wall-clock 7 天為 fallback 觸發。

Stale → @Lead **不**自動 resume 派發；觸發 Step 5。

### Step 5：Resume vs Restart 決策

| 情境                                                | 動作                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ State 一致 + 無 🔴 + ROUTING_TICKET fresh        | resume：依 PENDING_ACTIONS §🎯 派下一階段                                                                                                                                                                                                                                                           |
| 🟡 有 🔴 PENDING                                    | 阻斷；先請 User 處理 🔴（依 assistant.md §s07）                                                                                                                                                                                                                                                     |
| 🟡 ROUTING_TICKET stale                             | 暫停派發；摘要當前狀態（5 鐵律欄位 + wake-up 上下文）給 User；請 User 確認 resume / 重新派發                                                                                                                                                                                                        |
| 🔴 CURRENT_WORKSPACE 缺失                           | 阻斷；走 P-12 WORKSPACE_MISSING 流程                                                                                                                                                                                                                                                                |
| 🔴 wake-up 完全失敗 + markdown SoT 也讀不到         | 阻斷；通知 User Memory Palace 完全降級；待修復                                                                                                                                                                                                                                                      |
| 🟢 **fresh init**（PROPOSAL_502_013 M-1）           | PENDING_ACTIONS 不存在 + 無 ROUTING_TICKET → @Lead 通知 User「fresh init 狀態；@Assistant 將於首次工作對話結束時依 `skills/templates/pending-actions-template.md` 自動建立 PENDING_ACTIONS（PROPOSAL_502_013 M-2）」；**不阻斷**接受新指令；wake-up 上下文（如有）作為輔助參考                      |
| 🟢 **fresh init 自修復**（PROPOSAL_502_023 A-2）    | **舊 ROUTING_TICKET 存在但 PENDING_ACTIONS 不存在** → @Lead 視為前次 session 異常終止 → auto-archive 舊 ROUTING_TICKET 至 `.agents/archive/routing-tickets/<timestamp>-<original_id>.md`（保留審計軌跡）→ fresh init 路徑接續；通知 User「偵測舊 ROUTING_TICKET 但 state lost；已歸檔避免重複派發」 |
| 🟢 **`.pending/` 目錄保證**（PROPOSAL_502_023 A-1） | @Lead 第一動作 `mkdir -p .agents/memory/.pending`（idempotent）；確保 mempalace MCP down fallback 寫 buffer 不會 ENOENT；`init-workspace.mjs` 已建此目錄；session 重啟後仍須校驗                                                                                                                    |

---

## 禁止行為

- **絕對禁止** 跳過 Step 2（讀 PENDING_ACTIONS §🎯）直接派新工作（違反 ADR-0001 stateless 三鐵律 #1）
- **絕對禁止** mempalace wake-up 失敗時不通知 User（lead.md §s_memory_palace 絕對禁止條款）
- **絕對禁止** ROUTING_TICKET stale 時自動推進階段（破壞工作流連續性）
- **絕對禁止** 偽裝「state OK」掩飾驗證失敗（解除阻斷必明文）

---

## 與其他規則對齊

- `rules/lead.md §s_state_anchor`：三鐵律狀態錨點
- `rules/lead.md §s_memory_palace`：MCP fallback 通知 User
- `iron-rules/lead-state-anchor.md`：派發鐵律不可變條款
- `skills/memory-operations.md §2.2`：wake-up 操作細則
- `tasks/audit-retro-coordination.md Step 0`：審計協作的 wake-up 步驟（同模式）
- `docs/PRODUCTION_READINESS.md §1`：launch gate validator 對齊

---

## 溯源

- 建立提案：PROPOSAL_20260502_008 H-4
- 立檔背景：完整 pre-launch 評鑒（4 並行 audit subagent）Phase B 點名「無單一 session start SOP；散在各處導致 1-month 靜默後返回有風險」
- 觸發 Agent：`@Lead`（每次 session 啟動 / @Assistant 偵測 staleness 通知時）

**修訂方式**：透過 `RULE_UPDATE_PROPOSAL`。

---

## Related Decisions

- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless Routing；本 SOP 補 wake-up 入口
- [ADR-0039](../decisions/0039-mempalace-memory-backend.md) — MemPalace primary；wake-up 上下文來源
- [ADR-0034](../decisions/0034-langgraph-dual-env-integration.md) — MCP 整合；wake-up CLI 對應
