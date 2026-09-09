// src/scheduler/dailyCheck.mjs
// 每日檢查核心邏輯
// 從 dailyCheck.mjs 重構而來，移除 CLI 相關邏輯

import { fileURLToPath } from "url";
import { assertEnv } from "../utils/envGuard.mjs";
assertEnv();

import { buildSignalContext } from "../domain/signalContext.mjs";
import { buildReportReplaySnapshot } from "../domain/replaySnapshot.mjs";
import {
  appendFreshnessObservation,
  applyFreshnessGuard,
  buildTechnicalFreshnessObservation,
  resolveFreshnessConfig,
  buildFreshnessGuardDecision,
} from "../domain/dataFreshness.mjs";
import { getInvestmentSignalAsync } from "../modules/strategy/strategyEngine.mjs";
import { fetchStrategyConfig } from "../modules/strategy/signalRules.mjs";
import { broadcastDailyReport } from "../modules/notifications/notifier.mjs";
import { getAiInvestmentAdvice } from "../modules/ai/aiCoach.mjs";
import { shouldRunJudge, runJudge } from "../modules/ai/llmJudge.mjs";
import { logDailyToSheet } from "../modules/storage.mjs";
import { archiveManager } from "../modules/data/archiveManager.mjs";
import { TwDate, stepTimer } from "../utils/coreUtils.mjs";
import { isSnapshotEncryptEnabled } from "../utils/snapshotCrypto.mjs";
import { sendTelegramBatch } from "../modules/notifications/transports/telegramClient.mjs";
import { shutdownLangfuse } from "../modules/ai/langfuseClient.mjs";
import { IlnState } from "../domain/ilnState.mjs";
import { buildDailyRunContext } from "../domain/dailyRunContext.mjs";
import { shouldWriteSheet } from "./sideEffectPolicy.mjs";
import logger, {
  setGlobalContext,
  clearGlobalContext,
} from "../utils/logger.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-${Date.now()}`;

/**
 * 每日檢查核心邏輯
 * @param {Object} deps - 依賴注入物件
 * @param {Object} deps.dataProvider - 符合 IDataProvider 介面
 * @param {Object} deps.aiProvider - 符合 IAIProvider 介面
 * @param {Object} deps.notifier - 符合 INotifier 介面
 * @param {Object} options - 選項
 * @param {boolean} options.isTelegramEnabled - 是否啟用 Telegram
 * @param {boolean} options.isAIAdvisor - 是否啟用 AI 建議
 * @param {boolean} options.isCallAI - 是否呼叫 AI
 * @returns {Promise<string>} 執行結果訊息
 */
export async function runDailyCheck(deps = {}, options = {}) {
  const { dataProvider, _aiProvider, _notifier } = deps;
  const {
    isTelegramEnabled = true,
    isAIAdvisor = true,
    isCallAI = true,
    isSheetEnabled = true,
  } = options;

  // 設定日誌上下文追蹤
  const traceId = `dailyCheck-${Date.now()}`;
  setGlobalContext({ traceId, sessionId, runType: "dailyCheck" });
  logger.info("🚀 開始執行 dailyCheck...", {
    isTelegramEnabled,
    isAIAdvisor,
    isCallAI,
  });

  // ── Step 1：統一資料撈取 ────────────────────────────────────────────────────
  let ctx;
  try {
    ctx = await buildDailyRunContext({ isCallAI, dataProvider });
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
    clearGlobalContext();
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
    sourceMetadata,
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
    clearGlobalContext();
    return "✅ dailyCheck 執行成功（非交易日）";
  }

  // ── Step 2+3：指標計算 & 策略引擎 ──────────────────────────────────────────
  logger.info("🧠 正在計算技術指標並組裝 signalData...");
  const { signalData, finalPriceZ2 } = buildSignalContext(ctx);
  // 將補全後的價格回灌 ctx，確保後續策略引擎與 AI 教練使用一致的價格基準
  ctx.currentPrice = finalPriceZ2;
  logger.info("✅ 指標計算完成");

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

  let freshnessDecision = null;
  try {
    const strategy = await fetchStrategyConfig();
    const freshnessConfig = resolveFreshnessConfig(strategy.dataFreshness);
    const technicalFreshness = buildTechnicalFreshnessObservation({
      historyZ2,
      history0050,
      reportDate: dateText,
      staleAfterTradingDays: freshnessConfig.staleAfterTradingDays,
    });
    freshnessDecision = buildFreshnessGuardDecision({
      mode: freshnessConfig.mode,
      freshness: technicalFreshness,
      affectedSignals: ["buy_tactical", "sell_tactical", "exit_buffer"],
    });
    result = applyFreshnessGuard(result, freshnessDecision);

    const stats = await archiveManager.getFreshnessShadowStats();
    const nextStats = appendFreshnessObservation(stats, {
      reportDate: dateText,
      wouldBlock: freshnessDecision.wouldBlock,
      blockedSignals: freshnessDecision.blockedSignals,
    });
    await archiveManager.saveFreshnessShadowStats(nextStats);
  } catch (freshnessErr) {
    logger.warn(freshnessErr, "⚠️ Freshness guard 計算失敗，使用原始 decision");
  }

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
  if (shouldWriteSheet({ isSheetEnabled })) {
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
  } else {
    logger.info("⏭️ 累積模式已停用 Google Sheets 寫入");
  }

  // ── Step 7：儲存最終報告 ────────────────────────────────────────────────────
  try {
    logger.info("🧹 正在清理過期快取並儲存最終報告...");
    const done = stepTimer("saveReport");

    const snapshotPayload =
      isSnapshotEncryptEnabled() && lastState
        ? {
            // price0050 / priceZ2 注入快照，供 normaliseSnapshot 計算當日市值
            ...lastState,
            price0050: price0050 ?? null,
            priceZ2: finalPriceZ2 ?? null,
          }
        : null;

    const replay = buildReportReplaySnapshot({
      result: { ...result, sourceMetadata },
      strategySnapshot: result.strategySnapshot ?? {},
    });

    const replayWithObservation = freshnessDecision
      ? { ...replay, shadowGuardDecision: freshnessDecision }
      : replay;

    const state = new IlnState({
      marketState: result.marketState ?? {},
      rawMarket: null,
      macroData: macroData ?? null,
      portfolioRaw: snapshotPayload,
      signals: result.signals ?? {},
      strategySnapshot: result.strategySnapshot ?? {},
      ai: aiAdvice ?? {},
      reportDate: dateText,
      meta: macroData?._meta ?? null,
      replay: replayWithObservation,
    });

    const baseReport = state.toReportObject();

    await archiveManager.saveReport({
      ...baseReport,
      // Simulator 所需扁平化欄位 (直接在報告層級儲存，避免每次查詢重組)
      price0050,
      currentPrice: currentPriceZ2,
      portfolio: lastState,
      VIX: vixData?.value ?? null,
      quote,
      vixData,
      usRisk,
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
  const signalDirection = result?.signals?.signalDirection ?? "hold";
  const isHighRiskDay =
    vixValue >= 30 ||
    signalDirection !== "hold" || // ← long/short 都算高風險日
    valuationGuardState.latchActive !==
      (result?.signals?.latchNowActive ?? false);

  if (isHighRiskDay) {
    logger.info(
      `⚠️ [LLMJudge] 高風險日偵測：VIX=${vixValue.toFixed(2)}, action=${result?.signals?.action ?? "unknown"}, latchChanged=${valuationGuardState.latchActive !== (result?.signals?.latchNowActive ?? false)}`,
    );
  }

  const judgeContext = { forceRun: isHighRiskDay };
  const judgeTasks = [];

  const shouldRun = shouldRunJudge(judgeContext);
  const canRun = adviceTraceId && typeof aiAdvice === "object";

  if (shouldRun && canRun) {
    logger.info("🔍 [LLMJudge] 今日觸發 Judge，排入背景任務...");
    judgeTasks.push(
      runJudge(adviceTraceId, aiAdvice, sessionId).catch((err) =>
        logger.warn(err, "⚠️ [LLMJudge] 背景任務發生例外"),
      ),
    );
  } else if (shouldRun) {
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

  // 清除日誌上下文
  clearGlobalContext();

  return "✅ dailyCheck 執行成功";
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runDailyCheck(
      {},
      { isTelegramEnabled: true, isAIAdvisor: true, isCallAI: true },
    );
  } catch (err) {
    logger.error(err, "❌ dailyCheck 執行失敗");
    process.exit(1);
  } finally {
    logger.info("🚀 dailyCheck 執行結束");
    logger.info("🔒 正在關閉 Langfuse...");
    try {
      await shutdownLangfuse();
      logger.info("✅ Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
