import fetch from "node-fetch";
import https from "https";

// ============================================================================
// ⚡ 網路優化設定 (共用 Agent 提升連線速度與突破防火牆)
// ============================================================================
const yahooAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  family: 4,
  timeout: 5000,
});

const baseFetchOptions = {
  agent: yahooAgent,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: "https://tw.stock.yahoo.com/",
  },
};
// ============================================================================
// 💵 取得最新 USD/TWD (美元兌台幣) 匯率與近 1 月走勢
// ============================================================================
export async function fetchUsdTwdExchangeRate() {
  const symbol = "TWD=X";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const result = {
    currentRate: null,
    previousClose: null,
    changePercent: null,
    historicalPrices: [],
  };

  try {
    const response = await fetch(url, {
      ...baseFetchOptions,
      headers: { ...baseFetchOptions.headers, Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const resultObj = data?.chart?.result?.[0];

    if (!resultObj || !resultObj.meta || !resultObj.indicators) {
      throw new Error("Yahoo Finance JSON 結構變更或無資料");
    }

    const meta = resultObj.meta;
    const closePrices = resultObj.indicators.quote[0].close;

    // 過濾掉陣列中的 null 值（Yahoo API 假日有時會回傳 null）
    const validPrices = closePrices.filter((p) => typeof p === "number");

    // 💡 增強版：昨收價防呆機制
    // 優先取 previousClose，若無則取 chartPreviousClose，再沒有就拿陣列倒數第二筆
    let prevClose = meta.previousClose || meta.chartPreviousClose;
    if (typeof prevClose !== "number" && validPrices.length >= 2) {
      prevClose = validPrices[validPrices.length - 2];
    }

    // 取得最新價格
    if (typeof meta.regularMarketPrice === "number") {
      result.currentRate = Number(meta.regularMarketPrice.toFixed(4));

      if (typeof prevClose === "number" && prevClose > 0) {
        result.previousClose = Number(prevClose.toFixed(4));
        const change = result.currentRate - result.previousClose;
        result.changePercent = Number(
          ((change / result.previousClose) * 100).toFixed(2),
        );
      }
    }

    // 將收盤價取至小數點後四位存入歷史陣列
    if (validPrices.length > 0) {
      result.historicalPrices = validPrices.map((p) => Number(p.toFixed(4)));
    }

    return result;
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("⚠️ 獲取 USD/TWD 匯率超時");
    } else {
      console.warn("⚠️ 獲取 USD/TWD 匯率失敗:", err.message);
    }
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}
