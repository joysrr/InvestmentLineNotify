import { fork } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 5179;
process.env.FIXTURE_PORT = String(PORT);
const srv = fork(path.join(ROOT, 'scripts/agent/serve-fixtures.mjs'), {
  cwd: ROOT, stdio: 'ignore', env: { ...process.env, FIXTURE_PORT: String(PORT) },
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ws(t=15000){const s=Date.now();while(Date.now()-s<t){try{const r=await fetch(`http://127.0.0.1:${PORT}/api/status`);if(r.ok)return true}catch { /* server not ready */ }await sleep(300)}return false}
async function main(){
  if(!(await ws())){console.log('srv timeout');process.exit(1)}
  const b = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--headless=new','--single-process','--no-zygote','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl-egl'],timeout:30000});
  const ctx = await b.newContext({viewport:{width:390,height:844},colorScheme:'light'});
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/#/strategy-config`, {waitUntil:'domcontentloaded'});
  await sleep(3000);
  const r = await page.evaluate(() => {
    const alerts = [...document.querySelectorAll('.el-alert')].map(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { h: Math.round(r.height), display: cs.display, padding: cs.padding, fontSize: cs.fontSize, lineHeight: cs.lineHeight, border: cs.border, bg: cs.backgroundColor };
    });
    const header = document.querySelector('.el-collapse-item__header');
    const headerStyles = header ? {
      tag: header.tagName, h: Math.round(header.getBoundingClientRect().height),
      display: getComputedStyle(header).display,
      padding: getComputedStyle(header).padding,
      lineHeight: getComputedStyle(header).lineHeight,
      textContent: header.textContent.slice(0, 80),
      childElementCount: header.childElementCount,
      innerHTML: header.innerHTML.slice(0, 300),
    } : null;
    const tabs = [...document.querySelectorAll('.el-tab-pane')].map(el => ({
      label: el.getAttribute('aria-label') || el.getAttribute('name'),
      hidden: el.getAttribute('aria-hidden'),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      childCount: el.childElementCount,
    }));
    const formItems = document.querySelectorAll('.el-form-item');
    return { alerts, headerStyles, tabs, formItemCount: formItems.length };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close(); srv.kill('SIGKILL');
}
main().catch(e => { console.error(e); srv.kill('SIGKILL'); process.exit(1); });
