# Tech Stack: Node.js Testing Framework

## 測試開發準則 (Testing Standards)
1. **測試框架**：一律採用 Node.js 原生的 `node:test` 與 `node:assert` 模組，不引入額外的 Jest 或 Mocha，以保持輕量化。
2. **測試檔案命名與位置**：
  - 針對 `src/modules/xxx.mjs` 的單元測試，檔案必須命名為 `src/test/xxx.test.mjs`。
3. **Mocking (模擬資料)**：
  - 絕對不可在測試中呼叫真實的 Telegram API 或寫入正式的 `data/` 檔案。
  - 必須使用 `node:test` 的 `mock.method()` 來攔截外部依賴，或讀取 `src/test/fixtures/` 下的靜態 JSON 作為假資料。
4. **測試涵蓋範圍**：
  - **Happy Path**：正常資料輸入必須得到預期結果。
  - **Edge Cases (邊界值)**：輸入 `null`, `undefined`, 空陣列，或極端行情數值（如跌幅 20%），系統不可崩潰，必須拋出預期的 Error。