import { fetchUsMarketData } from "./usMarketProvider.mjs";
import { fetchFearAndGreedIndex } from "./cnnProvider.mjs";
import { fetchTwseMarginData } from "./kgiProvider.mjs";
import { fetchFinMindMarginData } from "./finmindProvider.mjs";
import { fetchUsdTwdExchangeRate } from "./yahooProvider.mjs";
import { fetchBusinessIndicator } from "./ndcProvider.mjs";
import { getDailyQuote } from "./quoteProvider.mjs";
import {
  fetchMarketValuation,
  fetchMarketOverview,
  fetchStockInstitutionalData,
  fetchStockMarginData,
} from "./twseProvider.mjs";
import * as macroProvider from "./macroProvider.mjs";
import { ProviderError } from "../../utils/retryUtils.mjs";

export { ProviderError };

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

  // ── 融資餘額：多個 provider，擇一在 dataSourceConfig 啟用 ────────────────
  marginKgi: {
    label: "融資餘額 (KGI / MoneyDJ)",
    async fetch() {
      return fetchTwseMarginData();
    },
  },
  marginFinMind: {
    label: "融資餘額 / 維持率 (FinMind)",
    async fetch() {
      return fetchFinMindMarginData();
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
  stockInstitutionalTwse: {
    label: "個股三大法人買賣超",
    async fetch(ticker = "0050") {
      return fetchStockInstitutionalData(ticker);
    },
  },
  stockMarginTwse: {
    label: "個股融資融券",
    async fetch(ticker = "00675L") {
      return fetchStockMarginData(ticker);
    },
  },
  twCentralBankRate: {
    label: "台灣基準利率 (央行)",
    async fetch() {
      return macroProvider.fetchCentralBankRate();
    },
  },
  twCpiYoY: {
    label: "消費者物價指數年增率 (CPI)",
    async fetch() {
      return macroProvider.fetchCpiYoY();
    },
  },
  dailyQuote: {
    label: "每日一句",
    async fetch() {
      return getDailyQuote();
    },
  },
};
