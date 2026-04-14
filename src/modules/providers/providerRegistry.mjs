import { fetchUsMarketData } from "./usMarketProvider.mjs";
import { fetchFearAndGreedIndex } from "./cnnProvider.mjs";
import { fetchTwseMarginData } from "./kgiProvider.mjs";
import { fetchWantgooMarginData } from "./wantgooProvider.mjs";
import { fetchUsdTwdExchangeRate } from "./yahooProvider.mjs";
import { fetchBusinessIndicator } from "./ndcProvider.mjs";
import { getDailyQuote } from "./quoteProvider.mjs";
import { fetchMarketValuation, fetchMarketOverview } from "./twseProvider.mjs";

/**
 * providerRegistry 負責把實際的 provider 實作包裝成統一介面。
 * 之後如果你要切換 margin 來源，只需修改 dataSourceConfig.mjs 的 providerId，
 * 不需要動任何業務邏輯。
 */
export const providerRegistry = {
  ndcBusinessIndicator: {
    label: "景氣燈號 (NDC)",
    async fetch() {
      return fetchBusinessIndicator();
    },
  },

  // ── 融資餘額：兩個 provider，擇一在 dataSourceConfig 啟用 ────────────────
  marginKgi: {
    label: "融資餘額 (KGI / MoneyDJ)",
    async fetch() {
      return fetchTwseMarginData();
    },
  },
  marginWantgoo: {
    label: "融資餘額 (WantGoo)",
    async fetch() {
      return fetchWantgooMarginData();
    },
  },
  // ─────────────────────────────────────────────────────────────────────────

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
};
