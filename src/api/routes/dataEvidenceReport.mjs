import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { generateDataEvidenceReport } from "../../modules/verification/generateDataEvidenceReport.mjs";

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
  try {
    const filenames = (await readdir(reportsDir))
      .filter((filename) => REPORT_FILENAME.test(filename))
      .sort()
      .reverse();

    return filenames.length > 0 ? path.join(reportsDir, filenames[0]) : null;
  } catch {
    return null;
  }
}

export default async function dataEvidenceReportRoute(fastify, options = {}) {
  // 容許 Content-Type: application/json 但無 body 或 body 為空字串之請求 (如前端無載荷動作觸發)
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      if (!body || body.trim() === "") {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body));
      } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  // 1. 取得最新資料證據報告 (JSON)
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

  // 2. 即時生成最新資料證據報告並寫入落地檔
  fastify.post("/data-evidence-report", async (_request, reply) => {
    try {
      const rootDir = options.rootDir || process.cwd();
      const outputDir =
        options.reportsDir ||
        path.resolve(rootDir, "data/verification-reports");
      const { report } = generateDataEvidenceReport({
        rootDir,
        outputDir,
      });
      return reply.send(report);
    } catch (error) {
      fastify.log?.error?.(error, "Failed to generate data evidence report");
      return reply.code(500).send({
        error: "Failed to generate data evidence report",
        message: error.message,
      });
    }
  });

  // 3. 檔案下載端點 (帶 Content-Disposition: attachment)
  fastify.get("/data-evidence-report/download", async (_request, reply) => {
    try {
      const reportPath = await resolveReportPath(options);
      if (!reportPath) {
        return reply.code(404).send({
          error: "Data evidence report unavailable",
        });
      }
      const filename = path.basename(reportPath);
      const content = await readFile(reportPath, "utf8");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      reply.type("application/json; charset=utf-8");
      return reply.send(content);
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
