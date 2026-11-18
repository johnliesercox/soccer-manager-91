// The management screens before and after a change of presentation: what they say, what they let you do, and what
// doing it does. One seeded game is played through a fixed journey over Home, Squad and the Transfer Market (every
// sub-tab, a scouted club, a second week), and at each stop the tool records the words on the screen (in any order:
// regrouping into cards and columns is allowed), every control with its action, its attributes and its label, and at
// the end a checksum of the whole saved game. Two builds that say the same, offer the same and do the same give the
// same record. It also takes a picture of each stop at a phone and a desktop size.
//   node tools/ui-parity.js <site dir> <out dir> [query]            write record.json and the pictures ([query] such as ?classic)
//   node tools/ui-parity.js --compare a/record.json b/record.json   compare two records
// (after python3 build.py; needs playwright)
const fs = require('fs'), path = require('path');
const norm = s => s.replace(/\s+/g, ' ').trim();
if (process.argv[2] === '--compare'){
  const A = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), B = JSON.parse(fs.readFileSync(process.argv[4], 'utf8')); let bad = 0;
  const allow = new Set((process.argv[5] || '').split('|').filter(Boolean));   // words the second build may add (the wordmark)
  for (const v of Object.keys(A.views)){ const a = A.views[v], b = B.views[v]; const was = bad; if (!b){ console.log('FAIL', v, 'is missing from the second record'); bad++; continue; }
    for (const stop of Object.keys(a.stops)){ const x = a.stops[stop], y = b.stops[stop]; if (!y){ console.log('FAIL', v, stop, 'missing'); bad++; continue; }
      const bag = t => { const m = {}; for (let w of t.split(' ')){ w = w.replace(/^[.,;:]+|[.,;:]+$/g, ''); if (w) m[w] = (m[w] || 0) + 1; } return m; };   /* a full stop or comma that now sits outside a bold figure is not a change of wording */ const wa = bag(x.words), wb = bag(y.words); const lost = [], added = [];
      for (const w of Object.keys(wa)) if ((wb[w] || 0) < wa[w]) lost.push(w); for (const w of Object.keys(wb)) if ((wa[w] || 0) < wb[w] && !allow.has(w)) added.push(w);
      const ca = x.controls.slice().sort(), cb = y.controls.slice().sort(); const gone = ca.filter(c => cb.indexOf(c) < 0), come = cb.filter(c => ca.indexOf(c) < 0);
      if (lost.length || added.length || gone.length || come.length || ca.length !== cb.length){ bad++; console.log('FAIL', v, stop + ':', lost.length? 'words lost ' + JSON.stringify(lost.slice(0, 12)) : '', added.length? 'words added ' + JSON.stringify(added.slice(0, 12)) : '', gone.length? 'controls gone ' + JSON.stringify(gone.slice(0, 4)) : '', come.length? 'controls new ' + JSON.stringify(come.slice(0, 4)) : '', ca.length !== cb.length? 'control count ' + ca.length + ' v ' + cb.length : ''); }
    }
    if (a.state !== b.state){ bad++; console.log('FAIL', v, 'the saved game after the journey differs:', a.state, b.state); }
    else if (bad === was) console.log('ok  ', v + ':', Object.keys(a.stops).length, 'stops say the same and offer the same controls; the saved game after the journey is the same (' + a.state + ')');
  }
  process.exit(bad? 1 : 0);
}
const { chromium } = require('playwright'); const http = require('http');
const SITE = path.resolve(process.argv[2] || '.'); const OUT = path.resolve(process.argv[3] || 'ui-parity'); const QUERY = process.argv[4] || ''; fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  if (path.resolve(f).indexOf(SITE) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const INIT = seed => { let a = seed >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// the journey: [what to do, a name to record the screen under afterwards (or nothing)]
const JOURNEY = [
  ['nav:home', 'home-week1'], ['nav:squad', 'squad'], ['a:formation[data-f="4-3-3"]', 'squad-433'], ['a:autopick', null], ['a:training[data-t="hard"]', 'squad-hard'], ['a:toggle', 'squad-dropped'], ['a:autopick', null],
  ['nav:transfers', 'market-for-sale'], ['a:ttab[data-t="free"]', 'market-free'], ['a:ttab[data-t="offers"]', 'market-offers'], ['a:ttab[data-t="scout"]', 'market-scout'],
  ['a:brief[data-k="pos"]:nth', 'market-scout-brief'], ['a:scoutdiv[data-d="3"]', 'market-scout-div3'], ['a:scoutclub', 'market-scout-club'], ['a:scoutback', null], ['a:ttab[data-t="list"]', null], ['a:buy', 'market-after-buy'],
  ['nav:home', 'home-after'], ['week', 'home-week2'], ['nav:squad', 'squad-week2'], ['nav:transfers', 'market-week2'],
];
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = `http://127.0.0.1:${server.address().port}/` + QUERY;
  const browser = await chromium.launch(); const record = { site: SITE, query: QUERY, views: {} };
  for (const V of [{ name: 'phone', w: 390, h: 664, scale: 2 }, { name: 'desktop', w: 1366, h: 768, scale: 1 }]){
    const ctx = await browser.newContext({ viewport: { width: V.w, height: V.h }, deviceScaleFactor: V.scale, isMobile: V.name === 'phone', hasTouch: V.name === 'phone' });
    await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort()); await ctx.addInitScript(INIT, 1991);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL); await sleep(500); await page.click('[data-a="setup"]'); await sleep(150); const ins = await page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Parity'); await page.click('[data-a="start"]'); await sleep(400);
    const view = record.views[V.name] = { stops: {}, skipped: [] };
    const capture = async name => {
      view.stops[name] = await page.evaluate(() => { const norm = s => s.replace(/\s+/g, ' ').trim(); const parts = ['#hdr', '#main', '#nav', '#act'].map(q => document.querySelector(q)).filter(e => e && e.style.display !== 'none');
        const controls = []; for (const e of parts) for (const c of e.querySelectorAll('[data-a],[data-nav],a[href],input,select')){ const at = [...c.attributes].filter(x => /^data-|^href$|^id$|^value$|^inputmode$/.test(x.name)).map(x => x.name + '=' + x.value).sort().join(' '); controls.push(c.tagName + ' ' + at + (c.disabled? ' disabled' : '') + ' | ' + norm(c.textContent || '')); }
        const words = []; for (const e of parts){ const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) words.push(n.nodeValue); }   /* each piece of text on its own, so that two elements side by side never read as one word */
        return { words: norm(words.join(' ')), controls }; });
      await page.screenshot({ path: path.join(OUT, V.name + '-' + name + '.png') });
      if (V.name === 'phone'){ const h = await page.evaluate(() => { const m = document.querySelector('#main'); return m.scrollHeight - m.clientHeight; }); if (h > 40){ await page.evaluate(() => { const m = document.querySelector('#main'); m.scrollTop = m.scrollHeight; }); await sleep(80); await page.screenshot({ path: path.join(OUT, V.name + '-' + name + '-end.png') }); await page.evaluate(() => { document.querySelector('#main').scrollTop = 0; }); } }
    };
    for (const [what, name] of JOURNEY){
      if (what === 'week'){   // take the instant result and come back to Home in the next week
        await page.click('#act [data-a="play"]'); await sleep(300);
        for (let i = 0; i < 12; i++){ const at = await page.evaluate(() => window.__sm91.S.screen); if (at === 'home') break; const sel = at === 'matchpick'? '[data-a="md-instant"],[data-a="instant"]' : '#act [data-a], #main [data-a="home"], #main [data-a="continue"]'; const el = await page.$(sel); if (!el){ view.skipped.push('week: stuck at ' + at); break; } await el.click(); await sleep(350); }
      } else { const [kind, rest] = [what.slice(0, what.indexOf(':')), what.slice(what.indexOf(':') + 1)]; const nth = /:nth$/.test(rest); const r = rest.replace(/:nth$/, '');
        const sel = kind === 'nav'? `[data-nav="${r}"]` : `[data-a="${r.split('[')[0]}"]` + (r.indexOf('[') >= 0? r.slice(r.indexOf('[')) : ''); const els = await page.$$(sel); const el = els[nth? Math.min(1, els.length - 1) : 0];
        if (!el){ view.skipped.push(what); } else { await el.click(); await sleep(200); } }
      if (name) await capture(name);
    }
    if (process.env.DUMP) fs.writeFileSync(path.join(OUT, V.name + '-state.json'), await page.evaluate(() => JSON.stringify(window.__sm91.S.state)));
    view.state = await page.evaluate(() => { const t = JSON.stringify(Object.assign({}, window.__sm91.S.state, { gameId: '' }));   /* the game's id is made from the time of day; everything else is the seeded game */ let h = 0x811c9dc5; for (let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16) + ':' + t.length; });
    view.errors = errors; console.log(V.name + ':', Object.keys(view.stops).length, 'stops recorded, saved game', view.state, '| skipped:', JSON.stringify(view.skipped), '| page errors:', errors.length, errors.slice(0, 2).join(' ; '));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'record.json'), JSON.stringify(record)); await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
