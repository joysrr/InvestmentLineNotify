# `.agents/` 框架部署操作手冊

> 把這套 Multi-Agent 框架部署到新專案的完整 bootstrap 流程。
> 一次性執行；完成後使用日常 workflow（見 §六 日常維護）。
>
> **適用對象**：solo developer 想在新專案啟用此框架；既有專案想導入。
> **預估時間**：30-60 分鐘（首次；含 mempalace 安裝與測試）。
>
> **版本對齊**：框架 v6.27（2026-05-02）；MemPalace 3.3.4+。

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

### 3.1 安裝套件

```bash
pip install mempalace>=3.3.4
mempalace --version              # 確認 ≥ 3.3.4
which mempalace-mcp              # MCP server 命令；必須有
```

### 3.2 初始化 palace

```bash
mempalace init                   # 在 ~/.mempalace/ 建立資料庫
mempalace status                 # 應顯示「palace 已 init；0 drawers」
```

### 3.3 首次採礦（從 framework markdown SoT）

```bash
mempalace mine .agents/memory/ --yes --auto-mine --no-llm
mempalace status                 # 應顯示 ≥ 5 drawers（framework debug_graveyard 條目）
```

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

### 5.1 選擇 onboarding 路徑

| 你的情境                  | 走哪條                    |
| ------------------------- | ------------------------- |
| **綠地新專案**（無 src/） | §5.2 互動 CLI             |
| **既有專案**（已有 src/） | §5.3 import workflow      |
| **不確定**（想看選項）    | §5.2 先用 CLI；中途可中止 |

### 5.2 互動 CLI（綠地推薦）

```bash
cd <你的專案根>
node .agents/scripts/init-workspace.mjs --name <project_snake_case>
```

依提示填欄位；`--dry-run` 可先預覽不寫檔。完成後：

- `workspaces/<name>.md` 建立
- `.agents/CURRENT_WORKSPACE` 寫入
- 自動跑 `mempalace wake-up` 注入 L0+L1 上下文

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

# Step 5: 完成
mempalace mine .agents/workspaces/<ws_name>/memory/
```

---

## 六、Phase 5：First validation（驗證部署）

### 6.1 跑 15 validators

```bash
bash .agents/tests/run-all.sh
# 期望：✅ All validation passed (15 validators 全 0 errors / 0 warnings)
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

| 路徑                        | 用途                                                                |
| --------------------------- | ------------------------------------------------------------------- |
| `.agents/rules/`            | 13 Agent rules（行為規範）                                          |
| `.agents/skills/`           | 64+ skills（操作手冊；分 templates / examples / checklists 子目錄） |
| `.agents/tasks/`            | 14+ tasks（workflow SOP）                                           |
| `.agents/decisions/`        | 39 ADRs（架構決策；不可動）                                         |
| `.agents/iron-rules/`       | 6 iron themes（鐵律；immutable）                                    |
| `.agents/memory/`           | Markdown SoT backup（debug_graveyard）                              |
| `.agents/workspaces/`       | Per-project 配置 + memory + proposals                               |
| `.agents/proposals/`        | Framework scope 提案歷史                                            |
| `.agents/tests/`            | 15 validators + scripts L1+L3                                       |
| `.agents/scripts/`          | init-workspace + generators + hooks                                 |
| `.agents/docs/`             | Framework 文件（PRODUCTION_READINESS / etc.）                       |
| `.agents/CURRENT_WORKSPACE` | active workspace 名稱（單一檔；單行）                               |
| `.agents/KNOWN_ISSUES.md`   | KI 條目追蹤（4 條 + observation）                                   |
| `.agents/CHANGELOG.md`      | 框架版本歷史                                                        |
| `.agents/FRAMEWORK_VERSION` | 當前版本 + drift_score baseline                                     |
| `PENDING_ACTIONS.md`        | 專案根；@Assistant 維護；跨 session 狀態                            |
| `ROUTING_TICKET.md`         | 專案根；@Lead 派發必寫                                              |
| `.mcp.json`                 | 專案根；Claude Code MCP server 註冊                                 |

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
