---
stack_name: vue3-vite
file_type: tech_stack
category: web-frontend
class: F2
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
scope: framework
manifest_entry: vue3-vite
depends_on: []
audience:
  - Frontend
referenced_by:
  - rules/frontend.md
---

# Tech Stack: Vue 3 & Vite

> 純通用技術棧；專案特定的 composables 命名 / 頁面清單 / 路由檔位置 → 參照 §專案特化參照 對應 workspace 欄位。

## 核心框架與語法 (Composition API)

1. **全面使用 Composition API**：
   - 所有 Vue 元件必須使用 `<script setup>` 語法糖；**嚴禁** Vue 2 的 Options API（`data()` / `methods` / `created` 等）。
   - Script setup 提供更好的 Tree-shaking、自動 type inference、`defineProps` / `defineEmits` macro 支援。

2. **響應式狀態 (Reactivity)**：
   - **原始型別**（boolean / string / number）→ 使用 `ref`，存取時記得 `.value`。
   - **物件 / 陣列** → 使用 `reactive`，直接屬性存取（避免 `.value` 層級不一致）。
   - 深度響應性若影響效能，改用 `shallowRef` / `shallowReactive`。

3. **共用邏輯封裝 (Composables)**：
   - 跨元件的商業邏輯必須封裝為 `useXxx()` 形式的 **composable** 函式，統一放於**專案指定的 composables 目錄**。
   - 保持 `.vue` 檔案僅處理 UI 渲染；邏輯層由 composable 提供。

## 專案結構與打包 (Project Layout)

1. **工具鏈 (Vite)**：
   - 前端專案由 Vite 驅動；新增環境變數必須以 `VITE_` 為開頭並讀取自 `import.meta.env.VITE_XXX`。
   - Production build 產出 `dist/`；禁止將 `dist/` 納入版控。

2. **路由管理 (vue-router)**：
   - 使用 `vue-router` 處理 SPA 路由；新增頁面時必須在**專案指定的路由註冊檔**新增對應路由記錄。
   - 路由命名採 **kebab-case** URL + **PascalCase** component name。
   - 動態 import 頁面組件實現 code-splitting：`component: () => import('@/views/XxxView.vue')`。

3. **樣式規範**：
   - 優先使用 **Scoped CSS**（`<style scoped>`），確保元件樣式不互相污染。
   - 全域樣式集中於專案 Style Entry（如 `src/styles/global.css`）；各元件不得定義全域選擇器。
   - CSS 變數優先於 SASS 變數，利於 runtime 主題切換。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
tech_stack: vue3-vite
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 tech-stack 的具體 composables 目錄 / 路由檔位置 / 頁面清單皆由 workspace 注入；請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| Tech-stack 概念  | Workspace 欄位                     | Fallback 行為                                              |
| ---------------- | ---------------------------------- | ---------------------------------------------------------- |
| 前端專案根目錄   | `PATHS.frontend_root`              | 缺失 → `@Lead` 阻斷前端任務，要求補填                      |
| Composables 目錄 | `PATHS.source_modules.composables` | 缺失 → `@Lead` 改以「請建立 composables 目錄結構」任務升級 |
| 前端技術選擇     | `TECH_STACK.frontend`              | 缺失 → 警告；`@Lead` 假設 Vue 3 + Vite                     |

**引用規範**：本 tech-stack 描述**Vue 3 / Vite 語法與架構原則**；workspace 描述**具體目錄位置與頁面清單**。
