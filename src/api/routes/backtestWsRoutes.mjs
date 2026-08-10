/**
 * backtestWsRoutes.mjs
 * 回測 WebSocket 進度推播路由
 * - GET /api/backtest/:jobId/ws - 訂閱任務進度
 */

import { subscribeProgress } from "../../modules/backtest/backtestQueue.mjs";

async function backtestWsRoutes(fastify) {
  // WebSocket 路由：訂閱回測進度
  fastify.get(
    "/api/backtest/:jobId/ws",
    { websocket: true },
    (connection, request) => {
      const { jobId } = request.params;
      const logger = fastify.log.child({ jobId, ws: true });

      logger.info("WebSocket 連線建立");

      // 處理 ping/pong
      connection.socket.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "ping") {
            connection.socket.send(
              JSON.stringify({ type: "pong", timestamp: Date.now() }),
            );
          }
        } catch {
          // 忽略非 JSON 訊息
        }
      });

      // 訂閱進度
      const unsubscribe = subscribeProgress(jobId, (progress) => {
        if (connection.socket.readyState === 1) {
          // OPEN
          connection.socket.send(JSON.stringify(progress));
        }
      });

      logger.info({ jobId }, "已訂閱進度推播");

      // 連線關閉處理
      connection.socket.on("close", () => {
        logger.info("WebSocket 連線關閉");
        unsubscribe();
      });

      connection.socket.on("error", (err) => {
        logger.error({ err }, "WebSocket 錯誤");
      });

      // 發送歡迎訊息
      connection.socket.send(
        JSON.stringify({
          type: "connected",
          jobId,
          message: "已連線至回測進度推播",
          timestamp: Date.now(),
        }),
      );
    },
  );
}

export default backtestWsRoutes;
