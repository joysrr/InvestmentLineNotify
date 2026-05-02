---
adr_id: ADR-0037
title: Iron Themes — 跨切不可變鐵律 first-class artifact 治理
status: Accepted
date: 2026-05-01
supersedes: []
superseded_by: []
extends: [ADR-0022, ADR-0036]
related_proposals:
  - PROPOSAL_20260501_002
  - PROPOSAL_20260501_001 # 收尾發現 11/13 需 exception；本 ADR 為根因解決
referenced_by:
  - iron-rules/machine-readable-output.md
  - iron-rules/data-deletion-zero-tolerance.md
  - iron-rules/parallel-review-boundary.md
  - rules/reviewer.md
  - rules/qa.md
  - rules/security.md
  - rules/backend.md
  - rules/lead.md
  - rules/consultant.md
---

# ADR-0037: Iron Themes — 跨切不可變鐵律治理

## Status

**Accepted** (2026-05-01)

## Context

PROPOSAL_20260501_001 完成 13 rules slim-down 後，發現 11/13 需 `token_budget_exception` flag。深度稽核揭露**真正的架構問題**（非 budget 數字問題）：

### 真實 SoT 違反

| 跨切主題                         | 散布處                                                                                | 現象                    |
| -------------------------------- | ------------------------------------------------------------------------------------- | ----------------------- |
| 機讀產出物 5 條鐵律              | review.md / qa.md / security.md（均 §s_output_strict）                                | 同名同內容 3 處複製     |
| 資料刪除 + strategyWeight 零容忍 | backend.md s06 / consultant.md s07 / security.md s02 / lead.md s11 / system-prompt.md | 5 處散布；變更需動 5 檔 |
| 平行審查職責互斥                 | reviewer.md s10 / security.md s02+s07                                                 | 2-3 處部分重複          |

### 既有 immutable 機制的缺陷

1. **convention-based**：靠 `<section immutable="true">` attribute + reviewer 自律
2. **無跨檔一致性檢查**：schema-validator 只查單檔 diff；不偵測跨檔同名 immutable 漂移
3. **與 mutable 內容混雜**：同檔 token budget 計算混算 immutable bytes（不公平）

PROPOSAL_20260501_002 採 Option E（Iron Themes）作根因解決。

## Decision

訂立 **Iron Themes** 機制：跨切不可變鐵律從 `rules/*.md` 抽出為 first-class artifact，存於新目錄 `.agents/iron-rules/`。

### 核心原則

1. **First-class artifact**：iron theme 是獨立檔案，不是 section attribute；structural immutability 強過 convention
2. **Cross-cutting first**：theme 抽出條件側重「跨切共用」；非跨切的 immutable 暫保留 inline
3. **Bidirectional binding**：theme `applies_to` ↔ rule `applies_iron_themes` 雙向一致；validator 強制
4. **正交於 ADR-0036**：本 ADR 規範 immutable；ADR-0036 規範 mutable；token budget 機制各自獨立計算

### Theme 判定 4 原則（任一成立即抽）

1. **跨切共用**：≥ 2 rules 含同名同內容 immutable section
2. **大尺寸**：單一 immutable section > 200 tokens
3. **跨 Agent 安全邊界**：涉 strategyWeight / 資料刪除 / 金鑰管理 / 全局緊急阻斷
4. **鐵律密度**：≥ 3 條獨立「絕對禁止」/「絕對不可」條款

### 不抽（保留 inline）的判定

1. **內容因 Agent 而異** 的 anti-rules（consultant 唯讀 / qa 職責隔離 / reviewer 退件上限 / auditor 評分）— 結構同模式但內容不重複
2. **與 rule mutable 內容緊密耦合** 的 immutable（抽出後 mutable 失語意）

### 檔案結構

```
.agents/
  rules/                              ← mutable 操作細則（agent_rule type）
    lead.md
    security.md
    ...
  iron-rules/                         ← immutable 跨切鐵律（iron_theme type；新）
    machine-readable-output.md        ← review/qa/security 共用
    data-deletion-zero-tolerance.md   ← backend/lead/security/consultant/system-prompt 共用
    parallel-review-boundary.md       ← reviewer/security 共用
    [Phase H solo themes 後續評估]
  decisions/
    0037-iron-themes-...              ← 本 ADR
```

### Iron Theme frontmatter Schema

```yaml
---
theme_id: <kebab-case-id>
file_type: iron_theme # 新 file_type；ADR-0022 schema 升級
version: v<major>.<minor>
last_modified: YYYY-MM-DD
last_proposal: PROPOSAL_*
audit_baseline: v1.0
immutable: true # 整檔不可變（對齊 schema-validator 強制）
applies_to: [<agent_id>, ...] # 引用本 theme 的 rules
modification_policy: |
  本檔變動必經提案流程；commit-time iron-theme-validator 檢查 diff；
  違反觸發 system-prompt.md §全局緊急阻斷條件三（rules 直修）
---
```

### Rule 引用機制

```yaml
# rules/<agent>.md frontmatter 新增
applies_iron_themes:
  - machine-readable-output
  - data-deletion-zero-tolerance
```

Rule 內保留 1-行入口 section（priority=critical，不降級）：

```markdown
<section id="s_output_strict_ref" priority="critical">
## 機讀產出物強制規範

**完整 5 條鐵律**：`iron-rules/machine-readable-output.md`（不可變主題；本 Agent 適用）

</section>
```

### Validator 配套

#### 1. iron-theme-validator（新；run-all.sh 第 13）

- 掃 `iron-rules/*.md`
- 雙向一致性：每 theme `applies_to` 列出的 rules 必有 `applies_iron_themes` 引用本 theme（反之亦然）
- commit-time diff 檢查：theme 內容變動必有對應提案 reference
- 退出碼：0=ok / 1=warn（一致性 drift）/ 2=error（unauthorized diff）

#### 2. schema-validator 升級

- 識別 `applies_iron_themes` frontmatter
- Rule budget 只算 rule 自身 mutable bytes（theme 內容由 iron-theme-validator 另算）
- iron_theme file_type 套用獨立 budget（warn=600 / block=1000；PROPOSAL_004 校準至實際密度；典型 theme 約 300-700 tokens）

#### 3. rule-token-budget-validator 簡化

- 移除「混算 immutable bytes」邏輯
- token_budget_exception flag 保留作 mutable-only escape hatch（語意更清晰）

### Context Loader 整合

`scripts/lib/rule-loader.mjs`（新建）：

```javascript
export function loadRuleWithThemes(agentId) {
  const rule = readRule(agentId);
  const themes = (rule.frontmatter.applies_iron_themes || []).map((id) =>
    readIronTheme(id),
  );
  return {
    rule,
    themes,
    totalContext: rule.body + themes.map((t) => t.body).join("\n"),
  };
}
```

@Lead 派發前 require 此 lib；確保 themes 注入子 Agent context。

## Alternatives Considered

| 方案                                                                      | 為何不採                                                                    |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **A: Per-rule immutable extraction**（每 immutable 抽至獨立檔；15+ 新檔） | 跨切共用無 SoT；output-strict 仍重複 3 處                                   |
| **B: Single aggregator IMMUTABLE_RULES.md**（全 immutable 彙整）          | 違反單一職責；長期變 monolith；tight coupling                               |
| **C: Schema-validator 排除 immutable bytes**（不改結構；改 budget 公式）  | 遮蔽真實 token 成本；future context 規劃基於錯誤數據；surprise failure 風險 |
| **D: Tier-based budget（meta/worker/orchestrator）**                      | 不解決 immutable 本質；只調整 budget 數字；跨切重複未消除                   |
| **E: Theme-based aggregators**（本決策）                                  | ✅ 跨切升 first-class；strongest SoT；structural immutability               |

## Consequences

### Positive

- **SoT 強化**：output-strict 3→1；data-deletion 5→1；parallel-arbitration 2→1（重複 100% 消除）
- **Structural immutability**：檔案 + 路徑強過 attribute convention；攻擊面縮小
- **Audit clarity**：每 theme 獨立 git history；跨檔變動集中於 iron-rules/
- **Cross-cutting concerns first-class**：DDD shared-kernel 模式；演化路徑清晰
- **Budget 語意精確**：rule budget 只算 mutable；exception flag 用途變窄（mutable-only）

### Negative / Trade-offs

- **概念新增**：iron_theme file_type + applies_iron_themes + applies_to 三個 schema 欄位
- **Composition 複雜度**：context loader 需組合 rule + themes；@Lead 派發路徑加一步
- **Theme 設計爭議**：邊角情境的判定可能爭議；交 @Architect / @Retro 仲裁
- **Solo themes 抽出 ROI 低**：Phase H 評估；可選抽

### 套用範圍 / 不套用

| 套用                                                  | 不套用                          |
| ----------------------------------------------------- | ------------------------------- |
| 跨 ≥ 2 rules 同名 immutable section                   | 內容因 Agent 而異的 anti-rules  |
| > 200 tokens 大 immutable section                     | 與 mutable 緊密耦合的 immutable |
| 跨 Agent 安全邊界（strategyWeight / 資料刪除 / 金鑰） | 純流程 SOP（屬 skill 範疇）     |
| ≥ 3 鐵律密度                                          | 單條鐵律（inline 即可）         |

## Validation

- 首次套用：PROPOSAL_20260501_002 Phase B-D（3 主要跨切 themes）
- 量測：跨切重複數 0；schema-validator 0 error；iron-theme-validator 雙向一致 100%
- drift_score 不退化（baseline 0.865）

## Notes

- 本 ADR 與 ADR-0036（Rule Decomposition Patterns）正交：ADR-0036 規範 mutable 縮減，本 ADR 規範 immutable 治理
- 本 ADR 與 ADR-0022（rules frontmatter）相容：擴充 schema，不破壞既有 rules
- token_budget_exception flag（PROPOSAL_20260501_001 引入）保留作 mutable-only escape hatch；採用本 ADR 後預期使用率下降
- 與 ADR-0001（Stateless Routing）兼容：themes 透過 ROUTING_TICKET 注入下游 Agent context
- Phase H（solo themes）為後續可選工作；本 ADR 不強制執行
