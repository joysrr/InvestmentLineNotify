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

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `local-${Date.now()}`;

export async function dailyCheck({
  isTelegramEnabled = true,
  isAIAdvisor = true,
}) {
  console.log("🚀 開始執行 dailyCheck...");

  // 1. 從試算表繼承昨天的持股狀態
  console.log("📊 正在讀取試算表持股...");
  let lastState = null;
  try {
    const done = stepTimer("fetchPortfolioState");
    lastState = await fetchLastPortfolioState();
    done();
  } catch (e) {
    console.error("⚠️ 讀取試算表失敗，將使用預設設定 0:", e.message);
    const cachedLastBuyDate = await archiveManager.getLastBuyDate();
    if (cachedLastBuyDate) {
      console.warn(
        `⚠️ [dailyCheck] Sheet 失敗，lastBuyDate 使用本地備份: ${cachedLastBuyDate}`,
      );
    } else {
      console.warn(
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
  console.log(stockStatus);

  // 檢查是否開市
  console.log("📅 檢查是否開市...");
  const openToday = await isMarketOpenTodayTWSE();
  if (!openToday) {
    console.log("😴 當日無開市，跳過通知");
  }

  // 台指恐慑指數 (VIX)
  console.log("📈 抓取台指恐慑指數 (VIX)...");
  let vixData;
  {
    const done = stepTimer("fetchVix");
    vixData = await getTwVix();
    done();
  }
  if (vixData) {
    console.log(`✅ VIX 値：${vixData.value.toFixed(2)}`);
  } else {
    console.log("❌ VIX 抓取失敗，不影響主流程");
  }

  // 抓取基準價
  console.log("📥 正在抓取基準價...");
  let basePrice;
  {
    const done = stepTimer("fetchBasePrice");
    const result = await fetchLatestBasePrice();
    basePrice = result.basePrice;
    done();
  }
  console.log(`💰 取得基準價：${basePrice}`);

  // 取得總經與籌碼資料
  console.log("🌏 正在獲取總經與籌碼資料 (含每日一句與美股風險)...");
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
    console.log(
      `✅ 大盤量價：指數 ${ov.taiex ?? "--"} 點，成交 ${ov.tradeValueHundredMillion ?? "--"} 億元 [${ov.date ?? "--"}]`,
    );
  } else {
    console.log("⚠️ 大盤量價概覽資料缺失，AI Coach 將略過此指標");
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
  console.log(`✅ 美股風險：${usRisk.riskLevel}`);
  console.log(`📖 今日一句：${quote.quote}`);

  // 取得股票資訊
  const symbolZ2 = "00675L.TW";
  const symbol0050 = "0050.TW";

  const today = new Date();
  const lastYear = new Date(today);
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  console.log("📥 正在抓取00675L歷史數據...");
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
    console.log("❌ 資料不足，無法計算指標");
    return "❌ 資料不足";
  }

  // 抓取 0050 最新價格
  console.log("📥 正在抓取 0050 價格...");
  let price0050 = null;
  {
    const done = stepTimer("fetchPrice0050");
    try {
      const rt0050 = await fetchRealtimeFromMis(symbol0050);
      price0050 = rt0050?.price;
    } catch (e) {
      console.log("⚠️ 0050 MIS 失敗，轉用收盤價");
    }
    if (!price0050) {
      const latest0050 = await fetchLatestClose(symbol0050);
      price0050 = latest0050?.close;
    }
    done();
  }

  // 抓取 00675L 即時價
  console.log("📥 正在抓取 00675L 即時價...");
  let currentPriceZ2 = null;
  {
    const done = stepTimer("fetchPriceZ2");
    try {
      const rt = await fetchRealtimeFromMis(symbolZ2);
      currentPriceZ2 = rt?.price;
    } catch (e) {
      console.log(`⚠️ 00675L MIS 失敗，改用收盤價：${currentPriceZ2}`);
    }
    if (!currentPriceZ2) {
      const latest = await fetchLatestClose(symbolZ2);
      currentPriceZ2 = latest?.close;
    }
    done();
  }

  // 計算指標
  console.log(`🧠 正在計算指標...`);
  let closes, rsiArr, macdArr, kdArr;
  {
    const done = stepTimer("calculateIndicators");
    ({ closes, rsiArr, macdArr, kdArr } = calculateIndicators(history));
    done();
  }
  const latestClose = closes[closes.length - 1];
  const finalPriceZ2 = currentPriceZ2 || latestClose;
  const ma240 =
    closes.length >= 240
      ? closes.slice(-240).reduce((a, b) => a + b, 0) / 240
      : null;
  const latestRSI = rsiArr[rsiArr.length - 1];
  const latestKD = kdArr[kdArr.length - 1];
  console.log(`✅ 指標計算完成`);

  // ── 取得新跡集錦與總經分析（提前至策略引擎之前）────────────────────
  let newsMessages = [];
  let newsSummaryText = "今日無重大市場新跡。";
  let conflictSummary = "";
  let newsStructured = { tw: [], us: [] };
  console.log("📝 正在從 news pool 取得新跡集錦...");
  {
    const done = stepTimer("fetchNews");
    try {
      const newsResult = await getNewsTelegramMessages();
      newsMessages = newsResult.messages;
      newsSummaryText = newsResult.summaryText;
      conflictSummary = newsResult.conflictSummary ?? "";
      newsStructured = newsResult.structured ?? { tw: [], us: [] };
    } catch (err) {
      console.error("❌ 取得新跡集錦失敗 (但不影響發送通知):", err.message);
      newsMessages = [];
      newsSummaryText = "新跡集錦取得失敗，請檢查系統日誌。";
      conflictSummary = "";
      newsStructured = { tw: [], us: [] };
    }
    done();
  }

  console.log("🤖 正在產生總經多空對決報告...");
  let macroAnalysis = null;
  let macroTextForCoach = "無新跡數據，無法進行總經分析。";
  if (newsMessages?.length) {
    const done = stepTimer("analyzeMacro");
    macroAnalysis = await analyzeMacroNewsWithAI(
      newsSummaryText,
      conflictSummary,
    );
    macroTextForCoach = formatMacroAnalysisForCoach(macroAnalysis);
    done();
  } else {
    console.log("⚠️ 無新跡數據，跳過總經分析");
    macroAnalysis = {
      bullish: 0,
      bearish: 0,
      neutral: 0,
      summary: "無新跡數據，無法進行總經分析。",
    };
    macroTextForCoach = macroAnalysis.summary;
  }

  const macroMarketDirection =
    macroAnalysis?.conclusion?.market_direction ?? null;
  if (macroMarketDirection) {
    console.log(`✅ 總經方向：${macroMarketDirection}`);
  } else {
    console.log("⚠️ 無總經方向，策略引擎將不套用情緒調整");
  }
  // ───────────────────────────────────────────────────────────────────────────

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
    US_VIX: usRisk.vix,
    US_SPX_Change: usRisk.spxChg,
    US_RiskLevel: usRisk.riskLevel,
    US_RiskIcon: usRisk.riskIcon,
    US_Suggestion: usRisk.suggestion,
    macroMarketDirection,
  };

  console.log("🧠 正在計算投資訊號...");
  let result;
  {
    const done = stepTimer("getInvestmentSignal");
    result = await getInvestmentSignalAsync(signalData);
    done();
  }

  const dateText = TwDate().formatDateKey();

  // ── 載入前次 AI 建議摘要（供 Prompt 注入，提升連貫性）─────────────────────
  console.log("📂 正在載入前次 AI 建議摘要...");
  let previousAdviceSummary = "";
  {
    const done = stepTimer("fetchPrevAdvice");
    try {
      previousAdviceSummary = await archiveManager.getPreviousAdviceSummary();
      if (previousAdviceSummary) {
        console.log(
          `✅ 前次建議摘要已載入（${previousAdviceSummary.length} 字）`,
        );
      } else {
        console.log("ℹ️ 無前次建議記錄（首次執行或讀取失敗），AI 將全量分析");
      }
    } catch (err) {
      console.warn("⚠️ 載入前次建議失敗，繼續執行:", err.message);
    }
    done();
  }
  // ───────────────────────────────────────────────────────────────────────────

  // 取得 AI 決策報告
  console.log("🤖 正在產生 AI 決策分析...");
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

  broadcastDailyReport(reportDailyData, newsMessages, isTelegramEnabled);

  console.log("📝 正在寫入試算表...");
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
    console.error("❌ 寫入試算表失敗 (但不影響發送通知):", sheetErr.message);
  }

  // 清理系統，儲存最終報告
  try {
    console.log("🧹 正在清理過期快取並儲存最終報告...");
    const done = stepTimer("saveReport");

    // 帳戶快照：有金鑰才加密存入，否則略過
    // 補存 price0050 / priceZ2 市價欄位，供圖表市價法淨値計算使用
    let snapshotField = {};
    if (isSnapshotEncryptEnabled() && lastState) {
      const snapshotPayload = {
        ...lastState,
        price0050: price0050 ?? null,
        priceZ2: finalPriceZ2 ?? null,
      };
      const encrypted = encryptSnapshot(snapshotPayload);
      if (encrypted) {
        snapshotField = { snapshot: encrypted };
        console.log("🔐 [Snapshot] 帳戶快照已加密（含市價），納入報告");
      } else {
        console.warn("⚠️ [Snapshot] 加密失敗，本次報告不含快照");
      }
    } else if (!isSnapshotEncryptEnabled()) {
      console.log("ℹ️ [Snapshot] SNAPSHOT_ENCRYPT_KEY 未設定，略過快照");
    }

    await archiveManager.saveReport({
      date: dateText,
      signals: result,
      ai: aiAdvice,
      // ── 補存欄位：Mini App 歷史查閱需要 ────────────────────────────────
      quote,
      vixData,
      usRisk,
      macroData: {
        rawCnn: macroData?.rawCnn ?? null,
        rawMargin: macroData?.rawMargin ?? null,
        rawFx: macroData?.rawFx ?? null,
        rawNdc: macroData?.rawNdc ?? null,
        rawValuation: macroData?.rawValuation ?? null,
        // ── 新增：大盤量價概覽 (FMTQIK) ────────────────────────────────
        rawMarketOverview: macroData?.rawMarketOverview ?? null,
      },
      macroAnalysis,
      // ── 補存 AI 精選新跡給 Mini App 使用 ───────────────────────────────
      news: {
        tw: newsStructured.tw,
        us: newsStructured.us,
        generatedAt: dateText,
      },
      // ── 帳戶快照（有金鑰時才存在此欄位）──────────────────────────────
      ...snapshotField,
    });
    await archiveManager.cleanOldArchives(30);
    done();
  } catch (err) {
    console.warn("⚠️ 儲存最終報告或清理快取失敗:", err.message);
  }

  // ── LLM Judge（背景評估，不阻塞主流程）─────────────────────────────────────────
  const judgeTasks = [];

  if (shouldRunJudge() && adviceTraceId && typeof aiAdvice === "object") {
    console.log("🔍 [LLMJudge] 今日觸發 Judge，排入背景任務...");
    judgeTasks.push(
      runJudge(adviceTraceId, aiAdvice, sessionId).catch((err) =>
        console.warn("⚠️ [LLMJudge] 背景任務發生例外:", err.message),
      ),
    );
  } else if (shouldRunJudge()) {
    console.log(
      "⚠️ [LLMJudge] 今日應觸發但 adviceTraceId 無效或 aiAdvice 非物件，跳過",
    );
  } else {
    console.log("⏭️ [LLMJudge] 今日不執行 Judge");
  }

  if (judgeTasks.length > 0) {
    console.log("⏳ [LLMJudge] 等待背景 Judge 任務完成...");
    await Promise.allSettled(judgeTasks);
    console.log("✅ [LLMJudge] 背景 Judge 任務完成");
  }

  return "✅ dailyCheck 執行成功";
}
