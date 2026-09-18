// src/api/routes/socialSentiment.mjs
//
// 職責：提供 GET /api/social-sentiment 端點，回傳當日社群情緒快照。
// 供 Telegram Mini App「多空對決」專區與首頁抽屜渲染指標卡片。

import {
  fetchSocialSentimentData,
  DEFAULT_SENTIMENT_FILE_PATH,
  DEFAULT_SOCIAL_SENTIMENT,
} from "../../modules/providers/socialSentimentProvider.mjs";

/**
 * GET /api/social-sentiment
 * 回傳最新社群情緒快照，若檔案不存在則回傳安全預設值 (Safe-fallback)
 */
export default async function socialSentimentRoute(fastify) {
  fastify.get("/social-sentiment", async (_request, reply) => {
    const result = await fetchSocialSentimentData(DEFAULT_SENTIMENT_FILE_PATH);
    if (!result.success && result.reason !== "FILE_NOT_FOUND") {
      fastify.log.warn(
        { reason: result.reason },
        "Social sentiment snapshot fallback applied",
      );
    }
    return reply.send(result.data || DEFAULT_SOCIAL_SENTIMENT);
  });
}
