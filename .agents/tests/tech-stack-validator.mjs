#!/usr/bin/env node
// tech-stack-validator.mjs
// PROPOSAL_20260423_017 Phase E：Tech-Stacks Catalog 一致性驗證
//
// 檢查項目：
//   1. MANIFEST.yaml 存在且可解析
//   2. categories 區段存在 + 每個 stack.category 須為已定義
//   3. MANIFEST 每個 stack entry 的 file/folder 路徑存在（若 installed:true）
//      installed:false 則 file/folder 不存在是合法（已 remove）
//   4. 實體 tech-stacks/ 下所有 .md 檔（含子目錄）皆在 MANIFEST 中註冊
//      （MANIFEST.yaml / README.md / .gitkeep 除外）
//   5. depends_on 指向 MANIFEST 內已註冊的 stack name
//   6. 無循環依賴（DFS 偵測）
//   7. F2 class 的 stack 檔案（若 installed）須含「§專案特化」或 workspace 引用
//   8. 資料夾模式須有 README.md + SOURCE.md（upstream/ 選填）
//   9. vendor_source 存在時，vendor_last_vetted 應已填寫（非 null）
//
// Exit codes: 0 = pass, 1 = warnings, 2 = errors

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, '..'));
const TECH_STACKS_DIR = join(AGENTS_ROOT, 'tech-stacks');
const MANIFEST_PATH = join(TECH_STACKS_DIR, 'MANIFEST.yaml');

let errors = 0;
let warnings = 0;
const errorMsgs = [];
const warnMsgs = [];

function error(msg) { errors++; errorMsgs.push(msg); console.error(`❌ ${msg}`); }
function warn(msg) { warnings++; warnMsgs.push(msg); console.warn(`⚠️  ${msg}`); }
function info(msg) { console.log(`ℹ️  ${msg}`); }

// ───────── Minimal MANIFEST parser ─────────
function parseManifest(text) {
  const out = { version: null, schema_version: null, categories: {}, stacks: [] };
  let mode = null, curCat = null, cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = line.match(/^(\s*)/)[1].length;
    const t = line.trim();

    if (indent === 0) {
      const m = t.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
      if (!m) continue;
      if (m[1] === 'categories') { mode = 'categories'; continue; }
      if (m[1] === 'stacks') { mode = 'stacks'; continue; }
      if (m[1] === 'version') out.version = parseScalar(m[2]);
      if (m[1] === 'schema_version') out.schema_version = parseScalar(m[2]);
      continue;
    }

    if (mode === 'categories') {
      if (indent === 2) {
        const m = t.match(/^([A-Za-z_][\w-]*)\s*:\s*$/);
        if (m) { curCat = m[1]; out.categories[curCat] = {}; }
      } else if (indent === 4 && curCat) {
        const m = t.match(/^([A-Za-z_][\w]*)\s*:\s*(.+)$/);
        if (m) out.categories[curCat][m[1]] = parseScalar(m[2]);
      }
    } else if (mode === 'stacks') {
      if (indent === 2 && t.startsWith('- name:')) {
        cur = { name: parseScalar(t.slice('- name:'.length)) };
        out.stacks.push(cur);
      } else if (indent === 4 && cur) {
        const m = t.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
        if (m) cur[m[1]] = parseScalar(m[2]);
      }
    }
  }
  return out;
}

function parseScalar(s) {
  s = (s ?? '').trim().replace(/\s*#.*$/, '').trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith('[') && s.endsWith(']')) {
    return s.slice(1, -1).split(',').map(x => parseScalar(x)).filter(v => v !== null && v !== '');
  }
  return s;
}

// ───────── 掃實體 tech-stacks 下 .md ─────────
function scanPhysicalStacks() {
  const out = [];
  if (!existsSync(TECH_STACKS_DIR)) return out;
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      if (f === 'MANIFEST.yaml' || f === 'README.md' || f === '.gitkeep') continue;
      const p = join(dir, f);
      const rel = relative(TECH_STACKS_DIR, p);
      const s = statSync(p);
      if (s.isDirectory()) {
        // 檢查是否為 vendor folder（有 README.md 或 SOURCE.md 的直系子資料夾視為 folder-mode stack）
        const hasReadme = existsSync(join(p, 'README.md'));
        const hasSource = existsSync(join(p, 'SOURCE.md'));
        if (hasReadme || hasSource) {
          out.push({ path: rel + '/', type: 'folder' });
          continue;  // 不再深入資料夾（內部檔案屬於該 stack）
        }
        walk(p);
      } else if (f.endsWith('.md')) {
        out.push({ path: rel, type: 'file' });
      }
    }
  };
  walk(TECH_STACKS_DIR);
  return out;
}

// ───────── 循環依賴偵測（DFS）─────────
function detectCycles(stacks) {
  const byName = Object.fromEntries(stacks.map(s => [s.name, s]));
  const color = {};  // 0: unvisited, 1: visiting, 2: done
  const cycles = [];

  function dfs(name, path) {
    if (color[name] === 2) return;
    if (color[name] === 1) {
      const idx = path.indexOf(name);
      cycles.push(path.slice(idx).concat(name).join(' → '));
      return;
    }
    color[name] = 1;
    const s = byName[name];
    for (const d of (s?.depends_on || [])) {
      if (!byName[d]) continue;  // unknown dep 由另一項檢查處理
      dfs(d, path.concat(name));
    }
    color[name] = 2;
  }

  for (const s of stacks) dfs(s.name, []);
  return cycles;
}

// ───────── 主流程 ─────────
console.log('🔍 Tech-Stack Validator (PROPOSAL_20260423_017 Phase E)');
console.log('');

if (!existsSync(MANIFEST_PATH)) {
  error(`MANIFEST 不存在：${relative(AGENTS_ROOT, MANIFEST_PATH)}`);
  process.exit(2);
}

const manifest = parseManifest(readFileSync(MANIFEST_PATH, 'utf-8'));
info(`MANIFEST version: ${manifest.version}; schema: v${manifest.schema_version}`);
info(`Categories: ${Object.keys(manifest.categories).length}; Stacks: ${manifest.stacks.length}`);

// Check 1: categories 區段
if (Object.keys(manifest.categories).length === 0) {
  error('MANIFEST 缺 categories 區段或為空');
}

// Check 2-3: stack entries 完整性
const definedCats = new Set(Object.keys(manifest.categories));
const allNames = new Set();
for (const s of manifest.stacks) {
  if (!s.name) { error(`stack entry 缺 name 欄位`); continue; }
  if (allNames.has(s.name)) error(`stack name 重複：${s.name}`);
  allNames.add(s.name);

  if (!s.category) error(`[${s.name}] 缺 category 欄位`);
  else if (!definedCats.has(s.category)) error(`[${s.name}] 的 category "${s.category}" 未在 categories 區段定義`);

  if (!s.file && !s.folder) error(`[${s.name}] 缺 file 或 folder 欄位（須擇一）`);
  if (s.file && s.folder) error(`[${s.name}] 同時有 file 和 folder（互斥）`);

  // Check 3: installed 路徑存在性
  if (s.installed === true) {
    const relPath = s.file || s.folder;
    const fullPath = join(TECH_STACKS_DIR, relPath);
    if (!existsSync(fullPath)) {
      error(`[${s.name}] installed:true 但檔案不存在：${relPath}`);
    } else if (s.folder) {
      // Check 8: folder mode 必備檔
      if (!existsSync(join(fullPath, 'README.md'))) {
        error(`[${s.name}] 資料夾模式缺 README.md：${relPath}README.md`);
      }
      if (!existsSync(join(fullPath, 'SOURCE.md'))) {
        warn(`[${s.name}] 資料夾模式建議補 SOURCE.md（audit trail）：${relPath}SOURCE.md`);
      }
    }
  }

  // Check 9: vendor_source 有但 vendor_last_vetted 未填
  if (s.vendor_source && !s.vendor_last_vetted && s.installed) {
    warn(`[${s.name}] 已 installed 且有 vendor_source，但 vendor_last_vetted 未填（audit trail 缺失）`);
  }
}

// Check 4: 實體檔案 ↔ MANIFEST 雙向對應
const physicalStacks = scanPhysicalStacks();
const manifestPaths = new Set(manifest.stacks.map(s => s.file || s.folder).filter(Boolean));
for (const p of physicalStacks) {
  if (!manifestPaths.has(p.path)) {
    error(`實體檔案未於 MANIFEST 註冊：${p.path}`);
  }
}

// Check 5: depends_on 合法性
for (const s of manifest.stacks) {
  for (const d of (s.depends_on || [])) {
    if (!allNames.has(d)) {
      error(`[${s.name}] depends_on "${d}" 未在 MANIFEST 中註冊`);
    }
  }
}

// Check 6: 循環依賴
const cycles = detectCycles(manifest.stacks);
if (cycles.length > 0) {
  for (const c of cycles) error(`循環依賴：${c}`);
}

// Check 7: F2 stack 「§專案特化」或 workspace 引用存在性
// F1/F3 無此要求；F2 若已 installed 檢查檔案內容
for (const s of manifest.stacks) {
  if (s.class !== 'F2' || s.installed !== true) continue;
  if (s.folder) {
    // 資料夾模式讀 README.md
    const rd = join(TECH_STACKS_DIR, s.folder, 'README.md');
    if (!existsSync(rd)) continue;  // 已於 Check 8 報錯
    const c = readFileSync(rd, 'utf-8');
    if (!/workspace\.|專案特化|特化參照|Fallback/i.test(c)) {
      warn(`[${s.name}] F2 資料夾 README.md 未見「workspace.* / 專案特化 / Fallback」關鍵字`);
    }
  } else if (s.file) {
    const fp = join(TECH_STACKS_DIR, s.file);
    if (!existsSync(fp)) continue;
    const c = readFileSync(fp, 'utf-8');
    if (!/workspace\.|專案特化|特化參照|Fallback/i.test(c)) {
      warn(`[${s.name}] F2 檔案未見「workspace.* / 專案特化 / Fallback」關鍵字`);
    }
  }
}

console.log('');
console.log(`Summary: errors=${errors}, warnings=${warnings}`);
process.exit(errors > 0 ? 2 : (warnings > 0 ? 1 : 0));
