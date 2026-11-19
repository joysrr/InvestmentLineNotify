/**
 * 開發用情境路由器（Mock Router）
 * 僅供 VITE_USE_MOCK_API=true 或 DEV/test/Playwright 限定 ?mock= 啟用。
 * 生產組建必須完全忽略。
 */

import createFixtures, { defaultFixtures } from "./fixtures/index.js";

export const SCENARIOS = ["rich", "risk", "empty", "error", "weak-network"];

/**
 * 解析當前應該使用的情境
 * 優先級：URL ?mock= > VITE_USE_MOCK_API 對應的設定 > 無情境（正常 API）
 * 生產環境永遠不啟用查詢參數覆蓋。
 * @param {string} mode - import.meta.env.MODE
 * @param {boolean} isDev - import.meta.env.DEV
 * @param {string} [url] - 目前頁面完整 URL
 * @returns {string|null} 情境名稱，null 表示不使用 mock
 */
export function resolveScenario(
  mode,
  isDev,
  url = typeof location !== "undefined" ? location.href : "",
) {
  if (mode === "production") return null;

  try {
    const params = new URL(url).searchParams;
    const queryMock = params.get("mock");
    if (queryMock) {
      if (isDev || mode === "test" || process.env.NODE_ENV === "test") {
        return SCENARIOS.includes(queryMock) ? queryMock : null;
      }
      return null;
    }
  } catch (error) {
    // URL parsing is best-effort; invalid URLs simply disable query override.
    void error;
  }
  return null;
}

/**
 * 判斷當前是否應啟用 mock（env 命名或命令列啟用）
 * @param {boolean} enabled - VITE_USE_MOCK_API === "true"
 * @param {string|null} scenario - resolveScenario 結果
 * @returns {boolean}
 */
export function isMockEnabled(enabled, scenario) {
  return !!enabled || scenario !== null;
}

/**
 * 取得給定情境的 fixture
 * @param {string|null} scenario
 * @returns {Object}
 */
export function getFixtures(scenario = null) {
  return scenario ? createFixtures(scenario) : defaultFixtures;
}

/**
 * Endpoint router：模擬 /api/<endpoint> 的 deterministic 行為
 * @param {string} pathname - 例如 /api/status
 * @param {Object} options - fetch options
 * @param {Object} ctx - { scenario, isWeakNetwork }
 * @returns {Promise<Response>}
 */
export async function routeApi(pathname, options = {}, ctx = {}) {
  const { scenario = "rich", isWeakNetwork = false } = ctx;
  const fixtures = getFixtures(scenario);

  // 可測試弱網路：固定延遲後才回應，便於驗證 loading / 錯誤行為
  if (isWeakNetwork) {
    await new Promise((r) => setTimeout(r, 2500));
  }

  const base = "/api";
  const method = (options.method || "GET").toUpperCase();

  if (!pathname.startsWith(base)) {
    return new Response(JSON.stringify({ error: "not api" }), { status: 404 });
  }

  const path = pathname.slice(base.length);
  const statusCode = scenario === "error" ? 502 : 200;

  const handlers = {
    GET: {
      "/status": fixtures.status,
      "/portfolio/health": fixtures.health,
      "/reports": fixtures.reports,
      "/reports/weekly": fixtures.reports.slice(0, 3),
      "/reports/monthly": fixtures.reports.slice(0, 12),
      "/report/latest-theoretical": fixtures.report,
      "/reports/snapshots": fixtures.snapshots,
      "/reports/snapshots/weekly": fixtures.snapshots,
      "/reports/snapshots/monthly": fixtures.snapshots,
      "/news": fixtures.news,
      "/report/news": fixtures.reportNews,
      "/social-sentiment": fixtures.sentiment,
      "/data-evidence-report": fixtures.evidence,
      "/data-evidence-report/download": fixtures.evidence,
      "/replay-evidence": [],
      "/strategy-config/meta": fixtures.strategyMeta,
      "/strategy-config": fixtures.strategyConfig,
      "/strategy-config/default": fixtures.strategyConfig,
      "/strategy-status": fixtures.strategyStatus,
    },
    POST: {
      "/data-evidence-report": fixtures.evidence,
      "/strategy-config": { ok: true, config: fixtures.strategyConfig },
    },
  };

  const handler = handlers[method]?.[path];
  if (handler === undefined) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
    });
  }

  if (scenario === "error") {
    return new Response(JSON.stringify({ error: "mock error scenario" }), {
      status: statusCode,
    });
  }

  return new Response(JSON.stringify(handler), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  resolveScenario,
  isMockEnabled,
  getFixtures,
  routeApi,
  SCENARIOS,
};
