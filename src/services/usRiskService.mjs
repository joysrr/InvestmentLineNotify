import { fetchUsMarketData } from "../providers/usMarketProvider.mjs";

export async function analyzeUsRisk() {
  const data = await fetchUsMarketData();

  const vixVal = Number(data?.vix?.value);
  const spxChg = Number(data?.spx?.changePercent);

  const spxChgText = Number.isFinite(spxChg) ? `${spxChg.toFixed(2)}%` : "N/A";
  const vixText = Number.isFinite(vixVal) ? vixVal.toFixed(2) : "N/A";

  let riskLevel = "正常";
  let suggestion = "依原策略執行";
  let isHighRisk = false;

  // 你之前討論的規則：13.5 / 20
  if (Number.isFinite(vixVal) && vixVal >= 30) {
    riskLevel = "🚨極高風險";
    suggestion = "暫停00675L新增撥款，嚴守維持率";
    isHighRisk = true;
  } else if ((Number.isFinite(vixVal) && vixVal >= 20) || (Number.isFinite(spxChg) && spxChg <= -2)) {
    riskLevel = "⚠️高風險";
    suggestion = "暫停00675L新增撥款，偏防守";
    isHighRisk = true;
  } else if ((Number.isFinite(vixVal) && vixVal >= 13.5) || (Number.isFinite(spxChg) && spxChg <= -1)) {
    riskLevel = "📈風險升高";
    suggestion = "偏保守，避免追價加碼";
  }

  return {
    success: Boolean(Number.isFinite(vixVal) || Number.isFinite(spxChg)),
    vix: vixText,
    spxChg: spxChgText,
    riskLevel,
    suggestion,
    isHighRisk,
    meta: {
      vixDate: data?.vix?.date ?? null,
      spxDate: data?.spx?.date ?? null,
      source: "stooq(^spx)+fred(vixcls)",
    },
  };
}
