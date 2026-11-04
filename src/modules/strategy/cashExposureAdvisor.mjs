import {
  PANIC_RADARS,
  CRISIS_ACCUMULATE_BATCH_RATIO,
  CRISIS_ACCUMULATE_MAX_BATCH,
} from "./strategyDefaults.mjs";

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
  kellyConservative,
  radarTriggered = [],
  totalDebt = 0,
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

  const targetExposure = accountNetAsset * kellyConservative;
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
        suggestedDcaAmt: 0,
        exposureGap,
        targetExposure,
        cashAdequacy,
        message: `基本面雷達觸發：${fundamentalRadars.join("，")}，暫緩加速，維持基礎 DCA`,
      };
    }

    // 2. 純恐慌型雷達觸發 + 無借款帳戶 → 限速加碼
    if (panicRadars.length > 0 && numericDebt === 0) {
      const batchLimit = Math.min(
        cash * CRISIS_ACCUMULATE_BATCH_RATIO,
        CRISIS_ACCUMULATE_MAX_BATCH,
      );
      return {
        status: "CRISIS_ACCUMULATE",
        suggestedDcaAmt: batchLimit,
        exposureGap,
        targetExposure,
        cashAdequacy,
        message: `⚡ 恐慌加碼模式：無借款帳戶，建議本批加碼 00675L 上限 ${batchLimit.toLocaleString()} TWD`,
        batchRationale: `VIX 恐慌視窗；每批上限 = min(現金×${CRISIS_ACCUMULATE_BATCH_RATIO * 100}%, ${CRISIS_ACCUMULATE_MAX_BATCH})；歷史實證 VIX>40 長期正期望值，限速控制路徑損耗`,
        disclaimer:
          "P0 DCA 維持不變，本建議僅影響 P1 條件加碼；00675L 為槓桿產品，震盪市存在複利損耗",
      };
    }

    // 3. 有借款帳戶 + 恐慌雷達 → DEFER（防斷頭）
    return {
      status: "DEFER",
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
