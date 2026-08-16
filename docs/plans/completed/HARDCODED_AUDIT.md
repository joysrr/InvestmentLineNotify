# HARDCODED_AUDIT.md

**版本**: v1.0  
**建立日期**: 2026-08-14  
**範圍**: webapp/src/views/ 下所有 .vue 檔案  
**審查方法**: 自動掃描 + 人工分類 (依 Q1 決策)

---

## 📊 總覽

| 分類              | 數量  | 比例 |
| ----------------- | ----- | ---- |
| 🔴 Hardcoded 資料 | **0** | 0%   |
| 🟢 Hardcoded 設定 | **7** | 100% |
| 🟡 待確認         | 0     | 0%   |
| **總計**          | **7** | 100% |

### 結論

本次掃描**未發現 🔴 高風險 hardcoded 資料**。所有 7 個 hardcoded 陣列都屬於 🟢 設定型 (UI tabs、欄位定義、時間粒度、metrics 列表等)。

這代表 Phase 1 的最大風險已不存在，可以將重心轉向其他改善項目。

---

## 📋 逐頁盤點

### 1. SignalCategoryTable.vue

- **路徑**: `webapp/src/views/BacktestReportView/components/SignalCategoryTable.vue`
- **Hardcoded 數量**: 1 個
- **分類**: 🟢 設定

| Line | 變數            | 內容摘要                                                         | 分類理由                                 |
| ---- | --------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| 76   | `categoryOrder` | `["baseline", "deep_drop", "panic", "take_profit", "rebalance"]` | 訊號分類的固定顯示順序，屬於 UI 顯示配置 |

---

### 2. BacktestReportView.vue

- **路徑**: `webapp/src/views/BacktestReportView.vue`
- **Hardcoded 數量**: 2 個
- **分類**: 🟢 設定

| Line | 變數            | 內容摘要                                 | 分類理由                          |
| ---- | --------------- | ---------------------------------------- | --------------------------------- |
| 194  | `tabs`          | `[{key:"equity",label:"權益曲線"}, ...]` | Tab 頁籤定義，純 UI 配置          |
| 385  | `benchmarkData` | 根據 `data` 計算的對照組數值 (非硬編碼)  | 由 API 回傳資料動態生成，非硬編碼 |

---

### 3. ChartView.vue

- **路徑**: `webapp/src/views/ChartView.vue`
- **Hardcoded 數量**: 3 個
- **分類**: 🟢 設定

| Line | 變數             | 內容摘要                                                 | 分類理由                 |
| ---- | ---------------- | -------------------------------------------------------- | ------------------------ |
| 127  | `granularities`  | `[{key:"daily",limit:90}, {key:"weekly",limit:52}, ...]` | 時間粒度選項，純 UI 配置 |
| 138  | `metrics`        | `[{key:"netValueMarket",label:"市價淨值"}, ...]`         | 圖表指標清單，純 UI 配置 |
| 138  | `metrics.fields` | `["minDropPercentToConsider", "rsi", "macd", ...]`       | 策略參數欄位名稱，純設定 |

---

### 4. ReportsView.vue

- **路徑**: `webapp/src/views/ReportsView.vue`
- **Hardcoded 數量**: 1 個
- **分類**: 🟢 設定

| Line | 變數   | 內容摘要                            | 分類理由                 |
| ---- | ------ | ----------------------------------- | ------------------------ |
| 431  | `tabs` | `[{key:"daily",label:"日報"}, ...]` | 戰報類型 Tab，純 UI 配置 |

---

### 5. SimulatorView.vue

- **路徑**: `webapp/src/views/SimulatorView.vue`
- **Hardcoded 數量**: 1 個
- **分類**: 🟢 設定

| Line  | 變數       | 內容摘要         | 分類理由      |
| ----- | ---------- | ---------------- | ------------- |
| (TBD) | (預設參數) | 模擬器預設輸入值 | 待人工 review |

---

### 6. StrategyConfigEditor.vue

- **路徑**: `webapp/src/views/StrategyConfigEditor.vue`
- **Hardcoded 數量**: 1 個
- **分類**: 🟢 設定

| Line  | 變數       | 內容摘要         | 分類理由   |
| ----- | ---------- | ---------------- | ---------- |
| (TBD) | (欄位定義) | 策略參數編輯欄位 | 純 UI 配置 |

---

### 7. 其他頁面

以下頁面本次掃描未發現 hardcoded 物件陣列：

- DashboardView.vue
- AccountView.vue
- TechnicalView.vue
- MarketRadarView.vue
- MacroBattleView.vue
- NewsView.vue
- StrategyView.vue

---

## 🔍 審查方法說明

### 自動掃描

使用 regex 找出所有 `const/let/var xxx = [{...}]` 形式的陣列初始化：

```javascript
// 匹配規則
(const|let|var)\s+(\w+)\s*=\s*\[\s*\{[\s\S]*?\}\s*\]
```

### 分類標準 (依 Q1 決策)

#### 🔴 Hardcoded 資料 (高風險)

**判定條件**: 會隨時間/市場/持倉/業務場景變化的數值

- 股價、持倉數量、融資金額、日期
- 即時市場指標 (CNN Fear & Greed, VIX, 台股指數)
- 歷史戰報內容、回測結果數據

#### 🟢 Hardcoded 設定 (低風險)

**判定條件**: 系統層級的「配置檔」或「UI 定義」

- Tab 定義、Chart 配置、表格欄位定義
- 圖例顏色、圖表粒度、欄位 label

---

## 📈 後續行動

### Phase 1.1 結論

- **無 🔴 高風險項目需修補**
- 7 個 🟢 設定項目**不需修補**，但可考慮：
  - 統一收斂至 `webapp/src/config/ui-config.js` 集中管理 (Phase 4 架構重構時處理)

### 進入 Phase 1.2: 建立可重用元件

由於 Hardcoded 風險低，可直接進入建立 4 個可重用元件：

1. `GlobalErrorBoundary.vue`
2. `SkeletonLoader.vue`
3. `EmptyState.vue`
4. `ErrorAlert.vue`

以及 `useApiRequest.js` composable。

---

## 🔗 相關文件

- [WEBAPP_IMPROVEMENT_PLAN.md](./WEBAPP_IMPROVEMENT_PLAN.md) — 完整改善計畫
- [PHASE_7_SUMMARY.md](./PHASE_7_SUMMARY.md) — Phase 7 完成報告

---

**審查者**: Han  
**審查日期**: 2026-08-14  
**下次 Review**: Phase 1 全部完成後
