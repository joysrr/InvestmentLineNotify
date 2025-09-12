const ti = require('technicalindicators');

function calculateRSI(values) {
  const rsiArr = ti.RSI.calculate({ values, period: 14 });
  return rsiArr[rsiArr.length - 1];
}

function calculateMACD(values) {
  const macdArr = ti.MACD.calculate({
    values,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  return macdArr[macdArr.length - 1];
}

module.exports = { calculateRSI, calculateMACD };
