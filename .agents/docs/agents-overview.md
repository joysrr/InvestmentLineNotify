# Multi-Agent 系統總覽

> **文件分層**：framework（跨專案通用）
> **類別**：framework-docs（`.agents/docs/` 層）
> **維護者**：`@Retro`（透過 RULE_UPDATE_PROPOSAL；收斂階段由 `@Architect` / `@Lead` 更新派生視圖）
> **對齐**：`RULES_DESIGN_GUIDE §二十 文件分層三原則`
> **備註**：本文件含 InvestmentLineNotify / strategyWeight 等歷史範例引用（當前主要服務專案）；框架層通用性由 rules/ 本體保證，歷史範例不影響跨專案搬運（依 PROPOSAL_20260423_004 §一.3 保留文件內容本體不動）。
>
> **文件定位**：`.agents/` Multi-Agent 框架的穩定入口文件。
> 對齊 PROPOSAL-021 Rules 結構（YAML frontmatter + XML section），
> 作為開發者、User 與未來自動化工具的單一概覽視圖。
>
> **單一事實來源（SSOT）**：本文件為派生視圖，所有規則以 `.agents/` 目錄為準。
> 若本文件與 `.agents/` 內容不一致，**以 `.agents/` 為準**，並請 `@Retro` 提案同步。
>
> **維護者**：`@Architect`（收斂階段更新）/ `@Lead`（提案執行後同步）
> **最後對齊提案**：PROPOSAL_20260422_021（派生視圖持續同步機制；含 T-1 一次性修補）
> **累計對齊提案**：PROPOSAL_20260422_001~019 + 021（20 份；020 已 CANCELLED 轉為本次 T-1 手動任務）

---

## 一、系統架構總覽

### 1.1 設計哲學

本系統是一個**以 `@Lead` 為工作流指揮官**的 Multi-Agent 開發協作框架，專為 InvestmentLineNotify（個人投資通知系統）量身打造。核心設計原則：

- **單一指揮官**：User 僅與 `@Lead` 互動，禁止直接呼叫其他 Agent
- **職責邊界明確**：每個 Agent 專注單一職能，跨職能溝通一律經 `@Lead` 轉達
- **動態注入**：`@Consultant` / `@Backend` / `@Frontend` / `@Reviewer` / `@QA` / `@Security` 的行為由 `@Lead` 傳入的外部文件決定，擴充新領域/技術不需改 Rules
- **規則即文件**：所有行為準則、禁止條款、HITL 觸發條件均文件化於 `.agents/`，無隱含知識
- **雙層可讀性**：每份 Rules 同時含 YAML frontmatter（機器可讀）+ Markdown body（人類可讀）

### 1.2 Rules 檔案分層

整個框架由 **14 份 Rules 文件 + 系統層 6 份** 構成（PROPOSAL_20260422_008 新增 @Auditor；002 新增 workspaces/；009 新增 tests/；014 新增 SYSTEM_THRESHOLDS.yaml；022 新增 WORKSPACE_SCHEMA.yaml；20260423_001 新增 FRAMEWORK_VERSION + CHANGELOG + scripts/；20260423_004 新增 `.agents/docs/` 層）：

```
.agents/
├── CURRENT_WORKSPACE             ← 當前 active workspace 指定（PROPOSAL_002）
├── FRAMEWORK_VERSION             ← 框架整體版本識別（PROPOSAL_20260423_001 新增）
├── CHANGELOG.md                  ← 框架層時序變更（PROPOSAL_20260423_001 新增；Keep a Changelog 格式）
├── RULES_DESIGN_GUIDE.md         ← 設計規範 orchestrator（v2.0；依 PROPOSAL_20260423_011 拆為 3 子檔；保 TOC + 專案特化參照 + 相容層）
├── RULES_DESIGN_GUIDE.DESIGN.md  ← 設計形式子檔（§一、三、五、六、九；依 PROPOSAL_20260423_011 新增）
├── RULES_DESIGN_GUIDE.SCOPE.md   ← 範圍治理子檔（§十一、十二、十五、十六、十七、二十、二十一；同上）
├── RULES_DESIGN_GUIDE.QUALITY.md ← 品質與量化子檔（§二、四、七、八、十四、十八、十九；同上）
├── docs/                         ← Framework 說明文件層（PROPOSAL_20260423_004 新增；跨專案通用，不可含專案業務內容）
│   ├── README.md                 ← 目錄說明 + 當前檔案清單 + §二十 分層規則
│   ├── agents-overview.md        ← 本文件（framework 總覽；從 `docs/` 移入）
│   ├── quality-audit-checklist.md       ← 通用評鑒表（從 `docs/Reports/` 移入 + 檔名統一）
│   └── quality-audit-automation-manual.md ← 自動化評審手冊（@Auditor Judge LLM 基礎；從 `docs/Reports/` 移入 + 檔名統一）
├── RULES_METADATA_SCHEMA.md      ← Metadata Schema SSOT（PROPOSAL-021）
├── RULES_VERSION_INDEX.md        ← 版本總索引（PROPOSAL-019）
├── SYSTEM_THRESHOLDS.yaml        ← 系統參數 SSOT（含 complexity_thresholds / MODEL_ROUTING / LANE_ROUTING；PROPOSAL_014+024+032）
├── WORKSPACE_SCHEMA.yaml         ← Workspace 欄位契約 SSOT（PROPOSAL_022 新增）
├── rules/
│   ├── system-prompt.md          ← AlwaysOn 模式判斷入口（1 份）
│   └── <12 份 Agent Rules>       ← 按需載入（含 auditor.md / PROPOSAL_008 新增）
├── workspaces/                   ← 專案環境變數（PROPOSAL_002 新增）
│   ├── README.md
│   ├── default_env.md            ← 空白模板
│   └── <project_name>.md         ← 各專案 workspace
├── tests/                        ← 驗證腳本（PROPOSAL_009 新增；022/025/027/028/029/20260423_004/006/008/012 擴充）
│   ├── README.md
│   ├── run-all.sh                ← 批次執行腳本（11 validators 聯合；008 並行升級；012 index_drift；015 proposal_scope）
│   ├── index-drift-validator.sh  ← INDEX 與 generator 輸出同步驗證（PROPOSAL_20260423_012 新增）
│   ├── proposal-scope-validator.mjs   ← 提案 scope 儲存位置一致性（PROPOSAL_20260423_015 新增）
│   ├── auto-generated-block.test.mjs  ← lib 單元測試 10 cases（PROPOSAL_20260423_012）
│   ├── gen-proposal-index.test.mjs    ← parseProposalStatus 單元測試 7 cases（PROPOSAL_20260423_012）
│   ├── lib/                      ← 共用函式庫（PROPOSAL_20260423_008 新增）
│   │   └── git-diff-detector.sh  ← --fast 模式依 git diff 偵測相關 validators
│   ├── scripts/                  ← scripts/ 測試（PROPOSAL_20260423_006 新增）
│   │   ├── unit.test.mjs         ← L1 單元測試（30 cases；node:test 零 npm）
│   │   ├── smoke.test.sh         ← L3 E2E 煙霧測試（9 cases；setup/trap cleanup）
│   │   └── run.sh                ← 統一測試入口（串 L1 + L3）
│   ├── schema-validator.mjs
│   ├── lead-stateless-audit.mjs
│   ├── artifact-format-validator.mjs
│   ├── proposal-intent-consistency.mjs
│   ├── workspace-schema-validator.mjs           ← PROPOSAL_022 新增；20260423_001 擴充 validateSkillsAndTasks
│   ├── agent-drift-simulator.mjs                ← PROPOSAL_025 新增（Mode A 靜態；Mode B 未實作）
│   ├── validate-auditor-dispatch.mjs            ← PROPOSAL_027 新增（Fragment 派遣驗證 + AUDIT_DECISION_LOG 稽核）
│   ├── ref-validator.mjs                        ← PROPOSAL_029 新增（!ref anchor + 循環引用）
│   ├── agents-overview-sync-validator.mjs       ← PROPOSAL_028 新增（5 項派生視圖對齐自動掃描）
│   └── docs-location-validator.mjs              ← PROPOSAL_20260423_004 新增（文件分層三原則偵測）
├── scripts/                      ← 本地工具（PROPOSAL_20260423_001 新增；無網路依賴）
│   ├── framework-diff.mjs        ← 框架層 vs 專案層 diff；多專案並行升級用
│   ├── init-workspace.mjs        ← 互動式 CLI；新專案 workspace 初始化（PROPOSAL_20260423_005 新增）
│   └── generators/               ← 索引自動產生器（PROPOSAL_20260423_007 + 012 + 015 擴充）
│       ├── README.md             ← 設計原則 + 工具清單 + 限制
│       ├── lib/                  ← 共用工具（PROPOSAL_20260423_012 新增）
│       │   └── auto-generated-block.mjs  ← AUTO-GENERATED 區塊 replace/check
│       ├── gen-rules-version-index.mjs  ← RULES_VERSION_INDEX 版本表（支援 --write / --check）
│       ├── gen-changelog.mjs     ← CHANGELOG [vX.Y] 條目模板（支援 --write / --check）
│       ├── gen-proposal-index.mjs ← PROPOSAL_INDEX 統計（支援 --write / --check / --workspace；015 擴充）
│       ├── gen-framework-version.mjs ← FRAMEWORK_VERSION bump（支援 --write / --check）
│       └── gen-proposal-summary.mjs ← 季度/區間提案摘要（015 新增；支援 --period / --range / --workspace）
├── proposals/                    ← framework scope 提案（跨專案資產演進史）
│   ├── PROPOSAL_INDEX.md         ← §🔗 提案意圖繼承關係表（PROPOSAL_006 新增；015 擴雙區）
│   ├── active/                   ← OPEN / IN_PROGRESS
│   ├── completed/                ← DONE / CANCELLED / REJECTED
│   ├── archived/                 ← 超過 2 個審計週期
│   └── summaries/                ← 季度/區間摘要（PROPOSAL_20260423_015 Phase C 新增）
│       ├── README.md             ← 摘要索引 + 產生指令 + 搬運規範
│       └── SUMMARY_2026Q2.md     ← 首次摘要（70 份提案）
├── decisions/                    ← Architecture Decision Records（ADR；依 PROPOSAL_20260423_016 建立；跨專案知識資產）
│   ├── README.md                 ← ADR index + 三層職責定義 + 編號規則 + 搬運規範
│   ├── ADR-TEMPLATE.md           ← 標準格式（Context / Decision / Consequences / Alternatives）
│   ├── PROPOSAL_MAPPING.md       ← PROPOSAL ↔ ADR 對照表
│   └── ADR-0001~0030.md          ← 30 份 ADR 覆蓋核心決策（Agent / Workflow / Security / Structure / Governance / Monitoring）
├── domains/                      ← @Consultant 領域知識庫（含 privacy-compliance.md）
├── skills/                       ← 模板與技能手冊（含 Agent examples 11/11 / auditor-rubric-prompts 18 Fragments / PROPOSAL_026 新增：lead-dispatch-patterns / consultant-bypass-rules / assistant-user-commands / PROPOSAL_030 新增：assistant-examples / reviewer-security-examples；20260423_001 對 9 份 F2 類補 §專案特化參照；20260423_002 新增：prior-art-scan-checklist（F2）/ prior-art-report-template（F1）；20260423_003 新增：diagnostic-playbook（F2）；20260423_010 分拆：rule-update-proposal-full-template / rule-update-proposal-lite-template）
├── tech-stacks/                  ← 技術棧規範
└── tasks/                        ← 事件觸發 checklist（PROPOSAL_026 新增：exemption-approval-workflow / emergency-shutdown-playbook（20260423_009 重構雙軌）；PROPOSAL_031 新增：audit-retro-coordination；PROPOSAL_20260423_001 新增：framework-upgrade-workflow；PROPOSAL_20260423_008 新增：periodic-design-review）
```

- **AlwaysOn 層**（1 份）：`system-prompt.md` — 每次對話必載入，≤ 500 tokens
- **按需層**（12 份）：`rules/*.md` — 依任務類型動態載入，每份目標 ≤ 1000 tokens（部分超標見 RULES_VERSION_INDEX）
- **設計/Schema/Index 層**（7 份 + ADR 目錄；依 PROPOSAL_20260423_011 + 013 + 016）：`RULES_DESIGN_GUIDE.md`（orchestrator）+ `RULES_DESIGN_GUIDE.DESIGN.md` + `.SCOPE.md` + `.QUALITY.md`（3 主題子檔）+ `RULES_METADATA_SCHEMA` / `RULES_VERSION_INDEX` / `SYSTEM_THRESHOLDS.yaml` + `FRAMEWORK_REQUIREMENTS.md`（依 013；runtime 規範）+ **`decisions/` ADR 目錄**（30 份；依 016 決策層），僅 `@Retro` 與 `@Lead` 維護
- **版本治理層**（2 份；PROPOSAL_20260423_001 新增）：`FRAMEWORK_VERSION` + `CHANGELOG.md`，由 `@Lead` 於每次提案 Phase E 更新

---

## 二、Agent 名冊（12 Agents + 1 AlwaysOn）

### 2.1 全員總覽表

| # | Rules 檔案 | Agent | 角色定位 | 核心職責 | 主要產出物 |
|---|-----------|-------|---------|---------|-----------|
| 0 | `system-prompt.md` | — | AlwaysOn 入口 | 判斷任務模式、觸發 `@Lead`、全局緊急阻斷 | （純規則，無產出）|
| 1 | `lead.md` | `@Lead` | 工作流指揮官 | 接收 User 指令、派發 Agent、執行 Gate Check | `PENDING_ACTIONS.md` 更新、Gate Check 通知 |
| 2 | `planner.md` | `@Planner` | 專案經理（PM）| 管理功能狀態流轉、撰寫 User Story + AC | `ideas/preplan/draft/finishedplan_features.md`、`ADVICE_RESPONSE_*.md` |
| 3 | `consultant.md` | `@Consultant` | 領域顧問（動態化身）| 從 `domains/*.md` 注入的金融視角審查需求、偵測衝突 | `docs/plans/advice/ADVICE_*.md` |
| 4 | `architect.md` | `@Architect` | 系統架構師 | 設計階段產 API Spec、收斂階段更新架構文件 | `docs/api/*.md`、`docs/architecture.md`、`docs/modules/*` |
| 5 | `qa.md` | `@QA` | 品質保證專家 | 開發前產 Test Spec、開發後執行驗證測試 | `TEST_SPEC_*.md`、`TEST_REPORT.md` |
| 6 | `backend.md` | `@Backend` | 後端開發者 | 實作 API、排程、策略引擎 | `src/` 程式碼、單元測試、部署指令清單 |
| 7 | `frontend.md` | `@Frontend` | 前端開發者 | 實作 Telegram Mini App UI、串接 API | `webapp/` 程式碼、元件測試 |
| 8 | `reviewer.md` | `@Reviewer` | 資深程式碼審查員 | 程式碼品質/可讀性/效能審查（非安全範疇）| `REVIEW_REPORT.md` |
| 9 | `security.md` | `@Security` | 資訊安全審查員（PROPOSAL-020 新增）| 依 SC-01~SC-10 範疇執行資安審查，與 `@Reviewer` **平行** | `SECURITY_REPORT.md` |
| 10 | `retro.md` | `@Retro` | 敏捷教練（進化管理員）| 根因分析、提案修改 `.agents/` 規則 | `.agents/proposals/active/PROPOSAL_*.md` |
| 11 | `assistant.md` | `@Assistant` | 巡邏與通知管理員 | 自動偵測異常、維護 `PENDING_ACTIONS.md` / `GLOBAL_STATUS_SUMMARY.md` | `PENDING_ACTIONS.md` / `GLOBAL_STATUS_SUMMARY.md` |
| 12 | `auditor.md` | `@Auditor` | 品質審計員（PROPOSAL_008 新增）| 定期 5 維度 × 15 細項評分，產出時序歷史供 @Retro 參照 | `docs/Reports/AUDIT_HISTORY.md` |

### 2.2 動態注入 Agent 對應

6 個 Agent 採動態注入設計，核心行為由 `@Lead` 任務時傳入的外部文件決定：

| Agent | 注入來源 | 決定內容 |
|-------|---------|---------|
| `@Consultant` | `.agents/domains/*.md` | 金融流派視角、審查邏輯、衝突偵測 |
| `@Backend` | `tech-stacks/*.md`（含 telegram-bot）、`skills/infra-constraints.md`、workspace `DEPLOYMENT_SOP` | 語言規範、部署流程、資源限制 |
| `@Frontend` | `tech-stacks/*.md`（含 telegram-miniapp / telegram-miniapp-sdk / vue3-component-pattern）| 框架規範、WebApp SDK、ThemeParams |
| `@Reviewer` | 對應 Agent 的 DoD 章節 + `skills/*.md` | 審查 Checklist（動態組合）|
| `@QA` | 對應 Agent 的 DoD 章節 + `tech-stacks/web-backend/testing-nodejs.md` | 測試範疇、測試框架規範 |
| `@Security` | `skills/security-audit.md`、`tech-stacks/messaging/telegram-miniapp-sdk.md`、`tech-stacks/storage/file-based-storage.md` | SC-01~SC-10 審查項目、鐵律 |

### 2.3 Agent 互動關係（一律經 `@Lead`）

```
                            User
                              │
                              ▼
                  ┌──────── @Lead ────────┐
                  │  （唯一接收 User 指令） │
                  └─────────┬─────────────┘
                            │ 派發
  ┌──────┬──────┬──────┬───┴────┬──────┬──────┬──────┬──────┐
  ▼      ▼      ▼      ▼        ▼      ▼      ▼      ▼      ▼
@Planner @Consultant @Architect @QA @Backend @Frontend @Reviewer @Security @Retro
                                                          │        │
                                                          └─平行───┘
                                                            審查
                                                          (衝突仲裁
                                                           經 @Lead)
                              │
                              ▼
                       @Assistant（巡邏）
```

> **鐵律**：任兩個 Agent 之間**不得直接互動**，所有跨 Agent 訊息傳遞一律經 `@Lead` 轉達；`@Assistant` 為唯一被動觀察者，不接收主動呼叫。

---

## 三、核心工作流（10 階段派發順序）

依 `.agents/rules/lead.md §核心工作流引擎`，`@Lead` 依下表順序派發，不可跳過（**第 6.5 為條件式**）；依 PROPOSAL_20260422_032 新增**車道分流**機制：`Lane: fast` 跳過第 2/4/6/6.5/7 階段、`Lane: standard` 跳過第 2/6.5 階段、`Lane: heavy` 全量執行（詳見 SYSTEM_THRESHOLDS.LANE_ROUTING.gate_matrix）：

### 3.1 階段總覽

| 階段 | 名稱 | 呼叫 Agent | 關鍵動作 | Gate Check |
|------|------|-----------|---------|-----------|
| 0 | 前置檢查 | `@Lead` | 確認 `PENDING_ACTIONS.md` 🔴 區塊為空 | 有 🔴 → 阻斷啟動 |
| 1 | 需求規劃 | `@Planner` | 撰寫 User Story + AC，產 `draft_features.md` v1 | User 確認草案 |
| 2 | 戰略審查 | `@Consultant` | 依 `domains/*.md` 審查，產 `ADVICE_*.md` | 若 🔴 風險 → 強制 @Planner 整合 |
| 3 | 架構設計 | `@Architect` | 依 S/M/L 動態範疇機制產 API Spec | 技術依賴缺失 → 🚧 阻斷 |
| 4 | 測試規格 | `@QA`（介入點一）| 將 AC 轉 Test Case，產 `TEST_SPEC_*.md` | — |
| 5 | 實作 | `@Backend` / `@Frontend`（可並行）| 依 API Spec + Test Spec 實作，DoD 自評 | 雙方自評完成 |
| 6 | 程式碼審查 | `@Reviewer` | 產 `REVIEW_REPORT.md`（非安全範疇）| 無 BLOCKER |
| **6.5** | **資安審查（條件式）** | **`@Security`** | **依 `skills/security-audit.md §1` SC-01~10 判斷；與第 6 平行** | **無 BLOCKER** |
| 7 | 驗證測試 | `@QA`（介入點二）| 邊界值 + 整合測試，產 `TEST_REPORT.md` | 全數通過 |
| 8 | 收斂 | `@Architect` + `@Planner` + `@Assistant` | 更新 `docs/`、標記完成、觸發巡邏 | User 確認 Artifact Checklist |
| 9 | 進化 | `@Retro` | 分析根因，產提案至 `proposals/active/` | 等待 User 採納 |

### 3.2 第 6 / 6.5 平行審查流程（PROPOSAL-020）

依 `lead.md §平行審查與衝突仲裁規則`，當第 6.5 SC 範疇觸發時：

```
@Lead
  │
  ├───同時派發──→ @Reviewer（第 6）────────→ REVIEW_REPORT.md
  │                                             │
  └───同時派發──→ @Security（第 6.5）──────→ SECURITY_REPORT.md
                  （若 SC-01~10 觸發）           │
                                                 ▼
                                           @Lead 合併
                                           「統一退件清單」
                                                 │
                                                 ▼
                                     @Backend / @Frontend
                                     一次性修正後重送審
                                                 │
                                                 ▼
                                     複審計入 REVIEW_CYCLE_LIMIT
                                     （兩方共用計數器）
```

### 3.3 衝突仲裁規則（四層防線）

| 防線 | 機制 | 說明 |
|------|------|------|
| **1 職責互斥** | 明文切分範疇 | `@Security` 專屬 SC-01~10；`@Reviewer` 專屬程式碼品質/效能（未涉安全）|
| **2 平行派發** | 絕對禁止序列派發 | `@Lead` 必須同時派發，避免先後退件循環 |
| **3 衝突仲裁** | 安全優先原則 | 安全 vs 可讀性：`@Security` 優先；安全 vs 效能：`@Security` 優先但須提供 3 個緩解方案 |
| **4 共用計數** | 單點配置 | `REVIEW_CYCLE_LIMIT`（§十四，預設 2）兩方共用 |

### 3.4 退件關係總表

| 發起 | 對象 | 觸發條件 | 上限 |
|------|------|---------|------|
| `@Consultant` | `@Planner`（經 `@Lead`）| ADVICE 含 🔴 或 🚨 領域衝突 | — |
| `@Architect` | `@Planner` | 技術依賴缺失 | — |
| `@Frontend` | `@Architect` | API Spec 無法滿足 UI | — |
| `@Reviewer` | `@Backend` / `@Frontend` | REVIEW_REPORT 含 🔴 BLOCKER | `REVIEW_CYCLE_LIMIT`（2）|
| `@Security` | `@Backend` / `@Frontend` | SECURITY_REPORT 含 🔴 BLOCKER | `REVIEW_CYCLE_LIMIT`（共用）|
| `@QA` | `@Backend` / `@Frontend` | TEST_REPORT 含未解決 Bug | `QA_RETEST_LIMIT`（3）|

---

## 四、通知分級與巡邏機制

### 4.1 五級通知符號（PROPOSAL-017）

依 `.agents/RULES_DESIGN_GUIDE.md §九`，全系統統一 5 個符號。所有 Agent 向 `@Lead` 回報的標頭行**必須**包含對應符號：

| 級別 | 符號 | 含義 | `@Lead` 處理時限 |
|------|------|------|----------------|
| CRITICAL | 🔴 | 需立即處理，可能阻斷系統執行 | 本次對話立即處理 |
| BLOCKED | ❌ | 執行被阻斷，需外部解除 | 本次對話立即處理 |
| WARNING | 🟡 | 需關注，不阻斷但有潛在風險 | 本次對話結束前處理 |
| DONE | ✅ | 任務 / 項目已完成 | 無需處理，確認即可 |
| INFO | 🟢 | 資訊性通知，無需立即行動 | 下次巡邏前處理或記錄 |

**格式規範**：
```
【@{Agent} {回報類型}】{級別符號} {簡短描述}
```

**禁止行為**：
- 絕對禁止使用此標準以外的符號
- 絕對禁止單一通知混用兩個以上級別（以最高級別為代表）
- 跨級別需求必須拆分為多個獨立通知

### 4.2 @Assistant 巡邏規則（P-01 ~ P-20）

依 `.agents/rules/assistant.md §巡邏規則`，`@Assistant` 依以下 **20 條規則**被動偵測異常，產出寫入 `PENDING_ACTIONS.md`：

| 巡邏 ID | 掃描目標 | 偵測條件 | 通知類型 | 級別 | 阻斷新功能 |
|---------|---------|---------|---------|------|-----------|
| P-01 | `REVIEW_REPORT.md` | 複審 ≥ `REVIEW_CYCLE_LIMIT`（2）仍有 BLOCKER；與 P-11 **共用計數** | `REVIEW_QUALITY` | 🔴 | ✅ |
| P-02 | `TEST_REPORT.md` | 重測 ≥ `QA_RETEST_LIMIT`（3）仍有 Bug | `QA_QUALITY` | 🔴 | ✅ |
| P-03 | `proposals/*.md` | 狀態 `IN_PROGRESS` 且距上次 Retro 超過一個任務週期 | `RETRO_TIMEOUT` | 🟡 | ❌ |
| P-04 | `proposals/*.md` | 狀態 `OPEN` 且含 `🚨 反覆問題警告` | `RETRO_REPEAT` | 🔴 | ✅ |
| P-05 | `proposals/*.md` | 狀態 `OPEN`（任何新提案）| `RETRO_PROPOSAL` | 🟡 | ❌ |
| P-06 | `ADVICE_*.md` | 含 `🚨 領域衝突警告` 且 `strategyWeight` 未填 | `CONSULTANT_CONFLICT` | 🔴 | ✅ |
| P-07 | `ADVICE_*.md` | 含 `⚠️ 未採納高風險建議` | `CONSULTANT_RISK` | 🔴 | ✅ |
| P-08 | `docs/api/*.md` | API 規格退回請求超過一個任務週期未回應 | `FRONTEND_API_BLOCK` | 🟡 | ❌ |
| P-09 | `REVIEW_REPORT.md` | 標記 Hotfix 且收斂文件未更新 | `HOTFIX_DOC_PENDING` | 🟡 | ❌ |
| P-10 | `PENDING_ACTIONS.md` 豁免區塊 | 未歸檔豁免記錄 ≥ `EXEMPTION_AUDIT_THRESHOLD`（5 筆）| `EXEMPTION_ACCUMULATED` | 🟡 | ❌ |
| **P-11** | **`SECURITY_REPORT.md`** | **複審 ≥ `REVIEW_CYCLE_LIMIT`（2）仍有 BLOCKER；與 P-01 共用計數** | **`SECURITY_AUDIT_FAIL`** | **🔴** | **✅** |
| **P-12** | **`CURRENT_WORKSPACE` + `workspaces/`** | **workspace 缺失或欄位不完整（PROPOSAL_002）** | **`WORKSPACE_MISSING`** | **🔴** | **✅** |
| **P-13** | **`docs/Reports/GLOBAL_STATUS_SUMMARY.md`** | **摘要過期超過 `SUMMARY_STALE_THRESHOLD`（5，PROPOSAL_004）** | **`SUMMARY_STALE`** | **🟢** | **❌** |
| **P-14** | **`proposals/completed/*.md` + `PROPOSAL_INDEX §🔗`** | **新提案推翻歷史意圖但未標注繼承（PROPOSAL_007）** | **`PROPOSAL_INTENT_REGRESSION`** | **🔴** | **✅** |
| **P-15** | **`docs/Reports/AUDIT_HISTORY.md`** | **最新評分任一維度 < `AUDIT_DIMENSION_MIN_SCORE`（3.0，PROPOSAL_008）** | **`AUDIT_QUALITY`** | **🟡** | **❌** |
| **P-16** | **`WORKSPACE_SCHEMA.yaml` + `workspaces/<active>.md`** | **workspace-schema-validator exit 2（required 欄位缺失，PROPOSAL_022）** | **`WORKSPACE_REQUIRED_MISSING`** | **🔴** | **✅** |
| **P-17** | **`WORKSPACE_SCHEMA.yaml` + `workspaces/<active>.md`** | **workspace-schema-validator exit 1（recommended 欄位缺失，PROPOSAL_022）** | **`WORKSPACE_RECOMMENDED_MISSING`** | **🟡** | **❌** |
| **P-18** | **`.agents/proposals/` + `workspaces/<*>/proposals/`** | **scope 欄位與儲存位置不符 / scope 欄位缺失 / project 提案缺前綴（PROPOSAL_023）** | **`PROPOSAL_SCOPE_MISCLASSIFIED`** | **🟡** | **❌** |
| **P-19** | **`PENDING_ACTIONS.md` 派發紀錄 + `SYSTEM_THRESHOLDS.MODEL_ROUTING`** | **派發指令未含 Model: 欄位 / 模型與 complexity 不符 / force_complex_scenarios 未升 complex（PROPOSAL_024）** | **`MODEL_ROUTING_VIOLATION`** | **🟡** | **❌** |
| **P-20** | **`PENDING_ACTIONS.md §LANE_ESCALATION_*` + `SYSTEM_THRESHOLDS.LANE_ROUTING`** | **24h 同類任務升級 ≥ 3 次 / 派發缺 Lane: 欄位 / force_complex 未走 heavy（PROPOSAL_032）** | **`LANE_ESCALATION`** | **🟡** | **❌** |

### 4.3 User 解除指令對照

每項 🔴 / 🟡 通知均配對一條 User 解除指令：

| 通知 | 解除指令 |
|------|---------|
| `REVIEW_QUALITY` | `重新評估實作方案 <功能名稱>` |
| `QA_QUALITY` | `重新評估需求範圍 <功能名稱>` |
| `RETRO_TIMEOUT` | `繼續執行提案 PROPOSAL_YYYYMMDD_NNN` |
| `RETRO_REPEAT` / `RETRO_PROPOSAL` | `採納提案 PROPOSAL_YYYYMMDD_NNN` 或 `拒絕提案 PROPOSAL_YYYYMMDD_NNN，原因：<說明>` |
| `CONSULTANT_CONFLICT` | 在 `ADVICE_*.md` 填寫 `strategyWeight` 後回覆 `已填寫 strategyWeight，請繼續` |
| `CONSULTANT_RISK` | `確認接受風險 <ADVICE_*.md 檔名>` 或 `退回修改需求 <功能名稱>` |
| `FRONTEND_API_BLOCK` | `確認 API 規格修改 <模組名稱>` |
| `HOTFIX_DOC_PENDING` | （更新收斂文件後自動關閉）|
| `EXEMPTION_ACCUMULATED` | `執行豁免審計` |
| `SECURITY_AUDIT_FAIL` | `重新評估實作方案 <功能名稱>` |

### 4.4 自動關閉機制

`@Assistant` 每次巡邏結束後對所有未關閉 🔴 / 🟡 項目執行反向檢查：條件消失 → 自動關閉，移至「最近已處理」；條件仍成立 → 保留不動。

---

## 五、動態注入機制

### 5.1 設計意義

6 個 Agent（`@Consultant` / `@Backend` / `@Frontend` / `@Reviewer` / `@QA` / `@Security`）的核心行為由 `@Lead` 任務時傳入的外部文件決定。新增領域知識、技術規範或技能手冊時，**只需新增對應文件，不需修改任何 Agent 的 rules 本體**。

### 5.2 注入來源目錄

```
.agents/
├── domains/          ← @Consultant 領域知識庫（金融流派）
│   ├── finance-left-side.md
│   ├── finance-lifecycle.md
│   ├── finance-technical.md
│   └── math-quant.md
├── tech-stacks/      ← @Backend / @Frontend / @Security 技術規範（PROPOSAL_022 純淨分離 + 扁平命名）
│   ├── nodejs-esm-backend.md
│   ├── vue3-vite.md
│   ├── vue3-component-pattern.md           ← PROPOSAL_022 Phase H 由 skills/ 遷移
│   ├── file-based-storage.md
│   ├── telegram-bot.md                     ← PROPOSAL_022 Phase H 由 skills/ 遷移（去 -pattern）
│   ├── telegram-miniapp.md                 ← PROPOSAL_022 Phase H 由 skills/ 遷移（UI 模式）
│   ├── telegram-miniapp-sdk.md             ← PROPOSAL_022 Phase H 重命名自 telegram-mini-app.md（SDK 協定）
│   └── testing-nodejs.md
├── skills/           ← 模板與技能手冊（技術無關；PROPOSAL_022 Phase C 瘦身）
│   ├── security-audit.md（@Security SC-01~10 清單）
│   ├── infra-constraints.md                ← PROPOSAL_022 Phase C 拆分（保留通用）
│   ├── advice-template.md
│   ├── review-report-template.md
│   ├── test-spec-template.md
│   └── ...（15 份模板與手冊）
└── tasks/            ← 事件觸發 checklist
    ├── hotfix-checklist.md
    ├── new-agent-onboarding.md
    └── domain-creation-guide.md
```

### 5.3 各 Agent 注入對應

| Agent | 必備注入 | 條件式注入 |
|-------|---------|-----------|
| `@Consultant` | `domains/*.md`（至少 1 份）| — |
| `@Backend` | `tech-stacks/web-backend/nodejs-esm-backend.md` | `tech-stacks/messaging/telegram-bot.md` / workspace `DEPLOYMENT_SOP` / `skills/infra-constraints.md` |
| `@Frontend` | `tech-stacks/web-frontend/vue3-vite.md` | `tech-stacks/messaging/telegram-miniapp.md` / `tech-stacks/messaging/telegram-miniapp-sdk.md` / `tech-stacks/web-frontend/vue3-component-pattern.md` / `skills/infra-constraints.md` |
| `@Reviewer` | 對應 Agent 的 DoD 章節 | 依任務範疇組合 `tech-stacks/*.md` + `skills/*.md` |
| `@QA` | `tech-stacks/web-backend/testing-nodejs.md` | 依任務範疇組合 `skills/*.md` |
| `@Security` | `skills/security-audit.md` | `tech-stacks/messaging/telegram-miniapp-sdk.md` / `file-based-storage.md` |

**設計優點**：`@Reviewer` / `@QA` / `@Security` 不持有任何 Checklist，永遠審查各 Agent DoD 與 SC 清單的**最新版本**，不會因 Rules 未同步更新而遺漏規範。

---

## 六、提案生命週期（`@Retro`）

### 6.1 四種狀態 + 三層目錄（PROPOSAL-016）+ 兩 Scope 分層（PROPOSAL-023）

依 PROPOSAL_20260422_023，提案依 **scope** 分兩類儲存：

| Scope | 目錄位置 | 編號格式 | 索引 |
|-------|---------|---------|------|
| `framework` | `.agents/proposals/` | `PROPOSAL_YYYYMMDD_NNN` | `.agents/proposals/PROPOSAL_INDEX.md` |
| `project:<name>` | `.agents/workspaces/<name>/proposals/` | `<PROJECT_PREFIX>_PROPOSAL_YYYYMMDD_NNN` | `.agents/workspaces/<name>/proposals/PROPOSAL_INDEX.md` |

Scope 判定依 `RULES_DESIGN_GUIDE §十七.B` 3 步機械化流程；混合 scope 強制拆分為獨立提案。



```
@Retro 產出提案
     │
     ▼
  ┌──────┐   User 採納    ┌─────────────┐   @Lead 完成    ┌──────┐
  │ OPEN │───────────────▶│ IN_PROGRESS │────────────────▶│ DONE │
  └──┬───┘                └─────────────┘                 └──┬───┘
     │                                                       │
     │ User 拒絕                                             │ 超過 2 個
     ▼                                                       │ 審計週期
  ┌───────────┐                                              ▼
  │ CANCELLED │                                        ┌──────────┐
  └───────────┘                                        │ ARCHIVED │
                                                       └──────────┘
```

| 狀態 | 目錄 | 可執行操作 |
|------|------|-----------|
| `OPEN` | `proposals/active/` | User 採納 / 拒絕 |
| `IN_PROGRESS` | `proposals/active/` | `@Lead` 執行中 |
| `DONE` | `proposals/completed/` | 等待 `@Retro` 歸檔 |
| `CANCELLED` | `proposals/completed/` | 永久保留（納入反覆問題計數）|
| `ARCHIVED` | `proposals/archived/` | 歷史參考，不納入計數 |

### 6.2 規模警示門檻（`retro.md`）

| 指標 | 警示門檻 | 處理動作 |
|------|---------|---------|
| `active/` OPEN 累積 | ≥ `PROPOSAL_OPEN_WARN`（15）| `@Retro` 評估優先級，建議啟動 Sprint |
| `completed/` 未歸檔 | ≥ `PROPOSAL_UNARCHIVED_WARN`（10）| `@Retro` 執行批次歸檔 |
| 全目錄總計 | ≥ `PROPOSAL_TOTAL_WARN`（50）| `@Retro` 提出目錄重整提案 |

### 6.3 提案粒度規則

每份提案**只能包含**：
- 一個目標 Agent（禁止跨 Agent 捆綁）
- 一條規則變更（禁止同時修改多章節）
- 一個根因層級（REQ / ARCH / DEV / TEST 擇一）

**設計理由**：確保每份提案可獨立採納或拒絕，避免 User 面對「捆綁決策」。

### 6.4 反覆問題警告（PROPOSAL-010）

`@Retro` 以「目標 Agent + 根因分類」為鍵值掃描歷史提案；累計達第 3 次出現時，提案頂部強制加上 `🚨 反覆問題警告`，觸發 P-04 🔴 `RETRO_REPEAT` 並阻斷新功能，強迫 User 介入決策。

---

## 七、系統參數配置（§十四 SSOT）

依 PROPOSAL-020 建立，所有數值門檻的**單一配置點**於 `.agents/RULES_DESIGN_GUIDE.md §十四`。
**自 PROPOSAL_014 起**：實際數值外部化於 `.agents/SYSTEM_THRESHOLDS.yaml`；`§十四` 保留分類與用途說明。修改 YAML 即自動影響所有引用 Rules，**無需同步更新多處**。

### 7.1 參數總表

| 類別 | 參數名 | 預設值 | 說明 |
|------|-------|-------|------|
| **審查循環** | `REVIEW_CYCLE_LIMIT` | 2 | `@Reviewer` + `@Security` 共用複審上限 |
| | `QA_RETEST_LIMIT` | 3 | `@QA` 重測上限 |
| **巡邏與狀態** | `PATROL_CYCLE` | 3 個工作對話 | 標準巡邏週期 |
| | `PATROL_OVERDUE` | 5 個工作對話 | 即時觸發（超時保底）|
| | `PENDING_YELLOW_EXPIRE` | 3 對話 | 🟡 過期升 🔴 |
| | `PENDING_RED_EXPIRE` | 2 對話 | 🔴 高優異常過期（觸發全局阻斷條件二）|
| | `PENDING_DONE_EXPIRE` | 5 對話 | ✅ DONE 未歸檔提示 |
| **豁免與提案** | `EXEMPTION_AUDIT_THRESHOLD` | 5 筆 | 觸發 `@Retro` 豁免審計（P-10）|
| | `PROPOSAL_OPEN_WARN` | 15 份 | OPEN 規模警示 |
| | `PROPOSAL_UNARCHIVED_WARN` | 10 份 | 完成未歸檔警示 |
| | `PROPOSAL_TOTAL_WARN` | 50 份 | 目錄總量警示 |
| **Token 預算** | `TOKEN_ALWAYSON_LIMIT` | 500 | AlwaysOn 文件上限 |
| | `TOKEN_ONDEMAND_LIMIT` | 1000 | 按需載入 Rules 上限 |
| **輸出與歸檔** | `SUMMARY_STALE_THRESHOLD` | 5 | P-13 摘要過期門檻（PROPOSAL_004）|
| | `SUMMARY_HISTORY_LIMIT` | 3 | `archive/summary/` 保留份數 |
| **Workspace** | `WORKSPACE_DEFAULT_FALLBACK` | 保守升級 | `CURRENT_WORKSPACE` 缺失的預設行為（PROPOSAL_002）|
| **品質審計** | `AUDIT_INTERVAL` | 10 工作對話 | `@Auditor` 定期派遣週期（PROPOSAL_008）|
| | `AUDIT_HISTORY_RETAIN_MONTHS` | 12 | AUDIT_HISTORY 保留期 |
| | `AUDIT_DIMENSION_MIN_SCORE` | 3.0 | P-15 觸發門檻（任一維度低於此值）|
| **複雜度評估** | `complexity_thresholds` | 3 tier（simple / medium / complex）| 依 input_tokens / reasoning_steps / artifact_paths 三維度判定（PROPOSAL_024+032 共用）|
| **Model Routing** | `MODEL_ROUTING.model_tier_map` | haiku / sonnet / opus | 依 complexity 分配模型層級；`force_complex_scenarios` 涵蓋 strategyWeight / @Security / Hotfix / @Retro / @Auditor（PROPOSAL_024）|
| **Lane Routing** | `LANE_ROUTING.lane_map` | fast / standard / heavy | 依 complexity 分配工作流車道；含 20 項快車道指標 + gate_matrix + auto_escalation_triggers（PROPOSAL_032）|

### 7.2 變更規範

- **絕對禁止** 直接修改 §十四 參數值；調整必須透過 `RULE_UPDATE_PROPOSAL` 流程
- 調整後 `@Lead` **不必**同步更新引用文件（各文件採參數名參照，自動套用新值）
- 本章節調整計為 `RULES_DESIGN_GUIDE.md` 的 `minor +1` 版本遞增

---

## 八、Rules 版本控制與 Metadata Schema

### 8.1 版本標頭標準（PROPOSAL-019）

所有 Rules 文件在第一個章節前必須包含版本標頭：

```
***
版本：v{major}.{minor}
最後修改：{YYYY-MM-DD}
修改提案：{PROPOSAL-XXX}
修改摘要：{一句話描述}
審計基準：v{major}.{minor}
***
```

- **major +1**：章節結構重組 / Persona 或角色邊界重大調整 / 向下不相容
- **minor +1**：新增章節或條文 / 修改現有條文語意 / 修正錯誤或補充

版本總索引維護於 `.agents/RULES_VERSION_INDEX.md`。

### 8.2 Metadata Schema（PROPOSAL-021）

依 `.agents/RULES_METADATA_SCHEMA.md`，所有 Rules 文件除六章節外**必須**包含三層結構：

```
第 1 層：YAML Frontmatter（機器可讀 metadata）
---
agent_id: ...
file_type: agent_rule | always_on | design_guide
version: v1.x
workflow_stages: [...]
interacts_with: [...]
references: {...}
constraints_ref: {review_cycle_limit: !ref RULES_DESIGN_GUIDE.md#REVIEW_CYCLE_LIMIT}
---

第 2 層：H1 + 版本標頭（人類摘要層）

第 3 層：Markdown Body + XML section 標籤（LLM 注意力層）
<section id="s01" priority="critical|high|normal|info" [immutable="true"]>
## 章節標題
...內容...
</section>
```

### 8.3 AlwaysOn 例外

`system-prompt.md`（AlwaysOn）依 Schema §四之一 適用例外：
- 免 body 版本標頭
- 免 `<section>` 標籤
- Frontmatter 為唯一 metadata 層
- 受 `TOKEN_ALWAYSON_LIMIT`（500）硬性限制

### 8.4 `immutable="true"` 保護章節（8 處）

以下 8 個章節標 `priority="critical" immutable="true"`，修改需透過提案：

| 檔案 | 章節 |
|------|------|
| `system-prompt.md` | 全局緊急阻斷（section s04 略）|
| `lead.md` | 平行審查與衝突仲裁規則、豁免授權與記錄機制 |
| `consultant.md` | 核心禁止條款 |
| `backend.md` | HITL 升級條件 |
| `security.md` | 審查職責邊界、禁止行為清單 |
| `RULES_DESIGN_GUIDE.md` | 系統參數配置（§十四）|

---

## 九、文件索引與引用

### 9.1 `.agents/` 核心文件

| 文件 | 用途 | 維護者 |
|------|------|-------|
| `RULES_DESIGN_GUIDE.md` | 設計規範（§一 ~ §十五）| `@Retro` 提案維護 |
| `RULES_METADATA_SCHEMA.md` | Metadata Schema SSOT | `@Retro` 提案維護 |
| `RULES_VERSION_INDEX.md` | 版本總索引 | `@Lead` 提案執行後同步 |
| `proposals/PROPOSAL_INDEX.md` | 提案總索引 | `@Lead` 狀態變更時同步 |

### 9.2 Rules 文件清單（當前版本）

| # | 檔案 | 當前版本 | Agent |
|---|------|---------|-------|
| 1 | `rules/system-prompt.md` | v1.2 | —（AlwaysOn）|
| 2 | `rules/lead.md` | v1.2 | `@Lead` |
| 3 | `rules/planner.md` | v1.1 | `@Planner` |
| 4 | `rules/consultant.md` | v1.1 | `@Consultant` |
| 5 | `rules/architect.md` | v1.1 | `@Architect` |
| 6 | `rules/qa.md` | v1.3 | `@QA` |
| 7 | `rules/backend.md` | v1.1 | `@Backend` |
| 8 | `rules/frontend.md` | v1.1 | `@Frontend` |
| 9 | `rules/reviewer.md` | v1.3 | `@Reviewer` |
| 10 | `rules/security.md` | v1.1 | `@Security` |
| 11 | `rules/retro.md` | v1.3 | `@Retro` |
| 12 | `rules/assistant.md` | v1.3 | `@Assistant` |
| 13 | `rules/auditor.md` | v1.0 | `@Auditor` |

### 9.3 產出物交叉引用

| 產出物 | 產出者 | 存放位置 |
|-------|-------|---------|
| `PENDING_ACTIONS.md` | `@Assistant` / `@Lead` | 專案根目錄 |
| `draft_features.md` / `finishedplan_features.md` | `@Planner` | `docs/plans/` |
| `ADVICE_*.md` | `@Consultant` | `docs/plans/advice/` |
| `ADVICE_RESPONSE_*.md` | `@Planner` | `docs/plans/advice/` |
| API Spec | `@Architect` | `docs/api/<模組>_api.md` |
| 系統架構 / 模組文件 | `@Architect`（收斂階段）| `docs/architecture.md` / `docs/modules/*` |
| `TEST_SPEC_*.md` / `TEST_REPORT.md` | `@QA` | 專案根目錄 |
| `REVIEW_REPORT.md` | `@Reviewer` | 專案根目錄 |
| `SECURITY_REPORT.md` | `@Security` | 專案根目錄 |
| `PROPOSAL_*.md` | `@Retro` | `.agents/proposals/active/` |
| `AUDIT_HISTORY.md` | `@Auditor`（PROPOSAL_008）| `docs/Reports/AUDIT_HISTORY.md`|
| `GLOBAL_STATUS_SUMMARY.md` | `@Assistant`（PROPOSAL_004）| `docs/Reports/GLOBAL_STATUS_SUMMARY.md`|
| `DoD_AUDIT_LOG.md` | `@Lead`（PROPOSAL_012）| `docs/DoD_AUDIT_LOG.md`|

### 9.4 相關 Reports 快照

以下文件為**時間點快照**（非 ongoing 維護）：

- `docs/Reports/InvestmentLineNotify AI Agents 系統總覽.md` — 細節版系統總覽（與本文件互補，重在呈現工作流視覺化）
- `docs/Reports/InvestmentLineNotify AI Agents 系統評鑑報告.md` — 系統品質評鑑（五維度評分矩陣）

---

## 十、維護規範

- **更新時機**：每次提案執行合併後，由 `@Lead` 檢查本文件是否需要同步
- **觸發條件**：以下任一 → 必須更新本文件（依 PROPOSAL_021 強制列入提案 Phase E）
  - 新增 / 移除 / 重命名 Agent
  - Workflow 階段增減
  - 巡邏規則 P-XX 增減
  - 通知分級符號變動
  - `§十四` 參數新增
  - Metadata Schema 變更
  - 新建 `rules / skills / tasks / domains / tests / workspaces` 結構層變化
  - 產出物新增（影響 §9.3 交叉引用表）
- **偵測機制**（依 PROPOSAL_021）：`@Auditor` 維度 2.2 自動掃描 5 項對齊（Agents 數量 / 巡邏範圍 / 產出物 / 版本 / 系統參數），不一致 → 扣 0.5 分 / 項
- **產出方式**：本文件為派生視圖，僅反映 `.agents/` 當前狀態，不定義新規則
- **回退規範**：若本文件與 `.agents/` 不一致，以 `.agents/` 為準；由 `@Retro` 提案同步

***

*對齊提案：PROPOSAL-021（2026-04-21）*
*下次審視：`@Retro` 審計週期或下一次影響 Workflow 的提案執行時*

