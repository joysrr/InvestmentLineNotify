import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// 定位至專案根目錄的 data/config/parts
const CONFIG_PARTS_DIR = resolve(__dirname, "../../../data/config/parts");
const META_PATH = resolve(__dirname, "../../../data/config/ConfigMeta.json");

export default async function configRoute(fastify) {
  fastify.get("/strategy-config", async (request, reply) => {
    const parts = [
      {
        key: "system",
        file: "SystemConfig.json",
        label: "系統與費用",
        desc: "系統版本、交易稅費與冷卻天數設定",
      },
      {
        key: "asset",
        file: "AssetConfig.json",
        label: "資產與風險",
        desc: "質押倍數上限、現金儲備門檻與發薪日週期",
      },
      {
        key: "indicator",
        file: "IndicatorConfig.json",
        label: "指標與訊號",
        desc: "買賣訊號規則、計分權重與部位分配矩陣",
      },
      {
        key: "guard",
        file: "GuardConfig.json",
        label: "安全守衛",
        desc: "估值 PB 壓縮層、市場情緒抑制與急跌解鎖機制",
      },
    ];

    try {
      const data = { _meta: {} };

      // 讀取元數據
      try {
        const metaText = await readFile(META_PATH, "utf-8");
        data._meta = JSON.parse(metaText);
      } catch (e) {
        request.log.warn("ConfigMeta.json not found, skipping labels");
      }

      for (const part of parts) {
        const path = resolve(CONFIG_PARTS_DIR, part.file);
        try {
          const text = await readFile(path, "utf-8");
          data[part.key] = {
            content: JSON.parse(text),
            label: part.label,
            desc: part.desc,
          };
        } catch (err) {
          request.log.warn(`Config file missing: ${part.file}`);
          data[part.key] = {
            content: null,
            error: "file not found",
            label: part.label,
            desc: part.desc,
          };
        }
      }
      return data;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: "無法讀取策略設定檔" });
    }
  });
}
