/**
 * 數據標準化工具 (Data Normalizer)
 */

/**
 * 強制轉為數字，並處理常見的符號與異常
 */
export function toNum(val, decimals = 2) {
  if (val === null || val === undefined || val === "") return 0;

  // 處理百分比字串 (如 "3.25%")
  if (typeof val === "string") {
    val = val.replace(/[%|,]/g, "");
  }

  const n = parseFloat(val);
  if (isNaN(n)) return 0;

  // 處理小數點位數
  return parseFloat(n.toFixed(decimals));
}

/**
 * 根據 MARKET_SCHEMA 結構進行對應轉換
 */
export function normalizeMarketData(raw) {
  return {
    valuation: {
      pe: toNum(raw.rawValuation?.pe),
      pb: toNum(raw.rawValuation?.pb),
      pr: toNum(raw.rawValuation?.currentPR || raw.rawValuation?.pr),
      yield: toNum(raw.rawValuation?.yield),
    },
    sentiment: {
      vix: toNum(raw.rawUsMarket?.vix),
      fearGreed: toNum(raw.rawCnn?.score),
      isPanic: raw.rawUsMarket?.vix > 30, // 範例邏輯，未來可擴充
    },
    liquidity: {
      marginRatio: toNum(raw.rawMargin?.maintenanceRatio),
      fxRate: toNum(raw.rawFx?.currentRate),
      institutionalNetBuy: toNum(raw.rawInstitutional?.totalNetBuy / 1000000), // 轉為百萬
    },
    economy: {
      ndcScore: toNum(raw.rawNdc?.score),
      ndcLight: raw.rawNdc?.light || "未知",
      cpiYoY: toNum(raw.rawCpi?.value),
      bankRate: toNum(raw.rawBankRate?.value),
    },
  };
}
