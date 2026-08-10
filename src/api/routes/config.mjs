import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchStrategyConfigUnified } from "../../modules/strategy/strategyLoader.mjs";
import { validateStrategyConfig } from "../../modules/strategy/validateStrategyConfig.mjs";
import {
  validateConfig,
  flattenConfig,
  unflattenConfig,
} from "../../modules/config/configValidator.mjs";
import logger from "../../utils/logger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CUSTOM_STRATEGY_PATH = resolve(
  __dirname,
  "../../../data/config/Strategy.custom.json",
);
const DEFAULT_STRATEGY_PATH = resolve(
  __dirname,
  "../../../data/config/Strategy.default.json",
);
const META_PATH = resolve(__dirname, "../../../data/config/ConfigMeta.json");

export default async function configRoute(fastify) {
  // CORS 與 rate-limit 由 router 在 server.mjs 掛載

  // GET: 取得策略設定 (包含 ConfigMeta 用於前端表單生成)
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

      // 1. 使用新驗證器驗證資料結構 (基於 ConfigMeta)
      try {
        validateStrategyConfig(newConfig);
      } catch (validationErr) {
        logger.warn(
          { err: validationErr.message },
          "[ConfigRouter] 儲存失敗: 原始驗證未通過",
        );
        return reply
          .status(400)
          .send({ error: "策略結構驗證失敗", details: validationErr.message });
      }

      // 2. 額外使用新驗證器 (ConfigMeta-based) 做欄位層級驗證
      const metaText = await readFile(META_PATH, "utf-8");
      const configMeta = JSON.parse(metaText);
      const validationResult = validateConfig(newConfig, configMeta);
      if (!validationResult.valid) {
        logger.warn(
          { errors: validationResult.errors },
          "[ConfigRouter] 儲存失敗: ConfigMeta 驗證未通過",
        );
        return reply
          .status(400)
          .send({
            error: "欄位驗證失敗",
            details: validationResult.errors.join("; "),
          });
      }

      // 3. 寫入到 Strategy.custom.json
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

  // GET: 取得預設設定 (用於重置)
  fastify.get("/strategy-config/default", async (request, reply) => {
    try {
      const defaultText = await readFile(DEFAULT_STRATEGY_PATH, "utf-8");
      const defaultConfig = JSON.parse(defaultText);
      return { success: true, config: defaultConfig };
    } catch (err) {
      logger.error(err);
      return reply.status(500).send({ error: "無法讀取預設設定" });
    }
  });

  // GET: 取得 ConfigMeta (用於前端動態表單)
  fastify.get("/strategy-config/meta", async (request, reply) => {
    try {
      const metaText = await readFile(META_PATH, "utf-8");
      const meta = JSON.parse(metaText);
      return { success: true, meta };
    } catch (err) {
      logger.error(err);
      return reply.status(500).send({ error: "無法讀取 ConfigMeta" });
    }
  });

  // POST: 驗證設定 (不儲存，僅驗證)
  fastify.post("/strategy-config/validate", async (request, reply) => {
    try {
      const config = request.body;

      // 原始驗證
      try {
        validateStrategyConfig(config);
      } catch (validationErr) {
        return reply
          .status(400)
          .send({ valid: false, error: validationErr.message });
      }

      // ConfigMeta 驗證
      const metaText = await readFile(META_PATH, "utf-8");
      const configMeta = JSON.parse(metaText);
      const result = validateConfig(config, configMeta);

      return { valid: result.valid, errors: result.errors };
    } catch (err) {
      logger.error(err);
      return reply.status(500).send({ error: "驗證過程發生錯誤" });
    }
  });
}
