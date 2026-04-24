#!/usr/bin/env node
// schema-validator.mjs — 驗證 rules frontmatter + XML section 合規性
// 依 PROPOSAL_20260422_009 + 014 建立
// 使用：node .agents/tests/schema-validator.mjs [--strict] [--file <path>]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_DIR = join(__dirname, '../rules');
const SCHEMA_FILE = join(__dirname, '../RULES_METADATA_SCHEMA.md');

const REQUIRED_FRONTMATTER = [
  'agent_id', 'agent_name', 'file_type', 'version',
  'last_modified', 'last_proposal', 'audit_baseline', 'trigger',
];

const TOKEN_LIMITS = {
  always_on: 500,
  agent_rule: 1000,
  design_guide: 3000,
};

let errors = 0;
let warnings = 0;

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const lines = match[1].split('\n');
  const fm = {};
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function estimateTokens(content) {
  // 中英混合估算：位元組數 × 0.6 / 4
  const bytes = Buffer.byteLength(content, 'utf-8');
  return Math.round(bytes * 0.6 / 4);
}

function validateSections(content) {
  const sections = content.match(/<section id="[^"]+" priority="[^"]+"/g) || [];
  const ids = sections.map(s => s.match(/id="([^"]+)"/)[1]);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) {
    console.error(`  ❌ Duplicate section ids: ${[...new Set(duplicates)].join(', ')}`);
    errors++;
  }
  return { count: sections.length, duplicates };
}

function validateFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const fileName = filePath.split('/').pop();
  console.log(`\n📄 Validating: ${fileName}`);

  // 1. Frontmatter 檢查
  const fm = parseFrontmatter(content);
  if (!fm) {
    console.error(`  ❌ Missing YAML frontmatter`);
    errors++;
    return;
  }

  const missing = REQUIRED_FRONTMATTER.filter(k => !fm[k]);
  if (missing.length) {
    console.error(`  ❌ Missing required fields: ${missing.join(', ')}`);
    errors++;
  }

  // 2. Token 預算檢查
  const tokens = estimateTokens(content);
  const limit = TOKEN_LIMITS[fm.file_type] || TOKEN_LIMITS.agent_rule;
  const pct = Math.round(tokens / limit * 100);
  if (tokens > limit) {
    console.warn(`  ⚠️  Token estimate ${tokens} exceeds limit ${limit} (${pct}%)`);
    warnings++;
  } else {
    console.log(`  ✅ Token: ${tokens} / ${limit} (${pct}%)`);
  }

  // 3. XML section 檢查（AlwaysOn 例外）
  if (fm.file_type !== 'always_on') {
    const { count, duplicates } = validateSections(content);
    if (count === 0) {
      console.error(`  ❌ No <section> tags found (required for non-AlwaysOn)`);
      errors++;
    } else {
      console.log(`  ✅ Sections: ${count} (no duplicates)`);
    }
  }

  // 4. 版本標頭檢查（AlwaysOn 例外）
  if (fm.file_type !== 'always_on') {
    if (!content.match(/\*\*\*\n版本：v\d+\.\d+/)) {
      console.warn(`  ⚠️  Missing body version header`);
      warnings++;
    }
  }
}

// 主執行
const args = process.argv.slice(2);
const fileArg = args.indexOf('--file');
const targetFile = fileArg >= 0 ? args[fileArg + 1] : null;

console.log('🔍 Schema Validator (PROPOSAL_20260422_009)\n');

if (targetFile) {
  validateFile(targetFile);
} else {
  const files = readdirSync(RULES_DIR).filter(f => f.endsWith('.md'));
  for (const f of files) {
    validateFile(join(RULES_DIR, f));
  }
}

console.log(`\n─────────────────────────────`);
console.log(`Summary: ${errors} errors, ${warnings} warnings`);
console.log(`─────────────────────────────`);
process.exit(errors > 0 ? 2 : warnings > 0 ? 1 : 0);
