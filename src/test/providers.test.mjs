import test from "node:test";
import assert from "node:assert/strict";

import { fetchFearAndGreedIndex } from "../modules/providers/cnnProvider.mjs";
import { fetchUsdTwdExchangeRate } from "../modules/providers/yahooProvider.mjs";
import { fetchBusinessIndicator } from "../modules/providers/ndcProvider.mjs";
import { fetchTwseMarginData } from "../modules/providers/kgiProvider.mjs";
import {
  fetchRealtimeFromMis,
  getTwVix,
  loadHolidaySet,
  isMarketOpenTodayTWSE,
  fetchStockHistory,
  fetchLatestClose,
  fetchRealTimePrice,
  fetchMarketValuation,
} from "../modules/providers/twseProvider.mjs";
import {
  formatCnnDataForAi,
  formatMarginForAi,
  formatFxForAi,
  formatBusinessIndicatorForAi,
} from "../modules/ai/aiDataPreprocessor.mjs";

// ============================================================================
// 🎛️ CLI 參數篩選：PROVIDER=twse,cnn,kgi,yahoo,ndc,ai
//    用法範例：
//      PROVIDER=twse   node --test src/test/providers.test.mjs
//      PROVIDER=twse,cnn node --test src/test/providers.test.mjs
//      node --test src/test/providers.test.mjs                     (全部執行)
// ============================================================================
const providerArg =
  process.env.PROVIDER ||
  process.argv.find((a) => a.startsWith("--provider="))?.replace("--provider=", "");
const selectedProviders = providerArg
  ? new Set(providerArg.split(",").map((s) => s.trim().toLowerCase()))
  : null; // null = 全部執行

function shouldRun(providerName) {
  return !selectedProviders || selectedProviders.has(providerName);
}

// ============================================================================
// 1. 外部 API 獲取測試 (Providers)
// ============================================================================

// ── CNN Provider ────────────────────────────────────────────────────────────
if (shouldRun("cnn")) {
  test("🧪 測試 CNN 恐懼與貪婪指數 API", async (t) => {
    const result = await fetchFearAndGreedIndex();
    assert.ok(result, "回傳結果不應為空");
    assert.ok(
      result.score >= 0 && result.score <= 100,
      `分數 ${result.score} 不在 0~100 範圍內`,
    );
    assert.ok(
      typeof result.rating === "string" && result.rating.length > 0,
      "Rating 應為有效字串",
    );
    assert.ok(
      result.timestamp instanceof Date && !isNaN(result.timestamp),
      "Timestamp 必須是合法的 Date",
    );
    console.log(
      `✅ [CNN API] 測試通過 | 當前分數: ${result.score} (${result.rating})`,
    );
  });
}

// ── KGI Provider ────────────────────────────────────────────────────────────
if (shouldRun("kgi")) {
  test("🧪 測試 凱基證券 台股大盤融資維持率與餘額 API", async (t) => {
    const result = await fetchTwseMarginData();
    assert.ok(result, "回傳結果不應為空");
    assert.ok(
      result.maintenanceRatio > 130 && result.maintenanceRatio < 220,
      `融資維持率 ${result.maintenanceRatio}% 異常 (不在 130~220 之間)`,
    );
    assert.ok(
      result.marginBalance100M > 1000,
      `融資餘額 ${result.marginBalance100M} 億異常 (小於 1000 億)`,
    );
    assert.ok(
      typeof result.marginBalanceChange100M === "number",
      "融資增減必須是數字",
    );
    console.log(
      `✅ [凱基融資 API] 測試通過 | 維持率: ${result.maintenanceRatio}% | 餘額: ${result.marginBalance100M}億`,
    );
  });
}

// ── Yahoo Provider ──────────────────────────────────────────────────────────
if (shouldRun("yahoo")) {
  test("🧪 測試 Yahoo USD/TWD 美元兌台幣匯率 API", async (t) => {
    const result = await fetchUsdTwdExchangeRate();
    assert.ok(result, "回傳結果不應為空");

    // 相容修改後的欄位名稱 (currentRate 或 exchangeRate)
    const rate = result.currentRate || result.exchangeRate;
    assert.ok(rate > 25 && rate < 40, `匯率 ${rate} 不在 25~40 範圍內`);
    assert.ok(typeof result.previousClose === "number", "昨收價必須是數字");
    assert.ok(typeof result.changePercent === "number", "漲跌幅必須是數字");

    // 測試是否成功抓取到多日陣列
    assert.ok(Array.isArray(result.historicalPrices), "應該回傳歷史價格陣列");

    console.log(
      `✅ [Yahoo 匯率 API] 測試通過 | 最新匯率: ${rate} (漲跌: ${result.changePercent}%)`,
    );
  });
}

// ── NDC Provider ────────────────────────────────────────────────────────────
if (shouldRun("ndc")) {
  test("🧪 測試 國發會景氣對策信號 API", async (t) => {
    const result = await fetchBusinessIndicator();
    assert.ok(result, "回傳結果不應為空");
    assert.ok(
      result.score >= 9 && result.score <= 45,
      `景氣分數 ${result.score} 不在 9~45 範圍內`,
    );
    const validColors = [
      "red",
      "yellow-red",
      "green",
      "yellow-blue",
      "blue",
      "unknown",
    ];
    assert.ok(
      validColors.includes(result.lightColor),
      `未知的燈號顏色: ${result.lightColor}`,
    );
    assert.match(
      result.date,
      /^\d{4}-\d{2}$/,
      `日期格式 ${result.date} 必須是 YYYY-MM`,
    );
    console.log(
      `✅ [國發會 API] 測試通過 | 月份: ${result.date} | 燈號: ${result.light} (${result.score}分)`,
    );
  });
}

// ── TWSE Provider ───────────────────────────────────────────────────────────
if (shouldRun("twse")) {
  test("🧪 測試 TWSE MIS 即時報價 (fetchRealtimeFromMis)", async (t) => {
    // 使用台積電 2330 作為測試標的
    const result = await fetchRealtimeFromMis("2330");
    assert.ok(result, "回傳結果不應為空");
    assert.ok(
      ["last(z)", "bid1(b)", "ask1(a)", "none"].includes(result.priceSource),
      `priceSource 應為合法值，實際: ${result.priceSource}`,
    );
    // 非交易時段 price 可能為 null，只驗證結構
    assert.ok("price" in result, "應有 price 欄位");
    assert.ok("time" in result, "應有 time 欄位");
    assert.ok("rawTime" in result, "應有 rawTime 欄位");
    console.log(
      `✅ [TWSE MIS] 測試通過 | 價格: ${result.price} | 來源: ${result.priceSource}`,
    );
  });

  test("🧪 測試 期交所 VIX (getTwVix)", async (t) => {
    const result = await getTwVix();
    // VIX 在非交易時段可能回傳 null
    if (result === null) {
      console.log("⚠️ [VIX] 非交易時段，回傳 null (跳過數值驗證)");
      return;
    }
    assert.ok(typeof result.value === "number", "VIX value 應為數字");
    assert.ok(
      result.value > 0 && result.value < 100,
      `VIX ${result.value} 不在合理範圍 (0~100)`,
    );
    assert.ok(
      ["安逸", "中性", "緊張"].includes(result.status),
      `VIX 狀態應為 安逸/中性/緊張，實際: ${result.status}`,
    );
    assert.ok(typeof result.change === "number", "VIX change 應為數字");
    assert.ok(result.symbolUsed, "應有 symbolUsed 標記");
    console.log(
      `✅ [VIX] 測試通過 | 值: ${result.value} (${result.status}) | 變化: ${result.change}`,
    );
  });

  test("🧪 測試 TWSE 休市日載入 (loadHolidaySet)", async (t) => {
    const currentYear = new Date().getFullYear();
    const holidays = await loadHolidaySet(currentYear);
    assert.ok(holidays instanceof Set, "應回傳 Set 物件");

    if (holidays.size === 0) {
      // TWSE 休市日頁面為 JS 動態渲染，非瀏覽器環境可能解析不到資料
      console.log(
        `⚠️ [休市日] ${currentYear} 年解析到 0 筆 (頁面可能為 JS 渲染，跳過數值驗證)`,
      );
      return;
    }

    // 驗證格式：應為 YYYY-MM-DD
    for (const d of holidays) {
      assert.match(
        d,
        /^\d{4}-\d{2}-\d{2}$/,
        `休市日格式應為 YYYY-MM-DD，實際: ${d}`,
      );
      break; // 只驗第一筆即可
    }
    console.log(
      `✅ [休市日] 測試通過 | ${currentYear} 年共 ${holidays.size} 個休市日`,
    );
  });

  test("🧪 測試 TWSE 今日是否開市 (isMarketOpenTodayTWSE)", async (t) => {
    const result = await isMarketOpenTodayTWSE();
    assert.ok(
      typeof result === "boolean",
      `回傳值應為 boolean，實際: ${typeof result}`,
    );
    const dayName = [
      "週日",
      "週一",
      "週二",
      "週三",
      "週四",
      "週五",
      "週六",
    ][new Date().getDay()];
    console.log(
      `✅ [開市判斷] 測試通過 | 今天(${dayName}) 開市: ${result}`,
    );
  });

  test("🧪 測試 TWSE 歷史股價 (fetchStockHistory)", async (t) => {
    // 取近 1 個月的資料，降低 API 壓力
    const now = new Date();
    const period2 = now.toISOString().slice(0, 10);
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const period1 = oneMonthAgo.toISOString().slice(0, 10);

    const result = await fetchStockHistory("2330", period1, period2);
    assert.ok(Array.isArray(result), "應回傳陣列");
    assert.ok(result.length > 0, "近 1 個月應至少有 1 筆交易日資料");

    const row = result[0];
    assert.ok(row.date, "每筆應有 date");
    assert.ok(typeof row.open === "number", "open 應為數字");
    assert.ok(typeof row.high === "number", "high 應為數字");
    assert.ok(typeof row.low === "number", "low 應為數字");
    assert.ok(typeof row.close === "number", "close 應為數字");
    assert.ok(typeof row.volume === "number", "volume 應為數字");
    assert.ok(row.close > 0, `收盤價 ${row.close} 應為正數`);
    console.log(
      `✅ [歷史股價] 測試通過 | ${period1}~${period2} 共 ${result.length} 筆 | 最新收盤: ${result[result.length - 1].close}`,
    );
  });

  test("🧪 測試 TWSE 最新收盤價 (fetchLatestClose)", async (t) => {
    const result = await fetchLatestClose("2330");
    // 若當月尚無交易日（如 1/1）可能為 null
    if (result === null) {
      console.log("⚠️ [最新收盤] 當月尚無交易日資料，回傳 null (跳過驗證)");
      return;
    }
    assert.ok(result.date, "應有 date 欄位");
    assert.ok(typeof result.close === "number", "close 應為數字");
    assert.ok(result.close > 0, `收盤價 ${result.close} 應為正數`);
    console.log(
      `✅ [最新收盤] 測試通過 | 日期: ${result.date} | 收盤: ${result.close}`,
    );
  });

  test("🧪 測試 TWSE 即時價格 (fetchRealTimePrice)", async (t) => {
    const result = await fetchRealTimePrice("2330");
    assert.ok(result, "回傳結果不應為空");
    assert.ok("price" in result, "應有 price 欄位");
    assert.ok("time" in result, "應有 time 欄位");
    // 非交易時段走 fallback，price 也可能為 null
    if (result.price !== null) {
      assert.ok(typeof result.price === "number", "price 應為數字");
      assert.ok(result.price > 0, `價格 ${result.price} 應為正數`);
    }
    console.log(
      `✅ [即時價格] 測試通過 | 價格: ${result.price} | 時間: ${result.time}`,
    );
  });

  test("🧪 測試 TWSE 大盤估值 PB/PE (fetchMarketValuation)", async (t) => {
    const result = await fetchMarketValuation();
    assert.ok(result, "回傳結果不應為空");

    // PE: 一般大盤 PE 在 8~30 之間
    if (result.pe !== null) {
      assert.ok(typeof result.pe === "number", "PE 應為數字");
      assert.ok(
        result.pe > 5 && result.pe < 50,
        `大盤 PE ${result.pe} 不在合理範圍 (5~50)`,
      );
    }

    // PB: 一般大盤 PB 在 1.0~3.5 之間
    if (result.pb !== null) {
      assert.ok(typeof result.pb === "number", "PB 應為數字");
      assert.ok(
        result.pb > 0.5 && result.pb < 5,
        `大盤 PB ${result.pb} 不在合理範圍 (0.5~5)`,
      );
    }

    // Yield
    if (result.yield !== null) {
      assert.ok(typeof result.yield === "number", "Yield 應為數字");
      assert.ok(
        result.yield > 0 && result.yield < 10,
        `殖利率 ${result.yield}% 不在合理範圍 (0~10)`,
      );
    }

    console.log(
      `✅ [大盤估值] 測試通過 | PE: ${result.pe} | PB: ${result.pb} | 殖利率: ${result.yield}% | 日期: ${result.date}`,
    );
  });
}

// ============================================================================
// 2. AI Preprocessor 轉換邏輯測試 (使用 Mock Data)
// ============================================================================

if (shouldRun("ai")) {
  test("🧪 測試 AI Preprocessor: formatCnnDataForAi", (t) => {
    const mockData = {
      score: 20,
      rating: "extreme fear",
      previousClose: 25,
      previous1Week: 30,
    };
    const formatted = formatCnnDataForAi(mockData);

    assert.ok(formatted["當前狀態"].includes("極度恐慌"), "應該正確翻譯 rating");
    assert.ok(
      formatted["短期趨勢_較昨日"].includes("-5"),
      "應該正確計算昨日差異",
    );
    console.log("✅ [CNN Preprocessor] 邏輯驗證通過");
  });

  test("🧪 測試 AI Preprocessor: formatMarginForAi", (t) => {
    // 測試斷頭崩盤情境
    const mockPanicData = {
      marginBalance100M: 2800,
      marginBalanceChange100M: -50,
      maintenanceRatio: 132,
    };
    const panicFormatted = formatMarginForAi(mockPanicData);

    assert.ok(
      panicFormatted["大盤維持率"].includes("極度恐慌 (歷史低點)"),
      "132% 應被判定為極度恐慌",
    );
    assert.ok(
      panicFormatted["今日餘額變化"].includes("恐慌性殺出"),
      "-50億應被判定為恐慌性殺出",
    );
    console.log("✅ [融資 Preprocessor] 邏輯驗證通過");
  });

  test("🧪 測試 AI Preprocessor: formatFxForAi (雙週期)", (t) => {
    const mockFxData = {
      currentRate: 32.8,
      changePercent: 0.5,
      // 模擬 1個月 (20天) 的陣列，從 32.0 升到 32.8 (貶值趨勢)
      historicalPrices: [
        32.0, 32.0, 32.1, 32.1, 32.2, 32.2, 32.3, 32.3, 32.4, 32.4, 32.5,
        32.5, 32.5, 32.6, 32.6, 32.7, 32.7, 32.7, 32.8, 32.8,
      ],
    };
    const formatted = formatFxForAi(mockFxData);

    assert.ok(formatted["今日變化"].includes("急貶"), "單日大漲 0.5% 應為急貶");
    assert.ok(
      formatted["中線趨勢_近1月"].includes("中期貶值趨勢"),
      "價差 +0.8 應為中期貶值",
    );
    console.log("✅ [匯率 Preprocessor] 雙週期邏輯驗證通過");
  });

  test("🧪 測試 AI Preprocessor: formatBusinessIndicatorForAi", (t) => {
    // 測試藍燈買點情境
    const mockBlueLight = {
      date: "2026-02",
      score: 15,
      light: "藍燈 (低迷)",
      lightColor: "blue",
    };
    const formatted = formatBusinessIndicatorForAi(mockBlueLight);

    assert.ok(
      formatted["景氣循環位階"].includes("景氣低迷"),
      "15分應判定為景氣低迷",
    );
    assert.ok(
      formatted["AI解讀提示"].includes("極佳的左側買點"),
      "藍燈應提示長線左側買點",
    );
    console.log("✅ [景氣燈號 Preprocessor] 邏輯驗證通過");
  });
}
