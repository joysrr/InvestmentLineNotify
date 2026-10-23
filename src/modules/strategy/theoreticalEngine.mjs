/**
 * Pure theoretical calculations for shadow-mode research.
 * This module must not read files, call APIs, or mutate strategy state.
 */

export function calculateGrossExposure({
  value0050,
  value00675L,
  leverageMultiplier,
}) {
  if (![value0050, value00675L, leverageMultiplier].every(Number.isFinite)) {
    return {
      status: "UNAVAILABLE",
      reason: "INVALID_EXPOSURE_INPUT",
      grossExposure: null,
    };
  }

  return {
    status: "OK",
    grossExposure: value0050 + value00675L * leverageMultiplier,
  };
}

export function calculateCurrentLeverage({ grossExposure, accountNetAsset }) {
  if (
    !Number.isFinite(grossExposure) ||
    !Number.isFinite(accountNetAsset) ||
    accountNetAsset <= 0
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "INVALID_ACCOUNT_NET_ASSET",
      currentLeverage: null,
    };
  }

  return {
    status: "OK",
    currentLeverage: grossExposure / accountNetAsset,
  };
}

export function calculateEstimatedMaintenance({ collateralValue, totalDebt }) {
  if (totalDebt === 0) {
    return {
      status: "NO_DEBT",
      maintenanceRatio: Infinity,
    };
  }

  return {
    status: "ESTIMATED",
    maintenanceRatio: (collateralValue / totalDebt) * 100,
  };
}

export function calculateHumanCapital({ cashFlows, growthRate, discountRate }) {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_CASH_FLOWS",
      humanCapital: null,
    };
  }

  const humanCapital = cashFlows.reduce(
    (total, cashFlow, index) =>
      total +
      (cashFlow * (1 + growthRate) ** index) / (1 + discountRate) ** index,
    0,
  );

  return {
    status: "OK",
    humanCapital,
  };
}

export function calculateTrueExposure({
  grossExposure,
  financialCapital,
  humanCapital,
}) {
  if (humanCapital == null) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_HUMAN_CAPITAL",
      trueExposure: null,
    };
  }

  return {
    status: "OK",
    trueExposure: grossExposure / (financialCapital + humanCapital),
  };
}

export function calculateCrashTolerance({
  currentMaintenance,
  targetMaintenance,
}) {
  if (
    !Number.isFinite(currentMaintenance) ||
    currentMaintenance <= 0 ||
    !Number.isFinite(targetMaintenance) ||
    targetMaintenance < 0
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "INVALID_MAINTENANCE_INPUT",
      crashTolerance: null,
    };
  }

  return {
    status: "ESTIMATED",
    crashTolerance: 1 - targetMaintenance / currentMaintenance,
  };
}

export function calculateKellyLimits({
  mu,
  sigma,
  borrowRate,
  productCostAdjustment,
  protectiveScale,
}) {
  if ([mu, sigma, borrowRate].some((value) => value == null)) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_RESEARCH_INPUT",
      kellyMax: null,
      halfKelly: null,
    };
  }

  if (!Number.isFinite(sigma) || sigma <= 0) {
    return {
      status: "INVALID_INPUT",
      reason: "INVALID_SIGMA",
      kellyMax: null,
      halfKelly: null,
    };
  }

  if (productCostAdjustment == null) {
    return {
      status: "UNMODELED",
      reason: "MISSING_PRODUCT_COST",
      kellyMax: null,
      halfKelly: null,
    };
  }

  const excessReturn = mu - borrowRate - productCostAdjustment;
  if (excessReturn <= 0) {
    return {
      status: "NO_POSITIVE_KELLY",
      reason: "NON_POSITIVE_EXCESS_RETURN",
      kellyMax: 0,
      halfKelly: 0,
    };
  }

  const kellyMax = excessReturn / sigma ** 2;
  return {
    status: "OK",
    kellyMax,
    halfKelly: kellyMax * protectiveScale,
  };
}
