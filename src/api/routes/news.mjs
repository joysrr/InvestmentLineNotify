import { readFile } from "fs/promises";
import { join } from "path";

const NEWS_PATH = join(
  process.cwd(),
  "data",
  "news",
  "pool_filtered_active.json",
);

/**
 * GET /api/news
 * Returns the contents of data/news/pool_filtered_active.json.
 * Returns an empty array [] if the file does not exist (non-fatal).
 */
export default async function newsRoute(fastify) {
  fastify.get("/news", async (_request, reply) => {
    try {
      const raw = await readFile(NEWS_PATH, "utf-8");
      const data = JSON.parse(raw);
      return reply.send(data);
    } catch (err) {
      if (err.code === "ENOENT") {
        return reply.send([]);
      }
      fastify.log.error({ err }, "Failed to read news pool");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
