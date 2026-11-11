#!/usr/bin/env node
/**
 * validate-docs-code-consistency.mjs
 * CI/本地腳本：驗證關鍵文件與程式碼常數的一致性
 *
 * 初期覆蓋 3–5 個關鍵數值：
 *  1. regime_policy.md 的 VIX 門檻 vs src/modules/strategy/regimePolicy.mjs
 *  2. cash_exposure_advisor.md 的 resolveTargetLeverage 四層優先序 vs src/modules/strategy/cashExposureAdvisor.mjs
 *
 * 使用方式: node scripts/validate-docs-code-consistency.mjs
 */

import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const REPO_ROOT = resolve(".");
const RESULTS = { pass: 0, fail: 0, warnings: [] };

function log(label, ok, detail = "") {
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
  if (ok) RESULTS.pass += 1;
  else {
    RESULTS.fail += 1;
    RESULTS.warnings.push(`${label}: ${detail}`);
  }
}

// ──────────────────────────────────────────────
// 1. regime_policy.md VIX 門檻 vs regimePolicy.mjs
// ──────────────────────────────────────────────
function checkVixThresholds() {
  console.log("\n📋 1. regime_policy.md VIX 門檻 vs regimePolicy.mjs");
  const docPath = join(REPO_ROOT, "docs/modules/strategy/regime_policy.md");
  const codePath = join(REPO_ROOT, "src/modules/strategy/regimePolicy.mjs");

  if (!existsSync(docPath) || !existsSync(codePath)) {
    log("VIX 門檻檢查", false, "文件或程式碼不存在");
    return;
  }

  const doc = readFileSync(docPath, "utf-8");
  const code = readFileSync(codePath, "utf-8");

  // 從文件抽取 VIX 門檻（表格中的數值）
  const docVixNumbers = [...new Set(doc.match(/VIX\s*[<≥>]\s*(\d+)/gi) || [])]
    .map((m) => {
      const n = m.match(/\d+/);
      return n ? parseInt(n[0], 10) : null;
    })
    .filter((n) => n !== null);

  // 從程式碼抽取 VIX 門檻
  const codeVixMatches = code.match(/VIX\s*[<≥]\s*(\d+)/gi);
  const codeVixNumbers = codeVixMatches
    ? [...new Set(codeVixMatches.map((m) => parseInt(m.match(/\d+/)[0], 10)))]
    : [];

  console.log(`   文件 VIX 門檻: [${docVixNumbers.join(", ")}]`);
  console.log(`   程式碼 VIX 門檻: [${codeVixNumbers.join(", ")}]`);

  const docSet = new Set(docVixNumbers);
  const codeSet = new Set(codeVixNumbers);
  const onlyInDoc = [...docSet].filter((n) => !codeSet.has(n));
  const onlyInCode = [...codeSet].filter((n) => !docSet.has(n));

  if (onlyInDoc.length > 0 || onlyInCode.length > 0) {
    log(
      "VIX 門檻一致性",
      false,
      `文件只有: [${onlyInDoc.join(", ")}], 程式碼只有: [${onlyInCode.join(", ")}]`,
    );
  } else {
    log("VIX 門檻一致性", true, `雙方皆為 [${[...docSet].join(", ")}]`);
  }

  // 檢查 vixOverrideTrigger 與 vixAbsoluteOverride 是否在文件中有對應說明
  const hasOverrideTrigger = /vixOverrideTrigger/.test(doc);
  const hasAbsoluteOverride = /vixAbsoluteOverride/.test(doc);
  log(
    "文件 vixOverrideTrigger 說明",
    hasOverrideTrigger,
    hasOverrideTrigger ? "" : "缺失",
  );
  log(
    "文件 vixAbsoluteOverride 說明",
    hasAbsoluteOverride,
    hasAbsoluteOverride ? "" : "缺失",
  );
}

// ──────────────────────────────────────────────
// 2. cash_exposure_advisor.md 四層優先序 vs cashExposureAdvisor.mjs
// ──────────────────────────────────────────────
function checkLeverageLayers() {
  console.log(
    "\n📋 2. cash_exposure_advisor.md 四層優先序 vs cashExposureAdvisor.mjs",
  );
  const docPath = join(
    REPO_ROOT,
    "docs/modules/strategy/cash_exposure_advisor.md",
  );
  const codePath = join(
    REPO_ROOT,
    "src/modules/strategy/cashExposureAdvisor.mjs",
  );

  if (!existsSync(docPath) || !existsSync(codePath)) {
    log("四層優先序檢查", false, "文件或程式碼不存在");
    return;
  }

  const doc = readFileSync(docPath, "utf-8");
  const code = readFileSync(codePath, "utf-8");

  // 文件應聲明 4 層優先序
  const docLayers = doc.match(/4 層|4層|four layers?/gi);
  const docHasLayers = docLayers ? docLayers.length > 0 : false;

  // 程式碼應有 resolveTargetLeverage 函數與 4 個返回點（if/return）
  const codeHasResolve = /function resolveTargetLeverage/.test(code);
  const codeReturnCount = (code.match(/return /g) || []).length;

  log("文件宣稱 4 層優先序", docHasLayers, docHasLayers ? "" : "缺失 4 層說明");
  log(
    "程式碼有 resolveTargetLeverage",
    codeHasResolve,
    codeHasResolve ? "" : "缺失函數",
  );
  log(
    "程式碼 return 陳述數量",
    codeReturnCount >= 4,
    `共 ${codeReturnCount} 個 return，預期 ≥ 4（對應 4 層）`,
  );

  // 檢查四層的關鍵條件是否都在文件與程式碼中
  const conditions = [
    "portfolio.targetLeverage",
    "panic.suggestedLeverage",
    "allocation",
    "ceiling",
  ];
  for (const cond of conditions) {
    const inDoc = doc.includes(cond);
    const inCode = code.includes(cond);
    log(
      `條件 "${cond}" 文件/程式碼`,
      inDoc && inCode,
      `${inDoc ? "文件✅" : "文件❌"} / ${inCode ? "程式碼✅" : "程式碼❌"}`,
    );
  }
}

// ──────────────────────────────────────────────
// 主程式
// ──────────────────────────────────────────────
function main() {
  console.log(
    "🔍 validate-docs-code-consistency.mjs — 文件與程式碼一致性檢查\n",
  );

  checkVixThresholds();
  checkLeverageLayers();

  console.log(`\n📊 結果: ${RESULTS.pass} 通過, ${RESULTS.fail} 失敗`);
  if (RESULTS.fail > 0) {
    console.log("\n⚠️  發現文件與程式碼不一致：");
    for (const w of RESULTS.warnings) {
      console.log(`   • ${w}`);
    }
    process.exit(1);
  } else {
    console.log("✅ 所有文件與程式碼一致性檢查通過");
    process.exit(0);
  }
}

main();
