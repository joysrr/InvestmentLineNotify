# Tech Stack: Node.js (ESM Strict)

## 模組與語法標準
1. **純 ESM 環境**：專案全面採用 ECMAScript Modules (`.mjs`)。
   - 必須使用 `import`/`export`。
   - 絕對禁止使用 `require()` 或 `module.exports`。
   - 本地檔案引入時，路徑尾端必須明確包含 `.mjs`（例如 `import x from './utils.mjs'`）。
2. **非同步處理 (Async/Await)**：全面使用 Async/Await 取代傳統的 Promise `.then()`。必須妥善處理 `try/catch` 捕捉例外，防止 Unhandled Promise Rejection。

## 並行與執行緒安全
1. **鎖定機制 (Locking)**：由於系統透過 Crontab 觸發多個 Runner (如 `runDailyCheck.mjs`, `runNewsFetch.mjs`) 並同時運行 Telegram Bot 事件，所有排程與狀態變更任務必須使用 `src/modules/bot/runnerLock.mjs`，以防競爭條件 (Race Condition) 損壞資料。
2. **無狀態 (Stateless) 執行**：排程腳本應設計為無狀態。每次啟動時讀取快取，執行完畢後寫入並關閉，不可將長期狀態保留於全域變數中。

## 網路連線與防錯誤 (Network & Error Handling)
1. **全面禁用無 Timeout 原生 Fetch**：
   - 專案內所有外部 API 呼叫，**絕對禁止**直接使用原生的 `await fetch(url)`。
   - 必須統一使用專案封裝的 `fetchWithTimeout`，或強制配置 `AbortController`，並綁定最高不超過 30 秒的逾期限制。
2. **重試機制 (Retry Mechanism)**：
   - 任何外部資料拉取的 Retry 邏輯，必須將 Node.js 底層網路異常 (如 `ETIMEDOUT`, `ECONNRESET`, `fetch failed`) 納入可重試白名單，不可因非 HTTP 特定的錯誤代碼就放棄重試。
3. **並發防護 (Concurrency)**：
   - 使用 `Promise.all` 時，必須評估是否允許單點失敗。如果允許部分成功，強制改用 `Promise.allSettled()` 以阻斷骨牌效應。