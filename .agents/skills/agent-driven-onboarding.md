# Skill: Agent-Driven Onboarding（agent 對話內驅動 workspace 初始化）

> 由 PROPOSAL_502_024 建立。本 skill 為 `.agents/tasks/project-onboarding-workflow.md` 軌道 A
> 的執行 playbook；任何 LLM 環境（Claude Code / Qwen / Antigravity / 自建）通用。

## §0 核心原則（NON-NEGOTIABLE）

**User 不執行任何腳本。** Onboarding 全程：

- ✅ User 只說「幫我啟動新專案 / 建 workspace」（自然語言）
- ✅ Agent 用 Read / Write / LS / Bash tools **自動執行**所有偵測 / 寫檔 / validator
- ❌ **絕對禁止**回覆 User「請你跑 `node ...`」/「請你執行 `bash ...`」
- ❌ **絕對禁止**指示 User 手動建檔 / 手動填 yaml

如果 agent 環境的 Bash tool 無法執行某個腳本（如 Qwen 環境特殊限制），agent 改用替代方案
（如 Read + 邏輯判斷取代 validator script），仍**不轉嫁**給 User。

## §1 何時走本 skill

User 表達建 workspace / 啟動新專案意圖時，**唯一路徑 = 本 skill**。
舊 `init-workspace.mjs` CLI 已降為 fallback；除非：

- User 明示「我想自己跑互動 CLI」
- 環境完全無 LLM tool（純 shell；極罕見）

## §2 Agent 4 步驟流程

### Step 1 — Auto-detect（無需問 User；agent 自動執行）

依下列順序 scan 專案根：

| 訊號                                  | 工具       | 推導目標                                         |
| ------------------------------------- | ---------- | ------------------------------------------------ |
| `package.json` exists                 | Read       | tech-stacks 候選 + name + description seed       |
| `pom.xml` / `build.gradle`            | Read       | java 棧                                          |
| `requirements.txt` / `pyproject.toml` | Read       | python 棧                                        |
| `go.mod`                              | Read       | go 棧                                            |
| `Cargo.toml`                          | Read       | rust 棧                                          |
| `*.csproj` / `*.sln`                  | Read       | .NET 棧                                          |
| `composer.json`                       | Read       | PHP 棧                                           |
| `Gemfile`                             | Read       | Ruby 棧                                          |
| 子目錄名（`auth/` `payment/` `hr/`）  | LS         | domains 候選                                     |
| `.git/config` remote URL              | Read       | workspace name 候選                              |
| 目錄名（basename）                    | Bash `pwd` | workspace name fallback                          |
| `tsconfig.json` / `tsx` 檔            | Read       | TypeScript                                       |
| `Dockerfile` / `docker-compose.yml`   | Read       | container deployment                             |
| `.github/workflows/`                  | LS         | CI 已有                                          |
| `uname -s` / `$env:OS`                | Bash       | RUNTIME_CONTEXT.platform（PROPOSAL_502_029 T-2） |
| `which node` / `which python3`        | Bash       | RUNTIME_CONTEXT.binaries baseline 路徑           |

對每個偵測到的 tech，grep `.agents/tech-stacks/MANIFEST.yaml` 找對應 entry。

**RUNTIME_CONTEXT 偵測**（PROPOSAL_502_029 T-2）：

- platform 自動偵測（`uname -s` / Windows 用 `[System.Environment]::OSVersion.Platform`）
- binaries：`which node` / `which python3` 取結果填 RUNTIME_CONTEXT.binaries
- **pre_command_hooks 不自動填**；Step 3 multi-choice 問 User：「需要在執行 shell 前加任何 setup 嗎？（如 PATH override / venv activate）[Y/n]」
- 預設 N；User Y 時開另一輪 multi-choice 收集 hooks

### Step 2 — Plan（agent 內部組織；輸出 user 確認單）

組成 **Detection Report**：

```
🔍 偵測到專案資訊：

Workspace name 候選：
  • <basename>（從目錄名）
  • <repo-name>（從 git remote）
  → 我用 <basename> 可以嗎？或請指定其他名稱

Tech-stacks 候選（match MANIFEST）：
  ✓ react (web-frontend；package.json deps)
  ✓ express (web-backend；package.json deps)
  ✓ postgres (storage；package.json deps)
  ⚠ <unknown package> 在 MANIFEST 中無對應；先略過

Domains 候選（從目錄結構）：
  • auth/ → auth domain
  • payment/ → payment domain
  ⚠ 還未建 domain 文件；先記入 workspace 待後續補

需要 User 決定（multi-choice）：
  Q1. Workspace 名稱：[A] <basename>  [B] <repo-name>  [C] 自訂
  Q2. Domains 是否現在建？：[A] 略過稍後再補  [B] 全建 placeholder  [C] 自選

其他欄位（schema optional）：先用空值 / 預設；首次 dispatch 時補。
```

### Step 3 — Confirm（multi-choice；只在必要時問）

僅問 schema `required: true` + auto-detect 真的不確定的欄位。每題 ≤ 4 選項。

**禁止**：

- 自由 free-form 問答（除非 User 明說「我自己填」）
- 一次問超過 3 題
- 問 schema `required: false` 的欄位（defer）

User 回答後，agent **直接寫檔**（用 Write tool 不跑 CLI）：

```yaml
# .agents/workspaces/<name>.md frontmatter
---
project_name: <name>
description: <auto-detect or empty>
tech_stack:
  - name: react
    last_audit_date: <today>
    audit_status: pending
  - name: express
  - name: postgres
domains:
  - <user 選的或空 list>
created_at: <ISO>
maturity: pilot # default
---
# <name> workspace

（首次 dispatch 時 @Lead / @Architect 補完細節）
```

### Step 4 — Activate + Validate

```bash
# Agent 用 Write tool 直接寫
.agents/workspaces/<name>.md          ← workspace 檔（必含 GITNEXUS_INTEGRATION 占位；PROPOSAL_502_041 GR-E2）
.agents/CURRENT_WORKSPACE             ← 內容 = <name>
.agents/workspaces/<name>/proposals/active/.gitkeep      ← 提案目錄
.agents/workspaces/<name>/proposals/completed/.gitkeep
.agents/workspaces/<name>/proposals/archived/.gitkeep
```

**workspace.md 範本必含區塊**（解 GR-E2；新 workspace 自動繼承 v7.11 schema 升級）：

```yaml
## GITNEXUS_INTEGRATION
gitnexus_repo: <not_applicable> # user 啟用後可填 git remote 推導的 repo 名
gitnexus_indexed: false # 預設 false；Step 4.6 user 跑 analyze 後可改 true
gitnexus_last_index_at: <not_applicable>
```

然後跑 validator（用 Bash tool）：

```bash
python3 .agents/tests/workspace-schema-validator.py
node .agents/tests/run-all.sh --validator workspace
```

驗證失敗 → 報 User，修補；通過 → 進 Step 4.5。

### Step 4.5 — mempalace wing 建立（PROPOSAL_502_035 主題 5；G-D4 修補）

通過 validator 後、`wake-up` 之前：agent 呼 `mcp__mempalace__add_drawer` 建 `wing_<project>` 索引 drawer：

```yaml
wing: <project_name>
room: index # 自訂 room；workspace 級索引
File: workspace_index_<project>
Type: meta
Tags: workspace, onboarding, <tech_stacks comma list>
Summary: workspace <project> 接入索引；首次建立於 <date>
---
workspace_path: .agents/workspaces/<name>.md
created_at: <ISO8601>
detected_tech_stacks: [...]
detected_modules: [...]
gitnexus_indexed: false # 若 user 後續跑 gitnexus analyze → update_drawer 改 true
```

→ 後續 `mempalace.search` 命中此 drawer 即可快速取得 workspace meta；避免每次重 detect。

**Polyglot multi-stack 分流**（PROPOSAL_502_041 解 GR-E3；monorepo ≥2 sub-module）：

偵測 sub-module（grep `package.json | go.mod | Cargo.toml | pyproject.toml | pom.xml` 等於 ≥2 不同根層 dir）→ 對每 sub-module **額外 add drawer**：

```yaml
wing: <project_name>
room: index_<submodule_name> # 例 index_backend-core / index_gateway / index_api-server / index_frontend
File: workspace_index_<project>_<submodule>
Type: meta
Tags: workspace, onboarding, <stack>, submodule
Summary: <submodule> 子模組索引；<stack> 棧
---
submodule_path: <path>
submodule_stack: <主 stack>
parent_wing_drawer: workspace_index_<project>
```

並在 root drawer 加 `submodules: [{name, path, stack}]` 列表 → search 時可從 root drawer 跳 sub-module drawer（解 GR-E3 解析度不足）。

### Step 4.6 — Optional GitNexus 提示（user 啟用且想用語法層）

ROUTING_TICKET 寫 `gitnexus_hint.triggered_by=onboarding-scenario` + `optional: true`：

- P-32 偵測 optional → 只記 🟢（不升 🟡/🔴；不阻斷新派發）
- 提示 user：「若已 `npm install -g gitnexus` → 可跑 `gitnexus analyze .` 建索引」

**Polyglot scope 提示**（PROPOSAL_502_041 解 GR-E4）：

- monorepo 且子模組獨立 deploy 各 → 提示 user 對每 sub-module 各跑 `cd <submodule> && gitnexus analyze .`
- monorepo 但子模組緊耦合（cross-module call graph 重要）→ 提示 root 一次 `gitnexus analyze .`（cross-module 完整）
- 模糊 → 預設 root analyze（較安全；少漏 cross-module impact）

最後跑 `mempalace wake-up` 注入跨 session 上下文。

## §3 Decision Tree：什麼自動 / 什麼問 / 什麼 defer

```
                     ┌─ schema required: true?
                     │      │
                     │      ├─ auto-detect 確定 → 自動填
                     │      ├─ 多候選 → multi-choice 問 User
                     │      └─ 完全無資訊 → 必問 User（free-form 唯一情境）
                     │
欄位 ─→ 是 required ──┘
       │
       └─ optional → defer（先建後補；首次 dispatch 時 @Architect 標 missing）
```

## §4 Multi-choice 範本（agent 對話必用此格式）

```
Q<N>. <欄位名稱>

候選：
  [A] <選項 1>（<為什麼推薦／來源>）
  [B] <選項 2>
  [C] <選項 3>
  [D] 自訂（free-form；不推薦）

請回 [A/B/C/D]（或直接打字選項內容）。預設按 Enter = [A]。
```

## §5 偵測規則對照（≥ 5 種語言/技術棧）

| 環境          | 主檢測檔                                                  | 次檢測                   | 對應 MANIFEST                     |
| ------------- | --------------------------------------------------------- | ------------------------ | --------------------------------- |
| Node.js / web | `package.json`                                            | `tsconfig.json`, `*.tsx` | react/vue/express/nest/etc.       |
| Python        | `requirements.txt` / `pyproject.toml`                     | `setup.py`, `Pipfile`    | django/flask/fastapi/etc.         |
| Java          | `pom.xml` / `build.gradle`                                | `*.java` count           | spring-boot/etc.                  |
| Go            | `go.mod`                                                  | `main.go`                | gin/echo/etc.                     |
| Rust          | `Cargo.toml`                                              | `src/main.rs`            | actix/axum/etc.                   |
| .NET          | `*.csproj` / `*.sln`                                      | `Program.cs`             | aspnet/efcore/etc.                |
| PHP           | `composer.json`                                           | `index.php`              | laravel/symfony/etc.              |
| Ruby          | `Gemfile`                                                 | `config.ru`              | rails/etc.                        |
| 容器化        | `Dockerfile` / `docker-compose.yml`                       | k8s manifests            | docker/k8s                        |
| Mobile        | `pubspec.yaml` / `*.xcodeproj` / `build.gradle (android)` | —                        | flutter/react-native/swift/kotlin |

## §6 Defer 清單（不要在 onboarding 階段問）

- 詳細 domain 知識（`.agents/domains/<x>.md`）→ 首次需用時建
- 完整 tech-stack audit（`tech-stacks/<x>/PHASE_*`）→ pilot 後做
- 業務脈絡完整描述 → @Planner 第一次派發時補
- KNOWN_ISSUES → 遇到時加
- AUDIT baseline → 第一次 @Auditor 跑 audit 時建立
- proposal 模板複製 → 第一個 RULE_UPDATE_PROPOSAL 時建

## §7 範例對話（agent ↔ user 全流程）

```
User: 幫我啟動新專案 onboarding

Agent: [Step 1 auto-detect]
  • Read package.json → react 18 + express 4 + postgres
  • LS 子目錄 → auth/ payment/ user/
  • Read .git/config → remote = github.com/me/myapp

[Step 2 Detection Report]
🔍 偵測到：
  Workspace 名稱：myapp（git remote）/ 201013（目錄名）
  Tech-stacks：react (web-frontend) + express (web-backend) + postgres (storage)
  Domains：auth, payment, user（從子目錄；皆未建 .agents/domains/*.md）

需 User 決定：
  Q1. Workspace 名稱：[A] myapp（git remote 推薦）[B] 201013（目錄名）[C] 自訂
  Q2. Domains 是否現在建：[A] 略過，第一次派發時補 [B] 全建空 placeholder [C] 自選

User: A、A

Agent: [Step 3 寫檔]
  ✓ .agents/workspaces/myapp.md
  ✓ .agents/CURRENT_WORKSPACE = "myapp"
  ✓ .agents/workspaces/myapp/proposals/{active,completed,archived}/

[Step 4 Validate]
  ✓ workspace-schema-validator: PASS
  ✓ mempalace wake-up: <600 tokens 注入>

✅ Onboarding 完成。下一步建議：
  • 派 @Architect 讀現有程式碼 → 產 EXISTING_CODEBASE_REPORT.md baseline
  • 或 User 直接派任務（auth / payment / user 任一 domain）；我會在第一次需用時補建 domain 文件

可以嗎？
```

## §8 Windows / Qwen / Antigravity 適配

本 skill 完全用 LLM Read / Write / LS / Bash tools，**不依賴 stdin readline**：

- ✅ Windows：完全 OK（無 TTY 依賴）
- ✅ Qwen：完全 OK（subagent 可走）
- ✅ Antigravity：完全 OK
- ✅ Claude Code Web：完全 OK（sandbox 限制不影響）

CLI 軌道 B 在這些環境**不可靠**；本 skill 為 default。

## §9 失敗處理

| 失敗                                 | 處理                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| schema-validator FAIL                | Read 失敗欄位；補；重跑                                 |
| `.agents/CURRENT_WORKSPACE` 寫入失敗 | 報 user；查 fs permission                               |
| 既有 workspace 同名                  | 問 user：[A] 取消 [B] 改名 [C] 覆蓋（需打 "覆蓋" 確認） |
| User 半途中止                        | 已建檔案保留（不 rollback；@Retro 之後 cleanup）        |

> CLI（軌道 B）有 transaction-like 回退；本 skill 採「漸進建檔」策略；錯誤時部分產物可保留。

## §10 Related

- `tasks/project-onboarding-workflow.md` 軌道 A 入口
- `tasks/existing-project-import-workflow.md`（既有 codebase 進框架；onboarding 後跑）
- `scripts/init-workspace.mjs`（軌道 B 互動 CLI；fallback only）
- `WORKSPACE_SCHEMA.yaml`（欄位 SSOT）
- `tech-stacks/MANIFEST.yaml`（tech-stack 候選 catalog）

## Related Decisions

ADR-0002（Workspace 注入；本 skill 為其 onboarding 階段執行手冊）/ ADR-0017（文件分層）/ ADR-0036（Rule Decomposition；本 skill = workflow F2 類）— 在 `decisions/`。
