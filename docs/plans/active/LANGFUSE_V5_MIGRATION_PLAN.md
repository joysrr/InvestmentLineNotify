# Langfuse v3 → v5 Migration Plan (分階段執行)

> **建立日期**: 2026-09-08  
> **最後更新**: 2026-09-08  
> **Deadline**: 2026-11-16 (Langfuse Cloud v3 sunset)  
> **總工作量**: 15-20 小時  
> **當前狀態**: ⏸️ Phase 1 完成，Phase 2 待啟動  
> **負責人**: Han + Agent  
> **優先級**: P0 (阻斷性遷移)

---

## 📋 目錄

1. [Migration 總覽](#migration-總覽)
2. [Phase 1: 環境準備](#phase-1-環境準備--完成)
3. [Phase 2: aiClient.mjs 核心遷移](#phase-2-aiclientmjs-核心遷移--待啟動)
4. [Phase 3: Score API 遷移](#phase-3-score-api-遷移--等待-phase-2)
5. [Phase 4: 測試檔案更新](#phase-4-測試檔案更新--等待-phase-3)
6. [Phase 5: 驗證與部署](#phase-5-驗證與部署--等待-phase-4)
7. [執行進度追蹤](#執行進度追蹤)
8. [風險管理](#風險管理)
9. [Rollback 策略](#rollback-策略)
10. [開發日誌](#開發日誌)

---

## Migration 總覽

### 背景

Langfuse Cloud 將於 **2026-11-16** 停止支援 v3 SDK 與 legacy ingestion API。專案目前使用 `langfuse@3.38.20`，需遷移至 `@langfuse/tracing@5.11.0` 等 v5 套件。

### 核心變更對照表

| 層面           | v3 (舊)                                    | v5 (新)                                                     | 變更類型     |
| :------------- | :----------------------------------------- | :---------------------------------------------------------- | :----------- |
| **套件名**     | `langfuse`                                 | `@langfuse/tracing` + `@langfuse/otel` + `@langfuse/client` | Breaking     |
| **架構**       | 自有 batch queue                           | OpenTelemetry-based                                         | Breaking     |
| **Trace API**  | `langfuse.trace({ name, ... })`            | `observe(fn, { name, ... })` decorator                      | Breaking     |
| **Generation** | `trace.generation({ model, ... })`         | `observe(fn, { as_type: "generation" })`                    | Breaking     |
| **Score**      | `langfuse.score({ traceId, name, value })` | `LangfuseAPIClient.score.create({ ... })`                   | Breaking     |
| **Prompt**     | `langfuse.getPrompt(name, { label })`      | `LangfuseAPIClient.prompts.get(name, { label })`            | Breaking     |
| **Flush**      | `langfuse.flushAsync()`                    | `flush()` from `@langfuse/tracing`                          | API 名稱變更 |

### 影響範圍評估

| 模組                                    | 變更量            | 風險等級 |
| :-------------------------------------- | :---------------- | :------- |
| `src/modules/ai/aiClient.mjs`           | 752 行，核心邏輯  | 🔴 高    |
| `src/modules/ai/aiCoach.mjs`            | 7 處 score 呼叫   | 🟡 中    |
| `src/modules/ai/llmJudge.mjs`           | 2 處 score 呼叫   | 🟡 中    |
| `src/modules/ai/periodReportAgent.mjs`  | 1 處 score 呼叫   | 🟢 低    |
| `src/modules/ai/ruleOptimizerAgent.mjs` | 1 處 score 呼叫   | 🟢 低    |
| `src/scheduler/newsFetch.mjs`           | 1 處 score 呼叫   | 🟢 低    |
| `src/runNewsFetch.mjs`                  | 1 處 score 呼叫   | 🟢 低    |
| **測試檔案** (6 個)                     | 899+ 行 mock 更新 | 🔴 高    |

---

## Phase 1: 環境準備 ✅ **完成 (2026-09-08)**

### 完成項目

- [x] 安裝 v5 SDK 套件
- [x] 創建 `langfuseClient.mjs` 初始化模組
- [x] 備份 `aiClient.mjs` 為 `aiClient.v3.backup.mjs`
- [x] 創建 migration plan 文件
- [x] Git commit 並 push (`03175bd`, `c78b599`)

### 產出物

1. **`src/modules/ai/langfuseClient.mjs`** (新建)

   ```javascript
   // 統一 v5 初始化與封裝
   export const langfuseExporter = new LangfuseExporter({ ... });
   export const langfuseClient = new LangfuseAPIClient({ ... });
   export async function flushLangfuse(traceId, status) { ... }
   export async function getLangfusePrompt(name, options) { ... }
   export async function writeLangfuseScore(payload) { ... }
   ```

2. **`package.json`** (更新)

   ```json
   "dependencies": {
     "@langfuse/tracing": "^5.11.0",
     "@langfuse/otel": "^5.11.0",
     "@langfuse/core": "^5.11.0",
     "@langfuse/client": "^5.11.0"
   }
   ```

3. **`src/modules/ai/aiClient.v3.backup.mjs`** (備份)

### 驗證結果

- ✅ 套件安裝成功，無 peer dependencies 衝突
- ⚠️ Node.js v20.20.2 vs `ky@2.0.2` 需要 Node >= 22 的 warning（不影響運作）
- ✅ Git commit `03175bd` 並 push 成功

### 實際工時

**2 小時**

---

## Phase 2: `aiClient.mjs` 核心遷移 🚧 **進行中**

### 進度追蹤

- ✅ **Phase 2.1 完成 (2026-09-08 23:17)**: `langfuseClient.mjs` v5 API helpers
  - Commit: c20b21b
  - 新增 `getCurrentTraceIdSafe()`, `observeWithLangfuse()`, `getPromptFromLangfuse()`
  - 測試覆蓋：5/5 通過
  - aiClient 測試：84/84 仍然通過（無破壞）
- ⏸️ **Phase 2.2 待執行**: 更新 `aiClient.mjs` imports
- ⏸️ **Phase 2.3 待執行**: 重構 `resolveChatPrompt()`
- ⏸️ **Phase 2.4 待執行**: 重構 `callAI()` 核心函數
- ⏸️ **Phase 2.5 待執行**: 更新測試檔案

### 目標

重構 752 行的 `aiClient.mjs`，從 v3 API 改用 v5 的 OpenTelemetry-based API。

### 執行範圍

#### 2.1 更新 Imports (Lines 1-15)

**Before (v3)**:

```javascript
import { Langfuse } from "langfuse";

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
  flushAt: 1,
  flushInterval: 1000,
});
```

**After (v5)**:

```javascript
import { observe, updateActiveObservation, flush } from "@langfuse/tracing";
import {
  langfuseClient,
  getLangfusePrompt,
  writeLangfuseScore,
  flushLangfuse,
} from "./langfuseClient.mjs";

// 不再需要 singleton，v5 使用 global exporter
```

#### 2.2 重構 `resolveChatPrompt()` (Lines 289-349)

**核心變更**: Prompt 管理從 `langfuse.getPrompt()` 改為 `langfuseClient.prompts.get()`

**Before (v3)**:

```javascript
async function resolveChatPrompt(promptName, variables = {}) {
  let langfusePromptObj = null;
  let langfuseConfig = {};
  let promptSource = "missing";

  if (!isCI) {
    try {
      langfusePromptObj = await langfuse.getPrompt(promptName, {
        label: "production",
        cacheTtlSeconds: 300,
      });
      // ... 解析 prompt ...
    } catch (err) {
      logger.warn("Langfuse getPrompt 失敗");
    }
  }
  // ... fallback 邏輯 ...
}
```

**After (v5)**:

```javascript
import { getLangfusePrompt } from "./langfuseClient.mjs";

async function resolveChatPrompt(promptName, variables = {}) {
  let langfusePromptObj = null;
  let langfuseConfig = {};
  let promptSource = "missing";

  if (!isCI) {
    try {
      langfusePromptObj = await getLangfusePrompt(promptName, {
        label: "production",
      });
      // 解析邏輯保持不變
    } catch (err) {
      logger.warn("Langfuse getPrompt 失敗");
    }
  }
  // ... fallback 邏輯保持不變 ...
}
```

#### 2.3 重構 `callAI()` 核心函數 (Lines 377-640)

**核心變更**: 從 `langfuse.trace()` + `trace.generation()` 改為 `observe()` decorator

**Before (v3)**:

```javascript
export async function callAI(promptName, options = {}) {
  // ... Circuit Breaker 檢查 ...

  const trace = langfuse.trace({
    name: promptName,
    sessionId: options.sessionId,
    userId: options.userId,
    metadata: { provider, model, humanReviewMeta },
  });

  const generation = trace.generation({
    name: `${promptName}-attempt-0`,
    model: resolvedModel,
    input: { system: systemInstruction, user: userTemplate },
  });

  try {
    const result = await callGeminiAPI({ ... });

    generation.end({
      output: result.text,
      usage: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
    });

    await langfuse.flushAsync();
    return { text: result.text, traceId: trace.id };
  } catch (error) {
    generation.end({ level: "ERROR", statusMessage: error.message });
    throw error;
  }
}
```

**After (v5)**:

```javascript
import { observe, updateActiveObservation } from "@langfuse/tracing";
import { flushLangfuse } from "./langfuseClient.mjs";

export async function callAI(promptName, options = {}) {
  // ... Circuit Breaker 檢查保持不變 ...

  // 使用 observe decorator 包裝整個 AI 呼叫
  const tracedCall = observe(
    async () => {
      // 設定 trace metadata
      updateActiveObservation({
        name: promptName,
        sessionId: options.sessionId,
        userId: options.userId,
        metadata: { provider, model, humanReviewMeta },
      });

      try {
        const result = await callGeminiAPI({ ... });

        // 設定 generation output
        updateActiveObservation({
          output: result.text,
          usage: {
            input: result.inputTokens,
            output: result.outputTokens,
          },
        });

        // v5 自動 flush (exporter 處理)
        await flushLangfuse(getCurrentTraceId(), "success");

        return { text: result.text, traceId: getCurrentTraceId() };
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
      name: `${promptName}-attempt-0`,
      model: resolvedModel,
      input: { system: systemInstruction, user: userTemplate },
    }
  );

  return await tracedCall();
}
```

**注意事項**:

- v5 的 `observe()` 需要**包裝整個函數**，不能像 v3 那樣分段呼叫
- `traceId` 需透過 OpenTelemetry context 取得（需額外實作 `getCurrentTraceId()` helper）
- 重試邏輯（key rotation）需保留在 `observe()` wrapper 外部

#### 2.4 更新 Flush 機制

**Before (v3)**:

```javascript
await langfuse.flushAsync();
```

**After (v5)**:

```javascript
import { flushLangfuse } from "./langfuseClient.mjs";

await flushLangfuse(traceId, "success");
```

### 預估工作量

- **開發時間**: 4-6 小時
- **單元測試更新**: 2 小時
- **驗證測試**: 1 小時
- **總計**: 7-9 小時

### 驗收標準

- [ ] `aiClient.mjs` 所有 Langfuse v3 API 呼叫改用 v5 API
- [ ] 保留所有現有功能（Circuit Breaker、key rotation、retry）
- [ ] `aiClient.test.mjs` (899 行) 更新並全綠
- [ ] 手動測試：呼叫 `callAI("News/GenerateSearchQueries")` 確認 Langfuse Cloud 顯示正確 trace

### 風險與緩解

| 風險                                    | 影響              | 機率 | 緩解策略                                               |
| :-------------------------------------- | :---------------- | :--- | :----------------------------------------------------- |
| `observe()` decorator 不支援 retry 邏輯 | key rotation 失效 | 中   | 將 retry 邏輯移到 `observe()` 外層                     |
| OpenTelemetry trace context 丟失        | traceId 為 null   | 中   | 實作 `getCurrentTraceId()` helper 從 OTEL context 取得 |
| v5 flush 語意不明                       | traces 未送出     | 低   | 參考官方文件，確認 exporter 自動 flush 機制            |
| 測試 mock 結構錯誤                      | 測試失敗率高      | 高   | 先建立 minimal test case 驗證 mock 結構                |

### 開發檢查清單

- [ ] 備份當前 `aiClient.mjs`（已完成於 Phase 1）
- [ ] 更新 imports
- [ ] 重構 `resolveChatPrompt()`
- [ ] 重構 `callAI()` 主函數
- [ ] 實作 `getCurrentTraceId()` helper
- [ ] 更新所有 `flushAsync()` 為 `flushLangfuse()`
- [ ] 更新 `aiClient.test.mjs` mock
- [ ] 執行 `npm test src/modules/ai/aiClient.test.mjs`
- [ ] 手動測試 AI 呼叫
- [ ] Git commit

---

## Phase 3: Score API 遷移 🔜 **等待 Phase 2 完成**

### 目標

將 13 處 `langfuse.score()` 呼叫遷移到 v5 API。

### 影響檔案清單

| 檔案                                    | 呼叫次數 | 風險  |
| :-------------------------------------- | :------- | :---- |
| `src/modules/ai/aiCoach.mjs`            | 7 處     | 🟡 中 |
| `src/modules/ai/llmJudge.mjs`           | 2 處     | 🟡 中 |
| `src/modules/ai/periodReportAgent.mjs`  | 1 處     | 🟢 低 |
| `src/modules/ai/ruleOptimizerAgent.mjs` | 1 處     | 🟢 低 |
| `src/scheduler/newsFetch.mjs`           | 1 處     | 🟢 低 |
| `src/runNewsFetch.mjs`                  | 1 處     | 🟢 低 |

### 遷移方案

#### 3.1 搜尋所有 score 呼叫點

```bash
grep -rn "langfuse.score\|safeLangfuseScore" src/modules/ai src/scheduler src/runNewsFetch.mjs
```

#### 3.2 替換範例

**Before (v3)**:

```javascript
// aiCoach.mjs
async function safeLangfuseScore(payload) {
  try {
    await langfuse.score(payload);
  } catch (err) {
    logger.warn(
      { name: payload.name, error: err.message },
      "Langfuse score 寫入失敗",
    );
  }
}

await safeLangfuseScore({
  traceId,
  name: "Schema_Validation",
  value: 1,
  comment: "FilterAndCategorizeNews JSON parse success",
});
```

**After (v5)**:

```javascript
// aiCoach.mjs
import { writeLangfuseScore } from "./langfuseClient.mjs";

// safeLangfuseScore 可刪除，writeLangfuseScore 已內建 try-catch

await writeLangfuseScore({
  traceId,
  name: "Schema_Validation",
  value: 1,
  comment: "FilterAndCategorizeNews JSON parse success",
});
```

### 預估工作量

- **搜尋與替換**: 1 小時
- **測試更新**: 2 小時
- **驗證**: 1 小時
- **總計**: 4 小時

### 驗收標準

- [ ] 所有 13 處 `langfuse.score()` 改用 `writeLangfuseScore()`
- [ ] 刪除所有 `safeLangfuseScore()` wrapper 函數
- [ ] 對應測試檔案更新
- [ ] `npm test` 全綠
- [ ] 手動測試：執行 `aiCoach` 確認 scores 正確寫入 Langfuse Cloud

### 開發檢查清單

- [ ] 搜尋所有 `langfuse.score` 呼叫點
- [ ] 逐一替換為 `writeLangfuseScore`
- [ ] 更新對應測試 mock
- [ ] 執行單元測試
- [ ] Git commit

---

## Phase 4: 測試檔案更新 🔜 **等待 Phase 3 完成**

### 目標

更新 6 個測試檔案的 mock 結構，從 v3 API 改為 v5 API。

### 影響檔案

| 檔案                                         | 行數     | Mock 複雜度 |
| :------------------------------------------- | :------- | :---------- |
| `src/modules/ai/aiClient.test.mjs`           | 899 行   | 🔴 高       |
| `src/modules/ai/aiCoach.test.mjs`            | 1000+ 行 | 🔴 高       |
| `src/modules/ai/llmJudge.test.mjs`           | 200+ 行  | 🟡 中       |
| `src/test/integration/aiPrompt.test.mjs`     | 100+ 行  | 🟡 中       |
| `src/test/unit/scheduler/newsFetch.test.mjs` | 200+ 行  | 🟡 中       |

### Mock 更新範例

#### 4.1 aiClient.test.mjs

**Before (v3)**:

```javascript
const { MockLangfuseClass } = vi.hoisted(() => {
  class MockLangfuse {
    constructor() {
      this.getPrompt = vi.fn();
      this.trace = vi.fn().mockReturnValue({
        id: "test-trace-id",
        generation: vi.fn().mockReturnValue({
          end: vi.fn(),
        }),
        update: vi.fn(),
      });
      this.flushAsync = vi.fn();
      this.score = vi.fn();
    }
  }
  return { MockLangfuseClass: MockLangfuse };
});

vi.mock("langfuse", () => ({
  Langfuse: MockLangfuseClass,
}));
```

**After (v5)**:

```javascript
vi.mock("@langfuse/tracing", () => ({
  observe: vi.fn((fn) => fn), // 直接執行被包裝的函數
  updateActiveObservation: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  getCurrentTraceId: vi.fn().mockReturnValue("test-trace-id"),
}));

vi.mock("./langfuseClient.mjs", () => ({
  langfuseClient: {
    prompts: {
      get: vi.fn().mockResolvedValue({
        version: 1,
        prompt: "mock prompt content",
        config: {},
      }),
    },
    score: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  },
  getLangfusePrompt: vi.fn().mockResolvedValue({
    version: 1,
    prompt: "mock prompt",
  }),
  writeLangfuseScore: vi.fn().mockResolvedValue(undefined),
  flushLangfuse: vi.fn().mockResolvedValue(undefined),
}));
```

### 預估工作量

- **Mock 結構設計**: 1 小時
- **aiClient.test.mjs 更新**: 2 小時
- **其他測試檔案更新**: 2 小時
- **測試驗證**: 1 小時
- **總計**: 6 小時

### 驗收標準

- [ ] 所有測試檔案 mock 更新完成
- [ ] `npm test` 全綠（55 個測試檔案，375 個測試案例）
- [ ] 測試覆蓋率不下降（當前 > 80%）
- [ ] CI/CD pipeline 通過

### 開發檢查清單

- [ ] 設計 v5 mock 結構範本
- [ ] 更新 `aiClient.test.mjs`
- [ ] 更新 `aiCoach.test.mjs`
- [ ] 更新其他 4 個測試檔案
- [ ] 執行 `npm test`
- [ ] 執行 `npm run test:coverage`
- [ ] Git commit

---

## Phase 5: 驗證與部署 🔜 **等待 Phase 4 完成**

### 5.1 本地驗證

#### 單元測試

```bash
npm test
# 預期：55 個測試檔案，375 個測試案例全綠
```

#### Integration 測試

```bash
# 測試 AI 呼叫
node -e "
import('./src/modules/ai/aiClient.mjs').then(async ({ callAI }) => {
  const result = await callAI('News/GenerateSearchQueries', {
    promptVariables: { newsListText: 'test' },
  });
  console.log('✅ AI call success:', result.traceId);
});
"
```

#### Langfuse Cloud 驗證

1. 登入 https://cloud.langfuse.com
2. 確認 trace 顯示正確
3. 確認 scores 正確寫入

### 5.2 Smoke Test

執行完整流程：

```bash
# 1. 新聞採集
npm run news:fetch

# 2. AI Coach 生成
npm run coach:generate

# 3. 檢查 Langfuse Cloud traces
```

### 5.3 部署前檢查清單

- [ ] 所有單元測試通過
- [ ] Integration 測試通過
- [ ] Langfuse Cloud traces 顯示正確
- [ ] Scores 正確寫入
- [ ] Production build 成功: `npm run build`
- [ ] 移除 v3 套件: `npm uninstall langfuse`
- [ ] 移除備份檔案: `rm src/modules/ai/aiClient.v3.backup.mjs`
- [ ] 更新 `.env.example`（如有需要）
- [ ] 更新 README.md 文件（如有需要）

### 5.4 部署步驟

```bash
# 1. 最終 commit
git add .
git commit -m "feat(langfuse): complete v5 migration - all phases done"
git push

# 2. 部署到 production
# (根據你的部署流程)
```

### 預估工作量

- **測試驗證**: 2 小時
- **部署**: 30 分鐘
- **總計**: 2.5 小時

---

## 執行進度追蹤

| Phase                          | 狀態            | 開始日期          | 完成日期   | 預估工時  | 實際工時 |
| :----------------------------- | :-------------- | :---------------- | :--------- | :-------- | :------- |
| Phase 1: 環境準備              | ✅ 完成         | 2026-09-08        | 2026-09-08 | 2h        | 2h       |
| Phase 2: aiClient.mjs 核心遷移 | ⏸️ 待啟動       | 2026-09-08 (暫停) | -          | 7-9h      | -        |
| Phase 3: Score API 遷移        | 🔜 等待 Phase 2 | -                 | -          | 4h        | -        |
| Phase 4: 測試檔案更新          | 🔜 等待 Phase 3 | -                 | -          | 6h        | -        |
| Phase 5: 驗證與部署            | 🔜 等待 Phase 4 | -                 | -          | 2.5h      | -        |
| **總計**                       | **10% 完成**    | -                 | -          | **21.5h** | **2h**   |

**圖例**: ✅ 完成 | 🔄 進行中 | ⏸️ 待啟動 | 🔜 等待前一階段 | ❌ 停滯

---

## Timeline 推算

假設每週投入 6-8 小時開發：

| 週次       | 日期範圍           | 執行 Phase       | 預估完成度 |
| :--------- | :----------------- | :--------------- | :--------- |
| Week 0     | 2026-09-08         | Phase 1 ✅       | 10%        |
| Week 1     | 2026-09-09 ~ 09-15 | Phase 2          | 50%        |
| Week 2     | 2026-09-16 ~ 09-22 | Phase 3          | 70%        |
| Week 3     | 2026-09-23 ~ 09-29 | Phase 4          | 95%        |
| Week 4     | 2026-09-30 ~ 10-06 | Phase 5          | 100%       |
| **Buffer** | 2026-10-07 ~ 11-16 | 延遲緩衝 (41 天) | -          |

**距離 deadline 還有**: 69 天（充足）

---

## 風險管理

| 風險                                 | 機率 | 影響                  | 緩解策略                       | 觸發條件              | 應對措施               |
| :----------------------------------- | :--- | :-------------------- | :----------------------------- | :-------------------- | :--------------------- |
| Node.js 版本不足 (v20 < v22)         | 中   | 🟡 v5 SDK 無法運作    | 升級 Node.js 到 v22            | 發現 runtime 錯誤     | 立即升級或使用 Docker  |
| OpenTelemetry 學習曲線               | 高   | 🟡 Phase 2 延遲       | 預留 buffer 時間               | Phase 2 超過 2 天     | 請教官方文件或社群     |
| 測試覆蓋率下降                       | 中   | 🔴 漏網 bug           | TDD：測試先行                  | 測試失敗率 > 5%       | 補充測試案例           |
| 11-16 deadline 壓力                  | 低   | 🔴 強制部署不完整版本 | 提前 2 週完成                  | 10 月底未完成 Phase 4 | 加快開發節奏或尋求支援 |
| `observe()` decorator 不支援複雜邏輯 | 中   | 🔴 核心功能失效       | 改用手動 span 管理             | Phase 2 測試失敗      | 參考官方進階用法       |
| Langfuse Cloud 服務中斷              | 低   | 🟡 無法驗證           | 使用 self-hosted Langfuse 測試 | Cloud 502/503 錯誤    | 暫緩驗證，等待服務恢復 |

---

## Rollback 策略

### 緊急 Rollback (Phase 2-4 期間)

若發現致命問題需立即回滾：

```bash
# 1. 恢復 v3 版本
cd /workspace/projects/InvestmentLineNotify
cp src/modules/ai/aiClient.v3.backup.mjs src/modules/ai/aiClient.mjs

# 2. 回滾 git（如已 commit）
git revert HEAD

# 3. 重啟服務
pm2 restart all

# 4. 驗證 v3 正常運作
npm test
```

### Phase 5 後 Rollback

若部署後發現問題：

```bash
# 1. Git 回滾到 Phase 1 完成時的 commit
git reset --hard 03175bd

# 2. 重新安裝依賴
npm install

# 3. 重啟服務
pm2 restart all
```

### Rollback 決策標準

- **立即回滾**: AI 呼叫完全失效、traces 無法寫入
- **暫停觀察**: 測試失敗率 > 10%、performance 下降 > 20%
- **可接受**: 個別測試失敗 < 3%、minor bugs

---

## 開發日誌

### 2026-09-08 (Phase 1 完成 + Phase 2 啟動後暫停)

- ✅ **Phase 1 完成**: 環境準備
  - 安裝 v5 SDK packages (`@langfuse/tracing@5.11.0` 等)
  - 創建 `langfuseClient.mjs` 統一初始化模組
  - 創建完整 migration plan
  - 備份 `aiClient.mjs` → `aiClient.v3.backup.mjs`
  - Git commits: `03175bd` (Phase 1), `c78b599` (plan update)
- ⏸️ **Phase 2 啟動後暫停**: 評估後決定分多個 session 完成
  - **評估結論**: 752 行核心邏輯 + 899 行測試，需 6-8 小時專注開發
  - **決策**: 保持 Phase 1 clean state，下次 session 全力投入 Phase 2
  - 移除臨時檔案：`aiClient.wrapper.mjs`, `aiClient.v5.temp.mjs`
- **實際工時**: 2 小時

---

## 參考文件

### 官方文件

- [Langfuse v4 Migration Guide](https://github.com/langfuse/skills/blob/main/skills/langfuse/references/v4-project-migration.md)
- [Langfuse v5 SDK Documentation](https://langfuse.com/docs/sdk/typescript/guide)
- [OpenTelemetry JS Documentation](https://opentelemetry.io/docs/instrumentation/js/)
- [Langfuse Cloud Compatibility Matrix](https://langfuse.com/docs/compatibility)

### 內部文件

- `src/modules/ai/langfuseClient.mjs` - v5 初始化與封裝
- `src/modules/ai/aiClient.v3.backup.mjs` - v3 備份（可參考）
- `package.json` - 依賴版本

---

## Next Action

**Phase 2 準備就緒，等待啟動**

當你準備好時，請告訴我：「**開始 Phase 2**」

我會執行以下步驟：

1. 重構 `aiClient.mjs` imports
2. 重構 `resolveChatPrompt()` 函數
3. 重構 `callAI()` 核心函數
4. 更新 `aiClient.test.mjs` mock
5. 執行測試驗證
6. Git commit

預計完成時間：**6-8 小時**
