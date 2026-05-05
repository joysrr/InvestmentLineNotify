---
drawer_id: drawer_memory_debug_graveyard_1736b0b71fa40f1fd90753c5
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:02:59.949Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

---

room: debug_graveyard
incident_id: DG-20260426-002
date: 2026-04-26
category: api_limit
severity: major
agents_involved: [@Backend]
related_proposal: PROPOSAL_20260425_002
related_files:

- poc/langgraph-mcp/state.py
- poc/langgraph-mcp/graph.py
  fix_commit: d2c1870

---

# LangGraph TypedDict total=False 仍會過濾未宣告欄位

## 症狀

- POC 加了 `review_quality_violation: bool` flag 想讓 reviewer 達 limit 後跳出
- node 回傳的 dict 含 `{"review_quality_violation": True, ...}`
- conditional edge 函式 `route_after_reviewer` 讀 `state.get("review_quality_violation")` → 永遠是 None
- → reviewer 永遠進入 backend 重做迴圈（cycle 上限失效）
- 同樣 bug：`prior_art_scan_triggered`（HITL 不觸發）、`dim_1_avg`~`dim_5_avg`（auditor 5 並行 aggregate 抓不到）

## 根因
