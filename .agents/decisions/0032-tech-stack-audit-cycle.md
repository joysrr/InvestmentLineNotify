---
adr_id: ADR-0032
title: Tech-Stack 生命週期 Audit 機制（定期審視 + 初步篩選）
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
extends: [ADR-0031]
related_proposals:
  - PROPOSAL_20260424_018
referenced_by:
  - WORKSPACE_SCHEMA.yaml
  - scripts/tech-stack-manage.mjs
  - scripts/init-workspace.mjs
  - tasks/agent-onboarding-flow.md
  - skills/patrol-notification-catalog.md
  - rules/assistant.md
  - rules/lead.md
---

# ADR-0032: Tech-Stack 生命週期 Audit 機制（定期審視 + 初步篩選）

## Status

**Accepted** (2026-04-24)

## Context

ADR-0031（Tech-Stacks Catalog）確立分類 + MANIFEST + 選擇性搬運，但**只覆蓋生命週期上半段**（新增 / 移除）；缺乏「**已裝但未使用**」的偵測與清理機制。

User 2026-04-24 回饋：

> 一開始使用者可能不會篩選，選擇全面使用，所以希望 @Lead 可以在專案 init 完成後提醒使用者，甚至是定期提醒使用者是否要執行檢查刪除不必要的 tech-stack

問題：

1. **新 User 低認知負擔入場**與 **Catalog 精簡**之間存在張力：
   - 若強迫 init 時精選 → 學習成本高，流程摩擦大
   - 若任其全裝 → 3-6 個月後多餘 stacks 成為噪音 / token 浪費
2. **無 audit 提醒機制**：
   - @Assistant patrol catalog（ADR-0029）未覆蓋 tech-stack 閒置偵測
   - workspace schema 無 audit 時間戳欄位
3. **agent 無法主動發起**：
   - 當前 agent 只被動服從 User 指令
   - 「定期審視」此類**主動建議**流程在框架無先例

## Decision

建立 **Tech-Stack 定期 Audit 機制**，擴充 ADR-0031 的 catalog 生命週期：

### 1. Workspace Schema 擴充（SSOT）

`WORKSPACE_SCHEMA.yaml` v1.3 `TECH_STACK` block 新增兩欄位：

```yaml
TECH_STACK:
  last_audit_date: # YYYY-MM-DD；init 自動填當天；audit 執行時更新
    type: string
    required: false
  audit_interval_days: # 預設 30；User 可依專案性質調整
    type: integer
    required: false
    default: 30
```

**特性**：非 required（舊 workspace 相容）；`init-workspace` 自動填，**不**問 User。

### 2. Audit 指令（CLI）

`scripts/tech-stack-manage.mjs audit` 新指令：

- **引用統計**（初步篩選依據）：
  - `refs_in_rules`：掃 `rules/skills/tasks/docs/*.md` 中 `tech-stacks/<category>/<name>` 路徑字串出現次數
  - `refs_in_workspace`：掃當前 workspace md 檔（同上 + `stack.name` 關鍵字）
  - `refs_in_code`（`--deep` 模式骨架；未來實作）：grep workspace `PATHS.project_root`
- **分級建議**（`categorizeUsage`）：
  - total === 0 → `remove-candidate` 🔴
  - total ≤ 3 → `audit-candidate` 🟡
  - total > 3 → `keep` 🟢
- **逐個確認**：per-stack `[k]eep / [r]emove / [s]kip` 互動
- **反向依賴檢查**：被其他 installed stacks 依賴者強制跳過
- **批次最終確認**：列出所有要刪者 → 再次 `[y/N]`
- **無** `--yes-all` 類旗標（避免誤刪）
- 成功後自動更新 workspace `last_audit_date = today`

### 3. @Assistant P-23 巡邏

新 patrol 規則 `TECH_STACK_AUDIT_OVERDUE`：

- **觸發**：每次 session 啟動
- **邏輯**：讀 workspace `last_audit_date` 與 `audit_interval_days`；若 `today - last_audit_date > audit_interval_days` → 產 PENDING_ACTIONS.md 通知
- **通知級別**：💡 Hint（ADR-0030）；**不阻斷** 新任務
- **條件消失**：User 執行 audit（`last_audit_date` 更新）→ 巡邏自動關閉
- **防呆**：同 workspace OVERDUE 只保留一筆

### 4. Init Post-Reminder

`init-workspace.mjs` 完成後 `printPostGuide` 追加：

- 提示「30 天後執行 `tech-stack-manage audit`」
- 提及 @Assistant P-23 會自動提醒
- 說明刪除需 User 逐個確認（agent 只出建議）

### 5. @Lead 觸發時機

`rules/lead.md §6.4` Tasks Mapping 新增：

- User 觸發語（"開新專案" 類）→ `tasks/agent-onboarding-flow.md`
- audit 過期（P-23 偵測到）→ 派任務前傳達 User

### 6. Agent 角色職責（安全鐵律）

**核心安全準則**（User 2026-04-24 明確要求）：

| Agent                     | 可以做                           | 不可以做                        |
| ------------------------- | -------------------------------- | ------------------------------- |
| @Assistant                | 偵測過期 + 產通知 + 顯示引用統計 | 自動執行 audit / 自動刪除 stack |
| `tech-stack-manage audit` | 出初步篩選建議 + 互動引導        | 跳過 User 逐個確認              |
| @Lead                     | 引用本 task + 提醒 User          | 替 User 拍板刪除                |

**絕不實作**：

- `--yes-all` 類旗標
- 定時任務自動刪除
- 「超過 N 天無 audit 自動移除」規則

## Consequences

### 正面

- **入場門檻降低**：User init 時可選全裝（Enter = all），無需當下決策
- **生命週期完整**：Catalog 從「裝 / 移除」升級為「裝 / 審視 / 移除」
- **防噪音累積**：30 天節奏定期清理，避免 6 個月後變垃圾場
- **Agent 主動化**：@Assistant 主動提醒 + @Lead 傳達（符合「定期提醒」訴求）
- **安全可控**：永遠 User 逐個拍板；agent 只出建議
- **可選擇跳過**：User 可 bump `audit_interval_days` 推遲 / 永久關閉

### 負面 / Tradeoffs

- workspace schema 擴充 2 欄位（非 required；向後相容）
- @Assistant patrol 增加一條（P-23；計算成本低：讀 workspace md + 一次日期運算）
- audit 指令學習曲線（但有互動 UI 引導）
- 引用統計為**啟發式**（可能漏判或誤判；因此必須 User 拍板）

### 中性

- 與 ADR-0031 相容：本 ADR 為 catalog 生命週期擴充，不推翻分類 / MANIFEST / 選擇性搬運
- 與 ADR-0029 相容：P-23 是第 23 條巡邏規則，沿用 ADR-0029 機制

## Alternatives Considered

### Alternative A: 不加機制，靠 User 主動清理

**為何不採用**：人類遺忘週期 < 30 天；多數 User 不會主動清理；訴求（「定期提醒」）明文要求。

### Alternative B: 定時自動刪除（cron / scheduled job）

**為何不採用**：

- 與 ADR-0024 零依賴衝突（需 cron runtime）
- 違反「User 拍板」安全原則
- 誤刪風險不可逆

### Alternative C: 只做 audit 指令，無 patrol 提醒

**為何不採用**：User 若忘記跑 → 機制形同虛設；patrol 提醒是觸發 audit 的關鍵。

### Alternative D: 強制 init 時精選（不支援全裝）

**為何不採用**：User 明確反對（「一開始使用者可能不會篩選，選擇全面使用」）。

## Related Proposals

- PROPOSAL_20260424_018（本 ADR 原提案）
- PROPOSAL_20260423_017（ADR-0031：Catalog 基礎架構）— Extends

## Referenced By

- `WORKSPACE_SCHEMA.yaml` v1.3 — 新 2 欄位
- `scripts/tech-stack-manage.mjs audit` — CLI 實作
- `scripts/init-workspace.mjs` — post-init reminder
- `tasks/agent-onboarding-flow.md` §Step 5 — 交棒時引用
- `skills/patrol-notification-catalog.md §A P-23` — 巡邏規則
- `rules/assistant.md` — P-23 巡邏執行
- `rules/lead.md §6.4` — @Lead 觸發時機

## Notes

- 與 ADR-0030 通知分級相容：本 ADR 通知採 💡 Hint 級（不阻斷）
- User 可透過 `audit_interval_days` 個性化節奏：
  - 短專案（< 2 週）→ 可設 7 天
  - 穩定長專案（半年以上）→ 可設 90 天
  - 框架實驗專案 → 可設 14 天
- 未來擴充方向（不在本 ADR 範圍）：
  - `--deep` 真實作（grep project source code）
  - audit 歷史紀錄表（audit_log.md）
  - 多 workspace 統一 audit 儀表板
