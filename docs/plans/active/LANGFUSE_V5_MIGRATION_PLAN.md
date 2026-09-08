# Langfuse v3 → v5 Migration Plan (分階段執行)

> **建立日期**: 2026-09-08  
> **Deadline**: 2026-11-16 (Langfuse Cloud v3 sunset)  
> **總工作量**: 15-20 小時  
> **狀態**: ⏸️ Phase 1 完成，等待 Phase 2 啟動

---

## 📋 Migration 總覽

### 目標

將 Langfuse SDK 從 `langfuse@3.38.20` 遷移到 `@langfuse/tracing@5.11.0` + `@langfuse/otel@5.11.0`，確保 2026-11-16 Langfuse Cloud 強制切換前完成。

### 核心變更

| 層面           | v3 (舊)                            | v5 (新)                                                     |
| :------------- | :--------------------------------- | :---------------------------------------------------------- |
| **套件名**     | `langfuse`                         | `@langfuse/tracing` + `@langfuse/otel` + `@langfuse/client` |
| **Trace API**  | `langfuse.trace()`                 | `observe()` decorator / OpenTelemetry Span                  |
| **Generation** | `trace.generation()`               | `observe(fn, { as_type: "generation" })`                    |
| **Score**      | `langfuse.score({ traceId, ... })` | `LangfuseAPIClient.score.create()`                          |
| **Prompt**     | `langfuse.getPrompt()`             | `LangfuseAPIClient.prompts.get()`                           |
| **Flush**      | `langfuse.flushAsync()`            | `flush()` from `@langfuse/tracing`                          |

---

## 📦 Phase 1: 環境準備 ✅ **完成 (2026-09-08)**

### 完成項目

- [x] 安裝 v5 SDK 套件
  ```bash
  npm install @langfuse/tracing @langfuse/otel @langfuse/core @langfuse/client --save
  ```
- [x] 創建 `src/modules/ai/langfuseClient.mjs` 初始化模組
- [x] 創建 migration plan 文件
- [x] 備份 `aiClient.mjs` 為 `aiClient.v3.backup.mjs`

### 產出物

- `src/modules/ai/langfuseClient.mjs` (新建)
- `docs/plans/active/LANGFUSE_V5_MIGRATION_PLAN.md` (新建)
- `src/modules/ai/aiClient.v3.backup.mjs` (備份)

### 驗證結果

- ✅ 套件安裝成功，無 peer dependencies 衝突
- ⚠️ Node.js v20 vs `ky@2.0.2` 需要 Node >= 22 的 warning（暫時忽略）

---

## 🔧 Phase 2: `aiClient.mjs` 核心遷移 ⏸️ **待啟動**

### 目標

重構 752 行的 `aiClient.mjs`，從 v3 API 改用 v5 的 OpenTelemetry-based API。

### 執行範圍

1. **Trace 初始化重構** (Lines 68-104)
   - v3: `new Langfuse({ ... })` singleton
   - v5: `langfuseExporter` + `langfuseClient` from `langfuseClient.mjs`

2. **`callAI()` 函數重構** (Lines 377-640)
   - v3: `langfuse.trace()` → `trace.generation()` → `generation.end()`
   - v5: `observe(fn, { as_type: "generation", name })` decorator

3. **Langfuse Prompt 管理** (Lines 289-349)
   - v3: `langfuse.getPrompt()`
   - v5: `langfuseClient.prompts.get()`

4. **Flush 機制** (Lines 84-105, 582, 635)
   - v3: `langfuse.flushAsync()`
   - v5: `flush()` from `@langfuse/tracing`

### 預估工作量

- **開發時間**: 4-6 小時
- **測試時間**: 2 小時
- **總計**: 6-8 小時

### 驗收標準

- [ ] `aiClient.mjs` 所有 Langfuse 呼叫改用 v5 API
- [ ] `aiClient.test.mjs` 單元測試更新並全綠
- [ ] 手動測試：呼叫 `callAI()` 確認 Langfuse Cloud 正確顯示 trace

### 風險與緩解

| 風險                                | 影響           | 緩解策略                              |
| :---------------------------------- | :------------- | :------------------------------------ |
| OpenTelemetry 語意不明              | Trace 結構錯誤 | 先建立 minimal 測試案例驗證 span tree |
| v5 `observe()` decorator 用法不熟悉 | 功能缺失       | 參考官方文件 + 小範圍測試             |
| 測試覆蓋率下降                      | Bug 漏網       | 確保 899 行測試全數更新               |

---

## 🎯 Phase 3: Score API 遷移 🔜 **等待 Phase 2 完成**

### 目標

將 13 處 `langfuse.score()` 呼叫遷移到 v5 API。

### 影響檔案

1. `src/modules/ai/aiCoach.mjs` (7 處)
2. `src/modules/ai/llmJudge.mjs` (2 處)
3. `src/modules/ai/periodReportAgent.mjs` (1 處)
4. `src/modules/ai/ruleOptimizerAgent.mjs` (1 處)
5. `src/scheduler/newsFetch.mjs` (1 處)
6. `src/runNewsFetch.mjs` (1 處)

### 遷移方案

**Before (v3)**:

```javascript
await langfuse.score({
  traceId,
  name: "Schema_Validation",
  value: 1,
  comment: "JSON parse success",
});
```

**After (v5)**:

```javascript
import { writeLangfuseScore } from "./langfuseClient.mjs";

await writeLangfuseScore({
  traceId,
  name: "Schema_Validation",
  value: 1,
  comment: "JSON parse success",
});
```

### 預估工作量

- **開發時間**: 3-4 小時（搜尋、替換、測試）
- **測試時間**: 1 小時
- **總計**: 4-5 小時

### 驗收標準

- [ ] 所有 13 處 `langfuse.score()` 改用 `writeLangfuseScore()`
- [ ] 對應測試檔案更新
- [ ] 單元測試全綠

---

## 🧪 Phase 4: 測試檔案更新 🔜 **等待 Phase 3 完成**

### 目標

更新 6 個測試檔案的 mock 結構，從 v3 API 改為 v5 API。

### 影響檔案

1. `src/modules/ai/aiClient.test.mjs` (899 行)
2. `src/modules/ai/aiCoach.test.mjs` (1000+ 行)
3. `src/modules/ai/llmJudge.test.mjs`
4. `src/test/integration/aiPrompt.test.mjs`
5. `src/test/unit/scheduler/newsFetch.test.mjs`

### Mock 更新範例

**Before (v3)**:

```javascript
vi.mock("langfuse", () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    trace: vi.fn(),
    flushAsync: vi.fn(),
    score: vi.fn(),
  })),
}));
```

**After (v5)**:

```javascript
vi.mock("@langfuse/tracing", () => ({
  observe: vi.fn((fn) => fn),
  updateActiveObservation: vi.fn(),
  flush: vi.fn(),
}));

vi.mock("@langfuse/client", () => ({
  LangfuseAPIClient: vi.fn().mockImplementation(() => ({
    prompts: { get: vi.fn() },
    score: { create: vi.fn() },
  })),
}));
```

### 預估工作量

- **開發時間**: 2-3 小時
- **測試時間**: 2 小時
- **總計**: 4-5 小時

### 驗收標準

- [ ] 所有測試檔案 mock 更新
- [ ] `npm test` 全綠（55 個測試檔案）
- [ ] 測試覆蓋率不下降

---

## ✅ Phase 5: 驗證與部署 🔜 **等待 Phase 4 完成**

### 5.1 Integration 測試

- [ ] 執行 `npm test` 全綠
- [ ] 執行 `dailyCheck` 手動測試
- [ ] 確認 Langfuse Cloud trace 正確顯示

### 5.2 Smoke Test

- [ ] 執行新聞採集流程
- [ ] 執行 AI Coach 生成
- [ ] 確認所有 scores 正確寫入

### 5.3 部署前檢查

- [ ] Production build 成功
- [ ] E2E 測試全綠
- [ ] 移除 v3 套件: `npm uninstall langfuse`
- [ ] 移除備份檔案: `rm src/modules/ai/aiClient.v3.backup.mjs`
- [ ] Git commit 並 push

### 預估工作量

- **測試時間**: 2 小時
- **部署時間**: 30 分鐘
- **總計**: 2.5 小時

---

## 📊 執行進度追蹤

| Phase                          | 狀態            | 開始日期   | 完成日期   | 負責人 |
| :----------------------------- | :-------------- | :--------- | :--------- | :----- |
| Phase 1: 環境準備              | ✅ 完成         | 2026-09-08 | 2026-09-08 | Agent  |
| Phase 2: aiClient.mjs 核心遷移 | ⏸️ 待啟動       | -          | -          | TBD    |
| Phase 3: Score API 遷移        | 🔜 等待 Phase 2 | -          | -          | TBD    |
| Phase 4: 測試檔案更新          | 🔜 等待 Phase 3 | -          | -          | TBD    |
| Phase 5: 驗證與部署            | 🔜 等待 Phase 4 | -          | -          | TBD    |

**圖例**: ✅ 完成 | ⏸️ 待啟動 | 🔄 進行中 | 🔜 等待前一階段 | ❌ 停滯

---

## 📅 Timeline 推算

假設每週投入 6-8 小時開發：

| 週次       | 日期範圍           | 執行 Phase | 累積完成度 |
| :--------- | :----------------- | :--------- | :--------- |
| Week 0     | 2026-09-08         | Phase 1 ✅ | 10%        |
| Week 1     | 2026-09-09 ~ 09-15 | Phase 2    | 40%        |
| Week 2     | 2026-09-16 ~ 09-22 | Phase 3    | 65%        |
| Week 3     | 2026-09-23 ~ 09-29 | Phase 4    | 85%        |
| Week 4     | 2026-09-30 ~ 10-06 | Phase 5    | 100%       |
| **Buffer** | 2026-10-07 ~ 11-16 | 延遲緩衝   | -          |

**距離 deadline 還有**: 69 天（充足）

---

## 🚨 風險管理

| 風險                         | 機率 | 影響            | 緩解策略            | 觸發條件          |
| :--------------------------- | :--- | :-------------- | :------------------ | :---------------- |
| Node.js 版本不足 (v20 < v22) | 中   | v5 SDK 無法運作 | 升級 Node.js 到 v22 | 發現 runtime 錯誤 |
| OpenTelemetry 學習曲線       | 高   | Phase 2 延遲    | 預留 buffer 時間    | Phase 2 超過 2 天 |
| 測試覆蓋率下降               | 中   | 漏網 bug        | TDD：測試先行       | 測試失敗率 > 5%   |
| 11-16 deadline 壓力          | 低   | 強制部署不完整  | 提前 2 週完成       | 10 月底未完成     |

---

## 📝 開發日誌

### 2026-09-08

- ✅ 完成 Phase 1: 環境準備
  - 安裝 v5 SDK packages
  - 創建 `langfuseClient.mjs`
  - 創建 migration plan
  - 備份 `aiClient.mjs`
- ⏸️ Phase 2 待啟動

---

## 🔗 參考文件

- [Langfuse v4 Migration Guide](https://github.com/langfuse/skills/blob/main/skills/langfuse/references/v4-project-migration.md)
- [Langfuse v5 SDK Documentation](https://langfuse.com/docs/sdk/typescript/guide)
- [OpenTelemetry JS Documentation](https://opentelemetry.io/docs/instrumentation/js/)

---

## Next Action

**等待 Han 啟動 Phase 2**

當你準備好時，請告訴我：「開始 Phase 2」，我會開始 `aiClient.mjs` 核心遷移。
