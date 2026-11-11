---
type: reference
status: current
last_updated: 2026-11-11
tags:
  - ai
  - model-fallback
  - thinking-config
  - prompt-management
wiki_links:
  - docs/modules/ai_news/ai_pipeline.md
  - docs/modules/ai_news/integrations/langfuse_prompt_management.md
  - docs/modules/ai_news/integrations/langfuse_score_configs.md
related_code:
  - src/modules/ai/modelFallback.mjs
  - src/modules/ai/modelFallbackPolicy.mjs
  - src/modules/ai/thinkingConfigPolicy.mjs
---

# 模型降級與思考配置 (Model Fallback & Thinking Config)

記錄 `src/modules/ai/` 中三個模型策略模組的提示詞與配置行為，補足 `docs/modules/ai_news/` 的覆蓋盲區。

## 1. modelFallback.mjs — Gemini 多模型 Fallback 清單解析

**職責**：解析 Gemini 多模型 Fallback 清單，當主模型 quota 耗盡時依序嘗試備用模型。

### 輸入格式

| 參數           | 類型     | 說明                                                        |
| -------------- | -------- | ----------------------------------------------------------- |
| `defaultModel` | `string` | 主模型名稱（來自 `GEMINI_MODEL` env 或硬編碼預設）          |
| `fallbacksEnv` | `string` | 備用模型清單（來自 `GEMINI_MODEL_FALLBACKS` env，逗號分隔） |

### 輸出格式

`string[]` — 去重、過濾空值後的模型名稱陣列，首項為主模型。

### 行為邏輯

1. 主模型永遠是 `GEMINI_MODEL`（env）或硬編碼 `defaultModel`
2. 備用模型從 `GEMINI_MODEL_FALLBACKS`（env，逗號分隔）讀取
3. 自動去重、過濾空值
4. `callAI` 在 quota 耗盡時依序嘗試備用模型，所有模型失敗才報錯

## 2. modelFallbackPolicy.mjs — 模型降級策略

**職責**：決定當前模型失敗時，下一個應該嘗試的備用模型索引。

### 輸入格式

| 參數           | 類型       | 說明                                      |
| -------------- | ---------- | ----------------------------------------- |
| `currentIndex` | `number`   | 當前嘗試的模型索引                        |
| `modelList`    | `string[]` | 模型清單（由 `modelFallback.mjs` 產出）   |
| `errorType`    | `string`   | 錯誤類型（quota、rate limit、network 等） |

### 輸出格式

| 返回值      | 類型     | 說明                                            |
| ----------- | -------- | ----------------------------------------------- |
| `nextIndex` | `number` | 下一個應嘗試的模型索引；`-1` 表示無可用備用模型 |

## 3. thinkingConfigPolicy.mjs — 思考配置重試策略

**職責**：決定當 LLM 調用錯誤時，是否應該重試並禁用 thinking config。

### 輸入格式

| 參數    | 類型    | 說明             |
| ------- | ------- | ---------------- |
| `error` | `Error` | LLM 調用錯誤物件 |

### 輸出格式

| 返回值        | 類型      | 說明                                    |
| ------------- | --------- | --------------------------------------- |
| `shouldRetry` | `boolean` | `true` 表示應重試並禁用 thinking config |

## 4. 與 Langfuse 觀測的關聯

上述三個模組的執行結果（模型選擇、降級決策、思考配置重試）應透過 `langfuseClient.mjs` 上報至 Langfuse，作為 AI 管線觀測的維度：

- **模型 Fallback 次數**：每次切換至備用模型時上報
- **思考配置重試次數**：每次因錯誤重試並禁用 thinking config 時上報
- **最終模型**：每次請求最終使用的模型名稱

## 5. 提示詞版本管理策略

- 三個模組均為純邏輯代碼，不直接包含提示詞模板
- 提示詞模板由 `langfuseClient.mjs` 透過 Langfuse Prompt 管理，版本由 Langfuse 控制
- 模型選擇邏輯（modelFallback）與提示詞版本無直接耦合，但不同模型可能對應不同提示詞版本

---

_補寫：Phase 3-F，涵蓋 modelFallback、modelFallbackPolicy、thinkingConfigPolicy 三個此前未文件化的 AI 管線模組_
_建立：2026-11-11 | 負責人：Han_
