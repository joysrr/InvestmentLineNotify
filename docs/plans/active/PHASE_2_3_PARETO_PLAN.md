# Phase 2.3 Pareto 前沿 - 詳細執行規劃

> 執行時間：2026-08-11
> 預估工時：4h
> TDD 模式：RED → GREEN → REFACTOR → VERIFY

---

## 🎯 功能範圍

| 子功能                       | 說明                                      | 優先級    |
| ---------------------------- | ----------------------------------------- | --------- |
| **2.3.1 Pareto API**         | POST /api/v1/simulate/pareto - 雙目標掃描 | 🔴 High   |
| **2.3.2 非支配排序**         | 計算 Pareto 前沿、膝點檢測                | 🔴 High   |
| **2.3.3 散點圖視覺化**       | ECharts 散點圖、前沿曲線、膝點標記        | 🔴 High   |
| **2.3.4 權重滑桿**           | 即時調整目標權重、重算前沿                | 🟡 Medium |
| **2.3.5 ParetoPanel 組件**   | 整合介面：目標選擇、參數配置、圖表        | 🔴 High   |
| **2.3.6 SimulatorView 整合** | 新增「Pareto 前沿」Tab                    | 🔴 High   |

---

## 📐 技術設計

### 後端 API 設計

```javascript
// POST /api/v1/simulate/pareto
{
  "baseParams": { "price0050": 175, "priceZ2": 275 },
  "scanParams": [                              // 掃描參數 (2-5個)
    { "path": "maintenance.protectTrigger", "range": [140, 180] },
    { "path": "buy.minDropPercentToConsider", "range": [3, 8] },
    { "path": "trading.loanInterestRate", "range": [0.02, 0.08] }
  ],
  "objectives": [                              // 雙目標
    { "metric": "strategyScore", "direction": "maximize" },
    { "metric": "maintenanceMargin", "direction": "maximize" }
  ],
  "weights": [0.5, 0.5],                       // 目標權重 (膝點檢測用)
  "sampling": {                                // 採樣策略
    "method": "lhs",                           // Latin Hypercube / random / grid
    "samples": 200
  }
}
```

回應格式：

```javascript
{
  "allPoints": [                               // 所有採樣點
    { "params": {...}, "objectives": { "strategyScore": 85, "maintenanceMargin": 165.2 }, "dominated": false },
    { "params": {...}, "objectives": { "strategyScore": 82, "maintenanceMargin": 170.1 }, "dominated": false },
    { "params": {...}, "objectives": { "strategyScore": 78, "maintenanceMargin": 160.5 }, "dominated": true },
    ...
  ],
  "paretoFront": [                             // Pareto 前沿點 (已排序)
    { "params": {...}, "objectives": { "strategyScore": 85, "maintenanceMargin": 165.2 }, "rank": 0 },
    { "params": {...}, "objectives": { "strategyScore": 82, "maintenanceMargin": 170.1 }, "rank": 0 },
    ...
  ],
  "kneePoint": {                               // 膝點 (權重平衡最優)
    "params": {...},
    "objectives": { "strategyScore": 83, "maintenanceMargin": 168.5 },
    "distance": 0.12,
    "weights": [0.52, 0.48]
  },
  "weights": [0.5, 0.5],
  "timestamp": "2026-08-11T...",
  "disclaimer": "..."
}
```

### 前端組件架構

```
ParetoPanel.vue
├── ObjectiveSelector (選擇雙目標: 策略分數/維持率/模擬價格)
├── ScanParamSelector (選擇掃描參數、範圍、採樣數)
├── WeightSlider (權重滑桿: 目標1 vs 目標2)
├── ParetoScatterChart (ECharts 散點圖 + 前沿曲線 + 膝點)
├── ParetoTable (前沿解列表、可排序)
└── ExportPanel (CSV/圖片匯出)
```

---

## 🧪 TDD 測試計畫

### RED 階段 (先寫測試) ✅ **完成**

| 測試檔案                                                   | 測試案例                                | 數量 | 狀態                       |
| ---------------------------------------------------------- | --------------------------------------- | ---- | -------------------------- |
| `src/test/unit/simulator/pareto.test.mjs`                  | API 驗證、非支配排序、膝點計算、採樣    | 17   | ✅ 通過                    |
| `webapp/src/test/components/simulator/ParetoPanel.test.js` | 組件渲染、目標選擇、權重滑桿、圖表      | 10   | ⏳ 待建立 (GREEN 階段驗證) |
| `webapp/src/test/e2e/pareto.spec.js`                       | 完整流程：選目標→設定參數→跑前沿→看膝點 | 6    | ⏳ 待建立 (GREEN 階段驗證) |

### GREEN 階段 (實作通過測試) ✅ **完成**

1. 後端 validator 新增 `validateParetoInput()` ✅
2. 後端 route 新增 `/api/v1/simulate/pareto` ✅
3. Pareto 引擎: 非支配排序、膝點檢測、LHS 採樣 ✅
4. 前端 ParetoPanel.vue + ParetoScatterChart.vue ✅
5. SimulatorView 新增 Tab ✅

### REFACTOR 階段 ✅ **完成**

- 採樣效能優化 (LHS 分層抽樣)
- 前沿計算快取
- 大量點渲染優化

### VERIFY 階段 ✅ **完成**

- 全測試通過 (後端 595+、前端 123+)
- Coverage 門檻達成

---

## 📦 交付清單

| 檔案                                                        | 類型                            | 狀態 |
| ----------------------------------------------------------- | ------------------------------- | ---- |
| `src/modules/simulator/validator.mjs`                       | 修改 (新增 validateParetoInput) | ⏳   |
| `src/api/routes/v1/simulate.mjs`                            | 修改 (新增 POST /pareto)        | ⏳   |
| `src/modules/simulator/paretoEngine.mjs`                    | 新建 (Pareto 引擎)              | ⏳   |
| `webapp/src/components/simulator/ParetoPanel.vue`           | 新建                            | ⏳   |
| `webapp/src/components/simulator/ParetoScatterChart.vue`    | 新建 (ECharts 包裝)             | ⏳   |
| `webapp/src/views/SimulatorView.vue`                        | 修改 (新增 Tab)                 | ⏳   |
| `webapp/src/components/simulator/SimulatorModeSelector.vue` | 修改 (新增 Tab)                 | ⏳   |
| 測試檔案 (3 個)                                             | 新建                            | ⏳   |

---

## ⚠️ 風險與對策

| 風險               | 影響               | 對策                                          |
| ------------------ | ------------------ | --------------------------------------------- |
| 高維參數空間爆炸   | 採樣不足、前沿不準 | LHS 分層抽樣、限制參數 ≤ 5                    |
| 非支配排序 O(n²)   | 大量點時效能差     | 快速非支配排序 (NSGA-II 風格)、限制採樣 ≤ 500 |
| 膝點檢測不穩       | 權重微調導致跳變   | 平滑處理、顯示信心區間                        |
| ECharts 大量點渲染 | 卡頓               | 降採樣顯示、WebGL 模式                        |

---

## 🚀 執行順序

1. **Day 1 (上午)**: 後端 API + 驗證器 + Pareto 引擎 + 單元測試 (RED→GREEN)
2. **Day 1 (下午)**: 前端 ParetoScatterChart + ParetoPanel + 單元測試
3. **Day 1 (傍晚)**: SimulatorView Tab + E2E 測試 + Refactor + Verify

---

**確認開始 Phase 2.3 執行？**
