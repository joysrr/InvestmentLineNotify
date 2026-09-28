/**
 * budgetLimitPolicy.mjs
 * Budget Priority 系統 - 每日/滾動借款額度控制
 *
 * 設計哲學：先扣固定成本，剩下的才能靈活運用
 * - Baseline DCA（固定費用）：房租、水電 → 每月一定要付，不能動用
 * - Tactical Drop（彈性支出）：旅遊、大件消費 → 有餘裕才花
 * - Tactical Panic（緊急預備金）：醫療、突發 → 留一小筆備用
 *
 * @module budgetLimitPolicy
 */

import { TwDate } from "../../../utils/coreUtils.mjs";
import {
  BUDGET_ROLLING_DAYS,
  DEFAULT_BUDGET_CONFIG,
} from "../strategyDefaults.mjs";

/**
 * 計算每日/滾動借款額度，並依 signalType 分配
 *
 * @param {Object} ctx - 執行上下文
 * @param {number} ctx.netAsset - 淨值
 * @param {number} ctx.totalLoan - 當前總借款
 * @param {number} ctx.loan10DaysAgo - 10天前總借款 (用於 rolling 計算)
 * @param {Object} strategy - 策略設定 (含 trading.budget, lifecycle.monthlyDcaAmount)
 * @param {string} signalType - 訊號類型: "baseline" | "tactical_drop" | "tactical_panic"
 * @param {number} requestedAmount - 策略請求的借款金額
 * @param {Object} [now=TwDate()] - 當前日期 (可注入以利測試)
 * @returns {Object} 額度分配結果
 */
export function resolveBudgetLimit(
  ctx,
  strategy,
  signalType,
  requestedAmount,
  _now = TwDate(),
) {
  // 1. 取得預算參數 (支援熱更新)
  const budget = strategy.trading?.budget || DEFAULT_BUDGET_CONFIG;
  const lifecycle = strategy?.lifecycle || {};

  const {
    maxDailyLoanIncreasePct = budget.maxDailyLoanIncreasePct,
    maxRollingLoanIncreasePct = budget.maxRollingLoanIncreasePct,
    _rollingDays = budget.rollingDays || BUDGET_ROLLING_DAYS,
  } = budget;

  const monthlyDcaAmount = lifecycle.monthlyDcaAmount || 30000;

  // 2. 基礎資料檢查
  const netAsset = ctx.netAsset ?? 0;
  const totalLoan = ctx.totalLoan ?? 0;
  const loan10DaysAgo = ctx.loan10DaysAgo ?? 0;

  if (netAsset <= 0) {
    return {
      allowedAmount: 0,
      isLimited: true,
      limitedReason: "netAsset 為零或負數，無法計算額度",
      budgetInfo: { error: "invalid_netAsset" },
    };
  }

  // 3. 步驟 1: 計算每日硬上限
  const dailyCap = netAsset * maxDailyLoanIncreasePct;

  // 4. 步驟 2: 計算滾動可用額度
  const rollingUsed = Math.max(0, totalLoan - loan10DaysAgo);
  const rollingCap = netAsset * maxRollingLoanIncreasePct;
  const rollingAvailable = Math.max(0, rollingCap - rollingUsed);

  // 5. 步驟 3: 每日總可用額度 (取較小者)
  const dailyAvailable = Math.min(dailyCap, rollingAvailable);

  // 6. 步驟 4: Baseline DCA 預留 (最高優先權)
  // 固定按 20 個交易日均分，不依實際交易日數
  const dailyDcaReserve = monthlyDcaAmount / 20;

  // 7. 步驟 4 保護: 如果每日可用不足以支付 Baseline，Baseline 仍優先
  // (實際上 dailyAvailable 應該 > dailyDcaReserve，但防禦性寫法)
  const effectiveDcaReserve = Math.min(dailyDcaReserve, dailyAvailable);

  // 8. 步驟 5: Tactical 可用池
  const tacticalPool = Math.max(0, dailyAvailable - effectiveDcaReserve);

  // 9. 步驟 6: 依 signalType 分配額度
  let poolAmount = 0;
  let poolAllocationRatio = 0;

  switch (signalType) {
    case "baseline":
      poolAmount = effectiveDcaReserve;
      poolAllocationRatio = 1;
      break;

    case "tactical_drop":
      poolAmount = tacticalPool * 0.7;
      poolAllocationRatio = 0.7;
      break;

    case "tactical_panic":
      poolAmount = tacticalPool * 0.3;
      poolAllocationRatio = 0.3;
      break;

    default:
      // 未知類型視為 baseline (保守處理)
      poolAmount = effectiveDcaReserve;
      poolAllocationRatio = 1;
  }

  // 10. 計算最終允許金額
  const allowedAmount = Math.min(requestedAmount, poolAmount);
  const isLimited = allowedAmount < requestedAmount * 0.999; // 允許極小浮點誤差
  const limitedReason = isLimited
    ? `Budget exhausted: ${signalType} pool=${poolAmount.toFixed(
        0,
      )} < requested=${requestedAmount.toFixed(0)}`
    : null;

  // 11. 構建回傳結果
  return {
    // 原始請求
    requestedAmount,
    signalType,

    // 額度計算中間值 (供除錯/報表)
    dailyCap,
    rollingCap,
    rollingUsed,
    rollingAvailable,
    dailyAvailable,
    dailyDcaReserve: effectiveDcaReserve,
    tacticalPool,

    // 分配結果
    allowedAmount,
    isLimited,
    limitedReason,

    // 透明化資訊 (供報表/除錯/複盤)
    budgetInfo: {
      dailyCap,
      rollingCap,
      rollingUsed,
      rollingAvailable,
      dailyAvailable,
      dailyDcaReserve: effectiveDcaReserve,
      tacticalPool,
      signalTypePool: signalType,
      poolAllocationRatio,
      poolAmount,
      // 風控覆寫資訊 (由上層注入)
      riskOverride: null,
    },
  };
}

/**
 * 風控覆寫：依風險狀態動態調整額度
 * 由 strategyEngine 在 resolveBudgetLimit 後呼叫
 *
 * @param {Object} budgetResult - resolveBudgetLimit 回傳結果
 * @param {Object} ctx - 執行上下文
 * @param {Object} strategy - 策略設定
 * @returns {Object} 調整後的 budgetResult
 */
export function applyRiskOverride(budgetResult, ctx, _strategy) {
  const result = { ...budgetResult };
  const riskOverrides = [];

  // 1. 維持率風控覆寫
  const maintenanceMargin = ctx.maintenanceMargin ?? 999;
  if (maintenanceMargin < 160) {
    // 維持率 < 160% → 僅允許 Baseline，Tactical 全關
    if (result.signalType !== "baseline") {
      result.allowedAmount = 0;
      result.isLimited = true;
      result.limitedReason = `維持率 ${maintenanceMargin.toFixed(
        1,
      )}% < 160%，禁止 Tactical 操作`;
      riskOverrides.push("maintenanceMargin_below_160");
    }
  }

  // 2. VIX 高波動覆寫
  const vix = ctx.vix ?? 0;
  if (vix > 25) {
    // VIX > 25 → 所有額度 × 0.5
    const originalAllowed = result.allowedAmount;
    result.allowedAmount = Math.floor(originalAllowed * 0.5);
    if (result.allowedAmount < originalAllowed) {
      result.isLimited = true;
      result.limitedReason = `VIX ${vix} > 25，額度折半`;
      riskOverrides.push("vix_above_25");
    }
  }

  // 3. MA60 向下趨勢覆寫
  const ma60Slope = ctx.ma60Slope ?? 0;
  if (ma60Slope < -0.1) {
    // MA60 斜率 < -0.1% → Tactical 池 × 0.5
    if (result.signalType !== "baseline") {
      const originalAllowed = result.allowedAmount;
      result.allowedAmount = Math.floor(originalAllowed * 0.5);
      if (result.allowedAmount < originalAllowed) {
        result.isLimited = true;
        result.limitedReason = `MA60 向下 (${ma60Slope.toFixed(
          4,
        )})，Tactical 額度折半`;
        riskOverrides.push("ma60_slope_negative");
      }
    }
  }

  // 4. 生命週期後期保守期覆寫
  const lifecycleStage = ctx.lifecycleStage;
  if (lifecycleStage === "PRE_RETIRE" && result.signalType !== "baseline") {
    result.allowedAmount = 0;
    result.isLimited = true;
    result.limitedReason = "生命週期後期保守期，禁止 Tactical 操作";
    riskOverrides.push("lifecycle_pre_retire");
  }

  // 記錄風控覆寫
  result.budgetInfo = {
    ...result.budgetInfo,
    riskOverride: riskOverrides.length > 0 ? riskOverrides : null,
    riskOverrideApplied: riskOverrides.length > 0,
  };

  return result;
}

/**
 * 計算 Tactical 所需借款金額 (由 scalingRatio 決定)
 * 供 strategyEngine 在建構請求金額時使用
 *
 * @param {Object} ctx - 執行上下文
 * @param {Object} decision - 決策結果 (含 scalingRatio)
 * @returns {number} 請求借款金額
 */
export function calculateRequestedLoanAmount(ctx, decision) {
  const availableCredit = ctx.availableCredit ?? 0;
  const scalingRatio = decision.scalingRatio ?? 1.0;

  // 基礎請求金額 = 剩餘質押空間 × scalingRatio
  const requestedAmount = availableCredit * scalingRatio;

  return requestedAmount;
}

export default {
  resolveBudgetLimit,
  applyRiskOverride,
  calculateRequestedLoanAmount,
};
