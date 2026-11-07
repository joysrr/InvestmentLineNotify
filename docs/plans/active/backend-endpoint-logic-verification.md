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

### Phase 1 — 端點目錄盤點（讀取現有程式碼）

- 讀取 12 個路由文件：`status.mjs`、`strategyStatus.mjs`、`portfolioHealth.mjs`、`reports.mjs`、`news.mjs`、`socialSentiment.mjs`、`config.mjs`、`replayEvidence.mjs`、`dataEvidenceReport.mjs`、`v1/simulate.mjs`、`monitoringRoutes.mjs`、`deployRoutes.mjs`
- 確認每個端點的 HTTP 方法、路徑、控制器函數
- 產出：後端端點目錄清單（30 個端點）

### Phase 2 — 用途與目的確認（比對 openapi.json 與程式碼註解）

- 將每個端點與 `docs/api/openapi.json` 51 paths 比對
- 確認每個端點的業務用途（例：`/api/portfolio/health` 用於投資組合健康檢查）
- 確認每個端點的觸發條件（例：定時排程 vs 手動觸發 vs 前端調用）
- 產出：端點用途說明表

### Phase 3 — 邏輯正確性驗證（TDD）

- 對每個端點撰寫測試（RED-GREEN-REFACTOR-VERIFY）
- 驗證計算規則（槓桿設定：0050=1x、00675L=2x；P0 DCA 無條件執行；停利條件等）
- 驗證邊界條件與錯誤處理
- 產出：端點邏輯測試報告

### Phase 4 — 前後端一致性確認與歸檔

- 確認前端 16 個 ENDPOINTS 調用的後端端點邏輯正確
- 確認 13 個未被前端調用端點的啟用條件與用途記錄完整
- 更新 `docs/wiki-index.json` 代碼映射（若涉及新概念）
- 歸檔本計劃至 `docs/plans/completed/`
- Commit 並推送

## 文件與 Wiki 更新

- 本計劃文件於每個階段完成後更新進度
- 驗證結果同步至 `docs/wiki-index.json`
- 完成後歸檔至 `docs/plans/completed/`

---

**目前狀態**：等待執行 Phase 1。
