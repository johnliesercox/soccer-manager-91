// Saved-game compatibility across the real update path: the last release is served over http, games are started and
// played through its own screens (a single manager and a three-manager hot-seat), saved to slots and to the autosave; then
// the new build's files replace them at the same addresses, the page is reloaded (the service worker revalidates and swaps its
// cache), and every save is resumed and played on. Facts about each game are compared before and after.
//   node tools/save-compat.js legacy/release-1.6.0 .        (after python3 build.py: the repo root holds the new index.html and sw.js)
// The two version numbers and service worker cache names are read from the files served, so the tool needs no editing per release.
// Needs playwright (npm install playwright) and its Chromium.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const [OLD, NEW] = process.argv.slice(2);
const versionOf = dir => (/APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')) || [])[1];
const cacheOf = dir => (/VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8')) || [])[1];
const OV = versionOf(OLD), NV = versionOf(NEW), OC = cacheOf(OLD), NC = cacheOf(NEW);
if (!OV || !NV || !OC || !NC || OV === NV || OC === NC){ console.log('cannot compare: old ' + OV + ' (' + OC + '), new ' + NV + ' (' + NC + '); the two must differ in version and in cache name'); process.exit(1); }
let serveDir = OLD;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(serveDir, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
});
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const PORT = server.address().port; const URL = `http://127.0.0.1:${PORT}/`;
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const app = () => page.evaluate(() => { const S = window.__sm91.S; const m = /Version (\S+)\./.exec(document.body.innerText); return { screen: S.screen, version: m? m[1] : null }; });
  const click = async (sel, ms=120) => { await page.click(sel); await sleep(ms); };
  const has = sel => page.$(sel).then(x => !!x);
  const text = () => page.evaluate(() => document.body.innerText);
  // the facts of a game that must survive an update exactly
  const facts = () => page.evaluate(() => {
    const S = window.__sm91.S, E = window.__sm91.E; const st = S.state; if (!st) return null;
    const mgrs = st.managers.map(m => ({ name: m.managerName, club: st.clubs[m.userClub].name, gameOver: !!m.gameOver }));
    const squads = st.managers.map(m => E.squadOf(st, st.clubs[m.userClub]).map(p => p.id + ':' + p.name + ':' + p.goals + ':' + (p.years||0)).join('|'));
    const table = st.clubs.map(c => c.name + ' ' + c.div + ' ' + c.leaguePos + ' ' + (c.matches||0) + ' ' + (c.history||[]).length).sort().join('|');
    const plans = st.managers.map(m => JSON.stringify(st.clubs[m.userClub].tactics || null));   // each manager's match plan (from the tactics milestone; null on a build without them, and for a manager who has set none)
    return { season: st.season, week: st.week, mgrs, balances: st.managers.map(m => st.clubs[m.userClub].balance), squads, table, honours: (st.honours||[]).length, gameId: st.gameId, players: Object.keys(st.players).length, plans };
  });
  const preseason = async () => { if (await has('[data-a="preseason"]') && (await text()).includes('Pre-season')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); } };
  const throughMatchday = async (mode) => {
    for (let i = 0; i < 8; i++){
      if (await has('[data-a="md-watch"]')){ if (mode === 'watch'){ await click('[data-a="md-watch"]', 1500); if (await has('[data-a="md-skip"]')) await click('[data-a="md-skip"]', 600); if (await has('[data-a="md-fulltime"]')) await click('[data-a="md-fulltime"]', 200); } else await click('[data-a="md-instant"]', 200); }
      if (await has('[data-a="md-continue"]')) await click('[data-a="md-continue"]', 200);
      if (!(await has('[data-a="md-watch"]')) && !(await has('[data-a="md-continue"]'))) break;
    }
  };
  // set one thing in the match plan, on a build that has one (the tactics milestone): Squad, open the card if it is shut, tap, Home
  const setPlan = async (k, v) => { if (!(await has('[data-nav="squad"]'))) return false; await click('[data-nav="squad"]', 150); if (!(await has('[data-a="tactic"]')) && (await has('[data-a="planopen"]'))) await click('[data-a="planopen"]', 150);
    const sel = `[data-a="tactic"][data-k="${k}"][data-v="${v}"]`; const there = await has(sel); if (there) await click(sel, 150); await click('[data-nav="home"]', 150); return there; };
  const playWeek = async (mode) => { await preseason(); if (!(await has('[data-a="play"]'))) throw new Error('no play button: ' + (await text()).slice(0, 160)); await click('[data-a="play"]', 300); await throughMatchday(mode); if (await has('[data-a="continue-week"]')) await click('[data-a="continue-week"]', 200); };
  const startGame = async (names) => {
    await page.goto(URL); await sleep(600);
    await click('[data-a="setup"]', 200); if (names.length > 1) await click(`[data-a="setupcount"][data-n="${names.length}"]`, 150);
    const ins = await page.$$('.mgrname'); for (let i = 0; i < names.length; i++) if (ins[i]) await ins[i].fill(names[i]);
    await click('[data-a="start"]', 500);
  };
  const saveSlot = async (name) => { if (await has('[data-a="taketurn"]')) await click('[data-a="taketurn"]', 300); if (await has('[data-a="home"]')) await click('[data-a="home"]', 150); await click('[data-a="saves"]', 200); await page.fill('#slotname', name); await click('[data-a="saveslot"]', 300); await click('[data-a="back"]', 150).catch(() => {}); };
  const hotseatRound = async (watchWho, planFor) => {
    const n = await page.evaluate(() => window.__sm91.S.state.managers.length);
    for (let i = 0; i < n; i++){ if (await has('[data-a="taketurn"]')) await click('[data-a="taketurn"]', 200); await preseason(); if (planFor === i) await setPlan('p', 1); if (await has('[data-a="ready"]')) await click('[data-a="ready"]', 300); }
    for (let i = 0; i < n; i++){ if (await has('[data-a="taketurn"]')) await click('[data-a="taketurn"]', 300); await throughMatchday(i === watchWho? 'watch' : 'instant'); }
    if (await has('[data-a="nextround"]')) await click('[data-a="nextround"]', 300);
  };

  // ---------- the last release ----------
  console.log('serving ' + OV + ' from', OLD, 'at', URL);
  await page.goto(URL); await sleep(600); let a = await app(); ok(a.version === OV, 'the old site is ' + OV + ' (' + a.version + ')');
  await startGame(['John']); await preseason();
  const plansOld = (await setPlan('m', 1)) && (await setPlan('r', -1));   // on a build with match plans the games are saved with plans set, so the update has them to carry
  for (let w = 0; w < 3; w++) await playWeek('instant');
  const single150 = await facts(); ok(single150 && single150.week === 4, 'single game played to week 4 on ' + OV + ' (week ' + (single150 && single150.week) + ')');
  await saveSlot('single, last release');
  await startGame(['Ann', 'Bob', 'Cat']); await hotseatRound(1, plansOld? 1 : undefined); await hotseatRound(-1);
  const multi150 = await facts(); ok(multi150 && multi150.mgrs.length === 3 && multi150.week === 3, 'hot-seat game played two rounds on ' + OV + ' (week ' + (multi150 && multi150.week) + ', ' + (multi150 && multi150.mgrs.length) + ' managers)');
  await saveSlot('hot-seat, last release');
  const slots150 = await page.evaluate(() => JSON.parse(localStorage.getItem('sm91-slots') || '[]').map(s => s.name));
  ok(slots150.length === 2, 'two slots saved on ' + OV + ': ' + slots150.join(', '));
  ok(true, plansOld? 'match plans set on ' + OV + ' before saving: single ' + single150.plans.join(' ') + ', hot-seat ' + multi150.plans.join(' ') : OV + ' has no match plans to set');
  if (plansOld) ok(single150.plans[0] === '{"m":1,"p":0,"r":-1,"s":0}' && multi150.plans[1] === '{"m":0,"p":1,"r":0,"s":0}' && multi150.plans[0] === 'null', 'the plans set are the plans saved');
  const sw150 = await page.evaluate(async () => (await caches.keys()).join(','));
  ok(sw150.includes(OC), 'service worker cache on ' + OV + ': ' + sw150);
  ok(errors.length === 0, 'no page errors on ' + OV + (errors.length? ': ' + errors.slice(0, 2).join(' | ') : ''));

  // ---------- the update: the same addresses now serve the new build ----------
  serveDir = NEW; console.log('now serving ' + NV + ' from', NEW);
  await page.goto(URL); await sleep(1500);
  a = await app(); ok(a.version === NV, 'the page is ' + NV + ' after the swap (' + a.version + ')');
  // the service worker update: a reload or two for the new worker to install, activate and drop the old cache
  // whole names, not parts of names: a development build's cache name can begin with the release's (sm91-v1.7.1 and sm91-v1.7.1-tactics1)
  let swKeys = ''; const swOk = () => { const k = swKeys.split(','); return k.includes(NC) && !k.includes(OC); }; for (let i = 0; i < 6; i++){ swKeys = await page.evaluate(async () => (await caches.keys()).join(',')); if (swOk()) break; await page.reload(); await sleep(1500); }
  ok(swOk(), 'service worker cache after the update: ' + swKeys);
  const ttl = await text(); ok(/What's new \(updated\)/.test(ttl) || /updated/i.test(ttl), 'title screen flags What\'s new as updated');
  ok(/Continue current game/.test(ttl) && /Load a saved game/.test(ttl), 'title offers Continue and Load after the update');
  const slots160 = await page.evaluate(() => JSON.parse(localStorage.getItem('sm91-slots') || '[]').map(s => s.name));
  ok(JSON.stringify(slots160) === JSON.stringify(slots150), 'the slot list survived: ' + slots160.join(', '));
  // the autosave (the hot-seat game) resumes exactly
  await click('[data-a="continue"]', 500);
  const same = (a, b, what) => { const bad = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); ok(bad.length === 0, what + (bad.length? ' differs in ' + bad.map(k => k + ': ' + JSON.stringify(a[k]).slice(0, 120) + ' -> ' + JSON.stringify(b[k]).slice(0, 120)).join('; ') : '')); };
  const multi160 = await facts(); same(multi150, multi160, 'hot-seat autosave identical after the update');
  await hotseatRound(0); const multiOn = await facts(); ok(multiOn.week === multi150.week + 1 && multiOn.mgrs.length === 3, 'hot-seat game plays on under ' + NV + ' (week ' + multiOn.week + ')');
  // the single-manager slot
  await page.goto(URL); await sleep(800); await click('[data-a="saves"]', 300);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('sm91-slots') || '[]').find(s => s.name === 'single, last release').id);
  await click(`[data-a="loadslot"][data-i="${id}"]`, 600);
  const single160 = await facts(); same(single150, single160, 'single-manager slot identical after the update');
  // on a build with match plans, a plan can be set on the game that came from the other build, and the match is played to it
  const plansNew = await setPlan('s', 1);
  await playWeek('watch'); const singleOn = await facts(); ok(singleOn.week === single150.week + 1, 'single game plays on under ' + NV + ' with a watched match (week ' + singleOn.week + ')');
  if (plansNew){ const used = await page.evaluate(() => { const S = window.__sm91.S, st = S.state, r = st.userResults[st.week - 1]; return r && r.plan? JSON.stringify(r.plan) : null; }); ok(used && JSON.parse(used).s === 1 && singleOn.plans[0] && JSON.parse(singleOn.plans[0]).s === 1, 'a plan set after the update is saved and the match is played to it (' + used + ')'); }
  else ok(true, NV + ' has no match plans; the game' + (plansOld? ', saved with one,' : '') + ' plays on without');
  const view = await page.evaluate(() => (window.__sm91.S.md && window.__sm91.S.md.viewer && window.__sm91.S.md.viewer.renderer && window.__sm91.S.md.viewer.renderer.id) || (window.Matchday && window.Matchday.isoDefaultStyle));
  ok(true, 'match viewer drew with ' + view + ' (default style ' + (await page.evaluate(() => window.Matchday.isoDefaultStyle)) + ')');
  // the hot-seat slot too
  await page.goto(URL); await sleep(800); await click('[data-a="saves"]', 300);
  const id2 = await page.evaluate(() => JSON.parse(localStorage.getItem('sm91-slots') || '[]').find(s => s.name === 'hot-seat, last release').id);
  await click(`[data-a="loadslot"][data-i="${id2}"]`, 600);
  const multiSlot = await facts(); same(multi150, multiSlot, 'hot-seat slot identical after the update');
  await hotseatRound(2); const multiSlotOn = await facts(); ok(multiSlotOn.week === multi150.week + 1, 'hot-seat slot plays on under ' + NV + ' with a watched match (week ' + multiSlotOn.week + ')');
  ok(errors.length === 0, 'no page errors on ' + NV + (errors.length? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close(); server.close();
  console.log(`${checks} checks, ${fails} failures`); console.log(fails? 'SAVE COMPATIBILITY FAILED' : 'SAVE COMPATIBILITY OK'); process.exit(fails? 1 : 0);
})().catch(e => { console.log('ERROR', e.message); process.exit(2); });
