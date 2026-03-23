import axios from "axios";
import { fetchStrategyConfig } from "../strategy/signalRules.mjs";

async function analyzeUsRisk(data) {
  const strategy = await fetchStrategyConfig();

  // 取得設定檔參數，並加上預設值以策安全
  const th = strategy?.threshold || {};
  const VIX_PANIC = th.usVixPanic || 30;
  const VIX_HIGH = th.vixHighFear || 20;
  const VIX_LOW = th.vixLowComplacency || 13.5;

  const vixVal = Number(data?.vix?.value);
  const spxChg = Number(data?.spx?.changePercent);

  const spxChgText = Number.isFinite(spxChg) ? `${spxChg.toFixed(2)}%` : "N/A";
  const vixText = Number.isFinite(vixVal) ? vixVal.toFixed(2) : "N/A";

  let riskLevel = "正常";
  let riskIcon = "✅";
  let suggestion = "依原策略執行";
  let isHighRisk = false;

  // --- 判斷邏輯 (優先級由高到低) ---
  // 1. 🚨 極高風險：VIX 破 30 或 標普大跌超過 3%
  if (
    (Number.isFinite(vixVal) && vixVal >= VIX_PANIC) ||
    (Number.isFinite(spxChg) && spxChg <= -3)
  ) {
    riskLevel = "極高風險";
    riskIcon = "🚨";
    suggestion = "全面禁止撥款，保留現金，嚴守維持率";
    isHighRisk = true;
  }
  // 2. ⚠️ 高風險：VIX 破 20 或 標普跌幅超過 2%
  else if (
    (Number.isFinite(vixVal) && vixVal >= VIX_HIGH) ||
    (Number.isFinite(spxChg) && spxChg <= -2)
  ) {
    riskLevel = "高風險";
    riskIcon = "⚠️";
    suggestion = "暫停00675L新增撥款，偏防守為主";
    isHighRisk = true;
  }
  // 3. 📈 風險升高：標普跌幅超過 1%
  else if (Number.isFinite(spxChg) && spxChg <= -1) {
    riskLevel = "風險升高";
    riskIcon = "📈";
    suggestion = "偏保守，暫緩市價追價加碼";
    isHighRisk = false;
  }
  // 4. 🔥 過度安逸：VIX 低於 13.5
  else if (Number.isFinite(vixVal) && vixVal < VIX_LOW) {
    riskLevel = "過度安逸";
    riskIcon = "🔥";
    suggestion = "居高思危，防範市場樂觀過頭的回馬槍";
    isHighRisk = false;
  }

  return {
    success: Boolean(Number.isFinite(vixVal) || Number.isFinite(spxChg)),
    vix: vixText,
    spxChg: spxChgText,
    riskLevel,
    riskIcon, // 新增此欄位方便通知使用
    suggestion,
    isHighRisk,
    meta: {
      vixDate: data?.vix?.date ?? null,
      spxDate: data?.spx?.date ?? null,
    },
  };
}

async function fetchFredSeriesLast2(seriesId) {
  const apiKey = process.env.FRED_API_KEY; // 建議加，穩定 [web:945]
  const url =
    "https://api.stlouisfed.org/fred/series/observations" +
    `?series_id=${encodeURIComponent(seriesId)}` +
    "&file_type=json&sort_order=desc&limit=10" +
    (apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "");

  const res = await axios.get(url, { timeout: 12_000 });
  const obs = res.data?.observations || [];

  // 從後往前挑兩個「可用數值」（FRED 偶爾會有 "."）
  const vals = [];
  for (let i = 0; i < obs.length && vals.length < 2; i++) {
    const v = Number(obs[i]?.value);
    // 確保是有效數字 (FRED 的假日或無效值會回傳 ".")
    if (Number.isFinite(v)) {
      vals.push({ date: obs[i].date, value: v });
    }
  }
  if (vals.length < 2) return null;

  const latest = vals[0];
  const prev = vals[1];
  return {
    date: latest.date,
    value: latest.value,
    changePercent: prev.value
      ? ((latest.value - prev.value) / prev.value) * 100
      : null,
  };
}

export async function fetchUsMarketData() {
  // VIXCLS: VIX 收盤；SP500: S&P500 收盤 [web:871][web:943]
  const [vix, spx] = await Promise.allSettled([
    fetchFredSeriesLast2("VIXCLS"),
    fetchFredSeriesLast2("SP500"),
  ]);

  const riskAnalysis = await analyzeUsRisk({
    vix: vix?.value,
    spx: spx?.value,
  });

  return {
    ...riskAnalysis, // 注入 riskLevel, riskIcon, suggestion, isHighRisk 等分析結果
    source: "FRED",
  };
}
