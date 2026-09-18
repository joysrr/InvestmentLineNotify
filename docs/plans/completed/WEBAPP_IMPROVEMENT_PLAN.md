---
type: plan
status: superseded
last_updated: 2026-09-18
superseded_by: WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN_v2.0.md
tags:
  - completed
  - archived
wiki_links: []
---

# WebApp 改善計畫

**版本**: v1.0  
**建立日期**: 2026-08-14  
**狀態**: superseded — 早期 WebApp 盤點已由 v2.0 系統性優化規格取代
**後續證據**: `WEBAPP_SYSTEMATIC_OPTIMIZATION_PLAN_v2.0.md` 及 `WEBAPP_PHASE_6_DETAIL_PLAN.md`
**負責人**: Han  
**專案**: InvestmentLineNotify WebApp

---

## 📋 目錄

1. [背景與現況](#背景與現況)
2. [問題定義](#問題定義)
3. [改善範圍](#改善範圍)
4. [驗收節奏](#驗收節奏)
5. [終止條件](#終止條件)
6. [執行階段](#執行階段)
7. [頁面盤點清單](#頁面盤點清單)
8. [風險與權衡](#風險與權衡)
9. [參考資料](#參考資料)

---

## 背景與現況

### 專案概況

- **路徑**: `/workspace/projects/InvestmentLineNotify/webapp/`
- **技術棧**: Vue 3 + Vite + Element Plus + ECharts
- **路由數**: 13 個頁面
- **當前狀態**: Phase 7 完成 (品質收尾與上線準備)，ESLint 0 errors / 276 warnings，測試 1499 passed

### 觸發原因

Phase 7 完成後，進行 WebApp 頁面系統性盤點，發現以下問題：

1. **8 個頁面含 hardcoded 資料/設定** (未區分)
2. **4 個頁面缺少錯誤處理** (DashboardView, MarketRadarView, StrategyView, SignalCategoryTable)
3. **架構分散**: API 呼叫散落於各元件，缺乏統一錯誤處理與 loading state 管理
4. **無統一防禦網**: 缺少可重用的 ErrorBoundary、SkeletonLoader、EmptyState 元件

---

## 問題定義

### Q1: Hardcoded 資料 vs 設定的分類標準

**選擇**: A - 嚴格分類，逐個標記

**定義**:

- 🔴 **Hardcoded 資料** (高風險)  
  會隨時間/市場/持倉變化的「業務數據」，例如：
  - 股價、持倉數量、融資金額、日期
  - 即時市場指標 (CNN Fear & Greed, VIX, 台股指數)
  - 歷史戰報內容、回測結果數據

- 🟢 **Hardcoded 設定** (低風險)  
  系統層級的「配置檔」或「UI 定義」，例如：
  - Tab 定義 (`[{label:"技術分析", value:"technical"}]`)
  - Chart 配置 (`{grid:{left:50, right:50}}`)
  - 表格欄位定義 (`columns: [{prop:"name", label:"名稱"}]`)
  - 圖例顏色 (`colors: ["#5470c6", "#91cc75"]`)

**審查流程**:

1. 掃描所有 `.vue` 檔案中的物件陣列初始化 (`const data = [{...}]`)
2. 逐個判斷是否會「隨業務場景變化」
3. 標記為 🔴 或 🟢，並記錄於本計畫 [頁面盤點清單](#頁面盤點清單)

---

### Q2: 錯誤處理的四層防禦網

**選擇**: C - 防禦網評估 (四層覆蓋率)

**四層定義**:

#### 第一層：try/catch + .catch()

```javascript
try {
  const res = await fetch("/api/xxx");
} catch (err) {
  console.error(err);
  ElMessage.error("載入失敗");
}
```

#### 第二層：Loading State

```vue
<el-skeleton v-if="loading" :rows="5" />
<div v-else>{{ data }}</div>
```

#### 第三層：Error Boundary (Vue onErrorCaptured)

```javascript
// App.vue or Layout
onErrorCaptured((err, instance, info) => {
  console.error("Global error:", err);
  return false; // 不向上傳播
});
```

#### 第四層：Fallback UI (Empty State)

```vue
<el-empty v-if="!data || data.length === 0" description="暫無資料" />
```

**審查標準**:

- ✅ **完整**: 四層都有
- 🟡 **部分**: 有 1-3 層
- ❌ **缺失**: 完全沒有

---

## 改善範圍

### Q3: 錯誤處理修補策略

**選擇**: A - 統一規格，建立可重用元件

**策略**:

1. 建立 4 個可重用元件:
   - `<GlobalErrorBoundary>` (全域 onErrorCaptured wrapper)
   - `<SkeletonLoader>` (可配置的 loading skeleton)
   - `<EmptyState>` (統一的空狀態提示，支援自訂 icon/文案/action)
   - `<ErrorAlert>` (統一的錯誤提示，支援 retry button)

2. 全站 12 個頁面統一使用這 4 個元件

3. 建立 `useApiRequest` composable:

```javascript
// composables/useApiRequest.js
export function useApiRequest(apiFunc) {
  const loading = ref(false);
  const error = ref(null);
  const data = ref(null);

  const execute = async (...args) => {
    loading.value = true;
    error.value = null;
    try {
      data.value = await apiFunc(...args);
    } catch (err) {
      error.value = err;
      ElMessage.error(err.message || "請求失敗");
    } finally {
      loading.value = false;
    }
  };

  return { loading, error, data, execute };
}
```

---

### Q5: 架構重構範圍

**選擇**: C - 全面架構升級

**包含**:

#### 1. API 連線層重構

- 從 `webapp/src/api/index.js` 抽離為 `webapp/src/api/`
- 結構:
  ```
  webapp/src/api/
  ├── client.js          # axios instance + interceptors
  ├── endpoints/
  │   ├── market.js      # /api/market/*
  │   ├── portfolio.js   # /api/portfolio/*
  │   ├── backtest.js    # /api/backtest/*
  │   └── simulator.js   # /api/v1/simulate/*
  └── types.d.ts         # TypeScript 型別定義
  ```

#### 2. Composables (商業邏輯層)

```
webapp/src/composables/
├── useStockPrice.js      # 股價資料 + WebSocket 更新
├── usePortfolio.js       # 持倉資料 + 維持率計算
├── useMarketIndicators.js # CNN/VIX/台股指數
├── useBacktestReport.js  # 回測報告列表 + 詳情
└── useSimulator.js       # 策略模擬器狀態管理
```

#### 3. Pinia Store

```
webapp/src/stores/
├── auth.js          # 使用者認證 (Telegram initData)
├── portfolio.js     # 全域持倉狀態
├── market.js        # 全域市場快取 (CNN/VIX/匯率)
└── preferences.js   # 使用者偏好設定
```

#### 4. Vue Router 守衛

```javascript
// router/index.js
router.beforeEach(async (to, from) => {
  const authStore = useAuthStore();

  // 驗證 Telegram initData
  if (!authStore.isValid) {
    ElMessage.error("請從 Telegram 開啟");
    return false;
  }

  // 檢查 API Server 連線
  if (!authStore.serverOnline) {
    return { name: "offline" };
  }
});
```

#### 5. Auth Gate

- 實作真實的 `initDataGuard` 驗證 (已在 Phase 7 完成 Backend，Frontend 需對接)
- 移除 `dev-bypass` 模式，統一使用 `generateValidInitData()` 產生測試憑證

#### 6. Layout 統一

```
webapp/src/layouts/
├── DefaultLayout.vue   # 主 Layout (含 Header + Sidebar + Footer)
├── BlankLayout.vue     # 空白 Layout (登入/錯誤頁)
└── components/
    ├── AppHeader.vue
    ├── AppSidebar.vue
    └── AppFooter.vue
```

---

## 驗收節奏

### Q4: 隨計畫進行驗收

**選擇**: A - 每完成一頁就重跑 ESLint 與該頁的 Vitest

**流程**:

1. **修改前**: 確認該頁的測試基線 (當前測試數量與通過率)
2. **修改中**: 邊寫邊跑 `npm run test -- <PageName>`
3. **修改後**:
   ```bash
   # ESLint
   npx eslint webapp/src/views/<PageName>.vue

   # Vitest (該頁相關測試)
   npm run test -- <PageName>

   # E2E (若該頁有 E2E 測試)
   npm run test:e2e -- <PageName>.spec.js
   ```
4. **提交前**: 完整跑一次全站測試 + ESLint
   ```bash
   npm run test
   npm run lint
   ```

**驗收標準**:

- ✅ ESLint 0 errors (warnings 可接受)
- ✅ 該頁相關 Vitest 全數通過
- ✅ E2E 測試 (若有) 通過
- ✅ 手動 Dogfood 測試 (開發環境點擊該頁，確認 UI 正常)

---

## 終止條件

### Q6: 無硬性終止條件，持續改善

**選擇**: C - 每個 PR 都必須通過測試與 ESLint

**策略**:

- 本計畫**不設終止日期**或「100% 完成」的里程碑
- 改善工作隨需求/時間持續推進，但每個 PR 都必須：
  1. ✅ ESLint 0 errors
  2. ✅ Vitest 相關測試通過
  3. ✅ 手動 Dogfood 測試通過
  4. ✅ 不破壞現有功能

**漸進式完成定義**:

- **Phase 1 完成**: 4 個可重用元件建立 + 分類標記完成
- **Phase 2 完成**: 至少 4 個核心頁面 (Dashboard, Simulator, BacktestReport, Account) 完成四層防禦網
- **Phase 3 完成**: 全站 12 頁完成四層防禦網
- **Phase 4 完成**: API 層 + Pinia + Router 守衛 + Auth Gate 完成

每個 Phase 完成後，允許長時間間隔再開始下一 Phase（因為專案為單人使用，線上有舊版本，無急迫性）。

---

## 執行階段

### Phase 1: 分類與規格建立 (預計 3-5 天)

**目標**: 完成 hardcoded 分類 + 建立 4 個可重用元件

#### Task 1.1: Hardcoded 分類審查

- [ ] 掃描全站 `.vue` 檔案，提取所有 `const data = [{...}]` 陣列初始化
- [ ] 逐個判斷為 🔴 資料 或 🟢 設定
- [ ] 更新 [頁面盤點清單](#頁面盤點清單) 中的分類標記
- [ ] 產出 `HARDCODED_AUDIT.md` 報告

#### Task 1.2: 建立可重用元件

- [ ] `webapp/src/components/common/GlobalErrorBoundary.vue`
- [ ] `webapp/src/components/common/SkeletonLoader.vue`
- [ ] `webapp/src/components/common/EmptyState.vue`
- [ ] `webapp/src/components/common/ErrorAlert.vue`

#### Task 1.3: 建立 Composable

- [ ] `webapp/src/composables/useApiRequest.js`

#### Task 1.4: 撰寫元件測試

- [ ] `webapp/src/components/common/*.test.js` (4 個元件的 Vitest)
- [ ] Storybook stories (可選)

**驗收**:

- ✅ 4 個元件測試通過
- ✅ `HARDCODED_AUDIT.md` 產出
- ✅ ESLint 0 errors

---

### Phase 2: 核心頁面改善 (預計 5-7 天)

**目標**: 4 個核心頁面完成四層防禦網

**核心頁面**:

1. `DashboardView.vue` - 儀表板
2. `SimulatorView.vue` - 策略模擬器
3. `BacktestReportView.vue` - 回測報告
4. `AccountView.vue` - 帳戶持倉

#### Task 2.1: DashboardView 改善

- [ ] 替換所有 🔴 hardcoded 資料為 API 呼叫
- [ ] 加入 `<SkeletonLoader>` + `<EmptyState>` + `<ErrorAlert>`
- [ ] 使用 `useApiRequest` composable
- [ ] 加入 `onErrorCaptured`
- [ ] 測試 + ESLint

#### Task 2.2: SimulatorView 改善

- [ ] 同上

#### Task 2.3: BacktestReportView 改善

- [ ] 同上

#### Task 2.4: AccountView 改善

- [ ] 同上 (此頁有 6 個 hardcoded，需特別注意)

**驗收**:

- ✅ 每頁完成後立即跑該頁測試 + ESLint
- ✅ 4 頁全部完成後跑全站測試
- ✅ Dogfood 測試 (手動點擊 4 頁，確認 loading/error/empty 狀態)

---

### Phase 3: 全站頁面改善 (預計 7-10 天)

**目標**: 剩餘 8 個頁面完成四層防禦網

**剩餘頁面**:

1. `TechnicalView.vue`
2. `MarketRadarView.vue`
3. `MacroBattleView.vue`
4. `ChartView.vue`
5. `ReportsView.vue`
6. `NewsView.vue`
7. `StrategyView.vue`
8. `StrategyConfigEditor.vue`

**流程**: 同 Phase 2，每頁完成後驗收

---

### Phase 4: 架構升級 (預計 10-15 天)

**目標**: API 層 + Pinia + Router 守衛 + Auth Gate + Layout 統一

#### Task 4.1: API 連線層重構

- [ ] 建立 `webapp/src/api/client.js` (axios instance + interceptors)
- [ ] 拆分 `api/index.js` 為 `api/endpoints/*.js`
- [ ] 所有頁面改用新的 API 層

#### Task 4.2: Pinia Store 建立

- [ ] `stores/auth.js`
- [ ] `stores/portfolio.js`
- [ ] `stores/market.js`
- [ ] `stores/preferences.js`

#### Task 4.3: Composables (商業邏輯層)

- [ ] `useStockPrice.js`
- [ ] `usePortfolio.js`
- [ ] `useMarketIndicators.js`
- [ ] `useBacktestReport.js`
- [ ] `useSimulator.js`

#### Task 4.4: Vue Router 守衛

- [ ] `beforeEach` 驗證 Telegram initData
- [ ] `beforeEach` 檢查 API Server 連線
- [ ] 建立 `/offline` 錯誤頁

#### Task 4.5: Auth Gate (Frontend 對接)

- [ ] 移除 `dev-bypass` 模式
- [ ] 使用 `generateValidInitData()` 產生測試憑證
- [ ] 整合 Backend `initDataGuard` HMAC 驗證

#### Task 4.6: Layout 統一

- [ ] 建立 `layouts/DefaultLayout.vue`
- [ ] 建立 `layouts/BlankLayout.vue`
- [ ] 拆分 Header/Sidebar/Footer 為獨立元件
- [ ] 所有頁面改用 Layout wrapper

**驗收**:

- ✅ 全站測試通過
- ✅ ESLint 0 errors
- ✅ Dogfood 測試 (完整走一遍所有頁面)
- ✅ E2E 測試通過

---

## 頁面盤點清單

### 圖例說明

- 🔴 **高風險**: Hardcoded 資料 (會誤導使用者)
- 🟢 **低風險**: Hardcoded 設定 (UI 配置檔)
- 🟡 **待確認**: 需進一步審查
- ✅ **完整**: 四層防禦網完整
- 🟡 **部分**: 1-3 層防禦
- ❌ **缺失**: 完全無錯誤處理

---

### 1. DashboardView.vue

- **路由**: `/#/dashboard`
- **行數**: 232
- **API 端點**: 5 個
- **互動元素**: 5 buttons / 0 inputs
- **Hardcoded 狀態**: 🟡 5 個待分類
- **錯誤處理**: ❌ 缺失
- **備註**: 主儀表板，優先度最高

---

### 2. AccountView.vue

- **路由**: `/#/account`
- **行數**: 459
- **API 端點**: 3 個
- **互動元素**: 0 buttons
- **Hardcoded 狀態**: 🔴 6 個高風險 (可能是持倉/融資數據)
- **錯誤處理**: 🟡 有 try/catch 但無 loading/empty
- **備註**: 高風險頁面，需優先審查

---

### 3. BacktestReportView.vue

- **路由**: `/#/backtest-report`
- **行數**: 437
- **API 端點**: 2 個
- **互動元素**: 多 buttons
- **Hardcoded 狀態**: 🔴 5 個 + 含 `placeholder` 關鍵字
- **錯誤處理**: 🟡 有 try/catch 但無 loading/empty
- **備註**: 回測報告，核心功能

---

### 4. SimulatorView.vue

- **路由**: `/#/simulator`
- **行數**: 351
- **API 端點**: 2 個
- **互動元素**: 多 inputs
- **Hardcoded 狀態**: 🟡 1 個 + 含 `placeholder`
- **錯誤處理**: 🟡 有 try/catch
- **備註**: 策略模擬器，核心功能

---

### 5. StrategyConfigEditor.vue

- **路由**: `/#/strategy-config`
- **行數**: 326
- **API 端點**: 2 個
- **互動元素**: 0 buttons
- **Hardcoded 狀態**: 🟡 1 個待分類
- **錯誤處理**: ✅ 完整
- **備註**: 策略參數編輯器

---

### 6. ReportsView.vue

- **路由**: `/#/reports`
- **行數**: 306
- **API 端點**: 1 個
- **互動元素**: 多 buttons
- **Hardcoded 狀態**: 🟡 2 個待分類
- **錯誤處理**: 🟡 有 try/catch
- **備註**: 歷史戰報列表

---

### 7. StrategyView.vue

- **路由**: `/#/strategy`
- **行數**: 284
- **API 端點**: 0 個 ⚠️
- **互動元素**: 0 buttons
- **Hardcoded 狀態**: 🟡 待審查 (無 API 呼叫，可能全是 hardcoded)
- **錯誤處理**: ❌ 缺失
- **備註**: **異常頁面** - 完全沒有 API 呼叫，需確認是否為純展示頁

---

### 8. TechnicalView.vue

- **路由**: `/#/technical`
- **行數**: 280
- **API 端點**: 1 個
- **互動元素**: 0 buttons
- **Hardcoded 狀態**: 🟡 2 個待分類
- **錯誤處理**: 🟡 有 try/catch
- **備註**: 技術分析圖表

---

### 9. MarketRadarView.vue

- **路由**: `/#/radar`
- **行數**: 257
- **API 端點**: 1 個
- **互動元素**: 0 buttons
- **Hardcoded 狀態**: 🟡 待審查
- **錯誤處理**: ❌ 缺失
- **備註**: 市場雷達掃描

---

### 10. ChartView.vue

- **路由**: `/#/chart`
- **行數**: 234
- **API 端點**: 0 個 ⚠️
- **互動元素**: 多 buttons
- **Hardcoded 狀態**: 🟡 5 個待分類 (可能是 ECharts 配置)
- **錯誤處理**: 🟡 有 try/catch
- **備註**: 圖表頁，無 API 可能是使用 props 或 Pinia

---

### 11. MacroBattleView.vue

- **路由**: `/#/macro`
- **行數**: 211
- **API 端點**: 0 個 ⚠️
- **互動元素**: 0 buttons
- **Hardcoded 狀態**: 🟡 待審查
- **錯誤處理**: 🟡 有 try/catch
- **備註**: 總體戰情，無 API 可能是從 store 讀取

---

### 12. NewsView.vue

- **路由**: `/#/news`
- **行數**: 124
- **API 端點**: 0 個 ⚠️
- **互動元素**: 0 buttons
- **Hardcoded 狀態**: 🟡 待審查
- **錯誤處理**: 🟡 有 try/catch
- **備註**: 新聞頁，無 API 可能是外部 iframe 或 RSS feed

---

### 13. SignalCategoryTable.vue (子元件)

- **路由**: N/A (BacktestReportView 的子元件)
- **行數**: 未統計
- **API 端點**: N/A
- **互動元素**: N/A
- **Hardcoded 狀態**: 🟡 待審查
- **錯誤處理**: ❌ 缺失
- **備註**: 訊號分類表格元件

---

## 風險與權衡

### 風險 1: Hardcoded 誤判 (分類錯誤)

**風險**: 將「動態資料」誤判為「靜態設定」，導致未修復真正的高風險項目

**緩解措施**:

- Phase 1 完成 `HARDCODED_AUDIT.md` 後，請使用者 (Han) review 一次
- 每個 🔴 標記項目附上「為何判斷為資料」的理由
- 每個 🟢 標記項目附上「為何判斷為設定」的理由

---

### 風險 2: 過度重構導致 regression

**風險**: API 層、Pinia、Router 守衛的重構可能破壞現有功能

**緩解措施**:

- Phase 4 每個 Task 完成後立即跑全站測試
- 保留舊版 `api/index.js`，新舊並存一段時間，逐頁遷移
- E2E 測試覆蓋核心路徑 (Dashboard → Simulator → Backtest)

---

### 風險 3: 時間拉長導致計畫放棄

**風險**: 因為「無硬性終止條件」，計畫可能因時間拉長而被放棄

**緩解措施**:

- 每個 Phase 完成後，產出一份 `PHASE_X_SUMMARY.md` 報告
- 每個 Phase 完成後，允許長時間間隔 (數週/數月) 再開始下一 Phase
- 每個 Phase 都是「可單獨上線」的完整交付，即使後續 Phase 未完成，前面的改善也已生效

---

### 權衡 1: 全面重構 vs 漸進式修補

**選擇**: 全面重構 (Q5 選 C)

**權衡**:

- ✅ **優點**: 一次性建立清晰架構，避免技術債累積
- ❌ **缺點**: 工作量大 (預計 25-37 天)，期間新功能開發受阻

**決策理由**: 因為專案為單人使用，且線上有舊版本，可接受較長的改善週期

---

### 權衡 2: 統一規格 vs 關鍵頁優先

**選擇**: 統一規格 (Q3 選 A)

**權衡**:

- ✅ **優點**: 全站體驗一致，可重用元件減少重複程式碼
- ❌ **缺點**: 非核心頁面也需改善，工作量較大

**決策理由**: 避免未來「兩套規格並存」的技術債

---

## 參考資料

### 相關文件

- [Phase 7 Summary](./PHASE_7_SUMMARY.md) - Phase 7 完成報告
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - 部署前檢查清單
- [DEC-016: Vitest Worker Crash](../decisions/DEC-016-vitest-worker-crash.md) - Vitest 測試框架問題

### 程式碼參考

- `webapp/src/api/index.js` - 當前 API 層
- `webapp/src/router/index.js` - 當前路由定義
- `webapp/src/views/` - 所有頁面元件

### 工具與指令

```bash
# 開發伺服器
npm run dev

# 測試
npm run test              # Vitest
npm run test:e2e          # Playwright E2E
npm run test:coverage     # 覆蓋率報告

# Lint
npm run lint              # ESLint
npm run lint:fix          # 自動修復

# Build
npm run build             # Production build
npm run preview           # Preview build
```

---

## 附錄: 快速啟動指令

### 開始 Phase 1

```bash
cd /workspace/projects/InvestmentLineNotify/webapp

# 建立可重用元件目錄
mkdir -p src/components/common

# 建立 composables 目錄
mkdir -p src/composables

# 開始開發
npm run dev
```

### 掃描 Hardcoded

```bash
# 找出所有可能的 hardcoded 陣列
grep -rn "const.*=.*\[.*{" src/views/ --include="*.vue"

# 找出 mock/placeholder 關鍵字
grep -rn "mock\|MOCK\|placeholder\|PLACEHOLDER\|hardcoded" src/views/ --include="*.vue"
```

### 驗收測試

```bash
# 單頁測試
npm run test -- DashboardView

# ESLint 單檔
npx eslint src/views/DashboardView.vue

# 全站測試
npm run test && npm run lint
```

---

**本計畫版本**: v1.0  
**最後更新**: 2026-08-14  
**下次 Review**: Phase 1 完成後
