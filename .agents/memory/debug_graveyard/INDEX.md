# Framework Debug Graveyard INDEX

跨專案通用的踩坑紀錄；專案特有的請寫進 `workspaces/<ws>/memory/debug_graveyard/`。

對齊 `skills/memory-palace-schema.md` Room 3 規範。

## 條目（依日期倒序）

| ID              | 日期       | Category      | Severity | 一句話                                                         | 條目                                          |
| --------------- | ---------- | ------------- | -------- | -------------------------------------------------------------- | --------------------------------------------- |
| DG-20260427-002 | 2026-04-27 | concurrency   | major    | progress.py module-level 全域 race condition                   | DG-20260427-002-progress-globalstate.md       |
| DG-20260427-001 | 2026-04-27 | serialization | critical | LangGraph state 含 RequestContext 爆 msgpack                   | DG-20260427-001-msgpack-state.md              |
| DG-20260426-001 | 2026-04-26 | lib_compat    | major    | Qwen3 reasoning model 開 thinking 但 max_tokens 不足→ 0 字回應 | DG-20260426-001-qwen3-thinking-empty.md       |
| DG-20260426-002 | 2026-04-26 | api_limit     | major    | LangGraph TypedDict total=False 仍會過濾未宣告欄位             | DG-20260426-002-langgraph-typeddict-filter.md |

## 類別統計

| Category      | 條目數 |
| ------------- | -----: |
| serialization |      1 |
| concurrency   |      1 |
| lib_compat    |      1 |
| api_limit     |      1 |

<!-- END: framework debug graveyard index -->
