# 後端端點與前端調用對照表

生成時間: 2026-11-07T15:05:20.168Z

## 摘要

- 後端 HTTP 端點總數: 41
- 前端 fetch* 調用總數: 20
- 前端實際調用的後端端點: 16
- 後端未被前端調用的端點: 23
- 前端調用但後端無對應端點: 4

## 1. 前端調用的後端端點（已使用）

| 前端調用                  | 後端路徑                     | 方法 | 來源文件                 |
| ------------------------- | ---------------------------- | ---- | ------------------------ |
| `fetchDataEvidenceReport` | `/data-evidence-report`      | GET  | `dataEvidenceReport.mjs` |
| `fetchLatestTheoretical`  | `/report/latest-theoretical` | GET  | `reports.mjs`            |
| `fetchMonthlyReports`     | `/reports/monthly`           | GET  | `reports.mjs`            |
| `fetchNews`               | `/news`                      | GET  | `news.mjs`               |
| `fetchPortfolioHealth`    | `/portfolio/health`          | GET  | `portfolioHealth.mjs`    |
| `fetchReplayEvidence`     | `/replay-evidence`           | GET  | `replayEvidence.mjs`     |
| `fetchReportNews`         | `/report/news`               | GET  | `reports.mjs`            |
| `fetchReports`            | `/reports`                   | GET  | `reports.mjs`            |
| `fetchSnapshots`          | `/reports/snapshots`         | GET  | `reports.mjs`            |
| `fetchSnapshotsMonthly`   | `/reports/snapshots/monthly` | GET  | `reports.mjs`            |
| `fetchSnapshotsWeekly`    | `/reports/snapshots/weekly`  | GET  | `reports.mjs`            |
| `fetchSocialSentiment`    | `/social-sentiment`          | GET  | `socialSentiment.mjs`    |
| `fetchStatus`             | `/status`                    | GET  | `status.mjs`             |
| `fetchStrategyConfig`     | `/strategy-config`           | GET  | `config.mjs`             |
| `fetchStrategyStatus`     | `/strategy-status`           | GET  | `strategyStatus.mjs`     |
| `fetchWeeklyReports`      | `/reports/weekly`            | GET  | `reports.mjs`            |

## 2. 後端未被前端調用的端點（候選移除）

| 路徑                                   | 方法   | 來源文件                 |
| -------------------------------------- | ------ | ------------------------ |
| `/strategy-config/default`             | GET    | `config.mjs`             |
| `/strategy-config/meta`                | GET    | `config.mjs`             |
| `/strategy-config/validate`            | POST   | `config.mjs`             |
| `/data-evidence-report/download`       | GET    | `dataEvidenceReport.mjs` |
| `/deploy`                              | POST   | `deployRoutes.mjs`       |
| `/deploy/:jobId`                       | GET    | `deployRoutes.mjs`       |
| `/deploy/:jobId/ws`                    | GET    | `deployRoutes.mjs`       |
| `/deploy/history`                      | GET    | `deployRoutes.mjs`       |
| `/deploy/cancel/:jobId`                | POST   | `deployRoutes.mjs`       |
| `/errors`                              | POST   | `monitoringRoutes.mjs`   |
| `/errors`                              | GET    | `monitoringRoutes.mjs`   |
| `/errors/stats`                        | GET    | `monitoringRoutes.mjs`   |
| `/monitoring/dashboard`                | GET    | `monitoringRoutes.mjs`   |
| `/monitoring/metrics`                  | GET    | `monitoringRoutes.mjs`   |
| `/monitoring/alerts/rules`             | POST   | `monitoringRoutes.mjs`   |
| `/monitoring/alerts/rules`             | GET    | `monitoringRoutes.mjs`   |
| `/monitoring/alerts/rules/:name`       | DELETE | `monitoringRoutes.mjs`   |
| `/monitoring/alerts/history`           | GET    | `monitoringRoutes.mjs`   |
| `/monitoring/alerts/test`              | POST   | `monitoringRoutes.mjs`   |
| `/monitoring/metrics/http`             | POST   | `monitoringRoutes.mjs`   |
| `/monitoring/metrics/queue`            | POST   | `monitoringRoutes.mjs`   |
| `/monitoring/metrics/worker-heartbeat` | POST   | `monitoringRoutes.mjs`   |
| `/report/:date`                        | GET    | `reports.mjs`            |

## 3. 前端調用但後端無對應端點

- `fetchAll`
- `fetchConfig`
- `fetchLatest`
- `fetchTheoryData`

## 4. 後端端點完整列表（45 個 HTTP 端點）

| 路徑                                   | 方法   | 來源文件                 | 前端是否調用 |
| -------------------------------------- | ------ | ------------------------ | ------------ |
| `/strategy-config`                     | GET    | `config.mjs`             | ✅ 是        |
| `/strategy-config`                     | POST   | `config.mjs`             | ✅ 是        |
| `/strategy-config/default`             | GET    | `config.mjs`             | ❌ 否        |
| `/strategy-config/meta`                | GET    | `config.mjs`             | ❌ 否        |
| `/strategy-config/validate`            | POST   | `config.mjs`             | ❌ 否        |
| `/data-evidence-report`                | GET    | `dataEvidenceReport.mjs` | ✅ 是        |
| `/data-evidence-report`                | POST   | `dataEvidenceReport.mjs` | ✅ 是        |
| `/data-evidence-report/download`       | GET    | `dataEvidenceReport.mjs` | ❌ 否        |
| `/deploy`                              | POST   | `deployRoutes.mjs`       | ❌ 否        |
| `/deploy/:jobId`                       | GET    | `deployRoutes.mjs`       | ❌ 否        |
| `/deploy/:jobId/ws`                    | GET    | `deployRoutes.mjs`       | ❌ 否        |
| `/deploy/history`                      | GET    | `deployRoutes.mjs`       | ❌ 否        |
| `/deploy/cancel/:jobId`                | POST   | `deployRoutes.mjs`       | ❌ 否        |
| `/errors`                              | POST   | `monitoringRoutes.mjs`   | ❌ 否        |
| `/errors`                              | GET    | `monitoringRoutes.mjs`   | ❌ 否        |
| `/errors/stats`                        | GET    | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/dashboard`                | GET    | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/metrics`                  | GET    | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/alerts/rules`             | POST   | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/alerts/rules`             | GET    | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/alerts/rules/:name`       | DELETE | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/alerts/history`           | GET    | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/alerts/test`              | POST   | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/metrics/http`             | POST   | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/metrics/queue`            | POST   | `monitoringRoutes.mjs`   | ❌ 否        |
| `/monitoring/metrics/worker-heartbeat` | POST   | `monitoringRoutes.mjs`   | ❌ 否        |
| `/news`                                | GET    | `news.mjs`               | ✅ 是        |
| `/portfolio/health`                    | GET    | `portfolioHealth.mjs`    | ✅ 是        |
| `/replay-evidence`                     | GET    | `replayEvidence.mjs`     | ✅ 是        |
| `/report/news`                         | GET    | `reports.mjs`            | ✅ 是        |
| `/reports`                             | GET    | `reports.mjs`            | ✅ 是        |
| `/reports/weekly`                      | GET    | `reports.mjs`            | ✅ 是        |
| `/reports/monthly`                     | GET    | `reports.mjs`            | ✅ 是        |
| `/report/latest-theoretical`           | GET    | `reports.mjs`            | ✅ 是        |
| `/report/:date`                        | GET    | `reports.mjs`            | ❌ 否        |
| `/reports/snapshots`                   | GET    | `reports.mjs`            | ✅ 是        |
| `/reports/snapshots/weekly`            | GET    | `reports.mjs`            | ✅ 是        |
| `/reports/snapshots/monthly`           | GET    | `reports.mjs`            | ✅ 是        |
| `/social-sentiment`                    | GET    | `socialSentiment.mjs`    | ✅ 是        |
| `/status`                              | GET    | `status.mjs`             | ✅ 是        |
| `/strategy-status`                     | GET    | `strategyStatus.mjs`     | ✅ 是        |
