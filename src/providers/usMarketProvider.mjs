import axios from "axios";

async function fetchFredSeriesLast2(seriesId) {
  const apiKey = process.env.FRED_API_KEY; // 建議加，穩定 [web:945]
  const url =
    "https://api.stlouisfed.org/fred/series/observations" +
    `?series_id=${encodeURIComponent(seriesId)}` +
    "&file_type=json&sort_order=asc&limit=20" +
    (apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "");

  const res = await axios.get(url, { timeout: 12_000 });
  const obs = res.data?.observations || [];

  // 從後往前挑兩個「可用數值」（FRED 偶爾會有 "."）
  const vals = [];
  for (let i = obs.length - 1; i >= 0 && vals.length < 2; i--) {
    const v = Number(obs[i]?.value);
    if (Number.isFinite(v)) vals.push({ date: obs[i].date, value: v });
  }
  if (vals.length < 2) return null;

  const latest = vals[0];
  const prev = vals[1];
  return {
    date: latest.date,
    value: latest.value,
    changePercent: prev.value ? ((latest.value - prev.value) / prev.value) * 100 : null,
  };
}

export async function fetchUsMarketData() {
  // VIXCLS: VIX 收盤；SP500: S&P500 收盤 [web:871][web:943]
  const [vix, spx] = await Promise.allSettled([
    fetchFredSeriesLast2("VIXCLS"),
    fetchFredSeriesLast2("SP500"),
  ]);

  return {
    vix: vix.status === "fulfilled" ? vix.value : null,
    spx: spx.status === "fulfilled" ? spx.value : null,
    source: "FRED",
  };
}