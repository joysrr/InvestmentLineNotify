// src/api/routes/socialSentiment.mjs
//
// 職責：提供 GET /api/social-sentiment 端點，回傳當日社群情緒快照。
// 供 Telegram Mini App「多空對決」專區與首頁抽屜渲染指標卡片。

import { readFile } from "fs/promises";
import {
  DEFAULT_SENTIMENT_FILE_PATH,
  DEFAULT_SOCIAL_SENTIMENT,
} from "../../modules/providers/socialSentimentProvider.mjs";

/**
 * GET /api/social-sentiment
 * 回傳最新社群情緒快照，若檔案不存在則回傳安全預設值 (Safe-fallback)
 */
export default async function socialSentimentRoute(fastify) {
  fastify.get("/social-sentiment", async (_request, reply) => {
    try {
      const raw = await readFile(DEFAULT_SENTIMENT_FILE_PATH, "utf-8");
      const data = JSON.parse(raw);
      return reply.send(data);
    } catch (err) {
      if (err.code === "ENOENT") {
        return reply.send(DEFAULT_SOCIAL_SENTIMENT);
      }
      fastify.log.error(
        { err },
        "Failed to read social sentiment daily snapshot",
      );
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
