#!/usr/bin/env node
// proposal-intent-consistency.mjs — 驗證 PROPOSAL_INDEX.md §🔗 意圖繼承表完整性
// 依 PROPOSAL_20260422_007 + 009 + 014 建立
// 使用：node .agents/tests/proposal-intent-consistency.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_FILE = join(__dirname, '../proposals/PROPOSAL_INDEX.md');
const COMPLETED_DIR = join(__dirname, '../proposals/completed');

// P-14 比對關鍵字（PROPOSAL_20260422_014）
const REGRESSION_KEYWORDS = [
  { old: '必須 X', neu: '禁止 X' },
  { old: '硬編碼', neu: '去硬編碼' },
  { old: '錨定', neu: '通用' },
  { old: 'Rules 內化', neu: 'workspace 注入' },
];

function loadInheritanceTable(content) {
  // 找 §🔗 提案意圖繼承關係 區塊
  const section = content.match(/## 🔗 提案意圖繼承關係[\s\S]*?(?=##\s|$)/);
  if (!section) return [];
  const rows = section[0].match(/\| PROPOSAL_\w+[\s\S]*?\|/g) || [];
  return rows.map(r => {
    const cells = r.split('|').map(c => c.trim()).filter(Boolean);
    return { historical: cells[0], original_intent: cells[1], inheritor: cells[2] };
  });
}

function scanCompletedProposals() {
  if (!existsSync(COMPLETED_DIR)) return [];
  return readdirSync(COMPLETED_DIR)
    .filter(f => f.startsWith('PROPOSAL_') && f.endsWith('.md'))
    .map(f => ({ id: f.replace('.md', ''), path: join(COMPLETED_DIR, f) }));
}

function main() {
  console.log('🔍 Proposal Intent Consistency Check\n');

  if (!existsSync(INDEX_FILE)) {
    console.error(`❌ PROPOSAL_INDEX.md not found`);
    process.exit(2);
  }

  const indexContent = readFileSync(INDEX_FILE, 'utf-8');
  const inheritanceTable = loadInheritanceTable(indexContent);
  console.log(`📋 Inheritance entries: ${inheritanceTable.length}`);
  for (const entry of inheritanceTable) {
    console.log(`   - ${entry.historical} → ${entry.inheritor}`);
  }

  const proposals = scanCompletedProposals();
  console.log(`\n📂 Completed proposals: ${proposals.length}`);

  let warnings = 0;
  for (const p of proposals) {
    const content = readFileSync(p.path, 'utf-8');
    // 簡單關鍵字掃描：若提案 §七 備註提及「推翻」「取代」「重新設計」歷史提案，但未在繼承表中 → 警告
    const overtones = content.match(/(推翻|取代|廢除)\s*PROPOSAL[-_]\d+/g);
    if (overtones) {
      const listed = inheritanceTable.some(e => e.historical && e.historical.includes(p.id));
      if (!listed) {
        console.warn(`⚠️  ${p.id} 提及推翻歷史提案但未在 §🔗 繼承表註冊`);
        warnings++;
      }
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`Summary: ${warnings} warnings`);
  console.log(`─────────────────────────────`);
  process.exit(warnings > 0 ? 1 : 0);
}

main();
