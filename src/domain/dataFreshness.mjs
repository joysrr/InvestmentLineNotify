export function tradingDayGap(latestDate, reportDate, tradingDays) {
  const latestIndex = tradingDays.indexOf(latestDate);
  const reportIndex = tradingDays.indexOf(reportDate);
  if (latestIndex < 0 || reportIndex < 0) return null;
  return Math.max(0, reportIndex - latestIndex);
}

export function evaluateFreshness(
  latestDate,
  reportDate,
  tradingDays,
  staleAfterTradingDays = 3,
) {
  if (!latestDate) return { status: "unavailable", tradingDayGap: null };

  const gap = tradingDayGap(latestDate, reportDate, tradingDays);
  if (gap == null) return { status: "unavailable", tradingDayGap: null };
  if (gap >= staleAfterTradingDays) {
    return { status: "stale", tradingDayGap: gap };
  }
  return { status: "fresh", tradingDayGap: gap };
}
