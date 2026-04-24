#!/usr/bin/env node
// gen-proposal-index.mjs
// 自動更新 PROPOSAL_INDEX.md 三個機械性區塊：統計摘要 / OPEN 列表 / IN_PROGRESS 列表
// 不動：DONE / §🔗 意圖繼承 / CANCELLED / ARCHIVED（屬內容判斷或歷史紀錄）
// 依 PROPOSAL_20260423_007 Part 3 建立；純 Node.js 內建模組
//
// 使用：
//   node .agents/scripts/generators/gen-proposal-index.mjs           # dry-run
//   node .agents/scripts/generators/gen-proposal-index.mjs --write   # 替換 AUTO-GENERATED 標記區塊
//
// 退出碼：
//   0 = 成功
//   2 = 錯誤

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceBlock, checkDrift, hasBlock } from './lib/auto-generated-block.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, '..', '..'));
const PROPOSALS_DIR = join(AGENTS_ROOT, 'proposals');
const INDEX_PATH = join(PROPOSALS_DIR, 'PROPOSAL_INDEX.md');
const ACTIVE_DIR = join(PROPOSALS_DIR, 'active');
const COMPLETED_DIR = join(PROPOSALS_DIR, 'completed');
const ARCHIVED_DIR = join(PROPOSALS_DIR, 'archived');

// -------- Pure functions（export for unit test）--------

export function parseProposalStatus(content) {
  // 從基本資訊區塊撈「狀態：DONE / OPEN / IN_PROGRESS / CANCELLED」
  // 支援 markdown 粗體 / 斜體（**CANCELLED** / _DONE_）— 依 PROPOSAL_20260423_012 §3.5
  // 狀態 token 限定 [A-Z] 與 `_`（避免 markdown 標記被 \w 吞入）
  const match = content.match(/^-\s*狀態[:：]\s*(?:\*\*|__|_|\*)?([A-Z]+(?:_[A-Z]+)*)(?:\*\*|__|_|\*)?/m);
  return match ? match[1] : 'UNKNOWN';
}

export function parseProposalTitle(content) {
  // 優先順序（依 PROPOSAL_20260423_012 Phase B 增強）：
  // 1. frontmatter `title:` 欄位
  // 2. 執行摘要 Part 1 標題
  // 3. 第一個 `# PROPOSAL_...` heading 冒號後文字
  // 4. fallback

  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const titleMatch = fm[1].match(/^title:\s*(.+?)$/m);
    if (titleMatch) return titleMatch[1].replace(/^["']|["']$/g, '').trim().substring(0, 120);
  }

  const summaryMatch = content.match(/執行摘要[（(]\d+\s*Part[）)][:：]?\s*\n\s*-\s*\*\*Part\s+1\*\*[:：]\s*(.+)/);
  if (summaryMatch) return summaryMatch[1].trim().substring(0, 120);

  const h1Match = content.match(/^#\s+PROPOSAL_\d+_\d+[:：]\s*(.+?)$/m);
  if (h1Match) return h1Match[1].trim().substring(0, 120);

  return '<unknown title>';
}

export function parseProposalMeta(content, filename) {
  const idMatch = filename.match(/^(PROPOSAL_\d+_\d+)/);
  const priorityMatch = content.match(/^-\s*優先級[:：]\s*\*?\*?(P\d+)\*?\*?/m);
  const dateMatch = content.match(/^-\s*提案日期[:：]\s*(\d{4}-\d{2}-\d{2})/m);
  const dependsMatch = content.match(/^-\s*前置依賴[:：]\s*\n([\s\S]*?)(?=\n-\s+|\n##)/m);
  return {
    id: idMatch ? idMatch[1] : filename.replace('.md', ''),
    title: parseProposalTitle(content),
    priority: priorityMatch ? priorityMatch[1] : 'P?',
    date: dateMatch ? dateMatch[1] : '<unknown>',
    depends: dependsMatch ? dependsMatch[1].trim().split('\n')[0].replace(/^\s*-\s*/, '').substring(0, 60) : '無',
  };
}

export function scanProposals(activeDir, completedDir, archivedDir) {
  const filterMd = (dir) => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(f => f.endsWith('.md') && f !== '.gitkeep');
  };

  const activeFiles = filterMd(activeDir);
  const completedFiles = filterMd(completedDir);
  const archivedFiles = filterMd(archivedDir);

  const openProposals = [];
  const inProgressProposals = [];
  for (const f of activeFiles) {
    const content = readFileSync(join(activeDir, f), 'utf-8');
    const status = parseProposalStatus(content);
    const meta = parseProposalMeta(content, f);
    if (status === 'OPEN') openProposals.push(meta);
    else if (status === 'IN_PROGRESS') inProgressProposals.push(meta);
  }

  // 區分 DONE / CANCELLED（從檔案標題或內文判斷；簡化：完成於 completed/ 但未取消視為 DONE）
  let cancelledCount = 0;
  let doneCount = 0;
  for (const f of completedFiles) {
    const content = readFileSync(join(completedDir, f), 'utf-8');
    const status = parseProposalStatus(content);
    if (status === 'CANCELLED') cancelledCount++;
    else doneCount++;
  }

  return {
    counts: {
      OPEN: openProposals.length,
      IN_PROGRESS: inProgressProposals.length,
      DONE: doneCount,
      CANCELLED: cancelledCount,
      ARCHIVED: archivedFiles.length,
      total: openProposals.length + inProgressProposals.length + completedFiles.length + archivedFiles.length,
    },
    openProposals,
    inProgressProposals,
  };
}

export function buildStatsTable(counts) {
  return `| 狀態 | 數量 | 目錄位置 |
|------|------|---------|
| OPEN | ${counts.OPEN} | \`active/\` |
| IN_PROGRESS | ${counts.IN_PROGRESS} | \`active/\` |
| DONE | ${counts.DONE} | \`completed/\` |
| CANCELLED | ${counts.CANCELLED} | \`completed/\` |
| ARCHIVED | ${counts.ARCHIVED} | \`archived/\` |
| **合計** | **${counts.total}** | — |`;
}

export function buildOpenTable(proposals) {
  const lines = [
    '| 編號 | 標題 | 優先級 | 提案日期 | 前置依賴 |',
    '|------|------|-------|---------|---------|',
  ];
  if (proposals.length === 0) {
    lines.push('| — | （目前無待執行項目）| — | — | — |');
  } else {
    for (const p of proposals) {
      lines.push(`| ${p.id} | ${p.title} | ${p.priority} | ${p.date} | ${p.depends} |`);
    }
  }
  return lines.join('\n');
}

export function buildInProgressTable(proposals) {
  const lines = [
    '| 編號 | 標題 | 優先級 | 開始日期 | 預計完成 |',
    '|------|------|-------|---------|---------|',
  ];
  if (proposals.length === 0) {
    lines.push('| — | （目前無執行中項目）| — | — | — |');
  } else {
    for (const p of proposals) {
      lines.push(`| ${p.id} | ${p.title} | ${p.priority} | ${p.date} | <由 @Lead 填寫> |`);
    }
  }
  return lines.join('\n');
}

// -------- CLI entry guard --------

const BLOCKS = {
  stats: (r) => buildStatsTable(r.counts),
  open_list: (r) => buildOpenTable(r.openProposals),
  in_progress_list: (r) => buildInProgressTable(r.inProgressProposals),
};

// -------- Workspace-aware path resolution（依 PROPOSAL_20260423_015 Phase B）--------

export function resolveProposalPaths(agentsRoot, workspaceName) {
  if (workspaceName) {
    const wsBase = join(agentsRoot, 'workspaces', workspaceName, 'proposals');
    return {
      indexPath: join(wsBase, 'PROPOSAL_INDEX.md'),
      activeDir: join(wsBase, 'active'),
      completedDir: join(wsBase, 'completed'),
      archivedDir: join(wsBase, 'archived'),
      area: 'project',
    };
  }
  return {
    indexPath: INDEX_PATH,
    activeDir: ACTIVE_DIR,
    completedDir: COMPLETED_DIR,
    archivedDir: ARCHIVED_DIR,
    area: 'framework',
  };
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  const writeMode = args.includes('--write');
  const checkMode = args.includes('--check');
  const workspaceArgIdx = args.indexOf('--workspace');
  const workspaceName = workspaceArgIdx >= 0 ? args[workspaceArgIdx + 1] : null;

  const paths = resolveProposalPaths(AGENTS_ROOT, workspaceName);

  if (workspaceName && !existsSync(paths.activeDir)) {
    console.error(`❌ Workspace '${workspaceName}' not found (${paths.activeDir})`);
    process.exit(2);
  }

  const result = scanProposals(paths.activeDir, paths.completedDir, paths.archivedDir);
  const INDEX_PATH_EFFECTIVE = paths.indexPath;

  if (!writeMode && !checkMode) {
    console.log(`=== [${paths.area}${workspaceName ? `:${workspaceName}` : ''}] 統計摘要 ===\n`);
    console.log(BLOCKS.stats(result));
    console.log('\n=== OPEN 列表 ===\n');
    console.log(BLOCKS.open_list(result));
    console.log('\n=== IN_PROGRESS 列表 ===\n');
    console.log(BLOCKS.in_progress_list(result));
    console.log('\n（dry-run；--write 實寫 / --check 比對 drift；--workspace <name> 掃專案區）');
    process.exit(0);
  }

  if (checkMode) {
    const content = readFileSync(INDEX_PATH_EFFECTIVE, 'utf-8');
    let totalDrift = 0;
    for (const [name, builder] of Object.entries(BLOCKS)) {
      const expected = builder(result);
      const res = checkDrift(content, name, expected);
      if (res.drift) {
        totalDrift++;
        console.error(`❌ DRIFT [${name}]: ${res.reason}`);
        if (res.reason === 'CONTENT_DIFFERS') {
          console.error(`--- current ---\n${res.current}\n--- expected ---\n${res.expected}\n`);
        }
      } else {
        console.log(`✅ IN_SYNC [${name}]`);
      }
    }
    process.exit(totalDrift === 0 ? 0 : 1);
  }

  if (writeMode) {
    if (!existsSync(INDEX_PATH_EFFECTIVE)) {
      console.error(`❌ INDEX file not found: ${INDEX_PATH_EFFECTIVE}`);
      process.exit(2);
    }
    let content = readFileSync(INDEX_PATH_EFFECTIVE, 'utf-8');
    const missing = [];
    for (const name of Object.keys(BLOCKS)) {
      if (!hasBlock(content, name)) missing.push(name);
    }
    if (missing.length) {
      console.error(`❌ AUTO-GENERATED markers missing: ${missing.join(', ')}`);
      console.error(`   請於 ${INDEX_PATH_EFFECTIVE} 先加入 <!-- AUTO-GENERATED:BEGIN <name> --> / <!-- AUTO-GENERATED:END <name> --> 標記`);
      process.exit(2);
    }
    for (const [name, builder] of Object.entries(BLOCKS)) {
      content = replaceBlock(content, name, builder(result));
    }
    writeFileSync(INDEX_PATH_EFFECTIVE, content, 'utf-8');
    console.log(`✅ ${INDEX_PATH_EFFECTIVE.replace(AGENTS_ROOT + '/', '')} 已更新（${Object.keys(BLOCKS).length} 區塊 / area=${paths.area}）`);
    process.exit(0);
  }
}
