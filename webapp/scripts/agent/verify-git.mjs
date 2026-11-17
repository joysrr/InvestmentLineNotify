#!/usr/bin/env node
/**
 * GitHub 基線驗證 — 取代像素截圖比對（記憶體不足時的正式方案）
 *
 * 判定邏輯：
 *   1. 抓取 origin/main，列出工作區相對遠端的改動
 *   2. 跑 production build（真正的門禁）
 *   3. 可選跑 lint
 *
 * 退出碼：0 通過；2 build/lint 失敗；1 執行錯誤
 */
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(webappRoot, "..");
const REPORT_DIR = path.join(webappRoot, ".agent-report", "latest");

const run = (cmd, opts = {}) => {
  try {
    return { ok: true, out: execSync(cmd, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim() };
  } catch (e) {
    return { ok: false, out: (e.stdout || "").trim(), err: (e.stderr || "").trim(), status: e.status };
  }
};

async function main() {
  await fs.rm(REPORT_DIR, { recursive: true, force: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const report = {
    createdAt: new Date().toISOString(),
    mode: "git-vs-github",
    baseline: "origin/main",
    ahead: 0, behind: 0,
    committed: [], uncommitted: [],
    build: null, lint: null,
  };

  console.log("[verify-git] 抓取 origin/main …");
  run("git fetch origin --quiet");

  const hasOrigin = run("git rev-parse --verify origin/main").ok;
  if (!hasOrigin) {
    console.error("[verify-git] FAIL: 找不到 origin/main，無法比較");
    process.exit(1);
  }

  const ab = run("git rev-list --left-right --count HEAD...origin/main");
  if (ab.ok && ab.out) {
    const [a, b] = ab.out.split(/\s+/).map(Number);
    report.ahead = a; report.behind = b;
  }

  // 已提交但未推送的改動
  if (report.ahead > 0) {
    const d = run("git diff --name-status origin/main...HEAD");
    if (d.ok && d.out) report.committed = d.out.split("\n").filter(Boolean);
  }
  // 工作區未提交改動
  const st = run("git status --porcelain");
  if (st.ok && st.out) report.uncommitted = st.out.split("\n").filter(Boolean);

  console.log(`[verify-git] ahead=${report.ahead} behind=${report.behind} 已提交改動=${report.committed.length} 未提交=${report.uncommitted.length}`);

  // ── 門禁 1：production build ──
  console.log("[verify-git] 執行 production build …");
  const buildStart = Date.now();
  const build = run("npm run build", { cwd: webappRoot, stdio: ["ignore", "pipe", "pipe"], timeout: 600000 });
  report.build = {
    ok: build.ok,
    durationMs: Date.now() - buildStart,
    tail: (build.ok ? build.out : (build.err || build.out)).split("\n").slice(-12).join("\n"),
  };
  console.log(`[verify-git] build ${build.ok ? "✓ 通過" : "✗ 失敗"}（${report.build.durationMs}ms）`);

  // ── 門禁 2：lint（不阻斷，僅記錄）──
  console.log("[verify-git] 執行 lint …");
  const lint = run("npm run lint", { cwd: webappRoot, stdio: ["ignore", "pipe", "pipe"], timeout: 300000 });
  report.lint = {
    ok: lint.ok,
    tail: (lint.ok ? lint.out : (lint.err || lint.out)).split("\n").slice(-15).join("\n"),
  };
  console.log(`[verify-git] lint ${lint.ok ? "✓ 通過" : "⚠ 有問題"}`);

  await fs.writeFile(path.join(REPORT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(REPORT_DIR, "REPORT.md"), renderMarkdown(report));

  console.log(`\n[verify-git] 報告 → ${REPORT_DIR}/REPORT.md`);
  console.log(`[verify-git] 彙總：build=${build.ok ? "ok" : "FAIL"} lint=${lint.ok ? "ok" : "warn"}`);

  if (!build.ok) process.exit(2);
  process.exit(0);
}

function renderMarkdown(r) {
  const L = [];
  L.push(`# UI 驗證報告（GitHub 基線）`, "");
  L.push(`- **產生時間**: ${r.createdAt}`);
  L.push(`- **比較基線**: \`${r.baseline}\``);
  L.push(`- **分支狀態**: ahead ${r.ahead} / behind ${r.behind}`, "");
  L.push(`## 門禁結果`, "", `| 項目 | 狀態 |`, `|---|---|`);
  L.push(`| Production Build | ${r.build?.ok ? "✓ 通過" : "✗ 失敗"} |`);
  L.push(`| Lint | ${r.lint?.ok ? "✓ 通過" : "⚠ 有問題"} |`, "");
  if (!r.build?.ok) {
    L.push(`### Build 輸出（尾段）`, "", "```", r.build?.tail || "(無輸出)", "```", "");
  }
  if (!r.lint?.ok) {
    L.push(`### Lint 輸出（尾段）`, "", "```", r.lint?.tail || "(無輸出)", "```", "");
  }
  L.push(`## 相對 origin/main 的已提交改動（${r.committed.length}）`, "");
  if (r.committed.length === 0) L.push("_無_");
  else for (const f of r.committed) L.push(`- \`${f}\``);
  L.push("", `## 工作區未提交改動（${r.uncommitted.length}）`, "");
  if (r.uncommitted.length === 0) L.push("_無_");
  else for (const f of r.uncommitted) L.push(`- \`${f}\``);
  L.push("");
  return L.join("\n");
}

main().catch((e) => { console.error("[verify-git] FAIL:", e); process.exit(1); });
