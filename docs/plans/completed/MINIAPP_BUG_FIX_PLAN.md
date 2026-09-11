---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# Mini App 問題修復與體驗優化計畫 (v4.0 Final Spec)

> **版本**: v4.0 (經 Grill-Me 嚴格架構審查與主流規範確認)  
> **更新日期**: 2026-08-15  
> **狀態**: 🔴 Active  
> **目標分支**: `fix/miniapp-bugs`

---

## 📌 共識架構與設計規範 (Grilling Session Settled)

| 領域                   | 決策項目                  | 最終設計規範 (主流最佳實踐)                                                                                                                              |
| ---------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth 認證與安全性**  | **HMAC TTL & Token 刷新** | **30 分鐘 TTL + 前端靜默刷新**：`MAX_AGE_SECONDS` 設為 1800 秒 (30 分鐘)；前端 `apiFetch` 遇到 401 時自動取 `window.Telegram.WebApp.initData` 靜默刷新。 |
| **Auth UX 退路**       | **憑證失效處置**          | **一鍵重載 Modal**：靜默刷新依然失敗時，跳出對話框提示「憑證已過期」，提供「一鍵重載頁面」按鈕引導重新進入。                                             |
| **502 崩潰防禦**       | **環境變數與 Boot 自檢**  | **雙重 Fallback 機制**：`ecosystem.config.cjs` 與 `server.mjs` 入口均實作 `dotenv` 載入；`assertEnv()` 在崩潰前輸出完整錯誤與變數清單至 Console/Pino。   |
| **Log 系統架構**       | **12-Factor App 日誌**    | **Pino Stdout + PM2 轉向**：符合雲原生規範，Pino 於正式環境輸出至 `stdout`，由 PM2 統一寫入專案內 `logs/pm2-api-out.log` 與 `logs/pm2-api-error.log`。   |
| **介面中文與 UI 降級** | **亂碼還原與 API 404**    | 全專案 UTF-8 損壞字元已還原；`StrategyStatusView.vue` 加入 404/503 友善降級顯示。                                                                        |

---

## 📌 最新執行進度總覽

| 階段                               | 狀態                       | 完成項目                                                                                                                                                                             |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Phase A (快速修復與字元還原)**   | ✅ **100% 完成**           | • 全專案 7 個檔案 585 處 `U+FFFD` 亂碼字元全部還原<br>• `StrategyStatusView.vue` 404/503 降級提示<br>• 147 後端 + 206 前端測試 100% 通過                                             |
| **Phase B (與 502 防禦與 Logger)** | 🟡 **進行中 (規範已確立)** | • Fastify `server.mjs` 接入 Pino 審計 (`onRequest`/`onResponse`)<br>• `server.mjs` 雙重 `dotenv` Fallback 與 Boot Crash 異常追蹤<br>• `ecosystem.config.cjs` 配置專案內 `logs/` 輸出 |
| **Phase C (認證機制升級)**         | ⏳ **待執行**              | • `initDataGuard.mjs` TTL 改為 1800 秒<br>• 前端 `apiFetch` 401 靜默刷新與憑證過期 Modal                                                                                             |
| **Phase D (UI 導向整合)**          | ⏳ **待執行**              | • 統一 NavBar「策略」與 Router 重定向至 `/strategy-config`<br>• 標記 `StrategyConfigPanel.vue` 棄用 (Deprecated)                                                                     |

---

## 🚀 升級版修復執行計畫 (Execution Schedule)

### Phase 1：502 防禦與 Logger 審計日誌 (Phase B)

| #       | 任務                   | 說明 / 檔案                                                                                              | 狀態      |
| ------- | ---------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| **1.1** | Fastify 接入 Pino 日誌 | 將 Fastify `server.mjs` 的 logger 替換為 `src/utils/logger.mjs`，掛載 `onRequest` 與 `onResponse` 審計。 | 🟡 進行中 |
| **1.2** | 雙重 `dotenv` Fallback | 在 `server.mjs` 入口確保動態相對路徑 `dotenv` 載入，防止工作目錄差異引發 `assertEnv()` Crash。           | 🟡 進行中 |
| **1.3** | PM2 Ecosystem 規範修正 | 更新 `ecosystem.config.cjs`，設定 `logs/pm2-api-out.log` 與 `logs/pm2-api-error.log` 日誌檔案路徑。      | 🟡 進行中 |

### Phase 2：Auth 認證與前端體驗升級 (Phase C)

| #       | 任務                      | 說明 / 檔案                                                                               | 狀態      |
| ------- | ------------------------- | ----------------------------------------------------------------------------------------- | --------- |
| **2.1** | HMAC TTL 調整為 30 分鐘   | 修改 `src/api/middleware/initDataGuard.mjs` 的 `MAX_AGE_SECONDS = 1800`，並更新單元測試。 | ⏳ 待執行 |
| **2.2** | 前端 401 靜默刷新與 Modal | 在 `webapp/src/api/index.js` 實現 401 靜默刷新 Header，並新增憑證過期重載 Modal。         | ⏳ 待執行 |

### Phase 3：頁面與路由整合 (Phase D)

| #       | 任務             | 說明 / 檔案                                                                              | 狀態      |
| ------- | ---------------- | ---------------------------------------------------------------------------------------- | --------- |
| **3.1** | 策略設定入口合併 | 修改 Router `src/router/index.js` 與 `NavBar.vue`，統一導向 `StrategyConfigEditor.vue`。 | ⏳ 待執行 |
| **3.2** | 清理舊組件       | 標記 `StrategyConfigPanel.vue` 為 Deprecated。                                           | ⏳ 待執行 |

---

## 🧪 最終驗證標準

1. **502 零崩潰驗證**：不論在何種工作目錄下以 `node` 或 `pm2` 啟動，皆能正確載入環境變數並成功監聽 3001 端口；崩潰時能印出完整堆棧至 Pino Logger。
2. **12-Factor 日誌驗證**：控制台與 PM2 `logs/pm2-api-out.log` 正確印出每一筆 `[API Request]` 與 `[API Response]` 審計資訊。
3. **安全與體驗**：30 分鐘安全 TTL 配合前端靜默刷新，過期時彈出重載 Modal。
4. **測試覆蓋**：後端與前端全套單元與整合測試保持 100% 綠燈通過。
