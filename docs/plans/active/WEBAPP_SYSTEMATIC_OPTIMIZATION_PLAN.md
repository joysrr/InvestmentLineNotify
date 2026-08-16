# WebApp 系統性優化計畫 (v1.0)

> **版本**: v1.0 (基於 2026-08-16 完整代碼審查)
> **建立日期**: 2026-08-16
> **狀態**: 🔴 Active
> **目標分支**: `optimize/webapp-systematic`
> **前置條件**: Mini App Bug Fix Phase 1-3 已完成並部署至正式區

---

## 📌 優化全景概覽

| 階段        | 項目                                                | 優先級 | 預期效益                              |
| ----------- | --------------------------------------------------- | ------ | ------------------------------------- |
| **Phase 1** | 打包優化 (Code Splitting + ECharts 按需)            | P1     | 首包 JS 2.47MB → 200-300KB (gzip)     |
| **Phase 2** | 防禦網收尾 (GlobalErrorBoundary 全覆蓋)             | P0     | 消除唯一防禦缺口                      |
| **Phase 3** | 死碼活用 (SkeletonLoader / EmptyState / ErrorAlert) | P2     | 消除建而不用的公共元件                |
| **Phase 4** | API 層收斂 (useApiRequest 統一)                     | P3     | DRY 收斂，消除 12 View 手寫 try/catch |
| **Phase 5** | Hardcoded 設定收斂                                  | P4     | 7 處 UI 設定統一管理                  |

---

## Phase 1: 打包優化 (Code Splitting + ECharts 按需引入)

**問題**: `vite build` 產出單包 JS 2.47MB (gzip 800KB)，Telegram Mini App 手機端首載偏重。

**現狀**:

- `vite.config.js` 未設定 `manualChunks` (Vendor 分包)
- 3 個 ECharts 圖表元件使用全量引入 `import * as echarts`
- 3 個 View 已正確使用按需引入 `import { use } from "echarts/core"`

**任務**:

| #   | 任務                   | 說明 / 檔案                                                                                                                                                              | 狀態 |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 1.1 | Vite manualChunks 設定 | `webapp/vite.config.js` 加入 `build.rollupOptions.output.manualChunks`，拆分 `vendor-vue` (vue, vue-router), `vendor-echarts` (echarts), `vendor-element` (element-plus) | ⏳   |
| 1.2 | ECharts 全量引入改按需 | `SensitivityChart.vue`, `ParetoScatterChart.vue`, `TornadoChart.vue` 從 `import * as echarts` 改為 `import { use } from "echarts/core"` + 按需引入圖表類型               | ⏳   |
| 1.3 | 驗證打包體積           | `npm run build` 確認首包 JS < 500KB (gzip < 200KB)                                                                                                                       | ⏳   |

**驗證**: `npm run build` 無逐步降載、所有圖表正常渲染、212 個前端測試通過

---

## Phase 2: 防禦網收尾 (GlobalErrorBoundary 全覆蓋)

**問題**: `StrategyStatusView.vue` 是唯一未接入 `GlobalErrorBoundary` 的 View (13 個中唯一缺口)。

**現狀**:

- 12/13 View 已接入 `GlobalErrorBoundary`
- `StrategyStatusView.vue` 使用手動 `loading/error/data` 狀態管理，與其他 View 不一致

**任務**:

| #   | 任務                                        | 說明 / 檔案                                        | 狀態 |
| --- | ------------------------------------------- | -------------------------------------------------- | ---- |
| 2.1 | StrategyStatusView 補上 GlobalErrorBoundary | 包裹 `<GlobalErrorBoundary>` 並遷移手動 error 處理 | ⏳   |
| 2.2 | 統一 import 路徑                            | 全部 View 統一使用 `@/components/common/...` 別名  | ⏳   |

**驗證**: 212 個前端測試通過、E2E 策略狀態頁正常渲染

---

## Phase 3: 死碼活用 (SkeletonLoader / EmptyState / ErrorAlert)

**問題**: 3 個公共元件已建立但未被任何 View 實際使用。

**現狀**:

- `SkeletonLoader.vue` — 0 View 引用 (僅測試檔)
- `EmptyState.vue` — 0 View 引用 (僅測試檔)
- `ErrorAlert.vue` — 1 View import (DashboardView) 但模板未實際使用

**任務**:

| #   | 任務                | 說明 / 檔案                                                 | 狀態 |
| --- | ------------------- | ----------------------------------------------------------- | ---- |
| 3.1 | SkeletonLoader 接入 | 在 ReportsView, NewsView, StrategyStatusView 的載入狀態使用 | ⏳   |
| 3.2 | EmptyState 接入     | 在 ReportsView (無報表), NewsView (無新聞) 的空資料狀態使用 | ⏳   |
| 3.3 | ErrorAlert 接入     | 在 DashboardView 模板中實際使用已 import 的 ErrorAlert      | ⏳   |

**驗證**: 3 個元件在至少 1 個 View 中實際渲染、前端測試通過

---

## Phase 4: API 層收斂 (useApiRequest 統一)

**問題**: 13 個 View 中 12 個直接使用 `apiFetch` + 手寫 try/catch，僅 DashboardView 使用 `useApiRequestBatch`。`useApiRequest` (單一) 零使用率。

**現狀**:

- `useApiRequest` — 0/13 View 使用 (0%)
- `useApiRequestBatch` — 1/13 View 使用 (7.7%)
- 其餘 12 個 View 手動管理 loading/error/data 狀態

**任務**:

| #    | 任務                      | 說明 / 檔案                      | 狀態 |
| ---- | ------------------------- | -------------------------------- | ---- |
| 4.1  | ReportsView 遷移          | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.2  | NewsView 遷移             | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.3  | StrategyStatusView 遷移   | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.4  | StrategyConfigEditor 遷移 | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.5  | BacktestReportView 遷移   | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.6  | MarketRadarView 遷移      | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.7  | MacroBattleView 遷移      | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.8  | ChartView 遷移            | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.9  | TechnicalView 遷移        | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.10 | AccountView 遷移          | 手寫 try/catch → `useApiRequest` | ⏳   |
| 4.11 | SimulatorView 遷移        | 手寫 try/catch → `useApiRequest` | ⏳   |

**驗證**: 212+ 個前端測試通過、各 View API 呼叫正常、loading/error 體驗一致

---

## Phase 5: Hardcoded 設定收斂

**問題**: 7 處 UI 設定型 hardcoded 陣列散落各 View (已確認為低風險，非業務數據)。

**現狀 (已完成審查，均為 🟢 設定型)**:

- `SignalCategoryTable.vue` — `categoryOrder` (訊號分類順序)
- `BacktestReportView.vue` — `tabs` (頁籤定義), `benchmarkData` (動態生成)
- `ChartView.vue` — `granularities` (時間粒度), `metrics` (圖表指標)
- `ReportsView.vue` — `tabs` (戰報類型)
- `SimulatorView.vue` — 預設參數
- `StrategyConfigEditor.vue` — 欄位定義

**任務**:

| #   | 任務         | 說明 / 檔案                                                              | 狀態 |
| --- | ------------ | ------------------------------------------------------------------------ | ---- |
| 5.1 | 評估收斂策略 | 7 處 UI 設定是否需收斂至統一設定檔 (如 `config/uiConfig.js`)，或維持原位 | ⏳   |

**驗證**: 視評估結果而定

---

## 📋 歷史計畫歸檔

以下已完成或過期的計畫已歸檔至 `docs/plans/completed/` 或 `docs/plans/archive/`:

| 計畫                         | 原位置       | 新位置       | 原因                                    |
| ---------------------------- | ------------ | ------------ | --------------------------------------- |
| `MINIAPP_BUG_FIX_PLAN.md`    | `active/`    | `completed/` | Phase 1-3 全數完成                      |
| `HARDCODED_AUDIT.md`         | `active/`    | `completed/` | 審查完成，0 高風險項                    |
| `DEPLOYMENT_CHECKLIST.md`    | `active/`    | `completed/` | 部署已完成 (PORT 修正)                  |
| `WEBAPP_IMPROVEMENT_PLAN.md` | `completed/` | `completed/` | Phase 1-2 已完成，Phase 3+ 已併入本計畫 |

---

## 📊 總體測試基線

| 項目             | 數量                    | 狀態                              |
| ---------------- | ----------------------- | --------------------------------- |
| 後端 API 測試    | 149                     | ✅ 全部通過                       |
| 前端 WebApp 測試 | 212                     | ✅ 全部通過                       |
| ESLint           | 0 errors / 264 warnings | ✅                                |
| `npm run build`  | 成功                    | ✅ (單包 2.47MB，待 Phase 1 優化) |
