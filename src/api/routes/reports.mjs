import { readdir, readFile } from "fs/promises";
import { join } from "path";

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

export default async function reportsRoute(fastify) {
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
            return { date, error: "Failed to parse report" };
          }
        }),
      );

      return reply.send(results);
    } catch (err) {
      fastify.log.error({ err }, "Failed to list reports");
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
      if (err.code === "ENOENT") {
        return reply.code(404).send({ error: `Report for ${date} not found` });
      }
      fastify.log.error({ err }, "Failed to read report");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
