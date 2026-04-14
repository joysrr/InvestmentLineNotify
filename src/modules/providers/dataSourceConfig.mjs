/**
 * macroDataSlots 定義「latest.json 的欄位」要用哪個 provider 來填。
 * 之後如果你要把 rawMargin 改用新的 provider，只要改這一行的 providerId。
 */
export const macroDataSlots = {
  rawNdc: {
    providerId: "ndcBusinessIndicator",
  },
  rawMargin: {
    providerId: "marginKgi", // 未來要切換就改成 "marginAlt" 之類
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
  rawFx: {
    providerId: "usdTwdYahoo",
  },
  quote: {
    providerId: "dailyQuote",
  },
};
