import { loadStateFromLatestFiles } from "../../domain/ilnState.mjs";

/**
 * GET /api/status
 * 使用 IlnState 載入最新狀態，回傳 data/market/latest.json 結構。
 * 若 market + report 都不存在則回 404。
 */
export default async function statusRoute(fastify) {
  fastify.get("/status", async (_request, reply) => {
    try {
      const state = await loadStateFromLatestFiles();

      if (!state) {
        return reply
          .code(404)
          .send({ error: "Market status data not available yet" });
      }

      const payload = state.toStatusPayload();
      return reply.send(payload);
    } catch (err) {
      fastify.log.error({ err }, "Failed to load market status via IlnState");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
