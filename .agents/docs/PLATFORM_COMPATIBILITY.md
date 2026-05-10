# Platform Compatibility（多 harness 支援度對照）

> **文件分層**：framework（跨專案通用 framework 文件；對齊 ADR-0017 文件分層三原則）
>
> 由 PROPOSAL_502_019 T-1 建立。
> 本文件公布框架在 4 種 agent harness 的支援度 + 已知限制 + 移植路徑。

---

## 一、支援度總表（**2026-05-04 PROPOSAL_502_021 Sprint C 補實測**）

| Harness                               | 整體支援度                                 | drift_score                                | DoD             | primary use case                                                                                                    | 移植工時                            |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Claude Code CLI**                   | ✅ 100%                                    | **0.883**（baseline；C-1 實測 2026-05-04） | **5/5（100%）** | 本框架原生環境                                                                                                      | 0（直接照 INSTALL.md）              |
| **Claude Code Web**（claude.ai/code） | 🟡 70-80%                                  | 待 User 跑 cross-harness-validator.mjs     | 待測            | sandbox 受限；部分功能需 git 同步補位                                                                               | 1-2h（hooks/MCP 確認）              |
| **Antigravity**（Google）             | 🟢 70%（**已實機驗證 2026-05-02**）        | 待 User 跑 cross-harness-validator.mjs     | 待測            | MCP 自有註冊機制可用；**sub-agent 僅 browser_subagent**；其他並行任務 serial mode 通用（PROPOSAL_502_021 Sprint A） | 已驗證；參 `INSTALL_ANTIGRAVITY.md` |
| **自建 Qwen Agent**                   | 🟢 70-80%（**2026-05-04 修正：MCP 可用**） | 待 User 跑 cross-harness-validator.mjs     | 待測            | serial mode + Qwen MCP；persona drift 仍須重測                                                                      | 6-10h（drift + naming）             |

> **drift / DoD 補測指引**：在目標 harness 執行 `python3 .agents/scripts/cross-harness-validator.py --append --report`；本表會由 User 補完。

---

## 二、12 capability dimensions × 4 harness

| Capability                                           | Claude Code CLI         | Claude Code Web                             | Antigravity                                                                        | Qwen Agent                                                              |
| ---------------------------------------------------- | ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Markdown rules 讀取                                  | ✅                      | ✅                                          | ✅                                                                                 | ✅                                                                      |
| Read/Write/Edit tools                                | ✅                      | ✅                                          | 🟡 命名可能不同                                                                    | 🟡 需 adapter                                                           |
| Bash tool                                            | ✅                      | ✅                                          | 🟡 sandbox 限制                                                                    | 🟡 需 shell access                                                      |
| Sub-agent dispatch（Task）                           | ✅ parallel mode opt-in | ✅ parallel mode opt-in                     | 🟡 **僅 browser_subagent**；走 serial mode（PROPOSAL_502_021 Sprint A 後 default） | 🟡 走 serial mode（PROPOSAL_502_021 Sprint A 後 default）               |
| MCP server（`.mcp.json`）                            | ✅                      | 🟡 web 載入待證                             | 🟢 **IDE 自有 MCP 註冊**（**非 .mcp.json**；2026-05-02 實證）                      | 🟢 **MCP 可用**（User 實證 2026-05-04；自有註冊機制；非 `.mcp.json`）   |
| `settings.local.json` hooks                          | ✅                      | 🟡 sandbox 環境不同                         | 🟢 **改用 git pre-commit hook**（PROPOSAL_502_021 Sprint B-5；harness-neutral）    | 🟢 **改用 git pre-commit hook**（同 Antigravity；不依賴 LLM-side hook） |
| Discussion vs Execution mode                         | ✅（system-prompt）     | ✅                                          | 🟡 mode 概念可能不同                                                               | 🟡 需 prompt engineering                                                |
| 持久 file system                                     | ✅                      | 🟡 sandbox session-bounded（git push 補位） | 🟡 視 sandbox                                                                      | 🟡 視部署                                                               |
| 跨 session state（PENDING_ACTIONS / ROUTING_TICKET） | ✅                      | 🟡 + git push 後可恢復                      | 🟡 視 session model                                                                | 🟡 需 implementation                                                    |
| mempalace CLI 存取                                   | ✅                      | 🟡 視 sandbox 含 Python/pip                 | 🟡 視 sandbox                                                                      | 🟡 sandbox decide                                                       |
| Workflow stages（10 階段）                           | ✅                      | ✅                                          | ✅（Markdown 層）                                                                  | 🟡 + prompt 強化                                                        |
| Iron-themes immutability                             | ✅                      | ✅                                          | ✅                                                                                 | ✅                                                                      |

✅ = 完整支援；🟡 = 大致支援需注意；🔴 = 主要落差需 adapter

---

## 三、各 harness 詳細限制 + workaround

### 3.1 Claude Code CLI ✅

無已知限制。本框架 primary target。

### 3.2 Claude Code Web 🟡

| 限制                                           | 影響                                                 | Workaround                                                                       |
| ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.mcp.json` 是否載入 web sandbox 不確定        | mempalace MCP tools 可能不可達                       | 走 hybrid fallback（markdown grep；ADR-0039）；mempalace CLI 視 sandbox 是否提供 |
| `.claude/settings.local.json` hooks 可能不觸發 | post-commit auto-mine 失效                           | 手動跑 `mempalace mine` 或在每 commit 後派 @Assistant 巡邏                       |
| Sandbox session-bounded                        | session 結束 PENDING_ACTIONS / ROUTING_TICKET 可能清 | **git push** 後重新 clone 恢復                                                   |
| 跨 session counter（CONVERSATION_COUNTER）     | 重啟 sandbox 後可能 reset                            | **wall-clock fallback** 設計（PROPOSAL_502_014 N-4 已考慮）                      |

**部署建議**：可用；功能 70-80%；MCP/hooks 不確定的功能跳過或手動執行。

### 3.3 Antigravity 🟢（**已實機驗證 2026-05-02**）

**已實測**。完整實機回報：Node v24.13 / Python 3.12.13 / mempalace 3.3.3 全達標。

| 限制                                 | 影響                                                         | Workaround / 實機狀態                                                                      |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| MCP 註冊**不用 `.mcp.json`**         | Antigravity 自有 MCP 註冊機制（IDE Settings）                | 不影響功能；改在 IDE Settings 加 mempalace server                                          |
| `.claude/settings.local.json` 不被讀 | Claude Code 風格 hook 失效                                   | 手動跑 `mempalace mine` 或 git post-commit hook                                            |
| **Sub-agent 僅 browser_subagent**    | @Auditor 5 並行 / @Retro 多情境 simulation 不可並行          | 改串行（5x 慢；功能等價）；或大型 audit 改用 Claude CLI 跑                                 |
| 工具命名完全不同                     | Read→view_file / Write→write_to_file / Bash→run_command / 等 | LLM 自動 mapping；framework 文字描述需 mental translation（見 INSTALL_ANTIGRAVITY.md §三） |
| `mempalace status` CLI 報失敗        | 實際 MCP 路徑可用                                            | 走 `mcp_mempalace_*` 工具；忽略 CLI 失敗                                                   |

**部署建議**：依 `INSTALL_ANTIGRAVITY.md`；可跑日常開發任務；大規模並行 audit 推薦另環境執行。

### 3.4 自建 Qwen Agent 🟡（**2026-05-04 修正：MCP 可用**）

| 落差                                                           | 投入                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Sub-agent dispatch 完全自實作（或走 serial mode；推薦 serial） | 0h（serial 通用）/ 6-10h（parallel 實作）                        |
| MCP 整合：**Qwen-Agent 框架支援 MCP**（User 實證 2026-05-04）  | 0h（直接使用）；adapter 詳 `tasks/harness-adapter-pattern.md §B` |
| Hook 系統自實作（或走 git pre-commit hook）                    | 0-2h（git hook）/ 2-4h（自實作 LLM-side hook）                   |
| Discussion vs Execution mode 完全靠 prompt engineering         | 2-4h（system prompt 調優）                                       |
| Persona drift 重測（Qwen vs Claude baseline 不同）             | 2-4h                                                             |
| Tool 命名 + payload 對齊                                       | 2-4h                                                             |

**Persona stability 警告**：Qwen 模型 drift_score 可能 < Claude baseline 0.883；需重跑 `agent-drift-simulator` 評估，drift_score < 0.70 時 framework 部分 rule 自評可能失準。

**部署建議**：直接使用 Qwen-Agent MCP 機制接 mempalace；sub-agent 走 serial mode（PROPOSAL_502_021 Sprint A 後 default）；hooks 走 git pre-commit；最低工時 ~6-10h（drift 重測 + tool naming + prompt engineering；MCP / sub-agent / hooks 全可用 baseline）。

---

## 四、移植到非 Claude Code 環境的指引

### 4.1 不變的核心（任何 harness 都能用）

- `.agents/rules/*.md` + `.agents/iron-rules/*.md`：純 markdown 規則
- `.agents/decisions/*.md`：39 ADRs（Markdown）
- `.agents/skills/*.md`：64+ skills（Markdown）
- `.agents/tasks/*.md`：14+ workflow SOP（Markdown）
- `.agents/tests/*.mjs / *.sh`：純 Node + Bash validators
- mempalace CLI（獨立套件；不綁 LLM）

### 4.2 需 adapter 的層

詳見 `.agents/tasks/harness-adapter-pattern.md`（T-2 同 sprint 建立）。4 個 adapter 點：

1. Sub-agent dispatch（Task tool 抽象）
2. MCP integration（或 fallback 至 mempalace CLI 直呼）
3. Hooks（post-commit / patrol）
4. 工具命名（Read/Write/Edit/Bash protocol）

### 4.3 移植自評流程

部署到非 Claude Code 環境後，**必須**執行：

```bash
# 1. 跑 platform detect（PROPOSAL_502_019 T-3）
python3 .agents/scripts/platform-detect.py
# 輸出：harness / capabilities / fallbacks / warnings

# 2. 跑 14/15 validators（純 Node + Bash；任何 harness 都能跑）
python3 .agents/tests/run-all.py

# 3. 重測 drift_score baseline（每 harness baseline 不同）
python3 .agents/tests/agent-drift-simulator.py

# 4. 執行 27 情境簡化版（cold start + hello-world dispatch）驗證行為層
# （參考 INSTALL.md §七 hello world test）
```

---

## 五、未來擴充方向（不在本提案）

- 若 User 確定要部署多 harness → 立 PROPOSAL_502_NNN 做：
  - 真實 adapter 實作（依 T-2 設計指南）
  - Web mode 完整 fallback wiring
  - 各 harness drift baseline 校準
  - cross-harness CI 測試矩陣

- Per-harness `.agents/<harness>/` overlay 目錄（如 `.agents/web/`、`.agents/qwen/`）
- 共享 `rules/` / `iron-rules/` 不變；各 harness 客製 `scripts/` / `tests/`

---

## 六、聯絡與回報

部署到非 Claude Code 環境遇問題：

- 先跑 `platform-detect.mjs` 看 capability 報告
- 對照本文件 §三 已知限制
- 仍無法解 → 自己派 @Retro 立 RULE_UPDATE_PROPOSAL

---

## Related Decisions

- [ADR-0034](../decisions/0034-langgraph-dual-env-integration.md) — LangGraph + MCP 雙環境（已預想 multi-harness）
- [ADR-0039](../decisions/0039-mempalace-memory-backend.md) — Memory Palace（hybrid fallback；MCP-down 時 markdown 補位）
