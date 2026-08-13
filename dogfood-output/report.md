# Dogfood 探索式 QA 報告

**生成時間**: 2026/8/13 上午9:12:44

**測試環境**: Vite Dev Server (localhost:5173) + API Server (localhost:3001)

## 📊 摘要

| 指標 | 數值 |
|------|------|
| API 端點測試 | 2/11 通過 |
| 頁面測試 | 0/3 通過 |
| **Critical Bugs** | 0 |
| **High Bugs** | 9 |
| **Medium Bugs** | 6 |
| **Low Bugs** | 0 |
| **總計** | 15 |

## 📡 API 測試結果

| 端點 | 名稱 | 狀態 | 通過 |
|------|------|------|------|
| /health | Health Check | 200 | ✅ |
| /healthz | Health Check (alt) | 200 | ✅ |
| /api/status | System Status | 403 | ❌ |
| /api/reports/latest | Latest Report | 403 | ❌ |
| /api/news/pool | News Pool | 403 | ❌ |
| /api/config | Config | 403 | ❌ |
| /api/portfolio-health | Portfolio Health | 403 | ❌ |
| /api/strategy-status | Strategy Status | 403 | ❌ |
| /api/v1/simulate | Simulator | 403 | ❌ |
| /api/backtest/list | Backtest List | 403 | ❌ |
| /api/monitoring/health | Monitoring Health | 403 | ❌ |

## 🌐 頁面測試結果

| 頁面 | 路徑 | 載入時間 | 通過 | Console Errors | JS Exceptions | Network Failures |
|------|------|----------|------|----------------|---------------|------------------|
| Dashboard | / | 1410ms | ❌ | 36 | 0 | 12 |
| Simulator | /simulator | 1025ms | ❌ | 24 | 0 | 8 |
| Account | /account | 971ms | ❌ | 12 | 0 | 4 |

## 🐛 Bug 分類報告

### High (9)

#### API 失敗: System Status (/api/status)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/status

#### API 失敗: Latest Report (/api/reports/latest)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/reports/latest

#### API 失敗: News Pool (/api/news/pool)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/news/pool

#### API 失敗: Config (/api/config)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/config

#### API 失敗: Portfolio Health (/api/portfolio-health)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/portfolio-health

#### API 失敗: Strategy Status (/api/strategy-status)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/strategy-status

#### API 失敗: Simulator (/api/v1/simulate)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/v1/simulate

#### API 失敗: Backtest List (/api/backtest/list)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/backtest/list

#### API 失敗: Monitoring Health (/api/monitoring/health)

- **分類**: API
- **嚴重度**: High
- **詳情**: Status: 403, Response: {"error":"Missing hash in initData"}
- **重現步驟**: GET http://localhost:3001/api/monitoring/health

### Medium (6)

#### 頁面異常: Dashboard (/)

- **分類**: Frontend
- **嚴重度**: Medium
- **詳情**: Load time: 1410ms, Console errors: 36, JS exceptions: 0, Network failures: 12
- **重現步驟**: Visit http://localhost:5173/
- **截圖**:
  - ![dogfood-output/screenshot-dashboard-1786583562251.png](dogfood-output/screenshot-dashboard-1786583562251.png)
- **Console 錯誤**:
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `{traceId: api-fetch, path: /api/status, status: 500, statusText: Internal Server Error, errorText: } ❌ [apiFetch] API /api/status failed: 500 Internal Server Error `
- **網路失敗**:
  - http://localhost:5173/api/status (500 Internal Server Error)
  - http://localhost:5173/api/reports?limit=1 (500 Internal Server Error)
  - http://localhost:5173/api/news (500 Internal Server Error)
  - http://localhost:5173/api/portfolio/health (500 Internal Server Error)
  - http://localhost:5173/api/status (500 Internal Server Error)

#### Console 錯誤: Dashboard (/)

- **分類**: Console
- **嚴重度**: Medium
- **詳情**: Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); {traceId: api-fetch, path: /api/status, status: 500, statusText: Internal Server Error, errorText: } ❌ [apiFetch] API /api/status failed: 500 Internal Server Error 
- **重現步驟**: Visit http://localhost:5173/ and open DevTools Console

#### 頁面異常: Simulator (/simulator)

- **分類**: Frontend
- **嚴重度**: Medium
- **詳情**: Load time: 1025ms, Console errors: 24, JS exceptions: 0, Network failures: 8
- **重現步驟**: Visit http://localhost:5173/simulator
- **截圖**:
  - ![dogfood-output/screenshot-simulator-1786583563366.png](dogfood-output/screenshot-simulator-1786583563366.png)
- **Console 錯誤**:
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `{traceId: api-fetch, path: /api/status, status: 500, statusText: Internal Server Error, errorText: } ❌ [apiFetch] API /api/status failed: 500 Internal Server Error `
- **網路失敗**:
  - http://localhost:5173/api/status (500 Internal Server Error)
  - http://localhost:5173/api/reports?limit=1 (500 Internal Server Error)
  - http://localhost:5173/api/news (500 Internal Server Error)
  - http://localhost:5173/api/portfolio/health (500 Internal Server Error)
  - http://localhost:5173/api/status (500 Internal Server Error)

#### Console 錯誤: Simulator (/simulator)

- **分類**: Console
- **嚴重度**: Medium
- **詳情**: Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); {traceId: api-fetch, path: /api/status, status: 500, statusText: Internal Server Error, errorText: } ❌ [apiFetch] API /api/status failed: 500 Internal Server Error 
- **重現步驟**: Visit http://localhost:5173/simulator and open DevTools Console

#### 頁面異常: Account (/account)

- **分類**: Frontend
- **嚴重度**: Medium
- **詳情**: Load time: 971ms, Console errors: 12, JS exceptions: 0, Network failures: 4
- **重現步驟**: Visit http://localhost:5173/account
- **截圖**:
  - ![dogfood-output/screenshot-account-1786583564427.png](dogfood-output/screenshot-account-1786583564427.png)
- **Console 錯誤**:
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
  - `{traceId: api-fetch, path: /api/status, status: 500, statusText: Internal Server Error, errorText: } ❌ [apiFetch] API /api/status failed: 500 Internal Server Error `
- **網路失敗**:
  - http://localhost:5173/api/status (500 Internal Server Error)
  - http://localhost:5173/api/reports?limit=1 (500 Internal Server Error)
  - http://localhost:5173/api/news (500 Internal Server Error)
  - http://localhost:5173/api/portfolio/health (500 Internal Server Error)

#### Console 錯誤: Account (/account)

- **分類**: Console
- **嚴重度**: Medium
- **詳情**: Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); Failed to load resource: the server responded with a status of 500 (Internal Server Error); {traceId: api-fetch, path: /api/status, status: 500, statusText: Internal Server Error, errorText: } ❌ [apiFetch] API /api/status failed: 500 Internal Server Error 
- **重現步驟**: Visit http://localhost:5173/account and open DevTools Console

## 📝 建議後續行動

2. **優先修復 High Bugs** (9 個) - 影響主要使用流程
3. **排程修復 Medium Bugs** (6 個) - 影響使用者體驗
