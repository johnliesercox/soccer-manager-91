// Whole frames of a match as a list of checksums: the same seeded game, the same match, paused and moved to a spread of
// moments (kick-off, open play, goals and their celebrations, the second half), the stage's pixels hashed at each, on a
// phone-sized and a desktop-sized window and with each camera. Two builds that draw the same picture give the same
// file; it is the end-to-end check that work on speed has changed nothing that is seen.
//   node tools/frame-reference.js <site dir> out.json            write the checksums of this build
//   node tools/frame-reference.js <site dir> out.json ref.json   and compare them with an earlier file
// (after python3 build.py; needs playwright)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.resolve(process.argv[2] || '.'); const OUT = process.argv[3] || 'frame-reference.json'; const REF = process.argv[4] || '';
const QUERY = process.env.SM91_QUERY || '';   // for example SM91_QUERY='?rules=1.7' plays the reference match by the match rules of 1.7.1 (no plans, the old formation values)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  if (path.resolve(f).indexOf(SITE) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const INIT = seed => { let a = seed >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(); const out = { frames: {}, count: 0, errors: [] };
  for (const V of [{ name: 'phone', w: 384, h: 692 }, { name: 'desktop', w: 1366, h: 768 }]){
    const ctx = await browser.newContext({ viewport: { width: V.w, height: V.h }, deviceScaleFactor: 1 });
    await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort()); await ctx.addInitScript(INIT, 91);
    const page = await ctx.newPage(); page.on('pageerror', e => out.errors.push(e.message));
    const click = async (sel, ms = 150) => { await page.click(sel); await sleep(ms); }; const has = sel => page.$(sel).then(x => !!x);
    await page.goto(URL + QUERY); await sleep(600); await click('[data-a="setup"]', 200); const ins = await page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Frames'); await click('[data-a="start"]', 500);
    if (await has('[data-a="preseason"]')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); }
    await click('[data-a="play"]', 400); await click('[data-a="md-watch"]', 300);
    await page.waitForFunction(() => { const v = window.__sm91.S.md && window.__sm91.S.md.viewer; const A = window.Matchday.isoAssets; return v && v.playback && v.playback.state().playing && v.renderer && v.renderer.isReady && v.renderer.isReady() && (!A.planeState || [12, 16, 24].every(s => ['ready', 'old way', 'no sheets', 'not read'].indexOf(A.planeState(s)) >= 0)); }, null, { timeout: 60000 });
    await page.evaluate(() => { const v = window.__sm91.S.md.viewer; if (v.playback.state().playing) v.playback.pause(); }); await sleep(500);
    const res = await page.evaluate(async () => {
      const v = window.__sm91.S.md.viewer, MD = window.Matchday; const wait = ms => new Promise(r => setTimeout(r, ms)); const frames = {};
      const hash = d => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i++){ h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
      const goals = v.pres.events.filter(e => e.type === MD.EVENT.GOAL).map(e => e.matchSecond); const segs = v.playback.timeMap().segs.filter(g => !g.ff);
      const times = new Set([0, 1.5, 4]); for (const g of goals) for (const d of [-3, -0.5, 0.3, 1.0, 1.6, 2.6, 4]) times.add(+(g + d).toFixed(2)); segs.forEach((g, i) => { if (i % 3 === 0){ times.add(+g.a.toFixed(2)); times.add(+((g.a + g.b)/2).toFixed(2)); } });
      for (const cam of ['close', 'follow', 'whole']){ v.renderer.setCamera(cam);
        // each moment is drawn as the first frame after a cut to it, and again a third of a second later when the fade
        // of the cut is over: the view's own drawing, with nothing depending on how fast this machine is
        for (const t of [...times].filter(t => t >= 0).sort((a, b) => a - b)){ const g = segs.find(x => t >= x.a && t <= x.b); const hud = g? { segment: { a: g.a, b: g.b } } : {}; const sc = v.scene.getSceneAt(t);
          v.renderer.render(sc, Object.assign({ sinceCut: 0 }, hud)); await wait(340); v.renderer.render(sc, Object.assign({ sinceCut: 5 }, hud));
          const c = document.querySelector('#md-stage canvas'); frames[cam + '|' + t] = c.width + 'x' + c.height + ':' + hash(c.getContext('2d').getImageData(0, 0, c.width, c.height).data); } }
      return { frames, teams: v.pres.teams.home.name + ' v ' + v.pres.teams.away.name, goals: goals.length };
    });
    for (const k of Object.keys(res.frames)){ out.frames[V.name + '|' + k] = res.frames[k]; out.count++; } out[V.name] = res.teams + ', ' + res.goals + ' goals';
    await ctx.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('frames hashed', out.count, '(' + new Set(Object.values(out.frames)).size + ' different) |', out.phone, '| page errors:', out.errors.length);
  let bad = 0; if (out.errors.length){ console.log('FAIL page errors', out.errors.slice(0, 3)); bad++; } if (out.count < 60 || new Set(Object.values(out.frames)).size < out.count*0.6){ console.log('FAIL too few frames, or too many of them alike'); bad++; }
  if (REF){ const ref = JSON.parse(fs.readFileSync(REF, 'utf8')); const keys = new Set(Object.keys(ref.frames).concat(Object.keys(out.frames))); const diff = []; for (const k of keys) if (ref.frames[k] !== out.frames[k]) diff.push(k);
    if (diff.length){ console.log('FAIL', diff.length, 'of', keys.size, 'frames differ from the reference:', diff.slice(0, 12)); bad++; } else console.log('ok   all', keys.size, 'frames are pixel for pixel the reference'); }
  await browser.close(); server.close(); process.exit(bad? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
