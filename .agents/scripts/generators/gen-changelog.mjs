#!/usr/bin/env node
// gen-changelog.mjs
// 從提案 markdown 自動產 CHANGELOG.md [vX.Y] 條目模板
// 依 PROPOSAL_20260423_007 Part 2 建立；純 Node.js 內建模組
//
// 使用：
//   node .agents/scripts/generators/gen-changelog.mjs --proposal <path>          # dry-run
//   node .agents/scripts/generators/gen-changelog.mjs --proposal <path> --write  # prepend 至 CHANGELOG
//
// 退出碼：
//   0 = 成功
//   2 = 錯誤

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, '..', '..'));
const CHANGELOG_PATH = join(AGENTS_ROOT, 'CHANGELOG.md');
const FRAMEWORK_VERSION_PATH = join(AGENTS_ROOT, 'FRAMEWORK_VERSION');

// -------- Pure functions（export for unit test）--------

export function parseProposalMetadata(content) {
  const meta = {};

  // 提案編號
  const idMatch = content.match(/提案編號[:：]\s*(\S+)/);
  meta.id = idMatch ? idMatch[1] : '<unknown>';

  // 標題（從第一個 H1 後的第一段或 §三 Part 第一行猜）
  const titleMatch = content.match(/^#\s*RULE_UPDATE_PROPOSAL\s*\n+##\s*基本資訊[\s\S]*?- 提案編號[\s\S]*?\n.*?執行摘要[（(]([\s\S]*?)[)）]/);
  // 簡化：直接從「執行摘要（X Part）」之後抓 1 行作標題
  const summaryMatch = content.match(/執行摘要[（(]\d+\s*Part[）)][:：]?([\s\S]*?)(?=\n##|\n---)/);
  meta.summary = summaryMatch ? summaryMatch[1].trim().split('\n')[0].trim() : '';

  // scope
  const scopeMatch = content.match(/scope[:：]\s*`?([a-z]+)`?/);
  meta.scope = scopeMatch ? scopeMatch[1] : 'framework';

  // 提案日期
  const dateMatch = content.match(/提案日期[:：]\s*(\d{4}-\d{2}-\d{2})/);
  meta.date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  // §三 Part 標題列表（Added 主要來源）
  const partRegex = /^###\s*\d+\.\d+\s+Part\s+(\d+)[：:]\s*(.+)$/gm;
  meta.parts = [];
  let m;
  while ((m = partRegex.exec(content)) !== null) {
    meta.parts.push({ num: m[1], title: m[2].trim() });
  }

  // 從基本資訊撈執行摘要 bullet（- **Part X**: ...）
  const bulletRegex = /^\s*-\s*\*\*Part\s+(\d+)\*\*[：:]\s*(.+)$/gm;
  meta.summaryBullets = [];
  while ((m = bulletRegex.exec(content)) !== null) {
    meta.summaryBullets.push({ num: m[1], desc: m[2].trim() });
  }

  return meta;
}

export function bumpVersion(current, type = 'minor') {
  const m = current.match(/^v(\d+)\.(\d+)$/);
  if (!m) throw new Error(`Invalid version format: "${current}" (expected vX.Y)`);
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  if (type === 'minor') return `v${major}.${minor + 1}`;
  if (type === 'major') return `v${major + 1}.0`;
  throw new Error(`Unknown bump type: ${type} (expected minor|major)`);
}

export function readFrameworkVersion(frameworkVersionPath) {
  if (!existsSync(frameworkVersionPath)) return 'v1.0';
  const content = readFileSync(frameworkVersionPath, 'utf-8');
  const m = content.match(/framework_version[:：]\s*(v\d+\.\d+)/);
  return m ? m[1] : 'v1.0';
}

export function buildChangelogEntry(proposal, version) {
  const lines = [];
  lines.push(`## [${version}] - ${proposal.date}`);
  lines.push('');
  lines.push('### Added');
  lines.push(`- **${proposal.id}**：${proposal.summary || '<請填寫一句話摘要>'}`);

  // 從 §三 Part 撈
  if (proposal.parts.length > 0) {
    for (const p of proposal.parts) {
      lines.push(`  - Part ${p.num}: ${p.title}`);
    }
  } else if (proposal.summaryBullets.length > 0) {
    for (const b of proposal.summaryBullets) {
      lines.push(`  - Part ${b.num}: ${b.desc}`);
    }
  }

  lines.push('');
  lines.push('### Changed');
  lines.push(`- <請 @Lead 填寫實際變更檔案 / 版本 bump>`);
  lines.push('');
  lines.push('### Notes');
  lines.push('- <請 @Lead 填寫設計原則 / 對偶 / 警告等內容判斷段落>');

  return lines.join('\n');
}

export function prependEntryToChangelog(changelogContent, entry) {
  // 在第一個 `## [v` 之前插入新 entry
  const pattern = /(\n)(## \[v\d+\.\d+\])/;
  if (!pattern.test(changelogContent)) {
    // 若無既有 [vX.Y] 條目（罕見）→ 在 `# Framework Changelog` 之後插入
    return changelogContent.replace(/(# Framework Changelog\s*\n)/, `$1\n${entry}\n\n---\n\n`);
  }
  return changelogContent.replace(pattern, `\n${entry}\n\n---\n$1$2`);
}

// -------- CLI entry guard --------

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  let proposalPath = null;
  let writeMode = false;
  let checkMode = false;
  let bumpType = 'minor';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--proposal' && args[i + 1]) proposalPath = args[++i];
    else if (args[i] === '--write') writeMode = true;
    else if (args[i] === '--check') checkMode = true;
    else if (args[i] === '--bump' && args[i + 1]) bumpType = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node gen-changelog.mjs --proposal <path> [--write | --check] [--bump minor|major]');
      process.exit(0);
    }
  }

  if (!proposalPath) {
    console.error('❌ --proposal <path> 為必填');
    console.error('Usage: node gen-changelog.mjs --proposal <path> [--write | --check] [--bump minor|major]');
    process.exit(2);
  }

  if (!existsSync(proposalPath)) {
    console.error(`❌ 提案檔案不存在: ${proposalPath}`);
    process.exit(2);
  }

  const proposalContent = readFileSync(proposalPath, 'utf-8');
  const proposal = parseProposalMetadata(proposalContent);

  const currentVersion = readFrameworkVersion(FRAMEWORK_VERSION_PATH);
  const newVersion = bumpVersion(currentVersion, bumpType);

  const entry = buildChangelogEntry(proposal, newVersion);

  if (checkMode) {
    if (!existsSync(CHANGELOG_PATH)) {
      console.error(`❌ ${CHANGELOG_PATH} 不存在`);
      process.exit(1);
    }
    const changelogContent = readFileSync(CHANGELOG_PATH, 'utf-8');
    const hasProposalEntry = changelogContent.includes(proposal.id) && changelogContent.includes(`[${newVersion}]`);
    if (hasProposalEntry) {
      console.log(`✅ IN_SYNC: CHANGELOG 含 ${proposal.id} + [${newVersion}] 條目`);
      process.exit(0);
    }
    console.error(`❌ DRIFT: CHANGELOG 缺 ${proposal.id} 或 [${newVersion}] 條目`);
    process.exit(1);
  }

  if (writeMode) {
    if (!existsSync(CHANGELOG_PATH)) {
      console.error(`❌ ${CHANGELOG_PATH} 不存在`);
      process.exit(2);
    }
    const changelogContent = readFileSync(CHANGELOG_PATH, 'utf-8');
    const updated = prependEntryToChangelog(changelogContent, entry);
    writeFileSync(CHANGELOG_PATH, updated);
    console.log(`✅ CHANGELOG.md 已 prepend [${newVersion}] 條目（請 @Lead 檢視 Notes 段落）`);
    process.exit(0);
  }

  console.log('--- CHANGELOG entry（dry-run）---\n');
  console.log(entry);
  console.log(`\n（提案: ${proposal.id} → 版本: ${currentVersion} → ${newVersion}; --write 實寫 / --check 驗證條目）`);
}
