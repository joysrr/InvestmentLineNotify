---
type: plan
status: active
created: 2026-11-07
last_updated: 2026-11-07
tags:
  - backend-api
  - endpoint-cleanup
  - data-verification
  - mini-app
wiki_links: []
---

# 後端端點精簡與原始資料驗證計劃

## 目的

1. **端點精簡**：盤點所有後端端點與前端實際調用，識別未使用端點，評估可否安全移除。
2. **原始資料驗證**：透過 `data/` 目錄下的原始資料（不透過外部 API、不透過 Agent 服務），驗證各端點回傳的資料正確性。

## 基礎（本次盤點發現）

### 後端路由文件（12 個）

| 檔案                   | HTTP 端點數           | 前端 ENDPOINTS 是否定義                           | 前端是否實際調用                               |
| ---------------------- | --------------------- | ------------------------------------------------- | ---------------------------------------------- |
| status.mjs             | GET /status           | ✅ status                                         | ✅ DashboardView, AccountView, MarketRadarView |
| strategyStatus.mjs     | GET /strategy-status  | ❌                                                | ✅ DashboardView（硬編碼 URL）                 |
| portfolioHealth.mjs    | GET /portfolio/health | ❌                                                | ✅ DashboardView（硬編碼 URL）                 |
| reports.mjs            | 11 個端點             | ✅ reports.*, reportNews                          | ✅ 多個 View                                   |
| news.mjs               | GET /news             | ✅ news                                           | ✅ DashboardView, NewsView, market.js          |
| socialSentiment.mjs    | GET /social-sentiment | ✅ socialSentiment                                | ✅ MacroBattleView                             |
| config.mjs             | 5 個端點              | ✅ strategyConfig                                 | ✅ StrategyConfigPanel.vue                     |
| replayEvidence.mjs     | GET /replay-evidence  | ✅ replayEvidence                                 | ✅ ReportsView.vue                             |
| dataEvidenceReport.mjs | 3 個端點              | ✅ dataEvidenceReport, dataEvidenceReportDownload | ✅ SimulatorView                               |
| v1/simulate.mjs        | 8 個端點              | ❌                                                | ⚠️ 需確認 SimulatorView 調用方式               |
| monitoringRoutes.mjs   | 8 個端點              | ❌                                                | ❌ 未在前端調用（後端內部）                    |
| deployRoutes.mjs       | 5 個端點              | ❌                                                | ❌ 未在前端調用（後端內部）                    |

### 前端 ENDPOINTS 定義（16 個）

全部定義於 `webapp/src/api/config.js` line 14-48。

### 原始資料目錄（`data/`）

| 子目錄                              | 說明                                     |
| ----------------------------------- | ---------------------------------------- |
| data/market/latest.json             | 最新市場狀態                             |
| data/market/history/*.json          | 歷史市場資料（2026-10-09 至 2026-11-07） |
| data/news/pool_active.json          | 新聞池                                   |
| data/news/pool_filtered_active.json | 過濾後新聞（news.mjs 讀取此檔）          |
| data/news/archive/*.json            | 新聞歸檔                                 |
| data/reports/*.json                 | 報告資料                                 |
| data/sentiment/*.json               | 社群情緒                                 |
| data/monitoring/                    | 監控資料（空）                           |

## 驗收標準（6 項）

1. 每個後端端點是否被前端實際調用，有明確記錄（是/否 + 調用位置）
2. 未被前端調用的端點，其用途與啟用條件有記錄，可安全評估是否移除
3. 每個被調用端點，透過 `data/` 原始資料驗證回傳內容正確（不透過外部 API）
4. P0 DCA 執行路徑不受影響（理論模組不得覆寫 P0 DCA 執行紀律）
5. 移除未使用端點前，需有回滾方案（git commit 作為回滾點）
6. 計畫完成後歸檔至 `docs/plans/completed/`

## 執行大綱（4 階段）

### Phase 1 — 端點使用盤點（TDD：先寫驗證腳本）⏳ 等待執行

- 撰寫驗證腳本 `scripts/verify-endpoint-usage.mjs`
- 比對後端 45 個 HTTP 端點與前端實際調用（.vue/.js 中的 fetch* 調用）
- 識別「定義但未調用」與「調用但未定義」的端點
- 產出：端點使用對照表（CSV/Markdown）

### Phase 2 — 原始資料驗證（TDD：先測試，後驗證）⏳ 等待執行

- 針對每個被前端調用的端點，讀取對應的 `data/` 原始資料
- 驗證端點回傳內容與原始資料是否一致（如 news.mjs vs pool_filtered_active.json）
- 驗證計算規則（槓桿設定：0050=1x、00675L=2x；P0 DCA 無條件執行）
- 不透過外部 API、不透過 Agent 服務，僅使用本地 `data/`
- 產出：資料正確性驗證報告

### Phase 3 — 端點精簡評估（需用戶確認）⏳ 等待執行

- 基於 Phase 1 結果，評估未使用端點可否安全移除
- 針對監控/部署類端點（/monitoring/_, /deploy/_），確認是否僅供後端內部使用
- 提出精簡建議，等待用戶決策
- 不執行實際移除，僅提出建議與回滾方案

### Phase 4 — 文件更新與歸檔 ✅ 等待執行

- 更新 `docs/wiki-index.json` 代碼映射
- 更新 `docs/api/openapi.json`（若涉及端點變更）
- 歸檔本計劃至 `docs/plans/completed/`
- Commit 並推送

## 文件與 Wiki 更新

- 本計劃文件於每個階段完成後更新進度
- 驗證結果同步至 `docs/wiki-index.json`
- 完成後歸檔至 `docs/plans/completed/`

---

**目前狀態**：建立計畫，等待用戶確認後執行 Phase 1。
