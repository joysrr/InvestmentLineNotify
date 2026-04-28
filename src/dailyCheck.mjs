// src/dailyCheck.mjs
import "dotenv/config";
import { assertEnv } from "./utils/envGuard.mjs";
assertEnv();

import { calculateIndicators } from "./modules/strategy/indicators.mjs";
import { getInvestmentSignalAsync } from "./modules/strategy/strategyEngine.mjs";
import { broadcastDailyReport } from "./modules/notifications/notifier.mjs";
import { getAiInvestmentAdvice } from "./modules/ai/aiCoach.mjs";
import { shouldRunJudge, runJudge } from "./modules/ai/llmJudge.mjs";
import { logDailyToSheet } from "./modules/storage.mjs";
import { archiveManager } from "./modules/data/archiveManager.mjs";
import { TwDate, stepTimer } from "./utils/coreUtils.mjs";
import { isSnapshotEncryptEnabled } from "./utils/snapshotCrypto.mjs";
import { sendTelegramBatch } from "./modules/notifications/transports/telegramClient.mjs";
import { IlnState } from "./domain/ilnState.mjs";
import { buildDailyRunContext } from "./domain/dailyRunContext.mjs";
import logger from "./utils/logger.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-${Date.now()}`;

export async function dailyCheck({
  isTelegramEnabled = true,
  isAIAdvisor = true,
  isCallAI = true,
}) {
  logger.info("🚀 開始執行 dailyCheck...");

  // ── Step 1：統一資料撈取 ────────────────────────────────────────────────────
  let ctx;
  try {
    ctx = await buildDailyRunContext({ isCallAI });
  } catch (err) {
    // 致命錯誤（Z2 歷史不足）：通知後提前返回
    logger.error(err, "❌ [dailyCheck] buildDailyRunContext 失敗，中止執行");
    if (isTelegramEnabled) {
      await sendTelegramBatch([
        {
          text: `⚠️ <b>嚴重錯誤</b>\n00675L 歷史資料不足 30 筆，今日 dailyCheck 強制終止。`,
        },
      ]);
    }
    return "❌ 資料不足";
  }

  const {
    lastState,
    openToday,
    vixData,
    basePrice,
    price0050,
    currentPriceZ2,
    historyZ2,
    history0050,
    macroData,
    macroAndChipStr,
    usRisk,
    quote,
    newsMessages,
    newsSummaryText,
    newsStructured,
    macroAnalysis,
    macroTextForCoach,
    macroMarketDirection,
    previousAdviceSummary,
    valuationGuardState,
    pbRecords,
    pbRecordsObjects,
  } = ctx;

  if (!openToday) {
    logger.info("😴 當日無開市，跳過通知");
  }

  // ── Step 2：計算技術指標 ────────────────────────────────────────────────────
  logger.info("🧠 正在計算 00675L 指標...");
  let indicatorsZ2;
  {
    const done = stepTimer("calculateIndicatorsZ2");
    indicatorsZ2 = calculateIndicators(historyZ2);
    done();
  }

  logger.info("🧠 正在計算 0050 指標...");
  let indicators0050;
  {
    const done = stepTimer("calculateIndicators0050");
    indicators0050 = calculateIndicators(history0050);
    done();
  }

  const { closes, rsiArr, macdArr, kdArr } = indicatorsZ2;
  const latestClose = closes[closes.length - 1];
  const latestRSI = rsiArr[rsiArr.length - 1];
  const latestKD = kdArr[kdArr.length - 1];

  // [P2-6] finalPriceZ2 語意邊界：
  // 1. currentPriceZ2 有值（MIS 即時價）→ 使用即時價，反映真實市況。
  // 2. null（MIS 失敗）→ fallback 至 latestClose（前一交易日收盤價）。
  //    此 fallback 可能導致劇烈波動日延遲停損判斷，應盡量確保 MIS 正常。
  const finalPriceZ2 = currentPriceZ2 || latestClose;

  const ma240 =
    closes.length >= 240
      ? closes.slice(-240).reduce((a, b) => a + b, 0) / 240
      : null;

  logger.info("✅ 指標計算完成");

  // ── Step 3：策略引擎 ────────────────────────────────────────────────────────
  const signalData = {
    RSI: latestRSI,
    KD_K: latestKD ? latestKD.k : null,
    KD_D: latestKD ? latestKD.d : null,
    currentPrice: finalPriceZ2,
    basePrice,
    price0050: price0050 || 0,
    VIX: vixData?.value ?? null,
    VIXTime: vixData?.dateTimeText ?? vixData?.time ?? null,
    VIXStatus: vixData?.status ?? null,
    ma240,
    portfolio: lastState,
    rsiArr,
    macdArr,
    kdArr,
    closeArr: indicatorsZ2.closes || [],
    ma20Arr: indicatorsZ2.ma20Arr || [],
    atrArr: indicatorsZ2.atrArr || [],
    indicators0050: {
      rsi: indicators0050.rsiArr[indicators0050.rsiArr.length - 1],
      rsiArr: indicators0050.rsiArr,
      ma60Slope: indicators0050.ma60Slope,
      kd: indicators0050.kdArr[indicators0050.kdArr.length - 1],
    },
    macroMarketDirection,
    valuationGuardState,
    pbRecords,
    pbRecordsObjects,
    rawValuation: macroData?.rawValuation ?? null,
    usRisk,
  };

  logger.info("🧠 正在計算投資訊號...");
  let result;
  {
    const done = stepTimer("getInvestmentSignal");
    result = await getInvestmentSignalAsync(signalData);

    // ── latch 狀態變更後回寫 valuationGuardState.json ──────────────────────
    const decision = result?.signals ?? result;
    const newLatchActive = decision?.latchNowActive ?? false;
    const latchChanged =
      newLatchActive !== valuationGuardState.latchActive ||
      decision?.shouldLatch === true ||
      decision?.shouldUnlatch === true;

    if (latchChanged) {
      const newState = {
        defenseLatch: newLatchActive,
        latchTriggeredAt: decision?.shouldLatch
          ? new Date().toISOString().slice(0, 10)
          : newLatchActive
            ? valuationGuardState.latchTriggeredAt
            : null,
        latchTriggeredPR: decision?.shouldLatch
          ? (decision?.valuationGuardResult?.currentPR ?? null)
          : newLatchActive
            ? valuationGuardState.latchTriggeredPR
            : null,
      };
      try {
        await archiveManager.saveValuationGuardState(newState);
        logger.info(
          `🛡️ [dailyCheck] valuationGuardState 已更新：defenseLatch=${newState.defenseLatch}` +
            (newState.latchTriggeredAt
              ? `，觸發日 ${newState.latchTriggeredAt}`
              : ""),
        );
      } catch (err) {
        logger.error(err, "❌ [dailyCheck] valuationGuardState.json 寫入失敗");
        if (isTelegramEnabled) {
          await sendTelegramBatch([
            {
              text: `⚠️ <b>嚴重錯誤</b>\nvaluationGuardState.json 寫入失敗，後續狀態可能不一致：\n${err.message}`,
            },
          ]);
        }
      }
    }
    done();
  }

  const dateText = TwDate().formatDateKey();

  // ── Step 4：AI 決策報告 ─────────────────────────────────────────────────────
  logger.info("🤖 正在產生 AI 決策分析...");
  let aiAdvice, adviceTraceId;
  {
    const done = stepTimer("getAiAdvice");
    const adviceResult = await getAiInvestmentAdvice(
      result,
      lastState,
      vixData,
      newsSummaryText,
      macroTextForCoach,
      macroAndChipStr,
      previousAdviceSummary,
      !isAIAdvisor,
    );
    aiAdvice = adviceResult.advice;
    adviceTraceId = adviceResult.traceId;
    done();
  }

  // ── Step 5：推送至 Telegram ─────────────────────────────────────────────────
  const reportDailyData = {
    result,
    vixData,
    usRisk,
    macroData,
    macroAnalysis,
    config: lastState,
    dateText,
    aiAdvice,
    quote,
  };

  await broadcastDailyReport(reportDailyData, newsMessages, isTelegramEnabled);

  // ── Step 6：寫入試算表 ──────────────────────────────────────────────────────
  logger.info("📝 正在寫入試算表...");
  try {
    const done = stepTimer("logToSheet");
    await logDailyToSheet({
      ...result,
      price0050,
      currentPrice: finalPriceZ2,
      portfolio: lastState,
    });
    done();
  } catch (sheetErr) {
    logger.error(sheetErr, "❌ 寫入試算表失敗（不影響發送通知）");
  }

  // ── Step 7：儲存最終報告 ────────────────────────────────────────────────────
  try {
    logger.info("🧹 正在清理過期快取並儲存最終報告...");
    const done = stepTimer("saveReport");

    const snapshotPayload =
      isSnapshotEncryptEnabled() && lastState
        ? {
            ...lastState,
            price0050: price0050 ?? null,
            priceZ2: finalPriceZ2 ?? null,
          }
        : null;

    const state = new IlnState({
      macro: result.marketState ?? {},
      portfolioRaw: snapshotPayload,
      signals: result.signals ?? {},
      strategySnapshot: result.strategySnapshot ?? {},
      ai: aiAdvice ?? {},
      reportDate: dateText,
      meta: macroData?._meta ?? null,
    });

    const baseReport = state.toReportObject();

    await archiveManager.saveReport({
      ...baseReport,
      quote,
      vixData,
      usRisk,
      macroData: {
        rawCnn: macroData?.rawCnn ?? null,
        rawMargin: macroData?.rawMargin ?? null,
        rawFx: macroData?.rawFx ?? null,
        rawNdc: macroData?.rawNdc ?? null,
        rawValuation: macroData?.rawValuation ?? null,
        rawMarketOverview: macroData?.rawMarketOverview ?? null,
      },
      macroAnalysis,
      news: {
        tw: newsStructured.tw,
        us: newsStructured.us,
        generatedAt: dateText,
      },
    });

    done();
  } catch (err) {
    logger.warn(err, "⚠️ 儲存最終報告或清理快取失敗");
  }

  // ── Step 8：LLM Judge（背景評估，不阻塞主流程）─────────────────────────────
  const vixValue = vixData?.value ?? 0;
  const isHighRiskDay =
    vixValue >= 30 ||
    (result?.signals?.action && result.signals.action !== "HOLD") ||
    valuationGuardState.latchActive !==
      (result?.signals?.latchNowActive ?? false);

  if (isHighRiskDay) {
    logger.info(
      `⚠️ [LLMJudge] 高風險日偵測：VIX=${vixValue.toFixed(2)}, action=${result?.signals?.action ?? "unknown"}, latchChanged=${valuationGuardState.latchActive !== (result?.signals?.latchNowActive ?? false)}`,
    );
  }

  const judgeContext = { forceRun: isHighRiskDay };
  const judgeTasks = [];

  if (
    shouldRunJudge(judgeContext) &&
    adviceTraceId &&
    typeof aiAdvice === "object"
  ) {
    logger.info("🔍 [LLMJudge] 今日觸發 Judge，排入背景任務...");
    judgeTasks.push(
      runJudge(adviceTraceId, aiAdvice, sessionId).catch((err) =>
        logger.warn(err, "⚠️ [LLMJudge] 背景任務發生例外"),
      ),
    );
  } else if (shouldRunJudge(judgeContext)) {
    logger.warn(
      "⚠️ [LLMJudge] 今日應觸發但 adviceTraceId 無效或 aiAdvice 非物件，跳過",
    );
  } else {
    logger.info("⏭️ [LLMJudge] 今日不執行 Judge");
  }

  if (judgeTasks.length > 0) {
    logger.info("⏳ [LLMJudge] 等待背景 Judge 任務完成...");
    await Promise.allSettled(judgeTasks);
    logger.info("✅ [LLMJudge] 背景 Judge 任務完成");
  }

  return "✅ dailyCheck 執行成功";
}
