#!/usr/bin/env node
// gen-proposal-index.test.mjs
// 單元測試：parseProposalStatus（依 PROPOSAL_20260423_012 §3.5 bug 修復）

import { strict as assert } from 'node:assert';
import { parseProposalStatus } from '../scripts/generators/gen-proposal-index.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('parses plain OPEN', () => {
  assert.equal(parseProposalStatus('- 狀態：OPEN'), 'OPEN');
});

test('parses plain DONE', () => {
  assert.equal(parseProposalStatus('- 狀態：DONE'), 'DONE');
});

test('parses bold **CANCELLED** (regression fix)', () => {
  assert.equal(parseProposalStatus('- 狀態：**CANCELLED**（備註）'), 'CANCELLED');
});

test('parses italic _DONE_', () => {
  assert.equal(parseProposalStatus('- 狀態：_DONE_'), 'DONE');
});

test('parses bold **IN_PROGRESS**', () => {
  assert.equal(parseProposalStatus('- 狀態：**IN_PROGRESS**'), 'IN_PROGRESS');
});

test('half-width colon works', () => {
  assert.equal(parseProposalStatus('- 狀態: OPEN'), 'OPEN');
});

test('returns UNKNOWN when no match', () => {
  assert.equal(parseProposalStatus('no status here'), 'UNKNOWN');
});

let passed = 0, failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
