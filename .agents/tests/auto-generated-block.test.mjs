#!/usr/bin/env node
// auto-generated-block.test.mjs
// 單元測試：lib/auto-generated-block.mjs（依 PROPOSAL_20260423_012 Phase A 建立）

import { strict as assert } from 'node:assert';
import {
  buildBlockRegex,
  hasBlock,
  extractBlockBody,
  replaceBlock,
  checkDrift,
} from '../scripts/generators/lib/auto-generated-block.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('hasBlock: returns true when marker present', () => {
  const content = `# Title
<!-- AUTO-GENERATED:BEGIN foo -->
body
<!-- AUTO-GENERATED:END foo -->
tail`;
  assert.equal(hasBlock(content, 'foo'), true);
});

test('hasBlock: returns false when marker missing', () => {
  assert.equal(hasBlock('# no markers', 'foo'), false);
});

test('extractBlockBody: extracts body without markers', () => {
  const content = `<!-- AUTO-GENERATED:BEGIN stats -->
line1
line2
<!-- AUTO-GENERATED:END stats -->`;
  assert.equal(extractBlockBody(content, 'stats'), 'line1\nline2');
});

test('extractBlockBody: returns null when marker missing', () => {
  assert.equal(extractBlockBody('nothing', 'foo'), null);
});

test('replaceBlock: replaces body idempotently', () => {
  const content = `before
<!-- AUTO-GENERATED:BEGIN stats -->
OLD
<!-- AUTO-GENERATED:END stats -->
after`;
  const updated = replaceBlock(content, 'stats', 'NEW\nNEW2');
  assert.equal(extractBlockBody(updated, 'stats'), 'NEW\nNEW2');
  // idempotent
  const again = replaceBlock(updated, 'stats', 'NEW\nNEW2');
  assert.equal(again, updated);
});

test('replaceBlock: throws when marker missing', () => {
  assert.throws(() => replaceBlock('no marker', 'foo', 'body'), /block marker not found/);
});

test('checkDrift: detects content differs', () => {
  const content = `<!-- AUTO-GENERATED:BEGIN s -->
OLD
<!-- AUTO-GENERATED:END s -->`;
  const res = checkDrift(content, 's', 'NEW');
  assert.equal(res.drift, true);
  assert.equal(res.reason, 'CONTENT_DIFFERS');
});

test('checkDrift: detects missing marker', () => {
  const res = checkDrift('nothing', 's', 'anything');
  assert.equal(res.drift, true);
  assert.equal(res.reason, 'MISSING_MARKER');
});

test('checkDrift: in sync when body matches (trim-tolerant)', () => {
  const content = `<!-- AUTO-GENERATED:BEGIN s -->

BODY

<!-- AUTO-GENERATED:END s -->`;
  const res = checkDrift(content, 's', 'BODY');
  assert.equal(res.drift, false);
  assert.equal(res.reason, 'IN_SYNC');
});

test('buildBlockRegex: escapes special chars in name', () => {
  const re = buildBlockRegex('stats.v1');
  assert.match(
    `<!-- AUTO-GENERATED:BEGIN stats.v1 -->x<!-- AUTO-GENERATED:END stats.v1 -->`,
    re
  );
});

// Runner
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
