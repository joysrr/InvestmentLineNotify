# useApiRequest 使用指南

`useApiRequest` 統一管理 API 請求的 loading、error、data 與重試行為。

## 基本用法

```js
import { useApiRequest } from "@/composables/useApiRequest.js";
import { fetchReports } from "@/api/index.js";

const { loading, error, data, execute, reset } = useApiRequest(fetchReports);

await execute({ limit: 10 });
```

## Retry

只對暫時性失敗啟用重試。`retry` 是額外重試次數，不包含第一次請求。

```js
const { execute } = useApiRequest(fetchReports, {
  retry: 2,
  retryDelay: 300,
});
```

## Dedup

同一個 composable instance 中，使用相同參數執行中的請求只會呼叫一次 API；兩個呼叫會共用同一個 Promise。

```js
const { execute } = useApiRequest(fetchReports, { dedup: true });

const [first, second] = await Promise.all([
  execute({ limit: 10 }),
  execute({ limit: 10 }),
]);
```

請求完成或失敗後，dedup key 會清除；下一次執行會重新請求。

## Abort

需要取消請求時，啟用 `abort: true`，再呼叫 `cancel()`。這會把 `AbortSignal` 作為最後一個 options 參數傳給 API 函數。

```js
const { execute, cancel } = useApiRequest(fetchReports, { abort: true });

const request = execute({ limit: 10 });
cancel();

try {
  await request;
} catch (requestError) {
  if (requestError.name === "AbortError") {
    // 使用者主動取消，不顯示一般錯誤提示
  }
}
```

未啟用 `abort` 時，`apiFunc` 的既有參數契約不變。

## 選用原則

- 新增 View：預設使用 `useApiRequest`。
- 既有 View：只有重構或需求明確時才遷移。
- 查詢請求：可搭配 `retry`、`dedup`、`abort`。
- 寫入請求：目前直接使用 `apiFetch`；等出現重複需求再抽出 mutation composable。
- 不要為單次請求額外建立 wrapper；`apiFetch` 已負責 API 基礎錯誤處理。

## API 選項

| 選項                 |    預設 | 用途                     |
| -------------------- | ------: | ------------------------ |
| `showSuccessMessage` | `false` | 成功時顯示 toast         |
| `showErrorMessage`   |  `true` | 最終失敗時顯示 toast     |
| `retry`              |     `0` | 額外重試次數             |
| `retryDelay`         |   `300` | 重試間隔，單位毫秒       |
| `dedup`              | `false` | 共用相同參數的執行中請求 |
| `abort`              | `false` | 啟用 `AbortController`   |

`execute()` 仍會在最終失敗時拋出原始錯誤；呼叫端可用 `try/catch` 或交由頁面錯誤處理流程處理。

## 驗證

```bash
cd webapp
npx vitest run src/composables/useApiRequest.test.js
```

目前測試涵蓋：基本狀態、成功/失敗、retry、dedup、abort、callback、reset、batch request。*
