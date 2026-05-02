---
stack_name: telegram-miniapp
file_type: tech_stack
category: messaging
class: F2
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
scope: framework
manifest_entry: telegram-miniapp
depends_on:
  - vue3-vite
audience:
  - Frontend
referenced_by:
  - rules/frontend.md
---

# Tech Stack: Telegram Mini App (UI Pattern)

# Telegram Mini App 前端開發規範

> 本文件定義所有涉及 Telegram Mini App UI 的前端開發規範（設計模式層）。
> `@Frontend` 在實作任何 Mini App UI 功能時必須讀取並遵守本文件。
>
> **與 telegram-miniapp-sdk.md 關係**：
>
> - 本檔（`telegram-miniapp.md`）：**UI 設計模式與使用者體驗規範**（主題、元件、效能、錯誤處理）
> - `telegram-miniapp-sdk.md`：**SDK 協定與認證鐵律**（initData 驗證、安全）
>
> **遷移紀錄**：本檔於 PROPOSAL_20260422_022 Phase H 由 `skills/telegram-miniapp-pattern.md` 遷移至 `tech-stacks/messaging/telegram-miniapp.md`（扁平命名）。

## 初始化規範

### 強制初始化流程

每個 Mini App 頁面進入點必須執行以下初始化序列，缺一不可：

```javascript
// 1. 確認 WebApp 環境已就緒
const tg = window.Telegram.WebApp;
tg.ready();

// 2. 展開至最大高度（避免 Mini App 視窗過小）
tg.expand();

// 3. 讀取主題參數（禁止硬寫顏色）
const theme = tg.themeParams;
```

### initData 傳遞規範

- Mini App 對後端的所有 API 請求，必須在 Header 附帶 `initData`：
  ```
  X-Telegram-Init-Data: <tg.initData 的值>
  ```
- 禁止將 `initData` 存入 `localStorage` 或 `sessionStorage`
- `initData` 有效期限為 24 小時，過期後需引導 User 重新開啟 Mini App

---

## 主題與樣式規範

### 禁止硬寫顏色

所有顏色必須使用 Telegram ThemeParams CSS 變數，禁止使用固定色碼：

| CSS 變數                             | 用途                     |
| ------------------------------------ | ------------------------ |
| `var(--tg-theme-bg-color)`           | 頁面背景色               |
| `var(--tg-theme-text-color)`         | 主要文字色               |
| `var(--tg-theme-hint-color)`         | 次要提示文字色           |
| `var(--tg-theme-link-color)`         | 連結色                   |
| `var(--tg-theme-button-color)`       | 主要按鈕背景色           |
| `var(--tg-theme-button-text-color)`  | 主要按鈕文字色           |
| `var(--tg-theme-secondary-bg-color)` | 次要背景色（卡片、列表） |

### 響應式設計

- 以 Mobile 為主要設計基準（Telegram 行動端為主要使用環境）
- 禁止使用固定 px 寬度的版面配置，使用 `%`、`vw`、`flex`、`grid`
- 最小可互動元素尺寸：44×44px（符合 iOS/Android 觸控規範）

---

## 導航與返回按鈕規範

### BackButton 控制

- 進入子頁面時，必須顯示 Telegram 原生返回按鈕：
  ```javascript
  tg.BackButton.show();
  tg.BackButton.onClick(() => {
    // 執行返回邏輯
    tg.BackButton.hide();
  });
  ```
- 返回主頁面後必須呼叫 `tg.BackButton.hide()`
- 禁止同時使用瀏覽器 `history.back()` 與 Telegram BackButton，避免導航衝突

### MainButton 使用規範

- 主要操作（送出、確認）優先使用 Telegram MainButton，而非自訂按鈕
- MainButton 文字長度不超過 20 字元
- 執行非同步操作期間必須顯示 loading 狀態：
  ```javascript
  tg.MainButton.showProgress();
  // 操作完成後
  tg.MainButton.hideProgress();
  ```

---

## 效能規範

### 禁止事項

- 禁止在 Mini App 啟動時一次性載入超過 100 筆資料
- 禁止使用會阻塞 UI 的同步運算（長時間計算必須移至 Web Worker）
- 禁止引入超過 500KB 的第三方套件（Mini App WebView 載入速度有限）

### 圖表渲染

- 使用 Canvas-based 圖表套件（如 lightweight-charts），避免 SVG-based 套件的記憶體問題
- 圖表資料超過 500 筆時，必須實作資料抽樣或分頁載入

---

## 錯誤處理規範

### API 請求失敗

- 所有 API 請求必須有 loading、success、error 三種 UI 狀態
- 錯誤訊息必須以使用者可理解的語言呈現，禁止直接顯示技術性錯誤訊息
- 網路錯誤（無法連線）必須提供「重試」按鈕

### Mini App 環境異常

- 若 `window.Telegram` 不存在（非 Telegram 環境開啟），必須顯示提示：
  > 「請在 Telegram 中開啟此應用程式」

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
tech_stack: telegram-miniapp
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 tech-stack 描述 **Mini App UI 設計模式與效能規範**；專案特定的主題色 / 頁面清單 / 元件庫由 workspace 注入。

| Tech-stack 概念                          | Workspace 欄位                     | Fallback 行為                                  |
| ---------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| 前端框架選擇                             | `TECH_STACK.frontend`              | 缺失 → 警告；假設 Vue 3 + Vite                 |
| 前端 composable 位置（`useTelegram` 等） | `PATHS.source_modules.composables` | 缺失 → `@Lead` 阻斷 Mini App UI 任務，要求補填 |
| 前端專案根目錄                           | `PATHS.frontend_root`              | 缺失 → `@Lead` 阻斷，要求補填                  |
| 元件尺寸規範特例                         | workspace `BUSINESS_RULES`         | 缺失 → 套用本 tech-stack 預設（44×44px）       |

**引用規範**：本 tech-stack 描述**UI 模式與效能鐵律**；workspace 描述**框架選擇與目錄位置**。

---

<!--
  維護說明：當 Telegram Mini App SDK 有重大版本更新時，
  由 @Frontend 提案更新此文件，並通知 @Lead 更新 Skills Mapping。
-->
