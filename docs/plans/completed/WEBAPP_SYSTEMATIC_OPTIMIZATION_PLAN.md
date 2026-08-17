# WebApp 系統性優化計畫 (v2.0 Final Spec)

> **版本**: v2.0 (經 Grill-Me 審查確認，鎖定執行規格)
> **更新日期**: 2026-08-16
> **狀態**: 🔴 Active
> **目標分支**: `optimize/webapp-systematic`
> **前置條件**: Mini App Bug Fix Phase 1-3 已完成並部署至正式區

---

## 📌 Grill-Me 審查決策總表

| 議題                      | 決策                                                        | 理由                                                                                     |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Q1 Code Splitting 策略    | 標準三向分包 (vendor-vue / vendor-element / vendor-echarts) | 結構清晰，最大化長效快取命中，避免過多微小 chunk 的 TCP 握手延遲                         |
| Q2 死碼活用策略           | Phase 3 改為「評估後決定保留或移除」，不強制接入            | YAGNI 原則：建而不用代表需求不存在，保留元件檔案但標記為「待需求驅動」                   |
| Q3 useApiRequest 遷移策略 | Phase 4 降級為「選用」而非強制目標，保留現有手寫 try/catch  | 12 個 View 手寫邏輯已穩定運行，強制遷移風險大於收益，且 useApiRequest 本身未經正式區驗證 |
| Q4 Hardcoded 設定收斂     | Phase 5 維持原位不收斂                                      | 7 處均為 UI 設定型 (低風險)，收斂至額外設定檔增加間接層但無實際收益                      |

---

## 📌 優化全景概覽

| 階段        | 項目                                                | 優先級 | 預期效益                          | 狀態    |
| ----------- | --------------------------------------------------- | ------ | --------------------------------- | ------- |
| **Phase 1** | 打包優化 (Code Splitting + ECharts 按需)            | P1     | 首包 JS 2.47MB → 200-300KB (gzip) | ⏳      |
| **Phase 2** | 防禦網收尾 (GlobalErrorBoundary 全覆蓋)             | P0     | 消除唯一防禦缺口                  | ⏳      |
| **Phase 3** | 死碼評估 (SkeletonLoader / EmptyState / ErrorAlert) | P3     | 評估保留或移除                    | ⏳      |
| **Phase 4** | API 層收斂 (useApiRequest 選用)                     | P4     | 選用性遷移，非強制                | ⏳      |
| **Phase 5** | Hardcoded 設定維持原位                              | —      | 不需動作 (已確認低風險)           | ✅ 結案 |

---

## Phase 1: 打包優化 (Code Splitting + ECharts 按需引入)

**問題**: `vite build` 產出單包 JS 2.47MB (gzip 800KB)，Telegram Mini App 手機端首載偏重。

**現狀**:

- `vite.config.js` 未設定 `manualChunks` (Vendor 分包)
- 3 個 ECharts 圖表元件使用全量引入 `import * as echarts`
  - `src/components/simulator/SensitivityChart.vue`
  - `src/components/simulator/ParetoScatterChart.vue`
  - `src/components/simulator/TornadoChart.vue`
- 3 個 View 已正確使用按需引入 `import { use } from "echarts/core"`
  - `src/views/BacktestReportView.vue`
  - `src/views/ChartView.vue`
  - `src/views/ReportsView.vue`

**分包策略 (Grill-Me Q1 確認)**:

```js
// vite.config.js — build.rollupOptions.output.manualChunks
manualChunks: {
  'vendor-vue': ['vue', 'vue-router', '@vueuse/core'],
  'vendor-element': ['element-plus', '@element-plus/icons-vue'],
  'vendor-echarts': ['echarts', 'vue-echarts'],
}
```

**任務**:

| #   | 任務                   | 說明 / 檔案                                                                                                                                                | 狀態 |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1.1 | Vite manualChunks 設定 | `webapp/vite.config.js` 加入 `build.rollupOptions.output.manualChunks`，三向分包                                                                           | ⏳   |
| 1.2 | ECharts 全量引入改按需 | `SensitivityChart.vue`, `ParetoScatterChart.vue`, `TornadoChart.vue` 從 `import * as echarts` 改為 `import { use } from "echarts/core"` + 按需引入圖表類型 | ⏳   |
| 1.3 | 驗證打包體積           | `npm run build` 確認首包 JS < 500KB (gzip < 200KB)                                                                                                         | ⏳   |
| 1.4 | 確認圖表渲染           | 6 個圖表頁面正常渲染 (Sensitivity, Pareto, Tornado, Backtest, Chart, Reports)                                                                              | ⏳   |

**驗證**: `npm run build` 無逐步降載、所有圖表正常渲染、212 個前端測試通過

---

## Phase 2: 防禦網收尾 (GlobalErrorBoundary 全覆蓋)

**問題**: `StrategyStatusView.vue` 是唯一未接入 `GlobalErrorBoundary` 的 View (13 個中唯一缺口)。

**現狀**:

- 12/13 View 已接入 `GlobalErrorBoundary`
- `StrategyStatusView.vue` 使用手動 `loading/error/data` 狀態管理，與其他 View 不一致

**任務**:

| #   | 任務                                        | 說明 / 檔案                                                                                          | 狀態 |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- |
| 2.1 | StrategyStatusView 補上 GlobalErrorBoundary | 包裹 `<GlobalErrorBoundary>` 並遷移手動 error 處理至邊界統一捕获                                     | ⏳   |
| 2.2 | 統一 import 路徑風格                        | 全部 12 個 View 的 GlobalErrorBoundary import 統一使用 `@/components/common/GlobalErrorBoundary.vue` | ⏳   |

**驗證**: 212 個前端測試通過、E2E 策略狀態頁正常渲染

---

## Phase 3: 死碼評估 (SkeletonLoader / EmptyState / ErrorAlert)

**問題**: 3 個公共元件已建立但未被任何 View 實際使用。

**現狀**:

- `SkeletonLoader.vue` — 0 View 引用 (僅測試檔)
- `EmptyState.vue` — 0 View 引用 (僅測試檔)
- `ErrorAlert.vue` — 1 View import (DashboardView) 但模板未實際使用

**決策 (Grill-Me Q2 確認)**: YAGNI 原則。保留元件檔案但標記為「待需求驅動」，不強制接入。

**任務**:

| #   | 任務                             | 說明 / 檔案                                                          | 狀態 |
| --- | -------------------------------- | -------------------------------------------------------------------- | ---- |
| 3.1 | ErrorAlert 清理                  | 移除 DashboardView 中未實際使用的 `ErrorAlert` import (避免死碼誤導) | ⏳   |
| 3.2 | SkeletonLoader / EmptyState 標記 | 在元件 JSDoc 加上 `@since v1.0, 待需求驅動` 註記                     | ⏳   |

**驗證**: 前端測試通過、移除 ErrorAlert import 後 DashboardView 正常渲染

---

## Phase 4: API 層收斂 (選用，非強制)

**問題**: 13 個 View 中 12 個直接使用 `apiFetch` + 手寫 try/catch，`useApiRequest` 零使用率。

**決策 (Grill-Me Q3 確認)**: 降級為「選用」。12 個 View 手寫邏輯已穩定運行，強制遷移風險大於收益。未來新增 View 時優先使用 `useApiRequest`，現有 View 不主動遷移。

**任務**:

| #   | 任務           | 說明 / 檔案                                                                            | 狀態 |
| --- | -------------- | -------------------------------------------------------------------------------------- | ---- |
| 4.1 | 新增 View 規範 | 在 `useApiRequest.js` 頂部 JSDoc 加入使用規範註記：未來新增 View 優先使用此 composable | ⏳   |

**驗證**: 視未來新 View 開發時落實

---

## Phase 5: Hardcoded 設定 (已結案)

**決策 (Grill-Me Q4 確認)**: 7 處 UI 設定型 hardcoded 陣列均為低風險，維持原位不收斂。收斂至額外設定檔增加間接層但無實際收益。

**狀態**: ✅ 結案，不需動作。

---

## 📋 歷史計畫歸檔

以下已完成或過期的計畫已歸檔至 `docs/plans/completed/`:

| 計畫                         | 原位置       | 新位置       | 原因                                    |
| ---------------------------- | ------------ | ------------ | --------------------------------------- |
| `MINIAPP_BUG_FIX_PLAN.md`    | `active/`    | `completed/` | Phase 1-3 全數完成                      |
| `HARDCODED_AUDIT.md`         | `active/`    | `completed/` | 審查完成，0 高風險項                    |
| `DEPLOYMENT_CHECKLIST.md`    | `active/`    | `completed/` | 部署已完成 (PORT 3000 修正)             |
| `WEBAPP_IMPROVEMENT_PLAN.md` | `completed/` | `completed/` | Phase 1-2 已完成，Phase 3+ 已併入本計畫 |

---

## 📊 總體測試基線

| 項目             | 數量                    | 狀態                              |
| ---------------- | ----------------------- | --------------------------------- |
| 後端 API 測試    | 149                     | ✅ 全部通過                       |
| 前端 WebApp 測試 | 212                     | ✅ 全部通過                       |
| ESLint           | 0 errors / 264 warnings | ✅                                |
| `npm run build`  | 成功                    | ✅ (單包 2.47MB，待 Phase 1 優化) |
