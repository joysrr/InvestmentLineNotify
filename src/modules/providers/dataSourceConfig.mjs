/**
 * macroDataSlots 定義「latest.json 的欄位」要用哪個 provider 來填。
 *
 * 切換融資來源只需改 rawMargin 的 providerId：
 *   "marginKgi"     → KGI / MoneyDJ (原始來源，JSON API)
 *   "marginWantgoo" → WantGoo 玩股網 (HTML scraping)
 */
export const macroDataSlots = {
  rawNdc: {
    providerId: "ndcBusinessIndicator",
  },
  rawMargin: {
    providerId: "marginWantgoo", // ← 已切換至 WantGoo；改回 KGI 請填 "marginKgi"
  },
  rawCnn: {
    providerId: "cnnFearGreed",
  },
  rawUsMarket: {
    providerId: "usMarketFred",
  },
  rawValuation: {
    providerId: "twMarketValuation",
  },
  rawMarketOverview: {
    providerId: "twMarketOverview", // FMTQIK: 收盤指數 + 成交金額
  },
  rawFx: {
    providerId: "usdTwdYahoo",
  },
  quote: {
    providerId: "dailyQuote",
  },
};
