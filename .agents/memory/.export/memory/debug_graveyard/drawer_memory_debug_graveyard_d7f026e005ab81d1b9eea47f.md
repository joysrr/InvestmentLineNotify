---
drawer_id: drawer_memory_debug_graveyard_d7f026e005ab81d1b9eea47f
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.048Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

- ✅ 用真實 OpenAI client 直接打 API（`tests/debug_qwen_raw.py`）測試各種 thinking 開關以確認部署認哪一種

## 相似 pattern 警示

其他 reasoning models 都有類似 issue：

- OpenAI o1 / o3 — `reasoning_tokens` 計入 max_completion_tokens
- DeepSeek-R1 — `reasoning_content` 欄位
- Claude extended thinking — `thinking` block 在 content array

**判斷簡則**：用 reasoning model 時先讀其 doc 的「output structure」與「token accounting」章節。

<!-- END: DG-20260426-001 -->
