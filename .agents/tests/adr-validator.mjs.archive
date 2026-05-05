#!/usr/bin/env node
// adr-validator.mjs
// 驗證規則層（rules/ + skills/ + tasks/ + RULES_DESIGN_GUIDE 家族）的 PROPOSAL 引用清理狀態
// 依 PROPOSAL_20260423_016 Batch 1 建立
//
// 三類引用（對齐 PROPOSAL_20260423_016 §1）：
//   Type A: frontmatter `last_proposal`         → 保留（audit trail）
//   Type B: 內文「（依 PROPOSAL_XXX）」標頭     → 應移除（Batch 2 清理）
//   Type C: 規則條款嵌入 PROPOSAL_XXX 編號     → 應改指 ADR（Batch 4-5 清理）
//
// 退出碼：
//   0 = 合規（無 Type B / C 殘留；或強制模式未啟用）
//   1 = 有違規（僅在 --strict 模式下）
//
// 模式：
//   預設 warning：只報告違規數，不阻斷
//   --strict：違規 → exit 1（Batch 6 後啟用為 run-all.sh 一員）

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, '..'));

const SCAN_DIRS = [
  'rules',
  'skills',
  'tasks',
];

const SCAN_ROOT_FILES = [
  'RULES_DESIGN_GUIDE.md',
  'RULES_DESIGN_GUIDE.DESIGN.md',
  'RULES_DESIGN_GUIDE.SCOPE.md',
  'RULES_DESIGN_GUIDE.QUALITY.md',
  'RULES_METADATA_SCHEMA.md',
];

// -------- Pure helpers --------

export function stripFrontmatter(content) {
  // 去 YAML frontmatter
  let out = content;
  const fmMatch = out.match(/^---\n[\s\S]*?\n---\n/);
  if (fmMatch) out = out.slice(fmMatch[0].length);
  // 去 ADR-0022 版本標頭 `***...***`（含 last_proposal 等 metadata；應視為 frontmatter 延伸）
  out = out.replace(/\n\*\*\*\n[\s\S]*?\n\*\*\*\n/, '\n');
  return out;
}

/**
 * 移除合法 audit trail 區塊（不計為違規）：
 * - AUTO-GENERATED 區塊（依 ADR-0025；索引自動產生）
 * - Related Decisions footer（ADR 連結區）
 * - Related Proposals（ADR 溯源區；ADR 本身）
 * - Referenced By（ADR 反向索引；ADR 本身）
 * - §🔗 提案意圖繼承關係 表（依 ADR-0020；設計要求）
 * - TOC 章節映射表（RULES_DESIGN_GUIDE orchestrator；依 ADR-0018）
 * - 相容層（orchestrator；依 ADR-0018）
 * - Code blocks（```...```；範例內容不計）
 */
export function stripLegitimateContent(content) {
  let out = content;
  // AUTO-GENERATED 區塊
  out = out.replace(/<!--\s*AUTO-GENERATED:BEGIN[\s\S]*?AUTO-GENERATED:END\s+\w+\s*-->/g, '');
  // Related Decisions section (文末 footer)
  out = out.replace(/##\s+Related Decisions[\s\S]*$/, '');
  // Related Proposals section (ADR 內部)
  out = out.replace(/##\s+Related Proposals[\s\S]*?(?=\n##\s|\n---\n|$)/g, '');
  // Referenced By section (ADR 內部)
  out = out.replace(/##\s+Referenced By[\s\S]*?(?=\n##\s|\n---\n|$)/g, '');
  // §🔗 意圖繼承關係 section
  out = out.replace(/##\s+🔗\s+提案意圖繼承關係[\s\S]*?(?=\n##\s|$)/g, '');
  // 章節索引 TOC 表（orchestrator）
  out = out.replace(/##\s+章節索引[\s\S]*?(?=\n##\s|$)/g, '');
  // 相容層
  out = out.replace(/##\s+相容層[\s\S]*?(?=\n##\s|$)/g, '');
  // 溯源 section (ADR / 某些文件)
  out = out.replace(/##\s+溯源[\s\S]*?(?=\n##\s|$)/g, '');
  // Fenced code blocks
  out = out.replace(/```[\s\S]*?```/g, '');
  // Inline code blocks (`...`) — 範例 ID 通常包於反引號內
  out = out.replace(/`[^`\n]*`/g, '');
  return out;
}

// 真實 PROPOSAL ID 精確 pattern（排除 PROPOSAL_INDEX / PROPOSAL_ID / 常數名）
//   新格式：PROPOSAL_YYYYMMDD_NNN；舊格式：PROPOSAL-NNN
const PROPOSAL_ID_PATTERN = /PROPOSAL_\d{8}_\d{3}|PROPOSAL-\d{3}/g;
const TYPE_B_PATTERN = /（依\s*(?:PROPOSAL_\d{8}_\d{3}|PROPOSAL-\d{3})[^）]*）|\(依\s*(?:PROPOSAL_\d{8}_\d{3}|PROPOSAL-\d{3})[^)]*\)/g;

export function countProposalReferences(content) {
  // 兩層過濾：frontmatter/版本標頭 + 合法內容
  const body = stripLegitimateContent(stripFrontmatter(content));

  // Type B: 括號註記「（依 PROPOSAL_XXX）」
  const typeB = body.match(TYPE_B_PATTERN) || [];

  // 所有 body 中的真實 PROPOSAL ID 引用（包含 Type B 括號內的）
  const allBodyRefs = body.match(PROPOSAL_ID_PATTERN) || [];

  // Type B 括號內的 PROPOSAL ID 數量
  const typeBInnerRefs = typeB.join('').match(PROPOSAL_ID_PATTERN) || [];

  // Type C = 全部 body 引用 - Type B 內的引用
  const typeC = Math.max(0, allBodyRefs.length - typeBInnerRefs.length);

  // Type A (frontmatter) 只計真實 ID
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const typeA = fmMatch ? (fmMatch[1].match(PROPOSAL_ID_PATTERN) || []).length : 0;

  return {
    typeA,
    typeB_count: typeB.length,
    typeC_residual: typeC,
    total_body_refs: allBodyRefs.length,
  };
}

export function scanFile(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, 'utf-8');
  return { path: filePath, ...countProposalReferences(content) };
}

export function scanDir(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const stat = statSync(p);
    if (stat.isFile() && f.endsWith('.md')) {
      const r = scanFile(p);
      if (r) results.push(r);
    }
  }
  return results;
}

// -------- CLI --------

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const strict = process.argv.includes('--strict');
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  console.log('🔍 ADR Validator (PROPOSAL_20260423_016)');
  console.log(`Mode: ${strict ? 'STRICT（違規阻斷）' : 'WARNING（僅報告）'}\n`);

  let allResults = [];

  for (const d of SCAN_DIRS) {
    const results = scanDir(join(AGENTS_ROOT, d));
    allResults.push(...results);
  }
  for (const f of SCAN_ROOT_FILES) {
    const r = scanFile(join(AGENTS_ROOT, f));
    if (r) allResults.push(r);
  }

  const totals = {
    typeA: 0,
    typeB: 0,
    typeC: 0,
    filesWithViolations: 0,
  };

  const violators = [];

  for (const r of allResults) {
    totals.typeA += r.typeA;
    totals.typeB += r.typeB_count;
    totals.typeC += r.typeC_residual;
    if (r.typeB_count > 0 || r.typeC_residual > 0) {
      totals.filesWithViolations++;
      violators.push(r);
    }
  }

  // Summary
  console.log('📊 引用統計：');
  console.log(`  Type A（frontmatter audit trail；保留）：${totals.typeA}`);
  console.log(`  Type B（內文標頭；應 Batch 2 清理）：${totals.typeB}`);
  console.log(`  Type C（規則條款嵌入；應 Batch 4-5 清理）：${totals.typeC}`);
  console.log(`  有違規的檔案數：${totals.filesWithViolations} / ${allResults.length}`);

  if (verbose && violators.length > 0) {
    console.log('\n違規詳情（前 10）：');
    for (const v of violators.slice(0, 10)) {
      const rel = v.path.replace(AGENTS_ROOT + '/', '');
      console.log(`  ${rel}: B=${v.typeB_count}, C=${v.typeC_residual}`);
    }
  }

  console.log('');
  const hasViolations = totals.typeB > 0 || totals.typeC > 0;

  if (!hasViolations) {
    console.log('✅ ADR Validator: 規則層已完全去 PROPOSAL 引用化');
    process.exit(0);
  }

  if (strict) {
    console.error(`❌ ADR Validator: 發現 ${totals.typeB + totals.typeC} 處 Type B/C 引用（strict mode）`);
    console.error('   修復路徑：');
    console.error('   - Type B：移至檔案底部「Related Decisions」footer');
    console.error('   - Type C：重寫為自我解釋條款 + 指向 ADR');
    process.exit(1);
  }

  console.log(`⚠️  ADR Validator: 發現 ${totals.typeB + totals.typeC} 處引用待清理（warning mode）`);
  console.log('   預計於 PROPOSAL_20260423_016 Batch 2-5 完成');
  process.exit(0);
}
