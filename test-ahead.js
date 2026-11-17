'use strict';
// Phase 3, Milestone 5: painting the ground ahead of the camera. A ground tile costs a few milliseconds to paint, and a
// cut used to paint a whole screen of them in one frame. The renderer now paints, one tile a frame, the tiles the next
// highlight opens on (during the fast-forward that leads to it) and the tiles just beyond the edge a pan is heading for.
// This suite plays a match through a mounted renderer the way the match screen does and counts tiles painted per frame.
// Run: node test-ahead.js
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/canvas2d','renderers/pixelart','renderers/wireframe','renderers/iso-projection','iso-sprites','iso-assets','renderers/iso-pitch','renderers/iso-stadium','renderers/iso-camera','renderers/iso-actors','renderers/isometric']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const def = MD.renderers.isometric;
const { createCanvas } = require('@napi-rs/canvas'); MD.sprites.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas);
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } };

const { JSDOM } = require('jsdom'); const dom = new JSDOM('<div id="s"></div>'); const doc = dom.window.document; const el = doc.getElementById('s'); let size = { w: 366, h: 411 }; let stage = null;
Object.defineProperty(el, 'clientWidth', { get: () => size.w }); Object.defineProperty(el, 'clientHeight', { get: () => size.h }); globalThis.document = doc;
const origCreate = doc.createElement.bind(doc); doc.createElement = tag => { if (tag==='canvas'){ const c = createCanvas(1, 1); c.style = {}; c.setAttribute = () => {}; c.addEventListener = () => {}; c.removeEventListener = () => {}; c.getBoundingClientRect = () => ({ left: 0, top: 0, width: size.w, height: size.h }); c.className = ''; return c; } return origCreate(tag); };
el.appendChild = c => { stage = c; return c; };
let clock = 5000; const realNow = globalThis.performance.now; globalThis.performance.now = () => clock;

// a match with goals in it, so there are cuts inside highlights (the restart, the scorer) as well as between them
const st = E.newGame({ seed: 4242, userClub: 14 }); const res = E.advanceWeek(st);
const HALF = MD.PERIODS.regulation.half;   // the first half is enough (and keeps the suite to about a minute and a half)
const pres = res.map(m => MD.withTimeline(MD.capture(st, m, st.lastWeekInfo))).find(p => p.events.filter(e => e.type===MD.EVENT.GOAL && e.matchSecond < HALF - 60).length >= 2);
const sc = MD.createScene(pres); const segs = MD.createPlayback(pres, { onFrame(){}, onEvent(){}, onEnd(){} }).timeMap().segs.filter(g => g.b <= HALF); const RATE = 2.8;
const hash = () => { const d = stage.getContext('2d').getImageData(0, 0, stage.width, stage.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 97) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; };

// the match is played as the match screen plays it: a highlight at its own pace, then the fast-forward to the next (as
// long as it really lasts), in which the picture runs on while (with `ahead`) the renderer is told where the cut will
// land; a few seconds before a goal it is told that too, so the stands can be got ready for the wave
const goalTimes = pres.events.filter(e => e.type===MD.EVENT.GOAL).map(e => e.matchSecond);
function play(w, h, ahead){
  size = { w, h }; const r = def.create({ style: 'none' }); r.mount(el, pres); r.setCamera('close');
  const out = { cuts: [], inner: [], ffFrames: [], playFrames: 0, multi: 0, worst: 0, most: 0, pictures: [], camMoved: 0 }; let prepFor = null, waveFor = null;
  // the start of the next highlight (past the fast-forward before it), as the match screen names it to the view
  const next = from => { let k = from; while (k < segs.length && segs[k].ff) k++; const nx = segs[k]; if (!nx || prepFor===nx.a) return; prepFor = nx.a; const c0 = r.lastFrame().cam; r.prepare(sc.getSceneAt(nx.a), { segment: { a: nx.a, b: nx.b } }); const c1 = r.lastFrame().cam; if (c0.ox!==c1.ox || c0.oy!==c1.oy || c0.P!==c1.P) out.camMoved++; };
  const frame = (t, hud) => { clock += 1000/60; const before = r.tilesPainted(); r.render(sc.getSceneAt(t), hud); out.most = Math.max(out.most, r.worldTiles()); return r.tilesPainted() - before; };   // tiles painted in this frame, on demand or ahead
  for (let i = 0; i < segs.length; i++){
    const g = segs[i];
    if (g.ff){ const n = Math.max(30, Math.round((g.b - g.a)/g.rate*60)); out.ffFrames.push(n); for (let k = 0; k < n; k++){ const t = Math.min(g.b - 0.001, g.a + k*RATE/60); frame(t, { sinceCut: 2 + k/60, fastForward: true });
        if (ahead && k===0) next(i + 1); }
      continue; }
    let since = 0, lastCut = g.a;
    for (let t = g.a; t < g.b; t += RATE/60){
      const cut = sc.cutTimes.find(x => x > t - RATE/60 && x <= t && x > g.a);   // a cut inside the highlight falls on this frame
      if (cut!==undefined){ since = 0; lastCut = cut; }
      if (ahead){ const gl = goalTimes.find(x => x > t && x < t + 4); if (gl!==undefined && waveFor!==gl){ waveFor = gl; r.expectWave(); } }
      if (ahead){ let c = sc.cutTimes.find(x => x > t + 0.05 && x < t + 3.5); { const gl = goalTimes.find(x => x > t - 1.5 && x < t + 4); const cel = gl!==undefined? sc.getSceneAt(gl + 0.05).celebration : null; if (cel && cel.cut > t + 0.05 && (c===undefined || cel.cut < c)) c = cel.cut; }   // the cut to the scorer
        if (c!==undefined){ if (prepFor!==c){ prepFor = c; r.prepare(sc.getSceneAt(c + 0.02), { segment: { a: g.a, b: g.b } }); } } else if (g.b - t < 6) next(i + 1); }
      const d = frame(t, { sinceCut: since, segment: { a: g.a, b: g.b } });
      if (since===0 && t===g.a) out.cuts.push(d); else if (since===0) out.inner.push(d); else { out.playFrames++; if (d > 1) out.multi++; out.worst = Math.max(out.worst, d); }
      since += 1/60;
      if (Math.abs(t - (g.a + 1.4)) < RATE/120 || Math.abs(t - (g.b - 1.4)) < RATE/120) out.pictures.push(hash());
    }
  }
  out.cap = r.worldTiles; r.dispose(); return out;
}

for (const [w, h] of [[366, 411], [1164, 756]]){
  const name = w+'x'+h; const plain = play(w, h, false), ahead = play(w, h, true);
  const later = a => a.slice(1); const sum = a => a.reduce((x, y) => x + y, 0);
  ok(plain.cuts.length >= 4 && Math.max.apply(null, later(plain.cuts)) >= 4, name+': without painting ahead a cut paints several tiles in one frame (the fault: up to '+Math.max.apply(null, later(plain.cuts))+', '+sum(later(plain.cuts))+' over '+later(plain.cuts).length+' cuts)');
  ok(Math.max.apply(null, later(ahead.cuts)) <= 1, name+': with it, a cut into a highlight paints no more than a frame\'s one tile ('+later(ahead.cuts).join(',')+'; the fast-forwards before them lasted '+ahead.ffFrames.join(',')+' frames)');
  ok(ahead.inner.length===plain.inner.length && sum(ahead.inner) <= ahead.inner.length, name+': cuts inside a highlight (a restart, the scorer): '+sum(ahead.inner)+' tiles on '+ahead.inner.length+' cut frames, '+sum(plain.inner)+' before');
  ok(ahead.worst <= 6 && ahead.multi <= ahead.playFrames*0.01 && plain.worst >= ahead.worst, name+': during play, a goal and its wave included, a frame paints one tile at most, almost always ('+ahead.multi+' of '+ahead.playFrames+' frames painted more, none more than '+ahead.worst+'; without painting ahead the worst frame painted '+plain.worst+')');
  ok(ahead.camMoved===0, name+': working out where a cut will land does not move the camera that is showing the match');
  { const cols = Math.ceil(w/256) + 1, rows = Math.ceil(h/256) + 1; const room = cols*rows*2 + 2*(cols + rows) + 4; const cap = Math.max(40, Math.min(72, room)) + Math.max(w >= 700? 40 : 30, Math.min(72, room));
    ok(ahead.most <= cap, name+': the tile cache stays within its cap ('+ahead.most+' tiles at most with painting ahead, '+plain.most+' without; '+cap+' allowed over the two scales)'); }
  ok(ahead.pictures.length >= 6 && ahead.pictures.length===plain.pictures.length && ahead.pictures.every((x, i) => x===plain.pictures[i]), name+': the picture is the same with and without painting ahead ('+ahead.pictures.length+' frames compared)');
}
globalThis.performance.now = realNow;
console.log(checks+' checks, '+fails+' failures');
if (fails){ console.log('PAINT-AHEAD TESTS FAILED'); process.exit(1); }
console.log('ALL PAINT-AHEAD TESTS PASSED');
