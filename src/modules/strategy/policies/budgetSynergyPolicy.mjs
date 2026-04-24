import { TwDate } from "../../../utils/coreUtils.mjs";

/**
 * 生命週期投資法 - DCA 預算協同模組
 * 判斷是否需要提前動用資金「攔截」低點
 */
export function resolveBudgetSynergy(ctx, strategy, score) {
  const lifecycle = strategy?.lifecycle;
  if (!lifecycle || !lifecycle.monthlyDcaAmount) return null;

  const { payDay, preInjectDays = 5, monthlyDcaAmount } = lifecycle;
  const now = TwDate();
  const currentDay = now.date;
  const currentYear = now.year;
  const currentMonth = now.month;

  // 1. 計算距離下一個撥款日的天數
  let daysToPayDay = 0;
  if (currentDay <= payDay) {
    daysToPayDay = payDay - currentDay;
  } else {
    // 跨月處理
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
    daysToPayDay = lastDayOfMonth - currentDay + payDay;
  }

  // 2. 判斷攔截條件
  // 條件：距離撥款日 <= 預設天數 且 評分 >= 8 (Panic Buy)
  const isNearPayDay = daysToPayDay <= preInjectDays;
  const isExtremeOpportunity = score >= 8;

  if (isNearPayDay && isExtremeOpportunity) {
    return {
      type: "BUDGET_INTERCEPTION",
      label: "🎯 預算攔截模式",
      daysToPayDay,
      suggestedAmount: monthlyDcaAmount,
      reason: `距離撥款日僅剩 ${daysToPayDay} 天且評分達標 (${score}pt)，建議提前動用額度攔截低點。`,
      suggestion: `• 偵測到發薪日前出現極端機會\n• 建議提前買入約 $${monthlyDcaAmount.toLocaleString("zh-TW")} 的部位\n• 等發薪日資金到位後再行歸還質押額度`,
    };
  }

  return null;
}
