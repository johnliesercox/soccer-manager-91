// Soak audit (Phase 3 brief, Milestone 5): the built game is served over http and driven in a browser through the things
// that only show up over time or when something goes wrong.
//   leak      E03: ten matches opened and closed and twenty view switches; memory, canvases, animation loops, observers
//             and listeners must not grow
//   fallback  section 10.2, scenario 15: the isometric view is made to fail (it cannot be created, it throws mid-match,
//             its painted art never arrives) and the match must still be watchable and the week playable
//   offline   E05, scenario 13: after one visit the network is cut; the game must reload, start, show a match and save
//   hotseat   scenario 10: three managers, each match watched in the isometric view, nothing given away at a handover
//   measure   E01: the game's own measuring screen (What's new > Measure the match frame rate) run for a minute on a phone-sized
//             and two desktop-sized windows; headless Chromium figures, which say nothing about a real phone (E02)
//   stills    scenarios 7 and 9, B07: pictures of a shoot-out's end, a dismissal and a keeper in the other side's colour
//   node tools/soak-audit.js . out-dir [leak|fallback|offline|hotseat|measure|stills|all]     (after python3 build.py; needs playwright)
// Writes out-dir/soak-<part>.json and screenshots, prints what it found and exits 1 if anything it checks is wrong.
// Requests to anywhere but the local server are blocked, so runs never reach the usage beacon or the ladder.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const [SITE = '.', OUT = 'soak-audit-out', PART = 'all'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  if (path.resolve(f).indexOf(path.resolve(SITE)) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); return !!c; };
const note = msg => console.log('    ', msg);

// counters put into the page before its own script runs: animation frames asked for, observers and window listeners alive
const PROBES = () => {
  const p = window.__probe = { raf: 0, ro: 0, resize: 0, timers: 0 };
  const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => { p.raf++; return raf(cb); };
  if (window.ResizeObserver){ const RO = window.ResizeObserver; window.ResizeObserver = class extends RO { constructor(cb){ super(cb); this._n = 0; } observe(el){ p.ro++; this._n++; return super.observe(el); } disconnect(){ p.ro -= this._n; this._n = 0; return super.disconnect(); } }; }
  const add = window.addEventListener.bind(window), rem = window.removeEventListener.bind(window);
  window.addEventListener = (t, f, o) => { if (t === 'resize') p.resize++; return add(t, f, o); }; window.removeEventListener = (t, f, o) => { if (t === 'resize') p.resize--; return rem(t, f, o); };
};
const stageLook = () => { const c = document.querySelector('#md-stage canvas'); if (!c) return { canvas: false }; const x = c.getContext('2d'); const seen = new Set(); let clear = 0, n = 0;
  for (let gy = 0; gy < 12; gy++) for (let gx = 0; gx < 16; gx++){ const d = x.getImageData(Math.floor((gx + 0.5)*c.width/16), Math.floor((gy + 0.5)*c.height/12), 1, 1).data; n++; if (d[3] === 0) clear++; seen.add(d.join(',')); }
  const v = window.__sm91.S.md && window.__sm91.S.md.viewer; const st = v && v.playback? v.playback.state() : null;
  return { canvas: true, colours: seen.size, clear: clear/n, painted: seen.size > 3 && clear < 0.5, view: (document.querySelector('#md-view')||{}).textContent, playing: st? st.playing : null, second: st? Math.round(st.matchSecond) : null, comm: (document.querySelector('#md-comm')||{}).textContent }; };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: opts.w || 390, height: opts.h || 664 }, deviceScaleFactor: 2, isMobile: !opts.desktop, hasTouch: !opts.desktop });
    await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort());
    await ctx.addInitScript(PROBES); if (opts.init) await ctx.addInitScript(opts.init);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const has = sel => page.$(sel).then(x => !!x); const click = async (sel, ms = 150) => { await page.click(sel); await sleep(ms); };
    const text = () => page.evaluate(() => document.body.innerText);
    const preseason = async () => { if (await has('[data-a="preseason"]') && (await text()).includes('Pre-season')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); } };
    const startGame = async (names) => { await page.goto(URL); await sleep(600); await click('[data-a="setup"]', 200); if (names.length > 1) await click(`[data-a="setupcount"][data-n="${names.length}"]`, 150); const ins = await page.$$('.mgrname'); for (let i = 0; i < names.length; i++) if (ins[i]) await ins[i].fill(names[i]); await click('[data-a="start"]', 500); };
    const toMatch = async () => { await preseason(); await click('[data-a="play"]', 400); };
    const watching = (ms = 15000) => page.waitForFunction(() => { const v = window.__sm91.S.md && window.__sm91.S.md.viewer; return v && v.playback && v.playback.state().playing; }, null, { timeout: ms }).then(() => true, () => false);
    const finish = async () => { if (await has('[data-a="md-skip"]')) await click('[data-a="md-skip"]', 700); if (await has('[data-a="md-fulltime"]')) await click('[data-a="md-fulltime"]', 250); for (let i = 0; i < 4 && await has('[data-a="md-continue"]'); i++) await click('[data-a="md-continue"]', 250); if (await has('[data-a="continue-week"]')) await click('[data-a="continue-week"]', 250); };
    const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });
    return { ctx, page, errors, has, click, text, preseason, startGame, toMatch, watching, finish, shot };
  };

  // ---------------- leak: ten matches, twenty view switches ----------------
  if (PART === 'all' || PART === 'leak'){
    console.log('\n=== leak (E03): ten matches opened and closed, twenty view switches');
    const b = await open(); const cdp = await b.ctx.newCDPSession(b.page); await cdp.send('HeapProfiler.enable');
    const measure = async () => { await cdp.send('HeapProfiler.collectGarbage'); await sleep(150); await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); const p = await b.page.evaluate(() => { const before = window.__probe.raf; return new Promise(r => setTimeout(() => r({ rafIdle: window.__probe.raf - before, ro: window.__probe.ro, resize: window.__probe.resize, canvases: document.querySelectorAll('canvas').length, viewer: !!(window.__sm91.S.md && window.__sm91.S.md.viewer), sprites: (window.Matchday.isoAssets? window.Matchday.isoAssets.cacheSize() : 0) + window.Matchday.isoSprites.cacheSize() }), 600)); }); return Object.assign({ heapMB: +(h.usedSize/1048576).toFixed(1) }, p); };
    const rows = [];
    try {
      await b.startGame(['Soak']); await b.preseason(); rows.push(Object.assign({ at: 'before any match' }, await measure()));
      let toggles = 0;
      for (let m = 1, w = 0; m <= 10 && w < 16; w++){
        await b.toMatch(); if (!(await b.has('[data-a="md-watch"]'))){ await b.finish(); continue; }   // a week with no match for this club
        await b.click('[data-a="md-watch"]', 300); await b.watching(); await sleep(1200);
        for (let k = 0; k < 2; k++){ await b.click('#md-view', 350); toggles++; }          // two switches a match: twenty in all
        for (let k = 0; k < 2; k++) await b.click('#md-view', 350);                         // and round to the isometric view again
        await b.click('#md-camera', 200); await sleep(800);
        await b.finish(); await sleep(300);
        rows.push(Object.assign({ at: 'after match ' + m }, await measure())); m++;
      }
      rows.toggles = toggles;
    } catch (e){ ok(false, 'the leak run threw: ' + String(e.message || e).slice(0, 300)); }
    for (const r of rows) note(r.at + (r.heapMB !== undefined? ': heap ' + r.heapMB + ' MB, canvases in the page ' + r.canvases + ', frames asked for while idle ' + r.rafIdle + ', observers alive ' + r.ro + ', resize listeners ' + r.resize + ', cached figures ' + r.sprites : ''));
    const after = rows.filter(r => /after match/.test(r.at)); const base = rows[0];
    if (after.length >= 8){
      const early = after.slice(2, 5).reduce((s, r) => s + r.heapMB, 0)/3, late = after.slice(-3).reduce((s, r) => s + r.heapMB, 0)/3;
      ok(after.length === 10 && rows.toggles === 20, 'ten matches were opened and closed, with twenty view switches');
      ok(late - early < 6, 'memory settles: ' + early.toFixed(1) + ' MB after matches 3 to 5, ' + late.toFixed(1) + ' MB after matches 8 to 10 (the cached figures are capped at 2,400 a store)');
      ok(after.every(r => r.rafIdle === 0), 'no animation loop is left running after a match (' + after.map(r => r.rafIdle).join(',') + ' frames asked for while idle)');
      ok(after.every(r => r.ro === base.ro && r.resize === base.resize), 'no observer or resize listener is left behind (' + after.map(r => r.ro + '/' + r.resize).join(' ') + ', ' + base.ro + '/' + base.resize + ' before)');
      ok(after.every(r => r.canvases === base.canvases && !r.viewer), 'no canvas or viewer is left in the page');
    } else ok(false, 'only ' + after.length + ' matches could be watched');
    ok(b.errors.length === 0, 'no page errors (' + b.errors.slice(0, 2).join(' | ') + ')');
    fs.writeFileSync(path.join(OUT, 'soak-leak.json'), JSON.stringify(rows, null, 1)); await b.ctx.close();
  }

  // ---------------- fallback: the isometric view is made to fail ----------------
  if (PART === 'all' || PART === 'fallback'){
    console.log('\n=== fallback (section 10.2, scenario 15): the isometric view is made to fail');
    const FAULTS = [
      { name: 'cannot be created', inject: () => { const d = window.Matchday.renderers.isometric; d.create = () => { throw new Error('injected: create failed'); }; } },
      { name: 'cannot be mounted', inject: () => { const d = window.Matchday.renderers.isometric; const real = d.create; d.create = o => { const r = real(o); r.mount = () => { throw new Error('injected: mount failed'); }; return r; }; } },
      { name: 'throws in the middle of a match', inject: () => { const d = window.Matchday.renderers.isometric; const real = d.create; d.create = o => { const r = real(o); const render = r.render; let n = 0; r.render = (s, h) => { if (++n > 90) throw new Error('injected: render failed'); return render(s, h); }; return r; }; } },
      { name: 'painted art never arrives', inject: () => { const A = window.Matchday.isoAssets; A.isReady = () => false; A.styleReady = () => new Promise(() => {}); } },
    ];
    const out = [];
    for (const F of FAULTS){
      const b = await open(); const rec = { fault: F.name };
      try {
        await b.startGame(['Fault']); await b.toMatch(); await b.page.evaluate(F.inject);
        if (await b.has('[data-a="md-watch"]')) await b.click('[data-a="md-watch"]', 400);
        await sleep(9000);   // past the six seconds the match waits for the art
        rec.screen = await b.page.evaluate(() => window.__sm91.S.screen); rec.stage = await b.page.evaluate(stageLook); const t1 = rec.stage.second; await sleep(1500); rec.later = await b.page.evaluate(stageLook);
        rec.clockMoving = rec.later.second !== null && t1 !== null && rec.later.second > t1; rec.toast = await b.page.evaluate(() => { const t = document.querySelector('.toast'); return t? t.textContent : null; });
        await b.shot('fallback-' + F.name.replace(/ /g, '-'));
        await b.finish(); await sleep(300); rec.after = await b.page.evaluate(() => ({ screen: window.__sm91.S.screen, week: window.__sm91.S.state.week }));
        // and the next week still plays
        await b.toMatch(); if (await b.has('[data-a="md-instant"]')) await b.click('[data-a="md-instant"]', 250); await b.finish(); rec.next = await b.page.evaluate(() => ({ screen: window.__sm91.S.screen, week: window.__sm91.S.state.week }));
      } catch (e){ rec.threw = String(e.message || e).slice(0, 300); }
      rec.errors = b.errors.slice(0, 4); out.push(rec); await b.ctx.close();
      const s = rec.later || rec.stage || {};
      note(F.name + ': screen ' + rec.screen + ', view "' + s.view + '", stage ' + (s.canvas? (s.painted? 'painted' : 'NOT painted (' + s.colours + ' colours)') : 'no canvas') + ', clock ' + (rec.clockMoving? 'moving' : 'not moving') + ', commentary "' + (s.comm || '').slice(0, 60) + '"' + (rec.toast? ', toast "' + rec.toast + '"' : '') + (rec.errors.length? ', page errors: ' + rec.errors.join(' | ').slice(0, 200) : '') + (rec.threw? ', run threw: ' + rec.threw : ''));
      ok(!rec.threw && rec.after && rec.next && rec.next.week > rec.after.week - 1 && rec.next.week >= 2, F.name + ': the week can still be finished and the next one played');
      ok(rec.screen === 'matchresult' || (s.canvas && s.painted && !/Iso/.test(s.view || '') ) || (s.canvas && s.painted && F.name === 'painted art never arrives'), F.name + ': the match is still shown (another view, the generated art, or the result with a message)');
    }
    fs.writeFileSync(path.join(OUT, 'soak-fallback.json'), JSON.stringify(out, null, 1));
  }

  // ---------------- offline: one visit, then no network ----------------
  if (PART === 'all' || PART === 'offline'){
    console.log('\n=== offline (E05, scenario 13): one visit, then the network is cut');
    const b = await open();
    try {
      await b.page.goto(URL); await sleep(500);
      const sw = await b.page.evaluate(async () => { if (!navigator.serviceWorker) return { none: true }; const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 8000))]); if (!reg) return { ready: false }; await new Promise(r => setTimeout(r, 1500)); const keys = await caches.keys(); const urls = []; for (const k of keys){ const c = await caches.open(k); for (const q of await c.keys()) urls.push(new URL(q.url).pathname); } return { ready: true, keys, urls }; });
      ok(sw.ready && sw.keys.length === 1 && sw.urls.some(u => /index\.html$|\/$/.test(u)), 'the first visit installs the offline copy (cache ' + (sw.keys||[]).join(',') + ': ' + (sw.urls||[]).join(' ') + ')');
      await b.ctx.setOffline(true);
      const reload = await b.page.reload({ timeout: 15000 }).then(() => true, e => String(e.message).slice(0, 120)); await sleep(700);
      const title = await b.page.evaluate(() => { const m = /Version (\S+)\./.exec(document.body.innerText); return { version: m? m[1] : null, setup: !!document.querySelector('[data-a="setup"]') }; }).catch(() => ({}));
      ok(reload === true && title.setup, 'with no network the game loads again (version ' + title.version + ')' + (reload === true? '' : ': ' + reload));
      await b.click('[data-a="setup"]', 200); const ins = await b.page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Offline'); await b.click('[data-a="start"]', 500);
      await b.toMatch(); await b.click('[data-a="md-watch"]', 300); const playing = await b.watching(); await sleep(2500); const st = await b.page.evaluate(stageLook); await b.shot('offline-match');
      ok(playing && st.painted && /Iso/.test(st.view), 'a new game starts and its first match is shown in the isometric view, painted, with no network (' + st.colours + ' colours)');
      await b.finish(); const wk = await b.page.evaluate(() => window.__sm91.S.state.week); await b.toMatch(); if (await b.has('[data-a="md-instant"]')) await b.click('[data-a="md-instant"]', 250); await b.finish();
      const wk2 = await b.page.evaluate(() => window.__sm91.S.state.week); ok(wk2 > wk, 'the viewer closes and the following week plays (week ' + wk + ' to ' + wk2 + ')');
      const facts = await b.page.evaluate(() => { const st = window.__sm91.S.state; return st.season + ':' + st.week + ':' + st.clubs[st.userClub].balance; });
      await b.page.reload({ timeout: 15000 }).catch(() => {}); await sleep(700); const cont = await b.has('[data-a="continue"]'); if (cont) await b.click('[data-a="continue"]', 400);
      const facts2 = await b.page.evaluate(() => { const st = window.__sm91.S.state; return st? st.season + ':' + st.week + ':' + st.clubs[st.userClub].balance : null; });
      ok(cont && facts2 === facts, 'closed and opened again with no network, the game carries on from its autosave (' + facts + ')');
      ok(b.errors.length === 0, 'no page errors offline (' + b.errors.slice(0, 2).join(' | ') + ')');
    } catch (e){ ok(false, 'the offline run threw: ' + String(e.message || e).slice(0, 300)); }
    await b.ctx.close();
  }

  // ---------------- hot-seat: three managers, each match in the isometric view ----------------
  if (PART === 'all' || PART === 'hotseat'){
    console.log('\n=== hot-seat (scenario 10): three managers, the isometric view, nothing given away');
    const b = await open(); const seen = [];
    try {
      await b.startGame(['Ann', 'Bob', 'Cat']);
      const n = await b.page.evaluate(() => window.__sm91.S.state.managers.length);
      for (let i = 0; i < n; i++){ if (await b.has('[data-a="taketurn"]')) await b.click('[data-a="taketurn"]', 200); await b.preseason(); if (await b.has('[data-a="ready"]')) await b.click('[data-a="ready"]', 300); }
      const scoreIn = (t, r) => new RegExp('\\b' + r.gH + '\\s*[-:]\\s*' + r.gA + '\\b').test(t);
      for (let i = 0; i < n; i++){
        const rec = { manager: i };
        if (await b.has('[data-a="taketurn"]')){ rec.handover = (await b.text()).replace(/\s+/g, ' ').slice(0, 300); rec.handoverHasScore = /\b\d+\s*-\s*\d+\b/.test(rec.handover); await b.shot('hotseat-handover-' + (i + 1)); await b.click('[data-a="taketurn"]', 300); }
        if (!(await b.has('[data-a="md-watch"]'))){ rec.noMatch = true; seen.push(rec); continue; }
        const r = await b.page.evaluate(() => { const S = window.__sm91.S; const m = S.md.queue[0].m; const u = S.state.clubs[S.state.managers[S.state.turn !== undefined? S.state.turn : 0].userClub]; return { gH: m.gH, gA: m.gA, home: m.home.name, away: m.away.name, mine: u? u.name : null, results: !!S.results }; });
        rec.result = r; const pick = await b.text(); rec.pickShowsScore = scoreIn(pick.replace(/\d+:\d+/g, ''), r) && (r.gH + r.gA > 0); rec.pickNames = pick.includes(r.home) || pick.includes(r.away);
        await b.click('[data-a="md-watch"]', 300); rec.playing = await b.watching(); await sleep(1500); rec.stage = await b.page.evaluate(stageLook); rec.board = await b.page.evaluate(() => document.querySelector('.md-board').innerText.replace(/\s+/g, ' ')); await b.shot('hotseat-match-' + (i + 1));
        rec.boardAtStart = /0\s*-\s*0/.test(rec.board);
        if (await b.has('[data-a="md-skip"]')) await b.click('[data-a="md-skip"]', 700); rec.boardAtEnd = await b.page.evaluate(() => document.querySelector('#md-score').textContent.replace(/\s+/g, ' ')); if (await b.has('[data-a="md-fulltime"]')) await b.click('[data-a="md-fulltime"]', 250);
        rec.endOk = new RegExp('^\\s*' + r.gH + '\\s*-\\s*' + r.gA + '\\s*$').test(rec.boardAtEnd);
        for (let k = 0; k < 4 && await b.has('[data-a="md-continue"]'); k++) await b.click('[data-a="md-continue"]', 250);
        seen.push(rec);
      }
    } catch (e){ ok(false, 'the hot-seat run threw: ' + String(e.message || e).slice(0, 300)); }
    for (const r of seen) note('manager ' + (r.manager + 1) + (r.noMatch? ': no match this week' : ': ' + r.result.home + ' v ' + r.result.away + ' (' + r.result.gH + '-' + r.result.gA + '), view "' + r.stage.view + '", stage ' + (r.stage.painted? 'painted' : 'NOT painted') + ', scoreboard at the start "' + r.board + '", at full time "' + r.boardAtEnd + '"') + (r.handover? ' | handover screen: "' + r.handover.slice(0, 110) + '"' : ''));
    const played = seen.filter(r => !r.noMatch);
    ok(played.length === 3, 'each of the three managers has a match to watch (' + played.length + ')');
    ok(played.every(r => r.playing && r.stage.painted && /Iso/.test(r.stage.view)), 'each match opens in the isometric view, painted and playing');
    ok(played.every(r => !r.pickShowsScore && r.boardAtStart), 'no result is shown before its match is watched (the screen before kick-off, the scoreboard at kick-off)');
    ok(seen.every(r => !r.handoverHasScore), 'a handover screen shows no score');
    ok(played.every(r => r.endOk), 'each match ends on the engine\'s own score');
    ok(b.errors.length === 0, 'no page errors (' + b.errors.slice(0, 2).join(' | ') + ')');
    fs.writeFileSync(path.join(OUT, 'soak-hotseat.json'), JSON.stringify(seen, null, 1)); await b.ctx.close();
  }

  // ---------------- measure: the game's own measuring screen ----------------
  if (PART === 'all' || PART === 'measure'){
    console.log('\n=== measure (E01): the measuring screen, one minute of play (headless Chromium)');
    const out = [];
    for (const V of [{ name: 'phone-390x664', w: 390, h: 664 }, { name: 'desktop-1366x768', w: 1366, h: 768, desktop: true }, { name: 'desktop-1920x1080', w: 1920, h: 1080, desktop: true }]){
      const b = await open(V); const rec = { window: V.name };
      try {
        await b.page.goto(URL); await sleep(600); await b.click('[data-a="whatsnew"]', 250); await b.click('[data-a="md-measure"]', 250); await b.click('[data-a="title"]', 250);
        await b.click('[data-a="setup"]', 200); const ins = await b.page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Meter'); await b.click('[data-a="start"]', 500);
        await b.toMatch(); await b.click('[data-a="md-watch"]', 300); await b.watching();
        rec.counting = await b.page.evaluate(() => { const m = document.querySelector('#md-meter'); return m? m.textContent : null; });
        const done = await b.page.waitForFunction(() => { const m = document.querySelector('#md-meter'); return m && /card/.test(m.className); }, null, { timeout: 100000 }).then(() => true, () => false);
        rec.done = done; rec.stats = await b.page.evaluate(() => window.Matchday.ui.lastMeasure || null); rec.paused = await b.page.evaluate(() => !window.__sm91.S.md.viewer.playback.state().playing);
        await b.shot('measure-' + V.name);
        await b.click('[data-a="md-measure-close"]', 400); rec.resumed = await b.page.evaluate(() => ({ gone: !document.querySelector('#md-meter'), playing: window.__sm91.S.md.viewer.playback.state().playing || window.__sm91.S.md.viewer.done }));
        await b.finish(); await b.toMatch(); if (await b.has('[data-a="md-watch"]')){ await b.click('[data-a="md-watch"]', 300); await b.watching(); await sleep(800); rec.nextMatchMeter = await b.page.evaluate(() => !!document.querySelector('#md-meter')); }
      } catch (e){ rec.threw = String(e.message || e).slice(0, 300); }
      rec.errors = b.errors.slice(0, 3); out.push(rec); await b.ctx.close(); const s = rec.stats || {};
      note(V.name + ': ' + (rec.stats? s.fps + ' frames a second over ' + s.seconds + ' s; a frame ' + s.typicalMs + ' ms typically, slowest 5% ' + s.p95Ms + ' ms, slowest 1% ' + s.p99Ms + ' ms, worst ' + s.worstMs + ' ms; ' + s.slow30 + ' of ' + s.frames + ' slower than 30 a second; drawing ' + s.drawAvgMs + ' ms on average, ' + s.drawP95Ms + ' ms slowest 5%, ' + s.drawWorstMs + ' ms worst; stage ' + s.stage + ', camera ' + s.camera + ', ' + s.tiles + ' tiles' + (s.heapMB? ', ' + s.heapMB + ' MB' : '') : 'no figures') + (rec.threw? ' | THREW ' + rec.threw : ''));
      ok(!rec.threw && rec.done && rec.stats && rec.stats.frames > 1500 && rec.paused && /Measuring/.test(rec.counting || ''), V.name + ': the measuring screen counts down for a minute of play, pauses the match and shows its figures');
      ok(rec.resumed && rec.resumed.gone && rec.resumed.playing && rec.nextMatchMeter === false, V.name + ': closing it carries the match on, and the next match is not measured');
      ok(rec.stats && rec.stats.fps >= 55 && rec.stats.p95Ms <= 21, V.name + ': E01 the desktop target in headless Chromium: about 60 frames a second, the slowest 5% of frames within a quarter of a frame of 16.7 ms (' + (rec.stats? rec.stats.fps + ', ' + rec.stats.p95Ms + ' ms' : 'none') + ')');
      ok(rec.errors.length === 0, V.name + ': no page errors (' + rec.errors.join(' | ') + ')');
    }
    fs.writeFileSync(path.join(OUT, 'soak-measure.json'), JSON.stringify(out, null, 1));
  }

  // ---------------- stills: the rare situations with the painted art, for a person to look at ----------------
  if (PART === 'all' || PART === 'stills'){
    console.log('\n=== stills (scenarios 7 and 9, B07): pictures for review');
    // the same seeded world test-situations.js walks, searched in the page for one match of each kind
    const find = kind => { const E = window.__sm91.E, MD = window.Matchday; const st = E.newGame({ seed: 4242, userClub: 3 }); const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const d = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
      for (let w = 0; w < E.CFG.WEEKS*2; w++){ const res = E.advanceWeek(st); if (st.gameOver){ st.gameOver = null; st.sackOffer = null; st.clubs[st.userClub].confidence = E.CFG.CONF_START; st.clubs[st.userClub].overdraftWeeks = 0; }
        for (const m of res){ const p = MD.capture(st, m, st.lastWeekInfo); const reds = p.official.cards.filter(c => c.card === 'red' && c.playerId); const role = id => (p.players.find(x => x.id === id)||{}).role;
          const hit = kind === 'pens'? p.official.extra === 'pens' : kind === 'aet'? p.official.extra === 'aet' && p.official.scorers.some(s => s.period === 'extraTime') : kind === 'gkred'? reds.some(c => role(c.playerId) === 'GK' && c.minute < 70) : kind === 'red'? reds.length === 1 && role(reds[0].playerId) !== 'GK' && reds[0].minute < 60
            : kind === 'keeperclash'? d(p.teams.home.kit.secondary, p.teams.away.kit.primary) < 30 && p.official.homeGoals + p.official.awayGoals >= 2 : kind === 'refclash'? d(p.teams.home.kit.primary, '#1A1A1A') < 60 || d(p.teams.away.kit.primary, '#1A1A1A') < 60 : false;
          if (hit){ window.__still = { m, st }; return { id: p.matchId, teams: p.teams.home.name + ' v ' + p.teams.away.name, score: p.official.homeGoals + '-' + p.official.awayGoals, extra: p.official.extra, kits: [p.teams.home.kit, p.teams.away.kit] }; } } }
      return null; };
    const STILLS = [
      { kind: 'pens', name: 'shoot-out-end', at: v => v.scene.duration - 9, wait: 5200, camera: 'follow' },
      { kind: 'aet', name: 'extra-time-interval', at: v => 6300 - 4, wait: 5200, camera: 'follow' },
      { kind: 'red', name: 'dismissal-ten-men', at: v => v.pres.events.find(e => e.type === 'SENT_OFF').matchSecond + 12, wait: 900, camera: 'whole' },
      { kind: 'gkred', name: 'keeper-dismissed-stand-in', at: v => v.pres.events.find(e => e.type === 'SENT_OFF').matchSecond + 12, wait: 900, camera: 'whole' },
      { kind: 'keeperclash', name: 'keeper-in-the-other-sides-colour', at: v => { const H = v.pres.teams.home.id; const e = v.pres.events.find(e => e.type === 'SHOT_SAVED' && e.teamId !== H) || v.pres.events.find(e => e.type === 'SHOT_SAVED' || e.type === 'GOAL'); return e.matchSecond + 0.15; }, until: true, camera: 'close' },
      { kind: 'refclash', name: 'side-in-the-referees-colour', at: v => { const e = v.pres.events.find(e => e.type === 'CARD' || e.type === 'FOUL'); return (e? e.matchSecond : 300) + 1; }, wait: 900, camera: 'close' },
    ];
    const out = [];
    for (const S of STILLS){
      const b = await open({ w: 390, h: 664 }); const rec = { still: S.name };
      try {
        await b.startGame(['Still']); await b.toMatch();
        rec.match = await b.page.evaluate(find, S.kind); if (!rec.match){ note(S.name + ': no such match in the two seasons'); out.push(rec); await b.ctx.close(); continue; }
        await b.page.evaluate(() => { const S = window.__sm91.S; S.state.lastWeekInfo = window.__still.st.lastWeekInfo; S.md.queue[0] = { m: window.__still.m }; });
        await b.click('[data-a="md-watch"]', 300); await b.watching(); await sleep(500); await b.page.evaluate(u => { window.__until = u; }, !!S.until);
        await b.page.evaluate(({ at, camera }) => { const v = window.__sm91.S.md.viewer; v.renderer.setCamera(camera); document.querySelector('#md-camera').textContent = 'Cam: ' + camera; const t = (new Function('v', 'return (' + at + ')(v)'))(v); window.__target = t; v.playback.seek(Math.max(0, t - (window.__until? 5 : 0))); }, { at: S.at.toString(), camera: S.camera });
        if (S.until){ await b.page.waitForFunction(() => window.__sm91.S.md.viewer.playback.state().matchSecond >= window.__target, null, { timeout: 40000, polling: 16 }).catch(() => {}); await b.page.evaluate(() => window.__sm91.S.md.viewer.playback.pause()); await sleep(450); }
        else await sleep(S.wait);
        rec.stage = await b.page.evaluate(stageLook); rec.log = await b.page.evaluate(() => [...document.querySelectorAll('#md-log div')].slice(0, 5).map(d => d.textContent)); rec.board = await b.page.evaluate(() => document.querySelector('.md-board').innerText.replace(/\s+/g, ' ') + ' | ' + document.querySelector('#md-clock').textContent);
        await b.shot('still-' + S.name);
        if (S.kind === 'pens'){ await sleep(4500); rec.end = await b.page.evaluate(stageLook); rec.endLog = await b.page.evaluate(() => [...document.querySelectorAll('#md-log div')].slice(0, 4).map(d => d.textContent)); await b.shot('still-shoot-out-full-time'); if (await b.has('[data-a="md-fulltime"]')) await b.click('[data-a="md-fulltime"]', 400); rec.result = (await b.text()).replace(/\s+/g, ' ').slice(0, 260); await b.shot('still-shoot-out-result'); }
      } catch (e){ rec.threw = String(e.message || e).slice(0, 300); }
      rec.errors = b.errors.slice(0, 3); out.push(rec); await b.ctx.close();
      note(S.name + ': ' + (rec.match? rec.match.teams + ' ' + rec.match.score + (rec.match.extra? ' ' + rec.match.extra : '') : '') + (rec.board? ' | ' + rec.board : '') + (rec.stage? ' | commentary "' + (rec.stage.comm || '') + '"' : '') + (rec.endLog? ' | last lines: ' + rec.endLog.join(' / ') : '') + (rec.result? ' | result screen: ' + rec.result.slice(0, 140) : '') + (rec.threw? ' | THREW ' + rec.threw : '') + (rec.errors.length? ' | page errors ' + rec.errors.join(' | ') : ''));
      ok(!rec.threw && rec.errors.length === 0 && rec.match && rec.stage && rec.stage.painted, S.name + ': the situation is shown, painted, with no error');
    }
    fs.writeFileSync(path.join(OUT, 'soak-stills.json'), JSON.stringify(out, null, 1));
  }

  await browser.close(); server.close();
  console.log('\n' + checks + ' checks, ' + fails + ' failures');
  console.log(fails? 'SOAK AUDIT FOUND PROBLEMS' : 'SOAK AUDIT PASSED'); process.exit(fails? 1 : 0);
})();
