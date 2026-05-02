---
task_id: project-onboarding-workflow
file_type: workflow
owner: @Lead
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  新**專案** onboarding 完整 6 步 SOP（三軌：minimal / standard / full）
referenced_by:
  - rules/system-prompt.md
  - skills/assistant-user-commands.md
  - skills/tech-stack-onboarding.md
  - skills/lead-orchestration-guide.md
  - tasks/agent-onboarding-flow.md
  - tasks/framework-upgrade-workflow.md
---

# Task: Project Onboarding (專案引導)

> 本任務由 PROPOSAL_20260422_002 建立；由 PROPOSAL_20260422_022 擴充為 **Schema-driven 逐欄引導**。
> 當首次服務新專案或 `CURRENT_WORKSPACE` 缺失時，`@Lead` 依本 task 執行。

## 觸發條件

以下任一情況觸發：

1. `.agents/CURRENT_WORKSPACE` 不存在或內容為空
2. `@Assistant` 巡邏 P-12 `WORKSPACE_MISSING` 🔴 已觸發
3. User 明確指示「啟動新專案 `<project_name>`」
4. User 執行 `執行 project-onboarding` 指令

## Schema 驅動原則

- **SSOT**：`.agents/WORKSPACE_SCHEMA.yaml` 為所有欄位定義的唯一事實來源
- **逐欄引導**：依 SCHEMA 頂層區塊順序逐一詢問 User，而非複製模板後補填
- **required 強制**：Schema 標記 `required: true` 的欄位若 User 無法提供，必須阻斷並升級 User 補齊
- **optional 分級**：Schema 標記 `required: false` 的欄位採**分級 Fallback**（警告 / 降級 / 略過）
- **驗證收尾**：執行 `node .agents/tests/workspace-schema-validator.mjs` 通過方可結束 onboarding
- **雙軌共用原則**：軌道 A（AI 對話）與軌道 B（CLI）皆遵守上述原則；CLI 動態讀取 schema 不硬編碼欄位

## 引導模式

現提供**三軌並存**的引導選擇；三者最終產出與驗證出口一致（均執行 `workspace-schema-validator.mjs`）。

### 軌道 A：@Lead AI 對話引導（原流程）

適用：

- 需要解釋欄位意義、業務脈絡複雜需 Q&A
- 熔斷檢查發現缺 `tech-stacks/*.md` 需 User 決策是否新建提案
- 新手使用者不熟 CLI 操作

流程：依本文件 §6 步驟流程 由 `@Lead` 逐欄對話收集。

### 軌道 B：互動式 CLI 引導

適用：

- 多專案批次建立
- 脫離 AI 對話的快速初始化（如 CI scaffold / 新 repo git init 後）
- User 已熟悉 schema 欄位意義

執行方式：

```bash
# 基本互動模式
node .agents/scripts/init-workspace.mjs

# 指定名稱
node .agents/scripts/init-workspace.mjs --name myapp

# Dry-run 預覽不寫檔
node .agents/scripts/init-workspace.mjs --dry-run

# 強制覆寫已存在的 CURRENT_WORKSPACE
node .agents/scripts/init-workspace.mjs --force

# 顯示說明
node .agents/scripts/init-workspace.mjs --help
```

### 軌道 C：Agent 對話驅動（PROPOSAL_20260424_018）

適用（**推薦**新 User / 明確平台的新專案）：

- User 說「我要開 Avalonia 專案 / Vue 專案 / Node Bot」等觸發語
- 希望把 40 題互動縮為 3-5 題對話
- Agent 代跑 CLI（User 不必 attend 終端）

流程：完整 SOP 見 `tasks/agent-onboarding-flow.md`（5 步驟）：

1. Agent 識別關鍵字 → MANIFEST stacks 映射
2. `AskUserQuestion` 精簡 3-5 題
3. 產出 YAML config
4. 呼叫 `init-workspace --config <yaml>`（非互動）
5. 回顯 + 30 天後 audit 提醒 + 交棒 @Planner

執行入口由 agent 觸發；非 User 直接執行。

CLI 行為對齊本文件 §6 步驟流程，差別在於：

1. 自動讀 `WORKSPACE_SCHEMA.yaml` 動態產生問答
2. 自動掃描 `tech-stacks/` 產生熔斷檢查可用清單
3. Transaction-like 寫檔（失敗完整回退；不留半成品）
4. 自動呼叫 `workspace-schema-validator` 驗證
5. 自動更新 `workspaces/README.md` 當前已建立的 workspace 表格

### 軌道切換規則

- **CLI 執行中遇熔斷（tech-stacks 缺失）→ 可選「中止並回到 @Lead 軌道」**（由 User 決策是否新建 tech-stacks 提案）
- **@Lead 軌道執行中 User 明示「改用 CLI」** → 參照本文件 §6 Step 6 的 CLI 指令繼續
- 兩軌道的最終 workspace 檔案格式與驗證結果**完全一致**

### 選擇建議

| 情境                                             | 推薦軌道                                          |
| ------------------------------------------------ | ------------------------------------------------- |
| 首次專案初始化，對 schema 不熟                   | 🟢 A（AI 對話引導）                               |
| 快速批次建立 2+ 個新 workspace                   | 🟢 B（CLI）                                       |
| schema 有新欄位需 User 理解意義                  | 🟢 A                                              |
| CI / 自動化腳本需無人值守建立                    | 🟢 B（搭配 `--name`）或 🟢 C（`--config <yaml>`） |
| 業務脈絡複雜需討論                               | 🟢 A                                              |
| 明確平台的新專案（Avalonia / Vue / Node Bot 等） | 🟢 C（agent 驅動；3-5 題對話即可）                |
| User 說「我要開 xxx 專案」觸發語                 | 🟢 C（@Lead 自動走 agent-onboarding-flow）        |

## 6 步驟流程

### Step 1：需求萃取（PROJECT_CONTEXT 區塊）

分析 User 原始需求，逐欄詢問並記錄 SCHEMA `PROJECT_CONTEXT` 區塊：

| 欄位              | Schema required | 詢問範例                           |
| ----------------- | --------------- | ---------------------------------- |
| `project_name`    | ✅ required     | 「專案代號（snake_case 英文）？」  |
| `display_name`    | ✅ required     | 「顯示名稱（中英文皆可）？」       |
| `business_domain` | ✅ required     | 「業務領域一句話描述？」           |
| `core_entities`   | optional        | 「核心資料實體名稱清單？」         |
| `user_role`       | optional        | 「使用者角色（個人/團隊/公開）？」 |

若任一 **required** 欄位 User 未能回答 → **阻斷並升級**，不得填入預設值矇混。

### Step 2：技術棧掃描（TECH_STACK 區塊）

依 SCHEMA `TECH_STACK` 逐欄詢問：`language` / `frontend` / `backend` / `storage` / `external_dependency` / `deployment` / `testing_framework`。

**熔斷檢查**（依 `lead.md §資源映射表`）：

- 若 `TECH_STACK` 任一選擇值**沒有對應的 tech-stacks/ 檔案**（例：User 選 `Django` 但 `.agents/tech-stacks/django.md` 不存在）→ 暫停 onboarding，升級 User：
- 「是否由 `@Retro` 先產出 `tech-stacks/django.md` 提案？」
- 或「是否暫時跳過該技術棧的專屬規範（採通用後端規範）？」

### Step 3：路徑與模組（PATHS 區塊）

依 SCHEMA `PATHS` 逐項填寫：

- 基礎路徑：`project_root` / `frontend_root` / `data_root` / `docs_root` / `env_example` / `test_root`
- `PATHS.source_modules`：依**已選擇的 tech-stacks** 要求的欄位回填（如選 `file-based-storage` → 必須填 `source_modules.storage` + `.archive`；選 `nodejs-esm-backend` → 必須填 `source_modules.concurrency`）
- `PATHS.schedulers`（若有排程）：逐一列出排程腳本檔名

缺失策略：

- required（`data_root`）缺失 → 阻斷
- tech-stacks 強制的 `source_modules.*` 欄位缺失 → `@Lead` 阻斷 + 發任務「請建立對應模組」給 `@Backend`
- 其他 optional → 允許 warning

### Step 4：部署與業務域（DEPLOYMENT\_\* + BUSINESS_DOMAINS）

依 SCHEMA 區塊逐一填寫：

- `DEPLOYMENT_CONSTRAINTS`：CPU / 記憶體 / 儲存 / 網路限制 / runtime / watchdog / PM2 命名前綴 / Nginx 設定檔
- `DEPLOYMENT_SOP`：deploy_steps / env_sync / rollback
- `BUSINESS_DOMAINS.core` + `.realtime`：核心與即時業務功能分類

Fallback 策略：

- 若 User 部署目標不明 → 記錄 `<not_applicable>`；`@Lead` 後續派發部署類任務改為 User 裁決
- `process_naming` 缺失 → 阻斷 PM2 相關任務（對齊 `skills/infra-constraints.md §專案特化參照`）

### Step 5：業務規範（FUNCTIONAL_DOMAINS / CRITICAL_PATHS / SECURITY_SCOPE_EXTENSIONS / QA_MANDATORY_TESTS / BUSINESS_RULES）

依 SCHEMA 各區塊逐一引導：

- `FUNCTIONAL_DOMAINS`：列出功能域 + 主要執行 Agent（供 `@Planner` 動態參照）
- `CRITICAL_PATHS`：供 `@Reviewer` / `@Security` 動態參照
- `SECURITY_SCOPE_EXTENSIONS`：若無 → 標注 `<not_applicable>`
- `QA_MANDATORY_TESTS`：P0 / P1 / P2 分級
- `BUSINESS_RULES`：自由格式摘要；無則標注 `<not_applicable>`

### Step 6：驗證 + 啟動

> 若使用軌道 B（CLI；依 PROPOSAL_20260423_005）或軌道 C（agent 驅動；依 PROPOSAL_20260424_018），以下 Step 6.1~6.4 由 CLI 自動執行；User 只需執行 Step 6.5 的 Gate Check。
> 軌道 C 完成後 agent 會主動引導 Gate Check（見 `tasks/agent-onboarding-flow.md §Step 5`）。

1. 執行 `node .agents/tests/workspace-schema-validator.mjs --workspace <project_name>`

- 必須 **exit 0** 才可繼續；exit 2 → 回到對應 Step 補齊

2. 確認（或建立）根目錄 `PENDING_ACTIONS.md`，監控模式預設 `ACTIVE`
3. 於 `.agents/CURRENT_WORKSPACE` 寫入 `<project_name>` 作為 active workspace
4. 於 `.agents/workspaces/README.md §當前已建立的 workspace` 新增條目
5. 設定第一個 Gate Check：`@Lead` 派發 `@Planner` 進入需求階段
6. **Tech-Stack Audit 節奏建立**（PROPOSAL_20260424_018）：
   - workspace 的 `TECH_STACK.last_audit_date` 自動填當天
   - `TECH_STACK.audit_interval_days` 預設 30（User 可依專案性質調整）
   - 30 天後 `@Assistant P-23` 巡邏會自動提醒執行 `tech-stack-manage audit`

## DoD 自評

- [ ] `workspaces/<project_name>.md` 已建立，欄位結構對齊 `WORKSPACE_SCHEMA.yaml`
- [ ] `.agents/tests/workspace-schema-validator.mjs --workspace <project_name>` exit 0
- [ ] `.agents/CURRENT_WORKSPACE` 已寫入對應名稱
- [ ] `.agents/workspaces/README.md` 已更新當前已建立的 workspace 表格
- [ ] `tech-stacks/` 對應專案技術棧已存在（缺失已由 User 明確確認跳過或新建提案）
- [ ] `domains/` 對應業務領域已存在（若 SCHEMA `BUSINESS_DOMAINS` 有 entry）
- [ ] `PENDING_ACTIONS.md` 初始化完成，🔴 / 🟡 均為 0 筆
- [ ] `@Assistant` 巡邏 P-12 `WORKSPACE_MISSING` 通知（若存在）已自動關閉

## 缺失時的保守升級政策

執行過程中若發現以下情況，`@Lead` 依 PROPOSAL_20260422_001 §s_state_anchor「缺失判斷備案」採保守態度：

- **SCHEMA required 欄位缺失** → 🔴 阻斷；升級 User 補齊，不得預設值填入
- **SCHEMA 標示 `referenced_by` 對應的 tech-stacks 檔案缺失** → 升級 User 是否新建 tech-stacks 提案
- **workspace-schema-validator 回傳 exit 2** → 回到對應 Step 修正
- **業務領域模糊** → 升級 User 明確化 `PROJECT_CONTEXT.business_domain`

## 禁止行為

- **絕對禁止** 未完成 workspace 建立且 validator exit 0 即派發子 Agent 執行業務任務
- **絕對禁止** 跳過 SCHEMA required 欄位的阻斷機制
- **絕對禁止** 跳過技術棧 / 領域缺失熔斷直接假設 `tech-stacks/` / `domains/` 已存在
- **絕對禁止** 直接修改 `rules/*.md` 加入新專案的特定資訊（違反 Core Soul 原則）
- **絕對禁止** 在 workspace 檔內寫入程式碼或業務邏輯（僅保存環境變數）

## 未來延伸參考

依 §七 未來延伸：

- 達閾值 ≥ 5 份同前綴 tech-stacks → 依扁平命名規則升級為子目錄結構
- `scripts/migrate-workspace.mjs`（Schema 升級時自動提示補填）未來可減少 onboarding 工作量

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: project-onboarding
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 task 描述**通用 onboarding 流程**；專案 schema / tech stack / 部署約束由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念        | Workspace 欄位             | Fallback 行為                      |
| --------------- | -------------------------- | ---------------------------------- |
| Schema 欄位對應 | `WORKSPACE_SCHEMA.yaml`    | 阻斷：schema 不存在無法 onboarding |
| 技術棧選擇      | `TECH_STACK.*`             | 阻斷：必填欄位缺失                 |
| 部署約束        | `DEPLOYMENT_CONSTRAINTS.*` | 警告（可逐步補填）                 |

---

## Related Decisions

- [ADR-0002](../decisions/0002-workspace-context-injection.md) — Workspace 靜態注入
- [ADR-0015](../decisions/0015-tech-stacks-purity.md) — Tech-Stacks 純淨原則
