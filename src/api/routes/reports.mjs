import {
  aggregateByWeek,
  aggregateByMonth,
} from "../utils/reportAggregator.mjs";
import {
  normaliseSnapshot,
  aggregateSnapshotsByWeek,
  aggregateSnapshotsByMonth,
} from "../utils/snapshotAggregator.mjs";

import { loadStateFromReport } from "../../domain/ilnState.mjs";
import { archiveManager } from "../../modules/data/archiveManager.mjs";
import { buildReportReadOnlyView } from "../../modules/strategy/reportReadOnlyView.mjs";
import {
  READ_ONLY_REPORT_VIEW_SCHEMA,
  REPORT_SCHEMA,
} from "../schema/contract.mjs";

// Simple TTL Cache to prevent file I/O spikes
const cache = new Map();
const CACHE_TTL_MS = 2000; // 2 seconds

async function getCached(key, fetcher) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetcher();
  cache.set(key, { timestamp: Date.now(), data });
  return data;
}

/**
 * Reads all report filenames, filters to YYYY-MM-DD.json,
 * sorts descending (newest first), and returns the date strings.
 */
async function getSortedDates() {
  return getCached("sortedDates", async () => {
    return archiveManager.listArchiveDates(); // 已排序 DESC，格式 YYYY-MM-DD[]
  });
}

/**
 * Loads N daily report files and returns full objects.
 * @param {string[]} dates - sorted DESC date strings
 * @param {number}   limit - how many to load
 */
async function loadReports(dates, limit) {
  const cacheKey = `loadReports:${limit}:${dates[0] || "empty"}`;
  return getCached(cacheKey, async () => {
    const selected = dates.slice(0, limit);
    const results = await Promise.all(
      selected.map((date) =>
        archiveManager
          .getReportByDate(date)
          .then((r) => {
            if (!r) return null;
            const report = { date, ...r };
            return { ...report, ...buildReportReadOnlyView(report) };
          })
          .catch(() => null),
      ),
    );
    return results.filter(Boolean);
  });
}

/**
 * Walks date files and collects decrypted snapshot entries (via IlnState).
 * Stops once `limit` valid snapshots are collected or all dates are exhausted.
 * @param {string[]} dates  - sorted DESC
 * @param {number}   limit  - max snapshot entries to collect
 * @returns {Array<{date:string, snap:Object}>}
 */
async function loadSnapshotEntries(dates, limit) {
  const entries = [];
  for (const date of dates) {
    if (entries.length >= limit) break;
    try {
      const state = await loadStateFromReport(date);
      if (!state || !state.portfolioRaw) continue;
      // portfolioRaw 即為 decrypted snapshot，與 snapshotAggregator 的預期 shape 相符
      entries.push({ date, snap: state.portfolioRaw });
    } catch {
      continue;
    }
  }
  return entries;
}

export default async function reportsRoute(fastify) {
  /**
   * GET /api/report/news
   * Returns AI-curated news from the latest daily report only.
   * An empty latest report must not silently display stale news.
   */
  fastify.get("/report/news", async (_req, reply) => {
    try {
      const dates = await getSortedDates();
      if (!dates.length)
        return reply.send({ tw: [], us: [], generatedAt: null });

      const date = dates[0];
      const report = await archiveManager.getReportByDate(date);
      const news = report?.news;
      return reply.send({
        tw: news?.tw ?? [],
        us: news?.us ?? [],
        generatedAt: news?.generatedAt ?? date,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to read report news");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/reports?limit=N
   * Returns the N most recent daily reports (full JSON objects).
   * Default limit: 30.  Capped at 365 (supports 1-year daily chart).
   */
  fastify.get(
    "/reports",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              allOf: [REPORT_SCHEMA, READ_ONLY_REPORT_VIEW_SCHEMA],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const rawLimit = parseInt(request.query.limit ?? "30", 10);
      const limit =
        Number.isNaN(rawLimit) || rawLimit < 1 ? 30 : Math.min(rawLimit, 365);

      try {
        const dates = await getSortedDates();
        const results = await loadReports(dates, limit);
        return reply.send(results);
      } catch (err) {
        fastify.log.error({ err }, "Failed to list reports");
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  /**
   * GET /api/reports/weekly?limit=N
   * Returns ISO-week aggregated periods (newest first).
   * Default limit: 12 weeks.  Capped at 52.
   */
  fastify.get("/reports/weekly", async (request, reply) => {
    const rawLimit = parseInt(request.query.limit ?? "12", 10);
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 ? 12 : Math.min(rawLimit, 52);

    try {
      const dates = await getSortedDates();
      // Load enough daily reports to cover the requested weeks
      // 7 trading days/week * limit weeks * 1.5 buffer for holidays/gaps
      const loadLimit = Math.min(dates.length, Math.ceil(limit * 7 * 1.5));
      const allReports = await loadReports(dates, loadLimit);
      const weekly = aggregateByWeek(allReports, limit);
      return reply.send(weekly);
    } catch (err) {
      fastify.log.error({ err }, "Failed to build weekly reports");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/reports/monthly?limit=N
   * Returns month aggregated periods (newest first).
   * Default limit: 12 months.  Capped at 360.
   */
  fastify.get("/reports/monthly", async (request, reply) => {
    const rawLimit = parseInt(request.query.limit ?? "12", 10);
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 ? 12 : Math.min(rawLimit, 360);

    try {
      const dates = await getSortedDates();
      // Load enough daily reports to cover the requested months
      // ~22 trading days/month * limit months * 1.2 buffer
      const loadLimit = Math.min(dates.length, Math.ceil(limit * 22 * 1.2));
      const allReports = await loadReports(dates, loadLimit);
      const monthly = aggregateByMonth(allReports, limit);
      return reply.send(monthly);
    } catch (err) {
      fastify.log.error({ err }, "Failed to build monthly reports");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/report/latest-theoretical
   * Returns the latest report that has theoreticalShadow.status === 'AVAILABLE'.
   * Falls back through previous trading days until found or exhausted.
   */
  fastify.get("/report/latest-theoretical", async (_request, reply) => {
    try {
      const dates = await getSortedDates();
      if (!dates.length) {
        return reply.code(404).send({ error: "No reports found" });
      }

      // Search through dates (newest first) for one with available theoreticalShadow
      for (const date of dates) {
        try {
          const state = await loadStateFromReport(date);
          if (state?.rawReport?.theoreticalShadow?.status === "AVAILABLE") {
            return reply.send(state.rawReport);
          }
        } catch {
          // Continue to next date
          continue;
        }
      }

      // No report with available theoretical data found
      return reply.code(404).send({
        error: "No report with available theoretical data found",
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to find latest theoretical report");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/reports/snapshots?limit=N
   * Returns decrypted portfolio snapshots from historical reports (via IlnState).
   * Only includes reports that contain an encrypted snapshot field.
   * Default limit: 30.  Capped at 365 (supports 1-year daily chart).
   *
   * Response shape:
   * {
   *   snapshots: Array<normalised snapshot with netValueCost & netValueMarket>,
   *   hasEncryption: boolean
   * }
   */
  fastify.get("/reports/snapshots", async (request, reply) => {
    const rawLimit = parseInt(request.query.limit ?? "30", 10);
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 ? 30 : Math.min(rawLimit, 365);

    try {
      const dates = await getSortedDates();
      const hasEncryption = !!process.env.SNAPSHOT_ENCRYPT_KEY;

      if (!hasEncryption) {
        return reply.send({ snapshots: [], hasEncryption: false });
      }

      const entries = await loadSnapshotEntries(dates, limit);
      const snapshots = entries.map(({ date, snap }) =>
        normaliseSnapshot(date, snap),
      );

      return reply.send({ snapshots, hasEncryption: true });
    } catch (err) {
      fastify.log.error({ err }, "Failed to read snapshots");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/reports/snapshots/weekly?limit=N
   * Returns weekly-aggregated portfolio snapshots (end-of-week position).
   * Default limit: 52.  Capped at 52.
   *
   * Response shape: Array<weekly period with normalised snapshot fields>
   */
  fastify.get("/reports/snapshots/weekly", async (request, reply) => {
    const rawLimit = parseInt(request.query.limit ?? "52", 10);
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 ? 52 : Math.min(rawLimit, 52);

    try {
      const dates = await getSortedDates();
      const hasEncryption = !!process.env.SNAPSHOT_ENCRYPT_KEY;

      if (!hasEncryption) {
        return reply.send([]);
      }

      // Load enough entries to cover requested weeks (5 trading days × weeks × 1.5 buffer)
      const loadLimit = Math.min(dates.length, Math.ceil(limit * 5 * 1.5));
      const entries = await loadSnapshotEntries(dates, loadLimit);
      const weekly = aggregateSnapshotsByWeek(entries, limit);

      return reply.send(weekly);
    } catch (err) {
      fastify.log.error({ err }, "Failed to build weekly snapshots");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/reports/snapshots/monthly?limit=N
   * Returns monthly-aggregated portfolio snapshots (end-of-month position).
   * Default limit: 120.  Capped at 360 (supports 30-year chart).
   *
   * Response shape: Array<monthly period with normalised snapshot fields>
   */
  fastify.get("/reports/snapshots/monthly", async (request, reply) => {
    const rawLimit = parseInt(request.query.limit ?? "120", 10);
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 ? 120 : Math.min(rawLimit, 360);

    try {
      const dates = await getSortedDates();
      const hasEncryption = !!process.env.SNAPSHOT_ENCRYPT_KEY;

      if (!hasEncryption) {
        return reply.send([]);
      }

      // Load enough entries: ~22 trading days/month × months × 1.2 buffer
      const loadLimit = Math.min(dates.length, Math.ceil(limit * 22 * 1.2));
      const entries = await loadSnapshotEntries(dates, loadLimit);
      const monthly = aggregateSnapshotsByMonth(entries, limit);

      return reply.send(monthly);
    } catch (err) {
      fastify.log.error({ err }, "Failed to build monthly snapshots");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
