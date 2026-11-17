#!/usr/bin/env node
/**
 * Phase 4 · 計算樣式斷言（回答「圓角是否 20px、按鈕是否膠囊、間距是否 8 倍數」）
 * 用既有 serve-fixtures + Playwright（環境曾驗證可用）
 */
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 5177;
process.env.FIXTURE_PORT = String(PORT);

const srv = fork(path.join(ROOT, 'scripts/agent/serve-fixtures.mjs'), {
  cwd: ROOT, stdio: 'ignore', env: { ...process.env, FIXTURE_PORT: String(PORT) },
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitServer(t=20000){const s=Date.now();while(Date.now()-s<t){try{const r=await fetch(`http://127.0.0.1:${PORT}/api/status`);if(r.ok)return true}catch { /* server not ready */ }await sleep(300)}return false}

const ROUTES = [
  ['dashboard', '/#/dashboard'],
  ['insights-radar', '/#/insights?tab=radar'],
  ['chart', '/#/chart'],
  ['news', '/#/news'],
  ['account', '/#/account'],
  ['strategy-config', '/#/strategy-config'],
];

const checks = [];
function add(page, rule, value, pass) { checks.push({ page, rule, value, pass }); }

async function main() {
  if (!(await waitServer())) { console.error('server timeout'); process.exit(1); }
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--headless=new','--single-process','--no-zygote','--no-sandbox',
           '--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl-egl',
           '--js-flags=--max-old-space-size=128'],
    timeout: 30000,
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const base = `http://127.0.0.1:${PORT}`;

  for (const [name, route] of ROUTES) {
    const page = await ctx.newPage();
    await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    const probe = await page.evaluate(() => {
      const cs = (el) => el ? getComputedStyle(el) : null;
      const card = document.querySelector('.content-card, .iln-card');
      const cardCs = cs(card);
      const btn = document.querySelector('.el-button, button');
      const btnCs = cs(btn);
      const html = cs(document.documentElement);
      const body = cs(document.body);
      const brand = html.getPropertyValue('--iln-brand').trim();
      const radiusCard = html.getPropertyValue('--iln-radius-card').trim();
      const radiusFull = html.getPropertyValue('--iln-radius-full').trim();
      const space4 = html.getPropertyValue('--iln-space-4').trim();
      // 抓主内容区的 padding
      const main = document.querySelector('.iln-page, .app-main');
      const mainCs = cs(main);
      return {
        brand, radiusCard, radiusFull, space4,
        cardRadius: cardCs?.borderRadius || null,
        cardPadding: cardCs?.paddingTop || null,
        btnRadius: btnCs?.borderRadius || null,
        bodyBg: body?.backgroundColor || null,
        mainPadding: mainCs?.paddingLeft || null,
        scheme: document.documentElement.dataset.tgScheme,
      };
    });
    add(name, '--iln-brand = #6750A4 (B1)', probe.brand, probe.brand === '#6750A4');
    add(name, '--iln-radius-card = 20px', probe.radiusCard, probe.radiusCard === '20px');
    add(name, '--iln-space-4 = 16px', probe.space4, probe.space4 === '16px');
    if (probe.cardRadius) add(name, '卡片 border-radius = 20px', probe.cardRadius, probe.cardRadius === '20px');
    if (probe.btnRadius) add(name, '按鈕膠囊 (border-radius 很大/50%)', probe.btnRadius, parseFloat(probe.btnRadius) >= 20 || probe.btnRadius.includes('%'));
    if (probe.cardPadding) add(name, '卡片 padding ≥ 16px', probe.cardPadding, parseFloat(probe.cardPadding) >= 16);
    add(name, 'scheme = dark（Playwright 模擬）', probe.scheme, probe.scheme === 'dark');
    await page.close();
  }

  await browser.close();
  srv.kill('SIGKILL');

  const failed = checks.filter(c => !c.pass);
  console.log(JSON.stringify({ checks, failed: failed.length }, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); srv.kill('SIGKILL'); process.exit(1); });
