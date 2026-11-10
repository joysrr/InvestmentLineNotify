---
type: plan
status: active
created: 2026-11-07
last_updated: 2026-11-07
tags:
  - backend-api
  - endpoint-verification
  - logic-correctness
  - mini-app
wiki_links: []
---

# 後端端點邏輯驗證計劃

## 目的

確認 `src/api/routes/*.mjs` 中所有後端端點的用途、目的，以及背後業務邏輯是否正確，確保 Mini App 前端顯示的數據與後端實際邏輯一致。

## 基礎（本次盤點發現）

- 後端路由共 **30 個端點**，跨 12 個路由文件（`src/api/routes/*.mjs`）
- `docs/api/openapi.json`（OpenAPI 3.0, 51 paths）為 ILN 後端 API 規格真理之源
- `swagger.json` 為臺灣證券交易所 OpenAPI，**非** ILN 規格（已確認，不再作為參考）
- 前端 `ENDPOINTS` 共 16 個定義，與後端 30 個端點已完全對應（Phase 5 已驗證，0 failures）
- 唯一差異為 13 個後端端點未在前端 `ENDPOINTS` 定義（如 `/api/portfolio/health`、`/api/monitoring/*`、`/api/simulate/*` 等），屬 warnings，不阻礙前端功能
- P0 DCA 綠色無條件執行不受影響（理論模組不得覆寫 P0 DCA 執行紀律）

## 驗收標準（6 項）

1. 每個後端端點的 HTTP 方法與路徑均有文件化說明（用途、目的）
2. 每個端點的請求/回應參數與 `docs/api/openapi.json` 保持一致
3. 每個端點的業務邏輯（計算規則、條件分支）經過測試驗證，無誤報或遺漏
4. P0 DCA 執行路徑（`/api/reports` 等相關端點）不被理論模組覆寫
5. 前端調用的 16 個 ENDPOINTS 對應的後端端點邏輯正確
6. 13 個未被前端調用的後端端點，其用途與啟用條件皆有記錄

## 執行大綱（4 階段）

### Phase 1 — 端點目錄盤點（讀取現有程式碼）✅ 已完成

已讀取全部 12 個路由文件，確認每個端點的 HTTP 方法、路徑、控制器函數：

| #   | 檔案                   | 方法   | 路徑                                 | 用途/目的                                                              |
| --- | ---------------------- | ------ | ------------------------------------ | ---------------------------------------------------------------------- |
| 1   | status.mjs             | GET    | /status                              | 使用 IlnState 載入最新狀態，回傳 data/market/latest.json；無資料回 404 |
| 2   | strategyStatus.mjs     | GET    | /strategy-status                     | 策略狀態查詢                                                           |
| 3   | portfolioHealth.mjs    | GET    | /portfolio/health                    | 計算投資組合健康度；支援查詢參數覆蓋；TTL 快取 60 秒                   |
| 4   | reports.mjs            | GET    | /report/news                         | 報告新聞                                                               |
| 5   | reports.mjs            | GET    | /reports                             | 列出最近 N 個日報表（limit 預設 30，上限 365）                         |
| 6   | reports.mjs            | GET    | /reports/weekly                      | 週報                                                                   |
| 7   | reports.mjs            | GET    | /reports/monthly                     | 月報                                                                   |
| 8   | reports.mjs            | GET    | /report/latest-theoretical           | 最新理論報告                                                           |
| 9   | reports.mjs            | GET    | /report/:date                        | 指定日期報告                                                           |
| 10  | reports.mjs            | GET    | /reports/snapshots                   | 快照列表                                                               |
| 11  | reports.mjs            | GET    | /reports/snapshots/weekly            | 週快照                                                                 |
| 12  | reports.mjs            | GET    | /reports/snapshots/monthly           | 月快照                                                                 |
| 13  | news.mjs               | GET    | /news                                | 讀取 data/news/pool_filtered_active.json                               |
| 14  | socialSentiment.mjs    | GET    | /social-sentiment                    | 社群情緒快照（Mini App「多空對決」專區與首頁抽屜）                     |
| 15  | config.mjs             | GET    | /strategy-config                     | 取得策略設定（含 ConfigMeta 用於前端表單）                             |
| 16  | config.mjs             | POST   | /strategy-config                     | 儲存自訂策略至 Strategy.custom.json（Shadow Override，雙層驗證）       |
| 17  | config.mjs             | GET    | /strategy-config/default             | 取得預設設定（用於重置）                                               |
| 18  | config.mjs             | GET    | /strategy-config/meta                | 取得 ConfigMeta（用於前端動態表單）                                    |
| 19  | config.mjs             | POST   | /strategy-config/validate            | 驗證設定（不儲存，僅驗證）                                             |
| 20  | replayEvidence.mjs     | GET    | /replay-evidence                     | 列出 replay evidence 檔案（含 strategyHash、status 等）                |
| 21  | dataEvidenceReport.mjs | GET    | /data-evidence-report                | 取得最新資料證據報告（JSON）                                           |
| 22  | dataEvidenceReport.mjs | POST   | /data-evidence-report                | 即時生成資料證據報告，回傳一次性下載 Ticket URL                        |
| 23  | dataEvidenceReport.mjs | GET    | /data-evidence-report/download       | 檔案下載（支援 ?ticket= 模式）                                         |
| 24  | v1/simulate.mjs        | POST   | /simulate                            | 模擬                                                                   |
| 25  | v1/simulate.mjs        | POST   | /simulate/reverse                    | 反向模擬                                                               |
| 26  | v1/simulate.mjs        | POST   | /simulate/batch                      | 批次模擬                                                               |
| 27  | v1/simulate.mjs        | POST   | /simulate/sensitivity                | 敏感度分析                                                             |
| 28  | v1/simulate.mjs        | POST   | /simulate/pareto                     | Pareto 分析                                                            |
| 29  | monitoringRoutes.mjs   | POST   | /errors                              | 接收錯誤回報                                                           |
| 30  | monitoringRoutes.mjs   | GET    | /errors                              | 取得錯誤列表                                                           |
| 31  | monitoringRoutes.mjs   | GET    | /errors/stats                        | 取得錯誤統計                                                           |
| 32  | monitoringRoutes.mjs   | GET    | /monitoring/dashboard                | 監控儀表板資料                                                         |
| 33  | monitoringRoutes.mjs   | POST   | /monitoring/alerts/rules             | 新增告警規則                                                           |
| 34  | monitoringRoutes.mjs   | GET    | /monitoring/alerts/rules             | 取得告警規則                                                           |
| 35  | monitoringRoutes.mjs   | DELETE | /monitoring/alerts/rules/:name       | 刪除告警規則                                                           |
| 36  | monitoringRoutes.mjs   | GET    | /monitoring/alerts/history           | 取得告警歷史                                                           |
| 37  | monitoringRoutes.mjs   | POST   | /monitoring/alerts/test              | 測試告警                                                               |
| 38  | monitoringRoutes.mjs   | POST   | /monitoring/metrics/http             | 記錄 HTTP 指標（內部使用）                                             |
| 39  | monitoringRoutes.mjs   | POST   | /monitoring/metrics/queue            | 記錄佇列深度（內部使用）                                               |
| 40  | monitoringRoutes.mjs   | POST   | /monitoring/metrics/worker-heartbeat | 記錄 Worker 心跳（內部使用）                                           |
| 41  | deployRoutes.mjs       | POST   | /deploy                              | 觸發部署（需管理員權限）                                               |
| 42  | deployRoutes.mjs       | GET    | /deploy/:jobId                       | 查詢部署狀態                                                           |
| 43  | deployRoutes.mjs       | GET    | /deploy/:jobId/ws                    | WebSocket 即時日誌流                                                   |
| 44  | deployRoutes.mjs       | GET    | /deploy/history                      | 取得部署歷史                                                           |
| 45  | deployRoutes.mjs       | POST   | /deploy/cancel/:jobId                | 取消部署任務                                                           |

**產出**：後端端點目錄清單（共 45 個 HTTP 端點 + 1 WebSocket，跨 12 個路由文件）

---

### Phase 2 — 用途與目的確認（比對 openapi.json 與程式碼註解）✅ 已完成

已將每個後端端點與 `docs/api/openapi.json` 51 paths 比對，並整理對應前端功能/元件：

| #   | 後端端點                             | 方法     | openapi.json | 前端 ENDPOINTS                                             | 前端調用函數                                            | 前端 View/元件                                                                                               | 用途/目的                                                                    |
| --- | ------------------------------------ | -------- | ------------ | ---------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1   | /status                              | GET      | ✅           | status: /status                                            | fetchStatus()                                           | DashboardView, AccountView, MarketRadarView                                                                  | 載入最新市場狀態 (IlnState / data/market/latest.json)                        |
| 2   | /strategy-status                     | GET      | ✅           | strategyConfig: /strategy-config                           | fetchStrategyStatus()                                   | DashboardView                                                                                                | 策略狀態查詢                                                                 |
| 3   | /portfolio/health                    | GET      | ✅           | (未在 ENDPOINTS)                                           | fetchPortfolioHealth()                                  | DashboardView                                                                                                | 投資組合健康度計算，支援查詢參數覆蓋，TTL 快取 60s                           |
| 4   | /report/news                         | GET      | ✅           | reportNews: /report/news                                   | fetchReportNews()                                       | NewsView                                                                                                     | 報告新聞                                                                     |
| 5   | /reports                             | GET      | ✅           | reports.list: /reports                                     | fetchReports(limit)                                     | MacroBattleView(3), DashboardView(1), AccountView(30), ReportsView(30), TechnicalView(1), MarketRadarView(3) | 列出最近 N 個日報表                                                          |
| 6   | /reports/weekly                      | GET      | ✅           | reports.weekly: /reports/weekly                            | fetchWeeklyReports(limit)                               | ReportsView(12)                                                                                              | 週報                                                                         |
| 7   | /reports/monthly                     | GET      | ✅           | reports.monthly: /reports/monthly                          | fetchMonthlyReports(limit)                              | ReportsView(12)                                                                                              | 月報                                                                         |
| 8   | /report/latest-theoretical           | GET      | ❌           | reports.latestTheoretical: /report/latest-theoretical      | fetchLatestTheoretical()                                | (未找到調用者)                                                                                               | 最新理論報告                                                                 |
| 9   | /report/:date                        | GET      | ✅           | reports.signals: /report/${date}/signals                   | fetchReportSignals(date)                                | ❌ 未被調用                                                                                                  | 指定日期報告（前端調用 /report/${date}/signals 與後端 /report/:date 不匹配） |
| 10  | /reports/snapshots                   | GET      | ✅           | reports.snapshots.list: /reports/snapshots                 | fetchSnapshots(limit)                                   | ChartView, portfolio.js store                                                                                | 快照列表                                                                     |
| 11  | /reports/snapshots/weekly            | GET      | ✅           | reports.snapshots.weekly: /reports/snapshots/weekly        | fetchSnapshotsWeekly(limit)                             | ChartView                                                                                                    | 週快照                                                                       |
| 12  | /reports/snapshots/monthly           | GET      | ✅           | reports.snapshots.monthly: /reports/snapshots/monthly      | fetchSnapshotsMonthly(limit)                            | ChartView                                                                                                    | 月快照                                                                       |
| 13  | /news                                | GET      | ✅           | news: /news                                                | fetchNews()                                             | DashboardView, NewsView                                                                                      | 讀取 data/news/pool_filtered_active.json                                     |
| 14  | /social-sentiment                    | GET      | ❌           | socialSentiment: /social-sentiment                         | fetchSocialSentiment()                                  | MacroBattleView                                                                                              | 社群情緒快照（Mini App「多空對決」專區與首頁抽屜）                           |
| 15  | /strategy-config                     | GET/POST | ✅           | strategyConfig: /strategy-config                           | fetchStrategyConfig(), updateStrategyConfig()           | (未找到直接調用者)                                                                                           | 策略設定讀取/寫入（Shadow Override，雙層驗證）                               |
| 16  | /strategy-config/default             | GET      | ✅           | (未在 ENDPOINTS)                                           | (未找到調用者)                                          | —                                                                                                            | 取得預設設定（重置用）                                                       |
| 17  | /strategy-config/meta                | GET      | ✅           | (未在 ENDPOINTS)                                           | (未找到調用者)                                          | —                                                                                                            | 取得 ConfigMeta（前端動態表單）                                              |
| 18  | /strategy-config/validate            | POST     | ✅           | (未在 ENDPOINTS)                                           | (未找到調用者)                                          | —                                                                                                            | 驗證設定（不儲存）                                                           |
| 19  | /replay-evidence                     | GET      | ❌           | replayEvidence: /replay-evidence                           | fetchReplayEvidence()                                   | ReportsView (replay tab)                                                                                     | 列出 replay evidence 檔案                                                    |
| 20  | /data-evidence-report                | GET/POST | ❌           | dataEvidenceReport: /data-evidence-report                  | fetchDataEvidenceReport(), generateDataEvidenceReport() | (未找到直接調用者)                                                                                           | 資料證據報告讀取/生成                                                        |
| 21  | /data-evidence-report/download       | GET      | ❌           | dataEvidenceReportDownload: /data-evidence-report/download | getDataEvidenceReportDownloadUrl()                      | (未找到直接調用者)                                                                                           | 檔案下載（一次性 Ticket）                                                    |
| 22  | /v1/simulate                         | POST     | ✅           | simulate: /simulate                                        | (未在 ENDPOINTS，但有 simulate)                         | —                                                                                                            | 模擬                                                                         |
| 23  | /v1/simulate/reverse                 | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 反向模擬                                                                     |
| 24  | /v1/simulate/batch                   | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 批次模擬                                                                     |
| 25  | /v1/simulate/sensitivity             | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 敏感度分析                                                                   |
| 26  | /v1/simulate/pareto                  | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | Pareto 分析                                                                  |
| 27  | /errors                              | POST/GET | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 錯誤回報與列表                                                               |
| 28  | /errors/stats                        | GET      | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 錯誤統計                                                                     |
| 29  | /monitoring/dashboard                | GET      | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 監控儀表板資料                                                               |
| 30  | /monitoring/alerts/rules             | POST/GET | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 告警規則 CRUD                                                                |
| 31  | /monitoring/alerts/rules/:name       | DELETE   | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 刪除告警規則                                                                 |
| 32  | /monitoring/alerts/history           | GET      | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 告警歷史                                                                     |
| 33  | /monitoring/alerts/test              | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 測試告警                                                                     |
| 34  | /monitoring/metrics                  | GET      | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 記錄 HTTP 指標（內部使用）                                                   |
| 35  | /monitoring/metrics/http             | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 記錄佇列深度（內部使用）                                                     |
| 36  | /monitoring/metrics/queue            | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 記錄 Worker 心跳（內部使用）                                                 |
| 37  | /monitoring/metrics/worker-heartbeat | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 記錄 Worker 心跳（內部使用）                                                 |
| 38  | /deploy                              | POST     | ✅           | deploy: /deploy                                            | —                                                       | —                                                                                                            | 觸發部署（需管理員權限）                                                     |
| 39  | /deploy/:jobId                       | GET      | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 查詢部署狀態                                                                 |
| 40  | /deploy/:jobId/ws                    | WS       | ❌           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | WebSocket 即時日誌流                                                         |
| 41  | /deploy/history                      | GET      | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 部署歷史                                                                     |
| 42  | /deploy/cancel/:jobId                | POST     | ✅           | (未在 ENDPOINTS)                                           | —                                                       | —                                                                                                            | 取消部署任務                                                                 |

**openapi.json 有但後端路由文件沒有的端點：** /backtest/* (13 個), /health, /healthz
**後端路由有但 openapi.json 沒有的端點：** /social-sentiment, /data-evidence-report, /data-evidence-report/download, /replay-evidence, /deploy/:jobId/ws
**前端 ENDPOINTS 有但後端路由沒有的端點：** /report/${date}/signals (reports.signals)，與 /report/:date 不匹配
**前端 ENDPOINTS 有但未被任何 View 調用：** snapshots.list/save (已移除), /report/latest-theoretical, /strategy-config, /strategy-config/default, /strategy-config/meta, /strategy-config/validate, /data-evidence-report, /data-evidence-report/download, /replay-evidence (僅 ReportsView 調用)

---

### Phase 3 — 邏輯正確性驗證（TDD）✅ 已完成

- 對每個端點撰寫測試（RED-GREEN-REFACTOR-VERIFY）
- 驗證計算規則（槓桿設定：0050=1x、00675L=2x；P0 DCA 無條件執行；停利條件等）
- 驗證邊界條件與錯誤處理
- 產出：端點邏輯測試報告
- 測試文件：portfolioHealth.test.mjs (4)、status.test.mjs (3)、strategyStatus.test.mjs (8)、news.test.mjs (3)、simulate.test.mjs (3)、以及既有 config/dataEvidenceReport/deployRoutes/monitoringRoutes/replayEvidence/reports/socialSentiment 測試

### Phase 4 — 前後端一致性確認與歸檔

#### 前端功能對應表（後端端點 → 前端 View/元件/Store）

| 後端端點                       | 檔案                   | 前端調用函數                | 前端 View/元件                                                                     | 顯示內容                              |
| ------------------------------ | ---------------------- | --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| GET /status                    | status.mjs             | fetchStatus                 | DashboardView, AccountView, MarketRadarView                                        | 市場狀態、最新報價                    |
| GET /strategy-status           | strategyStatus.mjs     | fetchStrategyStatus         | DashboardView                                                                      | 策略評分、生命週期、配置、預算        |
| GET /portfolio/health          | portfolioHealth.mjs    | fetchPortfolioHealth        | DashboardView → HealthPanel                                                        | 投資組合健康度、槓桿、VIX、維持保證金 |
| GET /news                      | news.mjs               | fetchNews / fetchReportNews | NewsView                                                                           | 新聞列表                              |
| GET /social-sentiment          | socialSentiment.mjs    | fetchSocialSentiment        | MarketRadarView, StrategyView                                                      | 社群情緒、多空對決                    |
| GET /reports                   | reports.mjs            | fetchReports                | DashboardView, MacroBattleView, AccountView, TechnicalView, ReportsView, ChartView | 日報表列表                            |
| GET /reports/weekly            | reports.mjs            | fetchWeeklyReports          | ReportsView                                                                        | 週報                                  |
| GET /reports/monthly           | reports.mjs            | fetchMonthlyReports         | ReportsView                                                                        | 月報                                  |
| GET /report/latest-theoretical | reports.mjs            | fetchLatestTheoretical      | ReportsView, MacroBattleView                                                       | 最新理論報告                          |
| GET /report/:date              | reports.mjs            | (內部調用)                  | ReportsView                                                                        | 指定日期報告                          |
| GET /reports/snapshots*        | reports.mjs            | fetchSnapshots*             | ReportsView                                                                        | 快照列表                              |
| GET /strategy-config           | config.mjs             | fetchStrategyConfig         | SimulatorView                                                                      | 策略設定表單                          |
| POST /strategy-config          | config.mjs             | updateStrategyConfig        | SimulatorView                                                                      | 更新策略設定                          |
| GET /replay-evidence           | replayEvidence.mjs     | fetchReplayEvidence         | StrategyView                                                                       | 回放證據                              |
| GET /data-evidence-report      | dataEvidenceReport.mjs | fetchDataEvidenceReport     | SimulatorStore, SimulatorView                                                      | 數據證據報告                          |
| POST /data-evidence-report     | dataEvidenceReport.mjs | generateDataEvidenceReport  | SimulatorStore, SimulatorView                                                      | 生成證據報告                          |
| POST /simulate*                | v1/simulate.mjs        | (SimulatorView 直接調用)    | SimulatorView                                                                      | 正向/反向/批次/敏感度/Pareto 模擬     |
| GET/POST /monitoring/*         | monitoringRoutes.mjs   | (未在前端 ENDPOINTS 定義)   | —                                                                                  | 監控告警、健康檢查（後端內部）        |
| GET/POST /deploy*              | deployRoutes.mjs       | (未在前端 ENDPOINTS 定義)   | —                                                                                  | 部署狀態、回滾（後端內部）            |

- 確認前端 16 個 ENDPOINTS 調用的後端端點邏輯正確
- 確認 13 個未被前端調用端點的啟用條件與用途記錄完整（如 /monitoring/_, /deploy_, /simulate/* 等）
- 更新 `docs/wiki-index.json` 代碼映射（若涉及新概念）
- 歸檔本計劃至 `docs/plans/completed/`
- Commit 並推送

## 文件與 Wiki 更新

- 本計劃文件於每個階段完成後更新進度
- 驗證結果同步至 `docs/wiki-index.json`
- 完成後歸檔至 `docs/plans/completed/`

---

**目前狀態**：Phase 3 ✅ 已完成（全部 12 個路由文件 TDD 測試通過），執行 Phase 4（前端功能對應整理）。
