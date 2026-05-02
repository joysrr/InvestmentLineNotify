---
adr_id: ADR-0014
title: Prior Art Scan 強制程序（預防重複造輪子）
status: Accepted
date: 2026-04-23
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260423_002
referenced_by:
  - rules/architect.md §前置強制階段
  - rules/lead.md Prior Art Verification Gate
  - skills/checklists/prior-art-scan-checklist.md
  - skills/templates/prior-art-report-template.md
  - RULES_DESIGN_GUIDE.QUALITY §十八
---

# ADR-0014: Prior Art Scan 強制程序

## Status

**Accepted** (2026-04-23)

## Context

歷史上多次發現：@Backend / @Frontend 實作某功能後，`@Retro` 於審計時發現「既有套件 / 既有內部模組已有類似功能」，造成重工 / 代碼重複 / 維護成本上升。需要**事前預防**機制。

## Decision

建立 **Prior Art Scan 三階段強制程序**：

1. **A 階段：@Planner User Story 欄位**
   - 必填 `existing_solution_hint`（粗篩；User 已知相關套件 / 模組）

2. **B 階段：@Architect 前置強制階段**（6 步驟 DoD）：
   1. 掃 npm / 內部 skills / 內部 tech-stacks 搜尋關鍵字
   2. 列 ≥ 2 候選方案
   3. 比對採納 / 不採納理由
   4. 快取結果於 workspace `EVALUATED_PACKAGES` 欄位（`workspaces/<ws>.md` yaml；非獨立 .md 檔；PROPOSAL_502_014 N-5 勘誤）
   5. 產 `docs/plans/prior-art/<feature>.md`（PROPOSAL_502_014 N-5 勘誤；原文 `prior-art-report/` 為 typo；rules/skills/templates 全用 `prior-art/`）
   6. 提交 @Lead Gate Check

3. **C 階段：@Lead Prior Art Verification Gate**
   - 強制 HITL：User WebSearch 驗證結論
   - 未通過 → 阻斷實作

**禁止行為**：

- 跳過 Prior Art Scan 直接實作
- workspace `EVALUATED_PACKAGES` 欄位未更新

## Consequences

### 正面

- 重工風險顯著降低
- workspace `EVALUATED_PACKAGES` 欄位形成組織記憶（未來新專案搬運可帶）
- @Architect 職責擴充但合理（架構師本就應掌握技術生態）
- 與 ADR-0012（診斷組，事後修復）成「事前預防 vs 事後修復」語意對偶

### 負面 / Tradeoffs

- 新功能開發前置時間增加（A+B+C 階段 ~30 min）
- HITL Gate 依賴 User 可用性
- 小型修正可能不需要（Fast Lane 可豁免）

## Alternatives Considered

### Alternative A: 事後審計（@Reviewer / @Retro 發現重複再修）

**為何不採用**：重工成本高；代碼已寫 / 測試已做。

### Alternative B: 只建議不強制

**為何不採用**：執行者傾向略過；流程紀律難維持。

## Related Proposals

- PROPOSAL_20260423_002（原始提案：Prior Art Scan 強制程序 A+B 組合）

## Referenced By

- `rules/architect.md §前置強制階段`（6 步驟 DoD）
- `rules/lead.md` Prior Art Verification Gate
- `skills/checklists/prior-art-scan-checklist.md`（F2 類）
- `skills/templates/prior-art-report-template.md`（F1 類）
- `RULES_DESIGN_GUIDE.QUALITY §十八`（完整規範）

## Notes

- 與 ADR-0008 / 0012（Hotfix 三支柱）成語意對偶：事前預防 vs 事後修復
- workspace `EVALUATED_PACKAGES` 欄位快取是組織記憶資產；搬運新專案時建議保留
