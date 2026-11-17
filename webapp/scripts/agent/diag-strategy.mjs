import { fork } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 5178;
process.env.FIXTURE_PORT = String(PORT);
const srv = fork(path.join(ROOT, 'scripts/agent/serve-fixtures.mjs'), {
  cwd: ROOT, stdio: 'ignore', env: { ...process.env, FIXTURE_PORT: String(PORT) },
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ws(t=15000){const s=Date.now();while(Date.now()-s<t){try{const r=await fetch(`http://127.0.0.1:${PORT}/api/status`);if(r.ok)return true}catch{}await sleep(300)}return false}
async function main(){
  if(!(await ws())){console.log('srv timeout');process.exit(1)}
  const b = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--headless=new','--single-process','--no-zygote','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl-egl'],timeout:30000});
  const ctx = await b.newContext({viewport:{width:390,height:844},colorScheme:'light'});
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  await page.goto(`http://127.0.0.1:${PORT}/#/strategy-config`, {waitUntil:'domcontentloaded', timeout:30000});
  await sleep(3000);

  const state = await page.evaluate(() => {
    const body = document.body;
    // 找可能的 loader / 错误态
    const loaders = [...document.querySelectorAll('[class*=load], [class*=skeleton], [class*=spinner], [class*=error], [class*=empty]')]
      .map(el => ({ cls: el.className.toString().slice(0,80), display: getComputedStyle(el).display, w: el.offsetWidth, h: el.offsetHeight }))
      .filter(x => x.w > 50 && x.h > 50);
    const main = document.querySelector('.iln-page, .app-main, main');
    const textNodes = main ? main.innerText : '';
    // 找出最大的彩色/深色区域
    const all = [...main?.querySelectorAll('*') || []];
    const bigBlocks = all.map(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, cls: (el.className||'').toString().slice(0,60),
               bg: cs.backgroundColor, w: Math.round(r.width), h: Math.round(r.height),
               top: Math.round(r.top), left: Math.round(r.left) };
    }).filter(x => x.w > 200 && x.h > 100).sort((a,b)=>b.w*b.h - a.w*a.h).slice(0,8);
    return {
      textLen: textNodes.length,
      textSample: textNodes.slice(0, 300),
      loaders,
      bigBlocks,
      h1: main?.querySelector('h1,.page-title,.view-title')?.textContent || null,
      cards: main?.querySelectorAll('.iln-card, .content-card, [class*=card]').length || 0,
    };
  });
  console.log(JSON.stringify({ errors, state }, null, 2));
  await b.close(); srv.kill('SIGKILL');
}
main().catch(e => { console.error(e); srv.kill('SIGKILL'); process.exit(1); });
