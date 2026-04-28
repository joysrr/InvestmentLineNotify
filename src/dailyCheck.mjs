import "dotenv/config";
import { assertEnv } from "./utils/envGuard.mjs";
assertEnv();

import {
  getTwVix,
  fetchStockHistory,
  fetchLatestClose,
  fetchRealtimeFromMis,
  isMarketOpenTodayTWSE,
} from "./modules/providers/twseProvider.mjs";
import { fetchLatestBasePrice } from "./modules/providers/basePriceProvider.mjs";
import { broadcastDailyReport } from "./modules/notifications/notifier.mjs";
import { getInvestmentSignalAsync } from "./modules/strategy/strategyEngine.mjs";
import { calculateIndicators } from "./modules/strategy/indicators.mjs";
import {
  fetchLastPortfolioState,
  logDailyToSheet,
} from "./modules/storage.mjs";
import {
  getAiInvestmentAdvice,
  analyzeMacroNewsWithAI,
} from "./modules/ai/aiCoach.mjs";
import { shouldRunJudge, runJudge } from "./modules/ai/llmJudge.mjs";
import { getNewsTelegramMessages } from "./modules/newsFetcher.mjs";
import { fetchAllMacroData } from "./modules/providers/marketData.mjs";
import {
  formatMacroChipForCoach,
  formatMacroAnalysisForCoach,
} from "./modules/ai/aiDataPreprocessor.mjs";
import { archiveManager } from "./modules/data/archiveManager.mjs";
import { TwDate, stepTimer } from "./utils/coreUtils.mjs";
import {
  encryptSnapshot,
  isSnapshotEncryptEnabled,
} from "./utils/snapshotCrypto.mjs";
import logger from "./utils/logger.mjs";
import { sendTelegramBatch } from "./modules/notifications/transports/telegramClient.mjs";
import { IlnState } from "./domain/ilnState.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-${Date.now()}`;

export async function dailyCheck({
  isTelegramEnabled = true,
  isAIAdvisor = true,
  isCallAI = true,
}) {
  logger.info("🚀 開始執行 dailyCheck...");

  // 1. 從試算表繼承昨天的持股狀態
  logger.info("📊 正在讀取試算表持股...");
  let lastState = null;
  try {
    const done = stepTimer("fetchPortfolioState");
    lastState = await fetchLastPortfolioState();
    done();
  } catch (e) {
    logger.error(e, "⚠️ 讀取試算表失敗，將使用預設設定 0");
    const cachedLastBuyDate = await archiveManager.getLastBuyDate();
    if (cachedLastBuyDate) {
      logger.warn(
        `⚠️ [dailyCheck] Sheet 失敗，lastBuyDate 使用本地備份: ${cachedLastBuyDate}`,
      );
    } else {
      logger.warn(
        "⚠️ [dailyCheck] Sheet 失敗且無本地備份，lastBuyDate 將以 null 處理",
      );
    }
    lastState = {
      date: null,
      qty0050: 0,
      qtyZ2: 0,
      totalLoan: 0,
      cash: 0,
      avgCost0050: null,
      avgCostZ2: null,
      lastBuyDate: cachedLastBuyDate ?? null, // 1→2→4 fallback
    };
  }
  const stockStatus = `✅ 持股狀態確認：0050=${lastState.qty0050}股, 00675L=${lastState.qtyZ2}股, 借款=${lastState.totalLoan}`;
  logger.info(stockStatus);

  // 檢查是否開市
  logger.info("📅 檢查是否開市...");
  const openToday = await isMarketOpenTodayTWSE();
  if (!openToday) {
    logger.info("😴 當日無開市，跳過通知");
  }

  // 台指恐懾指數 (VIX)
  logger.info("📈 抓取台指恐懾指數 (VIX)...");
  let vixData;
  {
    const done = stepTimer("fetchVix");
    vixData = await getTwVix();
    done();
  }
  if (vixData) {
    logger.info(`✅ VIX 値：${vixData.value.toFixed(2)}`);
  } else {
    logger.info("❌ VIX 抓取失敗，不影響主流程");
  }

  // 抓取基準價
  logger.info("📥 正在抓取基準價...");
  let basePrice;
  {
    const done = stepTimer("fetchBasePrice");
    const result = await fetchLatestBasePrice();
    basePrice = result.basePrice;
    done();
  }
  logger.info(`💰 取得基準價：${basePrice}`);

  // 取得總經與籌碼資料
  logger.info("🌏 正在獲取總經與籌碼資料 (含每日一句與美股風險)...");
  let macroData;
  {
    const done = stepTimer("fetchMacroData");
    macroData = await fetchAllMacroData();
    done();
  }
  const macroAndChipStr = formatMacroChipForCoach(macroData);

  // ── 大盤量價概覽 log ────────────────────────────────────────────────────────
  if (macroData.rawMarketOverview) {
    const ov = macroData.rawMarketOverview;
    logger.info(
      `✅ 大盤量價：指數 ${ov.taiex ?? "--"} 點，成交 ${ov.tradeValueHundredMillion ?? "--"} 億元 [${ov.date ?? "--"}]`,
    );
  } else {
    logger.warn("⚠️ 大盤量價概覽資料缺失，AI Coach 將略過此指標");
  }
  // ────────────────────────────────────────────────────────────────────────────

  const usRisk = macroData.rawUsMarket || {
    riskLevel: "正常",
    vix: "N/A",
    spx: "N/A",
    suggestion: "無美股數據",
  };
  const quote = macroData.quote || {
    quote: "投資需謹慎",
    author: "系統預設",
  };
  logger.info(`✅ 美股風險：${usRisk.riskLevel}`);
  logger.info(`📖 今日一句：${quote.quote}`);

  // 取得股票資訊
  const symbolZ2 = "00675L.TW";
  const symbol0050 = "0050.TW";

  const today = new Date();
  const lastYear = new Date(today);
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  logger.info("📥 正在抓取00675L歷史數據...");
  let history;
  {
    const done = stepTimer("fetchStockHistory");
    history = await fetchStockHistory(
      symbolZ2,
      lastYear.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10),
    );
    done();
  }

  if (history.length < 30) {
    logger.error("❌ 資料不足，無法計算指標");
    if (isTelegramEnabled) {
      await sendTelegramBatch([
        {
          text: "⚠️ <b>嚴重錯誤</b>\n00675L 歷史資料不足 30 筆，今日 dailyCheck 強制終止。",
        },
      ]);
    }
    return "❌ 資料不足";
  }

  // 抓取 0050 歷史數據 (用於長線趨勢與穩定指標參考)
  logger.info("📥 正在抓取 0050 歷史數據...");
  let history0050;
  {
    const done = stepTimer("fetchStockHistory0050");
    history0050 = await fetchStockHistory(
      symbol0050,
      lastYear.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10),
    );
    done();
  }

  // 抓取 0050 最新價格
  logger.info("📥 正在抓取 0050 價格...");
  let price0050 = null;
  {
    const done = stepTimer("fetchPrice0050");
    try {
      const rt0050 = await fetchRealtimeFromMis(symbol0050);
      price0050 = rt0050?.price;
    } catch (e) {
      logger.warn("⚠️ 0050 MIS 失敗，轉用收盤價");
    }
    if (!price0050) {
      const latest0050 = await fetchLatestClose(symbol0050);
      price0050 = latest0050?.close;
    }
    done();
  }

  // 抓取 00675L 即時價
  logger.info("📥 正在抓取 00675L 即時價...");
  let currentPriceZ2 = null;
  {
    const done = stepTimer("fetchPriceZ2");
    try {
      const rt = await fetchRealtimeFromMis(symbolZ2);
      currentPriceZ2 = rt?.price;
    } catch (e) {
      logger.warn(`⚠️ 00675L MIS 失敗，改用收盤價：${currentPriceZ2}`);
    }
    if (!currentPriceZ2) {
      const latest = await fetchLatestClose(symbolZ2);
      currentPriceZ2 = latest?.close;
    }
    done();
  }

  // 計算 00675L 指標 (戰術盤感)
  logger.info(`🧠 正在計算 00675L 指標...`);
  let indicatorsZ2;
  {
    const done = stepTimer("calculateIndicatorsZ2");
    indicatorsZ2 = calculateIndicators(history);
    done();
  }

  // 計算 0050 指標 (底層趨勢參考)
  logger.info(`🧠 正在計算 0050 指標...`);
  let indicators0050;
  {
    const done = stepTimer("calculateIndicators0050");
    indicators0050 = calculateIndicators(history0050);
    done();
  }

  const { closes, rsiArr, macdArr, kdArr } = indicatorsZ2;
  const latestClose = closes[closes.length - 1];

  // [P2-6] finalPriceZ2 的語意邊界說明：
  // 1. 若 currentPriceZ2 有值（來自 MIS 即時價），則使用它，此時反映真實市況。
  // 2. 若為 null（MIS 失敗），fallback 至 latestClose（即前一交易日收盤價）。
  // 此 fallback 可能導致當日 priceDropPercent 等同 0（若與昨日比），在劇烈波動日時可能延遲停損判斷，應盡量確保 MIS 正常。
  const finalPriceZ2 = currentPriceZ2 || latestClose;

  const ma240 =
    closes.length >= 240
      ? closes.slice(-240).reduce((a, b) => a + b, 0) / 240
      : null;
  const latestRSI = rsiArr[rsiArr.length - 1];
  const latestKD = kdArr[kdArr.length - 1];
  logger.info(`✅ 指標計算完成`);

  // ── 取得新跡集錦與總經分析（提前至策略引擎之前）────────────────────
  let newsMessages = [];
  let newsSummaryText = "今日無重大市場新跡。";
  let conflictSummary = "";
  let newsStructured = { tw: [], us: [] };
  let macroAnalysis = null;
  let macroTextForCoach = "無新跡數據，無法進行總經分析。";
  let macroMarketDirection = null;
  if (isCallAI) {
    logger.info("📝 正在從 news pool 取得新跡集錦...");
    const done = stepTimer("fetchNews");
    try {
      const newsResult = await getNewsTelegramMessages();
      newsMessages = newsResult.messages;
      newsSummaryText = newsResult.summaryText;
      conflictSummary = newsResult.conflictSummary ?? "";
      newsStructured = newsResult.structured ?? { tw: [], us: [] };
    } catch (err) {
      logger.error(err, "❌ 取得新跡集錦失敗 (但不影響發送通知)");
      newsMessages = [];
      newsSummaryText = "新跡集錦取得失敗，請檢查系統日誌。";
      conflictSummary = "";
      newsStructured = { tw: [], us: [] };
    }
    done();

    logger.info("🤖 正在產生總經多空對決報告...");
    if (newsMessages?.length) {
      const done = stepTimer("analyzeMacro");
      try {
        macroAnalysis = await analyzeMacroNewsWithAI(
          newsSummaryText,
          conflictSummary,
        );
        macroTextForCoach = formatMacroAnalysisForCoach(macroAnalysis);
      } catch (err) {
        logger.error(err, "❌ 總經分析 AI 產生失敗，降級處理");
        macroAnalysis = {
          bullish: 0,
          bearish: 0,
          neutral: 0,
          summary: "總經分析 AI 產生失敗，使用預設空結構。",
        };
        macroTextForCoach = macroAnalysis.summary;
      }
      done();
    } else {
      logger.warn("⚠️ 無新跡數據，跳過總經分析");
      macroAnalysis = {
        bullish: 0,
        bearish: 0,
        neutral: 0,
        summary: "無新跡數據，無法進行總經分析。",
      };
      macroTextForCoach = macroAnalysis.summary;
    }

    macroMarketDirection = macroAnalysis?.conclusion?.market_direction ?? null;
    if (macroMarketDirection) {
      logger.info(`✅ 總經方向：${macroMarketDirection}`);
    } else {
      logger.warn("⚠️ 無總經方向，策略引擎將不套用情緒調整");
    }
  } else {
    logger.info("⏭️ 今日設定不呼叫AI，將略過新跡集錦與總經分析");
  }
  // ───────────────────────────────────────────────────────────────────────────

  // ── 步驟 3-7：讀取 valuationGuardState.json ──
  let valuationGuardState = {
    latchActive: false,
    latchTriggeredAt: null,
    latchTriggeredPR: null,
  };
  try {
    const savedState = await archiveManager.getValuationGuardState();
    if (savedState && typeof savedState.defenseLatch === "boolean") {
      valuationGuardState = {
        latchActive: savedState.defenseLatch,
        latchTriggeredAt: savedState.latchTriggeredAt ?? null,
        latchTriggeredPR: savedState.latchTriggeredPR ?? null,
      };
      logger.info(
        `✅ [dailyCheck] valuationGuardState 載入：latchActive=${valuationGuardState.latchActive}` +
          (valuationGuardState.latchTriggeredAt
            ? `，觸發日 ${valuationGuardState.latchTriggeredAt}`
            : ""),
      );
    }
  } catch (err) {
    logger.warn(
      err,
      `⚠️ [dailyCheck] valuationGuardState.json 讀取失敗，使用預設值`,
    );
  }

  let pbRecordsObjects = [];
  try {
    // getPbHistory 現在統一回傳 [{date, pb}, ...]
    pbRecordsObjects = await archiveManager.getPbHistory();
  } catch (err) {
    logger.warn(err, `⚠️ [dailyCheck] pbHistory 讀取失敗`);
  }
  // pbRecords: 純 PB 數值陣列（供 resolveValuationGuard 使用）
  // pbRecordsObjects: 含 date 的完整紀錄（供 resolveValuationMomentum 使用）
  const pbRecords = pbRecordsObjects.map((r) => r.pb);

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
    // 注入 0050 參考指標
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
    // ── latch 狀態變更後回寫 valuationGuardState.json ──
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
        logger.error(err, `❌ [dailyCheck] valuationGuardState.json 寫入失敗`);
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

  // ── 載入前次 AI 建議摘要（供 Prompt 注入，提升連貫性）─────────────────────
  logger.info("📂 正在載入前次 AI 建議摘要...");
  let previousAdviceSummary = "";
  {
    const done = stepTimer("fetchPrevAdvice");
    try {
      previousAdviceSummary = await archiveManager.getPreviousAdviceSummary();
      if (previousAdviceSummary) {
        logger.info(
          `✅ 前次建議摘要已載入（${previousAdviceSummary.length} 字）`,
        );
      } else {
        logger.info("ℹ️ 無前次建議記錄（首次執行或讀取失敗），AI 將全量分析");
      }
    } catch (err) {
      logger.warn(err, "⚠️ 載入前次建議失敗，繼續執行");
    }
    done();
  }
  // ───────────────────────────────────────────────────────────────────────────

  // 取得 AI 決策報告
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
      previousAdviceSummary, // ← 注入前次建議，消除重複感
      !isAIAdvisor,
    );
    aiAdvice = adviceResult.advice;
    adviceTraceId = adviceResult.traceId;
    done();
  }

  // 推送至 Telegram
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

  logger.info("📝 正在寫入試算表...");
  try {
    const done = stepTimer("logToSheet");
    const logData = {
      ...result,
      price0050: price0050,
      currentPrice: finalPriceZ2,
      portfolio: lastState,
    };
    await logDailyToSheet(logData);
    done();
  } catch (sheetErr) {
    logger.error(sheetErr, "❌ 寫入試算表失敗 (但不影響發送通知)");
  }

  // 清理系統，儲存最終報告
  try {
    logger.info("🧹 正在清理過期快取並儲存最終報告...");
    const done = stepTimer("saveReport");

    // 1) 帳戶快照：有金鑰才加密存入，否則略過
    //    這裡先組 snapshotPayload，後面同時給 IlnState 與 saveReport 使用
    let snapshotField = {};
    let snapshotPayload = null;

    if (isSnapshotEncryptEnabled() && lastState) {
      snapshotPayload = {
        ...lastState,
        price0050: price0050 ?? null,
        priceZ2: finalPriceZ2 ?? null,
      };
      const encrypted = encryptSnapshot(snapshotPayload);
      if (encrypted) {
        snapshotField = { snapshot: encrypted };
        logger.info("🔐 [Snapshot] 帳戶快照已加密（含市價），納入報告");
      } else {
        logger.warn("⚠️ [Snapshot] 加密失敗，本次報告不含快照");
      }
    } else if (!isSnapshotEncryptEnabled()) {
      logger.info("ℹ️ [Snapshot] SNAPSHOT_ENCRYPT_KEY 未設定，略過快照");
    }

    // 2) 用當日結果建立 IlnState（統一 domain 物件）
    const state = new IlnState({
      // macro / marketState：直接塞入 strategyEngine 填好的 marketState
      macro: result.marketState ?? {},
      // portfolioRaw：用尚未加密前的 snapshotPayload（若有）
      portfolioRaw: snapshotPayload,
      // signals / strategySnapshot：從 strategyEngine 結果來
      signals: result.signals ?? {},
      strategySnapshot: result.strategySnapshot ?? {},
      // ai：沿用目前的 aiAdvice 結構
      ai: aiAdvice ?? {},
      // 報告日期
      reportDate: dateText,
      // meta：可以放 macroData._meta 或留空，視你的 ilnState 設計而定
      meta: macroData?._meta ?? null,
    });

    // 3) 從 IlnState 輸出標準報告主體（含 snapshot，如 ilnState.toReportObject 有處理）
    const baseReport = state.toReportObject();

    // 4) 保留原本報告裡的附加欄位（quote / vixData / usRisk / macroData / macroAnalysis / news）
    await archiveManager.saveReport({
      ...baseReport,

      // === 以下是原來你存進報告、給 Mini App 看的欄位 ===
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

      // 如果 ilnState.toReportObject 已經幫你處理 snapshot，可以視情況移除這一段
      ...snapshotField,
    });

    // 若有需要清理舊檔，可以在這裡或 archiveManager 內處理
    // await archiveManager.cleanOldArchives(30);

    done();
  } catch (err) {
    logger.warn(err, "⚠️ 儲存最終報告或清理快取失敗");
  }

  // ── LLM Judge（背景評估，不阻塞主流程）─────────────────────────────────────────
  const judgeTasks = [];

  // ── 高風險日判斷 ──────────────────────────────────────────────────────────────
  const vixValue = vixData?.value ?? 0;
  const isHighRiskDay =
    vixValue >= 30 ||
    (result?.signals?.action && result.signals.action !== "HOLD") ||
    valuationGuardState.latchActive !==
      (result?.signals?.latchNowActive ?? false);
  // 說明：
  //   1. VIX ≥ 30  → 市場恐慌，AI 建議最需驗證
  //   2. 非 HOLD 日 → 實際有買賣動作，建議品質攸關財務決策
  //   3. latch 狀態轉換日 → 策略發生結構性變化，需確認建議方向正確

  const judgeContext = { forceRun: isHighRiskDay };

  if (isHighRiskDay) {
    logger.info(
      `⚠️ [LLMJudge] 高風險日偵測：VIX=${vixValue.toFixed(2)}, action=${result?.signals?.action ?? "unknown"}, latchChanged=${valuationGuardState.latchActive !== (result?.signals?.latchNowActive ?? false)}`,
    );
  }

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
