# WebApp Phase 3-5 細節確認與執行計畫 (v1.0)

> **版本**: v1.0
> **建立日期**: 2026-08-16
> **狀態**: 🔴 Active — 待細節確認
> **前提**: Phase 1 (Code Splitting) + Phase 2 (GlobalErrorBoundary) 已完成並驗證
> **來源**: WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN.md v2.0 (Grill-Me 決策) → 已歸檔至 completed/

---

## 📋 Grill-Me 決策回顧 (v2.0 鎖定)

| 議題                      | 決策                                                        | 理由                               |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| **Q1 Code Splitting**     | 標準三向分包 (vendor-vue / vendor-element / vendor-echarts) | 結構清晰，最大化長效快取命中       |
| **Q2 死碼活用**           | Phase 3 改為「評估後決定保留或移除」，不強制接入            | YAGNI：建而不用代表需求不存在      |
| **Q3 useApiRequest 遷移** | Phase 4 降級為「選用」而非強制目標                          | 12 Views 手寫邏輯穩定，風險 > 收益 |
| **Q4 Hardcoded 收斂**     | Phase 5 維持原位不收斂                                      | 7 處均為 UI 設定型，低風險         |

---

## 🎯 Phase 3: 死碼評估 (P3 — 暫緩)

### 評估對象 (3 個元件)

| 元件               | 檔案                                              | 當前使用處 | 評估標準                       |
| ------------------ | ------------------------------------------------- | ---------- | ------------------------------ |
| **SkeletonLoader** | `webapp/src/components/common/SkeletonLoader.vue` | 0 處       | 是否有真實 loading 狀態需求    |
| **EmptyState**     | `webapp/src/components/common/EmptyState.vue`     | 0 處       | 是否有真實空資料場景           |
| **ErrorAlert**     | `webapp/src/components/common/ErrorAlert.vue`     | 0 處       | GlobalErrorBoundary 是否已覆蓋 |

### 待確認問題

1. **是否有新頁面/功能需要 Skeleton 效果？** (如報表載入、圖表渲染中)
2. **是否有 API 可能回傳空陣列需顯示友善提示？** (如無回測記錄、無新聞)
3. **ErrorAlert vs GlobalErrorBoundary 的分工界線？** (前者 inline、後者全頁)

### 執行選項

| 選項                                     | 說明                             | 優點                 | 缺點             |
| ---------------------------------------- | -------------------------------- | -------------------- | ---------------- |
| **A: 保留檔案，標記 `@available` JSDoc** | 不刪除，不強制接入，有需求時再用 | 零風險、保留投資     | 檔案長期閒置     |
| **B: 移至 `archived/` 目錄**             | 物理隔離，需求時再搬回           | 清楚區分 active/dead | 稍微增加取用步驟 |
| **C: 完全刪除**                          | 徹底清理                         | 最乾淨               | 可能誤刪未來需求 |

**建議**: **選項 A** — YAGNI 原則，保留但標記可用狀態。

---

## 🎯 Phase 4: useApiRequest 選用遷移 (P4 — 選用制)

### 現狀分析

| 項目              | 現狀                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| **useApiRequest** | `webapp/src/composables/useApiRequest.js` — Loading/Error/Retry 封裝 |
| **useApiBatch**   | `webapp/src/composables/useApiBatch.js` — 並行請求批次               |
| **現有 12 Views** | 全部手寫 `try/catch` + `ref` + `onMounted` fetch                     |
| **已採用者**      | 僅 `DashboardView.vue` 使用 `useApiBatch`                            |

### 遷移策略 (選用制)

| 原則               | 說明                                                  |
| ------------------ | ----------------------------------------------------- |
| **新 View 必用**   | 新增頁面預設使用 useApiRequest                        |
| **既有 View 選用** | 重構/重寫時可選用，不強制                             |
| **錯誤處理統一**   | 無論用不用 composable，錯誤皆拋給 GlobalErrorBoundary |

### 待確認問題

1. **useApiRequest 是否已支援所有現有需求？** (retry 次數、timeout、abort、取消重複請求)
2. **是否需要新增 `useApiMutation` (POST/PUT/DELETE) 區分查詢與寫入？**
3. **TypeScript 化時機？** (目前全專案 JS，遷移可順便加型別)

### 執行選項

| 選項                                   | 說明                             |
| -------------------------------------- | -------------------------------- |
| **A: 現狀維持，文件化「選用指南」**    | 不動代碼，只寫 README 供未來參考 |
| **B: 修正 useApiRequest 缺口，再推廣** | 先補強 composable 功能           |
| **C: 下個新 View 實戰驗證**            | 以實戰檢驗 API 設計              |

**實際決策**: **B 已完成，A 已完成；C 延至下一個新 View**。

已補強 `useApiRequest`：`retry`、`retryDelay`、`dedup`、opt-in `abort` / `cancel()`，並新增 `docs/useApiRequest-guide.md`。既有 Views 不強制遷移。

---

## 🎯 Phase 5: Hardcoded 設定維持原位 (P5 — 結案)

### 審計結果 (v2.0 已確認)

| #   | 檔案                             | 硬編碼內容       | 風險等級 | 決策 |
| --- | -------------------------------- | ---------------- | -------- | ---- |
| 1   | `tabsConfig.js`                  | Tab label/order  | 低       | 維持 |
| 2   | `StrategyConfigEditor.vue`       | 區塊標題、預設值 | 低       | 維持 |
| 3   | `ConfigFieldEditor.vue`          | 輸入驗證規則     | 低       | 維持 |
| 4   | `SensitivityPanel.vue`           | 參數選項、範圍   | 低       | 維持 |
| 5   | `ParetoScatterChart.vue`         | 圖表預設配置     | 低       | 維持 |
| 6   | `TornadoChart.vue`               | 圖表預設配置     | 低       | 維持 |
| 7   | `simulatorReversePhaseD.spec.js` | Mock 資料        | 測試專用 | 維持 |

### 結案理由

- 全為 **UI 設定型** (非業務邏輯、非機密、非環境差異)
- 收斂至設定檔會增加 **間接層** 但無實際收益
- 未來若需多語系/主題化，再統一處理

---

## 📋 待確認清單 (請逐項回覆)

| #   | 確認項目                                                       | 影響 Phase | 建議                   | 實際決定       |
| --- | -------------------------------------------------------------- | ---------- | ---------------------- | -------------- |
| 1   | SkeletonLoader/EmptyState/ErrorAlert 採 **選項 A (保留+標記)** | 3          | ✅                     | ✅ 完成        |
| 2   | useApiRequest 採 **選項 A+C (文件化+新 View 實戰)**            | 4          | ✅                     | A 完成；C 延後 |
| 3   | Hardcoded 7 處 **維持原位結案**                                | 5          | ✅                     | ✅ 結案        |
| 4   | 是否需要新增 `useApiMutation` 區分寫入操作？                   | 4          | 視新 View 需求再加     | 延後           |
| 5   | Phase 3-5 是否併入同一 PR，還是分批？                          | 全部       | 建議單一 PR (改動極小) | 分批完成       |

---

## 🚀 執行順序 (確認後)

1. **Phase 3**: 三個元件加上 `@available` JSDoc 標記
2. **Phase 4**:
   - 撰寫 `docs/useApiRequest-guide.md` 選用指南
   - 下個新 View 實戰驗證
3. **Phase 5**: 無動作 (已結案)
4. **歸檔**: 本計畫移至 `completed/`

---

## 📦 歸檔對應

| 原計畫                                      | 歸檔位置                                                            |
| ------------------------------------------- | ------------------------------------------------------------------- |
| WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN.md v2.0 | `docs/plans/completed/WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN_v2.0.md`  |
| 本計畫 (v1.0)                               | 執行完畢後 → `docs/plans/completed/WEBAPP_PHASE_3-5_DETAIL_PLAN.md` |
