---
title: "0050 雙向模擬器 (Simulator)"
category: "modules/strategy"
type: reference
status: current
created: "2026-11-11"
last_updated: "2026-11-11"
tags:
  - simulator
  - forward-simulation
  - reverse-engine
  - strategy
  - 0050
code_refs:
  - src/modules/simulator/forwardSimulator.mjs
  - src/modules/simulator/reverseEngine.mjs
  - src/modules/simulator/scanner.mjs
  - src/modules/simulator/analyticalSolvers.mjs
  - src/modules/simulator/paretoEngine.mjs
  - src/modules/simulator/dataAdapter.mjs
  - src/modules/simulator/constants.mjs
  - src/modules/simulator/validator.mjs
---

# 0050 雙向模擬器 (Simulator)

## 📋 目錄

1. [架構總覽](#架構總覽)
2. [正向模擬 (Forward Simulation)](#正向模擬)
3. [反向推導 (Reverse Engine)](#反向推導)
4. [9 種目標類型](#9-種目標類型)
5. [掃描器 (Scanner)](#掃描器)
6. [API 合約](#api-合約)
7. [使用方式與範例](#使用方式與範例)

---

## 架構總覽

雙向模擬器提供兩種推導方向：

```
正向: SimulationInput (股價) → 策略引擎 → 分數 / 建議
反向: 目標條件 (RSI / MA / 分數 ...) → 推導 → 所需股價
```

**核心模組**：

| 檔案                    | 職責                                          |
| ----------------------- | --------------------------------------------- |
| `forwardSimulator.mjs`  | 正向模擬主流程：輸入股價 → 產出策略評分與建議 |
| `reverseEngine.mjs`     | 反向推導路由器：解析解 or 掃描器              |
| `analyticalSolvers.mjs` | 解析解求解（maintenanceRatio、RSI、MA 等）    |
| `scanner.mjs`           | 掃描器：依步長掃描股價範圍，逐一正向驗證      |
| `paretoEngine.mjs`      | Pareto 多目標最優化                           |
| `dataAdapter.mjs`       | 資料介接：歷史快取 + Portfolio 轉換           |
| `validator.mjs`         | 輸入驗證                                      |
| `constants.mjs`         | 所有常數（邊界值、目標類型清單、掃描設定）    |

---

## 正向模擬

**入口**：`runForwardSimulation(input, context)` ← `src/modules/simulator/forwardSimulator.mjs`

**流程**：

1. 驗證輸入（`validator.mjs`）
2. 以模擬股價計算維持率
3. 呼叫策略引擎 (`resolveAction`) 取得評分與建議
4. 格式化回應，包含：策略分數、建議動作、槓桿分數

**輸入**：

```javascript
{
  price: number,          // 模擬股價 (台幣)
  portfolio: Object,      // 資產組合（持股數、現金、借貸等）
  strategy: Object,       // 策略設定
  history: Array,         // K 線歷史資料
  lifecycleContext: Object
}
```

**輸出**：

```javascript
{
  price: number,
  strategyScore: number,      // 0–100
  maintenanceRatio: number,   // 維持率 %
  action: string,             // "BUY" | "HOLD" | "SELL"
  leverageScore: number
}
```

---

## 反向推導

**入口**：`runReverseEngine({ targetType, targetValue, ... })` ← `src/modules/simulator/reverseEngine.mjs`

**路由邏輯**：

- 若目標類型支援**解析解** → `analyticalSolvers.mjs` 直接求解
- 其餘目標 → `scanner.mjs` 掃描股價範圍後正向驗證

**支援目標類型（`REVERSE_TARGET_TYPES`）**：見下節。

---

## 9 種目標類型

定義於 `src/modules/simulator/constants.mjs`：

| #   | 目標類型           | 說明                                       |
| --- | ------------------ | ------------------------------------------ |
| 1   | `maintenanceRatio` | 維持率達到指定 %                           |
| 2   | `rsi`              | RSI 達到指定值                             |
| 3   | `ma20`             | 股價穿越 20 日均線                         |
| 4   | `ma60`             | 股價穿越 60 日均線                         |
| 5   | `ma240Bias`        | 與 240 日均線的乖離率                      |
| 6   | `kdCross`          | KD 黃金交叉 / 死亡交叉                     |
| 7   | `macdCross`        | MACD 黃金交叉 / 死亡交叉                   |
| 8   | `strategyScore`    | 策略分數達到指定值                         |
| 9   | `portfolioHealth`  | Portfolio Health 達到 green / yellow / red |

**掃描方向（`CROSS_DIRECTIONS`）**：`"golden"` | `"dead"`

---

## 掃描器

**入口**：`scanPriceRange(options)` ← `src/modules/simulator/scanner.mjs`

掃描器以固定步長（預設 1 台幣）掃描股價範圍（`PRICE_BOUNDS: { MIN: 1, MAX: 500 }`），對每個候選股價執行正向驗證，直到滿足目標條件。

**各目標掃描函數**：

| 函數                                             | 對應目標          |
| ------------------------------------------------ | ----------------- |
| `createKDCrossChecker(direction, kdHistory)`     | `kdCross`         |
| `createMACDCrossChecker(direction, macdHistory)` | `macdCross`       |
| `createStrategyScoreChecker(targetScore)`        | `strategyScore`   |
| `createPortfolioHealthChecker(targetStatus)`     | `portfolioHealth` |

---

## API 合約

### GET `/api/v1/simulator/forward`

| 參數          | 類型   | 說明             |
| ------------- | ------ | ---------------- |
| `price`       | number | 模擬股價（台幣） |
| `portfolioId` | string | 資產組合 ID      |

### POST `/api/v1/simulator/reverse`

```json
{
  "targetType": "rsi",
  "targetValue": 30,
  "direction": "golden"
}
```

---

## 使用方式與範例

### 範例 1：正向模擬 — 股價 150 元時的策略分數

```javascript
import { runForwardSimulation } from "./src/modules/simulator/forwardSimulator.mjs";

const result = await runForwardSimulation({
  price: 150,
  portfolio: { shares: 1000, cash: 50000 },
  strategy: defaultStrategy,
  history: priceHistory,
});
// result.strategyScore → 65
// result.action → "HOLD"
```

### 範例 2：反向推導 — RSI 達到 30 需要多低的股價

```javascript
import { runReverseEngine } from "./src/modules/simulator/reverseEngine.mjs";

const result = await runReverseEngine({
  targetType: "rsi",
  targetValue: 30,
  portfolio,
  history: priceHistory,
});
// result.price → 128.5
```

### 範例 3：Portfolio Health 達到 green

```javascript
const result = await runReverseEngine({
  targetType: "portfolioHealth",
  targetValue: "green",
  portfolio,
  history: priceHistory,
});
```

---

> **SSOT**：以 `src/modules/simulator/constants.mjs` 中 `REVERSE_TARGET_TYPES` 為準。
> 本文件最後更新於 2026-11-11，對應程式碼版本 `main`（HEAD `f50b15b`）。
