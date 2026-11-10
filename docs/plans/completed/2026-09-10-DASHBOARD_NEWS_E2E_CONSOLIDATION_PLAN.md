---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# Dashboard 整合重構、News Tab 修復與 E2E 發現總結計畫

> **狀態**：Active — 目前現行計畫
> **建立日期**：2026-09-02
> **背景**：前序 `2026-09-10-DASHBOARD_INTEGRATION_AND_CONFIG_FIX_PLAN.md` 完成 Task 1-3，Task 4 E2E 驗證發現 3 個既有問題（catch-all route LIFO、FloatingPill 遮擋、SensitivityPanel watch 時序），皆已修復 (477c5e5)。
> **目標**：(A) 整合 DashboardView 健康度/分析/策略狀態三區塊；(B) News Tab 加回 bottom nav；(C) 更新 DashboardView/SimulatorView 測試。
>
> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`

---

## 0. 前序狀態 (Task 1–3+4 已完成)

| 項目                                         | 狀態          | Commit    |
| -------------------------------------------- | ------------- | --------- |
| Task 1: ConfigFieldEditor 型別歸一化         | ✅ 完成       | `b5b33f4` |
| Task 2: StrategyHealthOverview.vue 新元件    | ✅ 完成 (4/5) | `1afa496` |
| Task 3: SimulatorView subtabs + 回測報表遷移 | ✅ 完成       | `1afa496` |
| Task 4: E2E 驗證                             | ✅ 50/50 綠   | `ca44ab1` |

**Task 3-4 發現（需整理）**：

- **D1 — Catch-all LIFO bug**: `sensitivity.spec.js` 的 `page.route("**/api/**")` catch-all，因 Playwright LIFO（後註冊優先），覆蓋 `page.route("**/api/v1/simulate/sensitivity**")`，mock 被 `route.continue()` 吞掉 → 409。**已修** (移除 catch-all)，但 14 個其他 E2E 檔案**完全不用 mock**，全部打真實 `BYPASS_INIT_DATA` 後端，CI 不穩定風險。
- **D2 — FloatingPill 遮擋**: SimulatorView subtabs 下推內容，執行按鈕落入 fixed FloatingPill intercept 區。**已修** (`padding-bottom: 130px`)，但這是 UI 布局 debt，應普遍檢查其他頁面。
- **D3 — SensitivityPanel watch 時序**: `watch(targetParam)` + `onMounted` 自動設定，與 test fill 時序競態，難以預期。**未修**，須評估是否需解耦。

---

## 1. 目標總覽

Han 日常使用流程（總覽頁）與 News 監控：

1. **DashboardView** 日常總覽：Han 開 app 第一頁看「健康度 / 分析 / 策略狀態」。
2. **NewsView** 新聞監控：Han 需要在 bottom nav 直接跳到新聞，當前 `/news` route 存在但 **nav tab 缺失**。

### 需求清單

- **A1**: 整合 `HealthPanel` + `AnalysisPanel` + `StrategyStatusView` 為單一 `StrategyHealthOverview.vue`（或整合入 DashboardView），頂部 Summary Banner + 左右卡片佈局。**移除** top-level tab 切換（健康度/分析/策略狀態→單頁整合），降低 Han 切換成本。
- **A2**: `StrategyConfigEditor` 保留為**跳出式對話框** (modal) 或**子路由** `/strategy-config`，不再是 top-level tab。
- **B1**: 將 `NewsView` 加回 `tabsConfig.js` bottom nav，icon + label =「新聞」。
- **B2**: 確認 `NewsView.vue` 功能正常（路由 `/news` 存在）。
- **C1**: 更新 `DashboardView.test.js` / `SimulatorView.test.js` / E2E 反映 UI 變更。
- **C2**: 整理 D1-D3 發現到 `docs/knowledge/e2e_findings.md`，建立 shared test helper 預防 catch-all LIFO。

---

## 2. Tasks

### Task A: 整合 DashboardView 健康度/分析/策略狀態

**Files**:

- Create: `webapp/src/components/dashboard/StrategyHealthOverview.vue`
- Create Test: `webapp/src/test/components/dashboard/StrategyHealthOverview.test.js`
- Modify: `webapp/src/views/DashboardView.vue` (移除 3 個 top-level tab，改用整合元件)
- Modify: `webapp/src/stores/navigationStore.js` (清理 `dashboardTab` 死碼)
- Modify Test: `webapp/src/test/views/DashboardView.test.js`

**接口**:

- Consumes: `healthData`, `macroStatus`, `strategyState`, `aiStrategyVerdict`
- Produces: 單頁整合戰情儀表板

- [ ] Step 1: 撰寫 `StrategyHealthOverview.test.js` 驗證整合渲染 (RED)
- [ ] Step 2: 跑測試確認 FAIL
- [ ] Step 3: 實作 `StrategyHealthOverview.vue`:
  - 頂部 Summary Banner (策略健康分數 + 信號燈 + 建議動作)
  - 左卡: 健康度與風險 (維持率、Z2槓桿、耐受跌幅%)
  - 中卡: 市場多空 (VIX、PB/PR、情緒)
  - 右卡: 策略戰術 (Signal 狀態)
  - 使用 `HealthPanel` / `AnalysisPanel` / `StrategyStatusView` 內容 (提取可共用邏輯)
- [ ] Step 4: 更新 `DashboardView.vue` 替換 3 個 tab 為 `<StrategyHealthOverview />`
- [ ] Step 5: 更新 `DashboardView.test.js`
- [ ] Step 6: 跑 unit test 確認 GREEN
- [ ] Step 7: 跑 E2E 確認
- [ ] Step 8: Commit

> **TDD**: 先寫 integration test → RED → implement → GREEN。
> **YAGNI**: 不必搬遷全部邏輯，只整合 UI 陈列與數據來源。

### Task B: 將 News Tab 加回 Bottom Nav

**Files**:

- Modify: `webapp/src/config/tabsConfig.js` (加 News tab)
- Verify: `webapp/src/views/NewsView.vue` (確認存在且功能完整)

- [ ] Step 1: 檢查 NewsView.vue 目前功能
- [ ] Step 2: 在 tabsConfig.js 加入 News tab (icon: 📰, label: 新聞, to: /news)
- [ ] Step 3: 更新 E2E 03-backtestReport 或新增 nav 測試驗證 News tab 顯示
- [ ] Step 4: 跑 E2E 確認
- [ ] Step 5: Commit

### Task C: 清理測試 & 發現整理

**Files**:

- Modify: `webapp/src/test/views/DashboardView.test.js`
- Modify: `webapp/src/test/views/SimulatorView.test.js`
- Modify: `webapp/src/test/stores/navigationStore.test.js`
- Create: `docs/knowledge/e2e_findings.md`

- [ ] Step 1: 更新 DashboardView/SimulatorView/navigationStore 測試反映 tab 清理
- [ ] Step 2: 建立 `e2e_findings.md` 記錄 D1-D3（catch-all LIFO, FloatingPill, SensitivityPanel watch)
- [ ] Step 3: 評估 D1 — 是否為 14 個 E2E 檔案加入最小 mock (catch-all 改用 `route.fallback` 或移除)
- [ ] Step 4: Commit

---

## 3. 順序與 DoD

1. **Task A** (Dashboard 整合) — Han 日常功能，優先。
2. **Task B** (News tab) — Han 日常功能。
3. **Task C** (test cleanup + findings) — 收尾。

**DoD**:

- 所有修改的 unit tests 100% pass (`npm run test`)
- 影響的 E2E 測試 100% pass (workers=1)
- commit 並 push

---

## 4. 風險與開放問題

- **R1**: `HealthPanel/A/B/C` 的數據來源若高度耦合 DashboardView 本地 computed，整合可能需 refactoring。**Mitigation**: 先以 prop 注入模式抽離數據，保留原 computed。
- **R2**: StrategyConfigEditor 移出 top-level tab 後，Han 如何存取？**問 Han**: 移到 Dashboard 內的 modal 還是獨立路由 `/strategy-config`？
- **R3**: D1 的 14 個 E2E 檔案無 mock — 是否要全面 mock？**建議**: 先記錄，等 CI 環境失敗再處理 (YAGNI)。
