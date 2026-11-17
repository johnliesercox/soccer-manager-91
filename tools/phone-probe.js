// One minute of play at John's phone size with the processor slowed, recording what each slow frame was doing.
// node tools/phone-probe.js <site dir> <cpu rate> [out.json]   (after python3 build.py; needs playwright), then python3 tools/phone-probe-report.py out.json
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.resolve(process.argv[2]); const RATE = +process.argv[3] || 1; const OUT = process.argv[4] || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  if (path.resolve(f).indexOf(SITE) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 384, height: 692 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true });
  await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort());
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const click = async (sel, ms = 150) => { await page.click(sel); await sleep(ms); }; const has = sel => page.$(sel).then(x => !!x);
  await page.goto(URL); await sleep(600); await click('[data-a="whatsnew"]', 250); await click('[data-a="md-measure"]', 250); await click('[data-a="title"]', 250);
  await click('[data-a="setup"]', 200); const ins = await page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Probe'); await click('[data-a="start"]', 500);
  if (await has('[data-a="preseason"]')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); }
  await click('[data-a="play"]', 400);
  const cdp = await ctx.newCDPSession(page); if (RATE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await click('[data-a="md-watch"]', 300);
  await page.waitForFunction(() => { const v = window.__sm91.S.md && window.__sm91.S.md.viewer; return v && v.playback && v.renderer && v.renderer.render; }, null, { timeout: 60000 });
  await page.evaluate(() => {
    const v = window.__sm91.S.md.viewer, r = v.renderer, MD = window.Matchday; const orig = r.render.bind(r); const L = window.__log = []; const F = window.__raf = [];
    const sprites = () => (MD.isoAssets && MD.isoAssets.cacheSize? MD.isoAssets.cacheSize() : 0) + (MD.isoSprites && MD.isoSprites.cacheSize? MD.isoSprites.cacheSize() : 0);
    r.render = (s, hud) => { const p0 = r.tilesPainted? r.tilesPainted() : 0, a0 = r.aheadCount? r.aheadCount() : 0, c0 = sprites(), t0 = performance.now(); orig(s, hud); const t1 = performance.now();
      L.push({ t: +t0.toFixed(1), d: +(t1 - t0).toFixed(2), painted: (r.tilesPainted? r.tilesPainted() : 0) - p0, sprites: sprites() - c0, ahead: a0, cut: hud && hud.sinceCut!==undefined? +hud.sinceCut.toFixed(3) : null, ff: !!(hud && hud.fastForward), sec: +(s.t||0).toFixed(2) }); };
    let last = 0; const tick = ts => { const st = v.playback.state(); if (st.playing && last) F.push({ t: +ts.toFixed(1), dt: +(ts - last).toFixed(2) }); last = st.playing? ts : 0; if (!(v.meter && v.meter.done)) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  });
  const done = await page.waitForFunction(() => { const m = document.querySelector('#md-meter'); return m && /card/.test(m.className); }, null, { timeout: 400000 }).then(() => true, () => false);
  const res = await page.evaluate(() => ({ stats: window.Matchday.ui.lastMeasure || null, log: window.__log, raf: window.__raf }));
  res.done = done; res.errors = errors; res.rate = RATE;
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res));
  const s = res.stats || {}; console.log('rate', RATE, 'done', done, JSON.stringify({ fps: s.fps, typ: s.typicalMs, p95: s.p95Ms, p99: s.p99Ms, worst: s.worstMs, slow30: s.slow30, slow20: s.slow20, frames: s.frames, drawAvg: s.drawAvgMs, drawP95: s.drawP95Ms, drawWorst: s.drawWorstMs, stage: s.stage, tiles: s.tiles }), 'errors', errors.length);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
