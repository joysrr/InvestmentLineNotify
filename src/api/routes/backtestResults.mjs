/**
 * backtestResults.mjs
 * 回測結果查詢路由
 * - GET /api/backtest/results - 查詢回測結果列表
 * - GET /api/backtest/results/:jobId - 查詢單一任務完整結果
 * - GET /api/backtest/results/:jobId/chart?type=equity|drawdown|signalCategory - 圖表數據
 * - GET /api/backtest/results/export?jobId=xxx&format=csv|json - 匯出
 * - GET /api/backtest/results/files - 列出結果檔案
 */

import {
  queryBacktestResults,
  getBacktestResult,
  generateChartData,
  exportResultsCSV,
  exportResultsJSON,
  listResultFiles,
} from "../../modules/backtest/backtestResults.mjs";

const RESULT_QUERY_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["completed", "failed", "running"] },
    start: { type: "number" },
    end: { type: "number" },
    name: { type: "string" },
  },
};

const CHART_QUERY_SCHEMA = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["equity", "drawdown", "signalCategory", "comparison"],
    },
  },
  required: ["type"],
};

const EXPORT_QUERY_SCHEMA = {
  type: "object",
  required: ["jobId"],
  properties: {
    jobId: { type: "string" },
    format: { type: "string", enum: ["csv", "json"] },
  },
};

export default async function backtestResultsRoutes(fastify) {
  // GET /backtest/results - 查詢回測結果列表
  fastify.get(
    "/backtest/results",
    {
      schema: {
        querystring: RESULT_QUERY_SCHEMA,
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                jobId: { type: "string" },
                name: { type: "string" },
                status: { type: "string" },
                config: { type: "object" },
                createdAt: { type: "number" },
                finishedAt: { type: "number" },
                summary: { type: "object" },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const filters = request.query;
        const results = await queryBacktestResults(filters);

        // 回傳精簡版列表 (不含完整 results 陣列)
        const simplified = results.map((job) => ({
          jobId: job.jobId,
          name: job.name,
          status: job.status,
          config: job.config,
          createdAt: job.createdAt,
          finishedAt: job.finishedAt,
          summary: job.summary,
          error: job.error,
        }));

        return simplified;
      } catch (err) {
        fastify.log.error({ err }, "查詢回測結果失敗");
        return reply.code(500).send({ error: "查詢回測結果失敗" });
      }
    },
  );

  // GET /backtest/results/:jobId - 查詢單一任務完整結果
  fastify.get(
    "/backtest/results/:jobId",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
          required: ["jobId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              jobId: { type: "string" },
              name: { type: "string" },
              status: { type: "string" },
              config: { type: "object" },
              createdAt: { type: "number" },
              finishedAt: { type: "number" },
              summary: { type: "object" },
              signalCategoryStats: { type: "object" },
              results: { type: "array" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { jobId } = request.params;
        const result = await getBacktestResult(jobId);

        if (!result) {
          return reply.code(404).send({ error: "找不到指定的回測任務" });
        }

        return result;
      } catch (err) {
        fastify.log.error({ err }, "查詢回測任務失敗");
        return reply.code(500).send({ error: "查詢回測任務失敗" });
      }
    },
  );

  // GET /backtest/results/:jobId/chart - 圖表數據
  fastify.get(
    "/backtest/results/:jobId/chart",
    {
      schema: {
        params: {
          type: "object",
          properties: { jobId: { type: "string" } },
          required: ["jobId"],
        },
        querystring: CHART_QUERY_SCHEMA,
        response: {
          200: {
            type: "object",
            properties: {
              labels: { type: "array", items: { type: "string" } },
              datasets: { type: "array" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { jobId } = request.params;
        const { type } = request.query;

        const result = await getBacktestResult(jobId);
        if (!result) {
          return reply.code(404).send({ error: "找不到指定的回測任務" });
        }

        let chartData;
        if (type === "comparison") {
          // 比較模式需要多個任務，這裡簡單處理
          chartData = generateChartData([result], type);
        } else if (type === "signalCategory") {
          chartData = generateChartData(result.summary, type);
        } else {
          chartData = generateChartData(result.results || [], type);
        }

        return chartData;
      } catch (err) {
        fastify.log.error({ err }, "生成圖表數據失敗");
        return reply.code(500).send({ error: "生成圖表數據失敗" });
      }
    },
  );

  // GET /backtest/results/export - 匯出結果
  fastify.get(
    "/backtest/results/export",
    {
      schema: {
        querystring: EXPORT_QUERY_SCHEMA,
        response: {
          200: { type: "string" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { jobId, format = "csv" } = request.query;

        const result = await getBacktestResult(jobId);
        if (!result) {
          return reply.code(404).send({ error: "找不到指定的回測任務" });
        }

        let content;
        let contentType;
        let filename;

        if (format === "json") {
          content = exportResultsJSON(result);
          contentType = "application/json";
          filename = `backtest_${jobId}.json`;
        } else {
          content = exportResultsCSV(result.results || [], result.summary);
          contentType = "text/csv";
          filename = `backtest_${jobId}.csv`;
        }

        return reply
          .header("Content-Type", contentType)
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(content);
      } catch (err) {
        fastify.log.error({ err }, "匯出回測結果失敗");
        return reply.code(500).send({ error: "匯出回測結果失敗" });
      }
    },
  );

  // GET /backtest/results/files - 列出結果檔案
  fastify.get(
    "/backtest/results/files",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                path: { type: "string" },
                size: { type: "number" },
                createdAt: { type: "number" },
                modifiedAt: { type: "number" },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        const files = await listResultFiles();
        return files;
      } catch (err) {
        fastify.log.error({ err }, "列出結果檔案失敗");
        return reply.code(500).send({ error: "列出結果檔案失敗" });
      }
    },
  );
}
