export {
  fetchStockHistory,
  fetchRealTimePrice,
  getTwVix,
  isMarketOpenTodayTWSE,
} from "./twseProvider.mjs";
export { fetchUsMarketData } from "./usMarketProvider.mjs";
export { getDailyQuote } from "./quoteProvider.mjs";
export { fetchLatestBasePrice } from "./basePriceProvider.mjs";
import { fetchFearAndGreedIndex } from "./cnnProvider.mjs";
import { fetchTwseMarginData } from "./kgiProvider.mjs";
import { fetchUsdTwdExchangeRate } from "./yahooProvider.mjs";
import { fetchBusinessIndicator } from "./ndcProvider.mjs";

/**
 * ⚡ 平行獲取所有總經與籌碼資料 (容錯設計)
 * @returns {Promise<Object>} 包含四個指標原始資料的物件
 */
export async function fetchAllMacroData() {
  console.log("🔄 開始平行獲取總經與籌碼原始資料...");
  const startTime = Date.now();

  const [cnnResult, marginResult, fxResult, ndcResult] =
    await Promise.allSettled([
      fetchFearAndGreedIndex(),
      fetchTwseMarginData(),
      fetchUsdTwdExchangeRate(),
      fetchBusinessIndicator(),
    ]);

  const rawData = {
    rawCnn: cnnResult.status === "fulfilled" ? cnnResult.value : null,
    rawMargin: marginResult.status === "fulfilled" ? marginResult.value : null,
    rawFx: fxResult.status === "fulfilled" ? fxResult.value : null,
    rawNdc: ndcResult.status === "fulfilled" ? ndcResult.value : null,
  };

  if (cnnResult.status === "rejected")
    console.warn("⚠️ CNN API 失敗:", cnnResult.reason);
  if (marginResult.status === "rejected")
    console.warn("⚠️ KGI API 失敗:", marginResult.reason);
  if (fxResult.status === "rejected")
    console.warn("⚠️ Yahoo API 失敗:", fxResult.reason);
  if (ndcResult.status === "rejected")
    console.warn("⚠️ 國發會 API 失敗:", ndcResult.reason);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ 總經資料獲取完成 (耗時: ${duration}s)`);

  return rawData;
}

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
