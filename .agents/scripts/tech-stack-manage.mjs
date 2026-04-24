#!/usr/bin/env node
// tech-stack-manage.mjs
// Tech-Stacks Catalog 管理 CLI（PROPOSAL_20260423_017 Phase C）
// 零依賴：Node.js 內建模組 + Bash（git 命令）
//
// 指令：
//   list                    列出全部 stacks（依 category 分組；顯示 installed/available 狀態）
//   info <name>             顯示單一 stack 詳細
//   install <name>          標記 installed: true；依賴自動解析提示
//   remove <name>           標記 installed: false + git rm 檔案（保留 MANIFEST entry）
//   restore <name>          從 git history 取回檔案 + 標記 installed: true
//
// 通用旗標：
//   --dry-run    僅預覽不寫檔
//   --force      跳過確認
//   --help       顯示說明

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync, readSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = resolve(join(__dirname, '..'));
const TECH_STACKS_DIR = join(AGENTS_ROOT, 'tech-stacks');
const MANIFEST_PATH = join(TECH_STACKS_DIR, 'MANIFEST.yaml');

// ───────── CLI 解析 ─────────
const argv = process.argv.slice(2);
const flags = {
  dryRun: argv.includes('--dry-run'),
  force: argv.includes('--force'),
  help: argv.includes('--help') || argv.includes('-h'),
};
const positional = argv.filter(a => !a.startsWith('--') && a !== '-h');
const [cmd, name] = positional;

function printHelp() {
  console.log(`
tech-stack-manage.mjs — Tech-Stacks Catalog 管理 CLI

USAGE:
  node .agents/scripts/tech-stack-manage.mjs <command> [args] [flags]

COMMANDS:
  list                     列出全部 stacks（依 category 分組）
  info <name>              顯示指定 stack 詳細資訊
  install <name>           將 stack 標記為 installed: true（依賴自動檢查）
  remove <name>            標記 installed: false 並 git rm 檔案
  restore <name>           從 git history 取回檔案並標記 installed: true

FLAGS:
  --dry-run                僅預覽不寫檔
  --force                  跳過互動確認
  --help, -h               顯示本說明

REFERENCE:
  PROPOSAL_20260423_017 / ADR-0031 / tech-stacks/MANIFEST.yaml
`);
}

// ───────── 極簡 MANIFEST YAML parser（僅支援本 MANIFEST 結構）─────────
// 不使用 init-workspace 的 parseYaml（該版不支援 list-of-objects）
export function parseManifest(text) {
  const lines = text.split('\n');
  const result = { version: null, schema_version: null, categories: {}, stacks: [] };
  let mode = null;            // null | 'categories' | 'stacks'
  let currentCat = null;
  let currentStack = null;

  for (let raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    const stripped = line.trim();

    // 頂層 key
    if (indent === 0) {
      const m = stripped.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
      if (!m) continue;
      const [, key, rest] = m;
      if (key === 'version') result.version = parseScalar(rest);
      else if (key === 'schema_version') result.schema_version = parseScalar(rest);
      else if (key === 'categories') { mode = 'categories'; currentCat = null; currentStack = null; }
      else if (key === 'stacks') { mode = 'stacks'; currentCat = null; currentStack = null; }
      continue;
    }

    if (mode === 'categories') {
      // indent 2: 類別名稱
      if (indent === 2) {
        const m = stripped.match(/^([A-Za-z_][\w-]*)\s*:\s*$/);
        if (m) { currentCat = m[1]; result.categories[currentCat] = {}; }
      } else if (indent === 4 && currentCat) {
        const m = stripped.match(/^([A-Za-z_][\w]*)\s*:\s*(.+)$/);
        if (m) result.categories[currentCat][m[1]] = parseScalar(m[2]);
      }
    } else if (mode === 'stacks') {
      // indent 2: 新 stack entry（以 `- name:` 開頭）
      if (indent === 2 && stripped.startsWith('- name:')) {
        currentStack = { name: parseScalar(stripped.slice('- name:'.length).trim()) };
        result.stacks.push(currentStack);
      } else if (indent === 4 && currentStack) {
        const m = stripped.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
        if (m) currentStack[m[1]] = parseScalar(m[2]);
      }
    }
  }
  return result;
}

export function parseScalar(s) {
  s = (s ?? '').trim().replace(/\s*#.*$/, '').trim();
  if (s === '') return null;
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith('[') && s.endsWith(']')) {
    return s.slice(1, -1).split(',').map(x => parseScalar(x)).filter(v => v !== null);
  }
  return s;
}

// ───────── MANIFEST 寫入（行導向；僅更新 installed: 欄位） ─────────
// 不重寫 YAML，避免破壞註解與排版；用精確比對定位 stack entry 後改其 installed 行
export function updateInstalledField(manifestText, stackName, installed) {
  const lines = manifestText.split('\n');
  let inTargetStack = false;
  let baseIndent = null;
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1].length;

    // 偵測 `- name: <stackName>` 的 entry 開頭
    const nameMatch = trimmed.match(/^- name:\s*(.+?)\s*(?:#.*)?$/);
    if (nameMatch) {
      const thisName = nameMatch[1].replace(/^["']|["']$/g, '');
      inTargetStack = thisName === stackName;
      baseIndent = indent;
      continue;
    }

    // 同層或更外層的新 key/entry → 結束 target 範圍
    if (inTargetStack && trimmed.startsWith('- ') && indent <= baseIndent) {
      inTargetStack = false;
      continue;
    }

    if (inTargetStack) {
      const m = line.match(/^(\s*)installed:\s*(true|false)(.*)$/);
      if (m) {
        lines[i] = `${m[1]}installed: ${installed}${m[3]}`;
        modified = true;
        inTargetStack = false;  // 已改完當前 entry
      }
    }
  }

  return { text: lines.join('\n'), modified };
}

// ───────── 工具：Stack 路徑與 git 操作 ─────────
export function stackPath(stack) {
  if (stack.file) return join(TECH_STACKS_DIR, stack.file);
  if (stack.folder) return join(TECH_STACKS_DIR, stack.folder);
  return null;
}

export function stackRelativePath(stack) {
  return stack.file || stack.folder || null;
}

function runGit(args, { quiet = false } = {}) {
  const res = spawnSync('git', args, { cwd: AGENTS_ROOT, encoding: 'utf-8' });
  if (res.status !== 0 && !quiet) {
    console.error(`git ${args.join(' ')} 失敗：${res.stderr || res.stdout}`);
  }
  return res;
}

// ───────── 依賴解析 ─────────
export function resolveDependencies(stacks, targetName) {
  const byName = Object.fromEntries(stacks.map(s => [s.name, s]));
  const resolved = [];
  const seen = new Set();
  const visiting = new Set();

  function dfs(n) {
    if (seen.has(n)) return;
    if (visiting.has(n)) throw new Error(`循環依賴：${n}`);
    visiting.add(n);
    const s = byName[n];
    if (!s) throw new Error(`未知 stack：${n}`);
    for (const dep of s.depends_on || []) dfs(dep);
    visiting.delete(n);
    seen.add(n);
    resolved.push(s);
  }

  dfs(targetName);
  return resolved;
}

// ───────── 指令實作 ─────────
function cmdList(manifest) {
  const byCat = {};
  for (const s of manifest.stacks) {
    (byCat[s.category] ||= []).push(s);
  }
  const cats = Object.keys(manifest.categories)
    .sort((a, b) => (manifest.categories[a].priority || 99) - (manifest.categories[b].priority || 99));

  console.log(`\n📦 Tech-Stacks Catalog（MANIFEST v${manifest.version}）\n`);
  for (const cat of cats) {
    const desc = manifest.categories[cat].description || '';
    const entries = byCat[cat] || [];
    console.log(`── ${cat} ── ${desc}`);
    if (entries.length === 0) { console.log('   （無 stack）\n'); continue; }
    for (const s of entries) {
      const mark = s.installed ? '✅' : '⬜';
      const mode = s.folder ? '[folder]' : '[file]';
      const deps = (s.depends_on && s.depends_on.length) ? ` ← ${s.depends_on.join(', ')}` : '';
      console.log(`   ${mark} ${s.name.padEnd(28)} ${mode.padEnd(9)} ${s.class || ''}${deps}`);
    }
    console.log('');
  }

  const total = manifest.stacks.length;
  const installed = manifest.stacks.filter(s => s.installed).length;
  console.log(`合計：${total}（installed: ${installed} / available: ${total - installed}）`);
}

function cmdInfo(manifest, stackName) {
  const s = manifest.stacks.find(x => x.name === stackName);
  if (!s) { console.error(`❌ 找不到 stack：${stackName}`); process.exit(2); }

  console.log(`\n📦 ${s.name}\n`);
  console.log(`  category       ${s.category}`);
  console.log(`  class          ${s.class || '(unset)'}`);
  console.log(`  mode           ${s.folder ? 'folder' : 'file'}`);
  console.log(`  path           ${stackRelativePath(s)}`);
  console.log(`  installed      ${s.installed ? '✅ true' : '⬜ false'}`);
  console.log(`  depends_on     ${(s.depends_on || []).join(', ') || '(none)'}`);
  console.log(`  platforms      ${(s.platforms || []).join(', ') || '(any)'}`);
  if (s.extends_base) console.log(`  extends_base   true`);
  if (s.vendor_source) console.log(`  vendor_source  ${s.vendor_source}`);
  if (s.vendor_last_vetted) console.log(`  vendor_vetted  ${s.vendor_last_vetted}`);

  const fp = stackPath(s);
  if (fp && existsSync(fp)) {
    console.log(`  file_exists    ✅ ${fp}`);
  } else if (fp) {
    console.log(`  file_exists    ⚠️  missing (${fp})`);
  }
}

function cmdInstall(manifest, stackName) {
  const s = manifest.stacks.find(x => x.name === stackName);
  if (!s) { console.error(`❌ 找不到 stack：${stackName}`); process.exit(2); }

  const chain = resolveDependencies(manifest.stacks, stackName);
  const toInstall = chain.filter(x => !x.installed);

  if (toInstall.length === 0) {
    console.log(`ℹ️  ${stackName} 及其依賴皆已 installed。`);
    return;
  }

  console.log(`📦 將標記為 installed（含依賴）：`);
  for (const x of toInstall) {
    const fp = stackPath(x);
    const exists = fp && existsSync(fp);
    console.log(`   - ${x.name}${exists ? '' : '  ⚠️ 檔案缺失'}`);
  }

  if (flags.dryRun) { console.log('\n[DRY-RUN] 不寫檔'); return; }
  if (!flags.force && !confirmSync('確認執行？[y/N] ')) { console.log('取消。'); return; }

  let text = readFileSync(MANIFEST_PATH, 'utf-8');
  for (const x of toInstall) {
    const r = updateInstalledField(text, x.name, true);
    if (!r.modified) console.warn(`⚠️  未能更新 ${x.name} 的 installed 欄位`);
    text = r.text;
  }
  writeFileSync(MANIFEST_PATH, text);
  console.log('✅ MANIFEST 已更新');

  // 檔案缺失提示
  const missing = toInstall.filter(x => { const fp = stackPath(x); return !fp || !existsSync(fp); });
  if (missing.length > 0) {
    console.log('\n⚠️  下列 stack 檔案不存在，請考慮：');
    for (const x of missing) {
      console.log(`   - ${x.name}：執行 \`node .agents/scripts/tech-stack-manage.mjs restore ${x.name}\` 從 git history 取回`);
    }
  }
}

function cmdRemove(manifest, stackName) {
  const s = manifest.stacks.find(x => x.name === stackName);
  if (!s) { console.error(`❌ 找不到 stack：${stackName}`); process.exit(2); }

  // 檢查有沒有其他 installed stack 依賴此 stack
  const dependents = manifest.stacks.filter(x => x.installed && (x.depends_on || []).includes(stackName));
  if (dependents.length > 0) {
    console.error(`❌ 無法 remove：以下 installed stacks 依賴此 stack：`);
    for (const d of dependents) console.error(`   - ${d.name}`);
    console.error('請先 remove 依賴方，或使用 --force 強制執行（不建議）');
    if (!flags.force) process.exit(2);
  }

  const fp = stackPath(s);
  const relPath = stackRelativePath(s);
  console.log(`📦 remove ${stackName}:`);
  console.log(`   - MANIFEST: installed: true → false`);
  if (fp && existsSync(fp)) {
    console.log(`   - git rm ${relPath}`);
  } else {
    console.log(`   - 檔案已不存在（僅更新 MANIFEST）`);
  }

  if (flags.dryRun) { console.log('\n[DRY-RUN] 不執行'); return; }
  if (!flags.force && !confirmSync('確認執行？[y/N] ')) { console.log('取消。'); return; }

  // git rm
  if (fp && existsSync(fp)) {
    const isDir = statSync(fp).isDirectory();
    const res = runGit(['rm', isDir ? '-r' : '-f', `tech-stacks/${relPath}`]);
    if (res.status !== 0) {
      console.warn('⚠️  git rm 失敗；改用直接刪除');
      rmSync(fp, { recursive: true, force: true });
    }
  }

  const text = readFileSync(MANIFEST_PATH, 'utf-8');
  const r = updateInstalledField(text, stackName, false);
  if (!r.modified) console.warn(`⚠️  未能更新 ${stackName} 的 installed 欄位`);
  writeFileSync(MANIFEST_PATH, r.text);
  console.log('✅ 完成（MANIFEST 保留 entry 以便未來 restore）');
}

function cmdRestore(manifest, stackName) {
  const s = manifest.stacks.find(x => x.name === stackName);
  if (!s) { console.error(`❌ 找不到 stack：${stackName}`); process.exit(2); }

  const relPath = stackRelativePath(s);
  const targetPath = `tech-stacks/${relPath}`;
  const fp = stackPath(s);

  if (fp && existsSync(fp)) {
    console.log(`ℹ️  檔案已存在：${relPath}；僅更新 MANIFEST 狀態`);
  } else {
    // 從 git history 找最近含此檔的 commit
    console.log(`🔍 搜尋 git history 中的 ${targetPath} ...`);
    const logRes = runGit(['log', '--all', '--pretty=format:%H', '--', targetPath], { quiet: true });
    const commits = (logRes.stdout || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (commits.length === 0) {
      console.error(`❌ git history 無此檔案記錄：${targetPath}`);
      console.error('   若為 vendor folder 類，請手動從 upstream 取回。');
      process.exit(2);
    }
    const sourceCommit = commits[0];
    console.log(`   找到最近 commit：${sourceCommit.slice(0, 10)}`);

    if (flags.dryRun) { console.log('[DRY-RUN] 不取回檔案'); return; }
    if (!flags.force && !confirmSync(`從 ${sourceCommit.slice(0, 10)} 取回？[y/N] `)) { console.log('取消。'); return; }

    const dir = dirname(fp);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const checkoutRes = runGit(['checkout', sourceCommit, '--', targetPath]);
    if (checkoutRes.status !== 0) { console.error('❌ git checkout 失敗'); process.exit(2); }
    console.log(`✅ 已從 git history 取回 ${relPath}`);
  }

  // 標記 installed
  const text = readFileSync(MANIFEST_PATH, 'utf-8');
  const r = updateInstalledField(text, stackName, true);
  if (r.modified) writeFileSync(MANIFEST_PATH, r.text);
  console.log('✅ MANIFEST 已標記 installed: true');
}

// ───────── 互動式確認（同步；僅用於 install/remove/restore）─────────
function confirmSync(prompt) {
  process.stdout.write(prompt);
  const buf = Buffer.alloc(1024);
  let read = 0;
  try {
    // 嘗試同步讀取一行（從 stdin fd 0）
    read = readSync(0, buf, 0, buf.length, null);
  } catch {
    // non-TTY 環境：預設為 'n'
    return false;
  }
  const ans = buf.slice(0, read).toString('utf-8').trim();
  return ans.toLowerCase().startsWith('y');
}

// ───────── Entry ─────────
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  if (flags.help || !cmd) { printHelp(); process.exit(cmd ? 0 : 1); }
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`❌ MANIFEST 不存在：${MANIFEST_PATH}`);
    process.exit(2);
  }
  const manifest = parseManifest(readFileSync(MANIFEST_PATH, 'utf-8'));

  switch (cmd) {
    case 'list':    cmdList(manifest); break;
    case 'info':    if (!name) { console.error('❌ info 需指定 <name>'); process.exit(1); } cmdInfo(manifest, name); break;
    case 'install': if (!name) { console.error('❌ install 需指定 <name>'); process.exit(1); } cmdInstall(manifest, name); break;
    case 'remove':  if (!name) { console.error('❌ remove 需指定 <name>'); process.exit(1); } cmdRemove(manifest, name); break;
    case 'restore': if (!name) { console.error('❌ restore 需指定 <name>'); process.exit(1); } cmdRestore(manifest, name); break;
    default:
      console.error(`❌ 未知指令：${cmd}`);
      printHelp();
      process.exit(1);
  }
}
