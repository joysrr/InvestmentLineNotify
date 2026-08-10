// src/api/routes/v1/simulate.mjs
// POST /api/v1/simulate - 正向模擬
// POST /api/v1/simulate/reverse - 反向推導

import {
  buildSimulationInput,
  getValidatedLatestReport,
} from "../../../modules/simulator/dataAdapter.mjs";
import { runForwardSimulation } from "../../../modules/simulator/forwardSimulator.mjs";
import { runReverseEngine } from "../../../modules/simulator/reverseEngine.mjs";
import {
  validateForwardInput,
  validateReverseInput,
  validateBatchInput,
  createErrorResponse,
} from "../../../modules/simulator/validator.mjs";
import {
  ERROR_CODES,
  HTTP_STATUS,
  CONFLICT_REASONS,
  REVERSE_TARGET_TYPES,
  CALCULATION_MODE,
} from "../../../modules/simulator/constants.mjs";

/** 解析錯誤代碼並回傳對應的 HTTP 狀態碼與錯誤回應 */
function handleError(reply, error) {
  const message = error.message || "未知錯誤";

  // 已知錯誤代碼
  if (message.startsWith("HISTORY_INCOMPLETE:")) {
    return reply
      .code(HTTP_STATUS.CONFLICT)
      .send(
        createErrorResponse(
          ERROR_CODES.CONFLICT,
          `歷史資料不完整: ${message.replace("HISTORY_INCOMPLETE: ", "")}`,
          "history",
        ),
      );
  }

  if (message.startsWith("REPORT_EXPIRED:")) {
    return reply
      .code(HTTP_STATUS.CONFLICT)
      .send(
        createErrorResponse(
          ERROR_CODES.CONFLICT,
          `戰報過期: ${message.replace("REPORT_EXPIRED: ", "")}`,
          "report",
        ),
      );
  }

  if (message.startsWith("DATA_NOT_READY:")) {
    return reply
      .code(HTTP_STATUS.CONFLICT)
      .send(
        createErrorResponse(
          ERROR_CODES.DATA_NOT_READY,
          `資料未就緒: ${message.replace("DATA_NOT_READY: ", "")}`,
          "data",
        ),
      );
  }

  if (message.startsWith("STRATEGY_LOAD_FAILED:")) {
    return reply
      .code(HTTP_STATUS.CONFLICT)
      .send(
        createErrorResponse(
          ERROR_CODES.CONFLICT,
          `策略載入失敗: ${message.replace("STRATEGY_LOAD_FAILED: ", "")}`,
          "strategy",
        ),
      );
  }

  // 未預期錯誤
  console.error("[SimulateRoute] Unexpected error:", error);
  return reply
    .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR, "伺服器內部錯誤"));
}

export default async function simulateRoute(fastify) {
  // POST /api/v1/simulate - 正向模擬
  fastify.post("/simulate", async (request, reply) => {
    try {
      // 1. 輸入驗證
      const validation = validateForwardInput(request.body);
      if (!validation.valid) {
        return reply
          .code(HTTP_STATUS.BAD_REQUEST)
          .send(
            createErrorResponse(
              ERROR_CODES.VALIDATION_ERROR,
              validation.errors.join("; "),
              validation.errors[0]?.includes("price0050")
                ? "price0050"
                : validation.errors[0]?.includes("priceZ2")
                  ? "priceZ2"
                  : null,
            ),
          );
      }

      const { price0050, priceZ2 } = validation.sanitized;

      // 2. 取得並驗證最新戰報
      let latestReport;
      try {
        latestReport = await getValidatedLatestReport();
      } catch (err) {
        return handleError(reply, err);
      }

      // 3. 建構模擬輸入資料
      let simulationInput;
      try {
        simulationInput = await buildSimulationInput(
          latestReport,
          price0050,
          priceZ2,
        );
      } catch (err) {
        return handleError(reply, err);
      }

      // 4. 執行正向模擬
      const result = await runForwardSimulation(
        simulationInput,
        latestReport.price0050,
        latestReport.currentPrice,
      );

      return reply.code(HTTP_STATUS.OK).send(result);
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // POST /api/v1/simulate/reverse - 反向推導
  fastify.post("/simulate/reverse", async (request, reply) => {
    try {
      // 1. 輸入驗證
      const validation = validateReverseInput(request.body);
      if (!validation.valid) {
        return reply
          .code(HTTP_STATUS.BAD_REQUEST)
          .send(
            createErrorResponse(
              ERROR_CODES.VALIDATION_ERROR,
              validation.errors.join("; "),
              "target",
            ),
          );
      }

      const { target } = validation.sanitized;

      // 2. 取得並驗證最新戰報
      let latestReport;
      try {
        latestReport = await getValidatedLatestReport();
      } catch (err) {
        return handleError(reply, err);
      }

      // 3. 建構基礎模擬輸入 (使用當前價格，不替換)
      let baseSimulationInput;
      try {
        baseSimulationInput = await buildSimulationInput(
          latestReport,
          latestReport.price0050, // 使用當前價格
          latestReport.currentPrice,
        );
      } catch (err) {
        return handleError(reply, err);
      }

      // 4. 執行反向推導引擎
      const result = await runReverseEngine({
        target,
        simulationInput: baseSimulationInput,
        forwardSimulator: runForwardSimulation,
        currentPrice0050: latestReport.price0050,
        currentPriceZ2: latestReport.currentPrice,
      });

      // 5. 加上通用欄位
      const response = {
        ...result,
        timestamp: new Date().toISOString(),
        dataAsOf: latestReport.date,
        disclaimer:
          "此為條件分析，非價格預測亦非投資建議。反向推導基於固定假設，實際市場表現可能不同。",
      };

      return reply.code(HTTP_STATUS.OK).send(response);
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // POST /api/v1/simulate/batch - 批次模擬
  fastify.post("/simulate/batch", async (request, reply) => {
    try {
      // 1. 輸入驗證
      const validation = validateBatchInput(request.body);
      if (!validation.valid) {
        return reply
          .code(HTTP_STATUS.BAD_REQUEST)
          .send(
            createErrorResponse(
              ERROR_CODES.VALIDATION_ERROR,
              validation.errors.join("; "),
              "batch",
            ),
          );
      }

      const { jobs, options = {} } = validation.sanitized;
      const concurrency = options.concurrency ?? 4;
      const retryAttempts = options.retryAttempts ?? 2;
      const retryDelayMs = options.retryDelayMs ?? 1000;

      // 2. 取得並驗證最新戰報
      let latestReport;
      try {
        latestReport = await getValidatedLatestReport();
      } catch (err) {
        return handleError(reply, err);
      }

      // 3. 建構基礎模擬輸入
      let baseSimulationInput;
      try {
        baseSimulationInput = await buildSimulationInput(
          latestReport,
          latestReport.price0050,
          latestReport.currentPrice,
        );
      } catch (err) {
        return handleError(reply, err);
      }

      // 4. 執行批次模擬
      const results = [];
      const errors = [];

      // 簡單的併發控制：分批處理
      for (let i = 0; i < jobs.length; i += concurrency) {
        const batch = jobs.slice(i, i + concurrency);

        const batchPromises = batch.map(async (job, jobIndex) => {
          const globalIndex = i + jobIndex;

          // 建構單次模擬輸入
          const jobSimulationInput = {
            ...baseSimulationInput,
            price0050: job.price0050,
            currentPrice:
              job.priceZ2 ??
              job.price0050 *
                (latestReport.currentPrice / latestReport.price0050),
          };

          let attempt = 0;
          let lastError = null;

          while (attempt <= retryAttempts) {
            try {
              const result = await runForwardSimulation(
                jobSimulationInput,
                latestReport.price0050,
                latestReport.currentPrice,
              );

              results[globalIndex] = {
                jobIndex: globalIndex,
                success: true,
                result,
              };
              return;
            } catch (err) {
              lastError = err;
              attempt++;
              if (attempt <= retryAttempts) {
                // 延遲後重試
                await new Promise((resolve) =>
                  setTimeout(resolve, retryDelayMs),
                );
              }
            }
          }

          // 所有重試都失敗
          errors[globalIndex] = {
            jobIndex: globalIndex,
            success: false,
            error: lastError?.message || "未知錯誤",
            input: job,
          };
        });

        await Promise.all(batchPromises);
      }

      // 5. 回傳批次結果
      const response = {
        totalJobs: jobs.length,
        successful: results.filter((r) => r?.success).length,
        failed: errors.filter((e) => e).length,
        results: jobs.map((_, idx) => results[idx] || errors[idx]),
        timestamp: new Date().toISOString(),
        dataAsOf: latestReport.date,
        disclaimer:
          "此為批次條件分析，非價格預測亦非投資建議。結果基於固定假設，實際市場表現可能不同。",
      };

      return reply.code(HTTP_STATUS.OK).send(response);
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
