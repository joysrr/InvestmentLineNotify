// src/domain/signalContext.mjs
//
// 職責：計算層（Indicator + SignalData 組裝）
//   接收 buildDailyRunContext 的回傳值（DailyRunContext），
//   計算技術指標並組裝 getInvestmentSignalAsync 所需的完整 signalData。
//
// 設計原則：
//   - Pure function（不做 IO，不寫檔案，不 call 外部 API）
//   - dailyRunContext.mjs 只負責 IO；本檔只負責計算與組裝
//   - 輸出的 SignalContext 包含 signalData 及計算中間產物，
//     供 dailyCheck.mjs 後續 Step（logDailyToSheet、snapshotPayload）使用

import { calculateIndicators } from "../modules/strategy/indicators.mjs";

/**
 * buildSignalContext
 *
 * @param {DailyRunContext} ctx - buildDailyRunContext 的回傳物件
 * @returns {SignalContext}
 */
export function buildSignalContext(ctx) {
  const {
    historyZ2,
    history0050,
    currentPriceZ2,
    basePrice,
    price0050,
    vixData,
    vixArr,
    macroData,
    macroMarketDirection,
    valuationGuardState,
    pbRecords,
    pbRecordsObjects,
    usRisk,
    lastState,
  } = ctx;

  // ── 計算技術指標 ──────────────────────────────────────────────────────────
  const indicatorsZ2 = calculateIndicators(historyZ2);
  const indicators0050 = calculateIndicators(history0050);

  const { closes, rsiArr, macdArr, kdArr, ma20Arr, atrArr, ma240 } =
    indicatorsZ2;

  const latestClose = closes.at(-1);
  const latestRSI = rsiArr.at(-1);
  const latestKD = kdArr.at(-1) ?? null;

  // currentPriceZ2 有值（MIS 即時價）→ 使用即時價；
  // null（MIS 失敗）→ fallback 至 latestClose（前一交易日收盤價）。
  const finalPriceZ2 = currentPriceZ2 || latestClose;

  // ── 組裝 signalData ───────────────────────────────────────────────────────
  const signalData = {
    RSI: latestRSI,
    KD_K: latestKD?.k ?? null,
    KD_D: latestKD?.d ?? null,
    currentPrice: finalPriceZ2,
    basePrice,
    price0050: price0050 || 0,
    VIX: vixData?.value ?? null,
    VIXTime: vixData?.dateTimeText ?? vixData?.time ?? null,
    VIXStatus: vixData?.status ?? null,
    vixArr,
    ma240,
    portfolio: lastState,
    rsiArr,
    macdArr,
    kdArr,
    closeArr: closes,
    ma20Arr,
    atrArr,
    indicators0050: {
      rsi: indicators0050.rsiArr.at(-1),
      rsiArr: indicators0050.rsiArr,
      ma60Slope: indicators0050.ma60Slope,
      kd: indicators0050.kdArr.at(-1),
    },
    macroMarketDirection,
    valuationGuardState,
    pbRecords,
    pbRecordsObjects,
    rawValuation: macroData?.rawValuation ?? null,
    usRisk,
  };

  return {
    signalData,
    indicatorsZ2,
    indicators0050,
    finalPriceZ2,
  };
}
