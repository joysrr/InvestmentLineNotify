import axios from "axios";

import { fetchStrategyConfig } from "./strategyConfigService.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const arr = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  return arr.map((x) => x.split(";")[0]).join("; ");
}

const toNum = (s) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : null; // 防 NaN/Infinity [web:181]
};

function formatTaifexDateTime(CDate, CTime) {
  // CDate: YYYYMMDD, CTime: HHmmss
  if (!CDate || !CTime || CDate.length !== 8) return null;
  const t = CTime.padStart(6, "0");
  const hh = t.slice(0, 2);
  const mm = t.slice(2, 4);
  const ss = t.slice(4, 6);
  return `${CDate.slice(0, 4)}/${CDate.slice(4, 6)}/${CDate.slice(6, 8)} ${hh}:${mm}:${ss}`;
}

async function getTwVix() {
  try {
    // 建 session（拿 cookie）
    const pre = await axios.get(
      "https://mis.taifex.com.tw/futures/VolatilityQuotes/",
      {
        headers: { "User-Agent": UA },
        timeout: 8000,
      },
    );
    const cookie = extractCookie(pre.headers["set-cookie"]);

    const url = "https://mis.taifex.com.tw/futures/api/getQuoteDetail";
    const candidates = ["TAIWANVIX", "RTD:1:TAIWANVIX", "RTD:1:VIX"];

    // 取得門檻
    const strategy = await fetchStrategyConfig();

    for (const symbol of candidates) {
      const { data } = await axios.post(
        url,
        { SymbolID: [symbol] },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": UA,
            Referer: "https://mis.taifex.com.tw/futures/VolatilityQuotes/",
            Origin: "https://mis.taifex.com.tw",
            ...(cookie ? { Cookie: cookie } : {}),
          },
          timeout: 8000,
        },
      );

      const quote = data?.RtData?.QuoteList?.[0] ?? data?.QuoteDetail?.[0];
      if (!quote) continue;

      // 你實際拿到的欄位就是這套
      const value = toNum(quote.CLastPrice) ?? toNum(quote.CRefPrice);
      if (value == null) continue;

      const prev = toNum(quote.CRefPrice);
      const change = value != null && prev != null ? value - prev : 0;

      let status = "中性";
      if (value < strategy.threshold.vixLowComplacency)
        status = "安逸";
      else if (value > strategy.threshold.vixHighFear)
        status = "緊張";

      return {
        symbolUsed: symbol,
        value,
        change,
        status,
        date: quote.CDate ?? null,
        time: quote.CTime ?? null,
        dateTimeText: formatTaifexDateTime(quote.CDate, quote.CTime),
      };
    }

    return null;
  } catch (e) {
    console.error("VIX 抓取失敗:", e.message);
    return null;
  }
}

export { getTwVix };