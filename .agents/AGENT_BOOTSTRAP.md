# AGENT_BOOTSTRAP — 進入專案的第一個 read

> **每個 LLM agent 進入專案的 session 必須第一個讀本檔**。300 行內覆蓋 80% 常見流程；
> 細節指向其他文件。本檔 = framework 心智地圖；不要先讀別的。
> 由 PROPOSAL_502_029 T-3 建立；PROPOSAL_502_051 B-7 加 §0（v8.0 LangGraph 強制鐵律）。

---

## §0 v8.0 強制鐵律（PROPOSAL_502_051 B-7；Q5-B）

**v8.0 啟用後（v7.23+）**：

🔴 **絕對禁止 harness 自行 role-play 11 agents 序列演出 dispatch**
🔴 **所有 dispatch 必呼 `mcp__langgraph__dispatch(request="<user 原文>")`**

```
偵測 user 任何 dispatch 意圖（"我要做 X" / refactor / hotfix / onboarding 等）
  ↓ harness 必執行
mcp__langgraph__dispatch(request=...)
  ↓ LangGraph runtime 跑 11-stage workflow
回結果摘要 + 中間 HITL（user elicitation）
```

**判定 v8.0 是否啟用**：

- 檢 `.agents/runtime/setup.py` 已執行（`.claude/settings.local.json` 含 `langgraph` MCP server entry）
- 或 `mcp__langgraph__dispatch` tool 在 session 可呼用
- 兩者任一 true → 強制走 LangGraph；harness 不 role-play

**例外**：

- 純對話、查詢、解釋 → harness 直接回應（不需 dispatch）
- v7.22 文件層更新（rules/skills/decisions markdown 編輯）→ harness 仍可直接 Edit；但完成後 user 需 restart LangGraph runtime（改 ground truth）

**讀規則 vs role-play 區分**（Q6-A 雙讀）：

- ✅ harness 仍讀 `.agents/rules/*.md` 作為**對話風格參考**（@Lead 風格 / @Architect 視角等）
- ❌ harness 不再順序執行 11 stages（這由 LangGraph runtime mechanically 跑）

---

## §1 框架架構（30 sec 速覽）

```
.agents/                          ← 框架本體；100% Python（v7.0+）
  rules/         13 agent rules（@Lead / @Architect / @Backend / ... 各自職責）
  iron-rules/    6 鐵律（跨切；不可變；每個 agent 視 applies_iron_themes 載）
  decisions/    40 ADRs（why；歷史決策；查詢用）
  skills/       60+ skills（how；lazy load；按需查）
  tasks/        20+ workflow SOPs（when）
  workspaces/   per-project 設定（含 RUNTIME_CONTEXT / TECH_STACK）
  proposals/    framework-scope 提案歷史
  memory/       cold export of mempalace drawers
  scripts/      Python utility scripts（agent 自動代執行）
  tests/        18 validators + Python unittest

mempalace MCP server = primary memory（跨 session 持久；29 tools）
qwen.md / .claude/CLAUDE.md = harness-specific 入口

CURRENT_WORKSPACE = .agents/CURRENT_WORKSPACE 內單行 = 當前 active workspace
```

**核心**：你扮演的 agent 視 `CURRENT_WORKSPACE` 與 ROUTING_TICKET 切換工作上下文。

---

## §2 Session-start checklist（並行；單一 message 多 tool）

進入新 session 第一個 message 內**並行**呼叫（不要串行）：

```
[並行 5 tool calls]
  1. mempalace_status                 → palace overview
  2. Read .agents/CURRENT_WORKSPACE   → active workspace name
  3. Read PENDING_ACTIONS.md          → 跨 session state（若存在）
  4. Read ROUTING_TICKET.md           → in-flight dispatch（若存在）
  5. LS .agents/memory/.pending/      → MCP fallback buffer 是否殘留
```

收到結果後**第二輪 message** 解讀 + 載 active workspace：

```
6. Read .agents/workspaces/<active>.md  → workspace meta + RUNTIME_CONTEXT
7. mempalace_wake-up                    → 跨 session L0+L1 上下文
```

完整流程 + fresh init 自修復：`.agents/tasks/session-start-checklist.md`

### 2.1 新機器 onboarding（V90-A-9 PROPOSAL_502_062）

session-start 偵測 `.qwen/settings.json` 不存在（Qwen Code harness）→ 主動建議 user 跑 deploy 腳本：

```cmd
REM 自動偵測 + DashScope preset
python .agents\scripts\deploy-qwen-setup.py --auto ^
  --llm-provider qwen --llm-token-env DASHSCOPE_API_KEY

REM 或公司閘道（custom）
python .agents\scripts\deploy-qwen-setup.py --custom ^
  --node-bin-dir "D:\node-v22.12.0-win-x64" ^
  --python-bin "C:\Python313\python.exe" ^
  --llm-provider custom --llm-model qwen3.5 ^
  --llm-base-url "http://gateway.company.local/v1" ^
  --llm-key-env COMPANY_LLM_TOKEN --llm-token-env COMPANY_LLM_TOKEN

REM Interactive 對話 prompt（user 自跑；agent 不適合）
python .agents\scripts\deploy-qwen-setup.py
```

**Agent 可直接呼**（Bash tool）：non-TTY 環境必指 `--auto` 或 `--custom`；缺 LLM args fail-fast。
**安全**：`--llm-token-env` 從 env 讀 token（不落 process arg）；`--dry-run` 預覽 render 不寫檔。
詳：`.agents/INSTALL.md §3A`。

---

## §3 派發新工作（@Lead 流程）

User 說「我要做 X」→ 你扮演 @Lead 走以下決策：

### 3.1 判定 task_class（決定哪些步驟可跳）

| task_class        | 適用                   | 跳過項                                       |
| ----------------- | ---------------------- | -------------------------------------------- |
| `feature`         | 新功能 / 新模組        | 走完整 10 stage                              |
| `modify-existing` | 改既有                 | 同 feature；可省 prior_art_scan              |
| `hotfix`          | 生產 bug               | 走 hotfix-checklist 雙路徑                   |
| `doc-sync`        | 純文件                 | 跳 @QA / Stage 4 / Stage 5                   |
| `config-adjust`   | 配置常數（如 timeout） | 跳 Stage 3 設計 / Stage 4 / mempalace.search |

### 3.2 派發前 batch（單一 message 並行）

```
[並行 4 tool calls]
  1. Read PENDING_ACTIONS.md §🔴 §📥
  2. grep touched_files: 'strategyWeight|risk_limit|金融'
  3. mempalace.search(query=<keywords>, limit=1)  ← skip if doc-sync/config-adjust
  4. Read ROUTING_TICKET.md（既有狀態）
```

mempalace search 預設 `limit=1`；top-1 cosine ≥ 0.4 即用；不足 follow-up `limit=3` / `5`。

### 3.3 寫 ROUTING_TICKET（6 必欄 + 選填）

```yaml
target_agent: @Backend / @Architect / @Frontend / ...
task_class: feature | modify-existing | doc-sync | hotfix | config-adjust
complexity_tier: simple | standard | heavy
lane: simple | heavy
touched_files: [...]
artifacts_to_produce: [...]
# 選填
memory_mode: mcp | filesystem_fallback
memory_hint: <search 結果摘要>
skip_memory_search: false
runtime_setup: [...]  ← 從 active workspace.RUNTIME_CONTEXT 注入
autonomy_mode: gate-at-design  ← PROPOSAL_502_032；控 stage gate；缺則 fallback auto
```

### 3.3.1 autonomy_mode（HITL gate 控制；PROPOSAL_502_032）

控 agent 是否一路自動跑完 Stage 1-9。Smart default per task_class：

| task_class                   | smart default    | 行為                                     |
| ---------------------------- | ---------------- | ---------------------------------------- |
| `doc-sync` / `config-adjust` | `auto`           | 0 gate；秒過                             |
| `feature`                    | `gate-at-design` | Stage 3 後卡 1 次（user 確認方向）       |
| `modify-existing`            | `gate-at-impl`   | Stage 5 前卡 1 次（user 確認 TEST_SPEC） |
| `hotfix`                     | `step-by-step`   | 每階段轉移皆 gate（最多 8-9 次）         |

**User override（自然語言）**：

- "幫我跑完" / "全自動" → `auto`
- "每階段確認" / "step by step" → `step-by-step`
- "設計完先給我看" / "確認方向" → `gate-at-design`
- "實作前先看" → `gate-at-impl`

**Gate 命中時行為**：寫 🟡 `STAGE_<N>_VERIFY_PENDING` 至 PENDING_ACTIONS → 等 user 回應；24h 無回 P-33 升 🔴。

完整 schema：`.agents/skills/routing-ticket-protocol.md` §3.4

### 3.3.2 GitNexus state-level integration（V90-A-8 mandatory；舊版 PROPOSAL_502_034 B-1/B-2/B-5 advisory hint 升級）

**V90-A-8 後**：GitNexus 從 optional advisory hint 升 **framework-mandatory**。LangGraph runtime nodes（`@Lead` / `@Architect` / `@Backend` / `@Frontend` / `@Reviewer`）會自動透過 `runtime/gitnexus_helper.py` 在 LLM call 前 pre-fetch 對應 stage 所需 GitNexus context（callers / callees / impact / module deps）並注入 prompt。

**部署條件**：

- Node v22 LTS 必裝（v24 缺 `ladybugdb-core` prebuild）
- `npm install -g gitnexus` 完成
- `mcp_server.py` 啟動 health probe 偵測 `gitnexus.cmd` PATH 解析；不可達 → 拒啟 dispatch
- 緊急除錯可設 env `GITNEXUS_OPTIONAL=1` 降回 advisory（⚠️ 不建議生產用）

**雙路徑共存**（V90-A-8）：

- **Harness 互動 query**：仍走 MCP（`mcp__gitnexus__*`；user 對話框直接呼）
- **Runtime nodes 自動 pre-fetch**：走 CLI subprocess（`runtime/gitnexus_helper.py`）— 不依賴 MCP cross-talk

**舊版 advisory hint 仍存**（向後相容）：lead supervisor 依然會偵測 4 場景並寫 `gitnexus_hint` 到 ROUTING_TICKET；hint 用於 sub-agent **手動** query 補強；不取代 nodes 自動 pre-fetch。

| 觸發                  | 條件                                           |
| --------------------- | ---------------------------------------------- |
| cross-stack           | touched_files ≥3 + 含 ≥2 副檔名                |
| large-file            | 任一檔 LOC>800                                 |
| refactor-keyword      | 指令含 refactor/rename/impact/「找出所有使用」 |
| frontend-backend-pair | touched_files 同含 frontend + backend 路徑     |

**鐵律**（ADR-0041 v2 鐵律 3 + V90-A-8 修訂）：mempalace = 語意層 SoT；GitNexus = 語法層 cache（per-repo `.gitnexus/`；可重建；不持久；framework-mandatory）。

完整：`.agents/skills/code-graph-exploration.md §C` + `.agents/runtime/gitnexus_helper.py`

### 3.4 10 stage workflow（M-tier feature）

```
1. 需求         @Planner
2. 戰略審查     @Consultant（cross-domain 風險）
3. 設計         @Architect（API spec / 模組）
3.5 Prior Art Gate（≥ 500 LOC 或關鍵字觸發）
4. TEST_SPEC    @QA
5. 實作         @Backend / @Frontend
5.5 自評       同上
6. Review       @Reviewer
6.5 Security    @Security（SC-01~10 觸發；條件式）
7. QA 驗證      @QA
8. 收斂         @Architect / @Planner / @Assistant
9. Retro        @Retro
9.5 Phase E     @Lead + @Assistant（CHANGELOG / version bump）
```

完整：`.agents/skills/lead-orchestration-guide.md §六`

---

## §4 Mempalace 三件套（**每次必用**）

| 操作            | MCP tool                                    | 何時                         |
| --------------- | ------------------------------------------- | ---------------------------- |
| 派發前查上下文  | `mempalace_search(query, limit=1)`          | 寫 ROUTING_TICKET 前         |
| 跨 session wake | `mempalace_wake-up`                         | session-start 第二輪         |
| 寫新知識        | `mempalace_add_drawer(wing, room, content)` | 完成踩坑 / decision / lesson |

**寫 drawer 前 self-check**（PROPOSAL_502_020 v2 Plan G / 502_061 V89-A-2）：

- 內容雙標：中文 ≤ 2000 字 / 英文 ≤ 5000 chars（Qwen Code timeout；中文 tokenize 慢 2-4×）
- Header 5 行格式：File / Type / Wing / Tags / Summary
- 前 200 char 含關鍵字（embedding 索引前 ~256 token）
- Sequential（一次一個；等 success: true）
- 寫完跑 `python3 .agents/scripts/mempalace-export.py` 同步 cold backup
- **🆕 verbatim code > 5 行禁止 inline**（ADR-0041 兩層 SoT）
  - mempalace = 語意層（why / 決策 / 教訓）；GitNexus = 語法層（code / 行號）
  - 違規症狀：drawer 臃腫 → timeout + search recall 低
  - 改寫：用 `gitnexus query "..."` / `file:L202-251` 取代整段 code paste

完整 schema + anti-patterns：`.agents/skills/memory-operations.md`

---

## §5 Workspace 機制

每個專案 / 模組 = 一個 workspace。`CURRENT_WORKSPACE` 切換上下文。

### Workspace 內容（`workspaces/<name>.md` 必含）

```yaml
PROJECT_CONTEXT: project_name / display_name / business_domain
TECH_STACK: language / frontend / backend / storage / ...
PATHS: project_root / data_root / source_modules / ...
DEPLOYMENT_*: constraints / SOP
BUSINESS_*: domains / rules
RUNTIME_CONTEXT: platform / shell / pre_command_hooks / binaries / env_vars  ← 環境特化（PROPOSAL_502_029 T-2）
```

### RUNTIME_CONTEXT 用途（**重要**）

特殊環境設定（如 Windows 強制 Node 版本）放這。Agent 派發 sub-agent 跑 shell 前**必先執行 pre_command_hooks**。

範例：

```yaml
RUNTIME_CONTEXT:
  platform: win32
  shell: powershell
  pre_command_hooks:
    - description: "強制使用 Node v22 LTS（D:\\ 內建版；V90-A-7: 不用 v24）"
      command: '$env:Path = "D:\node-v22.12.0-win-x64;" + $env:Path'
      shell: powershell
      reason: "Windows 系統 Node 18 過舊；GitNexus 需 v22 LTS（v24 缺 ladybugdb prebuild）"
```

Agent 看到 ROUTING_TICKET `runtime_setup` 非空 → 跑主命令前先依序跑 hooks。

完整：`.agents/WORKSPACE_SCHEMA.yaml` §RUNTIME_CONTEXT

---

## §6 Proposal scope 判定（**起草前第一動作**）

要立 proposal？先判 scope：

```
1. User 指令 / ROUTING_TICKET 提及 workspace name？
   → 是 → scope: project:<name>；存 .agents/workspaces/<name>/proposals/
   → 否 → 下一步

2. 影響範圍涉 .agents/{rules,decisions,iron-rules,skills,tasks}？
   → 是 → scope: framework；存 .agents/proposals/
   → 否 → 必問 User 確認；不得擅自選 framework
```

完整：`.agents/rules/retro.md §s06` + `.agents/RULES_DESIGN_GUIDE.SCOPE.md`

---

## §7 Agent 行為鐵律

1. ❌ **絕對禁止**回覆 User「請你跑 `python3 ...`」/「請執行 `bash ...`」；agent 用 Bash/run_command tool **自動代執行**
2. ❌ **絕對禁止**派發前未查 memory（mempalace.search 或 fallback grep）；除非 task_class 觸發 skip
3. ❌ **絕對禁止**寫死 sub-agent dispatch；mode-aware（serial default；parallel Claude Code opt-in）
4. ❌ **絕對禁止**MCP 寫入後 commit 前未跑 export
5. ❌ **絕對禁止**忽略 RUNTIME_CONTEXT.pre_command_hooks 直接執行 shell 命令
6. ❌ **絕對禁止**漫無目的讀檔；single-message parallel batch；不要每 step 都串行

---

## §8 「我要做 X 該讀哪份」對照表

| 你要做              | 讀這個                                                                             |
| ------------------- | ---------------------------------------------------------------------------------- |
| 派發新工作          | `rules/lead.md` + `skills/lead-orchestration-guide.md`                             |
| 寫 / 改 rule        | `RULES_DESIGN_GUIDE.DESIGN.md` + `RULES_METADATA_SCHEMA.md`                        |
| 立 proposal         | `rules/retro.md` + `skills/templates/rule-update-proposal-{full,lite}-template.md` |
| Hotfix              | `tasks/hotfix-checklist.md` + `skills/diagnostic-playbook.md`                      |
| Audit（5 維度評分） | `rules/auditor.md` + `tasks/auditor-dispatch-checklist.md`                         |
| Onboarding 新專案   | `skills/agent-driven-onboarding.md` + `tasks/project-onboarding-workflow.md`       |
| Mempalace 操作      | `skills/memory-operations.md`                                                      |
| 跨 harness 部署     | `docs/PLATFORM_COMPATIBILITY.md` + `INSTALL.md`                                    |
| 看 ADR / why        | `decisions/0001-*.md` 起點；ADR 編號 1-40                                          |
| Patrol 通知         | `skills/patrol-notification-catalog.md`（P-01~P-31）                               |
| Validator 跑哪個    | `python3 .agents/tests/run-all.py [--fast / --validator <name>]`                   |

---

## §9 給 LLM 的記憶提示

讀完本檔，請在你的內部 working memory 記住這 5 條（任務間反覆參考）：

1. **Session-start = single-message parallel 5 tool calls**
2. **派發前 batch + RUNTIME_CONTEXT 注入 + mempalace search limit=1**
3. **寫 mempalace drawer 必含 5 行 header + 雙標（中文 ≤ 2000 字 / 英文 ≤ 5000 chars）+ sequential**
4. **Proposal scope 判定 = 起草前第一動作**
5. **Agent 0 user-script-execution；用 Bash/run_command tool 自動代執行**

任何疑慮 → 查 §8 對照表 → 讀對應細節文件。
不要靠記憶；framework 文件才是 SoT。

---

## §10 環境差異速查

| 你在這                            | 讀這個補充                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Claude Code CLI                   | `.claude/settings.local.json` + `.mcp.json`                                                                        |
| Qwen Code                         | `qwen.md`（root）+ `.qwen/settings.json`（V90-A-9 一鍵部署：`python .agents/scripts/deploy-qwen-setup.py --auto`） |
| Antigravity                       | `.agents/INSTALL_ANTIGRAVITY.md`（IDE settings 特化）                                                              |
| Windows native                    | 必在 `RUNTIME_CONTEXT.platform: win32` + `shell: powershell`                                                       |
| WSL / Linux                       | 預設配置即可                                                                                                       |
| 大型 refactor / cross-file impact | 建議 user 啟用 GitNexus；`skills/code-graph-exploration.md`                                                        |

---

> **設計理由**：本檔取代「需要 read 多份文件才知道要做什麼」的高 context 模式。
> 一次讀完 → agent 內部 working memory 已建框架地圖；後續工作只需查 §8 細節。
> Latency 預期：cold-start 從讀 5-10 份文件變讀 1 份 + 並行探測 = -50% 載入時間。
