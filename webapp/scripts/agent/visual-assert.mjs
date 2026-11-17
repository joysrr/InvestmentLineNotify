#!/usr/bin/env node
/**
 * Phase 4 · 像素級視覺斷言（補足 DOM 探針無法回答的問題）
 * 1. PNG 像素：主色命中率、色彩豐富度、亮度分布
 * 2. 判斷是否符合 A2 Light-first + B1 M3 紫
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const DIR = process.argv[2] || '.agent-report/latest/visual';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png'));

// M3 Light 主色（B1 拍板）
const BRAND = [0x67, 0x50, 0xA4];        // #6750A4
const BRAND_SOFT = [0xEA, 0xDD, 0xFF];   // #EADDFF primary-container
const BG_LIGHT = [0xFE, 0xF7, 0xFF];     // #FEF7FF surface
const ON_SURFACE = [0x1D, 0x1B, 0x20];   // #1D1B20

function near(a, b, tol) {
  return Math.abs(a[0]-b[0])<=tol && Math.abs(a[1]-b[1])<=tol && Math.abs(a[2]-b[2])<=tol;
}

const results = [];
for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(DIR, f)));
  const { width, height, data } = png;
  const total = width * height;
  let brand=0, brandSoft=0, bgLight=0, onSurface=0;
  const colorSet = new Set();
  let lumSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r=data[i], g=data[i+1], b=data[i+2];
    // 量化色彩（16 级/通道）用于统计丰富度
    colorSet.add(((r>>4)<<8) | ((g>>4)<<4) | (b>>4));
    if (near([r,g,b], BRAND, 18)) brand++;
    else if (near([r,g,b], BRAND_SOFT, 18)) brandSoft++;
    if (near([r,g,b], BG_LIGHT, 6)) bgLight++;
    if (near([r,g,b], ON_SURFACE, 12)) onSurface++;
    lumSum += 0.299*r + 0.587*g + 0.114*b;
  }
  results.push({
    file: f,
    size: `${width}x${height}`,
    brandHit: +(brand/total*100).toFixed(3),
    brandSoftHit: +(brandSoft/total*100).toFixed(3),
    bgHit: +(bgLight/total*100).toFixed(2),
    textHit: +(onSurface/total*100).toFixed(2),
    colorRichness: colorSet.size,
    meanLum: +(lumSum/total).toFixed(1),
  });
}

// 断言
const checks = [];
for (const r of results) {
  checks.push({ file: r.file, rule: 'bg #FEF7FF ≥ 50%', value: r.bgHit+'%', pass: r.bgHit >= 50 });
  checks.push({ file: r.file, rule: 'M3 紫品牌色有命中 (brand+brandSoft ≥ 0.05%)', value: (r.brandHit+r.brandSoftHit).toFixed(3)+'%', pass: (r.brandHit+r.brandSoftHit) >= 0.05 });
  checks.push({ file: r.file, rule: '色彩丰富度 ≥ 60（非纯色白屏）', value: r.colorRichness, pass: r.colorRichness >= 60 });
  checks.push({ file: r.file, rule: '文字色 #1D1B20 命中 ≥ 0.5%（有正文渲染）', value: r.textHit+'%', pass: r.textHit >= 0.5 });
  checks.push({ file: r.file, rule: '平均亮度 180-250（Light 主题）', value: r.meanLum, pass: r.meanLum >= 180 && r.meanLum <= 250 });
}
const failed = checks.filter(c => !c.pass);

console.log(JSON.stringify({ results, checks, failed: failed.length }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
