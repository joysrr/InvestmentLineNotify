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
    providerId: "marginKgi",
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
    providerId: "twMarketOverview",
  },
  rawFx: {
    providerId: "usdTwdYahoo",
  },
  rawInstitutional: {
    providerId: "stockInstitutionalTwse",
  },
  rawStockMargin: {
    providerId: "stockMarginTwse",
  },
  rawBankRate: {
    providerId: "twCentralBankRate",
  },
  rawCpi: {
    providerId: "twCpiYoY",
  },
  quote: {
    providerId: "dailyQuote",
  },
};
