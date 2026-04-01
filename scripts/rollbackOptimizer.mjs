/**
 * 緊急回滾工具
 * 用法：node scripts/rollbackOptimizer.mjs --date YYYY-MM-DD [--dry-run]
 * 效果：移除指定日期由 optimizer 寫入的規則，並更新 optimizerHistory.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const BLACKLIST_PATH = join(DATA_DIR, "config", "blacklist.json");
const HISTORY_PATH = join(DATA_DIR, "config", "optimizerHistory.json");

// ---- 參數解析 ----
const args = process.argv.slice(2);
const dateIdx = args.indexOf("--date");
const isDryRun = args.includes("--dry-run");

if (dateIdx === -1 || !args[dateIdx + 1]) {
  console.error("❌ 用法：node scripts/rollbackOptimizer.mjs --date YYYY-MM-DD [--dry-run]");
  process.exit(1);
}

const targetDate = args[dateIdx + 1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  console.error("❌ 日期格式錯誤，請使用 YYYY-MM-DD（例如：2026-04-02）");
  process.exit(1);
}

// ---- 讀取檔案 ----
if (!existsSync(BLACKLIST_PATH)) {
  console.error(`❌ 找不到 blacklist.json：${BLACKLIST_PATH}`);
  process.exit(1);
}
if (!existsSync(HISTORY_PATH)) {
  console.error(`❌ 找不到 optimizerHistory.json：${HISTORY_PATH}`);
  process.exit(1);
}

const blacklist = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
const history = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));

// ---- 找出目標日期的未回滾紀錄 ----
const records = history.history.filter(
  (r) => r.date === targetDate && !r.rolledBack
);

if (records.length === 0) {
  console.log(`ℹ️  ${targetDate} 無可回滾的規則（已回滾或當日無寫入）`);
  process.exit(0);
}

// ---- 收集要移除的規則 ----
const toRemove = new Set(
  records.flatMap((r) => r.addedRules.map((x) => x.regexLiteral))
);

if (toRemove.size === 0) {
  console.log(`ℹ️  ${targetDate} 無規則被寫入（accepted 均為 0），無需回滾`);
  process.exit(0);
}

console.log(`\n📋 即將移除以下 ${toRemove.size} 條規則（日期：${targetDate}）：`);
let i = 1;
toRemove.forEach((r) => console.log(`  [${i++}] ${r}`));

if (isDryRun) {
  console.log("\n🔍 [Dry Run] 模擬模式，不實際寫入任何檔案");
  process.exit(0);
}

// ---- 執行移除 ----
const before = blacklist.titleBlackListPatterns.length;
blacklist.titleBlackListPatterns = blacklist.titleBlackListPatterns.filter(
  (pattern) => !toRemove.has(pattern)
);
const removed = before - blacklist.titleBlackListPatterns.length;

// ---- 標記 history 為已回滾 ----
const rolledBackAt = new Date().toISOString();
history.history = history.history.map((r) =>
  r.date === targetDate && !r.rolledBack
    ? { ...r, rolledBack: true, rolledBackAt }
    : r
);
history.lastUpdated = rolledBackAt;

// ---- 寫入 ----
writeFileSync(BLACKLIST_PATH, JSON.stringify(blacklist, null, 2), "utf-8");
writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");

console.log(`\n✅ 回滾完成`);
console.log(`   移除規則數：${removed}`);
console.log(`   blacklist.json 目前規則總數：${blacklist.titleBlackListPatterns.length}`);
console.log(`   操作時間：${rolledBackAt}`);
