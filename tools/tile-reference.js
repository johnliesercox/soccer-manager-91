// The painted ground, tile by tile, as a list of checksums: the reference that any change to how the ground is painted
// must reproduce exactly. Every 256 px tile of the whole stadium is painted at each scale in use (12, 16 and 24 px a
// metre, and the whole-pitch scales of a phone and a desktop stage), with the crowd still and risen, for two pairs of
// club colours, and its pixels are hashed. Where the build can paint a tile in steps, the stepped painting is hashed
// too and must equal the painting done in one go.
//   node tools/tile-reference.js <site dir> out.json            write the checksums of this build
//   node tools/tile-reference.js <site dir> out.json ref.json   and compare them with an earlier file
// (after python3 build.py; needs playwright)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.resolve(process.argv[2] || '.'); const OUT = process.argv[3] || 'tile-reference.json'; const REF = process.argv[4] || '';
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
  await page.goto(URL); await sleep(600); await click('[data-a="setup"]', 200); const ins = await page.$$('.mgrname'); if (ins[0]) await ins[0].fill('Tiles'); await click('[data-a="start"]', 500);
  if (await has('[data-a="preseason"]')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); }
  await click('[data-a="play"]', 400); await click('[data-a="md-watch"]', 300);
  await page.waitForFunction(() => { const v = window.__sm91.S.md && window.__sm91.S.md.viewer; return v && v.playback && v.playback.state().playing && v.renderer && v.renderer.isReady && v.renderer.isReady(); }, null, { timeout: 60000 });
  await page.evaluate(() => { const v = window.__sm91.S.md.viewer; if (v.playback.state().playing) v.playback.pause(); });
  const res = await page.evaluate(() => {
    const MD = window.Matchday, ISO = MD.iso, PR = ISO.projection, DIM = PR.DIM, T = 256, OUTSIDE = '#2B3036';
    const hash = d => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i++){ h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
    const scales = [12, 16, 24, +PR.fit(360, 465, DIM.runoff + 1.5).P.toFixed(6), +PR.fit(904, 619, DIM.runoff + 1.5).P.toFixed(6)];
    const out = { scales, tiles: {}, count: 0, crowdTiles: 0, steppedDiffers: [], stepped: !!ISO.stadium.groundSteps, art: !!(MD.isoAssets && MD.isoAssets.crowdStrip(16, 'far', 0, false, 7, ['#C8102E', '#1D5BA4']) && MD.isoAssets.grass(16)) };
    const cv = document.createElement('canvas'); cv.width = T; cv.height = T; const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false;
    const paint = (P, tx, ty, jump, seed, colours, stepped) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = OUTSIDE; ctx.fillRect(0, 0, T, T); const cam = { P, ox: -tx*T, oy: -ty*T }, clip = { x: 0, y: 0, w: T, h: T };
      let crowd = false; if (stepped){ for (const st of ISO.stadium.groundSteps(ctx, cam, seed, jump, clip, { colours })) crowd = st() || crowd; } else crowd = ISO.stadium.drawGround(ctx, cam, seed, jump, clip, { colours });
      return { crowd: !!crowd, h: hash(ctx.getImageData(0, 0, T, T).data) }; };
    for (const P of scales){
      // every tile the stadium can reach: the ground with forty metres round it and twenty-five of height
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const X of [-40, DIM.L + 40]) for (const Y of [-40, DIM.W + 40]) for (const Z of [0, 25]){ const p = PR.project(X, Y, Z, { P, ox: 0, oy: 0 }); x0 = Math.min(x0, p.sx); x1 = Math.max(x1, p.sx); y0 = Math.min(y0, p.sy); y1 = Math.max(y1, p.sy); }
      const sets = P === 16? [[7, ['#C8102E', '#1D5BA4']], [20261117, ['#F2C200', '#111111']]] : [[7, ['#C8102E', '#1D5BA4']]];
      for (const [seed, colours] of sets) for (let ty = Math.floor(y0/T); ty <= Math.floor(y1/T); ty++) for (let tx = Math.floor(x0/T); tx <= Math.floor(x1/T); tx++) for (const jump of [false, true]){
        const a = paint(P, tx, ty, jump, seed, colours, false); if (jump && !a.crowd) continue;   // a tile with no crowd has no risen painting
        const key = P + '|' + seed + '|' + tx + '|' + ty + '|' + (jump? 'j' : 's'); out.tiles[key] = a.h + (a.crowd? 'c' : ''); out.count++; if (a.crowd) out.crowdTiles++;
        if (out.stepped){ const b = paint(P, tx, ty, jump, seed, colours, true); if (b.h !== a.h || b.crowd !== a.crowd) out.steppedDiffers.push(key); }
      }
    }
    return out;
  });
  res.errors = errors; fs.writeFileSync(OUT, JSON.stringify(res));
  const distinct = new Set(Object.values(res.tiles)).size;
  console.log('tiles hashed', res.count, '(' + res.crowdTiles + ' with crowd, ' + distinct + ' different pictures) at scales', res.scales.join(', '), '| painted art loaded:', res.art, '| page errors:', errors.length);
  let bad = 0; if (!res.art){ console.log('FAIL the painted art was not loaded'); bad++; } if (errors.length){ console.log('FAIL page errors', errors.slice(0, 3)); bad++; }
  if (res.stepped){ if (res.steppedDiffers.length){ console.log('FAIL painted in steps differs from painted in one go:', res.steppedDiffers.length, res.steppedDiffers.slice(0, 8)); bad++; } else console.log('ok   every tile painted in steps equals the same tile painted in one go'); }
  if (REF){ const ref = JSON.parse(fs.readFileSync(REF, 'utf8')); const keys = new Set(Object.keys(ref.tiles).concat(Object.keys(res.tiles))); const diff = []; for (const k of keys) if (ref.tiles[k] !== res.tiles[k]) diff.push(k);
    if (diff.length){ console.log('FAIL', diff.length, 'of', keys.size, 'tiles differ from the reference:', diff.slice(0, 12)); bad++; } else console.log('ok   all', keys.size, 'tiles are pixel for pixel the reference'); }
  await browser.close(); server.close(); process.exit(bad? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
