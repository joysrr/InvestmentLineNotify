---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# Dashboard 整合重構與策略設定修復計畫 (DASHBOARD_INTEGRATION_AND_CONFIG_FIX_PLAN)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 整合總覽頁面的健康度、分析與策略狀態，移除重複的 0050 雙向模擬器，將回測報表移至模擬器頁籤，並修復策略設定維護中「不支援的型別」問題。

**Architecture:**

1. 建立 `StrategyHealthOverview.vue` 新整合元件，將原先分散在健康度、分析、策略狀態的三大資訊融合為現代化 Card/Grid 視覺卡片。
2. 簡化 `DashboardView.vue` 頂層 Tab，移除重複的「0050 雙向模擬器」Tab，將「回測報表」遷移至 `SimulatorView.vue` 作為子頁籤。
3. 擴充 `ConfigFieldEditor.vue` 型別相容層，支援 `integer`, `float`, `enum`, `json`, `text` 以及 `null/undefined` 邊界推斷防護，消除「不支援的型別: unknown」。

**Tech Stack:** Vue 3 Composition API, Element Plus, Pinia, Vitest, Playwright E2E.

---

## Architecture & Grilling Decisions (決策定案)

本計畫經過 Grilling 訪談與設計樹對齊，確定以下 4 大關鍵架構決策：

1. **Q1: 總覽頁視覺採「單頁式精簡戰情儀表板 (Single Integrated View)」**
   - **決策**：移除「健康度」、「分析」、「策略狀態」這三個重複度高的獨立 Tab 按鈕。
   - **理由**：改為單頁式戰情儀表板，頂部放 Key Metrics Banner（總體策略健康分數 + 燈號 + 建議動作），下方分左右卡片併陳「保證金跌幅防禦」與「市場多空指標」，無須切換 Tab 即可一目了然。
2. **Q2: 歷史回測報表遷移至 `SimulatorView.vue` 採「 Segmented Control 頂部子頁籤」**
   - **決策**：在 `SimulatorView.vue` 頂部新增 `[🧮 試算模擬器 | 📊 歷史回測報表]` 兩個 Segmented Button，預設為「試算模擬器」。
   - **理由**：避免與試算模擬器在同一頁垂直排列導致頁面過長與圖表負載過重，兼顧分類與效能。
3. **Q3: 策略設定編輯器 (`ConfigFieldEditor.vue`) `unknown` 型別防護**
   - **決策**：採「雙重防禦機制 (Default to String + Diagnostic Logger)」。當型別未定義且值為 `null`/`undefined` 時，預設退回 `string` 編輯器並嘗試轉型，絕不顯示 `不支援的型別: unknown`。
   - **理由**：確保 100% 欄位皆可檢視與編輯，不遺漏選填欄位或破壞畫面。
4. **Q4: 廢棄狀態與測試案例對齊 (Clean Architecture)**
   - **決策**：更新 `navigationStore.js` 併入 `simulatorSubTab`（記錄 `calculator` 與 `backtest-report`），清理 `dashboardTab` 死碼狀態並更新 5 個關聯測試檔。
   - **理由**：避免留下技術債與舊欄位。

---

## Global Constraints

- **TDD Mandatory:** RED-GREEN-REFACTOR-VERIFY. Tests must be written before implementation.
- **Language:** Traditional Chinese for docs & prompt reports; English for code/logs.
- **No Breakage:** Existing Pinia state memory and Playwright tests must pass.

---

### Task 1: 修復策略設定編輯器不支援型別問題 (ConfigFieldEditor Fallback & Type Handling)

**Files:**

- Modify: `webapp/src/components/config/ConfigFieldEditor.vue`
- Test: `webapp/src/test/components/config/ConfigFieldEditor.test.js`

**Interfaces:**

- Consumes: `meta[path]` and `getNestedValue(config, path)`
- Produces: Normalized `fieldType` ('number', 'boolean', 'string', 'array', 'object', 'enum')

- [ ] **Step 1: 撰寫 failing unit test 驗證相容型別與 fallback 邏輯**

在 `ConfigFieldEditor.test.js` 中新增測試案例，測試 `meta.type = 'integer'`, `meta.type = 'enum'`, 以及 `val = undefined` 時能正常渲染，而不顯示 `unsupported-type`。

```javascript
it("應將 integer / float 正確推斷為 number 編輯器", async () => {
  const wrapper = mount(ConfigFieldEditor, {
    props: {
      path: "basic.step",
      config: { basic: { step: 5 } },
      meta: { "basic.step": { type: "integer", label: "步長" } },
    },
  });
  expect(wrapper.find(".unsupported-type").exists()).toBe(false);
  expect(wrapper.findComponent({ name: "ElInputNumber" }).exists()).toBe(true);
});
```

- [ ] **Step 2: 執行單元測試確認 FAIL**

Run: `npm run test -- src/test/components/config/ConfigFieldEditor.test.js`

- [ ] **Step 3: 實作 ConfigFieldEditor.vue 型別對應邏輯**

在 `ConfigFieldEditor.vue` 的 `fieldType` 寫入歸一化轉譯：

- `integer`, `float`, `double` -> `'number'`
- `text`, `string` -> `'string'`
- `bool` -> `'boolean'`
- `json` -> `'object'`
- `val === undefined || val === null` -> 依據 `fieldMeta.default` 或推斷為 `'string'`，絕不丟出 `'unknown'`。

- [ ] **Step 4: 執行測試確認 PASS**

Run: `npm run test -- src/test/components/config/ConfigFieldEditor.test.js`

- [ ] **Step 5: Commit 修改**

```bash
git add webapp/src/components/config/ConfigFieldEditor.vue webapp/src/test/components/config/ConfigFieldEditor.test.js
git commit -m "fix(webapp): expand type normalization in ConfigFieldEditor to resolve unsupported type warning"
```

---

### Task 2: 建立 StrategyHealthOverview 整合元件 (健康度 + 分析 + 策略狀態三合一)

**Files:**

- Create: `webapp/src/components/dashboard/StrategyHealthOverview.vue`
- Create Test: `webapp/src/test/components/dashboard/StrategyHealthOverview.test.js`
- Modify: `webapp/src/views/DashboardView.vue`

**Interfaces:**

- Consumes: `healthData`, `macroStatus`, `strategyState`
- Produces: Integrated visual dashboard card grid

- [ ] **Step 1: 撰寫 StrategyHealthOverview 元件單元測試**

測試整合元件能成功渲染健康度指標卡片、多空情緒分析、以及策略信號狀態。

- [ ] **Step 2: 執行測試確認 FAIL**

Run: `npm run test -- src/test/components/dashboard/StrategyHealthOverview.test.js`

- [ ] **Step 3: 實作 StrategyHealthOverview.vue**

採用現代響應式 Grid 佈局：

1. **頂部 Summary Banner**：當前總體策略健康分數、信號燈號 (GREEN/YELLOW/RED) 與即時建議動作。
2. **左側 健康度與風險剖析卡**：維護保證金、Z2 槓桿率、耐受跌幅 %。
3. **右側 市場多空與策略戰術盤點**：VIX 狀態、PB/PR 區間、多空戰役情緒。

- [ ] **Step 4: 執行測試確認 PASS**

Run: `npm run test -- src/test/components/dashboard/StrategyHealthOverview.test.js`

- [ ] **Step 5: Commit 修改**

```bash
git add webapp/src/components/dashboard/StrategyHealthOverview.vue webapp/src/test/components/dashboard/StrategyHealthOverview.test.js
git commit -m "feat(webapp): add integrated StrategyHealthOverview component combining health, analysis and strategy status"
```

---

### Task 3: 清理 DashboardView 頂層頁籤與遷移「回測報表」至 SimulatorView

**Files:**

- Modify: `webapp/src/views/DashboardView.vue`
- Modify: `webapp/src/views/SimulatorView.vue`
- Modify Test: `webapp/src/test/views/DashboardView.test.js`
- Modify Test: `webapp/src/test/views/SimulatorView.test.js`

**Interfaces:**

- Consumes: Navigation tabs config
- Produces: Cleaned top-level tabs and sub-tabs in SimulatorView

- [ ] **Step 1: 撰寫 DashboardView & SimulatorView 頁籤異動單元測試**

測試 `DashboardView.vue` 不再包含 `0050 雙向模擬器` 與獨立 `回測報表` Tab，而 `SimulatorView.vue` 包含 `回測報表` 子頁籤。

- [ ] **Step 2: 執行測試確認 FAIL**

Run: `npm run test -- src/test/views/DashboardView.test.js src/test/views/SimulatorView.test.js`

- [ ] **Step 3: 更新 DashboardView.vue 與 SimulatorView.vue**

1. 從 `DashboardView.vue` 移除 `currentTab === 'simulator'` 與 `currentTab === 'backtest-report'` 按鈕。
2. 將「健康度」、「分析」、「策略狀態」融合為單一選單/頁籤項目或直接整合於總覽，使標題簡潔。
3. 在 `SimulatorView.vue` 中加入子 Tab：`試算模擬器` (`calculator`) 與 `歷史回測報表` (`backtest-report`)。

- [ ] **Step 4: 執行測試確認 PASS**

Run: `npm run test -- src/test/views/DashboardView.test.js src/test/views/SimulatorView.test.js`

- [ ] **Step 5: Commit 修改**

```bash
git add webapp/src/views/DashboardView.vue webapp/src/views/SimulatorView.vue webapp/src/test/
git commit -m "refactor(webapp): simplify dashboard tabs, remove duplicate simulator tab, and move backtest report to SimulatorView"
```

---

### Task 4: E2E 整合自動化測試與整體修復驗證

**Files:**

- Modify: `webapp/src/test/e2e/navigation.spec.js` (或新增全頁面巡檢測試)

- [ ] **Step 1: 跑全套 Vitest 單元測試**

Run: `npm run test` in `webapp`
Expected: 100% PASS

- [ ] **Step 2: 跑 E2E Playwright 導覽巡檢測試**

Run: `npx playwright test` (或 Playwright 巡檢 script)
Expected: 100% PASS

- [ ] **Step 3: Commit 並標記完成**

```bash
git add .
git commit -m "test(e2e): update end-to-end tests for dashboard integration and simulator tab restructuring"
```
