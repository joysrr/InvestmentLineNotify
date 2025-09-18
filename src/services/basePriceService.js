const fetch = require("node-fetch");

async function fetchLatestBasePrice(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP 錯誤 ${response.status}`);
    const text = await response.text();
    const lines = text.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const [baseDate, basePriceStr] = lastLine.split(",").map((s) => s.trim());
    const basePrice = parseFloat(basePriceStr);
    if (!baseDate || isNaN(basePrice))
      throw new Error("基準格式錯誤，無法解析最後一行");
    return { baseDate, basePrice };
  } catch (e) {
    console.error("抓取基準價格失敗:", e);
    throw e;
  }
}

module.exports = { fetchLatestBasePrice };