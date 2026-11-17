#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import WebSocket from 'ws';
const WEBAPP = process.argv[2] || '/root/work/InvestmentLineNotify/webapp';
const OUT = process.argv[3] || '/tmp/style-probe.json';
const PORT = 5176, CDP = 9223;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ROUTES = [
  {slug:'dashboard',path:'/dashboard'},
  {slug:'insights-radar',path:'/insights?tab=radar'},
  {slug:'insights-macro',path:'/insights?tab=macro'},
  {slug:'chart',path:'/chart'},
  {slug:'news',path:'/news'},
  {slug:'account',path:'/account'},
  {slug:'strategy-config',path:'/strategy-config'},
];
async function waitHttp(u,t=20000){const t0=Date.now();while(Date.now()-t0<t){try{const r=await fetch(u);if(r.ok)return 1}catch { /* ignore */ }await sleep(300)}return 0}
function mkCdp(ws){let id=0;const p=new Map();ws.on('message',r=>{let m;try{m=JSON.parse(r.toString())}catch{return}if(m.id&&p.has(m.id)){const{res,rej}=p.get(m.id);p.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error).slice(0,200))):res(m.result)}});return{send:(method,params={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}))})}}
async function main(){
  const srv=spawn(process.execPath,['--max-old-space-size=64','scripts/agent/serve-fixtures.mjs'],{cwd:WEBAPP,stdio:['ignore','ignore','ignore'],env:{...process.env,FIXTURE_PORT:String(PORT)}});
  if(!(await waitHttp(`http://127.0.0.1:5176/api/status`))){srv.kill('SIGKILL');throw new Error('srv timeout')}
  const ch=spawn('/usr/bin/chromium',['--headless=new','--single-process','--no-zygote','--no-sandbox','--disable-dev-shm-usage','--disable-extensions','--disable-plugins','--use-gl=angle','--use-angle=gl-egl','--js-flags=--max-old-space-size=192','--window-size=390,844',`--remote-debugging-port=${CDP}`,'--user-data-dir=/tmp/probe-profile','about:blank'],{stdio:['ignore','ignore','ignore']});
  if(!(await waitHttp(`http://127.0.0.1:${CDP}/json/version`))){ch.kill('SIGKILL');srv.kill('SIGKILL');throw new Error('cdp timeout')}
  const tgt=await(await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(tgt.webSocketDebuggerUrl,{perMessageDeflate:false});
  await new Promise((res,rej)=>{ws.once('open',res);ws.once('error',rej)});
  const c=mkCdp(ws);await c.send('Page.enable');await c.send('Runtime.enable');
  const out=[];
  const EXPR=`(()=>{
    const bodyBg=getComputedStyle(document.body).backgroundColor;
    const rootScheme=document.documentElement.dataset.tgScheme||null;
    const rootAttrs=[...document.documentElement.attributes].map(a=>a.name+'='+a.value.slice(0,40));
    const parseRgb=(s)=>{const m=s.match(/\\d+/g);return m?m.slice(0,3).map(Number):null};
    const lum=(r,g,b)=>0.299*r+0.587*g+0.114*b;
    const brightEls=[];
    document.querySelectorAll('*').forEach(el=>{
      const cs=getComputedStyle(el);
      const bg=parseRgb(cs.backgroundColor);
      if(!bg)return;
      const L=lum(...bg);
      const r=el.getBoundingClientRect();
      if(L>200&&r.width>100&&r.height>40){
        const a=cs.backgroundColor.match(/rgba?\\([^)]+\\)/);const alpha=a&&a[0].includes('rgba')?parseFloat(a[0].split(',')[3]):1;
        if(alpha>0.5)brightEls.push({tag:el.tagName,cls:(el.className||'').toString().slice(0,60),bg:cs.backgroundColor,w:Math.round(r.width),h:Math.round(r.height),L:Math.round(L)});
      }
    });
    const card=document.querySelector('.iln-card, .content-card, .card, [class*=card]');
    const cardCs=card?getComputedStyle(card):null;
    const btn=document.querySelector('button, .iln-btn, [class*=btn]');
    const btnCs=btn?getComputedStyle(btn):null;
    const h1=document.querySelector('h1, .view-title, .iln-title, [class*=title]');
    const h1Cs=h1?getComputedStyle(h1):null;
    return {
      rootScheme, rootAttrs:rootAttrs.slice(0,6),
      bodyBg, bodyColor:getComputedStyle(document.body).color,
      bodyLum: Math.round(lum(...(parseRgb(bodyBg)||[0,0,0]))),
      cardBg: cardCs?cardCs.backgroundColor:null,
      cardRadius: cardCs?cardCs.borderRadius:null,
      cardPadding: cardCs?cardCs.padding:null,
      cardBorder: cardCs?cardCs.border:null,
      btnBg: btnCs?btnCs.backgroundColor:null,
      btnRadius: btnCs?btnCs.borderRadius:null,
      h1Color: h1Cs?h1Cs.color:null,
      h1Size: h1Cs?h1Cs.fontSize:null,
      h1Weight: h1Cs?h1Cs.fontWeight:null,
      brightCount: brightEls.length,
      brightSamples: brightEls.slice(0,8),
    };
  })()`;
  for(const r of ROUTES){
    await c.send('Page.navigate',{url:`http://127.0.0.1:5176/#${r.path}`});
    await sleep(4000);
    try{
      const res=await c.send('Runtime.evaluate',{returnByValue:true,expression:EXPR});
      out.push({slug:r.slug,...res.result.value});
    }catch(e){out.push({slug:r.slug,error:String(e.message).slice(0,150)})}
  }
  ws.close();ch.kill('SIGKILL');srv.kill('SIGKILL');
  await fs.writeFile(OUT,JSON.stringify(out,null,2));
  console.log('WROTE '+OUT+' ('+out.length+' pages)');
}
main().catch(e=>{console.error('FAIL',e);process.exit(1)});