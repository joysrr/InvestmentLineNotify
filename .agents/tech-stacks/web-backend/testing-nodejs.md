# Tech Stack: Node.js Testing Framework

> 純通用技術棧；專案特定的測試根目錄 / fixtures 位置 / 禁止呼叫的實際 API 清單 → 參照 §專案特化參照 對應 workspace 欄位。

## 測試開發準則 (Testing Standards)

1. **測試框架選擇**：
   - 一律採用 Node.js 原生的 `node:test` 與 `node:assert` 模組；**不引入** Jest / Mocha / Vitest，保持輕量化。
   - 覆蓋率工具統一採用 `c8`（原生相容）；輸出格式為 `text` + `lcov`（供 CI 工具分析）。

2. **測試檔案命名與位置**：
   - 針對原始碼 `<source_root>/xxx.mjs` 的單元測試，對應檔案必須命名為 `<test_root>/xxx.test.mjs`。
   - 測試檔案以業務模組組織，而非以測試類型組織（避免 fixture 路徑混亂）。
   - 整合測試以 `.integration.test.mjs` 後綴，便於 CI 分層執行。

3. **Mocking (模擬依賴)**：
   - **絕對不可**在測試中呼叫真實的外部 API（Telegram / Google Sheets / 第三方付費服務等）— 清單由 workspace `TECH_STACK.external_dependency` 決定。
   - **絕對不可**在測試中寫入 workspace `PATHS.data_root` 下的正式資料；若需寫入測試資料，必須導向測試專用臨時目錄。
   - 優先使用 `node:test` 的 `mock.method()` 攔截外部依賴；或讀取**專案指定的 fixtures 目錄**下的靜態 JSON 作為假資料。

4. **測試涵蓋範圍 (Coverage Goals)**：
   - **Happy Path**：正常資料輸入必須得到預期結果。
   - **Edge Cases**：`null` / `undefined` / 空陣列 / 極端數值 / NaN / Infinity 等；系統不可崩潰，必須拋出預期的 Error 並被捕捉。
   - **Error Paths**：外部依賴失敗（網路錯誤 / 檔案不存在 / 授權過期）時的降級行為。
   - **Concurrency Paths**（若涉及並行）：多 worker 同時觸發同一鎖的行為。

5. **測試獨立性**：
   - 每個 `test()` 必須能獨立執行，不依賴前一測試的副作用。
   - 共用初始化改用 `beforeEach` / `afterEach`；禁止使用全域變數跨測試傳遞狀態。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
tech_stack: testing-nodejs
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 tech-stack 的具體測試根目錄 / fixtures 位置 / 實際 API 清單皆由 workspace 注入；請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| Tech-stack 概念 | Workspace 欄位 | Fallback 行為 |
|---|---|---|
| 測試根目錄 | `PATHS.test_root` | 缺失 → 警告；`@Lead` 預設 `test/` |
| 測試框架選擇 | `TECH_STACK.testing_framework` | 缺失 → 警告；`@Lead` 假設 `node:test` |
| 不可呼叫的實際 API 清單 | `TECH_STACK.external_dependency` | 缺失 → 警告；`@Lead` 預設所有外部依賴均 mock |
| 測試禁止寫入的資料根 | `PATHS.data_root` | 缺失 → 警告；測試仍應避免寫入任何生產路徑 |

**引用規範**：本 tech-stack 描述**測試原則與覆蓋率目標**；workspace 描述**具體路徑與禁呼叫清單**。
