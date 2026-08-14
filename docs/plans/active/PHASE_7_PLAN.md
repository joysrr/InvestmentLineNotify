# Phase 7 計畫：品質收尾與上線準備 (Quality Finalization & Pre-Launch)

## 目標

解決 Phase 6 遺留的技術債與深層隱患，確保系統在真實 Production 環境下的穩定性與安全性，並修復所有致命語法錯誤 (ESLint Errors)。放棄追逐無意義的虛榮指標，轉向實質的系統防禦。

---

## 執行藍圖與策略 (基於 `/grilling` 決策)

### 1. 測試覆蓋率策略調整 (解決「虛榮指標」問題)

- **現狀**：62.6% 分支覆蓋率，距離原定 65% 尚缺 2.4%。
- **決策**：**下修分支覆蓋率最低門檻至 60% (已達標)**。
- **行動**：
  - 放棄為 `server.mjs` (Fastify setup) 與 `marketData.mjs` (外部 I/O) 撰寫高耦合、低價值的 Mock 測試。
  - 將省下的時間預算轉移至 Auth 驗證與 E2E/API 整合測試。

### 2. Auth 邏輯真實測試 (解決「掩耳盜鈴」問題)

- **現狀**：Dogfood 測試依賴 `TEST_MODE=true` 繞過 `initDataGuard` 的 HMAC-SHA256 驗證。
- **決策**：**實作真實的 HMAC-SHA256 Payload 產生器**。
- **行動**：
  - 移除或嚴格限縮 `TEST_MODE` 在整合測試中的使用。
  - 開發 `generateMockInitData(botToken, userPayload)` 工具函式。
  - 讓 Dogfood 腳本使用測試用的 Bot Token 簽發合法憑證，確保 `initDataGuard` 的核心驗證邏輯 (簽章比對、過期時間檢查) 在每次測試中都被真實行使。

### 3. 資源洩漏防禦 (解決「Vitest Pending Handles」問題)

- **現狀**：Vitest worker 因 pending handles 以 exit code 1 退出，被誤認為 cosmetic issue。
- **決策**：**實作全域 Teardown 機制**。
- **行動**：
  - 建立全域的 `vitest.setup.mjs`。
  - 在 `afterAll` hook 中，強制執行資源回收：關閉 Logger file streams (Pino)、斷開 SQLite (`better-sqlite3`) 連線、關閉 Fastify server instance。
  - 確保 Vitest 能以 exit code 0 乾淨退出，防止真實的 Connection/Memory Leak 掩蓋在測試雜音中。

### 4. ESLint 致命錯誤修復與 Linter 適配 (解決「弄髒 Codebase」問題)

- **現狀**：存在 12 個致命 Errors (包含 `no-undef`, `no-case-declarations`, `vue/no-use-v-if-with-v-for`) 與 1700+ 個 Warnings。
- **決策**：**修復致命 Errors，放寬 Warnings 的工具鏈限制**。
- **行動**：
  - **修復 Errors** (最高優先級)：
    - 補齊 Vue SFC 中的 `onBeforeUnmount`, `ElMessage` import (或配置 auto-import 白名單)。
    - 修復 `no-case-declarations` (使用 `{}` 建立 block scope)。
    - 重構 `v-if` 與 `v-for` 混用的 anti-pattern (改用 computed property)。
  - **適配 Warnings**：
    - 不修改業務代碼 (不加海量 `_` 前綴)。
    - 在 `eslint.config.js` 中正確配置 Vue 3 auto-imports 的 global globals。
    - 針對 Vue SFC 放寬特定無意義的未使用變數檢查。

---

## 執行里程碑

1. **Phase 7.1: ESLint 致命錯誤殲滅 (預估 1-2h)**
   - 修復 12 個 Runtime Errors。
   - 調整 `eslint.config.js` 使 Warnings 降至可控範圍 (<100) 或正確被忽略。
2. **Phase 7.2: 全域資源回收機制 (預估 1-2h)**
   - 建立 `vitest.setup.mjs`，消除 Vitest worker exit code 1。
3. **Phase 7.3: Auth 防禦網重建 (預估 2-3h)**
   - 實作 HMAC 簽名產生器，替換 `TEST_MODE` 繞過機制，執行 Dogfood 驗證。
4. **Phase 7.4: 最終上線驗證 (預估 1h)**
   - 執行完整 CI 流程，確保零錯誤、零洩漏、Auth 啟動。
