#!/usr/bin/env node
// init-workspace.mjs
// 互動式 CLI 初始化工具：建立新專案 workspace
// 依 PROPOSAL_20260423_005 建立；純 Node.js 內建模組
// 對齐 tasks/project-onboarding.md 6 步驟 SOP
//
// 使用：
//   node .agents/scripts/init-workspace.mjs                 # 基本互動模式
//   node .agents/scripts/init-workspace.mjs --name myapp    # 指定名稱跳過第一問
//   node .agents/scripts/init-workspace.mjs --dry-run       # 僅預覽不寫檔
//   node .agents/scripts/init-workspace.mjs --force         # 覆寫已存在 CURRENT_WORKSPACE
//   node .agents/scripts/init-workspace.mjs --help          # 顯示說明

// 注：使用 classic readline（非 readline/promises）以支援 piped input + TTY 雙模
// readline/promises.question() 在 non-TTY 下只能消費一行後 silently close；event-based 迴避此限制
import { createInterface } from 'node:readline';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, '..'));
const SCHEMA_PATH = join(AGENTS_ROOT, 'WORKSPACE_SCHEMA.yaml');
const CURRENT_WORKSPACE_PATH = join(AGENTS_ROOT, 'CURRENT_WORKSPACE');
const WORKSPACES_DIR = join(AGENTS_ROOT, 'workspaces');
const TECH_STACKS_DIR = join(AGENTS_ROOT, 'tech-stacks');
const WORKSPACES_README = join(WORKSPACES_DIR, 'README.md');

// -------- CLI args（於 main entry 內解析；避免 import 時觸發）--------
let nameArg = null, dryRun = false, force = false;

function parseCliArgs() {
  const args = process.argv.slice(2);
  let help = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) nameArg = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--force') force = true;
    else if (args[i] === '--help' || args[i] === '-h') help = true;
  }
  return help;
}

function printHelp() {
  console.log(`
init-workspace.mjs — Interactive workspace initialization CLI

USAGE:
  node .agents/scripts/init-workspace.mjs [OPTIONS]

OPTIONS:
  --name <name>    Specify workspace name (skip first prompt)
  --dry-run        Preview without writing files
  --force          Overwrite existing CURRENT_WORKSPACE without confirmation
  --help, -h       Show this help

DESCRIPTION:
  依 .agents/tasks/project-onboarding.md 6 步驟 SOP 引導建立新專案 workspace。
  動態讀取 .agents/WORKSPACE_SCHEMA.yaml 產生問答；新增 schema 欄位 CLI 自動涵蓋。

  產出：
    - .agents/workspaces/<name>.md             （填好的 workspace 檔）
    - .agents/workspaces/<name>/proposals/     （專案 scope 提案目錄）
    - .agents/CURRENT_WORKSPACE                （寫入 <name>）
    - 更新 .agents/workspaces/README.md 當前已建立的 workspace 表格

  失敗完整回退；不留半成品。
  結束前呼叫 workspace-schema-validator.mjs 驗證；失敗則回退。

REFERENCE:
  PROPOSAL_20260423_005 / tasks/project-onboarding.md / WORKSPACE_SCHEMA.yaml
`);
}

let errors = 0;
function fatal(msg) {
  console.error(`❌ ${msg}`);
  errors++;
  process.exit(2);
}

// -------- Minimal YAML parser --------
// 沿用 workspace-schema-validator.mjs 的 parseYaml 實作
export function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  const lines = text.split('\n');

  for (let rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    const stripped = line.trim();

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    const kvMatch = stripped.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let rest = kvMatch[2].replace(/\s*#.*$/, '').trim();

      if (rest === '') {
        parent[key] = {};
        stack.push({ indent, obj: parent[key] });
      } else if (rest.startsWith('{') && rest.endsWith('}')) {
        const inner = rest.slice(1, -1);
        const obj = {};
        const parts = splitTopLevel(inner, ',');
        for (const p of parts) {
          const m = p.match(/^\s*([A-Za-z_][\w]*)\s*:\s*(.+?)\s*$/);
          if (!m) continue;
          obj[m[1]] = parseScalar(m[2]);
        }
        parent[key] = obj;
      } else {
        parent[key] = parseScalar(rest);
      }
    }
  }
  return root;
}

export function splitTopLevel(str, sep) {
  const out = []; let buf = ''; let depth = 0;
  for (const c of str) {
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === sep && depth === 0) { out.push(buf); buf = ''; }
    else buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

export function parseScalar(s) {
  s = s.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith('[') && s.endsWith(']')) {
    return splitTopLevel(s.slice(1, -1), ',').map(x => parseScalar(x));
  }
  return s;
}

// -------- Renderers --------
export function renderWorkspaceMd(name, answers) {
  const get = (k) => answers[k] !== undefined ? answers[k] : '<not_applicable>';
  const lines = [];
  lines.push(`# Workspace: ${name}`);
  lines.push('');
  lines.push(`> 由 \`.agents/scripts/init-workspace.mjs\` CLI 建立（依 PROPOSAL_20260423_005）`);
  lines.push(`> 建立日期：${new Date().toISOString().split('T')[0]}`);
  lines.push(`> **契約**：所有欄位定義參照 \`.agents/WORKSPACE_SCHEMA.yaml\` SSOT`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 依 answers 的 key 分組：含 "." 者為多欄位 block 的子欄位；不含者為 block 本身即 field
  const blocks = {};
  const singleFieldBlocks = {};
  for (const [key, value] of Object.entries(answers)) {
    if (key.includes('.')) {
      const [block, field] = key.split('.');
      if (!blocks[block]) blocks[block] = {};
      blocks[block][field] = value;
    } else {
      singleFieldBlocks[key] = value;
    }
  }

  // 先輸出多欄位 blocks
  for (const [block, fields] of Object.entries(blocks)) {
    lines.push(`## ${block}`);
    lines.push('');
    for (const [field, value] of Object.entries(fields)) {
      lines.push(`- **${field}**：${value}`);
    }
    lines.push('');
  }

  // 再輸出單欄位 blocks（整塊作為一個 section；value 作 description）
  for (const [block, value] of Object.entries(singleFieldBlocks)) {
    lines.push(`## ${block}`);
    lines.push('');
    lines.push(value);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**維護紀錄**：');
  lines.push(`- ${new Date().toISOString().split('T')[0]} 由 init-workspace.mjs CLI 建立`);
  lines.push('');

  return lines.join('\n');
}

export function renderProposalIndexShell(name) {
  return `# PROPOSAL_INDEX — Project Scope (${name})

> 本索引管理 \`workspaces/${name}/proposals/\` 下的 **project scope** 提案（依 PROPOSAL_20260422_023）。
> Framework scope 提案索引請見 \`.agents/proposals/PROPOSAL_INDEX.md\`。

## 統計摘要

| 狀態 | 數量 | 目錄 |
|------|------|------|
| OPEN | 0 | active/ |
| IN_PROGRESS | 0 | active/ |
| DONE | 0 | completed/ |
| CANCELLED | 0 | completed/ |
| ARCHIVED | 0 | archived/ |
| **合計** | **0** | — |

## 🟡 OPEN（待執行）

| 編號 | 標題 | 優先級 | 提案日期 | 前置依賴 |
|------|------|-------|---------|---------|
| — | （目前無待執行項目）| — | — | — |

## 🔵 IN_PROGRESS（執行中）

| 編號 | 標題 | 優先級 | 開始日期 | 預計完成 |
|------|------|-------|---------|---------|
| — | （目前無執行中項目）| — | — | — |

## ✅ DONE（已完成）

| 編號 | 標題 | 優先級 | 完成日期 | 執行者 |
|------|------|-------|---------|-------|
| — | （尚無完成項目）| — | — | — |
`;
}

// -------- Queue-based readline wrapper（lazy init；支援 piped input + TTY 雙模）--------
// readline/promises 在 non-TTY 下只能消費一行後 silently close；改用事件驅動避開此限制
// PROPOSAL_20260423_006 Part 1：lazy init 避免 import 時啟動 readline（測試可只 import 純函式）
let _rl = null;
const _lineQueue = [];
const _waiters = [];
let _closed = false;

function ensureReadline() {
  if (_rl) return;
  _rl = createInterface({ input, output, terminal: false });

  _rl.on('line', (line) => {
    if (_waiters.length > 0) {
      const resolver = _waiters.shift();
      resolver(line);
    } else {
      _lineQueue.push(line);
    }
  });

  _rl.on('close', () => {
    _closed = true;
    while (_waiters.length > 0) {
      const resolver = _waiters.shift();
      resolver('');  // EOF → 餘下 question 立即解析為空字串
    }
  });

  _rl.on('SIGINT', () => {
    console.log('\n\n⚠️  使用者中斷（Ctrl+C）。若已有變更將執行回退。');
    _rl.close();
    process.exit(130);
  });
}

function question(prompt) {
  ensureReadline();
  output.write(prompt);
  if (_lineQueue.length > 0) return Promise.resolve(_lineQueue.shift());
  if (_closed) return Promise.resolve('');
  return new Promise(resolve => _waiters.push(resolve));
}

function closeReadline() { if (_rl) _rl.close(); }

// -------- Tech-stacks availability scan --------
// MANIFEST.yaml 為 SSOT（PROPOSAL_20260423_017 Phase B 之後）；無 MANIFEST 時 fallback 遞迴掃 .md
export function scanAvailableTechStacks() {
  if (!existsSync(TECH_STACKS_DIR)) return [];
  const manifestPath = join(TECH_STACKS_DIR, 'MANIFEST.yaml');
  if (existsSync(manifestPath)) {
    try {
      const names = [];
      for (const raw of readFileSync(manifestPath, 'utf-8').split('\n')) {
        const m = raw.match(/^\s*-\s*name:\s*(.+?)\s*(?:#.*)?$/);
        if (m) names.push(m[1].replace(/^["']|["']$/g, ''));
      }
      if (names.length > 0) return names;
    } catch { /* fallback 到遞迴掃 */ }
  }
  // Fallback：遞迴掃 tech-stacks/ 下所有 .md（去 .md / 去路徑前綴）
  const out = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (f.endsWith('.md')) out.push(f.replace(/\.md$/, ''));
    }
  };
  walk(TECH_STACKS_DIR);
  return out;
}

// MANIFEST 完整讀取（含 category / installed / depends_on；for 選擇性搬運）
export function loadManifestStacks() {
  const manifestPath = join(TECH_STACKS_DIR, 'MANIFEST.yaml');
  if (!existsSync(manifestPath)) return null;
  const text = readFileSync(manifestPath, 'utf-8');
  const stacks = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = line.match(/^(\s*)/)[1].length;
    const stripped = line.trim();
    if (indent === 2 && stripped.startsWith('- name:')) {
      cur = { name: stripped.slice('- name:'.length).trim().replace(/^["']|["']$/g, '') };
      stacks.push(cur);
    } else if (indent === 4 && cur) {
      const m = stripped.match(/^([A-Za-z_][\w]*)\s*:\s*(.+?)\s*(?:#.*)?$/);
      if (m) {
        const val = m[2].trim();
        if (val === 'true') cur[m[1]] = true;
        else if (val === 'false') cur[m[1]] = false;
        else if (val.startsWith('[') && val.endsWith(']')) {
          cur[m[1]] = val.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean);
        } else {
          cur[m[1]] = val;
        }
      }
    }
  }
  return stacks;
}

// 模糊匹配：答案是否對應任一 tech-stacks 檔案
export function answerMatchesAvailableStacks(answer, stacks) {
  if (!answer || answer === '<not_applicable>') return true;  // 允許空
  const lowAns = answer.toLowerCase();
  return stacks.some(s => lowAns.includes(s.toLowerCase()) || s.toLowerCase().includes(lowAns));
}

// -------- Step 0: 前置檢查 --------
async function preCheck() {
  if (!existsSync(SCHEMA_PATH)) fatal(`Schema not found: ${SCHEMA_PATH}`);

  let previousWorkspace = null;
  if (existsSync(CURRENT_WORKSPACE_PATH)) {
    previousWorkspace = readFileSync(CURRENT_WORKSPACE_PATH, 'utf-8').trim();
    if (previousWorkspace && !force) {
      const ans = await question(`⚠️  CURRENT_WORKSPACE = "${previousWorkspace}"；確定建立新 workspace 並切換？[y/N] `);
      if (!ans.toLowerCase().startsWith('y')) {
        console.log('使用者取消。');
        process.exit(0);
      }
    }
  }

  const schema = parseYaml(readFileSync(SCHEMA_PATH, 'utf-8'));
  const availableTechStacks = scanAvailableTechStacks();

  console.log(`\n📋 已載入 WORKSPACE_SCHEMA（version: ${schema.schema_version || 'unknown'}）`);
  console.log(`📋 已掃描 tech-stacks/（${availableTechStacks.length} 份可用）`);
  if (availableTechStacks.length > 0) {
    console.log(`   可用清單：${availableTechStacks.slice(0, 6).join(', ')}${availableTechStacks.length > 6 ? ' ...' : ''}`);
  }

  return { schema, availableTechStacks, previousWorkspace };
}

// -------- Step 1-5: 逐 schema 區塊問答 --------
async function collectAnswers( schema, availableTechStacks, nameOverride) {
  const answers = {};
  const topBlocks = Object.keys(schema).filter(k => !['schema_version', 'last_modified', 'last_proposal'].includes(k));

  // 先問 project_name（或使用 --name 參數）
  let name = nameOverride;
  if (!name) {
    while (true) {
      name = (await question('\nproject_name [required, snake_case 英文代號]: ')).trim();
      if (!name) { console.log('❌ project_name 必填'); continue; }
      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        console.log('❌ 格式錯誤：須為小寫字母開頭，僅含英數與底線');
        continue;
      }
      break;
    }
  } else {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) fatal(`--name "${name}" 格式錯誤（須 snake_case 英文）`);
  }
  answers['PROJECT_CONTEXT.project_name'] = name;

  // 逐區塊問答
  for (const block of topBlocks) {
    const blockFields = schema[block];
    if (!blockFields || typeof blockFields !== 'object') continue;

    // Case 1: 頂層 block 本身即為單一 field（如 FUNCTIONAL_DOMAINS / CRITICAL_PATHS / BUSINESS_RULES
    //         等，直接以 `type: table|text|list` 標示）。此時 blockFields = { type, required, description, ... }
    //         不是「子欄位容器」，須一次詢問即完成。
    if (typeof blockFields.type === 'string') {
      console.log(`\n=== ${block} ===`);
      const hint = blockFields.required ? '[required]' : '[optional]';
      const desc = blockFields.description ? `\n  （${blockFields.description}）` : '';
      const ans = (await question(`\n${block} ${hint}:${desc}\n> `)).trim();
      if (blockFields.required && !ans) {
        fatal(`required block "${block}" 未填寫；無法繼續`);
      }
      answers[block] = ans || '<not_applicable>';
      continue;
    }

    console.log(`\n=== ${block} ===`);

    // Case 2: 頂層 block 為多欄位容器（如 PROJECT_CONTEXT / TECH_STACK / PATHS 等）
    for (const [field, def] of Object.entries(blockFields)) {
      // 已經問過 project_name 跳過
      if (block === 'PROJECT_CONTEXT' && field === 'project_name') continue;

      // def 可能是 object（帶 type / required / description）或子區塊（如 PATHS.source_modules）
      const isFieldDef = def && typeof def === 'object' && 'type' in def;
      if (!isFieldDef) {
        // 子區塊（如 PATHS.source_modules / DEPLOYMENT_CONSTRAINTS 的子欄位結構）
        // 簡化處理：提示 User 輸入 YAML 片段或跳過
        console.log(`\n  -- ${block}.${field}（子區塊；可選）--`);
        const subAns = (await question(`  ${block}.${field}（輸入 YAML 片段或留白跳過）: `)).trim();
        if (subAns) answers[`${block}.${field}`] = subAns;
        continue;
      }

      const hint = def.required ? '[required]' : '[optional]';
      const desc = def.description ? `\n  （${def.description}）` : '';
      let ans = (await question(`\n${block}.${field} ${hint}:${desc}\n> `)).trim();

      // TECH_STACK 熔斷檢查
      if (block === 'TECH_STACK' && ans && !answerMatchesAvailableStacks(ans, availableTechStacks)) {
        console.log(`⚠️  "${ans}" 無對應 tech-stacks/*.md。`);
        const choice = (await question('  [1] 中止並先產出 tech-stacks 提案 / [2] 跳過該技術棧規範（採通用）/ [3] 修改輸入: ')).trim();
        if (choice === '1') fatal('使用者中止 onboarding（建議先透過 @Retro 產出 tech-stacks 提案）');
        if (choice === '3') {
          ans = (await question(`${block}.${field} ${hint}: `)).trim();
        }
        // choice === '2' → 維持原答案（採通用規範）
      }

      // required 阻斷
      if (def.required && !ans) {
        fatal(`required 欄位 "${block}.${field}" 未填寫；無法繼續（依 project-onboarding §Step 1-2）`);
      }

      answers[`${block}.${field}`] = ans || '<not_applicable>';
    }
  }

  return { name, answers };
}

// -------- Step 6: 預覽 + 寫檔（transaction-like）--------
async function previewAndCommit( name, answers, previousWorkspace) {
  const wsFile = join(WORKSPACES_DIR, `${name}.md`);
  const wsDir = join(WORKSPACES_DIR, name);
  const proposalsDir = join(wsDir, 'proposals');

  if (existsSync(wsFile) && !force) {
    fatal(`workspace 已存在：${wsFile}；使用 --force 覆寫`);
  }

  const content = renderWorkspaceMd(name, answers);
  const proposalIndex = renderProposalIndexShell(name);

  console.log('\n📋 將建立以下檔案：');
  console.log(`  - ${wsFile}`);
  console.log(`  - ${wsDir}/proposals/active/.gitkeep`);
  console.log(`  - ${wsDir}/proposals/completed/.gitkeep`);
  console.log(`  - ${wsDir}/proposals/archived/.gitkeep`);
  console.log(`  - ${wsDir}/proposals/PROPOSAL_INDEX.md`);
  console.log(`  - ${CURRENT_WORKSPACE_PATH}（寫入「${name}」）`);
  console.log('');
  console.log(`📋 workspace.md 預覽（前 20 行）：`);
  console.log(content.split('\n').slice(0, 20).map(l => '  ' + l).join('\n'));
  console.log('  ...');

  if (dryRun) {
    console.log('\n[DRY-RUN] 不執行實際寫檔。結束。');
    return { success: true, skipped: true };
  }

  const ok = (await question('\n確認執行？[y/N] ')).trim();
  if (!ok.toLowerCase().startsWith('y')) {
    console.log('使用者取消。');
    return { success: false, cancelled: true };
  }

  // 寫檔（transaction-like）
  try {
    mkdirSync(join(proposalsDir, 'active'), { recursive: true });
    mkdirSync(join(proposalsDir, 'completed'), { recursive: true });
    mkdirSync(join(proposalsDir, 'archived'), { recursive: true });
    writeFileSync(join(proposalsDir, 'active', '.gitkeep'), '');
    writeFileSync(join(proposalsDir, 'completed', '.gitkeep'), '');
    writeFileSync(join(proposalsDir, 'archived', '.gitkeep'), '');
    writeFileSync(join(proposalsDir, 'PROPOSAL_INDEX.md'), proposalIndex);
    writeFileSync(wsFile, content);
    writeFileSync(CURRENT_WORKSPACE_PATH, name + '\n');
    console.log('✅ 檔案寫入完成');
  } catch (e) {
    console.error(`❌ 寫檔失敗：${e.message}`);
    rollback(name, previousWorkspace);
    process.exit(2);
  }

  // 驗證
  console.log('\n🔍 執行 workspace-schema-validator...');
  const validateRes = spawnSync('node', [
    join(AGENTS_ROOT, 'tests', 'workspace-schema-validator.mjs'),
    '--workspace', name,
  ], { stdio: 'inherit' });

  if (validateRes.status === 2) {
    console.error('❌ validator 錯誤；回退變更');
    rollback(name, previousWorkspace);
    process.exit(2);
  }

  updateWorkspacesReadme(name);

  return { success: true };
}

function rollback(name, previousWorkspace) {
  console.log('↩️  Rolling back...');
  const wsFile = join(WORKSPACES_DIR, `${name}.md`);
  const wsDir = join(WORKSPACES_DIR, name);
  try { if (existsSync(wsFile)) rmSync(wsFile); } catch {}
  try { if (existsSync(wsDir)) rmSync(wsDir, { recursive: true }); } catch {}
  // 回退 CURRENT_WORKSPACE
  try {
    if (previousWorkspace) {
      writeFileSync(CURRENT_WORKSPACE_PATH, previousWorkspace + '\n');
    } else {
      if (existsSync(CURRENT_WORKSPACE_PATH)) rmSync(CURRENT_WORKSPACE_PATH);
    }
  } catch {}
  console.log('✅ 回退完成');
}

// -------- Step 6.5: Tech-Stack 選擇性搬運（PROPOSAL_20260423_017 Phase C）--------
// 依 TECH_STACK.platform 或已填答案推薦；互動選擇要保留的 stacks；未選者可標記 installed:false 或刪檔
// 簡化規則：純 CLI 列表 + 逗號分隔輸入；非 TTY / 無 MANIFEST 則跳過
export async function selectTechStacks(answers) {
  const manifestPath = join(TECH_STACKS_DIR, 'MANIFEST.yaml');
  if (!existsSync(manifestPath)) {
    console.log('ℹ️  tech-stacks/MANIFEST.yaml 不存在；跳過 stack 選擇步驟');
    return { skipped: true };
  }
  // 非 TTY（piped input / CI）時自動跳過，避免消耗後續問答的輸入
  if (!process.stdin.isTTY) {
    console.log('ℹ️  非 TTY 輸入；跳過 tech-stack 選擇（保留 MANIFEST 當前狀態）');
    return { skipped: true };
  }
  const stacks = loadManifestStacks();
  if (!stacks || stacks.length === 0) {
    console.log('ℹ️  MANIFEST 無 stack 條目；跳過');
    return { skipped: true };
  }

  console.log('\n=== Tech-Stack 選擇（PROPOSAL_017）===');
  console.log('已安裝的 stacks（已在當前框架）：');
  const byCat = {};
  for (const s of stacks) (byCat[s.category] ||= []).push(s);
  let idx = 1;
  const indexMap = [];
  for (const cat of Object.keys(byCat).sort()) {
    console.log(`  [${cat}]`);
    for (const s of byCat[cat]) {
      const mark = s.installed ? '✅' : '⬜';
      console.log(`    ${String(idx).padStart(2)}. ${mark} ${s.name}`);
      indexMap.push(s);
      idx++;
    }
  }
  console.log(`
請輸入要「保留安裝」的 stack 編號，逗號分隔（例：1,3,5）
直接 Enter 表示保留「目前全部 installed: true」的 stacks（不變更）
輸入 "all" 全保留；"none" 全不要；"keep" 跳過本步驟`);
  const raw = (await question('> ')).trim();
  if (raw === '' || raw === 'keep') {
    console.log('ℹ️  不變更 MANIFEST 安裝狀態');
    return { skipped: true };
  }

  let selectedNames;
  if (raw === 'all') selectedNames = indexMap.map(s => s.name);
  else if (raw === 'none') selectedNames = [];
  else {
    const picks = raw.split(',').map(x => x.trim()).filter(Boolean);
    selectedNames = picks.map(p => {
      const n = Number(p);
      return (n >= 1 && n <= indexMap.length) ? indexMap[n - 1].name : null;
    }).filter(Boolean);
  }

  // 自動解析依賴
  const selectedSet = new Set(selectedNames);
  for (const name of selectedNames) {
    const s = stacks.find(x => x.name === name);
    for (const dep of s?.depends_on || []) selectedSet.add(dep);
  }

  const keep = stacks.filter(s => selectedSet.has(s.name));
  const drop = stacks.filter(s => !selectedSet.has(s.name) && s.installed);

  console.log('\n📋 變更預覽：');
  console.log(`  保留 installed (${keep.length}): ${keep.map(s => s.name).join(', ') || '(無)'}`);
  console.log(`  將標記 installed:false (${drop.length}): ${drop.map(s => s.name).join(', ') || '(無)'}`);
  console.log('');
  const mode = (await question(
    '未選擇的 stacks 處置：[1] 刪檔+標記 installed:false  [2] 保留檔案，僅標記 installed:false  [keep] 不動作：'
  )).trim().toLowerCase();

  if (mode === 'keep' || mode === '') {
    console.log('ℹ️  不變更');
    return { skipped: true };
  }

  if (dryRun) {
    console.log('[DRY-RUN] 不實際變更 MANIFEST / 不刪檔');
    return { skipped: true };
  }

  // 讀原 MANIFEST，依 regex 更新 installed:
  let text = readFileSync(manifestPath, 'utf-8');
  const { spawnSync: sp } = await import('node:child_process');
  for (const s of drop) {
    // 更新 MANIFEST installed
    const lines = text.split('\n');
    let inEntry = false;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const m = t.match(/^- name:\s*(.+?)\s*$/);
      if (m) inEntry = (m[1].replace(/^["']|["']$/g, '') === s.name);
      else if (inEntry && /^installed:\s*true/.test(t)) {
        lines[i] = lines[i].replace(/installed:\s*true/, 'installed: false');
        inEntry = false;
      }
    }
    text = lines.join('\n');

    // mode === '1' → 額外 git rm（若檔案存在）
    if (mode === '1') {
      const p = s.file || s.folder;
      if (!p) continue;
      const full = join(TECH_STACKS_DIR, p);
      if (!existsSync(full)) continue;
      const rmRes = sp('git', ['rm', statSync(full).isDirectory() ? '-r' : '-f', `tech-stacks/${p}`],
        { cwd: AGENTS_ROOT, encoding: 'utf-8' });
      if (rmRes.status !== 0) {
        console.warn(`⚠️  git rm ${p} 失敗；嘗試直接刪除`);
        try { rmSync(full, { recursive: true, force: true }); } catch {}
      }
    }
  }
  writeFileSync(manifestPath, text);
  console.log(`✅ MANIFEST 更新完成；${mode === '1' ? '已 git rm 未選 stacks' : '檔案保留但 installed:false'}`);
  return { kept: keep.map(s => s.name), dropped: drop.map(s => s.name), mode };
}

// -------- Step 7: 更新 workspaces/README.md 表格 --------
function updateWorkspacesReadme(name) {
  if (!existsSync(WORKSPACES_README)) return;
  const content = readFileSync(WORKSPACES_README, 'utf-8');
  // 偵測是否已有該 workspace 條目
  const entryPattern = new RegExp(`\\|\\s*\`${name}\`\\s*\\|`, 'm');
  if (entryPattern.test(content)) {
    console.log(`ℹ️  README.md 已含 "${name}" 條目，不重複新增`);
    return;
  }
  // 在「當前已建立的 workspace」表格最後 append（簡化：尋找表格結尾並插入）
  const tableMarker = /\|\s*`investmentlinenotify`.*Active\s*\|/;
  if (tableMarker.test(content)) {
    const newRow = `| \`${name}\` | （由 CLI 建立；待補專案描述）| ✅ Active |`;
    const updated = content.replace(tableMarker, (match) => `${match}\n${newRow}`);
    writeFileSync(WORKSPACES_README, updated);
    console.log(`✅ workspaces/README.md 已更新（新增 "${name}" 條目）`);
  } else {
    console.log(`ℹ️  workspaces/README.md 表格格式不符預期；請手動新增 "${name}" 條目`);
  }
}

// -------- 後置指引 --------
function printPostGuide(name) {
  console.log(`
✅ Workspace "${name}" 建立完成

📂 檔案位置：
   - .agents/workspaces/${name}.md（主 workspace 檔）
   - .agents/workspaces/${name}/proposals/（專案 scope 提案目錄）
   - .agents/CURRENT_WORKSPACE（已指向 "${name}"）

🎯 下一步建議：
   1. 檢視 .agents/workspaces/${name}.md 確認所有欄位
   2. 呼叫 @Lead 派發 @Planner 進入需求階段
   3. 於根目錄建立 PENDING_ACTIONS.md（由 @Assistant 初始化）

📖 參考：
   - tasks/project-onboarding.md（完整 6 步驟 SOP）
   - WORKSPACE_SCHEMA.yaml（欄位契約 SSOT）
`);
}

// -------- CLI entry guard（依 PROPOSAL_20260423_006 Part 1）--------
// 允許 unit.test.mjs import 純函式而不觸發 main / readline / CLI args
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const showHelp = parseCliArgs();
  if (showHelp) { printHelp(); process.exit(0); }

  (async () => {
    try {
      const { schema, availableTechStacks, previousWorkspace } = await preCheck();
      const { name, answers } = await collectAnswers(schema, availableTechStacks, nameArg);
      // PROPOSAL_20260423_017 Phase C：Tech-Stack 選擇性搬運（MANIFEST-aware）
      await selectTechStacks(answers);
      const result = await previewAndCommit(name, answers, previousWorkspace);

      if (result.success && !result.skipped) {
        printPostGuide(name);
      }
    } catch (e) {
      console.error(`❌ 未預期錯誤：${e.message}`);
      process.exit(2);
    } finally {
      closeReadline();
    }
  })();
}
