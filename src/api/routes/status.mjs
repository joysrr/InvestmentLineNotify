import { loadStateFromLatestFiles } from "../../domain/ilnState.mjs";

/**
 * GET /api/status
 * Returns the current market status payload derived from latest report + market cache.
 * - 若僅有 latest.json 而無報告，也會回傳 { _meta, data } 結構。
 * - 若兩者皆無，回 404。
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
