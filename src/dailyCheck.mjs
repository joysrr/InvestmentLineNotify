import "dotenv/config";
import { getTwVix } from "./services/vixService.mjs";
import { fetchLatestBasePrice } from "./services/basePriceService.mjs";
import { pushMessage, pushMessages, buildFlexCarouselFancy } from "./services/notifyService.mjs";
import { getMACDSignal, getInvestmentSignalAsync } from "./services/stockSignalService.mjs";
import { fetchStockHistory, fetchLatestClose } from "./providers/twse/twseStockDayProvider.mjs";
import { fetchRealtimeFromMis } from "./providers/twse/twseMisProvider.mjs";
import { isMarketOpenTodayTWSE } from "./providers/twse/twseCalendarProvider.mjs";
import { calculateIndicators } from "./finance/indicators.mjs";
import { getTaiwanDate } from "./utils/timeUtils.mjs";
import { fetchLastPortfolioState, logDailyToSheet } from "./services/googleSheetService.mjs";

async function dailyCheck(sendPush = true) {
  try {
    console.log("🚀 開始執行 dailyCheck...");

    // 1. 從試算表繼承昨天的持股狀態
    console.log("📊 正在讀取試算表持股...");
    let lastState = null;
    try {
      lastState = await fetchLastPortfolioState();
    } catch (e) {
      console.error("⚠️ 讀取試算表失敗，將使用預設設定:", e.message);
    }

    // 如果試算表讀不到，就用 .env 的備用設定
    const config = {
      qty0050: lastState?.qty0050 ?? parseFloat(process.env.QTY_0050 || 0),
      qtyZ2: lastState?.qtyZ2 ?? parseFloat(process.env.QTY_00675L || 0),
      totalLoan:
        lastState?.totalLoan ?? parseFloat(process.env.TOTAL_LOAN || 0),
      cash: lastState?.cash ?? parseFloat(process.env.CASH || 0),
    };

    const stockStatus = `✅ 持股狀態確認：0050=${config.qty0050}股, 正2=${config.qtyZ2}股, 借款=${config.totalLoan}`;
    console.log(stockStatus);

    const symbolZ2 = "00675L.TW";
    const symbol0050 = "0050.TW";

    // 新增：抓 VIX
    console.log("📈 抓取台指恐慌指數 (VIX)...");
    const vixData = await getTwVix();
    if (vixData) {
      console.log(`✅ VIX 值：${vixData.value.toFixed(2)}`);
    } else {
      console.log("❌ VIX 抓取失敗，不影響主流程");
    }

    // 基本檢查
    const openToday = await isMarketOpenTodayTWSE();
    if (!openToday) {
      console.log("😴 當日無開市，跳過通知");
      return "當日無開市，跳過通知";
    }

    // 抓取 00675L 數據
    console.log("📥 正在抓取 00675L 數據...");
    const { basePrice } = await fetchLatestBasePrice(); // baseDate 沒用到可省略

    const today = new Date();
    const lastYear = new Date(today);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    const history = await fetchStockHistory(
      symbolZ2,
      lastYear.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10),
    );

    if (history.length < 30) return "❌ 資料不足";

    // 抓取 0050 最新價格
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
    let currentPriceZ2 = null;
    try {
      const rt = await fetchRealtimeFromMis(symbolZ2);
      currentPriceZ2 = rt?.price;
    } catch (e) { }

    if (!currentPriceZ2) {
      const latest = await fetchLatestClose(symbolZ2);
      currentPriceZ2 = latest?.close;
    }

    // 計算指標
    const { closes, rsiArr, macdArr, kdArr } = calculateIndicators(history);
    const latestClose = closes[closes.length - 1];
    const finalPriceZ2 = currentPriceZ2 || latestClose;
    const ma240 =
      closes.length >= 240
        ? closes.slice(-240).reduce((a, b) => a + b, 0) / 240
        : null;

    const latestRSI = rsiArr[rsiArr.length - 1];
    const latestKD = kdArr[kdArr.length - 1];
    const priceDropPercent = ((basePrice - finalPriceZ2) / basePrice) * 100;

    // 準備數據包
    const data = {
      priceDropPercent,
      RSI: latestRSI,
      MACDSignal: getMACDSignal(macdArr),
      KD_K: latestKD ? latestKD.k : null,
      KD_D: latestKD ? latestKD.d : null,
      currentPrice: finalPriceZ2,
      basePrice,
      price0050: price0050 || 0,
      VIX: vixData?.value ?? null,
      VIXTime: vixData?.dateTimeText ?? vixData?.time ?? null,
      VIXStatus: vixData?.status ?? null,
    };

    const signalData = {
      ...data,
      ma240: ma240,
      price0050: price0050,
      currentPrice: finalPriceZ2,
      portfolio: config,
    };

    console.log("🧠 正在計算投資訊號...");
    const result = await getInvestmentSignalAsync(
      signalData,
      rsiArr,
      macdArr,
      kdArr,
    );

    // 交易時段檢查
    const nowTaipei = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
    );
    const hour = nowTaipei.getHours();
    if (hour < 7 || hour >= 18) {
      console.log("😴 非交易時段，不發送通知");
      return "非交易時段";
    }

    // 組合戰報訊息
    let header = `【00675L ${result.strategy.leverage.targetMultiplier}倍質押戰報】`;

    let msg = `📅 資料時間：${new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}\n\n`;

    // --- 台指恐慌指數 (VIX) ---
    if (vixData) {
      // 你原先門檻照用（之後再回測微調）
      let vixStatus = "中性";
      if (vixData.value < result.strategy.threshold.vixLowComplacency)
        vixStatus = "安逸";
      else if (vixData.value > result.strategy.threshold.vixHighFear)
        vixStatus = "緊張";

      vixData.vixStatus = vixStatus;

      msg +=
        `🎭 台指恐慌指數(TAIWAN VIX)：${vixData.value.toFixed(2)}\n` +
        `   └ 漲跌：${vixData.change >= 0 ? "+" : ""}${vixData.change.toFixed(2)}｜狀態：${vixStatus}\n` +
        `   └ 時間：${vixData.dateTimeText ?? "未知"}｜Symbol：${vixData.symbolUsed}\n\n`;
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
      msg += "   └ ⚠️ 正2佔比過高，請優先評估止盈還款！\n";

    msg +=
      `\n【心理紀律】\n` +
      `   └ 33年目標：7,480萬\n` +
      `   └ 下跌是加碼的禮物，上漲是資產的果實\n\n`;

    let detailMsg =
      `🔍 數據細節：\n` +
      `   └ RSI：${result.RSI.toFixed(1)} ${result.RSI > result.strategy.threshold.rsiCoolOff ? `(>${result.strategy.threshold.rsiCoolOff})⚠️` : ""}\n` +
      `   └ KD_K：${result.KD_K.toFixed(1)} ${result.KD_K > result.strategy.threshold.kdCoolOff ? `(>${result.strategy.threshold.kdCoolOff})⚠️` : ""}\n` +
      `   └ 年線乖離：${result.bias240.toFixed(2)}% ${result.bias240 > result.strategy.threshold.bias240CoolOff ? `(>${result.strategy.threshold.bias240CoolOff})⚠️` : ""}\n\n`;

    detailMsg +=
      `🛡️ 帳戶安全狀態\n` +
      `   └ 預估維持率：${result.totalLoan > 0 ? `${result.maintenanceMargin.toFixed(1)}%` : "未質押"} ${result.maintenanceMargin < result.strategy.threshold.mmDanger ? `(<${result.strategy.threshold.mmDanger})⚠️` : "✅"} \n` +
      `   └ 正 2 淨值佔比：${result.z2Ratio.toFixed(1)}% ${result.z2Ratio > result.strategy.threshold.z2RatioHigh ? `(>${result.strategy.threshold.z2RatioHigh})⚠️` : `(距離目標 40% 尚有 ${(40 - result.z2Ratio).toFixed(1)}% 空間)`}\n` +
      `   └ 警戒上限：${result.strategy.threshold.z2RatioHigh}%（超過觸發再平衡）\n` +
      `   └ 現金儲備：${config.cash.toLocaleString()} 元\n` +
      `   └ 目前總負債：${result.totalLoan.toLocaleString()} 元\n\n` +
      `🎯 策略操作指令\n` +
      `   └ 加碼權重：${result.weightScore} 分\n` +
      `🔍 加碼權重細節：\n` +
      `   └ 基準價(校準/前次買點)：${basePrice}\n`;

    result.buyDetails.forEach((line) => (detailMsg += `   └ ${line}\n`));

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

    const flexCarousel = buildFlexCarouselFancy({
      result,
      vixData,
      config,
      dateText,
    });

    const messages = [
      {
        type: "flex",
        altText: `00675L ${result.marketStatus}`, // altText 建議短（必填）[web:405]
        contents: flexCarousel,
      },
    ];

    console.log(messages);

    if (sendPush) {
      console.log("📝 正在寫入試算表...");
      // 準備寫入的資料
      const logData = {
        ...result,
        price0050: price0050,
        currentPrice: finalPriceZ2,
        portfolio: config,
      };
      // 執行寫入 (即使失敗也不要讓程式崩潰，所以用 try catch 包起來)
      try {
        await logDailyToSheet(logData);
      } catch (sheetErr) {
        console.error(
          "❌ 寫入試算表失敗 (但不影響發送通知):",
          sheetErr.message,
        );
      }

      console.log("📤 正在發送 Line 通知...");
      await pushMessages(messages);
      console.log("✅ 執行完成！");
    }

    return { header, msg, detailMsg, messages };
  } catch (err) {
    console.error("❌ 系統發生嚴重錯誤:", err);
    if (sendPush) {
      await pushMessage(`系統錯誤：${err.message}`);
    }
    return err.message;
  }
}

export { dailyCheck };