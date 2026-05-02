# .agents/iron-rules/ — Iron Themes（跨切不可變鐵律）

> 由 PROPOSAL_20260501_002 + ADR-0037 建立。
> 跨 ≥ 2 rules 共用、或滿足判定 4 原則的 immutable 鐵律 first-class artifact。

---

## 目錄

- [背景](#背景)
- [Theme 清單](#theme-清單)
- [Frontmatter Schema](#frontmatter-schema)
- [新增 Theme 流程](#新增-theme-流程)
- [Validator 整合](#validator-整合)
- [與 rules/ 的關係](#與-rules-的關係)

---

## 背景

當 immutable 鐵律重複出現於多個 `rules/*.md` 時，convention-based `<section immutable="true">` 機制有以下缺陷：

- 跨檔同名 immutable 漂移（修改一處未同步另一處）
- 無 SoT（每處都是「副本」）
- structural immutability 弱（靠 attribute 不靠路徑）

`iron-rules/` 把跨切鐵律升為 first-class artifact，每 theme 一檔，雙向一致性由 `iron-theme-validator` 強制。

---

## Theme 清單（6 themes 全列；PROPOSAL_20260501_004 W-3 補完）

### 跨切 themes（≥ 2 rules 共用）

| Theme                        | 路徑                              | 共用 rules（applies_to）                                       | 套用判定                     |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------- | ---------------------------- |
| machine-readable-output      | `machine-readable-output.md`      | reviewer / qa / security                                       | 跨切共用 + 5 條鐵律          |
| data-deletion-zero-tolerance | `data-deletion-zero-tolerance.md` | backend / consultant / project_lead / security / system_prompt | 跨切共用 + 跨 Agent 安全邊界 |
| parallel-review-boundary     | `parallel-review-boundary.md`     | reviewer / security / **project_lead**                         | 跨切共用 + 4 防線            |

### Solo themes（單 rule；PROPOSAL_002 Phase H 抽出）

| Theme                 | 路徑                       | applies_to   | 套用判定                     |
| --------------------- | -------------------------- | ------------ | ---------------------------- |
| lead-state-anchor     | `lead-state-anchor.md`     | project_lead | 三大鐵律 + ADR-0001 核心     |
| assistant-hci-summary | `assistant-hci-summary.md` | assistant    | HCI 雙軌 + 5 區塊 + 5 條鐵律 |
| auditor-rubric-iron   | `auditor-rubric-iron.md`   | auditor      | 4 條 anti-rules + ADR-0005   |

---

## Frontmatter Schema

```yaml
---
theme_id: <kebab-case-id>
file_type: iron_theme
version: v<major>.<minor>
last_modified: YYYY-MM-DD
last_proposal: PROPOSAL_*
audit_baseline: v1.0
immutable: true
applies_to: [<agent_id>, ...] # 引用本 theme 的 rules
modification_policy: |
  本檔變動必經提案流程；commit-time iron-theme-validator 檢查 diff；
  違反觸發 system-prompt.md §全局緊急阻斷條件三（rules 直修）
---
```

---

## 新增 Theme 流程

1. **判定**：是否符合 ADR-0037 §Theme 判定 4 原則（任一）
   - 跨切共用 ≥ 2 rules
   - > 200 tokens immutable content
   - 跨 Agent 安全邊界
   - ≥ 3 鐵律密度
2. **立案**：走標準提案流程（@Retro 產提案 → @Lead 採納）
3. **建檔**：新建 `iron-rules/<theme>.md` + 完整 frontmatter
4. **改 rules**：對應 rules 加 `applies_iron_themes` + 1 行入口 section
5. **驗證**：`bash .agents/tests/run-all.sh --validator iron_theme` 雙向一致性 PASS
6. **CHANGELOG**：本提案產 entry

---

## Validator 整合

### iron-theme-validator（run-all.sh 第 13 個）

雙向一致性檢查：

- 每 theme `applies_to` 列出的 agent 必有對應 rule，且 rule frontmatter `applies_iron_themes` 包含本 theme
- 每 rule `applies_iron_themes` 列出的 theme 必存在於 `iron-rules/`，且 theme `applies_to` 包含本 agent
- 違反 → exit 1（warn）

Commit-time diff 檢查（pre-commit hook）：

- theme 內容變動 → 必有對應提案 reference（last_proposal 必更新）
- 違反 → exit 2（block；對齊 ADR-0001 三鐵律精神）

### schema-validator 升級

- 識別 `applies_iron_themes`；驗證每 theme 存在
- Rule budget 只算自身 mutable bytes（theme 不混算；ADR-0037 §Validator 配套）
- iron_theme file_type budget：warn=600 / block=1000（PROPOSAL_004 校準）

---

## 與 rules/ 的關係

| 軸           | rules/                                 | iron-rules/                                |
| ------------ | -------------------------------------- | ------------------------------------------ |
| 內容性質     | mutable 操作細則                       | immutable 跨切鐵律                         |
| 修改路徑     | 提案 + reviewer 自律                   | 提案 + iron-theme-validator 強制           |
| Audit        | git history per rule                   | git history per theme                      |
| Token budget | warn=1000(worker) / 1800(orchestrator) | warn=600 / block=1000（PROPOSAL_004 校準） |
| ADR          | ADR-0036（4 patterns）                 | ADR-0037（4 判定 + 雙向一致）              |

修改流程差異：

- 改 rule mutable → 走 PROPOSAL_ADOPT 流程
- 改 iron theme → 走 PROPOSAL_ADOPT + iron-theme-validator + 同步審查所有 `applies_to` rules

---

## 維護紀錄

- 2026-05-01：初版建立（PROPOSAL_20260501_002 Phase A）
