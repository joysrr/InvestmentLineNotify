import { archiveManager } from "../data/archiveManager.mjs";
import { TwDate } from "../../utils/coreUtils.mjs";

// === 匯出不需經過 Cache 的即時 / 核心功能 ===
export {
  fetchStockHistory,
  fetchRealTimePrice,
  getTwVix,
  isMarketOpenTodayTWSE,
} from "./twseProvider.mjs";
export { fetchLatestBasePrice } from "./basePriceProvider.mjs";

// === 匯出即將被我們整合進 Cache 機制的 Provider ===
import { fetchUsMarketData } from "./usMarketProvider.mjs";
import { fetchFearAndGreedIndex } from "./cnnProvider.mjs";
import { fetchTwseMarginData } from "./kgiProvider.mjs";
import { fetchUsdTwdExchangeRate } from "./yahooProvider.mjs";
import { fetchBusinessIndicator } from "./ndcProvider.mjs";
import { getDailyQuote } from "./quoteProvider.mjs";
import { fetchMarketValuation } from "./twseProvider.mjs";

/**
 * ⚡ 智慧獲取所有總經與籌碼資料 (結合 Archive Cache 機制)
 */
export async function fetchAllMacroData() {
  console.log("🔄 開始獲取總經與籌碼資料 (檢查快取)...");
  const startTime = Date.now();

  // 1. 讀取目前的快取檔案
  const cache = await archiveManager.getLatestMarketData();
  const cachedMeta = cache?._meta?.sources || {};
  const cachedData = cache?.data || {};

  const now = new Date();
  const twHour = Number(
    now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Taipei",
    }),
  );

  const todayStr = TwDate().formatDateKey();

  // 準備裝結果的容器
  const finalData = {};
  const newMetaSources = { ...cachedMeta };
  const fetchPromises = []; // 存放需要真正打 API 的任務

  // ====================================================================
  // 判斷邏輯 A: 國發會景氣燈號 (極低頻)
  // 策略: 每天抓一次即可。檢查 lastFetch 日期是否為今天。
  // ====================================================================
  const ndcLastDate = cachedMeta.ndcProvider?.lastFetch?.split("T")[0];
  if (cachedData.rawNdc && ndcLastDate === todayStr) {
    console.log("⚡ [Cache] 景氣燈號使用快取資料");
    finalData.rawNdc = cachedData.rawNdc;
  } else {
    fetchPromises.push(
      fetchBusinessIndicator()
        .then((res) => {
          finalData.rawNdc = res;
          newMetaSources.ndcProvider = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ 國發會 API 失敗:", err.message);
          finalData.rawNdc = cachedData.rawNdc || null;
          newMetaSources.ndcProvider = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta.ndcProvider?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 B: 台股融資餘額 (每日 16:30 更新)
  // 策略: 16:00 前不抓取直接讀 Cache。16:00 後強制重抓。
  // ====================================================================
  const marginLastTime = new Date(cachedMeta.kgiProvider?.lastFetch || 0);
  const hoursSinceMarginUpdate = (now - marginLastTime) / (1000 * 60 * 60);

  if (cachedData.rawMargin && (twHour < 16 || hoursSinceMarginUpdate < 2)) {
    console.log("⚡ [Cache] 融資餘額使用快取資料");
    finalData.rawMargin = cachedData.rawMargin;
  } else {
    fetchPromises.push(
      fetchTwseMarginData()
        .then((res) => {
          finalData.rawMargin = res;
          newMetaSources.kgiProvider = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ KGI API 失敗:", err.message);
          finalData.rawMargin = cachedData.rawMargin || null;
          newMetaSources.kgiProvider = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta.kgiProvider?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 C: CNN 恐懼貪婪指數 (美股盤中變動)
  // 策略: 台灣時間 21:00 ~ 隔日 05:00 強制抓取。其餘時間讀 Cache。
  // ====================================================================
  const isUsMarketOpen = twHour >= 21 || twHour < 5;
  const cnnLastTime = new Date(cachedMeta.cnnProvider?.lastFetch || 0);

  if (
    !isUsMarketOpen &&
    cachedData.rawCnn &&
    now - cnnLastTime < 24 * 60 * 60 * 1000
  ) {
    console.log("⚡ [Cache] CNN 恐慌指數使用快取資料");
    finalData.rawCnn = cachedData.rawCnn;
  } else {
    fetchPromises.push(
      fetchFearAndGreedIndex()
        .then((res) => {
          finalData.rawCnn = res;
          newMetaSources.cnnProvider = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ CNN API 失敗:", err.message);
          finalData.rawCnn = cachedData.rawCnn || null;
          newMetaSources.cnnProvider = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta.cnnProvider?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 D: 美股 FRED 數據 (每日早上更新昨收)
  // 策略: 每天抓一次即可
  // ====================================================================
  const usMarketLastDate =
    cachedMeta.usMarketProvider?.lastFetch?.split("T")[0];
  if (cachedData.rawUsMarket && usMarketLastDate === todayStr) {
    console.log("⚡ [Cache] FRED 美股數據使用快取資料");
    finalData.rawUsMarket = cachedData.rawUsMarket;
  } else {
    fetchPromises.push(
      fetchUsMarketData()
        .then((res) => {
          finalData.rawUsMarket = res;
          newMetaSources.usMarketProvider = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ FRED API 失敗:", err.message);
          finalData.rawUsMarket = cachedData.rawUsMarket || null;
          newMetaSources.usMarketProvider = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta.usMarketProvider?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 E: 大盤 PB/PE 估值 (每日更新)
  // 策略: 每天抓一次即可
  // ====================================================================
  const valuationLastDate =
    cachedMeta.valuationProvider?.lastFetch?.split("T")[0];
  if (cachedData.rawValuation && valuationLastDate === todayStr) {
    console.log("⚡ [Cache] 大盤估值(PB/PE)使用快取資料");
    finalData.rawValuation = cachedData.rawValuation;
  } else {
    fetchPromises.push(
      fetchMarketValuation()
        .then((res) => {
          finalData.rawValuation = res;
          newMetaSources.valuationProvider = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ TWSE 估值 API 失敗:", err.message);
          finalData.rawValuation = cachedData.rawValuation || null;
          newMetaSources.valuationProvider = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta.valuationProvider?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 F: 匯率與每日一句
  // ====================================================================

  // 匯率：即時抓取 (若失敗則回退)
  fetchPromises.push(
    fetchUsdTwdExchangeRate()
      .then((res) => {
        finalData.rawFx = res;
        newMetaSources.yahooProvider = {
          status: "SUCCESS",
          lastFetch: now.toISOString(),
        };
      })
      .catch((err) => {
        console.warn("⚠️ Yahoo API 失敗:", err.message);
        finalData.rawFx = cachedData.rawFx || null;
        newMetaSources.yahooProvider = {
          status: "FAILED",
          error: err.message,
          lastFetch: cachedMeta.yahooProvider?.lastFetch || null,
        };
      }),
  );

  // 每日一句：交由其內建的 Archive 讀取邏輯處理，這裡只需等它回傳即可
  fetchPromises.push(
    getDailyQuote()
      .then((res) => {
        finalData.quote = res;
      })
      .catch((err) => {
        console.warn("⚠️ Quote API 失敗:", err.message);
        finalData.quote = cachedData.quote || null;
      }),
  );

  // ====================================================================
  // 3. 執行所有需要打網路的任務
  // ====================================================================
  if (fetchPromises.length > 0) {
    console.log(`🌐 共有 ${fetchPromises.length} 個指標需要重新抓取或驗證...`);
    await Promise.allSettled(fetchPromises);
  }

  // 4. 將最新的結果存回 Cache (交給 Archive Manager)
  const newMarketState = {
    _meta: {
      lastRun: now.toISOString(),
      sources: newMetaSources,
    },
    data: finalData,
  };

  await archiveManager.saveMarketData(newMarketState);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ 總經資料獲取與快取更新完成 (耗時: ${duration}s)`);

  return finalData;
}
