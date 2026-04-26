/**
 * Optimizer 本地驗證測試腳本（不呼叫 AI，不需要 API Key）
 * 用法：node scripts/testOptimizer.mjs
 *
 * 涵蓋測試：
 *  T1  isValidRegex        — 合法 / 非法 regex
 *  T2  isOverbroad         — 廣泛 / 具體 pattern
 *  T3  toRegexLiteral      — 字串格式轉換
 *  T4  isDuplicate         — 對比實際 blacklist.json 重複偵測
 *  T5  passesGoldenTest    — 對比實際 goldenDataset.json 碰撞測試
 *  T6  validateAndPrepare  — 四關卡完整流程（含 Mock AI 輸出）
 *  T7  normalizeTitle      — 標題尾綴清洗
 *  T8  Full Dry Run        — 模擬完整 optimizer 流程（臨時目錄，不汙染正式資料）
 *  T9  rollbackOptimizer   — --dry-run 正常退出驗證
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const BLACKLIST_PATH = join(DATA_DIR, "config", "blacklist.json");
const GOLDEN_PATH = join(DATA_DIR, "config", "goldenDataset.json");
const HISTORY_PATH = join(DATA_DIR, "config", "optimizerHistory.json");
const TMP_DIR = join(DATA_DIR, "_test_tmp");

// ---- 前置檢查：必要檔案 ----
const REQUIRED = [BLACKLIST_PATH, GOLDEN_PATH];
for (const f of REQUIRED) {
  if (!existsSync(f)) {
    console.error(`\n❌ 找不到必要檔案：${f}`);
    console.error("   請確認 data/config/blacklist.json 與 data/config/goldenDataset.json 已就緒\n");
    process.exit(1);
  }
}

// ---- 載入 agent 純邏輯函式（不觸發 AI） ----
const {
  isValidRegex,
  isOverbroad,
  toRegexLiteral,
  isDuplicate,
  passesGoldenTest,
  validateAndPrepare,
} = await import("../src/modules/ai/ruleOptimizerAgent.mjs");

// ---- 測試框架 ----
let passed = 0;
let failed = 0;
const failLog = [];

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? " — " + detail : ""}`);
    failed++;
    failLog.push(name);
  }
}

// ---- 載入實際資料 ----
const blacklist = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
const golden    = JSON.parse(readFileSync(GOLDEN_PATH, "utf-8"));

// ============================================================
// T1：isValidRegex
// ============================================================
console.log("\n📋 T1：isValidRegex — 合法 / 非法 regex");
assert("合法：\\bBrexit\\b 搭配 flag i",         isValidRegex("\\bBrexit\\b", "i"));
assert("合法：ISM.*University",                    isValidRegex("ISM.*University", "i"));
assert("合法：中文字符集 [\\u4e00-\\u9fa5]{2,5}", isValidRegex("[\\u4e00-\\u9fa5]{2,5}", ""));
assert("合法：現有規則格式 Powell Industries",    isValidRegex("Powell Industries", "i"));
assert("非法：未閉合括號 [abc",                   !isValidRegex("[abc", ""));
assert("非法：無效 flag z",                        !isValidRegex("test", "z"));

// ============================================================
// T2：isOverbroad
// ============================================================
console.log("\n📋 T2：isOverbroad — 廣泛 / 具體 pattern");
assert("廣泛：.*",                      isOverbroad(".*"));
assert("廣泛：.+stock",                 isOverbroad(".+stock"));
assert("廣泛：\\w+",                    isOverbroad("\\w+"));
assert("廣泛：\\d+",                    isOverbroad("\\d+"));
assert("廣泛：.{0,10}買進",             isOverbroad(".{0,10}買進"));
assert("具體：\\bBrexit\\b 不觸發",     !isOverbroad("\\bBrexit\\b"));
assert("具體：最強.{0,5}概念股 不觸發", !isOverbroad("最強.{0,5}概念股"));
assert("具體：\\d+ stocks? to buy 不觸發", !isOverbroad("\\d+ stocks? to buy"));

// ============================================================
// T3：toRegexLiteral
// ============================================================
console.log("\n📋 T3：toRegexLiteral — 字串格式轉換");
assert("有 flag：Powell Industries → /Powell Industries/i",
  toRegexLiteral("Powell Industries", "i") === "/Powell Industries/i");
assert("無 flag：盤前分析 → /盤前分析/",
  toRegexLiteral("盤前分析", "") === "/盤前分析/");
assert("undefined flag 仍有結尾 /",
  toRegexLiteral("test", undefined) === "/test/");

// ============================================================
// T4：isDuplicate（對比實際 blacklist.json）
// ============================================================
console.log("\n📋 T4：isDuplicate — 對比實際 blacklist.json");

// 還原第一條現有規則的 pattern + flags
const firstRaw = blacklist.titleBlackListPatterns[0];
const m = firstRaw.match(/^\/(.+)\/([gimsuy]*)$/s);

if (m) {
  const [, p, f] = m;
  assert("現有規則應識別為重複",
    isDuplicate(p, f, blacklist.titleBlackListPatterns),
    `測試規則：${firstRaw}`);
}
assert("全新規則不應識別為重複",
  !isDuplicate("完全沒有的測試Pattern_XYZ_9999", "i", blacklist.titleBlackListPatterns));
assert("相同 pattern 不同 flag 不視為重複（除非 blacklist 也有無 flag 版本）",
  !isDuplicate("Powell Industries", "", blacklist.titleBlackListPatterns));

// ============================================================
// T5：passesGoldenTest（對比實際 goldenDataset.json）
// ============================================================
console.log("\n📋 T5：passesGoldenTest — 對比實際 goldenDataset.json");

assert("農場文規則不誤殺黃金清單",
  passesGoldenTest(new RegExp("最強.{0,5}(概念股|飆股).{0,10}(布局|卡位|搶先)"), golden));

assert("過廣規則（台積電）碰撞黃金清單應被擋",
  !passesGoldenTest(new RegExp("台積電", "i"), golden));

assert("精確農場規則 \\d+檔?必買 不誤殺黃金清單",
  passesGoldenTest(new RegExp("\\d+(檔|支).{0,5}(必買|必存|精選)股", "i"), golden));

assert("過廣規則（Fed）碰撞黃金清單應被擋",
  !passesGoldenTest(new RegExp("Fed", "i"), golden));

assert("精確英文農場文規則 stocks? to (buy|watch) 不誤殺黃金清單",
  passesGoldenTest(new RegExp("\\d+ stocks? to (buy|watch|own)(?! before)", "i"), golden));

// ============================================================
// T6：validateAndPrepare — 四關卡完整流程
// ============================================================
console.log("\n📋 T6：validateAndPrepare — 四關卡完整流程（Mock AI 輸出）");

const MOCK_RULES = [
  // ✅ 應通過：合法、具體、不重複、不殺黃金
  {
    pattern: "\\d+(檔|支).{0,5}(必買|必存|精選|推薦)股",
    flags: "i",
    reason: "個股推薦農場文特徵：數字+必買/必存/精選組合",
  },
  // ✅ 應通過：中文農場 SEO 特徵
  {
    pattern: "最強.{0,5}(概念股|飆股).{0,10}(布局|卡位|搶先)",
    flags: "",
    reason: "中文農場 SEO 特徵標題",
  },
  // ❌ 應拒絕：invalid_regex（未閉合括號）
  {
    pattern: "[abc",
    flags: "",
    reason: "非法 regex（測試用）",
  },
  // ❌ 應拒絕：overbroad（.* 開頭）
  {
    pattern: ".*股票推薦",
    flags: "i",
    reason: "過廣通配（測試用）",
  },
  // ❌ 應拒絕：golden_dataset_kill（會打到 TSMC）
  {
    pattern: "TSMC",
    flags: "i",
    reason: "過廣會誤殺黃金清單（測試用）",
  },
  // ❌ 應拒絕：duplicate（取自既有規則）
  ...(m ? [{ pattern: m[1], flags: m[2], reason: "重複規則測試" }] : []),
];

const { accepted, rejected } = validateAndPrepare(MOCK_RULES, blacklist, golden);

assert(`通過規則數應為 2，實際：${accepted.length}`,   accepted.length === 2);
assert(`拒絕規則數應 ≥ 3，實際：${rejected.length}`,  rejected.length >= 3);

const reasons = rejected.map((r) => r.rejectReason);
assert("應有 invalid_regex",       reasons.includes("invalid_regex"));
assert("應有 overbroad",           reasons.includes("overbroad"));
assert("應有 golden_dataset_kill", reasons.includes("golden_dataset_kill"));
if (m) {
  assert("應有 duplicate",         reasons.includes("duplicate"));
}

assert("通過規則有 regexLiteral 欄位且以 / 開頭",
  accepted.every((r) => typeof r.regexLiteral === "string" && r.regexLiteral.startsWith("/")));
assert("通過規則有非空 reason 欄位",
  accepted.every((r) => typeof r.reason === "string" && r.reason.length > 0));

// ============================================================
// T7：normalizeTitle（內嵌測試，不依賴 export）
// ============================================================
console.log("\n📋 T7：normalizeTitle — 標題尾綴清洗");

function normalizeTitle(title) {
  return title.replace(/\s*-\s*[^-]{2,40}$/, "").trim();
}

assert("移除英文來源尾綴",   normalizeTitle("Fed raises rates - Reuters") === "Fed raises rates");
assert("移除中文來源尾綴",   normalizeTitle("台積電法說 - 經濟日報") === "台積電法說");
assert("無尾綴保持原樣",     normalizeTitle("Fed raises rates by 25bps") === "Fed raises rates by 25bps");
assert("多個 - 只移除最後一段",
  normalizeTitle("S&P 500 up 1% - best day - Reuters").startsWith("S&P 500 up 1%"));

// ============================================================
// T8：Full Dry Run（臨時目錄，不汙染正式資料）
// ============================================================
console.log("\n📋 T8：Full Dry Run — 模擬完整 optimizer 流程");

// 建立臨時目錄
if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
mkdirSync(join(TMP_DIR, "config"),    { recursive: true });
mkdirSync(join(TMP_DIR, "news_logs"), { recursive: true });

const tmpBlacklist = join(TMP_DIR, "config", "blacklist.json");
const tmpGolden    = join(TMP_DIR, "config", "goldenDataset.json");
const tmpHistory   = join(TMP_DIR, "config", "optimizerHistory.json");

writeFileSync(tmpBlacklist, readFileSync(BLACKLIST_PATH, "utf-8"));
writeFileSync(tmpGolden,    readFileSync(GOLDEN_PATH, "utf-8"));
writeFileSync(tmpHistory,   JSON.stringify({ lastUpdated: "", history: [] }, null, 2));

// 建立 mock passedArticles（昨日）
const dateStr = new Date(Date.now() - 86400000)
  .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

const mockArticles = [
  { title: "最強飆股大公開！布局卡位搶先機 - 財經網", source: "財經網" },
  { title: "Fed raises interest rates - Reuters",       source: "Reuters" },
  { title: "10檔必買存股推薦，退休族最愛 - 理財周刊",  source: "理財周刊" },
  { title: "台股大盤收漲 1.2%，外資買超 - 工商時報",  source: "工商時報" },
  { title: "3 stocks to watch before earnings season",  source: "Motley Fool" },
];
writeFileSync(
  join(TMP_DIR, "news_logs", `passedArticles_TW_${dateStr}.json`),
  JSON.stringify({ _savedAt: new Date().toISOString(), region: "TW",
    count: mockArticles.length, articles: mockArticles.map((a) => ({ ...a, _region: "TW" })) }, null, 2)
);

// 用 Mock 規則執行驗證（不呼叫 AI）
const tmpBlacklistData = JSON.parse(readFileSync(tmpBlacklist, "utf-8"));
const tmpGoldenData    = JSON.parse(readFileSync(tmpGolden, "utf-8"));

const mockRules2 = [
  { pattern: "\\d+(檔|支).{0,10}(必買|必存|推薦)股", flags: "i", reason: "農場推薦文" },
  { pattern: "最強.{0,5}(飆股|概念股).{0,10}(大公開|搶先|卡位)", flags: "", reason: "農場 SEO 標題" },
];

const dryResult = validateAndPrepare(mockRules2, tmpBlacklistData, tmpGoldenData);
assert("Dry Run 有規則通過驗證", dryResult.accepted.length > 0);
assert("Dry Run 無黃金清單誤殺",
  dryResult.rejected.filter((r) => r.rejectReason === "golden_dataset_kill").length === 0);

// 寫入臨時 blacklist
const before = tmpBlacklistData.titleBlackListPatterns.length;
tmpBlacklistData.titleBlackListPatterns.push(...dryResult.accepted.map((r) => r.regexLiteral));
writeFileSync(tmpBlacklist, JSON.stringify(tmpBlacklistData, null, 2));
const after = JSON.parse(readFileSync(tmpBlacklist, "utf-8")).titleBlackListPatterns.length;

assert(`規則已 append 到臨時 blacklist（${before} → ${after}）`, after > before);

// 寫入 history
let tmpHistData = JSON.parse(readFileSync(tmpHistory, "utf-8"));
tmpHistData.history.push({
  date: dateStr, region: "TW",
  addedRules: dryResult.accepted, rejectedRules: dryResult.rejected,
  savedAt: new Date().toISOString(), rolledBack: false,
});
tmpHistData.lastUpdated = new Date().toISOString();
writeFileSync(tmpHistory, JSON.stringify(tmpHistData, null, 2));
tmpHistData = JSON.parse(readFileSync(tmpHistory, "utf-8"));

assert("history 有 1 筆紀錄",         tmpHistData.history.length === 1);
assert(`history.date 正確：${dateStr}`, tmpHistData.history[0].date === dateStr);
assert("history.rolledBack 預設 false", tmpHistData.history[0].rolledBack === false);

// 清理臨時目錄
rmSync(TMP_DIR, { recursive: true });
console.log("  🧹 臨時測試目錄已清理");

// ============================================================
// T9：rollbackOptimizer --dry-run
// ============================================================
console.log("\n📋 T9：rollbackOptimizer --dry-run — 正常退出驗證");

try {
  execSync(
    `node scripts/rollbackOptimizer.mjs --date 9999-12-31 --dry-run`,
    { cwd: ROOT, encoding: "utf-8", stdio: "pipe" }
  );
  assert("--dry-run 對不存在日期正常退出（exit 0）", true);
} catch (err) {
  // exit 0 = 正常（無可回滾），非 0 才是異常
  assert("rollback 腳本可正常執行", err.status === 0, `exit code: ${err.status}`);
}

// ============================================================
// 結果彙整
// ============================================================
console.log("\n" + "=".repeat(60));
console.log(`🏁 測試完成  ✅ 通過：${passed}  ❌ 失敗：${failed}`);
if (failLog.length > 0) {
  console.error("\n失敗項目：");
  failLog.forEach((f) => console.error(`  • ${f}`));
  console.log("=".repeat(60));
  process.exit(1);
}
console.log("=".repeat(60));
process.exit(0);
