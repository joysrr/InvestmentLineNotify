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
import { buildNonTradingDayMessage } from "../modules/notifications/templates/telegramHtmlBuilder.mjs";
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
import { shouldPersistDailyReport } from "../domain/reportWritePolicy.mjs";
import { evaluateLeadingIndicators } from "../modules/strategy/leadingIndicatorEvaluator.mjs";
import { mapLeadingIndicatorInputs } from "../modules/strategy/leadingIndicatorInputMapper.mjs";
import { SYSTEM_STATES } from "../modules/strategy/marginStateMachine.mjs";
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
  const runStartMs = Date.now();
  const traceId = `dailyCheck-${runStartMs}`;
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
    logger.error(err, "❌ [dailyCheck] buildDailyRunContext 失敗，中止執行");
    if (isTelegramEnabled) {
      const details = err.details ?? {};
      const failedMonths = details.failedMonths?.join(", ") || "未知";
      const text =
        err.code === "HISTORY_SOURCE_UNAVAILABLE"
          ? `⚠️ <b>嚴重錯誤</b>\n00675L 歷史資料來源暫時不可用，今日 dailyCheck 強制終止。\n失敗月份：${failedMonths}\n原因：${details.lastError ?? err.message}`
          : `⚠️ <b>嚴重錯誤</b>\n00675L 歷史資料不足 ${details.required ?? 60} 筆（實際 ${details.count ?? 0} 筆），今日 dailyCheck 強制終止。`;
      await sendTelegramBatch([{ text }]);
    }
    clearGlobalContext();
    return "❌ 資料不足";
  }

  const {
    lastState,
    openToday,
    vixData,
    _basePrice,
    price0050,
    currentPriceZ2,
    historyZ2,
    history0050,
    macroData,
    socialSentiment,
    taifexNight,
    taifexRetailSentiment,
    sourceMetadata,
    macroAndChipStr,
    usRisk,
    quote,
    newsMessages,
    newsSummaryText,
    newsAnalysisStatus,
    newsStructured,
    macroAnalysis,
    macroTextForCoach,
    _macroMarketDirection,
    previousAdviceSummary,
    valuationGuardState,
    _pbRecords,
    _pbRecordsObjects,
  } = ctx;

  if (!openToday) {
    logger.info("😴 當日無開市，進入休市日市場與輿情情報管線...");
    const dateText = TwDate().formatDateKey();

    // 建立休市日情報報告物件
    const nonTradingReport = {
      reportDate: dateText,
      timestamp: new Date().toISOString(),
      openToday: false,
      marketStatus: "休市觀測",
      totalValue: lastState?.totalValue ?? 0,
      cash: lastState?.cash ?? 0,
      price0050: price0050 ?? null,
      currentPrice: currentPriceZ2 ?? null,
      portfolio: lastState ?? {},
      VIX: vixData?.value ?? null,
      vixData: vixData ?? null,
      quote: quote ?? null,
      usRisk: usRisk || {},
      macro: macroData || {},
      socialSentiment: ctx.socialSentiment || null,
      newsSummary: newsSummaryText || "",
      newsStructured: newsStructured || { tw: [], us: [] },
      news: {
        tw: newsStructured?.tw || [],
        us: newsStructured?.us || [],
        generatedAt: dateText,
      },
      macroAnalysis: macroAnalysis || {},
      newsPoolCount: newsMessages?.length || 0,
      newsAnalysisStatus: newsAnalysisStatus || "skipped",
      note: "非交易日市場情報觀測報告",
    };

    let reportPersisted = false;
    if (shouldPersistDailyReport({ newsAnalysisStatus })) {
      try {
        await archiveManager.saveReport(nonTradingReport);
        reportPersisted = true;
        logger.info(`📁 [休市情報] 每日報告已成功存檔 (${dateText})`);
      } catch (saveErr) {
        logger.error(saveErr, "❌ [休市情報] 儲存休市報告失敗");
      }
    } else {
      logger.warn(
        { newsAnalysisStatus },
        "⚠️ 新聞分析失敗，略過休市日報告寫入以避免空結果覆寫",
      );
    }

    if (isTelegramEnabled) {
      const miniappUrl =
        process.env.TELEGRAM_MINIAPP_URL ||
        "https://t.me/InvestmentLineNotifyBot/app";
      const messages = buildNonTradingDayMessage(ctx, miniappUrl);
      await sendTelegramBatch(messages);
      logger.info("📢 [休市情報] Telegram 休市情報卡已送出");
    }

    const durationMs = Date.now() - runStartMs;
    logger.info(
      `[dailyCheck runSummary] ${JSON.stringify({
        runId: traceId,
        durationMs,
        openToday: false,
        newsPoolCount: newsMessages?.length || 0,
        newsAnalysisStatus: newsAnalysisStatus || "skipped",
        reportPersisted,
      })}`,
    );

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

  // ── Step 4.5：領先指標四大極端雷達與狀態機評估 ──────────────────────────────
  logger.info("📡 正在評估領先指標四大極端雷達與狀態機...");
  let leadingIndicators = null;
  {
    const done = stepTimer("evaluateLeadingIndicators");
    try {
      const prevReport = await archiveManager
        .getLatestReport()
        .catch(() => null);
      const prevState =
        prevReport?.leadingIndicators?.stateMachine?.state ??
        SYSTEM_STATES.IDLE;
      const prevCooldownDays =
        prevReport?.leadingIndicators?.stateMachine?.cooldownDays ?? 0;
      const prevActiveDays =
        prevReport?.leadingIndicators?.stateMachine?.activeDays ?? 0;
      const prevUsedBatches = prevReport?.leadingIndicators?.usedBatches ?? 0;

      const rawMargin = macroData?.rawMargin ?? {};
      const leadingIndicatorInputs = mapLeadingIndicatorInputs({
        rawMargin,
        rawMarketOverview: macroData?.rawMarketOverview ?? {},
      });
      const marginRatio = leadingIndicatorInputs.maintenanceRatio ?? 160.0;
      const marginBalanceChangePct =
        leadingIndicatorInputs.marginBalanceChangePct ?? 0;

      const taifexSentiment = taifexRetailSentiment ?? {
        rsr: null,
        dataStatus: "SOURCE_UNAVAILABLE",
      };
      leadingIndicators = evaluateLeadingIndicators({
        marketData: {
          rSox: usRisk?.soxChg == null ? 0 : usRisk.soxChg / 100,
          rTsm: usRisk?.tsmChg == null ? 0 : usRisk.tsmChg / 100,
          rNight:
            taifexNight?.dayToNightChangePct ?? taifexNight?.changePct ?? null,
          nightDataStatus: taifexNight?.dataStatus ?? "UNAVAILABLE",
          maintenanceRatio: marginRatio,
          marginBalanceChangePct,
          vix: vixData?.value ?? 18.0,
          taiexReturn:
            leadingIndicatorInputs.taiexReturn ??
            result?.marketState?.twMarket?.changePct ??
            0,
          bias60: signalData?.bias60 ?? null,
          bias60DataStatus: signalData?.bias60DataStatus ?? "UNAVAILABLE",
          rsr: taifexSentiment?.rsr ?? null,
          retailSentimentDataStatus:
            taifexSentiment?.dataStatus ?? "UNAVAILABLE",
        },
        portfolio: lastState ?? {},
        currentState: prevState,
        cooldownDays: prevCooldownDays,
        activeDays: prevActiveDays,
        usedBatches: prevUsedBatches,
      });

      logger.info(
        {
          bias60: signalData?.bias60 ?? null,
          bias60DataStatus: signalData?.bias60DataStatus ?? "UNAVAILABLE",
          rsr: taifexSentiment?.rsr ?? null,
          retailSentimentDataStatus:
            taifexSentiment?.dataStatus ?? "UNAVAILABLE",
          rNight:
            taifexNight?.dayToNightChangePct ?? taifexNight?.changePct ?? null,
          nightDataStatus: taifexNight?.dataStatus ?? "UNAVAILABLE",
        },
        "📡 [LeadingIndicator] evaluator 輸入邊界紀錄",
      );

      // 極端發聲：若有 Telegram 警報卡片且 Telegram 功能啟用，發送獨立警報卡
      if (leadingIndicators?.telegramCard && isTelegramEnabled) {
        try {
          await sendTelegramBatch([{ text: leadingIndicators.telegramCard }]);
          logger.info("🚨 已發送領先指標極端警報卡至 Telegram");
        } catch (cardErr) {
          logger.error({ error: cardErr }, "❌ 發送領先指標極端警報卡失敗");
        }
      }
    } catch (radarErr) {
      logger.warn(radarErr, "⚠️ 領先指標評估失敗，跳過極端雷達檢查");
    }
    done();
  }

  // ── Step 5：推送至 Telegram ─────────────────────────────────────────────────
  const reportDailyData = {
    result,
    vixData,
    usRisk,
    macroData,
    socialSentiment,
    macroAnalysis,
    newsStructured,
    config: lastState,
    dateText,
    aiAdvice,
    quote,
    leadingIndicators,
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
      leadingIndicators,
    });

    const baseReport = state.toReportObject();

    if (shouldPersistDailyReport({ newsAnalysisStatus })) {
      await archiveManager.saveReport({
        ...baseReport,
        leadingIndicators,
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
      logger.info(
        {
          extremePanicBias60:
            leadingIndicators?.radars?.extremePanic?.metrics?.bias60 ?? "N/A",
          extremePanicBias60DataStatus:
            leadingIndicators?.radars?.extremePanic?.metrics
              ?.bias60DataStatus ?? "N/A",
          retailSentimentRsr:
            leadingIndicators?.radars?.retailSentiment?.metrics?.rsr ?? "N/A",
          retailSentimentDataStatus:
            leadingIndicators?.radars?.retailSentiment?.metrics?.dataStatus ??
            "N/A",
        },
        "📁 [LeadingIndicator] report 序列化邊界紀錄",
      );
    } else {
      logger.warn(
        { newsAnalysisStatus },
        "⚠️ 新聞分析失敗，略過每日報告寫入以避免空結果覆寫",
      );
    }

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

  // ── 執行摘要（可觀測性：方便排錯，不影響主流程）────────────────────────────
  const runEndMs = Date.now();
  logger.info(
    {
      runSummary: {
        runId: traceId,
        durationMs: runEndMs - runStartMs,
        openToday,
        newsPoolCount: newsMessages?.length ?? 0,
        newsAnalysisStatus,
        reportPersisted: shouldPersistDailyReport({ newsAnalysisStatus }),
      },
    },
    "📊 dailyCheck 執行摘要",
  );

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
