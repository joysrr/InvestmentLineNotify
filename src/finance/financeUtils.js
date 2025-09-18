const yahooFinance = require("yahoo-finance2").default;
const { RSI, MACD, Stochastic } = require("technicalindicators");

// 將 Yahoo Finance 回傳資料轉格式
function convertToHistoricalResult(chartResult) {
  return chartResult.quotes
    .map((quote) => ({
      ...quote,
      open: quote.open || null,
      high: quote.high || null,
      low: quote.low || null,
      close: quote.close || null,
      volume: quote.volume || null,
    }))
    .filter((dq) => dq.low !== null || dq.high !== null);
}

// 取得技術指標計算結果
function calculateIndicators(history) {
  const closes = history.map((item) => item.close).filter(Boolean);
  const highs = history.map((item) => item.high).filter(Boolean);
  const lows = history.map((item) => item.low).filter(Boolean);
  return {
    closes,
    highs,
    lows,
    rsiArr: RSI.calculate({ values: closes, period: 14 }),
    macdArr: MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }),
    kdArr: Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 9,
      signalPeriod: 3,
    }),
  };
}

async function fetchStockHistory(symbol, period1, period2) {
  const chartResult = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval: "1d",
  });
  return convertToHistoricalResult(chartResult);
}

module.exports = {
  fetchStockHistory,
  calculateIndicators,
};
