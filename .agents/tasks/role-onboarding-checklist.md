---
task_id: role-onboarding-checklist
file_type: checklist
owner: @Lead + @Architect
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  新增**角色**（rule.md）的 3 步 onboarding（與專案 onboarding 不同）
referenced_by:
  - docs/agents-overview.md
---

# Task: 新 Agent 報到與設定流程 (Onboarding)

## 用途

在多 Agent 系統中新增一個角色 (Role) 時，必須遵循此 Checklist，以確保新成員能完美融入現有的工作流引擎與阻斷機制。

## Step 1: 建立角色規則檔 (`.agents/rules/<role_name>.md`)

檔案必須包含以下完整結構，並使用 `` 標記結尾：

1. `## 任務目標`
2. `## 核心行為準則 (Rules)`
3. `## 產出物 (Artifacts)`
4. `## 🚫 核心禁止條款 (Anti-Rules)` (必須定義該角色的越界防護與阻斷條件)

## Step 2: 註冊至大總管 (`lead.md`)

- [ ] 在 `## 你的團隊成員 (Team Roster)` 中新增該 Agent 的名稱與簡介。
- [ ] 在 `## 核心工作流引擎 (Workflow Engine)` 中，安插該 Agent 的執行階段 (例如在實作與驗證之間安插資安審查)。

## Step 3: 更新助理通知機制 (Optional)

若該 Agent 會產出新的 🔴 阻斷狀態或 🟡 警告狀態：

- [ ] 修改 `assistant.md`，在狀態判斷表中加入該 Agent 專屬的狀態代碼 (如 `SECURITY_AUDIT_FAIL`) 與觸發條件。
- [ ] 修改 `lead.md` 的 `## 中斷與重啟機制` 表格，定義當 User 排除該狀態後，流程該退回給誰重啟。

---

## Related Decisions

- [ADR-0022](../decisions/0022-rules-metadata-frontmatter.md) — Rules 結構標準化
