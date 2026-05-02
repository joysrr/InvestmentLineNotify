---
agent_id: design_guide
agent_name: "Rules Design Guide (Orchestrator)"
file_type: design_guide_orchestrator
version: v2.0
last_modified: 2026-04-24
last_proposal: PROPOSAL-021+022+023+025+20260423_001+20260423_002+20260423_003+20260423_004+007+008+009+010+011+012
audit_baseline: v1.0
trigger: manual
token_budget_ref: TOKEN_ONDEMAND_LIMIT
references:
  version_control: RULES_VERSION_INDEX.md
  metadata_schema: RULES_METADATA_SCHEMA.md
  notification_standard: RULES_DESIGN_GUIDE.DESIGN.md#九
  system_thresholds: RULES_DESIGN_GUIDE.QUALITY.md#十四
submodules:
  - RULES_DESIGN_GUIDE.DESIGN.md
  - RULES_DESIGN_GUIDE.SCOPE.md
  - RULES_DESIGN_GUIDE.QUALITY.md
maintained_by: "@Retro"
---

# Agent Rules 設計規範指引（Orchestrator）

---

版本：v2.0（拆檔版）
最後修改：2026-04-24
修改提案：PROPOSAL_20260423_011（拆檔）；累計 PROPOSAL-021 + 20260422_022/023/025 + 20260423_001~004/007~012
修改摘要：依 PROPOSAL_20260423_011 將 1194 行內容拆為 3 主題子檔（DESIGN / SCOPE / QUALITY）；本檔化為 orchestrator
審計基準：v1.0

---

> 建立依據：PROPOSAL_20260421_003；PROPOSAL_20260423_011 拆檔
> 維護者：`@Retro`（透過 RULE_UPDATE_PROPOSAL 提案更新）
> 用途：新增或修改任何 `.agents/rules/` 文件時的強制參照規範

---

## 拆檔說明（v2.0；依 PROPOSAL_20260423_011）

本檔原為單檔 1194 行（21 章節），依 PROPOSAL_20260423_004 文件分層三原則自我應用，拆為：

| 子檔                            | 主題       | 行數 | 覆蓋章節                                    |
| ------------------------------- | ---------- | ---- | ------------------------------------------- |
| `RULES_DESIGN_GUIDE.DESIGN.md`  | 設計形式   | ~248 | §一、三、五、六、九                         |
| `RULES_DESIGN_GUIDE.SCOPE.md`   | 範圍治理   | ~483 | §十一、十二、十五、十六、十七、二十、二十一 |
| `RULES_DESIGN_GUIDE.QUALITY.md` | 品質與量化 | ~457 | §二、四、七、八、十、十四、十八、十九       |

---

## 章節索引（Table of Contents）

**使用說明**：下表將舊編號（§一~§二十一）映射至新位置。新提案**強制**使用「子檔 + §N」格式；舊提案引用由相容層處理（見文末）。

| 舊章節                                 | 新位置  | 主題 | 相關提案                             |
| -------------------------------------- | ------- | ---- | ------------------------------------ |
| §一 Rules 標準結構                     | DESIGN  | 結構 | PROPOSAL_20260421_003                |
| §二 Token 預算規範                     | QUALITY | 量化 | PROPOSAL_20260422_013                |
| §三 模板外部化強制規定                 | DESIGN  | 結構 | PROPOSAL_20260421_001                |
| §四 HITL 最低設計要求                  | QUALITY | 量化 | PROPOSAL_20260421_009                |
| §五 業務脈絡三層次規範                 | DESIGN  | 結構 | PROPOSAL_20260422_002                |
| §六 負面約束設計四原則                 | DESIGN  | 結構 | PROPOSAL_20260421_014                |
| §七 產出物 DoD 自評規範                | QUALITY | 量化 | PROPOSAL_20260421_012 + 20260422_012 |
| §八 新增 Rules 前置審查 Checklist      | QUALITY | 量化 | PROPOSAL_20260422_008                |
| §九 通知分級標準                       | DESIGN  | 結構 | PROPOSAL_20260421_017                |
| §十 雙向邏輯測試準則                   | QUALITY | 量化 | PROPOSAL_20260424_019                |
| §十一 Rules 版本標頭標準               | SCOPE   | 治理 | PROPOSAL_20260421_019                |
| §十二 提案執行後版本更新義務           | SCOPE   | 治理 | PROPOSAL_20260423_007                |
| §十四 系統參數配置                     | QUALITY | 量化 | PROPOSAL_20260422_014                |
| §十五 本文件自身維護規範               | SCOPE   | 治理 | PROPOSAL-021                         |
| §十六 技術知識分層原則                 | SCOPE   | 治理 | PROPOSAL_20260422_022                |
| §十七 提案 Scope 分層                  | SCOPE   | 治理 | PROPOSAL_20260422_023                |
| §十八 Prior Art Scan 強制程序          | QUALITY | 量化 | PROPOSAL_20260423_002                |
| §十九 Hotfix 診斷強化三支柱 + 輕重分級 | QUALITY | 量化 | PROPOSAL_20260423_003 + 009          |
| §二十 文件分層三原則                   | SCOPE   | 治理 | PROPOSAL_20260423_004                |
| §二十一 提案輕重分級                   | SCOPE   | 治理 | PROPOSAL_20260423_010                |

---

## 📌 專案特化參照 (Project-Specific References)

<!-- 本節保留於主檔；為 orchestrator 性質；依 PROPOSAL_20260423_011 不拆分 -->

## 🔗 專案特化參照 (Project-Specific References)

> 本 <skill|task> 描述**通用原則**；專案特定實值由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念 | Workspace 欄位              | Fallback 行為             |
| -------- | --------------------------- | ------------------------- |
| <概念 A> | <WORKSPACE_SCHEMA 欄位路徑> | 阻斷 / 升級 / 警告 / 略過 |

```

#### F.3 違規偵測

| 違規類型 | 判定 | 處理 |
|---------|------|------|
| F2 類 skill / task 缺 §專案特化參照 | 🟡 格式不符 | `@Auditor §2.2` 扣分；`workspace-schema-validator` 警告 |
| F3 類內容寫入 skills / tasks | 🔴 三分法違規 | 應遷移至 workspace 實值欄位 |
| referenced_by 反向索引斷鏈（WORKSPACE_SCHEMA 未宣告被 skills/tasks 引用）| 🟡 一致性違規 | `workspace-schema-validator` 扣 0.5 分 |
| F1 類誤植 §專案特化參照 | 🟡 格式誤用 | 移除區塊（純通用不需 workspace 注入）|

#### F.4 既有 skills / tasks 回溯分類

| 檔案 | 類別 | 說明 |
|------|-----|------|
| `skills/templates/review-report-template.md` | F1 | 純模板 |
| `skills/templates/test-spec-template.md` | F1 | 純模板 |
| `skills/templates/test-report-template.md` | F1 | 純模板 |
| `skills/templates/advice-template.md` | F1 | 純模板 |
| `skills/templates/security-report-template.md` | F1 | 純模板 |
| `skills/concurrency-guard-pattern.md` | **F2** | 引用 `PATHS.source_modules.concurrency` |
| `skills/infra-constraints.md` | **F2** | 引用 `DEPLOYMENT_CONSTRAINTS.*` |
| `skills/security-audit.md` | **F2** | 引用 `CRITICAL_PATHS` / `SECURITY_SCOPE_EXTENSIONS` |
| `skills/lead-dispatch-patterns.md` | **F2** | 引用 `BUSINESS_RULES` / `CRITICAL_PATHS` |
| `skills/consultant-bypass-rules.md` | **F2** | 引用 `BUSINESS_RULES` 擴充 Bypass 清單 |
| `skills/pm2-management.md` | **F2** | 引用 `DEPLOYMENT_CONSTRAINTS` / `DEPLOYMENT_SOP` |
| `skills/checklists/strategyweight-change-checklist.md` | **F2** | 含 IMN 特定用語但通用適用；引用 `CRITICAL_PATHS` / `BUSINESS_RULES` |
| `skills/*-examples.md`（12 份）| F1 | Few-Shot 範例（純示意）|
| `skills/auditor-rubric-prompts.md` | F1 | 純 Prompt Fragment |
| `skills/stateless-routing-pattern.md` | F1 | 純鐵律 |
| `skills/patrol-notification-catalog.md` | F1 | 純清單 |
| `skills/git-pr-workflow.md` | F1 | 純流程 |
| `skills/rule-update-proposal-template.md` | F1 | 純模板 |
| `skills/templates/proposal-integration-analysis-template.md` | F1 | 純模板 |
| `skills/templates/global-status-summary-template.md` | F1 | 純模板 |
| `skills/templates/pending-actions-template.md` | F1 | 純模板 |
| `skills/dod-audit-checklist-template.md` | F1 | 純模板 |
| `skills/templates/user-story-template.md` | F1 | 純模板 |
| `skills/templates/draft-features-template.md` | F1 | 純模板 |
| `skills/assistant-user-commands.md` | F1 | 純通用指令對照 |
| `tasks/project-onboarding-workflow.md` | **F2** | 引用 `WORKSPACE_SCHEMA` / `TECH_STACK` / `DEPLOYMENT_CONSTRAINTS` |
| `tasks/hotfix-checklist.md` | F1 | 純流程 |
| `tasks/domain-creation-checklist.md` | F1 | 純流程 |
| `tasks/proposal-integration-analysis.md` | F1 | 純流程 |
| `tasks/role-onboarding-checklist.md` | F1 | 純流程 |
| `tasks/audit-retro-coordination.md` | F1 | 純協作 SOP |
| `tasks/exemption-approval-workflow.md` | F1 | 純通用流程 |
| `tasks/emergency-shutdown-playbook.md` | **F2** | 引用 `DEPLOYMENT_SOP.rollback` / `DEPLOYMENT_CONSTRAINTS` |
| `tasks/lane-routing-task-classification.md` | F1 | 純通用分級 |

**本回溯盤點**：F2 類共 **9 份**（7 skills + 2 tasks），需於 PROPOSAL_20260423_001 Phase B 補 §專案特化參照。
</section>

<section id="s15" priority="normal">

---

## 相容層：舊章節 Anchor 重導向

> 保留 60+ 歷史 DONE 提案引用不失效；外部文件引用 `§一~§二十一` 按本節對照新位置。
> **DEPRECATED 時程**：2026-10-24 後標記 DEPRECATED；2027-04-24 後允許移除本相容層。

### 引用對照規則

- **歷史 proposals/completed/*.md** 引用 `§N` → 按上方「章節索引」查對應子檔
- **新提案** 強制使用 `RULES_DESIGN_GUIDE.<subject>.md#<N>` 格式（subject ∈ {DESIGN, SCOPE, QUALITY}）
- **rules/**.md / tasks/*.md / skills/*.md** 引用更新：Phase D 執行；暫維持 `§N` 語法（本相容層支援）

### 違規偵測（P-23 巡邏；依 PROPOSAL_20260423_011）

- 新提案（`date >= 2026-04-24`）使用裸 `§一~§二十一` 而非 `RULES_DESIGN_GUIDE.<subject>.md#N` → 🟡 WARN
- 子檔內互引用使用舊 `§N` 格式未轉新 → 🟡 WARN

### 設計意義

本次拆檔為 **PROPOSAL_20260423_004（文件分層三原則）的自我應用**：將原則用於本文件自身驗證普適性。同時解除 `periodic-design-review §7 警示維度 #6`（單檔 rules/ ≥800 行警示）：1194 → 483（最大子檔）遠低於 800 閾值。

---

## 溯源

- **拆檔提案**：PROPOSAL_20260423_011
- **觸發警示**：§7 警示維度 #6（1194 行 ≥800）
- **指導原則**：PROPOSAL_20260423_004（文件分層三原則）自我應用
- **配套提案**：009（§十九.G）+ 010（§二十一）+ 012（AUTO-GENERATED 標記）

---

## Related Decisions

- [ADR-0017](decisions/0017-document-layering.md) — 文件分層三原則
- [ADR-0018](decisions/0018-rules-design-guide-subdivision.md) — RULES_DESIGN_GUIDE 拆檔
```
