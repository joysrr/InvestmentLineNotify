/**
 * test-keywordConfig.mjs
 * 驗證：
 *   1. loadBlacklist() 能正確讀取並解析 blacklist.json
 *   2. 帶旗標 "/pattern/flags" 格式的 regex 正確解析
 *   3. 無旗標字串格式自動補 /i
 *   4. 所有 titleBlackListPatterns 是有效的 RegExp 實例
 *   5. twExcludedSources / usExcludedSources 是非空陣列
 *
 * 執行方式：node test-keywordConfig.mjs
 */

import assert from "assert/strict";
import { loadBlacklist } from "../modules/keywordConfig.mjs"; // ← 路徑請自行確認

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     → ${err.message}`);
    failed++;
  }
}

// 獨立測試 parseRegexString 邏輯（不需 export，複製一份）
function parseRegexString(str) {
  const m = str.match(/^\/(.+)\/([gimsuy]*)$/s);
  if (m) return new RegExp(m[1], m[2]);
  return new RegExp(str, "i");
}

console.log("\n📋 [test-keywordConfig] blacklist.json 解析驗證\n");

await test("帶旗標格式 /pattern/i 解析正確", () => {
  const re = parseRegexString("/Powell Industries/i");
  assert.ok(re instanceof RegExp);
  assert.equal(re.flags, "i");
  assert.ok(re.test("Powell Industries Inc."));
  assert.ok(!re.test("John Doe"));
});

await test("帶多旗標 /pattern/gi 解析正確", () => {
  const re = parseRegexString("/FTSE 100/gi");
  assert.ok(re.flags.includes("g") && re.flags.includes("i"));
});

await test("不帶旗標字串自動補 /i", () => {
  const re = parseRegexString("Powell Industries");
  assert.equal(re.flags, "i");
  assert.ok(re.test("POWELL INDUSTRIES"));
});

await test("含 \\b 與 | 的 regex 解析不拋出錯誤", () => {
  const re = parseRegexString("/\\b(RBA|Reserve Bank of Australia)\\b/i");
  assert.ok(re instanceof RegExp);
  assert.ok(re.test("RBA raises rates"));
  assert.ok(!re.test("Federal Reserve"));
});

await test("含中文的 regex 解析正確", () => {
  const re = parseRegexString("/盤[前中後]分析/");
  assert.ok(re.test("盤前分析"));
  assert.ok(re.test("盤中分析"));
  assert.ok(!re.test("盤面觀察"));
});

await test("loadBlacklist() 回傳物件結構正確", async () => {
  const bl = await loadBlacklist();
  assert.ok(bl);
  assert.ok(Array.isArray(bl.twExcludedSources));
  assert.ok(Array.isArray(bl.usExcludedSources));
  assert.ok(Array.isArray(bl.titleBlackListPatterns));
});

await test("twExcludedSources 非空且全部為字串", async () => {
  const bl = await loadBlacklist();
  assert.ok(bl.twExcludedSources.length > 0);
  bl.twExcludedSources.forEach((src, i) =>
    assert.equal(typeof src, "string", `第 ${i} 項應為字串`)
  );
});

await test("usExcludedSources 包含已知黑名單項目", async () => {
  const bl = await loadBlacklist();
  assert.ok(bl.usExcludedSources.includes("Stock Traders Daily"));
  assert.ok(bl.usExcludedSources.includes("facebook.com"));
});

await test("titleBlackListPatterns 全部是 RegExp 實例", async () => {
  const bl = await loadBlacklist();
  assert.ok(bl.titleBlackListPatterns.length > 0);
  bl.titleBlackListPatterns.forEach((re, i) =>
    assert.ok(re instanceof RegExp, `第 ${i} 項應為 RegExp，實際為 ${typeof re}`)
  );
});

await test("titleBlackListPatterns 匹配壞標題、放行好標題", async () => {
  const bl = await loadBlacklist();
  const match = (title) => bl.titleBlackListPatterns.some((re) => re.test(title));

  // 應攔截
  assert.ok(match("Powell Industries Q3 Results"), "應攔截 Powell Industries");
  assert.ok(match("FTSE 100 closes higher"), "應攔截 FTSE 100");
  assert.ok(match("India GDP growth forecast 2026"), "應攔截 India GDP");
  assert.ok(match("盤前分析：外資回流"), "應攔截盤前分析");

  // 不應誤殺
  assert.ok(!match("Federal Reserve rate decision"), "不應誤殺 Fed 新聞");
  assert.ok(!match("台積電法說會釋利多"), "不應誤殺台積電新聞");
});

await test("titleBlackListPatterns 數量 >= 20 條", async () => {
  const bl = await loadBlacklist();
  assert.ok(
    bl.titleBlackListPatterns.length >= 20,
    `應有至少 20 條，實際 ${bl.titleBlackListPatterns.length} 條`
  );
});

console.log(`\n${"─".repeat(50)}`);
console.log(`  結果：${passed} 通過 / ${failed} 失敗 / ${passed + failed} 總計`);
if (failed > 0) {
  console.error("  ⚠️  有測試失敗，請檢查 blacklist.json 與 keywordConfig.mjs");
  process.exit(1);
} else {
  console.log("  🎉 全部通過！");
}