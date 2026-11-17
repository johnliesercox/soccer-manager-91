// A stand-in for a phone. One minute of play from kick-off at the size of John's Samsung Galaxy S23 Ultra (384x692 CSS
// px at a pixel ratio of 3.75) in headless Chromium with the processor slowed, the game's own measuring screen running,
// and every frame logged with what it was doing: ground tiles painted, player pictures recoloured, a cut, a
// fast-forward, and how long the page's own code ran in that frame. Slowed six times it lands on the figures his phone
// gave on 17 November (49.9 frames a second, 5.8% of frames slower than 30 a second), so it is the gate for work on
// phone frame pacing between his measurements. The game is the same game every run (the page's random numbers are
// seeded here), so two builds are compared on the same match.
//   node tools/phone-probe.js <site dir> [rate=6] [out.json] [seed=91]      (after python3 build.py; needs playwright)
// Exit code 1 when more than 1% of frames are slower than 30 a second (longer than 34 ms).
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.resolve(process.argv[2] || '.'); const RATE = +process.argv[3] || 6; const OUT = process.argv[4] || ''; const SEED = +process.argv[5] || 91;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  if (path.resolve(f).indexOf(SITE) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const INIT = seed => {
  let a = seed >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const T = window.__tasks = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) T.push({ t: +e.startTime.toFixed(1), d: +e.duration.toFixed(1) }); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}   // tasks of 50 ms and more, whatever they are
  // how long the page's own code runs in each animation frame (all the callbacks of the frame together)
  const J = window.__js = []; const raf = window.requestAnimationFrame.bind(window); let cur = null;
  window.requestAnimationFrame = cb => raf(ts => { const t0 = performance.now(); try { cb(ts); } finally { const d = performance.now() - t0; if (cur && cur.ts === ts) cur.d += d; else { cur = { ts, d }; J.push(cur); } } });
};
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 384, height: 692 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true });
  await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort());
  await ctx.addInitScript(INIT, SEED);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const click = async (sel, ms = 150) => { await page.click(sel); await sleep(ms); }; const has = sel => page.$(sel).then(x => !!x);
  await page.goto(URL); await sleep(600); await click('[data-a="whatsnew"]', 250); await click('[data-a="md-measure"]', 250); await click('[data-a="title"]', 250);
  await click('[data-a="setup"]', 200); const ins = await page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Probe'); await click('[data-a="start"]', 500);
  if (await has('[data-a="preseason"]')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); }
  await click('[data-a="play"]', 400);
  // the frame log is hooked on when the match screen makes its view, before the first frame is drawn
  await page.evaluate(() => {
    const MD = window.Matchday; const L = window.__log = [];
    const built = () => (MD.isoAssets && MD.isoAssets.built? MD.isoAssets.built() : (MD.isoAssets && MD.isoAssets.cacheSize? MD.isoAssets.cacheSize() : 0)) + (MD.isoSprites && MD.isoSprites.cacheSize? MD.isoSprites.cacheSize() : 0);
    const hook = r => { if (!r || r.__probed || !r.render) return; r.__probed = true; const orig = r.render.bind(r);
      if (r.warm){ const w = r.warm.bind(r); r.warm = (...args) => { const c0 = built(), t0 = performance.now(); const n = w(...args); window.__warm = { ms: +(performance.now() - t0).toFixed(1), moments: n, pictures: built() - c0 }; return n; }; }
      r.render = (s, hud) => { const p0 = r.tilesPainted? r.tilesPainted() : 0, c0 = built(), t0 = performance.now(); orig(s, hud); const t1 = performance.now(); const f = r.lastFrame? r.lastFrame() : null;
        L.push({ t: +t0.toFixed(1), d: +(t1 - t0).toFixed(2), painted: (r.tilesPainted? r.tilesPainted() : 0) - p0, sprites: built() - c0, cut: hud && hud.sinceCut !== undefined? +hud.sinceCut.toFixed(3) : null, ff: !!(hud && hud.fastForward), sec: +(s.t || 0).toFixed(2), P: f && f.cam? f.cam.P : null }); }; };
    const def = MD.renderers.isometric, make = def.create; def.create = o => { const r = make(o); hook(r); return r; }; window.__stopHook = () => { def.create = make; };
  });
  // as in use: the art has been decoded, and the sheets read, while the player was in the menus
  await page.waitForFunction(() => { const A = window.Matchday.isoAssets; const st = window.Matchday.isoDefaultStyle || 'B'; if (!A || (A.isReady && !A.isReady(st))) return false; return !A.planeState || [16, 12].every(s => ['ready', 'old way', 'no sheets'].indexOf(A.planeState(s, st)) >= 0); }, null, { timeout: 60000 }).catch(() => {});
  const cdp = await ctx.newCDPSession(page); if (RATE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await click('[data-a="md-watch"]', 300);
  const done = await page.waitForFunction(() => { const m = document.querySelector('#md-meter'); return m && /card/.test(m.className); }, null, { timeout: 400000 }).then(() => true, () => false);
  const res = await page.evaluate(() => { window.__stopHook(); const M = window.__sm91.S.md.viewer.meter; return { stats: window.Matchday.ui.lastMeasure || null, log: window.__log, js: window.__js.map(x => ({ t: +x.ts.toFixed(1), d: +x.d.toFixed(2) })), deltas: M? M.deltas.map(x => +x.toFixed(2)) : [], tasks: window.__tasks, warm: window.__warm || null, teams: (document.querySelector('#md-stage canvas') || { getAttribute(){ return ''; } }).getAttribute('aria-label') }; });
  res.done = done; res.errors = errors; res.rate = RATE; res.seed = SEED; if (OUT) fs.writeFileSync(OUT, JSON.stringify(res));
  await browser.close(); server.close();
  // ---- the report ----
  const s = res.stats || {}, L = res.log, D = res.deltas; const pct = (a, q) => { a = a.slice().sort((x, y) => x - y); return a.length? a[Math.min(a.length - 1, Math.floor(a.length*q))] : 0; };
  console.log('phone probe: processor slowed ' + RATE + 'x, seed ' + SEED + ', ' + (res.teams || '') + ', measuring screen finished: ' + done + ', page errors: ' + errors.length);
  console.log('  ' + s.fps + ' frames a second; typical frame ' + s.typicalMs + ' ms, slowest 5% ' + s.p95Ms + ', slowest 1% ' + s.p99Ms + ', worst ' + s.worstMs + ' ms; stage ' + s.stage);
  const over = ms => D.filter(x => x > ms).length; const share = n => (100*n/Math.max(1, D.length)).toFixed(1) + '%';
  console.log('  frames: ' + D.length + '; longer than 34 ms (slower than 30 a second): ' + over(34) + ' (' + share(over(34)) + '); longer than 50 ms: ' + over(50) + ' (' + share(over(50)) + '); longer than 100 ms: ' + over(100));
  console.log('  drawing a frame: ' + s.drawAvgMs + ' ms on average, ' + s.drawP95Ms + ' for the slowest 5%, ' + s.drawWorstMs + ' at worst');
  const kind = x => [x.painted > 0? 'tile' : '', x.sprites > 0? 'pictures' : '', x.cut !== null && x.cut < 0.03? 'cut' : '', x.ff? 'ff' : ''].filter(Boolean).join('+') || 'plain';
  const G = {}; for (const x of L) (G[kind(x)] = G[kind(x)] || []).push(x.d);
  console.log('  drawings by what the frame was doing (n, average ms, slowest 5%, worst):');
  for (const k of Object.keys(G).sort((a, b) => G[b].reduce((x, y) => x + y, 0) - G[a].reduce((x, y) => x + y, 0))){ const a = G[k]; console.log('    ' + k.padEnd(18) + String(a.length).padStart(5) + (a.reduce((x, y) => x + y, 0)/a.length).toFixed(1).padStart(8) + pct(a, 0.95).toFixed(1).padStart(8) + Math.max(...a).toFixed(1).padStart(8)); }
  console.log('  tiles painted: ' + L.reduce((n, x) => n + x.painted, 0) + '; player pictures recoloured: ' + L.reduce((n, x) => n + x.sprites, 0) + '; drawings over 16.7 ms: ' + L.filter(x => x.d > 16.7).length + ', over 33.3 ms: ' + L.filter(x => x.d > 33.3).length);
  const worst = L.slice().sort((a, b) => b.d - a.d).slice(0, 6); console.log('  slowest drawings: ' + worst.map(x => x.d + ' ms (' + kind(x) + (x.painted > 1? ' x' + x.painted : '') + ', ' + x.sec + ' s)').join('; '));
  const js = res.js.map(x => x.d); console.log('  the page\'s code in a frame: ' + (js.reduce((x, y) => x + y, 0)/Math.max(1, js.length)).toFixed(1) + ' ms on average, ' + pct(js, 0.95).toFixed(1) + ' for the slowest 5%, ' + pct(js, 0.99).toFixed(1) + ' for the slowest 1%, ' + (js.length? Math.max(...js) : 0).toFixed(1) + ' at worst');
  const t0 = L.length? L[0].t : 0, t1 = L.length? L[L.length - 1].t : 0; const inPlay = (res.tasks || []).filter(x => x.t >= t0 && x.t <= t1);
  console.log('  tasks of 50 ms or more during play: ' + inPlay.length + (inPlay.length? ' (longest ' + Math.max(...inPlay.map(x => x.d)) + ' ms)' : '') + (res.warm? '; before the clock started, ' + res.warm.pictures + ' pictures made over ' + res.warm.moments + ' moments of the opening in ' + res.warm.ms + ' ms' : ''));
  const pass = done && !errors.length && over(34) <= 0.01*D.length; console.log(pass? 'ok   no more than 1% of frames slower than 30 a second' : 'FAIL more than 1% of frames slower than 30 a second (or the run did not finish)');
  process.exit(pass? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
