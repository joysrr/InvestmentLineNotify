---
type: plan
status: completed
created_at: 2026-11-19
last_updated: 2026-11-19
progress: "M0–M4 完成（production bundle budget 有 0.6 KB 既有限制）"
tags:
  - development
  - mock
  - testing
  - visual-regression
summary: "建立可切換、可重複、具真實內容的前端情境式 mock，支援本地開發、Playwright 驗證與視覺回歸，不改動 production authentication。"
related_code:
  - webapp/src/dev-mock/
  - webapp/scripts/verify-all-pages.mjs
  - webapp/scripts/capture-p4-screenshots.mjs
  - webapp/src/api/index.js
---

# 前端情境式 Mock 計畫（2026-11-19）

## 1. 目標

讓開發時能即時看到具真實內容的 UI/UX 結果，並以固定情境重複驗證正常、空資料、錯誤、高風險、弱網與深色模式；同一套 fixture 同時服務本地開發、Playwright smoke test 與截圖驗證。

## 2. 範圍

### 包含

- 建立集中式 deterministic fixtures 與 API mock router。
- 支援 `rich`、`risk`、`empty`、`error`、`weak-network` 情境。
- 透過明確的 `VITE_USE_MOCK_API=true` 或測試注入啟用。
- 更新 all-pages verification 與 screenshot capture 使用共用 mock。
- 補充 mock 使用說明與情境驗證命令。
- 驗證五項底部導航（含新聞）在 populated data 下實際呈現。

### 不包含

- 不改動 production API、Telegram production authentication 或後端資料模型。
- 不在 production bundle 啟用 dev bypass 或 mock。
- 不以 mock 取代正式 E2E/API contract test。

## 3. 情境契約

| 情境           | 用途                                 |
| -------------- | ------------------------------------ |
| `rich`         | 預設完整資料、開發與截圖基準         |
| `risk`         | 高 VIX、偏空、風險警示與防守 CTA     |
| `empty`        | EmptyState、空圖表與首次使用流程     |
| `error`        | 401/500/錯誤提示與重試流程           |
| `weak-network` | 延遲、部分失敗、loading/offline 行為 |

可透過 query `?mock=<scenario>` 覆寫環境預設，但僅在 DEV/test 生效。

## 4. 驗收標準

- 所有主要頁面在 `rich` 情境具有可見且合理的非空內容。
- News 頁與五項 bottom navigation 在截圖中可驗證。
- `empty`、`error`、`risk`、`weak-network` 情境可重複觸發。
- all-pages verification 在 rich 情境全頁通過，且只攔截 `/api/`。
- 截圖產物可辨識 mock 情境，並完成至少一組基準與差異檢查。
- production build 與既有 authentication 行為不受影響。

## 5. 詳細階段與 Todo

### M0：邊界、啟用規則與驗收契約

- [x] 確認 mock 僅服務 DEV／test／Playwright，不改 production authentication。
- [x] 確認只攔截 `/api/`，Vite module、asset 與 route navigation 一律放行。
- [x] 確認情境名稱、切換優先序與錯誤／延遲行為。
- [x] 建立本計畫 Todo，後續依階段逐一驗收。

### M1：資料契約與集中式 Mock 核心

- [x] 完成 API 消費者盤點：每個頁面使用的 endpoint、預期 response shape、空態與錯誤態（已完成盤點，見下方表格）。
- [x] 設計 fixture schema 與 deterministic seed，涵蓋 status、reports、snapshots、news、sentiment、strategy config、portfolio health。
- [x] 建立 `webapp/src/dev-mock/`：scenario resolver、fixtures、endpoint router、response helpers。
- [x] 定義 `rich`、`risk`、`empty`、`error`、`weak-network` 的逐 endpoint 行為。
- [x] 為 mock router 補單元測試，避免 fixture shape 漂移（7 測試全過）。

#### M1 盤點結果（2026-11-19）

| 消費者                                          | Endpoint                               | 最小 response contract                                           |
| ----------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| Dashboard / Account / Radar                     | `/api/status`                          | `{ _meta: { lastRun }, data: { rawUsMarket, rawNdc } }`          |
| Dashboard / Account / Radar / Macro / Technical | `/api/reports?limit=`                  | 陣列；項目含 `signals`、`portfolio`、`marketState`、`ai`         |
| Dashboard                                       | `/api/portfolio/health`                | health summary object；rich 情境需含可顯示風險數值               |
| Chart / Account snapshot composable             | `/api/reports/snapshots*`              | `{ snapshots: [], hasEncryption }` 或陣列（weekly/monthly 相容） |
| News                                            | `/api/news`                            | `{ articles: [] }` 或 `{ items: [] }`                            |
| News                                            | `/api/report/news`                     | `{ tw, us, generatedAt }`                                        |
| Macro                                           | `/api/social-sentiment`                | sentiment object；失敗時 consumer 可接受 `null`                  |
| Strategy status drawer                          | `/api/strategy-status`                 | strategy status summary/panel object                             |
| Strategy config editor                          | `/api/strategy-config/meta`            | `{ fields: [], version }`                                        |
| Strategy config editor                          | `/api/strategy-config`                 | config object；POST 更新可回 200                                 |
| Strategy config editor                          | `/api/strategy-config/default`         | default config object                                            |
| Data evidence card                              | `/api/data-evidence-report`            | report object；POST 同 endpoint 可回 200                         |
| Replay / deployment（互動操作）                 | `/api/replay-evidence`, `/api/deploy*` | 非首屏 smoke；由 error scenario 覆蓋 4xx/5xx                     |

主要頁面為 Dashboard、Account、Technical、Radar、Macro、Chart、News、Strategy、Strategy Config，共 9 頁；底部導航保留五項且 News 為第五項。

### M2：開發與驗證工具整合

- [x] 以 `VITE_USE_MOCK_API=true` 作為明確開關，預設不影響正常 DEV API 行為。
- [x] 加入 DEV/test 限定的 `?mock=<scenario>` query override；production 一律忽略。
- [x] 更新 `verify-all-pages.mjs` 使用共用 router，保留非 `/api/` request pass-through。
- [x] 更新 `capture-p4-screenshots.mjs` 使用 `rich` fixture，標示情境與 viewport。
- [x] 更新 E2E utilities，讓測試可指定 scenario、延遲與 endpoint failure。
- [x] 補充開發者文件與啟動命令範例。

### M3：情境與視覺驗證

- [x] `rich`：九個主要頁面都有非空、合理且穩定的內容（9/9）。
- [x] `risk`：風險指標、偏空訊號、警示 CTA 與顏色語義正確。
- [x] `empty`：EmptyState、空圖表與空新聞狀態可見且無 console error。
- [x] `error`：502／部分 endpoint 失敗、錯誤提示與 retry CTA 可驗證。
- [x] `weak-network`：2500ms 延遲行為可重複。
- [x] 驗證五項 bottom navigation，確認 News 為 index 4。
- [x] 使用 vision tool 檢查四種 viewport 截圖；重複 dashboard-375 pixel diff 為 0%。

### M4：品質、安全與結案

- [x] 執行 mock 單元測試、既有測試、lint 與 all-pages verification（mock 7/7；五情境各 9/9）。
- [x] 執行 production build，確認 mock code 不會在 production 啟用或繞過 auth（bundle scan 無 mock symbols）。
- [x] 檢查 production bundle 中不存在 `dev-bypass` 啟用路徑或未受保護的 mock interceptor。
- [x] 整理各情境命令、截圖、測試輸出與已知限制。
- [x] 更新本計畫進度與交接紀錄；所有驗收通過後標記 completed。

## 6. 目前狀態

此計畫承接已結案的 UI/UX P1–P4，但 mock 層是獨立的開發／驗證基礎建設，完成後再另行結案。

## 7. 更新紀錄

- 2026-11-19：建立計畫；結案 UI/UX 優化與決策體驗計畫，將情境式 mock 獨立管理。
- 2026-11-20（最後一輪）：修正臨時時間戳（固定 MOCK_NOW）、補充截圖驗證、確認 production bundle 無 mock symbols、列出 0.6 KB bundle budget 超標為已知限制、測試 7/7、五情境 9/9、截圖重複 pixel diff 0%，計畫 M0–M4 completed。截圖腳本目前仍保留 Playwright inline API route（僅攔截 `/api/`）；後續可再抽取為共用 router。
