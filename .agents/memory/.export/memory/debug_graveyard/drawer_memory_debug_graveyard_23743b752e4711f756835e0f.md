---
drawer_id: drawer_memory_debug_graveyard_23743b752e4711f756835e0f
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.044Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

ns` 至 16384+：

```python
default_tokens = 16384 if not should_disable_thinking else 4096
```

3. **content 空時 fallback 抓 reasoning_content**：
   ```python
   for key in ("reasoning_content", "reasoning", "thinking", "thought"):
       candidate = response.additional_kwargs.get(key)
       if candidate:
           llm_text = candidate
           break
   ```

## 教訓（避免再犯）

- ❌ 用 reasoning model 卻沿用 non-reasoning 的 `max_tokens` 預設
- ❌ 假設 `response.content` 一定有東西就 parse
- ✅ 任務 tier=simple/medium 可關 thinking 省 tokens 與時間
- ✅ tier=complex 必開 thinking 但 `max_tokens >= 16384`
- ✅ Parser 加 `_extract_llm_text()` fallback；空時印 `finish_reason / token_usage / additional_kwargs.keys`
- ✅ 用真實 OpenAI client 直接打 API（`tests/debug_qwen_raw.py`）測試各種 thinking 開關以確認部署認哪一種

## 相似 pattern 警示
