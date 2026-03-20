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
// 💵 取得最新 USD/TWD (美元兌台幣) 匯率
// ============================================================================
export async function fetchUsdTwdExchangeRate() {
  // 使用 Yahoo Finance 的內部 Chart API，抓取 1 天、間隔 1 分鐘的最新資料
  const symbol = "TWD=X";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  // 預設 Fallback 值
  const result = {
    exchangeRate: null,
    previousClose: null,
    change: null,
    changePercent: null,
  };

  try {
    const response = await fetch(url, {
      ...baseFetchOptions,
      // 覆蓋 Accept 標頭，告訴伺服器我們只要 JSON
      headers: { ...baseFetchOptions.headers, Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const resultObj = data?.chart?.result?.[0];

    if (!resultObj || !resultObj.meta) {
      throw new Error("Yahoo Finance JSON 結構變更或無資料");
    }

    const meta = resultObj.meta;

    // 取得最新價格與昨收價
    const currentPrice = meta.regularMarketPrice;
    const prevClose = meta.previousClose;

    if (typeof currentPrice === "number") {
      result.exchangeRate = Number(currentPrice.toFixed(4)); // 匯率通常取到小數點後四位

      if (typeof prevClose === "number" && prevClose > 0) {
        result.previousClose = Number(prevClose.toFixed(4));
        result.change = Number((currentPrice - prevClose).toFixed(4));
        // 計算漲跌幅 (%)，台幣匯率數字往上代表「台幣貶值 / 美元升值」
        result.changePercent = Number(
          ((result.change / prevClose) * 100).toFixed(2),
        );
      }
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
