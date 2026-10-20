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
export function parseTaifexSmallTxMarketOiRows({ rows = [] } = {}) {
  const totalOi = (Array.isArray(rows) ? rows : [])
    .filter(
      (row) =>
        row?.契約 === "MTX" && String(row?.交易時段 ?? "").trim() === "一般",
    )
    .map((row) => Number(row?.未沖銷契約數))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);

  return {
    totalOi: totalOi > 0 ? totalOi : null,
    dataStatus: totalOi > 0 ? "VERIFIED" : "UNAVAILABLE",
  };
}

export function parseTaifexInstitutionalOiRows({
  rows = [],
  totalLongOi = null,
  totalShortOi = null,
} = {}) {
  const institutionalRows = Array.isArray(rows)
    ? rows.filter((row) => row?.商品名稱 === "小型臺指期貨")
    : [];
  const institutionalNetOi = institutionalRows.reduce(
    (sum, row) => sum + (Number(row?.多空未平倉口數淨額) || 0),
    0,
  );
  const hasDirectionalTotal =
    Number.isFinite(Number(totalLongOi)) &&
    Number.isFinite(Number(totalShortOi)) &&
    Number(totalLongOi) > 0 &&
    Number(totalShortOi) > 0;
  const totalDirectionalOi = hasDirectionalTotal
    ? Number(totalLongOi) + Number(totalShortOi)
    : null;
  const rsr = totalDirectionalOi
    ? Number(((-institutionalNetOi / totalDirectionalOi) * 100).toFixed(2))
    : null;

  return {
    institutionalNetOi:
      institutionalRows.length > 0 ? institutionalNetOi : null,
    totalDirectionalOi,
    rsr,
    dataStatus: totalDirectionalOi ? "VERIFIED" : "INSUFFICIENT_TOTAL_OI",
  };
}

export async function fetchTaifexOfficialRetailSentiment({
  dateStr = new Date().toISOString().slice(0, 10),
  marketRowsFetcher,
  institutionalRowsFetcher,
} = {}) {
  try {
    const [marketResult, institutionalResult] = await Promise.all([
      marketRowsFetcher(dateStr),
      institutionalRowsFetcher(dateStr),
    ]);
    const market = parseTaifexSmallTxMarketOiRows(marketResult);
    const institutional = parseTaifexInstitutionalOiRows(institutionalResult);
    const totalOi = market.totalOi;
    const rsr =
      totalOi && institutional.institutionalNetOi !== null
        ? Number(
            ((-institutional.institutionalNetOi / totalOi) * 100).toFixed(2),
          )
        : null;

    return {
      totalOi,
      institutionalNetOi: institutional.institutionalNetOi,
      retailNetOi:
        institutional.institutionalNetOi === null
          ? null
          : -institutional.institutionalNetOi,
      rsr,
      dataStatus: rsr === null ? "UNAVAILABLE" : "VERIFIED",
    };
  } catch (err) {
    logger.warn(`[taifexProvider] 合併官方 RSR 資料失敗: ${err.message}`);
    return {
      totalOi: null,
      institutionalNetOi: null,
      retailNetOi: null,
      rsr: null,
      dataStatus: "SOURCE_UNAVAILABLE",
      isFallback: true,
    };
  }
}

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
export function parseTaifexSessionQuotes({ rows = [] } = {}) {
  const validRows = Array.isArray(rows)
    ? rows.filter((row) => row && row.契約 === "MTX")
    : [];
  const deliveryMonth = String(validRows[0]?.["到期月份(週別)"] ?? "").trim();
  const dayRow = validRows.find(
    (row) => String(row.交易時段 ?? "").trim() === "一般",
  );
  const nightRow = validRows.find(
    (row) => String(row.交易時段 ?? "").trim() === "盤後",
  );
  const daySessionClose = toPositiveNumber(dayRow?.收盤價);
  const close = toPositiveNumber(nightRow?.收盤價);
  const hasBothSessions = daySessionClose !== null && close !== null;

  return {
    contract: "MTX",
    deliveryMonth: deliveryMonth || null,
    daySessionClose,
    close,
    dayToNightChangePct: hasBothSessions
      ? (close - daySessionClose) / daySessionClose
      : null,
    dataStatus: hasBothSessions ? "VERIFIED" : "UNAVAILABLE",
  };
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function fetchTaifexOfficialInstitutionalOiRows({
  dateStr = new Date().toISOString().slice(0, 10),
  requestFn = null,
} = {}) {
  const formattedDate = dateStr.replaceAll("-", "/");
  const request = {
    endpoint: "https://www.taifex.com.tw/cht/3/futContractsDateDown",
    fields: {
      queryStartDate: formattedDate,
      queryEndDate: formattedDate,
      commodityId: "MXF",
    },
  };
  const response =
    typeof requestFn === "function"
      ? await requestFn(request)
      : await fetch(request.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "InvestmentLineNotify/2.0",
          },
          body: new URLSearchParams(request.fields),
        });

  if (!response?.ok) {
    throw new Error(
      `TAIFEX futContractsDateDown HTTP ${response?.status ?? "unknown"}`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const big5Text = new TextDecoder("big5").decode(bytes);
  const text = big5Text.includes("商品名稱")
    ? big5Text
    : new TextDecoder().decode(bytes);
  return { rows: parseTaifexCsv(text) };
}

export async function fetchTaifexOfficialSessionRows({
  dateStr = new Date().toISOString().slice(0, 10),
  requestFn = null,
} = {}) {
  const formattedDate = dateStr.replaceAll("-", "/");
  const request = {
    endpoint: "https://www.taifex.com.tw/cht/3/futDataDown",
    fields: {
      down_type: "1",
      commodity_id: "MTX",
      queryStartDate: formattedDate,
      queryEndDate: formattedDate,
    },
  };
  const response =
    typeof requestFn === "function"
      ? await requestFn(request)
      : await fetch(request.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "InvestmentLineNotify/2.0",
          },
          body: new URLSearchParams(request.fields),
        });

  if (!response?.ok) {
    throw new Error(`TAIFEX futDataDown HTTP ${response?.status ?? "unknown"}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const big5Text = new TextDecoder("big5").decode(bytes);
  const text = big5Text.includes("契約")
    ? big5Text
    : new TextDecoder().decode(bytes);
  return { rows: parseTaifexCsv(text) };
}

function parseTaifexCsv(text) {
  const lines = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [
        header.trim(),
        values[index]?.trim() ?? "",
      ]),
    );
  });
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

export function parseTaifexNightQuote({
  close = 0,
  referencePrice = 0,
  daySessionClose = 0,
} = {}) {
  const safeClose = Number(close) || 0;
  const safeRef = Number(referencePrice) || 0;
  const safeDayClose = Number(daySessionClose) || 0;
  const hasValidClose = safeClose > 0;
  const hasValidReference = safeRef > 0;
  const hasValidDayClose = safeDayClose > 0;

  return {
    close: safeClose,
    referencePrice: safeRef,
    daySessionClose: hasValidDayClose ? safeDayClose : null,
    change: hasValidClose && hasValidReference ? safeClose - safeRef : null,
    changePct:
      hasValidClose && hasValidReference
        ? (safeClose - safeRef) / safeRef
        : null,
    dayToNightChangePct:
      hasValidClose && hasValidDayClose
        ? (safeClose - safeDayClose) / safeDayClose
        : null,
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
  marketRequestFn = null,
  institutionalRequestFn = null,
} = {}) {
  if (_sentimentCache.has(dateStr)) {
    return _sentimentCache.get(dateStr);
  }

  try {
    if (typeof fetcherFn === "function") {
      const parsed = parseTaifexSmallTxOi(await fetcherFn(dateStr));
      _sentimentCache.set(dateStr, parsed);
      return parsed;
    }

    const result = await fetchTaifexOfficialRetailSentiment({
      dateStr,
      marketRowsFetcher: (date) =>
        fetchTaifexOfficialSessionRows({
          dateStr: date,
          requestFn: marketRequestFn,
        }),
      institutionalRowsFetcher: (date) =>
        fetchTaifexOfficialInstitutionalOiRows({
          dateStr: date,
          requestFn: institutionalRequestFn,
        }),
    });
    _sentimentCache.set(dateStr, result);
    return result;
  } catch (err) {
    logger.warn(
      `[taifexProvider] 取得小台指散戶未平倉失敗 (${dateStr}): ${err.message}`,
    );
    return {
      totalOi: null,
      institutionalNetOi: null,
      retailNetOi: null,
      rsr: null,
      dataStatus: "SOURCE_UNAVAILABLE",
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
export async function fetchTaifexNightSession({
  dateStr = new Date().toISOString().slice(0, 10),
  fetcherFn = null,
  requestFn = null,
} = {}) {
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
      rawQuote = await fetchTaifexOfficialSessionRows({ dateStr, requestFn });
    }

    const parsed = Array.isArray(rawQuote?.rows)
      ? parseTaifexSessionQuotes(rawQuote)
      : parseTaifexNightQuote(rawQuote);
    _nightCache = {
      data: parsed,
      timestamp: now,
    };
    return parsed;
  } catch (err) {
    logger.warn(`[taifexProvider] 取得台指夜盤行情失敗: ${err.message}`);
    return {
      close: null,
      referencePrice: null,
      daySessionClose: null,
      change: null,
      changePct: null,
      dayToNightChangePct: null,
      dataStatus: "SOURCE_UNAVAILABLE",
      isFallback: true,
    };
  }
}
