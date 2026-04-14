import { fetchUsMarketData } from "./usMarketProvider.mjs";
import { fetchFearAndGreedIndex } from "./cnnProvider.mjs";
import { fetchTwseMarginData } from "./kgiProvider.mjs";
import { fetchUsdTwdExchangeRate } from "./yahooProvider.mjs";
import { fetchBusinessIndicator } from "./ndcProvider.mjs";
import { getDailyQuote } from "./quoteProvider.mjs";
import { fetchMarketValuation, fetchMarketOverview } from "./twseProvider.mjs";

/**
 * providerRegistry 負責把實際的 provider 實作包裝成統一介面。
 * 之後如果你寫一個新的 marginProvider，只要在這裡多註冊一個 key 即可。
 */
export const providerRegistry = {
  ndcBusinessIndicator: {
    label: "景氣燈號 (NDC)",
    async fetch() {
      return fetchBusinessIndicator();
    },
  },
  marginKgi: {
    label: "融資餘額 (KGI / MoneyDJ)",
    async fetch() {
      return fetchTwseMarginData();
    },
  },
  cnnFearGreed: {
    label: "CNN Fear & Greed",
    async fetch() {
      return fetchFearAndGreedIndex();
    },
  },
  usMarketFred: {
    label: "美股風險 (FRED)",
    async fetch() {
      return fetchUsMarketData();
    },
  },
  twMarketValuation: {
    label: "台股大盤估值 (PB/PE)",
    async fetch() {
      return fetchMarketValuation();
    },
  },
  twMarketOverview: {
    label: "大盤量價 (FMTQIK)",
    async fetch() {
      return fetchMarketOverview();
    },
  },
  usdTwdYahoo: {
    label: "USD/TWD 匯率 (Yahoo)",
    async fetch() {
      return fetchUsdTwdExchangeRate();
    },
  },
  dailyQuote: {
    label: "每日一句",
    async fetch() {
      return getDailyQuote();
    },
  },

  // （未來你新增 margin 替代來源時，可以在這邊加）
  // marginAlt: {
  //   label: "融資餘額 (新來源)",
  //   async fetch() {
  //     return fetchTwseMarginDataFromNewSource();
  //   },
  // },
};
