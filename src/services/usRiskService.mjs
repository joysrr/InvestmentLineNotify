import { fetchUsMarketData } from "../providers/usMarketProvider.mjs";
import { fetchStrategyConfig } from "./strategyConfigService.mjs";

export async function analyzeUsRisk() {
  const data = await fetchUsMarketData();
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
  if ((Number.isFinite(vixVal) && vixVal >= VIX_PANIC) || (Number.isFinite(spxChg) && spxChg <= -3)) {
    riskLevel = "極高風險";
    riskIcon = "🚨";
    suggestion = "全面禁止撥款，保留現金，嚴守維持率";
    isHighRisk = true;
  } 
  // 2. ⚠️ 高風險：VIX 破 20 或 標普跌幅超過 2%
  else if ((Number.isFinite(vixVal) && vixVal >= VIX_HIGH) || (Number.isFinite(spxChg) && spxChg <= -2)) {
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