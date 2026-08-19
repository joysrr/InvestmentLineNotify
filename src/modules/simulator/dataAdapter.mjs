// src/modules/simulator/dataAdapter.mjs
// latestReport + 價格 → SimulationInput (DEC-02, DEC-03, DEC-05, DEC-06, DEC-07, D2, D6, DEC-28)

import fs from "fs/promises";
import path from "path";
import { calculateIndicators } from "../strategy/indicators.mjs";
import { archiveManager } from "../data/archiveManager.mjs";
import {
  REQUIRED_HISTORY_MONTHS,
  HISTORY_CACHE_CONFIG,
  MA240_FALLBACK_THRESHOLDS,
  DATA_QUALITY_LABELS,
} from "./constants.mjs";

/** 記憶體快取: key -> { data: OHLCV[], mtime: number, expires: number } */
const historyCache = new Map();

/**
 * 取得股價歷史 (含快取 TTL + mtime 雙重檢查)
 * @param {string} stockNo - "0050" 或 "00675L"
 * @param {string} monthKey - "YYYYMM"
 * @returns {Promise<Array|null>} OHLCV 陣列或 null
 */
export async function getStockHistoryCached(stockNo, monthKey) {
  const cacheKey = `${stockNo}_${monthKey}`;
  const now = Date.now();
  const cached = historyCache.get(cacheKey);

  // 檢查快取是否有效 (TTL 未過期 且 檔案 mtime 未變更)
  if (cached && now < cached.expires) {
    try {
      const filePath = path.join(
        process.cwd(),
        "data",
        "stock_history",
        `${stockNo}_${monthKey}.json`,
      );
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs <= cached.mtime) {
        return cached.data;
      }
      // 檔案已更新，快取失效
      historyCache.delete(cacheKey);
    } catch {
      // 檔案不存在或 stat 失效，快取失效
      historyCache.delete(cacheKey);
    }
  }

  // 讀取檔案
  const data = await archiveManager.getStockHistory(stockNo, monthKey);
  if (data && Array.isArray(data)) {
    const filePath = path.join(
      process.cwd(),
      "data",
      "stock_history",
      `${stockNo}_${monthKey}.json`,
    );
    try {
      const stat = await fs.stat(filePath);
      historyCache.set(cacheKey, {
        data,
        mtime: stat.mtimeMs,
        expires: now + HISTORY_CACHE_CONFIG.TTL_MS,
      });
    } catch {
      // 無法取得 mtime，仍快取資料但不設 mtime (下次會重讀)
      historyCache.set(cacheKey, {
        data,
        mtime: 0,
        expires: now + HISTORY_CACHE_CONFIG.TTL_MS,
      });
    }
  }
  return data;
}

/**
 * 檢查必要月份是否完整
 * @param {string[]} monthKeys
 * @returns {Object} { complete: boolean, missing: string[] }
 */
export async function checkHistoryCompleteness(monthKeys, stockNo) {
  const missing = [];
  for (const monthKey of monthKeys) {
    const data = await getStockHistoryCached(stockNo, monthKey);
    if (!data || data.length === 0) {
      missing.push(monthKey);
    }
  }
  return { complete: missing.length === 0, missing };
}

/**
 * 合併多月份歷史為單一時序陣列 (由舊到新)
 * @param {string} stockNo
 * @param {string[]} monthKeys - 已排序
 * @returns {Promise<Array>} 合併後的 OHLCV 陣列
 */
export async function mergeMonthlyHistory(stockNo, monthKeys) {
  const allRows = [];
  for (const monthKey of monthKeys) {
    const monthData = await getStockHistoryCached(stockNo, monthKey);
    if (monthData && Array.isArray(monthData)) {
      allRows.push(...monthData);
    }
  }
  // 確保按日期排序 (舊到新)
  allRows.sort((a, b) => a.date.localeCompare(b.date));
  return allRows;
}

/**
 * 替換最新一根 K 棒的收盤價 (並調整 high/low)
 * @param {Array} history - OHLCV 陣列 (由舊到新)
 * @param {number} simulatedClose - 模擬收盤價
 * @returns {Array} 新的歷史陣列 (深層複製)
 */
export function replaceLastCandle(history, simulatedClose) {
  if (!history.length) return history;
  const newHistory = history.map((row) => ({ ...row })); // 深層複製
  const lastIdx = newHistory.length - 1;
  newHistory[lastIdx].close = simulatedClose;
  newHistory[lastIdx].high = Math.max(newHistory[lastIdx].high, simulatedClose);
  newHistory[lastIdx].low = Math.min(newHistory[lastIdx].low, simulatedClose);
  return newHistory;
}

/**
 * 計算 MA240 並套用分級 Fallback (DEC-06)
 * @param {number[]} closes
 * @returns {Object} { ma240Arr, ma240, quality }
 */
export function computeMA240WithFallback(closes) {
  const ma240Arr = calcMA240(closes); // 使用 indicators.mjs 的函式
  let ma240 = ma240Arr.at(-1);
  let quality = DATA_QUALITY_LABELS.OK;

  if (!Number.isFinite(ma240)) {
    // 分級 Fallback
    if (closes.length >= MA240_FALLBACK_THRESHOLDS.MA60_PROXY) {
      const ma60Arr = calcMA60(closes);
      ma240 = ma60Arr.at(-1);
      quality = DATA_QUALITY_LABELS.FALLBACK_USED;
    } else if (closes.length >= MA240_FALLBACK_THRESHOLDS.MA20_PROXY) {
      const ma20Arr = calcMA20(closes);
      ma240 = ma20Arr.at(-1);
      quality = DATA_QUALITY_LABELS.FALLBACK_USED;
    } else {
      ma240 = null;
      quality = DATA_QUALITY_LABELS.INSUFFICIENT_DATA;
    }
  }

  return { ma240Arr, ma240, ma240Quality: quality };
}

// 從 indicators.mjs 引入需要的計算函式 (避免循環依賴，這裡內聯核心邏輯)
function calcSMA(prices, period) {
  if (!Array.isArray(prices) || period < 1 || !Number.isInteger(period))
    return [];
  const result = new Array(prices.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i];
    if (i >= period) sum -= prices[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

function calcMA20(closes) {
  return calcSMA(closes, 20);
}
function calcMA60(closes) {
  return calcSMA(closes, 60);
}
function calcMA240(closes) {
  return calcSMA(closes, 240);
}

/**
 * 建構模擬輸入資料
 * @param {Object} latestReport - 最新戰報
 * @param {number} simulatedPrice0050 - 模擬 0050 價格
 * @param {number} [simulatedPriceZ2] - 模擬 00675L 價格 (選填，預設同比例)
 * @returns {Promise<Object>} SimulationInput
 */
export async function buildSimulationInput(
  latestReport,
  simulatedPrice0050,
  simulatedPriceZ2 = null,
) {
  // 1. 確定模擬價格
  const currentPrice0050 = Number(latestReport.price0050);
  const currentPriceZ2 = Number(latestReport.currentPrice);
  const priceRatio = currentPriceZ2 / currentPrice0050;

  const finalPrice0050 = Number(simulatedPrice0050);
  const finalPriceZ2 =
    simulatedPriceZ2 !== null
      ? Number(simulatedPriceZ2)
      : finalPrice0050 * priceRatio; // DEC-01, DEC-08: 同比例聯動

  // 2. 取得必要月份 key (最近 13 個月)
  const now = new Date();
  const monthKeys = [];
  for (let i = 0; i < REQUIRED_HISTORY_MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  monthKeys.reverse(); // 由舊到新

  // 3. 檢查歷史資料完整性 (DEC-05: 嚴格模式)
  const [check0050, checkZ2] = await Promise.all([
    checkHistoryCompleteness(monthKeys, "0050"),
    checkHistoryCompleteness(monthKeys, "00675L"),
  ]);

  if (!check0050.complete || !checkZ2.complete) {
    const missing = [...check0050.missing, ...checkZ2.missing].join(", ");
    throw new Error(`HISTORY_INCOMPLETE: 缺少歷史資料月份: ${missing}`);
  }

  // 4. 合併歷史並替換最新收盤價
  const [history0050, historyZ2] = await Promise.all([
    mergeMonthlyHistory("0050", monthKeys),
    mergeMonthlyHistory("00675L", monthKeys),
  ]);

  const simulatedHistory0050 = replaceLastCandle(history0050, finalPrice0050);
  const simulatedHistoryZ2 = replaceLastCandle(historyZ2, finalPriceZ2);

  // 5. 完整重新計算所有指標 (DEC-07: 復用現有 calculateIndicators)
  const indicators0050 = calculateIndicators(simulatedHistory0050);
  const indicatorsZ2 = calculateIndicators(simulatedHistoryZ2);

  // 6. MA240 分級 Fallback (DEC-06)
  const { ma240Arr, ma240, ma240Quality } = computeMA240WithFallback(
    indicatorsZ2.closes,
  );

  // 7. 建構 SimulationInput
  const simulationInput = {
    // 價格欄位
    currentPrice: finalPriceZ2,
    price0050: finalPrice0050,
    basePrice: Number(latestReport.basePrice),

    // 價格序列 (00675L 為主，策略引擎主要用此)
    closeArr: indicatorsZ2.closes,
    highArr: indicatorsZ2.highs,
    lowArr: indicatorsZ2.lows,
    closeArr0050: indicators0050.closes, // DEC-03: 必填 0050 獨立指標

    // 指標陣列
    ma20Arr: indicatorsZ2.ma20Arr,
    ma60Arr: indicatorsZ2.ma60Arr,
    ma240Arr,
    ma60SlopeArr: indicatorsZ2.ma60Slope,
    macdArr: indicatorsZ2.macdArr,
    kdArr: indicatorsZ2.kdArr,
    rsiArr: indicatorsZ2.rsiArr,
    atrArr: indicatorsZ2.atrArr,
    vixArr: latestReport.vixArr || [],

    // 最新指標單值 (供策略引擎直接使用，避免其自行計算)
    RSI: indicatorsZ2.rsiArr.at(-1) ?? null,
    KD_K: indicatorsZ2.kdArr.length > 0 ? indicatorsZ2.kdArr.at(-1).k : null,
    KD_D: indicatorsZ2.kdArr.length > 0 ? indicatorsZ2.kdArr.at(-1).d : null,
    MACD: indicatorsZ2.macdArr.length > 0 ? indicatorsZ2.macdArr.at(-1) : null,
    bias240: ma240,

    // 投資組合 (不變)
    portfolio: { ...latestReport.portfolio },

    // 市場環境 (不變)
    VIX: Number(latestReport.VIX),
    macroMarketDirection: latestReport.macroMarketDirection || "NEUTRAL",
    indicators0050: {
      rsiArr: indicators0050.rsiArr,
      kdArr: indicators0050.kdArr,
      macdArr: indicators0050.macdArr,
      ma20Arr: indicators0050.ma20Arr,
      ma60Arr: indicators0050.ma60Arr,
      ma240: indicators0050.ma240,
      atrArr: indicators0050.atrArr,
    },

    // 原始資料 (不變)
    rawValuation:
      latestReport.rawValuation || latestReport.marketState?.valuation || {},
    rawUsMarket: latestReport.rawUsMarket || {},
    rawCnn:
      latestReport.rawCnn ||
      (Number.isFinite(latestReport.marketState?.sentiment?.cnnScore)
        ? { score: latestReport.marketState.sentiment.cnnScore }
        : {}),
    rawMargin: latestReport.rawMargin || {},
    rawFx: latestReport.rawFx || {},
    liveBaseline: {
      rawMargin: latestReport.rawMargin || {},
      rawFx: latestReport.rawFx || {},
      marginPolicy: "recalculate_from_simulated_portfolio",
      fxPolicy: "not_applied",
    },

    // 歷史記錄 (不變)
    pbRecords: latestReport.pbRecords || [],
    pbRecordsObjects: latestReport.pbRecordsObjects || [],
    valuationGuardState: latestReport.valuationGuardState || {},
    institutionalNet: Number.isFinite(Number(latestReport.institutionalNet))
      ? Number(latestReport.institutionalNet)
      : Number.isFinite(latestReport.macroData?.rawInstitutional?.totalNetBuy)
        ? latestReport.macroData.rawInstitutional.totalNetBuy / 1_000_000
        : 0,
    institutionalHistory: latestReport.institutionalHistory || [],

    // 模擬日期
    date: latestReport.date || new Date().toISOString().split("T")[0],

    // 資料品質標籤
    dataQuality: {
      ma240: ma240Quality,
      rsi:
        indicatorsZ2.rsiArr.length >= 14
          ? DATA_QUALITY_LABELS.OK
          : DATA_QUALITY_LABELS.INSUFFICIENT_DATA,
      kd:
        indicatorsZ2.kdArr.length >= 9
          ? DATA_QUALITY_LABELS.OK
          : DATA_QUALITY_LABELS.INSUFFICIENT_DATA,
      macd:
        indicatorsZ2.macdArr.length >= 26
          ? DATA_QUALITY_LABELS.OK
          : DATA_QUALITY_LABELS.INSUFFICIENT_DATA,
      ma20:
        indicatorsZ2.ma20Arr.filter(Number.isFinite).length >= 20
          ? DATA_QUALITY_LABELS.OK
          : DATA_QUALITY_LABELS.INSUFFICIENT_DATA,
      ma60:
        indicatorsZ2.ma60Arr.filter(Number.isFinite).length >= 60
          ? DATA_QUALITY_LABELS.OK
          : DATA_QUALITY_LABELS.INSUFFICIENT_DATA,
      atr:
        indicatorsZ2.atrArr.filter(Number.isFinite).length >= 14
          ? DATA_QUALITY_LABELS.OK
          : DATA_QUALITY_LABELS.INSUFFICIENT_DATA,
    },
  };

  return simulationInput;
}

/**
 * 取得最新戰報並驗證可用性
 * @returns {Promise<Object>} latestReport (含扁平化必要欄位供 simulator 使用)
 */
export async function getValidatedLatestReport() {
  const report = await archiveManager.getLatestReport();
  if (!report) {
    throw new Error("REPORT_EXPIRED: 無最新戰報資料");
  }
  // 檢查戰報時效性 (24小時內)
  const reportDate = new Date(report.date).getTime();
  const now = Date.now();
  if (now - reportDate > 24 * 60 * 60 * 1000) {
    throw new Error("REPORT_EXPIRED: 最新戰報超過 24 小時");
  }
  // 檢查必要欄位 (報告現在直接包含扁平化欄位)
  const required = {
    price0050: report.price0050,
    currentPrice: report.currentPrice,
    portfolio: report.portfolio,
    VIX: report.VIX,
  };
  for (const [field, value] of Object.entries(required)) {
    if (value === undefined || value === null) {
      throw new Error(`DATA_NOT_READY: 戰報缺少必要欄位 ${field}`);
    }
  }
  return report;
}

/** 清除快取 (測試用) */
export function clearHistoryCache() {
  historyCache.clear();
}

/** 取得快取統計 (除錯用) */
export function getCacheStats() {
  return {
    size: historyCache.size,
    keys: Array.from(historyCache.keys()),
  };
}
