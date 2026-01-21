import ti from "technicalindicators";

const { RSI, MACD, Stochastic } = ti;

/**
 * 由歷史日線資料計算 RSI / MACD / KD。
 * history item: { date, open, high, low, close, volume }
 */
function calculateIndicators(history) {
  const closes = history.map((x) => x.close).filter(Boolean);
  const highs = history.map((x) => x.high).filter(Boolean);
  const lows = history.map((x) => x.low).filter(Boolean);

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

export { calculateIndicators };