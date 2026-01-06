const { fetchLatestBasePrice } = require("./services/basePriceService");
const {
  fetchStockHistory,
  fetchRealTimePrice,
  calculateIndicators,
} = require("./finance/financeUtils");
const {
  checkInvestmentSignalVerbose,
  getMACDSignal,
} = require("./services/stockAnalysisService");
const { pushMessage } = require("./line/lineNotify");
const {
  getTaiwanDayOfWeek,
  getTaiwanDate,
  isQuarterEnd,
} = require("./utils/timeUtils");

async function dailyCheck(sendPush = true) {
  try {
    // 取得基準價
    console.log("正在抓取基準價格...");
    const url =
      "https://raw.githubusercontent.com/joysrr/joysrr.github.io/refs/heads/master/Stock/BasePrice.txt";
    const { baseDate, basePrice } = await fetchLatestBasePrice(url);

    const today = new Date();
    const todayTW = new Date(
      today.toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
    );
    todayTW.setHours(0, 0, 0, 0); // 當日凌晨

    const lastYear = new Date(today);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    console.log(`基準日: ${baseDate}, 基準價: ${basePrice}`);

    const history = await fetchStockHistory(
      "00675L.TW",
      lastYear.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10),
    );

    console.log(`歷史資料筆數: ${history.length}`);

    const { price: realTimePrice, time: realTimeTimestamp } =
      await fetchRealTimePrice("00675L.TW");

    console.log(`即時價: ${realTimePrice}, 時間: ${realTimeTimestamp}`);

    // 判斷即時報價是否屬於當日台北時間
    let showRealTime = false;
    if (realTimeTimestamp) {
      const realTimeTW = new Date(
        realTimeTimestamp.toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
      );
      realTimeTW.setHours(0, 0, 0, 0);
      if (realTimeTW.getTime() === todayTW.getTime()) {
        showRealTime = true;
      }
    }

    if (history.length < 30) {
      const msg = "資料不足，無法計算指標。";
      if (sendPush) await pushMessage(msg);
      return msg;
    }
    console.log("正在計算資料...");

    const { closes, highs, lows, rsiArr, macdArr, kdArr } =
      calculateIndicators(history);

    const latestTradeDate = new Date(
      realTimeTimestamp.toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
    ).toLocaleDateString("zh-TW");
    const latestDate = history[history.length - 1].date;
    const latestClose = closes[closes.length - 1];
    const latestRSI = rsiArr[rsiArr.length - 1];
    const macdSignal = getMACDSignal(macdArr);
    const latestKD = kdArr[kdArr.length - 1];
    const priceDropPercent = ((basePrice - latestClose) / basePrice) * 100;
    const realTimePriceChangePercent =
      ((realTimePrice - basePrice) / basePrice) * 100;

    const data = {
      priceDropPercent,
      RSI: latestRSI,
      MACDSignal: macdSignal,
      KD_K: latestKD ? latestKD.k : null,
      KD_D: latestKD ? latestKD.d : null,
      currentPrice: latestClose,
      basePrice,
    };

    const result = checkInvestmentSignalVerbose(data, rsiArr, macdArr);

    // 如果最新交易日與今天不同，通常是當日休市
    const todayTaipei = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
    );
    const todayStr = todayTaipei.toLocaleDateString("zh-TW");

    const isMarketOpenToday = latestTradeDate === todayStr;

    if (!isMarketOpenToday) {
      console.log(`當日無開市，不發送通知，上次開市日期: ${latestTradeDate}`);
      return "當日無開市，跳過通知";
    } else {
      console.log("當日有開市，發送通知");
    }

    // 取得目前台北時間
    const hour = todayTaipei.getHours();

    // 判斷時間是否在 07:00~15:00 間
    if (hour < 7 || hour >= 15) {
      console.log("目前時間非交易時段，跳過發送通知");
      return "非交易時段，未發送通知";
    }

    // 組即時價格通知（僅當為當日價格時）
    let realTimeMsg = "";
    if (showRealTime) {
      realTimeMsg =
        `【00675L 即時價格資訊】（資料時間: ${realTimeTimestamp.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) || "無法取得時間"}）\n` +
        `即時價: ${realTimePrice}\n` +
        `即時價相對基準價漲跌幅(%): ${realTimePriceChangePercent.toFixed(2)}\n`;
    }

    let msg = `【00675L 技術指標分析】（資料時間: ${new Date(latestDate).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}）\n基準日: ${baseDate}, 基準價: ${basePrice}\n買賣建議: ${
      result.suggestion
    }\n\n買入權重細節:\n`;
    result.buyDetails.forEach((line) => (msg += ` - ${line}\n`));
    msg += `\n賣出訊號細節:\n`;
    result.sellDetails.forEach((line) => (msg += ` - ${line}\n`));
    msg += `\n槓桿與資金配置建議:\n`;
    msg += ` - 槓桿比例: ${(result.allocation.leverage * 100).toFixed(0)}%\n`;
    msg += ` - 現金比例: ${(result.allocation.cash * 100).toFixed(0)}%\n`;
    msg += `\n價格與技術指標資訊：\n`;
    msg += ` - 現價: ${result.currentPrice}\n`;
    msg += ` - 跌幅(%): ${result.priceDropPercent.toFixed(2)}\n`;
    msg += ` - RSI: ${result.RSI.toFixed(2)}\n`;
    msg += ` - MACD訊號: ${result.MACDSignal}\n`;
    msg += ` - KD K: ${result.KD_K.toFixed(2)}\n`;
    msg += ` - KD D: ${result.KD_D.toFixed(2)}\n`;
    msg += ` - 漲幅(%): ${result.priceUpPercent}\n`;
    msg += ` - 賣出指標成立數量: ${result.sellSignalCount}\n`;

    const dayOfWeek = getTaiwanDayOfWeek();
    const date = getTaiwanDate();
    const quarterEnd = isQuarterEnd();

    msg += `\n【特定時間注意事項】\n`;
    if (dayOfWeek === 1) {
      msg += "- 每週一開盤前：檢查上週持倉績效及當周市場消息\n";
    }
    if (date >= 28) {
      msg += "- 每月月底：檢查槓桿比例是否偏離目標，調整持倉現金比\n";
    }
    if (quarterEnd) {
      msg += "- 每季末：進行完整投資策略回顧，評估風險控管成效\n";
    }
    msg += "- 重大政策宣布或事件前後：評估市場波動，考慮風險避險\n";

    msg += `\n【心理與操作紀律】\n- 今日是否遵守紀律，無追高恐慌賣出\n- 保持冷靜，依計畫執行\n\n請於盤前/盤後詳閱以上提醒，理性操作。`;

    if (sendPush) {
      if (showRealTime) await pushMessage(realTimeMsg);
      await pushMessage(msg);
    }

    return `${realTimeMsg}\n\n${msg}`;
  } catch (err) {
    const errMsg = `資料抓取錯誤: ${err.message || err}`;
    console.error(errMsg);
    if (sendPush) await pushMessage(errMsg);
    return errMsg;
  }
}

module.exports = { dailyCheck };

// 本機執行示範用
if (require.main === module) {
  dailyCheck(false).then((msg) => {
    console.log("\n=== 每日投資自檢訊息（本機測試） ===\n");
    console.log(msg);
  });
}
