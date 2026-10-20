/**
 * 將既有市場資料欄位映射成領先指標雷達輸入。
 * 缺少來源時回傳 null，讓上層能區分「無資料」與真實數值 0。
 */
export function mapLeadingIndicatorInputs({
  rawMargin = {},
  rawMarketOverview = {},
} = {}) {
  const maintenanceRatio = toFiniteNumber(rawMargin.maintenanceRatio);
  const marginBalance = toFiniteNumber(rawMargin.marginBalance100M);
  const marginBalanceChange = toFiniteNumber(rawMargin.marginBalanceChange100M);
  const previousMarginBalance =
    marginBalance !== null && marginBalanceChange !== null
      ? marginBalance - marginBalanceChange
      : null;
  const marginBalanceChangePct =
    previousMarginBalance !== null && previousMarginBalance !== 0
      ? marginBalanceChange / previousMarginBalance
      : null;

  const marketChangePercent = toFiniteNumber(rawMarketOverview.changePercent);

  return {
    maintenanceRatio,
    marginBalanceChangePct,
    taiexReturn:
      marketChangePercent === null ? null : marketChangePercent / 100,
  };
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
