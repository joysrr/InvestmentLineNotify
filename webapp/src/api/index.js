const BASE = import.meta.env.VITE_API_BASE || "";

async function apiFetch(path, maxRetries = 3, retryDelay = 800) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const initData =
      window.Telegram?.WebApp?.initData ||
      (import.meta.env.DEV ? "dev-bypass" : "");

    if (!initData && attempt < maxRetries) {
      await delay(retryDelay);
      continue;
    }

    try {
      const url = `${BASE}${path}`;
      const res = await fetch(url, {
        headers: { "X-Telegram-Init-Data": initData },
      });

      if (!res.ok) {
        console.error(`❌ [apiFetch] Failed: ${url} | Status: ${res.status}`);
        throw new Error(`API ${path} failed: ${res.status}`);
      }
      return res.json();
    } catch (err) {
      console.error(`❌ [apiFetch] Error: ${err.message}`);
      lastError = err;
      if (attempt < maxRetries) await delay(retryDelay);
    }
  }

  throw (
    lastError ?? new Error(`API ${path} failed after ${maxRetries} retries`)
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const fetchReports = (limit = 30) =>
  apiFetch(`/api/reports?limit=${limit}`);
export const fetchWeeklyReports = (limit = 12) =>
  apiFetch(`/api/reports/weekly?limit=${limit}`);
export const fetchMonthlyReports = (limit = 12) =>
  apiFetch(`/api/reports/monthly?limit=${limit}`);
export const fetchNews = () => apiFetch("/api/news");
export const fetchStatus = () => apiFetch("/api/status");
export const fetchReportNews = () => apiFetch("/api/report/news");

// ── Portfolio Snapshots ──────────────────────────────────────────────────────────────────────────────
// 日粒度（近 90 日）
export const fetchSnapshots = (limit = 90) =>
  apiFetch(`/api/reports/snapshots?limit=${limit}`);
// 週粒度（近 52 週 / 約一年）
export const fetchSnapshotsWeekly = (limit = 52) =>
  apiFetch(`/api/reports/snapshots/weekly?limit=${limit}`);
// 月粒度（預設 120 個月 / 約 10 年，最高 360 個月 / 30 年）
export const fetchSnapshotsMonthly = (limit = 120) =>
  apiFetch(`/api/reports/snapshots/monthly?limit=${limit}`);

export const fetchStrategyConfig = () => apiFetch("/api/strategy-config");
