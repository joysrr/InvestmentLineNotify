// unit.test.mjs — scripts/ 純函式單元測試
// 依 PROPOSAL_20260423_006 Part 2 建立；零 npm 依賴（node:test + node:assert）
//
// 使用：node --test .agents/tests/scripts/unit.test.mjs
//
// 退出碼：0 = 全通過；非 0 = 有測試失敗

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import pure functions from scripts
import {
  parseYaml,
  splitTopLevel,
  parseScalar,
  renderWorkspaceMd,
  renderProposalIndexShell,
  answerMatchesAvailableStacks,
} from '../../scripts/init-workspace.mjs';

import {
  classifyPath,
  hashFile,
  readVersion,
  isAgentsDir,
} from '../../scripts/framework-diff.mjs';

// PROPOSAL_20260423_007 generators 純函式 import
import {
  parseFrontmatter as parseFM_v1,
  buildVersionTable,
  collectFilesInfo,
  replaceVersionTableSection,
} from '../../scripts/generators/gen-rules-version-index.mjs';

import {
  parseProposalMetadata as parseProposalMeta_changelog,
  bumpVersion as bumpVersion_changelog,
  readFrameworkVersion,
  buildChangelogEntry,
  prependEntryToChangelog,
} from '../../scripts/generators/gen-changelog.mjs';

import {
  parseProposalStatus,
  parseProposalTitle,
  parseProposalMeta,
  buildStatsTable,
  buildOpenTable,
  buildInProgressTable,
} from '../../scripts/generators/gen-proposal-index.mjs';

import {
  bumpVersion as bumpVersion_fw,
  readCurrentVersion,
  countCompletedProposals,
  updateFrameworkVersionFields,
} from '../../scripts/generators/gen-framework-version.mjs';

// ============================================================
// parseYaml 測試
// ============================================================

test('parseYaml: 基本 key-value 解析', () => {
  const result = parseYaml('name: demo\nversion: 1.0');
  assert.equal(result.name, 'demo');
  assert.equal(result.version, 1);
});

test('parseYaml: 巢狀 block 縮排處理', () => {
  const yaml = `
PROJECT_CONTEXT:
  project_name:
    type: string
    required: true
`;
  const result = parseYaml(yaml);
  assert.ok(result.PROJECT_CONTEXT);
  assert.ok(result.PROJECT_CONTEXT.project_name);
  assert.equal(result.PROJECT_CONTEXT.project_name.type, 'string');
  assert.equal(result.PROJECT_CONTEXT.project_name.required, true);
});

test('parseYaml: flow-style 物件 {key: value}', () => {
  const result = parseYaml('obj: { type: string, required: true }');
  assert.deepEqual(result.obj, { type: 'string', required: true });
});

test('parseYaml: 註解與空行略過', () => {
  const yaml = `
# 這是註解
name: demo

# 另一註解
version: 2
`;
  const result = parseYaml(yaml);
  assert.equal(result.name, 'demo');
  assert.equal(result.version, 2);
});

test('parseYaml: boolean / number / null 型別識別', () => {
  const yaml = `
flag_true: true
flag_false: false
num_int: 42
num_float: 3.14
empty_value: null
`;
  const result = parseYaml(yaml);
  assert.equal(result.flag_true, true);
  assert.equal(result.flag_false, false);
  assert.equal(result.num_int, 42);
  assert.equal(result.num_float, 3.14);
  assert.equal(result.empty_value, null);
});

// ============================================================
// parseScalar 測試
// ============================================================

test('parseScalar: true/false/null 轉換', () => {
  assert.equal(parseScalar('true'), true);
  assert.equal(parseScalar('false'), false);
  assert.equal(parseScalar('null'), null);
  assert.equal(parseScalar(''), null);
});

test('parseScalar: quoted string 去引號', () => {
  assert.equal(parseScalar('"hello"'), 'hello');
  assert.equal(parseScalar("'world'"), 'world');
});

test('parseScalar: array literal [a, b]', () => {
  assert.deepEqual(parseScalar('[a, b, c]'), ['a', 'b', 'c']);
  assert.deepEqual(parseScalar('[1, 2, 3]'), [1, 2, 3]);
});

// ============================================================
// splitTopLevel 測試
// ============================================================

test('splitTopLevel: 基本逗號分隔', () => {
  assert.deepEqual(splitTopLevel('a, b, c', ','), ['a', ' b', ' c']);
});

test('splitTopLevel: 巢狀括號保留', () => {
  assert.deepEqual(splitTopLevel('a, [b, c], d', ','), ['a', ' [b, c]', ' d']);
});

// ============================================================
// renderWorkspaceMd 測試
// ============================================================

test('renderWorkspaceMd: 含標準 header 與維護紀錄', () => {
  const md = renderWorkspaceMd('test_ws', {
    'PROJECT_CONTEXT.project_name': 'test_ws',
  });
  assert.ok(md.includes('# Workspace: test_ws'));
  assert.ok(md.includes('PROPOSAL_20260423_005'));
  assert.ok(md.includes('**維護紀錄**'));
});

test('renderWorkspaceMd: 多欄位 block 分組輸出', () => {
  const md = renderWorkspaceMd('test_ws', {
    'PROJECT_CONTEXT.project_name': 'test_ws',
    'PROJECT_CONTEXT.display_name': 'Test Workspace',
    'TECH_STACK.language': 'Node.js',
  });
  assert.ok(md.includes('## PROJECT_CONTEXT'));
  assert.ok(md.includes('## TECH_STACK'));
  assert.ok(md.includes('- **project_name**：test_ws'));
  assert.ok(md.includes('- **display_name**：Test Workspace'));
  assert.ok(md.includes('- **language**：Node.js'));
});

test('renderWorkspaceMd: 單欄位 block 整塊輸出（PROPOSAL_20260423_006 Bug 1 修正驗證）', () => {
  const md = renderWorkspaceMd('test_ws', {
    'PROJECT_CONTEXT.project_name': 'test_ws',
    'FUNCTIONAL_DOMAINS': '<not_applicable>',
    'BUSINESS_RULES': '- Rule A\n- Rule B',
  });
  // 單欄位 block 不應出現為「子欄位」格式
  assert.ok(md.includes('## FUNCTIONAL_DOMAINS'));
  assert.ok(md.includes('## BUSINESS_RULES'));
  assert.ok(!md.includes('- **FUNCTIONAL_DOMAINS**'));  // 不應作為子欄位
  // 值直接作為 section 內容
  assert.ok(md.includes('<not_applicable>'));
});

test('renderWorkspaceMd: 空 answers 仍產出基本結構', () => {
  const md = renderWorkspaceMd('empty_ws', {});
  assert.ok(md.includes('# Workspace: empty_ws'));
  assert.ok(md.includes('---'));
  assert.ok(md.includes('**維護紀錄**'));
});

// ============================================================
// renderProposalIndexShell 測試
// ============================================================

test('renderProposalIndexShell: 含 project scope 說明', () => {
  const md = renderProposalIndexShell('demo_app');
  assert.ok(md.includes('Project Scope (demo_app)'));
  assert.ok(md.includes('project scope'));
  assert.ok(md.includes('PROPOSAL_20260422_023'));
});

test('renderProposalIndexShell: 統計摘要初始 0', () => {
  const md = renderProposalIndexShell('demo_app');
  assert.ok(md.includes('| **合計** | **0** |'));
  assert.ok(md.includes('OPEN | 0'));
  assert.ok(md.includes('DONE | 0'));
});

// ============================================================
// answerMatchesAvailableStacks 測試
// ============================================================

test('answerMatchesAvailableStacks: 精確匹配', () => {
  const stacks = ['nodejs-esm-backend', 'vue3-vite', 'telegram-bot'];
  assert.equal(answerMatchesAvailableStacks('vue3-vite', stacks), true);
});

test('answerMatchesAvailableStacks: 模糊子字串匹配', () => {
  const stacks = ['nodejs-esm-backend', 'vue3-vite'];
  assert.equal(answerMatchesAvailableStacks('nodejs', stacks), true);
  assert.equal(answerMatchesAvailableStacks('vue3', stacks), true);
});

test('answerMatchesAvailableStacks: 空值 / <not_applicable> 允許', () => {
  const stacks = ['nodejs-esm-backend'];
  assert.equal(answerMatchesAvailableStacks('', stacks), true);
  assert.equal(answerMatchesAvailableStacks('<not_applicable>', stacks), true);
});

test('answerMatchesAvailableStacks: 完全不匹配 → false', () => {
  const stacks = ['nodejs-esm-backend', 'vue3-vite'];
  assert.equal(answerMatchesAvailableStacks('django', stacks), false);
});

// ============================================================
// classifyPath 測試（framework-diff）
// ============================================================

test('classifyPath: framework 層正確識別（rules/skills）', () => {
  assert.equal(classifyPath('rules/lead.md'), 'framework');
  assert.equal(classifyPath('skills/diagnostic-playbook.md'), 'framework');
  assert.equal(classifyPath('tech-stacks/web-backend/nodejs-esm-backend.md'), 'framework');
  assert.equal(classifyPath('tasks/project-onboarding.md'), 'framework');
  assert.equal(classifyPath('docs/agents-overview.md'), 'framework');
  assert.equal(classifyPath('RULES_DESIGN_GUIDE.md'), 'framework');
});

test('classifyPath: project 層正確識別（workspaces/<name> + active 提案）', () => {
  assert.equal(classifyPath('CURRENT_WORKSPACE'), 'project');
  assert.equal(classifyPath('workspaces/myapp.md'), 'project');
  assert.equal(classifyPath('workspaces/myapp/proposals/active/x.md'), 'project');
  assert.equal(classifyPath('proposals/PROPOSAL_INDEX.md'), 'project');
  assert.equal(classifyPath('proposals/active/PROPOSAL_20260423_001.md'), 'project');
});

test('classifyPath: default_env / README 屬 framework', () => {
  assert.equal(classifyPath('workspaces/default_env.md'), 'framework');
  assert.equal(classifyPath('workspaces/README.md'), 'framework');
});

test('classifyPath: unknown 類型保守歸類', () => {
  assert.equal(classifyPath('some/random/path.txt'), 'unknown');
  assert.equal(classifyPath('foo.md'), 'unknown');
});

// ============================================================
// hashFile 測試（使用 /tmp fixture）
// ============================================================

test('hashFile: 相同內容哈希一致 / 不同內容哈希不同', () => {
  const tmpDir = join(tmpdir(), `agents-test-${process.pid}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  try {
    const file1 = join(tmpDir, 'a.txt');
    const file2 = join(tmpDir, 'b.txt');
    const file3 = join(tmpDir, 'c.txt');
    writeFileSync(file1, 'hello world');
    writeFileSync(file2, 'hello world');  // 同內容
    writeFileSync(file3, 'different');

    const h1 = hashFile(file1);
    const h2 = hashFile(file2);
    const h3 = hashFile(file3);

    assert.equal(h1, h2, '同內容哈希必須一致');
    assert.notEqual(h1, h3, '不同內容哈希必須不同');
    assert.equal(typeof h1, 'string');
    assert.equal(h1.length, 64, 'SHA-256 hex 長度為 64');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('hashFile: 不存在檔案返回 null', () => {
  const result = hashFile('/tmp/nonexistent-file-' + Date.now());
  assert.equal(result, null);
});

// ============================================================
// readVersion 測試
// ============================================================

test('readVersion: 從 FRAMEWORK_VERSION 正確擷取版本號', () => {
  const tmpDir = join(tmpdir(), `agents-test-${process.pid}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  try {
    writeFileSync(join(tmpDir, 'FRAMEWORK_VERSION'),
      'framework_version: v4.5\nrelease_date: 2026-04-23\n');
    const ver = readVersion(tmpDir);
    assert.ok(ver.includes('v4.5'));
    assert.ok(ver.includes('2026-04-23'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('readVersion: 無 FRAMEWORK_VERSION 返回提示字串', () => {
  const tmpDir = join(tmpdir(), `agents-test-${process.pid}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  try {
    const ver = readVersion(tmpDir);
    assert.ok(ver.includes('無 FRAMEWORK_VERSION'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================
// isAgentsDir 測試
// ============================================================

test('isAgentsDir: 當前 .agents/ 應識別為 true', () => {
  // 相對於本測試檔（.agents/tests/scripts/unit.test.mjs）的 .agents/ 根
  const agentsRoot = join(import.meta.url.replace('file://', ''), '..', '..', '..');
  assert.equal(isAgentsDir(agentsRoot), true);
});

test('isAgentsDir: /tmp 不應識別為 .agents/', () => {
  assert.equal(isAgentsDir(tmpdir()), false);
});

// ============================================================
// PROPOSAL_20260423_007 — generators 純函式測試
// ============================================================

// -------- gen-rules-version-index --------

test('gen-rules-version-index: parseFrontmatter 解析 markdown frontmatter', () => {
  const md = `---
agent_id: test
version: v1.5
last_modified: 2026-04-23
last_proposal: PROPOSAL_X
---

# content
`;
  const fm = parseFM_v1(md);
  assert.equal(fm.version, 'v1.5');
  assert.equal(fm.last_modified, '2026-04-23');
  assert.equal(fm.last_proposal, 'PROPOSAL_X');
});

test('gen-rules-version-index: parseFrontmatter 解析 YAML 檔', () => {
  const yaml = `# YAML file
schema_version: v2.0
last_modified: 2026-04-23
last_proposal: PROPOSAL_Y
`;
  const fm = parseFM_v1(yaml);
  assert.equal(fm.schema_version, 'v2.0');
});

test('gen-rules-version-index: buildVersionTable 產生有效 markdown 表格', () => {
  const filesInfo = [
    { path: '.agents/rules/test.md', version: 'v1.0', last_modified: '2026-01-01', last_proposal: 'PROPOSAL_X', audit_baseline: 'v1.0' },
  ];
  const table = buildVersionTable(filesInfo);
  assert.ok(table.includes('| 文件 | 當前版本 |'));
  assert.ok(table.includes('| `.agents/rules/test.md` | **v1.0** |'));
});

test('gen-rules-version-index: replaceVersionTableSection 找不到區塊應拋錯', () => {
  const content = '# 沒有版本總覽區塊\n\n## 其他章節\n';
  assert.throws(() => replaceVersionTableSection(content, '<table>'));
});

// -------- gen-changelog --------

test('gen-changelog: bumpVersion minor 正確遞增', () => {
  assert.equal(bumpVersion_changelog('v4.5', 'minor'), 'v4.6');
  assert.equal(bumpVersion_changelog('v1.0', 'minor'), 'v1.1');
  assert.equal(bumpVersion_changelog('v9.9', 'minor'), 'v9.10');
});

test('gen-changelog: bumpVersion major 重置 minor', () => {
  assert.equal(bumpVersion_changelog('v4.5', 'major'), 'v5.0');
  assert.equal(bumpVersion_changelog('v1.99', 'major'), 'v2.0');
});

test('gen-changelog: bumpVersion 無效格式拋錯', () => {
  assert.throws(() => bumpVersion_changelog('invalid'));
  assert.throws(() => bumpVersion_changelog('v1'));
});

test('gen-changelog: parseProposalMetadata 撈基本資訊', () => {
  const proposal = `# RULE_UPDATE_PROPOSAL

## 基本資訊
- 提案編號：PROPOSAL_20260423_999
- scope: \`framework\`
- 提案日期：2026-04-23
- 執行摘要（3 Part）：
  - **Part 1**：第一部分描述
  - **Part 2**：第二部分描述
  - **Part 3**：第三部分描述
`;
  const meta = parseProposalMeta_changelog(proposal);
  assert.equal(meta.id, 'PROPOSAL_20260423_999');
  assert.equal(meta.scope, 'framework');
  assert.equal(meta.date, '2026-04-23');
  assert.equal(meta.summaryBullets.length, 3);
});

test('gen-changelog: buildChangelogEntry 含必要區塊', () => {
  const proposal = {
    id: 'PROPOSAL_X',
    summary: 'Test summary',
    date: '2026-04-23',
    parts: [{ num: '1', title: 'Test part' }],
    summaryBullets: [],
  };
  const entry = buildChangelogEntry(proposal, 'v5.0');
  assert.ok(entry.includes('## [v5.0] - 2026-04-23'));
  assert.ok(entry.includes('### Added'));
  assert.ok(entry.includes('### Changed'));
  assert.ok(entry.includes('### Notes'));
  assert.ok(entry.includes('PROPOSAL_X'));
});

// -------- gen-proposal-index --------

test('gen-proposal-index: parseProposalStatus 識別 OPEN/IN_PROGRESS/DONE', () => {
  assert.equal(parseProposalStatus('- 狀態：OPEN'), 'OPEN');
  assert.equal(parseProposalStatus('- 狀態：IN_PROGRESS'), 'IN_PROGRESS');
  assert.equal(parseProposalStatus('- 狀態：DONE'), 'DONE');
  assert.equal(parseProposalStatus('- 狀態：CANCELLED'), 'CANCELLED');
  assert.equal(parseProposalStatus('沒有狀態'), 'UNKNOWN');
});

test('gen-proposal-index: buildStatsTable 含合計行', () => {
  const counts = { OPEN: 1, IN_PROGRESS: 2, DONE: 60, CANCELLED: 1, ARCHIVED: 1, total: 65 };
  const table = buildStatsTable(counts);
  assert.ok(table.includes('| OPEN | 1 |'));
  assert.ok(table.includes('| **合計** | **65** |'));
});

test('gen-proposal-index: buildOpenTable 空清單顯示提示', () => {
  const table = buildOpenTable([]);
  assert.ok(table.includes('（目前無待執行項目）'));
});

test('gen-proposal-index: buildOpenTable 含實際提案', () => {
  const proposals = [{ id: 'PROPOSAL_X', title: 'Test', priority: 'P1', date: '2026-04-23', depends: '無' }];
  const table = buildOpenTable(proposals);
  assert.ok(table.includes('| PROPOSAL_X | Test | P1 |'));
});

// -------- gen-framework-version --------

test('gen-framework-version: bumpVersion 與 gen-changelog 共用實作（行為一致）', () => {
  assert.equal(bumpVersion_fw('v4.6', 'minor'), 'v4.7');
  assert.equal(bumpVersion_fw('v4.6', 'major'), 'v5.0');
});

test('gen-framework-version: readCurrentVersion 撈 framework_version 欄位', () => {
  const content = `framework_version: v4.5
release_date: 2026-04-23
`;
  assert.equal(readCurrentVersion(content), 'v4.5');
});

test('gen-framework-version: updateFrameworkVersionFields 替換多欄位', () => {
  const content = `framework_version: v4.5
release_date: 2026-01-01
baseline_proposal: PROPOSAL_OLD

proposals_included:
  total: 50
  framework: 50
  project: 0

last_included_proposal: PROPOSAL_OLD
`;
  const updated = updateFrameworkVersionFields(content, {
    newVersion: 'v4.6',
    newDate: '2026-04-23',
    baselineProposal: 'PROPOSAL_NEW',
    lastProposal: 'PROPOSAL_NEW',
    proposalsTotal: 51,
  });
  assert.ok(updated.includes('framework_version: v4.6'));
  assert.ok(updated.includes('release_date: 2026-04-23'));
  assert.ok(updated.includes('baseline_proposal: PROPOSAL_NEW'));
  assert.ok(updated.includes('total: 51'));
  assert.ok(updated.includes('framework: 51'));
});
