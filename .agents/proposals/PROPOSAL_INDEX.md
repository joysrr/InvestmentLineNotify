# PROPOSAL_INDEX — Framework Scope

> 提案總索引（由 `@Lead` 每次提案狀態變更時更新）。
> 依 PROPOSAL-016 建立；**依 PROPOSAL_20260422_023 自 2026-04-22 起本索引僅收錄 `framework` scope 提案**（跨專案資產演進）。
> **Project scope 提案索引**：見各 workspace 獨立目錄 `.agents/workspaces/<project>/proposals/PROPOSAL_INDEX.md`。
> 格式定義見 `retro.md §s07`；scope 判定規則見 `RULES_DESIGN_GUIDE §十七.B`。

- **最後更新**：2026-04-24（**009/010/011/012 四立案完成**；OPEN: 009 Hotfix 分輕重 / 010 Lite Proposal / 011 RULES_DESIGN_GUIDE 拆檔 / 012 Script 漏用防護；建議採納順序 012→009→010→011；framework v4.7；007+008 雙效完成）
- **維護者**：`@Lead`

---

## 統計摘要

<!-- ⚠️ 下方區塊由 gen-proposal-index.mjs --write 管理；手動編輯會在下次執行時被覆蓋 -->
<!-- AUTO-GENERATED:BEGIN stats -->

| 狀態        | 數量    | 目錄位置     |
| ----------- | ------- | ------------ |
| OPEN        | 0       | `active/`    |
| IN_PROGRESS | 0       | `active/`    |
| DONE        | 118     | `completed/` |
| CANCELLED   | 1       | `completed/` |
| ARCHIVED    | 24      | `archived/`  |
| **合計**    | **143** | —            |

<!-- AUTO-GENERATED:END stats -->

> **同步來源**：`node .agents/scripts/generators/gen-proposal-index.mjs --write`（依 PROPOSAL_20260423_012 Phase B 起全自動）

2026-04-22 R11~R15 改善循環 5 份提案已全部完成採納執行：

- ✅ **PROPOSAL_20260422_015**（R11: Few-Shot 第二批補齊）
- ✅ **PROPOSAL_20260422_016**（R12: lead/assistant Token 外部化）
- ✅ **PROPOSAL_20260422_017**（R13: GDPR 完整性補齊）
- ✅ **PROPOSAL_20260422_018**（R14: @Auditor Prompt Fragment 整合）
- ✅ **PROPOSAL_20260422_019**（R15: pre-commit hook 配置）

**Token 改善實測**：

- `lead.md`: 4,126 → 3,877（-6%）
- `assistant.md`: 4,174 → 3,368（-19%，顯著改善）

2026-04-22 **自我評比後**的 7 份改善提案已全部完成採納執行（基於 5 維度 × 15 細項評分 3.58/5 衍生）：

- ✅ **PROPOSAL_20260422_008**（@Auditor + 定期評分機制）— Sprint 1
- ✅ **PROPOSAL_20260422_009**（Agent 行為自動化驗收框架）— Sprint 1
- ✅ **PROPOSAL_20260422_010**（File-based 並行防護 + PM2 身份）— Sprint 1
- ✅ **PROPOSAL_20260422_011**（隱私 + strategyWeight 流程治理）— Sprint 1
- ✅ **PROPOSAL_20260422_012**（DoD 自評統一化 + Gate Check Auto-Audit）— Sprint 2
- ✅ **PROPOSAL_20260422_013**（Token 優化 + Few-Shot 補齊）— Sprint 2
- ✅ **PROPOSAL_20260422_014**（系統參數 YAML 化 + 意圖衝突機械化）— Sprint 3

**預期改善後整體評分**：3.58 → **4.54**（+0.96）；待 `@Auditor` 下次派遣實測驗證

---

## 🟡 OPEN（待執行）

> 2026-04-23 User 指示補齊 009-011 後續提案；依 PROPOSAL_008 定期設計檢視機制警示維度的後續改善。

<!-- ⚠️ 下方區塊由 gen-proposal-index.mjs --write 管理；手動編輯會在下次執行時被覆蓋 -->
<!-- AUTO-GENERATED:BEGIN open_list -->

| 編號 | 標題                 | 優先級 | 提案日期 | 前置依賴 |
| ---- | -------------------- | ------ | -------- | -------- |
| —    | （目前無待執行項目） | —      | —        | —        |

<!-- AUTO-GENERATED:END open_list -->

## 🚫 CANCELLED（已取消，保留編號佔位）

| 編號                  | 標題                                       | 取消日期   | 取消原因                                                                 |
| --------------------- | ------------------------------------------ | ---------- | ------------------------------------------------------------------------ |
| PROPOSAL_20260422_020 | docs/agents-overview.md 同步（一次性修補） | 2026-04-22 | User 判定：一次性修補不應列為提案；內容轉為 021 採納後的手動任務 T-1~T-3 |

---

## 📐 建議採納順序（依整合性分析）

```
Step 1（P0 同 Sprint）：008 + 009 + 010 + 011
  → 補齊安全與自動化基礎能力

Step 2（P1 同 Sprint）：012 + 013
  → 強化長程一致性 + 瘦身

Step 3（P2）：014
  → 進階自動化（依賴前面 P0 工具已就位）
```

---

## 🔵 IN_PROGRESS（執行中）

<!-- ⚠️ 下方區塊由 gen-proposal-index.mjs --write 管理；手動編輯會在下次執行時被覆蓋 -->
<!-- AUTO-GENERATED:BEGIN in_progress_list -->

| 編號 | 標題                 | 優先級 | 開始日期 | 預計完成 |
| ---- | -------------------- | ------ | -------- | -------- |
| —    | （目前無執行中項目） | —      | —        | —        |

<!-- AUTO-GENERATED:END in_progress_list -->

---

## ✅ DONE（已完成，尚未歸檔）

| 編號                  | 標題                                                                                                                    | 優先級 | 完成日期   | 執行者  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ------- |
| PROPOSAL_20260421_001 | 系統性模板外部化                                                                                                        | P0     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_002 | frontend.md 全面重構                                                                                                    | P0     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_003 | RULES_DESIGN_GUIDE 建立                                                                                                 | P0     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_004 | system-prompt.md 三項修補                                                                                               | P0     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_005 | consultant 禁止語氣升級                                                                                                 | P1     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_006 | retro 任務週期量化                                                                                                      | P1     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_007 | reviewer 業務脈絡補強                                                                                                   | P2     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_008 | planner @Assistant 兼底                                                                                                 | P2     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_009 | architect/backend HITL 數值化                                                                                           | P2     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_010 | assistant 巡邏週期明確化                                                                                                | P2     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_011 | 業務脈絡錨定批次補強（意圖繼承至 PROPOSAL_20260422_002 + 006）                                                          | P2     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_012 | DoD 自評機制補充                                                                                                        | P2     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_013 | 系統級豁免記錄規範                                                                                                      | P2     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_014 | reviewer 複審上限說明                                                                                                   | P3     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_016 | 提案目錄規模管理                                                                                                        | P3     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_015 | lead.md 架構性精簡                                                                                                      | P3     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_017 | @Assistant 通知分級統一                                                                                                 | P3     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_018 | 動態範疇機制擴展（architect）                                                                                           | P3     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_019 | Rules 版本控制機制                                                                                                      | P3     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260420_001 | 排程併發防禦 + Token 效期鐵律                                                                                           | —      | 2026-04-21 | `@Lead` |
| PROPOSAL_20260420_002 | Policy 模組 100% Test Coverage                                                                                          | —      | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_020 | @Security 角色 + 系統參數單點配置                                                                                       | P1     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260421_021 | Rules 結構標準化（YAML frontmatter + XML section，方案 C+F）                                                            | P1     | 2026-04-21 | `@Lead` |
| PROPOSAL_20260422_005 | assistant.md Token 縮減（PENDING_ACTIONS 模板外部化）                                                                   | P0     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_002 | Agent 通用性與全環境適配優化（workspaces/ + project-onboarding）                                                        | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_006 | PROPOSAL-011 意圖繼承修補（002 同 Sprint）                                                                              | P0     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_007 | 提案整合性分析機制（預防未來類似衝突）                                                                                  | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_003 | 審查類 Agent 機讀產出物強制規範（M2M 合約）                                                                             | P0     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_001 | @Lead 狀態錨點與無狀態路由限制（LangGraph 前置）                                                                        | P0     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_004 | @Assistant HCI 全局摘要機制（001 溫度補償）                                                                             | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_008 | @Auditor + 定期 5 維度評分機制                                                                                          | P0     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_009 | Agent 行為自動化驗收框架                                                                                                | P0     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_010 | File-based 並行防護 + PM2 身份                                                                                          | P0     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_011 | 隱私 + strategyWeight 流程治理                                                                                          | P0     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_012 | DoD 自評統一化 + Gate Check Auto-Audit                                                                                  | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_013 | Token 優化 + Few-Shot 補齊                                                                                              | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_014 | 系統參數 YAML 化 + P-14 機械化                                                                                          | P2     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_024 | 模型分層路由（解 P-15）                                                                                                 | P0 🔴  | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_032 | 多車道路由架構（Fast/Standard/Heavy）                                                                                   | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_025 | Agent Drift Simulator（選項 A 僅 Mode A；Mode B 標 Claude Code 平台不適用）                                             | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_026 | lead/assistant 黑板模式外部化（選項 B；新建 3 skills + 2 tasks；rules/ 維持 13 檔；drift_score 0.957 維持）             | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_027 | Judge Fragment 完整性驗證（16→18 + validate-auditor-dispatch.mjs + AUDIT_DECISION_LOG）                                 | P2     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_031 | audit-retro-coordination SOP（5 步驟協作 + 衝突仲裁）                                                                   | P2     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_029 | !ref 自動驗證（22/22 有效 + 零循環）                                                                                    | P2     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_028 | agents-overview 自動同步驗證器（5/5 對齊）                                                                              | P2     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_030 | examples 補充（assistant + reviewer-security；11/11 Agent 覆蓋）                                                        | P2     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_022 | tech-stacks 純淨分離 + WORKSPACE_SCHEMA SSOT + Schema-driven Onboarding                                                 | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260422_023 | 提案 Scope 分層治理（framework vs project）                                                                             | P1     | 2026-04-22 | `@Lead` |
| PROPOSAL_20260423_001 | skills/tasks 專案特化參照規範 + 框架版本治理（Part 1-6 合併）                                                           | P1     | 2026-04-23 | `@Lead` |
| PROPOSAL_20260423_002 | Prior Art Scan 強制程序（A+B 組合 + HITL Gate + EVALUATED_PACKAGES 快取；Part 1-7 合併）                                | P1     | 2026-04-23 | `@Lead` |
| PROPOSAL_20260423_003 | Hotfix 診斷強化三支柱（診斷組 + @Security 條件式 + @Lead 上下文注入）                                                   | P1     | 2026-04-23 | `@Lead` |
| PROPOSAL_20260423_004 | 文件分層三原則（`.agents/docs/` 與 `docs/` 分離 + §二十 + docs-location-validator）                                     | P1     | 2026-04-23 | `@Lead` |
| PROPOSAL_20260423_005 | 互動式 CLI 初始化工具（scripts/init-workspace.mjs；雙軌引導）                                                           | P2     | 2026-04-23 | `@Lead` |
| PROPOSAL_20260423_006 | scripts/ 測試框架（L1 unit 30 cases + L3 smoke 6 cases + run-all.sh 第 9 validator）                                    | P1     | 2026-04-23 | `@Lead` |
| PROPOSAL_20260423_008 | run-all.sh 並行 + --fast + --validator 三模式（pre-commit 35→0.9 sec；附加定期設計檢視機制）                            | P1     | 2026-04-23 | `@Lead` |
| PROPOSAL_20260423_007 | 索引自動產生器（4 generators + --regenerate-indexes；首次 dogfooding 自動更新 RULES_VERSION_INDEX + FRAMEWORK_VERSION） | P1     | 2026-04-23 | `@Lead` |

> **DONE 表中段省略**（PROPOSAL*20260423_009 ~ PROPOSAL_20260430_005 共 70+ 筆）：
> 完整列表見 `proposals/completed/` 目錄 + `proposals/summaries/SUMMARY*\*.md` 季度摘要；
> 統計總數見上方 AUTO-GENERATED stats 區塊（DONE = 96）。
> 本表自 PROPOSAL_20260424 起改為「最近 batch + 重大里程碑」維護策略（PROPOSAL_502_010 J-1 確認）。

| PROPOSAL_20260501_001 | system-prompt + 13 rules ADR-0038 tier-based budget 機制（major 結構升級；rule_category 必填）| P0 | 2026-05-01 | `@Lead` |
| PROPOSAL_20260501_002 | iron-rules README + machine-readable-output theme（補 3 solo themes 缺口）| P1 | 2026-05-01 | `@Lead` |
| PROPOSAL_20260501_003 | ADR-0038 establishment（tier-based budget；取代 flat warn/block）| P0 | 2026-05-01 | `@Lead` |
| PROPOSAL_20260501_004 | 6-Phase pre-launch audit（8 BLOCKERs 全修；33 WARNINGs 處理 7；26 deferred 退 retro 觀察）| P0 | 2026-05-01 | `@Lead` |
| PROPOSAL_20260502_001 | MemPalace primary memory backend（ADR-0039；+ skills/memory-palace-schema v2.0 + memory-operations + memory-palace-validator）| P0 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_002 | MemPalace 廣度整合（13 rules + 5 tasks 全部 wire MemPalace；達成 13/13 全 agent 覆蓋）| P0 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_003 | MemPalace 永續性（auto-mine hook / compress monitor / wake-up 切換 / 持續🔴 自動歸檔）| P2 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_004 | MemPalace 邏輯補完（auditor baseline-search + lead 阻斷派發 + schema/ops 整併 + §s07 指針）| P2 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_005 | KNOWN_ISSUES.md 治理 + cleanup（KI-001~004 + memory_palace stub 刪除 + MCP tools 分 tier）| P3 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_006 | architect.md + backend.md token slim（KI-002 解除；剩 ~190 token healthy headroom）| P2 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_007 | Deprecated cleanup（W-4 token_budget_ref + SYSTEM_THRESHOLDS 已標 deprecated 子鍵；KI-003 部分閉合）| P3 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_008 | Pre-launch 收尾 4 patch（lead.md token 釋放 + stale §s10 補 + validator count 校準 + session-start-checklist）| P1 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_009 | Post-launch 防呆三補（P-26 MEMPALACE_SILENT_SKIP + KI-001 allowlist + sub-agent timeout playbook + KI-005）| P3 | 2026-05-02 | `@Lead` |
| PROPOSAL_20260502_010 | 治理收尾（Q1 audit 6 處漂移修復；INDEX / superseded_by / mempalace.yaml / frontmatter / footer / 用語）| P1 | 2026-05-02 | `@Lead` |

---

## 🔗 提案意圖繼承關係（由 PROPOSAL_20260422_006 建立）

當新提案與 DONE 狀態歷史提案存在設計意圖衝突時，本表記錄繼承關係，避免歷史意圖失聯。

| 歷史提案                                                                                                                                                              | 原意圖                                                                                      | 繼承提案                                            | 繼承方式                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROPOSAL_20260421_011                                                                                                                                                 | Rules 內化錨定專案技術棧，防止 LLM 偏離系統約束                                             | PROPOSAL_20260422_002 + 006                         | 意圖保留，實作由「硬編碼」改為「workspace 動態注入 + 缺失保守升級」                                                                                                                                                                                                                                                  |
| PROPOSAL_20260422_002 + 006                                                                                                                                           | Core Soul vs Project Context 分離（workspace 欄位層）                                       | PROPOSAL_20260422_022                               | 第二階段延伸：tech-stacks 知識層純淨化 + WORKSPACE_SCHEMA SSOT 契約驅動                                                                                                                                                                                                                                              |
| PROPOSAL_20260422_002 + 022                                                                                                                                           | .agents/ 跨專案搬運純度（欄位層 + 知識層）                                                  | PROPOSAL_20260422_023                               | 第三階段延伸：proposals 紀錄層分層治理（framework / project 二元 scope + 目錄分離）                                                                                                                                                                                                                                  |
| PROPOSAL_20260422_024（模型分層路由）                                                                                                                                 | 任務複雜度評估 → 模型選擇（haiku/sonnet/opus）                                              | PROPOSAL_20260422_032                               | 平行延伸：任務複雜度評估 → 工作流車道選擇（fast/standard/heavy）；共用 SYSTEM_THRESHOLDS.complexity_thresholds 評估基礎                                                                                                                                                                                              |
| PROPOSAL_20260422_005 + 021                                                                                                                                           | assistant.md PENDING_ACTIONS 模板外部化 + Rules 結構標準化                                  | PROPOSAL_20260422_026                               | 延伸執行：黑板模式純度化；lead/assistant 實作細節完整外部化至 skills/tasks（非拆分 rules；對齊 User 警示 Hub-and-Spoke + Blackboard Pattern 精神）                                                                                                                                                                   |
| PROPOSAL_20260422_022（tech-stacks 三分法純淨）+ 023（scope 分層治理）+ 028（agents-overview 同步驗證）+ 029（!ref 驗證）                                             | tech-stacks 專案特化參照格式 + framework/project scope 分離 + 派生視圖同步工具 + 引用一致性 | PROPOSAL_20260423_001                               | 延伸：§十六.F skills/tasks 三態分類（F1/F2/F3）+ FRAMEWORK_VERSION + CHANGELOG 雙軌治理 + framework-diff 工具 + framework-upgrade-workflow SOP；完整覆蓋 tech-stacks + skills + tasks 專案特化參照格式；為方案 B 多專案並行部署奠基                                                                                  |
| PROPOSAL_20260422_022（tech-stacks 純淨分離）+ PROPOSAL_20260423_001（skills/tasks 三態分類）                                                                         | tech-stacks 為已採納技術棧 + skills/tasks §專案特化參照                                     | PROPOSAL_20260423_002                               | 延伸：新增「選型前 Prior Art Scan 強制程序」（§十八）+ 2 份新 skills（F2 + F1）+ EVALUATED_PACKAGES 快取；形成「選型 → 採納 → tech-stacks 文件化 → 未來改版再評估」完整閉環；HITL Gate 補 LLM 知識截止盲區                                                                                                           |
| PROPOSAL_20260422_020（@Security + SC-XX）+ 026（emergency-shutdown-playbook）+ PROPOSAL_20260423_001（skills/tasks 三態）+ PROPOSAL_20260423_002（Prior Art Scan）   | 資安審查條件式介入 + Hotfix Fast Lane 3 步驟 + F2 skill 格式 + 事前預防                     | PROPOSAL_20260423_003                               | 延伸：Hotfix 診斷強化三支柱（§十九）— 診斷組（D1-D4）+ @Security 條件式（SC-01~10）+ @Lead 上下文注入；新增 diagnostic-playbook F2 skill；與 PROPOSAL_20260423_002 對偶（事前預防 vs 事後修復）；堵 Hotfix 資安空窗                                                                                                  |
| PROPOSAL_20260422_022（tech-stacks 純淨）+ 023（scope 分層）+ 20260423_001（skills/tasks 三態分類）                                                                   | 跨專案搬運純度 + scope 二元分層 + 內容層級分類                                              | PROPOSAL_20260423_004                               | 延伸：文件位置層級分類（§二十）— `.agents/docs/` framework 說明 + `docs/` 專案特有（含運作紀錄）；3 份 framework 文件從 `docs/` 移入 `.agents/docs/`；新建 docs-location-validator 防污染；與 §十六.F 互補（位置 vs 內容）                                                                                           |
| PROPOSAL_20260422_002（workspaces/ 架構）+ 022（WORKSPACE_SCHEMA SSOT）+ 023（scope 分層）+ PROPOSAL_20260423_001 Part 5-6（純 Node.js 工具風格 + upgrade SOP）       | workspaces 檔案契約 + schema 驅動驗證 + scope 分層 + 工具層設計風格 + 升級 SOP 對偶         | PROPOSAL_20260423_005                               | 延伸：互動式 CLI 初始化工具（scripts/init-workspace.mjs）— 雙軌引導（AI 對話 + CLI）並存；CLI 讀 schema 動態問答 + 熔斷自動化 + transaction-like 回退；與 upgrade SOP 對偶（首次建立 vs 升級既有）                                                                                                                   |
| PROPOSAL_20260423_001 Part 5（framework-diff.mjs 零依賴風格）+ 005（init-workspace.mjs v1 + §1.5「不新增自動化測試」）                                                | scripts/ 純 Node.js 工具 + 第一個互動式 CLI 無測試                                          | PROPOSAL_20260423_006                               | 補足 + 修正：scripts/ 測試框架（L1 單元 30 cases + L3 smoke 6 cases）；修正 005 §1.5 決策（User 實測 2 bug 後認定測試必要）；整合 run-all.sh 第 9 validator（warning-level policy）                                                                                                                                  |
| PROPOSAL_20260422_019（run-all.sh + pre-commit hook）+ 20260423_006（scripts/ 測試框架）                                                                              | run-all.sh 序列執行 + scripts 測試                                                          | PROPOSAL_20260423_008                               | 升級：8 validators 並行 + scripts L3 序列；新增 --fast / --validator / --help 三模式；pre-commit 35→0.9 sec；附加 tasks/periodic-design-review.md（流程繁瑣 + LLM 可程式化雙目標檢視）+ retro.md §s02 強制執行                                                                                                       |
| PROPOSAL_20260422_022（SSOT）+ 028（agents-overview-sync-validator）+ 001 Part 5（framework-diff 工具風格）+ 005（init-workspace CLI 範本）+ 006（scripts/ 測試框架） | SSOT 原則 + 索引驗證 + 工具風格 + CLI 模式 + 測試框架                                       | PROPOSAL_20260423_007                               | 升級：sync-validator「驗證」→ generators「主動產生」；4 generators（rules-version / changelog / proposal-index / framework-version）+ --regenerate-indexes 一鍵入口；每提案 Phase E 同步 -77%；測試擴充 30→46 + 9→12 cases；首次 dogfooding（本提案 RULES_VERSION_INDEX + FRAMEWORK_VERSION 由 generators 自動更新） |
| PROPOSAL_20260502_001（MemPalace primary backend；ADR-0039 v1）                                                                                                       | markdown SoT → mempalace mine 雙寫                                                          | PROPOSAL_20260502_020（Plan G）                     | **意圖反轉**：mempalace = primary write target（單寫）；markdown 降為 cold export artifact；ADR-0039 v1 → v2 amended（PROPOSAL_502_023 補錄）                                                                                                                                                                        |
| PROPOSAL_20260502_019（Platform compatibility 文件層）                                                                                                                | 4 harness × 12 capability 對照表（記錄；未脫鉤）                                            | PROPOSAL_20260502_021（harness-neutral）            | **延伸**：sub-agent dispatch mode-aware（serial default / parallel opt-in）；工具命名中性化；設定檔 layered；正式脫鉤 Claude Code 強依賴                                                                                                                                                                             |
| PROPOSAL_20260502_021 Sprint C（cross-harness baseline 部分；C-2/C-3 deferred）                                                                                       | 跨 harness drift 實測待補                                                                   | PROPOSAL_20260502_023 Sprint B-8（deferred 持續中） | **持續延伸**：Antigravity / Web / Qwen drift baseline 仍待 User 在實機環境補實測；本提案承認 deferred 狀態                                                                                                                                                                                                           |
| PROPOSAL_20260502_020 Plan G（mempalace 單寫 + .export/ cold backup）                                                                                                 | 假設 .pending/ 目錄存在                                                                     | PROPOSAL_20260502_023 A-1 / B-5                     | **修正**：之前隱含假設 .pending/ 目錄存在但 init-workspace 未保證；本提案補 mkdir + file-based lock + retry-with-backoff                                                                                                                                                                                             |

<!-- AUTO-GENERATED:BEGIN intent_inheritance_candidates -->

> 由 `gen-proposal-index.mjs` 依 frontmatter 自動掃描；@Retro 須人工判斷是否需上方主表記錄

| 提案                  | frontmatter 信號                  | 候選原因     |
| --------------------- | --------------------------------- | ------------ |
| PROPOSAL_20260502_036 | amends_adr / related_proposals(3) | 修訂既有 ADR |
| PROPOSAL_20260502_037 | amends_adr / related_proposals(2) | 修訂既有 ADR |
| PROPOSAL_20260502_038 | amends_adr / related_proposals(3) | 修訂既有 ADR |
| PROPOSAL_20260502_039 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_040 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_041 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_042 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_043 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_044 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_045 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_046 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_047 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_048 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_049 | amends_adr                        | 修訂既有 ADR |
| PROPOSAL_20260502_050 | amends_adr                        | 修訂既有 ADR |

<!-- AUTO-GENERATED:END intent_inheritance_candidates -->

**維護規範**：

- 後續提案若推翻既有 DONE 提案的設計方向，**必須**於本表新增繼承關係條目
- 違反視為「語意回退」，由 `@Assistant` 巡邏 P-14 🔴 `PROPOSAL_INTENT_REGRESSION` 偵測（對齊 PROPOSAL_20260422_007）
- 更新觸發：每次提案執行合併後 5 分鐘內由 `@Lead` 同步
- **責任鏈明文化**（PROPOSAL_502_023 C-5）：@Retro 起草新提案時即預判是否需要繼承記錄；提案 frontmatter 若含 `amends_adr:` / `supersedes:` 則 @Retro 同時起草本表 diff；@Lead 採納時 atomic commit 兩檔（PROPOSAL + INDEX）；如疏漏，由 @Assistant 巡邏 P-14 偵測。
- **AUTO-GENERATED candidates**：上方候選清單由 generator 依 frontmatter 自動掃描；@Retro 每次新提案前必先檢視；確認無漏標

---

## 🗄️ ARCHIVED（已歸檔，超過 2 個審計週期）

| 編號                          | 標題                                         | 完成日期   | 歸檔日期                         |
| ----------------------------- | -------------------------------------------- | ---------- | -------------------------------- |
| RULE_UPDATE_PROPOSAL_20260419 | 技術棧防呆（網路/File 原子鎖/Telegram 驗證） | 2026-04-19 | 2026-04-19（原 `archive/` 目錄） |

---

## 維護規則

- **新增提案**：`@Retro` 產出後預設 `OPEN`，置於 `active/`，並在本索引 OPEN 區塊新增條目
- **狀態變更**：每次狀態變更（OPEN → IN_PROGRESS / DONE / CANCELLED / ARCHIVED）由 `@Lead` 同步更新本索引
- **目錄移動**：檔案隨狀態變更移動至對應目錄（`active/` / `completed/` / `archived/`）
- **歸檔條件**：DONE 提案超過 **2 個審計週期**後移至 `archived/`，狀態改為 ARCHIVED
- **索引更新**：`@Lead` 5 分鐘內更新本索引（不等下次收斂）

### 規模警示門檻（對齊 `retro.md` §「提案目錄規模警示」）

| 指標                | 警示門檻 | 處理動作                                                  |
| ------------------- | -------- | --------------------------------------------------------- |
| `active/` OPEN 累積 | ≥ 15 份  | `@Retro` 評估執行優先級，建議 `@Lead` 啟動批次執行 Sprint |
| `completed/` 未歸檔 | ≥ 10 份  | `@Retro` 執行批次歸檔                                     |
| 全目錄總計          | ≥ 50 份  | `@Retro` 提出目錄重整提案                                 |
