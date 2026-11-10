---
type: plan
status: superseded
last_updated: 2026-09-18
superseded_by: 2026-09-10-WEBAPP_PHASE_6_DETAIL_PLAN.md
tags:
  - completed
  - archived
wiki_links: []
---

# E2E 測試修正計畫 (v1.0)

> **版本**: v1.0
> **建立日期**: 2026-08-16
> **狀態**: superseded — 原始失敗修正清單已由後續整合與 Phase 6 驗證取代
> **前提**: Phase 1 (Code Splitting) + Phase 2 (GlobalErrorBoundary) 已完成
> **原始 E2E 結果**: 27 passed, 22 failed (49 total)
> **後續結果**: `2026-09-10-WEBAPP_PHASE_6_DETAIL_PLAN.md` 記錄 E2E 49/49 通過（workers=1）。

---

## 失敗分類總覽

| 群組                            | 失敗數 | 根因                                                                       | 類型              |
| ------------------------------- | ------ | -------------------------------------------------------------------------- | ----------------- |
| **A: Routing 預期不符**         | 8      | `/strategy` redirect 至 `/strategy-config`，測試仍預期舊頁標題「投資策略」 | 測試需更新        |
| **B: NewsView API 403**         | 1      | `/api/report/news` 回傳 403 Forbidden                                      | 測試環境 API 權限 |
| **C: ECharts 渲染時序**         | 6      | 按需引入後初始延遲，`.sensitivity-chart-container` 15s 內不可見            | 元件初始化優化    |
| **D: Reverse Panel 選單值不符** | 9      | `selectOption("maintenanceRatio")` timeout，選項 value 可能已改名          | 選擇器對齊        |

---

## Phase 1: 修正測試預期 (Group A + B)

### P1-A: StrategyView / StrategyConfigEditor 測試 (8 cases)

**根因**: Phase 2 已將 `/strategy` redirect 至 `/strategy-config`（StrategyConfigEditor），但 E2E 測試仍預期舊頁面標題 `.view-title` 含「投資策略」。

**影響檔案**:

- `src/test/e2e/11-strategy.spec.js` (1 case)
- `src/test/e2e/12-strategyConfig.spec.js` (7 cases: STR-001~004, STR-007)

**修正方向**:

1. `11-strategy.spec.js`: 驗證 redirect 後落在 `/strategy-config`，標題改為 `策略參數設定`
2. `12-strategyConfig.spec.js`: 將 `.view-title` 選擇器改為 `h2` 含 `策略參數設定`
3. STR-004「應顯示至少一個策略模組面板」: 改用 `tablist` / `tab` 選擇器
4. STR-007「配置欄位應可見」: 展開第一個 tab 後驗證欄位

**待確認**: redirect 後 URL 是否為 `#/strategy-config` 或仍保持 `#/strategy`？

### P1-B: NewsView 測試 (1 case)

**根因**: `/api/report/news` 回傳 403 Forbidden。測試環境 API 需要 initData 認證，E2E 可能未正確帶入。

**影響檔案**:

- `src/test/e2e/10-news.spec.js` (1 case: NWS-001)

**修正方向**:

1. 確認 E2E setup 是否有設定 `BYPASS_INIT_DATA` 環境變數
2. 或在 API Server 啟動時加上 dev bypass 環境變數
3. 確認 `/api/report/news` 路由是否需要 initData guard

**待確認**: 403 是 initData guard 攔截還是路由本身權限？

---

## Phase 2: 修正元件渲染與選擇器 (Group C + D)

### P2-A: ECharts 渲染時序 (6 cases)

**根因**: `SensitivityChart.vue` / `ParetoScatterChart.vue` / `TornadoChart.vue` 從全量 `import * as echarts` 改為按需引入 `import { use, init } from "echarts/core"` 後，`use()` 註冊與 `init()` 呼叫之間可能有時序問題。

**影響檔案**:

- `src/test/e2e/sensitivity.spec.js` (6 cases)
- `src/components/simulator/SensitivityChart.vue`
- `src/components/simulator/ParetoScatterChart.vue`
- `src/components/simulator/TornadoChart.vue`

**修正方向**:

1. 確認 `use()` 在 `init()` 前已執行（目前 `use()` 在模組頂層，應已執行）
2. 確認 `init(chartRef.value)` 時 `chartRef` 已 mounted（`onMounted` 內應沒問題）
3. 可能需要在 `init()` 後加 `nextTick` 確保 DOM 渲染完成
4. 或在 E2E 測試加 `waitForSelector` 延長 timeout

**待確認**: 是元件 init 失敗（JS error）還是單純渲染延遲（需更長 timeout）？

### P2-B: Reverse Panel 選單值不符 (9 cases)

**根因**: `simulatorReversePhaseD.spec.js` 使用 `selectOption("maintenanceRatio")` 但 Page snapshot 顯示 `reverse-panel` 內容不完整，可能選項 value 已改名或下拉選單結構變更。

**影響檔案**:

- `src/test/e2e/simulatorReversePhaseD.spec.js` (9 cases)
- `src/components/simulator/ReversePanel.vue`（或對應元件）

**修正方向**:

1. 檢查 `ReversePanel.vue` 中 `<select>` 或 `<el-select>` 的 option value
2. 確認 value 是 `maintenanceRatio` 還是 `maintenance_margin` 或其他命名
3. 若 value 已改名，更新測試 `selectOption()` 參數
4. 確認 `data-testid="reverse-panel"` 仍在元件根節點

**待確認**: 需讀取 `ReversePanel.vue` 確認實際 option value

---

## 執行順序

| 順序 | Phase                     | 預估工時 | 優先級 |
| ---- | ------------------------- | -------- | ------ |
| 1    | P1-A (StrategyView 測試)  | 0.5h     | P0     |
| 2    | P1-B (NewsView 403)       | 0.5h     | P0     |
| 3    | P2-B (Reverse Panel 選單) | 1h       | P1     |
| 4    | P2-A (ECharts 渲染)       | 1h       | P1     |

**總預估**: 3h

---

## 驗證標準

- [ ] 49/49 E2E 測試全部通過
- [ ] 後端 149 單元測試不受影響
- [ ] 前端 212 單元測試不受影響
- [ ] `npm run build` 成功無 error
