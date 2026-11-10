---
type: plan
status: completed
last_updated: 2026-09-10
tags:
  - completed
  - archived
wiki_links: []
---

# 未接入頁面復原與科學回測清理計畫 (2026-09-10-MISSING_VIEWS_AND_CLEANUP_PLAN.md)

> **狀態**：Completed — 已完成開發、單元測試、E2E 測試與部署驗證
> **建立日期**：2026-09-06
> **背景**：針對盤點發現之未接入頁面 (`ChartView.vue` 個人資產歷史趨勢圖表) 進行 UI 接入，並依據 Han 的要求徹底清理 `ReportsView.vue` 中遺留的「科學回測 (discipline)」靜態區塊。

---

## 🎯 盤點結果與優化任務

### 1. 全頁面盤點結果 (View Inventory)

經全盤程式碼與路由檢查：

- 共有 13 個 View 檔案，其中 12 個已有正式入口。
- **唯一「已開發但未接入 UI」的頁面**：**`ChartView.vue` (📊 資產趨勢圖表)**！
  - _功能說明_：展示個人資產歷史快照趨勢圖表，支援「日/週/月」粒度切換、淨資產/0050股數/00675L股數/融資金額多維度圖表與統計摘要。

### 2. 任務一：接入個人資產歷史趨勢圖表 (`ChartView.vue`)

- **接入位置**：在 `AccountView.vue`（設定與帳戶）的「💼 帳戶快照」區塊標題旁加入「📊 查看資產趨勢歷史圖表」導航按鈕，點擊跳轉至 `#/chart` (`ChartView.vue`)。
- **驗證**：撰寫 E2E 測試驗證點擊導航與圖表加載 (`08-chartView.spec.js`)。

### 3. 任務二：移除 `ReportsView.vue` 中的「科學回測」區塊

- **清理內容**：
  - 移除 `ReportsView.vue` 中的 `discipline` (科學回測) Tab 選項按鈕。
  - 刪除 `.discipline-container` (17 年大循環歷史數據對比圖表與表格) 模板。
  - 刪除 `cagrOptions` 圖表選項與相關 CSS 樣式。
  - 同步修復 `ReportsView.test.js` 測試。

---

## 📅 開發階段劃分 (Phases)

| Phase       | 任務                                                     | 預計產出                                             |
| ----------- | -------------------------------------------------------- | ---------------------------------------------------- |
| **Phase 1** | 清理 `ReportsView.vue` 「科學回測」區塊                  | 刪除 discipline tab/模板/CSS + 修復單元測試 (Commit) |
| **Phase 2** | 在 `AccountView.vue` 接入 `ChartView.vue` (資產趨勢按鈕) | 補上導航按鈕 + E2E 驗證 (Commit)                     |
| **Phase 3** | 全套單元 (360+) 與 E2E (65+) 綠燈驗證與歸檔              | 測試綠燈 + npm run build 成功 + 歸檔 active 計畫     |

---

## 🧪 驗證與品質門檻

- **TDD Enforcement**：變更前先編寫/調整單元與 E2E 測試。
- **Lint & Build**：0 ESLint errors，`npm run build` 成功。
