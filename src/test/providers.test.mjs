import test from "node:test";
import assert from "node:assert/strict";

// 引入我們剛才寫好的三個 Provider 模組
// (請根據你實際的檔案路徑進行調整)
import { fetchFearAndGreedIndex } from "../modules/providers/cnnProvider.mjs";
import { fetchUsdTwdExchangeRate } from "../modules/providers/yahooProvider.mjs";
import { fetchBusinessIndicator } from "../modules/providers/ndcProvider.mjs";
import { fetchTwseMarginData } from "../modules/providers/hiStockProvider.mjs";

test("🧪 測試 CNN 恐懼與貪婪指數 API", async (t) => {
  const result = await fetchFearAndGreedIndex();

  // 測試是否有成功回傳物件
  assert.ok(result, "回傳結果不應為空");

  // 測試分數是否在 0 ~ 100 的合理範圍內
  assert.ok(
    result.score >= 0 && result.score <= 100,
    `分數 ${result.score} 不在 0~100 範圍內`,
  );

  // 測試是否成功解析出文字評價 (rating)
  assert.ok(
    typeof result.rating === "string" && result.rating.length > 0,
    "Rating 應為有效字串",
  );

  // 測試 timestamp 是否為合法的 Date 物件
  assert.ok(
    result.timestamp instanceof Date && !isNaN(result.timestamp),
    "Timestamp 必須是合法的 Date",
  );

  console.log(
    `✅ [CNN] 測試通過 | 當前分數: ${result.score} (${result.rating})`,
  );
});

test("🧪 測試 Yahoo 台股大盤融資維持率與餘額", async (t) => {
  const result = await fetchTwseMarginData();

  assert.ok(result, "回傳結果不應為空");

  // 測試大盤融資維持率是否介於 130% ~ 220% 之間
  assert.ok(
    result.maintenanceRatio > 130 && result.maintenanceRatio < 220,
    `融資維持率 ${result.maintenanceRatio}% 異常 (不在 130~220 之間)`,
  );

  // 測試融資餘額是否大於 1000 億 (台股上市融資常態在 2000~4000億之間)
  assert.ok(
    result.marginBalance100M > 1000,
    `融資餘額 ${result.marginBalance100M} 億異常 (小於 1000 億)`,
  );

  assert.ok(
    typeof result.marginBalanceChange100M === "number",
    "融資增減必須是數字",
  );

  console.log(
    `✅ [Yahoo 融資] 測試通過 | 維持率: ${result.maintenanceRatio}% | 餘額: ${result.marginBalance100M}億`,
  );
});

test("🧪 測試 Yahoo USD/TWD 美元兌台幣匯率", async (t) => {
  const result = await fetchUsdTwdExchangeRate();

  assert.ok(result, "回傳結果不應為空");

  // 測試匯率是否在 25 ~ 40 之間的合理範圍
  assert.ok(
    result.exchangeRate > 25 && result.exchangeRate < 40,
    `匯率 ${result.exchangeRate} 不在 25~40 範圍內`,
  );

  assert.ok(typeof result.previousClose === "number", "昨收價必須是數字");
  assert.ok(typeof result.changePercent === "number", "漲跌幅必須是數字");

  console.log(
    `✅ [Yahoo 匯率] 測試通過 | 最新匯率: ${result.exchangeRate} (漲跌: ${result.changePercent}%)`,
  );
});

test("🧪 測試 國發會景氣對策信號 API", async (t) => {
  const result = await fetchBusinessIndicator();

  assert.ok(result, "回傳結果不應為空");

  // 測試分數是否在 9 ~ 45 之間 (國發會滿分45，最低9)
  assert.ok(
    result.score >= 9 && result.score <= 45,
    `景氣分數 ${result.score} 不在 9~45 範圍內`,
  );

  // 測試燈號顏色字串是否合法
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

  // 測試日期格式是否為 YYYY-MM
  assert.match(
    result.date,
    /^\d{4}-\d{2}$/,
    `日期格式 ${result.date} 必須是 YYYY-MM`,
  );

  console.log(
    `✅ [國發會] 測試通過 | 月份: ${result.date} | 燈號: ${result.light} (${result.score}分)`,
  );
});
