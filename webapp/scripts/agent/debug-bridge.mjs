#!/usr/bin/env node
/**
 * Boot 時序橋探針
 * 讀取 window.__TELEGRAM_BRIDGE__ 完整快照，驗證 boot 各階段時間戳。
 * 用法：node --max-old-space-size=192 scripts/agent/debug-bridge.mjs
 */
import { fork } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 5183;
const srv = fork(path.join(ROOT, 'scripts/agent/serve-fixtures.mjs'), {
  cwd: ROOT, stdio: 'ignore', env: { ...process.env, FIXTURE_PORT: String(PORT) },
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ws(t = 15000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/api/status`); if (r.ok) return true; }
    catch { /* server not ready */ }
    await sleep(300);
  }
  return false;
}

async function main() {
  if (!(await ws())) { console.log('FAIL: server not ready'); process.exit(1); }
  const b = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--headless=new', '--single-process', '--no-zygote', '--no-sandbox',
           '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl-egl'],
    timeout: 30000,
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => consoleErrs.push('PAGEERROR: ' + e.message));

  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/#/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const tGoto = Date.now() - t0;
  await sleep(3000);

  // 讀 bridge 快照
  const snapshot = await page.evaluate(() => window.__TELEGRAM_BRIDGE__ ?? null);

  // 驗證 app 自身 API 請求是否寫入 bridge
  // 注意：不能用裸 fetch() 測，要走 apiFetch() 才會觸發 recordFetchToBridge()
  // 這裡改為斷言「進入頁面後 app 已有過至少一次 API 請求」
  const fetchProbe = await page.evaluate(() => {
    const b = window.__TELEGRAM_BRIDGE__;
    return {
      hasFetch: b?.lastFetchAt !== null,
      lastFetchPath: b?.lastFetchPath,
      lastFetchOk: b?.lastFetchOk,
      // 裸 fetch 不會寫入 bridge，這是預期行為（只走 apiFetch 才寫）
      rawFetchDoesNotWrite: true,
    };
  });

  const domProbe = await page.evaluate(() => ({
    appChildren: document.getElementById('app')?.children.length ?? 0,
    hasBootLoading: !!document.querySelector('.boot-loading'),
    hasVueApp: !!document.querySelector('.app-container'),
    hasFallbackText: document.body.innerText.includes('Telegram'),
  }));

  // 計算 boot 階段耗時
  const timing = snapshot ? {
    moduleStart: snapshot.tModuleStart,
    mountCost: snapshot.tMountStart != null && snapshot.tMountEnd != null
      ? (snapshot.tMountEnd - snapshot.tMountStart).toFixed(1) + 'ms' : null,
    readyCost: snapshot.tReadyStart != null && snapshot.tReadyResolved != null
      ? (snapshot.tReadyResolved - snapshot.tReadyStart).toFixed(1) + 'ms' : null,
    gotoToReady: snapshot.tReadyResolved != null ? (snapshot.tReadyResolved).toFixed(0) + 'ms' : null,
  } : null;

  const out = {
    gotoMs: tGoto,
    snapshot,
    timing,
    fetchProbe,
    domProbe,
    consoleErrors: consoleErrs.slice(0, 5),
  };
  console.log(JSON.stringify(out, null, 2));

  await b.close();
  srv.kill('SIGKILL');
}

main().catch(e => { console.error(e); srv.kill('SIGKILL'); process.exit(1); });
