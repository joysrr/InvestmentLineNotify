---
skill_id: assistant-examples
file_type: examples
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  @Assistant 3 組標準 I/O 範例（巡邏摘要 / 阻斷通知 / 全局摘要）
referenced_by:
  - rules/assistant.md
  - skills/templates/global-status-summary-template.md
  - docs/Reports/AUDIT_HISTORY.md
  - docs/agents-overview.md
---

# Skill: @Assistant Few-Shot 範例（3 組）

> 範例覆蓋「巡邏邊界場景」：多級別通知衝突 / PENDING_RED_EXPIRE 觸發 / 巡邏並發。

## 範例 1：多級別通知衝突時的優先級判斷

**情境**：同一巡邏週期內同時偵測到 P-04 🔴 `RETRO_REPEAT` + P-13 🟢 `SUMMARY_STALE`

**輸入**：

```
PENDING_ACTIONS.md 現況：
- 🔴 [BLOCK_042] RETRO_REPEAT：PROPOSAL_20260422_XXX 🚨 反覆問題警告
- 🟢 [INFO_007] SUMMARY_STALE：GLOBAL_STATUS_SUMMARY.md 距上次更新 6 工作對話
```

**@Assistant 應產出**（依 `lead.md §s04 通知接收優先級` + `skills/assistant-user-commands.md`）：

```markdown
## 巡邏輸出（優先級排序）

### 🔴 最優先處理（立即）

- **BLOCK_042** `RETRO_REPEAT`：需 User 明確採納 PROPOSAL_XXX
- User 標準指令：`採納提案 PROPOSAL_20260422_XXX`
- **阻斷效果**：`@Lead` 於 🔴 解除前拒絕啟動新功能

### 🟢 次優先級（下次巡邏前）

- **INFO_007** `SUMMARY_STALE`：@Assistant 下次巡邏自動產出新摘要
- 無需 User 指令；僅註記於巡邏日誌

**動作次序**：先處理 🔴 → 待 User 採納提案 → @Lead 執行合併 → 自動關閉 BLOCK_042
→ 下次巡邏時產出新 SUMMARY（同步關閉 INFO_007）
```

**關鍵遵循**：

- 🔴 / ❌ 優先於 🟡 / ✅ / 🟢（依 `lead.md §s04` 多通知處理順序）
- 🟢 不阻斷新任務派發
- 附上 User 標準指令格式（不得僅說「請處理」）

---

## 範例 2：PENDING_RED_EXPIRE 邊界觸發

**情境**：🔴 項目自產生後已經歷 2 個工作對話（= `PENDING_RED_EXPIRE` 預設值），User 仍未處理

**輸入**：

```
PENDING_ACTIONS.md:
- 🔴 [BLOCK_038] REVIEW_QUALITY：@Reviewer 複審第 2 次仍有 BLOCKER（創建於對話 #12）
- 當前對話序號：#14
- 計數：#14 - #12 = 2 = PENDING_RED_EXPIRE
```

**@Assistant 應產出**：

```markdown
## 🚨 全局緊急阻斷升級通知（依 system-prompt.md §全局緊急阻斷 條件二）

BLOCK_038 已達 `PENDING_RED_EXPIRE` = 2 工作對話未處理閾值：

- 觸發條件：條件二（🔴 超時）
- 觸發時間：對話 #14
- 阻斷範圍：**所有 Agent 派發暫停**

### @Lead 必要動作（不可跳過）

1. 立即停止派發任何新任務
2. 產出緊急通知給 User，附：

- 違規證據（BLOCK_038 詳情）
- 解除條件（User 採納 REVIEW_QUALITY 解除指令）
- User 標準指令：`重新評估實作方案 <功能名稱>`

### 解除後恢復流程（對齊 tasks/emergency-shutdown-playbook.md §二）

1. User 解除阻斷後，@Retro 強制執行根因分析（Model: opus + Lane: heavy）
2. 產出改善提案 → User 採納 → @Lead 執行 → 寫入 AUDIT_HISTORY
3. 阻斷狀態解除
```

**關鍵遵循**：

- PENDING_RED_EXPIRE（預設 2 對話）為 `system-prompt.md §全局緊急阻斷` 條件二觸發點
- 升級後 `@Lead` 必須**暫停所有派發**，不僅是該任務
- 解除後**強制 @Retro 根因分析**（對齊 PROPOSAL_024 `force_complex_scenarios`）

---

## 範例 3：SUMMARY_STALE 與巡邏並發

**情境**：本次巡邏同時觸發 P-13 `SUMMARY_STALE` + P-05 `RETRO_PROPOSAL`（新提案產生）

**輸入**：

```
本週期事件：
1. @Retro 剛產出 PROPOSAL_20260422_YYY（OPEN）→ 觸發 P-05 🟡
2. GLOBAL_STATUS_SUMMARY.md 距上次更新 7 工作對話 > SUMMARY_STALE_THRESHOLD (5) → 觸發 P-13 🟢
```

**@Assistant 應產出**（對齊 `patrol-notification-catalog.md` + `PROPOSAL_20260422_004` 全局摘要機制）：

```markdown
## 巡邏輸出（雙通知處理）

### 🟡 P-05 RETRO_PROPOSAL 寫入 PENDING_ACTIONS

- 新項目 BLOCK_045：PROPOSAL_20260422_YYY 待 User 審查
- User 標準指令：`採納提案 PROPOSAL_20260422_YYY` 或 `拒絕提案 PROPOSAL_20260422_YYY，原因：<說明>`
- **不阻斷新功能**（🟡 級別，依 `lead.md §s04`）

### 🟢 P-13 SUMMARY_STALE 自動產出新摘要

依 `skills/templates/global-status-summary-template.md` 生成新版 GLOBAL_STATUS_SUMMARY.md：

- 覆蓋舊摘要（新版寫入 docs/Reports/）
- 舊摘要歸檔至 archive/summary/（依 SUMMARY_HISTORY_LIMIT = 3 保留）
- 產出後 INFO_007 自動關閉
- **無需 User 指令**（自動關閉條件達成）

### 並發防護

- 本輪 PENDING_ACTIONS.md 單次寫入兩項（BLOCK_045 新增 + INFO_007 關閉），避免 TOCTOU
- 若同時有他 Agent 更新 → 使用 fs.openSync 'wx' 原子鎖（對齊 skills/concurrency-guard-pattern.md）
```

**關鍵遵循**：

- P-13 為 🟢 級別，無需 User 指令即可自動關閉（寫入新摘要）
- P-05 為 🟡 級別，需 User 採納但不阻斷
- 並發寫入 PENDING_ACTIONS.md 需用 concurrency-guard 原子鎖

---

## 對齊的既有規則

- `assistant.md §s04 異常判定標準`：🔴 / 🟡 / 🟢 三級定義
- `assistant.md §s05 巡邏規則表`：P-01~P-20 條件
- `assistant.md §s07 阻斷機制`：🔴 阻斷新功能
- `lead.md §s04 通知接收優先級`：多通知處理順序
- `skills/assistant-user-commands.md`：User 標準指令對照（PROPOSAL_026+030 整合）
- `skills/concurrency-guard-pattern.md`：PENDING_ACTIONS.md 並發寫入保護
- `tasks/emergency-shutdown-playbook.md §二`：🔴 超時升級條件二

## 溯源

本檔案為 PROPOSAL_20260422_030 新建；補齊 PROPOSAL_013 + 015 未覆蓋的 @Assistant。

---

## Related Decisions

- [ADR-0029](../decisions/0029-assistant-patrol-catalog.md) — @Assistant 巡邏規則目錄
- [ADR-0030](../decisions/0030-notification-classification.md) — 通知分級標準
