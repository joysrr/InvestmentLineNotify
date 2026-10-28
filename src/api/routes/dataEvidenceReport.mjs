import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { generateDataEvidenceReport } from "../../modules/verification/generateDataEvidenceReport.mjs";
import { createTicket, redeemTicket } from "../utils/downloadTicket.mjs";

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

  // 2. 即時生成最新資料證據報告並寫入落地檔，同時回傳一次性下載 Ticket URL
  fastify.post("/data-evidence-report", async (_request, reply) => {
    try {
      const rootDir = options.rootDir || process.cwd();
      const outputDir =
        options.reportsDir ||
        path.resolve(rootDir, "data/verification-reports");
      const { report, jsonPath } = generateDataEvidenceReport({
        rootDir,
        outputDir,
      });

      // 產生 60 秒有效一次性下載 Ticket
      const ticketId = createTicket(jsonPath);
      const downloadUrl = `/api/data-evidence-report/download?ticket=${ticketId}`;

      return reply.send({ ...report, downloadUrl });
    } catch (error) {
      fastify.log?.error?.(error, "Failed to generate data evidence report");
      return reply.code(500).send({
        error: "Failed to generate data evidence report",
        message: error.message,
      });
    }
  });

  // 3. 檔案下載端點 (帶 Content-Disposition: attachment)
  //    優先模式：?ticket= 一次性 Ticket（繞過 initDataGuard，供 openLink 外部瀏覽器使用）
  //    相容模式：無 ticket 時走舊有流程（initDataGuard 在 server.mjs 層負責攔截）
  fastify.get("/data-evidence-report/download", async (request, reply) => {
    try {
      const ticket = request.query.ticket;

      if (ticket !== undefined) {
        // Ticket 模式：驗證一次性 Ticket
        const ticketPath = redeemTicket(ticket);
        if (!ticketPath) {
          return reply.code(403).send({
            error: "Invalid or expired download ticket",
          });
        }
        const filename = path.basename(ticketPath);
        const content = await readFile(ticketPath, "utf8");
        reply.header(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        reply.type("application/json; charset=utf-8");
        return reply.send(content);
      }

      // 相容模式：舊有流程（由 initDataGuard 控管）
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
