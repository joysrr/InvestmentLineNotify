/**
 * verify-report.mjs
 *
 * 驗證 data/reports/YYYY-MM-DD.json 的落地正確性。
 * 在正式 VM 跑完 /daily 後執行，確認所有雷達數值已正確寫入。
 *
 * 用法：
 *   node scripts/verify-report.mjs
 *   node scripts/verify-report.mjs --date 2026-10-21
 */

import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import process from "process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// --- parse date ---
const dateArg = (() => {
  const args = process.argv.slice(2);
  const eqArg = args.find((a) => a.startsWith("--date="));
  if (eqArg) return eqArg.split("=")[1];
  const idx = args.indexOf("--date");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
})();
const today = dateArg ?? new Date().toISOString().slice(0, 10);
const reportPath = resolve(rootDir, `data/reports/${today}.json`);

// --- helpers ---
const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

let totalPass = 0;
let totalFail = 0;
const issues = [];

function check(label, value, condition, expected = "") {
  const ok = condition(value);
  const tag = ok ? PASS : FAIL;
  const display =
    value === null || value === undefined
      ? "null"
      : typeof value === "number"
        ? isNaN(value)
          ? "NaN"
          : value
        : String(value);
  const hint = expected ? ` (期望: ${expected})` : "";
  console.log(`  ${tag} ${label}: ${display}${hint}`);
  if (ok) totalPass++;
  else {
    totalFail++;
    issues.push(label);
  }
  return ok;
}

function warn(label, value, msg) {
  const display =
    value === null || value === undefined ? "null" : String(value);
  console.log(`  ${WARN} ${label}: ${display} — ${msg}`);
}

function section(title) {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(55));
}

// --- load report ---
console.log(`\n📋 Report 落地驗證 — ${today}`);
console.log(`   路徑：${reportPath}`);

if (!fs.existsSync(reportPath)) {
  console.log(`\n${FAIL} 找不到 report 檔案：${reportPath}`);
  console.log("   請確認 /daily 已執行完畢，或使用 --date 指定日期");
  process.exit(1);
}

const stat = fs.statSync(reportPath);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
console.log(
  `   檔案大小：${(stat.size / 1024).toFixed(1)} KB  最後修改：${stat.mtime.toISOString()}`,
);

// ══════════════════════════════════════════════════
// 基礎欄位
// ══════════════════════════════════════════════════
section("基礎欄位");
check("date", report.date, (v) => v === today, today);
check(
  "price0050 > 0",
  report.price0050,
  (v) => typeof v === "number" && v > 0,
  "> 0",
);

// ══════════════════════════════════════════════════
// leadingIndicators 存在
// ══════════════════════════════════════════════════
section("leadingIndicators 區塊");
const li = report.leadingIndicators;
if (!li) {
  console.log(`  ${FAIL} leadingIndicators 不存在（VM 可能執行舊版程式碼）`);
  totalFail++;
  issues.push("leadingIndicators missing");
} else {
  check(
    "stateMachine.state 存在",
    li?.stateMachine?.state,
    (v) => typeof v === "string" && v.length > 0,
    "string",
  );

  // ── Radar 1/2: extremeFear ──────────────────────
  section("  Radar 1/2 — extremeFear (SOX/TSM/VIX)");
  const ef = li?.radars?.extremeFear?.metrics;
  check(
    "soxChg 非 null",
    ef?.soxChg,
    (v) => v !== null && v !== undefined,
    "非 null",
  );
  check(
    "tsmChg 非 null",
    ef?.tsmChg,
    (v) => v !== null && v !== undefined,
    "非 null",
  );
  // VIX 可能 N/A（非美股時段），不強制失敗
  if (ef?.vix === null || ef?.vix === "N/A") {
    warn("vix", ef?.vix, "FRED 非美股時段可能無資料（可接受）");
  } else {
    check(
      "vix > 0",
      ef?.vix,
      (v) => Number.isFinite(Number(v)) && Number(v) > 0,
      "> 0",
    );
  }

  // ── Radar 3: extremePanic ───────────────────────
  section("  Radar 3 — extremePanic (bias60)");
  const ep = li?.radars?.extremePanic?.metrics;
  check(
    "bias60 非 null",
    ep?.bias60,
    (v) => v !== null && v !== undefined,
    "非 null",
  );
  check("bias60 非 0（疑似舊版遺留）", ep?.bias60, (v) => v !== 0, "!= 0");
  check(
    "bias60DataStatus",
    ep?.bias60DataStatus,
    (v) =>
      ["VERIFIED", "INSUFFICIENT_HISTORY", "SOURCE_UNAVAILABLE"].includes(v),
    "VERIFIED | INSUFFICIENT_HISTORY | SOURCE_UNAVAILABLE",
  );
  if (ep?.bias60 !== null && ep?.bias60 !== undefined) {
    console.log(
      `  ℹ️  bias60: ${(ep.bias60 * 100).toFixed(4)}%  isBiasOversold: ${ep?.isBiasOversold}`,
    );
  }

  // ── Radar 4: retailSentiment ────────────────────
  section("  Radar 4 — retailSentiment (RSR)");
  const rs = li?.radars?.retailSentiment?.metrics;
  check(
    "rsr 非 null",
    rs?.rsr,
    (v) => v !== null && v !== undefined,
    "非 null",
  );
  check("rsr 非 0（疑似舊版遺留）", rs?.rsr, (v) => v !== 0, "!= 0");
  check(
    "rsr 在合理範圍",
    rs?.rsr,
    (v) => typeof v === "number" && v >= 0 && v <= 100,
    "0–100",
  );
  check(
    "dataStatus",
    rs?.dataStatus,
    (v) => ["VERIFIED", "UNAVAILABLE"].includes(v),
    "VERIFIED | UNAVAILABLE",
  );
  if (rs?.rsr !== null && rs?.rsr !== undefined) {
    console.log(
      `  ℹ️  RSR: ${rs.rsr?.toFixed(2)}%  dataStatus: ${rs.dataStatus}`,
    );
  }

  // ── taiexHistory / indicatorsTaiex ─────────────
  section("  indicatorsTaiex（計算中繼資料）");
  const it = li?.indicatorsTaiex;
  if (!it) {
    warn("indicatorsTaiex", null, "欄位不存在（舊 report 或當日資料不足）");
  } else {
    check("closes 有資料", it?.closes?.length, (v) => v >= 60, ">= 60");
    check("ma60 有值", it?.ma60, (v) => Number.isFinite(v) && v > 0, "> 0");
    check("bias60 匹配", it?.bias60, (v) => Number.isFinite(v), "finite");
  }
}

// ══════════════════════════════════════════════════
// 總結
// ══════════════════════════════════════════════════
console.log(`\n${"═".repeat(55)}`);
console.log(`  驗證結果：${totalPass} 通過 / ${totalFail} 失敗`);
if (issues.length > 0) {
  console.log(`  失敗項目：`);
  for (const i of issues) console.log(`    • ${i}`);
  console.log(`\n  建議：查看 logs/daily.log 中的邊界日誌`);
  console.log(`    🔍 [LeadingIndicators] Evaluator input`);
  console.log(`    📁 [LeadingIndicators] Report persisted`);
}
console.log("═".repeat(55));
process.exit(totalFail > 0 ? 1 : 0);
