import ti from "technicalindicators";

const { RSI, MACD, Stochastic } = ti;

/**
 * 由歷史日線資料計算 RSI / MACD / KD。
 * history item: { date, open, high, low, close, volume }
 */
export function calculateIndicators(history) {
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

export function last2(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  return [arr[arr.length - 2], arr[arr.length - 1]];
};

export function crossUpLevel(arr, level) {
  const v = last2(arr);
  if (!v) return false;
  const [prev, curr] = v;
  return Number.isFinite(prev) && Number.isFinite(curr) && prev < level && curr >= level;
};

export function crossDownLevel(arr, level) {
  const v = last2(arr);
  if (!v) return false;
  const [prev, curr] = v;
  return Number.isFinite(prev) && Number.isFinite(curr) && prev >= level && curr < level;
};

export function macdCrossUp(macdArr) {
  const v = last2(macdArr);
  if (!v) return false;
  const [prev, curr] = v;
  return prev.MACD <= prev.signal && curr.MACD > curr.signal && curr.histogram > 0;
};

export function macdCrossDown(macdArr) {
  const v = last2(macdArr);
  if (!v) return false;
  const [prev, curr] = v;
  return prev.MACD >= prev.signal && curr.MACD < curr.signal;
};

export function kdCrossDown(kdArr) {
  const v = last2(kdArr);
  if (!v) return false;
  const [prev, curr] = v;
  return prev.k >= prev.d && curr.k < curr.d; // 死叉
};