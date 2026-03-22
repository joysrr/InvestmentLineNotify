import test from "node:test";
import assert from "node:assert/strict";

import { fetchFearAndGreedIndex } from "../modules/providers/cnnProvider.mjs";
import { fetchUsdTwdExchangeRate } from "../modules/providers/yahooProvider.mjs";
import { fetchBusinessIndicator } from "../modules/providers/ndcProvider.mjs";
import { fetchTwseMarginData } from "../modules/providers/kgiProvider.mjs";
import {
  formatCnnDataForAi,
  formatMarginForAi,
  formatFxForAi,
  formatBusinessIndicatorForAi,
  buildExtendedMacroContext,
} from "../modules/ai/aiDataPreprocessor.mjs";

// ============================================================================
// 1. 外部 API 獲取測試 (Providers)
// ============================================================================

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

// ============================================================================
// 2. AI Preprocessor 轉換邏輯測試 (使用 Mock Data)
// ============================================================================

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
      32.0, 32.0, 32.1, 32.1, 32.2, 32.2, 32.3, 32.3, 32.4, 32.4, 32.5, 32.5,
      32.5, 32.6, 32.6, 32.7, 32.7, 32.7, 32.8, 32.8,
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
