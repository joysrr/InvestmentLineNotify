import logger from "../../../utils/logger.mjs";
import { loadHolidaySet } from "../../providers/twseProvider.mjs";
import { TwDate } from "../../../utils/coreUtils.mjs";

/**
 * 檢查是否在 Cooldown 期間 (以「交易日」計算)
 * @param {Date|string} lastBuyDate - 最後買入日期
 * @param {number} cooldownTradingDays - 冷卻「交易日」天數
 * @returns {Promise<Object>} { inCooldown, daysLeft, lastBuyDate, message }
 */
export async function checkCooldown(lastBuyDate, cooldownTradingDays) {
  if (!lastBuyDate) {
    return {
      inCooldown: false,
      daysLeft: 0,
      lastBuyDate: null,
      message: "無歷史買入記錄",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastBuy = new Date(lastBuyDate);
  lastBuy.setHours(0, 0, 0, 0);
  if (isNaN(lastBuy.getTime())) {
    return {
      inCooldown: false,
      daysLeft: 0,
      lastBuyDate: null,
      message: `⚠️ lastBuyDate 格式無效：${lastBuyDate}`,
    };
  }

  if (lastBuy > today) {
    return {
      inCooldown: false,
      daysLeft: 0,
      lastBuyDate: TwDate(lastBuy).formatDateKey(),
      message: `⚠️ lastBuyDate 為未來日期，視為無冷卻限制`,
    };
  }

  const startYear = lastBuy.getFullYear();
  const endYear = today.getFullYear();

  const holidays = new Set();

  let holidayFallback = false;

  try {
    for (let y = startYear; y <= endYear; y++) {
      const yearHolidays = await loadHolidaySet(y);
      yearHolidays.forEach((dateStr) => holidays.add(dateStr));
    }
  } catch (e) {
    logger.warn({ error: e.message }, "⚠️ 無法取得 TWSE 假日，將退回使用六日計算交易日");
    holidayFallback = true;
  }

  let tradingDaysPassed = 0;
  let currentDate = new Date(lastBuy);
  currentDate.setDate(currentDate.getDate() + 1);

  while (currentDate <= today) {
    const dayOfWeek = currentDate.getDay();
    const isoDate = TwDate(currentDate).formatDateKey();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(isoDate);

    if (!isWeekend && !isHoliday) {
      tradingDaysPassed++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const daysLeft = Math.max(0, cooldownTradingDays - tradingDaysPassed);
  const lastBuyStr = TwDate(lastBuy).formatDateKey();

  return {
    inCooldown: daysLeft > 0,
    daysLeft,
    lastBuyDate: lastBuyStr,
    tradingDaysPassed,
    holidayFallback,
    message:
      daysLeft > 0
        ? `最後買入：${lastBuyStr}，經過 ${tradingDaysPassed} 交易日`
        : `已過 ${tradingDaysPassed} 個交易日`,
  };
}
