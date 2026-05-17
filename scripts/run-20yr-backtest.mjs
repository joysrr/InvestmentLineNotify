/**
 * scripts/run-20yr-backtest.mjs
 *
 * 17 年完整回測（2009~2026）
 *
 * ══════════════════════════════════════════════════════════════
 * 資金架構（對齊生產設計）
 * ──────────────────────────────────────────────────────────────
 *   起始資金    ：0（從零開始，全靠每月 DCA 累積）
 *   每月 DCA    ：30,000 元買入 0050（底倉，永不賣出）
 *   槓桿來源    ：質押 0050 底倉（折數 60%）→ 借款買 00675L
 *   加碼金額    ：剩餘可借額度 × scalingRatio（tier1=40%/tier2=70%/tier3=100%）
 *   賣出條件    ：訊號 short 或 VIX CRISIS → 全數出清 00675L 並還款
 *
 * 對比：
 *   A）策略 v2.8（buyTactical=4.0, bullish=1.5）
 *   B）原廠保守版（buyTactical=6.0，無牛市放寬）
 *   C）純 0050 DCA 基準（每月 3 萬，不做槓桿）
 * ══════════════════════════════════════════════════════════════
 */

import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const TIMELINE_FILE = path.join(PROJECT_ROOT, "data/backtest/timeline.json");

// ─── 工具：最大回撤 ──────────────────────────────────────────────
function calcMDD(netAssets) {
  let peak = -Infinity,
    mdd = 0;
  for (const v of netAssets) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > mdd) mdd = dd;
  }
  return mdd;
}

// ─── 工具：年度報酬 ──────────────────────────────────────────────
function calcAnnualReturns(results) {
  const byYear = {};
  for (const r of results) {
    const yr = r.date.slice(0, 4);
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(r.netAsset);
  }
  const annual = {};
  let prevEnd = null;
  for (const [yr, vals] of Object.entries(byYear).sort()) {
    const yearEnd = vals.at(-1);
    if (prevEnd !== null)
      annual[yr] = (((yearEnd - prevEnd) / prevEnd) * 100).toFixed(2);
    prevEnd = yearEnd;
  }
  return annual;
}

// ─── 純 0050 DCA 基準（每月 3 萬，不做槓桿） ─────────────────────
async function run0050DCA(timeline, monthlyDca) {
  let cash = 0,
    qty0050 = 0,
    lastMonth = -1;
  const feeRate = 0.0001425 * 0.28;
  const results = [];

  for (let i = 60; i < timeline.length; i++) {
    const { date, price0050 } = timeline[i];
    const month = new Date(date).getMonth();

    if (month !== lastMonth) {
      cash += monthlyDca;
      const shares = Math.floor(cash / (price0050 * (1 + feeRate)));
      if (shares > 0) {
        qty0050 += shares;
        cash -= shares * price0050 * (1 + feeRate);
      }
      lastMonth = month;
    }

    results.push({ date, netAsset: cash + qty0050 * price0050, qty0050, cash });
  }
  return results;
}

// ─── 統計分析 ─────────────────────────────────────────────────────
function analyze(results, totalInvested, years, label) {
  const netAssets = results.map((r) => r.netAsset);
  const finalNav = netAssets.at(-1);
  // 年化報酬以「累計投入成本」為分母（更真實）
  const annualPct =
    (Math.pow(finalNav / Math.max(1, totalInvested), 1 / years) - 1) * 100;
  const mdd = calcMDD(netAssets) * 100;
  const annualRets = calcAnnualReturns(results);

  const dailyRets = [];
  for (let i = 1; i < netAssets.length; i++)
    dailyRets.push((netAssets[i] - netAssets[i - 1]) / netAssets[i - 1]);
  const mean = dailyRets.reduce((a, b) => a + b, 0) / dailyRets.length;
  const variance =
    dailyRets.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyRets.length;
  const annualStd = Math.sqrt(variance) * Math.sqrt(252);
  const sharpe = annualStd > 0 ? (annualPct / 100 - 0.015) / annualStd : 0;

  return { label, finalNav, totalInvested, annualPct, mdd, annualRets, sharpe };
}

// ─── 主程式 ──────────────────────────────────────────────────────
async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  📊 InvestmentLineNotify — 17 年長期回測");
  console.log("  資金架構：每月 DCA 3 萬買 0050，質押 60% 借款操作 00675L");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const raw = JSON.parse(await fs.readFile(TIMELINE_FILE, "utf-8"));
  const startDate = raw[60]?.date;
  const endDate = raw.at(-1)?.date;
  const years = (new Date(endDate) - new Date(startDate)) / (365.25 * 86400000);
  const months = Math.ceil(years * 12);
  const MONTHLY = 30000;
  const totalInvested = months * MONTHLY; // 累計投入（不含利息）

  console.log(
    `\n  資料範圍：${startDate} → ${endDate}（${years.toFixed(1)} 年，約 ${months} 個月）`,
  );
  console.log(
    `  累計投入：NT$ ${totalInvested.toLocaleString()}（每月 ${MONTHLY.toLocaleString()} × ${months} 個月）\n`,
  );

  // ── 共用設定 ────────────────────────────────────────────────
  const BASE = {
    initialCash: 0,
    monthlyDca: MONTHLY,
    pledgeRatio: 0.6,
    interestRate: 0.022,
    disableGuards: true, // 關閉 valuationGuard / entryGate，觀察計分矩陣訊號品質
    quiet: true,
  };

  // ── 策略 A：v2.8 雙軌動能 ───────────────────────────────────
  console.log("  🔵 [策略 A] v2.8 雙軌動能（buyTactical=4.0, bullish=1.5）...");
  const runnerA = new BacktestRunner({
    ...BASE,
    name: "策略 v2.8（雙軌動能）",
    buyTactical: 4.0,
    buyTacticalBullish: 1.5,
  });
  await runnerA.run();
  const resultsA = runnerA.results;

  // ── 策略 B：原廠保守版 ──────────────────────────────────────
  console.log("  🟡 [策略 B] 原廠保守版（buyTactical=6.0，無牛市放寬）...");
  const runnerB = new BacktestRunner({
    ...BASE,
    name: "原廠保守版（buyTactical=6）",
    buyTactical: 6.0,
    buyTacticalBullish: 6.0,
  });
  await runnerB.run();
  const resultsB = runnerB.results;

  // ── 基準 C：純 0050 DCA ─────────────────────────────────────
  console.log("  ⚪ [基準 C] 純 0050 DCA（每月 3 萬，不做槓桿）...");
  const resultsC = await run0050DCA(raw, MONTHLY);

  // ── 分析 ────────────────────────────────────────────────────
  const anaA = analyze(resultsA, totalInvested, years, "策略 v2.8（雙軌動能）");
  const anaB = analyze(resultsB, totalInvested, years, "原廠保守版");
  const anaC = analyze(resultsC, totalInvested, years, "純 0050 DCA");

  const fmt = (n) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
  const fmtN = (n) => `NT$${Math.round(n).toLocaleString()}`;

  // ── 綜合摘要 ─────────────────────────────────────────────────
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("                  📈 綜合績效摘要");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(
    `  累計投入：${fmtN(totalInvested)}  回測期間：${years.toFixed(1)} 年\n`,
  );
  console.log(
    `  ${"策略".padEnd(22)} ${"最終淨值".padStart(14)} ${"年化報酬".padStart(10)} ${"最大回撤".padStart(10)} ${"夏普".padStart(8)}`,
  );
  console.log("  " + "─".repeat(68));
  for (const a of [anaA, anaB, anaC]) {
    console.log(
      `  ${a.label.padEnd(22)} ${fmtN(a.finalNav).padStart(14)} ` +
        `${fmt(a.annualPct).padStart(10)} ` +
        `${("-" + a.mdd.toFixed(2) + "%").padStart(10)} ` +
        `${a.sharpe.toFixed(2).padStart(8)}`,
    );
  }

  // ── 年度分解 ─────────────────────────────────────────────────
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("                  📅 年度報酬分解");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  const allYears = [
    ...new Set([
      ...Object.keys(anaA.annualRets),
      ...Object.keys(anaB.annualRets),
      ...Object.keys(anaC.annualRets),
    ]),
  ].sort();
  console.log(
    `  ${"年份".padEnd(6)} ${"v2.8 策略".padStart(12)} ${"原廠保守".padStart(12)} ${"0050 DCA".padStart(12)}`,
  );
  console.log("  " + "─".repeat(46));
  const fmtR = (obj, yr) =>
    obj[yr] != null ? (+obj[yr] >= 0 ? "+" : "") + obj[yr] + "%" : "  ─";
  for (const yr of allYears) {
    console.log(
      `  ${yr.padEnd(6)} ${fmtR(anaA.annualRets, yr).padStart(12)} ` +
        `${fmtR(anaB.annualRets, yr).padStart(12)} ${fmtR(anaC.annualRets, yr).padStart(12)}`,
    );
  }

  // ── 詳細狀態（槓桿運用） ─────────────────────────────────────
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("               📦 最終帳戶狀態（策略 A/B）");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  for (const [label, runner] of [
    ["策略 A (v2.8)", runnerA],
    ["策略 B (原廠)", runnerB],
  ]) {
    const s = runner.results.at(-1);
    if (!s) continue;
    const p = runner.timeline.at(-1)?.price0050 ?? 1;
    console.log(`  ${label}：`);
    console.log(
      `    0050 底倉  ：${s.qty0050} 股，市值 ${fmtN(s.qty0050 * p)}`,
    );
    console.log(`    00675L 部位：${s.qtyZ2} 股，市值 ${fmtN(s.valueZ2)}`);
    console.log(`    質押借款   ：${fmtN(s.totalLoan)}`);
    console.log(`    可借額度   ：${fmtN(s.pledgeCap)}（0050 × 60%）`);
    console.log(`    剩餘可借   ：${fmtN(s.availCredit)}`);
    console.log(`    現金       ：${fmtN(s.cash)}`);
    console.log(`    淨值       ：${fmtN(s.netAsset)}`);
    console.log("");
  }

  // ── 買賣次數統計 ─────────────────────────────────────────────
  for (const [label, runner] of [
    ["策略 A (v2.8)", runnerA],
    ["策略 B (原廠)", runnerB],
  ]) {
    const buys = runner.results.filter((r) => r.signal === "long").length;
    const sells = runner.results.filter(
      (r) => r.signal === "short" || (r.advice || "").includes("強制賣出"),
    ).length;
    console.log(`  ${label}：共觸發買入 ${buys} 次 / 賣出 ${sells} 次`);
  }

  // ── 結論 ─────────────────────────────────────────────────────
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("                  🧠 結論");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  const diffC = anaA.annualPct - anaC.annualPct;
  const diffB = anaA.annualPct - anaB.annualPct;
  console.log(
    `  • v2.8 年化 ${anaA.annualPct.toFixed(2)}%  vs  純 DCA ${anaC.annualPct.toFixed(2)}%`,
  );
  console.log(
    `    → 槓桿策略比純 DCA ${diffC >= 0 ? "多賺" : "少賺"} ${Math.abs(diffC).toFixed(2)}% / 年`,
  );
  console.log(
    `\n  • v2.8 vs 原廠保守版：${diffB >= 0 ? "多賺" : "少賺"} ${Math.abs(diffB).toFixed(2)}% / 年`,
  );
  console.log(
    `\n  • v2.8 MDD ${anaA.mdd.toFixed(2)}%  夏普 ${anaA.sharpe.toFixed(2)}`,
  );
  console.log(
    `    原廠保守版 MDD ${anaB.mdd.toFixed(2)}%  夏普 ${anaB.sharpe.toFixed(2)}`,
  );
  console.log(
    `    純 DCA MDD ${anaC.mdd.toFixed(2)}%  夏普 ${anaC.sharpe.toFixed(2)}`,
  );
  console.log("");
}

main().catch((e) => {
  console.error("❌ 回測失敗:", e.message);
  console.error(e.stack);
  process.exit(1);
});
