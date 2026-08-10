# Phase 2.2 敏感度分析 - 詳細執行規劃

> 執行時間：2026-08-11
> 預估工時：6h
> TDD 模式：RED → GREEN → REFACTOR → VERIFY

---

## 🎯 功能範圍

| 子功能                          | 說明                                                  | 優先級    |
| ------------------------------- | ----------------------------------------------------- | --------- |
| **2.2.1 參數掃描 API**          | POST /api/v1/simulate/sensitivity - 單參數/多參數掃描 | 🔴 High   |
| **2.2.2 敏感度曲線圖表**        | ECharts 折線圖：X=參數值, Y=策略分數/維持率           | 🔴 High   |
| **2.2.3 Tornado 圖**            | 條狀圖顯示多參數影響度排序                            | 🔴 High   |
| **2.2.4 關鍵驅動因子識別**      | 自動計算斜率、標記 Top 3 關鍵參數                     | 🟡 Medium |
| **2.2.5 SensitivityPanel 組件** | 整合介面：參數選擇、範圍設定、圖表切換                | 🔴 High   |
| **2.2.6 SimulatorView 整合**    | 新增「敏感度分析」Tab、模式切換                       | 🔴 High   |

---

## 📐 技術設計

### 後端 API 設計

```javascript
// POST /api/v1/simulate/sensitivity
{
  "baseParams": { "price0050": 175, "priceZ2": 275 },  // 基準參數
  "targetParam": "maintenanceRatio",                     // 目標參數路徑
  "scanRange": { "min": 140, "max": 180, "step": 1 },   // 掃描範圍
  "metrics": ["strategyScore", "maintenanceMargin"],     // 觀測指標
  "multiParams": [                                       // 多參數掃描 (Tornado 圖用)
    { "path": "maintenanceRatio", "range": [140, 180] },
    { "path": "buy.minDropPercentToConsider", "range": [3, 8] },
    ...
  ]
}
```

回應格式：

```javascript
{
  "singleParam": {                    // 單參數敏感度曲線
    "paramPath": "maintenanceRatio",
    "metric": "strategyScore",
    "points": [
      { "x": 140, "y": 85, "maintenanceMargin": 165.2 },
      { "x": 141, "y": 87, "maintenanceMargin": 166.1 },
      ...
    ],
    "slope": 0.5,                     // 平均斜率
    "correlation": 0.92               // 相關係數
  },
  "multiParam": {                     // Tornado 圖資料
    "results": [
      { "paramPath": "maintenanceRatio", "impact": 45.2, "direction": "positive" },
      { "paramPath": "buy.minDropPercentToConsider", "impact": 23.8, "direction": "negative" },
      ...
    ],
    "keyDrivers": [                   // Top 3 關鍵驅動因子
      "maintenanceRatio",
      "buy.minDropPercentToConsider",
      "trading.loanInterestRate"
    ]
  },
  "timestamp": "2026-08-11T...",
  "disclaimer": "..."
}
```

### 前端組件架構

```
SensitivityPanel.vue
├── ParameterSelector (選擇目標參數、掃描範圍、步長)
├── MetricSelector (觀測指標：策略分數/維持率/多選)
├── ChartToggle (敏感度曲線 / Tornado 圖 切換)
├── SensitivityChart (ECharts 折線圖)
├── TornadoChart (ECharts 條狀圖)
├── KeyDriversPanel (關鍵驅動因子列表)
└── ExportPanel (CSV/圖片匯出)
```

### 策略參數路徑映射 (從 StrategyConfigEditor 參考)

```javascript
const SCANNABLE_PARAMS = [
  // 維持率防禦
  {
    path: "maintenance.protectTrigger",
    label: "維持率防禦觸發",
    type: "number",
    min: 100,
    max: 200,
  },
  {
    path: "maintenance.protectTarget",
    label: "維持率防禦目標",
    type: "number",
    min: 100,
    max: 200,
  },
  {
    path: "maintenance.marginCallThreshold",
    label: "追加保證金閾值",
    type: "number",
    min: 100,
    max: 150,
  },

  // 交易設定
  {
    path: "trading.transFee",
    label: "手續費率",
    type: "number",
    min: 0.001,
    max: 0.01,
  },
  {
    path: "trading.transFeeDiscount",
    label: "手續費折扣",
    type: "number",
    min: 0.5,
    max: 1,
  },
  {
    path: "trading.taxRate",
    label: "交易稅率",
    type: "number",
    min: 0.001,
    max: 0.005,
  },
  {
    path: "trading.loanInterestRate",
    label: "融資利率",
    type: "number",
    min: 0.01,
    max: 0.1,
  },

  // 買入設定
  {
    path: "buy.minDropPercentToConsider",
    label: "最小跌幅考慮",
    type: "number",
    min: 1,
    max: 15,
  },
  {
    path: "buy.minWeightScoreToBuy",
    label: "最小權重分數",
    type: "number",
    min: 0,
    max: 100,
  },

  // 賣出設定
  {
    path: "sell.minUpPercentToSell",
    label: "最小漲幅賣出",
    type: "number",
    min: 1,
    max: 15,
  },
  {
    path: "sell.minSignalCountToSell",
    label: "最小信號數",
    type: "number",
    min: 1,
    max: 5,
  },

  // 系統閾值
  {
    path: "threshold.ma240Bias",
    label: "MA240 偏離閾值",
    type: "number",
    min: -20,
    max: 20,
  },
];
```

---

## 🧪 TDD 測試計畫

### RED 階段 (先寫測試) ✅ **完成**

| 測試檔案                                                        | 測試案例                                   | 數量 | 狀態                       |
| --------------------------------------------------------------- | ------------------------------------------ | ---- | -------------------------- |
| `src/test/unit/simulator/sensitivity.test.mjs`                  | API 驗證、單參數掃描、多參數掃描、斜率計算 | 18   | ✅ 通過                    |
| `webapp/src/test/components/simulator/SensitivityPanel.test.js` | 組件渲染、參數選擇、圖表切換、API 呼叫     | 12   | ✅ 通過 (10 待 GREEN 實作) |
| `webapp/src/test/e2e/sensitivity.spec.js`                       | 完整流程：選參數→設定範圍→跑圖→看結果      | 8    | ✅ 就緒                    |

### GREEN 階段 (實作通過測試) 🚀 **進行中**

1. 後端 validator 新增 `validateSensitivityInput()`
2. 後端 route 新增 `/api/v1/simulate/sensitivity`
3. 前端 SensitivityPanel.vue + ECharts 整合
4. SimulatorView 新增 Tab

### REFACTOR 階段

- 圖表效能優化 (大量資料點取樣)
- 參數路徑驗證快取
- 錯誤處理統一化

### VERIFY 階段

- 全測試通過 (後端 560+、前端 110+、E2E 30+)
- Coverage 門檻達成

---

## 📦 交付清單

| 檔案                                                        | 類型                                 | 狀態                  |
| ----------------------------------------------------------- | ------------------------------------ | --------------------- |
| `src/modules/simulator/validator.mjs`                       | 修改 (新增 validateSensitivityInput) | ✅ 完成               |
| `src/modules/simulator/constants.mjs`                       | 修改 (新增 SCANNABLE_PARAMS)         | ✅ 完成               |
| `src/api/routes/v1/simulate.mjs`                            | 修改 (新增 POST /sensitivity)        | ⏳ 待實作             |
| `webapp/src/components/simulator/SensitivityPanel.vue`      | 新建                                 | ⏳ 待實作 (stub 就緒) |
| `webapp/src/components/simulator/SensitivityChart.vue`      | 新建 (ECharts 包裝)                  | ✅ 完成               |
| `webapp/src/components/simulator/TornadoChart.vue`          | 新建 (ECharts 包裝)                  | ✅ 完成               |
| `webapp/src/views/SimulatorView.vue`                        | 修改 (新增 Tab)                      | ⏳ 待實作             |
| `webapp/src/components/simulator/SimulatorModeSelector.vue` | 修改 (新增 Tab)                      | ⏳ 待實作             |
| 測試檔案 (3 個)                                             | 新建                                 | ✅ 完成               |

---

## ⚠️ 風險與對策

| 風險               | 影響         | 對策                                       |
| ------------------ | ------------ | ------------------------------------------ |
| ECharts 版本相容性 | 圖表無法渲染 | 固定使用專案現有 echarts^5.5.1             |
| 大量掃描點效能     | 回應超時     | 限制 MAX_POINTS=200、後端分頁/取樣         |
| 參數路徑錯誤       | 掃描失敗     | 從 configMeta 動態驗證路徑                 |
| 多參數組合爆炸     | 組合數過大   | Tornado 圖僅掃描單參數變化 (one-at-a-time) |

---

## 🚀 執行順序

1. **Day 1 (上午)**: 後端 API + 驗證器 + 單元測試 (RED→GREEN)
2. **Day 1 (下午)**: 前端 SensitivityChart/TornadoChart + 單元測試
3. **Day 2 (上午)**: SensitivityPanel 整合 + SimulatorView Tab
4. **Day 2 (下午)**: E2E 測試 + Refactor + Verify

---

**確認開始 Phase 2.2 執行？**
