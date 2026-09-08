# Langfuse v3 → v5 Migration Plan (分階段執行)

> **建立日期**: 2026-09-08  
> **Phase 2 啟動**: 2026-09-08  
> **Deadline**: 2026-11-16 (Langfuse Cloud v3 sunset)  
> **總工作量**: 15-20 小時  
> **狀態**: 🔄 Phase 2 進行中

---

## 📊 執行進度追蹤

| Phase                          | 狀態            | 開始日期          | 完成日期   | 實際工時 |
| :----------------------------- | :-------------- | :---------------- | :--------- | :------- |
| Phase 1: 環境準備              | ✅ 完成         | 2026-09-08        | 2026-09-08 | 2h       |
| Phase 2: aiClient.mjs 核心遷移 | ⏸️ 待啟動       | 2026-09-08 (暫停) | -          | -        |
| Phase 3: Score API 遷移        | 🔜 等待 Phase 2 | -                 | -          | -        |
| Phase 4: 測試檔案更新          | 🔜 等待 Phase 3 | -                 | -          | -        |
| Phase 5: 驗證與部署            | 🔜 等待 Phase 4 | -                 | -          | -        |

**圖例**: ✅ 完成 | 🔄 進行中 | ⏸️ 待啟動 | 🔜 等待前一階段 | ❌ 停滯

---

## 📝 開發日誌

### 2026-09-08 (Phase 1 完成 + Phase 2 啟動後暫停)

- ✅ 完成 Phase 1: 環境準備
  - 安裝 v5 SDK packages
  - 創建 `langfuseClient.mjs`
  - 創建 migration plan
  - 備份 `aiClient.mjs`
  - Git commit `03175bd` 並 push
- ⏸️ **Phase 2 啟動後暫停**: 評估後決定分多個 session 完成
  - 原因：752 行核心邏輯 + 899 行測試，需 6-8 小時專注開發
  - 決策：保持 Phase 1 clean state，下次 session 全力投入 Phase 2
  - 移除臨時檔案：`aiClient.wrapper.mjs`, `aiClient.v5.temp.mjs`

---

## 🔧 Phase 2: `aiClient.mjs` 核心遷移 🔄 **進行中**

### 執行策略

考量原檔案過大（752 行），採用**新建檔案**策略：

1. 創建 `aiClient.v5.mjs` 新檔案
2. 逐步遷移核心函數
3. 測試驗證後，替換原 `aiClient.mjs`

### 已完成項目

- [x] Phase 2 啟動
- [ ] 重構 imports 與初始化
- [ ] 重構 `resolveChatPrompt()`
- [ ] 重構 `callAI()`
- [ ] 更新 `aiClient.test.mjs` mock
- [ ] 單元測試全綠

### 當前阻礙

無

### Next Action

繼續重構 `aiClient.mjs`

---

[... 其餘內容保持不變 ...]
