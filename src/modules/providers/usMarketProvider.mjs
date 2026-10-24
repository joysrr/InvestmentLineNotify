import { fetchStrategyConfig } from "../strategy/signalRules.mjs";
import { fetchWithTimeout, parseNumber } from "../../utils/coreUtils.mjs";

async function analyzeUsRisk(data) {
  const strategy = await fetchStrategyConfig();

  // 取得設定檔參數，並加上預設值以策安全
  const th = strategy?.threshold || {};
  const VIX_PANIC = th.usVixPanic || 30;
  const VIX_HIGH = th.vixHighFear || 20;
  const VIX_LOW = th.vixLowComplacency || 13.5;

  // 使用 coreUtils 進行安全的數字轉換 (若無效會回傳 null)
  const vixVal = parseNumber(data?.vix?.value);
  const spxChg = parseNumber(data?.spx?.changePercent);

  const spxChgText = spxChg !== null ? `${spxChg.toFixed(2)}%` : "N/A";
  const vixText = vixVal !== null ? vixVal.toFixed(2) : "N/A";

  let riskLevel = "正常";
  let riskIcon = "✅";
  let suggestion = "依原策略執行";
  let isHighRisk = false;

  // --- 判斷邏輯 (優先級由高到低) ---
  // 1. 🚨 極高風險：VIX 破 30 或 標普大跌超過 3%
  if (
    (vixVal !== null && vixVal >= VIX_PANIC) ||
    (spxChg !== null && spxChg <= -3)
  ) {
    riskLevel = "極高風險";
    riskIcon = "🚨";
    suggestion = "全面禁止撥款，保留現金，嚴守維持率";
    isHighRisk = true;
  }
  // 2. ⚠️ 高風險：VIX 破 20 或 標普跌幅超過 2%
  else if (
    (vixVal !== null && vixVal >= VIX_HIGH) ||
    (spxChg !== null && spxChg <= -2)
  ) {
    riskLevel = "高風險";
    riskIcon = "⚠️";
    suggestion = "暫停00675L新增撥款，偏防守為主";
    isHighRisk = true;
  }
  // 3. 📈 風險升高：標普跌幅超過 1%
  else if (spxChg !== null && spxChg <= -1) {
    riskLevel = "風險升高";
    riskIcon = "📈";
    suggestion = "偏保守，暫緩市價追價加碼";
    isHighRisk = false;
  }
  // 4. 🔥 過度安逸：VIX 低於 13.5
  else if (vixVal !== null && vixVal < VIX_LOW) {
    riskLevel = "過度安逸";
    riskIcon = "🔥";
    suggestion = "居高思危，防範市場樂觀過頭的回馬槍";
    isHighRisk = false;
  }

  return {
    success: Boolean(vixVal !== null || spxChg !== null),
    vix: vixText,
    spxChg: spxChgText,
    riskLevel,
    riskIcon,
    suggestion,
    isHighRisk,
    meta: {
      vixDate: data?.vix?.date ?? null,
      spxDate: data?.spx?.date ?? null,
    },
  };
}

export async function fetchYahooChartSeriesLast2(
  symbol,
  { fetcherFn = null } = {},
) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10d&interval=1d`;

  try {
    const response =
      typeof fetcherFn === "function"
        ? await fetcherFn(url)
        : await fetchWithTimeout(
            url,
            {
              headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "application/json",
              },
            },
            12000,
          );
    if (!response.ok)
      throw new Error(`Yahoo Chart API HTTP ${response.status}`);

    const result = (await response.json())?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const rows = timestamps
      .map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        value: parseNumber(closes[index]),
      }))
      .filter((row) => row.value !== null);

    if (rows.length < 2) return null;

    const latest = rows.at(-1);
    const previous = rows.at(-2);
    return {
      symbol: result?.meta?.symbol ?? symbol,
      latest,
      previous,
      changePercent:
        previous.value !== 0
          ? ((latest.value - previous.value) / previous.value) * 100
          : null,
    };
  } catch (error) {
    console.warn(`⚠️ 獲取 Yahoo Chart 資料 (${symbol}) 失敗:`, error.message);
    return null;
  }
}

async function fetchFredSeriesLast2(seriesId) {
  const apiKey = process.env.FRED_API_KEY;
  const url =
    "https://api.stlouisfed.org/fred/series/observations" +
    `?series_id=${encodeURIComponent(seriesId)}` +
    "&file_type=json&sort_order=desc&limit=10" +
    (apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "");

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      },
      12000,
    );
    if (!response.ok) throw new Error(`FRED API HTTP ${response.status}`);

    const data = await response.json();
    const values = [];
    for (const observation of data?.observations ?? []) {
      const value = parseNumber(observation?.value);
      if (value !== null) values.push({ date: observation.date, value });
      if (values.length === 2) break;
    }
    if (values.length < 2) return null;

    const [latest, previous] = values;
    return {
      raw: data,
      date: latest.date,
      value: latest.value,
      changePercent:
        previous.value !== 0
          ? ((latest.value - previous.value) / previous.value) * 100
          : null,
    };
  } catch (error) {
    console.warn(`⚠️ 獲取 FRED 資料 (${seriesId}) 失敗:`, error.message);
    return null;
  }
}

export async function fetchUsMarketData() {
  const [vixResult, spxResult, soxResult, tsmResult] = await Promise.allSettled(
    [
      fetchFredSeriesLast2("VIXCLS"),
      fetchFredSeriesLast2("SP500"),
      fetchYahooChartSeriesLast2("^SOX"),
      fetchYahooChartSeriesLast2("TSM"),
    ],
  );

  const vix = vixResult.status === "fulfilled" ? vixResult.value : null;
  const spx = spxResult.status === "fulfilled" ? spxResult.value : null;
  const sox = soxResult.status === "fulfilled" ? soxResult.value : null;
  const tsm = tsmResult.status === "fulfilled" ? tsmResult.value : null;

  const riskAnalysis = await analyzeUsRisk({ vix, spx });
  const normalized = {
    ...riskAnalysis,
    soxChg: sox?.changePercent ?? null,
    tsmChg: tsm?.changePercent ?? null,
    source: "FRED+YAHOO",
  };
  const raw = {
    vix: vix?.raw ?? null,
    spx: spx?.raw ?? null,
    sox,
    tsm,
  };
  return { raw, normalized, ...normalized };
}
