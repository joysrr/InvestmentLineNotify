import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STRATEGY_PATH = resolve(__dirname, "../../../data/config/Strategy.json");
const META_PATH = resolve(__dirname, "../../../data/config/ConfigMeta.json");

export default async function configRoute(fastify) {
  fastify.get("/strategy-config", async (request, reply) => {
    try {
      const data = { _meta: {} };

      // 1. 讀取翻譯字典 (ConfigMeta)
      try {
        const metaText = await readFile(META_PATH, "utf-8");
        data._meta = JSON.parse(metaText);
      } catch (e) {
        request.log.warn("ConfigMeta.json not found, skipping labels");
      }

      // 2. 讀取唯一的 Strategy.json
      try {
        const text = await readFile(STRATEGY_PATH, "utf-8");
        data.strategy = {
          content: JSON.parse(text),
          label: "核心策略設定 (Strategy.json)",
          desc: "包含所有防護、購買與資金分配之參數",
        };
      } catch (err) {
        request.log.error(`Strategy.json missing: ${err.message}`);
        data.strategy = {
          content: null,
          error: "file not found",
          label: "核心策略設定",
          desc: "檔案讀取失敗",
        };
      }

      return data;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: "無法讀取策略設定檔" });
    }
  });
}
