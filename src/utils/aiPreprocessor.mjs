/**
 * AI 數據預處理工具
 */

// 1. 策略預處理：刪除 UI 標籤與不相關的欄位
export function minifyStrategy(strategy) {
  return {
    buy: {
      minDrop: strategy.buy.minDropPercentToConsider,
      minScore: strategy.buy.minWeightScoreToBuy,
      // 僅保留數值，刪除 label
      rules: strategy.buy.dropScoreRules.map(r => ({ d: r.minDrop, s: r.score })),
      rsi: strategy.buy.rsi,
      kd: strategy.buy.kd,
      macd: strategy.buy.macd
    },
    // 配置表是決策核心，必須完整保留但簡化 key
    allocation: strategy.allocation.map(a => ({ s: a.minScore, l: a.leverage, c: a.cash })),
    // 門檻值僅保留關鍵數值
    threshold: {
      mmDanger: strategy.threshold.mmDanger,
      biasOverheat: strategy.threshold.bias240OverheatLevel,
      vixFear: strategy.threshold.vixHighFear,
      z2High: strategy.threshold.z2RatioHigh
    }
  };
}

// 2. 市場數據預處理：四捨五入並精簡 Key
export function minifyMarketData(marketData, portfolio) {
  const round = (val) => (typeof val === 'number' ? Math.round(val * 100) / 100 : val);

  return {
    price: {
      "0050": round(marketData.price0050),
      "00675L": round(marketData.currentPrice),
      bias240: round(marketData.bias240),
      drop: round(marketData.priceDropPercent)
    },
    tech: {
      rsi: round(marketData.RSI),
      k: round(marketData.KD_K),
      macd: marketData.macdStatus || 'N/A'
    },
    account: {
      mm: round(marketData.maintenanceMargin),
      z2Ratio: round(marketData.z2Ratio),
      cash: portfolio.cash,
      vix: round(marketData.VIX)
    }
  };
}
