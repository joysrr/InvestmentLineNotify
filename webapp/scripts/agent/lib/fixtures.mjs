/**
 * API fixture 生成器（示範資料版）
 * 目的：讓截圖能渲染真實排版（卡片/KPI/圖表/列表），而非空狀態。
 *
 * 設計原則：
 *  - 形狀必須與真實後端一致（前端 .reverse() / .map() / 屬性訪問不崩）
 *  - 日期用動態「現在 - Nh」，避免 freshness 判過期
 *  - 所有端點都有內容，讓 Phase 3 的 CSS 改動能被真實渲染驗證
 *
 * 對照來源：
 *  - src/views/DashboardView.vue   → status._meta / status.data.raw* / reports[]
 *  - src/views/AccountView.vue     → status._meta.sources / reports[].signals
 *  - src/views/ChartView.vue       → {snapshots:[{date,netValueMarket,totalLoan}],hasEncryption}
 *  - src/views/MacroBattleView.vue → reports[].macroAnalysis.{bull_events,bear_events,...}
 *  - src/views/MarketRadarView.vue → status.data.rawCnn / rawFx / leadingIndicators
 *  - src/api/index.js              → ENDPOINTS 列表
 */

// ── 動態時間輔助 ─────────────────────────────────────
function isoAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}
function dateAgo(days) {
  return new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10);
}

// ── /api/status ──────────────────────────────────────
function statusFixture() {
  return {
    ok: true,
    _meta: {
      lastRun: isoAgo(0.5),
      sources: {
        cnnFearGreed:  { status: "SUCCESS", lastFetch: isoAgo(1),  label: "CNN 恐懼貪婪" },
        cnnFearGreed2: { status: "SUCCESS", lastFetch: isoAgo(1),  label: "CNN 替代源" },
        marginKgi:     { status: "SUCCESS", lastFetch: isoAgo(2),  label: "凱基融資" },
        marginTdcc:    { status: "FAILED",  lastFetch: isoAgo(3),  label: "TDCC 集保", error: "timeout" },
        ndcLight:      { status: "SUCCESS", lastFetch: isoAgo(2),  label: "國發會景氣" },
        vixUs:         { status: "SUCCESS", lastFetch: isoAgo(1),  label: "VIX (US)" },
        fxUsdTwd:      { status: "SUCCESS", lastFetch: isoAgo(1),  label: "USD/TWD" },
        tpExIndex:     { status: "SUCCESS", lastFetch: isoAgo(1),  label: "櫃買指數" },
      },
    },
    data: {
      rawCnn:      { score: 62, rating: "Greed" },
      rawFx:       { currentRate: 31.85, changePercent: -0.35 },
      rawUsMarket: { vix: 18.4, sp500: 5820.3, nasdaq: 19240.7 },
      rawNdc:      { light: "綠燈", score: 32 },
      rawMargin:   { marginBalanceChangePercent5d: 1.85 },
      leadingIndicators: {
        isLongTermDefense: false,
        score: 78,
        label: "偏多",
      },
    },
  };
}

// ── /api/reports ─────────────────────────────────────
function reportsFixture() {
  return [
    {
      id: "rpt-2026-11-17",
      date: dateAgo(0),
      timestamp: isoAgo(0.5),
      signals: {
        target: "買進 0050",
        priceChangePercent: 1.42,
        priceChangePercentText: "+1.42",
        grossLeverage: 1.68,
        maintenanceMargin: 182,
        vix: 18.4,
        valuationGuardResult: { currentPR: 42, percentile: 78 },
        macroRegime: { isMarginOverheated: false, regime: "中性偏多" },
        macroSentiment: { vixOverrideActive: false },
        portfolio: { maintenanceRatio: 168 },
      },
      portfolio: { maintenanceRatio: 168 },
      marketState: { sentiment: { vixOverrideActive: false } },
      macroAnalysis: {
        bull_events: [
          { title: "半導體外資連 3 日買超", weight: 2, score: 3 },
          { title: "美債殖利率回落", weight: 1, score: 2 },
          { title: "台幣止穩回升", weight: 1, score: 1 },
        ],
        bear_events: [
          { title: "中國 PMI 續弱", weight: 1, score: 2 },
          { title: "油價反彈推升通膨", weight: 1, score: 1 },
        ],
        neutral_events: [
          { title: "FOMC 會議紀要即將公布", weight: 1, score: 0 },
        ],
        conclusion: {
          market_direction: "bullish",
          short_summary: "偏多格局，短線關注半導體與金融",
          key_takeaways: ["維持 60/30/10 配置", "衛星倉位 00675L 已達目標"],
        },
      },
      ai: {
        risk_warnings: [
          "維持率 168%，距警戒 160% 僅 8 點，注意回撤",
          "融資餘額 5 日增 1.85%，過熱須留意",
        ],
        action_items: [
          { text: "0050 定期定額 3000 元", done: false },
          { text: "檢視 00675L 是否需回補", done: true },
        ],
        mindset_advice: ["不追高、不急躁", "遵守紀律，保持耐心"],
        coach_internal_thinking: "市場情緒樂觀，但維持率偏低需注意風險。",
        core_insight: "偏多但防禦，維持紀律是關鍵。",
        strategy_verdict: "符合預期，維持現有配置。",
      },
    },
    {
      id: "rpt-2026-11-16",
      date: dateAgo(1),
      timestamp: isoAgo(24),
      signals: {
        target: "持有",
        priceChangePercent: -0.28,
        priceChangePercentText: "-0.28",
        grossLeverage: 1.72,
        maintenanceMargin: 175,
        vix: 19.2,
        valuationGuardResult: { currentPR: 43, percentile: 80 },
        macroRegime: { isMarginOverheated: false },
        portfolio: { maintenanceRatio: 172 },
      },
      portfolio: { maintenanceRatio: 172 },
      macroAnalysis: {
        bull_events: [{ title: "外資回補", weight: 1, score: 2 }],
        bear_events: [{ title: "地緣政治風險", weight: 1, score: 1 }],
        neutral_events: [],
        conclusion: { market_direction: "neutral", short_summary: "中性觀望", key_takeaways: [] },
      },
    },
    {
      id: "rpt-2026-11-15",
      date: dateAgo(2),
      timestamp: isoAgo(48),
      signals: {
        target: "持有",
        priceChangePercent: 0.55,
        priceChangePercentText: "+0.55",
        grossLeverage: 1.70,
        maintenanceMargin: 178,
        vix: 18.9,
        valuationGuardResult: { currentPR: 44, percentile: 82 },
        macroRegime: { isMarginOverheated: false },
        portfolio: { maintenanceRatio: 175 },
      },
      portfolio: { maintenanceRatio: 175 },
    },
  ];
}

// ── /api/reports/snapshots ───────────────────────────
function snapshotsFixture() {
  // shape 對齊 src/api/utils/snapshotAggregator.mjs normaliseSnapshot()
  const arr = [];
  let net = 100;
  let loan = 40;
  let qty0050 = 2000;
  let qtyZ2 = 1500;
  for (let i = 89; i >= 0; i--) {
    net = net * (1 + (Math.sin(i / 5) * 0.006 + (Math.random() - 0.48) * 0.004));
    loan = loan * (1 + (Math.random() - 0.5) * 0.002);
    // 持股每 10 期略有變動，模擬實盤
    if (i % 10 === 0) { qty0050 += Math.round((Math.random() - 0.3) * 100); qtyZ2 += Math.round((Math.random() - 0.3) * 80); }
    const price0050 = Math.round((58 + Math.sin(i / 6) * 2.5) * 100) / 100;
    const priceZ2 = Math.round((14 + Math.sin(i / 7) * 0.6) * 100) / 100;
    arr.push({
      date: dateAgo(i),
      qty0050: Math.max(0, qty0050),
      qtyZ2: Math.max(0, qtyZ2),
      totalLoan: Math.round(loan * 100) / 100,
      cash: Math.round((12 + Math.sin(i / 4) * 3) * 100) / 100,
      avgCost0050: Math.round((55 + Math.sin(i / 20) * 1.2) * 100) / 100,
      avgCostZ2: Math.round((13.2 + Math.sin(i / 25) * 0.4) * 100) / 100,
      price0050,
      priceZ2,
      lastBuyDate: i % 20 === 0 ? dateAgo(i) : null,
      netValueCost: Math.round((net * 0.98) * 100) / 100,
      netValueMarket: Math.round(net * 100) / 100,
    });
  }
  return { snapshots: arr, hasEncryption: true };
}

// ── /api/news ────────────────────────────────────────
function newsFixture() {
  return [
    {
      id: "news-1",
      title: "台積電法說會報喜 明年資本支出上看 400 億美元",
      source: "經濟日報",
      sourceName: "經濟日報",
      url: "https://example.com/news/1",
      publishedAt: isoAgo(2),
      summary: "台積電今日法說會宣布明年資本支出將達 380-420 億美元，先進製程需求強勁。",
      sentiment: "positive",
      confidence: 0.85,
    },
    {
      id: "news-2",
      title: "Fed 官員：通膨若持續回落 明年初可能降息",
      source: "Reuters",
      sourceName: "Reuters",
      url: "https://example.com/news/2",
      publishedAt: isoAgo(4),
      summary: "聯準會官員表示，若通膨數據持續改善，明年第一季有機會啟動降息循環。",
      sentiment: "positive",
      confidence: 0.72,
    },
    {
      id: "news-3",
      title: "外資賣超台股 85 億元 主要賣超電子權值股",
      source: "中央社",
      sourceName: "中央社",
      url: "https://example.com/news/3",
      publishedAt: isoAgo(6),
      summary: "外資今日賣超台股 85.2 億元，主要賣超集中在電子權值股與半導體族群。",
      sentiment: "negative",
      confidence: 0.68,
    },
    {
      id: "news-4",
      title: "國發會公布 10 月景氣對策信號 續亮綠燈",
      source: "國發會",
      sourceName: "國發會",
      url: "https://example.com/news/4",
      publishedAt: isoAgo(10),
      summary: "10 月景氣對策信號綜合判斷分數 32 分，較上月增加 1 分，續亮綠燈。",
      sentiment: "neutral",
      confidence: 0.91,
    },
    {
      id: "news-5",
      title: "美國 10 月 CPI 年增 2.6% 符合預期",
      source: "Bloomberg",
      sourceName: "Bloomberg",
      url: "https://example.com/news/5",
      publishedAt: isoAgo(12),
      summary: "美國勞工部公布 10 月 CPI 年增 2.6%，核心 CPI 年增 3.3%，均符合市場預期。",
      sentiment: "neutral",
      confidence: 0.88,
    },
  ];
}

// ── /api/portfolio/health ────────────────────────────
function healthFixture() {
  return {
    score: 76,
    status: "ok",
    metrics: [
      { key: "maintenanceMargin", label: "維持率", value: 168, unit: "%", level: "warning", threshold: 160 },
      { key: "grossLeverage", label: "總槓桿", value: 1.68, unit: "x", level: "ok", threshold: 3.0 },
      { key: "dropBuffer", label: "下跌緩衝", value: 18.5, unit: "%", level: "ok", threshold: 15 },
      { key: "diversification", label: "分散度", value: 0.72, unit: "", level: "ok", threshold: 0.6 },
      { key: "liquidityScore", label: "流動性", value: 85, unit: "", level: "ok", threshold: 70 },
    ],
    alerts: [
      { level: "warning", message: "維持率 168%，接近警戒值 160%" },
    ],
    computedAt: isoAgo(0.2),
  };
}

// ── /api/strategy-config ─────────────────────────────
function strategyConfigFixture() {
  return {
    config: {
      targetAllocation: { core0050: 60, satellite00675L: 30, bond00740B: 40 },
      rebalanceThreshold: 5,
      maxGrossLeverage: 3.0,
      maintenanceMarginWarning: 160,
      maintenanceMarginDanger: 140,
    },
    sections: [
      { key: "allocation", title: "目標配置", fields: ["core0050", "satellite00675L", "bond00740B"] },
      { key: "risk", title: "風控參數", fields: ["maxGrossLeverage", "maintenanceMarginWarning", "maintenanceMarginDanger"] },
    ],
    thresholds: [
      { key: "maintenanceMarginWarning", value: 160, label: "維持率警戒" },
      { key: "maintenanceMarginDanger", value: 140, label: "維持率危險" },
    ],
  };
}

function strategyConfigMetaFixture() {
  return {
    fields: [
      { key: "core0050", label: "核心 0050 配置", type: "number", min: 0, max: 100, unit: "%" },
      { key: "satellite00675L", label: "衛星 00675L 配置", type: "number", min: 0, max: 100, unit: "%" },
      { key: "bond00740B", label: "錨定 00740B 配置", type: "number", min: 0, max: 100, unit: "%" },
      { key: "rebalanceThreshold", label: "再平衡閾值", type: "number", min: 1, max: 20, unit: "%" },
      { key: "maxGrossLeverage", label: "最大總槓桿", type: "number", min: 1, max: 5, unit: "x" },
    ],
    version: "1.0",
  };
}

// ── /api/strategy-status ────────────────────────────
function strategyStatusFixture() {
  return {
    status: "ok",
    computedAt: isoAgo(0.3),
    summary: "符合策略，維持現有配置。",
    checks: [
      { key: "allocation", label: "配置比例", status: "ok", message: "符合 60/30/10 目標" },
      { key: "leverage", label: "槓桿水平", status: "ok", message: "1.68x 低於上限 3.0x" },
      { key: "margin", label: "維持率", status: "warning", message: "168% 接近警戒 160%" },
      { key: "rebalance", label: "再平衡", status: "ok", message: "距閾值尚遠" },
    ],
  };
}

// ── /api/social-sentiment ────────────────────────────
function socialSentimentFixture() {
  const series = [];
  const labels = [];
  for (let i = 0; i < 14; i++) {
    labels.push(dateAgo(13 - i));
    series.push(Math.round((50 + Math.sin(i / 2) * 12 + (Math.random() - 0.5) * 6) * 10) / 10);
  }
  return { score: 58, series, labels, trend: "improving", source: "mixed" };
}

// ── /api/data-evidence-report ────────────────────────
function dataEvidenceFixture() {
  return {
    verificationScope: "persisted evidence only",
    generatedAt: isoAgo(1),
    summary: {
      totalFields: 24,
      verified: 22,
      missing: 2,
      coverage: 91.7,
    },
    items: [
      { field: "rawCnn.score", value: 62, source: "CNN", status: "verified" },
      { field: "rawCnn.rating", value: "Greed", source: "CNN", status: "verified" },
      { field: "rawFx.currentRate", value: 31.85, source: "Yahoo", status: "verified" },
      { field: "rawNdc.light", value: "綠燈", source: "國發會", status: "verified" },
      { field: "rawMargin.change5d", value: 1.85, source: "凱基", status: "verified" },
      { field: "rawUsMarket.vix", value: 18.4, source: "CBOE", status: "verified" },
      { field: "leadingIndicators.score", value: 78, source: "計算", status: "verified" },
      { field: "portfolio.maintenanceRatio", value: 168, source: "凱基", status: "verified" },
    ],
    rows: [
      { field: "rawCnn.score", value: "62" },
      { field: "rawFx.currentRate", value: "31.85" },
    ],
  };
}

// ── /api/replay-evidence ─────────────────────────────
function replayEvidenceFixture() {
  return [
    { id: "ev-1", timestamp: isoAgo(1), type: "status", detail: "抓取成功", status: "ok" },
    { id: "ev-2", timestamp: isoAgo(2), type: "reports", detail: "生成報表", status: "ok" },
    { id: "ev-3", timestamp: isoAgo(3), type: "news", detail: "抓取新聞 5 條", status: "ok" },
  ];
}

// ── /api/report/news ─────────────────────────────────
// 真後端 src/api/routes/reports.mjs:97 回 {tw, us, generatedAt} 物件
function reportNewsFixture() {
  const all = newsFixture();
  // 取前 2 筆當 TW，其餘當 US，避免空狀態
  return {
    tw: all.slice(0, 2),
    us: all.slice(2, 3),
    generatedAt: isoAgo(1),
  };
}

// ── /api/report/latest-theoretical ───────────────────
function latestTheoreticalFixture() {
  return {
    date: dateAgo(0),
    theoreticalNetValue: 102.35,
    actualNetValue: 100.0,
    deviation: 2.35,
    note: "非交易日推算值",
  };
}

// ── 路由分派 ─────────────────────────────────────────
export function fixtureFor(pathname) {
  const p = (pathname || "").toLowerCase();

  // 陣列型端點（最關鍵）
  if (p.includes("/reports/snapshots")) return snapshotsFixture();
  if (p.match(/\/reports\/weekly|\/reports\/monthly/)) return reportsFixture();
  if (p.match(/\/reports(\/|$|\?)/)) return reportsFixture();
  if (p.includes("/report/news")) return reportNewsFixture();
  if (p.includes("/news")) return newsFixture();
  if (p.includes("/replay-evidence")) return replayEvidenceFixture();
  if (p.includes("/report/latest-theoretical")) return latestTheoreticalFixture();

  // 物件型端點（精確匹配優先，避免 /strategy-status 被 /status 吃掉）
  if (p.includes("/strategy-status")) return strategyStatusFixture();
  if (p.includes("/strategy-config/meta")) return strategyConfigMetaFixture();
  if (p.includes("/strategy-config")) return strategyConfigFixture();
  if (p.includes("/portfolio/health")) return healthFixture();
  if (p.includes("/social-sentiment")) return socialSentimentFixture();
  if (p.includes("/data-evidence-report")) return dataEvidenceFixture();
  if (p.includes("/status")) return statusFixture();

  // 預設：空物件（不會崩，但可能顯示空狀態）
  return {};
}
