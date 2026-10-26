/**
 * Market Regime Model — 計算 μ (預期報酬率) 與 σ (波動率)
 * 純函數，無 I/O，可獨立測試
 */

/**
 * 計算對數報酬率序列
 * @param {Array<number|null|undefined>} prices - 價格陣列（含 null/undefined 會被過濾）
 * @returns {number[]} 對數報酬率陣列，長度 = 有效價格數 - 1
 */
export function calculateLogReturns(prices) {
  if (!Array.isArray(prices) || prices.length < 2) {
    return [];
  }

  const validPrices = prices.filter(
    (p) => typeof p === "number" && Number.isFinite(p) && p > 0,
  );

  if (validPrices.length < 2) {
    return [];
  }

  const returns = [];
  for (let i = 1; i < validPrices.length; i++) {
    returns.push(Math.log(validPrices[i] / validPrices[i - 1]));
  }
  return returns;
}

/**
 * 將日頻均值與標準差年化
 * @param {number} mean - 日對數報酬率平均
 * @param {number} std - 日對數報酬率標準差
 * @param {number} periodsPerYear - 每年期數（預設 252 交易日）
 * @returns {{mu: number, sigma: number}} 年化 μ、σ
 */
export function annualize(mean, std, periodsPerYear = 252) {
  return {
    mu: mean * periodsPerYear,
    sigma: std * Math.sqrt(periodsPerYear),
  };
}

/**
 * 簡易機制偵測：依 μ 正負與閾值分三態
 * @param {number} mu - 年化預期報酬率
 * @returns {"BULL"|"BEAR"|"NEUTRAL"}
 */
export function detectRegime(mu) {
  const BULL_THRESHOLD = 0.05; // 5% 年化
  const BEAR_THRESHOLD = -0.05;

  if (mu > BULL_THRESHOLD) return "BULL";
  if (mu < BEAR_THRESHOLD) return "BEAR";
  return "NEUTRAL";
}

/**
 * 核心介面：從價格歷史計算 μ、σ、機制
 * @param {Object} opts
 * @param {Array<{date: string, close: number|null}>} opts.prices - 歷史收盤價，含 date、close
 * @param {number} [opts.minDays=60] - 最小有效樣本天數
 * @returns {Object} MarketRegimeOutput
 */
export function calculateMuSigma({ prices, minDays = 60 }) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      mu: null,
      sigma: null,
      regime: null,
      asOf: new Date().toISOString(),
      sampleDays: 0,
    };
  }

  // 提取有效收盤價與對應日期
  const validEntries = prices
    .map((p) => ({ date: p?.date, close: p?.close }))
    .filter(
      (e) =>
        typeof e.close === "number" &&
        Number.isFinite(e.close) &&
        e.close > 0 &&
        e.date,
    );

  if (validEntries.length < minDays) {
    const lastDate =
      validEntries.length > 0
        ? validEntries[validEntries.length - 1].date
        : null;
    return {
      status: "INSUFFICIENT_DATA",
      mu: null,
      sigma: null,
      regime: null,
      asOf: lastDate
        ? new Date(lastDate).toISOString()
        : new Date().toISOString(),
      sampleDays: validEntries.length,
    };
  }

  const closes = validEntries.map((e) => e.close);
  const returns = calculateLogReturns(closes);
  if (returns.length === 0) {
    const lastDate = validEntries[validEntries.length - 1]?.date;
    return {
      status: "INSUFFICIENT_DATA",
      mu: null,
      sigma: null,
      regime: null,
      asOf: lastDate
        ? new Date(lastDate).toISOString()
        : new Date().toISOString(),
      sampleDays: 0,
    };
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);

  const { mu, sigma } = annualize(mean, std);
  const regime = detectRegime(mu);

  const lastDate = validEntries[validEntries.length - 1]?.date;
  return {
    status: "OK",
    mu: Number(mu.toFixed(6)),
    sigma: Number(sigma.toFixed(6)),
    regime,
    asOf: lastDate
      ? new Date(lastDate).toISOString()
      : new Date().toISOString(),
    sampleDays: returns.length,
  };
}
