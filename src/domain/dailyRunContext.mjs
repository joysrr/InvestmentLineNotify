// src/domain/dailyRunContext.mjs
//
// 職責：
//   dailyCheck 執行前的「資料撈取統一入口」。
//   將原本分散在 dailyCheck.mjs 主體的所有外部資料撈取與本地檔案讀取
//   集中至此，並盡可能並行執行以縮短整體執行時間。
//
// 回傳 DailyRunContext 物件，dailyCheck.mjs 直接解構使用，
//   不影響下游計算邏輯（indicatorsZ2、strategyEngine、aiCoach…）的任何行為。
//
// 並行策略：
//   Wave 1 — 完全獨立、無相互依賴的資料來源，全部同時並行
//   Wave 2 — 依賴 history（Z2 資料量檢查）才能繼續的後續步驟
//             （實際上 dailyCheck 已在拿到 history 後才判斷是否低於 60 筆，
//              故此層僅封裝，不改變原有提前終止語意）
//
// 錯誤處理原則：
//   - 致命性（history < 60 筆或來源不可用）→ 拋出，由 dailyCheck 捕捉並提前返回
//   - 非致命性（VIX / price / archive 讀取失敗）→ 記錄 warn，回傳 null / 預設值
//   - isCallAI = false 時，新聞與總經分析整段略過，相關欄位回傳空預設

import {
  getTwVix,
  fetchLatestClose,
  fetchRealtimeFromMis,
  isMarketOpenTodayTWSE,
} from "../modules/providers/twseProvider.mjs";
import { fetchStockHistoryWithAutoFillDetailed } from "../modules/providers/historyProvider.mjs";
import { fetchLatestBasePrice } from "../modules/providers/basePriceProvider.mjs";
import { fetchAllMacroData } from "../modules/providers/marketData.mjs";
import { fetchLastPortfolioState } from "../modules/storage.mjs";
import { fetchSocialSentimentData } from "../modules/providers/socialSentimentProvider.mjs";
import { getNewsTelegramMessages } from "../modules/newsFetcher.mjs";
import { analyzeMacroNewsWithAI } from "../modules/ai/aiCoach.mjs";
import {
  formatMacroChipForCoach,
  formatMacroAnalysisForCoach,
} from "../modules/ai/aiDataPreprocessor.mjs";
import { archiveManager } from "../modules/data/archiveManager.mjs";
import { stepTimer } from "../utils/coreUtils.mjs";
import logger from "../utils/logger.mjs";
import {
  getDefaultAssetRegistry,
  SchemaMapper,
} from "../modules/assets/assetRegistry.mjs";

// ─── 常數 ────────────────────────────────────────────────────────────────────

const SYMBOL_Z2 = "00675L.TW";
const SYMBOL_0050 = "0050.TW";
const HISTORY_MIN_BARS = 60; // 最低資料筆數；不足時視為致命錯誤

// ─── 主要 export ──────────────────────────────────────────────────────────────

/**
 * buildDailyRunContext
 *
 * 統一撈取 dailyCheck 所需的全部外部資料與本地檔案，
 * 並行執行 Wave 1，確認 Z2 歷史資料量後進入後續流程。
 *
 * @param {Object}  opts
 * @param {boolean} opts.isCallAI - 是否呼叫 AI（false 時略過新聞/總經分析）
 * @returns {Promise<DailyRunContext>}
 * @throws {Error} 若 Z2 歷史資料不足 HISTORY_MIN_BARS 筆（致命錯誤）
 */
export async function buildDailyRunContext({ isCallAI = true } = {}) {
  // ── Wave 1：全部獨立來源並行 ─────────────────────────────────────────────
  logger.info("⚡ [DailyRunContext] Wave 1 並行撈取開始...");
  const wave1Timer = stepTimer("wave1_parallel");

  const [
    portfolioResult,
    vixResult,
    basePriceResult,
    macroResult,
    socialSentimentResult,
    historyZ2Result,
    history0050Result,
    openTodayResult,
    valuationGuardResult,
    pbHistoryResult,
    prevAdviceResult,
    marketHistoryResult,
  ] = await Promise.allSettled([
    _fetchPortfolio(),
    _fetchVix(),
    _fetchBasePrice(),
    _fetchMacroData(),
    _fetchSocialSentiment(),
    _fetchHistory(SYMBOL_Z2),
    _fetchHistory(SYMBOL_0050),
    _checkMarketOpen(),
    _fetchValuationGuardState(),
    _fetchPbHistory(),
    _fetchPreviousAdviceSummary(),
    _fetchMarketHistory(),
  ]);

  wave1Timer();

  // ── 解包 Wave 1 結果 ─────────────────────────────────────────────────────

  const lastState = _unwrap(
    portfolioResult,
    _defaultPortfolio,
    "portfolioState",
  );
  const vixData = _unwrap(vixResult, null, "vixData");
  const basePrice = _unwrap(basePriceResult, null, "basePrice");

  // 確保在 _fetchVix 寫入完成後再讀取歷史紀錄
  let vixArr = [];
  try {
    vixArr = await _fetchVixHistory();
  } catch (err) {
    logger.warn(err, "⚠️ [DailyRunContext] vixArr 撈取失敗，使用 fallback");
  }

  const macroData = _unwrap(macroResult, {}, "macroData");
  const socialSentiment = _unwrap(
    socialSentimentResult,
    null,
    "socialSentiment",
  );
  const historyZ2ResultValue = _unwrap(
    historyZ2Result,
    {
      status: "source_unavailable",
      data: [],
      failedMonths: [],
      lastError: null,
    },
    "historyZ2",
  );
  const historyZ2Raw = Array.isArray(historyZ2ResultValue)
    ? historyZ2ResultValue
    : historyZ2ResultValue.data;
  const history0050ResultValue = _unwrap(history0050Result, [], "history0050");
  const history0050 = Array.isArray(history0050ResultValue)
    ? history0050ResultValue
    : (history0050ResultValue.data ?? []);
  const openToday = _unwrap(openTodayResult, false, "openToday");
  const valuationGuardState = _unwrap(
    valuationGuardResult,
    _defaultValuationGuardState(),
    "valuationGuardState",
  );
  const pbRecordsObjects = _unwrap(pbHistoryResult, [], "pbHistory");
  const previousAdviceSummary = _unwrap(
    prevAdviceResult,
    "",
    "previousAdviceSummary",
  );
  const marketHistory = _unwrap(marketHistoryResult, [], "marketHistory");

  // 部分 log（與原 dailyCheck 行為對齊）
  _logPortfolio(lastState);
  _logMarketOpen(openToday);
  _logVix(vixData);
  _logBasePrice(basePrice);
  _logMacroOverview(macroData);

  // ── 致命性檢查：Z2 歷史資料量 ────────────────────────────────────────────
  if (historyZ2ResultValue.status !== "available") {
    const isSourceUnavailable =
      historyZ2ResultValue.status === "source_unavailable";
    const error = new Error(
      isSourceUnavailable
        ? "00675L history source unavailable"
        : "00675L history insufficient",
    );
    error.code = isSourceUnavailable
      ? "HISTORY_SOURCE_UNAVAILABLE"
      : "HISTORY_INSUFFICIENT";
    error.details = {
      symbol: "00675L",
      required: HISTORY_MIN_BARS,
      count: historyZ2Raw.length,
      failedMonths: historyZ2ResultValue.failedMonths ?? [],
      lastError: historyZ2ResultValue.lastError ?? null,
    };
    logger.error({ err: error, details: error.details }, error.message);
    throw error;
  }

  // ── Wave 2：依賴 macroData 的衍生值 ──────────────────────────────────────

  const macroAndChipStr = formatMacroChipForCoach(macroData);

  const usRisk = macroData.rawUsMarket ?? {
    riskLevel: "正常",
    vix: "N/A",
    spx: "N/A",
    suggestion: "無美股數據",
  };
  const quote = macroData.quote ?? {
    quote: "投資需謹慎",
    author: "系統預設",
  };
  logger.info(`✅ 美股風險：${usRisk.riskLevel}`);
  logger.info(`📖 今日一句：${quote.quote}`);

  // pbRecords：純數值陣列，供 resolveValuationGuard 使用
  const pbRecords = pbRecordsObjects.map((r) => r.pb);

  // ── Wave 3：即時價（兩支股票可並行）─────────────────────────────────────
  logger.info("⚡ [DailyRunContext] Wave 3 即時行情並行撈取...");
  const wave3Timer = stepTimer("wave3_prices");

  const [price0050Result, priceZ2Result] = await Promise.allSettled([
    _fetchPrice(SYMBOL_0050),
    _fetchPrice(SYMBOL_Z2),
  ]);

  wave3Timer();

  const price0050 = _unwrap(price0050Result, null, "price0050");
  const currentPriceZ2 = _unwrap(priceZ2Result, null, "currentPriceZ2");

  // ── Wave 4：AI 新聞/總經分析（isCallAI = false 時全略）─────────────────
  let newsMessages = [];
  let newsSummaryText = "今日無重大市場新聞。";
  let conflictSummary = "";
  let newsAnalysisStatus = "success";
  let newsStructured = { tw: [], us: [] };
  let macroAnalysis = _defaultMacroAnalysis("無新聞數據，無法進行總經分析。");
  let macroTextForCoach = macroAnalysis.summary;
  let macroMarketDirection = null;

  if (isCallAI) {
    // 4-a. 新聞集錦
    logger.info("📝 [DailyRunContext] 正在從 news pool 取得新聞集錦...");
    const newsTimer = stepTimer("fetchNews");
    try {
      const newsResult = await getNewsTelegramMessages();
      newsMessages = newsResult.messages;
      newsSummaryText = newsResult.summaryText;
      conflictSummary = newsResult.conflictSummary ?? "";
      newsAnalysisStatus = newsResult.analysisStatus ?? "success";
      newsStructured = newsResult.structured ?? { tw: [], us: [] };
    } catch (err) {
      logger.error(err, "❌ [DailyRunContext] 取得新聞集錦失敗（不影響通知）");
      newsSummaryText = "新聞集錦取得失敗，請檢查系統日誌。";
    }
    newsTimer();

    // 4-b. 總經多空分析
    logger.info("🤖 [DailyRunContext] 正在產生總經多空對決報告...");
    if (newsMessages?.length) {
      const macroTimer = stepTimer("analyzeMacro");
      try {
        macroAnalysis = await analyzeMacroNewsWithAI(
          newsSummaryText,
          conflictSummary,
        );
        macroTextForCoach = formatMacroAnalysisForCoach(macroAnalysis);
      } catch (err) {
        logger.error(
          err,
          "❌ [DailyRunContext] 總經分析 AI 產生失敗，降級處理",
        );
        macroAnalysis = _defaultMacroAnalysis(
          "總經分析 AI 產生失敗，使用預設空結構。",
        );
        macroTextForCoach = macroAnalysis.summary;
      }
      macroTimer();
    } else {
      logger.warn("⚠️ [DailyRunContext] 無新聞數據，跳過總經分析");
      macroAnalysis = _defaultMacroAnalysis("無新聞數據，無法進行總經分析。");
      macroTextForCoach = macroAnalysis.summary;
    }

    macroMarketDirection = macroAnalysis?.conclusion?.market_direction ?? null;
    if (macroMarketDirection) {
      logger.info(`✅ 總經方向：${macroMarketDirection}`);
    } else {
      logger.warn("⚠️ [DailyRunContext] 無總經方向，策略引擎將不套用情緒調整");
    }
  } else {
    // 💰 節費測試模式
    logger.info(
      "💰 [Cost-Saving] isCallAI=false，強行略過新聞分析與總經 LLM 任務",
    );
    macroAnalysis = _defaultMacroAnalysis("[節費模式] 略過分析");
    macroTextForCoach = "[節費模式] 已略過 AI 總經分析";
  }

  // ── 組合回傳物件 ──────────────────────────────────────────────────────────
  // 建立資產註冊表與 SchemaMapper 以支援新舊格式轉換
  const assetRegistry = getDefaultAssetRegistry();
  const _schemaMapper = new SchemaMapper(assetRegistry);

  // 確保 lastState 不為 null
  const safeLastState = lastState ?? {};

  // 新格式 portfolio (assets-based)
  const newPortfolio = {
    assets: {
      "0050": {
        qty: safeLastState.qty0050 ?? 0,
        avgCost: safeLastState.avgCost0050 ?? null,
      },
      "00675L": {
        qty: safeLastState.qtyZ2 ?? 0,
        avgCost: safeLastState.avgCostZ2 ?? null,
      },
    },
    cash: safeLastState.cash ?? 0,
    totalLoan: safeLastState.totalLoan ?? 0,
    lastBuyDate: safeLastState.lastBuyDate ?? null,
  };

  // 新格式 marketData (prices-based)
  const newMarketData = {
    prices: {
      "0050": price0050 ?? 0,
      "00675L": currentPriceZ2 ?? 0,
    },
    vix: vixData?.value ?? null,
    pb: macroData?.rawValuation?.pb ?? null,
    currentRate: macroData?.rawFx?.currentRate ?? null,
    cnnScore: macroData?.rawCnn?.score ?? null,
    maintenanceRatio: macroData?.rawMargin?.maintenanceRatio ?? null,
  };

  return {
    // === 新格式 (資產抽象化) ===
    portfolio: newPortfolio,
    marketData: newMarketData,

    // === 舊格式 (向後相容) ===
    // 持股狀態
    lastState,
    // 開市狀態
    openToday,
    // 行情
    vixData,
    vixArr,
    basePrice,
    price0050,
    currentPriceZ2,
    // 歷史 K 棒
    historyZ2: historyZ2Raw,
    history0050,
    // 總經
    macroData,
    socialSentiment,
    sourceMetadata: macroData.sourceMetadata ?? null,
    macroAndChipStr,
    usRisk,
    quote,
    // AI / 新聞
    newsMessages,
    newsSummaryText,
    conflictSummary,
    newsAnalysisStatus,
    newsStructured,
    macroAnalysis,
    macroTextForCoach,
    macroMarketDirection,
    // 前次建議
    previousAdviceSummary,
    marketHistory,
    // 守衛狀態
    valuationGuardState,
    pbRecords,
    pbRecordsObjects,
  };
}

// ─── 私有撈取函式 ─────────────────────────────────────────────────────────────

/** 試算表持股狀態，失敗時 fallback 至本地備份 */
async function _fetchPortfolio() {
  try {
    const done = stepTimer("fetchPortfolioState");
    const state = await fetchLastPortfolioState();
    done();
    return state;
  } catch (e) {
    logger.error(e, "⚠️ [DailyRunContext] 讀取試算表失敗，將使用預設設定 0");
    const cachedLastBuyDate = await archiveManager.getLastBuyDate();
    if (cachedLastBuyDate) {
      logger.warn(
        `⚠️ [DailyRunContext] Sheet 失敗，lastBuyDate 使用本地備份: ${cachedLastBuyDate}`,
      );
    } else {
      logger.warn(
        "⚠️ [DailyRunContext] Sheet 失敗且無本地備份，lastBuyDate 將以 null 處理",
      );
    }
    return {
      ..._defaultPortfolio(),
      lastBuyDate: cachedLastBuyDate ?? null,
    };
  }
}

/** 台指 VIX */
async function _fetchVix() {
  const done = stepTimer("fetchVix");
  const result = await getTwVix();
  done();

  // 若成功取得 VIX，儲存到歷史紀錄
  if (result && typeof result.value === "number") {
    await archiveManager.saveVixHistory(result.value);
  }

  return result;
}

/** 台指 VIX 歷史序列（從本地緩存讀取） */
async function _fetchVixHistory() {
  const done = stepTimer("fetchVixHistory");
  const history = await archiveManager.getVixHistory();
  done();

  // 回傳純數值陣列（由舊到新排序），供 strategyEngine 使用
  return history.map((entry) => entry.value);
}

/** 基準價 */
async function _fetchBasePrice() {
  const done = stepTimer("fetchBasePrice");
  const result = await fetchLatestBasePrice();
  done();
  return result.basePrice;
}

/** 總經與籌碼資料 */
async function _fetchMacroData() {
  logger.info("🌏 [DailyRunContext] 正在獲取總經與籌碼資料...");
  const done = stepTimer("fetchMacroData");
  const result = await fetchAllMacroData();
  done();
  return result;
}

/** 社群情緒數據（來自 socialSentimentProvider） */
async function _fetchSocialSentiment() {
  logger.info("💬 [DailyRunContext] 正在獲取社群情緒資料...");
  const done = stepTimer("fetchSocialSentiment");
  try {
    const result = await fetchSocialSentimentData();
    done();
    return result;
  } catch (err) {
    done();
    logger.warn(err, "⚠️ [DailyRunContext] 社群情緒資料撈取失敗，回傳 null");
    return null;
  }
}

/** 個股歷史 K 棒 */
async function _fetchHistory(symbol) {
  logger.info(
    `📥 [DailyRunContext] 正在抓取 ${symbol} 歷史數據 (含自動回補)...`,
  );
  const done = stepTimer(`fetchStockHistory_${symbol}`);

  const result = await fetchStockHistoryWithAutoFillDetailed(
    symbol,
    HISTORY_MIN_BARS,
  );

  done();
  return result;
}

/** 是否開市 */
async function _checkMarketOpen() {
  logger.info("📅 [DailyRunContext] 檢查是否開市...");
  return isMarketOpenTodayTWSE();
}

/** 個股即時價（含 fallback 收盤價） */
async function _fetchPrice(symbol) {
  logger.info(`📥 [DailyRunContext] 正在抓取 ${symbol} 即時價...`);
  const done = stepTimer(`fetchPrice_${symbol}`);
  let price = null;
  try {
    const rt = await fetchRealtimeFromMis(symbol);
    price = rt?.price ?? null;
  } catch (e) {
    logger.warn(`⚠️ [DailyRunContext] ${symbol} MIS 失敗，轉用收盤價`);
  }
  if (!price) {
    const latest = await fetchLatestClose(symbol);
    price = latest?.close ?? null;
  }
  done();
  return price;
}

/** valuationGuardState（latch 狀態） */
async function _fetchValuationGuardState() {
  const savedState = await archiveManager.getValuationGuardState();
  if (savedState && typeof savedState.defenseLatch === "boolean") {
    const state = {
      latchActive: savedState.defenseLatch,
      latchTriggeredAt: savedState.latchTriggeredAt ?? null,
      latchTriggeredPR: savedState.latchTriggeredPR ?? null,
    };
    logger.info(
      `✅ [DailyRunContext] valuationGuardState 載入：latchActive=${state.latchActive}` +
        (state.latchTriggeredAt ? `，觸發日 ${state.latchTriggeredAt}` : ""),
    );
    return state;
  }
  return _defaultValuationGuardState();
}

/** PB 歷史紀錄 */
async function _fetchPbHistory() {
  return archiveManager.getPbHistory();
}

/** 市場歷史快照（非致命；讀取失敗時使用空陣列） */
async function _fetchMarketHistory() {
  try {
    return (await archiveManager.getMarketHistory()) ?? [];
  } catch (err) {
    logger.warn(err, "⚠️ [DailyRunContext] 市場歷史快照讀取失敗，使用空陣列");
    return [];
  }
}

/** 前次 AI 建議摘要 */
async function _fetchPreviousAdviceSummary() {
  logger.info("📂 [DailyRunContext] 正在載入前次 AI 建議摘要...");
  const done = stepTimer("fetchPrevAdvice");
  const summary = await archiveManager.getPreviousAdviceSummary();
  done();
  if (summary) {
    logger.info(
      `✅ [DailyRunContext] 前次建議摘要已載入（${summary.length} 字）`,
    );
  } else {
    logger.info(
      "ℹ️ [DailyRunContext] 無前次建議記錄（首次執行或讀取失敗），AI 將全量分析",
    );
  }
  return summary ?? "";
}

// ─── 預設值工廠 ───────────────────────────────────────────────────────────────

function _defaultPortfolio() {
  return {
    date: null,
    qty0050: 0,
    qtyZ2: 0,
    totalLoan: 0,
    cash: 0,
    avgCost0050: null,
    avgCostZ2: null,
    lastBuyDate: null,
  };
}

function _defaultValuationGuardState() {
  return {
    latchActive: false,
    latchTriggeredAt: null,
    latchTriggeredPR: null,
  };
}

function _defaultMacroAnalysis(summary = "") {
  return { bullish: 0, bearish: 0, neutral: 0, summary };
}

// ─── Promise.allSettled 解包 helper ───────────────────────────────────────────

/**
 * 解包 Promise.allSettled 的單筆結果；rejected 時記錄 warn 並回傳 fallback。
 * @template T
 * @param {{ status: string, value?: T, reason?: unknown }} settled
 * @param {T | (()=>T)} fallback  - 可以是值或工廠函式
 * @param {string} label          - 用於 log 的欄位名稱
 * @returns {T}
 */
function _unwrap(settled, fallback, label) {
  if (settled.status === "fulfilled") return settled.value;
  logger.warn(
    settled.reason,
    `⚠️ [DailyRunContext] ${label} 撈取失敗，使用 fallback`,
  );
  return typeof fallback === "function" ? fallback() : fallback;
}

// ─── Log helpers（與原 dailyCheck 行為對齊）──────────────────────────────────

function _logPortfolio(s) {
  if (!s) {
    logger.warn("⚠️ 持股資料為空，請檢查配置");
    return;
  }
  logger.info(
    `✅ 持股狀態確認：0050=${s.qty0050}股, 00675L=${s.qtyZ2}股, 借款=${s.totalLoan}`,
  );
}

function _logMarketOpen(open) {
  if (!open) logger.info("😴 當日無開市，跳過通知");
}

function _logVix(vixData) {
  if (vixData) {
    logger.info(`✅ VIX 值：${vixData.value.toFixed(2)}`);
  } else {
    logger.info("❌ VIX 抓取失敗，不影響主流程");
  }
}

function _logBasePrice(basePrice) {
  logger.info(`💰 取得基準價：${basePrice}`);
}

function _logMacroOverview(_macroData) {
  logger.info("🌏 總經概況已載入");
}
