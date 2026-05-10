# 部署到 Antigravity 操作手冊

> 基於 2026-05-02 實機回報撰寫（Node v24.13 / Python 3.12.13 / mempalace 3.3.3）。
> 對偶：`.agents/INSTALL.md`（Claude Code CLI 主指南）；本檔為 Antigravity 特化補強。

---

## 一、實機驗證結果摘要

| 項                             | 狀態                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- |
| Runtime（Node / Python / git） | ✅ 完整                                                                   |
| mempalace CLI                  | ✅ 可用                                                                   |
| **mempalace MCP**（透過 IDE）  | ✅ **可用**（不是 `.mcp.json` 註冊；Antigravity 自有機制）                |
| `.mcp.json`                    | ❌ 不被讀；非 Antigravity 標準                                            |
| `.claude/settings.local.json`  | ❌ 不被讀；非 Antigravity 標準                                            |
| **Sub-agent dispatch**         | ❌ **僅 1 個內建 `browser_subagent`**（用於網頁互動；非 general-purpose） |
| 工具命名                       | 🔄 完全不同（見 §三 mapping table）                                       |

**結論**：Antigravity 可作為 framework 的**單線 IDE 環境**；但**多並行 sub-agent dispatch 不可用**（影響 audit / 大規模 scenario simulation）。

---

## 二、Phase 0~6 部署步驟（Antigravity 版）

### Phase 0 環境準備

依 `INSTALL.md §一` 跑檢查；Antigravity 內建 Node v24+ / Python 3.12+ 通常齊全。

### Phase 1 部署 `.agents/`

依 `INSTALL.md §二` 任一方式（git clone / submodule / fresh）皆可。

### Phase 2 MemPalace 安裝（v2 Plan G）

```bash
pip install mempalace>=3.3.4   # 或 ≥3.3.3 也可用（實機驗證）
mempalace init                 # 在 ~/.mempalace 建資料庫
mempalace mine .agents/memory/.export/   # v2：來源從 .export/（每 drawer 一檔）
```

> v2 後寫入路徑：rules 直呼 `mcp__mempalace__add_drawer`（單寫；無雙寫）。
> 每次 commit 前跑 `python3 .agents/scripts/mempalace-export.py` 同步 `.export/` → 確保 zip 帶走。

### Phase 3 MCP 設定（**與 Claude Code 不同**）

**❌ 不要建 `.mcp.json`**（Antigravity 不讀）。

✅ 改用 Antigravity IDE 內建的 MCP 註冊機制：

1. 開 Antigravity IDE Settings / MCP servers
2. 加 mempalace server（指向 `mempalace-mcp` 命令）
3. 重啟 IDE 載入

驗證 MCP 可用：在對話內請 IDE 呼叫 `mcp_mempalace_mempalace_status`，應回傳當前 drawer count。

> **若 Antigravity 設定方式不同**：請參考其官方 MCP 文件；本框架只要求 `mcp_mempalace_*` 系列工具可達即可。

### Phase 4 First workspace

```bash
python3 .agents/scripts/init-workspace.py --name <ws_name>
```

互動模式應可走（Antigravity terminal 通常支援 stdin）。如不行 → 用 `--config <yaml>` 非互動模式。

### Phase 5 First validation

```bash
python3 .agents/tests/run-all.py   # 15 validators 全綠期望
python3 .agents/tests/agent-drift-simulator.py   # drift_score ≥ 0.85 期望
python3 .agents/scripts/platform-detect.py       # 應顯 'antigravity' 或 'antigravity_or_custom'
```

### Phase 6 Hello world test

對 IDE 說：

```
請執行 cold start checklist 並摘要當前 framework 狀態給我看。
```

@Lead 應走 `tasks/session-start-checklist.md` 5 步。**注意**：不能派 sub-agent 並行掃描；@Lead 在同一對話內依序處理。

---

## 三、工具命名對照表（**重要**）

Framework rules 中提到 Claude Code 工具名（Read / Write / Edit / Bash 等）；Antigravity 對應命名不同。LLM 跑時自動 mapping，但你**修 framework 文件**時要知道對照。

| 用途           | Claude Code        | Antigravity                  |
| -------------- | ------------------ | ---------------------------- |
| 讀檔           | `Read`             | `view_file`                  |
| 列目錄         | `LS`               | `list_dir`                   |
| 全文搜尋       | `Grep`             | `grep_search`                |
| 寫新檔         | `Write`            | `write_to_file`              |
| 改單區塊       | `Edit`             | `replace_file_content`       |
| 改多區塊       | (Edit replace_all) | `multi_replace_file_content` |
| 執行命令       | `Bash`             | `run_command`                |
| 查 bg 執行進度 | (none)             | `command_status`             |
| 對互動式輸入   | (none)             | `send_command_input`         |
| 網路搜尋       | `WebSearch`        | `search_web`                 |
| 抓網頁         | `WebFetch`         | `read_url_content`           |
| 生成圖片       | (none)             | `generate_image`             |

> **影響**：framework 內 hardcoded 工具名（如 `Bash tool`）對 LLM 是 transparent（會自動 mapping）；但你看 rule 文件描述時心理需做 translation。

---

## 四、Sub-agent 限制 + Workaround（**核心限制**）

### 限制

Antigravity 內建只有 `browser_subagent`（網頁互動專用）；**沒有** `general-purpose` / `Explore` / `Plan` 風格的 sub-agent。

這影響 framework 以下功能：

- `@Auditor` 5 並行 Explore subagents（5 維度評分）
- `@Retro` periodic design review（2-4 並行 audit）
- 27 情境模擬（多並行 subagent）
- Hotfix 診斷組（@Backend + @Reviewer 雙簽）

### Workaround：在同一對話內串行處理

修改 framework 行為：將「派 N 個 subagent 並行」改為「@Lead 在同一對話內串行做 N 個 task」。

#### A. @Auditor 評分流程（修改）

原：

```
@Auditor 派 5 並行 Explore subagents → 5 份 JSON → 整合
```

Antigravity 版：

```
@Lead 在同一對話內串行做：
  1. 拉 dimension 1 → @Auditor prompt → 等 LLM 回 JSON
  2. 拉 dimension 2 → 同上
  ...
  5. 拉 dimension 5 → 同上
最後 @Auditor 整合 5 份為 AUDIT_REPORT
```

效率：5x 慢；但功能等價。

#### B. 27 情境模擬（修改）

原：6 並行 subagent / 每 agent 5 scenarios。
Antigravity 版：1 個 LLM 對話內 27 scenarios 串行。可能要分多次對話。

#### C. Hotfix 診斷雙簽（簡化）

原：@Backend + @Reviewer 平行雙簽。
Antigravity 版：@Lead 先請 @Backend 出診斷；再請 @Reviewer 在同對話複核；只有一個 LLM 但兩種視角。

#### D. 暫時迴避作法

執行 audit / 大型 scenario simulation 時，**改用 Claude Code CLI** 跑（如有 access）；用 Antigravity 跑日常開發任務。

---

## 五、現有部署的 platform-detect 偵測結果解讀

實機輸出：

```
Harness: unknown (low confidence)
mempalace.Status OK: ❌
fs_writable: false
```

**正確解讀**：

- `Status OK: ❌` → 不代表 mempalace 不可用；**只是 CLI 路徑不通**（sandbox 限制）。Antigravity 用 MCP 路徑就 OK。
- `fs_writable: false` → 之前 detect script bug（已修；下次 pull 後正確）。
- `Harness: unknown` → 已修；新版會偵 `env_antigravity` 或 `env_qwen_agent` env vars；如 IDE 沒設這些 env vars，會 fall to `antigravity_or_custom`（中信心）。

更新後預期輸出：

```
Harness: antigravity (high confidence)  ← 若 IDE 設 ANTIGRAVITY env var
或
Harness: antigravity_or_custom (medium confidence)  ← 若沒 env var 但 mempalace 全 OK + .mcp.json 不存在
```

---

## 六、Troubleshooting

### 6.1 `mempalace status` CLI 失敗 但 IDE MCP 可用

正常。Antigravity sandbox 可能限 CLI 直呼；走 IDE 的 `mcp_mempalace_*` 工具系列即可。`memory-palace-validator.py` 偵測 CLI 不通會報 ❌；可忽略（MCP 路徑等同）。

### 6.2 Sub-agent 並行任務卡住

不可用；改成串行或用其他環境（CLI）跑。

### 6.3 `.claude/settings.local.json` hook 不觸發

正常。Antigravity 不讀此檔。

**v2 Plan G 替代方案**：

- 寫入：rules 直呼 `mcp__mempalace__add_drawer`（在對話內 LLM 直接呼叫；不依賴 hook）
- Cold export：建議在 git pre-commit hook（`.git/hooks/pre-commit`）跑 `python3 .agents/scripts/mempalace-export.py`，並 `git add .agents/memory/.export/`；確保每 commit 帶最新 cold backup
- v1 的 `mempalace mine` 在 v2 後僅 cold-start 重建用（從 `.export/`）；不再頻繁觸發

### 6.4 init-workspace.py 互動模式卡住

sandbox 終端機可能無 tty。改用：

```bash
python3 .agents/scripts/init-workspace.py --name <ws> --config /path/to/config.yaml
```

或在 Antigravity 對話內直接生成 workspace 檔（@Lead 走 `project-onboarding-workflow.md` 軌道 A AI 對話引導）。

---

## 七、實機回報缺漏待補

依本次回報目前未確認：

- [ ] `mempalace init` 完成後 IDE 報告 status OK；CLI status fail；**是否影響 daily workflow**（需實際派任務驗）
- [ ] Antigravity sub-agent dispatch 是否能透過自定 MCP server 補齊（如 spawn LLM child process 機制）
- [ ] `.mcp.json` 不被讀的具體機制（IDE setting only？或讀其他位置？）
- [ ] git push 後 Antigravity workspace 持久性（session 結束後檔案是否保留）

User 跑日常任務遇問題時可補回報；本指南會持續更新。

---

## 八、Related Documents

- `.agents/INSTALL.md`：CLI 主指南
- `.agents/docs/PLATFORM_COMPATIBILITY.md`：4 harness 對照表
- `.agents/tasks/harness-adapter-pattern.md`：adapter 設計指南（如要寫 sub-agent dispatch adapter）
- `.agents/scripts/platform-detect.py`：自動偵測

---

## 九、總結：Antigravity 部署判定

**✅ 可日常開發使用**（單線串行 LLM 任務）：實作 / 修 bug / 文件 / Discussion 全 OK。

**🔴 不可用功能**：

- @Auditor 5 並行評分（改串行可走但效率 5x）
- @Retro 大規模 design review（同上）
- 多情境 simulation（改串行可走）
- 並行 hotfix 診斷雙簽（改串行可走但同 LLM 視角）

**🟡 限制功能**：

- post-commit auto-mine 需手動觸發
- `mempalace status` CLI 不通；但 MCP 等價可用

**部署成功判定**：跑 `python3 .agents/scripts/platform-detect.py` 顯 `antigravity` + `python3 .agents/tests/run-all.py` 全綠 + IDE 對話跑 cold start checklist 走完 5 步。
