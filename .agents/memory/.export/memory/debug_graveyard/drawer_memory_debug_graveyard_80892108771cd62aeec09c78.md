---
drawer_id: drawer_memory_debug_graveyard_80892108771cd62aeec09c78
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.057Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

# Framework Debug Graveyard INDEX

跨專案通用的踩坑紀錄；專案特有的請寫進 `workspaces/<ws>/memory/debug_graveyard/`。

對齊 `skills/memory-palace-schema.md` Room 3 規範。

## 條目（依日期倒序）

| ID              | 日期       | Category      | Severity | 一句話                                                         | 條目                                    |
| --------------- | ---------- | ------------- | -------- | -------------------------------------------------------------- | --------------------------------------- |
| DG-20260427-002 | 2026-04-27 | concurrency   | major    | progress.py module-level 全域 race condition                   | DG-20260427-002-progress-globalstate.md |
| DG-20260427-001 | 2026-04-27 | serialization | critical | LangGraph state 含 RequestContext 爆 msgpack                   | DG-20260427-001-msgpack-state.md        |
| DG-20260426-001 | 2026-04-26 | lib_compat    | major    | Qwen3 reasoning model 開 thinking 但 max_tokens 不足→ 0 字回應 | DG-20260426-001-qwen3-thinking-empty.md |
