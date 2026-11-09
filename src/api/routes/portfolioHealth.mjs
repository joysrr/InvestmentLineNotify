import {
  computePortfolioHealth,
  getHealthLightStatus,
} from "../../modules/strategy/portfolioHealth.mjs";
import { fetchStrategyConfigUnified } from "../../modules/strategy/strategyLoader.mjs";
import { archiveManager } from "../../modules/data/archiveManager.mjs";
import { getTwVix } from "../../modules/providers/twseProvider.mjs";

// TTL Cache (60 seconds)
const cache = new Map();
const CACHE_TTL_MS = 60000;

export function resolveCurrentAge(query = {}, strategy = {}) {
  return Number(query.currentAge) || strategy.lifecycle?.currentAge || 33;
}

async function getCached(key, fetcher) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetcher();
  cache.set(key, { timestamp: Date.now(), data });
  return data;
}

/**
 * 計算 Portfolio 健康度
 */
export default async function portfolioHealthRoute(fastify) {
  fastify.get("/portfolio/health", async (request, reply) => {
    try {
      const query = request.query;

      // 載入 Strategy.json (已帶快取)
      const strategy = await fetchStrategyConfigUnified();

      // 取得最新戰報資料作為備援
      const latestReport = await getCached(
        "latest_report_for_health",
        async () => {
          const dates = await archiveManager.listArchiveDates();
          if (!dates.length) return null;
          return archiveManager.getReportByDate(dates[0]);
        },
      );

      // 數據對齊邏輯 (優先使用 Query, 次之使用最新戰報, 最後為 0)
      const maintenanceMargin =
        Number(query.maintenanceMargin) ||
        latestReport?.signals?.maintenanceMargin ||
        0;

      const z2Ratio =
        Number(query.z2Ratio) || latestReport?.signals?.z2Ratio || 0;

      const survivalDropPercent =
        Number(query.survivalDropPercent) ||
        latestReport?.signals?.marginAnalysis?.riskAssessment
          ?.survivalDropLimit || // 修正：依據 2026-05-03.json 結構
        0;

      const currentGrossLeverage =
        Number(query.currentGrossLeverage) ||
        latestReport?.signals?.grossLeverage ||
        0;

      const vix =
        Number(query.vix) || latestReport?.marketState?.sentiment?.vix || 0;

      let vixTW = null;
      try {
        vixTW = await getTwVix();
      } catch (_err) {
        vixTW = null;
      }

      const macroSentiment =
        query.macroSentiment ||
        latestReport?.macroAnalysis?.conclusion?.market_direction ||
        "NEUTRAL";

      const currentAge = resolveCurrentAge(query, strategy);

      // 計算生命週期上下文
      const { computeLifecycleContext } =
        await import("../../modules/strategy/lifecycleEngine.mjs");
      const lifecycleContext = computeLifecycleContext(
        currentAge,
        strategy.lifecycle?.retirementAge ?? 65,
        strategy.lifecycle?.profiles ?? null,
      );

      // 構建 ctx
      const ctx = {
        maintenanceMargin,
        z2Ratio,
        survivalDropPercent,
        currentGrossLeverage,
        vix,
        vixTW,
        macroSentiment: { direction: macroSentiment },
        currentAge,
      };

      // 計算健康度
      const health = computePortfolioHealth(ctx, strategy, lifecycleContext);

      // 加入簡化燈號
      const lightStatus = getHealthLightStatus(health.status);

      return reply.send({
        ...health,
        lightStatus,
        vixTW,
        _meta: {
          source: query.maintenanceMargin ? "query" : "latest_report",
          reportDate: latestReport?.date,
          cachedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to compute portfolio health");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
