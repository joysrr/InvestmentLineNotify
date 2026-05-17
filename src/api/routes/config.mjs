import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchStrategyConfigUnified } from "../../modules/strategy/strategyLoader.mjs";
import { validateStrategyConfig } from "../../modules/strategy/validateStrategyConfig.mjs";
import logger from "../../utils/logger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CUSTOM_STRATEGY_PATH = resolve(
  __dirname,
  "../../../data/config/Strategy.custom.json",
);
const META_PATH = resolve(__dirname, "../../../data/config/ConfigMeta.json");

export default async function configRoute(fastify) {
  // CORS 與 rate-limit 由 router 在 server.mjs 掛載

  // GET: 提取 Strategy (解析過所有 fallback 來源)
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

      // 2. 獲取最終策略 (含 default vs custom 合併邏輯)
      try {
        const strategyObj = await fetchStrategyConfigUnified();
        data.strategy = {
          content: strategyObj,
          label: "核心策略設定",
          desc: "包含所有防護、購買與資金分配之參數 (Shadow Override Mode)",
        };
      } catch (err) {
        request.log.error(`Strategy unified loading failed: ${err.message}`);
        data.strategy = {
          content: null,
          error: "無法載入策略設定",
          label: "核心策略設定",
          desc: "檔案讀取失敗或格式錯誤",
        };
      }

      return data;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: "無法讀取策略設定檔" });
    }
  });

  // POST: 將使用者修改的參數存入 Strategy.custom.json (Shadow Override)
  fastify.post("/strategy-config", async (request, reply) => {
    try {
      const newConfig = request.body;

      // 1. 驗證資料結構 (如果不合法會拋錯)
      try {
        validateStrategyConfig(newConfig);
      } catch (validationErr) {
        logger.warn(
          { err: validationErr.message },
          "[ConfigRouter] 儲存失敗: 驗證未通過",
        );
        return reply
          .status(400)
          .send({ error: "策略結構驗證失敗", details: validationErr.message });
      }

      // 2. 寫入到 Strategy.custom.json
      await writeFile(
        CUSTOM_STRATEGY_PATH,
        JSON.stringify(newConfig, null, 2) + "\n",
        "utf-8",
      );

      logger.info(
        { ip: request.ip },
        "[ConfigRouter] 自訂策略 Strategy.custom.json 已更新",
      );
      return reply
        .status(200)
        .send({ success: true, message: "策略配置已成功覆寫" });
    } catch (err) {
      logger.error(
        { err: err.stack },
        "[ConfigRouter] POST /strategy-config 嚴重錯誤",
      );
      return reply.status(500).send({ error: "儲存策略設定檔失敗" });
    }
  });
}
