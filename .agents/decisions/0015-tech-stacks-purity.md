---
adr_id: ADR-0015
title: Tech-Stacks 純淨原則（三分法 + 6 鐵律）
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
extended_by: [ADR-0031]
related_proposals:
  - PROPOSAL_20260422_022
  - PROPOSAL_20260423_017
referenced_by:
  - RULES_DESIGN_GUIDE.SCOPE §十六
  - tech-stacks/*.md
  - tech-stacks/MANIFEST.yaml
  - WORKSPACE_SCHEMA.yaml
---

# ADR-0015: Tech-Stacks 純淨原則（三分法 + 6 鐵律）

## Status

**Accepted** (2026-04-22)

## Context

`tech-stacks/` 最初混雜通用技術規範 + 專案特定路徑（如 `src/modules/strategyEngine.mjs`）+ 部署特定規格（如 `Oracle VM 24GB`）。跨專案搬運時需大量清洗；且 tech-stacks / skills / domains 三者邊界模糊。

## Decision

建立 **三分法** + **tech-stacks 6 鐵律**：

### 三分法

| 目錄           | 內容定位                                     | 跨專案適用性  |
| -------------- | -------------------------------------------- | ------------- |
| `tech-stacks/` | 特定技術實踐規範（某語言 / 框架 / 平台 SDK） | ✅ 跨專案通用 |
| `skills/`      | 技術無關流程 / 模板 / 跨技術模式             | ✅ 跨專案通用 |
| `domains/`     | 業務領域知識（量化投資 / 電商 / SaaS）       | ❌ 僅該業務   |

### Tech-Stacks 6 鐵律

1. 不得含專案特定路徑 → 改 workspace 欄位引用
2. 不得含專案特定命名 → 改通用範例 + workspace 引用
3. 不得含部署平台特定規格 → 移至 workspace `DEPLOYMENT_CONSTRAINTS`
4. 必須引用 workspace 欄位而非硬編碼數值
5. 必須含 §專案特化參照 + MACHINE_READABLE anchor
6. Fallback 策略明文化（每 workspace 欄位缺失時的降級行為）

### 命名規則

- 扁平命名（無子分類目錄）；以前綴語意分組
- 同前綴 ≥ 5 份 → 強制升級子目錄
- 命名衝突 → 加後綴明確化

## Consequences

### 正面

- 搬運新專案時 tech-stacks 零改寫
- skills / tasks 亦同樣純淨（借鑑此原則）
- domains 明確為專案特定（不需搬運）
- `@Auditor §2.2` scope 純度檢查機械化

### 負面 / Tradeoffs

- 既有 tech-stacks 需歷史清洗（PROPOSAL_022 執行已完成）
- 新增 tech-stacks 時需遵守 6 鐵律（學習成本）
- Fallback 策略需為每個 workspace 欄位明文（增加工作量）

## Alternatives Considered

### Alternative A: 允許有限度專案特定字串

**為何不採用**：邊界難劃；專案債務累積。

### Alternative B: 合併 tech-stacks / skills

**為何不採用**：語義不同（特定技術規範 vs 跨技術模式）；合併反增混淆。

## Related Proposals

- PROPOSAL_20260422_022（原始提案：tech-stacks 純淨分離 + WORKSPACE_SCHEMA SSOT）

## Referenced By

- `RULES_DESIGN_GUIDE.SCOPE §十六`（完整規範）
- `tech-stacks/*.md`（6 鐵律遵守）
- `WORKSPACE_SCHEMA.yaml`（欄位 SSOT）
- `tests/workspace-schema-validator.mjs`（驗證）

## Notes

- 與 ADR-0002（workspace 注入）設計一致：框架純淨 + 專案實值分離
- 與 ADR-0016（F1/F2/F3 分類）互補：§十六 規範結構層；F 分類規範 skills/tasks 內容屬性
- 2026-04-24 由 ADR-0031 extended：新增 Catalog 架構（分類子目錄 + MANIFEST + 選擇性搬運 + vendor 安全準則）；6 鐵律 + 純淨原則保持不變
