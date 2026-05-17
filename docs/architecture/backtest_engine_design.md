# InvestmentLineNotify Backtest Engine Architecture

## 1. 架構設計說明 (Architecture Overview)

回測引擎的核心目標是「重現歷史決策過程」並「衡量長期績效」。為了不變動現有的 `strategyEngine.mjs` 核心邏輯，我們將採取 **依賴注入與模擬器 (Stub/Mock)** 的設計模式。

回測流程視為一個「時間推進 (Time-stepping)」的迴圈：

1. **Time Shifting**: 模擬器推向歷史上的第 $T$ 天。
2. **Context Reconstruction**: 根據歷史資料庫，重建當天的 `DailyRunContext`。
3. **Signal Calculation**: 透過 `signalContext.mjs` 計算當天的技術指標與帳戶快照。
4. **Decision Making**: 調用 `strategyEngine.buildDecision` 產生訊號。
5. **Execution Simulation**: 模擬交易執行（買入/賣出/再平衡），更新帳戶狀態（維持率、槓桿、餘額）。
6. **State Persistence**: 進入第 $T+1$ 天，重複上述過程。

---

## 2. 職責分配 (Responsibility Matrix)

| 類別 / 模組            | 職責 (Responsibilities)                                                                   |
| :--------------------- | :---------------------------------------------------------------------------------------- |
| **BacktestRunner**     | 主迴圈控制器。管理模擬時間與狀態轉移，驅動整個回測流程。                                  |
| **BacktestDataLoader** | 負責讀取本地的 K 線、VIX、PB 歷史資料 JSON/CSV，並提供緩衝查詢 API。                      |
| **AccountSimulator**   | 模擬券商帳戶行為。管理 `qty0050`, `qty00675L`, `totalLoan`, `cash`；計算融資利息與稅費。  |
| **StrategyAdapter**    | 對接 `strategyEngine`。將 `StrategyEngine` 的輸出轉換為 `AccountSimulator` 可執行的訂單。 |
| **MetricsCollector**   | 記錄每日淨值、槓桿比、回撤 (Drawdown)、Sharpe Ratio 等績效指標。                          |

---

## 3. 實作原型建議 (Implementation Blueprint)

建議路徑：`src/modules/backtest/backtestEngine.mjs`

### 核心類別結構

```javascript
class BacktestEngine {
  constructor(config) {
    this.portfolio = {
      qtyZ2: 0,
      qty0050: 0,
      totalLoan: 0,
      cash: config.initialCapital,
      lastBuyDate: null,
    };
    this.history = []; // 存儲每日快照
  }

  async run(startDate, endDate) {
    const data = await DataLoader.loadRange(startDate, endDate);

    for (const day of data) {
      // 1. 準備當日資料上下文
      const ctx = this.prepareMockContext(day, data);

      // 2. 指標計算 (使用現有邏輯)
      const signalCtx = buildSignalContext(ctx);

      // 3. 策略決策 (需要 Mock archiveManager)
      const decision = await strategyEngine.buildDecision(
        signalCtx.signalData,
        strategy,
        leverageResult,
      );

      // 4. 執行交易
      this.executeDecision(decision, day);

      // 5. 結算當日績效 (含利息支出)
      this.settleDaily(day);
    }

    return Reporter.generate(this.history);
  }
}
```

---

## 4. 如何與現有 Engine 整合而不重寫邏輯

由於 `strategyEngine.mjs` 目前直接引用了 `archiveManager` 行為，為了支援回測而不改動原始碼，有兩種方案：

### 方案 A：Dependency Swapping (推薦)

修改 `strategyEngine.mjs` 接受一個可選的 `dataService` 參數，如果未傳入則預設使用 `archiveManager`。

```javascript
// strategyEngine.mjs 修改建議
export async function buildDecision(ctx, strategy, ..., services = { archiveManager }) {
  // ... 原本 call archiveManager 的地方改用 services.archiveManager
  const highsSince = await services.archiveManager.getHighsSince(buyDate);
}
```

### 方案 B：Global Mocking (快速原型)

在回測啟動腳本中，暫時取代 `archiveManager` 的方法。

```javascript
// backtestLauncher.mjs
import { archiveManager } from "../data/archiveManager.mjs";

// 攔截並覆蓋
archiveManager.getHighsSince = (date) => {
  return myBacktestDataLoader.getHighsInRange(date, currentSimDate);
};
```

---

## 5. 待開發清單

1. `prepareBacktestData.mjs`: 一個腳本，用於將 `historyProvider` 抓取的碎片資料整合成一個連續的 `historical_timeline.json`。
2. `backtestEngine.mjs`: 實作上述主迴圈與帳戶模擬。
3. `performanceReporter.mjs`: 輸出 MD 或網頁圖表。
