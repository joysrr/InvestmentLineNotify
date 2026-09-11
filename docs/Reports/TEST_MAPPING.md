---
type: report
status: archived
last_updated: 2026-09-10
tags:
  - testing
  - mapping
wiki_links: []
---

# 測試映射表 (Test Mapping Registry)

本文檔定義了本專案原始碼模組與其對應測試程式的映射關係，用於指導 `@QA` 與自動化腳本在修改程式後應執行的驗證範疇。

## 映射規則

| 原始碼路徑 (Source Path)              | 對應測試檔案 (Test File)                       | 測試類型 | 說明                                    |
| :------------------------------------ | :--------------------------------------------- | :------- | :-------------------------------------- |
| `src/modules/strategy/`               | `src/test/integration/strategyEngine.test.mjs` | 整合測試 | 策略引擎、維持率、分位數鎖定等核心邏輯  |
| `src/modules/data/archiveManager.mjs` | `src/test/unit/archiveManager.test.mjs`        | 單元測試 | 新聞日誌存檔與清理                      |
| `src/modules/newsFetcher.mjs`         | `src/test/unit/keywords.test.mjs`              | 單元測試 | 動態關鍵字驗證與 Query 生成             |
| `src/modules/providers/`              | `src/test/providers.test.mjs`                  | 整合測試 | 所有外部 API 資料供應商的連線與格式驗證 |
| `src/modules/ai/` (Prompts)           | `src/test/integration/aiPrompt.test.mjs`       | 整合測試 | Langfuse Prompts 的規範與插值驗證       |
| `src/utils/coreUtils.mjs`             | `test/coreUtils.test.js`                       | 單元測試 | 通用工具函式 (舊有框架)                 |

## 執行規範

1. **局部驗證**：修改特定模組時，應至少執行對應的單個測試檔案。
   - 範例：`npx vitest run src/test/unit/keywords.test.mjs`
2. **全量驗證**：涉及架構重構或核心邏輯異動時，必須執行全量測試。
   - 範例：`npm test`
3. **新增功能**：新增模組時，必須同步在 `src/test/` 下建立對應測試並更新此表。

## 腳本分類定義

本專案區分以下兩種測試腳本類型：

| 類型                     | 規範                                                                       | 路徑                                      |
| :----------------------- | :------------------------------------------------------------------------- | :---------------------------------------- |
| **自動化測試**（Vitest） | 必須使用 `describe`/`it`/`expect` 格式，可被 `npm test` 執行，須列入映射表 | `src/test/unit/`、`src/test/integration/` |
| **手動工具腳本**         | 供除錯或一次性驗證使用，不計入覆蓋率，**不得放置於 `src/test/`**           | `scripts/`                                |

> ⚠️ 放置於 `src/test/` 但未使用 Vitest 格式的腳本，視為「遊魂腳本」，需在下次 Retro 決定重構或移出。

## 補測待辦（Coverage Debt）

以下模組目前無對應測試，依風險等級排序補測：

| 優先序 | 原始碼路徑                                 | 建議測試檔案                                | 測試類型 | 原因                                                              |
| :----: | :----------------------------------------- | :------------------------------------------ | :------- | :---------------------------------------------------------------- |
|   P0   | `src/utils/snapshotCrypto.mjs`             | `src/test/unit/snapshotCrypto.test.mjs`     | 單元測試 | 財務資料加解密邏輯；key 長度錯誤、null key、加解密往返一致性      |
|   P0   | `src/api/server.mjs` + 所有 route handlers | `src/test/integration/apiContract.test.mjs` | 整合測試 | API Contract 驗證：endpoint 可達性、回傳 status code、schema 結構 |
|   P0   | `webapp/src/api/index.js` + 關鍵 Views     | `webapp/src/test/`                          | 單元測試 | Vue 元件消費 API mock 資料時的 render 正確性                      |
|   P1   | `src/modules/storage.mjs`                  | `src/test/unit/storage.test.mjs`            | 單元測試 | 資料持久化核心；讀寫失敗、格式異常行為                            |
|   P1   | `src/modules/notifications/`               | `src/test/unit/notifications.test.mjs`      | 單元測試 | 通知送出邏輯；格式化、錯誤處理                                    |
|   P2   | `src/modules/news/`                        | `src/test/unit/newsDedup.test.mjs`          | 單元測試 | 新聞去重（Jaccard）邊界值                                         |
|   P2   | `src/modules/bot/`                         | `src/test/integration/botHandler.test.mjs`  | 整合測試 | Bot 指令路由與回應                                                |

## ⚠️ API 異動 SOP（異動後必做）

修改以下任一項目後，**必須在 merge 前**執行 `npm test`（後端 contract 測試）與 `cd webapp && npm test`（前端元件測試）：

- `src/api/` 下任何 route handler 的回傳 schema
- `webapp/src/api/index.js` 的 endpoint 路徑或參數
- 核心數據模型（如 `snapshot` 或 `signals` 結構）的重大調整

> **注意**：若僅在 Telegram Mini App 實際開啟後才發現顯示異常，代表整合測試覆蓋率不足，需回補對應測試案例。

## 遊魂腳本清理待辦

以下腳本存在於 `src/test/` 但未整合進 Vitest，需在下次 Retro 決定去留：

| 檔案                              | 現況     | 建議處置                                        |
| :-------------------------------- | :------- | :---------------------------------------------- |
| `src/test/backtest.mjs`           | 手動腳本 | 保留為 `scripts/` 工具，移出 `src/test/`        |
| `src/test/newsTest.mjs`           | 手動腳本 | 重構為 Vitest 格式或移出                        |
| `src/test/test-keywordConfig.mjs` | 手動腳本 | 確認是否與 `keywords.test.mjs` 重疊，重疊則刪除 |

## 基礎設施工具

- **數據工廠**：`src/test/utils/mockFactory.mjs` (用於產出 Mock Ctx/Strategy)
- **測試框架**：Vitest
