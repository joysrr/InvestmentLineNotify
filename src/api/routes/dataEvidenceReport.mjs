import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_REPORT_PATH = path.resolve(
  process.cwd(),
  "data/verification-reports",
  `${new Date().toISOString().slice(0, 10)}-data-evidence.json`,
);

export default async function dataEvidenceReportRoute(fastify, options = {}) {
  const reportPath = path.resolve(
    process.cwd(),
    options.reportPath || DEFAULT_REPORT_PATH,
  );

  fastify.get("/data-evidence-report", async (_request, reply) => {
    try {
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      return reply.send(report);
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) {
        return reply.code(404).send({
          error: "Data evidence report unavailable",
        });
      }
      throw error;
    }
  });
}
