---
type: plan
status: active
created: 2026-11-07
last_updated: 2026-11-07
tags:
  - api-inventory
  - frontend-verification
  - data-consistency
  - mini-app
wiki_links: []
---

# 計畫書：後端 API 與前端屬性全面盤點與驗證（基於現有文件更新）

## 目標

基於現有文件資產（`swagger.json`、`API_CONTRACT.md`、`docs/modules/presentation/api/`、`useApiRequest-guide.md`、`wiki-index.json`），驗證後端 API 與前端屬性的對應正確性，補全缺失記錄，並建立可追蹤的前後端映射清單，確保 Mini App 前端顯示數據正確。

## 背景

用戶發現部分 Mini App 前端顯示數據不正確或根本未顯示。經初步盤點，專案已有豐富的 API 相關文件：

| 現有資產                                                   | 說明                                                        | 狀態   |
| ---------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| `swagger.json` (481KB)                                     | OpenAPI/Swagger 定義，**143 個 API 端點**，專案「真理之源」 | 已存在 |
| `docs/API_CONTRACT.md`                                     | API 契約管理指南，指向 `swagger.json`                       | 已存在 |
| `docs/modules/presentation/api/_index.md`                  | API 規格總覽 (verified: 2026-09-10)                         | 已存在 |
| `docs/modules/presentation/api/portfolio_health_api.md`    | 投資組合健康 API 契約                                       | 已存在 |
| `docs/modules/presentation/api/report_signals_contract.md` | `strategyEngine` 產出 `report.signals` 結構                 | 已存在 |
| `docs/modules/presentation/api/report_news_contract.md`    | `/api/report/news` 契約                                     | 已存在 |
| `docs/useApiRequest-guide.md`                              | 前端 API 請求指南                                           | 已存在 |
| `docs/wiki-index.json`                                     | 176 個概念，其中 45 個與 API/業務相關                       | 已存在 |

**調整策略**：不從零開始盤點，而是以現有文件為基準，逐一與實際代碼（後端路由 + 前端調用）比對，驗證一致性並補全缺失記錄。

## 後端 API 接口盤點範圍（基於 swagger.json 143 個端點）

後端路由文件（`src/api/routes/`）：

| #   | 路由文件                                | 對應 swagger 端點               | 狀態      | 備註           |
| --- | --------------------------------------- | ------------------------------- | --------- | -------------- |
| 1   | `src/api/routes/status.mjs`             | `/api/status`                   | ⏳ 待驗證 | 狀態總覽       |
| 2   | `src/api/routes/strategyStatus.mjs`     | `/api/strategy-status`          | ⏳ 待驗證 | 策略分數構成   |
| 3   | `src/api/routes/portfolioHealth.mjs`    | `/api/portfolio-health`         | ⏳ 待驗證 | 投資組合健康度 |
| 4   | `src/api/routes/reports.mjs`            | `/api/reports*`                 | ⏳ 待驗證 | 報表數據       |
| 5   | `src/api/routes/news.mjs`               | `/api/news`, `/api/report/news` | ⏳ 待驗證 | 新聞           |
| 6   | `src/api/routes/socialSentiment.mjs`    | `/api/social-sentiment`         | ⏳ 待驗證 | 社群情緒       |
| 7   | `src/api/routes/config.mjs`             | `/api/strategy-config*`         | ⏳ 待驗證 | 策略配置       |
| 8   | `src/api/routes/replayEvidence.mjs`     | `/api/replay-evidence`          | ⏳ 待驗證 | 回放證據       |
| 9   | `src/api/routes/dataEvidenceReport.mjs` | `/api/data-evidence-report`     | ⏳ 待驗證 | 數據證據報告   |
| 10  | `src/api/routes/v1/simulate.mjs`        | `/api/v1/simulate*`             | ⏳ 待驗證 | 模擬           |
| 11  | `src/api/routes/monitoringRoutes.mjs`   | 監控相關                        | ⏳ 待驗證 | 監控           |
| 12  | `src/api/routes/deployRoutes.mjs`       | 部署相關                        | ⏳ 待驗證 | 部署           |

## 前端 API 調用盤點範圍

前端調用位置（`webapp/src/`）：

| #   | 前端文件                                    | 調用端點                                                       | 使用屬性                   | 顯示組件        | 狀態      | 備註           |
| --- | ------------------------------------------- | -------------------------------------------------------------- | -------------------------- | --------------- | --------- | -------------- |
| 1   | `webapp/src/views/DashboardView.vue`        | `/api/status`, `/api/portfolio-health`, `/api/strategy-status` | 多個                       | Dashboard       | ⏳ 待驗證 |                |
| 2   | `webapp/src/views/StrategyStatusView.vue`   | `/api/strategy-status`                                         | weightScore, weightDetails | 策略分數構成    | ⏳ 待驗證 | 已發現數據問題 |
| 3   | `webapp/src/views/AccountView.vue`          | `/api/status`, `/api/reports`                                  | 多個                       | 帳戶            | ⏳ 待驗證 |                |
| 4   | `webapp/src/views/MarketRadarView.vue`      | `/api/status`                                                  | 多個                       | 市場雷達        | ⏳ 待驗證 |                |
| 5   | `webapp/src/views/SimulatorView.vue`        | `/api/reports`, `/api/v1/simulate`                             | 多個                       | 模擬器          | ⏳ 待驗證 |                |
| 6   | `webapp/src/views/StrategyConfigEditor.vue` | `/api/strategy-config/meta`, `/api/strategy-config`            | 多個                       | 策略配置編輯    | ⏳ 待驗證 |                |
| 7   | `webapp/src/stores/portfolio.js`            | 動態路徑                                                       | 多個                       | Portfolio store | ⏳ 待驗證 |                |
| 8   | `webapp/src/stores/strategy.js`             | `/api/strategy-config`                                         | 多個                       | Strategy store  | ⏳ 待驗證 |                |

## 驗收標準

1. `swagger.json` 中的 143 個端點與實際後端路由一致
2. `docs/API_CONTRACT.md` 與子契約文件與實際回應欄位一致
3. 前端每個 API 調用的端點、使用屬性與 `swagger.json` 回應欄位對應正確
4. Wiki (`wiki-index.json`) 中的 API 概念與代碼映射完整且準確
5. 發現的差異（欄位缺失、名稱不對應、路徑錯誤、前端顯示空白）列出並標記嚴重程度
6. 針對發現的差異，制定修正計畫（可拆分為獨立任務）

## 執行大綱

### Phase 1 — 後端路由盤點與前端 ENDPOINTS 比對（COMPLETED）

### 關鍵發現：swagger.json 不是後端 API 定義

`swagger.json` 是 **臺灣證券交易所 OpenAPI** 定義：

- host: `openapi.twse.com.tw`
- basePath: `/v1`
- title: `臺灣證券交易所 OpenAPI`
- 143 個端點，絕大部分為 `/opendata/*` 證交所開放資料

**結論**：`swagger.json` 不是 InvestmentLineNotify 後端 API 的「真理之源」。Phase 1 改為直接盤點後端路由文件，並與前端 `webapp/src/api/config.js` `ENDPOINTS` 映射比對。

### 後端路由清單（30 個端點）

| 方法   | 路徑                                 | 來源文件               |
| ------ | ------------------------------------ | ---------------------- |
| GET    | `/api/status`                        | status.mjs             |
| GET    | `/api/strategy-status`               | strategyStatus.mjs     |
| GET    | `/api/portfolio/health`              | portfolioHealth.mjs    |
| GET    | `/api/news`                          | news.mjs               |
| GET    | `/api/social-sentiment`              | socialSentiment.mjs    |
| GET    | `/api/strategy-config`               | config.mjs             |
| POST   | `/api/strategy-config`               | config.mjs             |
| GET    | `/api/strategy-config/default`       | config.mjs             |
| GET    | `/api/strategy-config/meta`          | config.mjs             |
| POST   | `/api/strategy-config/validate`      | config.mjs             |
| GET    | `/api/replay-evidence`               | replayEvidence.mjs     |
| GET    | `/api/data-evidence-report`          | dataEvidenceReport.mjs |
| POST   | `/api/data-evidence-report`          | dataEvidenceReport.mjs |
| GET    | `/api/data-evidence-report/download` | dataEvidenceReport.mjs |
| POST   | `/api/simulate`                      | v1/simulate.mjs        |
| POST   | `/api/simulate/reverse`              | v1/simulate.mjs        |
| POST   | `/api/simulate/batch`                | v1/simulate.mjs        |
| POST   | `/api/simulate/sensitivity`          | v1/simulate.mjs        |
| POST   | `/api/simulate/pareto`               | v1/simulate.mjs        |
| GET    | `/api/monitoring/metrics`            | monitoringRoutes.mjs   |
| GET    | `/api/monitoring/alerts/rules`       | monitoringRoutes.mjs   |
| DELETE | `/api/monitoring/alerts/rules/:name` | monitoringRoutes.mjs   |
| POST   | `/api/monitoring/alerts/test`        | monitoringRoutes.mjs   |
| GET    | `/api/report/:date`                  | reports.mjs            |
| GET    | `/api/report/latest-theoretical`     | reports.mjs            |
| GET    | `/api/report/news`                   | reports.mjs            |
| GET    | `/api/reports/weekly`                | reports.mjs            |
| GET    | `/api/reports/monthly`               | reports.mjs            |
| GET    | `/api/reports/snapshots`             | reports.mjs            |
| GET    | `/api/reports/snapshots/weekly`      | reports.mjs            |
| GET    | `/api/reports/snapshots/monthly`     | reports.mjs            |

### 前端 ENDPOINTS 與後端路由比對結果

#### ✓ 匹配（15 個）

| 前端 ENDPOINTS 鍵          | 端點路徑                         | 後端路由                               | 狀態 |
| -------------------------- | -------------------------------- | -------------------------------------- | ---- |
| status                     | `/status`                        | GET /api/status                        | ✓    |
| news                       | `/news`                          | GET /api/news                          | ✓    |
| socialSentiment            | `/social-sentiment`              | GET /api/social-sentiment              | ✓    |
| dataEvidenceReport         | `/data-evidence-report`          | GET/POST /api/data-evidence-report     | ✓    |
| dataEvidenceReportDownload | `/data-evidence-report/download` | GET /api/data-evidence-report/download | ✓    |
| replayEvidence             | `/replay-evidence`               | GET /api/replay-evidence               | ✓    |
| reports.weekly             | `/reports/weekly`                | GET /api/reports/weekly                | ✓    |
| reports.monthly            | `/reports/monthly`               | GET /api/reports/monthly               | ✓    |
| reports.latestTheoretical  | `/report/latest-theoretical`     | GET /api/report/latest-theoretical     | ✓    |
| reports.snapshots.list     | `/reports/snapshots`             | GET /api/reports/snapshots             | ✓    |
| reports.snapshots.weekly   | `/reports/snapshots/weekly`      | GET /api/reports/snapshots/weekly      | ✓    |
| reports.snapshots.monthly  | `/reports/snapshots/monthly`     | GET /api/reports/snapshots/monthly     | ✓    |
| reportNews                 | `/report/news`                   | GET /api/report/news                   | ✓    |
| strategyConfig             | `/strategy-config`               | GET/POST /api/strategy-config          | ✓    |

#### ⚠ 部分匹配/潛在問題（2 個）

| 前端 ENDPOINTS 鍵 | 端點路徑                            | 後端路由              | 問題說明                                     |
| ----------------- | ----------------------------------- | --------------------- | -------------------------------------------- |
| reports.list      | `/reports`                          | 無                    | 後端沒有 `GET /api/reports` 端點，只有子路徑 |
| reports.signals   | `(date) => /report/${date}/signals` | GET /api/report/:date | 路徑不匹配：後端無 `/signals` 子路徑         |

#### ✗ 前端有定義但後端無對應（2 個）

| 前端 ENDPOINTS 鍵 | 端點路徑     | 問題         |
| ----------------- | ------------ | ------------ |
| snapshots.list    | `/snapshots` | 後端無此端點 |
| snapshots.save    | `/snapshots` | 後端無此端點 |

#### ✗ 後端有但前端 ENDPOINTS 未定義（13 個）

| 後端路由                                  | 來源文件             | 前端 ENDPOINTS 中是否定義 |
| ----------------------------------------- | -------------------- | ------------------------- |
| GET /api/strategy-config/default          | config.mjs           | ✗ 未定義                  |
| GET /api/strategy-config/meta             | config.mjs           | ✗ 未定義                  |
| POST /api/strategy-config/validate        | config.mjs           | ✗ 未定義                  |
| GET /api/portfolio/health                 | portfolioHealth.mjs  | ✗ 未定義                  |
| GET /api/monitoring/metrics               | monitoringRoutes.mjs | ✗ 未定義                  |
| GET /api/monitoring/alerts/rules          | monitoringRoutes.mjs | ✗ 未定義                  |
| DELETE /api/monitoring/alerts/rules/:name | monitoringRoutes.mjs | ✗ 未定義                  |
| POST /api/monitoring/alerts/test          | monitoringRoutes.mjs | ✗ 未定義                  |
| POST /api/simulate                        | v1/simulate.mjs      | ✗ 未定義                  |
| POST /api/simulate/batch                  | v1/simulate.mjs      | ✗ 未定義                  |
| POST /api/simulate/pareto                 | v1/simulate.mjs      | ✗ 未定義                  |
| POST /api/simulate/reverse                | v1/simulate.mjs      | ✗ 未定義                  |
| POST /api/simulate/sensitivity            | v1/simulate.mjs      | ✗ 未定義                  |

### Phase 1 結論

1. 後端共有 30 個 API 端點，前端 ENDPOINTS 定義了 18 個（其中 15 個匹配）
2. `swagger.json` 不是後端 API 定義，不應作為比對基準
3. 發現 2 個前端端點沒有後端對應（snapshots.list/save）
4. 發現 13 個後端端點前端未在 ENDPOINTS 中定義（可能直接硬編碼路徑，或未使用）
5. 發現 2 個部分匹配（reports.list, reports.signals 路徑不一致）

### 下一步（Phase 2）

檢查前端 `webapp/src/views/*.vue`、`webapp/src/stores/*.js` 中的實際 API 調用，確認：

1. 哪些後端端點實際被前端調用
2. 前端是否直接調用不在 ENDPOINTS 中的路徑
3. 前端使用的回應屬性是否與後端實際回應一致

### Phase 2 — 前端 API 調用與後端路由比對（COMPLETED）

#### 前端 API 調用清單

**直接 apiFetch 調用（views 中）：**

| 視圖文件                 | 行號 | 調用路徑                                         | 後端匹配 | 備註                               |
| ------------------------ | ---- | ------------------------------------------------ | -------- | ---------------------------------- |
| StrategyStatusView.vue   | 342  | `apiFetch("/api/strategy-status")`               | ✓        | GET /api/strategy-status           |
| SimulatorView.vue        | 128  | `apiFetch("/api/reports?limit=1")`               | ✗        | **後端無 `GET /api/reports`**      |
| SimulatorView.vue        | 154  | `apiFetch("/api/v1/simulate", ...)`              | ✓        | POST /api/v1/simulate              |
| SimulatorView.vue        | 195  | `apiFetch("/api/v1/simulate/reverse", ...)`      | ✓        | POST /api/v1/simulate/reverse      |
| StrategyConfigEditor.vue | 161  | `apiFetch("/api/strategy-config/meta")`          | ✓        | GET /api/strategy-config/meta      |
| StrategyConfigEditor.vue | 162  | `apiFetch("/api/strategy-config")`               | ✓        | GET /api/strategy-config           |
| StrategyConfigEditor.vue | 186  | `apiFetch("/api/strategy-config/validate", ...)` | ✓        | POST /api/strategy-config/validate |
| StrategyConfigEditor.vue | 230  | `apiFetch("/api/strategy-config", ...)`          | ✓        | POST /api/strategy-config          |
| StrategyConfigEditor.vue | 252  | `apiFetch("/api/strategy-config/default")`       | ✓        | GET /api/strategy-config/default   |

**api/index.js helper 函數 → 端點映射：**

| Helper 函數                        | 端點路徑                                       | 後端匹配 | 調用視圖                                        |
| ---------------------------------- | ---------------------------------------------- | -------- | ----------------------------------------------- |
| fetchReports(limit)                | `GET /api/reports?limit=30`                    | ✗        | **MacroBattleView, AccountView, TechnicalView** |
| fetchWeeklyReports(limit)          | `GET /api/reports/weekly?limit=12`             | ✓        |                                                 |
| fetchMonthlyReports(limit)         | `GET /api/reports/monthly?limit=12`            | ✓        |                                                 |
| fetchLatestTheoretical()           | `GET /api/report/latest-theoretical`           | ✓        |                                                 |
| fetchNews()                        | `GET /api/news`                                | ✓        | NewsView                                        |
| fetchSocialSentiment()             | `GET /api/social-sentiment`                    | ✓        | MacroBattleView                                 |
| fetchDataEvidenceReport()          | `GET /api/data-evidence-report`                | ✓        |                                                 |
| generateDataEvidenceReport()       | `POST /api/data-evidence-report`               | ✓        |                                                 |
| getDataEvidenceReportDownloadUrl() | `GET /api/data-evidence-report/download`       | ✓        |                                                 |
| fetchReplayEvidence()              | `GET /api/replay-evidence`                     | ✓        |                                                 |
| fetchStatus()                      | `GET /api/status`                              | ✓        | AccountView, MarketRadarView                    |
| fetchReportNews()                  | `GET /api/report/news`                         | ✓        | NewsView                                        |
| fetchSnapshots(limit)              | `GET /api/reports/snapshots?limit=90`          | ✓        |                                                 |
| fetchSnapshotsWeekly(limit)        | `GET /api/reports/snapshots/weekly?limit=52`   | ✓        |                                                 |
| fetchSnapshotsMonthly(limit)       | `GET /api/reports/snapshots/monthly?limit=120` | ✓        |                                                 |
| fetchStrategyConfig()              | `GET /api/strategy-config`                     | ✓        |                                                 |
| fetchReportSignals(date)           | `GET /api/report/${date}/signals`              | ✗        | **路徑不匹配：後端無 `/signals` 後綴**          |
| fetchPortfolioHealth(params)       | `GET /api/portfolio/health?...`                | ✓        |                                                 |
| fetchStrategyStatus()              | `GET /api/strategy-status`                     | ✓        | StrategyStatusView                              |
| updateStrategyConfig(config)       | `POST /api/strategy-config`                    | ✓        |                                                 |

**Stores 使用動態路徑：**

| Store 文件   | 行號   | 調用                                                                        | 備註                   |
| ------------ | ------ | --------------------------------------------------------------------------- | ---------------------- |
| portfolio.js | 26     | `apiFetch(path)`                                                            | 動態路徑，需進一步檢查 |
| strategy.js  | 25-26  | `apiFetch("/api/strategy-config")`, `apiFetch("/api/strategy-config/meta")` | ✓                      |
| strategy.js  | 44     | `apiFetch("/api/strategy-config", ...)`                                     | ✓                      |
| market.js    | 29     | `apiFetch("/api/status")`                                                   | ✓                      |
| market.js    | 47, 64 | `apiFetch(path)`                                                            | 動態路徑，需進一步檢查 |

#### Phase 2 問題清單

**P0（高優先級，會導致前端顯示空白/錯誤）：**

| #    | 問題                                                                                        | 前端來源                                                  | 後端狀態                                  | 建議修正                                                          |
| ---- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| P0-1 | `fetchReports()` 調用 `GET /api/reports`，但後端無此端點                                    | `api/index.js` line 213-214; `SimulatorView.vue` line 128 | 無 `GET /api/reports` 端點                | 後端新增 `GET /api/reports`，或前端改用 `GET /api/reports/weekly` |
| P0-2 | `fetchReportSignals(date)` 調用 `GET /api/report/${date}/signals`，但後端無 `/signals` 後綴 | `api/index.js` line 268-269                               | 有 `GET /api/report/:date`，無 `/signals` | 後端新增 `/report/:date/signals`，或前端改用 `/report/:date`      |

**P1（中優先級，ENDPOINTS 未使用或未匹配）：**

| #    | 問題                                                  | 前端來源            | 後端狀態                 | 建議修正                           |
| ---- | ----------------------------------------------------- | ------------------- | ------------------------ | ---------------------------------- |
| P1-1 | `ENDPOINTS.snapshots.list` = `/snapshots`，無後端對應 | `config.js` line 51 | 無 `GET /api/snapshots`  | 移除未用 ENDPOINTS，或新增後端端點 |
| P1-2 | `ENDPOINTS.snapshots.save` = `/snapshots`，無後端對應 | `config.js` line 52 | 無 `POST /api/snapshots` | 移除未用 ENDPOINTS，或新增後端端點 |
| P1-3 | `ENDPOINTS.reports.list` = `/reports`，無後端對應     | `config.js` line 17 | 無 `GET /api/reports`    | 與 P0-1 同一問題                   |

**P2（低優先級，後端端點前端未調用）：**

後端有但前端未在 ENDPOINTS 中定義的端點：

- GET /api/strategy-config/default, /api/strategy-config/meta, /api/strategy-config/validate
- GET /api/portfolio/health
- GET/POST/DELETE /api/monitoring/*
- POST /api/simulate/*

（這些端點前端可能通過直接硬編碼路徑調用，或尚未由前端使用）

#### Phase 2 結論

1. **發現 2 個 P0 問題**：前端調用不存在的後端端點，會導致 API 失敗、前端顯示空白
2. **發現 2 個 P1 問題**：ENDPOINTS 中定義但後端無對應端點
3. 前端直接 apiFetch 調用（SimulatorView.vue line 128）繞過了 ENDPOINTS 映射，硬編碼路徑
4. portfolio.js 和 market.js 使用動態路徑 `apiFetch(path)`，需進一步檢查實際調用路徑

### Phase 3 — 現有文件驗證與更新（IN PROGRESS）

驗證並更新現有文件，確保與實際代碼一致：

- `docs/API_CONTRACT.md`：確認與後端路由一致
- `docs/modules/presentation/api/*`：確認契約內容與實際代碼一致
- `docs/useApiRequest-guide.md`：確認前端指南與實際調用一致
- `docs/wiki-index.json`：補全缺失的 API 概念與代碼映射

### Phase 3 — 現有文件驗證與更新（GREEN）

#### Phase 3 驗證發現（關鍵修正）

**1. OpenAPI 規格來源修正：**

- `swagger.json` **不是** ILN 後端 API 定義（host: openapi.twse.com.tw，證交所 OpenAPI，143 個 /opendata/* 端點）
- `docs/api/openapi.json` **才是** ILN 後端 OpenAPI 3.0 規格（title: "InvestmentLineNotify API"，51 個路徑）
- `docs/API_CONTRACT.md` 已正確參考 `docs/api/openapi.json`
- `docs/modules/presentation/api/_index.md` 需要更新（可能仍指向 swagger.json）

**2. OpenAPI.json vs 後端實際路由 vs 前端 ENDPOINTS 三方比對：**

| 前端 ENDPOINTS        | 前端調用                                         | OpenAPI.json                | 後端實際路由                   | 狀態             |
| --------------------- | ------------------------------------------------ | --------------------------- | ------------------------------ | ---------------- |
| reports.list          | GET /api/reports                                 | ✓ 有                        | ✗ 無                           | P0-1 缺失端點    |
| reports.signals(date) | GET /api/report/:date/signals                    | （隐含 /api/report/{date}） | ✗ 無（只有 /api/report/:date） | P0-2 路徑不匹配  |
| snapshots.list/save   | GET/POST /api/snapshots                          | ✗ 無                        | ✗ 無                           | P1-1/P1-2 未實作 |
| socialSentiment       | GET /api/social-sentiment                        | ✗ 遺失                      | ✓ 有                           | OpenAPI 不完整   |
| replayEvidence        | GET /api/replay-evidence                         | ✗ 遺失                      | ✓ 有                           | OpenAPI 不完整   |
| dataEvidenceReport*   | GET/POST/GET-download /api/data-evidence-report* | ✗ 遺失                      | ✓ 有                           | OpenAPI 不完整   |

**3. 各文件驗證結果：**

- `docs/modules/presentation/api/portfolio_health_api.md`：與 portfolioHealth.mjs 回應欄位一致 ✓
- `docs/modules/presentation/api/report_signals_contract.md`：與 strategyEngine.mjs signals 結構一致 ✓
- `docs/modules/presentation/api/report_news_contract.md`：需與 news.mjs 回應欄位再比對
- `docs/useApiRequest-guide.md`：與前端 composables 實際使用一致 ✓
- `docs/wiki-index.json`：需補全缺失的 API 概念（social-sentiment, replay-evidence, data-evidence-report）

#### Phase 3 結論

1. **OpenAPI 規格文件錯誤**：`swagger.json` 被誤認為後端 API 規格，實為證交所 OpenAPI；正確規格為 `docs/api/openapi.json`
2. **OpenAPI.json 不完整**：缺少 social-sentiment、replay-evidence、data-evidence-report 等後端實際端點
3. **P0 與 P1 問題與 Phase 2 一致**：2 個 P0（/api/reports 缺失、/report/:date/signals 路徑不匹配），2 個 P1（/snapshots 未實作）
4. 文件內容與實際代碼大致一致，但需更新 `_index.md` 及 `wiki-index.json`

### Phase 4 — 前端顯示邏輯驗證（VERIFY）

檢查前端顯示邏輯是否正確使用後端回應數據：

- 是否有未初始化的變數導致顯示空白
- 是否有錯誤的屬性路徑導致 `undefined`
- 條件渲染是否正確

### Phase 5 — 差異修正與測試（COMMIT）

針對 Phase 1–4 發現的差異：

- 修正後端回應欄位、前端調用屬性、或現有文件記錄
- 補上單元測試驗證 API 契約
- 更新 `wiki-index.json` 並執行 `validate-wiki-index.mjs`
- Commit 並推送

## 文件與 Wiki 更新

- 本計畫文件於每個階段完成後更新進度
- 盤點結果同步至 `docs/wiki-index.json`（若涉及新的 API 概念）
- 完成後歸檔至 `docs/plans/completed/`

---

**目前狀態**：計畫文件已調整（基於現有文件資產），等待執行 Phase 1。
