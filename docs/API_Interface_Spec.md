---
type: reference
status: current
last_updated: 2026-11-21
related_code:
  - webapp/src/api/config.js
  - webapp/src/api/index.js
  - src/api/server.mjs
  - src/api/routes/status.mjs
  - src/api/routes/reports.mjs
  - src/api/routes/portfolioHealth.mjs
  - src/domain/ilnState.mjs
tags:
  - api
  - specification
  - rest
wiki_links:
  - [[API Index]]
---

# InvestmentLineNotify 前後端 API 與資料結構規格書

**用途**：供後續重新設計輕量版 WebApp 參考。
**來源**：僅依照 `webapp/src/api/*` 與 `src/api/*` 實際程式碼，以及 `data/reports/2026-11-11.json` 最新一筆實際回報內容。未在程式碼/資料中出現的欄位不列入，若前端預期但後端未產出，會在說明中標註。
**敏感資訊**：持有金額、總貸款、帳號等皆以假值或遮罩呈現，僅供結構參考。

---

## 1. API Endpoints 清單

前端呼叫封裝位於 `webapp/src/api/index.js`，端點路徑定義於 `webapp/src/api/config.js` (`ENDPOINTS`)；全部經 `apiFetch(path, options)` 發送，基礎路徑為 `API_BASE + /api`。後端路由註冊於 `src/api/routes/*.mjs`，進入點為 `src/api/server.mjs`。

| 前端函數                             | 定義位置                      | HTTP | 路徑（`/api` 後）                                       | 查詢參數                                                                                                                | 後端路由檔                              | 前端呼叫頁面                                                     |
| ------------------------------------ | ----------------------------- | ---- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| `fetchReports(limit = 30)`           | `webapp/src/api/index.js:241` | GET  | `/reports`                                              | `limit`                                                                                                                 | `src/api/routes/reports.mjs`            | Dashboard, MarketRadar, MacroBattle, AccountView, TechnicalPanel |
| `fetchWeeklyReports(limit = 12)`     | `index.js:244`                | GET  | `/reports/weekly`                                       | `limit`                                                                                                                 | `reports.mjs`                           | API 定義存在，現有頁面呼叫未大量出現                             |
| `fetchMonthlyReports(limit = 12)`    | `index.js:247`                | GET  | `/reports/monthly`                                      | `limit`                                                                                                                 | `reports.mjs`                           | 同上                                                             |
| `fetchLatestTheoretical()`           | `index.js:250`                | GET  | `/report/latest-theoretical`                            | 無                                                                                                                      | `reports.mjs`                           | -                                                                |
| `fetchNews()`                        | `index.js:253`                | GET  | `/news`                                                 | 無                                                                                                                      | `src/api/routes/news.mjs`               | NewsView                                                         |
| `fetchSocialSentiment()`             | `index.js:255`                | GET  | `/social-sentiment`                                     | 無                                                                                                                      | `src/api/routes/socialSentiment.mjs`    | 社群情緒頁面                                                     |
| `fetchDataEvidenceReport()`          | `index.js:264`                | GET  | `/data-evidence-report`                                 | 無                                                                                                                      | `src/api/routes/dataEvidenceReport.mjs` | -                                                                |
| `fetchDataEvidenceReportDownload()`  | `index.js:268`                | GET  | `/data-evidence-report/download`                        | `ticket`                                                                                                                | `dataEvidenceReport.mjs`                | 下載用                                                           |
| `fetchReplayEvidence()`              | `index.js:276`                | GET  | `/replay-evidence`                                      | 無                                                                                                                      | `src/api/routes/replayEvidence.mjs`     | -                                                                |
| `fetchStatus()`                      | `index.js:279`                | GET  | `/status`                                               | 無                                                                                                                      | `src/api/routes/status.mjs`             | Dashboard, MarketRadar, AccountView                              |
| `fetchReportNews()`                  | `index.js:281`                | GET  | `/report/news`                                          | 無                                                                                                                      | `news.mjs`                              | NewsView                                                         |
| `fetchSnapshots(limit = 90)`         | `index.js:284`                | GET  | `/reports/snapshots`                                    | `limit`                                                                                                                 | `reports.mjs`                           | -                                                                |
| `fetchSnapshotsWeekly(limit = 52)`   | `index.js:287`                | GET  | `/reports/snapshots/weekly`                             | `limit`                                                                                                                 | `reports.mjs`                           | -                                                                |
| `fetchSnapshotsMonthly(limit = 120)` | `index.js:290`                | GET  | `/reports/snapshots/monthly`                            | `limit`                                                                                                                 | `reports.mjs`                           | -                                                                |
| `fetchStrategyConfig()`              | `index.js:293`                | GET  | `/strategy-config`                                      | 無                                                                                                                      | `src/api/routes/config.mjs`             | -                                                                |
| `fetchPortfolioHealth(params = {})`  | `index.js:298`                | GET  | `/portfolio/health`                                     | `maintenanceMargin`, `z2Ratio`, `survivalDropPercent`, `currentGrossLeverage`, `vix`, `currentAge`, `macroSentiment` 等 | `src/api/routes/portfolioHealth.mjs`    | DashboardView                                                    |
| `fetchStrategyStatus()`              | `index.js:318`                | GET  | `/api/strategy-status`（寫死完整路徑，未經 `buildUrl`） | 無                                                                                                                      | `src/api/routes/strategyStatus.mjs`     | -                                                                |

**注意**：`fetchStrategyStatus` 直接呼叫 `/api/strategy-status`，未使用 `ENDPOINTS` 對應項，屬於例外寫法。

---

## 2. 各 Endpoint 實際回傳欄位結構

### 2.1 Status / 排程狀態 API `GET /status`

後端檔案：`src/api/routes/status.mjs`
回傳最上層結構（由 `IlnState.toStatusPayload()` 建構）：

```json
{
  "_meta": { ... },
  "data": { ... },
  "leadingIndicators": null | { ... }
}
```

| 欄位                | 說明                                                                                                                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_meta`             | 建構 `IlnState` 時傳入的 `meta`，內容依資料來源而異（例如最新市場檔的 `_meta`）。**沒有固定的 `lastRun` 頂層欄位**，若存在，藏在 `_meta` 內部，非固定鍵。                                                                                                                                                         |
| `data`              | 等於 `data/market/latest.json` 的 `data` 物件（若來源不存在則 `{}`）；實際 key 由市場資料 provider 產出。可見 `rawNdc`、`rawMargin`、`rawFx`、`rawCnn`、`rawValuation`、`rawMarketOverview`、`rawInstitutional`、`rawStockMargin` 等 slot；不應把報表的 `portfolio`、`signals`、`ai` 當成此 `data` 的固定子欄位。 |
| `leadingIndicators` | 從 `rawReport?.leadingIndicators` 帶入，實際資料檔中常為 `null` 或空物件。                                                                                                                                                                                                                                        |

**前端 Dashboard 實際消費欄位**（以 `webapp/src/views/DashboardView.vue` 與測試模組為準）：

- `status.data.rawNdc.light`（例如 `"綠"`）

**前端預期但後端未產出的欄位**：`status._meta.lastRun`。程式碼中 `status` payload 本身沒有固定 `lastRun` 欄位；若前端重新設計依賴此欄位，需要後端補上或改用 `_meta` 內部時間欄位。

---

### 2.2 Reports / 報表 API `GET /reports`

後端檔案：`src/api/routes/reports.mjs`
資料檔單筆報表基底（以 `data/reports/2026-11-11.json` 實際內容為準，金額已遮罩/假值）：API 的 `/reports` handler 會再合併 `buildReportReadOnlyView(report)` 產生的唯讀衍生欄位（見 `src/modules/strategy/reportReadOnlyView.mjs`）；以下基底範例不代表 API 最終物件包含的全部欄位。`REPORT_SCHEMA` 與 `READ_ONLY_REPORT_VIEW_SCHEMA` 分別定義回傳驗證結構。列出前端需求的欄位皆依資料檔或 schema，其他衍生欄位需查該唯讀 view 實作。

```json
{
  "date": "2026-11-11",
  "price0050": 178,
  "currentPrice": 285,
  "basePrice": 150,
  "portfolio": {
    "totalValue": 1200000,
    "qty0050": 12000,
    "qtyZ2": 6000,
    "cash": 80000,
    "totalLoan": 900000,
    "lastBuyDate": "2026-07-15"
  },
  "VIX": 18.5,
  "vixArr": [18, 19, 18.5, 17, 18],
  "marketState": {
    "valuation": { "pe": 18.5, "pb": 1.8, "currentPR": 45 },
    "sentiment": { "vix": 18.5, "cnnScore": 45 },
    "liquidity": { "twMarket": { "turnover100M": 4500 } },
    "economy": { "cpi": 2.1 }
  },
  "strategySnapshot": { ... 完整策略快照 ... },
  "signals": { ... 見下方 ... },
  "dataAsOf": null,
  "dataProvenance": [],
  "strategyHash": null,
  "fixtureSource": null,
  "theoreticalSnapshot": {
    "status": "UNAVAILABLE",
    "reason": "MISSING_PORTFOLIO",
    "snapshot": null
  },
  "availability": {
    "status": "UNAVAILABLE",
    "reason": "MISSING_PROVENANCE"
  }
}
```

#### `report.signals` 實際欄位（完整鍵名）

```
date, price0050, currentPrice, basePrice, portfolio, VIX, vixArr,
priceChangePercent, priceUpPercent, priceDropPercent, maintenanceMargin,
z2Ratio, actualLeverage, grossLeverage, grossLeverageResult,
maintenanceRisk, marginAnalysis, netAsset, score, weightScore,
weightDetails, signalDirection, target, suggestion, status,
targetSuggestionShort, targetSuggestion, signalCategory, signalType,
cooldownStatus, valuationGuardResult, valuationMomentumResult,
panicBypassActive, trailingActive, regimeState, regimeResult,
budgetInfo, budgetAllowedAmount, budgetIsLimited, budgetLimitedReason
```

範例值：

```json
{
  "score": 62,
  "weightScore": 62,
  "weightDetails": {
    "dropScore": 4,
    "rsiScore": 4,
    "macdScore": 2,
    "kdScore": 1,
    "sentimentScore": 1
  },
  "signalDirection": "long",
  "target": "🔹 0050 DCA",
  "suggestion": "維持觀望",
  "status": "🌱",
  "targetSuggestionShort": "維持觀望",
  "targetSuggestion": "維持觀望",
  "signalCategory": "baseline",
  "signalType": "baseline",
  "cooldownStatus": {
    "inCooldown": false,
    "daysLeft": 0,
    "lastBuyDate": "2026-07-15",
    "message": "無冷卻期資料"
  },
  "valuationGuardResult": {
    "currentPR": 45,
    "guardActive": false,
    "latchActive": false
  },
  "valuationMomentumResult": {
    "momentumMultiplier": 1,
    "accelerationPenaltyMultiplier": 1
  },
  "panicBypassActive": false,
  "trailingActive": false,
  "regimeState": { "lifecycleStage": "EARLY" },
  "regimeResult": {
    "state": "NORMAL",
    "leverageMultiplier": 1,
    "mode": "normal"
  },
  "budgetInfo": {
    "dailyCap": 50000,
    "rollingCap": 150000,
    "rollingUsed": 5000,
    "rollingAvailable": 145000,
    "dailyAvailable": 50000,
    "dailyDcaReserve": 1500,
    "tacticalPool": 48500,
    "signalTypePool": "baseline",
    "poolAllocationRatio": 1,
    "poolAmount": 1500
  },
  "budgetAllowedAmount": 1500,
  "budgetIsLimited": false,
  "budgetLimitedReason": null
}
```

#### AI 教練建議（AI Coach）實際位置

- 欄位：資料契約 `REPORT_SCHEMA.properties.ai` 定義為 **JSON 物件**（非 JSON 字串、非 nullable）；此欄位非必填。
- 實際最新資料檔中**沒有 `ai` 鍵**，是缺漏而非 `null`。未由此樣本證實其他執行條件會填入何值。
- 實際上前端可用的「建議」資訊並未掛在 `report.ai`，而是分散在：
  - `signals.suggestion`（字串，例如 `"維持觀望"`）
  - `signals.targetSuggestion` / `signals.targetSuggestionShort`
  - `signals.status`（例如 `"🌱"`）
  - `signals.signalCategory` / `signals.signalType`

**結論**：不要把 `report.ai` 當成一定存在的 AI 建議物件；實際資料樣本中該鍵缺漏。前端若要顯示策略建議，可使用 `signals.suggestion`，並容許 `ai` 未提供。**它不等同 AI 教練生成內容**；本規格不推斷其他流程會否填入 AI 欄位。

---

### 2.3 Portfolio Health / 帳戶健康度 API `GET /portfolio/health`

後端檔案：`src/api/routes/portfolioHealth.mjs`
回傳結構：

```json
{
  ...computePortfolioHealth(ctx, strategy, lifecycleContext) 的全部欄位,
  "lightStatus": "...",
  "vixTW": null | number,
  "_meta": {
    "source": "query" | "latest_report",
    "reportDate": "2026-11-11" | null,
    "cachedAt": "2026-11-21T...Z"
  }
}
```

後端輸入 `ctx`（優先使用 Query，次之最新戰報，最後為 0）：

| `ctx` 欄位                 | 來源優先順序                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `maintenanceMargin`        | `query.maintenanceMargin` → `latestReport.signals.maintenanceMargin` → `0`                                  |
| `z2Ratio`                  | `query.z2Ratio` → `latestReport.signals.z2Ratio` → `0`                                                      |
| `survivalDropPercent`      | `query.survivalDropPercent` → `latestReport.signals.marginAnalysis.riskAssessment?.survivalDropLimit` → `0` |
| `currentGrossLeverage`     | `query.currentGrossLeverage` → `latestReport.signals.grossLeverage` → `0`                                   |
| `vix`                      | `query.vix` → `latestReport.marketState.sentiment.vix` → `0`                                                |
| `vixTW`                    | 由 `getTwVix()` 即時取得，失敗則 `null`                                                                     |
| `macroSentiment.direction` | `query.macroSentiment` → `latestReport.macroAnalysis.conclusion.market_direction` → `"NEUTRAL"`             |
| `currentAge`               | `query.currentAge` → 策略 `lifecycle.currentAge` → `33`                                                     |

前端呼叫：`fetchPortfolioHealth(params)` 在 `DashboardView.vue`，可傳入上述 query；未傳入時後端以最新戰報 `signals` 做 fallback，缺失則為 `0`。

`computePortfolioHealth` 實際程式碼回傳 `status`、`score`、`components`、`summary`、`recommendations`、`timestamp`；各 `components` 為 `margin`、`survival`、`decoupling`、`leverage`、`lifecycle`、`regime`，每項含 `status`、`score`、`details`。路由再加上 `lightStatus`、`vixTW`、`_meta`。**此 API 不產出 `weightScore` 或 `cooldown` 欄位**；勿將它們視為健康度契約。`timestamp` 為計算健康度時產生的 ISO 時間。建議仍以實際執行該 endpoint 的 JSON 做部署環境驗證。

---

## 3. 其他子頁面／分頁共用 API 與缺欠／多餘欄位

### 共用 API

- `GET /reports` 與 `GET /status` 是最共用的：Dashboard、MarketRadar、AccountView、MacroBattle、TechnicalPanel 均有呼叫。
- `GET /news` / `GET /report/news` 供 NewsView。
- `GET /social-sentiment` 供社群情緒相關頁面。
- `GET /portfolio/health` 目前由 DashboardView 呼叫。

### 欄位缺漏（後端沒產出、前端可能預期）

| 項目                                            | 說明                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `status._meta.lastRun`                          | 前端測試與說明常提及 `lastRun`，但後端 `/status` payload 本身沒有固定 `lastRun` 欄位；僅可能出現在 `_meta` 內部，非頂層固定鍵。 |
| `report.ai`                                     | 資料契約定義為可選 JSON 物件；實際樣本中鍵缺漏（非 `null`），不應當作一定存在。                                                 |
| `report.macroData` / `report.leadingIndicators` | 實際最新報告中鍵名為空陣列或 `null`，前端若依賴需容許缺漏。                                                                     |

### 前端多餘 fallback（非後端契約）

- `DashboardView.vue` 多處使用不一致的頂層 fallback（例如直接存取 `status.data.rawNdc.light`），重新設計時應統一以 `/status` 與 `/reports` 實際回傳結構為準，不應依賴未在後端產出的欄位。

---

## 4. 驗證記錄

- 檢查來源：`webapp/src/api/config.js`、`webapp/src/api/index.js`、`src/api/routes/status.mjs`、`src/api/routes/reports.mjs`、`src/api/routes/portfolioHealth.mjs`、`src/domain/ilnState.mjs`
- 實際資料樣本：`data/reports/2026-11-11.json`（金額已遮罩）
- 生成時間：2026-11-21（台灣時間）
- 備註：本規格僅描述介面契約與實際欄位，不包含業務邏輯重構建議；重新設計 WebApp 時，以實際 endpoint 回傳 JSON 為最終準則。
