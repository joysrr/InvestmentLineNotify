require('dotenv').config();
const axios = require('axios');
const ti = require('technicalindicators');

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const USER_ID = process.env.USER_ID;

// 推送LINE訊息
async function pushMessage(text) {
  try {
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: USER_ID,
      messages: [{ type: 'text', text }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      }
    });
    console.log('LINE訊息已發送');
  } catch (err) {
    console.error('LINE推送錯誤:', err.response?.data || err.message);
  }
}

// 抓取收盤價（Yahoo Finance）
async function fetchPrices(symbol = '00631L.TW') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`;
  try {
    const res = await axios.get(url);
    const prices = res.data.chart.result[0].indicators.quote[0].close;
    return prices.filter(p => p !== null);
  } catch (err) {
    console.error('取得股價錯誤:', err.message);
    return [];
  }
}

// 取得0050當年度投報率
async function fetch0050AnnualReturn() {
  const symbol = '0050.TW';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;

  try {
    const res = await axios.get(url);
    const closes = res.data.chart.result[0].indicators.quote[0].close.filter(p => p !== null);

    if (closes.length === 0) return null;

    const firstPrice = closes[0];
    const lastPrice = closes[closes.length - 1];
    const annualReturn = ((lastPrice - firstPrice) / firstPrice) * 100;
    return annualReturn;
  } catch (error) {
    console.error('取得0050價格錯誤:', error.message);
    return null;
  }
}

// 取得今天是星期幾（0=週日，1=週一...）
function getTaiwanDayOfWeek() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return taiwanTime.getUTCDay();
}

// 取得今天是幾號（用於月末判斷）
function getTaiwanDate() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return taiwanTime.getUTCDate();
}

// 判斷是否季末（3,6,9,12月最後一天）
function isQuarterEnd() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const month = taiwanTime.getUTCMonth() + 1;
  const date = taiwanTime.getUTCDate();

  if ([3, 6, 9, 12].includes(month)) {
    const lastDay = new Date(taiwanTime.getUTCFullYear(), month, 0).getUTCDate();
    if (date === lastDay) return true;
  }
  return false;
}

async function dailyCheck() {
  const closes = await fetchPrices();

  if (closes.length === 0) {
    await pushMessage('無法取得行情資料，請稍後再試');
    return;
  }

  // 技術指標計算
  const rsi = ti.RSI.calculate({ values: closes, period: 14 });
  const latestRSI = rsi[rsi.length - 1];

  const macdInput = {
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  };
  const macdResult = ti.MACD.calculate(macdInput);
  const latestMACD = macdResult[macdResult.length - 1];

  // 取得0050投報率
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

  // 特定時間提醒判斷
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

  // 心理與操作提醒
  msg += `\n【心理與操作紀律】\n` +
         '- 今日是否遵守紀律，無追高恐慌賣出\n' +
         '- 保持冷靜，依計畫執行\n\n' +
         '請於盤前/盤後詳閱以上提醒，理性操作。';

  await pushMessage(msg);
}

exports.handler = async function(event, context) {
  await dailyCheck();
  return {
    statusCode: 200,
    body: 'LINE 技術指標與投報率每日通知已發送',
  };
};