import {
  TwDate,
  toTwseStockNo,
  enumerateMonths,
  sleep,
} from "../../utils/coreUtils.mjs";
import { fetchStockDayMonthWithCache } from "./twseProvider.mjs";
import logger from "../../utils/logger.mjs";

/**
 * 具有自動回補功能的歷史資料抓取邏輯
 * 如果抓取的資料筆數不足 N 筆，會自動往更早的月份抓取，直到滿足為止。
 *
 * @param {string} symbol - 股票代號 (e.g. "0050.TW")
 * @param {number} minCount - 最少需要的資料筆數 (預設 60)
 * @param {string} endISO - 結束日期 (ISO格式, 預設今天)
 * @returns {Promise<Array>} 歷史資料陣列
 */
export async function fetchStockHistoryWithAutoFill(
  symbol,
  minCount = 60,
  endISO = null,
) {
  const stockNo = toTwseStockNo(symbol);
  const end = endISO ? new Date(endISO) : new Date();

  // 設定為當天 23:59:59 確保包含今天的資料
  end.setHours(23, 59, 59, 999);

  const allData = [];
  const processedMonths = new Set();

  // 從當前月份開始往回推
  let currentPtr = new Date(end.getFullYear(), end.getMonth(), 1);
  const currentMonthKey = TwDate().formatMonthKey();

  logger.info({ symbol, minCount }, "開始抓取歷史資料並自動回補");

  // 最多往回找 12 個月，避免無限迴圈
  let safetyCounter = 0;
  const MAX_MONTHS = 12;

  while (allData.length < minCount && safetyCounter < MAX_MONTHS) {
    const yyyy = currentPtr.getFullYear();
    const mm = String(currentPtr.getMonth() + 1).padStart(2, "0");
    const monthKey = `${yyyy}${mm}`;
    const yyyymm01 = `${monthKey}01`;

    if (processedMonths.has(monthKey)) break;

    logger.debug({ symbol, monthKey }, "抓取月份資料");

    const rows = await fetchStockDayMonthWithCache(stockNo, yyyymm01);

    if (rows && rows.length > 0) {
      // 過濾掉晚於 endISO 的資料
      const filteredRows = rows.filter((row) => new Date(row.date) <= end);

      // 避免重複日期
      for (const row of filteredRows) {
        if (!allData.some((d) => d.date === row.date)) {
          allData.push(row);
        }
      }
    }

    processedMonths.add(monthKey);

    // 如果是當月且資料不足，或者本來就沒抓到，則往上個月推
    // 禮貌性等待 (如果是當月)
    if (monthKey === currentMonthKey) {
      await sleep(1500);
    }

    // 往前推一個月
    currentPtr.setMonth(currentPtr.getMonth() - 1);
    safetyCounter++;

    // 排序一下，確保最新在後，方便判斷筆數
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  logger.info(
    {
      symbol,
      dataCount: allData.length,
      monthsProcessed: safetyCounter,
    },
    "歷史資料抓取完成",
  );

  // 如果最後還是不足 60 筆，僅記錄警告
  if (allData.length < minCount) {
    logger.warn(
      { symbol, count: allData.length, minCount },
      "歷史資料筆數仍不足需求筆數",
    );
  }

  return allData;
}
