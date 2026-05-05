---
agent_id: rules_metadata_schema
agent_name: "Rules Metadata Schema"
file_type: schema
version: v1.0
last_modified: 2026-04-21
last_proposal: PROPOSAL_20260421_021+PROPOSAL_20260423_014
audit_baseline: v1.0
trigger: manual
maintained_by: "@Retro"
---

# RULES_METADATA_SCHEMA

> 本文件依 PROPOSAL-021 建立，定義所有 `.agents/` Rules 文件的
> **YAML frontmatter + XML `<section>` 標籤統一規範**。
> User 與未來自動化工具（驗證器、dashboard、rules CLI 等）
> 以本檔為單一事實來源（SSOT）。
>
> 適用範圍：`.agents/RULES_DESIGN_GUIDE.md` + `.agents/rules/*.md` 共 13 份。
> 不適用於：`skills/` / `tasks/` / `domains/` / `tech-stacks/` / 索引 / 提案檔案。

- **版本**：v1.0
- **最後修改**：2026-04-21
- **建立依據**：PROPOSAL-021
- **維護者**：`@Retro`（透過 `RULE_UPDATE_PROPOSAL` 提案更新）

---

## 一、檔案結構總覽

每份 Rules 文件採三層結構：

```
第 1 層：YAML Frontmatter（機器可讀 metadata）
---
<YAML 欄位>
---

第 2 層：H1 標題 + 版本標頭（人類摘要）
# Role: ...
***
版本：vX.Y
最後修改：...
修改提案：...
修改摘要：...
審計基準：vX.Y
***

第 3 層：Markdown Body + XML <section> 標籤（人類說明 + LLM 注意力錨點）
<section id="task_goal" priority="normal">
## 任務目標
...（markdown 敘事內容）
</section>

<section id="parallel_review" priority="critical" immutable="true">
## 平行審查與衝突仲裁規則
...
</section>
```

### 設計原則

- **第 1 層**：機器與 LLM 讀取；User 可略讀
- **第 2 層**：human-first，供 User 快速掌握檔案狀態
- **第 3 層**：markdown body 保留原有敘事，XML 標籤僅為「邊界 + 權重」標注，**不改動內文字**

---

## 二、YAML Frontmatter Schema

### 2.1 共用欄位（所有 rules 必備）

| 欄位                   | 型別        | 必要 | 範例                                                       | 說明                                                                                                                                                                                     |
| ---------------------- | ----------- | :--: | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent_id`             | string      |  ✅  | `project_lead` / `system_prompt` / `design_guide`          | 小寫底線格式；`system-prompt.md` 用 `system_prompt`、`RULES_DESIGN_GUIDE.md` 用 `design_guide`                                                                                           |
| `agent_name`           | string      |  ✅  | `"@Lead"` / `"System Prompt"` / `"Rules Design Guide"`     | 顯示用；Agent 角色含 `@` 前綴                                                                                                                                                            |
| `file_type`            | enum        |  ✅  | `agent_rule` / `always_on` / `design_guide` / `iron_theme` | 區分四類檔案；`iron_theme` 為 PROPOSAL_20260501_002 + ADR-0037 引入（跨切不可變鐵律 first-class artifact）                                                                               |
| `version`              | semver-like |  ✅  | `v1.1`                                                     | 對齊 PROPOSAL-019 版本標頭                                                                                                                                                               |
| `last_modified`        | date (ISO)  |  ✅  | `2026-04-21`                                               | 最後修改日                                                                                                                                                                               |
| `last_proposal`        | string      |  ✅  | `PROPOSAL-021`                                             | 最近影響此檔的提案                                                                                                                                                                       |
| `audit_baseline`       | version     |  ✅  | `v1.0`                                                     | 上次 `@Retro` 審計時版本                                                                                                                                                                 |
| `trigger`              | enum        |  ✅  | `manual` / `always_on`                                     | 載入時機；AlwaysOn 文件用 `always_on`                                                                                                                                                    |
| ~~`token_budget_ref`~~ | ~~string~~  |  ❌  | —                                                          | **REMOVED on 2026-05-02 by PROPOSAL_502_007**（W-4 lingering 清理）；ADR-0038 後改用 `rule_category` tier-based 機制（meta/worker/orchestrator/iron_theme）；13 rules frontmatter 已全清 |

### 2.2 Agent 專屬欄位（`file_type: agent_rule`）

| 欄位                       | 型別        |             必要             | 範例                                                      | 說明                                                                                                                                                                                                                                                |
| -------------------------- | ----------- | :--------------------------: | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow_stages`          | list        |              ⭕              | `[審查, 資安審查]`                                        | 此 Agent 在 Workflow 10 階段中參與的階段                                                                                                                                                                                                            |
| `reports_to`               | string      |              ⭕              | `"@Lead"` / `user`                                        | 回報對象                                                                                                                                                                                                                                            |
| `interacts_with`           | list        |              ⭕              | `["@Reviewer", "@Backend"]`                               | 協作 Agent                                                                                                                                                                                                                                          |
| `produces`                 | list        |              ⭕              | `[SECURITY_REPORT.md, ADVICE_*.md]`                       | 產出物                                                                                                                                                                                                                                              |
| `references`               | map         |              ⭕              | 見 §2.3                                                   | 引用其他文件章節                                                                                                                                                                                                                                    |
| `constraints_ref`          | map         |              ⭕              | 見 §2.3                                                   | 引用 §十四 參數                                                                                                                                                                                                                                     |
| `project_aware`            | boolean     |              ⭕              | `false`（推薦，通用）/ `true`（過渡例外）                 | 依 PROPOSAL_20260422_002 新增：是否綁定特定專案（`true` 需搭配 `migration_target_version`，每次 `@Retro` 審計時評估是否可降為 `false`）                                                                                                             |
| `project_context_ref`      | string      |              ⭕              | `workspaces/current`                                      | 指向 workspace 讀取來源；預設 `workspaces/current` 代表依 `.agents/CURRENT_WORKSPACE` 動態決定                                                                                                                                                      |
| `migration_target_version` | string      |              ⭕              | `v1.4`                                                    | 僅當 `project_aware: true` 時填寫，標注預計完成通用化的目標版本                                                                                                                                                                                     |
| `applies_iron_themes`      | list        |              ⭕              | `[machine-readable-output, data-deletion-zero-tolerance]` | PROPOSAL_20260501_002 + ADR-0037 引入：本 rule 引用的 iron themes（跨切不可變鐵律）；對應 `iron-rules/<theme_id>.md`；**PROPOSAL_502_022 O-1：harness loader 應只載此清單列舉的鐵律；空 list = 此 rule 不主動需鐵律（仍可在執行中需要時 lazy 載）** |
| `load_priority`            | enum        |              ⭕              | `eager` / `lazy`                                          | **PROPOSAL_502_022 O-2 引入**（skill 專用）：harness loader 提示；`eager` = 隨 system prompt 預載；`lazy`（default for skill ≥ 3000 tokens）= LLM 主動 Read 才載；rule 一律 eager（不需此欄位）                                                     |
| `size_tokens_approx`       | int         |              ⭕              | `8280`                                                    | **PROPOSAL_502_022 O-2 引入**：approximate token size for loader budget decisions                                                                                                                                                                   |
| `load_when`                | string      |              ⭕              | `"@Lead 需查 §六 完整細則時"`                             | **PROPOSAL_502_022 O-2 引入**：lazy skill 載入時機說明，協助 LLM 判斷是否需開檔                                                                                                                                                                     |
| `rule_category`            | enum        | ✅（agent_rule / always_on） | `meta` / `worker` / `orchestrator`                        | PROPOSAL_20260501_003 + ADR-0038 引入：tier-based budget 分類；判定 4 原則見 ADR-0038（任一滿足→orchestrator；否則→worker；file_type=always_on→meta）                                                                                               |
| ~~token_budget_exception~~ | ~~boolean~~ |            ~~⭕~~            | ~~廢止~~                                                  | **PROPOSAL_20260501_003 + ADR-0038 廢止**：原 PROPOSAL_001 escape hatch；採 tier budget 後不再需要                                                                                                                                                  |

#### 2.2.0 Tier-based Budget Table（ADR-0038）

| `rule_category` | warn budget | block budget | 適用 file_type |
| --------------- | ----------- | ------------ | -------------- |
| `meta`          | 500         | 1000         | always_on      |
| `worker`        | 1500        | 2500         | agent_rule     |
| `orchestrator`  | 1800        | 3000         | agent_rule     |

判定 orchestrator 條件（任一滿足）：

1. Cross-Agent 派發職責（派發 / Gate Check / 收斂）
2. 多階段流程管理（≥ 3 個工作流階段或狀態流轉）
3. 跨時序整合（跨多工作對話 / Sprint 累積分析）
4. Hub 性質（其他 Agent 訊息流的中介點）

不滿足任一 → worker。`file_type=always_on` 自動 meta。

### 2.2.1 Iron Theme 專屬欄位（`file_type: iron_theme`）

> 由 PROPOSAL_20260501_002 + ADR-0037 引入；跨切不可變鐵律 first-class artifact。

| 欄位                  | 型別    | 必要 | 範例                       | 說明                                                                  |
| --------------------- | ------- | :--: | -------------------------- | --------------------------------------------------------------------- |
| `theme_id`            | string  |  ✅  | `machine-readable-output`  | kebab-case；對應 `iron-rules/<theme_id>.md`                           |
| `immutable`           | boolean |  ✅  | `true`                     | 整檔不可變（schema-validator + iron-theme-validator 強制）            |
| `applies_to`          | list    |  ✅  | `[reviewer, qa, security]` | 引用本 theme 的 agent_id 列表；雙向一致性由 iron-theme-validator 強制 |
| `modification_policy` | string  |  ✅  | 見 ADR-0037                | 變動授權說明（必經提案 + diff 強制）                                  |

注意：`iron_theme` 不需 `agent_id` / `agent_name` / `interacts_with` / `produces` 等 Agent 欄位；`theme_id` 取代 `agent_id` 角色。

### 2.3 引用欄位格式（`references` / `constraints_ref`）

**`references`**：指向其他檔案的具名章節（可讀內容）：

```yaml
references:
  system_thresholds: RULES_DESIGN_GUIDE.md#十四
  notification_standard: RULES_DESIGN_GUIDE.md#九
  parallel_review: lead.md#平行審查與衝突仲裁規則
```

**`constraints_ref`**：指向可調整數值（使用 `!ref` 標記動態讀取）：

```yaml
constraints_ref:
  review_cycle_limit: !ref RULES_DESIGN_GUIDE.md#REVIEW_CYCLE_LIMIT
  qa_retest_limit: !ref RULES_DESIGN_GUIDE.md#QA_RETEST_LIMIT
  exemption_threshold: !ref RULES_DESIGN_GUIDE.md#EXEMPTION_AUDIT_THRESHOLD
```

`!ref` 為專屬語法標記，表示該值應從目標位置動態讀取（目前人工維護；未來工具可自動解析驗證）。

---

## 三、XML `<section>` 標籤 Schema

### 3.1 基本語法

```html
<section
  id="<snake_case_id>"
  priority="<level>"
  [immutable="true"]
  [cross_ref="..."]
>
  ## 章節標題 （markdown 內容）
</section>
```

### 3.2 標籤屬性

| 屬性        | 型別                       | 必要 | 有效值                                              | 說明                                                             |
| ----------- | -------------------------- | :--: | --------------------------------------------------- | ---------------------------------------------------------------- |
| `id`        | string                     |  ✅  | `task_goal`、`parallel_review`、`forbidden_rules`   | 小寫底線；**每份 rules 內唯一**                                  |
| `priority`  | enum                       |  ✅  | `critical` / `high` / `normal` / `info`             | LLM 注意力權重提示                                               |
| `immutable` | boolean                    |  ⭕  | `true`                                              | 標記此章節需透過 `RULE_UPDATE_PROPOSAL` 才能修改（如零容忍條款） |
| `cross_ref` | list (semicolon-separated) |  ⭕  | `"lead.md#parallel_review;security.md#audit_scope"` | 跨檔案關聯（替代說明）                                           |

### 3.3 優先級 (`priority`) 使用指引

| 值         | 適用章節類型                                 | 典型例子                                                                    |
| ---------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| `critical` | 全局阻斷、零容忍禁止、豁免授權邊界、安全邊界 | `system-prompt §全局阻斷`、`lead §豁免授權邊界`、各 rules `§零容忍禁止條款` |
| `high`     | 核心工作流、HITL 觸發、DoD 自評、平行審查    | `lead §核心工作流引擎`、`security §審查職責邊界`、各 rules `§HITL 觸發條件` |
| `normal`   | 一般規範、審查準則、產出物定義               | 各 rules `§任務目標`、`§核心行為準則`、`§產出物`                            |
| `info`     | 補充說明、備註、維護規範                     | 各 rules 尾端的 `§備註`、`§自我維護規範`                                    |

### 3.4 `immutable="true"` 使用指引

以下章節**應**標注 `immutable="true"`：

- 所有含「零容忍」「絕對禁止」鐵律的章節
- 豁免授權邊界、全局緊急阻斷條款
- 平行審查衝突仲裁規則
- Rules 設計標準結構（`RULES_DESIGN_GUIDE §一`、§十四）

**意義**：LLM 與 User 讀到 `immutable="true"` 時，理解該章節內容**僅能透過正式提案流程**修改，直接編輯等同違反系統設計。

### 3.5 `id` 命名規範

- 全部小寫 + 底線分隔（snake_case）
- 對應章節名稱的英文含義，例如：
- `## 任務目標` → `id="task_goal"`
- `## 平行審查與衝突仲裁規則` → `id="parallel_review_arbitration"`
- `## 豁免授權與記錄機制` → `id="exemption_authorization"`
- `## 全局緊急阻斷` → `id="global_emergency_blocker"`

---

## 四、範例：`lead.md` 轉換前後對比

### 轉換前（PROPOSAL-020 完成狀態）

```markdown
---
trigger: manual
---

# Role: Tech Lead (Orchestrator)

---

版本：v1.1
最後修改：2026-04-21
修改提案：PROPOSAL-020
修改摘要：...
審計基準：v1.0

---

## 任務目標

...

## 平行審查與衝突仲裁規則

...
```

### 轉換後（依本 Schema）

```markdown
---
agent_id: project_lead
agent_name: "@Lead"
file_type: agent_rule
version: v1.2
last_modified: 2026-04-21
last_proposal: PROPOSAL-021
audit_baseline: v1.0
trigger: manual
workflow_stages: [coordination_all]
reports_to: user
interacts_with:
  - "@Planner"
  - "@Consultant"
  - "@Architect"
  - "@QA"
  - "@Reviewer"
  - "@Security"
  - "@Backend"
  - "@Frontend"
  - "@Retro"
  - "@Assistant"
references:
  system_thresholds: RULES_DESIGN_GUIDE.md#十四
  notification_standard: RULES_DESIGN_GUIDE.md#九
  version_control: RULES_VERSION_INDEX.md
constraints_ref:
  review_cycle_limit: !ref RULES_DESIGN_GUIDE.md#REVIEW_CYCLE_LIMIT
  exemption_threshold: !ref RULES_DESIGN_GUIDE.md#EXEMPTION_AUDIT_THRESHOLD
---

# Role: Tech Lead (Orchestrator)

---

版本：v1.2
最後修改：2026-04-21
修改提案：PROPOSAL-021
修改摘要：依 PROPOSAL-021 導入 frontmatter 擴充 + XML section 標籤
審計基準：v1.0

---

<section id="task_goal" priority="normal">
## 任務目標

（現有內容保留不變）

</section>

<section id="parallel_review_arbitration" priority="critical" immutable="true">
## 平行審查與衝突仲裁規則 (Parallel Review & Conflict Arbitration)

（現有內容保留不變）

</section>
```

---

## 四之一、AlwaysOn 文件例外設計 (AlwaysOn Exception)

依 PROPOSAL-021 Phase C 執行發現，AlwaysOn 文件（`file_type: always_on`，目前僅 `system-prompt.md`）受 `TOKEN_ALWAYSON_LIMIT` 500 tokens 上限限制，無法同時承載完整 YAML frontmatter + body XML `<section>` 標籤。

### 例外規則

- **YAML frontmatter**：必備（依 §2.1 共用欄位）
- **Body `\***版本標頭**\*` 區塊**：**選用**（frontmatter 已含版本資訊，避免雙重記錄）
- **Body `<section>` 標籤**：**選用**（AlwaysOn 可不加 XML 包覆）
- **關鍵章節標記**：若有對應 `critical` / `immutable` 章節，以 HTML 註解替代：

```html
<!-- CRITICAL + IMMUTABLE: <章節名稱> -->
## <章節名稱>
```

### 適用條件

- 檔案 `file_type: always_on`
- 實測 Token 若加 `<section>` 後超過 `TOKEN_ALWAYSON_LIMIT`
- User 透過 `RULE_UPDATE_PROPOSAL` 可明確放棄此例外並採完整 Schema（需同步調整 Token 上限）

### 非 AlwaysOn 文件無例外

- `agent_rule` / `design_guide` 類型**必須**使用 frontmatter + body version header + `<section>` 三層完整結構
- 非 AlwaysOn 文件若 Token 超標，依 §4 Token 預算規範精簡優先順序處理（外部化、合併條目、流程壓縮、重複消除）

---

## 五、違反 Schema 的處理流程

### 5.1 `@Retro` 審計時的檢查項

- 所有 rules 頂部有 YAML frontmatter（非僅 `---trigger: manual---` 舊格式）
- §2.1 必要欄位齊全（`agent_id` / `file_type` / `version` 等 8 項）
- `file_type: agent_rule` 文件含 `interacts_with` 或 `produces`（至少一項）
- 所有 `##` 章節以 `<section>` 包覆（含 `id` + `priority` 兩必要屬性）
- 同一份 rules 內 `<section id>` 無重複
- 含「絕對禁止」「零容忍」字樣的章節已標注 `immutable="true"`

### 5.2 發現違反時的處理

- `@Retro` 於審計報告標記 🔴 `[SCHEMA_VIOLATION]`
- 修正需透過 `RULE_UPDATE_PROPOSAL` 提案流程（**絕對禁止**直接改 rules 修正 Schema 違反）
- 違反累積 ≥ 3 份 rules → `@Assistant` 巡邏產 🔴 阻斷（未來可擴充 P-12）

---

## 六、未來自動化工具路徑

本 Schema 為 User 於 Q4 提及的「開發程式專門維護」預留基礎：

| 工具類型           | 功能                                                                                      | 依賴的 Schema 欄位               |
| ------------------ | ----------------------------------------------------------------------------------------- | -------------------------------- |
| Schema Validator   | 檢查 frontmatter 欄位完整性 / 型別 / `<section>` 標籤合法性                               | 全部                             |
| Cross-ref Resolver | 解析 `!ref` 並驗證目標章節存在                                                            | `references` / `constraints_ref` |
| Rules Dashboard    | 掃描所有 `priority="critical"` 章節並集中顯示                                             | `<section priority>`             |
| Token Monitor      | 依 `rule_category` tier 比對實際用量（ADR-0038；`tests/rule-token-budget-validator.mjs`） | `rule_category`                  |
| Immutable Guard    | Git pre-commit hook 檢查 `immutable="true"` 章節是否被非提案性修改                        | `<section immutable>`            |

---

## 七、維護規範

- 本檔案 Schema 變更 → 透過 `RULE_UPDATE_PROPOSAL` 提案，由 `@Retro` 起草 → User 採納 → `@Lead` 執行
- Schema 版本號規則（對齊 `RULES_DESIGN_GUIDE` Major/Minor）：
- **Major**：新增或刪除必要欄位、改變 XML 標籤基本結構
- **Minor**：新增選用欄位、擴充 `priority` 值、新增使用範例
- Schema 升級時，所有 rules 必須**同時**升級對齊（不允許跨版本並存）

---

<!-- END: RULES_METADATA_SCHEMA -->

---

## Related Decisions

- [ADR-0022](decisions/0022-rules-metadata-frontmatter.md) — Rules 結構標準化
