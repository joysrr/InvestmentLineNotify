/**
 * test-keywords.mjs
 * 驗證：
 *   1. validateDynamicKeyword() — 各種合規 / 不合規邊界
 *   2. mergeKeywords()          — 去重、驗證過濾、靜態池順序
 *   3. buildSingleKeywordQueryStr() — query 字串格式
 *
 * 執行方式：node test-keywords.mjs
 *
 * 注意：三個純函式直接複製自 newsFetcher.mjs，無需任何 import。
 *       若日後將函式 export，可改為 import。
 */

import assert from "assert/strict";

// ── 複製自 newsFetcher.mjs 的純函式 ──────────────────────────────────────────

function validateDynamicKeyword(item, staticPool) {
  if (!item?.keyword || typeof item.keyword !== "string") return false;
  const kw = item.keyword.trim();
  if (kw.length < 2) return false;
  if (/^[A-Z]{2,5}$/.test(kw)) return false;
  const tokens = kw.match(/[\u4e00-\u9fff\u3400-\u4dbf]+|[a-zA-Z0-9]+/g) ?? [];
  if (tokens.length < 1 || tokens.length > 4) return false;
  if (staticPool.some((s) => s.keyword.toLowerCase() === kw.toLowerCase()))
    return false;
  return true;
}

function mergeKeywords(baseList, dynamicList) {
  const validated = dynamicList.filter((item) =>
    validateDynamicKeyword(item, baseList)
  );
  const invalidCount = dynamicList.length - validated.length;
  if (invalidCount > 0) {
    console.log(`     [merge] 過濾 ${invalidCount} 個不合規關鍵字`);
  }
  const mergedMap = new Map();
  [...baseList, ...validated].forEach((item) =>
    mergedMap.set(item.keyword.toLowerCase(), item)
  );
  return Array.from(mergedMap.values());
}

function buildSingleKeywordQueryStr(item, excludeList = []) {
  const include =
    item.searchType === "intitle"
      ? `intitle:"${item.keyword}"`
      : `"${item.keyword}"`;
  const excludeParts = excludeList.map((ex) =>
    ex.searchType === "intitle"
      ? `-intitle:"${ex.keyword}"`
      : `-"${ex.keyword}"`
  );
  return [include, "+when:1d", ...excludeParts].join(" ");
}

// ── 靜態池 Mock ───────────────────────────────────────────────────────────────

const mockTwBase = [
  { keyword: "台股", searchType: "intitle" },
  { keyword: "大盤", searchType: "intitle" },
  { keyword: "外資", searchType: "broad" },
  { keyword: "三大法人", searchType: "broad" },
  { keyword: "央行", searchType: "broad" },
  { keyword: "通膨", searchType: "broad" },
];

const mockUsBase = [
  { keyword: "S&P 500", searchType: "intitle" },
  { keyword: "Federal Reserve", searchType: "broad" },
  { keyword: "Fed", searchType: "broad" },
  { keyword: "inflation", searchType: "broad" },
];

const mockTwExclude = [
  { keyword: "排行", searchType: "intitle" },
  { keyword: "即時新聞", searchType: "intitle" },
];

// ── 測試 Runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     → ${err.message}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. validateDynamicKeyword
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n📋 [test-keywords] validateDynamicKeyword\n");

test("正常中文複合詞通過", () => {
  assert.ok(validateDynamicKeyword({ keyword: "台積電 法說會", searchType: "intitle" }, mockTwBase));
});

test("正常英文複合詞通過", () => {
  assert.ok(validateDynamicKeyword({ keyword: "NVDA earnings beat", searchType: "broad" }, mockUsBase));
});

test("單一全大寫縮寫被拒絕 - ETF", () => {
  assert.ok(!validateDynamicKeyword({ keyword: "ETF", searchType: "broad" }, mockTwBase));
});

test("單一全大寫縮寫被拒絕 - GDP", () => {
  assert.ok(!validateDynamicKeyword({ keyword: "GDP", searchType: "broad" }, mockUsBase));
});

test("單一全大寫縮寫被拒絕 - ISM", () => {
  assert.ok(!validateDynamicKeyword({ keyword: "ISM", searchType: "broad" }, mockUsBase));
});

test("與靜態池重複被拒絕 - 外資", () => {
  assert.ok(!validateDynamicKeyword({ keyword: "外資", searchType: "broad" }, mockTwBase));
});

test("與靜態池重複被拒絕（大小寫不敏感）- fed", () => {
  assert.ok(!validateDynamicKeyword({ keyword: "fed", searchType: "broad" }, mockUsBase));
});

test("太短（單字元）被拒絕", () => {
  assert.ok(!validateDynamicKeyword({ keyword: "a", searchType: "broad" }, mockTwBase));
});

test("超過 4 個語意單元被拒絕（中文）", () => {
  assert.ok(!validateDynamicKeyword(
    { keyword: "今日美股科技板塊整體走勢分析", searchType: "broad" }, mockUsBase
  ));
});

test("超過 4 個英文單字被拒絕", () => {
  assert.ok(!validateDynamicKeyword(
    { keyword: "US stock market news today", searchType: "broad" }, mockUsBase
  ));
});

test("null 輸入安全處理不拋出", () => {
  assert.ok(!validateDynamicKeyword(null, mockTwBase));
});

test("缺少 keyword 欄位安全處理不拋出", () => {
  assert.ok(!validateDynamicKeyword({ searchType: "broad" }, mockTwBase));
});

test("邊界值：2 個語意單元通過", () => {
  assert.ok(validateDynamicKeyword({ keyword: "外資 匯出", searchType: "broad" }, mockTwBase));
});

test("邊界值：4 個語意單元通過", () => {
  assert.ok(validateDynamicKeyword(
    { keyword: "Fed rate cut 2026", searchType: "broad" }, mockUsBase
  ));
});

test("含英文字母的中文複合詞通過（如 AI 晶片）", () => {
  assert.ok(validateDynamicKeyword(
    { keyword: "AI 晶片 需求", searchType: "broad" }, mockTwBase
  ));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. mergeKeywords
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n📋 [test-keywords] mergeKeywords\n");

test("合法動態關鍵字被加入，結果數量正確", () => {
  const dynamic = [
    { keyword: "台積電 法說會", searchType: "intitle" },
    { keyword: "外資 買超 半導體", searchType: "broad" },
  ];
  const result = mergeKeywords(mockTwBase, dynamic);
  assert.equal(result.length, mockTwBase.length + 2);
});

test("不合規動態關鍵字被過濾，只有合法項加入", () => {
  const dynamic = [
    { keyword: "ETF", searchType: "broad" },    // 單一縮寫
    { keyword: "台股", searchType: "intitle" },  // 靜態池重複
    { keyword: "台積電 法說", searchType: "intitle" },  // 合法
  ];
  const result = mergeKeywords(mockTwBase, dynamic);
  assert.equal(result.length, mockTwBase.length + 1);
});

test("靜態池順序保持在結果前段", () => {
  const dynamic = [{ keyword: "新台幣 急貶", searchType: "broad" }];
  const result = mergeKeywords(mockTwBase, dynamic);
  assert.equal(result[0].keyword, mockTwBase[0].keyword);
});

test("完全重複的動態關鍵字只出現一次", () => {
  const dynamic = [
    { keyword: "新台幣 急貶", searchType: "broad" },
    { keyword: "新台幣 急貶", searchType: "broad" },
  ];
  const result = mergeKeywords(mockTwBase, dynamic);
  const count = result.filter((r) => r.keyword === "新台幣 急貶").length;
  assert.equal(count, 1);
});

test("空動態陣列回傳與靜態池相同長度", () => {
  const result = mergeKeywords(mockTwBase, []);
  assert.equal(result.length, mockTwBase.length);
});

test("大小寫不同但語意相同的動態關鍵字去重", () => {
  const dynamic = [
    { keyword: "Federal Reserve rate hike", searchType: "broad" },
    { keyword: "federal reserve rate hike", searchType: "broad" },
  ];
  const result = mergeKeywords(mockUsBase, dynamic);
  const count = result.filter(
    (r) => r.keyword.toLowerCase() === "federal reserve rate hike"
  ).length;
  assert.equal(count, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. buildSingleKeywordQueryStr
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n📋 [test-keywords] buildSingleKeywordQueryStr\n");

test("intitle 關鍵字產生正確前綴", () => {
  const result = buildSingleKeywordQueryStr(
    { keyword: "台積電 法說會", searchType: "intitle" }, []
  );
  assert.ok(result.startsWith('intitle:"台積電 法說會"'), `實際：${result}`);
});

test("broad 關鍵字使用引號包裹", () => {
  const result = buildSingleKeywordQueryStr(
    { keyword: "外資 賣超", searchType: "broad" }, []
  );
  assert.ok(result.startsWith('"外資 賣超"'), `實際：${result}`);
});

test("包含 +when:1d 時間限制", () => {
  const result = buildSingleKeywordQueryStr(
    { keyword: "台積電 法說會", searchType: "intitle" }, []
  );
  assert.ok(result.includes("+when:1d"), `實際：${result}`);
});

test("排除關鍵字 intitle 加上 -intitle 前綴", () => {
  const result = buildSingleKeywordQueryStr(
    { keyword: "外資", searchType: "broad" },
    [{ keyword: "排行", searchType: "intitle" }]
  );
  assert.ok(result.includes('-intitle:"排行"'), `實際：${result}`);
});

test("排除關鍵字 broad 加上 - 前綴", () => {
  const result = buildSingleKeywordQueryStr(
    { keyword: "inflation", searchType: "broad" },
    [{ keyword: "price target", searchType: "broad" }]
  );
  assert.ok(result.includes('-"price target"'), `實際：${result}`);
});

test("多個排除關鍵字全部加入 query", () => {
  const result = buildSingleKeywordQueryStr(
    { keyword: "Federal Reserve", searchType: "broad" },
    mockTwExclude
  );
  assert.ok(result.includes('-intitle:"排行"'));
  assert.ok(result.includes('-intitle:"即時新聞"'));
});

test("無排除關鍵字時輸出格式精確", () => {
  const result = buildSingleKeywordQueryStr(
    { keyword: "Fed rate decision", searchType: "intitle" }, []
  );
  assert.equal(result, 'intitle:"Fed rate decision" +when:1d');
});

// ── 結果統計 ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`  結果：${passed} 通過 / ${failed} 失敗 / ${passed + failed} 總計`);
if (failed > 0) {
  console.error("  ⚠️  有測試失敗，請檢查 newsFetcher.mjs 中的函式實作");
  process.exit(1);
} else {
  console.log("  🎉 全部通過！");
}