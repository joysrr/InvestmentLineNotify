#!/usr/bin/env node
/**
 * Phase 4.4 · 静态无障碍审计
 * 1. WCAG AA 对比度（Light + Dark 两套，支持 var() 链解析）
 * 2. icon-only 按钮 aria-label 覆盖率
 * 输出 JSON，退出码 0=全过 / 1=有违规
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '.');
const TOKENS = path.join(ROOT, 'src/styles/tokens.css');

// ── 颜色工具 ──
function parseHex(h) {
  const m = h.replace('#', '').trim();
  if (m.length === 3) return [0, 1, 2].map(i => parseInt(m[i] + m[i], 16));
  if (m.length === 6) return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16));
  return null;
}
function luminance([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const L1 = luminance(a), L2 = luminance(b);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// ── 解析 tokens.css 为两套 scope：root / dark ──
const css = fs.readFileSync(TOKENS, 'utf8');
function extractAll(re, name) {
  const vars = new Map();
  for (const m of css.matchAll(re)) {
    const body = m[1];
    for (const mm of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      if (!vars.has(mm[1])) vars.set(mm[1], mm[2].trim());
    }
  }
  return { name, vars };
}
// 合并所有 :root 块（Light）；[data-tg-scheme="dark"] 块（Dark，会覆盖 Light）
const lightScope = extractAll(/:root\s*\{([\s\S]*?)\}/g, 'light');
const darkScope = extractAll(/:root\[data-tg-scheme="dark"\]\s*\{([\s\S]*?)\}/g, 'dark');

// Dark 继承 Light 未覆盖的变量
function resolve(varName, scope) {
  const stack = new Set();
  function walk(n) {
    if (stack.has(n)) return null;
    stack.add(n);
    let raw = scope.vars.get(n) ?? lightScope.vars.get(n);
    if (!raw) return null;
    // 剥注释
    raw = raw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    // var(...) 递归
    const vm = raw.match(/var\(\s*--([\w-]+)\s*(?:,\s*([^)]+))?\)/);
    if (vm) {
      const inner = walk(vm[1]);
      if (inner) return inner;
      if (vm[2]) {
        const fb = vm[2].trim().match(/#[0-9a-fA-F]{3,6}/);
        if (fb) return fb[0];
      }
      return null;
    }
    const hex = raw.match(/#[0-9a-fA-F]{3,6}/);
    return hex ? hex[0] : null;
  }
  return walk(varName);
}

const pairs = [
  { fg: 'iln-text',          bg: 'iln-bg',      label: '正文 / 底色' },
  { fg: 'iln-hint',          bg: 'iln-bg',      label: '次要 / 底色' },
  { fg: 'iln-text',          bg: 'iln-surface', label: '正文 / 卡片' },
  { fg: 'iln-hint',          bg: 'iln-surface', label: '次要 / 卡片' },
  { fg: 'iln-text-on-brand', bg: 'iln-brand',   label: 'on-brand / 品牌色' },
];
const themeResults = [];
let contrastFails = 0;
for (const scope of [lightScope, darkScope]) {
  for (const p of pairs) {
    const fgHex = resolve(p.fg, scope);
    const bgHex = resolve(p.bg, scope);
    if (!fgHex || !bgHex) {
      themeResults.push({ theme: scope.name, ...p, status: 'SKIP', reason: '无法解析' });
      continue;
    }
    const ratio = +contrast(parseHex(fgHex), parseHex(bgHex)).toFixed(2);
    const pass = ratio >= 4.5;
    if (!pass) contrastFails++;
    themeResults.push({ theme: scope.name, ...p, fgHex, bgHex, ratio, status: pass ? 'AA' : 'FAIL' });
  }
}

// ── icon-only 按钮扫描 ──
const vueFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.vue')) vueFiles.push(p);
  }
})(path.join(ROOT, 'src'));

const ariaResults = [];
let ariaTotal = 0, ariaCovered = 0;
for (const f of vueFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const tpl = (src.match(/<template>[\s\S]*?<\/template>/) || [''])[0];
  for (const m of tpl.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    const openTag = m[0].slice(0, m[0].indexOf('>') + 1);
    const inner = m[1];
    const hasIcon = /<Icon\b|<svg\b/.test(inner);
    const visibleText = inner.replace(/<[^>]*>/g, '').replace(/\{\{[^}]*\}\}/g, 'X').trim();
    if (!hasIcon || visibleText.length > 0) continue;
    ariaTotal++;
    if (/aria-label\s*=/.test(openTag)) ariaCovered++;
    else ariaResults.push({ file: path.relative(ROOT, f), snippet: openTag.slice(0, 140).replace(/\s+/g, ' ') });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  contrast: {
    fails: contrastFails,
    light: themeResults.filter(r => r.theme === 'light'),
    dark: themeResults.filter(r => r.theme === 'dark'),
  },
  aria: {
    total: ariaTotal, covered: ariaCovered,
    coverage: ariaTotal ? +(ariaCovered / ariaTotal * 100).toFixed(1) : 100,
    missing: ariaResults,
  },
};
console.log(JSON.stringify(report, null, 2));
process.exit(contrastFails === 0 && ariaResults.length === 0 ? 0 : 1);
