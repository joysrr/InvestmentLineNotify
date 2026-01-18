require("dotenv").config();

const { fetchLatestBasePrice } = require("./services/basePriceService");
const { pushMessage } = require("./services/notifyService");
const { getInvestmentSignalAsync } = require("./services/stockSignalService");

const {
  fetchStockHistory,
  fetchLatestClose,
} = require("./providers/twse/twseStockDayProvider");
const { fetchRealtimeFromMis } = require("./providers/twse/twseMisProvider");
const {
  isMarketOpenTodayTWSE,
} = require("./providers/twse/twseCalendarProvider");

const { calculateIndicators } = require("./finance/indicators");
const { getTaiwanDate } = require("./utils/timeUtils");

// 引入你剛建立的 Google Sheet 服務
const {
  fetchLastPortfolioState,
  logDailyToSheet,
} = require("./services/googleSheetService");

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

    console.log(
      `✅ 持股狀態確認: 0050=${config.qty0050}股, 正2=${config.qtyZ2}股, 借款=${config.totalLoan}`,
    );

    const symbolZ2 = "00675L.TW";
    const symbol0050 = "0050.TW";

    // 2. 基本檢查 (★ 測試時建議先註解掉這段，否則假日會直接結束)
    /*
    const openToday = await isMarketOpenTodayTWSE();
    if (!openToday) {
      console.log("😴 當日無開市，跳過通知");
      return "當日無開市，跳過通知";
    }
    */

    // 3. 抓取 00675L 數據
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

    // 4. 抓取 0050 最新價格
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
    console.log(`💰 取得 0050 價格: ${price0050}`);

    // 5. 抓取 00675L 即時價
    let currentPriceZ2 = null;
    try {
      const rt = await fetchRealtimeFromMis(symbolZ2);
      currentPriceZ2 = rt?.price;
    } catch (e) {}

    if (!currentPriceZ2) {
      const latest = await fetchLatestClose(symbolZ2);
      currentPriceZ2 = latest?.close;
    }

    // 6. 計算指標
    const { closes, rsiArr, macdArr, kdArr } = calculateIndicators(history);
    const latestClose = closes[closes.length - 1];
    const finalPriceZ2 = currentPriceZ2 || latestClose;

    const latestRSI = rsiArr[rsiArr.length - 1];
    const latestKD = kdArr[kdArr.length - 1];
    const priceDropPercent = ((basePrice - finalPriceZ2) / basePrice) * 100;

    // 7. 準備數據包
    const data = {
      priceDropPercent,
      RSI: latestRSI,
      MACDSignal: require("./services/stockSignalService").getMACDSignal(
        macdArr,
      ),
      KD_K: latestKD ? latestKD.k : null,
      KD_D: latestKD ? latestKD.d : null,
      currentPrice: finalPriceZ2,
      basePrice,
      price0050: price0050 || 0,
    };

    const signalData = {
      ...data,
      price0050: price0050,
      currentPrice: finalPriceZ2,
      portfolio: config,
    };

    console.log("🧠 正在計算投資訊號...");
    const result = await getInvestmentSignalAsync(signalData, rsiArr, macdArr);

    // 8. 交易時段檢查 (★ 測試時建議先註解掉，否則晚上會沒反應)
    /*
    const nowTaipei = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    const hour = nowTaipei.getHours();
    if (hour < 7 || hour >= 15) {
        console.log("😴 非交易時段，不發送通知");
        return "非交易時段";
    }
    */

    // 9. 組合戰報訊息
    let msg =
      `【00675L 1.8倍質押戰報】\n` +
      `📅 資料時間: ${new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}\n\n` +
      `🛡️ 帳戶安全狀態\n` +
      ` - 預估維持率: ${result.maintenanceMargin.toFixed(1)}% ${result.maintenanceMargin < 160 ? "⚠️ 危險" : "✅ 安全"}\n` +
      ` - 正 2 淨值佔比: ${result.z2Ratio.toFixed(1)}% ${result.z2Ratio > 42 ? "⚠️ 過高" : "(基準 40%)"}\n` +
      ` - 現金儲備: ${config.cash.toLocaleString()} 元\n` + // ★ 顯示現金
      ` - 目前總負債: ${result.totalLoan.toLocaleString()} 元\n\n` +
      `🎯 策略操作指令\n` +
      ` - 當前總權重: ${result.weightScore} 分\n` +
      ` - 行動建議: ${result.suggestion}\n\n` +
      `🔍 買入權重細節 (基準價: ${basePrice}):\n`;

    result.buyDetails.forEach((line) => (msg += ` - ${line}\n`));

    msg +=
      `\n💰 止盈還款監控:\n` +
      ` - 正 2 漲幅: ${result.priceUpPercent}%\n` +
      ` - 賣出指標數: ${result.sellSignalCount} (RSI/MACD/KD)\n`;

    const date = getTaiwanDate();
    msg += `\n📅 重要提醒:\n`;
    if (date === 9) msg += "- 今日 9 號：執行定期定額與撥款校準\n";
    if (date === 21) msg += "- 今日 21 號：扣息日，檢查交割戶餘額\n";
    if (result.z2Ratio > 42) msg += "- ⚠️ 正2佔比過高，請優先評估止盈還款！\n";

    msg +=
      `\n【心理紀律】\n` +
      `- 33年目標：7,480萬\n` +
      `- 下跌是加碼的禮物，上漲是資產的果實`;

    // 10. ★ 關鍵修正：將寫入與發送移到 try 區塊內
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
        console.error("❌ 寫入試算表失敗 (但不影響發送通知):", sheetErr.message);
      }
      
      console.log("📤 正在發送 Line 通知...");
      await pushMessage(msg);
      console.log("✅ 執行完成！");
    }

    return msg;
  } catch (err) {
    console.error("❌ 系統發生嚴重錯誤:", err);
    if (sendPush) {
      await pushMessage(`系統錯誤: ${err.message}`);
    }
    return err.message;
  }
}

module.exports = { dailyCheck };

if (require.main === module) {
  dailyCheck(false).then((msg) => {
    console.log("\n=== 每日投資自檢訊息（本機測試） ===\n");
    console.log(msg);
  });
}
