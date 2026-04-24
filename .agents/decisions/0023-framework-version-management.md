---
adr_id: ADR-0023
title: Framework Version 管理（FRAMEWORK_VERSION + CHANGELOG）
status: Accepted
date: 2026-04-23
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_001
referenced_by:
  - FRAMEWORK_VERSION
  - CHANGELOG.md
  - scripts/generators/gen-framework-version.mjs
  - scripts/generators/gen-changelog.mjs
  - tasks/framework-upgrade-workflow.md
---

# ADR-0023: Framework Version 管理（FRAMEWORK_VERSION + CHANGELOG）

## Status

**Accepted** (2026-04-23)

## Context

框架為跨專案可搬運資產；多專案並行時需機制判斷「專案當前使用哪個版本 framework」+「是否需升級」。無版本標識則升級決策靠人工比對；易漏失關鍵改動。

## Decision

建立 **雙檔版本治理**：

### FRAMEWORK_VERSION（yaml 格式）

```yaml
framework_version: v5.1
release_date: 2026-04-24
baseline_proposal: PROPOSAL_20260423_015

proposals_included:
  total: 70
  framework: 70
  project: 0

last_included_proposal: PROPOSAL_20260423_015

auditor_baseline:
  last_audit_date: 2026-04-23
  last_audit_score: 4.62
  drift_score: 0.957

notes: |
  ...
```

### CHANGELOG.md（Keep a Changelog 格式）

```markdown
## [v5.1] - 2026-04-24

### Added
- PROPOSAL_20260423_015：...

### Fixed / Changed / Deprecated / Removed / Security

### Notes
- <設計原則 / 對偶說明 / 警告>
```

### 版本號規則

- **Major (+1)**：結構性重組（如 ADR-0018 拆檔 → v4.10 → v5.0）
- **Minor (+1)**：新增章節 / 新 Agent / 新工具
- **Patch**：typo / 純 doc 調整（不強制）

### 升級觸發

- 每次提案 Phase G 必 bump（minor 或 major）
- 可透過 `scripts/generators/gen-framework-version.mjs --bump minor --proposal <id> --write` 自動化
- CHANGELOG 條目可透過 `gen-changelog.mjs --proposal <path> --write` 自動 prepend

### 多專案升級流程

`tasks/framework-upgrade-workflow.md` 規範：
1. 比對專案當前 `FRAMEWORK_VERSION` vs 最新
2. 透過 `scripts/framework-diff.mjs` 列差異
3. 人工審查 workspace 相容性
4. 套用升級 + 驗證

## Consequences

### 正面

- 多專案版本對齐機械化
- CHANGELOG 提供清晰演進歷史
- drift_score 等關鍵指標追蹤
- 與 ADR-0025（AUTO-GENERATED）協同：generators 自動維護版本

### 負面 / Tradeoffs

- 每提案 Phase G 必 bump（增加工作量；但已由 generator 自動化）
- CHANGELOG Notes 段落仍需人工填寫
- 多專案時需手動觸發各專案升級比對

## Alternatives Considered

### Alternative A: 不標版本（靠 git log）

**為何不採用**：多專案並行時難以快速判斷相對版本。

### Alternative B: 僅 FRAMEWORK_VERSION（無 CHANGELOG）

**為何不採用**：版本跳號不足以說明變更內容；CHANGELOG 補充。

## Related Proposals

- PROPOSAL_20260423_001（原始提案：skills/tasks 專案特化參照 + 框架版本治理）

## Referenced By

- `FRAMEWORK_VERSION`（yaml SSOT）
- `CHANGELOG.md`（Keep a Changelog 條目）
- `scripts/generators/gen-framework-version.mjs`（bump 自動化）
- `scripts/generators/gen-changelog.mjs`（條目自動化）
- `tasks/framework-upgrade-workflow.md`（多專案升級 SOP）

## Notes

- 當前 framework 版本 v5.1（PROPOSAL_20260423_015 baseline）
- 下次 major bump 預期為 PROPOSAL_016 完成後（v5.x → v6.0）
