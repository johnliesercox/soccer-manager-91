// Viewport audit (Phase 3 brief, acceptance D04, D05, D07, D08, D09): the built game is served over http and a match is
// watched in the Isometric view at the five viewport presets of the brief. For each one the tool measures, from the page
// as a player would see it: whether every required control is on screen, unclipped and uncovered; whether the page or the
// match column scrolls; that the stage is painted; the size of the touch targets; the size of the drawn figures at each
// camera; whether a tap or click on a figure selects it, and how far outside the figure a tap still counts; and what
// rotating the device does while paused and while playing. It changes nothing in the game and only reports.
//   node tools/viewport-audit.js . out-dir        (after python3 build.py; needs playwright and its Chromium)
// Writes out-dir/audit.json and screenshots, prints a summary, exits 1 if a required control is missing or clipped or the
// stage stays unpainted while a match plays. What it reports without failing (touch targets, selection tolerance, the
// commentary line below the fold, a blank stage after a turn while paused) is for the QA report.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const [SITE = '.', OUT = 'viewport-audit-out'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const PRESETS = [
  { name: 'phone-360x640',     w: 360,  h: 640,  touch: true,  dsf: 3, rotate: { w: 640, h: 360 } },
  { name: 'phone-390x664',     w: 390,  h: 664,  touch: true,  dsf: 3, rotate: { w: 844, h: 390 } },
  { name: 'landscape-844x390', w: 844,  h: 390,  touch: true,  dsf: 3, rotate: { w: 390, h: 664 } },
  { name: 'desktop-1366x768',  w: 1366, h: 768,  touch: false, dsf: 1, rotate: { w: 1024, h: 768 } },   // a window resize, not a rotation
  { name: 'desktop-1920x1080', w: 1920, h: 1080, touch: false, dsf: 1, rotate: null },
];
const REQUIRED = ['#md-play', '#md-speed-1', '#md-speed-2', '#md-speed-4', '[data-a="md-skip"]', '#md-camera', '#md-view', '#md-sound', '#md-score', '#md-clock', '#md-stage', '#md-comm'];
const INFO = ['#md-comm'];   // reported, not failed: the commentary line is information, not a control (the event log below it always scrolls)
const BUTTONS = ['#md-play', '#md-speed-1', '#md-speed-2', '#md-speed-4', '[data-a="md-skip"]', '#md-camera', '#md-view', '#md-sound'];
const FINGER = 44;   // CSS pixels: the usual minimum comfortable touch target

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(SITE, p);
  if (path.resolve(f).indexOf(path.resolve(SITE)) !== 0){ res.writeHead(403); res.end('no'); return; }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- what is measured in the page ----
// the layout: every required element's box, whether it is wholly inside the window, whether something covers its centre,
// whether its text is cut off, and whether the page or the match column scrolls
const layout = (required) => {
  const iw = window.innerWidth, ih = window.innerHeight; const wrap = document.querySelector('.md-wrap'); const out = { inner: [iw, ih], wide: !!wrap && getComputedStyle(wrap).display === 'grid', items: {} };
  for (const sel of required){
    const el = document.querySelector(sel); if (!el){ out.items[sel] = { missing: true }; continue; }
    const r = el.getBoundingClientRect(); const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const top = document.elementFromPoint(Math.min(iw-1, Math.max(0, cx)), Math.min(ih-1, Math.max(0, cy)));
    out.items[sel] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= iw + 0.5 && r.bottom <= ih + 0.5 && r.width > 0 && r.height > 0,
      covered: !(top && (top === el || el.contains(top) || top.contains(el) && top.id === 'md-stage')), coveredBy: top && top !== el && !el.contains(top)? (top.id || top.className || top.tagName) : null,
      cut: el.scrollWidth > el.clientWidth + 1, text: (el.tagName === 'BUTTON' || sel === '#md-clock')? el.textContent.trim() : undefined, hidden: getComputedStyle(el).display === 'none' };
  }
  const de = document.documentElement, main = document.querySelector('main');
  out.pageScrollsX = de.scrollWidth > iw + 1; out.pageScrollsY = de.scrollHeight > ih + 1;
  out.mainScrolls = main? main.scrollHeight > main.clientHeight + 1 : null; out.mainOverflow = main? main.scrollHeight - main.clientHeight : null;
  const badge = document.querySelector('#md-badge'); if (badge && !badge.hidden){ const b = badge.getBoundingClientRect(); out.badge = { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), text: badge.textContent }; }
  return out;
};
// the stage: the canvas and how much of it is painted (a cleared canvas is transparent black everywhere)
const stage = () => {
  const c = document.querySelector('#md-stage canvas'); if (!c) return { canvas: false };
  const r = c.getBoundingClientRect(); const ctx = c.getContext('2d'); const seen = new Set(); let clear = 0, n = 0;
  for (let gy = 0; gy < 12; gy++) for (let gx = 0; gx < 16; gx++){
    const d = ctx.getImageData(Math.floor((gx + 0.5) * c.width/16), Math.floor((gy + 0.5) * c.height/12), 1, 1).data; n++;
    if (d[3] === 0) clear++; seen.add(d[0] + ',' + d[1] + ',' + d[2] + ',' + d[3]);
  }
  const v = window.__sm91.S.md && window.__sm91.S.md.viewer; const rn = v && v.renderer; const lf = rn && rn.lastFrame? rn.lastFrame() : null;
  return { canvas: true, css: [Math.round(r.width), Math.round(r.height)], backing: [c.width, c.height], colours: seen.size, clearShare: +(clear/n).toFixed(2), blank: seen.size <= 1,
    camera: rn && rn.getCamera? rn.getCamera() : null, P: lf && lf.cam? lf.cam.P : null, cam: lf && lf.cam? [lf.cam.ox, lf.cam.oy] : null, playing: v && v.playback? v.playback.state().playing : null };
};
// the figures drawn in the last frame, in CSS pixels of the window
const figures = () => {
  const v = window.__sm91.S.md.viewer; const c = document.querySelector('#md-stage canvas'); const r = c.getBoundingClientRect(); const k = r.width / c.width;
  const names = {}; for (const pl of v.scene.getSceneAt(v.playback.state().sceneSecond || 0).players) names[pl.id] = pl.name;
  return v.renderer.debugItems().filter(it => it.kind === 'player' && it.box).map(it => ({ id: it.id, name: names[it.id], x: r.left + it.box.x * k, y: r.top + it.box.y * k, w: it.box.w * k, h: it.box.h * k }))
    .filter(b => b.x >= r.left && b.y >= r.top && b.x + b.w <= r.right && b.y + b.h <= r.bottom);
};
const commentary = () => document.querySelector('#md-comm').textContent;

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(); const report = { site: path.resolve(SITE), when: new Date().toISOString(), presets: [] }; let hard = 0;
  for (const P of PRESETS){
    const ctx = await browser.newContext({ viewport: { width: P.w, height: P.h }, deviceScaleFactor: P.dsf, isMobile: P.touch, hasTouch: P.touch });
    await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort());   // nothing leaves the machine: the usage beacon must not count audit runs
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED|ERR_TUNNEL/.test(m.text())) errors.push('console: ' + m.text()); });
    const has = sel => page.$(sel).then(x => !!x); const click = async (sel, ms = 150) => { await page.click(sel); await sleep(ms); };
    const settled = async () => { let st = await page.evaluate(stage); for (let i = 0; i < 4 && st.blank && st.playing; i++){ await sleep(300); st = await page.evaluate(stage); } return st; };
    const shot = name => page.screenshot({ path: path.join(OUT, P.name + '-' + name + '.png') });
    const poke = async (x, y) => { if (P.touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await sleep(60); };
    const rec = { preset: P.name, viewport: [P.w, P.h], touch: P.touch, steps: {} };
    try {
      // a new single-manager game, straight to the first match
      await page.goto(URL); await sleep(600);
      rec.version = await page.evaluate(() => { const m = /Version (\S+)\./.exec(document.body.innerText); return m? m[1] : null; });
      await click('[data-a="setup"]', 200); const ins = await page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Audit'); await click('[data-a="start"]', 500);
      if (await has('[data-a="preseason"]')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); }
      await click('[data-a="play"]', 400); await click('[data-a="md-watch"]', 300);
      await page.waitForFunction(() => { const v = window.__sm91.S.md && window.__sm91.S.md.viewer; return v && v.renderer && v.playback && (!v.renderer.isReady || v.renderer.isReady()) && v.playback.state().playing; }, null, { timeout: 15000 });
      await sleep(2500);
      rec.view = await page.evaluate(() => localStorage.getItem('sm91-matchday-view') || 'default (isometric)');

      // 1. the layout while the match plays
      rec.steps.playing = { layout: await page.evaluate(layout, REQUIRED), stage: await settled() }; await shot('1-playing');

      // 2. each camera, paused so the figures hold still: their size, and what a tap selects
      await click('#md-play', 250); rec.steps.cameras = {};
      for (let i = 0; i < 3; i++){
        const st = await page.evaluate(stage); const figs = await page.evaluate(figures);
        const ws = figs.map(f => f.w).sort((a, b) => a - b), hs = figs.map(f => f.h).sort((a, b) => a - b); const med = a => a.length? +a[Math.floor(a.length/2)].toFixed(1) : null;
        const cam = { P: st.P, onScreen: figs.length, boxW: med(ws), boxH: med(hs), boxMinW: ws.length? +ws[0].toFixed(1) : null, centre: { tried: 0, hit: 0 }, near: {} };
        // figures nobody overlaps; each tap reads the figure's box again first, as it is drawn at that moment
        const alone = figs.filter(f => !figs.some(g => g !== f && g.x < f.x + f.w + 20 && g.x + g.w > f.x - 20 && g.y < f.y + f.h + 20 && g.y + g.h > f.y - 20)).slice(0, 6);
        const now = async id => (await page.evaluate(figures)).find(f => f.id === id);
        const selects = async (id, dx, dy) => { const f = await now(id); if (!f) return null; await page.evaluate(() => { document.querySelector('#md-comm').textContent = ''; }); await poke(f.x + f.w/2 + dx(f), f.y + f.h/2 + dy(f)); return (await page.evaluate(commentary)).indexOf(f.name + ',') === 0; };
        const before = (await page.evaluate(stage)).cam;
        for (const f of alone){ const r = await selects(f.id, () => 0, () => 0); if (r === null) continue; cam.centre.tried++; if (r) cam.centre.hit++; }
        // the same figures, tapped a little outside their box on each side: how forgiving is selection?
        for (const off of [4, 8, 12]){
          let tried = 0, hit = 0;
          for (const f of alone.slice(0, 4)) for (const [dx, dy] of [[g => -(g.w/2 + off), () => 0], [g => g.w/2 + off, () => 0], [() => 0, g => -(g.h/2 + off)], [() => 0, g => g.h/2 + off]]){ const r = await selects(f.id, dx, dy); if (r === null) continue; tried++; if (r) hit++; }
          cam.near[off + 'px outside'] = { tried, hit };
        }
        const after = (await page.evaluate(stage)).cam; cam.pausedPictureMoved = before && after? Math.round(Math.hypot(after[0] - before[0], after[1] - before[1])) : null;   // the picture should hold still while paused
        rec.steps.cameras[st.camera] = cam; await shot('2-camera-' + st.camera);
        await click('#md-camera', 500);
      }
      rec.steps.cameraLabel = await page.evaluate(() => document.querySelector('#md-camera').textContent);
      // a tap on a control must not select a player
      await page.evaluate(() => { document.querySelector('#md-comm').textContent = ''; }); await click('#md-sound', 150); await click('#md-sound', 150);
      rec.steps.controlTapSelects = /, number \d+\.$/.test(await page.evaluate(commentary));

      // 3. rotating (or resizing) while paused, then playing on, then turning back while playing
      if (P.rotate){
        const rot = {};
        await page.setViewportSize({ width: P.rotate.w, height: P.rotate.h }); await sleep(700);
        rot.pausedAfterTurn = { stage: await page.evaluate(stage), layout: await page.evaluate(layout, REQUIRED) }; await shot('3-turned-paused');
        await click('#md-play', 900);
        rot.playingAfterTurn = { stage: await settled() }; await shot('3-turned-playing');
        await page.setViewportSize({ width: P.w, height: P.h }); await sleep(700);
        rot.playingTurnedBack = { stage: await settled(), layout: await page.evaluate(layout, REQUIRED) }; await shot('3-turned-back');
        rec.steps.rotation = rot;
      } else await click('#md-play', 300);

      // 4. full time: the log is as long as it gets
      await click('[data-a="md-skip"]', 1200);
      rec.steps.fullTime = { layout: await page.evaluate(layout, ['#md-score', '#md-clock', '#md-stage', '#md-camera', '#md-view', '#md-sound', '#md-comm', '#md-log', '[data-a="md-fulltime"]']), stage: await page.evaluate(stage), logLines: await page.evaluate(() => document.querySelectorAll('#md-log div').length) };
      await shot('4-full-time');
    } catch (e){ rec.error = String(e && e.message || e).slice(0, 400); try { await shot('error'); } catch (x){} }
    rec.errors = errors; report.presets.push(rec); await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 1));

  // ---- the summary ----
  const line = s => console.log(s);
  for (const r of report.presets){
    line('\n=== ' + r.preset + (r.version? '  (version ' + r.version + ')' : ''));
    if (r.error){ line('  ERROR ' + r.error); hard++; continue; }
    const L = r.steps.playing.layout, S = r.steps.playing.stage;
    const off = v => v.missing || !v.inside || v.covered || v.hidden;
    const bad = Object.entries(L.items).filter(([k, v]) => !INFO.includes(k) && off(v));
    if (bad.length) hard += bad.length; if (S.blank) hard++;
    line('  required controls on screen and uncovered: ' + (bad.length? 'NO: ' + bad.map(([k, v]) => k + (v.missing? ' missing' : v.hidden? ' hidden' : !v.inside? ' outside the window' : ' covered by ' + v.coveredBy)).join('; ') : 'yes, all ' + (Object.keys(L.items).length - INFO.length)) + '; commentary line on screen: ' + (off(L.items['#md-comm'])? 'NO (below the fold)' : 'yes'));
    line('  page scrolls sideways: ' + (L.pageScrollsX? 'YES' : 'no') + ', page scrolls down: ' + (L.pageScrollsY? 'YES' : 'no') + ', match column scrolls: ' + (L.mainScrolls? 'yes, by ' + L.mainOverflow + ' px' : 'no') + ', two-column layout: ' + (L.wide? 'yes' : 'no'));
    line('  stage ' + S.css.join('x') + ' px, painted: ' + (S.blank? 'NO (blank)' : 'yes') + ', camera ' + S.camera + ' at ' + S.P + ' px per metre');
    const small = BUTTONS.map(b => [b, L.items[b]]).filter(([, v]) => v && !v.missing && (v.w < FINGER || v.h < FINGER));
    line('  touch targets under ' + FINGER + ' px: ' + (small.length? small.map(([k, v]) => k + ' ' + v.w + 'x' + v.h).join(', ') : 'none'));
    const cut = Object.entries(L.items).filter(([, v]) => v.cut); line('  text cut off: ' + (cut.length? cut.map(([k, v]) => k + ' "' + (v.text || '') + '"').join(', ') : 'none') + '; camera label "' + L.items['#md-camera'].text + '", view label "' + L.items['#md-view'].text + '"');
    for (const [cam, c] of Object.entries(r.steps.cameras)) line('  camera ' + cam + ' (' + c.P + ' px/m): ' + c.onScreen + ' figures on screen, a figure is about ' + c.boxW + 'x' + c.boxH + ' px (narrowest ' + c.boxMinW + '); ' + (r.touch? 'tap' : 'click') + ' on the middle selects ' + c.centre.hit + '/' + c.centre.tried + '; just outside: ' + Object.entries(c.near).map(([k, v]) => k.replace(' outside', '') + ' ' + v.hit + '/' + v.tried).join(', ') + '; paused picture moved ' + c.pausedPictureMoved + ' px during the taps');
    line('  a tap on a control selects a player: ' + (r.steps.controlTapSelects? 'YES' : 'no'));
    if (r.steps.rotation){ const R = r.steps.rotation; const b2 = Object.entries(R.pausedAfterTurn.layout.items).filter(([, v]) => v.missing || !v.inside || v.covered || v.hidden);
      line('  turned while paused: stage ' + R.pausedAfterTurn.stage.css.join('x') + ', ' + (R.pausedAfterTurn.stage.blank? 'BLANK' : 'painted') + '; controls ' + (b2.filter(([k]) => !INFO.includes(k)).length? 'NOT all on screen: ' + b2.map(([k]) => k).join(', ') : 'all on screen' + (b2.length? ' (commentary line below the fold)' : '')) + '; after pressing Play: ' + (R.playingAfterTurn.stage.blank? 'BLANK' : 'painted') + '; turned back while playing: ' + (R.playingTurnedBack.stage.blank? 'BLANK' : 'painted')); }
    const F = r.steps.fullTime; const b3 = Object.entries(F.layout.items).filter(([k, v]) => k !== '#md-log' && !INFO.includes(k) && off(v));
    line('  full time (' + F.logLines + ' log lines): ' + (b3.length? 'NOT on screen: ' + b3.map(([k]) => k).join(', ') : 'everything still on screen') + ', stage ' + (F.stage.blank? 'one flat colour' : 'shows the ground') + (F.layout.badge? ', badge still showing "' + F.layout.badge.text + '"' : '') + ', match column scrolls: ' + (F.layout.mainScrolls? 'yes, by ' + F.layout.mainOverflow + ' px' : 'no'));
    if (r.errors.length) line('  page errors: ' + r.errors.slice(0, 3).join(' | '));
  }
  line('\n' + (hard? hard + ' REQUIRED CONTROL PROBLEMS' : 'NO REQUIRED CONTROL IS MISSING OR CLIPPED') + '   (details in ' + path.join(OUT, 'audit.json') + ')');
  process.exit(hard? 1 : 0);
})();
