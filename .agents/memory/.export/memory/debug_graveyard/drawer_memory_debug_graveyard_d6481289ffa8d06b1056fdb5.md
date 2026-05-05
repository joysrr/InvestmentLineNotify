---
drawer_id: drawer_memory_debug_graveyard_d6481289ffa8d06b1056fdb5
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.030Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

---

room: debug_graveyard
incident_id: DG-20260426-001
date: 2026-04-26
category: lib_compat
severity: major
agents_involved: [@Backend]
related_proposal: PROPOSAL_20260425_002
related_files:

- poc/langgraph-mcp/llm_factory.py
- poc/langgraph-mcp/tests/debug_qwen_raw.py
  fix_commit: 1fb3cc5

---

# Qwen3 reasoning model 開 thinking 但 max_tokens 不足 → content 為空

## 症狀

- POC 用 Qwen3.5-122B-A10B 跑 workflow
- 多個 node（reviewer / consultant / retro 等）回傳 `content = ""`
- `finish_reason = "length"`、`token_usage` 顯示用了 4000+ tokens
- 但 LLM 回應的可見內容是空字串
- → 下游 parser 抓不到值 → reviewer 進死循環、retro 不寫提案、HITL 不觸發

## 根因
