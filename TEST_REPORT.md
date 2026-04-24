# 系統驗證報告 (System Verification Report)

**報告日期**：2026-04-24
**狀態**：🟢 PASS (26/26 Tests Passed)

## 驗證摘要

本專案已建立統一的自動化測試基建，將散落的舊有腳本整合至 `vitest` 套件中，並針對核心邏輯（策略引擎、資料處理、AI Prompt）建立了健全的迴歸測試防線。

## 測試涵蓋範圍

### 1. 核心策略引擎 (Integration)

- **檔案**：`src/test/integration/strategyEngine.test.mjs`
- **項目**：
  - 🔴 斷頭危機 (Critical Margin) 優先攔截
  - 🟠 高危凍結 (Frozen Zone) 禁止進場
  - 🛡️ EntryGate 前置過濾（RSI、價格變化）
  - 🚨 Valuation Guard Latch (估值鎖定) 觸發邏輯
  - 🟢 常態佈局 (Normal DCA) 指令輸出

### 2. 資料供應商與預處理 (Integration)

- **檔案**：`src/test/providers.test.mjs`
- **項目**：
  - CNN Fear & Greed 指數 API
  - KGI 融資資料 API
  - Yahoo 匯率 API
  - NDC 景氣燈號 API
  - TWSE 估值資料
  - AI Data Preprocessor 格式轉換邏輯

### 3. AI Prompt 規範驗證 (Integration)

- **檔案**：`src/test/integration/aiPrompt.test.mjs`
- **項目**：
  - 驗證 4 個核心 Langfuse Prompt 的 System/User Prompt 完整性
  - 驗證插值變數 (Required Vars) 是否存在
  - 驗證 Config 與 Schema 配置是否符合模型規範

### 4. 資料管理單元測試 (Unit)

- **檔案**：`src/test/unit/archiveManager.test.mjs`
- **項目**：新聞紀錄存取、冪等性覆寫、自動清理過期檔案。

### 5. 關鍵字處理單元測試 (Unit)

- **檔案**：`src/test/unit/keywords.test.mjs`
- **項目**：動態關鍵字驗證、合併去重、Google News Query 字串生成。

## 執行紀錄

```bash
> line-etf-notify@2.0.0 test
> vitest run src/test

 RUN  v4.1.4 /Users/han/Project/InvestmentLineNotify

 ✓ src/test/unit/archiveManager.test.mjs (3 tests)
 ✓ src/test/providers.test.mjs (6 tests)
 ✓ src/test/integration/aiPrompt.test.mjs (4 tests)
 ✓ src/test/integration/strategyEngine.test.mjs (5 tests)
 ✓ src/test/unit/keywords.test.mjs (8 tests)

 Test Files  5 passed (5)
      Tests  26 passed (26)
   Duration  6.81s
```

## 後續建議

1. **CI 整合**：建議將 `npm test` 整合至 GitHub Actions 或 Jenkins，確保每次 Push 均通過驗證。
2. **擴充測試數據**：利用 `src/test/utils/mockFactory.mjs` 持續擴充特殊行情（如熔斷、長期盤整）的模擬測試。
