import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { fileURLToPath } from "url";
import { assertEnv } from "../utils/envGuard.mjs";
import logger from "../utils/logger.mjs";
console.log("[api] 🟢 基礎組件加載完成");

import { initDataGuard } from "./middleware/initDataGuard.mjs";
console.log("[api] 🟢 中間件加載完成");

import statusRoute from "./routes/status.mjs";
console.log("[api] 🟢 statusRoute 加載完成");

import reportsRoute from "./routes/reports.mjs";
console.log("[api] 🟢 reportsRoute 加載完成");

import newsRoute from "./routes/news.mjs";
console.log("[api] 🟢 newsRoute 加載完成");

import configRoute from "./routes/config.mjs";
console.log("[api] 🟢 configRoute 加載完成");

// 啟動前強制檢查環境變數，確保不帶病執行
console.log("[api] 🔍 執行環境變數檢查...");
assertEnv();
console.log("[api] ✅ 環境變數檢查通過");

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

  // ─── Global hook: Telegram initData guard ────────────────────────────────────
  fastify.addHook("onRequest", initDataGuard);

  // ─── Routes ──────────────────────────────────────────────────────────────────
  console.log("[api] 注册路由: status...");
  await fastify.register(statusRoute, { prefix: "/api" });
  console.log("[api] 注册路由: reports...");
  await fastify.register(reportsRoute, { prefix: "/api" });
  console.log("[api] 注册路由: news...");
  await fastify.register(newsRoute, { prefix: "/api" });
  console.log("[api] 注册路由: config...");
  await fastify.register(configRoute, { prefix: "/api" });
  console.log("[api] 路由注册完成");

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
});

// ─── 啟動邏輯 (僅在直接執行時觸發) ───────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const HOST = process.env.HOST || "0.0.0.0";

  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    console.log(`[api] 🚀 Server started successfully!`);
    console.log(`[api] Current Working Directory: ${process.cwd()}`);
    console.log(`[api] Listening on ${HOST}:${PORT}`);
  } catch (err) {
    console.error("❌ [api] 啟動失敗 (Fatal Error):");
    console.error(err.stack || err);
    process.exit(1);
  }
}
