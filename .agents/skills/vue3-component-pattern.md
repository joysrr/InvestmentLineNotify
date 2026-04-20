# Skill: Vue 3 Component Development Pattern
# Vue 3 元件開發規範

> 本文件定義所有 Vue 3 前端元件的開發規範。
> `@Frontend` 開發元件時必須遵守，`@Reviewer` 審查前端程式碼時以本文件為基準。

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
- 跨元件共用狀態，優先使用 Composables 封裝（例如 `useTelegram.js`、`useStrategy.js`）
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

<!--
  維護說明：當 Vue 3 有重大版本更新或專案引入新的 UI 規範時，
  由 @Frontend 提案更新此文件，並通知 @Lead 更新 Skills Mapping。
-->