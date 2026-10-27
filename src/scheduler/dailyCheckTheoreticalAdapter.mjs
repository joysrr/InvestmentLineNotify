/**
 * Adapter for integrating theoretical calculations into dailyCheck.
 * Bridges portfolio snapshot data to theoretical engine.
 */

import {
  calculateGrossExposure,
  calculateCurrentLeverage,
  calculateEstimatedMaintenance,
  calculateKellyLimits,
  calculateHumanCapital,
  calculateTrueExposure,
  calculateCrashTolerance,
} from "../modules/strategy/theoreticalEngine.mjs";
import { mapTheoreticalInputs } from "../modules/strategy/theoreticalInputMapper.mjs";
import { createTheoreticalShadowReport } from "../modules/strategy/theoreticalShadowReport.mjs";
import { calculateMuSigma } from "../modules/strategy/marketRegimeModel.mjs";
import { getHistoricalPrices } from "../modules/providers/yahooProvider.mjs";
import { loadPriceHistoryFromReports } from "../runSocialSentimentFetch.mjs";

/**
 * 取得 0050 歷史價格（優先 Yahoo，失敗則從既有報告重建）
 * @returns {Promise<Array<{date: string, close: number}>>}
 */
async function fetchPriceHistory0050() {
  // 嘗試 Yahoo Finance
  try {
    const prices = await getHistoricalPrices("0050.TW", 126);
    if (prices.length >= 60) {
      return prices;
    }
  } catch (err) {
    // 忽略錯誤，嘗試備援
  }
  // 備援：從既有日報重建
  return loadPriceHistoryFromReports();
}

/**
 * Builds theoretical shadow report for daily report.
 * @param {Object} params
 * @param {string} params.dateText - Report date (YYYY-MM-DD)
 * @param {Object} params.portfolio - Portfolio state (qty0050, qtyZ2, totalLoan, cash)
 * @param {Object} params.portfolioSnapshot - Portfolio snapshot from buildReportPortfolioSnapshot
 * @param {Object} params.price0050Snapshot - 0050 price snapshot
 * @param {Object} params.priceZ2Snapshot - 00675L price snapshot
 * @returns {Promise<Object>} Theoretical shadow report or UNAVAILABLE status
 */
export async function buildTheoreticalShadowForReport({
  dateText,
  portfolio,
  portfolioSnapshot,
  price0050Snapshot,
  priceZ2Snapshot,
}) {
  // Graceful degradation: if portfolioSnapshot is UNAVAILABLE, propagate
  if (
    !portfolioSnapshot ||
    portfolioSnapshot.status === "UNAVAILABLE" ||
    !portfolioSnapshot.accountNetAsset ||
    !portfolioSnapshot.collateralValue
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "PORTFOLIO_SNAPSHOT_UNAVAILABLE",
    };
  }

  // Validate price snapshots
  if (
    !price0050Snapshot?.price ||
    !priceZ2Snapshot?.price ||
    !price0050Snapshot.asOf ||
    !priceZ2Snapshot.asOf
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_PRICE_SNAPSHOT",
    };
  }

  // Build complete snapshot for theoretical input
  const completeSnapshot = {
    qty0050: portfolio.qty0050,
    qtyZ2: portfolio.qtyZ2,
    price0050: price0050Snapshot.price,
    priceZ2: priceZ2Snapshot.price,
    totalLoan: portfolio.totalLoan,
    accountNetAsset: portfolioSnapshot.accountNetAsset,
    accountNetAssetSource:
      portfolioSnapshot.accountNetAssetSource || portfolioSnapshot.source,
    accountNetAssetAsOf:
      portfolioSnapshot.accountNetAssetAsOf || portfolioSnapshot.asOf,
    collateralValue: portfolioSnapshot.collateralValue,
    collateralValueSource:
      portfolioSnapshot.collateralValueSource || portfolioSnapshot.source,
    collateralValueAsOf:
      portfolioSnapshot.collateralValueAsOf || portfolioSnapshot.asOf,
  };

  // Map to theoretical inputs
  const mappedInputs = mapTheoreticalInputs({
    snapshot: completeSnapshot,
    source: portfolioSnapshot.source,
    asOf: portfolioSnapshot.asOf,
  });

  // If inputs are unavailable, propagate
  if (mappedInputs.status === "UNAVAILABLE") {
    return {
      status: "UNAVAILABLE",
      reason: mappedInputs.reason,
    };
  }

  // Fetch market regime data (μ, σ) for Kelly calculation
  const priceHistory = await fetchPriceHistory0050();
  const regimeOutput = calculateMuSigma({ prices: priceHistory, minDays: 60 });

  // Calculate theoretical values
  const grossExposure =
    mappedInputs.status === "OK"
      ? calculateGrossExposure({
          value0050: mappedInputs.inputs.value0050.value,
          value00675L: mappedInputs.inputs.value00675L.value,
          leverageMultiplier: 2,
        })
      : null;

  const currentLeverage =
    grossExposure?.status === "OK" && mappedInputs.inputs.accountNetAsset
      ? calculateCurrentLeverage({
          grossExposure: grossExposure.grossExposure,
          accountNetAsset: mappedInputs.inputs.accountNetAsset.value,
        })
      : null;

  const estimatedMaintenance =
    mappedInputs.status === "OK" && mappedInputs.inputs.collateralValue
      ? calculateEstimatedMaintenance({
          collateralValue: mappedInputs.inputs.collateralValue.value,
          totalDebt: mappedInputs.inputs.totalDebt.value,
        })
      : null;

  // Kelly Limits: use market regime model output (dynamic μ/σ)
  const kellyLimits =
    mappedInputs.status === "OK" && regimeOutput.status === "OK"
      ? calculateKellyLimits({
          mu: regimeOutput.mu,
          sigma: regimeOutput.sigma,
          borrowRate: 0.025, // 2.5% borrow rate (from margin loan)
          productCostAdjustment: 0.01, // 1% product cost (ETF fee + slippage)
          protectiveScale: 0.5, // Half-Kelly for safety
        })
      : null;

  // Human Capital: still uses fixed values (to be implemented in Phase 5.3 Option B)
  const humanCapital =
    mappedInputs.status === "OK"
      ? calculateHumanCapital({
          annualIncome: 1200000, // 100K/month * 12 (TODO: make configurable via user profile)
          yearsToRetirement: 25, // TODO: make configurable
          discountRate: 0.03,
        })
      : null;

  const trueExposure =
    grossExposure?.status === "OK" && humanCapital?.status === "OK"
      ? calculateTrueExposure({
          grossExposure: grossExposure.grossExposure,
          financialCapital: mappedInputs.inputs.accountNetAsset.value,
          humanCapital: humanCapital.presentValue,
        })
      : null;

  const crashTolerance =
    mappedInputs.status === "OK" && mappedInputs.inputs.accountNetAsset
      ? calculateCrashTolerance({
          currentMaintenance: estimatedMaintenance?.maintenanceRatio ?? 0,
          targetMaintenance: 0.3, // 30% maintenance requirement
        })
      : null;

  // Build shadow report
  const shadowReport = createTheoreticalShadowReport({
    timestamp: dateText,
    actualDecision: null, // Daily report doesn't have explicit decision
    mappedInputs,
    theory: {
      status: "RESEARCH_ONLY",
      grossExposure: grossExposure?.grossExposure ?? null,
      currentLeverage: currentLeverage?.currentLeverage ?? null,
      accountNetAsset: mappedInputs.inputs?.accountNetAsset?.value ?? null,
      estimatedMaintenance: estimatedMaintenance?.maintenanceRatio ?? null,
      kellyLimits:
        kellyLimits?.halfKelly != null && kellyLimits?.kellyMax != null
          ? {
              conservative: kellyLimits.halfKelly,
              full: kellyLimits.kellyMax,
            }
          : null,
      humanCapital: humanCapital?.presentValue ?? null,
      trueExposure: trueExposure?.trueExposure ?? null,
      crashTolerance: crashTolerance
        ? {
            maxDrawdownTolerance: crashTolerance.crashTolerance,
            drawdownBeforeMarginCall: crashTolerance.crashTolerance,
          }
        : null,
      // Market regime info for transparency
      marketRegime:
        regimeOutput.status === "OK"
          ? {
              mu: regimeOutput.mu,
              sigma: regimeOutput.sigma,
              regime: regimeOutput.regime,
              asOf: regimeOutput.asOf,
              sampleDays: regimeOutput.sampleDays,
            }
          : null,
    },
  });

  // Return available shadow report with status
  return {
    status: "AVAILABLE",
    ...shadowReport,
  };
}
