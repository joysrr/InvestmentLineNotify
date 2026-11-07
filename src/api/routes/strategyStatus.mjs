import { loadStateFromLatestFiles } from "../../domain/ilnState.mjs";
import {
  determineLifecycleStage,
  LIFECYCLE_STAGE,
} from "../../modules/strategy/lifecycleEngine.mjs";

/**
 * GET /api/strategy-status
 * 回傳策略狀態詳細資訊：
 * - weightScore 構成細項
 * - 冷卻期狀態與倒數天數
 * - 策略分數檔位與目標槓桿
 * - Budget Priority 資訊
 * - 信號分類與類型
 * - 生命週期階段
 */
export default async function strategyStatusRoute(fastify) {
  fastify.get("/strategy-status", async (_request, reply) => {
    try {
      const state = await loadStateFromLatestFiles();

      if (!state) {
        return reply
          .code(404)
          .send({ error: "Strategy status data not available yet" });
      }

      const signals = state.signals ?? {};
      const strategy = state.strategySnapshot ?? {};
      const lifecycle = strategy.lifecycle ?? {};
      const _trading = strategy.trading ?? {};

      // 1. Weight Score 構成細項
      const weightDetails = signals.weightDetails ?? {};
      const weightScoreBreakdown = {
        dropScore: weightDetails.dropScore ?? 0,
        rsiScore: weightDetails.rsiScore ?? 0,
        macdScore: weightDetails.macdScore ?? 0,
        kdScore: weightDetails.kdScore ?? 0,
        sentimentScore: weightDetails.sentimentScore ?? 0,
        total:
          (weightDetails.dropScore ?? 0) +
          Math.max(weightDetails.rsiScore ?? 0, weightDetails.kdScore ?? 0) +
          (weightDetails.macdScore ?? 0) +
          (weightDetails.sentimentScore ?? 0),
      };

      // 2. 冷卻期狀態
      const cooldownStatus = signals.cooldownStatus ?? {
        inCooldown: false,
        daysLeft: 0,
        lastBuyDate: null,
        message: "無冷卻期資料",
      };

      // 3. 策略分數檔位與目標槓桿
      const allocation = strategy.allocation ?? [];
      const currentScore = signals.score ?? signals.weightScore ?? 0;
      let currentAllocation = allocation[0] || {
        leverage: 0.15,
        cash: 0.85,
        comment: "底倉",
      };
      let targetAllocation =
        allocation[allocation.length - 1] || currentAllocation;

      for (const alloc of allocation) {
        if (currentScore >= alloc.minScore) {
          currentAllocation = alloc;
        }
        if (currentScore >= alloc.minScore) {
          targetAllocation = alloc;
        } else {
          break;
        }
      }

      // 4. Budget Priority 資訊
      const _budgetInfo = signals.budgetInfo ?? {};
      const _budgetAllowedAmount = signals.budgetAllowedAmount ?? null;
      const _budgetIsLimited = signals.budgetIsLimited ?? false;
      const _budgetLimitedReason = signals.budgetLimitedReason ?? null;

      // 5. 信號分類
      const _signalCategory = signals.signalCategory ?? "baseline";
      const _signalType = signals.signalType ?? "baseline";

      // 6. 生命週期
      const yearsToRetirement = lifecycle.currentAge
        ? Math.max(0, (lifecycle.retirementAge ?? 65) - lifecycle.currentAge)
        : null;
      const lifecycleStageEn =
        signals.regimeState?.lifecycleStageEn ||
        (yearsToRetirement !== null
          ? determineLifecycleStage(yearsToRetirement)
          : LIFECYCLE_STAGE.EARLY);
      // 向後相容：也支援中文 lifecycleStage
      const lifecycleStage = lifecycleStageEn;

      // 6. 當前分配檔位資訊
      const allocationInfo = {
        current: {
          minScore: currentAllocation.minScore ?? 0,
          leverage: currentAllocation.leverage ?? 0,
          cash: currentAllocation.cash ?? 0,
          comment: currentAllocation.comment ?? "",
        },
        next:
          targetAllocation !== currentAllocation
            ? {
                minScore: targetAllocation.minScore ?? 0,
                leverage: targetAllocation.leverage ?? 0,
                cash: targetAllocation.cash ?? 0,
                comment: targetAllocation.comment ?? "",
                scoreToNext: Math.max(
                  0,
                  (targetAllocation.minScore ?? 0) - (signals.score ?? 0),
                ),
              }
            : null,
      };

      // 7. Budget Priority 詳細資訊
      const budgetDetails = {
        isLimited: signals.budgetIsLimited ?? false,
        limitedReason: signals.budgetLimitedReason ?? null,
        allowedAmount: signals.budgetAllowedAmount ?? null,
        details: signals.budgetInfo ?? {},
      };

      // 8. 綜合風控狀態
      const regimeState = signals.regimeState ?? {};
      const regimeResult = signals.regimeResult ?? {};
      const maintenanceRisk = signals.maintenanceRisk ?? {};
      const grossLeverageResult = signals.grossLeverageResult ?? {};

      const payload = {
        // 基礎資訊
        timestamp: new Date().toISOString(),
        reportDate: signals.date ?? new Date().toISOString().split("T")[0],

        // 1. Weight Score 構成
        weightScore: weightScoreBreakdown,

        // 2. 冷卻期狀態
        cooldown: {
          inCooldown: cooldownStatus.inCooldown ?? false,
          daysLeft: cooldownStatus.daysLeft ?? 0,
          lastBuyDate: cooldownStatus.lastBuyDate ?? null,
          message: cooldownStatus.message ?? "無冷卻期資料",
        },

        // 3. 策略分數檔位
        allocation: allocationInfo,

        // 3.1 當前分數與門檻
        scoring: {
          currentScore: currentScore,
          minScoreToBuy: strategy.buy?.minWeightScoreToBuy ?? 0,
          buyTactical: strategy.scoringMatrix?.thresholds?.buyTactical ?? 4,
          buyTacticalBullish:
            strategy.scoringMatrix?.thresholds?.buyTacticalBullish ?? 1.5,
        },

        // 4. Budget Priority
        budget: budgetDetails,

        // 5. 信號分類
        signal: {
          category: signals.signalCategory ?? "baseline",
          type: signals.signalType ?? "baseline",
          direction: signals.signalDirection ?? "hold",
          target: signals.target ?? "—",
          suggestion: signals.suggestion ?? "維持觀望",
        },

        // 6. 生命週期
        lifecycle: {
          stage: lifecycleStage,
          stageEn: lifecycleStageEn,
          currentAge: lifecycle.currentAge ?? null,
          retirementAge: lifecycle.retirementAge ?? 65,
          yearsToRetirement: lifecycle.currentAge
            ? Math.max(
                0,
                (lifecycle.retirementAge ?? 65) - lifecycle.currentAge,
              )
            : null,
        },

        // 6.1 生命週期設定檔
        lifecycleProfile: {
          maxLeverage:
            regimeState?.maxLeverage ??
            lifecycle.profiles?.[lifecycleStage]?.maxLeverage ??
            2.0,
          maxLeverageForNewZ2:
            regimeState?.maxLeverageForNewZ2 ??
            lifecycle.profiles?.[lifecycleStage]?.maxLeverageForNewZ2 ??
            1.5,
          minSurvivalDropLimit:
            lifecycle.profiles?.[lifecycleStage]?.minSurvivalDropLimit ?? 140,
          mode: lifecycle.profiles?.[lifecycleStage]?.mode ?? "unknown",
        },

        // 7. 風控狀態
        risk: {
          regime: regimeResult.state ?? regimeState ?? "NORMAL",
          regimeResult: regimeResult,
          maintenanceMargin: signals.maintenanceMargin ?? null,
          maintenanceRisk: maintenanceRisk,
          grossLeverage: signals.grossLeverage ?? null,
          grossLeverageResult: grossLeverageResult,
          valuationGuard: signals.valuationGuardResult ?? null,
          valuationMomentum: signals.valuationMomentumResult ?? null,
          panicBypassActive: signals.panicBypassActive ?? false,
          trailingActive: signals.trailingActive ?? false,
        },

        // 8. 關鍵指標
        keyMetrics: {
          maintenanceMargin: signals.maintenanceMargin ?? null,
          grossLeverage: signals.grossLeverage ?? null,
          z2Ratio: signals.z2Ratio ?? null,
          currentPr: signals.valuationGuardResult?.currentPR ?? null,
          netAsset: signals.netAsset ?? null,
          actualLeverage: signals.actualLeverage ?? null,
        },
      };

      return reply.send(payload);
    } catch (err) {
      fastify.log.error({ err }, "Failed to load strategy status");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
