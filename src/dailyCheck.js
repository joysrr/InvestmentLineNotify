require("dotenv").config();

const { fetchLatestBasePrice } = require("./services/basePriceService");
const { pushMessage } = require("./services/notifyService");
const {
  getInvestmentSignalAsync,
  getMACDSignal,
} = require("./services/stockSignalService");

const {
  fetchStockHistory,
  fetchLatestClose,
} = require("./providers/twse/twseStockDayProvider");
const { fetchRealtimeFromMis } = require("./providers/twse/twseMisProvider");
const {
  isMarketOpenTodayTWSE,
} = require("./providers/twse/twseCalendarProvider");

const { calculateIndicators } = require("./finance/indicators");
const {
  getTaiwanDayOfWeek,
  getTaiwanDate,
  isQuarterEnd,
} = require("./utils/timeUtils");

/**
 * 對外仍提供 dailyCheck(sendPush=true)
 * symbol 固定 00675L.TW（你目前需求）
 */
async function dailyCheck(sendPush = true) {
  try {
    const symbol = "00675L.TW";

    console.log("正在抓取基準價格...");
    const { baseDate, basePrice } = await fetchLatestBasePrice();
    console.log(`基準日: ${baseDate}, 基準價: ${basePrice}`);

    const today = new Date();
    const lastYear = new Date(today);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    console.log("正在抓取歷史資料...");
    const history = await fetchStockHistory(
      symbol,
      lastYear.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10),
    );
    console.log(`歷史資料筆數: ${history.length}`);

    if (history.length < 30) {
      const msg = "資料不足，無法計算指標。";
      if (sendPush) await pushMessage(msg);
      return msg;
    }

    // 精準判斷「今天是否開市」（與交易時間無關）
    const openToday = await isMarketOpenTodayTWSE();
    if (!openToday) {
      console.log("當日無開市，不發送通知");
      return "當日無開市，跳過通知";
    }

    // 即時價（MIS 抓不到就 fallback 收盤）
    let realTimePrice = null;
    let realTimeTimestamp = null;

    try {
      const rt = await fetchRealtimeFromMis(symbol);
      if (rt?.price != null) {
        console.log("成功取得 MIS 即時價");
        realTimePrice = rt.price;
        realTimeTimestamp = rt.time;
      } else {
        console.log("MIS 即時價為空，改用收盤價 fallback");
        const latest = await fetchLatestClose(symbol);
        realTimePrice = latest?.close ?? null;
        realTimeTimestamp = latest?.date
          ? new Date(`${latest.date}T13:30:00+08:00`)
          : null;
      }
    } catch (e) {
      console.error("MIS 抓取失敗，改用收盤價 fallback:", e.message);
      const latest = await fetchLatestClose(symbol);
      realTimePrice = latest?.close ?? null;
      realTimeTimestamp = latest?.date
        ? new Date(`${latest.date}T13:30:00+08:00`)
        : null;
    }

    console.log(
      `價格(即時或收盤fallback): ${realTimePrice}, 時間: ${realTimeTimestamp}`,
    );

    console.log("正在計算指標...");
    const { closes, rsiArr, macdArr, kdArr } = calculateIndicators(history);

    const latestDate = history[history.length - 1].date;
    const latestClose = closes[closes.length - 1];
    const latestRSI = rsiArr[rsiArr.length - 1];
    const macdSignal = getMACDSignal(macdArr);
    const latestKD = kdArr[kdArr.length - 1];

    const priceDropPercent = ((basePrice - latestClose) / basePrice) * 100;
    const realTimePriceChangePercent =
      realTimePrice == null
        ? null
        : ((realTimePrice - basePrice) / basePrice) * 100;

    const data = {
      priceDropPercent,
      RSI: latestRSI,
      MACDSignal: macdSignal,
      KD_K: latestKD ? latestKD.k : null,
      KD_D: latestKD ? latestKD.d : null,
      currentPrice: latestClose,
      basePrice,
    };

    const result = await getInvestmentSignalAsync(data, rsiArr, macdArr);

    // 交易時段判斷（你原本邏輯保留：只在 07~15 發送）
    const nowTaipei = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
    );
    const hour = nowTaipei.getHours();
    if (hour < 7 || hour >= 15) {
      console.log("目前時間非交易時段，跳過發送通知");
      return "非交易時段，未發送通知";
    }

    let realTimeMsg = "";
    if (
      openToday &&
      realTimePrice != null &&
      realTimePriceChangePercent != null
    ) {
      realTimeMsg =
        `【00675L 價格資訊】（資料時間: ${realTimeTimestamp.toLocaleString(
          "zh-TW",
          {
            timeZone: "Asia/Taipei",
          },
        )}）\n` +
        `價格: ${realTimePrice}\n` +
        `相對基準價漲跌幅(%): ${realTimePriceChangePercent.toFixed(2)}\n`;
    }

    let msg =
      `【00675L 技術指標分析】（資料時間: ${new Date(
        latestDate,
      ).toLocaleDateString("zh-TW", {
        timeZone: "Asia/Taipei",
      })}）\n` +
      `基準日: ${baseDate}, 基準價: ${basePrice}\n` +
      `買賣建議: ${result.suggestion}\n\n` +
      `買入權重細節:\n`;

    console.log("strategy result keys:", Object.keys(result || {}));
    console.log(
      "buyDetails type:",
      Array.isArray(result?.buyDetails),
      "sellDetails type:",
      Array.isArray(result?.sellDetails),
    );

    result.buyDetails.forEach((line) => (msg += ` - ${line}\n`));

    msg += `\n賣出訊號細節:\n`;
    result.sellDetails.forEach((line) => (msg += ` - ${line}\n`));

    msg += `\n槓桿與資金配置建議:\n`;
    msg += ` - 槓桿比例: ${(result.allocation.leverage * 100).toFixed(0)}%\n`;
    msg += ` - 現金比例: ${(result.allocation.cash * 100).toFixed(0)}%\n`;

    msg += `\n價格與技術指標資訊：\n`;
    msg += ` - 現價(指標基準): ${result.currentPrice}\n`;
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
    if (dayOfWeek === 1)
      msg += "- 每週一開盤前：檢查上週持倉績效及當周市場消息\n";
    if (date >= 28)
      msg += "- 每月月底：檢查槓桿比例是否偏離目標，調整持倉現金比\n";
    if (quarterEnd) msg += "- 每季末：進行完整投資策略回顧，評估風險控管成效\n";
    msg += "- 重大政策宣布或事件前後：評估市場波動，考慮風險避險\n";

    msg +=
      `\n【心理與操作紀律】\n` +
      `- 今日是否遵守紀律，無追高恐慌賣出\n` +
      `- 保持冷靜，依計畫執行\n\n` +
      `請於盤前/盤後詳閱以上提醒，理性操作。`;

    if (sendPush) {
      if (realTimeMsg) await pushMessage(realTimeMsg);
      await pushMessage(msg);
    }

    return `${realTimeMsg}\n\n${msg}`.trim();
  } catch (err) {
    const errMsg = `資料抓取錯誤: ${err.message || err}`;
    console.error(errMsg);
    if (sendPush) await pushMessage(errMsg);
    return errMsg;
  }
}

module.exports = { dailyCheck };

if (require.main === module) {
  dailyCheck(false).then((msg) => {
    console.log("\n=== 每日投資自檢訊息（本機測試） ===\n");
    console.log(msg);
  });
}
