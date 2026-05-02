---
stack_name: telegram-miniapp-sdk
file_type: tech_stack
category: messaging
class: F2
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
scope: framework
manifest_entry: telegram-miniapp-sdk
depends_on:
  - telegram-miniapp
audience:
  - Frontend
  - Backend
  - Security
referenced_by:
  - rules/frontend.md
  - rules/backend.md
  - rules/security.md
---

# Tech Stack: Telegram Mini App SDK

> 純通用技術棧；專案特定的 initData middleware 實作位置 / Composables 實作位置 → 參照 §專案特化參照 對應 workspace 欄位。
>
> **與 telegram-miniapp.md 關係**：
>
> - 本檔（`telegram-miniapp-sdk.md`）：**SDK 協定與認證鐵律**（initData 驗證、HMAC-SHA256、24h 時效、Replay 防護）
> - `telegram-miniapp.md`：**UI 設計模式與使用者體驗規範**（主題、元件、效能、錯誤處理）
>
> **重命名紀錄**：本檔於 PROPOSAL_20260422_022 Phase H 由 `tech-stacks/telegram-mini-app.md` 重命名為 `tech-stacks/messaging/telegram-miniapp-sdk.md`（避免與 `telegram-miniapp.md` UI 設計模式前綴衝突）。

## 前端 UI/UX 限制 (Frontend Constraints)

1. **Mobile-First**：
   - 介面設計必須考量 Telegram 手機版內建瀏覽器的呈現；避免過度複雜的視窗堆疊，保持極簡。
   - 所有互動元件需符合 Touch Target ≥ 44×44 pt 的可觸控性。

2. **原生互動 API**：
   - 盡可能呼叫 `window.Telegram.WebApp` 內建方法提升體驗：
     - `MainButton` — 主要行動按鈕
     - `BackButton` — 返回
     - `HapticFeedback` — 觸覺回饋
     - `showPopup` / `showAlert` — 原生對話框
   - 避免自製元件模擬上述行為，以保持 Telegram 生態系視覺一致性。

3. **主題適配 (ThemeParams)**：
   - 必須支援並即時跟隨 Telegram 的日/夜間模式；訂閱 `themeChanged` 事件動態更新 CSS 變數。
   - 使用 `var(--tg-theme-bg-color)` / `var(--tg-theme-text-color)` 等 Telegram 注入的 CSS 變數，不硬編碼色值。

## API 安全介接與認證 (Authentication & Security)

1. **前端請求規範**：
   - 所有前端送往後端的 HTTP Request 必須將 `window.Telegram.WebApp.initData` 附帶於 Header 中（例：`Authorization: tma <initData>`）。
   - 前端必須透過**專案指定的 composable**（統一介面）取得與附帶 initData，禁止各元件直接讀取 `window.Telegram.WebApp`。

2. **後端驗證雙重鐵律 (initData Security Guard)**：
   - **鐵律 1（完整性）**：所有 API 路由必須掛載**專案指定的 initData 驗證 middleware**，使用 HMAC-SHA256 驗證 initData 未被篡改。
   - **鐵律 2（時效性）**：驗證時必須同時解析被加密的 `auth_date`（Unix Timestamp），若 Token 產生時間超過 **24 小時（86400 秒）**立即拒絕授權（HTTP 401），徹底防範 Replay Attack。
   - **絕對禁止**繞過 HMAC-SHA256 驗證的公開路由；例外情況需於 workspace `BUSINESS_RULES` 明確記錄並由 User 授權。

3. **敏感資料處理**：
   - 前端 initData 僅用於認證；**禁止**將 initData 寫入 localStorage / sessionStorage（避免 XSS 竊取後重放）。
   - 解析後的 user 資料（如 user_id）可快取於記憶體；頁面關閉即清除。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
tech_stack: telegram-miniapp-sdk
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 tech-stack 的具體 middleware / composable 實作位置由 workspace 注入；請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| Tech-stack 概念               | Workspace 欄位                     | Fallback 行為                                                        |
| ----------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| initData 驗證 middleware 位置 | `PATHS.source_modules.middleware`  | 缺失 → `@Lead` 阻斷所有 Mini App API 路由開發，要求先建立 middleware |
| 前端 Telegram composable 位置 | `PATHS.source_modules.composables` | 缺失 → `@Lead` 改以「請實作 composable」任務升級                     |
| 前端 Build 工具               | `TECH_STACK.frontend`              | 缺失 → 警告；前端開發任務升級為 User 裁決                            |
| 允許的 Bypass 路由清單        | `BUSINESS_RULES`                   | 缺失 → 視為無 Bypass；所有路由強制驗證                               |

**引用規範**：本 tech-stack 描述**Telegram SDK 協定與鐵律**；workspace 描述**實作位置與 Bypass 允許清單**。
