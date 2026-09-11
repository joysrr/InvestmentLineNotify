---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# Phase 2 規格說明 — aiClient.mjs v3 → v5 遷移

**目的**：以最小變更將 752 行核心邏輯從 Langfuse v3 遷移到 v5，並保證**零功能損失**（Circuit Breaker、retry、key rotation、provider 切換、score 遞送全部保留）

---

## 一、API 對照表（v3 → v5：只改 import + tracing）

| 變更點              | v3                                                    | v5                                                        | 關鍵差異                                       |
| :------------------ | :---------------------------------------------------- | :-------------------------------------------------------- | :--------------------------------------------- |
| **核心套件**        | `langfuse`                                            | `@langfuse/tracing`, `@langfuse/otel`, `@langfuse/client` | v3 SDK deprecated，v5 基於 OTEL                |
| **Instance 創建**   | `new Langfuse({...})` singleton                       | `langfuseClient` (from langfuseClient.mjs)                | 全域 exporter 接管，client 僅用於 prompt/score |
| **Trace 建立**      | `langfuse.trace({name, sessionId, userId, metadata})` | `observe(fn, {name, ...})` decorator                      | 自動建立 trace 與 observation                  |
| **Generation 記錄** | `trace.generation({model, input})`                    | `observe()` 自動捕捉 + `updateActiveObservation({...})`   | OTEL span 自動追蹤                             |
| **Trace ID 取得**   | `langfuse.trace().id`                                 | 從 OpenTelemetry context 取得                             | 需要 helper 函數                               |
| **Flush**           | `langfuse.flushAsync()`                               | `flush()`（從 @langfuse/tracing import）                  | 無接口變化                                     |
| **Prompt 取得**     | `langfuse.getPrompt(name, {label, cacheTtlSeconds})`  | `langfuseClient.prompts.get(name, {label})`               | 格式相容                                       |
| **Score 寫入**      | `langfuse.score({traceId, name, value, comment})`     | `langfuseClient.score.create({...})`                      | REST API 呼叫                                  |

---

## 二、不可變更契約（不變功能清單）

### 1. Circuit Breaker（完整保留）

```javascript
import {
  canMakeAIRequest,
  getCircuitBreakerStatus,
  recordAIRequestResult,
} from "./aiCircuitBreaker.mjs";

if (!canMakeAIRequest()) {
  const status = getCircuitBreakerStatus();
  // throw CircuitBreaker error
}
```

### 2. API Key Rotation（完整保留）

```javascript
const provider = options.provider ?? PROVIDERS.GEMINI;
const cfg = PROVIDER_CONFIG[provider];
const keyCount = provider === PROVIDERS.GEMINI ? aiInstances.length : 1;
const maxRetries = options.maxRetries ?? keyCount * 2;

for (let attempt = 0; attempt < maxRetries; attempt++) {
  const currentKeyIndex = attempt % aiInstances.length;
  // 失敗後嘗試下一個 key
}
```

### 3. Retry Logic（完整保留）

```javascript
import { isAIRetryableError, withRetry } from "../../utils/retryUtils.mjs";

// 在 observe() wrapper 外層保留 retry
const result = await withRetry(async () => {
  return await tracedCallAI(...);
}, { maxRetries: 3 });
```

### 4. Provider 切換（完全保留）

```javascript
const PROVIDERS = { GEMINI: "gemini", GROK: "grok" };
// PROVIDER_CONFIG、callGeminiAPI()、callGrokAPI() 不變
```

### 5. Langfuse Prompt 管理（保持語意）

```javascript
if (!isCI) {
  langfusePromptObj = await getLangfusePrompt(promptName, {
    label: "production",
  });
}
```

### 6. Score 記錄機制（不變時機）

```javascript
await writeLangfuseScore({
  traceId,
  name: "Schema_Validation",
  value: 1,
});
```

---

## 三、 v3 → v5 具體程式碼對照

### 3.1 Imports 更新

**v3 (lines 1-15)**:

```javascript
import { Langfuse } from "langfuse";
import logger from "../../utils/logger.mjs";
import { fetchWithTimeout } from "../../utils/coreUtils.mjs";
// ... Circuit Breaker imports

// 建立 singleton
export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
  flushAt: 1,
  flushInterval: 1000,
});
```

**v5**:

```javascript
import { GoogleGenAI } from "@google/genai";
import { observe, updateActiveObservation } from "@langfuse/tracing";
import { flush } from "@langfuse/tracing";
import {
  getLangfusePrompt,
  writeLangfuseScore,
  flushLangfuse,
} from "./langfuseClient.mjs";
import logger from "../../utils/logger.mjs";
import { fetchWithTimeout } from "../../utils/coreUtils.mjs";
import {
  canMakeAIRequest,
  getCircuitBreakerStatus,
  recordAIRequestResult,
} from "./aiCircuitBreaker.mjs";

// 🗑️ v3 singleton 已刪除：langfuse = new Langfuse(...)
```

### 3.2 `resolveChatPrompt()` 函數重構

**位置**: aiClient.mjs line 289-349  
**v3 出現**: lines 290-349  
**v5 改動點**:

```javascript
// v3 (old)
const langfusePromptObj = await langfuse.getPrompt(promptName, {
  label: "production",
  cacheTtlSeconds: 300,
});

// v5 (new)
const langfusePromptObj = await getLangfusePrompt(promptName, {
  label: "production",
});
```

### 3.3 `callAI()` 核心重構

**位置**: aiClient.mjs line 377-640

**主要變更**:

1. **Trace 建立**: 從 `langfuse.trace({...})` 改成 `observe(fn, {...})`
2. **Generation 捕捉**: 從 `trace.generation()` 改成 `updateActiveObservation()`
3. **Trace ID 獲取**: 從 `trace.id` 改成 helper function（ OTEL context）
4. **Flush 位置**: v3 在每個 try/catch 末端，v5 由 SDK 自動管理

**v3 結構（概念圖）**:

```javascript
const trace = langfuse.trace({ name, sessionId, metadata });
const generation = trace.generation({ model, input });

try {
  const result = await callGeminiAPI(...);
  generation.end({ output, usage });
  await langfuse.flushAsync();
  return { text: result.text, traceId: trace.id };
} catch (error) {
  generation.end({ level: "ERROR", statusMessage: error.message });
  await langfuse.flushAsync();
  throw error;
}
```

**v5 結構（概念圖）**:

```javascript
const tracedCall = observe(
  async () => {
    updateActiveObservation({
      name: promptName,
      input: { system: systemInstruction, user: userTemplate },
      metadata: { provider, model, humanReviewMeta },
      sessionId: options.sessionId,
      userId: options.userId,
    });

    try {
      const result = await callGeminiAPI(...);

      updateActiveObservation({
        output: result.text,
        usage: {
          input: result.inputTokens,
          output: result.outputTokens,
        },
      });

      await flush(); // 完成呼叫 flush
      return {
        text: result.text,
        traceId: getCurrentTraceId(), // 從 OTEL context 取得
      };
    } catch (error) {
      updateActiveObservation({
        level: "ERROR",
        statusMessage: error.message,
      });
      throw error;
    }
  },
  {
    as_type: "generation",
    name: `${promptName}-attempt-${attempt}`,
    model: resolvedModel,
  }
);

return await tracedCall();
```

### 3.4 Helper 函數實作（關鍵）

**需求**: 從 OTEL context 取得 traceId  
**方案**: 使用 Langfuse v5 提供的 utility

```javascript
import { getCurrentTraceId } from "@langfuse/tracing";

// 在 observe() 內部：
const traceId = getCurrentTraceId();
```

**或手自定義**:

```javascript
function getCurrentTraceId(context) {
  // OTEL context 解析經驗實作
  return context.active()?.spanContext()?.traceId ?? null;
}
```

**注意**：由於 @langfuse/tracing v5 沒直接暴露 getCurrentTraceId，正確做法為從 OTEL context 取得，或改動設計讓 trace 無關。

---

## 四、Mock 設計規格（供 C 子代理執行）

### 4.1 Mock 架構結構

```javascript
// tests/fixtures/langfuse-v5.mock.mjs

import { vi } from "vitest";

export const mockLangfuseV5 = {
  // tracing
  observe: vi.fn((fn) => fn), // 立即執行被裝飾的函數
  updateActiveObservation: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  getCurrentTraceId: vi.fn().mockReturnValue("test-trace-id"),

  // client
  client: {
    prompts: {
      get: vi.fn().mockResolvedValue({
        version: 1,
        name: "test-prompt",
        prompt: [{ role: "system", content: "You are an AI assistant." }],
        config: {},
      }),
    },
    score: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  },

  // otel
  exporter: {
    export: vi.fn(),
    shutdown: vi.fn(),
  },
};
```

### 4.2 改裝現有測試 aiClient.test.mjs (899 lines)

**v3 mock 結構** (lines 17-35):

```javascript
const { MockLangfuseClass } = vi.hoisted(() => {
  class MockLangfuse {
    constructor() {
      this.getPrompt = vi.fn();
      this.trace = vi.fn().mockReturnValue({
        id: "test-trace-id",
        generation: vi.fn().mockReturnValue({ end: vi.fn() }),
        update: vi.fn(),
        flushAsync: vi.fn(),
        score: vi.fn(),
      });
      this.flushAsync = vi.fn();
      this.score = vi.fn();
    }
  }
  return { MockLangfuseClass: MockLangfuse };
});
// 需要替換成 v5 mock
```

**v5 mock 目標**：

```javascript
vi.mock("@langfuse/tracing", () => mockLangfuseV5.tracingMocks);
vi.mock("@langfuse/client", () => mockLangfuseV5.clientMocks);
vi.mock("@langfuse/otel", () => mockLangfuseV5.otelMocks);
vi.mock("./langfuseClient.mjs", () => mockLangfuseV5.clientMock);
```

### 4.3 Score 驗證測試

- 檢查 `writeLangfuseScore(payload)` 被呼叫
- 驗證 `mock.score.create` 被調用正確參數
- 檢查 try/catch 內部異常處理

---

## 五、驗收點（Phase 2 完成標誌）

### 必須通過

- [ ] `npm test` 全綠（包括 aiClient.test.mjs: 899 行測試）
- [ ] Functions 切換後測試：`callAI('News/GenerateSearchQueries', {...})` 能成功執行
- [ ] Mock 呼叫驗證：trace/generation/score 呼叫正確
- [ ] **回傳值契約**: 保留原本的 `{ text, traceId, ... }` 回傳格式
- [ ] circuit breaker 介入測試通過
- [ ] Prompt missing fallback 邏輯通過

### 可選擇性檢查

- [ ] perf 測試無一九九八% 下降（< 10s per call）
- [ ] Langfuse Cloud 顯示 trace 可視化成功

---

## 六、風險與緩解策略（預警）

| 風險                       | 可能性 | 展現形式               | 緩解                                                |
| :------------------------- | :----- | :--------------------- | :-------------------------------------------------- |
| observe() 使用方式錯誤     | 🔴 高  | Trace 不產生           | 先用 minimal test 驗證 `observe(() => {})` 是否有效 |
| getCurrentTraceId 取得不到 | 🟡 中  | Call 回傳 traceId 錯誤 | 實作 OTEL context 解析 helper                       |
| 套件 version mismatch      | 🟡 中  | runtime error          | 檢查 package.json 依賴衝突                          |
| test coverage 下降         | 🔴 高  | CI fail                | 確保 899 行測試全部更新後執行通過                   |

---

## 七、Phase 2 開發檢查清單（使用時）

以下清單供開發過程中 tests 清管理：

- [ ] **Step 1**: 創建 langfuse-v5.mock.mjs，包含 v3 mock 對照版本
- [ ] **Step 2**: 更新 `resolveChatPrompt()` 使用 `getLangfusePrompt()`
- [ ] **Step 3**: 實作 `getCurrentTraceId()` helper 函數
- [ ] **Step 4**: 重寫 `callAI()`，從 `trace()` + `generation()` 改成 `observe()`
- [ ] **Step 5**: 更新所有 `flushAsync()` 改為 `flush()`
- [ ] **Step 6**: 更新所有 `score()` 調用改為 `writeLangfuseScore()`
- [ ] **Step 7**: 執行 npm test，所有測試綠
- [ ] **Step 8**: 確認 trace 在 Langfuse Cloud 正確顯示
- [ ] **Step 9**: Commit 並驗證

---

## 八、完成定義 (Definition of Done)

Phase 2 完全完成的標誌：

✅ **Code 完成**: aiClient.mjs 完全使用 v5 API  
✅ **Test 完成**: aiClient.test.mjs 所有測試通過  
✅ **驗證完成**: 真實 API 呼叫驗證 trace 產生  
✅ **Review 完成**: 由 Han 或其他 agent 檢視合合理性  
✅ **Document 更新**: Plan 標記 Phase 2 100% 完成  
✅ **Git commit**: feature commit，標註 Phase 2 completion

---

**最後更新時間**: 2026-09-08  
**下一階段**: Phase 3: Score API 遷移（如果不是等待 Phase 3 Spec）
