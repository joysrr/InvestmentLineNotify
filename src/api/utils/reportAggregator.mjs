/**
 * reportAggregator.mjs
 * Utility functions to aggregate daily reports into weekly / monthly summaries.
 * Pure functions — no file I/O, no side effects.
 */

/**
 * Returns the ISO week key for a YYYY-MM-DD date string.
 * e.g. '2026-04-10' → '2026-W15'
 * @param {string} dateStr
 * @returns {string}
 */
export function getISOWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  // ISO week: Thursday of the week determines the year
  const tmp = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayOfWeek = tmp.getUTCDay() || 7; // 1=Mon ... 7=Sun
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek); // nearest Thursday
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Returns the month key for a YYYY-MM-DD date string.
 * e.g. '2026-04-10' → '2026-04'
 * @param {string} dateStr
 * @returns {string}
 */
export function getMonthKey(dateStr) {
  return dateStr.slice(0, 7);
}

/**
 * Builds cross-period summary stats from an array of daily report objects.
 * @param {Array} reports  - array of { date, signals, ... }
 * @returns {Object}
 */
export function buildSummary(reports) {
  const rsiArr = reports.map((r) => r.signals?.RSI).filter(Number.isFinite);
  const kdKArr = reports.map((r) => r.signals?.KD_K).filter(Number.isFinite);
  const kdDArr = reports.map((r) => r.signals?.KD_D).filter(Number.isFinite);
  const biasArr = reports
    .map((r) => r.signals?.bias240)
    .filter(Number.isFinite);
  const scoreArr = reports
    .map((r) => r.signals?.weightScore)
    .filter(Number.isFinite);
  const decisions = [
    ...new Set(reports.map((r) => r.signals?.target).filter(Boolean)),
  ];

  const avg = (arr) =>
    arr.length
      ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
      : null;
  const min = (arr) => (arr.length ? +Math.min(...arr).toFixed(1) : null);
  const max = (arr) => (arr.length ? +Math.max(...arr).toFixed(1) : null);

  return {
    avgRSI: avg(rsiArr),
    avgKD_K: avg(kdKArr),
    avgKD_D: avg(kdDArr),
    avgBias240: avg(biasArr),
    scoreRange: scoreArr.length
      ? { min: min(scoreArr), max: max(scoreArr) }
      : null,
    decisions,
  };
}

/**
 * Groups daily reports into weekly buckets.
 * @param {Array}  allReports  - all daily reports sorted DESC (newest first)
 * @param {number} limit       - max number of weeks to return (default 12)
 * @returns {Array} weekly aggregated periods, DESC order
 */
export function aggregateByWeek(allReports, limit = 12) {
  const groups = new Map();

  for (const report of allReports) {
    const key = getISOWeekKey(report.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(report);
  }

  const result = [];
  for (const [period, reports] of groups) {
    // reports are already DESC-sorted from input; sort ASC for date range calc
    const asc = [...reports].sort((a, b) => a.date.localeCompare(b.date));
    result.push({
      period,
      startDate: asc[0].date,
      endDate: asc[asc.length - 1].date,
      tradingDays: asc.length,
      lastReport: asc[asc.length - 1], // newest day in the week
      summary: buildSummary(asc),
    });
  }

  // Sort DESC by endDate, then cap
  return result
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, limit);
}

/**
 * Groups daily reports into monthly buckets.
 * @param {Array}  allReports  - all daily reports sorted DESC (newest first)
 * @param {number} limit       - max number of months to return (default 12)
 * @returns {Array} monthly aggregated periods, DESC order
 */
export function aggregateByMonth(allReports, limit = 12) {
  const groups = new Map();

  for (const report of allReports) {
    const key = getMonthKey(report.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(report);
  }

  const result = [];
  for (const [period, reports] of groups) {
    const asc = [...reports].sort((a, b) => a.date.localeCompare(b.date));
    result.push({
      period,
      startDate: asc[0].date,
      endDate: asc[asc.length - 1].date,
      tradingDays: asc.length,
      lastReport: asc[asc.length - 1],
      summary: buildSummary(asc),
    });
  }

  return result
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, limit);
}
