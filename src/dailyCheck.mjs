import "dotenv/config";
import { getTwVix } from "./services/vixService.mjs";
import { fetchLatestBasePrice } from "./services/basePriceService.mjs";
import { pushLine, buildFlexCarouselFancy } from "./services/notifyService.mjs";
import { getInvestmentSignalAsync } from "./services/stockSignalService.mjs";
import {
  fetchStockHistory,
  fetchLatestClose,
} from "./providers/twse/twseStockDayProvider.mjs";
import { fetchRealtimeFromMis } from "./providers/twse/twseMisProvider.mjs";
import { isMarketOpenTodayTWSE } from "./providers/twse/twseCalendarProvider.mjs";
import { calculateIndicators } from "./finance/indicators.mjs";
import { getTaiwanDate } from "./utils/timeUtils.mjs";
import {
  fetchLastPortfolioState,
  logDailyToSheet,
} from "./services/googleSheetService.mjs";
import { fetchStrategyConfig } from "./services/strategyConfigService.mjs";
import { getAiInvestmentAdvice } from "./services/aiAdvisorService.mjs";
import { getDailyQuote } from "./services/quoteService.mjs";
import { analyzeUsRisk } from "./services/usRiskService.mjs";
import {
  buildTelegramMessages,
  sendTelegramBatch,
} from "./services/telegramService.mjs";
import { getNewsTelegramMessages } from "./providers/newsProvider.mjs";

export async function dailyCheck({
  isLineEnabled = true,
  isTelegramEnabled = true,
  isTranslate = false,
  isAIAdvisor = true,
}) {
  try {
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

    // 台指恐慌指數 (VIX)
    console.log("📈 抓取台指恐慌指數 (VIX)...");
    const vixData = await getTwVix();
    if (vixData) {
      console.log(`✅ VIX 值：${vixData.value.toFixed(2)}`);
    } else {
      console.log("❌ VIX 抓取失敗，不影響主流程");
    }

    /*
    // 檢查是否開市
    console.log("📅 檢查是否開市...");
    const openToday = await isMarketOpenTodayTWSE();
    if (!openToday) {
      console.log("😴 當日無開市，跳過通知");
      return "當日無開市，跳過通知";
    }
    */

    // 取得股票資訊
    const symbolZ2 = "00675L.TW";
    const symbol0050 = "0050.TW";

    // 抓取基準價
    console.log("📥 正在抓取基準價...");
    const { basePrice } = await fetchLatestBasePrice(); // baseDate 沒用到可省略
    console.log(`💰 取得基準價：${basePrice}`);

    // 取得歷史數據（近一年）
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
    console.log(
      `📅 取得00675L歷史數據：${lastYear.toISOString().slice(0, 10)} 至 ${today.toISOString().slice(0, 10)}`,
    );

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
    console.log(`💰 取得 0050 價格：${price0050}`);

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
    console.log(`💰 取得 00675L 價格：${currentPriceZ2}`);

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

    const usRisk = await analyzeUsRisk();
    console.log(`✅ 美股風險：${usRisk.riskLevel}`);

    // 準備數據包
    const signalData = {
      // 指標最新值（用於 computeOverheatState / detail 顯示）
      RSI: latestRSI,
      KD_K: latestKD ? latestKD.k : null,
      KD_D: latestKD ? latestKD.d : null,

      // 價格
      currentPrice: finalPriceZ2,
      basePrice,
      price0050: price0050 || 0,

      // 其他資訊
      VIX: vixData?.value ?? null,
      VIXTime: vixData?.dateTimeText ?? vixData?.time ?? null,
      VIXStatus: vixData?.status ?? null,
      ma240,

      // 資產/負債
      portfolio: lastState,

      // 指標序列（用於 cross 判斷）
      rsiArr,
      macdArr,
      kdArr,

      // 美股恐慌指數
      US_VIX: usRisk.vix,
      US_SPX_Change: usRisk.spxChg,
      US_RiskLevel: usRisk.riskLevel,
      US_RiskIcon: usRisk.riskIcon,
      US_Suggestion: usRisk.suggestion,
    };

    console.log("🧠 正在計算投資訊號...");
    const result = await getInvestmentSignalAsync(signalData);
    const strategyConfig = await fetchStrategyConfig();

    // 取得 AI 決策報告
    console.log("🤖 正在產生 AI 決策分析...");

    //console.log("原始數據", result, lastState, strategyConfig);
    const aiAdvice = await getAiInvestmentAdvice(
      result,
      lastState,
      vixData,
      strategyConfig,
      !isAIAdvisor,
    );
    console.log("--- DEBUG AI ADVICE ---");
    console.log(aiAdvice); // ⚡️ 在 GitHub Actions 的 Log 裡看這段

    /*
    // 交易時段檢查
    const nowTaipei = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
    );
    const hour = nowTaipei.getHours();
    if (hour < 7 || hour >= 18) {
      console.log("😴 非交易時段，不發送通知");
      return "非交易時段";
    }
    */

    // 組合戰報訊息
    let header = `【00675L ${result.strategy.leverage.targetMultiplier}倍質押戰報】`;

    let msg = `📅 資料時間：${new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}\n\n`;

    // --- 台指恐慌指數 (VIX) ---
    if (vixData) {
      msg +=
        `🎭 台指恐慌指數(TAIWAN VIX)：${vixData.value.toFixed(2)}\n` +
        `   └ 漲跌：${vixData.change >= 0 ? "+" : ""}${vixData.change.toFixed(2)}｜狀態：${vixData.status}\n` +
        `   └ 時間：${vixData.dateTimeText ?? "未知"}｜Symbol：${vixData.symbolUsed}\n\n` +
        `   └ 門檻：低<${result.strategy.threshold.vixLowComplacency} / 高>${result.strategy.threshold.vixHighFear}\n\n`;
    } else {
      msg += `🎭 台指恐慌指數 (VIX)：抓取失敗（不影響其他判斷）\n\n`;
    }
    // -------------------------

    msg += `${stockStatus}\n`;
    msg += `📊 市場狀態：${result.marketStatus}\n`;
    msg += `🏹 行動建議：${result.suggestion}\n\n`;

    const date = getTaiwanDate();
    msg += `\n📅 重要提醒:\n`;
    if (date === 9) msg += "   └ 今日 9 號：執行定期定額與撥款校準\n";
    if (result.z2Ratio > 42)
      msg += "   └ ⚠️ 00675L佔比過高，請優先評估止盈還款！\n";

    msg +=
      `\n【心理紀律】\n` +
      `   └ 33年目標：7,480萬\n` +
      `   └ 下跌是加碼的禮物，上漲是資產的果實\n\n`;

    const rsiText = Number.isFinite(result.RSI) ? result.RSI.toFixed(1) : "N/A";
    const kdKText = Number.isFinite(result.KD_K)
      ? result.KD_K.toFixed(1)
      : "N/A";
    const kdDText = Number.isFinite(result.KD_D)
      ? result.KD_D.toFixed(1)
      : "N/A";
    const bias240Text = Number.isFinite(result.bias240)
      ? `${result.bias240.toFixed(2)}%`
      : "N/A";

    let detailMsg =
      `\n🔥 過熱狀態：${result.overheat.isOverheat ? "是" : "否"} (${result.overheat.highCount}/${result.overheat.factorCount})\n` +
      `📉 轉弱觸發：${result.reversal.triggeredCount}/${result.reversal.totalFactor}\n` +
      `🧾 賣出訊號：${result.sellSignals.signalCount}/${result.sellSignals.total}\n`;

    detailMsg +=
      `🔍 數據細節：\n` +
      `   └ 現價：${result.currentPrice}\n` +
      `   └ 基準價：${result.basePrice}\n` +
      `   └ 變動：${result.priceChangePercentText}%\n` +
      `   └ 跌幅(進場用)：${result.priceDropPercentText}%\n` +
      `   └ RSI：${rsiText} ${Number.isFinite(result.RSI) && result.RSI > result.strategy.threshold.rsiCoolOff ? `(>${result.strategy.threshold.rsiCoolOff})⚠️` : ""}\n` +
      `   └ KD_K：${kdKText} ${Number.isFinite(result.KD_K) && result.KD_K > result.strategy.threshold.kdCoolOff ? `(>${result.strategy.threshold.kdCoolOff})⚠️` : ""}\n` +
      `   └ KD_D：${kdDText}\n` +
      `   └ 年線乖離：${bias240Text} ${Number.isFinite(result.bias240) && result.bias240 > result.strategy.threshold.bias240CoolOff ? `(>${result.strategy.threshold.bias240CoolOff})⚠️` : ""}\n\n`;

    detailMsg +=
      `🛡️ 帳戶安全狀態\n` +
      `   └ 預估維持率：${result.totalLoan > 0 ? `${result.maintenanceMargin.toFixed(1)}%` : "未質押"} ${result.maintenanceMargin < result.strategy.threshold.mmDanger ? `(<${result.strategy.threshold.mmDanger})⚠️` : "✅"} \n` +
      `   └ 正 2 淨值佔比：${result.z2Ratio.toFixed(1)}% ${result.z2Ratio > result.strategy.threshold.z2RatioHigh ? `(>${result.strategy.threshold.z2RatioHigh})⚠️` : `(距離目標 40% 尚有 ${(40 - result.z2Ratio).toFixed(1)}% 空間)`}\n` +
      `   └ 警戒上限：${result.strategy.threshold.z2RatioHigh}%（超過觸發再平衡）\n` +
      `   └ 現金儲備：${lastState.cash.toLocaleString()} 元\n` +
      `   └ 目前總負債：${result.totalLoan.toLocaleString()} 元\n\n`;

    detailMsg +=
      `🎯 策略操作指令\n` +
      `   └ 加碼權重：${result.weightScore} 分\n` +
      `🔍 加碼權重細節：\n` +
      `   └ ${result.weightDetails.dropInfo}（+${result.weightDetails.dropScore}）\n` +
      `   └ ${result.weightDetails.rsiInfo}（+${result.weightDetails.rsiScore}）\n` +
      `   └ ${result.weightDetails.macdInfo}（+${result.weightDetails.macdScore}）\n` +
      `   └ ${result.weightDetails.kdInfo}（+${result.weightDetails.kdScore}）\n`;

    const legend = [
      "【說明】",
      "K線：日K｜區間：近1年;年線：240MA;價格：即時(MIS)/收盤(close)",
      "R80=RSI<80；K90=KD<90；B25=乖離<25",
      "KD=KD死叉;MACD=MACD死叉",
    ].join("\n");

    detailMsg += "\n" + legend;

    const dateText = new Date().toLocaleDateString("zh-TW", {
      timeZone: "Asia/Taipei",
    });

    const quote = await getDailyQuote(isTranslate);

    const flexCarousel = buildFlexCarouselFancy({
      result,
      vixData,
      usRisk,
      config: lastState,
      dateText,
      aiAdvice,
      quote,
    });

    const lineMessages = [
      {
        type: "flex",
        altText: `00675L ${result.marketStatus}`, // altText 建議短（必填）[web:405]
        contents: flexCarousel,
      },
    ];

    if (isLineEnabled) {
      console.log("📤 正在發送 Line 通知...");
      await pushLine(lineMessages);
      console.log("✅ 執行完成！");
    }

    let telegramMessages = buildTelegramMessages({
      result,
      vixData,
      usRisk,
      config: lastState,
      dateText,
      aiAdvice,
      quote,
    });

    if (isTelegramEnabled) {
      console.log("📤 正在發送 Telegram 通知...");
      console.log("📝 正在發送新聞錦集...");
      try {
        const newsMessages = await getNewsTelegramMessages();
        telegramMessages = telegramMessages.concat(newsMessages);
        console.log("✅ 執行完成！");
      } catch {
        console.error(
          "❌ 取得新聞錦集失敗 (但不影響發送通知):",
          sheetErr.message,
        );
      }
      await sendTelegramBatch(telegramMessages);
      console.log("✅ 執行完成！");
    }

    console.log("📝 正在寫入試算表...");
    try {
      // 準備寫入的資料
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

    return { header, msg, detailMsg, lineMessages, telegramMessages };
  } catch (err) {
    console.error("❌ 系統發生嚴重錯誤:", err);
    return err.message;
  }
}
