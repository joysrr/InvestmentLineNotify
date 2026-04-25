import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../../../data/market/latest.json");

/**
 * GET /api/status
 * Returns the full contents of data/market/latest.json.
 * 404 if the file does not exist.
 */
export default async function statusRoute(fastify) {
  fastify.get("/status", async (_request, reply) => {
    try {
      const raw = await readFile(DATA_PATH, "utf-8");
      const data = JSON.parse(raw);
      return reply.send(data);
    } catch (err) {
      if (err.code === "ENOENT") {
        return reply
          .code(404)
          .send({ error: "Market status data not available yet" });
      }
      fastify.log.error({ err }, "Failed to read market/latest.json");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
