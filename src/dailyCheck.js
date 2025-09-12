const { fetchPrices, fetch0050AnnualReturn } = require('./api/fetchYahoo');
const { calculateRSI, calculateMACD } = require('./indicators/technicalIndicators');
const { getTaiwanDayOfWeek, getTaiwanDate, isQuarterEnd } = require('./utils/timeUtils');
const { pushMessage } = require('./line/lineNotify');

async function dailyCheck(sendPush = true) {
  const closes = await fetchPrices('00631L.TW');
  if (closes.length === 0) {
    const failMsg = '無法取得行情資料，請稍後再試';
    if (sendPush) await pushMessage(failMsg);
    return failMsg;
  }

  if (closes.length < 35) {
    const shortMsg = '價格資料數量不足，無法計算MACD與RSI';
    if (sendPush) await pushMessage(shortMsg);
    return shortMsg;
  }

  const latestRSI = calculateRSI(closes);
  const latestMACD = calculateMACD(closes);
  const annualReturn0050 = await fetch0050AnnualReturn();

  let msg = `【正2 ETF 00631L 技術指標每日提醒】\n` +
            `RSI：${latestRSI.toFixed(2)}\n` +
            `MACD DIF：${latestMACD.MACD.toFixed(4)}；Signal：${latestMACD.signal.toFixed(4)}\n`;

  if (latestRSI < 30) msg += 'RSI進入超賣區，留意進場機會。\n';
  else if (latestRSI > 70) msg += 'RSI超買區，考慮獲利了結。\n';

  if (latestMACD.MACD > latestMACD.signal) msg += 'MACD呈現多頭訊號。\n';
  else msg += 'MACD呈現空頭訊號。\n';

  if (annualReturn0050 !== null) {
    msg += `\n【0050 年度投報率參考】\n今年報酬為：${annualReturn0050.toFixed(2)}%\n`;
  } else {
    msg += '\n無法取得0050年投報率資料。\n';
  }

  const dayOfWeek = getTaiwanDayOfWeek();
  const date = getTaiwanDate();
  const quarterEnd = isQuarterEnd();

  msg += `\n【特定時間注意事項】\n`;
  if (dayOfWeek === 1) {
    msg += '- 每週一開盤前：檢查上週持倉績效及當周市場消息\n';
  }
  if (date >= 28) {
    msg += '- 每月月底：檢查槓桿比例是否偏離目標，調整持倉現金比\n';
  }
  if (quarterEnd) {
    msg += '- 每季末：進行完整投資策略回顧，評估風險控管成效\n';
  }
  msg += '- 重大政策宣布或事件前後：評估市場波動，考慮風險避險\n';

  msg += `\n【心理與操作紀律】\n` +
         '- 今日是否遵守紀律，無追高恐慌賣出\n' +
         '- 保持冷靜，依計畫執行\n\n' +
         '請於盤前/盤後詳閱以上提醒，理性操作。';

  if (sendPush) {
    await pushMessage(msg);
  }
  return msg;
}

module.exports = { dailyCheck };

// 本機執行示範
if (require.main === module) {
  dailyCheck(false).then(msg => {
    console.log('\n=== 每日投資自檢訊息（本機測試） ===\n');
    console.log(msg);
  });
}