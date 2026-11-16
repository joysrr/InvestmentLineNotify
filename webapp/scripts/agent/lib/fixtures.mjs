/**
 * API fixture 生成器（空状态）
 * 关键：有些端点返回 array，有些返回 object，形状必须与真实后端一致，
 * 否则前端 .reverse() / .map() 会崩
 */

// /api/reports* 与 /api/reports/snapshots* 都返回数组
function emptyArray() {
  return [];
}

// /api/status
function statusFixture() {
  return {
    ok: true,
    status: "ok",
    uptime: 0,
    lastRunAt: null,
    sources: [],
    healthy: 0,
    total: 0,
  };
}

// /api/portfolio/health
function healthFixture() {
  return {
    score: 0,
    status: "ok",
    metrics: [],
    alerts: [],
    computedAt: null,
  };
}

// /api/news
function newsFixture() {
  return [];
}

// /api/strategy-config
function strategyConfigFixture() {
  return {
    config: {},
    sections: [],
    thresholds: [],
  };
}

// /api/social-sentiment
function socialSentimentFixture() {
  return { score: 0, series: [], labels: [] };
}

// /api/data-evidence-report
function dataEvidenceFixture() {
  return { rows: [], summary: {}, generatedAt: null };
}

// /api/replay-evidence
function replayEvidenceFixture() {
  return [];
}

export function fixtureFor(pathname) {
  const p = (pathname || "").toLowerCase();

  // ── 數組型端點（最關鍵）────────────────────────────
  if (p.includes("/reports/snapshots")) return emptyArray();
  if (p.match(/\/reports(\/|$|\?)/)) return emptyArray();
  if (p.includes("/news")) return newsFixture();
  if (p.includes("/replay-evidence")) return replayEvidenceFixture();

  // ── 物件型端點 ──────────────────────────────────────
  if (p.includes("/status")) return statusFixture();
  if (p.includes("/portfolio/health")) return healthFixture();
  if (p.includes("/strategy-config")) return strategyConfigFixture();
  if (p.includes("/social-sentiment")) return socialSentimentFixture();
  if (p.includes("/data-evidence-report")) return dataEvidenceFixture();

  // 預設：空物件（不會崩，但可能顯示空狀態）
  return {};
}
