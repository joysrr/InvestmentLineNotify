# Architecture Decision Records (ADRs)

> 依 PROPOSAL_20260423_016 建立。
> 收錄框架**重要設計決策**；規則層（`rules/*.md`）透過 `Related Decisions` footer 連結於此。
> ADR 為**跨專案知識資產**；搬運新專案時**必帶**（與 rules/ 同等重要）。

---

## 三層職責分離

| 層         | 位置                                                                    | 用途              | 讀取時機    |
| ---------- | ----------------------------------------------------------------------- | ----------------- | ----------- |
| **規則層** | `rules/*.md` + `skills/*.md` + `tasks/*.md` + `RULES_DESIGN_GUIDE.*.md` | 當前行為（WHAT）  | 每任務必讀  |
| **決策層** | `decisions/ADR-XXXX.md`（本目錄）                                       | 設計理由（WHY）   | 需要時才讀  |
| **歷史層** | `proposals/completed/*.md` + `proposals/summaries/`                     | 官方決議（AUDIT） | 審計 / 溯源 |

**核心原則**：**規則描述 WHAT，ADR 描述 WHY，兩者不互相依賴**；新 LLM 只讀 rules 即可執行任務，需要理解「為何這樣設計」時才展開 ADR。

---

## ADR 編號規則

- **格式**：`ADR-NNNN`（4 位數字，從 0001 起編號）
- **檔名**：`NNNN-kebab-case-slug.md`（如 `0001-stateless-lead-routing.md`）
- **不可重用**：即使 ADR 被 Superseded，編號永久保留佔位（避免編號碰撞）
- **跨專案通用**：所有專案共用編號空間（不區分 framework/project；workspace 決策各自寫 `workspaces/<name>/decisions/`）

## ADR 狀態

| Status       | 說明                                      |
| ------------ | ----------------------------------------- |
| `Proposed`   | 正在討論                                  |
| `Accepted`   | 已決議採用（主要狀態）                    |
| `Superseded` | 被新 ADR 取代（保留，標註 superseded_by） |
| `Deprecated` | 不再適用（保留作歷史）                    |

## 標準格式

見 `ADR-TEMPLATE.md`。所有 ADR **必**含：

- Context（問題情境）
- Decision（選擇）
- Consequences（正負影響）

建議含：

- Alternatives Considered（替代方案）
- Related Proposals（原始提案鏈）
- Referenced By（哪些規則引用）

## 索引（自動生成）

<!-- ⚠️ 下方區塊由 gen-adr-index.mjs --write 管理；手動編輯會在下次執行時被覆蓋 -->
<!-- AUTO-GENERATED:BEGIN adr_list -->

| ADR                                                   | Title                                                        | Status   | Date       | Supersedes |
| ----------------------------------------------------- | ------------------------------------------------------------ | -------- | ---------- | ---------- |
| [ADR-0001](0001-stateless-lead-routing.md)            | Stateless @Lead Routing 三鐵律                               | Accepted | 2026-04-22 | —          |
| [ADR-0002](0002-workspace-context-injection.md)       | Workspace-based Project Context 靜態注入                     | Accepted | 2026-04-22 | —          |
| [ADR-0003](0003-agent-drift-simulator.md)             | Agent Drift Simulator — rules 結構 drift 量化偵測            | Accepted | 2026-04-22 | —          |
| [ADR-0004](0004-file-based-concurrency-protection.md) | File-based 並行防護 + PM2 身份管理                           | Accepted | 2026-04-22 | —          |
| [ADR-0005](0005-auditor-periodic-scoring.md)          | @Auditor 定期 5 維度評分機制                                 | Accepted | 2026-04-22 | —          |
| [ADR-0006](0006-model-tier-routing.md)                | 模型分層路由（haiku/sonnet/opus）                            | Accepted | 2026-04-22 | —          |
| [ADR-0007](0007-lane-routing.md)                      | 多車道路由架構（fast/standard/heavy）                        | Accepted | 2026-04-22 | —          |
| [ADR-0008](0008-hotfix-dual-track.md)                 | Hotfix 雙軌流程（light 3 步 / heavy 5 步）                   | Accepted | 2026-04-24 | —          |
| [ADR-0009](0009-proposal-full-lite-tier.md)           | Full/Lite Proposal 分級機制                                  | Accepted | 2026-04-24 | —          |
| [ADR-0010](0010-parallel-review.md)                   | 平行審查制度（@Reviewer + @Security）                        | Accepted | 2026-04-21 | —          |
| [ADR-0011](0011-security-conditional-intervention.md) | @Security 條件式介入（SC-01~10 十項觸發）                    | Accepted | 2026-04-21 | —          |
| [ADR-0012](0012-diagnostic-team.md)                   | 診斷組機制（D1-D4 條件式雙眼診斷）                           | Accepted | 2026-04-23 | —          |
| [ADR-0013](0013-dod-self-audit.md)                    | DoD 自評框架 + Gate Check Auto-Audit                         | Accepted | 2026-04-22 | —          |
| [ADR-0014](0014-prior-art-scan.md)                    | Prior Art Scan 強制程序（預防重複造輪子）                    | Accepted | 2026-04-23 | —          |
| [ADR-0015](0015-tech-stacks-purity.md)                | Tech-Stacks 純淨原則（三分法 + 6 鐵律）                      | Accepted | 2026-04-22 | —          |
| [ADR-0016](0016-skills-tasks-classification.md)       | skills/tasks 三態分類（F1/F2/F3）+ 專案特化參照              | Accepted | 2026-04-23 | —          |
| [ADR-0017](0017-document-layering.md)                 | 文件分層三原則（.agents/docs/ vs docs/）                     | Accepted | 2026-04-23 | —          |
| [ADR-0018](0018-rules-design-guide-subdivision.md)    | RULES_DESIGN_GUIDE 拆檔（DESIGN/SCOPE/QUALITY）              | Accepted | 2026-04-24 | —          |
| [ADR-0019](0019-proposal-scope-tiering.md)            | Proposal Scope 分層治理（framework vs project）              | Accepted | 2026-04-22 | —          |
| [ADR-0020](0020-proposal-intent-inheritance.md)       | 提案意圖繼承機制（§🔗）                                      | Accepted | 2026-04-22 | —          |
| [ADR-0021](0021-proposal-lifecycle.md)                | 提案生命週期（OPEN → IN_PROGRESS → DONE → ARCHIVED）         | Accepted | 2026-04-21 | —          |
| [ADR-0022](0022-rules-metadata-frontmatter.md)        | Rules 結構標準化（YAML frontmatter + XML section）           | Accepted | 2026-04-21 | —          |
| [ADR-0023](0023-framework-version-management.md)      | Framework Version 管理（FRAMEWORK_VERSION + CHANGELOG）      | Accepted | 2026-04-23 | —          |
| [ADR-0024](0024-framework-runtime-requirements.md)    | Framework Runtime 規範（Node.js 18+ / Bash / 零依賴）        | Accepted | 2026-04-24 | —          |
| [ADR-0025](0025-auto-generated-block-pattern.md)      | AUTO-GENERATED 區塊機制 + 索引自動產生器                     | Accepted | 2026-04-23 | —          |
| [ADR-0026](0026-validator-parallel-fast-mode.md)      | Validator 並行執行 + --fast / --validator 三模式             | Accepted | 2026-04-23 | —          |
| [ADR-0027](0027-script-underuse-prevention.md)        | Script 漏用防護機制（四道防線）                              | Accepted | 2026-04-24 | —          |
| [ADR-0028](0028-proposal-summaries.md)                | 歷史提案摘要機制（summaries/）                               | Accepted | 2026-04-24 | —          |
| [ADR-0029](0029-assistant-patrol-catalog.md)          | @Assistant 巡邏規則目錄（P-01 ~ P-23）                       | Accepted | 2026-04-22 | —          |
| [ADR-0030](0030-notification-classification.md)       | 通知分級標準（五級符號體系）                                 | Accepted | 2026-04-21 | —          |
| [ADR-0031](0031-tech-stacks-catalog.md)               | Tech-Stacks Catalog 架構（分類 + MANIFEST + 選擇性搬運）     | Accepted | 2026-04-24 | —          |
| [ADR-0032](0032-tech-stack-audit-cycle.md)            | Tech-Stack 生命週期 Audit 機制（定期審視 + 初步篩選）        | Accepted | 2026-04-24 | —          |
| [ADR-0033](0033-orchestrator-policies-pattern.md)     | Orchestrator + Policies/Core 模式（module 層 Hub-and-Spoke） | Accepted | 2026-04-24 | —          |
| [ADR-0034](0034-langgraph-dual-env-integration.md)    | LangGraph + MCP 雙環境整合（Qwen / Antigravity）             | Accepted | 2026-04-26 | —          |

<!-- AUTO-GENERATED:END adr_list -->

## 產生指令

```bash
# 產生索引（掃 decisions/ 目錄 ADR-*.md 產 AUTO-GENERATED 區塊）
node .agents/scripts/generators/gen-adr-index.mjs --write

# 驗證規則層無殘留 PROPOSAL_XXX 引用
node .agents/tests/adr-validator.mjs
```

## 搬運規範（對齊 FRAMEWORK_REQUIREMENTS §6）

```bash
# 新專案必帶
cp -r .agents/decisions/ /new-project/.agents/
cp -r .agents/proposals/summaries/ /new-project/.agents/proposals/

# 搬運後驗證
node .agents/scripts/generators/gen-adr-index.mjs  # dry-run
node .agents/tests/adr-validator.mjs                # 規則無殘留 PROPOSAL 引用
```

## 決策粒度指引

| 決策性質                               | 是否寫 ADR |
| -------------------------------------- | ---------- |
| 跨 Agent 行為影響（如 @Lead 狀態錨點） | ✅         |
| 重大架構抉擇（如 workspace 分層）      | ✅         |
| 流程分輕重（如 Hotfix light/heavy）    | ✅         |
| Bug 修復                               | ❌         |
| 版本微調（如 token budget -5%）        | ❌         |
| Typo / 設定常數                        | ❌         |

**原則**：若一個決策會被多個規則引用或影響多個 Agent → 寫 ADR；單點修改 / 局部 patch → 不寫。

## 相關提案

- PROPOSAL_20260423_016（本目錄建立）
- PROPOSAL_20260423_015（framework/project 分層 + summaries）
- PROPOSAL_20260423_011（RULES_DESIGN_GUIDE 拆檔自我應用）
