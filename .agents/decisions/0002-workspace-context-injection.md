---
adr_id: ADR-0002
title: Workspace-based Project Context 靜態注入
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_002
  - PROPOSAL_20260422_006
referenced_by:
  - rules/lead.md §任務目標
  - rules/retro.md §任務目標
  - WORKSPACE_SCHEMA.yaml
  - workspaces/README.md
---

# ADR-0002: Workspace-based Project Context 靜態注入

## Status

**Accepted** (2026-04-22)

## Context

`.agents/` 框架為跨專案可搬運資產；rules/skills/tasks 必須描述**通用行為**，不可硬編碼專案特定資訊（如模組路徑、業務規則、部署限制）。歷史上 rules 內曾混入 InvestmentLineNotify 特定路徑，導致搬運新專案時需大量重寫。同時，LLM 任務執行仍需專案脈絡（如「修這個 cron 錯誤」需知道 cron 在哪個檔案）。

## Decision

建立 **Core Soul（通用行為）vs Project Context（專案實值）** 二元分離架構：

1. **Core Soul 層**：`rules/*.md` / `skills/*.md` / `tasks/*.md` 僅定義**通用行為框架**；不含專案特定字串
2. **Project Context 層**：`workspaces/<project>.md` 儲存專案特定實值（`PROJECT_CONTEXT` / `TECH_STACK` / `CRITICAL_PATHS` / `DEPLOYMENT_CONSTRAINTS` / `BUSINESS_RULES` 等）
3. **策略 A 靜態注入**：`@Lead` 派發子 Agent 前讀取當前 workspace（由 `.agents/CURRENT_WORKSPACE` 指向），將對應欄位合併至任務提示
4. **WORKSPACE_SCHEMA SSOT**：所有 workspace 欄位結構由 `.agents/WORKSPACE_SCHEMA.yaml` 單點定義（驗證器以此為準）

違反偵測：
- `@Assistant` 巡邏 P-12 `WORKSPACE_MISSING` — 無 `CURRENT_WORKSPACE` 時 🔴 阻斷
- `workspace-schema-validator` 檢查 workspace 欄位完整性

## Consequences

### 正面

- 框架搬運零衝突：複製 `.agents/` 後換一個 workspace 即可
- LLM 讀 rules 時不被專案雜訊干擾
- Workspace 可版本控制；跨專案升級框架時 workspace 單獨管理
- 多專案並行（一個 repo 多個 workspace）架構可行

### 負面 / Tradeoffs

- 增加一層抽象（rules → workspace → 實值）
- 新 Agent / 新規則需明確區分「通用」vs「專案特定」；認知成本稍高
- Fallback 策略需為每個 workspace 欄位定義（缺失時阻斷 / 警告 / 略過）

## Alternatives Considered

### Alternative A: 在 rules 中允許有限度專案特定字串

**為何不採用**：邊界難劃；易累積專案債務；搬運時仍需審查每一條規則。

### Alternative B: 動態注入（LLM 運行時從專案掃描）

**為何不採用**：成本高（每次需掃專案）、不可預測（LLM 可能錯判脈絡）、難以驗證。

## Related Proposals

- PROPOSAL_20260422_002（原始提案：workspaces/ 架構 + project-onboarding）
- PROPOSAL_20260422_006（意圖繼承修補；補充 PROPOSAL-011 的業務脈絡錨定）

## Referenced By

- `rules/lead.md §任務目標`（workspace 讀取義務）
- `rules/retro.md §任務目標`（workspace 注入註記）
- `WORKSPACE_SCHEMA.yaml`（欄位結構 SSOT）
- `tasks/project-onboarding.md`（新專案初始化 SOP）
- `scripts/init-workspace.mjs`（互動式 CLI）

## Notes

- 搬運新專案時：複製 `.agents/` + 移除舊 `workspaces/<old>/` + `init-workspace --name <new>`
- workspace 欄位 fallback 策略必填於每個 F2 類 skill/task 的「§專案特化參照」章節
- 本決策為框架搬運可行性的基礎設計
