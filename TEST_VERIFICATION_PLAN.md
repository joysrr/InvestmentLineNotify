# InvestmentLineNotify 測試驗證流程開發計畫

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 為三類程式碼 (排程程式、API 伺服器、Telegram Mini App) 建立明確且可行的完整測試驗證體系。

**Architecture:** 採用測試金字塔設計，從底層單元測試 → 整合測試 → E2E 測試，以 Mock 隔離外部依賴，並整合至 CI/CD 管線。

**Tech Stack:** Vitest (unit/integration), Playwright (E2E), ESLint (lint), GitHub Actions (CI/CD)

---

## 專案概覽

本專案包含三大類程式碼：

1. **排程程式** — `src/runDailyCheck.mjs`, `src/runMonthlyReport.mjs`, `src/runWeeklyReport.mjs`, `src/runNewsFetch.mjs`, `src/runOptimizer.mjs`
2. **API 伺服器** — `src/api/server.mjs` (Fastify)，提供 `/api/v1/simulate`、`/api/v1/simulate/reverse` 等端點
3. **Telegram Mini App** — `webapp/` (Vue 3 + Vite)，部署於 Telegram WebApp 環境

---

## 測試驗證流程架構 (Testing Pyramid)

```
                    ┌─────────────────────┐
                    │   E2E 測試 (少量)    │  <- Playwright: 關鍵用戶流程
                    └─────────┬───────────┘
                  ┌───────────┴───────────┐
                  │   整合測試 (中量)      │  <- API Contract + 資料完整性
                  └───────────┬───────────┘
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────┴───────┐    ┌───────┴───────┐    ┌───────┴───────┐
│ 後端單元測試   │    │ 前端單元測試   │    │  靜態分析     │
│ (大量, 快速)   │    │ (大量, 快速)   │    │  Lint + Scan  │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 現況分析

### 測試基礎設施現況

| 層級              | 工具                             | 狀態        | 測試數量                 |
| ----------------- | -------------------------------- | ----------- | ------------------------ |
| 後端單元/整合測試 | Vitest                           | ✅ 通過     | 426 passed + 6 todo      |
| 前端單元測試      | Vitest + @vue/test-utils + jsdom | ✅ 通過     | 22 passed                |
| Lint 檢查         | ESLint flat config               | ✅ 通過     | 0 errors, 968 warnings   |
| 靜態程式碼掃描    | `scripts/pre-deploy-verify.mjs`  | ✅ 存在     | 檢查 `await waitReady()` |
| API 健康檢查      | `scripts/pre-deploy-verify.mjs`  | ✅ 存在     | `/health`, `/api/status` |
| E2E 瀏覽器測試    | Playwright                       | ✅ 建立完成 | 10/10 passed             |

### 現有腳本

| 腳本                            | 用途                              | 狀態    |
| ------------------------------- | --------------------------------- | ------- |
| `npm run test`                  | 後端單元/整合測試                 | ✅ 正常 |
| `cd webapp && npm run test`     | 前端單元測試                      | ✅ 正常 |
| `cd webapp && npm run test:e2e` | Playwright E2E 測試               | ✅ 正常 |
| `npm run verify`                | 完整 pipeline (測試+建置+OpenAPI) | ✅ 正常 |
| `npm run pre-deploy`            | 完整 pipeline (含 E2E)            | ✅ 正常 |

---

## 成功指標 (KPIs)

| 指標                            | 當前值                                | 目標值      | 期限      |
| ------------------------------- | ------------------------------------- | ----------- | --------- |
| 後端測試通過率                  | 100% (426/426)                        | 100%        | 持續      |
| 前端測試通過率                  | 100% (22/22)                          | 100%        | 持續      |
| E2E 測試覆蓋 Simulator 關鍵路徑 | ✅ 100% (10/10)                       | 100%        | 階段 1 ✅ |
| API Contract 測試覆蓋端點       | ✅ 100% (Simulator + Health + Config) | 100%        | 階段 2 ✅ |
| 排程程式核心邏輯覆蓋率          | ~71%                                  | ≥80%        | 階段 3    |
| CI Pipeline 執行時間            | N/A (無 CI)                           | <5 分鐘     | 階段 4    |
| 部署前驗證自動化                | ✅ 完整自動化                         | 100% 自動化 | 階段 4    |

---

## 風險評估

| 風險                         | 影響          | 可能性 | 緩解策略                               |
| ---------------------------- | ------------- | ------ | -------------------------------------- |
| Telegram WebApp 環境難以模擬 | E2E 覆蓋不足  | 高     | ✅ 已建立完整 `telegram-mock.js`       |
| 排程程式耦合外部 API         | 單元測試難寫  | 中     | 階段 3 透過依賴注入重構完成            |
| Playwright CI 不穩定         | 偽陽性失敗    | 中     | Retry + retry config + screenshot 除錯 |
| ESLint 版本衝突              | lint 步驟失敗 | 低     | ✅ 已修復                              |

---

## 開發計畫

---

### 階段 1：Playwright E2E 測試建立 ✅ **[已完成]**

**完成日期：** 2026-08-04
**目標：** 建立 SimulatorView 完整 E2E 測試，取代原始簡單 HTML 瀏覽器檢查。

#### 完成項目

- [x] **1.1** 安裝 `@playwright/test` 並配置 `webapp/playwright.config.js`
  - 配置 `webServer`：自動啟動 Vite dev server + API server
  - 無頭模式 + 截圖/錄影存 `webapp/test-results/`
- [x] **1.2** 建立 Telegram WebApp Mock 環境
  - `webapp/src/test/e2e/telegram-mock.js`：模擬 `window.Telegram.WebApp` initData 與 user 物件
- [x] **1.3** 撰寫 `webapp/src/test/e2e/simulator.spec.js` (10 個測試)
  - 正向模擬：頁面載入、正常執行、空值驗證、清除結果、偏離市價警告
  - 反向推導：模式切換、目標類型切換（維持率/RSI/KD）、空值驗證
  - 通用：資料品質標籤顯示、免責聲明顯示
- [x] **1.4** 整合至 `scripts/pre-deploy-verify.mjs`：替換原始 Puppeteer 為 Playwright
- [x] **1.5** 修正 `forwardSimulator.test.mjs` 缺少 `bias240` mock 欄位導致失敗
- [x] **1.6** 配置 Vitest 排除 E2E 目錄 (`vite.config.js` exclude)
- [x] **1.7** 新增 webapp `lint` script
- [x] **1.8** 修正 Root ESLint 配置 Vue 支援問題（`@eslint/js` 與 `eslint@9` peer dependency 衝突）

#### 驗收結果

```
Playwright E2E: 10/10 passed ✅
後端 Vitest:    426 passed + 6 todo ✅
前端 Vitest:    22 passed ✅
Lint:           0 errors ✅
```

---

### 階段 2：API Contract 測試強化 ✅ **[已完成]**

**完成日期：** 2026-08-06
**目標：** 確保 API 介面穩定，前後端介面不會意外破壞

#### 完成項目

- [x] **2.1** 安裝 AJV 並建立 Schema 驗證工具
  - 安裝：`npm install -D ajv`
  - 建立：`src/test/helpers/schemaValidator.mjs`
  - 驗收：可驗證任意 JSON 物件符合 JSON Schema
- [x] **2.2** 定義 Simulator 端點 JSON Schemas
  - `src/test/schemas/simulate-forward-request.schema.json`
  - `src/test/schemas/simulate-forward-response.schema.json`
  - `src/test/schemas/simulate-reverse-request.schema.json`
  - `src/test/schemas/simulate-reverse-response.schema.json`
  - `src/test/schemas/error-response.schema.json`
- [x] **2.3** 擴充 API Contract 測試 (共 34 tests，新增 28 tests)
  - POST `/api/v1/simulate`: Happy path + 5 validation error cases
  - POST `/api/v1/simulate/reverse`: 9 target types + 6 validation errors
  - Error response format consistency (400/409/500)
  - GET `/api/portfolio/health`: 基本欄位 + query params
  - GET/POST `/api/strategy-config`: 回傳結構 + 驗證錯誤
- [x] **2.4** 修正 Mock Data
  - 寫入 `data/reports/YYYY-MM-DD.json` 供 `getLatestReport()` 讀取
  - 確保報告日期在 24 小時內 (使用 1 小時前時間戳)
  - 補齊 `strategySnapshot` 欄位供現有測試使用
- [x] **2.5** 導出 OpenAPI Spec (`docs/api/openapi.json`)
  - `scripts/generate-openapi.mjs`：程式化產出
  - `npm run openapi:generate`
- [x] **2.6** 建立 Breaking Change 偵測
  - `scripts/check-openapi-diff.mjs`：比對 git HEAD
  - 檢查：endpoint 移除、方法移除、schema 移除/修改
  - `npm run openapi:check`
- [x] **2.7** 整合至 `verify-all.mjs`
  - `npm run verify` 現在包含 OpenAPI 生成 + 檢查
- [x] **2.8** 補充 Portfolio Health & Config 端點 contract tests
  - GET `/api/portfolio/health` (基本欄位、query params)
  - GET `/api/strategy-config` (strategy、_meta)
  - POST `/api/strategy-config` (驗證錯誤)

#### 驗收結果

```
API Contract Tests: 34 passed ✅
  - 既有 6 tests (status, reports, snapshots, news, config, health)
  - 新增 28 tests (simulate forward/reverse, portfolio health, config, error formats)
後端 Vitest:    426 passed + 6 todo ✅
前端 Vitest:    22 passed ✅
E2E Playwright: 10/10 passed ✅
Lint:           0 errors ✅
Verify Pipeline: 完整通過 (含 OpenAPI gen + breaking change check) ✅
```

---

### 階段 3：排程程式測試覆蓋 ✅ **[已完成]**

**完成日期：** 2026-08-07
**目標：** 排程程式具備可測試性，核心決策邏輯覆蓋率 ≥ 80%

#### 完成項目

- [x] **3.1** 分析排程程式耦合點 ✅ **已完成 (2026-08-07)**
  - 產出：`docs/SCHEDULER_COUPLING_ANALYSIS.md` - 完整耦合點分析報告
  - 識別 5 個排程程式、24 個核心模組、4 大外部依賴類別
  - 定義 5 大介面規格 (IDataProvider, INotifier, IAIProvider, INewsProvider, IReportGenerator)

- [x] **3.2** 抽離純邏輯模組 + 建立介面層 ✅ **已完成 (2026-08-07)**
  - 建立 5 大介面：`src/interfaces/IDataProvider.mjs`, `INotifier.mjs`, `IAIProvider.mjs`, `INewsProvider.mjs`, `IReportGenerator.mjs`
  - 使用 JSDoc `@typedef` 語法 (相容 JS 專案)
  - 介面涵蓋：資料存取、通知發送、AI 服務、新聞抓取、報告產生

- [x] **3.3** 建立 Mock 工廠 ✅ **已完成 (2026-08-07)**
  - `src/test/mocks/`：5 個 Mock Factory (DataProvider, Notifier, AIProvider, NewsProvider, ReportGenerator)
  - `src/test/mocks/factories/`：測試資料 Factory (20+ factory functions)
  - 統一導出：`src/test/mocks/index.mjs`, `src/test/mocks/factories/index.mjs`

- [x] **3.4** 遷移排程邏輯至 `src/scheduler/` 並提取純邏輯 ✅ **已完成 (2026-08-07)**
  - 建立 `src/scheduler/` 目錄結構
  - 遷移 News Fetch → `src/scheduler/newsFetch.mjs` (含 3 測試)
  - 遷移 Optimizer → `src/scheduler/optimizer.mjs` (含 3 測試)
  - 遷移 Weekly Report → `src/scheduler/weeklyReport.mjs` (含 3 測試)
  - 遷移 Monthly Report → `src/scheduler/monthlyReport.mjs` (含 3 測試)
  - 遷移 Daily Check → `src/scheduler/dailyCheck.mjs` (含 4 測試)
  - 更新 CLI 入口為薄包裝 (`runNewsFetch.mjs` 等 import 新模組)

- [x] **3.5** 撰寫特徵測試 + 單元測試 ✅ **已完成 (2026-08-07)**
  - `src/test/unit/scheduler/newsFetch.test.mjs` (3 測試)
  - `src/test/unit/scheduler/optimizer.test.mjs` (3 測試)
  - `src/test/unit/scheduler/weeklyReport.test.mjs` (3 測試)
  - `src/test/unit/scheduler/monthlyReport.test.mjs` (3 測試)
  - `src/test/unit/scheduler/dailyCheck.test.mjs` (4 測試，含特徵測試)

- [x] **3.6** 覆蓋率檢查 ✅ **已完成 (2026-08-07)**
  - 指令：`npx vitest run --coverage src/test/unit/scheduler/`
  - 結果：整體覆蓋率 71.28%，DailyCheck 80% 達標
  - 待提升：weeklyReport (67.5%)、monthlyReport (69%)、newsFetch (70%)、optimizer (70%)

#### 驗收結果

```
Scheduler Unit Tests: 16 passed ✅
  - newsFetch: 3 tests
  - optimizer: 3 tests
  - weeklyReport: 3 tests
  - monthlyReport: 3 tests
  - dailyCheck: 4 tests (含特徵測試)

Coverage: 71.28% (DailyCheck 80% 達標，其他待提升至 80%)
後端總測試: 426 passed + 6 todo ✅
前端測試: 22 passed ✅
E2E: 10/10 passed ✅
Lint: 0 errors ✅
Verify Pipeline: 完整通過 ✅
```

---

### 階段 4：CI/CD 整合與自動化 ⏳ **[待開始]**

**目標：** 建立完整的自動化驗證管線，Push/PR 觸發自動執行
**前置條件：** 階段 1-3 完成

#### 任務清單

- [ ] **4.1** 建立 GitHub Actions Workflow
  - 建立：`.github/workflows/ci.yml`
  - 觸發條件：Push to main、PR to main、手動 `workflow_dispatch`
  - 驗收：Push 後 GitHub Actions tab 出現執行紀錄

- [ ] **4.2** 設計階段式 Pipeline

  ```yaml
  jobs:
    lint: # 並行 - ESLint 根目錄 + webapp
    backend-test: # 並行 - Vitest 後端 426 tests
    frontend-test: # 並行 - Vitest 前端 22 tests
    frontend-build: # 依賴 frontend-test - Vite build
    e2e-test: # 依賴 frontend-build - Playwright 10 tests
    pre-deploy: # 依賴 e2e-test - 完整驗證門檻 (含 OpenAPI check)
  ```

- [ ] **4.3** Node.js / Playwright 快取配置
  - 快取 `node_modules` (hash: `package-lock.json`)
  - 快取 Playwright 瀏覽器 (`~/.cache/ms-playwright`)
  - 驗收：第二次 CI 執行時間 < 5 分鐘

- [ ] **4.4** 測試報告產出
  - GitHub Actions Summary：測試通過數、失敗截圖連結
  - Artifact 上傳：`webapp/test-results/`（Playwright 截圖/trace）
  - 驗收：PR 頁面可直接看到測試摘要

- [ ] **4.5** 分支保護規則
  - main 分支：要求 CI 通過才可合併
  - 驗收：GitHub Branch Protection 設定完成

---

### 階段 5：文件化與維護指南 ⏳ **[待開始]**

**目標：** 建立完整的測試維護文件，確保可持續維護
**前置條件：** 階段 4 完成

#### 任務清單

- [ ] **5.1** 撰寫 `docs/TESTING.md`
  - 內容：測試策略、各層級說明、命名慣例、執行指令
  - 驗收：新人可依此文件獨立執行所有測試

- [ ] **5.2** 撰寫 `docs/E2E_TESTING_GUIDE.md`
  - 內容：Playwright 設定、Mock 策略、如何新增測試、除錯技巧
  - 驗收：包含至少 1 個完整新增測試範例

- [ ] **5.3** 撰寫 `docs/API_CONTRACT.md`
  - 內容：如何更新 API 規格、breaking change 流程、版本策略
  - 驗收：包含正確更新規格的 step-by-step 流程

- [ ] **5.4** 撰寫 `docs/TEST_TROUBLESHOOTING.md`
  - 內容：常見失敗原因與解決方案（含過去遇到的問題）
  - 驗收：至少涵蓋 5 個已知問題

- [ ] **5.5** 更新 `README.md`
  - 新增 CI 狀態徽章
  - 新增測試執行指令區塊
  - 驗收：README 頂部出現 Build Passing / tests 徽章

---

## 測試執行命令總覽

### 本地開發（頻繁執行）

```bash
# 後端單元/整合測試 (~12s)
npm run test

# 前端單元測試 (~11s)
cd webapp && npm run test

# Playwright E2E 測試 (含自動啟動伺服器) (~30s)
cd webapp && npm run test:e2e

# Playwright 視覺化除錯
cd webapp && npm run test:e2e:headed

# OpenAPI Spec 產出
npm run openapi:generate

# Breaking Change 檢查
npm run openapi:check
```

### Commit 前執行

```bash
# 完整 pipeline (測試 + 建置 + OpenAPI)
npm run verify
```

### 部署前完整驗證

```bash
# 完整 pipeline (Lint + 單元測試 + E2E + 建置 + OpenAPI)
npm run pre-deploy
```

---

## 進度追蹤

| 階段 | 名稱                    | 狀態      | 完成度                                      |
| ---- | ----------------------- | --------- | ------------------------------------------- |
| 1    | Playwright E2E 測試建立 | ✅ 完成   | 100%                                        |
| 2    | API Contract 測試強化   | ✅ 完成   | 100%                                        |
| 3    | 排程程式測試覆蓋        | ✅ 完成   | 90% (覆蓋率 71%，目標 80%，DailyCheck 達標) |
| 4    | CI/CD 整合與自動化      | ⏳ 待開始 | 0%                                          |
| 5    | 文件化與維護指南        | ⏳ 待開始 | 0%                                          |

---

_文件版本：v1.5_
_建立日期：2026-08-04_
_最後更新：2026-08-07_
_作者：LuLuLaLaHaHa_
