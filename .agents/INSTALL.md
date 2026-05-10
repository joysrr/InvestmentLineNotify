# `.agents/` Framework Starter — 部署手冊

> 把這套 LangGraph runtime + Multi-Agent framework starter clone 到新專案的完整初始化流程。
> 一次性執行；完成後 user 只動 `.qwen/settings.json` 配置。
>
> **適用情境**：clone starter → 套到既有 / 新公司 repo。
> **預估時間**：< 10 分鐘（首次；含 pip install）。
>
> **版本對齊**：framework v8.0.x（milestone v3 frozen `langgraph-runtime-v8-stable`）。

---

## 🎯 速覽（已部署過 1 次以上的 user 直接看這段）

```cmd
git clone <starter_url> myproject && cd myproject
copy .qwen\settings.json.example .qwen\settings.json
REM edit .qwen/settings.json: 改 5 處 placeholder (路徑 + token)
C:\Users\<u>\AppData\Local\Programs\Python\Python313\python.exe -m pip install -r .agents\runtime\requirements.txt langchain-openai
qwen
REM 對 Qwen 說: "我要開始這個專案" → onboarding 自動建 workspace
```

---

## §1 環境前置（**一次性；machine 級**）

新機器才跑；既有 machine 可跳。

### 1.1 必需

| 元件                                         | 版本                                                                        | 為何                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **獨立 Python 3.11+**                        | 3.11 / 3.12 / 3.13                                                          | LangGraph runtime 需；公司鎖版 Python 3.9 不行                                      |
| **獨立 Node 22 LTS**（V90-A-8 升 mandatory） | **22**（不用 24；v24 缺 `ladybugdb-core` prebuild → gitnexus install fail） | GitNexus 升 framework-mandatory；mempalace-mcp 等 npm 套件用；公司鎖版 Node 18 不行 |
| **mempalace-mcp**（user-global）             | latest                                                                      | 跨 session 持久記憶；單次 `npm install -g mempalace-mcp`                            |
| **公司內部 LLM token**                       | —                                                                           | dispatch 走 API mode 必需（Qwen Code 不支援 sampling）                              |

### 1.2 Windows 公司鎖版 PATH 環境

| 困擾                                                  | 解法                                                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 公司全域 PATH 鎖 Python 3.9 / Node 18，不可改         | 解壓獨立版到 `C:\Users\<u>\AppData\Local\Programs\Python\Python313\` 或 `D:\python-3.13\`；Node 用 `D:\node-v22.12.0-win-x64\`（**v22 LTS；不要 v24**）    |
| MCP child process 不繼承 cmd / PowerShell session env | `.qwen/settings.json` `mcpServers.<name>.command` 必填**絕對路徑**（不寫 `python` / `node`）                                                               |
| Agent run_command tool 需要新版 binary                | 啟動 Qwen Code 前在 cmd 跑 `set PATH=D:\node-v22.12.0-win-x64;C:\Users\<u>\AppData\Local\Programs\Python\Python313;%PATH%`；或寫進 user-level cmd autoexec |

詳見 `qwen.md §1`。

---

## §2 Clone Starter

```cmd
cd /d D:\Work\<workspace>
git clone <starter_repo_url> myproject
cd myproject

REM (option) 改 git remote 指向公司新 repo
git remote set-url origin <new_company_repo_url>
```

---

## §3 編 `.qwen/settings.json`（**單一檔配置 SoT**）

### 3A. **快速部署腳本**（推薦；V90-A-9 PROPOSAL_502_062）

`.agents/scripts/deploy-qwen-setup.py` 三模式自動產 `.qwen/settings.json`；agent 也可透過 Bash tool 觸發：

```cmd
REM Auto：偵測 Node/Python 路徑 + LLM preset；最少參數
python .agents\scripts\deploy-qwen-setup.py --auto ^
  --llm-provider qwen --llm-token-env DASHSCOPE_API_KEY

REM Custom：完全手動指定（CI / 公司閘道）
python .agents\scripts\deploy-qwen-setup.py --custom ^
  --node-bin-dir "D:\node-v22.12.0-win-x64" ^
  --python-bin   "C:\Users\u\AppData\Local\Programs\Python\Python313\python.exe" ^
  --llm-provider custom ^
  --llm-model qwen3.5 ^
  --llm-base-url "http://gateway.company.local/llm/qwen3.5/v1" ^
  --llm-key-env COMPANY_LLM_TOKEN ^
  --llm-token-env COMPANY_LLM_TOKEN

REM Interactive：對話 prompt 一步步問（TTY default；無 flag 也走這條）
python .agents\scripts\deploy-qwen-setup.py

REM 預覽不寫檔
python .agents\scripts\deploy-qwen-setup.py --auto ... --dry-run

REM 覆寫既有
python .agents\scripts\deploy-qwen-setup.py --auto ... --force
```

**LLM provider preset**：`qwen` (DashScope) / `anthropic` / `openai` / `custom` (公司閘道)；
auto 會：v22 LTS 偵測（v24 自動排到尾；ladybugdb prebuild 問題）、Python 3.11+ 驗、Qwen3/R1 自動加 `LLM_API_EXTRA_BODY` 關 thinking。

**Agent triggerable**（V90-A-9 設計）：

- non-TTY 環境（agent / CI）必指 `--auto` 或 `--custom`；否則 fail-fast 印 usage
- `--llm-token-env` 指向既有 env var（避免 token 進 process arg / log）
- `--dry-run` 給 agent 先驗 render 再決定是否寫

### 3B. 手動編輯（傳統路徑）

```cmd
copy .qwen\settings.json.example .qwen\settings.json
REM 編輯
```

替換 `.qwen/settings.json` 內所有 `<PLACEHOLDER_*>`（5 處）：

| placeholder                       | 替換成                                           | 出現次數                             |
| --------------------------------- | ------------------------------------------------ | ------------------------------------ |
| `<PLACEHOLDER_PYTHON_BINARY>`     | 獨立 Python 3.13 絕對路徑（雙反斜槓 escape）     | 1                                    |
| `<PLACEHOLDER_PROJECT_ROOT>`      | 此 repo 絕對路徑                                 | 3（cwd / PYTHONPATH / gitnexus.cwd） |
| `<PLACEHOLDER_NODE_BINARY_DIR>`   | Node 24 資料夾（option；不啟用 gitnexus 可不改） | 0 或 2                               |
| `<PLACEHOLDER_API_BASE_URL>`      | 公司 LLM gateway URL                             | 1（`LLM_API_BASE_URL`）              |
| `<PLACEHOLDER_MODEL_NAME>`        | 公司 model 字串（如 `qwen3.5`）                  | 1（`LLM_API_MODEL`）                 |
| `<PLACEHOLDER_COMPANY_LLM_TOKEN>` | 真實 token                                       | 1（`COMPANY_LLM_TOKEN`）             |

**最終 `mcpServers.langgraph.env` 應長這樣**（範例）：

```json
"env": {
  "PYTHONPATH": "D:\\Work\\workspace\\myproject\\.agents",
  "PYTHONUNBUFFERED": "1",
  "LANGGRAPH_CHECKPOINT_PATH": "%USERPROFILE%\\.langgraph\\checkpoints.db",

  "LLM_API_DEFAULT_MODE": "api",
  "LLM_API_PROVIDER": "custom",
  "LLM_API_MODEL": "qwen3.5",
  "LLM_API_BASE_URL": "http://internal-gw.company.local/llm/qwen3.5/v1",
  "LLM_API_KEY_ENV": "COMPANY_LLM_TOKEN",
  "LLM_SAMPLING_MAX_TOKENS": "4096",

  "COMPANY_LLM_TOKEN": "<actual_token>"
}
```

> ⚠️ `LLM_API_KEY_ENV` 的**值**（`COMPANY_LLM_TOKEN`）跟同 block 下的 token **變數名**必須完全一致。
>
> ⚠️ `.qwen/settings.json` 已 gitignored；不會被 commit。token 安全留本機。

### LLM_BACKEND 切換對照（換環境只動下面 5 行）

| 場景                               | 5 行配置                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **公司內部 OpenAI-compat gateway** | `provider=custom`, `model=qwen3.5`, `base_url=http://...`, `api_key_env=COMPANY_LLM_TOKEN`, +token                                       |
| **DashScope 公開 Qwen**            | `provider=qwen`, `model=qwen-max`, `base_url=https://dashscope.aliyuncs.com/compatible-mode/v1`, `api_key_env=DASHSCOPE_API_KEY`, +token |
| **Anthropic Claude**               | `provider=anthropic`, `model=claude-haiku-4-5`, `base_url=` (留空), `api_key_env=ANTHROPIC_API_KEY`, +token                              |
| **OpenAI 官方**                    | `provider=openai`, `model=gpt-4o-mini`, `base_url=` (留空), `api_key_env=OPENAI_API_KEY`, +token                                         |

---

## §4 安裝 Python 依賴

```cmd
REM 用 Python 3.13 絕對路徑跑 pip;確保裝在新版 Python 而非公司鎖版
C:\Users\<u>\AppData\Local\Programs\Python\Python313\python.exe -m pip install -r .agents\runtime\requirements.txt

REM custom / qwen / openai provider 都要 langchain-openai
C:\Users\<u>\AppData\Local\Programs\Python\Python313\python.exe -m pip install langchain-openai

REM (option) anthropic provider
C:\Users\<u>\AppData\Local\Programs\Python\Python313\python.exe -m pip install langchain-anthropic

REM 驗
C:\Users\<u>\AppData\Local\Programs\Python\Python313\python.exe -c "import langgraph, mcp, langchain_openai; print('OK')"
```

---

## §5 第一次 dispatch（**自動觸發 onboarding**）

### 5.1 啟動 Qwen Code

```cmd
cd /d D:\Work\workspace\myproject
qwen
```

### 5.2 確認 MCP servers 都連上

對 Qwen 說：

```
請列出所有可用的 MCP tools
```

預期看到：

| MCP server  |                           工具數                           |           必要性            |
| ----------- | :--------------------------------------------------------: | :-------------------------: |
| `langgraph` | 4（dispatch / dispatch_resume / dim6_audit / walkthrough） |           ✅ 核心           |
| `mempalace` |                             29                             |     ✅ 跨 session 記憶      |
| `gitnexus`  |                             16                             | ⚪ option（程式碼分析才需） |

### 5.3 觸發 onboarding

對 Qwen 說（自然語言皆可，**有 dispatch 意圖即可**）：

```
我要開始這個專案，請進行初始化
```

或更具體：

```
這是 ASP.NET 訂單管理系統；請幫我設定 framework workspace
```

### 5.4 LangGraph runtime 自動行為

```
[lead_node]
  ↓ 偵測 .agents/CURRENT_WORKSPACE 不存在
  ↓ Layer-1 結構訊號 = "missing_workspace"
  ↓ task_class = onboarding (自動)

[onboarding_node]
  ↓ Step 1 偵測技術棧（掃 *.csproj / package.json / pom.xml ...）
  ↓ Step 2 產 Detection Report
  ↓ Step 3 列 ≤3 題給你回答（workspace 名 / business domains）
  ↓ Step 4 寫 .agents/workspaces/<新名>.md + .agents/CURRENT_WORKSPACE
  ↓ Step 4.5 mempalace_add_drawer wing=<project> room=index
  ↓ Step 4.6 GitNexus optional prompt
  ↓ END
```

你只要回答 Step 3 的問題即可；其他全自動。

### 5.5 onboarding 完成後驗證

```cmd
type .agents\CURRENT_WORKSPACE
REM 應印你新 workspace 名稱

dir .agents\workspaces\
REM 應看到 <新 workspace>.md 已建好
```

之後 dispatch 走正常 11-stage workflow（`@Lead` → `@Architect` → `@QA` → `@Backend/@Frontend` → `@Reviewer` → ...）。

---

## §6 GitNexus 程式碼語法層（**V90-A-8 升 mandatory**）

含程式碼的專案 **必裝**（V90-A-8 後從 optional 升 framework-mandatory）；mempalace 寫語意；GitNexus 寫語法；ADR-0041 兩層 SoT。LangGraph runtime 啟動健康 probe 偵測缺失 → 拒啟。

```cmd
REM 6.1 npm prefix 指 Node v22 LTS 資料夾（⚠️ v24 缺 ladybugdb-core prebuild → install fail）
D:\node-v22.12.0-win-x64\npm.cmd config set prefix D:\node-v22.12.0-win-x64

REM 6.2 全域裝 gitnexus
D:\node-v22.12.0-win-x64\npm.cmd install -g gitnexus

REM 6.3 驗
D:\node-v22.12.0-win-x64\gitnexus.cmd --version
```

重啟 Qwen Code → 對話框確認 `mcp__gitnexus__*` 16 tools 出現 → 對 Qwen 說「掃這個 repo 建 gitnexus index」第一次自動 build `.gitnexus/` cache。

**V90-A-8 state-level integration**：runtime nodes（lead / architect / backend / frontend / reviewer）會自動透過 `runtime/gitnexus_helper.py` 在 LLM call 前 pre-fetch GitNexus context（callers / callees / impact）並注入 prompt；缺 GitNexus → mcp_server 啟動 health probe fail，禁啟 dispatch。

---

## §7 換環境（公司 → 家 / 新機器）只改一個檔

只動 `.qwen/settings.json`：

| 換什麼           | 動哪行                                                                     |
| ---------------- | -------------------------------------------------------------------------- |
| token 換新的     | `COMPANY_LLM_TOKEN` 值                                                     |
| 公司 → DashScope | 5 行（`LLM_API_PROVIDER` / `MODEL` / `BASE_URL` / `KEY_ENV` + 對應 token） |
| 換機器路徑       | `command` / `cwd` / `PYTHONPATH` / gitnexus.cwd 4 處                       |

**不需動**：`.agents/` 任何檔、workspace.md、`qwen.md`、`.mcp.json`。

---

## §8 常見問題快速修

| 症狀                                 | 原因                                   | 修法                                                                                |
| ------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `mcp__langgraph__*` tools 沒出現     | command 路徑錯 / Python 沒裝 langgraph | 用絕對路徑跑 `python.exe -c "import langgraph"`；改 `.qwen/settings.json` `command` |
| dispatch 卡 120s 後 fail-fast        | sampling 模式 / API 配置錯             | 確認 `LLM_API_DEFAULT_MODE=api`；用 curl 跑 `<base_url>/models` 驗 token + URL      |
| `400 Bad Request: model not found`   | model 字串對不上公司 API               | 找公司 wiki / curl `<base_url>/models` 看真實 model 名                              |
| `401 Unauthorized`                   | token 過期 / env var 名錯              | 確認 `LLM_API_KEY_ENV` 跟下面 token 變數名一致                                      |
| `Connection refused` / DNS 錯        | URL 寫錯 / 內網 DNS                    | curl `<base_url>` 驗                                                                |
| onboarding 沒觸發                    | `.agents/CURRENT_WORKSPACE` 殘留檔     | `del .agents\CURRENT_WORKSPACE`                                                     |
| mempalace add_drawer 卡住            | content 過大 / 含大量 verbatim code    | 中文 ≤2000 字 / 英文 ≤5000 chars；code 改 GitNexus reference 不 inline              |
| Web harness（Claude Code Web）跑不了 | 無 home fs 寫權限                      | env 加 `LANGGRAPH_INMEMORY=1`（trade-off：thread_id 不跨 invoke）                   |

---

## §9 架構速覽

```
                 ┌─────────── 4 harness ────────────┐
                 │ Claude Code CLI / Web            │
   user 對話 ──→ │ Qwen Code                        │
                 │ Antigravity                      │
                 └─────────────┬────────────────────┘
                               │
                               ▼  mcp__langgraph__dispatch
              ┌─────────────────────────────────────┐
              │ LangGraph runtime (v8.0.x stable)   │
              │ • 25 nodes (11 agents + sub-graphs) │
              │ • 14 conditional edges              │
              │ • 8 HITL interrupt types            │
              │ • AsyncSqliteSaver checkpoint       │
              └────────────┬───────────┬────────────┘
                           │           │
                           ▼           ▼
                    ┌──────────┐  ┌──────────┐
                    │ mempalace│  │ GitNexus │
                    │ 語意層 SoT│ │ 語法層    │
                    └──────────┘  └──────────┘
```

| 檔/目錄                        | 角色                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| `.agents/`                     | Framework 本體；不動（升級時 git pull）                        |
| `.qwen/settings.json`          | **machine 配置 SoT**；token / 路徑 / LLM*API*\*                |
| `.qwen/settings.json.example`  | 範本；給新 clone 參考                                          |
| `.mcp.json`                    | Claude Code MCP server 註冊（與 .qwen 並存；Claude Code 用）   |
| `.devcontainer/`               | Claude Code Web 自動 setup                                     |
| `qwen.md` / `QWEN.md`          | Qwen Code harness memory                                       |
| `.agents/CURRENT_WORKSPACE`    | 一行字；當前 active workspace 名（onboarding 寫）              |
| `.agents/workspaces/<name>.md` | 專案業務語意（PATHS / TECH_STACKS / BUSINESS_DOMAINS / RULES） |

---

## §10 維護 / 升級 framework

```cmd
REM 升 framework 版本
git fetch upstream
git merge upstream/main      REM 衝突主要在 .qwen/settings.json.example 跟 .agents/

REM workspace.md / .qwen/settings.json 不會衝突（一個進 git；一個 gitignored）
```

健康檢查：

```cmd
C:\Users\<u>\AppData\Local\Programs\Python\Python313\python.exe -c "import sys; sys.path.insert(0, '.agents'); from runtime.graph import build_graph; print('nodes:', len(build_graph().get_graph().nodes))"
REM 應印 nodes: 25

C:\Users\<u>\AppData\Local\Programs\Python\Python313\python.exe -c "import sys; sys.path.insert(0, '.agents'); from runtime.parser import validate_v722_ground_truth; errs = validate_v722_ground_truth(); print('OK' if not errs else f'drift: {len(errs)}')"
```

---

## §11 後續閱讀

| 主題                                                 | 文件                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| Framework 心智地圖（必讀；agent session start 必讀） | `.agents/AGENT_BOOTSTRAP.md`                               |
| Qwen Code 特化規則（drawer 限制 / scan budget）      | `qwen.md`                                                  |
| Routing ticket schema                                | `.agents/skills/routing-ticket-protocol.md`                |
| LangGraph runtime 架構（ADR-0046）                   | `.agents/decisions/0046-langgraph-runtime-architecture.md` |
| milestone v3 freeze 報告                             | `.agents/docs/Reports/MILESTONE_V3_FREEZE.md`              |
| mempalace 完整操作（29 tools / split / fallback）    | `.agents/skills/memory-operations.md`                      |
| GitNexus 場景表（何時該用）                          | `.agents/skills/code-graph-exploration.md`                 |
| Antigravity IDE 部署                                 | `.agents/INSTALL_ANTIGRAVITY.md`                           |
| 8 HITL interrupt 類型                                | `.agents/runtime/hitl.py` (source)                         |

---

> **設計原則（v8.0.9+）**：
>
> 1. **machine 配置 SoT** = `.qwen/settings.json` env block（單一檔；換環境只改這個）
> 2. **專案業務語意** = `.agents/workspaces/<name>.md`（onboarding 自動建；不放 machine config）
> 3. **Framework 本體** = `.agents/`（git tracked；升級時 merge upstream）
> 4. **Token 安全** = `.qwen/settings.json` gitignored；`.example` 為公開模板
