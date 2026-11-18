// The screens before and after a change of presentation: what they say, what they let you do, and what doing it does.
// Two seeded games are played through fixed journeys:
//   single   one manager: the title, help, what's new, hall of fame, setup, every management screen and sub-tab, a
//            player's page (list, contract, release prompt, rename), a rival club's player and a bid, a signing, a loan,
//            ticket, safety and stand decisions, a player left on the list so that offers arrive, staff, the academy, renaming, saves, a watched match skipped to full
//            time, the result and the week's results, then the rest of the season to the review and into the summer
//            (pre-season again, free agents, the youth intake, records with something in them)
//   hotseat  two managers: the hand-over, the rivals' market, a bid for a rival's player, the managers' table, the
//            shared week screen
// At each stop the tool records the words on the screen (in any order: regrouping into cards and columns is allowed),
// every control with its action, its attributes and its label, and at the end of each journey a checksum of the whole
// saved game. Two builds that say the same, offer the same and do the same give the same record. It also takes a
// picture of each stop at a phone and a desktop size.
//   node tools/ui-parity.js <site dir> <out dir> [query]            write record.json and the pictures ([query] such as ?classic)
//   node tools/ui-parity.js --compare a/record.json b/record.json [words the second may add, a|b|c]
//   node tools/ui-parity.js --stage <site dir>                      the match screen: every box in the old look (?classic) and the new, at eleven sizes
//   node tools/ui-parity.js --layout <site dir> [query]             the same journeys at the brief's five sizes, looking at every stop for anything
//                                                                   wider than the screen, off the screen, cut short, or too small for a fingertip
// (after python3 build.py; needs playwright. NOSHOTS=1 skips the pictures.)
const fs = require('fs'), path = require('path');
if (process.argv[2] === '--compare'){
  const A = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), B = JSON.parse(fs.readFileSync(process.argv[4], 'utf8')); let bad = 0, stops = 0;
  const allow = new Set((process.argv[5] || '').split('|').filter(Boolean));   // words the second build may add (the wordmark)
  const bag = t => { const m = {}; for (let w of t.split(' ')){ w = w.replace(/^[.,;:]+|[.,;:]+$/g, ''); if (w) m[w] = (m[w] || 0) + 1; } return m; };   // a full stop or comma that now sits outside a bold figure is not a change of wording
  for (const v of Object.keys(A.views)){ const a = A.views[v], b = B.views[v]; const was = bad; if (!b){ console.log('FAIL', v, 'is missing from the second record'); bad++; continue; }
    for (const stop of Object.keys(a.stops)){ const x = a.stops[stop], y = b.stops[stop]; stops++; if (!y){ console.log('FAIL', v, stop, 'missing'); bad++; continue; }
      const wa = bag(x.words), wb = bag(y.words); const lost = [], added = [];
      for (const w of Object.keys(wa)) if ((wb[w] || 0) < wa[w]) lost.push(w); for (const w of Object.keys(wb)) if ((wa[w] || 0) < wb[w] && !allow.has(w)) added.push(w);
      const ca = x.controls.slice().sort(), cb = y.controls.slice().sort(); const gone = ca.filter(c => cb.indexOf(c) < 0), come = cb.filter(c => ca.indexOf(c) < 0);
      if (lost.length || added.length || gone.length || come.length || ca.length !== cb.length){ bad++; console.log('FAIL', v, stop + ':', lost.length? 'words lost ' + JSON.stringify(lost.slice(0, 12)) : '', added.length? 'words added ' + JSON.stringify(added.slice(0, 12)) : '', gone.length? 'controls gone ' + JSON.stringify(gone.slice(0, 4)) : '', come.length? 'controls new ' + JSON.stringify(come.slice(0, 4)) : '', ca.length !== cb.length? 'controls ' + ca.length + ' -> ' + cb.length : ''); }
    }
    for (const stop of Object.keys(b.stops)) if (!a.stops[stop]){ console.log('FAIL', v, stop, 'is only in the second record'); bad++; }
    for (const j of Object.keys(a.state)){ if (a.state[j] !== b.state[j]){ bad++; console.log('FAIL', v, j, 'the saved game after the journey differs:', a.state[j], b.state[j]); } }
    if (JSON.stringify(a.skipped) !== JSON.stringify(b.skipped)){ bad++; console.log('FAIL', v, 'the two runs skipped different steps:', JSON.stringify(a.skipped), JSON.stringify(b.skipped)); }
    if (bad === was) console.log('ok  ', v + ':', Object.keys(a.stops).length, 'stops say the same and offer the same controls; the saved games after the journeys are the same (' + Object.keys(a.state).map(j => j + ' ' + a.state[j]).join(', ') + ')');
  }
  console.log(bad? bad + ' differences' : 'no differences in ' + stops + ' stops'); process.exit(bad? 1 : 0);
}
const { chromium } = require('playwright'); const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// a seeded Math.random and a clock that stands still, so that two runs of the same build are the same run
const INIT = seed => { let a = seed >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const Real = Date, T0 = 1795000000000; class Still extends Real { constructor(...x){ if (x.length) super(...x); else super(T0); } static now(){ return T0; } } window.Date = Still; };
if (process.argv[2] === '--stage'){
  const FILE = path.resolve(process.argv[3] || '.', 'soccer-manager-91.html');
  const SIZES = [[360, 640], [384, 692], [390, 664], [412, 915], [640, 360], [844, 390], [768, 1024], [1000, 500], [1024, 600], [1366, 768], [1920, 1080]];
  (async () => { const b = await chromium.launch(); let bad = 0;
    for (const [w, h] of SIZES){ const got = {};
      for (const q of ['?classic', '']){ const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 900 }); await ctx.addInitScript(INIT, 1991); const p = await ctx.newPage();
        await p.goto('file://' + FILE + q); await sleep(400); await p.click('[data-a="setup"]'); await sleep(100); await (await p.$('.mgrname')).fill('Stage'); await p.click('[data-a="start"]'); await sleep(300);
        await p.click('#act [data-a="play"]'); await sleep(300); await p.click('[data-a="md-watch"]'); await sleep(1500);
        const read = () => p.evaluate(() => { const r = {}; const one = (k, e) => { if (!e) return; const b = e.getBoundingClientRect(); r[k] = [b.left, b.top, b.width, b.height].map(x => Math.round(x * 100) / 100).join(' '); };
          one('stage', document.querySelector('#md-stage')); one('canvas', document.querySelector('#md-stage canvas')); one('board', document.querySelector('.md-board')); one('clock', document.querySelector('.md-clock')); one('comm', document.querySelector('.md-comm')); one('log', document.querySelector('.md-log')); one('act', document.querySelector('#act')); one('main', document.querySelector('#main'));
          document.querySelectorAll('.md-controls .b, .md-controls2 .b, #act > .b').forEach((e, i) => one('b' + i + ':' + (e.dataset.a || '') + (e.dataset.s || ''), e)); const c = document.querySelector('#md-stage canvas'); if (c) r.pixels = c.width + 'x' + c.height; r.pd = document.body.classList.contains('pd'); return r; });
        const playing = await read(); await p.click('[data-a="md-skip"]'); await sleep(1500); const ended = await read(); got[q] = { playing, ended }; await ctx.close(); }
      for (const when of ['playing', 'ended']){ const a = got['?classic'][when], c = got[''][when]; const diff = Object.keys(a).filter(k => k !== 'pd' && a[k] !== c[k]);
        if (diff.length || a.pd || !c.pd){ bad++; console.log('DIFF', w + 'x' + h, when, diff.map(k => k + ': ' + a[k] + ' -> ' + c[k]).join(' | ')); } else console.log('same', w + 'x' + h, when.padEnd(7), 'stage', a.stage, '| canvas', a.pixels, '| ' + (Object.keys(a).length - 2) + ' boxes'); } }
    await b.close(); console.log(bad? bad + ' differ' : 'every box on the match screen is where it was and the size it was, at every size'); process.exit(bad? 1 : 0); })().catch(e => { console.error(e); process.exit(1); });
  return;
}
const LAYOUT = process.argv[2] === '--layout';
const SITE = path.resolve(process.argv[LAYOUT? 3 : 2] || '.'); const OUT = path.resolve(process.argv[3] || 'ui-parity'); const QUERY = process.argv[4] || ''; if (!LAYOUT) fs.mkdirSync(OUT, { recursive: true });
const SHOTS = !process.env.NOSHOTS && !LAYOUT; const PAUSE = 170;
const VIEWS = LAYOUT? [[360, 640], [390, 664], [844, 390], [1366, 768], [1920, 1080]].map(([w, h]) => ({ name: w + 'x' + h, w, h, scale: 1, touch: w < 900 })) : [{ name: 'phone', w: 390, h: 664, scale: 2, touch: true }, { name: 'desktop', w: 1366, h: 768, scale: 1, touch: false }];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  if (path.resolve(f).indexOf(SITE) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); });
// A journey is a list of [what to do, a name to record the screen under afterwards (or nothing)]. What to do:
//   nav:x            the bottom navigation          a:x[...]      the first control with data-a="x" (a:x[..]:nth takes the second)
//   act              the button in the action bar   row           the first player row of a table
//   fill:sel=text    type into a field              wait:ms       let a "tap again" prompt run out
//   move             whatever takes the game forward from here (the instant result, Continue, the hand-over...)
//   until:screen     move until that screen         week          move until Home in a later week
//   season           move until the season review, recording the first sight of each kind of screen on the way
const SQUAD = [['nav:squad', 'squad'], ['a:formation[data-f="4-3-3"]', 'squad-433'], ['a:autopick', null], ['a:training[data-t="hard"]', 'squad-hard'], ['a:toggle', 'squad-dropped'], ['a:autopick', null]];
const JOURNEYS = {
  single: [
    ['', 'title'], ['a:help', 'help'], ['act', null], ['a:whatsnew', 'whatsnew'], ['act', null], ['a:hof', null], ['wait:700', 'hof-ladder'], ['a:board[data-b="fastest_title"]', 'hof-board'], ['a:hoftab[data-t="mine"]', 'hof-mine'], ['act', null],
    ['a:setup', 'setup'], ['a:setupcount[data-n="3"]', 'setup-three'], ['a:setupcount[data-n="1"]', null], ['a:mode:nth', 'setup-mode'], ['a:mode[data-m="classic"]', null], ['fill:.mgrname=Parity', null], ['a:start', 'home-week1'],
    ['a:preseason', 'preseason'], ['a:sponsor', 'preseason-sponsor'], ['a:tickets', 'preseason-done'], ['act', null],
    ['a:fixtures', 'fixtures'], ['act', null], ['a:results', 'results-none'], ['act', null],
    ['a:saves', 'saves'], ['fill:#slotname=Parity save', null], ['a:saveslot', 'saves-one'], ['a:delslot', 'saves-really'], ['a:delslot', 'saves-deleted'], ['act', null],
    ['a:resign', 'home-resign-really'], ['wait:4300', 'home-resign-lapsed'],
    ...SQUAD,
    ['a:player', 'player-mine'], ['a:setamt', null], ['a:list', 'player-listed'], ['a:unlist', 'player-unlisted'], ['a:cyears[data-y="2"]', null], ['a:setcw', 'player-terms'], ['a:contract', 'player-contract'], ['a:release', 'player-release-really'], ['wait:4300', null],
    ['fill:#pname=Parity Player', null], ['a:renameplayer', 'player-renamed'], ['a:toggle', 'player-toggled'], ['a:toggle', null], ['act', null],
    ['nav:transfers', 'market-for-sale'], ['a:ttab[data-t="free"]', 'market-free'], ['a:ttab[data-t="offers"]', 'market-offers'], ['a:ttab[data-t="scout"]', 'market-scout'],
    ['a:brief[data-k="pos"]:nth', 'market-scout-brief'], ['a:scoutgo', 'market-scout-report'], ['a:scoutdiv[data-d="3"]', 'market-scout-div3'], ['a:scoutclub', 'market-scout-club'],
    ['row', 'player-other'], ['a:setamt', null], ['a:bid', 'player-bid'], ['nav:transfers', null], ['a:scoutback', null], ['a:scoutdiv[data-d="0"]', 'market-scout-europe'], ['a:ttab[data-t="list"]', null],
    ['row', 'player-for-sale'], ['act', null], ['a:buy', 'market-after-buy'],
    ['nav:table', 'table'], ['a:tdiv[data-d="1"]', 'table-div1'], ['a:records', 'records'], ['act', null], ['a:hof', null], ['wait:700', 'hof-in-game'], ['act', null],
    ['nav:club', 'club-money'], ['a:loan', 'club-money-loan'], ['a:repay', 'club-money-repaid'],
    ['a:ctab[data-t="ground"]', 'club-ground'], ['a:ticket', 'club-ground-ticket'], ['a:safety[data-p="10"]', 'club-ground-safety'], ['a:build[data-n="1000"]', 'club-ground-build'],
    ['a:ctab[data-t="staff"]', 'club-staff'], ['a:staff[data-r="scout"][data-t="2"]', 'club-staff-scout'], ['a:ctab[data-t="youth"]', 'club-youth'], ['a:academy', 'club-youth-upgrade'],
    ['a:ctab[data-t="name"]', 'club-name'], ['fill:#clubshort=Parity', null], ['a:renameclub', 'club-renamed'], ['a:rndiv[data-d="2"]', null], ['a:rnclub', 'club-name-other'], ['a:rnclub[data-c=""]', 'club-name-cancelled'], ['a:ctab[data-t="money"]', null],
    ['nav:squad', null], ['a:player:nth', null], ['a:setamt', null], ['a:list', 'player-second-listed'], ['act', null],
    ['nav:home', 'home-after'], ['a:help', 'help-in-game'], ['act', null],
    ['act', 'matchpick'], ['a:md-watch', null], ['wait:1500', null], ['a:md-skip', null], ['wait:1500', 'matchview-ended'], ['a:md-fulltime', 'matchresult'], ['act', 'weekdone'], ['a:results', 'results'], ['a:rdiv[data-d="1"]', 'results-div1'], ['act', null], ['act', 'home-week2'],
    ['nav:squad', 'squad-week2'], ['nav:transfers', 'market-week2'], ['nav:table', 'table-week2'], ['nav:club', 'club-money-week2'], ['a:ctab[data-t="ground"]', 'club-ground-week2'], ['a:ctab[data-t="money"]', null], ['nav:home', null], ['a:fixtures', 'fixtures-week2'], ['act', null],
    ['season', 'review'], ['a:skipladder', null], ['a:declinejob', null], ['act', 'home-season2'], ['act', 'preseason-season2'], ['a:sponsor:nth', null], ['a:tickets:nth', 'preseason-season2-done'], ['act', null],
    ['nav:squad', 'squad-season2'], ['nav:transfers', null], ['a:ttab[data-t="free"]', 'market-free-summer'], ['row', 'player-free'], ['a:signfree', 'player-free-signed'], ['nav:transfers', null], ['a:ttab[data-t="list"]', null],
    ['nav:club', null], ['a:ctab[data-t="youth"]', 'club-youth-intake'], ['row', 'player-youth'], ['a:releasereserve', 'player-youth-really'], ['wait:4300', null], ['a:promote', 'player-youth-promoted'], ['nav:club', null], ['a:ctab[data-t="money"]', 'club-money-season2'],
    ['nav:table', 'table-season2'], ['a:records', 'records-season2'], ['act', null], ['nav:home', null], ['a:fixtures', 'fixtures-season2'], ['act', null], ['week', 'home-season2-week2'],
  ],
  hotseat: [
    ['a:setup', null], ['a:setupcount[data-n="2"]', 'setup-two'], ['fill:.mgrname=Ada|Bert', null], ['a:start', 'pass'], ['a:taketurn', 'home-hotseat'],
    ['a:retire', 'home-retire-really'], ['wait:4300', null], ['nav:transfers', 'market-hotseat'], ['a:ttab[data-t="scout"]', null], ['rival', 'market-rival-club'], ['row', 'player-rival'], ['a:setamt', null], ['a:bid', 'player-rival-bid'],
    ['nav:table', null], ['a:standings', 'standings'], ['act', null], ['nav:home', null], ['act', 'pass-second'], ['a:taketurn', 'home-second'], ['nav:transfers', null], ['a:ttab[data-t="offers"]', 'market-offers-rival'], ['a:reject', 'market-offers-rejected'],
    ['nav:home', null], ['until:weekmulti', 'weekmulti'], ['a:results', 'results-hotseat'], ['act', null], ['a:standings', 'standings-week1'], ['act', null], ['act', 'pass-week2'], ['a:taketurn', 'home-hotseat-week2'],
  ],
};
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = `http://127.0.0.1:${server.address().port}/` + QUERY;
  const browser = await chromium.launch(); const record = { site: SITE, query: QUERY, views: {} }; let looks = 0;
  for (const V of VIEWS){
    const view = record.views[V.name] = { stops: {}, skipped: [], state: {}, errors: [] };
    for (const J of Object.keys(JOURNEYS)){
      const ctx = await browser.newContext({ viewport: { width: V.w, height: V.h }, deviceScaleFactor: V.scale, isMobile: V.touch, hasTouch: V.touch });
      await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort()); await ctx.addInitScript(INIT, J === 'single'? 1991 : 1992);
      const page = await ctx.newPage(); page.on('pageerror', e => view.errors.push(J + ': ' + e.message));
      await page.goto(URL); await sleep(600);
      const at = () => page.evaluate(() => { const { S } = window.__sm91; const st = S.state, R = S.results; return { screen: S.screen, week: st? st.week : 0, season: st? st.season : 0, cur: st? st.cur : 0, offers: st? st.offers.length : 0, job: st? st.jobOffer !== null : false, over: !!(st && st.gameOver), type: R? R.type : '', played: !!(R && R.userMatch) }; });
      /* the match screen's buttons are left out of the "too small" test: their sizes are the old ones on purpose (--stage) */
      const look = async name => { const r = await page.evaluate(() => { const m = document.querySelector('#main'), vw = innerWidth, vh = innerHeight; const out = { over: m.scrollWidth - m.clientWidth, doc: document.documentElement.scrollWidth - vw, small: [], off: [], cut: [] };
          const said = e => (e.dataset.a || e.dataset.nav || e.tagName.toLowerCase()) + ' "' + (e.textContent || e.value || '').trim().slice(0, 16) + '"';
          for (const q of ['#hdr', '#nav', '#act']){ const e = document.querySelector(q); if (!e || e.style.display === 'none') continue; const b = e.getBoundingClientRect(); if (b.bottom > vh + 0.5 || b.right > vw + 0.5 || b.left < -0.5 || b.top < -0.5) out.off.push(q); }
          for (const c of document.querySelectorAll('#app button, #app a.b, #app input')){ const b = c.getBoundingClientRect(); if (!b.width) continue; if ((b.height < 39.5 || b.width < 35.5) && !document.body.classList.contains('md-wide')) out.small.push(said(c) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); if (c.tagName !== 'INPUT' && c.scrollWidth > c.clientWidth + 1) out.cut.push(said(c)); if (b.right > vw + 0.5 || b.left < -0.5) out.off.push(said(c)); }
          for (const c of document.querySelectorAll('#hdr *, #main td, #main th, #main .kv > span, #main h1, #main h2')){ if (c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflow !== 'visible') out.cut.push(c.tagName.toLowerCase() + ' "' + c.textContent.trim().slice(0, 18) + '"'); const b = c.getBoundingClientRect(); if (b.width && (b.right > vw + 0.5 || b.left < -0.5)) out.off.push(c.tagName.toLowerCase() + ' "' + c.textContent.trim().slice(0, 18) + '"'); }
          for (const t of document.querySelectorAll('#main table')){ const box = t.parentElement.getBoundingClientRect(), b = t.getBoundingClientRect(); if (b.right > box.right + 0.5) out.cut.push('table "' + t.textContent.trim().slice(0, 14) + '" wider than its card by ' + Math.round(b.right - box.right)); }
          out.pd = document.body.classList.contains('pd'); for (const k of ['small', 'off', 'cut']) out[k] = [...new Set(out[k])].slice(0, 5); return out; });
        const bad = r.over > 0 || r.doc > 0 || r.off.length || r.cut.length || r.small.length; view.stops[J + '/' + name] = 1;
        if (bad){ looks++; console.log('LOOK', V.name, (J + '/' + name).padEnd(34), r.over > 0? 'wider than the screen by ' + r.over + ';' : '', r.doc > 0? 'page wider by ' + r.doc + ';' : '', r.off.length? 'off screen: ' + r.off.join(', ') + ';' : '', r.cut.length? 'cut short: ' + r.cut.join(', ') + ';' : '', r.small.length? 'small: ' + r.small.join(', ') : ''); } };
      const capture = async name => { const key = J + '/' + name; if (view.stops[key]) return; if (LAYOUT) return look(name);
        view.stops[key] = await page.evaluate(() => { const norm = s => s.replace(/\s+/g, ' ').trim(); const parts = ['#hdr', '#main', '#nav', '#act'].map(q => document.querySelector(q)).filter(e => e && e.style.display !== 'none');
          const controls = []; for (const e of parts) for (const c of e.querySelectorAll('[data-a],[data-nav],a[href],input,select')){ const at = [...c.attributes].filter(x => /^data-|^href$|^id$|^value$|^inputmode$/.test(x.name)).map(x => x.name + '=' + x.value).sort().join(' '); controls.push(c.tagName + ' ' + at + (c.disabled? ' disabled' : '') + ' | ' + norm(c.textContent || '')); }
          const words = []; for (const e of parts){ const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) words.push(n.nodeValue); }   // each piece of text on its own, so that two elements side by side never read as one word
          return { screen: window.__sm91.S.screen, words: norm(words.join(' ')), controls }; });
        if (!SHOTS) return; const file = path.join(OUT, V.name + '-' + J + '-' + name);
        await page.screenshot({ path: file + '.png' });
        const more = await page.evaluate(() => { const m = document.querySelector('#main'); return m.scrollHeight - m.clientHeight; });
        if (more > 40){ await page.setViewportSize({ width: V.w, height: Math.min(4000, V.h + more) }); await sleep(90); await page.screenshot({ path: file + '-whole.png' }); await page.setViewportSize({ width: V.w, height: V.h }); await sleep(60); } };
      const tap = async sel => { const e = await page.$(sel); if (!e) return false; await e.click(); await sleep(PAUSE); return true; };
      const move = async (auto) => { const w = await at();
        if (auto){ if (w.screen === 'weekdone') await capture('seen-weekdone-' + (w.played? w.type : 'no-match')); else if (w.screen === 'matchresult') await capture('seen-matchresult-' + w.type); else if (w.screen === 'home' && w.job) await capture('seen-home-job-offer'); else if (w.screen === 'sacked' || w.screen === 'gameover') await capture('seen-' + w.screen);
          if (w.screen === 'home' && w.offers && !view.stops[J + '/seen-offers']){ await tap('[data-nav="transfers"]'); await tap('[data-a="ttab"][data-t="offers"]'); await capture('seen-offers'); await tap('[data-a="reject"]'); await capture('seen-offers-rejected'); await tap('[data-a="ttab"][data-t="list"]'); await tap('[data-nav="home"]'); } }
        let done;
        switch (w.screen){
          case 'home': if (w.job) await tap('[data-a="declinejob"]'); done = await tap('#act [data-a]'); break;
          case 'preseason': await tap('[data-a="sponsor"]'); await tap('[data-a="tickets"]'); done = await tap('#act [data-a]'); break;
          case 'matchpick': done = await tap('[data-a="md-instant"]'); break;
          case 'matchview': await tap('[data-a="md-skip"]'); await sleep(1200); done = await tap('[data-a="md-fulltime"]'); break;
          case 'pass': done = await tap('[data-a="taketurn"]'); break;
          case 'review': await tap('[data-a="skipladder"]'); await tap('[data-a="declinejob"]'); done = await tap('#act [data-a="newseason"]'); break;
          case 'sacked': done = (await tap('[data-a="takesack"]')) || (await tap('[data-a="walkaway"]')); break;
          default: done = await tap('#act [data-a]');
        }
        for (let i = 0; i < 12; i++){ const n = await at(); if (n.screen !== w.screen || n.week !== w.week || n.cur !== w.cur) break; await sleep(60); }   /* the week is played and saved before the next tap */
        return done; };
      for (const [what, name] of JOURNEYS[J]){
        const w0 = await at(); let ok = true;
        if (what === ''){ /* just look */ }
        else if (what === 'act') ok = await tap('#act [data-a]');
        else if (what === 'row') ok = await tap('#main tr[data-a="player"]');
        else if (what === 'rival'){ ok = await page.evaluate(() => { const { S, E } = window.__sm91; const st = S.state; const b = [...document.querySelectorAll('[data-a="scoutclub"]')].find(x => E.managerOf(st, +x.dataset.c)); if (b) b.click(); return !!b; }); await sleep(PAUSE); }
        else if (what === 'move') ok = await move(false);
        else if (what === 'week'){ for (let i = 0; i < 40; i++){ const n = await at(); if (n.screen === 'home' && (n.week !== w0.week || n.season !== w0.season)) break; if (!(await move(false)) || i === 39){ ok = false; break; } } }
        else if (what === 'season'){ for (let i = 0; i < 900; i++){ const n = await at(); if (n.screen === 'review') break; if (!(await move(true)) || i === 899){ ok = false; break; } } }
        else if (/^until:/.test(what)){ const want = what.slice(6); for (let i = 0; i < 60; i++){ const n = await at(); if (n.screen === want) break; if (!(await move(false)) || i === 59){ ok = false; break; } } }
        else if (/^wait:/.test(what)) await sleep(+what.slice(5));
        else if (/^fill:/.test(what)){ const [sel, text] = [what.slice(5, what.indexOf('=')), what.slice(what.indexOf('=') + 1)]; const els = await page.$$(sel); const vals = text.split('|'); if (!els.length) ok = false; for (let i = 0; i < els.length && i < vals.length; i++) await els[i].fill(vals[i]); }
        else { const kind = what.slice(0, what.indexOf(':')), rest = what.slice(what.indexOf(':') + 1); const nth = /:nth$/.test(rest); const r = rest.replace(/:nth$/, '');
          const sel = kind === 'nav'? `[data-nav="${r}"]` : `[data-a="${r.split('[')[0]}"]` + (r.indexOf('[') >= 0? r.slice(r.indexOf('[')) : ''); const els = await page.$$(sel); const el = els[nth? Math.min(1, els.length - 1) : 0];
          if (!el) ok = false; else { await el.click(); await sleep(PAUSE); } }
        if (!ok) view.skipped.push(J + ': ' + what + (name? ' (' + name + ')' : ''));
        if (name) await capture(name);
      }
      if (LAYOUT){ await ctx.close(); continue; }
      if (process.env.DUMP) fs.writeFileSync(path.join(OUT, V.name + '-' + J + '-state.json'), await page.evaluate(() => JSON.stringify(window.__sm91.S.state)));
      view.state[J] = await page.evaluate(() => { const t = JSON.stringify(Object.assign({}, window.__sm91.S.state, { gameId: '' })); let h = 0x811c9dc5; for (let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16) + ':' + t.length; });
      const end = await at(); console.log(V.name, J + ':', Object.keys(view.stops).filter(k => k.indexOf(J + '/') === 0).length, 'stops, ends at', end.screen, 'season', end.season, 'week', end.week, '| saved game', view.state[J]);
      await ctx.close();
    }
    console.log(V.name + ':', Object.keys(view.stops).length, 'stops recorded | skipped:', JSON.stringify(view.skipped), '| page errors:', view.errors.length, view.errors.slice(0, 2).join(' ; '));
  }
  if (LAYOUT){ console.log(looks? looks + ' stops to look at' : 'nothing wider than the screen, off it, cut short or too small, at any stop or size'); await browser.close(); server.close(); process.exit(looks? 1 : 0); }
  fs.writeFileSync(path.join(OUT, 'record.json'), JSON.stringify(record)); await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
