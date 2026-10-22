import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_REPORT_DIR = path.resolve(
  process.cwd(),
  "data/verification-reports",
);
const REPORT_FILENAME = /^\d{4}-\d{2}-\d{2}-data-evidence\.json$/;

async function resolveReportPath(options) {
  if (options.reportPath) {
    return path.resolve(process.cwd(), options.reportPath);
  }

  const reportsDir = path.resolve(
    process.cwd(),
    options.reportsDir || DEFAULT_REPORT_DIR,
  );
  const filenames = (await readdir(reportsDir))
    .filter((filename) => REPORT_FILENAME.test(filename))
    .sort()
    .reverse();

  return filenames.length > 0 ? path.join(reportsDir, filenames[0]) : null;
}

export default async function dataEvidenceReportRoute(fastify, options = {}) {
  fastify.get("/data-evidence-report", async (_request, reply) => {
    try {
      const reportPath = await resolveReportPath(options);
      if (!reportPath) {
        return reply.code(404).send({
          error: "Data evidence report unavailable",
        });
      }
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
