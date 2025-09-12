const axios = require('axios');

async function fetchPrices(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`;
  try {
    const res = await axios.get(url);
    const prices = res.data.chart.result[0].indicators.quote[0].close;
    return prices.filter(p => p !== null);
  } catch (err) {
    console.error('取得股價錯誤:', err.message);
    return [];
  }
}

async function fetch0050AnnualReturn() {
  const symbol = '0050.TW';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;
  try {
    const res = await axios.get(url);
    const closes = res.data.chart.result[0].indicators.quote[0].close.filter(p => p !== null);
    if (closes.length === 0) return null;
    const firstPrice = closes[0];
    const lastPrice = closes[closes.length - 1];
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  } catch (err) {
    console.error('取得0050價格錯誤:', err.message);
    return null;
  }
}

module.exports = { fetchPrices, fetch0050AnnualReturn };
