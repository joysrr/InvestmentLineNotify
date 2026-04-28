/**
 * 數據標準化工具 (Data Normalizer)
 */

import { parseNumber } from "./coreUtils.mjs";

/**
 * 根據 MARKET_SCHEMA 結構進行對應轉換
 */
export function normalizeMarketData(raw) {
  return {
    valuation: {
      pe: parseNumber(raw.rawValuation?.pe),
      pb: parseNumber(raw.rawValuation?.pb),
      pr: parseNumber(raw.rawValuation?.currentPR || raw.rawValuation?.pr),
      yield: parseNumber(raw.rawValuation?.yield),
    },
    sentiment: {
      vix: parseNumber(raw.rawUsMarket?.vix),
      fearGreed: parseNumber(raw.rawCnn?.score),
      isPanic: raw.rawUsMarket?.vix > 30, // 範例邏輯，未來可擴充
    },
    liquidity: {
      marginRatio: parseNumber(raw.rawMargin?.maintenanceRatio),
      fxRate: parseNumber(raw.rawFx?.currentRate),
      institutionalNetBuy: parseNumber(
        raw.rawInstitutional?.totalNetBuy / 1000000,
      ), // 轉為百萬
    },
    economy: {
      ndcScore: parseNumber(raw.rawNdc?.score),
      ndcLight: raw.rawNdc?.light || "未知",
      cpiYoY: parseNumber(raw.rawCpi?.value),
      bankRate: parseNumber(raw.rawBankRate?.value),
    },
  };
}
