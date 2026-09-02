# Telegram Mini App UI/UX 系統化重構計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重構 Telegram Mini App 前端 UI/UX 結構，將 8 個擁擠的底部頁籤收斂為 4 大主導覽列搭配次級頁籤，統一全站 Loading/Empty/Error 防禦元件，修復策略設定檔字串型別問題，並補齊 `data-testid` 建立 100% 穩定的 Playwright E2E 測試防線。

**Architecture:** Vue 3 Composition API (`<script setup>`) + Pinia 狀態持久化 + Vue Router 4 + ECharts 5 + 輕量級四層防禦元件 (GlobalErrorBoundary, SkeletonLoader, EmptyState, ErrorAlert) + Playwright E2E 測試。

**Tech Stack:** Vue 3.5, Vue Router 4, Pinia 4, Element Plus, ECharts 5, Playwright, Vitest.

## Global Constraints

- 嚴格遵守 Vue 3 Composition API (`<script setup>`) 規範。
- 所有 UI/UX 改動必須保持單人（Han）使用體驗的最佳流暢度。
- 採用 TDD 流程：撰寫失敗單元/E2E 測試 → 最小化實作 → 測試通過 → 提交 Git。
- 任何 E2E 測試選擇器皆優先使用 `data-testid` 屬性。

---

### Task 1: 基礎防禦型 UI 元件與全域 Error Boundary 建立

**Files:**

- Create: `webapp/src/components/common/SkeletonLoader.vue`
- Create: `webapp/src/components/common/EmptyState.vue`
- Create: `webapp/src/components/common/GlobalErrorBoundary.vue`
- Test: `webapp/src/test/components/common/DefensiveComponents.test.js`

**Interfaces:**

- Consumes: Vue 3 reactivity & slots
- Produces: `<SkeletonLoader>`, `<EmptyState>`, `<GlobalErrorBoundary>` 共通防禦元件

- [ ] **Step 1: 撰寫失敗的單元測試**

```javascript
// webapp/src/test/components/common/DefensiveComponents.test.js
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import EmptyState from "@/components/common/EmptyState.vue";

describe("Defensive UI Components", () => {
  it("renders SkeletonLoader with correct lines", () => {
    const wrapper = mount(SkeletonLoader, { props: { lines: 3 } });
    expect(wrapper.findAll(".skeleton-line")).toHaveLength(3);
  });

  it("renders EmptyState with custom title and message", () => {
    const wrapper = mount(EmptyState, {
      props: { title: "無資料", message: "請稍後再試" },
    });
    expect(wrapper.text()).toContain("無資料");
    expect(wrapper.text()).toContain("請稍後再試");
  });
});
```

- [ ] **Step 2: 執行測試驗證失敗**

Run: `npx vitest run webapp/src/test/components/common/DefensiveComponents.test.js`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 撰寫最小實作程式碼**

建立 `SkeletonLoader.vue` 與 `EmptyState.vue` 與 `GlobalErrorBoundary.vue`。

- [ ] **Step 4: 執行測試驗證通過**

Run: `npx vitest run webapp/src/test/components/common/DefensiveComponents.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/common/ webapp/src/test/components/common/
git commit -m "feat(ui): add SkeletonLoader, EmptyState, and GlobalErrorBoundary components"
```

---

### Task 2: 重構 4 大 Bottom Nav 與 Secondary Top Tabs (含 Pinia 狀態記憶)

**Files:**

- Create: `webapp/src/stores/navigationStore.js`
- Modify: `webapp/src/App.vue`
- Modify: `webapp/src/router/index.js`
- Test: `webapp/src/test/stores/navigationStore.test.js`

**Interfaces:**

- Consumes: Vue Router route paths
- Produces: 4 大主選單 (`/dashboard`, `/radar`, `/simulator`, `/account`) + 頁面頂部 Secondary Tabs

- [ ] **Step 1: 撰寫失敗的 navigationStore 測試**

```javascript
// webapp/src/test/stores/navigationStore.test.js
import { setActivePinia, createPinia } from "pinia";
import { describe, expect, it, beforeEach } from "vitest";
import { useNavigationStore } from "@/stores/navigationStore";

describe("Navigation Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("remembers sub-tab selection for radar view", () => {
    const store = useNavigationStore();
    expect(store.radarSubTab).toBe("overview");
    store.setRadarSubTab("technical");
    expect(store.radarSubTab).toBe("technical");
  });
});
```

- [ ] **Step 2: 執行測試驗證失敗**

Run: `npx vitest run webapp/src/test/stores/navigationStore.test.js`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 實作 navigationStore 並更新 App.vue 底部導覽列**

將底部導覽列精簡為 4 個帶有 `data-testid="nav-tab-xxx"` 的主按鈕。

- [ ] **Step 4: 執行測試驗證通過**

Run: `npx vitest run webapp/src/test/stores/navigationStore.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add webapp/src/stores/navigationStore.js webapp/src/App.vue webapp/src/test/stores/navigationStore.test.js
git commit -m "feat(nav): restructure to 4 bottom nav tabs with Pinia sub-tab persistence"
```

---

### Task 3: 修復 StrategyConfigEditor 中的 String / Unknown 型別欄位

**Files:**

- Modify: `webapp/src/views/StrategyConfigEditor.vue`
- Test: `webapp/src/test/StrategyStatusView.test.js`

**Interfaces:**

- Consumes: Strategy JSON Schema / default config
- Produces: 正常可編輯的 string / text 表單元件

- [ ] **Step 1: 撰寫失敗的編輯器型別單元測試**

驗證 `basic.version` 與 `basic.description` 能被正確識別為 `string` 型別並渲染 `<el-input>`。

- [ ] **Step 2: 執行測試驗證失敗**

Run: `npx vitest run webapp/src/test/StrategyStatusView.test.js`
Expected: FAIL

- [ ] **Step 3: 修改 StrategyConfigEditor.vue 支援 string 型別**

在型別判斷邏輯中新增 `typeof val === "string"` 對應至文字輸入框，消除 `不支援的型別: unknown` 警告。

- [ ] **Step 4: 執行測試驗證通過**

Run: `npx vitest run webapp/src/test/StrategyStatusView.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add webapp/src/views/StrategyConfigEditor.vue webapp/src/test/StrategyStatusView.test.js
git commit -m "fix(config): support string type inputs in StrategyConfigEditor"
```

---

### Task 4: E2E 測試套件選擇器加硬 (data-testid) 與 Playwright 全頁面自動化巡檢

**Files:**

- Modify: All `webapp/src/views/*.vue` (添加 `data-testid`)
- Modify: `webapp/src/test/e2e/*.spec.js`
- Test: `webapp/src/test/e2e/01-dashboard.spec.js`

**Interfaces:**

- Consumes: Playwright chromium page
- Produces: 100% 穩定的 E2E 綠燈測試套件

- [ ] **Step 1: 為 View 關鍵按鈕與標籤補齊 `data-testid`**

在 `DashboardView`, `MarketRadarView`, `SimulatorView`, `AccountView` 中補齊 `data-testid="nav-xxx"`, `data-testid="btn-xxx"`。

- [ ] **Step 2: 執行 Playwright 測試確認防線**

Run: `npx playwright test`
Expected: PASS with 0 failures

- [ ] **Step 3: Commit**

```bash
git add webapp/src/views/ webapp/src/test/e2e/
git commit -m "test(e2e): harden selectors with data-testid attributes across all views"
```
