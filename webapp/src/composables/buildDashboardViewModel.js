/**
 * 由後端實際回傳的 status / report / health 建構輕量 Dashboard ViewModel。
 * 不依賴後端未保證存在的欄位，所有數值皆有安全 fallback。
 */

function toFiniteNumber(val) {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function extractLatestReport(reportsPayload) {
  if (!reportsPayload) return null;
  if (Array.isArray(reportsPayload)) return reportsPayload[0] ?? null;
  if (Array.isArray(reportsPayload.data)) return reportsPayload.data[0] ?? null;
  if (reportsPayload.report && typeof reportsPayload.report === "object") {
    return reportsPayload.report;
  }
  return null;
}

export function buildDashboardViewModel({ status, report, health }) {
  const sigs = report?.signals ?? {};
  const portfolio = report?.portfolio ?? {};
  const healthMeta = health?._meta ?? {};
  const statusMeta = status?._meta ?? {};

  // 1. 決策與策略建議（依實際報表欄位，容許 ai 缺漏）
  const target = sigs.target || "—";
  const suggestion =
    sigs.suggestion ||
    sigs.targetSuggestion ||
    sigs.targetSuggestionShort ||
    "尚無操作建議";
  const score = toFiniteNumber(sigs.score ?? sigs.weightScore);
  const priceChangePercent = toFiniteNumber(sigs.priceChangePercent);
  const maintenanceMargin = toFiniteNumber(
    sigs.maintenanceMargin ?? health?.components?.margin?.details?.margin,
  );
  const grossLeverage = toFiniteNumber(
    sigs.grossLeverage ??
      sigs.actualLeverage ??
      health?.components?.leverage?.details?.current,
  );
  const currentPR = toFiniteNumber(sigs.valuationGuardResult?.currentPR);
  const ndcLight = status?.data?.rawNdc?.light || null;
  const vix = toFiniteNumber(
    health?.components?.regime?.details?.vix ??
      report?.marketState?.sentiment?.vix ??
      report?.VIX ??
      status?.data?.rawUsMarket?.vix,
  );
  const vixTW = toFiniteNumber(
    health?.vixTW ?? health?.components?.regime?.details?.vixTW,
  );

  // 2. 冷卻與預算狀態
  const cooldown = sigs.cooldownStatus ?? null;
  const cooldownText = cooldown?.inCooldown
    ? `冷卻中（剩 ${cooldown.daysLeft ?? 0} 天）`
    : "無冷卻期";

  const budgetInfo = sigs.budgetInfo ?? null;
  const budgetAllowed = toFiniteNumber(sigs.budgetAllowedAmount);

  // 3. 帳戶健康度（對應 GET /portfolio/health）
  const healthScore = toFiniteNumber(health?.score);
  const rawHealthStatus = String(health?.status || "").toLowerCase();
  let healthTone = "neutral";
  if (["ok", "healthy", "good"].includes(rawHealthStatus)) healthTone = "ok";
  else if (["warn", "warning", "caution"].includes(rawHealthStatus)) {
    healthTone = "warn";
  } else if (["danger", "critical", "alert"].includes(rawHealthStatus)) {
    healthTone = "danger";
  }

  const componentOrder = [
    ["margin", "維持率"],
    ["survival", "生存空間"],
    ["decoupling", "資產解耦"],
    ["leverage", "槓桿比例"],
    ["lifecycle", "生命週期"],
    ["regime", "市場環境"],
  ];

  const healthComponents = componentOrder
    .map(([key, label]) => {
      const item = health?.components?.[key];
      if (!item) return null;
      const d = item.details || {};
      let valueText = "—";
      if (d.margin != null && Number.isFinite(Number(d.margin))) {
        valueText = `${Number(d.margin).toFixed(1)}%`;
      } else if (d.dropPercent != null && Number.isFinite(Number(d.dropPercent))) {
        valueText = `${Number(d.dropPercent).toFixed(1)}%`;
      } else if (d.z2Ratio != null && Number.isFinite(Number(d.z2Ratio))) {
        valueText = `${Number(d.z2Ratio).toFixed(1)}%`;
      } else if (d.current != null && Number.isFinite(Number(d.current))) {
        valueText = `${Number(d.current).toFixed(2)}x`;
      } else if (d.stage) {
        valueText = String(d.stage);
      } else if (d.vix != null) {
        valueText = `VIX ${d.vix}`;
      } else if (item.value != null) {
        valueText = String(item.value);
      }

      return {
        key,
        label,
        status: String(item.status || "neutral").toLowerCase(),
        valueText,
        subText: d.message || d.stage || "",
      };
    })
    .filter(Boolean);

  // 4. AI 教練建議（僅在 report.ai 確實存在且有內容時顯示）
  const aiRaw = report?.ai && typeof report.ai === "object" ? report.ai : null;
  const aiInsight =
    aiRaw?.core_insight || aiRaw?.insight || aiRaw?.summary || "";
  const aiVerdict = aiRaw?.strategy_verdict || aiRaw?.verdict || "";
  const aiRisks = Array.isArray(aiRaw?.risk_warnings)
    ? aiRaw.risk_warnings
    : Array.isArray(aiRaw?.risks)
      ? aiRaw.risks
      : [];
  const aiActions = Array.isArray(aiRaw?.action_items)
    ? aiRaw.action_items
    : Array.isArray(aiRaw?.actions)
      ? aiRaw.actions
      : [];
  const aiMindset = Array.isArray(aiRaw?.mindset_advice)
    ? aiRaw.mindset_advice
    : Array.isArray(aiRaw?.mindset)
      ? aiRaw.mindset
      : [];
  const aiThinking =
    aiRaw?.coach_internal_thinking || aiRaw?.thinking || "";

  const hasAiContent = Boolean(
    aiInsight ||
      aiVerdict ||
      aiRisks.length ||
      aiActions.length ||
      aiMindset.length ||
      aiThinking,
  );

  // 5. 更新時間來源（優先用 health._meta.cachedAt / health.timestamp，其次 statusMeta）
  const updatedAt =
    healthMeta.cachedAt ||
    health?.timestamp ||
    statusMeta.updatedAt ||
    statusMeta.lastRun ||
    null;

  return {
    reportDate: report?.date || healthMeta.reportDate || "—",
    updatedAt,
    decision: {
      target,
      suggestion,
      statusEmoji: sigs.status || "",
      signalCategory: sigs.signalCategory || sigs.signalType || "",
      score,
      priceChangePercent,
      cooldownText,
      budgetAllowed,
      budgetInfo,
      regimeState: sigs.regimeResult?.state || "—",
    },
    metrics: {
      maintenanceMargin,
      grossLeverage,
      currentPR,
      ndcLight,
      vix,
      vixTW,
      price0050: toFiniteNumber(report?.price0050),
      currentPrice: toFiniteNumber(report?.currentPrice),
      cash: toFiniteNumber(portfolio.cash),
    },
    health: {
      hasData: Boolean(health),
      score: healthScore,
      tone: healthTone,
      lightStatus: health?.lightStatus || "",
      summary: health?.summary || "",
      recommendations: Array.isArray(health?.recommendations)
        ? health.recommendations
        : [],
      components: healthComponents,
    },
    ai: {
      hasData: hasAiContent,
      verdict: aiVerdict,
      insight: aiInsight,
      risks: aiRisks,
      actions: aiActions,
      mindset: aiMindset,
      thinking: aiThinking,
    },
  };
}
