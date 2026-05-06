/**
 * portfolioHealth.mjs
 *
 * Portfolio Health Dashboard 模組
 * 聚合 Margin / Survival / Decoupling / Regime 狀態，計算紅黃綠燈號
 */

import { computeLifecycleContext } from "./lifecycleEngine.mjs";

/**
 * 健康度燈號枚举
 */
export const HEALTH_STATUS = {
  GREEN: "GREEN",
  YELLOW: "YELLOW",
  RED: "RED",
};

/**
 * 計算 Portfolio 健康度
 * @param {Object} ctx - 策略執行上下文（包含維持率、槓桿、生存空間等）
 * @param {Object} strategy - Strategy.json 配置
 * @param {Object} lifecycleContext - 生命週期上下文（可選）
 * @returns {{
 *   status: string,           // GREEN / YELLOW / RED
 *   score: number,            // 0-100 健康分數
 *   components: {
 *     margin: { status: string, score: number, details: Object },
 *     survival: { status: string, score: number, details: Object },
 *     decoupling: { status: string, score: number, details: Object },
 *     leverage: { status: string, score: number, details: Object },
 *     lifecycle: { status: string, score: number, details: Object },
 *     regime: { status: string, score: number, details: Object }
 *   },
 *   summary: string,          // 簡短總結
 *   recommendations: string[] // 建議行動
 * }}
 */
export function computePortfolioHealth(ctx, strategy, lifecycleContext = null) {
  const components = {};

  // ─────────────────────────────────────────────────────────────
  // 1. Margin 健康度（維持率）
  // ─────────────────────────────────────────────────────────────
  const maintenanceMargin = ctx.maintenanceMargin || 0;
  const maintCfg = strategy.maintenance || {};
  const marginCallThreshold = maintCfg.marginCallThreshold || 135;
  const frozenZone = maintCfg.frozenZone || 145;
  const protectTrigger = maintCfg.protectTrigger || 160;

  let marginStatus, marginScore, marginDetails;

  if (maintenanceMargin >= protectTrigger) {
    marginStatus = HEALTH_STATUS.GREEN;
    marginScore = 100;
    marginDetails = {
      level: "safe",
      message: "維持率健康",
      margin: maintenanceMargin,
      threshold: protectTrigger,
    };
  } else if (maintenanceMargin >= frozenZone) {
    marginStatus = HEALTH_STATUS.YELLOW;
    marginScore = 60;
    marginDetails = {
      level: "warning",
      message: "維持率接近警戒區",
      margin: maintenanceMargin,
      threshold: frozenZone,
    };
  } else if (maintenanceMargin >= marginCallThreshold) {
    marginStatus = HEALTH_STATUS.RED;
    marginScore = 30;
    marginDetails = {
      level: "danger",
      message: "維持率進入危險區",
      margin: maintenanceMargin,
      threshold: marginCallThreshold,
    };
  } else {
    marginStatus = HEALTH_STATUS.RED;
    marginScore = 0;
    marginDetails = {
      level: "critical",
      message: "維持率低於強平線",
      margin: maintenanceMargin,
      threshold: marginCallThreshold,
    };
  }

  components.margin = { status: marginStatus, score: marginScore, details: marginDetails };

  // ─────────────────────────────────────────────────────────────
  // 2. Survival 健康度（生存空間）
  // ─────────────────────────────────────────────────────────────
  // 修正說明（Consultant #3）:
  // 原邏輯: survivalDropPercent < minSurvivalDropLimit * 0.7 可能永遠無法 GREEN
  // 新邏輯: 使用固定閾值，符合實際市場情境
  const survivalDropPercent = ctx.survivalDropPercent || 0;
  const minSurvivalDropLimit = lifecycleContext?.profile?.minSurvivalDropLimit || 140;

  let survivalStatus, survivalScore, survivalDetails;

  // 固定閾值：GREEN < 30%, YELLOW < 50%, RED >= 50%
  if (survivalDropPercent < 30) {
    survivalStatus = HEALTH_STATUS.GREEN;
    survivalScore = 100;
    survivalDetails = {
      level: "safe",
      message: "生存空間充足",
      dropPercent: survivalDropPercent,
      threshold: "30%",
    };
  } else if (survivalDropPercent < 50) {
    survivalStatus = HEALTH_STATUS.YELLOW;
    survivalScore = 60;
    survivalDetails = {
      level: "warning",
      message: "生存空間接近警戒區",
      dropPercent: survivalDropPercent,
      threshold: "50%",
    };
  } else {
    survivalStatus = HEALTH_STATUS.RED;
    survivalScore = 0;
    survivalDetails = {
      level: "danger",
      message: "生存空間不足",
      dropPercent: survivalDropPercent,
      threshold: "50%",
    };
  }

  components.survival = { status: survivalStatus, score: survivalScore, details: survivalDetails };

  // ─────────────────────────────────────────────────────────────
  // 3. Decoupling 健康度（資產解耦）
  // ─────────────────────────────────────────────────────────────
  const z2Ratio = ctx.z2Ratio || 0;
  const z2TargetRatio = strategy.threshold?.z2RatioHigh || 45;

  let decouplingStatus, decouplingScore, decouplingDetails;

  if (z2Ratio < z2TargetRatio * 0.5) {
    decouplingStatus = HEALTH_STATUS.GREEN;
    decouplingScore = 100;
    decouplingDetails = {
      level: "safe",
      message: "資產解耦風險低",
      z2Ratio,
      target: z2TargetRatio,
    };
  } else if (z2Ratio < z2TargetRatio) {
    decouplingStatus = HEALTH_STATUS.YELLOW;
    decouplingScore = 60;
    decouplingDetails = {
      level: "warning",
      message: "資產解耦風險中等",
      z2Ratio,
      target: z2TargetRatio,
    };
  } else {
    decouplingStatus = HEALTH_STATUS.RED;
    decouplingScore = 0;
    decouplingDetails = {
      level: "danger",
      message: "資產解耦風險高",
      z2Ratio,
      target: z2TargetRatio,
    };
  }

  components.decoupling = { status: decouplingStatus, score: decouplingScore, details: decouplingDetails };

  // ─────────────────────────────────────────────────────────────
  // 4. Leverage 健康度（槓桿使用）
  // ─────────────────────────────────────────────────────────────
  const currentGrossLeverage = ctx.currentGrossLeverage || 0;
  const lifecycleMaxLeverage = lifecycleContext?.profile?.maxLeverage || 2.0;
  const grossLeverageCeiling = strategy.grossLeverage?.ceiling || 2.0;
  const grossLeverageHardCap = strategy.grossLeverage?.hardCap || 2.5;

  let leverageStatus, leverageScore, leverageDetails;

  const effectiveMax = Math.min(lifecycleMaxLeverage, grossLeverageCeiling);

  if (currentGrossLeverage < effectiveMax * 0.6) {
    leverageStatus = HEALTH_STATUS.GREEN;
    leverageScore = 100;
    leverageDetails = {
      level: "safe",
      message: "槓桿使用保守",
      current: currentGrossLeverage,
      max: effectiveMax,
      limit: lifecycleMaxLeverage,  // HIGH-002 修正：加入 limit 欄位
    };
  } else if (currentGrossLeverage < effectiveMax) {
    leverageStatus = HEALTH_STATUS.YELLOW;
    leverageScore = 60;
    leverageDetails = {
      level: "warning",
      message: "槓桿接近上限",
      current: currentGrossLeverage,
      max: effectiveMax,
      limit: lifecycleMaxLeverage,  // HIGH-002 修正：加入 limit 欄位
    };
  } else if (currentGrossLeverage < grossLeverageHardCap) {
    leverageStatus = HEALTH_STATUS.RED;
    leverageScore = 30;
    leverageDetails = {
      level: "danger",
      message: "超過槓桿上限",
      current: currentGrossLeverage,
      max: effectiveMax,
      limit: lifecycleMaxLeverage,  // HIGH-002 修正：加入 limit 欄位
    };
  } else {
    leverageStatus = HEALTH_STATUS.RED;
    leverageScore = 0;
    leverageDetails = {
      level: "critical",
      message: "觸發槓桿硬頂",
      current: currentGrossLeverage,
      max: effectiveMax,
      limit: lifecycleMaxLeverage,  // HIGH-002 修正：加入 limit 欄位
    };
  }

  components.leverage = { status: leverageStatus, score: leverageScore, details: leverageDetails };

  // ─────────────────────────────────────────────────────────────
  // 5. Lifecycle 健康度（生命週期槓桿匹配）
  // ─────────────────────────────────────────────────────────────
  let lifecycleStatus, lifecycleScore, lifecycleDetails;

  if (lifecycleContext) {
    const isWithinLimit = currentGrossLeverage <= lifecycleMaxLeverage;
    lifecycleStatus = isWithinLimit ? HEALTH_STATUS.GREEN : HEALTH_STATUS.RED;
    lifecycleScore = isWithinLimit ? 100 : 0;
    lifecycleDetails = {
      stage: lifecycleContext.stage,
      yearsToRetirement: lifecycleContext.yearsToRetirement,
      mode: lifecycleContext.profile.mode,
      maxLeverage: lifecycleMaxLeverage,
      currentLeverage: currentGrossLeverage,
      withinLimit: isWithinLimit,
    };
  } else {
    lifecycleStatus = HEALTH_STATUS.GREEN;
    lifecycleScore = 100;
    lifecycleDetails = {
      stage: "N/A",
      message: "未啟用生命週期引擎",
    };
  }

  components.lifecycle = { status: lifecycleStatus, score: lifecycleScore, details: lifecycleDetails };

  // ─────────────────────────────────────────────────────────────
  // 6. Regime 健康度（市場環境）
  // ─────────────────────────────────────────────────────────────
  const vix = ctx.vix || 0;
  const macroSentiment = ctx.macroSentiment?.direction || "NEUTRAL";

  const vixOverrideTrigger = strategy.macroSentiment?.vixOverrideTrigger || 28;
  const vixAbsoluteOverride = strategy.macroSentiment?.vixAbsoluteOverride || 35;

  let regimeStatus, regimeScore, regimeDetails;

  if (vix >= vixAbsoluteOverride) {
    regimeStatus = HEALTH_STATUS.RED;
    regimeScore = 0;
    regimeDetails = {
      level: "panic",
      message: "極端恐慌市場",
      vix,
      action: "Sell-only",
    };
  } else if (vix >= vixOverrideTrigger) {
    regimeStatus = HEALTH_STATUS.YELLOW;
    regimeScore = 50;
    regimeDetails = {
      level: "high_volatility",
      message: "高波動市場",
      vix,
      action: "降槓桿 50%",
    };
  } else if (macroSentiment === "BEAR") {
    regimeStatus = HEALTH_STATUS.YELLOW;
    regimeScore = 60;
    regimeDetails = {
      level: "bearish",
      message: "空頭環境",
      vix,
      sentiment: macroSentiment,
    };
  } else {
    regimeStatus = HEALTH_STATUS.GREEN;
    regimeScore = 100;
    regimeDetails = {
      level: "normal",
      message: "正常市場環境",
      vix,
      sentiment: macroSentiment,
    };
  }

  components.regime = { status: regimeStatus, score: regimeScore, details: regimeDetails };

  // ─────────────────────────────────────────────────────────────
  // 計算總體健康度
  // ─────────────────────────────────────────────────────────────
  const scores = Object.values(components).map((c) => c.score);
  const totalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  let overallStatus;
  if (totalScore >= 80) {
    overallStatus = HEALTH_STATUS.GREEN;
  } else if (totalScore >= 50) {
    overallStatus = HEALTH_STATUS.YELLOW;
  } else {
    overallStatus = HEALTH_STATUS.RED;
  }

  // ─────────────────────────────────────────────────────────────
  // 生成總結與建議
  // ─────────────────────────────────────────────────────────────
  const summary = generateHealthSummary(overallStatus, totalScore, components);
  const recommendations = generateRecommendations(components);

  return {
    status: overallStatus,
    score: totalScore,
    components,
    summary,
    recommendations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 生成健康度總結
 */
function generateHealthSummary(status, score, components) {
  const statusEmoji = {
    [HEALTH_STATUS.GREEN]: "🟢",
    [HEALTH_STATUS.YELLOW]: "🟡",
    [HEALTH_STATUS.RED]: "🔴",
  };

  const redComponents = Object.entries(components)
    .filter(([_, c]) => c.status === HEALTH_STATUS.RED)
    .map(([k]) => k);

  if (redComponents.length === 0) {
    return `${statusEmoji[status]} 健康度 ${score}分 - 整體狀況良好`;
  }

  return `${statusEmoji[status]} 健康度 ${score}分 - 需關注：${redComponents.join(", ")}`;
}

/**
 * 生成建議行動
 */
function generateRecommendations(components) {
  const recommendations = [];

  if (components.margin.details.level === "critical") {
    recommendations.push("🚨 立即減碼或入金，避免強制平倉");
  } else if (components.margin.details.level === "danger") {
    recommendations.push("⚠️ 維持率過低，建議減碼或補充保證金");
  } else if (components.margin.details.level === "warning") {
    recommendations.push("👁️ 維持率接近警戒區，密切監控");
  }

  if (components.survival.details.level === "danger") {
    recommendations.push("📉 生存空間不足，降低槓桿以提高抗跌能力");
  }

  if (components.leverage.details.level === "critical") {
    recommendations.push("🔒 觸發槓桿硬頂，強制降低槓桿至上限以下");
  } else if (components.leverage.details.level === "danger") {
    recommendations.push("📊 超過生命週期槓桿上限，需減碼");
  }

  if (components.regime.details.level === "panic") {
    recommendations.push("🛑 極端恐慌市場，僅允許賣出，禁止加碼");
  } else if (components.regime.details.level === "high_volatility") {
    recommendations.push("📉 高波動環境，槓桿下修 50%");
  }

  if (components.decoupling.details.level === "danger") {
    recommendations.push("💰 Z2 比例過高，考慮轉換為現貨");
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ 目前無需特別操作，維持現行策略");
  }

  return recommendations;
}

/**
 * 將健康度狀態轉換為簡化燈號（供 Mini App 使用）
 */
export function getHealthLightStatus(status) {
  switch (status) {
    case HEALTH_STATUS.GREEN:
      return { emoji: "🟢", label: "正常", color: "#4CAF50" };
    case HEALTH_STATUS.YELLOW:
      return { emoji: "🟡", label: "警告", color: "#FFC107" };
    case HEALTH_STATUS.RED:
      return { emoji: "🔴", label: "危險", color: "#F44336" };
    default:
      return { emoji: "⚪", label: "未知", color: "#9E9E9E" };
  }
}
