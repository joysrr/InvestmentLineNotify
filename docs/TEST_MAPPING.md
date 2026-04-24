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

## 基礎設施工具

- **數據工廠**：`src/test/utils/mockFactory.mjs` (用於產出 Mock Ctx/Strategy)
- **測試框架**：Vitest
