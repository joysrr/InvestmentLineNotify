#!/usr/bin/env node
// gen-proposal-summary.mjs
// 產生季度 / 區間提案摘要（依 PROPOSAL_20260423_015 Phase C）
//
// 使用：
//   node gen-proposal-summary.mjs --period 2026Q2 [--write]
//   node gen-proposal-summary.mjs --range PROPOSAL_20260420_001:PROPOSAL_20260423_015 [--write]
//   node gen-proposal-summary.mjs --workspace <name> --period 2026Q2 [--write]

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, '..', '..'));

// -------- Pure helpers --------

export function parseProposalFile(path) {
  const content = readFileSync(path, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = fmMatch ? fmMatch[1] : '';

  const get = (key) => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+?)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  };

  const h1 = content.match(/^#\s+(PROPOSAL_\d+_\d+)[:：]\s*(.+?)$/m);
  const bulletTitle = content.match(/^-\s+提案編號[:：]\s*\*?\*?(PROPOSAL_\d+_\d+)/m);

  // File name → id fallback
  const filename = path.split('/').pop().replace(/\.md$/, '');
  const id = get('id') || (h1 ? h1[1] : null) || (bulletTitle ? bulletTitle[1] : null) || filename;

  const title = get('title') || (h1 ? h1[2].trim() : '<unknown>');

  const tier = get('tier') || 'full';
  const scope = get('scope') || 'unknown';
  const date = get('date') || extractDateFromId(id);
  const priority = get('priority') || extractPriority(content);

  const affectedFiles = extractAffectedFiles(content);
  const themeKeywords = extractThemeKeywords(content);

  return { id, title, tier, scope, date, priority, affectedFiles, themeKeywords, path };
}

function extractDateFromId(id) {
  if (!id) return null;
  const m = id.match(/PROPOSAL_(\d{4})(\d{2})(\d{2})_/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function extractPriority(content) {
  const m = content.match(/優先級[:：]\s*\*?\*?(P\d+)/);
  return m ? m[1] : 'P?';
}

function extractAffectedFiles(content) {
  const files = new Set();
  for (const line of content.split('\n').slice(0, 200)) {
    for (const m of line.matchAll(/\.agents\/[a-zA-Z0-9_.\/-]+\.(md|mjs|sh|yaml|yml)/g)) {
      files.add(m[0]);
    }
  }
  return [...files].slice(0, 5);
}

function extractThemeKeywords(content) {
  // 只掃標題 + §一(問題) + §三(提案內容) 區段；避免觸及引用池與 §備註 造成假陽性
  const headPart = content.slice(0, 5000);
  const themes = [];
  // 每個主題需要 ≥2 次匹配才計入（避免單次引用造成誤判）
  const patterns = [
    { rx: /validator|驗證器|自動偵測/gi, tag: 'validator', min: 3 },
    { rx: /generator|產生器|生成器|--write|--check/gi, tag: 'generator', min: 3 },
    { rx: /hotfix|緊急修復|事故|complexity_tier/gi, tag: 'hotfix', min: 3 },
    { rx: /workspace|專案特化|project-specific/gi, tag: 'workspace', min: 4 },
    { rx: /scope.*分層|framework.*vs.*project|scope: (framework|project)/gi, tag: 'scope-tier', min: 3 },
    { rx: /HITL|人工介入|Human-in-the-loop/gi, tag: 'HITL', min: 3 },
    { rx: /token.*預算|token.*budget|TOKEN_/gi, tag: 'token-budget', min: 2 },
    { rx: /@Security|SC-0[1-9]|SC-10|資安審查/gi, tag: 'security', min: 3 },
    { rx: /@Auditor|drift_score|5 維度評分/gi, tag: 'audit', min: 3 },
    { rx: /@Retro|根因|RULE_UPDATE_PROPOSAL/gi, tag: 'retro', min: 3 },
    { rx: /lite.*proposal|輕量.*提案|Lite Proposal|Full Proposal/gi, tag: 'proposal-tier', min: 3 },
    { rx: /RULES_DESIGN_GUIDE.*拆|design.*scope.*quality|orchestrator/gi, tag: 'design-guide-split', min: 2 },
    { rx: /skills\/|tasks\/|tech-stacks\//g, tag: 'content-layer', min: 5 },
    { rx: /pre-commit|AUTO-GENERATED|SOP/gi, tag: 'enforcement', min: 3 },
  ];
  for (const { rx, tag, min } of patterns) {
    const matches = headPart.match(rx);
    if (matches && matches.length >= min) themes.push(tag);
  }
  return themes;
}

export function dateInPeriod(date, period) {
  if (!date) return false;
  const [y, m] = date.split('-').map(Number);
  const qMatch = period.match(/^(\d{4})Q([1-4])$/);
  if (qMatch) {
    const py = Number(qMatch[1]);
    const pq = Number(qMatch[2]);
    if (y !== py) return false;
    const qStart = (pq - 1) * 3 + 1;
    return m >= qStart && m < qStart + 3;
  }
  const ymMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    return y === Number(ymMatch[1]) && m === Number(ymMatch[2]);
  }
  return false;
}

export function idInRange(id, rangeStr) {
  const [start, end] = rangeStr.split(':');
  if (!start || !end) return false;
  return id >= start && id <= end;
}

function scanSource(scope, workspaceName) {
  const dirs = [];
  if (scope === 'framework') {
    dirs.push(
      join(AGENTS_ROOT, 'proposals', 'active'),
      join(AGENTS_ROOT, 'proposals', 'completed'),
      join(AGENTS_ROOT, 'proposals', 'archived'),
    );
  } else if (scope === 'project' && workspaceName) {
    dirs.push(
      join(AGENTS_ROOT, 'workspaces', workspaceName, 'proposals', 'active'),
      join(AGENTS_ROOT, 'workspaces', workspaceName, 'proposals', 'completed'),
      join(AGENTS_ROOT, 'workspaces', workspaceName, 'proposals', 'archived'),
    );
  }
  const results = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.startsWith('PROPOSAL_') || !f.endsWith('.md')) continue;
      results.push(parseProposalFile(join(dir, f)));
    }
  }
  return results;
}

export function filterProposals(all, { period, range }) {
  if (period) return all.filter(p => dateInPeriod(p.date, period));
  if (range) return all.filter(p => idInRange(p.id, range));
  return all;
}

export function groupByTheme(proposals) {
  const groups = {};
  for (const p of proposals) {
    const tags = p.themeKeywords.length > 0 ? p.themeKeywords : ['other'];
    for (const t of tags) {
      if (!groups[t]) groups[t] = [];
      groups[t].push(p.id);
    }
  }
  return groups;
}

export function buildSummary({ period, range, scope, workspaceName, proposals }) {
  const sorted = [...proposals].sort((a, b) => a.id.localeCompare(b.id));
  const themeGroups = groupByTheme(sorted);

  const majorBumps = sorted.filter(p =>
    /拆檔|v\d+\.0.*→|重大結構|major/i.test(p.title)
  );

  const tierCounts = { full: 0, lite: 0, unknown: 0 };
  for (const p of sorted) tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;

  const header = [
    '---',
    `period: ${period || range || 'all'}`,
    `scope: ${scope}`,
    workspaceName ? `workspace: ${workspaceName}` : null,
    `generated: ${new Date().toISOString().split('T')[0]}`,
    `total: ${sorted.length}`,
    `tier_full: ${tierCounts.full}`,
    `tier_lite: ${tierCounts.lite}`,
    `proposal_range: ${sorted.length > 0 ? `${sorted[0].id} ~ ${sorted.at(-1).id}` : 'empty'}`,
    '---',
  ].filter(Boolean).join('\n');

  const lines = [header, '', `# 提案摘要：${period || range || 'all'}（scope: ${scope}${workspaceName ? ` / ${workspaceName}` : ''}）`, ''];

  lines.push('## 概觀', '');
  lines.push(`- **總數**：${sorted.length} 份（Full: ${tierCounts.full} / Lite: ${tierCounts.lite}）`);
  if (majorBumps.length > 0) {
    lines.push(`- **重大變更**：${majorBumps.length} 份`);
  }
  lines.push('');

  lines.push('## 主題聚合', '');
  const sortedThemes = Object.entries(themeGroups).sort((a, b) => b[1].length - a[1].length);
  lines.push('| 主題 | 提案數 | 成員 |');
  lines.push('|------|-------|------|');
  for (const [theme, ids] of sortedThemes) {
    const shortIds = ids.map(id => id.replace(/^PROPOSAL_/, '')).join(', ');
    lines.push(`| \`${theme}\` | ${ids.length} | ${shortIds} |`);
  }
  lines.push('');

  if (majorBumps.length > 0) {
    lines.push('## 關鍵變更 Highlight', '');
    for (const p of majorBumps) {
      lines.push(`### ${p.id}：${p.title}`);
      lines.push(`- 日期：${p.date} / 優先級：${p.priority} / tier：${p.tier}`);
      if (p.affectedFiles.length > 0) {
        lines.push(`- 主要檔案：${p.affectedFiles.slice(0, 3).join(' / ')}`);
      }
      lines.push('');
    }
  }

  lines.push('## 逐份摘要', '');
  lines.push('| ID | Title | Date | Priority | Tier | Themes |');
  lines.push('|----|-------|------|----------|------|--------|');
  for (const p of sorted) {
    const idShort = p.id.replace(/^PROPOSAL_/, '');
    const titleShort = (p.title || '').substring(0, 60);
    const themes = p.themeKeywords.slice(0, 3).join(', ') || '—';
    lines.push(`| ${idShort} | ${titleShort} | ${p.date || '?'} | ${p.priority} | ${p.tier} | ${themes} |`);
  }
  lines.push('');

  lines.push('## 跨提案主題鏈', '');
  lines.push('（手動維護；列出具語意繼承關係的提案組合）');
  lines.push('');
  lines.push('- 參見 `PROPOSAL_INDEX.md §🔗 提案意圖繼承關係` 完整圖譜');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(`生成工具：\`scripts/generators/gen-proposal-summary.mjs\`（PROPOSAL_20260423_015 Phase C）`);

  return lines.join('\n');
}

// -------- CLI --------

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  let period = null, range = null, writeMode = false, workspaceName = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--period' && args[i + 1]) period = args[++i];
    else if (args[i] === '--range' && args[i + 1]) range = args[++i];
    else if (args[i] === '--workspace' && args[i + 1]) workspaceName = args[++i];
    else if (args[i] === '--write') writeMode = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node gen-proposal-summary.mjs [--period 2026Q2 | --range ID1:ID2] [--workspace <name>] [--write]');
      process.exit(0);
    }
  }

  if (!period && !range) {
    console.error('❌ 需指定 --period YYYYQN / YYYY-MM 或 --range ID1:ID2');
    process.exit(2);
  }

  const scope = workspaceName ? 'project' : 'framework';
  const all = scanSource(scope, workspaceName);
  const proposals = filterProposals(all, { period, range });

  console.log(`📊 Found ${proposals.length} proposals (scope=${scope}${workspaceName ? `, workspace=${workspaceName}` : ''})`);

  const summary = buildSummary({ period, range, scope, workspaceName, proposals });

  if (writeMode) {
    const summariesDir = workspaceName
      ? join(AGENTS_ROOT, 'workspaces', workspaceName, 'proposals', 'summaries')
      : join(AGENTS_ROOT, 'proposals', 'summaries');
    if (!existsSync(summariesDir)) mkdirSync(summariesDir, { recursive: true });

    const fname = `SUMMARY_${period || range.replace(/[:]/g, '_')}.md`;
    const outPath = join(summariesDir, fname);
    writeFileSync(outPath, summary, 'utf-8');
    console.log(`✅ ${outPath.replace(AGENTS_ROOT + '/', '')} 已產生（${proposals.length} 份提案）`);
  } else {
    console.log('\n--- Summary preview (dry-run) ---\n');
    console.log(summary);
    console.log('\n（dry-run；--write 實寫至 proposals/summaries/）');
  }
}
