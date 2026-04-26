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

export const SLOT_CRITICALITY = {
  rawValuation: { level: "CRITICAL", staleHours: 48 },
  rawMargin: { level: "CRITICAL", staleHours: 48 },
  rawUsMarket: { level: "CRITICAL", staleHours: 48 },
  rawFx: { level: "IMPORTANT", staleHours: 4 },
  rawCnn: { level: "IMPORTANT", staleHours: 24 },
  rawMarketOverview: { level: "IMPORTANT", staleHours: 48 },
  rawInstitutional: { level: "IMPORTANT", staleHours: 48 },
  rawStockMargin: { level: "IMPORTANT", staleHours: 48 },
  rawNdc: { level: "LOW", staleHours: 720 },
  rawBankRate: { level: "LOW", staleHours: 720 },
  rawCpi: { level: "LOW", staleHours: 720 },
};
