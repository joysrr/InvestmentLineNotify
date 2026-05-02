# Platform Compatibility（多 harness 支援度對照）

> **文件分層**：framework（跨專案通用 framework 文件；對齊 ADR-0017 文件分層三原則）
>
> 由 PROPOSAL_502_019 T-1 建立。
> 本文件公布框架在 4 種 agent harness 的支援度 + 已知限制 + 移植路徑。

---

## 一、支援度總表

| Harness                               | 整體支援度 | primary use case                          | 移植工時                       |
| ------------------------------------- | ---------- | ----------------------------------------- | ------------------------------ |
| **Claude Code CLI**                   | ✅ 100%    | 本框架原生環境                            | 0（直接照 INSTALL.md）         |
| **Claude Code Web**（claude.ai/code） | 🟡 70-80%  | sandbox 受限；部分功能需 git 同步補位     | 1-2h（hooks/MCP 確認）         |
| **Antigravity**（Google）             | 🟡 60-70%  | 需驗證 MCP 標準；可能需 sub-agent adapter | 4-8h（驗證 + adapter）         |
| **自建 Qwen Agent**                   | 🟡 50-60%  | adapter layer 重大；persona drift 風險    | 20-40h（adapter + drift 重測） |

---

## 二、12 capability dimensions × 4 harness

| Capability                                           | Claude Code CLI     | Claude Code Web                             | Antigravity                  | Qwen Agent                 |
| ---------------------------------------------------- | ------------------- | ------------------------------------------- | ---------------------------- | -------------------------- |
| Markdown rules 讀取                                  | ✅                  | ✅                                          | ✅                           | ✅                         |
| Read/Write/Edit tools                                | ✅                  | ✅                                          | 🟡 命名可能不同              | 🟡 需 adapter              |
| Bash tool                                            | ✅                  | ✅                                          | 🟡 sandbox 限制              | 🟡 需 shell access         |
| Sub-agent dispatch（Task）                           | ✅                  | ✅                                          | 🟡 機制可能不同              | 🔴 需重寫                  |
| MCP server（`.mcp.json`）                            | ✅                  | 🟡 web 載入待證                             | 🟡 是否採 Anthropic MCP 標準 | 🔴 通常無 MCP；需 CLI 直呼 |
| `settings.local.json` hooks                          | ✅                  | 🟡 sandbox 環境不同                         | 🔴 不同 hook 系統            | 🔴 需自實作                |
| Discussion vs Execution mode                         | ✅（system-prompt） | ✅                                          | 🟡 mode 概念可能不同         | 🟡 需 prompt engineering   |
| 持久 file system                                     | ✅                  | 🟡 sandbox session-bounded（git push 補位） | 🟡 視 sandbox                | 🟡 視部署                  |
| 跨 session state（PENDING_ACTIONS / ROUTING_TICKET） | ✅                  | 🟡 + git push 後可恢復                      | 🟡 視 session model          | 🟡 需 implementation       |
| mempalace CLI 存取                                   | ✅                  | 🟡 視 sandbox 含 Python/pip                 | 🟡 視 sandbox                | 🟡 sandbox decide          |
| Workflow stages（10 階段）                           | ✅                  | ✅                                          | ✅（Markdown 層）            | 🟡 + prompt 強化           |
| Iron-themes immutability                             | ✅                  | ✅                                          | ✅                           | ✅                         |

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

### 3.3 Antigravity 🟡

**未實測**。基於公開資訊推論：

| 限制                            | 影響                                  | Workaround                                                |
| ------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| MCP 標準是否相容 Anthropic MCP  | mempalace MCP 可能無法 plug-and-play  | 改用 mempalace CLI 直呼（不依賴 MCP）                     |
| Sub-agent dispatch 機制可能不同 | Task tool API 名稱 / payload 可能不同 | 寫 dispatch adapter（見 §四 T-2 harness-adapter-pattern） |
| Hook 系統可能不同               | post-commit / patrol 自動化失效       | 替代 hook 或手動觸發                                      |
| 工具命名差異                    | Read/Write/Edit/Bash 可能叫別的       | adapter 抽象工具呼叫                                      |

**部署建議**：先小範圍 dogfooding（cold start + 簡單任務）；驗證後再決投入 adapter 開發。

### 3.4 自建 Qwen Agent 🟡

| 落差                                                   | 投入                                   |
| ------------------------------------------------------ | -------------------------------------- |
| Sub-agent dispatch 完全自實作                          | 6-10h                                  |
| MCP 整合：要嘛實 MCP client，要嘛改用 CLI 直呼         | 4-6h（CLI 路線）/ 10-15h（MCP client） |
| Hook 系統自實作                                        | 2-4h                                   |
| Discussion vs Execution mode 完全靠 prompt engineering | 2-4h（system prompt 調優）             |
| Persona drift 重測（Qwen vs Claude baseline 不同）     | 2-4h                                   |
| Tool 命名 + payload 對齊                               | 2-4h                                   |

**Persona stability 警告**：Qwen 模型 drift_score 可能 < Claude baseline 0.883；需重跑 `agent-drift-simulator` 評估，drift_score < 0.70 時 framework 部分 rule 自評可能失準。

**部署建議**：先確認 Qwen-Agent 框架的 sub-agent + tool 機制；寫 adapter 層；完成後重測 drift baseline + 27 情境模擬。

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
node .agents/scripts/platform-detect.mjs
# 輸出：harness / capabilities / fallbacks / warnings

# 2. 跑 14/15 validators（純 Node + Bash；任何 harness 都能跑）
bash .agents/tests/run-all.sh

# 3. 重測 drift_score baseline（每 harness baseline 不同）
node .agents/tests/agent-drift-simulator.mjs

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
