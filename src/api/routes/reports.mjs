import { readdir, readFile } from "fs/promises";
import { join } from "path";
import {
  aggregateByWeek,
  aggregateByMonth,
} from "../utils/reportAggregator.mjs";

const REPORTS_DIR = join(process.cwd(), "data", "reports");
const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.json$/;

/**
 * Reads all report filenames, filters to YYYY-MM-DD.json,
 * sorts descending (newest first), and returns the date strings.
 */
async function getSortedDates() {
  const entries = await readdir(REPORTS_DIR);
  return entries
    .filter((f) => DATE_PATTERN.test(f))
    .map((f) => f.replace(".json", ""))
    .sort((a, b) => b.localeCompare(a)); // DESC
}

/**
 * Loads N daily report files and returns full objects.
 * @param {string[]} dates - sorted DESC date strings
 * @param {number}   limit - how many to load
 */
async function loadReports(dates, limit) {
  const selected = dates.slice(0, limit);
  const results = await Promise.all(
    selected.map(async (date) => {
      try {
        const raw = await readFile(
          join(REPORTS_DIR, `${date}.json`),
          "utf-8",
        );
        return { date, ...JSON.parse(raw) };
      } catch {
        return null; // skip broken files
      }
    }),
  );
  return results.filter(Boolean);
}

export default async function reportsRoute(fastify) {
  /**
   * GET /api/report/news
   * Returns today's AI-curated news (tw + us) from the latest report.
   * Falls back to the most recent report that has news if today's is empty.
   */
  fastify.get("/report/news", async (_req, reply) => {
    try {
      const dates = await getSortedDates();
      if (!dates.length) {
        return reply.send({ tw: [], us: [], generatedAt: null });
      }

      // Walk recent reports (max 10) until we find one with news
      const candidates = dates.slice(0, 10);
      for (const date of candidates) {
        try {
          const raw = await readFile(join(REPORTS_DIR, `${date}.json`), "utf-8");
          const report = JSON.parse(raw);
          const news = report.news;
          if (news && (news.tw?.length || news.us?.length)) {
            return reply.send({
              tw: news.tw ?? [],
              us: news.us ?? [],
              generatedAt: news.generatedAt ?? date,
            });
          }
        } catch {
          continue;
        }
      }

      // No report with news found
      return reply.send({ tw: [], us: [], generatedAt: null });
    } catch (err) {
      fastify.log.error({ err }, "Failed to read report news");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/reports?limit=N
   * Returns the N most recent daily reports (full JSON objects).
   * Default limit: 30.  Capped at 100.
   */
  fastify.get("/reports", async (request, reply) => {
    const rawLimit = parseInt(request.query.limit ?? "30", 10);
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 ? 30 : Math.min(rawLimit, 100);

    try {
      const dates = await getSortedDates();
      const results = await loadReports(dates, limit);
      return reply.send(results);
    } catch (err) {
      fastify.log.error({ err }, "Failed to list reports");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

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
   * Default limit: 12 months.  Capped at 24.
   */
  fastify.get("/reports/monthly", async (request, reply) => {
    const rawLimit = parseInt(request.query.limit ?? "12", 10);
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 ? 12 : Math.min(rawLimit, 24);

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
   * GET /api/report/:date
   * Returns the full JSON for a single daily report.
   * :date must match YYYY-MM-DD.  404 if not found.
   */
  fastify.get("/report/:date", async (request, reply) => {
    const { date } = request.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply
        .code(400)
        .send({ error: "Invalid date format. Expected YYYY-MM-DD" });
    }

    const filePath = join(REPORTS_DIR, `${date}.json`);
    try {
      const raw = await readFile(filePath, "utf-8");
      return reply.send(JSON.parse(raw));
    } catch (err) {
      if (err.code === "EMOENT") {
        return reply.code(404).send({ error: `Report for ${date} not found` });
      }
      fastify.log.error({ err }, "Failed to read report");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}