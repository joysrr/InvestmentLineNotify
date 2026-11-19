const MOCK_NOW = "2026-01-15T12:00:00.000Z";
const iso = (daysAgo = 0) =>
  new Date(Date.parse(MOCK_NOW) - daysAgo * 86400000).toISOString();

const article = (id, region, title) => ({
  id,
  title,
  summary: `${title}：市場資料與策略觀察。`,
  source: region === "tw" ? "財經日報" : "Market Watch",
  link: `https://example.com/news/${id}`,
  url: `https://example.com/news/${id}`,
  publishedAt: iso(id),
});

export function createFixtures(scenario = "rich") {
  const risk = scenario === "risk";
  const empty = scenario === "empty";
  const report = {
    date: iso(0),
    signals: {
      maintenanceRisk: { level: risk ? "Warning" : "Normal" },
      grossLeverage: risk ? 2.8 : 1.45,
      valuationGuardResult: { currentPR: risk ? 92 : 61 },
      target: risk ? "減碼防守" : "持有並觀察",
      priceChangePercent: risk ? -2.7 : 1.2,
      priceChangePercentText: risk ? "-2.70" : "+1.20",
      vix: risk ? 28.4 : 16.8,
      macroRegime: { isMarginOverheated: risk },
      macroSentiment: { vixOverrideActive: risk },
      portfolio: { maintenanceRatio: risk ? 1.32 : 2.18 },
    },
    portfolio: { maintenanceRatio: risk ? 1.32 : 2.18 },
    marketState: { sentiment: { vixOverrideActive: risk } },
    ai: {
      risk_warnings: risk ? ["波動升高，請降低槓桿"] : ["留意本週重要經濟數據"],
      action_items: [risk ? "檢視停損與保證金" : "維持分散配置"],
      mindset_advice: ["依計畫執行，避免追高殺低"],
      core_insight: risk ? "風險報酬比轉弱" : "基本面與趨勢仍穩健",
      strategy_verdict: risk ? "防守" : "中性偏多",
      coach_internal_thinking: "依據最新市場訊號整理建議。",
    },
  };
  const reports = empty
    ? []
    : Array.from({ length: 30 }, (_, i) => ({
        ...report,
        date: iso(i),
        signals: {
          ...report.signals,
          priceChangePercent: ((risk ? -1 : 1) * (i % 4)) / 2,
        },
      }));
  const snapshots = empty
    ? []
    : Array.from({ length: 24 }, (_, i) => ({
        date: iso(23 - i).slice(0, 10),
        period: iso(23 - i).slice(0, 7),
        value: 100000 + (23 - i) * 420,
        totalValue: 100000 + (23 - i) * 420,
        returnPercent: (23 - i) * 0.4,
      }));
  const tw = empty
    ? []
    : [
        article(1, "tw", "台股量價結構維持健康"),
        article(2, "tw", "央行政策與產業展望"),
      ];
  const us = empty
    ? []
    : [
        article(3, "us", "US market closes higher"),
        article(4, "us", "Treasury yields in focus"),
      ];
  return {
    status: {
      _meta: { lastRun: iso(0) },
      data: {
        rawUsMarket: { vix: risk ? 28.4 : 16.8 },
        rawNdc: { light: risk ? "黃燈" : "綠燈" },
      },
    },
    reports,
    report,
    health: {
      status: risk ? "warning" : "healthy",
      maintenanceRatio: report.portfolio.maintenanceRatio,
      survivalDropPercent: risk ? 18 : 31,
      currentGrossLeverage: report.signals.grossLeverage,
    },
    snapshots,
    news: [...tw, ...us],
    reportNews: { tw, us, generatedAt: iso(0) },
    sentiment: {
      score: risk ? 28 : 72,
      label: risk ? "偏空" : "偏多",
      fearGreed: risk ? 34 : 68,
    },
    strategyStatus: {
      mode: risk ? "defensive" : "balanced",
      label: risk ? "防守模式" : "平衡模式",
      updatedAt: iso(0),
    },
    strategyMeta: {
      version: "1.0",
      fields: [{ key: "targetLeverage", label: "目標槓桿", type: "number" }],
    },
    strategyConfig: {
      targetLeverage: risk ? 1.2 : 1.5,
      rebalanceThreshold: 0.1,
    },
    evidence: {
      generatedAt: iso(0),
      sources: ["market-data", "portfolio-ledger"],
      status: "ready",
    },
  };
}

export const defaultFixtures = createFixtures();
export { iso };
export default createFixtures;
