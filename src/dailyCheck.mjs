import "dotenv/config";
import {
  getTwVix,
  fetchStockHistory,
  fetchLatestClose,
  fetchRealtimeFromMis,
  isMarketOpenTodayTWSE,
} from "./modules/providers/twseProvider.mjs";
import { fetchLatestBasePrice } from "./modules/providers/basePriceProvider.mjs";
import { broadcastDailyReport } from "./modules/notifications/notifier.mjs";
import { getInvestmentSignalAsync } from "./modules/strategy/strategyEngine.mjs";
import { calculateIndicators } from "./modules/strategy/indicators.mjs";
import {
  fetchLastPortfolioState,
  logDailyToSheet,
} from "./modules/storage.mjs";
import {
  getAiInvestmentAdvice,
  analyzeMacroNewsWithAI,
} from "./modules/ai/aiCoach.mjs";
import { getNewsTelegramMessages } from "./modules/newsFetcher.mjs";
import { fetchAllMacroData } from "./modules/providers/marketData.mjs";
import {
  formatMacroChipForCoach,
  formatMacroAnalysisForCoach,
} from "./modules/ai/aiDataPreprocessor.mjs";
import { archiveManager } from "./modules/data/archiveManager.mjs";
import { TwDate } from "./utils/coreUtils.mjs";

export async function dailyCheck({
  isTelegramEnabled = true,
  isAIAdvisor = true,
}) {
  console.log("🚀 開始執行 dailyCheck...");

  // 1. 從試算表繼承昨天的持股狀態
  console.log("📊 正在讀取試算表持股...");
  let lastState = null;
  try {
    lastState = await fetchLastPortfolioState();
  } catch (e) {
    console.error("⚠️ 讀取試算表失敗，將使用預設設定 0:", e.message);
    lastState = {
      date: null,
      qty0050: 0,
      qtyZ2: 0,
      totalLoan: 0,
      cash: 0,
    };
  }
  const stockStatus = `✅ 持股狀態確認：0050=${lastState.qty0050}股, 00675L=${lastState.qtyZ2}股, 借款=${lastState.totalLoan}`;
  console.log(stockStatus);

  // 檢查是否開市
  console.log("📅 檢查是否開市...");
  const openToday = await isMarketOpenTodayTWSE();
  if (!openToday) {
    console.log("😴 當日無開市，跳過通知");
  }

  // 台指恐慌指數 (VIX)
  console.log("📈 抓取台指恐慌指數 (VIX)...");
  const vixData = await getTwVix();
  if (vixData) {
    console.log(`✅ VIX 值：${vixData.value.toFixed(2)}`);
  } else {
    console.log("❌ VIX 抓取失敗，不影響主流程");
  }

  // 抓取基準價
  console.log("📥 正在抓取基準價...");
  const { basePrice } = await fetchLatestBasePrice();
  console.log(`💰 取得基準價：${basePrice}`);

  // 取得總經與籌碼資料
  console.log("🌏 正在獲取總經與籌碼資料 (含每日一句與美股風險)...");
  const macroData = await fetchAllMacroData();
  const macroAndChipStr = formatMacroChipForCoach(macroData);

  const usRisk = macroData.rawUsMarket || {
    riskLevel: "正常",
    vix: "N/A",
    spx: "N/A",
    suggestion: "無美股數據",
  };
  const quote = macroData.quote || {
    quote: "投資需謹慎",
    author: "系統預設",
  };
  console.log(`✅ 美股風險：${usRisk.riskLevel}`);
  console.log(`📖 今日一句：${quote.quote}`);

  // 取得股票資訊
  const symbolZ2 = "00675L.TW";
  const symbol0050 = "0050.TW";

  const today = new Date();
  const lastYear = new Date(today);
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  console.log("📥 正在抓取00675L歷史數據...");
  const history = await fetchStockHistory(
    symbolZ2,
    lastYear.toISOString().slice(0, 10),
    today.toISOString().slice(0, 10),
  );

  if (history.length < 30) {
    console.log("❌ 資料不足，無法計算指標");
    return "❌ 資料不足";
  }

  // 抓取 0050 最新價格
  console.log("📥 正在抓取 0050 價格...");
  let price0050 = null;
  try {
    const rt0050 = await fetchRealtimeFromMis(symbol0050);
    price0050 = rt0050?.price;
  } catch (e) {
    console.log("⚠️ 0050 MIS 失敗，轉用收盤價");
  }
  if (!price0050) {
    const latest0050 = await fetchLatestClose(symbol0050);
    price0050 = latest0050?.close;
  }

  // 抓取 00675L 即時價
  console.log("📥 正在抓取 00675L 即時價...");
  let currentPriceZ2 = null;
  try {
    const rt = await fetchRealtimeFromMis(symbolZ2);
    currentPriceZ2 = rt?.price;
  } catch (e) {
    console.log(`⚠️ 00675L MIS 失敗，改用收盤價：${currentPriceZ2}`);
  }
  if (!currentPriceZ2) {
    const latest = await fetchLatestClose(symbolZ2);
    currentPriceZ2 = latest?.close;
  }

  // 計算指標
  console.log(`🧠 正在計算指標...`);
  const { closes, rsiArr, macdArr, kdArr } = calculateIndicators(history);
  const latestClose = closes[closes.length - 1];
  const finalPriceZ2 = currentPriceZ2 || latestClose;
  const ma240 =
    closes.length >= 240
      ? closes.slice(-240).reduce((a, b) => a + b, 0) / 240
      : null;
  const latestRSI = rsiArr[rsiArr.length - 1];
  const latestKD = kdArr[kdArr.length - 1];
  console.log(`✅ 指標計算完成`);

  const signalData = {
    RSI: latestRSI,
    KD_K: latestKD ? latestKD.k : null,
    KD_D: latestKD ? latestKD.d : null,
    currentPrice: finalPriceZ2,
    basePrice,
    price0050: price0050 || 0,
    VIX: vixData?.value ?? null,
    VIXTime: vixData?.dateTimeText ?? vixData?.time ?? null,
    VIXStatus: vixData?.status ?? null,
    ma240,
    portfolio: lastState,
    rsiArr,
    macdArr,
    kdArr,
    US_VIX: usRisk.vix,
    US_SPX_Change: usRisk.spxChg,
    US_RiskLevel: usRisk.riskLevel,
    US_RiskIcon: usRisk.riskIcon,
    US_Suggestion: usRisk.suggestion,
  };

  console.log("🧠 正在計算投資訊號...");
  const result = await getInvestmentSignalAsync(signalData);

  const dateText = TwDate().formatDateKey();

  // 取得新聞集錦（從 pool 讀取，不再即時抓取）
  let newsMessages = [];
  let newsSummaryText = "今日無重大市場新聞。";
  console.log("📝 正在從 news pool 取得新聞集錦...");
  try {
    const newsResult = await getNewsTelegramMessages();
    newsMessages = newsResult.messages;
    newsSummaryText = newsResult.summaryText;
  } catch (err) {
    console.error("❌ 取得新聞集錦失敗 (但不影響發送通知):", err.message);
    newsMessages = [];
    newsSummaryText = "新聞集錦取得失敗，請檢查系統日誌。";
  }

  // 取得總經多空對決報告
  console.log("🤖 正在產生總經多空對決報告...");
  let macroAnalysis = null;
  let macroTextForCoach = "無新聞數據，無法進行總經分析。";
  if (newsMessages?.length) {
    macroAnalysis = await analyzeMacroNewsWithAI(newsSummaryText);
    macroTextForCoach = formatMacroAnalysisForCoach(macroAnalysis);
  } else {
    console.log("⚠️ 無新聞數據，跳過總經分析");
    macroAnalysis = {
      bullish: 0,
      bearish: 0,
      neutral: 0,
      summary: "無新聞數據，無法進行總經分析。",
    };
    macroTextForCoach = macroAnalysis.summary;
  }

  // 取得 AI 決策報告
  console.log("🤖 正在產生 AI 決策分析...");
  const aiAdvice = await getAiInvestmentAdvice(
    result,
    lastState,
    vixData,
    newsSummaryText,
    macroTextForCoach,
    macroAndChipStr,
    !isAIAdvisor,
  );

  // 推送至 Telegram
  const reportDailyData = {
    result,
    vixData,
    usRisk,
    macroData,
    macroAnalysis,
    config: lastState,
    dateText,
    aiAdvice,
    quote,
  };

  broadcastDailyReport(reportDailyData, newsMessages, isTelegramEnabled);

  console.log("📝 正在寫入試算表...");
  try {
    const logData = {
      ...result,
      price0050: price0050,
      currentPrice: finalPriceZ2,
      portfolio: lastState,
    };
    await logDailyToSheet(logData);
  } catch (sheetErr) {
    console.error("❌ 寫入試算表失敗 (但不影響發送通知):", sheetErr.message);
  }

  // 清理系統，儲存最終報告
  try {
    console.log("🧹 正在清理過期快取並儲存最終報告...");
    await archiveManager.saveReport({
      date: dateText,
      signals: result,
      ai: aiAdvice,
    });
    await archiveManager.cleanOldArchives(30);
  } catch (err) {
    console.warn("⚠️ 儲存最終報告或清理快取失敗:", err.message);
  }

  return "✅ dailyCheck 執行成功";
}
