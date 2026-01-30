import ti from "technicalindicators";

const { RSI, MACD, Stochastic } = ti;

/**
 * 由歷史日線資料計算 RSI / MACD / KD。
 * history item: { date, open, high, low, close, volume }
 */
export function calculateIndicators(history) {
  const rows = history.filter(
    (x) =>
      Number.isFinite(x?.close) &&
      Number.isFinite(x?.high) &&
      Number.isFinite(x?.low),
  );

  const closes = rows.map((x) => x.close);
  const highs = rows.map((x) => x.high);
  const lows = rows.map((x) => x.low);

  function SMA(values, period) {
    if (values.length < period) return [];
    return values.slice(-values.length + period - 1).map((_, i) => {
      const slice = values.slice(i, i + period);
      return slice.reduce((a, b) => a + b, 0) / period;
    });
  }

  const fastKD = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 9,
    signalPeriod: 3,
  });

  // Slow KD(9,3,3)：Slow K = SMA3(Fast %K)，Slow D = SMA3(Slow K)
  const slowK = SMA(
    fastKD.map((x) => x.k),
    3,
  );
  const slowD = SMA(slowK, 3);

  const kdArrSlow = fastKD
    .map((_, i) => ({ k: slowK[i] ?? NaN, d: slowD[i] ?? NaN }))
    .filter((x) => Number.isFinite(x.k) && Number.isFinite(x.d));

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
    kdArr: kdArrSlow,
  };
}

export function last2(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  return [arr[arr.length - 2], arr[arr.length - 1]];
}

export function crossUpLevel(arr, level) {
  const v = last2(arr);
  if (!v) return false;
  const [prev, curr] = v;
  return (
    Number.isFinite(prev) &&
    Number.isFinite(curr) &&
    prev < level &&
    curr >= level
  );
}

export function crossDownLevel(arr, level) {
  const v = last2(arr);
  if (!v) return false;
  const [prev, curr] = v;
  return (
    Number.isFinite(prev) &&
    Number.isFinite(curr) &&
    prev >= level &&
    curr < level
  );
}

// 曾經 <= level（lookback內），且現在 > level
export function roseAboveAfterBelow(
  arr,
  level,
  lookback = 10,
  { requireCrossToday = false } = {},
) {
  if (!Array.isArray(arr) || arr.length < 2) return false;

  const curr = arr[arr.length - 1];
  const prev = arr[arr.length - 2];
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return false;

  // 現在必須在門檻上方（你要的「回升到上方」）
  if (!(curr > level)) return false;

  // lookback 內曾經在門檻下方/等於（代表「之前超賣/偏弱」）
  const start = Math.max(0, arr.length - 1 - lookback); // 不含curr那根
  let wasBelow = false;
  for (let i = start; i < arr.length - 1; i++) {
    const x = arr[i];
    if (Number.isFinite(x) && x <= level) {
      wasBelow = true;
      break;
    }
  }
  if (!wasBelow) return false;

  // 可選：一定要「今天剛上穿」才觸發，避免在門檻上方連續觸發多天
  if (requireCrossToday) return prev <= level && curr > level;

  return true;
}

// 曾經 >= level（lookback內），且現在 < level
export function fellBelowAfterAbove(
  arr,
  level,
  lookback = 10,
  { requireCrossToday = false } = {},
) {
  if (!Array.isArray(arr) || arr.length < 2) return false;

  const curr = arr[arr.length - 1];
  const prev = arr[arr.length - 2];
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return false;

  // 現在必須在門檻下方（你要的「回落到下方」）
  if (!(curr < level)) return false;

  // lookback 內曾經在門檻上方/等於（代表「之前過熱」）
  const start = Math.max(0, arr.length - 1 - lookback); // 不含curr那根
  let wasAbove = false;
  for (let i = start; i < arr.length - 1; i++) {
    const x = arr[i];
    if (Number.isFinite(x) && x >= level) {
      wasAbove = true;
      break;
    }
  }
  if (!wasAbove) return false;

  // 可選：一定要「今天剛跌破」才觸發，避免在門檻下方連續觸發多天
  if (requireCrossToday) return prev >= level && curr < level;

  // 不要求今天剛跌破：只要「曾經在上方，且目前在下方」就算回落成立
  return true;
}

// 共用：lookback 內「曾經 >= level」就算（KD/RSI/BIAS 都可用）
// - arr: number[] 或 any[]（搭配 selector）
// - level: 門檻值
// - lookback: 往回看幾根（含今天；你也可改成不含今天）
// - selector: 若 arr 不是 number[]，用它取值，例如 x => x.k
export function wasAboveLevel(arr, level, lookback = 10, selector = (x) => x) {
  if (!Array.isArray(arr) || arr.length === 0) return false;

  const end = arr.length; // 含最後一筆
  const start = Math.max(0, end - lookback);

  for (let i = start; i < end; i++) {
    const v = selector(arr[i]);
    if (Number.isFinite(v) && v >= level) return true;
  }
  return false;
}

export function wasBelowLevel(arr, level, lookback = 10, selector = (x) => x) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const end = arr.length;
  const start = Math.max(0, end - lookback);
  for (let i = start; i < end; i++) {
    const v = selector(arr[i]);
    if (Number.isFinite(v) && v <= level) return true;
  }
  return false;
}

export function macdCrossUp(macdArr) {
  const v = last2(macdArr);
  if (!v) return false;
  const [prev, curr] = v;
  return (
    prev.MACD <= prev.signal && curr.MACD > curr.signal && curr.histogram > 0
  );
}

export function macdCrossDown(macdArr) {
  const v = last2(macdArr);
  if (!v) return false;
  const [prev, curr] = v;
  return prev.MACD >= prev.signal && curr.MACD < curr.signal;
}

export function kdCrossDown(kdArr) {
  const v = last2(kdArr);
  if (!v) return false;
  const [prev, curr] = v;
  return prev.k >= prev.d && curr.k < curr.d; // 死叉
}

export function kdCrossUp(kdArr) {
  const v = last2(kdArr);
  if (!v) return false;
  const [prev, curr] = v;
  return prev.k <= prev.d && curr.k > curr.d; // 黃金交叉
}

export function lastKD(kdArr) {
  if (!Array.isArray(kdArr) || kdArr.length === 0) return null;
  const last = kdArr.at(-1);
  if (!last || !Number.isFinite(last.k) || !Number.isFinite(last.d)) return null;
  return last;
}

export function kdSeries(kdArr, picker) {
  return Array.isArray(kdArr) ? kdArr.map(picker).filter(Number.isFinite) : [];
}
