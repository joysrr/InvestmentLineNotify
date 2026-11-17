#!/usr/bin/env node
/** 把 PNG 縮成 ASCII 色塊圖，用字符「看」佈局。 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const file = process.argv[2];
const COLS = Number(process.argv[3] || 64);
const png = PNG.sync.read(fs.readFileSync(file));
const { width, height, data } = png;
const ROWS = Math.round(COLS * height / width * 0.5); // 終端字元約 2:1
const cw = Math.max(1, Math.floor(width / COLS));
const ch = Math.max(1, Math.floor(height / ROWS));

function classify(r, g, b) {
  const lum = 0.299*r + 0.587*g + 0.114*b;
  if (Math.abs(r-0x67)<25 && Math.abs(g-0x50)<25 && Math.abs(b-0xA4)<25) return 'B'; // 品牌紫
  if (Math.abs(r-0xEA)<22 && Math.abs(g-0xDD)<22 && Math.abs(b-0xFF)<22) return 'b'; // 品牌容器紫
  if (Math.abs(r-0xFE)<8  && Math.abs(g-0xF7)<8  && Math.abs(b-0xFF)<8)  return ' '; // bg
  if (Math.abs(r-0xF7)<8  && Math.abs(g-0xF2)<8  && Math.abs(b-0xFA)<8)  return '-'; // surface 卡
  if (lum < 70)  return '@'; // 深色文字
  if (lum < 140) return '#'; // 中深
  if (lum < 210) return '+'; // 中灰
  if (lum < 245) return '.'; // 淺
  return ' ';
}

console.log(`=== ${file}  ${width}x${height} → ${COLS}x${ROWS} ===`);
for (let ry = 0; ry < ROWS; ry++) {
  let row = '';
  for (let rx = 0; rx < COLS; rx++) {
    let sr=0,sg=0,sb=0,n=0;
    for (let y = ry*ch; y < Math.min((ry+1)*ch, height); y += 2) {
      for (let x = rx*cw; x < Math.min((rx+1)*cw, width); x += 2) {
        const i = (y*width + x) * 4;
        sr+=data[i]; sg+=data[i+1]; sb+=data[i+2]; n++;
      }
    }
    row += classify(sr/n, sg/n, sb/n);
  }
  console.log(row);
}
