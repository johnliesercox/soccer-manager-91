// The hair audit: every player picture as the game draws it, checked for hair that is not drawn as hair.
//
// The painted sheets say what each pixel is (hair, skin, boots, eye and so on); the game colours hair with the player's
// own hair colour and draws boots and eyes black. Until 1.7.1 the converter had filed much of the painter's dark hair as
// boots or eye, so a fair-haired player's hair turned black in some poses. This audit does not read the sheets: it loads
// the built game in a browser and asks the game for every picture (window.Matchday.isoAssets.get, the call a match makes),
// three times over with different hair and skin colours. A pixel that changes with the hair colour is drawn as hair; one
// that changes with the skin colour is skin; one in the game's fixed boot or eye black is black. Where the head is comes
// from the game's own skeleton (window.Matchday.isoSprites.pose). Nothing outside the repository is needed.
//
// Part 1, every cell (58 poses and frames, 8 directions, 3 hairstyles for outfield players and the keepers' one, at the
// three sizes: 5,568 pictures). A cell FAILS if
//   * the game has no picture for it, or the picture is not the painted one (a fallback to the generated figure);
//   * a hairstyle has no row of its own (a fallback to hairstyle 0), or its picture is the same as hairstyle 0's;
//   * black that belongs to the head's hair is drawn (boots black, or a dark band joined to the hair that is not an eye or mouth);
//   * hair colour is drawn away from the head (on socks, knees, arms, the face or the neck);
//   * a small patch of another material is shut inside the hair;
//   * the head's hair is not on the common lightness level (so the same hair is not darker in one pose than another).
// It LISTS, against a recorded list of the cells known at 1.7.1 (tools/reference/hair-shape-known.json), the cells where the
// painting itself differs from the hairstyle's norm: a head with far less or far more hair than the hairstyle has in that
// direction, a head facing the camera that shows no face, a head facing away that shows one, a head missing from the
// painting. A cell that is not on the recorded list FAILS, so new art cannot add to them unnoticed.
//
// Part 2, the look followed through matches: seeded games are started, their first match is watched, and at several
// hundred moments of each, with each camera, every call the match makes for a player's picture is recorded. It FAILS if a
// player is ever asked for with a look other than his own (skin, hair colour, hairstyle), if any picture is missing, or
// if anyone's hairstyle changes during a match for any reason but the one known limitation: the keepers' sheet has one
// hairstyle, so an outfield player who goes in goal after a sending-off is drawn with it. That case is counted and reported.
//
//   node tools/hair-audit.js <site dir>                        both parts (20 matches), against the recorded list
//   node tools/hair-audit.js <site dir> --matches 0             part 1 only (about a minute)
//   node tools/hair-audit.js <site dir> --out report.json       write the full report
//   node tools/hair-audit.js <site dir> --record                write tools/reference/hair-shape-known.json from this build
//   node tools/hair-audit.js <site dir> --compare <other dir>   and say, cell by cell, what differs from another build
// (after python3 build.py; needs playwright)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2); const flag = n => { const i = args.indexOf(n); return i < 0? null : (args[i + 1] && !/^--/.test(args[i + 1])? args[i + 1] : true); };
const SITE = path.resolve(args[0] && !/^--/.test(args[0])? args[0] : '.'); const OUT = flag('--out'); const RECORD = !!flag('--record'); const COMPARE = flag('--compare');
const MATCHES = flag('--matches') === null? 20 : +flag('--matches'); const KNOWN_FILE = path.join(__dirname, 'reference', 'hair-shape-known.json'); const LENIENT = !!flag('--report-only');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const serve = dir => new Promise(res => { const server = http.createServer((req, rs) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(dir, p);
  if (path.resolve(f).indexOf(dir) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ rs.writeHead(404); rs.end('no'); return; }
  rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(rs); }); server.listen(0, '127.0.0.1', () => res(server)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const INIT = seed => { let a = seed >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// start a game and its first match, paused, with the painted art ready
async function openMatch(browser, url, seed, name){
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.toString()), route => route.abort()); if (seed !== null) await ctx.addInitScript(INIT, seed);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const click = async (sel, ms = 150) => { await page.click(sel); await sleep(ms); }; const has = sel => page.$(sel).then(x => !!x);
  await page.goto(url); await sleep(600); await click('[data-a="setup"]', 200); const ins = await page.$$('.mgrname'); if (ins[0]) await ins[0].fill(name); await click('[data-a="start"]', 500);
  if (await has('[data-a="preseason"]')){ await click('[data-a="preseason"]'); await click('[data-a="sponsor"]'); await click('[data-a="tickets"][data-m="12"]'); await click('[data-a="home"]'); }
  await click('[data-a="play"]', 400); await click('[data-a="md-watch"]', 300);
  await page.waitForFunction(() => { const v = window.__sm91.S.md && window.__sm91.S.md.viewer; return v && v.playback && v.playback.state().playing && v.renderer && v.renderer.isReady && v.renderer.isReady(); }, null, { timeout: 60000 });
  await page.evaluate(() => { const v = window.__sm91.S.md.viewer; if (v.playback.state().playing) v.playback.pause(); });
  return { ctx, page, errors };
}

// ---- part 1, in the page: every cell drawn by the game and measured ----
const SHEETS = async () => {
  const MD = window.Matchday, AS = MD.isoAssets, SP = MD.isoSprites, PR = MD.iso.projection; const scales = [24, 16, 12].filter(s => AS.has(s));
  const data = MD.isoAssetData || {}; const style = Object.keys(data).map(k => k.split('/')[0])[0];
  const deref = v => { let guard = 0; while (typeof v === 'string' && v[0] === '@' && guard++ < 8){ const [st, spr, ...p] = v.slice(1).split('/'); let x = data[st + '/' + spr]; for (const k of p) x = x? x[k] : undefined; v = x; } return v; };
  const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const HAIRS = MD.sprites.HAIRS, SKINS = MD.sprites.SKINS;
  // the measures, in metres of the figure, so the three sizes are treated alike (the same as tools/hair_repair.py)
  const R_CORE = 0.30, R_FOOT = 0.24, R_HAIR = { 0: 0.42, 1: 0.40, 2: 0.46 }, EYE_RUN = { 24: 2, 16: 2, 12: 1 }, EYE_KEEP = { 24: 3, 16: 2, 12: 1 }, R_EYE = 0.08, LEVEL = 1.6;
  const EMPTY = 0, HAIR = 1, SKIN = 2, EYE = 3, BOOT = 4, LINE = 5, OTHER = 6;
  const out = { style, scales, cells: [], fails: [], totals: {}, quick: {} };
  const fail = (key, what, n) => out.fails.push([key, what, n === undefined? 1 : n]);
  // 8- or 4-connected labelling of a mask
  const label = (mask, W, H, eight) => { const lab = new Int32Array(W*H); let n = 0; const st = [];
    for (let i = 0; i < W*H; i++){ if (!mask[i] || lab[i]) continue; n++; lab[i] = n; st.push(i);
      while (st.length){ const p = st.pop(); const x = p % W, y = (p - x)/W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){ if ((!dx && !dy) || (!eight && dx && dy)) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy*W + xx; if (mask[q] && !lab[q]){ lab[q] = n; st.push(q); } } } }
    return { lab, n }; };
  for (const spr of scales){
    if (AS.prime){ await AS.prime(spr); out.quick[spr] = AS.planeState? AS.planeState(spr) : '?'; }
    const d0 = data[style + '/' + spr]; let man = deref(d0.manifest); if (typeof man === 'string') man = JSON.parse(man); const K = man.tones;
    // the painted sheets themselves, only to tell a painted cell from a generated one
    const paint = {}; for (const [f, gk] of [['overrides', false], ['overridesKeepers', true]]){ const src = deref(d0[f]); if (!src){ paint[gk] = null; continue; } const im = await loadImage(src); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); paint[gk] = { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; }
    const rowsOf = gk => gk? man.keepers.rows : man.rows; const rowIndex = {}; for (const gk of [false, true]) for (const r of rowsOf(gk)) rowIndex[(gk? 'gk|' : '') + r[0] + '|' + r[1] + '|' + r[2]] = r;
    const frames = []; const seen = new Set(); for (const r of man.rows){ const k = r[0] + '|' + r[1]; if (!seen.has(k)){ seen.add(k); frames.push([r[0], r[1]]); } }
    const gframes = []; const gseen = new Set(); for (const r of man.keepers.rows){ const k = r[0] + '|' + r[1]; if (!gseen.has(k)){ gseen.add(k); gframes.push([r[0], r[1]]); } }
    const kits = { false: { primary: '#2060C0', secondary: '#F0F0F0', pattern: 'plain' }, true: { primary: '#F2C200', secondary: '#1F2A44', pattern: 'plain', gk: true } };
    const total = { cells: 0, missing: 0, notPainted: 0, noRow: 0, sameAsStyle0: 0, blackHair: 0, blackHairCells: 0, band: 0, bandCells: 0, stray: 0, strayCells: 0, patches: 0, patchCells: 0, offLevel: 0, hairPixels: 0, eyesOnFaces: 0, facesShown: 0, facesNoMark: 0 };
    const style0 = {};
    for (const gk of [false, true]) for (const hs of (gk? [0] : [0, 1, 2])) for (const [pose, frame] of (gk? gframes : frames)) for (let di = 0; di < man.dirs.length; di++){
      const dir = man.dirs[di]; const key = spr + '|' + (gk? 'keeper' : 'player') + '|' + pose + '|' + frame + '|' + hs + '|' + dir; total.cells++;
      const kit = kits[gk]; const row = rowIndex[(gk? 'gk|' : '') + pose + '|' + frame + '|' + hs];
      if (!row){ total.noRow++; fail(key, 'this hairstyle has no row of its own (the game would fall back to hairstyle 0)'); }
      const looks = [{ skin: 0, hair: 2, style: hs }, { skin: 0, hair: 3, style: hs }, { skin: 2, hair: 2, style: hs }];
      const cvs = looks.map(l => AS.get(kit, l, dir, pose, frame, spr));
      if (!cvs[0] || !cvs[1] || !cvs[2]){ total.missing++; fail(key, 'the game has no picture for this cell'); continue; }
      const W = cvs[0].width, H = cvs[0].height; const px = cvs.map(c => c.getContext('2d').getImageData(0, 0, W, H).data);
      const pal = AS.paletteFor(kit, looks[0], K); const eyeC = pal[8*8], lineC = pal[10*8]; const boots = []; for (let k = 0; k < K; k++) boots.push(pal[6*8 + k]); const hairT = []; for (let k = 0; k < K; k++) hairT.push(pal[1*8 + k]);
      const is = (d, o, c) => d[o] === c[0] && d[o + 1] === c[1] && d[o + 2] === c[2];
      const cls = new Uint8Array(W*H), tone = new Int8Array(W*H);
      for (let i = 0, o = 0; i < W*H; i++, o += 4){ const a = px[0];
        if (!a[o + 3]){ cls[i] = EMPTY; continue; }
        if (a[o] !== px[1][o] || a[o + 1] !== px[1][o + 1] || a[o + 2] !== px[1][o + 2]){ cls[i] = HAIR; let k = 0; for (let q = 0; q < K; q++) if (is(a, o, hairT[q])){ k = q; break; } tone[i] = k; continue; }
        if (a[o] !== px[2][o] || a[o + 1] !== px[2][o + 1] || a[o + 2] !== px[2][o + 2]){ cls[i] = SKIN; continue; }
        if (is(a, o, eyeC)){ cls[i] = EYE; continue; } if (is(a, o, lineC)){ cls[i] = LINE; continue; }
        let b = false; for (let q = 0; q < K; q++) if (is(a, o, boots[q])){ b = true; break; } cls[i] = b? BOOT : OTHER; }
      // painted, not generated: the cell of the painted sheet has paint, and the picture has exactly its outline
      const P = paint[gk]; if (row && P){ const y0 = row[3], x0 = di*row[4]; let any = false, same = true; for (let y = 0; y < H && same; y++) for (let x = 0; x < W; x++){ const a = P.d[((y0 + y)*P.w + x0 + x)*4 + 3] > 0; if (a) any = true; if (a !== (cls[y*W + x] !== EMPTY)){ same = false; break; } }
        if (!any || !same){ total.notPainted++; fail(key, !any? 'the cell is not painted (the generated figure is drawn)' : 'the picture is not the painted cell'); } }
      else if (!P){ total.notPainted++; fail(key, 'there is no painted sheet'); }
      // a hairstyle's picture is its own, not hairstyle 0's
      if (!gk){ let h = 0x811c9dc5; const a = px[0]; for (let i = 0; i < a.length; i++){ h ^= a[i]; h = Math.imul(h, 0x01000193); } const k0 = spr + '|' + pose + '|' + frame + '|' + dir; if (hs === 0) style0[k0] = h; else if (style0[k0] === h){ total.sameAsStyle0++; fail(key, 'the picture is the same as hairstyle 0\'s'); } }
      // where the head is, from the game's skeleton and projection
      const j = SP.pose(pose, frame); const c0 = SP.cell(spr, pose); const ang = SP.HEADING[dir]; const feet = cvs[0].feet;
      const proj = p => { const fx = Math.cos(ang), fy = Math.sin(ang), rx = -fy, ry = fx; const X = p[0]*fx + p[1]*rx, Y = p[0]*fy + p[1]*ry; return [W/2 + spr*(X - Y), feet + spr*((X + Y)*0.5 - p[2]*PR.HEIGHT)]; };
      const [hx, hy] = proj(j.head); const fL = proj(j.footL), fR = proj(j.footR); const eyes = [-0.065, 0.065].map(sy => proj([j.head[0] + 0.19*0.86, j.head[1] + sy, j.head[2] + 0.015])); const facing = (Math.cos(ang) + Math.sin(ang))/Math.SQRT2;
      const dh = new Float32Array(W*H), df = new Float32Array(W*H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ const i = y*W + x, cx = x + 0.5, cy = y + 0.5; dh[i] = Math.hypot(cx - hx, cy - hy)/spr; df[i] = Math.min(Math.hypot(cx - fL[0], cy - fL[1]), Math.hypot(cx - fR[0], cy - fR[1]))/spr; }
      const N = W*H; const isboot = new Uint8Array(N), iseye = new Uint8Array(N), ishair = new Uint8Array(N), cand = new Uint8Array(N); const R = R_HAIR[hs] === undefined? 0.42 : R_HAIR[hs];
      for (let i = 0; i < N; i++){ isboot[i] = cls[i] === BOOT && df[i] > R_FOOT? 1 : 0; iseye[i] = cls[i] === EYE? 1 : 0; ishair[i] = cls[i] === HAIR? 1 : 0; cand[i] = (ishair[i] || isboot[i] || iseye[i]) && dh[i] <= R? 1 : 0; }
      // the head's hair with the dark paint joined to it: of the blobs of hair, boot black and eye black around the head joint,
      // the one with the most hair or boot black close to the joint
      const L1 = label(cand, W, H, true); const solid = new Int32Array(L1.n + 1); for (let i = 0; i < N; i++) if (L1.lab[i] && (ishair[i] || isboot[i]) && dh[i] <= R_CORE) solid[L1.lab[i]]++;
      let mainK = 0, mainN = 0; for (let k = 1; k <= L1.n; k++) if (solid[k] > mainN){ mainN = solid[k]; mainK = k; } if (mainN < 3) mainK = 0;
      const mass = new Uint8Array(N); for (let i = 0; i < N; i++) mass[i] = mainK && L1.lab[i] === mainK? 1 : 0;
      let blackHair = 0; for (let i = 0; i < N; i++) if (mass[i] && isboot[i]) blackHair++;
      // which dark marks on the head are an eye or a mouth: a short run with skin at an end, or the dark paint nearest to where the model has an eye
      const facial = new Uint8Array(N); const maxrun = EYE_RUN[spr] || 2; const eyesIn = i => mass[i] && iseye[i];
      for (let y = 0; y < H; y++){ let x = 0; while (x < W){ if (!eyesIn(y*W + x)){ x++; continue; } const xs = x; while (x < W && eyesIn(y*W + x)) x++;
        const lc = xs > 0? cls[y*W + xs - 1] : EMPTY, rc = x < W? cls[y*W + x] : EMPTY; const edge = v => v === LINE || v === EMPTY;
        if (x - xs <= maxrun && ((lc === SKIN && rc === SKIN) || (lc === SKIN && edge(rc)) || (edge(lc) && rc === SKIN)) && y + 0.5 >= hy - 0.06*spr) for (let q = xs; q < x; q++) facial[y*W + q] = 1; } }
      const skinN = i => { const x = i % W, y = (i - x)/W; let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){ const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && cls[yy*W + xx] === SKIN) n++; } return n; };
      const inFace = i => dh[i] <= 0.28 && (Math.floor(i / W) + 0.5) >= hy - 0.10*spr;
      if (facing > -0.2){
        const keepNear = radius => { for (const [ex, ey] of eyes){ const c = []; for (let i = 0; i < N; i++){ if (!eyesIn(i) || facial[i] || skinN(i) < 1) continue; const x = i % W, y = (i - x)/W; const de = Math.hypot(x + 0.5 - ex, y + 0.5 - ey); if (de <= radius) c.push([de, i]); } c.sort((a, b) => a[0] - b[0]); for (const q of c.slice(0, EYE_KEEP[spr] || 2)) facial[q[1]] = 1; } };
        keepNear(Math.max(1.5, R_EYE*spr));
        let any = false, left = false, skin = 0; for (let i = 0; i < N; i++){ if (!inFace(i)) continue; if (iseye[i]){ any = true; if (!(eyesIn(i) && !facial[i])) left = true; } if (cls[i] === SKIN) skin++; }
        if (any && !left && skin >= Math.max(3, Math.round(10*(spr/24)*(spr/24)))){ keepNear(0.16*spr);
          let got = false; for (let i = 0; i < N; i++) if (facial[i] && inFace(i)){ got = true; break; }
          if (!got){ let best = -1, bd = 1e9; for (let i = 0; i < N; i++){ if (!eyesIn(i) || !inFace(i) || skinN(i) < 1) continue; const x = i % W, y = (i - x)/W; const de = Math.min(...eyes.map(e => Math.hypot(x + 0.5 - e[0], y + 0.5 - e[1]))); if (de < bd){ bd = de; best = i; } } if (best >= 0) facial[best] = 1; } }
      }
      // the dark band joined to the hair that is not an eye or a mouth
      const grow = new Uint8Array(N); const st = []; for (let i = 0; i < N; i++) if (mass[i] && (ishair[i] || isboot[i])){ grow[i] = 1; st.push(i); }
      let band = 0; while (st.length){ const p = st.pop(); const x = p % W, y = (p - x)/W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){ const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy*W + xx; if (!grow[q] && eyesIn(q) && !facial[q]){ grow[q] = 1; band++; st.push(q); } } }
      // small patches of other materials shut inside the hair
      const hairHead = new Uint8Array(N); for (let i = 0; i < N; i++) hairHead[i] = ishair[i] && dh[i] <= R? 1 : 0;
      const open = new Uint8Array(N); { const q = []; const push = i => { if (!hairHead[i] && !open[i]){ open[i] = 1; q.push(i); } }; for (let x = 0; x < W; x++){ push(x); push((H - 1)*W + x); } for (let y = 0; y < H; y++){ push(y*W); push(y*W + W - 1); }
        while (q.length){ const p = q.pop(); const x = p % W, y = (p - x)/W; if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (y > 0) push(p - W); if (y < H - 1) push(p + W); } }
      const hole = new Uint8Array(N); for (let i = 0; i < N; i++) hole[i] = !hairHead[i] && !open[i] && cls[i] !== EMPTY? 1 : 0;
      let patches = 0; { const L = label(hole, W, H, false); const size = new Int32Array(L.n + 1), eye = new Uint8Array(L.n + 1), faceSkin = new Uint8Array(L.n + 1), low = new Float32Array(L.n + 1), skin = new Uint8Array(L.n + 1);
        for (let i = 0; i < N; i++){ const k = L.lab[i]; if (!k) continue; size[k]++; if (cls[i] === EYE) eye[k] = 1; if (cls[i] === SKIN) skin[k] = 1; low[k] = Math.max(low[k], Math.floor(i / W) + 0.5); }
        const cap = Math.max(2, Math.round(10*(spr/24)*(spr/24))); for (let k = 1; k <= L.n; k++){ if (size[k] > cap || eye[k]) continue; if (skin[k] && facing > -0.2 && low[k] > hy - 0.03*spr) continue; patches += size[k]; } }
      // hair colour that is not the head's hair
      let stray = 0; { const loose = new Uint8Array(N); for (let i = 0; i < N; i++){ if (!ishair[i]) continue; if (dh[i] > R) stray++; else if (!mass[i]) loose[i] = 1; }
        const L = label(loose, W, H, true); const near = new Int32Array(L.n + 1), size = new Int32Array(L.n + 1), sumy = new Float64Array(L.n + 1);
        for (let i = 0; i < N; i++){ const k = L.lab[i]; if (!k) continue; size[k]++; sumy[k] += Math.floor(i / W) + 0.5; if (dh[i] <= R_CORE) near[k]++; }
        for (let k = 1; k <= L.n; k++) if (!(near[k] >= 0.6*size[k] && size[k] >= Math.max(3, Math.floor(spr/6)) && sumy[k]/size[k] < hy)) stray += size[k]; }     // a separate tuft above the middle of the head is hair
      // the head's hair: how much, how light, how wide and tall; the face
      let area = 0, tsum = 0, x0 = W, x1 = -1, y0 = H, y1 = -1; const hist = [0, 0, 0, 0, 0];
      for (let i = 0; i < N; i++) if (hairHead[i]){ area++; tsum += tone[i]; hist[Math.min(4, tone[i])]++; const x = i % W, y = (i - x)/W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      let faceSkin = 0, faceEyes = 0, headPaint = 0; for (let i = 0; i < N; i++){ if (dh[i] <= R_CORE && cls[i] !== EMPTY && cls[i] !== LINE) headPaint++; if (!inFace(i)) continue; if (cls[i] === SKIN) faceSkin++; if (cls[i] === EYE) faceEyes++; }
      const level = area? tsum/area : 0; const offLevel = area >= 6 && Math.floor(LEVEL - level + 0.5) !== 0 && !(hist[0] === area || hist[4] === area);
      total.hairPixels += area; total.blackHair += blackHair; total.band += band; total.stray += stray; total.patches += patches; if (blackHair) total.blackHairCells++; if (band) total.bandCells++; if (stray) total.strayCells++; if (patches) total.patchCells++; if (offLevel) total.offLevel++;
      const faceNeed = Math.max(3, Math.round(10*(spr/24)*(spr/24))); if (facing >= 0.85 && faceSkin >= faceNeed){ total.facesShown++; total.eyesOnFaces += faceEyes; if (!faceEyes) total.facesNoMark++; }
      if (blackHair) fail(key, 'hair drawn in boot black', blackHair); if (band) fail(key, 'a dark band joined to the hair is drawn black', band); if (stray) fail(key, 'hair colour away from the head\'s hair', stray); if (patches) fail(key, 'a patch of another material shut inside the hair', patches); if (offLevel) fail(key, 'the hair is not on the common lightness level (average tone ' + level.toFixed(2) + ')');
      out.cells.push([key, area, +level.toFixed(3), +((x1 - x0 + 1)/spr).toFixed(3), +((hy - y0)/spr).toFixed(3), +((y1 + 1 - hy)/spr).toFixed(3), faceSkin, faceEyes, headPaint, +facing.toFixed(2), blackHair + band, stray, hist.join(',')]);
    }
    out.totals[spr] = total;
  }
  return out;
};

// ---- part 2, in the page: the look every player is asked for, at many moments of the match on screen ----
const FOLLOW = async () => {
  const v = window.__sm91.S.md.viewer, MD = window.Matchday, AS = MD.isoAssets, SP = MD.isoSprites;
  const own = id => { const a = MD.sprites.variantFor(id); return { skin: a.skin, hair: a.hair, style: MD.hashString('style' + id) % 3 }; };   // a look worked out here, apart from the renderer
  const ids = new WeakMap(); const realV = SP.variantFor, realG = AS.get; const seen = {}; const res = { draws: 0, small: 0, players: 0, wrongLook: [], missing: [], changes: [], inGoal: [], keeperStyle: 0, moments: 0, refMissing: 0, use: {} };
  SP.variantFor = id => { const o = realV(id); ids.set(o, id); return o; };
  let now = 0;
  AS.get = (kit, variant, dir, pose, frame, spr) => { const cv = realG(kit, variant, dir, pose, frame, spr); const id = ids.get(variant); if (id === undefined){ if (!cv && AS.has(spr)) res.refMissing++; return cv; }      // the referee
    res.draws++; const o = own(id); if (variant.skin !== o.skin || variant.hair !== o.hair || variant.style !== o.style) res.wrongLook.push([id, now, JSON.stringify(variant), JSON.stringify(o)]);
    if (!cv){ if (AS.has(spr)) res.missing.push([id, now, pose, frame, dir, spr]); else res.small++; }
    else if (AS.has(spr)){ const k = spr + '|' + (kit.gk? 'keeper' : 'player') + '|' + pose + '|' + frame + '|' + (kit.gk? 0 : variant.style) + '|' + dir; res.use[k] = (res.use[k] || 0) + 1; }      // which cells a match really draws, and how often
    const drawn = kit.gk? 0 : variant.style; const s = seen[id] || (seen[id] = { own: o, first: now, styles: {}, gk: {} }); if (s.styles[drawn] === undefined) s.styles[drawn] = now; if (s.gk[kit.gk? 1 : 0] === undefined) s.gk[kit.gk? 1 : 0] = now; return cv; };
  try {
    const segs = v.playback.timeMap().segs.filter(g => !g.ff); const times = []; for (const g of segs) for (let t = g.a; t <= g.b; t += 0.25) times.push(+t.toFixed(2));
    for (const cam of ['close', 'follow', 'whole']){ v.renderer.setCamera(cam); const list = cam === 'close'? times : times.filter((t, i) => i % 4 === 0);
      for (const t of list){ now = t; const g = segs.find(x => t >= x.a && t <= x.b); v.renderer.render(v.scene.getSceneAt(t), Object.assign({ sinceCut: 5 }, g? { segment: { a: g.a, b: g.b } } : {})); res.moments++; } }
  } finally { SP.variantFor = realV; AS.get = realG; }
  for (const id of Object.keys(seen)){ const s = seen[id]; res.players++; const drawn = Object.keys(s.styles).map(Number); const both = s.gk[0] !== undefined && s.gk[1] !== undefined;
    if (s.gk[1] !== undefined && s.own.style !== 0) res.keeperStyle++;
    if (both) res.inGoal.push([id, s.gk[1], s.own.style]);                                  // an outfield player who went in goal (or the reverse)
    if (drawn.length > 1){ if (both) continue; res.changes.push([id, JSON.stringify(s.styles)]); } }
  const sent = v.pres.events.filter(e => e.type === MD.EVENT.SENT_OFF).length;
  return Object.assign(res, { teams: v.pres.teams.home.name + ' v ' + v.pres.teams.away.name, sentOff: sent });
};

// the known limitation, shown directly: the same scene with an outfield player put in goal
const STANDIN = async () => {
  const v = window.__sm91.S.md.viewer, MD = window.Matchday, AS = MD.isoAssets, SP = MD.isoSprites; const sc = v.scene.getSceneAt(1.5); const pl = sc.players.find(p => p.role !== 'GK' && MD.hashString('style' + p.id) % 3 !== 0);
  if (!pl) return { found: false }; const calls = []; const realG = AS.get; const ids = new WeakMap(); const realV = SP.variantFor; SP.variantFor = id => { const o = realV(id); ids.set(o, id); return o; };
  AS.get = (kit, variant, ...r) => { if (ids.get(variant) === pl.id) calls.push({ gk: !!kit.gk, style: variant.style, hair: variant.hair, skin: variant.skin }); return realG(kit, variant, ...r); };
  try { v.renderer.render(sc, { sinceCut: 5 }); const sc2 = Object.assign({}, sc, { players: sc.players.map(p => p.id === pl.id? Object.assign({}, p, { role: 'GK' }) : (p.teamId === pl.teamId && p.role === 'GK'? Object.assign({}, p, { sentOff: true }) : p)) }); v.renderer.render(sc2, { sinceCut: 5 }); }
  finally { AS.get = realG; SP.variantFor = realV; }
  return { found: true, own: MD.hashString('style' + pl.id) % 3, calls };
};

const KNOWN_KINDS = ['head missing from the painting', 'far less hair than the hairstyle has in this direction', 'far more hair than the hairstyle has in this direction', 'facing the camera, no face shown', 'facing away, a face shown'];
// the cells where the painting differs from its hairstyle's norm (not a colouring fault: a matter for the art)
function shapeFlags(sheet){
  const by = {}; const cells = sheet.cells.map(c => { const [spr, kind, pose, frame, hs, dir] = c[0].split('|'); return { key: c[0], spr: +spr, kind, pose, frame: +frame, hs: +hs, dir, area: c[1], level: c[2], faceSkin: c[6], faceEyes: c[7], headPaint: c[8], facing: c[9] }; });
  for (const c of cells){ const k = c.spr + '|' + c.kind + '|' + c.hs + '|' + c.dir; (by[k] = by[k] || []).push(c.area); }
  const med = {}; for (const k of Object.keys(by)){ const a = by[k].slice().sort((x, y) => x - y); med[k] = a[Math.floor(a.length/2)]; }
  const flags = {};
  for (const c of cells){ const m = med[c.spr + '|' + c.kind + '|' + c.hs + '|' + c.dir]; const f = (c.spr/24)*(c.spr/24); const list = [];
    if (c.headPaint < 60*f) list.push(KNOWN_KINDS[0]);
    else { if (c.area < 0.55*m) list.push(KNOWN_KINDS[1]); if (c.area > 1.45*m) list.push(KNOWN_KINDS[2]);
      if (c.facing >= 0.85 && c.faceSkin < Math.max(2, Math.round(6*f))) list.push(KNOWN_KINDS[3]); if (c.facing <= -0.85 && c.faceSkin >= Math.max(4, Math.round(16*f)) && c.faceEyes >= 1) list.push(KNOWN_KINDS[4]); }
    if (list.length) flags[c.key] = list; }
  return flags;
}

(async () => {
  let bad = 0; const report = {}; const server = await serve(SITE); const URL = `http://127.0.0.1:${server.address().port}/`; const browser = await chromium.launch();
  const say = (ok, text) => { console.log((ok? 'ok   ' : 'FAIL ') + text); if (!ok) bad++; };
  // part 1
  const first = await openMatch(browser, URL, null, 'Hair'); const sheet = await first.page.evaluate(SHEETS); const standin = await first.page.evaluate(STANDIN); await first.ctx.close(); report.sheet = sheet; report.standin = standin;
  const T = { cells: 0, missing: 0, notPainted: 0, noRow: 0, sameAsStyle0: 0, blackHair: 0, blackHairCells: 0, band: 0, bandCells: 0, stray: 0, strayCells: 0, patches: 0, patchCells: 0, offLevel: 0, hairPixels: 0, eyesOnFaces: 0, facesShown: 0, facesNoMark: 0 };
  for (const s of sheet.scales){ const t = sheet.totals[s]; for (const k of Object.keys(T)) T[k] += t[k];
    console.log(`     size ${s}: ${t.cells} cells | hair on heads ${t.hairPixels} px | black in the hair ${t.blackHair + t.band} px in ${new Set(sheet.fails.filter(f => f[0].split('|')[0] == s && /black/.test(f[1])).map(f => f[0])).size} cells | hair colour off the head ${t.stray} px in ${t.strayCells} cells | patches in hair ${t.patches} px | off level ${t.offLevel} | faces shown from the front ${t.facesShown}, eye and mouth marks on them ${t.eyesOnFaces}, without a mark ${t.facesNoMark}`); }
  report.totals = T;
  say(first.errors.length === 0, 'no page errors' + (first.errors.length? ': ' + first.errors.slice(0, 2).join(' / ') : ''));
  say(sheet.scales.length === 3 && T.cells === 5568, `every cell asked of the game: ${T.cells} pictures at sizes ${sheet.scales.join(', ')} (5,568 expected)`);
  for (const s of sheet.scales) if (sheet.quick[s] !== 'ready') say(false, 'the quick recolouring is not in use at size ' + s + ' (' + sheet.quick[s] + '), so this is not the path a match draws by');
  say(T.missing === 0, `a picture for every cell (${T.missing} missing)`);
  say(T.notPainted === 0, `every picture is its painted cell, none falls back to the generated figure (${T.notPainted} do)`);
  say(T.noRow === 0 && T.sameAsStyle0 === 0, `every hairstyle has its own pictures, none falls back to hairstyle 0 (${T.noRow} without a row, ${T.sameAsStyle0} identical to hairstyle 0)`);
  say(T.blackHair === 0 && T.band === 0, `no hair drawn black: ${T.blackHair} px in boot black in ${T.blackHairCells} cells, ${T.band} px of dark band in ${T.bandCells} cells`);
  say(T.stray === 0, `no hair colour away from the head: ${T.stray} px in ${T.strayCells} cells`);
  say(T.patches === 0, `no patch of another material inside the hair: ${T.patches} px in ${T.patchCells} cells`);
  say(T.offLevel === 0, `every head of hair on the common lightness level (${T.offLevel} are not)`);
  if (bad && sheet.fails.length){ const kinds = {}; for (const f of sheet.fails){ const k = f[1].replace(/\(average tone .*\)/, ''); (kinds[k] = kinds[k] || []).push(f[0]); } for (const k of Object.keys(kinds)) console.log('       ' + kinds[k].length + ' cells: ' + k + ', e.g. ' + kinds[k].slice(0, 5).join('  ')); }
  // the shape list
  const flags = shapeFlags(sheet); report.shape = flags; const counts = {}; for (const k of Object.keys(flags)) for (const w of flags[k]) counts[w] = (counts[w] || 0) + 1;
  console.log('     cells where the painting differs from its hairstyle\'s norm: ' + Object.keys(flags).length + ' (' + KNOWN_KINDS.map(k => (counts[k] || 0) + ' ' + k).join('; ') + ')');
  if (RECORD){ fs.mkdirSync(path.dirname(KNOWN_FILE), { recursive: true }); fs.writeFileSync(KNOWN_FILE, JSON.stringify({ note: 'Cells whose painting differs from its hairstyle\'s norm, as recorded for release 1.7.1 by tools/hair-audit.js --record. Not colouring faults: matters for the art. The audit fails on any cell not listed here.', kinds: KNOWN_KINDS, cells: Object.keys(flags).sort().map(k => [k, flags[k].map(w => KNOWN_KINDS.indexOf(w))]) })); console.log('     recorded to ' + path.relative(process.cwd(), KNOWN_FILE)); }
  else if (fs.existsSync(KNOWN_FILE)){ const known = JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')); const K = {}; for (const [k, w] of known.cells) K[k] = new Set(w.map(i => known.kinds[i]));
    const fresh = []; for (const k of Object.keys(flags)) for (const w of flags[k]) if (!K[k] || !K[k].has(w)) fresh.push(k + ': ' + w); let gone = 0; for (const k of Object.keys(K)) for (const w of K[k]) if (!flags[k] || flags[k].indexOf(w) < 0) gone++;
    say(fresh.length === 0 || LENIENT, `no cell differs from its hairstyle's norm that is not on the recorded list (${fresh.length} new, ${gone} of the ${known.cells.length} recorded no longer differ)` + (fresh.length? ': ' + fresh.slice(0, 6).join(' | ') : '')); report.shapeNew = fresh; }
  else say(LENIENT, 'no recorded list of known cells (tools/reference/hair-shape-known.json): run with --record');
  // the known limitation
  if (standin.found){ const out = standin.calls[0], ing = standin.calls[standin.calls.length - 1];
    console.log(`     known limitation, shown directly: an outfield player with hairstyle ${standin.own} is drawn with hairstyle ${out.gk? 0 : out.style} from the players' sheet; put in goal he is drawn from the keepers' sheet, which has hairstyle 0 only (hair colour ${ing.hair === out.hair? 'kept' : 'CHANGED'}, skin ${ing.skin === out.skin? 'kept' : 'CHANGED'})`);
    say(!out.gk && out.style === standin.own && ing.gk && ing.hair === out.hair && ing.skin === out.skin, 'an outfield player in goal keeps his hair colour and skin; only the hairstyle becomes the keepers\' one'); }
  // part 2
  if (MATCHES > 0){ const M = { matches: 0, moments: 0, draws: 0, small: 0, refMissing: 0, use: {}, players: 0, wrongLook: 0, missing: 0, changes: 0, inGoal: 0, keeperStyle: 0, sentOff: 0, list: [] };
    for (let i = 0; i < MATCHES; i++){ const seed = 1991 + i*7919; const m = await openMatch(browser, URL, seed, 'Hair ' + (i + 1)); const r = await m.page.evaluate(FOLLOW); await m.ctx.close();
      M.matches++; M.moments += r.moments; M.draws += r.draws; M.small += r.small; M.refMissing += r.refMissing; for (const k of Object.keys(r.use)) M.use[k] = (M.use[k] || 0) + r.use[k]; M.players += r.players; M.wrongLook += r.wrongLook.length; M.missing += r.missing.length; M.changes += r.changes.length; M.inGoal += r.inGoal.length; M.keeperStyle += r.keeperStyle; M.sentOff += r.sentOff; if (m.errors.length) M.errors = (M.errors || 0) + m.errors.length;
      M.list.push({ seed, teams: r.teams, moments: r.moments, draws: r.draws, players: r.players, sentOff: r.sentOff, wrongLook: r.wrongLook.slice(0, 5), missing: r.missing.slice(0, 5), changes: r.changes, inGoal: r.inGoal }); }
    report.matches = M;
    console.log(`     ${M.matches} seeded matches, ${M.moments} moments drawn with the three cameras, ${M.draws} player pictures asked for, ${M.players} players followed, ${M.sentOff} sendings-off`);
    say(!M.errors, 'no page errors in the matches'); say(M.wrongLook === 0, `every picture asked for with the player's own skin, hair colour and hairstyle (${M.wrongLook} were not)`);
    say(M.missing === 0 && M.refMissing === 0, `a painted picture for every one asked for at a painted size, none falls back to the generated figure (${M.missing} missing for players, ${M.refMissing} for the referee` + (M.missing? ', e.g. ' + M.list.filter(x => x.missing.length).slice(0, 3).map(x => x.missing[0].slice(2).join(' ')).join(' | ') : '') + ')');
    console.log(`     by design, not a fault: the whole-pitch camera draws its figures smaller than the smallest painted sheet, so those ${M.small} pictures are the generated small figure`); say(M.changes === 0, `nobody's hairstyle changes during a match (${M.changes} do)`);
    { const painted = Object.values(M.use).reduce((a, b) => a + b, 0); const byKind = {}; let listed = 0; for (const k of Object.keys(M.use)) if (flags[k]){ listed += M.use[k]; for (const w of flags[k]) byKind[w] = (byKind[w] || 0) + M.use[k]; }
      M.listedDraws = { painted, cellsUsed: Object.keys(M.use).length, listed, byKind }; console.log(`     how often the listed cells are really drawn: of ${painted} painted pictures drawn in these matches (${Object.keys(M.use).length} different cells), ${listed} (${(100*listed/Math.max(1, painted)).toFixed(1)}%) were cells on the list: ` + KNOWN_KINDS.map(k => (byKind[k] || 0) + ' ' + k).join('; ')); }
    console.log(`     known limitation: ${M.keeperStyle} of the keepers followed have a hairstyle of their own that the keepers' sheet cannot show (they are drawn with hairstyle 0 all match); outfield players who went in goal in these matches: ${M.inGoal}`); }
  // against another build
  if (COMPARE){ const other = await serve(path.resolve(COMPARE)); const o = await openMatch(browser, `http://127.0.0.1:${other.address().port}/`, null, 'Hair'); const os = await o.page.evaluate(SHEETS); await o.ctx.close(); other.close();
    const A = {}; for (const c of os.cells) A[c[0]] = c; let n = 0, hairUp = 0, eyesLost = 0; const lostList = []; const t = { blackBefore: 0, strayBefore: 0, cellsBlack: 0, cellsStray: 0 };
    for (const c of sheet.cells){ const a = A[c[0]]; if (!a) continue; n++; t.blackBefore += a[10]; t.strayBefore += a[11]; if (a[10]) t.cellsBlack++; if (a[11]) t.cellsStray++; if (c[1] > a[1]) hairUp++; const sz = +c[0].split('|')[0]; if (a[9] >= 0.85 && a[7] > 0 && c[7] === 0 && c[6] >= Math.max(3, Math.round(10*(sz/24)*(sz/24)))){ eyesLost++; lostList.push(c[0]); } }
    const ot = { hair: 0, eyes: 0, faces: 0 }; for (const s of os.scales){ ot.hair += os.totals[s].hairPixels; ot.eyes += os.totals[s].eyesOnFaces; ot.faces += os.totals[s].facesShown; }
    console.log(`     against ${COMPARE}: ${n} cells in both. There: black in the hair ${t.blackBefore} px in ${t.cellsBlack} cells, hair colour off the head ${t.strayBefore} px in ${t.cellsStray} cells, hair on heads ${ot.hair} px, ${ot.faces} faces shown from the front with ${ot.eyes} eye and mouth marks. Here: hair on heads ${T.hairPixels} px, ${T.facesShown} faces with ${T.eyesOnFaces} marks; faces that had marks there and have none here: ${eyesLost}`);
    report.compare = { other: COMPARE, cells: n, there: Object.assign(t, ot, { fails: os.fails.length, totals: os.totals }), facesThatLostEveryMark: eyesLost, lostList }; }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(report));
  console.log(bad? `\n${bad} check(s) FAILED` : '\nthe hair audit passes');
  await browser.close(); server.close(); process.exit(bad && !LENIENT? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
