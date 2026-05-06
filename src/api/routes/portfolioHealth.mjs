/**
 * portfolioHealth.mjs
 *
 * GET /api/portfolio/health
 * Portfolio Health Dashboard API
 * 回傳整合性的健康度狀態（Margin / Survival / Decoupling / Leverage / Lifecycle / Regime）
 */

import { computePortfolioHealth, getHealthLightStatus } from "../../modules/strategy/portfolioHealth.mjs";
import { fetchStrategyConfigUnified } from "../../modules/strategy/strategyLoader.mjs";

/**
 * 計算 Portfolio 健康度
 */
export default async function portfolioHealthRoute(fastify) {
  fastify.get("/portfolio/health", async (request, reply) => {
    try {
      const {
        maintenanceMargin,
        z2Ratio,
        survivalDropPercent,
        currentGrossLeverage,
        vix,
        macroSentiment,
        currentAge,
      } = request.query;

      // 載入 Strategy.json
      const strategy = await fetchStrategyConfigUnified();

      // 計算生命週期上下文（若有 currentAge）
      let lifecycleContext = null;
      if (currentAge != null) {
        const { computeLifecycleContext } = await import("../../modules/strategy/lifecycleEngine.mjs");
        lifecycleContext = computeLifecycleContext(
          Number(currentAge),
          strategy.lifecycle?.retirementAge ?? 65,
          strategy.lifecycle?.profiles ?? null,
        );
      }

      // 構建 ctx
      const ctx = {
        maintenanceMargin: Number(maintenanceMargin) || 0,
        z2Ratio: Number(z2Ratio) || 0,
        survivalDropPercent: Number(survivalDropPercent) || 0,
        currentGrossLeverage: Number(currentGrossLeverage) || 0,
        vix: Number(vix) || 0,
        macroSentiment: macroSentiment ? { direction: macroSentiment } : null,
        currentAge: currentAge ? Number(currentAge) : null,
      };

      // 計算健康度
      const health = computePortfolioHealth(ctx, strategy, lifecycleContext);

      // 加入簡化燈號
      const lightStatus = getHealthLightStatus(health.status);

      return reply.send({
        ...health,
        lightStatus,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to compute portfolio health");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
