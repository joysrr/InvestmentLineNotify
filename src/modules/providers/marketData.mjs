import { archiveManager } from "../data/archiveManager.mjs";
import { TwDate } from "../../utils/coreUtils.mjs";

// === 匯出即將被我們整合進 Cache 機制的 Provider ===
import { macroDataSlots, SLOT_CRITICALITY } from "./dataSourceConfig.mjs";
import { providerRegistry } from "./providerRegistry.mjs";
import { sendSystemMessage } from "../notifications/transports/telegramClient.mjs";

function getProviderForSlot(slotKey) {
  const slot = macroDataSlots[slotKey];
  if (!slot) {
    throw new Error(`Unknown macro data slot: ${slotKey}`);
  }
  const provider = providerRegistry[slot.providerId];
  if (!provider) {
    throw new Error(
      `Provider not found for slot ${slotKey}: ${slot.providerId}`,
    );
  }
  return provider;
}

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
  const ndcProviderKey = macroDataSlots.rawNdc.providerId;
  const ndcLastDate = cachedMeta[ndcProviderKey]?.lastFetch?.split("T")[0];
  if (cachedData.rawNdc && ndcLastDate === todayStr) {
    console.log("⚡ [Cache] 景氣燈號使用快取資料");
    finalData.rawNdc = cachedData.rawNdc;
  } else {
    const provider = getProviderForSlot("rawNdc");

    fetchPromises.push(
      provider
        .fetch()
        .then((res) => {
          finalData.rawNdc = res;
          newMetaSources[ndcProviderKey] = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ 國發會 API 失敗:", err.message);
          finalData.rawNdc = cachedData.rawNdc || null;
          newMetaSources[ndcProviderKey] = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta[ndcProviderKey]?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 B: 台股融資餘額 (每日 16:30 更新)
  // 策略: 16:00 前不抓取直接讀 Cache。16:00 後強制重抓。
  // ====================================================================
  const marginProviderKey = macroDataSlots.rawMargin.providerId;
  const marginLastTime = new Date(
    cachedMeta[marginProviderKey]?.lastFetch || 0,
  );
  const hoursSinceMarginUpdate = (now - marginLastTime) / (1000 * 60 * 60);

  if (cachedData.rawMargin && (twHour < 16 || hoursSinceMarginUpdate < 2)) {
    console.log("⚡ [Cache] 融資餘額使用快取資料");
    finalData.rawMargin = cachedData.rawMargin;
  } else {
    const provider = getProviderForSlot("rawMargin");

    fetchPromises.push(
      provider
        .fetch()
        .then((res) => {
          finalData.rawMargin = res;
          newMetaSources[marginProviderKey] = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn(`⚠️ ${provider.label} 失敗:`, err.message);
          finalData.rawMargin = cachedData.rawMargin || null;
          newMetaSources[marginProviderKey] = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta[marginProviderKey]?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 C: CNN 恐懼貪婪指數 (美股盤中變動)
  // 策略: 台灣時間 21:00 ~ 隔日 05:00 強制抓取。其餘時間讀 Cache。
  // ====================================================================
  const cnnProviderKey = macroDataSlots.rawCnn.providerId;
  const isUsMarketOpen = twHour >= 21 || twHour < 5;
  const cnnLastTime = new Date(cachedMeta[cnnProviderKey]?.lastFetch || 0);

  if (
    !isUsMarketOpen &&
    cachedData.rawCnn &&
    now - cnnLastTime < 24 * 60 * 60 * 1000
  ) {
    console.log("⚡ [Cache] CNN 恐慌指數使用快取資料");
    finalData.rawCnn = cachedData.rawCnn;
  } else {
    const provider = getProviderForSlot("rawCnn");

    fetchPromises.push(
      provider
        .fetch()
        .then((res) => {
          finalData.rawCnn = res;
          newMetaSources[cnnProviderKey] = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ CNN API 失敗:", err.message);
          finalData.rawCnn = cachedData.rawCnn || null;
          newMetaSources[cnnProviderKey] = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta[cnnProviderKey]?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 D: 美股 FRED 數據 (每日早上更新昨收)
  // 策略: 每天抓一次即可
  // ====================================================================
  const usMarketProviderKey = macroDataSlots.rawUsMarket.providerId;
  const usMarketLastDate =
    cachedMeta[usMarketProviderKey]?.lastFetch?.split("T")[0];
  if (cachedData.rawUsMarket && usMarketLastDate === todayStr) {
    console.log("⚡ [Cache] FRED 美股數據使用快取資料");
    finalData.rawUsMarket = cachedData.rawUsMarket;
  } else {
    const provider = getProviderForSlot("rawUsMarket");

    fetchPromises.push(
      provider
        .fetch()
        .then((res) => {
          finalData.rawUsMarket = res;
          newMetaSources[usMarketProviderKey] = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ FRED API 失敗:", err.message);
          finalData.rawUsMarket = cachedData.rawUsMarket || null;
          newMetaSources[usMarketProviderKey] = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta[usMarketProviderKey]?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 E: 大盤 PB/PE 估值 (每日更新)
  // 策略: 每天抓一次即可
  // ====================================================================
  const valuationProviderKey = macroDataSlots.rawValuation.providerId;
  const valuationLastDate =
    cachedMeta[valuationProviderKey]?.lastFetch?.split("T")[0];
  if (cachedData.rawValuation && valuationLastDate === todayStr) {
    console.log("⚡ [Cache] 大盤估值(PB/PE)使用快取資料");
    finalData.rawValuation = cachedData.rawValuation;
  } else {
    const provider = getProviderForSlot("rawValuation");

    fetchPromises.push(
      provider
        .fetch()
        .then(async (res) => {
          finalData.rawValuation = res;
          newMetaSources[valuationProviderKey] = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
          // ④ PB 歷史快取：每日成功取得 rawValuation 後追加當日紀錄
          if (res?.pb != null && res?.date) {
            try {
              await archiveManager.appendPbHistory(res.date, res.pb);
            } catch (err) {
              console.warn("⚠️ [Cache] appendPbHistory 寫入失敗:", err.message);
            }
          }
        })
        .catch((err) => {
          console.warn("⚠️ TWSE 估值 API 失敗:", err.message);
          finalData.rawValuation = cachedData.rawValuation || null;
          newMetaSources[valuationProviderKey] = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta[valuationProviderKey]?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 F: 匯率與每日一句
  // ====================================================================

  // 匯率：補上 30 分鐘快取保護 (Yahoo API 穩定性考量)
  const fxProviderKey = macroDataSlots.rawFx.providerId;
  const fxLastTime = new Date(cachedMeta[fxProviderKey]?.lastFetch || 0);
  const minutesSinceFxUpdate = (now - fxLastTime) / (1000 * 60);
  const fxStaleMinutes = SLOT_CRITICALITY.rawFx.staleHours * 60;

  if (cachedData.rawFx && minutesSinceFxUpdate < fxStaleMinutes) {
    console.log(
      `⚡ [Cache] 匯率使用快取資料（距上次更新 < ${fxStaleMinutes} 分鐘）`,
    );
    finalData.rawFx = cachedData.rawFx;
  } else {
    const fxProvider = getProviderForSlot("rawFx");
    fetchPromises.push(
      fxProvider
        .fetch()
        .then((res) => {
          finalData.rawFx = res;
          newMetaSources[fxProviderKey] = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ Yahoo API 失敗:", err.message);
          finalData.rawFx = cachedData.rawFx || null;
          newMetaSources[fxProviderKey] = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta[fxProviderKey]?.lastFetch || null,
          };
        }),
    );
  }

  // 每日一句：交由其內建的 Archive 讀取邏輯處理，這裡只需等它回傳即可
  const quoteProvider = getProviderForSlot("quote");
  const quoteProviderKey = macroDataSlots.quote.providerId;

  fetchPromises.push(
    quoteProvider
      .fetch()
      .then((res) => {
        finalData.quote = res;
        newMetaSources[quoteProviderKey] = {
          status: "SUCCESS",
          lastFetch: now.toISOString(),
        };
      })
      .catch((err) => {
        console.warn("⚠️ Quote API 失敗:", err.message);
        finalData.quote = cachedData.quote || null;
        newMetaSources[quoteProviderKey] = {
          status: "FAILED",
          error: err.message,
          lastFetch: cachedMeta[quoteProviderKey]?.lastFetch || null,
        };
      }),
  );

  // ====================================================================
  // 判斷邏輯 G: 大盤量價概覽 (FMTQIK — 收盤指數 + 成交金額)
  // 策略: 每天抓一次即可 (收盤後才會有新資料，同 rawValuation 頻率)
  // ====================================================================
  const overviewProviderKey = macroDataSlots.rawMarketOverview.providerId;
  const overviewLastDate =
    cachedMeta[overviewProviderKey]?.lastFetch?.split("T")[0];
  if (cachedData.rawMarketOverview && overviewLastDate === todayStr) {
    console.log("⚡ [Cache] 大盤量價概覽使用快取資料");
    finalData.rawMarketOverview = cachedData.rawMarketOverview;
  } else {
    const provider = getProviderForSlot("rawMarketOverview");

    fetchPromises.push(
      provider
        .fetch()
        .then((res) => {
          finalData.rawMarketOverview = res;
          newMetaSources[overviewProviderKey] = {
            status: "SUCCESS",
            lastFetch: now.toISOString(),
          };
        })
        .catch((err) => {
          console.warn("⚠️ FMTQIK 大盤量價 API 失敗:", err.message);
          finalData.rawMarketOverview = cachedData.rawMarketOverview || null;
          newMetaSources[overviewProviderKey] = {
            status: "FAILED",
            error: err.message,
            lastFetch: cachedMeta[overviewProviderKey]?.lastFetch || null,
          };
        }),
    );
  }

  // ====================================================================
  // 判斷邏輯 H: 個股籌碼與信用交易 (0050 法人 / 00675L 融資)
  // 策略: 每日 16:00 後重抓
  // ====================================================================
  const stockMetrics = [
    { slot: "rawInstitutional", key: "foreignNetBuy" },
    { slot: "rawStockMargin", key: "marginBalance" },
  ];

  for (const item of stockMetrics) {
    const slotKey = item.slot;
    const providerId = macroDataSlots[slotKey].providerId;
    const lastFetchDate = cachedMeta[providerId]?.lastFetch?.split("T")[0];

    // 16:00 前或今日已更新則使用快取
    if (cachedData[slotKey] && (twHour < 16 || lastFetchDate === todayStr)) {
      console.log(`⚡ [Cache] ${slotKey} 使用快取資料`);
      finalData[slotKey] = cachedData[slotKey];
    } else {
      const provider = getProviderForSlot(slotKey);
      fetchPromises.push(
        provider
          .fetch()
          .then((res) => {
            finalData[slotKey] = res;
            newMetaSources[providerId] = {
              status: "SUCCESS",
              lastFetch: now.toISOString(),
            };
          })
          .catch((err) => {
            console.warn(`⚠️ ${provider.label} 失敗:`, err.message);
            finalData[slotKey] = cachedData[slotKey] || null;
            newMetaSources[providerId] = {
              status: "FAILED",
              error: err.message,
              lastFetch: cachedMeta[providerId]?.lastFetch || null,
            };
          }),
      );
    }
  }

  // ====================================================================
  // 判斷邏輯 I: 總經指標 (利率 / 通膨)
  // 策略: 每日抓取一次 (Forward-Fill via Cache fallback)
  // ====================================================================
  const macroMetrics = ["rawBankRate", "rawCpi"];

  for (const slotKey of macroMetrics) {
    const providerId = macroDataSlots[slotKey].providerId;
    const lastFetchDate = cachedMeta[providerId]?.lastFetch?.split("T")[0];

    if (cachedData[slotKey] && lastFetchDate === todayStr) {
      console.log(`⚡ [Cache] ${slotKey} 使用快取資料`);
      finalData[slotKey] = cachedData[slotKey];
    } else {
      const provider = getProviderForSlot(slotKey);
      fetchPromises.push(
        provider
          .fetch()
          .then((res) => {
            finalData[slotKey] = res;
            newMetaSources[providerId] = {
              status: "SUCCESS",
              lastFetch: now.toISOString(),
            };
          })
          .catch((err) => {
            console.warn(`⚠️ ${provider.label} 失敗:`, err.message);
            finalData[slotKey] = cachedData[slotKey] || null;
            newMetaSources[providerId] = {
              status: "FAILED",
              error: err.message,
              lastFetch: cachedMeta[providerId]?.lastFetch || null,
            };
          }),
      );
    }
  }

  // ====================================================================
  // 3. 執行所有需要打網路的任務
  // ====================================================================
  if (fetchPromises.length > 0) {
    console.log(`🌐 共有 ${fetchPromises.length} 個指標需要重新抓取或驗證...`);
    await Promise.allSettled(fetchPromises);
  }

  // ====================================================================
  // 4. 新鮮度評估與 _stale 標籤注入
  // ====================================================================
  const criticalStaleSlots = [];

  for (const [slotKey, cfg] of Object.entries(SLOT_CRITICALITY)) {
    const slotData = finalData[slotKey];
    if (!slotData) continue;

    const providerId = macroDataSlots[slotKey]?.providerId;
    const meta = newMetaSources[providerId];
    if (!meta) continue;

    const lastFetch = new Date(meta.lastFetch || 0);
    const hoursStale = (now - lastFetch) / (1000 * 60 * 60);

    // 只有當資料超過容忍度時才標注，或抓取失敗時標注
    if (meta.status === "FAILED" || hoursStale > cfg.staleHours) {
      // 注入 _stale 標籤，使下游 AI Coach 可識別
      if (
        typeof finalData[slotKey] === "object" &&
        finalData[slotKey] !== null
      ) {
        finalData[slotKey]._stale = {
          hoursOld: Math.round(hoursStale),
          lastFetch: meta.lastFetch || null,
          status: meta.status,
        };
      }

      // 追蹤過期的關鍵 Slot
      if (cfg.level === "CRITICAL" && hoursStale > cfg.staleHours) {
        criticalStaleSlots.push({
          slot: slotKey,
          hours: hoursStale.toFixed(1),
          threshold: cfg.staleHours,
        });
      }
    }
  }

  // 若關鍵資料過期，發出系統告警
  if (criticalStaleSlots.length > 0) {
    const alertItems = criticalStaleSlots
      .map((s) => `${s.slot}(${s.hours}h/${s.threshold}h)`)
      .join(", ");
    const alertMsg = `⚠️ <b>[DataFreshness] 關鍵資料過期告警</b>\n\n以下指標已超過 STALE 容忍度，本日分析品質可能受影響：\n<code>${alertItems}</code>`;
    console.error(`❌ [DataFreshness] CRITICAL STALE：${alertItems}`);

    // 靜默發送系統告警
    await sendSystemMessage(alertMsg);
  }

  // 5. 將最新的結果存回 Cache (交給 Archive Manager)
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
