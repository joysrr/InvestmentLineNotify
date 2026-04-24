import { loadHolidaySet } from "../../providers/twseProvider.mjs";

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
  const lastBuy = new Date(lastBuyDate);

  today.setHours(0, 0, 0, 0);
  lastBuy.setHours(0, 0, 0, 0);

  const startYear = lastBuy.getFullYear();
  const endYear = today.getFullYear();

  const holidays = new Set();

  try {
    for (let y = startYear; y <= endYear; y++) {
      const yearHolidays = await loadHolidaySet(y);
      yearHolidays.forEach((dateStr) => holidays.add(dateStr));
    }
  } catch (e) {
    console.warn("⚠️ 無法取得 TWSE 假日，將退回使用六日計算交易日:", e.message);
  }

  let tradingDaysPassed = 0;
  let currentDate = new Date(lastBuy);
  currentDate.setDate(currentDate.getDate() + 1);

  while (currentDate <= today) {
    const dayOfWeek = currentDate.getDay();
    const isoDate = currentDate.toISOString().split("T")[0];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(isoDate);

    if (!isWeekend && !isHoliday) {
      tradingDaysPassed++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const daysLeft = Math.max(0, cooldownTradingDays - tradingDaysPassed);
  const lastBuyStr = lastBuy.toISOString().split("T")[0];

  return {
    inCooldown: daysLeft > 0,
    daysLeft,
    lastBuyDate: lastBuyStr,
    tradingDaysPassed,
    message:
      daysLeft > 0
        ? `最後買入：${lastBuyStr}，經過 ${tradingDaysPassed} 交易日`
        : `已過 ${tradingDaysPassed} 個交易日`,
  };
}
