/**
 * snapshotAggregator.mjs
 * Aggregates decrypted portfolio snapshots into weekly / monthly periods.
 * Each period uses the LAST trading day's snapshot (end-of-period position).
 * Pure functions — no file I/O, no side effects.
 *
 * Snapshot shape (after decryption):
 * {
 *   date, qty0050, qtyZ2, totalLoan, cash,
 *   avgCost0050, avgCostZ2, lastBuyDate,
 *   price0050,   // market price (added after Commit 0)
 *   priceZ2,     // market price (added after Commit 0)
 * }
 */

import { getISOWeekKey, getMonthKey } from './reportAggregator.mjs';

/**
 * Calculates cost-basis net value.
 * netValueCost = (qty0050 * avgCost0050) + (qtyZ2 * avgCostZ2) - totalLoan
 * Returns null when critical fields are missing.
 * @param {Object} s - decrypted snapshot
 * @returns {number|null}
 */
export function calcNetValueCost(s) {
  if (!s) return null;
  const v0050 = (s.qty0050 ?? 0) * (s.avgCost0050 ?? 0);
  const vZ2   = (s.qtyZ2   ?? 0) * (s.avgCostZ2   ?? 0);
  const loan  = s.totalLoan ?? 0;
  if (v0050 === 0 && vZ2 === 0) return null;
  return +((v0050 + vZ2 - loan).toFixed(2));
}

/**
 * Calculates market-price net value.
 * netValueMarket = (qty0050 * price0050) + (qtyZ2 * priceZ2) - totalLoan
 * Returns null when market price fields are absent (old snapshots).
 * @param {Object} s - decrypted snapshot
 * @returns {number|null}
 */
export function calcNetValueMarket(s) {
  if (!s) return null;
  if (s.price0050 == null && s.priceZ2 == null) return null;
  const v0050 = (s.qty0050 ?? 0) * (s.price0050 ?? 0);
  const vZ2   = (s.qtyZ2   ?? 0) * (s.priceZ2   ?? 0);
  const loan  = s.totalLoan ?? 0;
  if (v0050 === 0 && vZ2 === 0) return null;
  return +((v0050 + vZ2 - loan).toFixed(2));
}

/**
 * Normalises a raw decrypted snapshot into a standard chart data point.
 * @param {string} date  - YYYY-MM-DD
 * @param {Object} snap  - decrypted snapshot
 * @returns {Object}
 */
export function normaliseSnapshot(date, snap) {
  return {
    date,
    qty0050:        snap.qty0050        ?? 0,
    qtyZ2:          snap.qtyZ2          ?? 0,
    totalLoan:      snap.totalLoan      ?? 0,
    cash:           snap.cash           ?? 0,
    avgCost0050:    snap.avgCost0050    ?? null,
    avgCostZ2:      snap.avgCostZ2      ?? null,
    price0050:      snap.price0050      ?? null,
    priceZ2:        snap.priceZ2        ?? null,
    lastBuyDate:    snap.lastBuyDate    ?? null,
    netValueCost:   calcNetValueCost(snap),
    netValueMarket: calcNetValueMarket(snap),
  };
}

/**
 * Groups daily snapshots into weekly periods.
 * Each week uses the LAST available trading day as representative.
 *
 * @param {Array<{date:string, snap:Object}>} entries - sorted DESC
 * @param {number} limit - max weeks to return (default 52)
 * @returns {Array} weekly periods, DESC order
 */
export function aggregateSnapshotsByWeek(entries, limit = 52) {
  // Group by ISO week key, keep DESC order within group
  const groups = new Map();
  for (const { date, snap } of entries) {
    const key = getISOWeekKey(date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ date, snap });
  }

  const result = [];
  for (const [period, items] of groups) {
    // Sort ASC to identify start/end dates; last item = end-of-week
    const asc = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const last = asc[asc.length - 1];
    result.push({
      period,
      startDate:    asc[0].date,
      endDate:      last.date,
      tradingDays:  asc.length,
      ...normaliseSnapshot(last.date, last.snap),
    });
  }

  return result
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, limit);
}

/**
 * Groups daily snapshots into monthly periods.
 * Each month uses the LAST available trading day as representative.
 *
 * @param {Array<{date:string, snap:Object}>} entries - sorted DESC
 * @param {number} limit - max months to return (default 120)
 * @returns {Array} monthly periods, DESC order
 */
export function aggregateSnapshotsByMonth(entries, limit = 120) {
  const groups = new Map();
  for (const { date, snap } of entries) {
    const key = getMonthKey(date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ date, snap });
  }

  const result = [];
  for (const [period, items] of groups) {
    const asc = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const last = asc[asc.length - 1];
    result.push({
      period,
      startDate:    asc[0].date,
      endDate:      last.date,
      tradingDays:  asc.length,
      ...normaliseSnapshot(last.date, last.snap),
    });
  }

  return result
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, limit);
}
