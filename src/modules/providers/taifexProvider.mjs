/**
 * @file taifexProvider.mjs
 * @description 台灣期貨交易所 (TAIFEX) 數據採集層
 * 負責採集與解析小台指三大法人與全市場未平倉量 (計算 RSR) 及台指期夜盤即時行情。
 */

import logger from "../../utils/logger.mjs";

// 記憶體快取
const _sentimentCache = new Map();
let _nightCache = {
  data: null,
  timestamp: 0,
};

/**
 * 清除快取 (用於測試或強制重載)
 */
export function clearTaifexCache() {
  _sentimentCache.clear();
  _nightCache = {
    data: null,
    timestamp: 0,
  };
}

/**
 * 解析小台指未平倉數據
 * @param {Object} input
 * @param {number} input.totalOi - 小台全市場未平倉總口數
 * @param {number} input.dealersNetOi - 自營商小台淨留倉口數
 * @param {number} input.sitcNetOi - 投信小台淨留倉口數
 * @param {number} input.finetNetOi - 外資小台淨留倉口數
 * @returns {Object} { totalOi, institutionalNetOi, retailNetOi, rsr }
 */
export function parseTaifexSmallTxOi({
  totalOi = 0,
  dealersNetOi = 0,
  sitcNetOi = 0,
  finetNetOi = 0,
} = {}) {
  const safeTotalOi = Math.max(0, Number(totalOi) || 0);
  const instNet =
    (Number(dealersNetOi) || 0) +
    (Number(sitcNetOi) || 0) +
    (Number(finetNetOi) || 0);
  const retailNet = instNet === 0 ? 0 : -instNet;

  const rsr = safeTotalOi > 0 ? (retailNet / safeTotalOi) * 100 : 0;

  return {
    totalOi: safeTotalOi,
    institutionalNetOi: instNet,
    retailNetOi: retailNet,
    rsr: Number(rsr.toFixed(2)),
  };
}

/**
 * 解析台指期夜盤報價
 * @param {Object} input
 * @param {number} input.close - 當前或最新收盤價
 * @param {number} input.referencePrice - 昨收參考價
 * @returns {Object} { close, referencePrice, change, changePct }
 */
export function parseTaifexNightQuote({ close = 0, referencePrice = 0 } = {}) {
  const safeClose = Number(close) || 0;
  const safeRef = Number(referencePrice) || 0;

  if (safeRef <= 0 || safeClose <= 0) {
    return {
      close: safeClose,
      referencePrice: safeRef,
      change: 0,
      changePct: 0,
    };
  }

  const change = safeClose - safeRef;
  const changePct = change / safeRef;

  return {
    close: safeClose,
    referencePrice: safeRef,
    change,
    changePct,
  };
}

/**
 * 取得小台指散戶多空比數據 (支援快取與網路失敗安全降級)
 * @param {Object} options
 * @param {string} [options.dateStr] - 日期 YYYY-MM-DD
 * @param {Function} [options.fetcherFn] - 自訂數據取得函數 (依賴注入)
 * @returns {Promise<Object>}
 */
export async function fetchTaifexSmallTxRetailSentiment({
  dateStr = new Date().toISOString().slice(0, 10),
  fetcherFn = null,
} = {}) {
  // 1. 命中快取
  if (_sentimentCache.has(dateStr)) {
    return _sentimentCache.get(dateStr);
  }

  try {
    let rawData = null;
    if (typeof fetcherFn === "function") {
      rawData = await fetcherFn(dateStr);
    } else {
      // 預設兜底 (若無外部注入 fetcher)
      rawData = { totalOi: 0, dealersNetOi: 0, sitcNetOi: 0, finetNetOi: 0 };
    }

    const parsed = parseTaifexSmallTxOi(rawData);
    _sentimentCache.set(dateStr, parsed);
    return parsed;
  } catch (err) {
    logger.warn(
      `[taifexProvider] 取得小台指散戶未平倉失敗 (${dateStr}): ${err.message}`,
    );
    // 安全降級兜底，不讓主流程中斷
    return {
      totalOi: 0,
      institutionalNetOi: 0,
      retailNetOi: 0,
      rsr: 0,
      isFallback: true,
    };
  }
}

/**
 * 取得台指夜盤行情 (支援快取與安全降級)
 * @param {Object} options
 * @param {Function} [options.fetcherFn] - 自訂數據取得函數
 * @returns {Promise<Object>}
 */
export async function fetchTaifexNightSession({ fetcherFn = null } = {}) {
  const now = Date.now();
  // 快取 60 秒
  if (_nightCache.data && now - _nightCache.timestamp < 60000) {
    return _nightCache.data;
  }

  try {
    let rawQuote = null;
    if (typeof fetcherFn === "function") {
      rawQuote = await fetcherFn();
    } else {
      rawQuote = { close: 0, referencePrice: 0 };
    }

    const parsed = parseTaifexNightQuote(rawQuote);
    _nightCache = {
      data: parsed,
      timestamp: now,
    };
    return parsed;
  } catch (err) {
    logger.warn(`[taifexProvider] 取得台指夜盤行情失敗: ${err.message}`);
    return {
      close: 0,
      referencePrice: 0,
      change: 0,
      changePct: 0,
      isFallback: true,
    };
  }
}
