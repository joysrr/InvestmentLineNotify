import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { fileURLToPath } from "url";
import { assertEnv } from "../utils/envGuard.mjs";
import logger from "../utils/logger.mjs";
import { initDataGuard } from "./middleware/initDataGuard.mjs";
import statusRoute from "./routes/status.mjs";
import reportsRoute from "./routes/reports.mjs";
import newsRoute from "./routes/news.mjs";
import configRoute from "./routes/config.mjs";
import portfolioHealthRoute from "./routes/portfolioHealth.mjs";
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
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : ["http://localhost:5173", "http://127.0.0.1:5173"];

  await fastify.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "HEAD", "OPTIONS"],
  });

  // ─── Rate Limiter ────────────────────────────────────────────────────────────
  // 每分鐘最多 100 次請求，/health 端點除外
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    skip: (request) => {
      // 跳過 /health 端點
      return request.url.startsWith("/health");
    },
    onExceed: (request, reply) => {
      logger.warn(
        `[RateLimit] IP ${request.ip} 超過速率限制，URL: ${request.url}`
      );
    },
    errorResponseBuilder: (request, context) => ({
      error: "Too Many Requests",
      message: `請求過於頻繁，請在 ${Math.ceil(context.after / 1000)} 秒後再試`,
      retryAfter: context.after,
    }),
  });

  // ─── Global hook: Telegram initData guard ────────────────────────────────────
  fastify.addHook("onRequest", initDataGuard);

  // ─── Routes ──────────────────────────────────────────────────────────────────
  await fastify.register(statusRoute, { prefix: "/api" });
  await fastify.register(reportsRoute, { prefix: "/api" });
  await fastify.register(newsRoute, { prefix: "/api" });
  await fastify.register(configRoute, { prefix: "/api" });
  await fastify.register(portfolioHealthRoute, { prefix: "/api" });

  // ─── Health check (no auth required, skip guard in middleware) ───────────────
  fastify.get("/health", async () => ({ status: "ok", ts: Date.now() }));

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
    logger.info({ port: PORT, host: HOST, cwd: process.cwd() }, `[api] 🚀 Server started successfully! Listening on ${HOST}:${PORT}`);
  } catch (err) {
    logger.error({ err: err.stack || err }, "❌ [api] 啟動失敗 (Fatal Error)");
    process.exit(1);
  }
}
