---
type: reference
status: reference-only
last_updated: 2026-11-01
related_code:
  - src/api/
tags:
  - api
  - contract
  - rest
wiki_links:
  - [[API Index]]
---

# API 契約管理指南

> **版本**：v1.0  
> **更新日期**：2026-08-08  
> **適用對象**：後端開發、前端整合、API 消費者

---

## 1. 契約優先開發流程

本專案採用 **Contract-First** 策略：

```
API 設計 → JSON Schema → OpenAPI Spec → 程式碼實作 → Contract Test 驗證
```

### 核心檔案

| 檔案                                        | 用途                 | 更新時機                            |
| ------------------------------------------- | -------------------- | ----------------------------------- |
| `src/test/schemas/*.json`                   | JSON Schema 定義     | API 介面變更時                      |
| `docs/api/openapi.json`                     | OpenAPI 3.0 Spec     | `npm run openapi:generate` 自動產出 |
| `src/test/integration/apiContract.test.mjs` | Contract 測試        | Schema 變更時同步更新               |
| `scripts/check-openapi-diff.mjs`            | Breaking Change 偵測 | CI/部署前自動檢查                   |

---

## 2. 如何更新 API 規格

### 步驟 1：修改 JSON Schema

在 `src/test/schemas/` 更新對應檔案：

```bash
# 請求 Schema
src/test/schemas/simulate-forward-request.schema.json
src/test/schemas/simulate-reverse-request.schema.json

# 回應 Schema
src/test/schemas/simulate-forward-response.schema.json
src/test/schemas/simulate-reverse-response.schema.json

# 錯誤 Schema
src/test/schemas/error-response.schema.json
```

### 步驟 2：同步更新 Contract Test

在 `src/test/integration/apiContract.test.mjs` 同步調整測試案例：

```javascript
// 範例：新增欄位後的測試更新
it("回應應包含新欄位 newField", async () => {
  const res = await request.post("/api/v1/simulate").send(validInput);
  expect(res.body).toHaveProperty("newField");
  expect(typeof res.body.newField).toBe("string");
});
```

### 步驟 3：重新產出 OpenAPI Spec

```bash
npm run openapi:generate
# 輸出：docs/api/openapi.json
```

### 步驟 4：檢查 Breaking Change

```bash
npm run openapi:check
# 比對 git HEAD，檢查：
# - endpoint 移除/新增
# - HTTP method 變更
# - Schema required 欄位變更
# - 型別變更
# - enum 值移除
```

### 步驟 5：執行完整驗證

```bash
npm run verify
# 包含：lint + test + build + openapi:generate + openapi:check
```

---

## 3. 現有 API 端點清單

### Simulator 端點

| 端點                       | Method | 描述                     | Request Schema             | Response Schema             |
| -------------------------- | ------ | ------------------------ | -------------------------- | --------------------------- |
| `/api/v1/simulate`         | POST   | 正向模擬 (股價→策略分數) | `simulate-forward-request` | `simulate-forward-response` |
| `/api/v1/simulate/reverse` | POST   | 反向推導 (目標→股價)     | `simulate-reverse-request` | `simulate-reverse-response` |

### 系統端點

| 端點          | Method | 描述     |
| ------------- | ------ | -------- |
| `/health`     | GET    | 健康檢查 |
| `/api/status` | GET    | 系統狀態 |

### Portfolio & Config 端點

| 端點                    | Method | 描述                  |
| ----------------------- | ------ | --------------------- |
| `/api/portfolio/health` | GET    | 投資組合健康度        |
| `/api/strategy-config`  | GET    | 取得策略設定          |
| `/api/strategy-config`  | POST   | 更新策略設定 (需驗證) |

### 報表端點

| 端點                  | Method | 描述         |
| --------------------- | ------ | ------------ |
| `/api/reports`        | GET    | 取得報表列表 |
| `/api/reports/latest` | GET    | 取得最新報表 |

### 快照端點

| 端點                   | Method | 描述             |
| ---------------------- | ------ | ---------------- |
| `/api/snapshots`       | GET    | 取得快照列表     |
| `/api/snapshots/:date` | GET    | 取得指定日期快照 |

---

## 4. Schema 設計規範

### 命名慣例

| 類型     | 慣例                        | 範例                                   |
| -------- | --------------------------- | -------------------------------------- |
| 檔案名   | kebab-case + `.schema.json` | `simulate-forward-request.schema.json` |
| 物件屬性 | camelCase                   | `simulatedPrice0050`                   |
| Enum 值  | PascalCase                  | `MaintenanceRatio`, `GoldenCross`      |
| 錯誤代碼 | UPPER_SNAKE_CASE            | `VALIDATION_ERROR`, `CONFLICT`         |

### 必備欄位

每個 Schema 必須包含：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://investment-line-notify.com/schemas/xxx.json",
  "title": "描述性標題",
  "type": "object",
  "additionalProperties": false,
  "required": [...],
  "properties": { ... }
}
```

### 版本控管

- **Major**：Breaking Change (欄位移除、型別改變、required 變更)
- **Minor**：新增非必要欄位、新增 endpoint
- **Patch**：修正描述、調整範例值

---

## 5. 常見 Schema 模式

### 通用錯誤回應

```json
{
  "type": "object",
  "required": ["error", "message", "statusCode"],
  "properties": {
    "error": {
      "type": "string",
      "enum": ["VALIDATION_ERROR", "CONFLICT", "NOT_FOUND", "INTERNAL_ERROR"]
    },
    "message": { "type": "string" },
    "statusCode": { "type": "integer", "minimum": 400, "maximum": 599 },
    "field": { "type": "string" },
    "details": { "type": "array", "items": { "type": "object" } }
  }
}
```

### 分頁回應

```json
{
  "type": "object",
  "required": ["data", "pagination"],
  "properties": {
    "data": { "type": "array", "items": { "$ref": "..." } },
    "pagination": {
      "type": "object",
      "required": ["page", "limit", "total"],
      "properties": {
        "page": { "type": "integer", "minimum": 1 },
        "limit": { "type": "integer", "minimum": 1, "maximum": 100 },
        "total": { "type": "integer", "minimum": 0 }
      }
    }
  }
}
```

---

## 6. Breaking Change 判定標準

`scripts/check-openapi-diff.mjs` 檢查項目：

| 類型             | 判定為 Breaking                      | 判定為 Non-Breaking                       |
| ---------------- | ------------------------------------ | ----------------------------------------- |
| **Endpoint**     | 移除、路徑變更                       | 新增                                      |
| **Method**       | 移除                                 | 新增                                      |
| **Request Body** | 新增 required、型別收窄、enum 移除值 | 新增 optional 欄位、型別擴寬、enum 新增值 |
| **Response**     | 移除欄位、型別收窄、required 新增    | 新增欄位、型別擴寬                        |
| **Parameters**   | 移除、required 新增、型別收窄        | 新增 optional query/header                |
| **Security**     | 新增認證要求                         | 移除認證要求                              |

---

## 7. 版本發布流程

### 1. 開發階段

- 在 feature branch 修改 Schema + Tests
- 本地 `npm run verify` 通過

### 2. PR 階段

- CI 跑 `npm run verify` (含 `openapi:check` 對比 main)
- Breaking Change 需在 PR 描述說明遷移計畫

### 3. 合併後

- 自動產出新 `openapi.json`
- 版本號遵循 SemVer (package.json version)

### 4. 文件同步

- 更新 `docs/API_CONTRACT.md` (本文件)
- 如有公開 API 文件需同步更新

---

## 8. 前端整合指引

### TypeScript 類型生成 (可選)

```bash
# 使用 openapi-typescript 生成類型
npx openapi-typescript docs/api/openapi.json -o webapp/src/types/api.d.ts
```

### API 呼叫最佳實踐

```typescript
// webapp/src/services/api.ts
import type { SimulateForwardResponse } from "@/types/api";

export async function simulateForward(
  input: SimulateForwardRequest,
): Promise<SimulateForwardResponse> {
  const res = await fetch("/api/v1/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new ApiError(error.message, error.statusCode);
  }

  return res.json();
}
```

### 錯誤處理統一

```typescript
// 所有 API 錯誤統一格式
interface ApiErrorResponse {
  error: "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND" | "INTERNAL_ERROR";
  message: string;
  statusCode: number;
  field?: string;
}
```

---

## 9. 測試契約合規性

### Contract Test 執行

```bash
# 只跑 API Contract 測試
npx vitest run src/test/integration/apiContract.test.mjs

# 應該通過 34 tests
```

### Schema 驗證工具

```javascript
// src/test/helpers/schemaValidator.mjs
import { validateResponse } from "../helpers/schemaValidator.mjs";

// 在測試中使用
const isValid = validateResponse(
  responseBody,
  "simulate-forward-response.schema.json",
);
expect(isValid).toBe(true);
```

---

## 10. 常見問題

| 問題                   | 解決方案                                                      |
| ---------------------- | ------------------------------------------------------------- |
| `openapi:check` 失敗   | 檢查是否有 Breaking Change，需決定是否為 Major 版本或調整設計 |
| Schema 驗證失敗        | 確認回應結構符合 Schema，檢查 required 欄位、型別             |
| 前端類型不同步         | 重新執行 `openapi-typescript` 生成類型                        |
| 新增 endpoint 未被測試 | 在 `apiContract.test.mjs` 加入對應 describe block             |
| Enum 值需擴充          | 屬 Non-breaking，直接在 Schema 加入新值，同步更新前端 enum    |
