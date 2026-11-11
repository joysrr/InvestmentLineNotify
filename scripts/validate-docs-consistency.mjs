#!/usr/bin/env node
/**
 * validate-docs-consistency.mjs
 * CI/本地腳本：驗證 docs/ 內部一致性
 *
 * 檢查項目：
 *  1. docs/README.md 導航地圖列出的檔案路徑皆存在
 *  2. docs/ 下所有 .md 皆有 YAML frontmatter 與 last_updated
 *  3. DEC-*.md 全部集中於 docs/decisions/
 *  4. plans/active/ 全部檔案有日期前綴 (YYYY-MM-DD-*)
 *  5. docs/modules/ 下所有 .md 的 status 為 current / superseded / deprecated
 *
 * 使用方式: node scripts/validate-docs-consistency.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const REPO_ROOT = resolve(".");
const DOCS_DIR = join(REPO_ROOT, "docs");
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
// 1. docs/README.md 導航地圖檔案存在性
// ──────────────────────────────────────────────
function getReferencedFilesFromReadme() {
  const readmePath = join(DOCS_DIR, "README.md");
  const content = readFileSync(readmePath, "utf-8");
  // 提取所有 .md 路徑引用（排除 README.md 自身）
  const refs = [...new Set(content.match(/[a-zA-Z0-9_./-]+\.md/g) || [])];
  return refs.filter((r) => r !== "README.md");
}

function checkReadmeNavigation() {
  console.log("\n📋 1. docs/README.md 導航地圖檔案存在性");
  const refs = getReferencedFilesFromReadme();
  for (const ref of refs.sort()) {
    // 嘗試多個可能位置
    const candidates = [
      join(REPO_ROOT, ref), // repo root (e.g. SOUL.md)
      join(DOCS_DIR, ref),
      join(DOCS_DIR, "modules", ref),
      join(DOCS_DIR, "modules", "presentation", ref),
      join(DOCS_DIR, "modules", "strategy", ref),
      join(DOCS_DIR, "modules", "ai_news", ref),
      join(DOCS_DIR, "modules", "ai_news", "integrations", ref),
      join(DOCS_DIR, "decisions", ref),
      join(DOCS_DIR, "meta", ref),
      join(DOCS_DIR, "verification", ref),
      join(DOCS_DIR, "research", ref),
      join(DOCS_DIR, "plans", ref),
      join(DOCS_DIR, "plans", "active", ref),
      join(DOCS_DIR, "plans", "completed", ref),
    ];
    const exists = candidates.some((c) => existsSync(c));
    log(
      `導航路徑: ${ref}`,
      exists,
      exists ? "" : "未在 docs/ 下任何子目錄找到",
    );
  }
}

// ──────────────────────────────────────────────
// 2. docs/ 下所有 .md 皆有 YAML frontmatter 與 last_updated
// ──────────────────────────────────────────────
function walkMdFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMdFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function checkFrontmatter() {
  console.log("\n📋 2. docs/ .md frontmatter 與 last_updated");
  const mdFiles = walkMdFiles(DOCS_DIR);
  for (const file of mdFiles.sort()) {
    const rel = file.slice(REPO_ROOT.length + 1);
    const content = readFileSync(file, "utf-8");
    const hasFrontmatter = content.startsWith("---\n");
    let hasLastUpdated = false;
    if (hasFrontmatter) {
      const endIdx = content.indexOf("\n---\n", 4);
      const frontmatter = content.slice(
        4,
        endIdx === -1 ? content.length : endIdx,
      );
      hasLastUpdated = /^last_updated:/m.test(frontmatter);
    }
    log(
      `frontmatter: ${rel}`,
      hasFrontmatter && hasLastUpdated,
      hasFrontmatter
        ? hasLastUpdated
          ? ""
          : "缺少 last_updated"
        : "缺少 frontmatter",
    );
  }
}

// ──────────────────────────────────────────────
// 3. DEC-*.md 全部集中於 docs/decisions/
// ──────────────────────────────────────────────
function checkDecFiles() {
  console.log("\n📋 3. DEC-*.md 全部集中於 docs/decisions/");
  const mdFiles = walkMdFiles(DOCS_DIR);
  const decFiles = mdFiles.filter((f) => /DEC-\d+/.test(f.split("/").pop()));
  const decisionsDir = join(DOCS_DIR, "decisions");
  for (const file of decFiles.sort()) {
    const rel = file.slice(REPO_ROOT.length + 1);
    const inDecisions = file.startsWith(decisionsDir + "/");
    log(
      `DEC 位置: ${rel}`,
      inDecisions,
      inDecisions ? "" : "不在 docs/decisions/ 下",
    );
  }
  if (decFiles.length === 0) {
    log("DEC 檔案", true, "未發現 DEC-*.md 檔案");
  }
}

// ──────────────────────────────────────────────
// 4. plans/active/ 全部檔案有日期前綴 (YYYY-MM-DD-*)
// ──────────────────────────────────────────────
function checkPlanFiles() {
  console.log("\n📋 4. plans/active/ 檔案日期前綴");
  const plansActiveDir = join(DOCS_DIR, "plans", "active");
  if (!existsSync(plansActiveDir)) {
    log("plans/active/", true, "目錄不存在，跳過");
    return;
  }
  const files = readdirSync(plansActiveDir).filter((f) => f.endsWith(".md"));
  const datePrefix = /^\d{4}-\d{2}-\d{2}-/;
  for (const f of files.sort()) {
    const ok = datePrefix.test(f);
    log(`計畫檔案: ${f}`, ok, ok ? "" : "缺少 YYYY-MM-DD- 日期前綴");
  }
  if (files.length === 0) {
    log("plans/active/ 檔案", true, "無 .md 檔案");
  }
}

// ──────────────────────────────────────────────
// 5. docs/modules/ 下所有 .md 的 status 欄位
// ──────────────────────────────────────────────
function checkModuleStatus() {
  console.log("\n📋 5. docs/modules/ .md status 欄位");
  const modulesDir = join(DOCS_DIR, "modules");
  if (!existsSync(modulesDir)) {
    log("docs/modules/", true, "目錄不存在，跳過");
    return;
  }
  const mdFiles = walkMdFiles(modulesDir);
  const validStatuses = ["current", "superseded", "deprecated"];
  for (const file of mdFiles.sort()) {
    const rel = file.slice(REPO_ROOT.length + 1);
    const content = readFileSync(file, "utf-8");
    let statusOk = false;
    let statusDetail = "";
    if (content.startsWith("---\n")) {
      const endIdx = content.indexOf("\n---\n", 4);
      const frontmatter = content.slice(
        4,
        endIdx === -1 ? content.length : endIdx,
      );
      const statusMatch = frontmatter.match(/^status:\s*(\S+)/m);
      if (statusMatch) {
        const status = statusMatch[1];
        statusOk = validStatuses.includes(status);
        statusDetail = statusOk
          ? ""
          : `status=${status} 不在 [${validStatuses.join(", ")}] 中`;
      } else {
        statusDetail = "缺少 status 欄位";
      }
    } else {
      statusDetail = "缺少 frontmatter";
    }
    log(`modules status: ${rel}`, statusOk, statusDetail);
  }
  if (mdFiles.length === 0) {
    log("docs/modules/ 檔案", true, "無 .md 檔案");
  }
}

// ──────────────────────────────────────────────
// 6. related_code 引用有效性驗證
// ──────────────────────────────────────────────
function extractFrontmatter(fileContent) {
  const fmMatch = fileContent.match(/^---([\s\S]*?)---/m);
  if (!fmMatch) return null;
  return fmMatch[1];
}

function parseRelatedCode(fmContent) {
  const rcMatch = fmContent.match(/related_code:[\s\S]*?(?=\n\w|---|$)/);
  if (!rcMatch) return [];
  const lines = rcMatch[0].split("\n").slice(1);
  const paths = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s*(.+)$/);
    if (m) paths.push(m[1].trim());
  }
  return paths;
}

function checkRelatedCodeValidity() {
  console.log("\n🔗 6. related_code 引用有效性驗證");
  const mdFiles = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) mdFiles.push(full);
    }
  }
  walk(DOCS_DIR);

  let invalidCount = 0;
  for (const filePath of mdFiles) {
    const content = readFileSync(filePath, "utf-8");
    const fm = extractFrontmatter(content);
    if (!fm) continue;
    const relatedCode = parseRelatedCode(fm);
    if (relatedCode.length === 0) continue;
    for (const codePath of relatedCode) {
      const absPath = resolve(REPO_ROOT, codePath);
      if (!existsSync(absPath)) {
        log(`related_code 引用失效: ${codePath}`, false, `在 ${filePath} 中`);
        invalidCount++;
      }
    }
  }
  if (invalidCount === 0) {
    log("所有 related_code 引用有效", true);
  }
  return invalidCount;
}

function main() {
  console.log("🔍 validate-docs-consistency.mjs — docs 內部一致性檢查\n");

  checkReadmeNavigation();
  checkFrontmatter();
  checkDecFiles();
  checkPlanFiles();
  checkModuleStatus();
  checkRelatedCodeValidity();

  console.log(`\n📊 結果: ${RESULTS.pass} 通過, ${RESULTS.fail} 失敗`);
  if (RESULTS.fail > 0) {
    console.log("\n⚠️  失敗項目：");
    for (const w of RESULTS.warnings) {
      console.log(`   • ${w}`);
    }
    process.exit(1);
  } else {
    console.log("✅ 所有 docs 一致性檢查通過");
    process.exit(0);
  }
}

main();
