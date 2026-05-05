# Skill: Agent Script Orchestration（agent 全自動代執行 framework scripts）

> 由 PROPOSAL_502_024 建立。本 skill 為**框架治理原則**：所有 framework scripts 由 agent
> 自動代執行；User 0 腳本呼叫。任何 rule / task / skill 文件**禁止**指示 User 手動跑腳本。

## §0 核心原則（NON-NEGOTIABLE）

> **Framework = agent 架構；不是 user 工具。**
>
> User 只說「我要做 X」；agent 判斷要跑哪些 scripts 並用 Bash tool 自動執行。

## §1 Framework Scripts 完整清單 + agent 觸發時機

### 1.1 由 agent 自動執行（User 不需知道存在）

| Script                                                   | Agent 觸發時機                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `init-workspace.mjs --config <yaml>` 或 agent Write 替代 | User 表達建 workspace；走 `agent-driven-onboarding.md`                  |
| `mempalace-export.mjs`                                   | 任何 `mcp__mempalace__add_drawer` 寫入後；commit 前；User 要 zip 帶走時 |
| `tests/run-all.sh`                                       | 每次 file edit 後（fast mode）；commit 前（full mode）                  |
| `tests/run-all.sh --validator <name>`                    | 修了某類檔案後（如 改 ROUTING_TICKET → 跑 routing_ticket validator）    |
| `generators/gen-proposal-index.mjs --write`              | proposal 建 / 改 / 移動目錄後                                           |
| `generators/gen-rules-version-index.mjs --write`         | rule 改 frontmatter 版本後                                              |
| `generators/gen-changelog.mjs --proposal <path> --write` | proposal DONE 時                                                        |
| `generators/gen-framework-version.mjs --write`           | version bump 時                                                         |
| `platform-detect.mjs --json`                             | session-start（cold start checklist）                                   |
| `cross-harness-validator.mjs --append --report`          | User 切換到新 harness 環境時                                            |
| `tool-name-neutralizer.mjs --dry-run`                    | 任何修 rule 後（檢查工具名 hardcoded 漂移）                             |
| `mempalace mine .agents/memory/.export/`                 | cold-start 重建 palace；MCP 復活後 replay                               |
| `validate-auditor-dispatch.mjs`                          | @Auditor 5 維度評估前                                                   |

### 1.2 由 git hook 自動執行（agent 安裝；User 不需手動）

| Hook                                                                             | 觸發                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `.git/hooks/pre-commit`（複製自 `.agents/scripts/git-hooks/pre-commit.example`） | 每次 git commit；自動跑 mempalace-export + run-all.sh --fast |

Agent 在 onboarding / 第一次需要時自動安裝（用 Bash `cp` + `chmod +x`）。

### 1.3 由 framework patrol（@Assistant）自動觸發

@Assistant 巡邏 P-01 ~ P-31 內部呼叫對應 validator / 偵測腳本；User 不需介入。

## §2 對話模式範本

### ✅ 正確（agent 全自動）

```
User: 幫我建 workspace 給 ERP HR 模組
Agent: [auto-detect via Read/LS]
        [Write workspace .md + CURRENT_WORKSPACE]
        [Bash: node validate-workspace-schema]
       ✅ 已建 ws_erp_hr；驗證通過。下一步要派 @Architect 掃 codebase 嗎？

User: 我修改了 lead.md
Agent: [Bash: node rule-token-budget-validator + run-all.sh --fast]
       ✅ 16/16 validators 全綠；token 1981/2500 OK。
```

### ❌ 錯誤（指示 User 跑腳本）

```
Agent: 請你執行：
       node .agents/scripts/init-workspace.mjs --name ws_erp_hr
       然後跑：
       bash .agents/tests/run-all.sh
```

→ 違反核心原則。應改為 agent 用 Bash tool 自跑。

## §3 環境差異適配

| 環境              | Bash tool 可用      | 適配                            |
| ----------------- | ------------------- | ------------------------------- |
| Claude Code CLI   | ✅                  | 直接呼 Bash tool 跑 node / bash |
| Qwen Code         | ✅（`run_command`） | 同上；命令名不同但功能等價      |
| Antigravity       | ✅（`run_command`） | 同上                            |
| Claude Code Web   | 🟡 sandbox 視限制   | 可用就用；不可用走 §4 替代      |
| 自建 LLM 無 shell | ❌                  | 走 §4 replacement strategies    |

## §4 Bash 不可用時的替代策略

當環境無法執行 shell（極罕見）：

| 原本要跑的 script            | 替代                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `mempalace-export.mjs`       | agent 用 mempalace MCP tools 逐 wing/room/drawer 讀並 Write 檔    |
| `run-all.sh --fast`          | agent Read 改動檔 + 邏輯檢查（不如 validator 完整；標記 partial） |
| `gen-proposal-index --write` | agent Read 既有 INDEX + 算 stats + Write 替換 AUTO-GENERATED 區塊 |
| `init-workspace.mjs`         | 用 `agent-driven-onboarding.md` 純 Write 流程（已是替代）         |

替代效率較差；視為 graceful degradation；**仍不轉嫁 User**。

## §5 何時 agent 應主動告知 User script 執行結果

- ✅ 失敗時必告知（含完整錯誤摘要）
- ✅ 大規模操作前告知（如 export 25+ drawers）
- ✅ User 問「你做了什麼」時詳細列出
- ❌ 每個 fast validator 都報告（噪音）
- ❌ 例行 export 每次都 announce（除非 User 要追蹤）

預設：**靜默成功；明確失敗**。

## §6 對所有 framework 文件的撰寫規範

撰寫 / 改 rule / task / skill 文件時：

- ❌ 禁止：「User 請執行 `node ...`」
- ❌ 禁止：「請手動跑 `bash ...` 確認」
- ❌ 禁止：「執行下列命令」（指 User 操作）
- ✅ 用：「Agent 將自動執行 `node ...`」
- ✅ 用：「@Lead / @Assistant 在 trigger 時呼叫 `bash ...`」
- ✅ 用：「以下 script 由 [agent / git hook] 觸發」

主動審查既有文件時若發現 User-執行語氣，標 🟡 警告 + 立 lite proposal 修。

## §7 例外白名單（極少數可接受 User 直接跑）

只有以下情境合理：

1. **首次 framework deploy（infrastructure 級）**：
   - `pip install mempalace>=3.3.4`（套件安裝；non-framework）
   - `mempalace init`（初次資料庫；non-framework）
   - `git clone <framework-repo>`（取得 .agents/）

2. **Disaster recovery**：
   - mempalace palace 完全損毀 → User 須手動 `mempalace init` + 重 mine

3. **CI/CD pipeline**：
   - GitHub Actions / Jenkins yaml 內呼 `bash run-all.sh`（非互動使用者）

以上之外，User 不應被要求跑任何 framework 內 script。

## Related

- `.agents/skills/agent-driven-onboarding.md`（onboarding 階段；本 skill 的 specialized 應用）
- `.agents/INSTALL.md`（部署指南；應用本 skill 原則）
- `.agents/scripts/git-hooks/pre-commit.example`（agent 安裝的 hook）

## Related Decisions

ADR-0001（Stateless Routing）/ ADR-0002（Workspace 注入）/ ADR-0036（Rule Decomposition；本 skill = F1 通用治理原則）— 在 `decisions/`。
