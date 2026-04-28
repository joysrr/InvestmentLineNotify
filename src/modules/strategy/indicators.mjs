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

  const fastKD = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 9,
    signalPeriod: 3,
  });

  // Slow KD(9,3,3)：Slow K = SMA3(Fast %K)，Slow D = SMA3(Slow K)
  const fastKDK = fastKD.map((x) => x.k);
  const slowKFull = calcSMA(fastKDK, 3);
  const slowDFull = calcSMA(
    slowKFull.map((v) => (Number.isFinite(v) ? v : NaN)),
    3,
  );

  const kdArrSlow = fastKD
    .map((_, i) => ({ k: slowKFull[i], d: slowDFull[i] }))
    .filter((x) => Number.isFinite(x.k) && Number.isFinite(x.d));

  // ── Phase 0-4：MA / ATR / Slope 計算 ──────────────────────────────────────
  const ma20Arr = calcMA20(closes);
  const ma60Arr = calcMA60(closes);
  const atrArr = calcATR(highs, lows, closes, 14);
  const ma60Slope = calcSlopeN(ma60Arr, 5);
  const ma240Arr = calcMA240(closes);
  const ma240 = Number.isFinite(ma240Arr.at(-1)) ? ma240Arr.at(-1) : null;

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
    ma20Arr,
    ma60Arr,
    ma240Arr,
    ma240,
    atrArr,
    ma60Slope,
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
  return prev.MACD <= prev.signal && curr.MACD > curr.signal;
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
  if (![prev.k, prev.d, curr.k, curr.d].every(Number.isFinite)) return false;
  return prev.k >= prev.d && curr.k < curr.d; // 死叉
}

export function kdCrossUp(kdArr) {
  const v = last2(kdArr);
  if (!v) return false;
  const [prev, curr] = v;
  if (![prev.k, prev.d, curr.k, curr.d].every(Number.isFinite)) return false;
  return prev.k <= prev.d && curr.k > curr.d; // 黃金交叉
}

export function lastKD(kdArr) {
  if (!Array.isArray(kdArr) || kdArr.length === 0) return null;
  const last = kdArr.at(-1);
  if (!last || !Number.isFinite(last.k) || !Number.isFinite(last.d))
    return null;
  return last;
}

export function kdSeries(kdArr, picker) {
  return Array.isArray(kdArr) ? kdArr.map(picker).filter(Number.isFinite) : [];
}

export function getMACDSignal(macdResult) {
  if (!macdResult?.length) return "neutral";
  const last = macdResult[macdResult.length - 1];
  if (last.MACD > last.signal) return "bull";
  if (last.MACD < last.signal) return "bear";
  return "neutral";
}

/**
 * 通用簡單移動平均線（SMA）純函式。
 * 回傳與輸入等長的陣列，前 (period-1) 筆為 NaN（無足夠資料）。
 *
 * @param {number[]} prices - 收盤價（或任意數值）序列，由舊到新排列
 * @param {number}   period - 計算週期（必須為正整數）
 * @returns {number[]}
 */
export function calcSMA(prices, period) {
  if (!Array.isArray(prices) || period < 1 || !Number.isInteger(period)) {
    return [];
  }
  const result = new Array(prices.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i];
    if (i >= period) sum -= prices[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}
/**
 * MA20 — 20 日簡單移動平均線。
 * 回傳與輸入等長的陣列，前 19 筆為 NaN。
 *
 * @param {number[]} closes - 收盤價序列，由舊到新排列
 * @returns {number[]}
 */
export function calcMA20(closes) {
  return calcSMA(closes, 20);
}

/**
 * MA60 — 60 日簡單移動平均線。
 * 回傳與輸入等長的陣列，前 59 筆為 NaN。
 *
 * @param {number[]} closes - 收盤價序列，由舊到新排列
 * @returns {number[]}
 */
export function calcMA60(closes) {
  return calcSMA(closes, 60);
}

/**
 * MA240 — 240 日簡單移動平均線。
 * 回傳與輸入等長的陣列，前 239 筆為 NaN。
 *
 * @param {number[]} closes - 收盤價序列，由舊到新排列
 * @returns {number[]}
 */
export function calcMA240(closes) {
  return calcSMA(closes, 240);
}

/**
 * ATR（Average True Range）— 平均真實波幅。
 * True Range = max(high-low, |high-prevClose|, |low-prevClose|)
 * 回傳與輸入等長的陣列，第 0 筆及前 (period-1) 筆為 NaN。
 *
 * @param {number[]} highs   - 最高價序列，由舊到新排列
 * @param {number[]} lows    - 最低價序列，由舊到新排列
 * @param {number[]} closes  - 收盤價序列，由舊到新排列
 * @param {number}   period  - 計算週期（預設 14）
 * @returns {number[]}
 */
export function calcATR(highs, lows, closes, period = 14) {
  const len = closes.length;
  if (len < 2 || highs.length !== len || lows.length !== len) return [];

  const trArr = new Array(len).fill(NaN);
  for (let i = 1; i < len; i++) {
    const hl = highs[i] - lows[i];
    const hpc = Math.abs(highs[i] - closes[i - 1]);
    const lpc = Math.abs(lows[i] - closes[i - 1]);
    trArr[i] = Math.max(hl, hpc, lpc);
  }

  const atrArr = new Array(len).fill(NaN);
  // 第一個 ATR = 前 period 筆 TR 的簡單平均
  if (len <= period) return atrArr;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trArr[i];
  atrArr[period] = sum / period;
  // 之後採 Wilder 平滑（與 TradingView / technicalindicators 一致）
  for (let i = period + 1; i < len; i++) {
    atrArr[i] = (atrArr[i - 1] * (period - 1) + trArr[i]) / period;
  }
  return atrArr;
}

/**
 * HHV — 最近 N 根的最高高價（Highest High Value）。
 * 常用於計算移動停利的參考高點（前波高點）。
 * 回傳與輸入等長的陣列，前 (period-1) 筆為 NaN。
 *
 * @param {number[]} highs  - 最高價序列，由舊到新排列
 * @param {number}   period - 回顧週期（必須為正整數）
 * @returns {number[]}
 */
export function calcHHV(highs, period) {
  if (!Array.isArray(highs) || period < 1 || !Number.isInteger(period)) {
    return [];
  }
  const result = new Array(highs.length).fill(NaN);
  for (let i = period - 1; i < highs.length; i++) {
    let max = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (Number.isFinite(highs[j]) && highs[j] > max) max = highs[j];
    }
    result[i] = max === -Infinity ? NaN : max;
  }
  return result;
}
/**
 * calcSlopeN — MA 序列的 N 日簡單斜率。
 *
 * 計算方式：slope = (maArr[last] - maArr[last - lookback]) / lookback
 * 單位：每根 K 線的平均漲跌點數（與 MA 原始單位相同）。
 *
 * 使用情境：
 *   計畫 B latch 解鎖條件 3 — 判斷 MA60 是否「斜率向上」
 *   const slope = calcSlopeN(ma60Arr, 5);
 *   const isTrendingUp = slope > config.valuationGuard.latch.trendUnlockMa60SlopeThreshold;
 *
 * @param {number[]} maArr   - MA 序列（由 calcSMA / calcMA60 產生），由舊到新排列
 * @param {number}   lookback - 回顧根數（必須為正整數，預設 5）
 * @returns {number} slope 值；若資料不足或末端為 NaN 則回傳 NaN
 */
export function calcSlopeN(maArr, lookback = 5) {
  if (!Array.isArray(maArr) || !Number.isInteger(lookback) || lookback < 1) {
    return NaN;
  }
  const len = maArr.length;
  if (len < lookback + 1) return NaN;

  const curr = maArr[len - 1];
  const prev = maArr[len - 1 - lookback];

  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return NaN;

  return (curr - prev) / lookback;
}
