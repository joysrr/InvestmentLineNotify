import { fetchStrategyConfig } from "../strategy/signalRules.mjs";
import { fetchWithTimeout, parseNumberOrNull } from "../../utils/coreUtils.mjs";

async function analyzeUsRisk(data) {
  const strategy = await fetchStrategyConfig();

  // 取得設定檔參數，並加上預設值以策安全
  const th = strategy?.threshold || {};
  const VIX_PANIC = th.usVixPanic || 30;
  const VIX_HIGH = th.vixHighFear || 20;
  const VIX_LOW = th.vixLowComplacency || 13.5;

  // 使用 coreUtils 進行安全的數字轉換 (若無效會回傳 null)
  const vixVal = parseNumberOrNull(data?.vix?.value);
  const spxChg = parseNumberOrNull(data?.spx?.changePercent);

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

async function fetchFredSeriesLast2(seriesId) {
  const apiKey = process.env.FRED_API_KEY; // 建議加，穩定
  const url =
    "https://api.stlouisfed.org/fred/series/observations" +
    `?series_id=${encodeURIComponent(seriesId)}` +
    "&file_type=json&sort_order=desc&limit=10" +
    (apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "");

  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
          Accept: "application/json",
        },
      },
      12000,
    );
    if (!res.ok) throw new Error(`FRED API HTTP ${res.status}`);

    const data = await res.json();
    const obs = data?.observations || [];

    // 從後往前挑兩個「可用數值」（FRED 的假日或無效值會回傳 "."）
    const vals = [];
    for (let i = 0; i < obs.length && vals.length < 2; i++) {
      const v = parseNumberOrNull(obs[i]?.value); // 安全轉換：若是 "." 會變 null
      if (v !== null) {
        vals.push({ date: obs[i].date, value: v });
      }
    }
    if (vals.length < 2) return null;

    const latest = vals[0];
    const prev = vals[1];

    return {
      date: latest.date,
      value: latest.value,
      changePercent:
        prev.value !== 0 && prev.value !== null
          ? ((latest.value - prev.value) / prev.value) * 100
          : null,
    };
  } catch (err) {
    console.warn(`⚠️ 獲取 FRED 資料 (${seriesId}) 失敗:`, err.message);
    return null;
  }
}

export async function fetchUsMarketData() {
  // VIXCLS: VIX 收盤；SP500: S&P500 收盤
  const [vixResult, spxResult] = await Promise.allSettled([
    fetchFredSeriesLast2("VIXCLS"),
    fetchFredSeriesLast2("SP500"),
  ]);

  const riskAnalysis = await analyzeUsRisk({
    vix: vixResult.status === "fulfilled" ? vixResult.value : null,
    spx: spxResult.status === "fulfilled" ? spxResult.value : null,
  });

  return {
    ...riskAnalysis,
    source: "FRED",
  };
}
