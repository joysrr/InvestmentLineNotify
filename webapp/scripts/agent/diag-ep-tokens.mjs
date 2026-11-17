import { fork } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 5181;
process.env.FIXTURE_PORT = String(PORT);
const srv = fork(path.join(ROOT, 'scripts/agent/serve-fixtures.mjs'), {
  cwd: ROOT, stdio: 'ignore', env: { ...process.env, FIXTURE_PORT: String(PORT) },
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ws(t=15000){const s=Date.now();while(Date.now()-s<t){try{const r=await fetch(`http://127.0.0.1:${PORT}/api/status`);if(r.ok)return true}catch{}await sleep(300)}return false}

async function probe(page, scheme) {
  await page.evaluate((s) => { document.documentElement.setAttribute('data-tg-scheme', s); }, scheme);
  await sleep(400);
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const epVars = [
      '--el-color-primary','--el-bg-color','--el-fill-color-light','--el-fill-color-blank',
      '--el-text-color-primary','--el-text-color-regular','--el-border-color','--el-border-radius-base',
      '--el-color-info','--el-color-info-light-9','--el-alert-bg-color',
      '--el-color-success-light-9','--el-color-warning-light-9','--el-color-error-light-9',
    ];
    const ep = {}; epVars.forEach(v => ep[v] = root.getPropertyValue(v).trim());
    const ourVars = ['--iln-brand','--iln-bg','--iln-surface','--iln-text','--iln-hint','--iln-border-subtle'];
    const ours = {}; ourVars.forEach(v => ours[v] = root.getPropertyValue(v).trim());
    const alertEl = document.querySelector('.el-alert');
    const alertCs = alertEl ? getComputedStyle(alertEl) : null;
    const inputEl = document.querySelector('.el-input__wrapper');
    const inputCs = inputEl ? getComputedStyle(inputEl) : null;
    return {
      ep, ours,
      alert: alertCs ? { cls: alertEl.className, bg: alertCs.backgroundColor, color: alertCs.color, radius: alertCs.borderRadius, border: alertCs.borderTopColor } : null,
      input: inputCs ? { bg: inputCs.backgroundColor, radius: inputCs.borderRadius, boxShadow: inputCs.boxShadow } : null,
    };
  });
}

async function main(){
  if(!(await ws())){console.log('timeout');process.exit(1)}
  const b = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--headless=new','--single-process','--no-zygote','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl-egl'],timeout:30000});
  const ctx = await b.newContext({viewport:{width:390,height:844},colorScheme:'light'});
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/#/strategy-config`, {waitUntil:'domcontentloaded'});
  await sleep(3000);
  const light = await probe(page, 'light');
  const dark  = await probe(page, 'dark');
  console.log(JSON.stringify({ light, dark }, null, 2));
  await b.close(); srv.kill('SIGKILL');
}
main().catch(e => { console.error(e); srv.kill('SIGKILL'); process.exit(1); });
