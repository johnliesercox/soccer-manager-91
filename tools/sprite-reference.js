// The players' pictures as a list of checksums: the reference that any change to how a picture is recoloured for a kit
// must reproduce exactly. Every cell of the player and keeper sheets of the painted style, at every scale the build
// carries, is recoloured for a spread of kits (plain, stripes, hoops, halves, quarters, a white shirt, club colours
// given as hsl, two keepers, the referee with each card) and of looks (skin, hair, hair style), and its pixels hashed.
//   node tools/sprite-reference.js <site dir> out.json            write the checksums of this build
//   node tools/sprite-reference.js <site dir> out.json ref.json   and compare them with an earlier file
// (after python3 build.py; needs playwright)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.resolve(process.argv[2] || '.'); const OUT = process.argv[3] || 'sprite-reference.json'; const REF = process.argv[4] || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  if (path.resolve(f).indexOf(SITE) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort());
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const click = async (sel, ms = 150) => { await page.click(sel); await sleep(ms); }; const has = sel => page.$(sel).then(x => !!x);
  await page.goto(URL); await sleep(600); await click('[data-a="setup"]', 200); const ins = await page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Pictures'); await click('[data-a="start"]', 500);
  if (await has('[data-a="preseason"]')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); }
  await click('[data-a="play"]', 400); await click('[data-a="md-watch"]', 300);
  await page.waitForFunction(() => { const v = window.__sm91.S.md && window.__sm91.S.md.viewer; return v && v.playback && v.playback.state().playing && v.renderer && v.renderer.isReady && v.renderer.isReady(); }, null, { timeout: 60000 });
  await page.evaluate(() => { const v = window.__sm91.S.md.viewer; if (v.playback.state().playing) v.playback.pause(); });
  const res = await page.evaluate(async () => {
    const AS = window.Matchday.isoAssets; const scales = [12, 16, 24].filter(s => AS.has(s));
    const out = { scales, sprites: {}, count: 0, missing: 0, quick: {} };
    if (AS.prime) for (const s of scales){ await AS.prime(s); out.quick[s] = AS.planeState? AS.planeState(s) : '?'; }
    const hash = d => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i++){ h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
    const kits = { plain: { primary: '#C8102E', secondary: '#FFFFFF', pattern: 'plain' }, stripes: { primary: '#111111', secondary: '#F2F2F2', pattern: 'stripes' }, hoops: { primary: '#1D5BA4', secondary: '#F2C200', pattern: 'hoops' },
      halves: { primary: '#7B1E3A', secondary: '#35B7E8', pattern: 'halves' }, quarters: { primary: '#0FB5AE', secondary: '#F28C28', pattern: 'quarters' }, white: { primary: '#FFFFFF', secondary: '#1A1A1A', pattern: 'plain' },
      hsl: { primary: 'hsl(210,70%,40%)', secondary: 'hsl(40,90%,60%)', pattern: 'stripes' }, gkYellow: { primary: '#F2C200', secondary: '#1A1A1A', pattern: 'plain', gk: true }, gkGrey: { primary: '#9AA0A6', secondary: '#FFFFFF', pattern: 'stripes', gk: true },
      ref: { primary: '#1A1A1A', secondary: '#1A1A1A', pattern: 'plain' }, refYellow: { primary: '#1A1A1A', secondary: '#1A1A1A', pattern: 'plain', card: 'yellow' }, refRed: { primary: '#7B1E3A', secondary: '#7B1E3A', pattern: 'plain', card: 'red' } };
    const looks = [{ skin: 0, hair: 0, style: 0 }, { skin: 1, hair: 2, style: 1 }, { skin: 3, hair: 4, style: 2 }, { skin: 2, hair: 1, style: 3 }];
    const sheet = window.Matchday.isoAssetData || {}; const style = Object.keys(sheet).map(k => k.split('/')[0])[0];
    for (const spr of scales){
      // every cell: the poses and frames of both sheets, from the manifest the build carries
      const man = JSON.parse(typeof sheet[style + '/' + spr].manifest === 'string' && sheet[style + '/' + spr].manifest[0] === '{'? sheet[style + '/' + spr].manifest : JSON.stringify(sheet[style + '/' + spr].manifest));
      const cells = new Set(); for (const r of man.rows) cells.add(r[0] + '|' + r[1]); const gcells = new Set(); for (const r of man.keepers.rows) gcells.add(r[0] + '|' + r[1]);
      for (const [kn, kit] of Object.entries(kits)) for (let li = 0; li < looks.length; li++){ const look = looks[li]; if (kit.gk && li > 1) continue;
        for (const cell of (kit.gk? gcells : cells)){ const [pose, frame] = cell.split('|'); for (const dir of man.dirs){
          const cv = AS.get(kit, look, dir, pose, isNaN(+frame)? frame : +frame, spr); const key = spr + '|' + kn + '|' + li + '|' + cell + '|' + dir;
          if (!cv){ out.missing++; continue; } out.sprites[key] = cv.width + 'x' + cv.height + ':' + cv.feet + ':' + hash(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data); out.count++; } } }
    }
    return out;
  });
  // kept small: one checksum for each scale and kit (of the checksums of its pictures in order), and the count
  { const groups = {}; for (const k of Object.keys(res.sprites).sort()){ const g = k.split('|').slice(0, 2).join('|'); (groups[g] = groups[g] || []).push(k + '=' + res.sprites[k]); }
    const hs = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
    res.different = new Set(Object.values(res.sprites)).size; res.sprites = {}; for (const g of Object.keys(groups)) res.sprites[g] = groups[g].length + ':' + hs(groups[g].join(';')); }
  res.errors = errors; fs.writeFileSync(OUT, JSON.stringify(res));
  console.log('pictures hashed', res.count, '(' + res.different + ' different) at scales', res.scales.join(', '), '| cells with no picture:', res.missing, '| quick recolouring:', JSON.stringify(res.quick), '| page errors:', errors.length);
  let bad = 0; if (errors.length){ console.log('FAIL page errors', errors.slice(0, 3)); bad++; } if (!res.count){ console.log('FAIL nothing hashed'); bad++; }
  for (const s of Object.keys(res.quick)) if (res.quick[s] !== 'ready'){ console.log('FAIL the quick recolouring is not in use at scale ' + s + ': ' + res.quick[s]); bad++; }
  if (REF){ const ref = JSON.parse(fs.readFileSync(REF, 'utf8')); const keys = new Set(Object.keys(ref.sprites).concat(Object.keys(res.sprites))); const diff = []; for (const k of keys) if (ref.sprites[k] !== res.sprites[k]) diff.push(k);
    if (diff.length || ref.count !== res.count){ console.log('FAIL the pictures of', diff.length, 'of', keys.size, 'scale and kit groups differ from the reference:', diff.slice(0, 10)); bad++; } else console.log('ok   all', res.count, 'pictures (in', keys.size, 'groups by scale and kit) are pixel for pixel the reference'); }
  await browser.close(); server.close(); process.exit(bad? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
