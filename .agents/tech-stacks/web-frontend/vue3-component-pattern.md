# Tech Stack: Vue 3 Component Pattern
# Vue 3 元件開發設計模式

> 本文件定義所有 Vue 3 前端元件的開發設計模式（與 `tech-stacks/web-frontend/vue3-vite.md` 互補）。
> `@Frontend` 開發元件時必須遵守，`@Reviewer` 審查前端程式碼時以本文件為基準。
>
> **與 vue3-vite.md 關係**：
> - `vue3-vite.md`：**工具鏈與 SPA 結構**（Vite build / vue-router / CSS scope）
> - 本檔（`vue3-component-pattern.md`）：**元件設計模式**（Composition API 使用、響應式狀態、生命週期、效能）
>
> **遷移紀錄**：本檔於 PROPOSAL_20260422_022 Phase H 由 `skills/vue3-component-pattern.md` 遷移至 `tech-stacks/`（扁平命名，保留 `-pattern` 後綴表達設計模式性質）。

## Composition API 規範

### 強制使用 `<script setup>`
- 嚴禁混用 Options API（`data()`、`methods:`、`computed:`）
- 所有元件一律使用 `<script setup lang="ts">` 或 `<script setup>`

### 響應式狀態使用準則
| 情境 | 正確用法 | 禁止用法 |
|------|---------|---------|
| 基本型別（string、number、boolean） | `ref()` | `reactive()` 包裹基本型別 |
| 物件或陣列 | `reactive()` 或 `ref()` 均可，保持一致 | 混用兩種方式於同一元件 |
| 計算衍生值 | `computed()` | 在 template 中直接寫運算邏輯 |
| 非響應式常數 | 一般 `const` | 不必要地使用 `ref()` 包裹 |

### 跨元件狀態管理
- 跨元件共用狀態，優先使用 Composables 封裝（例如 `useXxx.js` 形式的 hook，具體命名與位置依 workspace `PATHS.source_modules.composables` 定義）
- 禁止透過 `props` 超過兩層傳遞同一狀態（超過兩層改用 Composable 或 `provide/inject`）

---

## 元件生命週期規範

### 事件監聽器清除
- 所有在 `onMounted` 中新增的事件監聽器，必須在 `onUnmounted` 中移除：
```javascript
onMounted(() => {
  window.addEventListener('resize', handleResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
```

### 非同步操作
- 禁止在 `setup()` 頂層直接使用 `await`（使用 `onMounted` 內的 async function）
- 非同步資料載入必須有 `isLoading`、`error` 的響應式狀態管理

---

## 效能優化規範

### 大量資料渲染
- 列表超過 50 筆：必須實作虛擬滾動（Virtual Scrolling）
- 圖表資料超過 500 筆：必須實作資料抽樣或分頁載入
- 使用 `v-memo` 優化不常變動的大型列表項目

### 元件懶載入
- 非首屏顯示的重型元件（圖表、複雜表格）必須使用 `defineAsyncComponent` 懶載入

---

## 錯誤邊界規範
- 實作全域 Error Handler（`app.config.errorHandler`）
- 每個非同步資料請求必須有對應的 Error State UI，禁止讓畫面空白

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
tech_stack: vue3-component-pattern
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 tech-stack 描述 **Vue 3 元件設計模式**；專案特定的 composable 命名 / 元件目錄由 workspace 注入。

| Tech-stack 概念 | Workspace 欄位 | Fallback 行為 |
|---|---|---|
| 前端框架版本 | `TECH_STACK.frontend` | 缺失 → 假設 Vue 3 最新穩定版 |
| Composables 目錄 | `PATHS.source_modules.composables` | 缺失 → `@Lead` 阻斷 composable 建立任務 |
| 前端根目錄 | `PATHS.frontend_root` | 缺失 → `@Lead` 阻斷，要求補填 |
| 大型列表虛擬滾動套件選擇 | workspace `TECH_STACK.external_dependency` | 缺失 → 警告；`@Frontend` 升級 User 選擇 |

**引用規範**：本 tech-stack 描述**元件設計模式與效能鐵律**；workspace 描述**目錄位置與套件選擇**。

---

<!--
  維護說明：當 Vue 3 有重大版本更新或專案引入新的 UI 規範時，
  由 @Frontend 提案更新此文件，並通知 @Lead 更新 Skills Mapping。
-->