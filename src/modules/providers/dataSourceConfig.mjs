/**
 * macroDataSlots 定義「latest.json 的欄位」要用哪個 provider 來填。
 *
 * 切換融資來源只需改 rawMargin 的 providerId：
 *   "marginKgi"      → KGI / MoneyDJ (原始來源，JSON API)
 *   "marginFinMind"  → FinMind 大盤融資 / 維持率（需 token，官方 TWSE+自建指標）
 */
export const macroDataSlots = {
  rawNdc: {
    providerId: "ndcBusinessIndicator",
  },
  rawMargin: {
    providerId: "marginFinMind", // ← 使用 FinMind 作為主要融資／維持率來源
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
