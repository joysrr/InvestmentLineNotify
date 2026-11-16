#!/usr/bin/env node
/**
 * 對照 baseline 驗證當前狀態
 * 產出：.agent-report/latest/{report.json, REPORT.md, screenshots/, diff/}
 * 退出碼：0 無退化；2 有退化；1 執行錯誤
 * 注意：每頁獨立 browser（跑完立刻關），避免 Chromium 疊加導致 OOM
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, newPage, installApiMocks } from "./lib/browser.mjs";
import { captureRoute } from "./lib/capture.mjs";
import { diffPngs } from "./lib/diff.mjs";
import * as fixtures from "./lib/fixtures.mjs";
import { ROUTES } from "./lib/routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(__dirname, "../..");
const BASELINE_DIR = path.join(webappRoot, ".agent-baseline");
const REPORT_DIR = path.join(webappRoot, ".agent-report", "latest");
const SHOT_DIR = path.join(REPORT_DIR, "screenshots");
const DIFF_DIR = path.join(REPORT_DIR, "diff");
const BASE_URL = process.env.AGENT_BASE_URL || "http://localhost:5174";
const DIFF_THRESHOLD_PCT = Number(process.env.AGENT_DIFF_THRESHOLD || "2.0");

function shortPath(p) { return p ? path.basename(p) : ""; }

async function main() {
  let baseline;
  try {
    baseline = JSON.parse(await fs.readFile(path.join(BASELINE_DIR, "manifest.json"), "utf8"));
  } catch {
    console.error("找不到 baseline，請先跑 npm run ui:baseline");
    process.exit(1);
  }

  await fs.rm(REPORT_DIR, { recursive: true, force: true });
  await fs.mkdir(SHOT_DIR, { recursive: true });
  await fs.mkdir(DIFF_DIR, { recursive: true });

  console.log(`[verify] → ${BASE_URL}`);
  const report = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    baselineCreatedAt: baseline.createdAt,
    thresholdPct: DIFF_THRESHOLD_PCT,
    routes: [],
    summary: { ok: 0, changed: 0, regressed: 0, error: 0 },
  };

  for (const route of ROUTES) {
    console.log(`[verify] ${route.slug} …`);
    let browser;
    let curr;
    try {
      browser = await launch();
      const { page, context } = await newPage(browser);
      await installApiMocks(page, fixtures);
      curr = await captureRoute(page, route, BASE_URL, SHOT_DIR);
      await context.close();
    } catch (e) {
      console.error(`  ✗ ${route.slug} 崩潰: ${e.message.slice(0, 200)}`);
      curr = {
        slug: route.slug, path: route.path, title: route.title,
        durationMs: 0, errors: [`CRASH: ${e.message.slice(0, 200)}`],
        warnings: [], failedRequests: [],
        screenshotPath: null, screenshotHash: null, screenshotBytes: 0,
      };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }

    const base = baseline.routes.find((r) => r.slug === route.slug);
    if (!base) {
      report.routes.push({ ...curr, status: "error", reason: "no baseline" });
      report.summary.error++;
      console.log(`  ! ${route.slug} (無基準)`);
      continue;
    }

    if (curr.screenshotHash === base.screenshotHash && curr.errors.length <= base.errors.length) {
      report.routes.push({ ...curr, status: "ok", diffPercent: 0, baselineErrors: base.errors.length, currentErrors: curr.errors.length });
      report.summary.ok++;
      console.log(`  ✓ ${route.slug} (identical)`);
      continue;
    }

    let diffPercent = 0;
    let sizeMismatch = false;
    try {
      const baseBuf = await fs.readFile(base.screenshotPath);
      const currBuf = await fs.readFile(curr.screenshotPath);
      const diffPath = path.join(DIFF_DIR, `${route.slug}.png`);
      const d = diffPngs(baseBuf, currBuf, diffPath);
      diffPercent = d.diffPercent;
      sizeMismatch = d.sizeMismatch;
    } catch (e) {
      curr.errors.push(`DIFF_FAIL: ${e.message.slice(0, 300)}`);
      diffPercent = 100;
    }

    const errBudget = base.errors.length;
    const errorRegression = curr.errors.length > errBudget;
    const tooDifferent = diffPercent > DIFF_THRESHOLD_PCT;

    let status = "changed";
    if (errorRegression || tooDifferent) status = "regressed";
    else if (diffPercent < 0.01 && !sizeMismatch) status = "ok";

    report.routes.push({
      ...curr,
      status,
      diffPercent: Math.round(diffPercent * 100) / 100,
      sizeMismatch,
      baselineErrors: base.errors.length,
      currentErrors: curr.errors.length,
    });

    if (status === "regressed") report.summary.regressed++;
    else if (status === "changed") report.summary.changed++;
    else report.summary.ok++;

    const icon = { ok: "✓", changed: "~", regressed: "✗", error: "!" }[status];
    console.log(`  ${icon} ${route.slug} (diff=${diffPercent.toFixed(2)}%, err=${curr.errors.length})`);
  }

  await fs.writeFile(path.join(REPORT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(REPORT_DIR, "REPORT.md"), renderMarkdown(report));

  console.log(`\n[verify] 報告 → ${REPORT_DIR}/REPORT.md`);
  console.log(`[verify] 彙總：ok=${report.summary.ok} changed=${report.summary.changed} regressed=${report.summary.regressed} error=${report.summary.error}`);

  if (report.summary.regressed > 0 || report.summary.error > 0) process.exit(2);
  process.exit(0);
}

function renderMarkdown(report) {
  const L = [];
  L.push(`# UI 驗證報告`, "");
  L.push(`- **產生時間**: ${report.createdAt}`);
  L.push(`- **基準建立**: ${report.baselineCreatedAt}`);
  L.push(`- **測試位址**: ${report.baseUrl}`);
  L.push(`- **差異閾值**: ${report.thresholdPct}%`, "");
  L.push(`## 彙總`, "", `| 狀態 | 數量 |`, `|---|---|`);
  L.push(`| ✓ ok | ${report.summary.ok} |`);
  L.push(`| ~ changed | ${report.summary.changed} |`);
  L.push(`| ✗ regressed | ${report.summary.regressed} |`);
  L.push(`| ! error | ${report.summary.error} |`, "");
  L.push(`## 各頁明細`, "");
  for (const r of report.routes) {
    L.push(`### ${r.title} (\`${r.path}\`)`, "");
    L.push(`- **狀態**: \`${r.status}\``);
    if (r.diffPercent !== undefined) L.push(`- **像素差異**: ${r.diffPercent}%`);
    L.push(`- **耗時**: ${r.durationMs}ms`);
    L.push(`- **錯誤數**: ${r.currentErrors ?? r.errors.length}（基準 ${r.baselineErrors ?? "?"}）`);
    if (r.sizeMismatch) L.push(`- ⚠ 截圖尺寸不一致`);
    if (r.errors.length) {
      L.push(`- **錯誤內容**:`);
      for (const e of r.errors.slice(0, 5)) L.push(`  - \`${e}\``);
      if (r.errors.length > 5) L.push(`  - …還有 ${r.errors.length - 5} 條`);
    }
    if (r.screenshotPath) L.push(`- **截圖**: \`${shortPath(r.screenshotPath)}\``);
    L.push("");
  }
  return L.join("\n");
}

main().catch((e) => { console.error("[verify] FAIL:", e); process.exit(1); });
