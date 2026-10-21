/**
 * verify-leading-indicators.mjs
 *
 * 四大雷達資料來源即時驗證腳本。
 * 直接呼叫各 provider，不依賴 /daily 是否執行完畢。
 *
 * 用法：
 *   node scripts/verify-leading-indicators.mjs
 *   node scripts/verify-leading-indicators.mjs --date 2026-10-21
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import process from "process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// --- resolve imports relative to project root ---
const { fetchUsMarketData } = await import(
  `${rootDir}/src/modules/providers/usMarketProvider.mjs`
);
const { fetchTaifexNightSession, fetchTaifexSmallTxRetailSentiment } =
  await import(`${rootDir}/src/modules/providers/taifexProvider.mjs`);
const { fetchTaiexHistoryWithAutoFillDetailed } = await import(
  `${rootDir}/src/modules/providers/historyProvider.mjs`
);
const { calcMA60, calcBias } = await import(
  `${rootDir}/src/modules/strategy/indicators.mjs`
);

// --- helpers ---
const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

function check(label, value, condition, expected = "") {
  const ok = condition(value);
  const tag = ok ? PASS : FAIL;
  const display =
    value === null || value === undefined
      ? "null"
      : typeof value === "number"
        ? value.toFixed(4)
        : String(value);
  const hint = expected ? ` (期望: ${expected})` : "";
  console.log(`  ${tag} ${label}: ${display}${hint}`);
  return ok;
}

function section(title) {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(55));
}

// --- parse CLI date ---
const dateArg = (() => {
  const args = process.argv.slice(2); // 跳過 node + script path
  const eqArg = args.find((a) => a.startsWith("--date="));
  if (eqArg) return eqArg.split("=")[1];
  const idx = args.indexOf("--date");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
})();
const today = dateArg ?? new Date().toISOString().slice(0, 10);

console.log(`\n🔍 四大雷達資料驗證 — ${today}`);

let totalPass = 0;
let totalFail = 0;
const issues = [];

function record(label, ok) {
  if (ok) totalPass++;
  else {
    totalFail++;
    issues.push(label);
  }
}

// ══════════════════════════════════════════════════
// Radar 1/2: SOX + TSM + VIX (usMarketProvider)
// ══════════════════════════════════════════════════
section("Radar 1/2 — SOX / TSM / VIX / SPX");
try {
  const data = await fetchUsMarketData();
  const sox = data?.raw?.sox?.changePercent;
  const tsm = data?.raw?.tsm?.changePercent;
  const vix = data?.raw?.vix?.value ?? null;
  const spx = data?.raw?.spx?.value ?? null;

  record(
    "SOX 日變化%",
    check("SOX 日變化%", sox, (v) => v !== null && v !== undefined, "非 null"),
  );
  record(
    "TSM 日變化%",
    check("TSM 日變化%", tsm, (v) => v !== null && v !== undefined, "非 null"),
  );

  // VIX/SPX 週末/非美股時段可能 N/A，標記 WARN 而非 FAIL
  const vixOk = vix !== null && Number.isFinite(vix);
  console.log(
    `  ${vixOk ? PASS : WARN} VIX: ${vix ?? "N/A"} (FRED 非美股時段可能無資料)`,
  );
  const spxOk = spx !== null && Number.isFinite(spx);
  console.log(
    `  ${spxOk ? PASS : WARN} SPX: ${spx ?? "N/A"} (FRED 非美股時段可能無資料)`,
  );

  if (sox !== null && sox !== undefined) {
    console.log(`  ℹ️  SOX date: ${data?.raw?.sox?.latest?.date}`);
  }
  if (tsm !== null && tsm !== undefined) {
    console.log(`  ℹ️  TSM date: ${data?.raw?.tsm?.latest?.date}`);
  }
} catch (e) {
  console.log(`  ${FAIL} fetchUsMarketData ERROR: ${e.message}`);
  record("usMarketData", false);
}

// ══════════════════════════════════════════════════
// Radar 3: TAIEX bias60
// ══════════════════════════════════════════════════
section("Radar 3 — TAIEX 60日乖離率 (bias60)");
try {
  const result = await fetchTaiexHistoryWithAutoFillDetailed(today, 60, {
    maxDays: 120,
    retryAttempts: 0,
    retryDelayMs: 0,
  });

  record(
    "history status=available",
    check("status", result.status, (v) => v === "available", "available"),
  );
  record(
    "count >= 60",
    check("count", result.data.length, (v) => v >= 60, ">= 60"),
  );
  record(
    "failedDates = 0",
    check("failedDates", result.failedDates.length, (v) => v === 0, "0"),
  );

  if (result.data.length >= 60) {
    const closes = result.data.map((d) => d.close);
    const ma60Arr = calcMA60(closes);
    const ma60 = ma60Arr.at(-1);
    const bias60 = calcBias(closes.at(-1), ma60);

    console.log(
      `  ℹ️  日期範圍: ${result.data[0].date} → ${result.data.at(-1).date}`,
    );
    console.log(`  ℹ️  最新收盤: ${closes.at(-1).toLocaleString()}`);
    console.log(`  ℹ️  MA60:     ${ma60?.toFixed(2)}`);

    record(
      "bias60 is finite",
      check("bias60", bias60, (v) => Number.isFinite(v), "有限數值"),
    );
    if (Number.isFinite(bias60)) {
      console.log(`  ℹ️  bias60:   ${(bias60 * 100).toFixed(4)}%`);
      const isOversold = bias60 <= -0.12;
      console.log(`  ℹ️  isBiasOversold: ${isOversold} (threshold: -12%)`);
    }
  }

  if (result.failedDates.length > 0) {
    console.log(
      `  ⚠️  failedDates (HTTP 非 2xx): ${result.failedDates.slice(0, 5).join(", ")}${result.failedDates.length > 5 ? "..." : ""}`,
    );
  }
} catch (e) {
  console.log(
    `  ${FAIL} fetchTaiexHistoryWithAutoFillDetailed ERROR: ${e.message}`,
  );
  record("taiexHistory", false);
}

// ══════════════════════════════════════════════════
// Radar 3/4: TAIFEX 夜盤
// ══════════════════════════════════════════════════
section("Radar 3/4 — TAIFEX 小台夜盤");
try {
  const night = await fetchTaifexNightSession();

  record(
    "dataStatus=VERIFIED",
    check("dataStatus", night?.dataStatus, (v) => v === "VERIFIED", "VERIFIED"),
  );
  record(
    "daySessionClose 有值",
    check(
      "daySessionClose",
      night?.daySessionClose,
      (v) => Number.isFinite(v) && v > 0,
      "> 0",
    ),
  );
  record(
    "nightClose 有值",
    check(
      "nightClose",
      night?.close,
      (v) => Number.isFinite(v) && v > 0,
      "> 0",
    ),
  );

  if (night?.dayToNightChangePct !== undefined) {
    console.log(
      `  ℹ️  日盤收盤: ${night.daySessionClose?.toLocaleString()}  夜盤收盤: ${night.close?.toLocaleString()}  日夜變化: ${(night.dayToNightChangePct * 100).toFixed(3)}%`,
    );
  }
} catch (e) {
  console.log(`  ${FAIL} fetchTaifexNightSession ERROR: ${e.message}`);
  record("taifexNight", false);
}

// ══════════════════════════════════════════════════
// Radar 4: 非三大法人淨部位比率 (RSR)
// ══════════════════════════════════════════════════
section("Radar 4 — 非三大法人淨部位比率 (RSR)");
try {
  const sentiment = await fetchTaifexSmallTxRetailSentiment();

  record(
    "dataStatus=VERIFIED",
    check(
      "dataStatus",
      sentiment?.dataStatus,
      (v) => v === "VERIFIED",
      "VERIFIED",
    ),
  );
  record(
    "totalOi > 0",
    check(
      "totalOi",
      sentiment?.totalOi,
      (v) => Number.isFinite(v) && v > 0,
      "> 0",
    ),
  );
  record(
    "rsr 在合理範圍",
    check(
      "rsr",
      sentiment?.rsr,
      (v) => Number.isFinite(v) && v >= 0 && v <= 100,
      "0–100",
    ),
  );

  if (sentiment?.rsr !== undefined) {
    console.log(
      `  ℹ️  totalOi: ${sentiment.totalOi?.toLocaleString()}  institutionalNet: ${sentiment.institutionalNetOi?.toLocaleString()}  RSR: ${sentiment.rsr?.toFixed(2)}%`,
    );
    const isHighRetailShort = sentiment.rsr >= 30;
    console.log(`  ℹ️  散戶大量做空 (RSR>=30%): ${isHighRetailShort}`);
  }
} catch (e) {
  console.log(
    `  ${FAIL} fetchTaifexSmallTxRetailSentiment ERROR: ${e.message}`,
  );
  record("retailSentiment", false);
}

// ══════════════════════════════════════════════════
// 總結
// ══════════════════════════════════════════════════
console.log(`\n${"═".repeat(55)}`);
console.log(`  驗證結果：${totalPass} 通過 / ${totalFail} 失敗`);
if (issues.length > 0) {
  console.log(`  失敗項目：${issues.join(", ")}`);
}
console.log("═".repeat(55));
process.exit(totalFail > 0 ? 1 : 0);
