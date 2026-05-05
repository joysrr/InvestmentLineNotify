---
drawer_id: drawer_memory_debug_graveyard_6a352f10d27d86300c90e4d0
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.055Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

同步多執行緒用 `threading.local`

- ✅ frozen dataclass 包裝避免被誤改（`@dataclass(frozen=True)`）

## 相似 pattern 警示

- Logging 的 logger 物件可以 module-level（無 per-request state）
- DB connection pool 可以 module-level（pool 自己管 connection 切換）
- 但 current request_id / current user / current session **不要** module-level

<!-- END: DG-20260427-002 -->
