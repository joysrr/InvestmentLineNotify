<!-- MACHINE_READABLE
type: context-mapping
category: F1
id: lead-context-mappings
related_proposals: [PROPOSAL_20260425_001, PROPOSAL_20260424_020]
related_decisions: [ADR-0001, ADR-0010, ADR-0011]
-->

# Skill: Lead Context & Resource Mappings（@Lead 派發前資源映射完整表）

> 由 PROPOSAL_20260425_001 Phase B 建立；F1 類（純通用映射規範）。
> `rules/lead.md §s13` 保留摘要 + 熔斷機制 + skill pointer；本文為**完整 6 類映射表**。
> @Lead 派發任務前**必查閱**對應映射表，將文件路徑附帶給執行 Agent（**禁止**讓 Agent 憑空猜測）。

---

## 零、Discussion Mode Skill Map（討論模式專用）

> 對應 `system-prompt.md §模式判斷` 討論模式 + Group A 評鑑缺口。
> 討論模式不派發但 @Lead 仍需查書回答；本表機械化討論主題 → 對應參考檔。

| User 詢問主題                                                                                                              | 應引用的書                                                                                                            | 說明                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROPOSAL 流程 / 提案生命週期                                                                                               | `rules/retro.md §s06` + `decisions/0021-proposal-lifecycle.md`                                                        | 6 狀態 + 採納指令格式                                                                                                                                            |
| Scope 分層（framework vs project）                                                                                         | `rules/retro.md §s06`（Scope 判定 3 步）+ `decisions/0019-proposal-scope-tiering.md`                                  | `RULES_DESIGN_GUIDE.SCOPE §十七.B` 三步機械化                                                                                                                    |
| 平行審查 / @Reviewer × @Security 衝突                                                                                      | `skills/parallel-review-arbitration.md` + `decisions/0010-parallel-review.md`                                         | 4 防線 + 衝突仲裁表                                                                                                                                              |
| Hotfix 流程 / 診斷組                                                                                                       | `tasks/hotfix-checklist.md` + `skills/diagnostic-playbook.md` + `decisions/0008-hotfix-dual-track.md`                 | Step 0 五步驟 + A/B 雙路徑                                                                                                                                       |
| Prior Art Scan / Gate                                                                                                      | `skills/checklists/prior-art-scan-checklist.md` + `decisions/0014-prior-art-scan.md`                                  | 6 步驟流程 + HITL Gate                                                                                                                                           |
| 任務複雜度 / 模型分層 / 多車道                                                                                             | `skills/lead-orchestration-guide.md §二` + `decisions/{0006,0007}*.md`                                                | 三步評估 + 雙軌決策                                                                                                                                              |
| 巡邏規則 / 通知分級                                                                                                        | `skills/patrol-notification-catalog.md` + `decisions/0030-notification-classification.md`                             | P-01~P-29 + 五級符號                                                                                                                                             |
| 資料刪除 / strategyWeight 鐵律                                                                                             | `skills/checklists/data-deletion-checklist.md` + `skills/checklists/strategyweight-change-checklist.md`               | 五步驟強制流程                                                                                                                                                   |
| Memory Palace（v2.0 Wings/Rooms/Drawers；ADR-0039 MemPalace primary + markdown SoT backup 雙寫設計；PROPOSAL_502_017 Q-9） | `skills/memory-palace-schema.md` v2.0 + `skills/memory-operations.md`                                                 | rooms：architecture / strategy_context / debug_graveyard / general（4 rooms；framework + per-workspace Wings；MCP=primary, markdown=git audit + re-mine source） |
| Rule_category 分類 / token tier（PROPOSAL_502_017 Q-9）                                                                    | `decisions/0038-tier-based-rule-budget.md` + `RULES_METADATA_SCHEMA.md §84` + `tests/rule-token-budget-validator.mjs` | 4 tier: meta(500) / worker(1500) / orchestrator(1800) / central_orchestrator(2500) + iron_theme(600)；judgement 5 原則（PROPOSAL_502_011 amend）                 |
| Rules 瘦身 / 骨架原則                                                                                                      | `RULES_DESIGN_GUIDE.DESIGN.md §三` + 本檔                                                                             | 模板外部化 + 骨架/血肉                                                                                                                                           |
| Auditor 5 維度評分                                                                                                         | `skills/auditor-rubric-prompts.md`（18 Fragments）+ `decisions/0005-auditor-periodic-scoring.md`                      | 5 並行 Explore SOP                                                                                                                                               |
| DoD 自評                                                                                                                   | `skills/templates/dod-audit-template.md` + per-agent dod-checklist.md                                                 | `decisions/0013-dod-self-audit.md`                                                                                                                               |

**使用方式**：討論模式中 @Lead 識別主題 → 查表 → `read_artifact(category, name)` 載入 → 引用回答。

**禁止**：討論模式憑記憶回答框架機制（必查書；避免漂移）。

---

## 一、熔斷機制（執行映射前先檢查）

派發前先掃描任務是否落在以下熔斷區：

| 缺失類型           | 觸發條件                                                                     | 處置                                                         |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **領域缺失**       | 任務涉及 `domains/*.md` 未涵蓋專業領域（如選擇權定價、總經分析）             | **暫停派發**；請 User 建立對應 `domains/` 知識庫             |
| **技術棧缺失**     | 任務涉及 `tech-stacks/*.md` 未涵蓋技術（如 Python / Redis / Docker / React） | **立即暫停派發**；請 User 建立對應 `tech-stacks/` 規範後繼續 |
| **Workspace 缺失** | `CURRENT_WORKSPACE` 不存在或無效                                             | 依 `lead-orchestration-guide.md §1.3` 缺失判斷備案分級處理   |

熔斷後不可繼續派發；必先 HITL 解除。

---

## 二、技術棧與框架映射（Tech-Stacks Mapping）

| 任務情境                                   | 應附帶的 Tech-Stack                                          |
| ------------------------------------------ | ------------------------------------------------------------ |
| 開發或修改 `webapp/` 的 UI/元件            | `.agents/tech-stacks/web-frontend/vue3-vite.md`              |
| 開發或修改 Telegram Mini App SDK 認證/協定 | `.agents/tech-stacks/messaging/telegram-miniapp-sdk.md`      |
| 開發或修改 Telegram Mini App UI 模式       | `.agents/tech-stacks/messaging/telegram-miniapp.md`          |
| 開發 `src/` 下的 API 或核心邏輯            | `.agents/tech-stacks/web-backend/nodejs-esm-backend.md`      |
| 涉及 JSON 檔案或資料持久層讀寫             | `.agents/tech-stacks/storage/file-based-storage.md`          |
| 需要撰寫或修改單元/整合測試                | `.agents/tech-stacks/web-backend/testing-nodejs.md`          |
| 處理 Telegram Bot Webhook 與重試機制       | `.agents/tech-stacks/messaging/telegram-bot.md`              |
| 開發 Vue 3 共用元件或封裝 Composables      | `.agents/tech-stacks/web-frontend/vue3-component-pattern.md` |

---

## 三、領域知識映射（Domains Mapping）

| 任務情境                             | 應附帶的 Domain                        |
| ------------------------------------ | -------------------------------------- |
| 涉及長線資金配置、預算攔截或動態槓桿 | `.agents/domains/finance-lifecycle.md` |
| 涉及 KD/RSI/MACD、動能或技術線型判斷 | `.agents/domains/finance-technical.md` |
| 涉及乖離率、破底建倉或價值回歸邏輯   | `.agents/domains/finance-left-side.md` |
| 涉及機率統計、極端值防護或評分矩陣   | `.agents/domains/math-quant.md`        |

> **延伸**：當前 active workspace 可能含專案特化 domains（見 `workspaces/<CURRENT_WORKSPACE>.md` 的 `BUSINESS_DOMAINS` 欄位）。

---

## 四、技術操作技能映射（Skills Mapping）

| 操作情境                                                      | 應附帶的 Skill                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 執行部署或伺服器設定                                          | workspace `DEPLOYMENT_SOP` 欄位（參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md`） |
| 規劃架構時遇到雲端與本地資源限制評估                          | `.agents/skills/infra-constraints.md`                                               |
| 第 6.5 階段 `@Security` 資安審查（範疇判斷 + Checklist 執行） | `.agents/skills/security-audit.md`                                                  |
| 設計新模組（≥ 500 行 / ≥ 3 業務子流程）                       | `.agents/skills/orchestrator-pattern.md`（PROPOSAL_024 / ADR-0033）                 |
| 派發任務需寫 ROUTING_TICKET（PROPOSAL_023 必）                | `.agents/skills/routing-ticket-protocol.md`                                         |
| 多 Phase 提案執行需雙維度追蹤（PROPOSAL_019 F-2）             | `.agents/skills/checklists/dual-tracking-checklist.md`                              |
| 派遣 5 並行 @Auditor sub-agents                               | `.agents/skills/auditor-rubric-prompts.md`（18 Fragment）                           |

---

## 五、任務執行檢核表（Tasks Mapping）

| 任務情境                                                        | 應附帶的 Task Checklist                                                                                                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 執行 Hotfix 緊急修復                                            | `.agents/tasks/hotfix-checklist.md` + `.agents/tasks/emergency-shutdown-playbook.md`                                                                                 |
| 建立新的領域顧問知識庫                                          | `.agents/tasks/domain-creation-checklist.md`                                                                                                                         |
| **User 觸發語**「開新專案 / init workspace / 建 Avalonia 專案」 | `.agents/tasks/agent-onboarding-flow.md`（PROPOSAL_018；對話驅動 5 步驟 SOP）                                                                                        |
| 既有 workspace 超過 `audit_interval_days` 未 audit              | 派發前通知 User：「距上次 tech-stack audit 已 N 天；建議執行 `node .agents/scripts/tech-stack-manage.mjs audit`」（@Assistant P-23 主動偵測；@Lead 收到後傳達 User） |
| 提案整合性分析（OPEN ≥ 2 份觸發）                               | `.agents/tasks/proposal-integration-analysis.md`（5 階段流程）                                                                                                       |
| 執行提案（framework scope）                                     | `.agents/proposals/active/`                                                                                                                                          |
| 執行提案（project scope）                                       | `.agents/workspaces/<CURRENT_WORKSPACE>/proposals/active/`                                                                                                           |
| 提案索引查詢（framework）                                       | `.agents/proposals/PROPOSAL_INDEX.md`                                                                                                                                |
| 提案索引查詢（project）                                         | `.agents/workspaces/<CURRENT_WORKSPACE>/proposals/PROPOSAL_INDEX.md`                                                                                                 |

> **註**：原「進行系統白箱審查或包含資安相關實作 → `tasks/security-review.md`」條目已移除，內容遷移至 `skills/security-audit.md`（§四 第 3 列）；@Security 職責分離見 ADR-0010 + ADR-0011。

---

## 六、設計規範映射（Design Guide Mapping）

| 任務情境                                                                                  | 應附帶的 Design Guide                                                                    |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 新增或修改任何 `.agents/rules/` 文件（含結構、Token、HITL、業務脈絡、負面約束、DoD 審查） | `.agents/RULES_DESIGN_GUIDE.md` 主檔 + `.DESIGN.md` / `.SCOPE.md` / `.QUALITY.md` 三子檔 |
| 修改 rules 規模超過 3000 tokens（PROPOSAL_020 治本層）                                    | 自動觸發 `force_complex_scenarios.rule_edit_large` → @Architect HITL                     |
| 修改 rules 超 4000 tokens                                                                 | 自動觸發 `force_complex_scenarios.rule_edit_critical` → 派發**阻斷**；必先立案拆檔提案   |

---

## 七、模板文件資源映射（Template Mapping）

| 模板類型                    | 路徑                                                             | 使用 Agent    |
| --------------------------- | ---------------------------------------------------------------- | ------------- |
| User Story 核心句型與 AC    | `.agents/skills/templates/user-story-template.md`                | `@Planner`    |
| Draft Features 條目         | `.agents/skills/templates/draft-features-template.md`            | `@Planner`    |
| TEST_SPEC                   | `.agents/skills/templates/test-spec-template.md`                 | `@QA`         |
| TEST_REPORT                 | `.agents/skills/templates/test-report-template.md`               | `@QA`         |
| REVIEW_REPORT               | `.agents/skills/templates/review-report-template.md`             | `@Reviewer`   |
| SECURITY_REPORT             | `.agents/skills/templates/security-report-template.md`           | `@Security`   |
| RULE_UPDATE_PROPOSAL (Full) | `.agents/skills/templates/rule-update-proposal-full-template.md` | `@Retro`      |
| RULE_UPDATE_PROPOSAL (Lite) | `.agents/skills/templates/rule-update-proposal-lite-template.md` | `@Retro`      |
| ADVICE                      | `.agents/skills/templates/advice-template.md`                    | `@Consultant` |
| AUDITOR JSON 輸出           | `.agents/skills/auditor-rubric-prompts.md` 內含 schema           | `@Auditor`    |

**規範**：所有產出物模板統一存放於 `.agents/skills/`，Rules 主文件只保留參照路徑；禁止嵌入模板內容（依 `RULES_DESIGN_GUIDE §三`）。

---

## 八、派發前 Context 注入清單（Checklist）

派發子 Agent 前 @Lead 必依下列 8 項檢查：

- [ ] 任務情境是否觸發**熔斷機制**（§一）？是 → 暫停派發
- [ ] 是否需注入 **Tech-Stack**（§二）？依清單附路徑
- [ ] 是否需注入 **Domain**（§三）？依清單附路徑
- [ ] 是否需注入 **Skill**（§四）？依清單附路徑
- [ ] 是否需注入 **Task Checklist**（§五）？依清單附路徑
- [ ] 是否需注入 **Design Guide**（§六）？依清單附路徑
- [ ] 是否需注入 **Template**（§七）？依使用 Agent 附路徑
- [ ] 寫 ROUTING_TICKET.md（PROPOSAL_023）`tech_stacks` / `touched_files` / `artifact_paths` 欄位填齊

---

## 九、禁止行為

- **絕對禁止** 跳過資源映射查閱直接派發（讓子 Agent 憑空猜測技術棧）
- **絕對禁止** 注入過時或已遷移的路徑（如已移除的 `tasks/security-review.md`）
- **絕對禁止** 在 Rules 主文件嵌入模板內容（依 `RULES_DESIGN_GUIDE §三`）
- **絕對禁止** 領域 / 技術棧缺失時繼續派發（必先 HITL 補建知識庫）

---

## 關聯

- `rules/lead.md §s13` — 摘要 + 熔斷機制 + 本 skill pointer
- `skills/lead-orchestration-guide.md` — @Lead 派發完整指南
- `skills/routing-ticket-protocol.md` — ROUTING_TICKET schema
- `skills/orchestrator-pattern.md` — 模組設計模式（≥500 行模組必引用）
- `RULES_DESIGN_GUIDE §三` — 模板外部化規範
- ADR-0010 / ADR-0011 — Security 職責分離

---

**維護紀錄**：

- 2026-04-25：PROPOSAL_20260425_001 Phase B 建立（F1 類）
