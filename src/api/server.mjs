import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyWebsocket from "@fastify/websocket";
import { fileURLToPath } from "url";
import { assertEnv } from "../utils/envGuard.mjs";
import logger from "../utils/logger.mjs";
import { initDataGuard } from "./middleware/initDataGuard.mjs";
import statusRoute from "./routes/status.mjs";
import reportsRoute from "./routes/reports.mjs";
import newsRoute from "./routes/news.mjs";
import socialSentimentRoute from "./routes/socialSentiment.mjs";
import dataEvidenceReportRoute from "./routes/dataEvidenceReport.mjs";
import configRoute from "./routes/config.mjs";
import portfolioHealthRoute from "./routes/portfolioHealth.mjs";
import strategyStatusRoute from "./routes/strategyStatus.mjs";
import simulateRoute from "./routes/v1/simulate.mjs";
import monitoringRoutes from "./routes/monitoringRoutes.mjs";
import deployRoutes from "./routes/deployRoutes.mjs";
// 啟動前強制檢查環境變數，確保不帶病執行
assertEnv();

/**
 * 建立 Fastify App Instance
 * @param {Object} opts 配置項
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export async function buildApp(opts = {}) {
  const fastify = Fastify({
    logger: opts.logger ?? {
      level: process.env.NODE_ENV === "dev" ? "info" : "warn",
    },
  });

  // ─── CORS ────────────────────────────────────────────────────────────────────
  const defaultOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://joysrr.duckdns.org",
  ];
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : defaultOrigins;

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // 允許無 origin (如同源、手機 App 原生 WebView、Curl 或工具請求)
      if (!origin) return cb(null, true);
      if (
        corsOrigins.includes(origin) ||
        origin.endsWith(".duckdns.org") ||
        origin.includes("telegram.org")
      ) {
        return cb(null, true);
      }
      return cb(null, true); // 防衛型寬鬆放行跨域，避免 Mini App WebView Origin 阻擋
    },
    methods: ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Telegram-Init-Data",
      "x-telegram-init-data",
    ],
    credentials: true,
  });

  // ─── Rate Limiter ────────────────────────────────────────────────────────────
  // 每分鐘最多 100 次請求，/health 端點除外
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    skip: (request) => {
      // 跳過 /health 與 /healthz 端點
      return request.url.startsWith("/health");
    },
    onExceed: (request, reply) => {
      logger.warn(
        `[RateLimit] IP ${request.ip} 超過速率限制，URL: ${request.url}`,
      );
    },
    errorResponseBuilder: (request, context) => ({
      error: "Too Many Requests",
      message: `請求過於頻繁，請在 ${Math.ceil(context.after / 1000)} 秒後再試`,
      retryAfter: context.after,
    }),
  });

  // ─── WebSocket ──────────────────────────────────────────────────────────────
  await fastify.register(fastifyWebsocket);

  // ─── Swagger / OpenAPI ────────────────────────────────────────────────────────
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: "InvestmentLineNotify API",
        description: "0050 / 00675L 生命周期投資決策系統 API 文件",
        version: "2.0.0",
      },
      servers: [
        { url: "http://localhost:3000", description: "開發環境" },
        {
          url: "https://api.investnotif.yourdomain.com",
          description: "正式環境",
        },
      ],
      tags: [
        { name: "Status", description: "系統狀態與市場快照" },
        { name: "Reports", description: "每日/週/月報告查詢" },
        { name: "News", description: "新聞池與 AI 新聞治理" },
        { name: "Config", description: "策略設定讀寫" },
        { name: "Portfolio Health", description: "帳戶健康度試算" },
        { name: "Simulator", description: "0050 雙向模擬器 (正向/反向)" },
      ],
      components: {
        securitySchemes: {
          telegramInitData: {
            type: "apiKey",
            in: "header",
            name: "X-Telegram-Init-Data",
            description: "Telegram WebApp initData (HMAC-SHA256 驗證)",
          },
        },
      },
      security: [{ telegramInitData: [] }],
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // ─── HTTP Request & Response Audit Logger Hooks ─────────────────────────────
  fastify.addHook("onRequest", async (request) => {
    // 排除大量輪詢的健康檢查以避免日誌污染
    if (request.url.startsWith("/health")) return;
    logger.info(
      {
        traceId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      `📡 [API Request] ${request.method} ${request.url}`,
    );
  });

  fastify.addHook("onResponse", async (request, reply) => {
    if (request.url.startsWith("/health")) return;
    logger.info(
      {
        traceId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: Math.round(reply.elapsedTime),
      },
      `✅ [API Response] ${request.method} ${request.url} ${reply.statusCode} (${Math.round(reply.elapsedTime)}ms)`,
    );
  });

  // ─── Global hook: Telegram initData guard ────────────────────────────────────
  fastify.addHook("onRequest", initDataGuard);

  await fastify.register(statusRoute, { prefix: "/api" });
  await fastify.register(reportsRoute, { prefix: "/api" });
  await fastify.register(newsRoute, { prefix: "/api" });
  await fastify.register(socialSentimentRoute, { prefix: "/api" });
  await fastify.register(dataEvidenceReportRoute, { prefix: "/api" });
  await fastify.register(configRoute, { prefix: "/api" });
  await fastify.register(portfolioHealthRoute, { prefix: "/api" });
  await fastify.register(strategyStatusRoute, { prefix: "/api" });
  await fastify.register(simulateRoute, { prefix: "/api/v1" });
  await fastify.register(monitoringRoutes);
  await fastify.register(deployRoutes);

  // ─── Global Error Handler (M-002: Path Hiding) ─────────────────────────────
  fastify.setErrorHandler((error, request, reply) => {
    const isDev = process.env.NODE_ENV === "dev";
    const statusCode = error.statusCode || 500;

    // 紀錄完整的錯誤資訊到 Server Logs
    if (statusCode >= 500) {
      logger.error(
        {
          err: error.stack || error,
          url: request.url,
          method: request.method,
          ip: request.ip,
        },
        `[API Error] ${error.message}`,
      );
    } else {
      logger.info({ msg: error.message, statusCode }, "[API Client Error]");
    }

    // 回傳給客戶端的訊息需去敏化 (Hide internal paths/stack)
    const response = {
      error: error.name || "Internal Server Error",
      message:
        statusCode >= 500 && !isDev
          ? "伺服器內部錯誤，請聯絡管理員"
          : error.message,
      statusCode,
    };

    reply.status(statusCode).send(response);
  });

  // ─── Health check (no auth required, skip guard in middleware) ───────────────
  fastify.get("/health", async () => ({ status: "ok", ts: Date.now() }));
  fastify.get("/healthz", async () => ({ status: "ok", ts: Date.now() }));

  return fastify;
}

// ─── 異常監控 ───────────────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error(err, "🔥 [Fatal] 未捕獲的異常 (Uncaught Exception)");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "🔥 [Fatal] 未處理的 Promise Rejection");
  process.exit(1);
});

// ─── 啟動邏輯 (僅在直接執行時觸發) ───────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const HOST = process.env.HOST || "0.0.0.0";

  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    logger.info(
      { port: PORT, host: HOST, cwd: process.cwd() },
      `[api] 🚀 Server started successfully! Listening on ${HOST}:${PORT}`,
    );
  } catch (err) {
    logger.error({ err: err.stack || err }, "❌ [api] 啟動失敗 (Fatal Error)");
    process.exit(1);
  }
}
