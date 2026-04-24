#!/usr/bin/env node
// lead-stateless-audit.mjs — 驗證 @Lead §s_state_anchor 三鐵律（PROPOSAL_20260422_001）
// 使用：node .agents/tests/lead-stateless-audit.mjs [--file PENDING_ACTIONS.md]

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '../../PENDING_ACTIONS.md');

function auditStateAnchor(filePath) {
  if (!existsSync(filePath)) {
    console.warn(`⚠️  PENDING_ACTIONS.md not found at ${filePath}`);
    console.warn('    系統尚未初始化 PENDING_ACTIONS.md；這是正常情況如果是首次啟用');
    return 1;
  }

  const content = readFileSync(filePath, 'utf-8');
  console.log('🔍 Auditing @Lead State Anchor Compliance\n');

  let errors = 0;

  // 1. [CURRENT_STAGE] 欄位存在
  if (!content.match(/\[CURRENT_STAGE\][：:]\s*\S+/)) {
    console.error('❌ [CURRENT_STAGE] field missing or empty');
    errors++;
  } else {
    console.log('✅ [CURRENT_STAGE] present');
  }

  // 2. [LAST_UPDATED] 時間戳
  if (!content.match(/\[LAST_UPDATED\][：:]\s*\d{4}-\d{2}-\d{2}/)) {
    console.error('❌ [LAST_UPDATED] missing or malformed');
    errors++;
  } else {
    console.log('✅ [LAST_UPDATED] present');
  }

  // 3. [ARTIFACT_PATHS] 欄位（可為空 list）
  if (!content.match(/\[ARTIFACT_PATHS\]/)) {
    console.warn('⚠️  [ARTIFACT_PATHS] section missing');
  } else {
    console.log('✅ [ARTIFACT_PATHS] section present');
  }

  // 4. 🔴 區塊為空（否則 @Lead 應阻斷新功能）
  const redSection = content.match(/## 🔴[\s\S]*?(?=##\s|$)/);
  if (redSection) {
    const hasRedItems = redSection[0].match(/\|\s*BLOCK_\d+/);
    if (hasRedItems) {
      console.warn('⚠️  🔴 blocked items present — @Lead should refuse new features');
    } else {
      console.log('✅ 🔴 section empty (no blockers)');
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`Summary: ${errors} errors`);
  console.log(`─────────────────────────────`);
  return errors > 0 ? 2 : 0;
}

const fileArg = process.argv.indexOf('--file');
const target = fileArg >= 0 ? process.argv[fileArg + 1] : DEFAULT_PATH;
process.exit(auditStateAnchor(target));
