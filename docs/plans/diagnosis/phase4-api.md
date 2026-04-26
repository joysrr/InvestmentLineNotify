# Phase 4: API 層 (Fastify Routes, Schema, Guard) 審查與修復計畫

## 診斷結果

### P1 — 中度

- **[P1-9]** `reports.mjs` 使用了 `join()` 但未 import，導致 `ReferenceError`。已補上 `import { join } from "path"`。
- **[P1-10]** `config.mjs` 讀取設定檔失敗時整體拋錯 500。已改為針對各部分進行 `try/catch`，部分缺失時回傳 `error: "file not found"`，避免靜默回傳破損物件。
- **[P1-11]** `initDataGuard` 驗證成功後未將 `user` 物件附加到 `request`。已將解析出的 `telegramUser` 附加至 `request.telegramUser` 供下游使用。

### P2 — 低度

- **[P2-12]** `contract.mjs` 的 Schema 是純文件物件，未被 Fastify 引用。已將其改寫為標準的 JSON Schema，並掛載至 `/reports` 與 `/report/:date` 路由的 Response Validation。
- **[P2-13]** `GET /api/reports` TTL 雙層 Cache 疊加可能導致更新延遲。已將 `reports.mjs` 的 TTL Cache 時間從 10 秒降為 2 秒，兼顧防禦 I/O 尖峰與即時性。
- **[P2-14]** `server.mjs` 中 `unhandledRejection` 只 log 不 exit。已統一行為，觸發時執行 `process.exit(1)`。

## 實作修復

由 @Backend 針對上述 6 項缺陷完成修復，並由 @Reviewer 與 @QA 完成自動化測試。
