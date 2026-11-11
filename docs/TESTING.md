---
type: tutorial
status: current
last_updated: 2026-09-11
related_code:
  - tests/
tags:
  - testing
  - vitest
  - unit-test
wiki_links: []
---

# InvestmentLineNotify 測試指南

> **版本**：v1.0  
> **更新日期**：2026-08-08  
> **適用對象**：所有開發人員、維護者

---

## 1. 測試策略總覽

本專案採用**測試金字塔**架構，三層級測試各司其職：

```
                    ┌─────────────────────┐
                    │   E2E 測試 (少量)    │  ← Playwright: 關鍵用戶流程
                    │      10 tests       │
                    └─────────┬───────────┘
                  ┌───────────┴───────────┐
                  │   整合測試 (中量)      │  ← API Contract + 資料完整性
                  │      34 tests         │
                  └───────────┬───────────┘
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────┴───────┐    ┌───────┴───────┐    ┌───────┴───────┐
│ 後端單元測試   │    │ 前端單元測試   │    │  靜態分析     │
│  426 tests    │    │  22 tests     │    │  Lint + Scan  │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 核心原則

| 原則                  | 說明                                     |
| --------------------- | ---------------------------------------- |
| **TDD 紅-綠-重構**    | 新功能先寫測試，再實作，最後重構         |
| **Mock 隔離外部依賴** | 單元測試不連真實 DB、API、Telegram       |
| **契約優先**          | API 變更需同步更新 Schema + OpenAPI Spec |
| **本地驗證優先**      | `npm run pre-deploy` 必須通過才能部署    |
| **覆蓋率門檻**        | 後端核心邏輯 ≥ 80%，新增程式碼 100%      |

---

## 2. 外部 Agent 資料證據報告

產生可交給外部 Agent 查核的資料證據報告：

```bash
npm run verify:data-evidence
```

輸出檔案：

- `data/verification-reports/YYYY-MM-DD-data-evidence.json`
- `data/verification-reports/YYYY-MM-DD-data-evidence.md`

報告會列出每個已落地數值的：

- 指標背景、單位與資料定義
- provider、dataset、來源狀態與 provenance hash
- 資料本身日期、抓取時間與落地時間
- 更新週期與時效核對依據
- 外部 Agent 應查核的項目與衍生計算說明

**重要限制：** 目前報告是「已落地資料的證據彙整」，不會重新呼叫外部 API，也不會宣稱資料已經被外部核實。報告中的 `verificationScope` 會明確標示這一點。外部 Agent 必須依 provider、日期與核對項目查詢真實來源後，再回填查核結論。

後續若整合 Mini App，應直接重用此報告模型與 JSON 輸出，不要在前端重新定義資料來源或計算規則。

---

## 3. 測試層級詳細說明

### 3.1 後端單元測試 (Vitest)

**位置**：`src/test/unit/`  
**執行**：`npm run test`  
**覆蓋模組**：

- 策略引擎 (`strategyEngine`, `forwardSimulator`, `reverseEngine`)
- 風險控管 (`valuationGuard`, `leverageMonitor`, `marginPolicy`)
- 排程邏輯 (`scheduler/`: `newsFetch`, `optimizer`, `dailyCheck`, `weeklyReport`, `monthlyReport`)
- 工具函式 (`coreUtils`, `retryUtils`, `snapshotCrypto`)

**命名慣例**：

```
src/test/unit/
├── modules/
│   ├── strategy/
│   │   ├── forwardSimulator.test.mjs
│   │   └── reverseEngine.test.mjs
│   └── scheduler/
│       ├── dailyCheck.test.mjs
│       └── newsFetch.test.mjs
└── utils/
    └── coreUtils.test.mjs
```

**Mock 模式**：使用 `src/test/mocks/` 工廠函式建立測試資料

### 2.2 後端整合測試 (Vitest)

**位置**：`src/test/integration/`  
**執行**：`npm run test`  
**測試對象**：

- API Contract 測試 (`apiContract.test.mjs` - 34 tests)
- 資料完整性 (`dataIntegrity.test.mjs` - 5 tests)
- 儲存/通知流程 (`storage.test.mjs`, `notifications.test.mjs`)

### 2.3 前端單元測試 (Vitest + @vue/test-utils + jsdom)

**位置**：`webapp/src/test/`  
**執行**：`cd webapp && npm run test`  
**測試組件**：

- `SimulatorView.vue` - 核心模擬器頁面
- `ReportsView.vue` - 報表頁面
- `SettingsView.vue` - 設定頁面

### 2.4 E2E 測試 (Playwright)

**位置**：`webapp/src/test/e2e/`  
**執行**：`cd webapp && npm run test:e2e`  
**瀏覽器**：Chromium (headless)  
**關鍵路徑**：

- 正向模擬：輸入價格 → 執行 → 檢查結果
- 反向推導：選擇目標 → 反向推導 → 檢查價格
- 資料品質標籤、免責聲明顯示

**Mock 環境**：`telegram-mock.js` 模擬 `window.Telegram.WebApp`

### 2.5 靜態分析

| 工具                    | 指令                    | 標準         |
| ----------------------- | ----------------------- | ------------ |
| ESLint                  | `npm run lint`          | 0 errors     |
| Prettier                | `npm run format`        | 格式一致     |
| OpenAPI Breaking Change | `npm run openapi:check` | 無破壞性變更 |

---

## 3. 測試執行指令速查表

### 本地開發 (頻繁執行)

```bash
# 後端單元/整合測試 (~15s)
npm run test

# 前端單元測試 (~10s)
cd webapp && npm run test

# Playwright E2E 測試 (~35s，含自動啟動伺服器)
cd webapp && npm run test:e2e

# Playwright 有頭模式除錯
cd webapp && npm run test:e2e:headed

# 只跑特定測試檔
npx vitest run src/test/unit/scheduler/dailyCheck.test.mjs

# 只跑特定測試
npx vitest run -t "資料不足時應回傳錯誤"

# 觀看覆蓋率報告
npx vitest run --coverage
```

### Commit 前 (強制)

```bash
# 完整 pipeline (測試 + 建置 + OpenAPI)
npm run verify

# 等同於：
# 1. npm run lint
# 2. npm run test (後端)
# 3. cd webapp && npm run test (前端)
# 4. cd webapp && npm run build
# 5. npm run openapi:generate
# 6. npm run openapi:check
```

### 部署前 (必要)

```bash
# 完整 pipeline (含 E2E)
npm run pre-deploy

# 等同於：
# 1. npm run verify
# 2. cd webapp && npm run test:e2e
```

### 部署

```bash
# 完整部署 (含 pre-deploy 驗證)
npm run deploy

# 只跑驗證不部署 (二次確認)
npm run deploy:dry

# 緊急部署 (跳過 pre-deploy，謹慎使用)
npm run deploy -- --skip-pre
```

---

## 4. 測試資料管理

### Mock 資料工廠

所有測試資料集中在 `src/test/mocks/factories/testDataFactory.mjs`：

```javascript
import {
  createMockReport,
  createMockReports,
  createMockMarketData,
  createMockStrategyConfig,
} from "../mocks/factories/index.mjs";

// 使用方式
const report = createMockReport({ date: "2026-08-08", price0050: 180 });
const reports = createMockReports(30); // 30 份報告
```

### 測試資料原則

| 原則           | 說明                                             |
| -------------- | ------------------------------------------------ |
| **資料真實性** | 從實際 `data/reports/latest.json` 衍生           |
| **時間有效性** | 報告日期必須在 24 小時內 (用 `Date.now() - 1hr`) |
| **完整性**     | 包含 `strategySnapshot` 等必要欄位               |
| **隔離性**     | 每個測試獨立建立資料，不共享狀態                 |

### Mock 介面

使用 `src/test/mocks/index.mjs` 統一導出：

```javascript
import {
  createMockDataProvider,
  createMockNotifier,
  createMockAIProvider,
} from "../mocks/index.mjs";
```

---

## 5. 新增測試檢查清單

新增功能時，請確認：

- [ ] **單元測試**：核心邏輯函數 100% 覆蓋
- [ ] **邊界測試**：空值、極值、錯誤輸入
- [ ] **Mock 完整**：所有外部依賴都有對應 Mock
- [ ] **命名規範**：`describe` + `it` 中文描述清楚
- [ ] **API 契約**：新增端點需加入 Schema + Contract test
- [ ] **E2E 關鍵路徑**：使用者主要流程有 E2E 覆蓋
- [ ] **文件同步**：`TEST_VERIFICATION_PLAN.md` 進度更新
- [ ] **覆蓋率**：`npx vitest run --coverage` 核心模組 ≥ 80%

---

## 6. CI/CD 本地替代方案

本專案不使用 GitHub Actions，**以本地腳本替代**：

| CI 階段       | 本地替代指令                                        |
| ------------- | --------------------------------------------------- |
| Lint          | `npm run lint`                                      |
| Unit Test     | `npm run test`                                      |
| Frontend Test | `cd webapp && npm run test`                         |
| Build         | `cd webapp && npm run build`                        |
| E2E           | `cd webapp && npm run test:e2e`                     |
| API Contract  | `npm run openapi:generate && npm run openapi:check` |
| Pre-deploy    | `npm run pre-deploy`                                |
| Deploy        | `npm run deploy`                                    |

**部署前必須在本機跑完 `npm run pre-deploy` 且全綠燈**。

---

## 7. 疑難排解快速連結

| 問題                  | 解決方案                                                |
| --------------------- | ------------------------------------------------------- |
| 測試失敗：找不到 Mock | 檢查 `src/test/mocks/` 是否有對應 factory               |
| E2E 選不到元素        | 更新 `simulator.spec.js` selector，優先用 `data-testid` |
| API 409 戰報過期      | 更新 Mock 報告日期為 1 小時前                           |
| 覆蓋率不足            | 補測未覆蓋分支，參考 `--coverage` 報告                  |
| Lint 錯誤             | `npm run format` 自動修復，或手動修正                   |

詳細疑難排解請見 `docs/TEST_TROUBLESHOOTING.md`。

---

## 8. 測試數量歷史

| 時間               | 測試數 | 測試文件  | 變化說明               |
| ------------------ | ------ | --------- | ---------------------- |
| 2026-11-11         | 1,897  | 194 files | 當前穩定狀態，全部通過 |
| 之前（約 2026-10） | 1,929  | 未知      | 減少 32 個測試         |

變化原因：

- **P1 移除 (2026-10-28)**：刪除了與 P1 條件加碼邏輯相關的測試，減少約 32 個測試。
- **測試重構**：部分小型測試合併為單一測試案例，文件數與測試數同步減少。

此變化不代表系統品質下降，所有 1,897 個測試皆為綠燈通過。

> 未來測試數量若再有變化，請於此段落追加記錄。
