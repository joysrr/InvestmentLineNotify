import { TwDate, toTwseStockNo, sleep } from "../../utils/coreUtils.mjs";
import { fetchStockDayMonthWithCache } from "./twseProvider.mjs";
import logger from "../../utils/logger.mjs";

/**
 * 具有自動回補功能的歷史資料抓取邏輯
 * 如果抓取的資料筆數不足 N 筆，會自動往更早的月份抓取，直到滿足為止。
 *
 * @param {string} symbol - 股票代號 (e.g. "0050.TW")
 * @param {number} minCount - 最少需要的資料筆數 (預設 60)
 * @param {string} endISO - 結束日期 (ISO格式, 預設今天)
 * @returns {Promise<Array>} 歷史資料陣列（相容舊呼叫者）
 */
export async function fetchStockHistoryWithAutoFill(
  symbol,
  minCount = 60,
  endISO = null,
) {
  const result = await fetchStockHistoryWithAutoFillDetailed(
    symbol,
    minCount,
    endISO,
  );
  return result.data;
}

/**
 * 回傳歷史資料與來源診斷資訊，供 dailyCheck 分類錯誤。
 * @returns {Promise<{status: string, data: Array, required: number, count: number, monthsProcessed: number, failedMonths: string[], lastError: string|null}>}
 */
export async function fetchStockHistoryWithAutoFillDetailed(
  symbol,
  minCount = 60,
  endISO = null,
  { maxMonths = 13, retryAttempts = 2, retryDelayMs = 2000 } = {},
) {
  const stockNo = toTwseStockNo(symbol);
  const end = endISO ? new Date(endISO) : new Date();
  end.setHours(23, 59, 59, 999);

  const allData = [];
  const processedMonths = new Set();
  const failedMonths = [];
  let lastError = null;
  let currentPtr = new Date(end.getFullYear(), end.getMonth(), 1);
  const currentMonthKey = TwDate().formatMonthKey();

  logger.info({ symbol, minCount }, "開始抓取歷史資料並自動回補");

  let safetyCounter = 0;
  while (allData.length < minCount && safetyCounter < maxMonths) {
    const yyyy = currentPtr.getFullYear();
    const mm = String(currentPtr.getMonth() + 1).padStart(2, "0");
    const monthKey = `${yyyy}${mm}`;
    const yyyymm01 = `${monthKey}01`;
    if (processedMonths.has(monthKey)) break;

    logger.debug({ symbol, monthKey }, "抓取月份資料");
    let rows;
    let monthError = null;
    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      try {
        rows = await fetchStockDayMonthWithCache(stockNo, yyyymm01);
        monthError = null;
        break;
      } catch (error) {
        monthError = error;
        lastError = error;
        if (attempt < retryAttempts && retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
      }
    }

    if (monthError) {
      const isEmptyCurrentMonth =
        monthKey === currentMonthKey &&
        monthError.message.includes("沒有符合條件的資料");
      if (isEmptyCurrentMonth) {
        lastError = null;
      } else {
        failedMonths.push(monthKey);
      }
    } else if (rows?.length) {
      const filteredRows = rows.filter((row) => new Date(row.date) <= end);
      for (const row of filteredRows) {
        if (!allData.some((data) => data.date === row.date)) allData.push(row);
      }
    }

    processedMonths.add(monthKey);
    if (monthKey === currentMonthKey) await sleep(1500);
    currentPtr.setMonth(currentPtr.getMonth() - 1);
    safetyCounter += 1;
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  const status =
    failedMonths.length > 0
      ? "source_unavailable"
      : allData.length < minCount
        ? "insufficient_history"
        : "available";

  const result = {
    status,
    data: allData,
    required: minCount,
    count: allData.length,
    monthsProcessed: safetyCounter,
    failedMonths,
    lastError: lastError?.message ?? null,
  };

  logger.info(
    { symbol, dataCount: result.count, monthsProcessed: safetyCounter, status },
    "歷史資料抓取完成",
  );
  if (status === "insufficient_history") {
    logger.warn(
      { symbol, count: result.count, minCount },
      "歷史資料筆數仍不足需求筆數",
    );
  }
  return result;
}
