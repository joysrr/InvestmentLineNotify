---
type: plan
status: archived
last_updated: 2026-09-11
tags:
  - archived
  - historical
wiki_links: []
---

# Phase 2.4 匯出功能 - 詳細執行規劃

> 執行時間：2026-08-11
> 預估工時：2h
> TDD 模式：RED → GREEN → REFACTOR → VERIFY

---

## 🎯 功能範圍

| 子功能                          | 說明                                          | 優先級    |
| ------------------------------- | --------------------------------------------- | --------- |
| **2.4.1 統一匯出工具**          | ExportUtility.js - 共用 CSV/JSON/圖片匯出邏輯 | 🔴 High   |
| **2.4.2 BatchPanel 匯出**       | 整合現有 CSV/JSON 匯出、新增圖片匯出          | 🔴 High   |
| **2.4.3 SensitivityPanel 匯出** | 新增 CSV/JSON/圖片匯出                        | 🔴 High   |
| **2.4.4 ParetoPanel 匯出**      | 整合現有 CSV/JSON 匯出、新增圖片匯出          | 🔴 High   |
| **2.4.5 統一匯出介面**          | 共用 ExportButton 元件、下拉選單              | 🟡 Medium |

---

## 📐 技術設計

### ExportUtility.js 核心函數

```javascript
// CSV 匯出
export function exportToCSV(data, filename, options = {}) {
  // 支援陣列物件、表格資料
  // 選項: headers, delimiter, encoding, bom
}

// JSON 匯出
export function exportToJSON(data, filename, options = {}) {
  // 選項: pretty, metadata, timestamp
}

// 圖片匯出 (ECharts)
export async function exportChartAsImage(chartInstance, filename, options = {}) {
  // 選項: type (png/jpeg), pixelRatio, backgroundColor
}

// 檔案下載觸發
export function triggerDownload(blob, filename) { ... }
```

### 匯出資料結構標準化

```javascript
// 所有匯出包含 metadata
{
  metadata: {
    exportedAt: "2026-08-11T...",
    version: "1.0",
    source: "batch|sensitivity|pareto",
    params: { ... }  // 原始輸入參數
  },
  data: [ ... ]  // 實際資料
}
```

---

## 🧪 TDD 測試計畫

### RED 階段 (先寫測試)

| 測試檔案                                                    | 測試案例                              | 數量 |
| ----------------------------------------------------------- | ------------------------------------- | ---- |
| `src/test/unit/export/exportUtility.test.mjs`               | CSV/JSON/圖片匯出、檔名生成、中文支援 | 10   |
| `webapp/src/test/components/simulator/ExportButton.test.js` | 元件渲染、下拉選單、點擊觸發          | 6    |

### GREEN 階段 (實作通過測試)

1. 建立 `src/utils/exportUtility.mjs` (後端) / `webapp/src/utils/exportUtility.js` (前端)
2. 建立 `webapp/src/components/common/ExportButton.vue`
3. 整合到 BatchPanel、SensitivityPanel、ParetoPanel

### REFACTOR 階段

- 統一錯誤處理、載入狀態
- 圖片匯出非同步處理、進度提示

### VERIFY 階段

- 全測試通過
- 手動驗證各 Panel 匯出功能

---

## 📦 交付清單

| 檔案                                                   | 類型                | 狀態 |
| ------------------------------------------------------ | ------------------- | ---- |
| `webapp/src/utils/exportUtility.js`                    | 新建 (前端共用)     | ⏳   |
| `webapp/src/components/common/ExportButton.vue`        | 新建                | ⏳   |
| `webapp/src/components/simulator/BatchPanel.vue`       | 修改 (整合圖片匯出) | ⏳   |
| `webapp/src/components/simulator/SensitivityPanel.vue` | 修改 (整合匯出)     | ⏳   |
| `webapp/src/components/simulator/ParetoPanel.vue`      | 修改 (整合圖片匯出) | ⏳   |
| 測試檔案 (2 個)                                        | 新建                | ⏳   |

---

## ⚠️ 風險與對策

| 風險                           | 影響         | 對策                                                                      |
| ------------------------------ | ------------ | ------------------------------------------------------------------------- |
| ECharts getDataURL 跨域/安全性 | 圖片匯出失敗 | 設定 chartInstance.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }) |
| 大量資料 CSV 記憶體            | 瀏覽器卡頓   | 分塊生成、Blob 流式處理                                                   |
| 中文檔名編碼                   | 下載檔名亂碼 | encodeURIComponent + RFC 5987 格式                                        |

---

## 🚀 執行順序

1. **前 30 分鐘**: ExportUtility.js + 測試 (RED→GREEN)
2. **前 30 分鐘**: ExportButton.vue + 整合到 3 個 Panel
3. **後 30 分鐘**: 圖片匯出功能 + 整合
4. **後 30 分鐘**: 測試驗證 + Refactor

---

**確認開始 Phase 2.4 執行？**
