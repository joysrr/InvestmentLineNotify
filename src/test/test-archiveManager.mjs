/**
 * test-archiveManager.mjs
 * 驗證：
 *   1. saveNewsLog() 建立檔案並寫入正確格式
 *   2. 同日再次呼叫覆寫（冪等性）
 *   3. cleanOldArchives() 刪除超齡檔案
 *   4. 未超齡的今日檔案不被清理
 *
 * 執行方式：node test-archiveManager.mjs
 * 注意：測試完成後自動清理暫存檔。
 */

import assert from "assert/strict";
import fs from "fs/promises";
import path from "path";
import { archiveManager } from "../modules/data/archiveManager.mjs"; // ← 路徑請自行確認

let passed = 0;
let failed = 0;
const cleanupPaths = [];

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

function getTwDateStr() {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })
    .replace(/\//g, "-");
}

function getNewsLogPath(region) {
  return path.join(
    process.cwd(), "data", "news_logs",
    `passedArticles_${region}_${getTwDateStr()}.json`
  );
}

// ── 假資料 ────────────────────────────────────────────────────────────────────

const mockArticlesTW = [
  {
    title: "台積電外資買超創新高，法說會前籌碼全面回穩",
    link: "https://example.com/news/1",
    pubDate: new Date().toISOString(),
    source: "工商時報",
    _region: "TW",
    _keyword: "台積電 法說會",
  },
  {
    title: "外資連三日買超台股，三大法人合計買超 120 億",
    link: "https://example.com/news/2",
    pubDate: new Date().toISOString(),
    source: "經濟日報",
    _region: "TW",
    _keyword: "外資",
  },
];

const mockArticlesUS = [
  {
    title: "Fed holds rates steady, signals two cuts in 2026",
    link: "https://example.com/news/3",
    pubDate: new Date().toISOString(),
    source: "Reuters",
    _region: "US",
    _keyword: "Fed rate decision",
  },
];

// ── 測試案例 ──────────────────────────────────────────────────────────────────

console.log("\n📋 [test-archiveManager] saveNewsLog & cleanOldArchives\n");

await test("saveNewsLog(TW) 成功建立 JSON 檔案", async () => {
  await archiveManager.saveNewsLog(mockArticlesTW, "TW", {
    usedKeywords: ["台積電 法說會", "外資"],
    fallbackTriggered: false,
  });
  cleanupPaths.push(getNewsLogPath("TW"));
  const stat = await fs.stat(getNewsLogPath("TW"));
  assert.ok(stat.isFile());
});

await test("saveNewsLog(TW) 檔案內容格式正確", async () => {
  const content = JSON.parse(await fs.readFile(getNewsLogPath("TW"), "utf-8"));
  assert.equal(content.region, "TW");
  assert.equal(content.count, mockArticlesTW.length);
  assert.ok(Array.isArray(content.articles));
  assert.ok(typeof content._savedAt === "string");
  assert.ok(Array.isArray(content.usedKeywords));
  assert.equal(content.fallbackTriggered, false);
});

await test("saveNewsLog(US) 成功建立 US 專屬檔案", async () => {
  await archiveManager.saveNewsLog(mockArticlesUS, "US", {
    usedKeywords: ["Fed rate decision"],
    fallbackTriggered: false,
  });
  cleanupPaths.push(getNewsLogPath("US"));
  const stat = await fs.stat(getNewsLogPath("US"));
  assert.ok(stat.isFile());
});

await test("saveNewsLog 同日再次呼叫覆寫（冪等性）", async () => {
  await archiveManager.saveNewsLog([mockArticlesTW[0]], "TW", {
    usedKeywords: ["台積電 法說會"],
    fallbackTriggered: false,
  });
  const content = JSON.parse(await fs.readFile(getNewsLogPath("TW"), "utf-8"));
  assert.equal(content.count, 1);
  assert.equal(content.articles.length, 1);
});

await test("saveNewsLog fallbackTriggered=true 正確記錄", async () => {
  await archiveManager.saveNewsLog(mockArticlesTW, "TW", {
    usedKeywords: ["台積電 法說會"],
    fallbackTriggered: true,
  });
  const content = JSON.parse(await fs.readFile(getNewsLogPath("TW"), "utf-8"));
  assert.equal(content.fallbackTriggered, true);
});

await test("cleanOldArchives 刪除 >30 天的舊檔案", async () => {
  const dir = path.join(process.cwd(), "data", "news_logs");
  await fs.mkdir(dir, { recursive: true });

  const oldFilePath = path.join(dir, "passedArticles_TW_2026-01-01.json");
  await fs.writeFile(oldFilePath, JSON.stringify({ _test: true }));

  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  await fs.utimes(oldFilePath, fortyDaysAgo, fortyDaysAgo);

  await archiveManager.cleanOldArchives(30);

  let exists = true;
  try { await fs.stat(oldFilePath); } catch { exists = false; }
  assert.ok(!exists, "40 天前的舊檔案應被刪除");
});

await test("cleanOldArchives 保留今日檔案不誤刪", async () => {
  await archiveManager.cleanOldArchives(30);
  const stat = await fs.stat(getNewsLogPath("TW"));
  assert.ok(stat.isFile());
});

// ── 清理暫存檔 ────────────────────────────────────────────────────────────────

console.log("\n  🧹 清理測試產生的暫存檔...");
for (const p of cleanupPaths) {
  try {
    await fs.unlink(p);
    console.log(`     已刪除：${path.basename(p)}`);
  } catch { /* 已被清理，略過 */ }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`  結果：${passed} 通過 / ${failed} 失敗 / ${passed + failed} 總計`);
if (failed > 0) {
  console.error("  ⚠️  有測試失敗，請檢查 archiveManager.mjs");
  process.exit(1);
} else {
  console.log("  🎉 全部通過！");
}