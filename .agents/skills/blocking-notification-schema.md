---
skill_id: blocking-notification-schema
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_004
purpose: |
  統一所有阻斷通知（rule_edit_critical / 依賴審查阻斷 / PENDING 🔴 阻斷 / 全局緊急阻斷）
  的格式 schema，避免目前散落於 api-spec-template / assistant.md / lead.md 三處
  的格式漂移風險（Group E 跨情境缺口 C-8）。
referenced_by:
  - rules/lead.md §s_complexity_lane (rule_edit_critical)
  - rules/architect.md §s08 (依賴審查阻斷)
  - rules/assistant.md §s07 (PENDING 🔴 阻斷)
  - rules/system-prompt.md §全局緊急阻斷
  - skills/templates/api-spec-template.md (依賴審查阻斷通知)
related_decision: decisions/0030-notification-classification.md
---

# Skill: 阻斷通知統一格式 Schema

## 為何需要統一

PROPOSAL_20260430_002 重構後評鑑（Group E 跨情境缺口）發現：4 種阻斷通知（rule_edit_critical / 依賴審查 / PENDING 🔴 / 全局緊急）目前格式各異，散落 3+ 處模板：

- `skills/templates/api-spec-template.md` — 依賴審查阻斷通知（🚧 開頭）
- `rules/assistant.md §s07` — PENDING 阻斷（🚫 開頭）
- `rules/lead.md §s_complexity_lane` — rule_edit_critical（無格式範例）
- `rules/system-prompt.md §全局緊急阻斷` — 「立即暫停」散文敘述

格式漂移 → User 看到不同樣式 → 認知負擔 + 易誤判等級。

## 通用 Schema

所有阻斷通知**必依以下 5 欄位結構**輸出：

```
<符號> <一句話標題>

【阻斷類型】<rule_edit_critical | dependency_audit | pending_block | global_emergency>
【觸發條件】<明確條件，含具體數值 / 路徑 / 引用文件>
【影響範圍】<暫停的派發 / 阻塞的工作流階段>
【解除條件】<User 必執行什麼動作才能解除阻斷>
【相關文件】<必引用的 rule / skill / task 路徑>
```

## 4 種阻斷類型對照

### 1. `rule_edit_critical`（量層阻斷）

**符號**：🔴 **觸發**：rules/\*.md token > `rule_token_thresholds.block`（4000）
**範例**：

```
🔴 派發阻斷：lead.md token 超 block 4000

【阻斷類型】rule_edit_critical
【觸發條件】rules/lead.md token=5021 > rule_token_thresholds.block=4000
【影響範圍】所有涉及 lead.md 修改的派發；本次任務暫停
【解除條件】User 派 @Retro 立案拆檔提案 → 採納執行 → token < block
【相關文件】lead.md §s_complexity_lane / rule_token_thresholds.yaml / retro.md §s06
```

### 2. `dependency_audit`（架構阻斷）

**符號**：🚧 **觸發**：`tech-stacks/<指定>` 不存在
**範例**：

```
🚧 架構設計阻斷通知：缺 PostgreSQL Tech Stack 規範

【阻斷類型】dependency_audit
【觸發條件】workspace TECH_STACK.storage 未列 PostgreSQL；對應 tech-stacks/db/postgresql.md 不存在
【影響範圍】無法產 API Spec；@Backend / @Frontend 暫停
【解除條件】User 二擇一：(A) 改用既有技術棧 / (B) 在 .agents/tech-stacks/db/ 建立 postgresql.md
【相關文件】architect.md §s08 / api-spec-template.md / lead.md §s13
```

### 3. `pending_block`（PENDING 🔴 阻斷）

**符號**：🚫 **觸發**：PENDING_ACTIONS.md §🔴 非空時派發新功能
**範例**：

```
🚫 新功能啟動已阻斷

【阻斷類型】pending_block
【觸發條件】PENDING_ACTIONS.md 含 2 個未處理 🔴 項目
【影響範圍】所有新功能派發；本次任務暫停
【解除條件】User 處理以下 🔴：
- [BLOCK_001] REVIEW_QUALITY：reviewer 複審 ≥ 2 次仍 BLOCKER
- [BLOCK_002] SECURITY_AUDIT_FAIL：SC-03 strategyWeight 越權變更
【相關文件】assistant.md §s07 / lead.md §s05 / skills/assistant-user-commands.md
```

### 4. `global_emergency`（全局緊急阻斷）

**符號**：🆘 **觸發**：system-prompt.md §全局緊急阻斷三條件之一
**範例**：

```
🆘 全局緊急阻斷觸發

【阻斷類型】global_emergency
【觸發條件】條件三：直接修改 strategyWeight 數值未經 User 字面授權
【影響範圍】所有 Workflow 暫停（含 Hotfix；除非有 EXEMPTION_LOG）
【解除條件】User 明確發出恢復指令「系統恢復」或「繼續執行」
【相關文件】system-prompt.md §全局緊急阻斷 / lead.md §s11 / strategyweight-change-checklist.md
```

## Hotfix 豁免標注

若 Hotfix 通道豁免某條阻斷（如 condition 二），通知**必加**標注：

```
<原阻斷格式 5 欄位>

【Hotfix 豁免】生產事故觸發 Hotfix: YES；豁免條件二（PENDING 🔴 超期）
【EXEMPTION_LOG】EX-YYYYMMDD-NNN（同步寫入 PENDING_ACTIONS.md §豁免記錄）
【補處理時限】Hotfix 完成後 24h 內必處理舊 🔴
```

## 違反處理

- **絕對禁止** 阻斷通知缺任一 5 欄位（影響 User 解讀）
- **絕對禁止** 自行設計新阻斷符號（必用 🔴 / 🚧 / 🚫 / 🆘 之一）
- **絕對禁止** Hotfix 豁免缺 EXEMPTION_LOG 編號

## 與既有模板的對齊

下次小修訂應**改既有模板引用本 schema**：

- `api-spec-template.md` 依賴審查阻斷通知 → 改用本 schema type 2
- `assistant.md §s07` 阻斷通知 → 改用本 schema type 3

本檔為**唯一 SoT**；任何阻斷通知格式變更**必先**改本檔再同步引用方。

<!-- END: blocking-notification-schema -->
