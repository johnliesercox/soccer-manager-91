'use strict';
// Phase 3, Milestone 4: selecting a player by touch (A04 at every zoom, D05, brief 8.4) and the picture when nothing is
// playing (D09: a phone turned while paused, a tap while paused, the cut that Skip ends on). The pure part asks the
// renderer's own pick() about frames drawn at every camera scale and stage size; the second part drives a mounted
// renderer through a minimal DOM with a clock the test controls.
// Run: node test-touch.js
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/canvas2d','renderers/pixelart','renderers/wireframe','renderers/iso-projection','iso-sprites','iso-assets','renderers/iso-pitch','renderers/iso-stadium','renderers/iso-camera','renderers/iso-actors','renderers/isometric']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const ISO = MD.iso; const def = MD.renderers.isometric; const EV = MD.EVENT;
const { createCanvas } = require('@napi-rs/canvas');
MD.sprites.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas);
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const st = E.newGame({ seed: 4242, userClub: 14 }); const res = E.advanceWeek(st);
const pres = res.slice(0, 3).map(m => MD.withTimeline(MD.capture(st, m, st.lastWeekInfo)));
const scenes = pres.map(p => MD.createScene(p));
const body = b => ({ x: b.x + b.w/2, y: b.y + b.h*0.6 });   // where a figure's body is in its box (pick() measures to the same point)
const players = items => items.filter(it => it.kind==='player' && it.box);
const gap = (a, b) => Math.hypot(Math.max(a.x - (b.x + b.w), 0, b.x - (a.x + a.w)), Math.max(a.y - (b.y + b.h), 0, b.y - (a.y + a.h)));   // between two boxes

// ---- 1. pick(): which player a tap means, at every camera scale on the stage sizes of the five viewport presets ----
{
  const T = def.TOUCH_SLOP, M = def.POINTER_SLOP;
  ok(typeof def.pick==='function' && T >= 12 && M <= 6 && M < T, 'D05 the renderer exposes pick(), with a wider reach for a fingertip ('+T+' px) than for a pointer ('+M+' px)');
  const VIEWS = [
    { name: 'phone 336x396 close',    w: 336,  h: 396, mode: 'follow', P: 16 }, { name: 'phone 336x396 follow', w: 336, h: 396, mode: 'follow', P: 12 }, { name: 'phone 336x396 whole', w: 336, h: 396, mode: 'whole' },
    { name: 'phone 366x411 close',    w: 366,  h: 411, mode: 'follow', P: 16 }, { name: 'phone 366x411 whole',  w: 366, h: 411, mode: 'whole' },
    { name: 'landscape 820x203 close', w: 820, h: 203, mode: 'follow', P: 24 }, { name: 'landscape 820x203 whole', w: 820, h: 203, mode: 'whole' },
    { name: 'desktop 904x619 close',  w: 904,  h: 619, mode: 'follow', P: 24 }, { name: 'desktop 904x619 follow', w: 904, h: 619, mode: 'follow', P: 16 }, { name: 'desktop 904x619 whole', w: 904, h: 619, mode: 'whole' },
    { name: 'desktop 1164x756 whole', w: 1164, h: 756, mode: 'whole' },
  ];
  let overlapsOnPhoneWhole = 0;
  for (const V of VIEWS){
    const cv = createCanvas(V.w, V.h); const ctx = cv.getContext('2d');
    let seen = 0, own = 0, reach = 0, reachOk = 0, pointerMiss = 0, beyond = 0, beyondOk = 0, grass = 0, grassOk = 0, others = 0, othersOk = 0, overlaps = 0;
    for (let m = 0; m < 2; m++) for (const t of [5, 240, 900, 1810, 2700, 4100]){
      const state = { anim: {} }; let frame = null;
      for (let k = 0; k < 3; k++) frame = def.drawFrame(ctx, V.w, V.h, scenes[m].getSceneAt(t + k/30), { teams: pres[m].teams, seed: pres[m].seed, state, dtReal: 1/30, nowMs: (t + k/30)*1000, cameraMode: V.mode, followP: V.P });   // a few frames, so the camera has moved (a pan must not matter)
      const ps = players(frame.items).filter(it => it.box.x >= 0 && it.box.y >= 0 && it.box.x + it.box.w <= V.w && it.box.y + it.box.h <= V.h);
      for (const it of ps){
        const c = body(it.box); seen++;
        // a tap on the body selects that figure, however many others overlap it (two bodies on the same spot: either)
        const got = def.pick(frame.items, c.x, c.y, 0); const gotIt = got && frame.items.find(x => x.kind==='player' && x.pl===got);
        if (got===it.pl || (gotIt && Math.hypot(body(gotIt.box).x - c.x, body(gotIt.box).y - c.y) <= 1)) own++;
        if (ps.some(o => o!==it && gap(o.box, it.box)===0)) overlaps++;
        // a figure with nobody near it: a fingertip just outside its box still selects it, a pointer does not, and neither does a tap well clear
        if (!ps.some(o => o!==it && gap(o.box, it.box) < 3*T) && it.box.x - T - 3 >= 0){
          reach++; if (def.pick(frame.items, it.box.x - (T - 1), c.y, T)===it.pl) reachOk++;
          if (def.pick(frame.items, it.box.x - (T - 1), c.y, M)===null) pointerMiss++;
          beyond++; if (def.pick(frame.items, it.box.x - (T + 2), c.y, T)===null) beyondOk++;
        }
      }
      // open grass well away from every figure selects nobody
      for (const [gx, gy] of [[8, 8], [V.w - 8, 8], [8, V.h - 8], [V.w - 8, V.h - 8], [V.w/2, 8]]) if (!players(frame.items).some(it => gap({ x: gx, y: gy, w: 0, h: 0 }, it.box) <= T)){ grass++; if (def.pick(frame.items, gx, gy, T)===null) grassOk++; }
      // the referee, the ball and the goals are never selected
      for (const it of frame.items.filter(x => x.kind!=='player' && x.box)) if (!players(frame.items).some(p => gap(p.box, it.box) <= T)){ others++; if (def.pick(frame.items, it.box.x + it.box.w/2, it.box.y + it.box.h/2, T)===null) othersOk++; }
    }
    ok(seen > 8 && own===seen, 'A04/D05 '+V.name+': a tap on the body of a drawn figure selects it ('+own+' of '+seen+', '+overlaps+' of them overlapped by another)');
    ok(reachOk===reach && pointerMiss===reach && beyondOk===beyond, 'D05 '+V.name+': a fingertip just outside a lone figure selects it, a pointer there and a tap well clear do not ('+reachOk+'/'+reach+', '+pointerMiss+'/'+reach+', '+beyondOk+'/'+beyond+')');
    ok(grassOk===grass && othersOk===others, 'D05 '+V.name+': open grass, the referee and the goals select nobody ('+grassOk+'/'+grass+', '+othersOk+'/'+others+')');
    if (/phone .* whole/.test(V.name)) overlapsOnPhoneWhole += overlaps;
  }
  ok(overlapsOnPhoneWhole > 50, 'D05 the whole-pitch view on a phone is the hard case and was exercised ('+overlapsOnPhoneWhole+' overlapped figures told apart)');
  // of two figures drawn over one another, the one tapped on wins, not simply the one in front
  { const mk = (id, x, y) => ({ kind: 'player', pl: { id }, box: { x, y, w: 20, h: 22 } }); const items = [mk('behind', 100, 100), mk('front', 108, 104)];
    ok(def.pick(items, 106, 109, 14).id==='behind' && def.pick(items, 122, 119, 14).id==='front', 'D05 of two overlapping figures the one whose body is tapped wins');
    ok(def.pick(items, 114, 115.2, 14).id==='front', 'D05 a dead heat between two bodies goes to the nearer figure (drawn later)'); }
}

// ---- 2. a mounted renderer, with a clock the test controls ----
(async () => {
  const { JSDOM } = require('jsdom'); const dom = new JSDOM('<div id="s"></div>'); const doc = dom.window.document; const el = doc.getElementById('s');
  let size = { w: 366, h: 411 };
  Object.defineProperty(el, 'clientWidth', { get: () => size.w }); Object.defineProperty(el, 'clientHeight', { get: () => size.h });
  const realDoc = globalThis.document; globalThis.document = doc;
  const handlers = {}; let canvas = null;
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = tag => { if (tag==='canvas'){ const c = createCanvas(1, 1); c.style = {}; c.setAttribute = () => {}; c.addEventListener = (t, fn) => { handlers[t] = fn; }; c.removeEventListener = t => { delete handlers[t]; }; c.getBoundingClientRect = () => ({ left: 0, top: 0, width: size.w, height: size.h }); c.className = ''; c.parentNode = null; return c; } return origCreate(tag); };   // (the renderer makes other canvases too: its ground tiles)
  el.appendChild = c => { canvas = c; c.parentNode = { removeChild: () => { c.parentNode = null; } }; return c; };   // the stage canvas is the one put in the stage
  let clock = 5000; const realNow = globalThis.performance.now; globalThis.performance.now = () => clock;
  const picked = []; const r = def.create({ style: 'none', onSelect: pl => picked.push(pl) });
  const sc = scenes[0], hud = extra => Object.assign({ fastForward: false, speed: 1, reducedMotion: false }, extra);
  // the picture: how many different colours a grid of samples finds, and whether it is all black
  const look = () => { const ctx = canvas.getContext('2d'); const seen = new Set(); let dark = 0, n = 0; for (let gy = 0; gy < 10; gy++) for (let gx = 0; gx < 12; gx++){ const d = ctx.getImageData(Math.floor((gx + 0.5)*canvas.width/12), Math.floor((gy + 0.5)*canvas.height/10), 1, 1).data; n++; if (d[3]===0 || d[0] + d[1] + d[2] < 12) dark++; seen.add(d[0] + ',' + d[1] + ',' + d[2] + ',' + d[3]); } return { colours: seen.size, dark: dark/n }; };
  let lastT = 0; const loop = (from, frames, since) => { for (let i = 0; i < frames; i++){ clock += 1000/60; lastT = from + i/60; r.render(sc.getSceneAt(lastT), hud({ sinceCut: since + i/60 })); } };
  const lone = () => { const ps = players(r.lastFrame().items).filter(it => it.box.x > 30 && it.box.y > 30 && it.box.x + it.box.w < canvas.width - 30 && it.box.y + it.box.h < canvas.height - 30); return ps.find(it => !ps.some(o => o!==it && gap(o.box, it.box) < 45)); };
  const tap = (x, y, type) => handlers.click({ clientX: x, clientY: y, pointerType: type });
  try {
    r.mount(el, pres[0]);
    // a moment of open play with the camera on the move, then Pause (the loop simply stops calling)
    let t0 = 240; loop(t0, 40, 2); let L = lone(); for (let tries = 0; !L && tries < 30; tries++){ t0 += 30; loop(t0, 40, 2); L = lone(); }
    ok(!!L, 'a lone figure is in the paused picture to tap');
    const moving = r.lastFrame().cam; clock += 2000;

    // D05 a fingertip ten pixels outside the figure selects it; nothing moves under the finger
    const texts = []; const ctx = canvas.getContext('2d'); const realText = ctx.fillText.bind(ctx); ctx.fillText = (s, x, y) => { texts.push(String(s)); return realText(s, x, y); };
    tap(L.box.x - 10, body(L.box).y, 'touch');
    ok(picked.length===1 && picked[0].id===L.pl.id, 'D05 a touch ten pixels outside a figure selects it');
    ok(texts.some(s => s.indexOf(L.pl.name) >= 0 && s.indexOf(String(L.pl.shirtNo)) >= 0 && s.indexOf(L.pl.role) >= 0), '8.4 the tag over the selected player carries name, number and role ('+(texts.find(s => s.indexOf(L.pl.name) >= 0)||'none')+')');
    for (let i = 0; i < 12; i++){ clock += 150; tap(8, 8, 'touch'); tap(L.box.x + 3, body(L.box).y, 'touch'); }
    const held = r.lastFrame().cam; ok(held.ox===moving.ox && held.oy===moving.oy && held.P===moving.P, 'D05 taps while paused do not move the picture (camera '+moving.ox+','+moving.oy+' before, '+held.ox+','+held.oy+' after 24 taps)');
    ok(r.lastFrame().fading===false && look().colours > 4, 'D05 the picture after a paused tap is complete');
    // a pointer is held to a tighter reach, and a tap on open grass clears the selection
    const n0 = picked.length; tap(L.box.x - 10, body(L.box).y, 'mouse'); ok(picked.length===n0, 'D05 a mouse click ten pixels outside a figure selects nobody');
    tap(L.box.x - 3, body(L.box).y, 'mouse'); ok(picked.length===n0 + 1 && picked[n0].id===L.pl.id, 'D05 a mouse click three pixels outside it selects it');
    // with no pointer type on the event (older browsers), the device's own pointer decides
    globalThis.matchMedia = q => ({ matches: /coarse/.test(q) }); const n1 = picked.length; handlers.click({ clientX: L.box.x - 10, clientY: body(L.box).y }); ok(picked.length===n1 + 1, 'D05 a click without a pointer type on a touch device gets the fingertip reach'); delete globalThis.matchMedia;

    // a tap straight after Pause (the loop's last frame was a moment ago): the tap does not step the camera on, and the
    // tag is drawn once it is certain that no frame is coming
    { loop(t0 + 0.7, 30, 2.7); const c0 = r.lastFrame().cam; const P2 = players(r.lastFrame().items).find(it => it.box.x > 10 && it.box.y > 20 && it.box.x + it.box.w < canvas.width - 10 && it.box.y + it.box.h < canvas.height - 10);
      clock += 50; texts.length = 0; const n2 = picked.length; tap(body(P2.box).x, body(P2.box).y, 'touch');
      ok(picked.length===n2 + 1 && r.lastFrame().cam.ox===c0.ox && r.lastFrame().cam.oy===c0.oy, 'D05 a tap straight after Pause selects without stepping the camera');
      clock += 400; await sleep(420); const c1 = r.lastFrame().cam;
      ok(c1.ox===c0.ox && c1.oy===c0.oy && r.lastFrame().fading===false && texts.some(s => s.indexOf(picked[n2].name) >= 0), 'D05 and the tag is then drawn on a still frame, the camera where it was ('+c0.ox+','+c0.oy+' and '+c1.ox+','+c1.oy+')'); }

    // D09 the phone is turned while paused: the stage is drawn again at once, at the new size, complete
    clock += 1000; size = { w: 820, h: 203 }; r.resize();
    let v = look(); ok(canvas.width===820 && canvas.height===203 && v.colours >= 2 && v.dark < 0.5 && r.lastFrame().fading===false, 'D09 turned while paused: the stage is painted at 820x203 ('+v.colours+' colours)');
    clock += 1000; size = { w: 366, h: 411 }; r.resize();
    v = look(); ok(canvas.width===366 && canvas.height===411 && v.colours >= 2 && v.dark < 0.5, 'D09 turned back while paused: painted at 366x411 ('+v.colours+' colours)');
    const seenPlay = sc.getSceneAt(lastT).ball; const fr = r.lastFrame(); const PRJ = ISO.projection; const bm = PRJ.toMetres(seenPlay.x, seenPlay.y); const bp = PRJ.project(bm.X, bm.Y, 0, fr.cam);
    ok(bp.sx > 0 && bp.sx < 366 && bp.sy > 0 && bp.sy < 411, 'D09 after the turn the camera is still on the same play (the ball is in the picture)');

    // D09 turned while playing: the loop carries on and the next frames are painted at the new size
    loop(t0 + 1, 5, 3); size = { w: 820, h: 203 }; r.resize(); loop(t0 + 1.1, 5, 3.1); v = look(); ok(canvas.width===820 && v.colours >= 2 && v.dark < 0.5, 'D09 turned while playing: painted at the new size');
    size = { w: 366, h: 411 }; r.resize(); loop(t0 + 1.2, 5, 3.2);

    // a cut is drawn dipped to black and fades in over the next frames; while they keep coming nothing interferes
    clock += 1000; r.render(sc.getSceneAt(t0 + 60), hud({ sinceCut: 0 }));
    ok(r.lastFrame().fading===true && look().dark > 0.95, 'the first frame of a cut is black (the fade starts from it)');
    for (let i = 0; i < 4; i++){ await sleep(100); clock += 100; r.render(sc.getSceneAt(t0 + 60 + (i + 1)*0.1), hud({ sinceCut: (i + 1)*0.05 })); }
    ok(r.lastFrame().fading===true, 'while frames keep coming the fade is left alone (no flash of a full frame part-way through)');
    // D09 the cut that Skip ends the match on: one frame, then nothing. The picture must not stay black.
    clock += 1000; r.render(sc.getSceneAt(5399), hud({ sinceCut: 0 })); ok(look().dark > 0.95, 'Skip: the last frame arrives on a cut, black');
    clock += 500; await sleep(450);
    v = look(); ok(r.lastFrame().fading===false && v.colours >= 2 && v.dark < 0.5, 'D09 full time after Skip: the final scene is shown, not a black stage ('+v.colours+' colours)');
    // turned at full time; a camera change at full time
    clock += 1000; size = { w: 820, h: 203 }; r.resize(); v = look(); ok(v.colours >= 2 && v.dark < 0.5, 'D09 turned at full time: painted');
    r.setCamera('whole'); v = look(); ok(r.lastFrame().cam.mode==='whole' && v.colours > 4 && r.lastFrame().fading===false, 'D09 a camera change at full time is drawn complete');
    r.setCamera('follow'); size = { w: 366, h: 411 }; r.resize();
    // during a fast-forward (the loop is running, the banner is up)
    loop(t0 + 2, 3, 2); r.render(sc.getSceneAt(t0 + 2.1), hud({ sinceCut: 2, fastForward: true })); size = { w: 820, h: 203 }; r.resize(); v = look(); ok(canvas.width===820 && v.colours >= 2 && v.dark < 0.5, 'D09 turned during a fast-forward: painted');
    ok(r.lastFrame().cam && isFinite(r.lastFrame().cam.ox), 'the camera is sound after every turn');
    r.dispose(); ok(!handlers.click, 'dispose removes the tap handler');
    await sleep(400);   // a pending settle would throw here on a disposed renderer if it were not cancelled
  } catch (e){ ok(false, 'the mounted-renderer checks threw: '+(e && e.stack || e)); }
  globalThis.performance.now = realNow; globalThis.document = realDoc;

  // ---- 3. reduced motion stills the generated crowd as well as the painted one (brief 9) ----
  {
    const goal = pres.map((p, i) => ({ i, e: p.events.find(x => x.type===EV.GOAL) })).find(x => x.e);
    if (goal){
      const w = 366, h = 411; const cv = createCanvas(w, h); const ctx = cv.getContext('2d'); const real = ISO.stadium.drawGround; const ups = { on: 0, off: 0 };
      ISO.stadium.drawGround = function(c, cam, seed, crowdUp){ if (crowdUp) ups[ISO.stadium._rm? 'on' : 'off']++; return real.apply(this, arguments); };
      for (const rm of [false, true]){ ISO.stadium._rm = rm; const state = { anim: {} }; for (let k = 0; k < 150; k++){ const t = goal.e.matchSecond + k/30; def.drawFrame(ctx, w, h, scenes[goal.i].getSceneAt(t), { teams: pres[goal.i].teams, seed: pres[goal.i].seed, state, dtReal: 1/30, nowMs: t*1000, cameraMode: 'follow', followP: 12, reducedMotion: rm, snap: rm }); } }
      ISO.stadium.drawGround = real; delete ISO.stadium._rm;
      ok(ups.off > 5 && ups.on===0, 'D06 the generated crowd jumps for a goal ('+ups.off+' frames) and holds still under reduced motion ('+ups.on+')');
    } else ok(false, 'no goal in the three test matches to check the crowd with');
  }

  console.log(checks+' checks, '+fails+' failures');
  if (fails){ console.log('TOUCH TESTS FAILED'); process.exit(1); }
  console.log('ALL TOUCH TESTS PASSED');
})();
