export {
  fetchStockHistory,
  fetchRealTimePrice,
  getTwVix,
  isMarketOpenTodayTWSE,
} from "./twseProvider.mjs";
export { fetchUsMarketData } from "./usMarketProvider.mjs";
export { getDailyQuote } from "./quoteProvider.mjs";
export { fetchLatestBasePrice } from "./basePriceProvider.mjs";
export { fetchFearAndGreedIndex } from "./cnnProvider.mjs";

// 如果有需要整合多個來源的函數，可以寫在這裡：
export async function getCompleteMarketStatus(symbol) {
  const [priceData, usRisk, vix] = await Promise.all([
    fetchRealTimePrice(symbol),
    fetchUsMarketData(),
    getTwVix(),
    fetchFearAndGreedIndex(),
  ]);
  return { priceData, usRisk, vix };
}
