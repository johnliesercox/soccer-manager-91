'use strict';
// Headless harness: boots the built game in jsdom and offers helpers to click through it.
const fs = require('fs');
const { JSDOM } = require('jsdom');
function boot(opts={}){
  const html = fs.readFileSync(opts.file||'soccer-manager-91.html','utf8');
  const errors = [];
  const sent = [];
  const dom = new JSDOM(html, { url: opts.url||'http://localhost/', runScripts:'dangerously', pretendToBeVisual:true, beforeParse(w){
    w.matchMedia = () => ({ matches: !!opts.reduced });
    if (!opts.realCanvas){ const noop = () => {}; const ctx = new Proxy({}, { get: (t, k) => (k==='canvas'? null : noop) }); w.HTMLCanvasElement.prototype.getContext = function(){ return ctx; }; }
    w.console.error = (...a) => errors.push(a.join(' '));
    if (opts.capture){ delete w.navigator.sendBeacon; w.fetch = (url, o) => { sent.push({ url, body: o && o.body }); return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(opts.fetchReply||{ok:true, rows:[]}), text:()=>Promise.resolve('{}') }); }; }
    if (opts.pre) opts.pre(w);
  }});
  const w = dom.window, d = w.document;
  w.addEventListener('error', e => errors.push('window error: '+e.message));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const text = () => d.querySelector('#main').textContent.replace(/\s+/g,' ').trim();
  const hdr = () => d.querySelector('#hdr').textContent.replace(/\s+/g,' ').trim();
  const act = () => d.querySelector('#act').textContent.replace(/\s+/g,' ').trim();
  const has = s => !!d.querySelector(s);
  const click = async (s, ms=40) => { const el = d.querySelector(s); if (!el) throw new Error('no '+s+' on: '+text().slice(0,200)); el.click(); await sleep(ms); };
  const toast = () => d.querySelector('#toast').textContent;
  const app = () => w.__sm91;
  const api = { w, d, sleep, text, hdr, act, has, click, toast, errors, sent, app,
    async start(names, mode){ await sleep(100); await click('[data-a="setup"]', 60); if (names && names.length>1){ await click(`[data-a="setupcount"][data-n="${names.length}"]`, 50); } if (mode && has(`[data-a="mode"][data-m="${mode}"]`)) await click(`[data-a="mode"][data-m="${mode}"]`, 40); const ins = d.querySelectorAll('.mgrname'); (names||['Tester']).forEach((n,i)=>{ if (ins[i]) ins[i].value = n; }); await click('[data-a="start"]', 200); },
    async preseason(){ if (has('[data-a="preseason"]') && act().includes('Pre-season')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); } },
    // matchday screens after a week resolves: Instant (default) or Watch + Skip
    async throughMatchday(mode){
      for (let i=0;i<8;i++){
        if (has('[data-a="md-watch"]')){ if (mode==='watch'){ await click('[data-a="md-watch"]', 80); if (has('[data-a="md-skip"]')) await click('[data-a="md-skip"]', 80); if (has('[data-a="md-fulltime"]')) await click('[data-a="md-fulltime"]', 40); } else await click('[data-a="md-instant"]', 40); }
        if (has('[data-a="md-continue"]')) await click('[data-a="md-continue"]', 40);
        if (!has('[data-a="md-watch"]') && !has('[data-a="md-continue"]')) break;
      }
    },
    async playWeek(mode){ await api.preseason(); if (!has('[data-a="play"]')) throw new Error('no play button on: '+text().slice(0,150)+' | act: '+act()); await click('[data-a="play"]', 150); await api.throughMatchday(mode||opts.matchday); if (has('[data-a="continue-week"]')) await click('[data-a="continue-week"]', 60); },
    async settle(){ // clear review / sacked / job-offer screens back to home
      for (let i=0;i<4;i++){
        await api.throughMatchday(opts.matchday);
        if (has('[data-a="acceptjob"]')) await click('[data-a="declinejob"]');
        if (has('[data-a="newseason"]')) await click('[data-a="newseason"]', 60);
        if (has('[data-a="takesack"]')) await click('[data-a="takesack"]', 60);
        if (has('[data-a="nextround"]')) await click('[data-a="nextround"]', 60);
        if (has('[data-a="back"]') && text().startsWith("Managers' table")) await click('[data-a="back"]', 60);
      }
    },
    async playSeasons(n){ const st = app().S.state; const target = st.season + n; let guard = 0; while (app().S.state.season < target && guard++ < 60*n){ await api.settle(); if (!has('[data-a="play"]') && !has('[data-a="preseason"]')){ await api.settle(); } if (has('[data-a="play"]') || has('[data-a="preseason"]')) await api.playWeek(); else await sleep(20); } await api.settle(); },
  };
  return api;
}
module.exports = { boot };
