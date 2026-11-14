'use strict';
// Phase 3 acceptance tests for the isometric renderer (Milestone 1 scope: geometry, projection,
// headings, the renderer contract, headless drawing, depth order and state integrity).
// Run: node test-isometric.js
const fs = require('fs');
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/canvas2d','renderers/pixelart','renderers/wireframe','renderers/iso-projection','iso-sprites','iso-assets','renderers/iso-pitch','renderers/iso-stadium','renderers/iso-camera','renderers/iso-actors','renderers/isometric']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const ISO = MD.iso; const PR = ISO.projection; const DIM = PR.DIM;
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } };
const near = (a, b, tol) => Math.abs(a - b) <= (tol===undefined? 1e-6 : tol);

// ---- A. geometry / projection ----
const cam = { P: 16, ox: 500, oy: 300 };
// A01 deterministic
{ const a = PR.project(30.5, 12.25, 1.1, cam), b = PR.project(30.5, 12.25, 1.1, cam); ok(a.sx===b.sx && a.sy===b.sy, 'A01 projection is deterministic'); }
// A02 metric mapping: centre, corners, penalty spots follow the 105:68 world
{
  const c = PR.project(DIM.L/2, DIM.W/2, 0, cam);
  ok(near(c.sx, cam.ox + cam.P*(DIM.L/2 - DIM.W/2)) && near(c.sy, cam.oy + cam.P*(DIM.L + DIM.W)/4), 'A02 centre spot lands where the formula says');
  const ne = PR.project(DIM.L, 0, 0, cam), sw = PR.project(0, DIM.W, 0, cam), o = PR.project(0, 0, 0, cam), far = PR.project(DIM.L, DIM.W, 0, cam);
  ok(ne.sx > o.sx && ne.sy > o.sy && sw.sx < o.sx && sw.sy > o.sy, 'A02 the length runs right-down and the width left-down');
  ok(near(far.sx - o.sx, cam.P*(DIM.L - DIM.W)) && near(far.sy - o.sy, cam.P*(DIM.L + DIM.W)/2), 'A02 opposite corners differ by (L-W, (L+W)/2) metres on screen');
  const s1 = PR.project(DIM.spot, DIM.W/2, 0, cam), s2 = PR.project(DIM.L - DIM.spot, DIM.W/2, 0, cam);
  ok(near(s2.sx - s1.sx, cam.P*(DIM.L - 2*DIM.spot)) && near(s2.sy - s1.sy, cam.P*(DIM.L - 2*DIM.spot)/2), 'A02 penalty spots are 83 m apart along the length');
  const m = PR.toMetres(0.5, 0.5); ok(near(m.X, 52.5) && near(m.Y, 34), 'A02 normalised scene coordinates convert to metres');
}
// A03 the centre circle projects to a 2:1 ellipse built from world samples, not a screen circle
{
  const pts = []; for (let i=0;i<360;i++){ const a = i/360*Math.PI*2; pts.push(PR.project(DIM.L/2 + DIM.circle*Math.cos(a), DIM.W/2 + DIM.circle*Math.sin(a), 0, cam)); }
  const xs = pts.map(p=>p.sx), ys = pts.map(p=>p.sy); const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  ok(near(w/h, 2, 0.02), 'A03 centre circle is a 2:1 ellipse on screen ('+(w/h).toFixed(3)+')');
  ok(near(w, 2*DIM.circle*Math.SQRT2*cam.P, 0.5), 'A03 ellipse width is 2r*sqrt(2)*P');
  const marks = ISO.pitch.markings; ok(marks.lines.length > 12 && marks.spots.length===3, 'A03 markings include boxes, arcs and three spots');
  // every marking point lies within the pitch rectangle, so nothing is drawn in screen space by guesswork
  ok(marks.lines.every(pl => pl.every(([X,Y]) => X >= -1e-6 && X <= DIM.L + 1e-6 && Y >= -1e-6 && Y <= DIM.W + 1e-6)), 'A03 markings stay on the pitch');
}
// A04/A05 inverse projection round trip
{
  let worst = 0;
  for (const P of [5.2, 12, 16]){ const c = { P, ox: 123.4, oy: 77.7 }; for (let i=0;i<500;i++){ const X = (i*37 % 1050)/10, Y = (i*53 % 680)/10; const p = PR.project(X, Y, 0, c); const q = PR.unproject(p.sx, p.sy, c); worst = Math.max(worst, Math.abs(q.X - X), Math.abs(q.Y - Y)); } }
  ok(worst < 1e-9, 'A05 world->screen->world round trip exact ('+worst.toExponential(1)+')');
  const c = { P: 12, ox: 0, oy: 0 }; const p = PR.project(10, 20, 0, c); const q = PR.unproject(p.sx + 6, p.sy, c); ok(near(q.X - 10, 0.25) && near(q.Y - 20, -0.25), 'A04 six pixels right at P=12 is half a metre along u');
}
// A06 feet anchor: every heading and pose puts the figure's lowest filled row at the anchor (or one above it)
{
  const SP = MD.isoSprites; let bad = 0;
  for (const spr of [12, 16]){ const { W, H, FEET } = SP.cell(spr); for (const dir of PR.DIRS) for (const [pose, frame] of [['idle',0],['run',0],['run',3],['walk',1],['set',0],['celebrate',0],['kick',1],['receive',0],['block',0],['booked',0]]){ const g = SP.gridFor(dir, pose, frame, spr); let low = -1; for (let y=H-1;y>=0 && low<0;y--) for (let x=0;x<W;x++) if (g[y*W+x] && g[y*W+x]!=='LINE'){ low = y; break; } if (Math.abs(low - FEET) > Math.max(2, spr*0.3)) bad++; } }   // a wide stance puts the near foot a little below the body's ground point
  ok(bad===0, 'A06 feet sit on the anchor row in every heading and grounded pose ('+bad+' off)');
}
// A08 ball shadow stays at the ground coordinate while the ball lifts
{
  const g = PR.project(40, 30, 0, cam), b = PR.project(40, 30, 2.0, cam);
  ok(g.sx===b.sx && near(g.sy - b.sy, 2.0*cam.P*PR.HEIGHT), 'A08 a two-metre ball rises 2P pixels straight up from its shadow');
}
// A09 goal order: the far goal's parts sort before the near goal's, and the near post after the far post
{
  const g0 = ISO.stadium.goalGeometry(0), g1 = ISO.stadium.goalGeometry(1);
  ok(g0.backDepth < g0.frontDepth && g1.backDepth < g1.frontDepth && g0.frontDepth < g1.backDepth, 'A09 goal parts sort back-to-front and the X=0 goal is behind the X=105 goal');
}
// B04 eight headings: a world facing that projects straight down is S; crossing 0/2pi is stable
{
  ok(PR.dir8(Math.PI/4)==='S' && PR.dir8(Math.PI/4 + Math.PI)==='N', 'B04 the pitch diagonal faces the viewer and its opposite faces away');
  ok(PR.dir8(0)==='SE' || PR.dir8(0)==='E', 'B04 facing down the length is E/SE on screen ('+PR.dir8(0)+')');
  ok(PR.dir8(-0.001)===PR.dir8(2*Math.PI - 0.001) && PR.dir8(0.001)===PR.dir8(2*Math.PI + 0.001), 'B04 wrapping round 2pi gives the same heading');
  // sweeping the facing through a full turn visits all eight headings in order, each once per turn
  const seen = []; for (let i=0;i<=720;i++){ const d = PR.dir8(i/720*Math.PI*2); if (seen[seen.length-1]!==d) seen.push(d); }
  const uniq = new Set(seen.slice(0, -1)); ok(uniq.size===8 && seen.length<=9, 'B04 a full turn visits each heading once ('+seen.join(',')+')');
  // hysteresis holds the current heading just over a sector edge, and lets go further on
  const edge = (function(){ for (let a=0;a<Math.PI*2;a+=0.0005) if (PR.dir8(a)!==PR.dir8(a+0.0005)) return a+0.00025; })();
  const before = PR.dir8(edge - 0.01); ok(PR.dir8(edge + 0.05, before, 0.2)===before && PR.dir8(edge + 0.6, before, 0.2)!==before, 'B04 hysteresis holds across a sector edge and releases later');
}

// ---- real matches for the renderer checks ----
const { createCanvas } = require('@napi-rs/canvas');
MD.sprites.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas);
const st = E.newGame({ seed: 4242, userClub: 14 }); const before = JSON.stringify(st);
const res = E.advanceWeek(st); const after1 = JSON.stringify(st);
const pres = res.slice(0, 3).map(m => MD.withTimeline(MD.capture(st, m, st.lastWeekInfo)));
const scenes = pres.map(p => MD.createScene(p));
const def = MD.renderers.isometric;

// B01 lifecycle with a minimal DOM
{
  const { JSDOM } = require('jsdom'); const dom = new JSDOM('<div id="s" style="width:400px;height:300px"></div>');
  const win = dom.window; const doc = win.document; const el = doc.getElementById('s');
  Object.defineProperty(el, 'clientWidth', { value: 400 }); Object.defineProperty(el, 'clientHeight', { value: 300 });
  const realDoc = globalThis.document; globalThis.document = doc;
  // canvases from jsdom have no 2D context; substitute node canvases
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = tag => { if (tag==='canvas'){ const c = createCanvas(1, 1); c.style = {}; c.setAttribute = () => {}; c.addEventListener = () => {}; c.removeEventListener = () => {}; c.getBoundingClientRect = () => ({ left:0, top:0, width:400, height:300 }); c.className = ''; c.parentNode = null; return c; } return origCreate(tag); };
  el.appendChild = c => { c.parentNode = { removeChild: () => { c.parentNode = null; } }; return c; };
  const r = def.create({}); let threw = null;
  try { r.mount(el, pres[0]); r.render(scenes[0].getSceneAt(5), { fastForward:false, sinceCut: 1 }); r.resize(); r.setCamera('whole'); r.render(scenes[0].getSceneAt(6), {}); r.setCamera('follow'); r.dispose(); } catch(e){ threw = e; }
  ok(!threw, 'B01 create/mount/render/resize/setCamera/dispose run without error'+(threw? ': '+threw.message : ''));
  ok(r.id==='isometric' && def.name==='Isometric', 'B01 renderer id and name');
  globalThis.document = realDoc;
}
// B02 headless drawFrame on the same scenes as the other renderers; B03 every movement/action has a frame
{
  const w = 904, h = 619; const cv = createCanvas(w, h); const ctx = cv.getContext('2d');
  let drawn = 0, threw = null; const actions = new Set(), moves = new Set();
  for (const [i, sc] of scenes.entries()){
    const p = pres[i]; const world = def.buildWorld(createCanvas, 16, p.seed); const state = { anim: {}, cx: undefined };
    for (let t=0; t<sc.duration; t+=sc.duration/60){
      const s = sc.getSceneAt(t); s.players.forEach(pl => { actions.add(pl.action); moves.add(pl.movement); });
      try { def.drawFrame(ctx, w, h, s, { teams: p.teams, seed: p.seed, world, state, dtReal: 1/60, nowMs: t*1000, cameraMode:'follow', followP: 16, snap: t===0 }); drawn++; } catch(e){ threw = e; break; }
    }
    if (threw) break;
  }
  ok(!threw && drawn >= 180, 'B02 headless drawFrame over three matches ('+drawn+' frames)'+(threw? ': '+threw.message : ''));
  ok(actions.size >= 6 && moves.size >= 4, 'B03 the sample covered '+actions.size+' actions and '+moves.size+' movement bands, all drawn');
  // and the whole-pitch camera
  const sc = scenes[0]; const wp = MD.iso.projection.fit(w, h, DIM.runoff + 1.5).P; const world = def.buildWorld(createCanvas, wp, pres[0].seed);
  let t2 = null; try { def.drawFrame(ctx, w, h, sc.getSceneAt(100), { teams: pres[0].teams, seed: pres[0].seed, world, state: { anim:{} }, dtReal: 1/60, cameraMode:'whole', snap:true }); } catch(e){ t2 = e; }
  ok(!t2, 'B02 whole-pitch frame draws'+(t2? ': '+t2.message : ''));
}
// A07 depth order is stable: sorting the same scene twice gives the same order, and nearby players keep a fixed tie-break
{
  const sc = scenes[0]; const p = pres[0]; const st2 = { anim: {} }; const c = { P: 16, ox: 0, oy: 0, mode:'follow' };
  const a = ISO.actors.build(sc.getSceneAt(300), p.teams, st2, 0, c, 16).items.map(x=>x.key).join(',');
  const b = ISO.actors.build(sc.getSceneAt(300), p.teams, st2, 0, c, 16).items.map(x=>x.key).join(',');
  ok(a===b, 'A07 the same scene sorts the same way twice');
  // flicker = the same pair of players swapping draw order three or more times within a second
  const swaps = new Map(); let prev = null, crossings = 0;
  // (only pairs close enough for their sprites to overlap count: two men 17 m apart on the same depth diagonal may swap freely)
  for (let t=300; t<330; t+=1/30){ const items = ISO.actors.build(sc.getSceneAt(t), p.teams, st2, t*1000, c, 16).items.filter(x=>x.kind==='player'); const order = items.map(x=>x.key); const at = {}; for (const it of items) at[it.key] = it; if (prev){ for (let i=0;i<order.length;i++) for (let j=i+1;j<order.length;j++){ const a = order[i], b = order[j]; if (prev.indexOf(a) > prev.indexOf(b)){ const pa = at[a].pl, pb = at[b].pl; if (Math.hypot((pa.x-pb.x)*DIM.L, (pa.y-pb.y)*DIM.W) > 3) continue; const k = a<b? a+'|'+b : b+'|'+a; (swaps.get(k) || swaps.set(k, []).get(k)).push(t); crossings++; } } } prev = order; }
  let flicker = 0; for (const ts of swaps.values()){ for (let i=2;i<ts.length;i++) if (ts[i] - ts[i-2] < 1) { flicker++; break; } }
  ok(flicker===0, 'A07 no pair of players flickers in draw order over 30 s ('+crossings+' crossings, '+flicker+' flickering pairs)');
}
// D02 camera snaps on a cut and otherwise moves smoothly within its pan cap
{
  const sc = scenes[0]; const p = pres[0]; const w = 904, h = 619; const state = { anim: {}, cx: undefined }; let maxStep = 0, first = true;
  let maxShotStep = 0;
  for (let t=200; t<260; t+=1/60){ const s = sc.getSceneAt(t); const c = ISO.camera.update(state, s, w, h, 'follow', 1/60, first, 16); if (!first){ const step = Math.hypot(c.ox - state.lastOx, c.oy - state.lastOy); const shot = s.cameraInterest && (s.cameraInterest.kind==='attack' || s.cameraInterest.kind==='goal') && s.ball.state==='travelling'; if (shot) maxShotStep = Math.max(maxShotStep, step); else maxStep = Math.max(maxStep, step); } state.lastOx = c.ox; state.lastOy = c.oy; first = false; }
  ok(maxStep <= ISO.camera.PAN_MAX*w/60 + 1.5, 'D02 camera pans within its cap ('+maxStep.toFixed(1)+' px per frame)');
  ok(maxShotStep <= ISO.camera.PAN_MAX*ISO.camera.SHOT_PAN*w/60 + 1.5, 'D02 camera whips within the shot cap ('+maxShotStep.toFixed(1)+' px per frame)');
  const s = sc.getSceneAt(2000); const c1 = ISO.camera.update(state, s, w, h, 'follow', 1/60, true, 16); const c2 = ISO.camera.update({ anim:{} }, s, w, h, 'follow', 1/60, true, 16);
  ok(c1.ox===c2.ox && c1.oy===c2.oy, 'D02 a snap lands on the target regardless of previous state');
  // the view never shows bare canvas beyond the allowed overshoot: its centre stays inside the clamp
  const cl = ISO.camera.clampToGround(c1.ox, c1.oy, w, h, 16); ok(isFinite(cl.cx) && isFinite(cl.cy), 'D02 clamp returns finite values');
}
// C01 watching (rendering) changes nothing in the game state; C03 the renderer touches no engine function
{
  ok(JSON.stringify(st)===after1, 'C01 game state unchanged by capture, scene building and rendering');
  const src = ['renderers/iso-projection','iso-sprites','renderers/iso-pitch','renderers/iso-stadium','renderers/iso-camera','renderers/iso-actors','renderers/isometric'].map(f => fs.readFileSync('./src/matchday/'+f+'.js','utf8')).join('\n');
  ok(!/Engine\.|playMatch|advanceWeek|Math\.random|localStorage\.setItem\('sm91-save/.test(src.replace(/\/\/.*$/gm, '')), 'C03 isometric modules never call the engine, Math.random or the save');
}
// C10 the old renderers still draw the same scenes
{
  const w = 400, h = 300; const cv = createCanvas(w, h); const ctx = cv.getContext('2d'); let threw = null;
  try { for (const id of ['canvas2d','wireframe','pixelart']){ const d2 = MD.renderers[id]; const info = { teams: pres[0].teams, state: { anim:{} }, dtReal: 1/60, cameraMode:'follow', snap:true }; if (id==='pixelart'){ info.lay = d2.layoutFor(w, h); info.world = d2.buildWorld(createCanvas, w, h, info.lay, pres[0].seed); } d2.drawFrame(ctx, w, h, scenes[0].getSceneAt(123), info); } } catch(e){ threw = e; }
  ok(!threw, 'C10 Pixels, Markers and Board still draw'+(threw? ': '+threw.message : ''));
}
// sprite cache stays bounded for a match
{ const n = MD.isoSprites.cacheSize(); ok(n > 0 && n <= 2400, 'sprite cache bounded ('+n+' sprites after three matches)'); }

// ---- Milestone 2A: the art assets (sheets rendered by tools/iso-art.js) ----
(async () => {
  const { loadImage } = require('@napi-rs/canvas'); MD.isoAssets.setCanvasFactory(createCanvas);
  const AS = MD.isoAssets; let registered = 0;
  for (const st of ['A','B']) for (const spr of [24, 16, 12]){ const dir = './assets/matchday/isometric/'+st; const man = dir+'/players-'+spr+'.json'; if (!fs.existsSync(man)) continue; const m = JSON.parse(fs.readFileSync(man)); const [img, patterns, keepers, crowd, grass] = await Promise.all(['players','patterns','keepers','crowd','grass'].map(n => loadImage(dir+'/'+n+'-'+spr+'.png'))); AS.register(st, spr, { img, patterns, keepers, crowd, grass, manifest: m }); registered++; }
  ok(registered >= 2, 'E07 asset sheets present for both styles ('+registered+' sets)');
  // painted override cells (tools/iso_paint.py) replace generated cells outright, and the stand texture tiles over the far stand
  {
    const dir = './assets/matchday/isometric/B'; const ovp = dir+'/overrides-16.png';
    if (fs.existsSync(ovp)){
      const m = JSON.parse(fs.readFileSync(dir+'/players-16.json'));
      const [img, patterns, keepers, crowd, grass, overrides] = await Promise.all(['players','patterns','keepers','crowd','grass','overrides'].map(n => loadImage(dir+'/'+n+'-16.png')));
      const kit = { primary:'#C8102E', secondary:'#FFFFFF', pattern:'plain' }; const px = c => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
      AS.register('B', 16, { img, patterns, keepers, crowd, grass, manifest: m }); AS.setStyle('B'); const gen = px(AS.get(kit, { skin:1, hair:2 }, 'S', 'run', 0, 16));
      AS.register('B', 16, { img, patterns, keepers, crowd, grass, overrides, manifest: m }); const painted = AS.get(kit, { skin:1, hair:2 }, 'S', 'run', 0, 16); const pp = px(painted);
      let diff = 0; for (let i=0;i<gen.length;i++) if (gen[i]!==pp[i]) diff++;
      ok(diff > 100 && painted.feet > 0 && painted.feet < painted.height, 'B12 a painted override cell replaces the generated run frame ('+diff+' bytes differ) and keeps a feet anchor');
      const standP = dir+'/stand-16.png'; if (fs.existsSync(standP)){ const stand = await loadImage(standP); const standMeta = JSON.parse(fs.readFileSync(dir+'/stand-16.json')); AS.register('B', 16, { img, patterns, keepers, crowd, grass, overrides, stand, standMeta, manifest: m }); const t = AS.standTexture(16); ok(!!t && t.meta.metres > 0 && t.image.width === standMeta.width, 'B13 the painted far-stand texture registers with its metres and anchor'); }
      // B14 painted stadium pieces: a (synthetic) near-stand texture registers, is served at its own scale and as the
      // nearest scale elsewhere, and is tiled along the near stand with its anchor on the stand's front-bottom corner
      {
        const tex = createCanvas(40, 20); const tctx = tex.getContext('2d'); tctx.fillStyle = '#FF00FF'; tctx.fillRect(0, 0, 40, 20);
        const meta = { P: 16, piece:'near', axis:'X', metres: 2.5, from: 36, anchor: { x: 0, y: 20 }, width: 40, height: 20 };
        AS.register('B', 16, { img, patterns, keepers, crowd, grass, pieces: { near: { image: tex, meta } }, manifest: m }); AS.setStyle('B');
        ok(!!AS.pieceTexture(16, 'near') && AS.pieceTexture(12, 'near').meta.P === 16 && !AS.pieceTexture(16, 'left') && !AS.pieceTexture(16, 'dugout'), 'B14 piece textures register per name and fall back to the nearest scale');
        const sm = PR.DIM.runoff + ISO.stadium.STAND.gap; const cam0 = { P: 16, ox: 0, oy: 0 };
        const from = -PR.DIM.runoff + 2, span = PR.DIM.L + 2*PR.DIM.runoff - 4; const n = Math.round(span/2.5), len = span/n; const a0 = PR.project(from + 20*len, PR.DIM.W + sm, 0, cam0);   // the 21st tile's anchor
        const cam = { P: 16, ox: 150 - a0.sx, oy: 150 - a0.sy }; const cv = createCanvas(300, 300); const ctx = cv.getContext('2d');
        ISO.stadium.drawGround(ctx, cam, 7, false, null, { colours: [] });
        const px = ctx.getImageData(150 + 3, 150 - 3, 1, 1).data; const far = ctx.getImageData(150 + 3, 150 - 60, 1, 1).data;
        ok(px[0] > 200 && px[1] < 60 && px[2] > 200 && !(far[0] > 200 && far[1] < 60 && far[2] > 200), 'B14 the near-stand texture is drawn just above its anchor corner and not far above it');
      }
      // B15 dugouts: part of the ground on the far side, open towards the viewer; without a painted piece the generated
      // shelter draws (its roof slab is what the view mostly sees), and no dugout item reaches the per-frame depth sort
      {
        const { items } = ISO.actors.build(scenes[0].getSceneAt(100), pres[0].teams, { anim: {} }, 0, { P: 16, ox: 0, oy: 0, mode:'follow' }, 16);
        ok(!items.some(i => i.kind==='dugout'), 'B15 dugouts are ground, not depth-sorted items');
        AS.setStyle('none'); const cam0 = { P: 16, ox: 0, oy: 0 }; const b = ISO.stadium.dugoutBox(41); const c = PR.project((b.xa + b.xb)/2, (b.ya + b.yb)/2, ISO.stadium.DUGOUT.h, cam0);
        const cam = { P: 16, ox: 100 - c.sx, oy: 100 - c.sy }; const cv = createCanvas(200, 200); const ctx = cv.getContext('2d'); ISO.stadium.drawGround(ctx, cam, 7, false, null, { colours: [], only: ['dugout'] });
        const d = ctx.getImageData(100, 100, 1, 1).data; ok(d[3] > 0 && d[0] > 150 && d[2] > 170, 'B15 the generated dugout\'s roof slab lands where its box says ('+d[0]+','+d[1]+','+d[2]+')');
        ok(b.yb < 0 && b.ya < b.yb, 'B15 the dugouts sit on the far side, open towards the pitch');
      }
      AS.register('B', 16, { img, patterns, keepers, crowd, grass, manifest: m });   // back to the generated sheets for the checks that follow
    } else console.log('   (no override sheets present; painted-cell checks skipped)');
  }
  for (const st of ['A','B']){
    AS.setStyle(st); let missing = 0, total = 0, feetOk = 0;
    const kit = { primary:'#C8102E', secondary:'#FFFFFF', pattern:'plain' };
    for (const [pose, n] of Object.entries(MD.isoSprites.POSES)) for (let f=0; f<n; f++) for (const dir of PR.DIRS){ total++; const cv = AS.get(kit, { skin:1, hair:2, style:0 }, dir, pose, f, 16); if (!cv) missing++; else if (cv.feet > 0 && cv.feet < cv.height) feetOk++; }
    ok(missing===0 && feetOk===total, 'B03 style '+st+': every pose, frame and heading has a sheet frame with a feet anchor ('+total+')');
    const gk = AS.get(Object.assign({}, kit, { gk:true }), { skin:0, hair:0 }, 'S', 'dive', 1, 16); ok(!!gk, 'B07 style '+st+': keeper frames (gloves) exist');
    // patterns recolour shirt pixels to the trim colour: a striped shirt differs from a plain one
    const plain = AS.get(kit, { skin:0, hair:0 }, 'S', 'idle', 0, 16), striped = AS.get(Object.assign({}, kit, { pattern:'stripes' }), { skin:0, hair:0 }, 'S', 'idle', 0, 16);
    const px = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const a = px(plain), b = px(striped); let diff = 0; for (let i=0;i<a.length;i+=4) if (a[i]!==b[i] || a[i+1]!==b[i+1] || a[i+2]!==b[i+2]) diff++;
    ok(diff > 10, 'B07 style '+st+': stripes change the shirt ('+diff+' pixels)');
    // crowd strips and grass textures come back for the scale
    ok(!!AS.crowdStrip(16, 'far', 0, false, 7, ['#C8102E']) && !!AS.crowdStrip(16, 'left', 2, true, 7, []) && !!AS.grass(16), 'B11 style '+st+': crowd strips and grass texture available at 16 px/m');
    // a frame drawn with the assets differs from the procedural one and draws without error
    const w = 904, h = 619; const cv = createCanvas(w, h); const ctx = cv.getContext('2d');
    const world = def.buildWorld(createCanvas, 16, pres[0].seed, ['#C8102E','#FFF200']); let threw = null;
    try { for (let k=0;k<20;k++) def.drawFrame(ctx, w, h, scenes[0].getSceneAt(300 + k/20), { teams: pres[0].teams, seed: pres[0].seed, world, state: { anim:{} }, dtReal: 1/60, cameraMode:'follow', followP: 16, snap: k===0 }); } catch(e){ threw = e; }
    ok(!threw, 'B02 style '+st+': frames draw with the asset sheets'+(threw? ': '+threw.message : ''));
  }
  // fallback: with no style selected the procedural figures are used and nothing breaks
  AS.setStyle('none'); const fb = AS.get({ primary:'#C8102E', secondary:'#FFF' }, { skin:0, hair:0 }, 'S', 'run', 1, 16); ok(fb===null, 'E06 fallback: no asset frame when no style is selected');
  { const w = 400, h = 300; const cv = createCanvas(w, h); const ctx = cv.getContext('2d'); let threw = null; try { const world = def.buildWorld(createCanvas, 12, pres[0].seed, []); def.drawFrame(ctx, w, h, scenes[0].getSceneAt(50), { teams: pres[0].teams, seed: pres[0].seed, world, state: { anim:{} }, dtReal: 1/60, cameraMode:'follow', followP: 12, snap: true }); } catch(e){ threw = e; } ok(!threw, 'E06 fallback: the procedural art still draws'+(threw? ': '+threw.message : '')); }
  console.log(checks+' checks, '+fails+' failures');
  if (fails){ console.log('ISOMETRIC TESTS FAILED'); process.exit(1); }
  console.log('ALL ISOMETRIC TESTS PASSED');
})();


