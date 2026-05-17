/**
 * InvestmentLineNotify 回測引擎原型 (Prototype)
 */

import { buildSignalContext } from "../src/domain/signalContext.mjs";
import * as strategyEngine from "../src/modules/strategy/strategyEngine.mjs";

class BacktestSimulator {
  constructor(initialCash = 1000000) {
    this.portfolio = {
      qtyZ2: 0,
      qty0050: 0,
      totalLoan: 0,
      cash: initialCash,
      lastBuyDate: null,
    };
    this.history = [];
  }

  /**
   * 模擬時間步進
   * @param {Array} historicalData - 包含每日收盤價、VIX、PB 的陣列
   */
  async runBacktest(historicalData, strategy) {
    console.log(`🚀 開始回測，共 ${historicalData.length} 個交易日`);

    for (let i = 60; i < historicalData.length; i++) {
      const today = historicalData[i];
      const lookbackData = historicalData.slice(0, i + 1);

      // 1. 建立 DailyRunContext (模擬當天環境)
      const mockContext = this.createMockDailyRunContext(today, lookbackData);

      // 2. 計算指標與帳戶快照
      // 注意：這裡的 lastState 會影響 signalContext 計算出的 z2Ratio 與維持率
      mockContext.lastState = this.getPortfolioSnapshot();
      const signalCtx = buildSignalContext(mockContext);

      // 3. 獲取決策建議
      // 注意：這裡可能需要處理 strategyEngine 對 archiveManager 的依賴 (見設計文件)
      const decision = await strategyEngine.buildDecision(
        signalCtx.signalData,
        strategy,
        { grossLeverage: signalCtx.signalData.actualLeverage },
      );

      // 4. 執行模擬交易
      this.executeSimulationTrade(decision, today);

      // 5. 記錄當日狀態
      this.recordProgress(today.date, signalCtx.signalData, decision);
    }

    return this.generateReport();
  }

  createMockDailyRunContext(today, slice) {
    // 映射歷史資料到 DailyRunContext 格式
    return {
      historyZ2: slice.map((d) => ({ date: d.date, close: d.closeZ2 })),
      history0050: slice.map((d) => ({ date: d.date, close: d.close0050 })),
      currentPriceZ2: today.closeZ2,
      price0050: today.close0050,
      vixData: { value: today.vix },
      vixArr: slice.map((d) => today.vix),
      pbRecords: slice.map((d) => d.pb),
      macroMarketDirection: today.macroDirection || "NEUTRAL",
      // ... 更多必要欄位
    };
  }

  getPortfolioSnapshot() {
    return { ...this.portfolio };
  }

  executeSimulationTrade(decision, today) {
    // 實作買入/賣出邏輯，更新 this.portfolio
    // 例如：如果 decision.target === '加碼買入'
    // this.portfolio.qtyZ2 += ...
    // this.portfolio.totalLoan += ...
  }

  recordProgress(date, signalData, decision) {
    this.history.push({
      date,
      netAsset: signalData.netAsset,
      leverage: signalData.actualLeverage,
      decision: decision.target,
    });
  }

  generateReport() {
    // 計算回報率、最大回檔等
    return {
      finalNetAsset: this.portfolio.cash + this.portfolio.qtyZ2 * 100, // 簡化計算
      totalDays: this.history.length,
    };
  }
}

export default BacktestSimulator;
