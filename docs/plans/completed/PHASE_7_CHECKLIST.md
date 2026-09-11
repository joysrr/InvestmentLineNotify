---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# Phase 7 執行清單：品質收尾與上線準備

這份清單定義了 Phase 7 的所有具體工作項目。請逐一透過指令要求 AI 完成各個階段，AI 將在每個階段內部自動執行並提交，不需要中斷確認。

---

## [Phase 7.1] ESLint 致命錯誤殲滅與 Linter 配置適配

**執行指令**: `Goal: 完成 Phase 7.1`

**具體工作**:

1. **修復 12 個致命 Runtime Errors**:
   - `ExportButton.vue`: 修復 switch/case 的 `no-case-declarations` (使用 `{}` 建立 scope)。
   - `BatchPanel.vue`: 匯入缺少的 `detailTitle` 或修復變數範圍。
   - `ParetoScatterChart.vue`, `SensitivityChart.vue`, `TornadoChart.vue`: 從 `vue` 匯入 `onBeforeUnmount`。
   - `BacktestReportView.vue`: 從 `element-plus` 匯入 `ElMessage` 或配置為全域。
   - `SignalCategoryTable.vue`: 修復 `vue/no-use-v-if-with-v-for`，將 `v-if` 過濾邏輯移至 computed property。
2. **適配 Vue 3 Warnings**:
   - 編輯 `eslint.config.js`，針對 Vue 專案特性 (如 `vue/no-unused-vars` 在 setup script 與 template 中的行為) 進行配置調整。
   - 確保不以「修改源碼加前綴 `_`」的方式掩蓋 Warning。

---

## [Phase 7.2] 資源洩漏防禦 (Vitest 全域 Teardown)

**執行指令**: `Goal: 完成 Phase 7.2`

**具體工作**:

1. 建立 `src/test/setup/vitest.setup.mjs`。
2. 實作 `afterAll` hook：
   - 斷開所有的 SQLite 資料庫連線 (mock 或實體)。
   - 關閉 Fastify server instance (如果測試中有啟動)。
   - 強制清空 Pino logger 的非同步寫入緩衝 (flush)。
3. 在 `vitest.config.js` 中註冊此 setup file。
4. 執行 `npx vitest run` 驗證 worker exit code 1 已消失，確認測試能以 exit code 0 乾淨退出。

---

## [Phase 7.3] 建立真實 Auth 防禦網 (HMAC-SHA256)

**執行指令**: `Goal: 完成 Phase 7.3`

**具體工作**:

1. 移除 `initDataGuard.mjs` 中的 `TEST_MODE === 'true'` 盲測後門。
2. 開發測試工具 `src/test/utils/authMock.mjs`，包含 `generateValidInitData(botToken, userPayload)`。
3. 確保該產生器能使用與生產環境相同的 HMAC-SHA256 演算法，並簽發未過期 (時間戳在 5 分鐘內) 的合法 Telegram InitData。
4. 修改現有的 API 整合測試與 Dogfood QA 腳本，讓它們使用這把「真正的鑰匙」來通過 `initDataGuard`，證明大門驗證邏輯有效。

---

## [Phase 7.4] Dogfood 最終驗證與 CI 就緒

**執行指令**: `Goal: 完成 Phase 7.4`

**具體工作**:

1. 準備 Dogfood 環境：設定測試用的 `BOT_TOKEN`。
2. 執行完整的 Dogfood 腳本 (或 API 測試組)。
3. 驗證 Phase 6 回報的 9 High + 6 Medium Bugs 是否真正消失，且伺服器日誌沒有拋出 `[InitDataGuard] Invalid token` 的錯誤。
4. 確認最終的測試覆蓋率 (維持在 60%+ 即可)，測試全過 (exit code 0)。
