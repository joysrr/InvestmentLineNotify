---
drawer_id: drawer_memory_debug_graveyard_131704240b3789afb618456c
wing: memory
room: debug_graveyard
exported_at: 2026-05-04T03:03:00.041Z
exported_by: mempalace-export.mjs (PROPOSAL_502_020 T-1)
---

顯示用了 4000+ tokens

- 但 LLM 回應的可見內容是空字串
- → 下游 parser 抓不到值 → reviewer 進死循環、retro 不寫提案、HITL 不觸發

## 根因

- Qwen3 系列 reasoning model（含 Qwen3.5 / QwQ）預設 `enable_thinking = True`
- thinking token 會吃光 max_tokens 配額（通常 5K-10K）
- 當 max_tokens 預設只有 4096 時 → thinking 階段就用完 → 進入 `content` 階段已無預算 → 回傳空字串
- 真正的推理結果藏在 `additional_kwargs.reasoning_content`（不是 `content`）

## 解法

兩條防線同時做：

1. **關 thinking 模式**（簡單任務）：

   ```python
   extra_body = {
       "enable_thinking": False,                              # Qwen 官方 API 認得
       "chat_template_kwargs": {"enable_thinking": False},    # vLLM/SGLang 部署認得
   }
   ```

   不同 Qwen 部署認的參數位置不同；同時送可提高相容性。

2. **若必須開 thinking** → 提高 `max_tokens` 至 16384+：
   ```python
   default_tokens = 16384 if not should_disable_thinking else 4096
   ```
