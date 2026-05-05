#!/usr/bin/env node
// framework-diff.mjs
// 比對兩份 .agents/ 目錄的框架層差異；零網路依賴；純 Node.js 內建模組
// 依 PROPOSAL_20260423_001 Part 5 建立
//
// 使用：
//   node .agents/scripts/framework-diff.mjs --target <path-to-other-.agents>
//   node .agents/scripts/framework-diff.mjs --target /tmp/latest-agents
//
// 退出碼：
//   0 = 兩框架層一致（無差異）
//   1 = 有差異，User 需審視（正常升級情境）
//   2 = 結構錯誤（如目錄非 .agents/ 結構）
//
// 安全保證：
//   - 本工具不自動執行 merge；僅輸出 diff 報告 + 建議指令
//   - 本工具不觸及 project_layer；即使在 target 中存在，diff 報告標記為 🔒 Protected
//   - User 最終決定是否 cp / rsync；可選擇性合併

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_AGENTS_ROOT = resolve(join(__dirname, '..'));

// -------- Layer classification --------
// Glob-like 白名單（依 PROPOSAL_20260423_001 Part 5 §3.5.2 + 20260423_004 Part 6）
const FRAMEWORK_LAYER_PATTERNS = [
  /^rules\/[^/]+\.md$/,
  /^skills\/[^/]+\.md$/,
  /^tech-stacks\/[^/]+\.md$/,
  /^docs\/[^/]+\.md$/,  // PROPOSAL_20260423_004: .agents/docs/ framework 說明文件
  /^tech-stacks\/[^/]+\/[^/]+\.md$/,  // 支援子目錄化
  /^domains\/[^/]+\.md$/,
  /^tasks\/[^/]+\.md$/,
  /^tests\/[^/]+\.mjs$/,
  /^tests\/[^/]+\.sh$/,
  /^scripts\/[^/]+\.mjs$/,
  /^proposals\/completed\/[^/]+\.md$/,
  /^proposals\/archived\/[^/]+\.md$/,
  /^RULES_DESIGN_GUIDE\.md$/,
  /^RULES_METADATA_SCHEMA\.md$/,
  /^RULES_VERSION_INDEX\.md$/,
  /^SYSTEM_THRESHOLDS\.yaml$/,
  /^WORKSPACE_SCHEMA\.yaml$/,
  /^FRAMEWORK_VERSION$/,
  /^CHANGELOG\.md$/,
  /^workspaces\/default_env\.md$/,
  /^workspaces\/README\.md$/,
  /^tests\/README\.md$/,
  /^\.gitkeep$/,
];

// project_layer：升級時不觸及；即使 target 中存在也標記為 🔒 Protected
const PROJECT_LAYER_PATTERNS = [
  /^CURRENT_WORKSPACE$/,
  /^workspaces\/(?!default_env\.md|README\.md)[^/]+\.md$/,  // workspaces/<name>.md 除 default_env/README
  /^workspaces\/[^/]+\//,  // workspaces/<name>/ 子目錄（未來專案層擴充）
  /^proposals\/active\/[^/]+\.md$/,
  /^proposals\/PROPOSAL_INDEX\.md$/,
];

export function classifyPath(relPath) {
  for (const p of PROJECT_LAYER_PATTERNS) if (p.test(relPath)) return 'project';
  for (const p of FRAMEWORK_LAYER_PATTERNS) if (p.test(relPath)) return 'framework';
  return 'unknown';
}

// -------- Utility --------
export function isAgentsDir(root) {
  // 簡易判定：含 rules/system-prompt.md 或至少 3 個 framework 標記檔
  const markers = ['rules', 'skills', 'RULES_DESIGN_GUIDE.md'];
  let hit = 0;
  for (const m of markers) if (existsSync(join(root, m))) hit++;
  return hit >= 2;
}

export function listAllFiles(root, rel = '') {
  const out = [];
  const full = join(root, rel);
  if (!existsSync(full)) return out;
  for (const entry of readdirSync(full)) {
    if (entry === '.git' || entry === 'node_modules' || entry.startsWith('.DS_')) continue;
    const relChild = rel ? `${rel}/${entry}` : entry;
    const abs = join(root, relChild);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) out.push(...listAllFiles(root, relChild));
    else if (st.isFile()) out.push(relChild);
  }
  return out;
}

export function hashFile(path) {
  try {
    const buf = readFileSync(path);
    return createHash('sha256').update(buf).digest('hex');
  } catch { return null; }
}

export function readVersion(root) {
  const path = join(root, 'FRAMEWORK_VERSION');
  if (!existsSync(path)) return '<無 FRAMEWORK_VERSION>';
  const text = readFileSync(path, 'utf-8');
  const m = text.match(/framework_version:\s*(\S+)/);
  const d = text.match(/release_date:\s*(\S+)/);
  return m ? `${m[1]}${d ? `（${d[1]}）` : ''}` : '<無版本號>';
}

// -------- Main --------
function main() {
  // CLI args 解析（main entry 內；便於測試 import 時不觸發）
  const args = process.argv.slice(2);
  let targetRoot = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) { targetRoot = resolve(args[++i]); }
  }
  if (!targetRoot) {
    console.error('Usage: node framework-diff.mjs --target <path-to-other-.agents>');
    process.exit(2);
  }
  return runDiff(targetRoot);
}

function runDiff(targetRoot) {
  // 結構驗證
  if (!isAgentsDir(LOCAL_AGENTS_ROOT)) {
    console.error(`❌ Local 目錄不是 .agents/ 結構: ${LOCAL_AGENTS_ROOT}`);
    process.exit(2);
  }
  if (!existsSync(targetRoot)) {
    console.error(`❌ Target 路徑不存在: ${targetRoot}`);
    process.exit(2);
  }
  if (!isAgentsDir(targetRoot)) {
    console.error(`❌ Target 目錄不是 .agents/ 結構: ${targetRoot}`);
    process.exit(2);
  }

  const localFiles = new Set(listAllFiles(LOCAL_AGENTS_ROOT));
  const targetFiles = new Set(listAllFiles(targetRoot));

  const localVer = readVersion(LOCAL_AGENTS_ROOT);
  const targetVer = readVersion(targetRoot);

  console.log('📂 Framework Layer Diff Report');
  console.log(`📍 Local:  ${LOCAL_AGENTS_ROOT}`);
  console.log(`📍 Target: ${targetRoot}`);
  console.log(`📅 Local  FRAMEWORK_VERSION: ${localVer}`);
  console.log(`📅 Target FRAMEWORK_VERSION: ${targetVer}`);
  console.log('');

  const newFiles = [];       // target 有、local 沒有（framework）
  const deletedFiles = [];   // local 有、target 沒有（framework）
  const modifiedFiles = [];  // 兩邊都有但內容不同（framework）
  const protectedFiles = []; // project_layer；不觸及
  const unknownFiles = [];   // 未分類（保守略過）

  const allPaths = new Set([...localFiles, ...targetFiles]);
  for (const rel of [...allPaths].sort()) {
    const cls = classifyPath(rel);
    if (cls === 'project') {
      protectedFiles.push(rel);
      continue;
    }
    if (cls === 'unknown') {
      unknownFiles.push(rel);
      continue;
    }

    const inLocal = localFiles.has(rel);
    const inTarget = targetFiles.has(rel);

    if (!inLocal && inTarget) newFiles.push(rel);
    else if (inLocal && !inTarget) deletedFiles.push(rel);
    else if (inLocal && inTarget) {
      const hL = hashFile(join(LOCAL_AGENTS_ROOT, rel));
      const hT = hashFile(join(targetRoot, rel));
      if (hL !== hT) modifiedFiles.push(rel);
    }
  }

  // -------- 輸出 5 類區塊 --------
  console.log(`✨ New Files (${newFiles.length})  [target 有、local 沒有]`);
  if (newFiles.length === 0) console.log('   (none)');
  for (const f of newFiles) console.log(`   + ${f}`);
  console.log('');

  console.log(`✏️  Modified Files (${modifiedFiles.length})  [內容不同]`);
  if (modifiedFiles.length === 0) console.log('   (none)');
  for (const f of modifiedFiles) console.log(`   ~ ${f}`);
  console.log('');

  console.log(`🗑️  Deleted Files (${deletedFiles.length})  [local 有、target 沒有；升級時可評估刪除]`);
  if (deletedFiles.length === 0) console.log('   (none)');
  for (const f of deletedFiles) console.log(`   - ${f}`);
  console.log('');

  console.log(`🔒 Protected Layer (${protectedFiles.length})  [project_layer；升級時不觸及]`);
  if (protectedFiles.length === 0) console.log('   (none)');
  for (const f of protectedFiles) console.log(`   🔒 ${f}`);
  console.log('');

  if (unknownFiles.length > 0) {
    console.log(`⚠️  Unknown / 未分類 (${unknownFiles.length})  [保守略過；升級時人工判斷]`);
    for (const f of unknownFiles) console.log(`   ? ${f}`);
    console.log('');
  }

  // -------- 建議合併指令 --------
  if (newFiles.length > 0 || modifiedFiles.length > 0) {
    console.log('📋 Recommended Merge Commands (User 審視後選擇性執行)');
    console.log('');
    for (const f of [...newFiles, ...modifiedFiles]) {
      const srcAbs = join(targetRoot, f);
      const dstAbs = join(LOCAL_AGENTS_ROOT, f);
      const dstDir = dirname(dstAbs);
      if (!existsSync(dstDir)) {
        console.log(`   mkdir -p "${relative(process.cwd(), dstDir)}"`);
      }
      console.log(`   cp "${relative(process.cwd(), srcAbs)}" "${relative(process.cwd(), dstAbs)}"`);
    }
    console.log('');
    console.log('⚠️  Post-merge Checks');
    console.log('   1. bash .agents/tests/run-all.sh');
    console.log('   2. node .agents/tests/workspace-schema-validator.mjs');
    console.log('   3. Review CHANGELOG.md for new proposals affecting workspace');
    console.log('   4. 參照 .agents/tasks/framework-upgrade-workflow.md 執行完整 8 步驟 SOP');
    console.log('');
  }

  // -------- Exit code --------
  const hasDiff = newFiles.length + modifiedFiles.length + deletedFiles.length > 0;
  if (hasDiff) {
    console.log('ℹ️  兩框架層有差異 → exit 1（正常升級情境）');
    process.exit(1);
  }
  console.log('✅ 兩框架層一致 → exit 0');
  process.exit(0);
}

// -------- CLI entry guard（依 PROPOSAL_20260423_006 Part 1）--------
// 允許 unit.test.mjs import 純函式而不觸發 main()
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) main();
