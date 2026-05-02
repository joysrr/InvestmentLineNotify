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

其他 reasoning models 都有類似 issue：

- OpenAI o1 / o3 — `reasoning_tokens` 計入 max_completion_tokens
- DeepSeek-R1 — `reasoning_content` 欄位
- Claude extended thinking — `thinking` block 在 content array

**判斷簡則**：用 reasoning model 時先讀其 doc 的「output structure」與「token accounting」章節。

<!-- END: DG-20260426-001 -->
