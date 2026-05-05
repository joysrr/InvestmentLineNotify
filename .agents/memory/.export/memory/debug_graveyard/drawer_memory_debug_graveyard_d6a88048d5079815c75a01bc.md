---
drawer_id: drawer_memory_debug_graveyard_d6a88048d5079815c75a01bc
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.052Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

ontext，但 module 變數不隨 task 切換

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
