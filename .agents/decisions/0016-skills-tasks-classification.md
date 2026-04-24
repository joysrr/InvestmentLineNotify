---
adr_id: ADR-0016
title: skills/tasks 三態分類（F1/F2/F3）+ 專案特化參照
status: Accepted
date: 2026-04-23
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_001
referenced_by:
  - RULES_DESIGN_GUIDE.SCOPE §十六.F
  - skills/*.md F2 類檔案
  - tasks/*.md F2 類檔案
  - tests/workspace-schema-validator.mjs
---

# ADR-0016: skills/tasks 三態分類（F1/F2/F3）+ 專案特化參照

## Status

**Accepted** (2026-04-23)

## Context

ADR-0015 規範 tech-stacks 純淨；但 skills/ 與 tasks/ 檔案性質更多元：
- 有的是純模板（如 `review-report-template.md`）→ 無 workspace 依賴
- 有的引用 workspace 欄位（如 `concurrency-guard-pattern.md` 引用 `PATHS.source_modules.concurrency`）
- 若無明確分類，搬運新專案時無法判斷哪些需要補 workspace 實值

## Decision

建立 **F1/F2/F3 三態分類**：

| 類別 | 定義 | 範例 | workspace 依賴 |
|------|------|------|---------------|
| **F1**（純通用）| 純模板 / 純流程 / 純 Prompt Fragment；無專案特定實值 | `review-report-template.md` | ❌ 無 |
| **F2**（通用 + 專案特化參照）| 通用規則 + 引用 workspace 欄位 | `concurrency-guard-pattern.md` | ✅ 必含 §專案特化參照 |
| **F3**（專案特定）| 只適用特定專案 | — | ❌ 應遷移至 workspace 實值 |

**F2 類強制格式**：檔案末尾加「§專案特化參照」章節（+ MACHINE_READABLE anchor）：
```markdown
<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: <name>
-->

## 🔗 專案特化參照

> 本 <skill|task> 描述通用原則；專案特定實值由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念 | Workspace 欄位 | Fallback 行為 |
|---|---|---|
| <概念 A> | <WORKSPACE_SCHEMA 欄位路徑> | 阻斷 / 升級 / 警告 / 略過 |
```

**違規偵測**：
- F2 缺 §專案特化參照 → 🟡 `@Auditor §2.2` 扣分
- F3 類內容出現於 skills/tasks → 🔴 應遷移至 workspace
- referenced_by 反向索引斷鏈 → 🟡 `workspace-schema-validator` 扣 0.5 分

## Consequences

### 正面

- skills/tasks 搬運可攜性清晰（F1 直接搬；F2 搬 + workspace 補實值；F3 不搬）
- `@Auditor` scope 純度檢查機械化
- WORKSPACE_SCHEMA.yaml 成為 F2 引用的 SSOT
- 歷史盤點已完成（9 份 F2；餘為 F1）

### 負面 / Tradeoffs

- F2 檔案需維護 §專案特化參照 + Fallback 策略（增加工作量）
- 邊界案例（F1/F2 含糊）需人工判斷
- MACHINE_READABLE anchor 為機讀格式；人類讀略顯冗餘

## Alternatives Considered

### Alternative A: 不分類（所有 skills 都視為通用）

**為何不採用**：F2 類實際依賴 workspace；搬運時易斷鏈。

### Alternative B: 二分（通用 vs 專案特定）

**為何不採用**：F2 佔多數；需明確區分「通用含引用」vs「純通用」。

## Related Proposals

- PROPOSAL_20260423_001（原始提案：skills/tasks 專案特化參照規範；Part 1-6 合併）

## Referenced By

- `RULES_DESIGN_GUIDE.SCOPE §十六.F`（完整規範）
- `skills/*.md` 中 9 份 F2 類
- `tasks/*.md` 中 2 份 F2 類（project-onboarding / emergency-shutdown-playbook）
- `tests/workspace-schema-validator.mjs`（驗證 F2 §專案特化參照）

## Notes

- 與 ADR-0015（tech-stacks 純淨）協同：§十六 規範結構層；本 ADR 規範 skills/tasks 內容屬性
- 與 ADR-0002（workspace 注入）互補：workspace 提供實值；本 ADR 規範如何引用
- F2 歷史盤點：9 份（7 skills + 2 tasks）已完成補 §專案特化參照
