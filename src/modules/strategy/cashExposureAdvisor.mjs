import {
  PANIC_RADARS,
  CRISIS_ACCUMULATE_BATCH_RATIO,
  CRISIS_ACCUMULATE_BATCH_COUNT,
} from "./strategyDefaults.mjs";
import { getTargetLeverageByScore } from "./riskManagement.mjs";

/**
 * Phase 7: 階層式取得目標槓桿（零硬編碼 SSOT）
 * 優先級：用戶指定 > 策略恐慌檔位 > 評分階梯 > 生命週期天花板
 * @param {object} portfolio - 包含 targetLeverage（可選）
 * @param {object} strategy - 包含 buy.panic.suggestedLeverage, allocation
 * @param {object} lifecycleContext - 包含 profile.maxLeverageForNewZ2
 * @param {number} marketScore - 市場評分
 * @returns {number} 目標總槓桿倍數
 */
function resolveTargetLeverage(
  portfolio,
  strategy,
  lifecycleContext,
  marketScore,
) {
  const ceiling = lifecycleContext?.profile?.maxLeverageForNewZ2 || 1.5;

  // 1. 用戶主動指定
  if (
    Number.isFinite(portfolio?.targetLeverage) &&
    portfolio.targetLeverage > 0
  ) {
    return Math.min(portfolio.targetLeverage, ceiling);
  }

  // 2. 恐慌檔位
  if (strategy?.buy?.panic?.suggestedLeverage != null) {
    const panicTotal = 1 + strategy.buy.panic.suggestedLeverage;
    return Math.min(panicTotal, ceiling);
  }

  // 3. 評分階梯
  if (strategy?.allocation && Array.isArray(strategy.allocation)) {
    const alloc = getTargetLeverageByScore(marketScore, strategy);
    const allocTotal = 1 + (alloc?.leverage || 0.15);
    return Math.min(allocTotal, ceiling);
  }

  // 4. 預設：當所有參數為空時，回傳天花板（保守策略）
  return ceiling;
}

/**
 * CashExposureAdvisor — 現金驅動曝險分析
 *
 * 以 Sheet 中的 `cash`（所有可立即動用資金：自有 + 增貸餘額）為基礎，
 * 分析「目前總曝險 vs. Kelly 建議曝險缺口 + 現金是否足夠」，給出行動建議。
 *
 * 純函式：不依賴外部狀態、不執行 I/O、不拋例外。
 *
 * 輸入：
 *   cash              number  現金儲備（可立即動用資金）
 *   grossExposure     number  目前總曝險 = qty0050×p + qtyZ2×p×2
 *   accountNetAsset   number  帳戶淨資產（需為 VERIFIED 狀態，否則 UNAVAILABLE）
 *   kellyConservative number  Kelly 建議保守槓桿上限（倍）
 *   radarTriggered    string[]  目前觸發的雷達清單
 *   totalDebt         number  總負債金額（預設 0）
 *
 * 輸出 { status, suggestedDcaAmt, exposureGap, targetExposure, cashAdequacy, message }
 */
export function evaluateCashExposure({
  cash,
  grossExposure,
  accountNetAsset,
  radarTriggered = [],
  totalDebt = 0,
  portfolio = {},
  strategy = {},
  lifecycleContext = {},
  marketScore = 0,
}) {
  // 帳戶淨資產未驗證 → 無法計算，回報 UNAVAILABLE 而非假數字
  if (
    accountNetAsset == null ||
    !Number.isFinite(accountNetAsset) ||
    accountNetAsset <= 0
  ) {
    return {
      status: "UNAVAILABLE",
      suggestedDcaAmt: 0,
      exposureGap: null,
      targetExposure: null,
      cashAdequacy: false,
      message: "帳戶淨資產未驗證，現金曝險建議暫不提供",
    };
  }

  // Phase 7: 動態解析目標槓桿（階層式取得）
  const targetLeverage = resolveTargetLeverage(
    portfolio,
    strategy,
    lifecycleContext,
    marketScore,
  );
  const targetExposure = accountNetAsset * targetLeverage;
  const exposureGap = targetExposure - grossExposure;

  // 已達或超過 Kelly 建議曝險 → 維持，不加速
  if (exposureGap <= 0) {
    return {
      status: "OVER_EXPOSED",
      suggestedDcaAmt: 0,
      exposureGap,
      targetExposure,
      cashAdequacy: false,
      message: `已達/超過 Kelly 建議曝險 (${targetExposure.toFixed(0)} / ${grossExposure.toFixed(0)})，維持基礎 DCA，不加速`,
    };
  }

  // 現金不足 → 無法填補缺口
  if (cash == null || !Number.isFinite(cash) || cash <= 0) {
    return {
      status: "INSUFFICIENT_CASH",
      suggestedDcaAmt: 0,
      exposureGap,
      targetExposure,
      cashAdequacy: false,
      message: `現金不足 (${cash ?? 0})，維持基礎 DCA，等待現金補充`,
    };
  }

  const cashAdequacy = cash >= exposureGap;
  const suggestedDcaAmt = Math.max(0, Math.min(cash * 0.5, exposureGap));

  // 市場雷達異常
  if (radarTriggered && radarTriggered.length > 0) {
    const panicRadars = radarTriggered.filter((r) => PANIC_RADARS.includes(r));
    const fundamentalRadars = radarTriggered.filter(
      (r) => !PANIC_RADARS.includes(r),
    );
    const numericDebt = Number(totalDebt ?? 0);

    // 1. 若有任何基本面/信用雷達觸發 → 一律 DEFER（基本面優先安全原則）
    if (fundamentalRadars.length > 0) {
      return {
        status: "DEFER",
        reason: "fundamental_radars_triggered",
        suggestedDcaAmt: 0,
        exposureGap,
        targetExposure,
        cashAdequacy,
        message: `基本面雷達觸發：${fundamentalRadars.join("，")}，暫緩加速，維持基礎 DCA`,
      };
    }

    // 2. 純恐慌型雷達觸發 + 無借款帳戶 → 限速加碼（Phase 7 動態批次）
    if (panicRadars.length > 0 && numericDebt === 0) {
      // Phase 7: 動態批次計算（00675L 2x 槓桿）
      const capitalGap = Math.max(0, exposureGap / 2);
      const batchByCount = Math.floor(
        capitalGap / CRISIS_ACCUMULATE_BATCH_COUNT,
      );
      const batchByCash = Math.floor(cash * CRISIS_ACCUMULATE_BATCH_RATIO);
      const batchRaw = Math.min(batchByCount, batchByCash, capitalGap);

      // 取整：≥1000 千元取整，<1000 百元取整
      const batchLimit =
        batchRaw >= 1000
          ? Math.floor(batchRaw / 1000) * 1000
          : Math.floor(batchRaw / 100) * 100;

      return {
        status: "CRISIS_ACCUMULATE",
        reason: "panic_opportunity_mode",
        batchLimit,
        suggestedDcaAmt: batchLimit,
        exposureGap,
        targetExposure,
        targetLeverage, // 透明度：目標槓桿（如 1.3x）
        currentLeverage: grossExposure / accountNetAsset, // 透明度：當前槓桿（如 0.78x）
        cashAdequacy,
        batchCalculation: {
          // 透明度：批次計算細節
          capitalGap,
          batchByCount,
          batchByCash,
          selectedBatch: batchLimit,
        },
        message: `⚡ 恐慌加碼模式：無借款帳戶，建議本批加碼 00675L 上限 ${batchLimit.toLocaleString()} TWD`,
        batchRationale: `VIX 恐慌視窗；批次上限 = min(缺口÷${CRISIS_ACCUMULATE_BATCH_COUNT}, 現金×${(CRISIS_ACCUMULATE_BATCH_RATIO * 100).toFixed(0)}%, 資本缺口)；歷史實證 VIX>40 長期正期望值，分批控制路徑損耗`,
        disclaimer:
          "P0 DCA 維持不變，本建議僅影響 P1 條件加碼；00675L 為槓桿產品，震盪市存在複利損耗",
      };
    }

    // 3. 有借款帳戶 + 恐慌雷達 → DEFER（防斷頭）
    return {
      status: "DEFER",
      reason: "debt_defense_mode",
      suggestedDcaAmt: 0,
      exposureGap,
      targetExposure,
      cashAdequacy,
      message: `市場雷達異常：${radarTriggered.join("，")}，暫緩加速，維持基礎 DCA`,
    };
  }

  // 現金充足且市場正常 → 建議 DCA
  return {
    status: "RECOMMEND_DCA",
    suggestedDcaAmt,
    exposureGap,
    targetExposure,
    cashAdequacy,
    message: `現金充足且市場正常，建議本次 DCA $${suggestedDcaAmt.toFixed(0)}（曝險缺口 ${exposureGap.toFixed(0)}）`,
  };
}
