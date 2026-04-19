# Tech Stack: Vue 3 & Vite

## 核心框架與語法
1. **全面使用 Composition API**：所有 Vue 元件必須使用 `<script setup>` 語法糖撰寫。嚴禁使用 Vue 2 的 Options API (`data()`, `methods`, `created`)。
2. **響應式狀態**：
   - 原始型別（布林值、字串、數字）使用 `ref`。
   - 物件或陣列使用 `reactive`。
3. **共用邏輯封裝**：跨元件的商業邏輯必須封裝至 `src/composables/`（例如 `usePortfolioSnapshots.js`），保持元件（`.vue` 檔）只處理 UI 渲染。

## 專案結構與打包
1. **工具鏈**：前端專案由 Vite 驅動。新增環境變數必須以 `VITE_` 為開頭，並讀取自 `import.meta.env`。
2. **路由管理**：使用 `vue-router` 處理 SPA 路由。若有新增頁面（如 `DashboardView.vue`），必須在 `src/router/index.js` 註冊。
3. **樣式規範**：優先使用 Scoped CSS (`<style scoped>`)，確保元件樣式不互相污染。