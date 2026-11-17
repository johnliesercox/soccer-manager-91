'use strict';
// Phase 3, the phone smoothness pass (after John's measurement of 17 November 2026: 49.9 frames a second on a Galaxy
// S23 Ultra, but one frame in thirty at 50 ms or more). The slow frames were frames that painted a ground tile, and
// frames that recoloured many player pictures at once. Both are now cheaper and spread out, and neither may change a
// pixel. This suite holds them to that without a browser:
//   A  a tile painted on its own (everything outside it left out) is the same as that part of the ground painted whole;
//   B  the ground painted a layer at a time is the ground painted in one go, and leaves nothing behind between layers;
//   C  a tile painted ahead in steps joins the cache only when whole, and is the tile painted on demand;
//   D  a player's picture made from the one-byte-a-pixel copy of its sheet is the picture made the old way;
//   E  the pictures of the opening and of a cut are made before the frames that show them;
//   F  on a slow clock the work ahead is spread over frames and the picture is still the same.
// (tools/tile-reference.js and tools/sprite-reference.js do A and D in a browser against the build before the change,
// for every tile at five scales and 61,248 pictures.)   Run: node test-smooth.js
const fs = require('fs');
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/canvas2d','renderers/pixelart','renderers/wireframe','renderers/iso-projection','iso-sprites','iso-assets','renderers/iso-pitch','renderers/iso-stadium','renderers/iso-camera','renderers/iso-actors','renderers/isometric']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const ISO = MD.iso, PR = ISO.projection, DIM = PR.DIM, AS = MD.isoAssets; const def = MD.renderers.isometric;
const { createCanvas, loadImage } = require('@napi-rs/canvas'); MD.sprites.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas); AS.setCanvasFactory(createCanvas);
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } else if (process.env.VERBOSE) console.log('ok  ', msg); };
const T = def.TILE, OUTSIDE = '#2B3036'; const same = (a, b) => { if (a.length!==b.length) return false; for (let i = 0; i < a.length; i++) if (a[i]!==b[i]) return false; return true; };
const px = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;

(async () => {
  // the sheets of the shipped styles, where the checkout has them (B: generated; E: the painted production set, which
  // takes its keepers, crowd and grass from B)
  const load = async (st, spr, from) => { const dir = './assets/matchday/isometric/'; const f = (s, n) => dir + s + '/' + n + '-' + spr + '.png'; if (!fs.existsSync(dir + st + '/players-' + spr + '.json')) return false;
    const m = JSON.parse(fs.readFileSync(dir + st + '/players-' + spr + '.json')); const got = async (n, alt) => fs.existsSync(f(st, n))? loadImage(f(st, n)) : (alt && fs.existsSync(f(alt, n)))? loadImage(f(alt, n)) : null;
    const parts = { img: await got('players'), patterns: await got('patterns'), keepers: await got('keepers', from), crowd: await got('crowd', from), grass: await got('grass', from), manifest: m };
    const ov = await got('overrides'), ovk = await got('overrides-keepers'); if (ov) parts.overrides = ov; if (ovk) parts.overridesKeepers = ovk;
    const pieces = {}; for (const n of ['left', 'right', 'near', 'dugout', 'cornerA', 'cornerB', 'cornerC', 'cornerD']){ const pj = dir + st + '/piece-' + n + '-' + spr + '.json'; if (fs.existsSync(pj)) pieces[n] = { image: await loadImage(pj.replace('.json', '.png')), meta: JSON.parse(fs.readFileSync(pj)) }; }
    const sj = dir + st + '/stand-' + spr + '.json'; if (fs.existsSync(sj)) pieces.far = { image: await loadImage(sj.replace('.json', '.png')), meta: JSON.parse(fs.readFileSync(sj)) };
    parts.pieces = pieces; if (!parts.img || !parts.keepers) return false; AS.register(st, spr, parts); return true; };
  const haveB = await load('B', 16), haveE = await load('E', 16, 'B'); await load('B', 12); await load('E', 12, 'B');

  // ---- A: a tile with everything outside it left out is the tile with nothing left out ----
  // (every tile of the whole stadium, painted both ways: ISO.pitch.culling(false) paints as the game did before, the
  // whole ground into each tile with the canvas left to throw away what falls outside)
  for (const [name, style, P] of [['generated art', 'none', 12], ['generated art', 'none', 16]].concat(haveB? [['style B sheets', 'B', 16]] : [], haveE? [['painted style E', 'E', 16], ['painted style E', 'E', 12]] : [])){
    AS.setStyle(style==='none'? 'zz' : style);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const X of [-34, DIM.L + 34]) for (const Y of [-34, DIM.W + 34]) for (const Z of [0, 22]){ const p = PR.project(X, Y, Z, { P, ox: 0, oy: 0 }); x0 = Math.min(x0, p.sx); x1 = Math.max(x1, p.sx); y0 = Math.min(y0, p.sy); y1 = Math.max(y1, p.sy); }
    const a = createCanvas(T, T), b = createCanvas(T, T); const actx = a.getContext('2d'), bctx = b.getContext('2d'); actx.imageSmoothingEnabled = false; bctx.imageSmoothingEnabled = false;
    for (const jump of [false, true]){
      let differ = 0, n = 0, crowdTiles = 0, plain = 0;
      for (let ty = Math.floor(y0/T); ty <= Math.floor(y1/T); ty++) for (let tx = Math.floor(x0/T); tx <= Math.floor(x1/T); tx++){
        const cam = { P, ox: -tx*T, oy: -ty*T }, clip = { x: 0, y: 0, w: T, h: T }, opts = { colours: ['#C8102E', '#1D5BA4'] };
        actx.fillStyle = OUTSIDE; actx.fillRect(0, 0, T, T); ISO.pitch.culling(false); const c1 = ISO.stadium.drawGround(actx, cam, 7, jump, clip, opts);
        bctx.fillStyle = OUTSIDE; bctx.fillRect(0, 0, T, T); ISO.pitch.culling(true); const c2 = ISO.stadium.drawGround(bctx, cam, 7, jump, clip, opts);
        const pa = px(a); n++; if (c2) crowdTiles++; if (!same(pa, px(b)) || !!c1!==!!c2) differ++; let flat = true; for (let i = 4; i < pa.length && flat; i += 4) if (pa[i]!==pa[0] || pa[i+1]!==pa[1] || pa[i+2]!==pa[2]) flat = false; if (flat) plain++;
      }
      ok(differ===0 && n - plain >= 40 && crowdTiles >= 8, 'A ' + name + ' at ' + P + ' px a metre, crowd ' + (jump? 'risen' : 'still') + ': each of ' + n + ' tiles painted with everything outside it left out is the tile painted with nothing left out (' + differ + ' differ; ' + crowdTiles + ' hold spectators, ' + plain + ' are empty concourse)');
    }
  }
  ok(ISO.pitch.clip()===null && ISO.pitch.culling()===true, 'A nothing is being left out once the painting is done');

  // ---- B: the ground a layer at a time ----
  { AS.setStyle(haveE? 'E' : 'zz'); const P = 16; let bad = 0, leaked = 0, most = 0, n = 0;
    for (const [tx, ty] of [[0, 0], [3, 1], [-2, 2], [5, 3], [1, 4], [-1, -1], [7, 2], [2, 6]]) for (const jump of [false, true]){
      const a = createCanvas(T, T), b = createCanvas(T, T); const actx = a.getContext('2d'), bctx = b.getContext('2d'); for (const c of [actx, bctx]){ c.imageSmoothingEnabled = false; c.fillStyle = OUTSIDE; c.fillRect(0, 0, T, T); }
      const cam = { P, ox: -tx*T + 700, oy: -ty*T + 300 }, clip = { x: 0, y: 0, w: T, h: T };
      const c1 = ISO.stadium.drawGround(actx, cam, 11, jump, clip, { colours: ['#F2C200', '#111111'] });
      const steps = ISO.stadium.groundSteps(bctx, cam, 11, jump, clip, { colours: ['#F2C200', '#111111'] }); let c2 = false; most = Math.max(most, steps.length);
      for (const st of steps){ c2 = st() || c2; if (ISO.pitch.clip()!==null) leaked++; ISO.pitch.poly(createCanvas(8, 8).getContext('2d'), { P: 4, ox: 0, oy: 0 }, [[0, 0], [1, 0], [1, 1]], '#fff'); }   // other drawing goes on between two steps
      n++; if (!same(px(a), px(b)) || !!c1!==!!c2) bad++;
    }
    ok(bad===0 && most >= 8, 'B ' + n + ' tiles painted a layer at a time (' + most + ' layers) are the tiles painted in one go, with other drawing between the layers (' + bad + ' differ)');
    ok(leaked===0, 'B between two layers nothing is being left out of other drawing');
  }

  // ---- C: a tile painted ahead in steps, in the cache ----
  { AS.setStyle('zz'); let now = 0; const w = def.buildWorld(createCanvas, 16, 5, ['#C8102E', '#1D5BA4'], 40), ref = def.buildWorld(createCanvas, 16, 5, ['#C8102E', '#1D5BA4'], 40);
    ok(w.start(2, 1, false)===true && w.building() && !w.has(2, 1), 'C a tile begun ahead is not in the cache while it is being painted');
    let calls = 0, got = null; while (!got && calls < 50){ calls++; got = w.advance(() => now, now); }   // a clock that has always run out: one layer a call
    ok(got && calls >= 8 && w.has(2, 1) && !w.building(), 'C it joins the cache when its last layer is on (' + calls + ' steps)');
    ok(same(px(got.cv), px(ref.get(2, 1, false).cv)) && got.crowd===ref.get(2, 1, false).crowd, 'C and is the tile painted on demand');
    ok(w.start(2, 1, false)===false, 'C a tile already painted is not begun again');
    w.start(-2, 0, false); w.advance(() => now, now); const mid = w.get(-2, 0, false);   // wanted on screen part-way through
    ok(!w.building() && same(px(mid.cv), px(ref.get(-2, 0, false).cv)), 'C a tile wanted on screen while it is being painted ahead is finished there and then, and is the same tile');
    ok(w.painted()===2 && ref.painted()===2, 'C each tile is counted once (' + w.painted() + ')');
    w.start(4, 4, false); w.advance(() => now, now); w.start(5, 4, false); ok(w.has(4, 4) && w.building(), 'C beginning another tile finishes the one in hand first');
    const whole = w.advance(); ok(whole && w.has(5, 4) && !w.building(), 'C with no clock a tile is finished at once');
  }

  // ---- D: pictures from the one-byte-a-pixel sheets ----
  { const kits = [{ primary: '#C8102E', secondary: '#FFFFFF', pattern: 'plain' }, { primary: '#111111', secondary: '#F2F2F2', pattern: 'stripes' }, { primary: '#1D5BA4', secondary: '#F2C200', pattern: 'hoops' }, { primary: '#7B1E3A', secondary: '#35B7E8', pattern: 'halves' },
      { primary: 'hsl(210,70%,40%)', secondary: 'hsl(40,90%,60%)', pattern: 'quarters' }, { primary: '#F2C200', secondary: '#1A1A1A', pattern: 'plain', gk: true }, { primary: '#1A1A1A', secondary: '#1A1A1A', pattern: 'plain', card: 'red' }];
    const looks = [{ skin: 0, hair: 0, style: 0 }, { skin: 3, hair: 4, style: 2 }];
    for (const [st, spr] of [['B', 16], ['B', 12], ['E', 16], ['E', 12]]){
      if (!AS.has(spr, st)) continue; AS.setStyle(st); AS.clear();
      const m = JSON.parse(fs.readFileSync('./assets/matchday/isometric/' + st + '/players-' + spr + '.json')); const cells = m.rows.map(r => [r[0], r[1]]), gcells = m.keepers.rows.map(r => [r[0], r[1]]);
      const sample = () => { const out = []; let i = 0; for (const kit of kits) for (const look of looks) for (const [pose, frame] of (kit.gk? gcells : cells)) for (const dir of m.dirs){ if (i++ % 13) continue; const cv = AS.get(kit, look, dir, pose, frame, spr); out.push(cv? { w: cv.width, h: cv.height, feet: cv.feet, spr: cv.spr, d: px(cv) } : null); } return out; };
      ok(AS.planeState(spr)==='not read', 'D ' + st + '/' + spr + ': before the sheets are read a picture is made the old way');
      const old = sample(); const b0 = AS.built(); AS.clear(); const read = await AS.prime(spr); ok(read===true && AS.planeState(spr)==='ready', 'D ' + st + '/' + spr + ': the sheets are read into their quick form (' + AS.planeState(spr) + ')');
      const quick = sample(); let differ = 0, n = 0; for (let i = 0; i < old.length; i++){ if (!old[i] && !quick[i]) continue; n++; if (!old[i] || !quick[i] || old[i].w!==quick[i].w || old[i].h!==quick[i].h || old[i].feet!==quick[i].feet || old[i].spr!==quick[i].spr || !same(old[i].d, quick[i].d)) differ++; }
      ok(differ===0 && n >= 300 && AS.built() - b0 === n, 'D ' + st + '/' + spr + ': ' + n + ' pictures (plain, stripes, hoops, halves, quarters, a keeper, the referee with a card; two looks) are the same pictures made from them (' + differ + ' differ)');
    }
    // a sheet that cannot be held at a byte a pixel keeps the old way: a half-clear pixel
    if (haveB){ const dir = './assets/matchday/isometric/B/'; const m = JSON.parse(fs.readFileSync(dir + 'players-16.json')); const [img, patterns, keepers] = await Promise.all(['players', 'patterns', 'keepers'].map(n => loadImage(dir + n + '-16.png')));
      const odd = createCanvas(img.width, img.height); const octx = odd.getContext('2d'); octx.drawImage(img, 0, 0); const cell = m.rows[0]; octx.clearRect(2, cell[3] + 2, 6, 6); octx.fillStyle = 'rgba(40,60,0,0.5)'; octx.fillRect(2, cell[3] + 2, 6, 6);
      AS.register('B', 16, { img: odd, patterns, keepers, manifest: m }); AS.setStyle('B'); const kit = { primary: '#C8102E', secondary: '#FFFFFF', pattern: 'plain' }; const before = px(AS.get(kit, { skin: 1, hair: 1, style: 0 }, m.dirs[0], cell[0], cell[1], 16));
      AS.clear(); const read = await AS.prime(16); const after = px(AS.get(kit, { skin: 1, hair: 1, style: 0 }, m.dirs[0], cell[0], cell[1], 16));
      ok(read===false && AS.planeState(16)==='old way' && same(before, after), 'D a sheet with a half-clear pixel keeps the old way, and its pictures are unchanged (' + AS.planeState(16) + ')');
      await load('B', 16); }
  }

  // ---- E and F: a mounted view ----
  const { JSDOM } = require('jsdom'); const dom = new JSDOM('<div id="s"></div>'); const doc = dom.window.document; const el = doc.getElementById('s'); let size = { w: 366, h: 411 }; let stage = null;
  Object.defineProperty(el, 'clientWidth', { get: () => size.w }); Object.defineProperty(el, 'clientHeight', { get: () => size.h }); globalThis.document = doc;
  const origCreate = doc.createElement.bind(doc); doc.createElement = tag => { if (tag==='canvas'){ const c = createCanvas(1, 1); c.style = {}; c.setAttribute = () => {}; c.addEventListener = () => {}; c.removeEventListener = () => {}; c.getBoundingClientRect = () => ({ left: 0, top: 0, width: size.w, height: size.h }); c.className = ''; return c; } return origCreate(tag); };
  el.appendChild = c => { stage = c; return c; };
  let clock = 5000, tick = 0; const realNow = globalThis.performance.now; globalThis.performance.now = () => (clock += tick);
  const st = E.newGame({ seed: 4242, userClub: 14 }); const res = E.advanceWeek(st); const HALF = MD.PERIODS.regulation.half;
  const pres = res.map(m => MD.withTimeline(MD.capture(st, m, st.lastWeekInfo))).find(p => p.events.filter(e => e.type===MD.EVENT.GOAL && e.matchSecond < HALF - 60).length >= 2);
  const sc = MD.createScene(pres); const allSegs = MD.createPlayback(pres, { onFrame(){}, onEvent(){}, onEnd(){} }).timeMap().segs; const segs = allSegs.filter(g => g.b <= HALF); const RATE = 2.8;
  const goalTimes = pres.events.filter(e => e.type===MD.EVENT.GOAL).map(e => e.matchSecond); const made = () => MD.isoSprites.cacheSize();
  const hash = () => { const d = stage.getContext('2d').getImageData(0, 0, stage.width, stage.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 97) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; };
  AS.setStyle('zz');

  // E: the opening. Without the warm-up the first strides make their pictures on the frames that show them.
  const opening = warmed => { MD.isoSprites.clear(); const r = def.create({ style: 'none' }); r.mount(el, pres); r.setCamera('close'); const g = segs.find(x => !x.ff); const seg = { a: g.a, b: g.b };
    r.render(sc.getSceneAt(g.a), { sinceCut: 0, segment: seg }); const before = made(); const n = warmed? r.warm(t => sc.getSceneAt(t), g.a, 3, seg) : 0; const inWarm = made() - before;
    let worst = 0, total = 0, since = 0; const shots = []; for (let t = g.a + RATE/60; t < g.a + 3; t += RATE/60){ clock += 1000/60; since += 1/60; const c0 = made(); r.render(sc.getSceneAt(t), { sinceCut: since, segment: seg }); const d = made() - c0; worst = Math.max(worst, d); total += d; shots.push(hash()); }
    r.dispose(); return { n, inWarm, worst, total, shots }; };
  { const cold = opening(false), warmed = opening(true);
    ok(cold.total >= 40 && warmed.n >= 50 && warmed.inWarm >= cold.total*0.6, 'E before the clock starts the pictures of the first three seconds are made (' + warmed.inWarm + ' over ' + warmed.n + ' moments; unprepared, those frames make ' + cold.total + ')');
    ok(warmed.total <= cold.total*0.25 && warmed.worst <= Math.max(3, cold.worst/3), 'E so the frames that show them make few (' + warmed.total + ' in all, ' + warmed.worst + ' at most in a frame; unprepared ' + cold.total + ' and ' + cold.worst + ')');
    ok(warmed.shots.length >= 50 && same(warmed.shots, cold.shots), 'E and the picture is the same either way (' + warmed.shots.length + ' frames)'); }

  // E: a cut. The view is told where the cut will land (MD.lookAhead) and makes the pictures the frames after it show.
  // F: the same match on a slow clock: every look at the clock costs 2 ms, so the frame's time for work ahead runs out
  // (each frame still starts on its sixtieth of a second, so the camera moves as it does on the fast clock).
  const play = (ahead, slow) => { MD.isoSprites.clear(); tick = 0; const r = def.create({ style: 'none' }); r.mount(el, pres); r.setCamera('close'); const look = MD.lookAhead(sc, goalTimes, () => allSegs);
    const out = { cutPictures: [], shots: [], aheadFrames: 0, partFrames: 0, tiles: 0 }; let prepFor = null, waveFor = null;
    const tell = (t, state) => { if (!ahead) return; const la = look(t, state); if (la.wave!==undefined && waveFor!==la.wave){ waveFor = la.wave; r.expectWave(); } if (la.target!==undefined && prepFor!==la.target){ prepFor = la.target; r.prepare(sc.getSceneAt(la.target), { segment: la.seg, sceneAt: tt => sc.getSceneAt(tt) }); } };
    let frameNo = 0; const frame = (t, hud) => { tick = 0; clock = 5000 + (++frameNo)*1000/60; const p0 = r.tilesPainted(), c0 = made(), busy = r.aheadCount() > 0; tick = slow? 2 : 0; r.render(sc.getSceneAt(t), hud); tick = 0; const d = r.tilesPainted() - p0; out.tiles += d; if (busy){ out.aheadFrames++; if (!d && r.aheadCount() > 0) out.partFrames++; } return made() - c0; };
    let done = 0; for (let i = 0; i < segs.length && done < 5; i++){ const g = segs[i];
      if (g.ff){ const n = Math.max(30, Math.round((g.b - g.a)/g.rate*60)); for (let k = 0; k < n; k++){ const t = Math.min(g.b - 0.001, g.a + k*RATE/60); frame(t, { sinceCut: 2 + k/60, fastForward: true }); tell(t, { segA: g.a, segB: g.b, segFF: true }); } continue; }
      let since = 0, first = 0, k = 0; for (let t = g.a; t < g.b; t += RATE/60, k++){ const d = frame(t, { sinceCut: since, segment: { a: g.a, b: g.b } }); tell(t, { segA: g.a, segB: g.b, segFF: false }); if (k < 4) first += d; since += 1/60; if (k===20 || k===70) out.shots.push(hash()); }
      if (done > 0) out.cutPictures.push(first); done++; }
    r.dispose(); return out; };
  { const plain = play(false, false), ahead = play(true, false), slow = play(true, true); const sum = a => a.reduce((x, y) => x + y, 0);
    ok(plain.cutPictures.length >= 3 && sum(plain.cutPictures) >= 30 && sum(ahead.cutPictures) <= sum(plain.cutPictures)*0.4, 'E the first frames after a cut make few pictures when the view was told of the cut (' + ahead.cutPictures.join(',') + ' over four frames each; unprepared ' + plain.cutPictures.join(',') + ')');
    ok(same(ahead.shots, plain.shots) && ahead.shots.length >= 8, 'E and the picture is the same with and without working ahead (' + ahead.shots.length + ' frames)');
    ok(slow.partFrames >= 10 && slow.partFrames > ahead.partFrames*2 && slow.tiles >= plain.tiles*0.8, 'F on a slow clock the work ahead is spread: ' + slow.partFrames + ' of ' + slow.aheadFrames + ' frames with work in hand ended with a tile still part-painted (' + ahead.partFrames + ' of ' + ahead.aheadFrames + ' on a fast one), and the ground still gets painted (' + slow.tiles + ' tiles; ' + plain.tiles + ' unprepared)');
    ok(same(slow.shots, plain.shots), 'F and the picture is the same on the slow clock (' + slow.shots.length + ' frames)'); }

  globalThis.performance.now = realNow;
  console.log(checks + ' checks, ' + fails + ' failures');
  if (fails){ console.log('SMOOTHNESS TESTS FAILED'); process.exit(1); }
  console.log('ALL SMOOTHNESS TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
