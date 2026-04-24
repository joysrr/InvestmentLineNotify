#!/usr/bin/env node
// docs-location-validator.mjs
// 驗證文件分層三原則（依 RULES_DESIGN_GUIDE §二十 + PROPOSAL_20260423_004 Part 4）
//
// 規則 1：docs/ 下不得含 framework 說明特徵（否則應移至 .agents/docs/）
// 規則 2：.agents/docs/ 不得含專案特化命名（歷史範例除外）
// 規則 3：.agents/docs/*.md（除 README.md）必有 framework 標示區塊
//
// 使用：node .agents/tests/docs-location-validator.mjs [--verbose]
//
// 退出碼：
//   0 = 全部通過
//   1 = warnings（規則 2 / 3）
//   2 = errors（規則 1）

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = join(__dirname, '..');
const PROJECT_ROOT = join(AGENTS_ROOT, '..');
const DOCS_ROOT = join(PROJECT_ROOT, 'docs');
const AGENTS_DOCS = join(AGENTS_ROOT, 'docs');

// -------- CLI --------
const verbose = process.argv.includes('--verbose');

let errors = 0;
let warnings = 0;

function err(msg) { console.error(`❌ [ERROR] ${msg}`); errors++; }
function warn(msg) { console.warn(`⚠️  [WARN]  ${msg}`); warnings++; }
function info(msg) { if (verbose) console.log(`ℹ️  ${msg}`); }

// -------- Framework 說明特徵（規則 1）--------
// 若 docs/ 下檔案命中以下任一特徵 → 應移至 .agents/docs/
const FRAMEWORK_INDICATORS = [
  // 明確提及 13 Agent 框架並列
  /@Lead.{0,40}@Planner.{0,40}@Architect/s,
  // RULES_DESIGN_GUIDE 章節引用（通用規範說明）
  /RULES_DESIGN_GUIDE\s*§[一二三四五六七八九十]/,
  // 明確為 AI Agent 通用品質評鑒表
  /AI\s*Agent\s*品質.{0,20}評鑒表/,
  /AI\s*Agent\s*品質.{0,20}評審手冊/,
  // `.agents/` 目錄樹符號
  /\.agents\/[\s\S]{0,20}├──/,
];

// -------- 專案特化命名（規則 2）--------
// .agents/docs/ 不應含，除歷史範例明文標示
const PROJECT_CONTAMINATION = [
  /InvestmentLineNotify/,
  /strategyWeight/,
  /data\/Strategy\.json/,
];

// -------- 排除路徑（不套用規則 1）--------
// 這些 docs/ 下檔案即使命中 framework 特徵，也屬合理（歷史 / 業務 / User 已判定保留）
const EXCLUDE_FROM_RULE_1 = [
  /SYSTEM_AUDIT_/,
  /2026-04-17/,
  /InvestmentLineNotify AI Agents 系統/,  // User 2026-04-23 明示保留（類別 B / 專案 overview）
  /AUDIT_HISTORY\.md$/,
  /AUDIT_DECISION_LOG\.md$/,
  /DoD_AUDIT_LOG\.md$/,
  /GLOBAL_STATUS_SUMMARY\.md$/,
  /\/summary\//,
  /\/archive\//,
];

// -------- 標示區塊偵測（規則 3）--------
const FRAMEWORK_HEADER_PATTERN = /\*\*文件分層\*\*\s*[:：]\s*framework/;

// -------- Utility --------
function listMdFilesRecursive(dir, rel = '') {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') && entry !== '.gitkeep') continue;  // skip hidden
    if (entry === 'node_modules') continue;
    const relChild = rel ? `${rel}/${entry}` : entry;
    const abs = join(dir, relChild);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) out.push(...listMdFilesRecursive(dir, relChild));
    else if (st.isFile() && entry.endsWith('.md')) out.push(relChild);
  }
  return out;
}

// -------- 規則 1：docs/ 不得含 framework 說明 --------
function checkRule1() {
  info('Rule 1: docs/ 不得含 framework 說明特徵');
  if (!existsSync(DOCS_ROOT)) {
    info('docs/ 不存在，跳過');
    return;
  }
  const files = listMdFilesRecursive(DOCS_ROOT);
  for (const rel of files) {
    const abs = join(DOCS_ROOT, rel);
    // 排除清單
    if (EXCLUDE_FROM_RULE_1.some(p => p.test(rel))) {
      info(`  skip (excluded): docs/${rel}`);
      continue;
    }
    const content = readFileSync(abs, 'utf-8');
    const hits = FRAMEWORK_INDICATORS.filter(p => p.test(content));
    if (hits.length > 0) {
      err(`docs/${rel}: 命中 ${hits.length} 項 framework 說明特徵 → 建議移至 .agents/docs/`);
    }
  }
}

// -------- 規則 2：.agents/docs/ 不得含專案特化命名 --------
function checkRule2() {
  info('Rule 2: .agents/docs/ 不得含專案特化命名');
  if (!existsSync(AGENTS_DOCS)) {
    info('.agents/docs/ 不存在，跳過');
    return;
  }
  const files = readdirSync(AGENTS_DOCS).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const content = readFileSync(join(AGENTS_DOCS, f), 'utf-8');
    for (const p of PROJECT_CONTAMINATION) {
      const matches = content.match(new RegExp(p.source, 'g'));
      if (matches) {
        // 檢查是否有明文說明為「歷史範例」
        const hasExplanation = /歷史範例|示意|\(example\)|（範例）|as example/i.test(content);
        if (!hasExplanation) {
          warn(`.agents/docs/${f}: 含 ${matches.length} 處 "${p.source}" 但無「歷史範例」明文說明 → 建議通用化`);
        } else {
          info(`  ${f}: 含 ${matches.length} 處 "${p.source}" 但有歷史範例說明（可接受）`);
        }
      }
    }
  }
}

// -------- 規則 3：.agents/docs/*.md（除 README）必有 framework 標示區塊 --------
function checkRule3() {
  info('Rule 3: .agents/docs/*.md 必有 framework 標示區塊');
  if (!existsSync(AGENTS_DOCS)) {
    info('.agents/docs/ 不存在，跳過');
    return;
  }
  const files = readdirSync(AGENTS_DOCS).filter(f => f.endsWith('.md') && f !== 'README.md');
  for (const f of files) {
    const content = readFileSync(join(AGENTS_DOCS, f), 'utf-8');
    // 只檢查前 50 行（標示區塊應在文首）
    const head = content.split('\n').slice(0, 50).join('\n');
    if (!FRAMEWORK_HEADER_PATTERN.test(head)) {
      warn(`.agents/docs/${f}: 缺「文件分層：framework」標示區塊（前 50 行內）`);
    }
  }
}

// -------- Main --------
function main() {
  console.log('🔍 Running docs-location-validator (PROPOSAL_20260423_004)');

  checkRule1();
  checkRule2();
  checkRule3();

  console.log('');
  console.log(`Summary: errors=${errors}, warnings=${warnings}`);

  if (errors > 0) process.exit(2);
  if (warnings > 0) process.exit(1);
  process.exit(0);
}

main();
