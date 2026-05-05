# `.agents/` 框架部署操作手冊

> 把這套 Multi-Agent 框架部署到新專案的完整 bootstrap 流程。
> 一次性執行；完成後使用日常 workflow（見 §六 日常維護）。
>
> **適用對象**：solo developer 想在新專案啟用此框架；既有專案想導入。
> **預估時間**：30-60 分鐘（首次；含 mempalace 安裝與測試）。
>
> **版本對齊**：框架 v6.33（2026-05-04）；MemPalace 3.3.4+；Python 3.9+。

## §0 部署原則 + 跨平台前置

> **核心原則**（PROPOSAL_502_024）：framework 是 **agent 架構**；user 不執行任何 framework
> 內部腳本。本檔的 `bash` / `python` 區塊**多數標 [Agent 自動]**；user 自跑只在
> [User 必跑] 標記的 bootstrap 環節（pip install / git clone 等 framework 還沒裝起來時）。

### Windows 用戶 bootstrap 前置

framework 內含 6 個 bash 腳本（PROPOSAL_502_025 後正逐步遷 Python）。
Windows 用戶請先擇一：

| 選項                                             | 說明                                   |
| ------------------------------------------------ | -------------------------------------- |
| ✅ **WSL 2**                                     | 推薦；完整 Linux 環境；無相容性問題    |
| ✅ **Git Bash**（Git for Windows 內建）          | 多數 IDE Bash tool 後端；夠用          |
| ✅ **Claude Code / Qwen Code / Antigravity IDE** | 內建 Bash backend；agent 跑無問題      |
| ❌ Windows native cmd / PowerShell               | bash 腳本不可跑（純 Python 部分仍 OK） |

mac / Linux：原生支援；無前置。

### 標記制度

文中所有命令區塊冠以下 3 種標記之一：

- **[User 必跑]**：framework 還沒就位前的 bootstrap；user 必須在 terminal 自跑
- **[Agent 自動]**：framework 就位後的 daily ops；agent 用 Bash/run_command tool 代執行
- **[Reference]**：說明用途；不需執行

---

## 一、Phase 0：環境準備（runtime 檢查）

### 1.1 必需 runtime

```bash
# 檢查所有必需版本
node --version              # v18.0+
bash --version              # 4.0+ (Linux/macOS) or Git Bash (Windows)
git --version               # 2.25+
python3 --version           # 3.9+
pip3 --version              # 24.0+
```

任一未達標 → 先升級或安裝再繼續。

### 1.2 平台特殊注意

- **macOS**：Bash 預設 3.2（過舊）；建議 `brew install bash` 升 5.x，或改用 zsh + 在腳本內聲明 `#!/usr/bin/env bash`
- **Windows**：必裝 **Git Bash** 或 WSL；不支援 PowerShell-only 環境
- **Linux**：通常皆已達標；確認 `python3 ≠ python2` 連結

---

## 二、Phase 1：部署 `.agents/` 至專案

### 2.1 取得 framework

選一種方式：

**方式 A：直接 copy（最簡；推薦個人專案）**

```bash
cd <你的專案根>
git clone https://github.com/<your-fork>/201013 /tmp/agents-framework
cp -r /tmp/agents-framework/.agents .
rm -rf /tmp/agents-framework
```

**方式 B：git submodule（多專案共享框架升級時）**

```bash
cd <你的專案根>
git submodule add <framework-repo-url> .agents
git submodule update --init
```

**方式 C：fresh clone（從零開始一個新專案）**

```bash
git clone <framework-repo-url> <new-project>
cd <new-project>
# 已含 .agents/；接下一步
```

### 2.2 確認檔案結構

```bash
ls .agents/
# 應見：rules/ skills/ tasks/ decisions/ iron-rules/ memory/ workspaces/
#       proposals/ docs/ scripts/ tests/ tech-stacks/ domains/
#       FRAMEWORK_VERSION FRAMEWORK_REQUIREMENTS.md CHANGELOG.md
#       KNOWN_ISSUES.md PROPOSAL_INDEX.md ...
```

少任何核心目錄 → 部署不完整；重做 §2.1。

### 2.3 .gitignore 對齊

於專案根 `.gitignore` 加：

```
# Memory Palace local cache (do not commit)
~/.mempalace/

# Per-session state (project root; not workspace)
PENDING_ACTIONS.md.snapshot.*
ROUTING_TICKET.md.snapshot.*

# Optional: 不追蹤 PENDING_ACTIONS 變更（per-team policy）
# PENDING_ACTIONS.md
```

> 注意：`PENDING_ACTIONS.md` 本身**建議追蹤**（git 內保留歷史；solo user 自評 + 跨 session 重建狀態用）；只有 snapshot 不追蹤。

---

## 三、Phase 2：MemPalace 安裝 + 初始化

> **本節 [User 必跑]**：mempalace 還沒裝起來時，agent 也用不了 mempalace MCP。
> 是 framework 4 個 bootstrap 例外之一（agent-script-orchestration §7）。

### 3.1 安裝套件

```bash
# [User 必跑] — bootstrap；agent 還沒能用 mempalace
pip install mempalace>=3.3.4
mempalace --version              # 確認 ≥ 3.3.4
which mempalace-mcp              # MCP server 命令；必須有
```

### 3.2 初始化 palace

```bash
mempalace init                   # 在 ~/.mempalace/ 建立資料庫
mempalace status                 # 應顯示「palace 已 init；0 drawers」
```

### 3.3 首次採礦（v2 Plan G：從 cold export 來源）

```bash
# v2：來源從 .agents/memory/ 改 .agents/memory/.export/（每 drawer 一檔；ratio 1:1）
mempalace mine .agents/memory/.export/
mempalace status                 # 應顯示 ≥ 25 drawers（framework + workspace export 總和）
```

> v1 用的 `--yes --auto-mine --no-llm` 是 `mempalace init` 的 flags；`mine` 沒這些 flags（PROPOSAL_502_020 T-1 調查時釐清）。

### 3.4 Cold export 驗證（Plan G 核心）

```bash
node .agents/scripts/mempalace-export.mjs --dry-run --verbose
# 應列出每 drawer would write to .agents/memory/.export/<wing>/<room>/<id>.md
node .agents/scripts/mempalace-export.mjs
# 實際 export；確保 `.agents/memory/.export/` 與 mempalace 同步
```

> Plan G 設計：mempalace = primary SoT（ChromaDB user-global，不跟專案走）；`.export/` = cold backup（commit 進 git；zip 帶走）。每次寫入後（或 commit 前）跑 export 同步。

---

## 四、Phase 3：MCP server 設定（Claude Code）

### 4.1 建立 `.mcp.json`

於專案根：

```json
{
  "mcpServers": {
    "mempalace": {
      "command": "mempalace-mcp",
      "args": []
    }
  }
}
```

### 4.2 重啟 Claude Code 載入 MCP

```bash
# Claude Code 啟動時自動讀 .mcp.json
# 確認 MCP tools 可用（任意 Claude Code session 內）：
# 應出現 mcp__mempalace__* 系列工具
```

不可達 → 檢查 `which mempalace-mcp`；確認 PATH 正確；重啟 Claude Code。

---

## 五、Phase 4：建立第一個 workspace

> **PROPOSAL_502_024 後**：onboarding **不要 User 跑腳本**；對 LLM 說「幫我建 workspace」即可。
> Agent 走 `.agents/skills/agent-driven-onboarding.md` 自動偵測 + 寫檔 + 驗證。
> 任何環境（Windows / Qwen / Antigravity）通用。

### 5.1 選擇 onboarding 路徑

| 你的情境                      | 走哪條                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| **任何 LLM 環境（推薦）**     | §5.2 對 agent 說「幫我建 workspace」（agent-driven）                         |
| **既有專案**（已有 src/）     | §5.3 import workflow（agent 走 `tasks/existing-project-import-workflow.md`） |
| **純 shell 無 LLM**（極罕見） | §5.4 互動 CLI（fallback；Windows 不穩）                                      |

### 5.2 Agent-driven onboarding（**推薦 default**）

直接對 LLM 說：

> 「幫我啟動新專案 onboarding，workspace 名稱 `<name>`」
>
> 或更簡單：「幫我建 workspace」（agent 自動從目錄名 / git remote 推導）

Agent 會：

1. Read `package.json` / `pom.xml` / 等檔自動偵測 tech-stacks
2. LS 子目錄推導 domains 候選
3. 必要時用 multi-choice 問你（≤ 3 題；不會 free-form 問細節）
4. Write 出 `.agents/workspaces/<name>.md` + `CURRENT_WORKSPACE`
5. Bash 跑 `workspace-schema-validator.mjs` 驗證
6. mempalace wake-up 注入跨 session 上下文

**完整 playbook**：`.agents/skills/agent-driven-onboarding.md`

### 5.4 互動 CLI（fallback；Windows 不穩；極罕見才用）

⚠️ Windows readline TTY 行為不穩；Qwen Code stdin pipe 可能 hang；**任何 LLM 環境直接走 §5.2 agent-driven**。

僅在「純 shell 無 LLM」時用：

```bash
cd <你的專案根>
node .agents/scripts/init-workspace.mjs --name <project_snake_case>
```

完全非互動（CI/CD 自動化）走 yaml：

```bash
node .agents/scripts/init-workspace.mjs --config /path/to/init.yaml --force
```

詳：`.agents/workspaces/README.md`。

### 5.3 既有專案 import workflow

依 `.agents/tasks/existing-project-import-workflow.md` 5 步：

```bash
TARGET=$(pwd)   # 專案根

# Step 1: 掃描既有 codebase（read-only）
cat $TARGET/package.json | jq '.dependencies, .devDependencies'
find $TARGET/src -type d -maxdepth 2

# Step 2: 對照 .agents/tech-stacks/MANIFEST.yaml；缺的補 stub

# Step 3: workspace 建立（用 CLI 或手動）
node .agents/scripts/init-workspace.mjs --name <ws_name>

# Step 4: audit baseline（首次掃描報告）
# → 後續派 @Architect 出 EXISTING_CODEBASE_REPORT.md

# Step 5: 完成（v2 Plan G：用 export 同步）
mempalace mine .agents/workspaces/<ws_name>/memory/.export/   # 若 workspace 已有 .export/
node .agents/scripts/mempalace-export.mjs --wing <wing_name>  # 反向同步至 .export/
```

---

## 六、Phase 5：First validation（驗證部署）

> **本節 [Agent 自動]**：framework 已就位後，validator 由 agent 用 Bash tool 自動跑；
> user 對 agent 說「驗證部署」即可。下方命令為 [Reference]。

### 6.1 跑 18 validators

```bash
# [Agent 自動執行] — user 不需自跑
bash .agents/tests/run-all.sh
# 期望：✅ All validation passed (18 validators 全 0 errors / 0 warnings)
```

任一 fail → 對應 validator 細節：

```bash
bash .agents/tests/run-all.sh --validator memory_palace   # 只跑單個
bash .agents/tests/run-all.sh --fast                       # 排除 scripts/L3 smoke
```

### 6.2 跑 drift simulator

```bash
node .agents/tests/agent-drift-simulator.mjs
# 期望：drift_score ≥ 0.85 PASS
```

### 6.3 確認 PENDING_ACTIONS / ROUTING_TICKET

```bash
ls PENDING_ACTIONS.md ROUTING_TICKET.md 2>&1
# 全新專案：兩者皆不存在；@Lead 首次工作對話會自動建（fresh init）
# 既有 workspace 切換：應有 §🏠 ACTIVE_WORKSPACE 標頭
```

---

## 七、Phase 6：First task dispatch（hello world 測試）

開啟 Claude Code session，輸入：

```
我剛完成 .agents/ 框架部署；請執行 cold start checklist 並摘要當前 framework 狀態給我看。
```

@Lead 應走 `tasks/session-start-checklist.md` 5 步：

1. 讀 CURRENT_WORKSPACE → ✅
2. 讀 PENDING_ACTIONS → 不存在（fresh init）
3. mempalace wake-up → 顯示 L0+L1 上下文
4. ROUTING_TICKET → 不存在（fresh）
5. Resume 決策 → 通知「fresh init；無阻斷指令」

如 @Lead 走完 5 步並回摘要 → **部署成功** ✅

---

## 八、日常維護（部署後）

> **本章全 [Agent 自動]**：對 agent 自然語言陳述需求即可（「接新任務」/「切 workspace」/「採納 PROPOSAL_X」/「跑驗證」）；agent 自動用 Bash/run_command tool 執行下列命令。User 不需離開對話視窗。
> 下方所有 `bash` 區塊都是 [Reference]，不是命令式。

### 8.1 接新任務

直接對 Claude Code 說即可；@Lead 自動走對應 workflow：

- 「實作新功能：X」→ feature task_class（10 階段）
- 「修現有 endpoint Y 加 Z 驗證」→ modify-existing task_class（從 Stage 4 進）
- 「重新掃 src/ 同步 docs/」→ doc-sync task_class
- 「正式環境 X 壞了！」→ Hotfix（依 SC/D 評估走 light/heavy）

### 8.2 切換 workspace

```bash
# 方式 1：CLI（自動觸發 handover）
node .agents/scripts/init-workspace.mjs --name <new_ws>

# 方式 2：手動改 CURRENT_WORKSPACE（@Lead 偵測漂移後觸發 handover SOP）
echo "<new_ws>" > .agents/CURRENT_WORKSPACE
```

切換時自動：snapshot 當前 / restore 新 / wake-up。詳：`tasks/workspace-switch-handover.md`。

### 8.3 採納提案

```
User: 採納 PROPOSAL_<id>
```

@Lead 走 `tasks/proposal-adoption-workflow.md` 6 步（pre-adoption 分析 → 執行 → DONE → bump → push）。

### 8.4 定期維護

| 頻率                 | 動作              | 命令                                                                |
| -------------------- | ----------------- | ------------------------------------------------------------------- |
| 每次 commit 前       | run-all.sh 確認   | `bash .agents/tests/run-all.sh`                                     |
| 每 minor bump        | drift sync        | `node .agents/tests/agent-drift-simulator.mjs` + 同步 AUDIT_HISTORY |
| 每 10 工作對話       | @Auditor 自動觸發 | （rules 內建；不需手動）                                            |
| Drawer count > 1000  | compress          | `mempalace compress --dry-run` 預覽後 `--yes` 執行                  |
| 完成提案 ≥ 10 未歸檔 | @Retro 批次歸檔   | （retro.md §s09 自動觸發）                                          |

### 8.x Harness Loader 載入策略（PROPOSAL_502_022 O-1/O-2）

**設計目標**：把每次 dispatch 的 token 注入降到必要量；節省 25-35%。

**Rules（13 個 + 6 iron-themes）載入策略**：

| 檔案類型                  | 載入時機                                                          | 範圍               |
| ------------------------- | ----------------------------------------------------------------- | ------------------ |
| `rules/system-prompt.md`  | eager（每次必載）                                                 | meta；500 tokens   |
| `rules/<active_agent>.md` | eager（被派發 agent 才載）                                        | 1,200-2,000 tokens |
| `iron-rules/<theme>.md`   | eager **依 active rule 的 `applies_iron_themes`**；不在清單者不載 | 300-700 / theme    |
| 其他 `rules/*.md`         | lazy（只在 LLM 需要查詢其他 agent 行為時 Read）                   | 不算入 baseline    |

**Skills 載入策略**：

| 檔案類型                        | 載入時機                                         |
| ------------------------------- | ------------------------------------------------ |
| `load_priority: lazy` 的 skill  | LLM 主動 Read 才載；不預載                       |
| `load_priority: eager` 的 skill | 隨 active rule 預載（罕見；只 system-prompt 級） |
| 無 `load_priority` 欄位         | default = lazy（≥ 3000 tokens 適用）             |

**典型效果**（PROPOSAL_502_022 O-1+O-2+O-3）：

- O-1：dispatch 只載 active agent 的 iron-themes（typically 1-3 個 vs 全 6 個）→ 省 ~1.5K
- O-2：lead-orchestration-guide.md（8,280 tokens；lazy）等大 skill 不預載 → 省 ~5K（cold start 時）
- O-3：mempalace.search default `limit=3` → 省 ~600/查詢
- 合計每 dispatch 節省 ~25-35%

**Harness 各自實作細節**：

- Claude Code CLI：rules 自動載入；skills 透過 LLM Read 才開啟（已是 lazy）
- Antigravity：IDE Settings 控制（參 INSTALL_ANTIGRAVITY.md §Phase 3）
- Qwen-Agent：自有 MCP / file API；遵循同策略
- 任何 harness：rules frontmatter `applies_iron_themes` 為機讀清單；loader 應 honor

詳細成本分析：`.agents/docs/Reports/TOKEN_COST_ANALYSIS_REPORT.md`

---

## 九、Troubleshooting

### 9.1 mempalace 命令找不到

```bash
which mempalace          # 應指向 ~/.local/bin/mempalace 或 venv 內
echo $PATH                # 確認含 pip 安裝目錄
pip3 install --user mempalace>=3.3.4   # 重裝至 user dir
```

### 9.2 mempalace-mcp 連線失敗

```bash
mempalace-mcp --help     # 確認命令存在
# Claude Code 重啟（讓它重讀 .mcp.json）
# 確認 .mcp.json 在專案根（不是 .agents/ 內）
```

連線失敗時系統自動降級為 hybrid fallback（markdown grep）；不阻斷，但效率降。

### 9.3 validator fail

```bash
bash .agents/tests/run-all.sh --validator <name>   # 只跑該 validator 看細節
node .agents/tests/<name>-validator.mjs --verbose   # 詳細輸出
```

最常見：`index_drift` → 跑 `node .agents/scripts/generators/gen-proposal-index.mjs --write` + `gen-rules-version-index.mjs --write`。

### 9.4 PENDING_ACTIONS 損毀 / 不存在

- 不存在 → 第一次工作對話 @Assistant 自動建（PROPOSAL_502_013 M-2）
- 損毀 → 依 `tasks/pending-actions-recovery.md` 三策略

### 9.5 ROUTING_TICKET stale（state 不同步）

`tasks/session-start-checklist.md` Step 4 偵測（dual check：5 工作對話 OR 7 天 wall-clock）→ 觸發 Step 5 決策。

### 9.6 workspace 漂移（§🏠 ACTIVE_WORKSPACE ≠ CURRENT_WORKSPACE）

@Lead 自動偵測 → 觸發 `tasks/workspace-switch-handover.md` 5 步 SOP。

### 9.7 Hotfix 派發

```
User: 正式環境 X 壞了！
```

@Lead 走 `tasks/hotfix-checklist.md` Step 0：SC/D 評估 → light/heavy 判定 → 派發。詳：`decisions/0008-hotfix-dual-track.md`。

---

## 十、目錄速查

| 路徑                        | 用途                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `.agents/rules/`            | 13 Agent rules（行為規範）                                                              |
| `.agents/skills/`           | 64+ skills（操作手冊；分 templates / examples / checklists 子目錄）                     |
| `.agents/tasks/`            | 14+ tasks（workflow SOP）                                                               |
| `.agents/decisions/`        | 39 ADRs（架構決策；不可動）                                                             |
| `.agents/iron-rules/`       | 6 iron themes（鐵律；immutable）                                                        |
| `.agents/memory/`           | Seed docs（cold-start re-mine 來源；v2 後不活躍維護）                                   |
| `.agents/memory/.export/`   | **Cold export artifact**（mempalace-export.mjs 自動產；commit + zip 帶走；Plan G 核心） |
| `.agents/workspaces/`       | Per-project 配置 + memory + proposals                                                   |
| `.agents/proposals/`        | Framework scope 提案歷史                                                                |
| `.agents/tests/`            | 15 validators + scripts L1+L3                                                           |
| `.agents/scripts/`          | init-workspace + generators + hooks                                                     |
| `.agents/docs/`             | Framework 文件（PRODUCTION_READINESS / etc.）                                           |
| `.agents/CURRENT_WORKSPACE` | active workspace 名稱（單一檔；單行）                                                   |
| `.agents/KNOWN_ISSUES.md`   | KI 條目追蹤（4 條 + observation）                                                       |
| `.agents/CHANGELOG.md`      | 框架版本歷史                                                                            |
| `.agents/FRAMEWORK_VERSION` | 當前版本 + drift_score baseline                                                         |
| `PENDING_ACTIONS.md`        | 專案根；@Assistant 維護；跨 session 狀態                                                |
| `ROUTING_TICKET.md`         | 專案根；@Lead 派發必寫                                                                  |
| `.mcp.json`                 | 專案根；Claude Code MCP server 註冊                                                     |

---

## 十一、進一步學習

部署完成後想深入了解時：

| 主題                  | 讀                                                                |
| --------------------- | ----------------------------------------------------------------- |
| 系統設計理念          | `.agents/decisions/0001-stateless-lead-routing.md`（從這篇開始）  |
| 完整 Agent 角色職責   | `.agents/docs/agents-overview.md`                                 |
| 工作流 10 階段        | `.agents/skills/lead-orchestration-guide.md §六`                  |
| 提案生命週期          | `.agents/decisions/0021-proposal-lifecycle.md` + `rules/retro.md` |
| 平行審查機制          | `.agents/skills/parallel-review-arbitration.md`                   |
| Memory Palace 詳細    | `.agents/skills/memory-palace-schema.md` + `memory-operations.md` |
| 上線就緒 checklist    | `.agents/docs/PRODUCTION_READINESS.md`                            |
| 已知問題              | `.agents/KNOWN_ISSUES.md`                                         |
| 巡邏目錄（P-01~P-29） | `.agents/skills/patrol-notification-catalog.md`                   |

---

## 十二、聯絡 / 回報問題

- 部署遇問題 → 先查 §九 Troubleshooting
- 框架本身 bug / 不一致 → 自己派 `@Retro` 立 RULE_UPDATE_PROPOSAL
- 不確定該不該動的設計 → Discussion mode 直接問 @Lead

---

**部署檢核總表**（依此勾選）：

- [ ] §一 環境準備：node 18+ / python 3.9+ / git 2.25+ / pip 24+
- [ ] §二 部署 .agents/ 至專案根 + .gitignore 對齊
- [ ] §三 mempalace 3.3.4+ 安裝 + init + 首次 mine
- [ ] §四 .mcp.json 建立 + Claude Code 載入
- [ ] §五 第一個 workspace 建立（CLI or import workflow）
- [ ] §六 15 validators 全綠 + drift_score ≥ 0.85
- [ ] §七 First task dispatch hello world 通過

全勾 → **部署成功**。可開始日常 workflow。
