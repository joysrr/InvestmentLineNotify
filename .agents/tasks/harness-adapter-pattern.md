---
task_id: harness-adapter-pattern
file_type: workflow
owner: "@Architect"
version: v1.0
last_modified: 2026-05-02
last_proposal: PROPOSAL_20260502_019
purpose: |
  非 Claude Code harness（Antigravity / Qwen-Agent / web-only / 其他）部署本框架時的
  adapter layer 設計指南。4 個 adapter 切入點 + 介面抽象 + 範例。
referenced_by:
  - docs/PLATFORM_COMPATIBILITY.md
  - tasks/existing-project-import-workflow.md
related_decisions:
  - ADR-0034 # LangGraph + MCP 雙環境（multi-harness 設計依據）
  - ADR-0039 # Memory Palace hybrid fallback（adapter 範例）
---

# Task: Harness Adapter Pattern（非 Claude Code 移植指南）

> PROPOSAL_502_019 T-2 建立。
> 對偶：`docs/PLATFORM_COMPATIBILITY.md`（哪些 harness × 哪些 feature）

---

## 一、Adapter 設計原則

### 1.1 不變層（adapter 不可動）

- `.agents/rules/*.md` + `.agents/iron-rules/*.md`
- `.agents/decisions/*.md`
- `.agents/skills/*.md`
- `.agents/tasks/*.md`
- `.agents/tests/*.mjs|*.sh`（驗證邏輯）
- mempalace CLI（獨立套件）

### 1.2 可變層（adapter 介入）

| 點  | 描述                                                 |
| --- | ---------------------------------------------------- |
| A   | Sub-agent dispatch 機制（Task tool 抽象）            |
| B   | MCP integration（或 fallback 至 mempalace CLI 直呼） |
| C   | Hooks（post-commit / Claude Code PostToolUse）       |
| D   | 工具命名 + payload protocol（Read/Write/Edit/Bash）  |

### 1.3 adapter 不應違反的 invariants

- **Iron-themes 不可動**（ADR-0037）
- **rules 修改唯一三情境**（PROPOSAL_ADOPT / Hotfix / 自動產出；lead.md §s10）
- **drift_score baseline** 每 harness 重測；不可沿用 Claude baseline
- **15 validators 全綠** 為 adapter 完成判定線
- **27 情境 hello-world** 為行為層驗證線

---

## 二、4 個 adapter 切入點

### A. Sub-agent dispatch

**Claude Code 行為**：

```
@Lead 寫 ROUTING_TICKET.md → 呼叫 Task tool（subagent_type=Explore|general-purpose|...）
sub-agent 接 prompt 執行 → 回 string result
@Lead 收 result → 寫回 PENDING_ACTIONS / ROUTING_TICKET status: completed
```

**Adapter interface**（pseudo-spec）：

```typescript
interface SubAgentDispatcher {
  dispatch(opts: {
    description: string;
    prompt: string;
    subagent_type: "general" | "explore" | "plan" | string;
    timeout_ms?: number; // 對齊 P-27 SUBAGENT_TIMEOUT
  }): Promise<{
    result: string; // 純文字回報
    status: "completed" | "timeout" | "failed";
    duration_ms: number;
  }>;
}
```

**移植範例**：

- Claude Code：使用 native Task tool
- Antigravity：mapping 至其 sub-agent API（介面可能類似但命名不同）
- Qwen-Agent：用 Qwen-Agent 框架的 multi-agent class；自行實作 timeout
- Plain LLM API（無 sub-agent）：fallback 至同 session 多輪 prompt（持續性差；不推薦）

### B. MCP integration

**Claude Code 行為**：

```
.mcp.json 註冊 mempalace-mcp server
MCP tools 自動以 mcp__mempalace__* prefix 出現
@Lead 透過 MCP tool（mempalace_search / wake_up / etc）呼叫
```

**Adapter interface**：

```typescript
interface MempalaceClient {
  search(
    query: string,
    opts?: { results?: number; wing?: string; room?: string },
  ): Promise<Drawer[]>;
  wakeUp(): Promise<{ contextText: string; tokenEstimate: number }>;
  status(): Promise<{ drawerCount: number; rooms: string[]; healthy: boolean }>;
  mine(path: string): Promise<{ minedFiles: number }>;
}
```

**Implementation 兩條路**：

- **路徑 1（MCP）**：寫 MCP client（如果 harness 支援 Anthropic MCP 標準）
- **路徑 2（CLI）**：直呼 `mempalace search/wake-up/status` CLI（更通用；任何 harness 都能跑 shell）

**Default fallback**：MCP unreachable → 自動切 CLI 路徑（已於 ADR-0039 hybrid fallback 預想）。

### C. Hooks

**Claude Code 行為**：

- `.claude/settings.local.json` PostToolUse hook → `mempalace-auto-mine.sh`
- post-commit hook（git）→ 同腳本

**Adapter interface**：

```typescript
interface HookRegistry {
  register(
    event: "post-commit" | "pre-commit" | "post-tool-use",
    script: string,
  ): void;
  unregister(event: string, script: string): void;
}
```

**Implementation**：

- Claude Code：寫 `.claude/settings.local.json`
- Antigravity：寫對應 hook 設定（API 命名可能不同）
- Qwen-Agent：自實作 event listener；wrap 周邊呼叫
- 無 hook 環境：手動觸發（每 commit 後派 @Assistant 巡邏 + 手動跑 `mempalace mine`）

### D. 工具命名 + payload protocol

**Claude Code（Anthropic protocol）**：

```
Read(file_path: string) -> { content: string }
Write(file_path: string, content: string) -> void
Edit(file_path: string, old_string: string, new_string: string) -> void
Bash(command: string, timeout?: number) -> { stdout: string, stderr: string, exit_code: number }
```

**Adapter interface**：

```typescript
interface FileTools {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  edit(path: string, oldStr: string, newStr: string): Promise<void>;
  bash(
    cmd: string,
    timeoutSec?: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}
```

**Implementation**：

- Claude Code：直接用 native tools
- Antigravity：可能叫 `read_file` / `write_file` / `execute_command` 等；wrap 一層
- Qwen-Agent：用其 `code_interpreter` / `file_io` 工具；自包裝
- 無 file system：純 in-memory（極限環境；不推薦）

---

## 三、Qwen-Agent adapter 概念實作（範例）

```python
# .agents/scripts/adapters/qwen_adapter.py（虛擬範例；非本提案實作）

from qwen_agent.agents import Assistant
from qwen_agent.tools.base import BaseTool
import subprocess
import json

class MempalaceCLIWrapper(BaseTool):
    """mempalace CLI 包裝為 Qwen-Agent tool"""
    name = "mempalace_search"
    description = "Search Memory Palace drawers"

    def call(self, query: str, results: int = 5):
        out = subprocess.run(
            ["mempalace", "search", query, "--results", str(results)],
            capture_output=True, text=True
        )
        return out.stdout

class FrameworkOrchestrator(Assistant):
    """13-Agent multi-agent framework 在 Qwen-Agent 的 adapter"""

    def __init__(self):
        # 讀 .agents/rules/lead.md 作為 system prompt
        with open(".agents/rules/lead.md") as f:
            system_prompt = f.read()
        super().__init__(system_prompt=system_prompt)
        self.tools = [MempalaceCLIWrapper(), ...]

    def dispatch_subagent(self, target_agent: str, ticket: dict):
        """Sub-agent dispatch；對應 ROUTING_TICKET 機制"""
        agent_rule = open(f".agents/rules/{target_agent}.md").read()
        sub = Assistant(system_prompt=agent_rule, tools=self.tools)
        return sub.run(messages=[{'role': 'user', 'content': json.dumps(ticket)}])
```

> ⚠️ 上述為**概念示範**，非可執行；真實移植需處理：context window / tool availability / state persistence / drift baseline 重測 等。

---

## 四、Adapter 完成判定（DoD）

新 harness adapter 完成必過以下：

- [ ] `node .agents/scripts/platform-detect.mjs` 偵測為新 harness + 列出可用 capability
- [ ] `bash .agents/tests/run-all.sh`：15 validators 全綠（純 Node + Bash；不依 harness）
- [ ] `node .agents/tests/agent-drift-simulator.mjs`：drift_score ≥ 0.85 PASS（**該 harness baseline**；非 Claude baseline 套用）
- [ ] 27 情境（依 PROPOSAL_502_009 / 502_013 / 502_018 重驗紀錄）至少跑：
  - S1 Cold Start
  - S4 新功能開發 hello-world
  - S15 MCP unreachable fallback
  - S18 sub-agent timeout
- [ ] PENDING_ACTIONS / ROUTING_TICKET 跨 session 持久化驗證
- [ ] AUDIT_HISTORY.md append 該 harness baseline
- [ ] `docs/PLATFORM_COMPATIBILITY.md` 對應 row 從 🟡 → ✅

---

## 五、禁止行為

- **絕對禁止** adapter 修改 `rules/*.md` / `iron-rules/*.md` / `decisions/*.md`（adapter 只接外圍；不動核心）
- **絕對禁止** 跳過 drift baseline 重測（直接套用 Claude baseline 風險高）
- **絕對禁止** 跳 27 情境簡化驗證（單 validator 綠不代表行為層 OK）
- **絕對禁止** 在 adapter 內 hardcode harness 命名（用 platform-detect 結果動態 dispatch）

---

## 六、Related Decisions

- [ADR-0034](../decisions/0034-langgraph-dual-env-integration.md) — LangGraph + MCP 雙環境
- [ADR-0039](../decisions/0039-mempalace-memory-backend.md) — MemPalace hybrid fallback（adapter 範例）
- [ADR-0001](../decisions/0001-stateless-lead-routing.md) — Stateless Routing（adapter 不可違反）
