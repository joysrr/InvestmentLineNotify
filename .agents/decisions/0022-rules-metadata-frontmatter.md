---
adr_id: ADR-0022
title: Rules 結構標準化（YAML frontmatter + XML section）
status: Accepted
date: 2026-04-21
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260421_021
  - PROPOSAL_20260423_014
referenced_by:
  - RULES_METADATA_SCHEMA.md
  - RULES_DESIGN_GUIDE.SCOPE §十一
  - tests/schema-validator.mjs
---

# ADR-0022: Rules 結構標準化（YAML frontmatter + XML section）

## Status

**Accepted** (2026-04-21；METADATA_SCHEMA frontmatter 補齊於 2026-04-24)

## Context

初期 rules/ 結構自由（各檔格式不一）；導致：

- 版本 / 修改提案 / 審計基準等 metadata 無法機械化解析
- 章節邊界不明（LLM 載入時難以精準抓取所需章節）
- 無法支援 dashboard / validator / 索引自動化

## Decision

採用 **方案 C+F** 雙結構化：

### C. YAML frontmatter（metadata）

所有 rules/ 檔案頂端：

```yaml
---
agent_id: <id>
agent_name: "<@Agent>"
file_type: agent_rule | design_guide | schema
version: vX.Y
last_modified: YYYY-MM-DD
last_proposal: PROPOSAL_XXX+PROPOSAL_YYY
audit_baseline: v1.0
trigger: manual | auto
token_budget_ref: TOKEN_ONDEMAND_LIMIT
default_model_tier: simple | medium | complex
workflow_stages: [...]
reports_to: "@<Agent>"
interacts_with: [...]
produces: [...]
references: { ... }
constraints_ref: { ... }
---
```

### F. XML `<section>` 標籤（章節邊界）

所有章節用 `<section>` 包裹：

```xml
<section id="s01" priority="normal">
## 章節標題

章節內容...

<!-- END: 章節標題 -->
</section>
```

**priority 值**：`critical` / `high` / `normal` / `low`
**immutable 屬性**（選用）：`immutable="true"` 禁止結構性變更

### Schema 單一真相

所有 frontmatter 欄位結構由 `RULES_METADATA_SCHEMA.md` 定義（ADR-0022 的 SSOT）。

**驗證**：`tests/schema-validator.mjs` 檢 frontmatter 完整性 + token 預算 + XML section 對稱。

## Consequences

### 正面

- frontmatter 可被 generator 解析（`gen-rules-version-index` / `gen-changelog`）
- section id 支援精準章節載入
- immutable 標記防關鍵章節被誤動（如 `rules/lead.md §s_state_anchor`）
- METADATA_SCHEMA 為 dashboard / CLI 提供統一結構

### 負面 / Tradeoffs

- frontmatter 佔用檔案頭部空間（~30 行）
- `<section>` 標籤對 markdown 純文字閱讀稍干擾
- `constraints_ref` 使用自定義 `!ref` YAML tag；需 validator 支援

## Alternatives Considered

### Alternative A: 純 markdown（無 frontmatter）

**為何不採用**：metadata 無法機械化解析。

### Alternative B: TOML / JSON frontmatter

**為何不採用**：markdown 生態 YAML frontmatter 最通用。

### Alternative C: 方案 A（純 YAML 分離）

**為何不採用**：rules 主體為說明性文字；分離後閱讀體驗差。

## Related Proposals

- PROPOSAL_20260421_021（原始提案：方案 C+F；YAML + XML）
- PROPOSAL_20260423_014（RULES_METADATA_SCHEMA.md frontmatter 補齊；Lite）

## Referenced By

- `RULES_METADATA_SCHEMA.md`（欄位 SSOT）
- `RULES_DESIGN_GUIDE.SCOPE §十一`（版本標頭規範）
- `tests/schema-validator.mjs`（驗證）

## Notes

- 首次導入時 13 rules 全改寫（PROPOSAL_021 Phase 執行）
- `!ref RULES_DESIGN_GUIDE.QUALITY.md#<ANCHOR>` 模式於 ADR-0018 拆檔後自動更新
