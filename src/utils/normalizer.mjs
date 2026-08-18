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
      pe: parseNumber(raw.rawValuation?.pe, { fallback: null }),
      pb: parseNumber(raw.rawValuation?.pb, { fallback: null }),
      pr: parseNumber(raw.rawValuation?.currentPR || raw.rawValuation?.pr, {
        fallback: null,
      }),
      yield: parseNumber(raw.rawValuation?.yield, { fallback: null }),
    },
    sentiment: {
      vix: parseNumber(raw.rawUsMarket?.vix, { fallback: null }),
      fearGreed: parseNumber(raw.rawCnn?.score, { fallback: null }),
      isPanic: raw.rawUsMarket?.vix > 30, // 範例邏輯，未來可擴充
    },
    liquidity: {
      marginRatio: parseNumber(raw.rawMargin?.maintenanceRatio, {
        fallback: null,
      }),
      fxRate: parseNumber(raw.rawFx?.currentRate, { fallback: null }),
      institutionalNetBuy: parseNumber(
        raw.rawInstitutional?.totalNetBuy / 1000000,
        { fallback: null },
      ), // 轉為百萬
    },
    economy: {
      ndcScore: parseNumber(raw.rawNdc?.score, { fallback: null }),
      ndcLight: raw.rawNdc?.light || "未知",
      cpiYoY: parseNumber(raw.rawCpi?.value, { fallback: null }),
      bankRate: parseNumber(raw.rawBankRate?.value, { fallback: null }),
    },
  };
}
