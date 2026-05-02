---
room: debug_graveyard
incident_id: DG-20260427-002
date: 2026-04-27
category: concurrency
severity: major
agents_involved: [@Backend]
related_proposal: PROPOSAL_20260425_002
related_files:
  - poc/langgraph-mcp/progress.py
fix_commit: 40b3058
---

# progress.py module-level 全域 state 在並發 MCP call 互踩

## 症狀

- 修完 DG-20260427-001 後，`progress.py` 用 module-level `_session` / `_loop` 暫存 RequestContext
- 單一 tool call 沒問題；但若 MCP server 同時處理多個 tool call（Antigravity 並發呼叫）
- 後者 `set_mcp_context(...)` 覆蓋前者的全域變數
- → 前一個 task 寫 log 時送到後者的 session（log 通知串接錯）

## 根因

- Python module 級變數是「全 process 共用」
- async tool handler 雖各自有 task context，但 module 變數不隨 task 切換
- `asyncio.run_coroutine_threadsafe` 用的是被覆寫後的 `_loop` → 通知到錯誤目的地

## 解法

改用 `contextvars.ContextVar`：

```python
_runtime: ContextVar[Optional[_MCPRuntime]] = ContextVar("mcp_runtime", default=None)

def set_mcp_context(session, loop, request_context=None) -> Token:
    return _runtime.set(_MCPRuntime(session, loop, request_context))

def reset_mcp_context(token: Token) -> None:
    _runtime.reset(token)
```

ContextVar 自動隨 async task 切換 context；並發 task 各自獨立讀寫。

## 教訓（避免再犯）

- ❌ **不要**用 module-level mutable 全域變數承載 per-request runtime state
- ❌ 即使「目前只會單 request」也別這樣做（等出 bug 再改成本高）
- ✅ async / per-request runtime 用 `contextvars.ContextVar`
- ✅ 同步多執行緒用 `threading.local`
- ✅ frozen dataclass 包裝避免被誤改（`@dataclass(frozen=True)`）

## 相似 pattern 警示

- Logging 的 logger 物件可以 module-level（無 per-request state）
- DB connection pool 可以 module-level（pool 自己管 connection 切換）
- 但 current request_id / current user / current session **不要** module-level

<!-- END: DG-20260427-002 -->
