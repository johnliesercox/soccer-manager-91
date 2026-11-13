'use strict';
// Matchday Milestone C tests: playback controller and renderers (headless).
const E = require('./engine.js');
globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/canvas2d','renderers/pixelart','renderers/wireframe']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday;
let fails = 0; const ok = (c, msg) => { if (!c){ fails++; console.log('FAIL', msg); } };

// a few real matches
const st = E.newGame({ seed: 99, userClub: 3 });
const pres = [];
for (let w=0; w<12; w++){ const res = E.advanceWeek(st); for (const m of res) pres.push(MD.withTimeline(MD.capture(st, m, st.lastWeekInfo))); }
const pick = f => pres.find(f);
const samples = [pick(p=>p.official.extra==='pens'), pick(p=>p.official.extra==='aet'), pick(p=>p.official.homeGoals+p.official.awayGoals>=5), pick(p=>p.official.homeGoals+p.official.awayGoals===0), pres[0]].filter(Boolean);
console.log('samples', samples.map(p=>p.matchId+' '+p.official.homeGoals+'-'+p.official.awayGoals+(p.official.extra? ' '+p.official.extra : '')).join(' | '));

// ---- fake animation frames ----
let rafQ = []; let now = 0;
globalThis.requestAnimationFrame = cb => { rafQ.push(cb); return rafQ.length; };
globalThis.cancelAnimationFrame = () => { rafQ = []; };
function runFrames(stepMs, maxFrames){ let n = 0; while (rafQ.length && n++<maxFrames){ const cbs = rafQ; rafQ = []; now += stepMs; for (const cb of cbs) cb(now); } return n; }

for (const p of samples){
  const sc = MD.createScene(p);
  const seen = []; let ended = 0, frames = 0, lastSecond = -1, monotonic = true; let lastScore = {home:0, away:0}, scoreBack = false;
  const pb = MD.createPlayback(p, { onEvent: e => seen.push(e), onEnd: () => ended++, onFrame: (s) => { frames++; if (s < lastSecond) monotonic = false; lastSecond = s; const sn = sc.getSceneAt(s); if (sn.score.home<lastScore.home || sn.score.away<lastScore.away) scoreBack = true; lastScore = sn.score; } });
  const map = pb.timeMap();
  ok(map.realDuration > 50 && map.realDuration < 130, 'real duration '+map.realDuration.toFixed(0)+'s for '+p.matchId);
  ok(map.segs.every((s,i)=>i===0 || s.a===map.segs[i-1].b), 'segments contiguous');
  ok(map.segs[map.segs.length-1].b===map.end, 'segments reach the end');
  // every goal sits inside a highlight window
  for (const g of p.events.filter(e=>e.type==='GOAL')){ const seg = map.segs.find(s=>g.matchSecond>=s.a && g.matchSecond<s.b) || map.segs[map.segs.length-1]; ok(!seg.ff, 'goal in a highlight '+p.matchId); }
  pb.play();
  const n = runFrames(1000/60, 20000);
  const realSeconds = n/60;
  ok(ended===1, 'ended once ('+ended+')');
  ok(monotonic, 'time monotonic');
  ok(!scoreBack, 'score never went backwards');
  ok(Math.abs(realSeconds - (map.realDuration + MD.PLAYBACK_DEFAULTS.endHold)) < 1.5, 'played in about the planned time: '+realSeconds.toFixed(1)+'s vs '+map.realDuration.toFixed(1));
  const officials = p.events.filter(e=>e.provenance==='official');
  const seenOfficial = seen.filter(e=>e.provenance==='official');
  ok(seenOfficial.length===officials.length && seenOfficial.every((e,i)=>e.id===officials[i].id), 'all official events emitted once, in order ('+seenOfficial.length+'/'+officials.length+')');
  ok(seen.every((e,i)=>i===0 || e.matchSecond>=seen[i-1].matchSecond), 'events emitted chronologically');
  const finalScene = sc.getSceneAt(pb.state().matchSecond);
  ok(finalScene.score.home===p.official.homeGoals && finalScene.score.away===p.official.awayGoals, 'final scene score matches official');
  ok(seen.filter(e=>e.type==='GOAL').length===p.official.homeGoals+p.official.awayGoals, 'goal commentary count');
  // skip: a fresh controller skipped immediately reaches the same result
  let ended2 = 0; const seen2 = [];
  const pb2 = MD.createPlayback(p, { onEvent: e => seen2.push(e), onEnd: () => ended2++ });
  pb2.play(); runFrames(1000/60, 30); pb2.skip();
  ok(ended2===1 && pb2.state().ended && pb2.state().matchSecond===pb.state().matchSecond, 'skip ends at the same second');
  ok(seen2.filter(e=>e.provenance==='official').length===officials.length, 'skip still emits every official event');
  // speed: 4x finishes in about a quarter of the time
  const pb4 = MD.createPlayback(p, {}); pb4.setSpeed(4); pb4.play(); const n4 = runFrames(1000/60, 20000);
  ok(Math.abs(n4/60 - (map.realDuration/4 + MD.PLAYBACK_DEFAULTS.endHold)) < 1.5, '4x duration '+(n4/60).toFixed(1));
  // pause really stops the clock
  const pb3 = MD.createPlayback(p, {}); pb3.play(); runFrames(1000/60, 60); pb3.pause(); const before = pb3.state().matchSecond; runFrames(1000/60, 60); ok(pb3.state().matchSecond===before && !pb3.state().playing, 'pause holds');
  // seek re-syncs the event stream
  const seen5 = []; const pb5 = MD.createPlayback(p, { onEvent: e => seen5.push(e) }); pb5.seek(2699); pb5.play(); runFrames(1000/60, 20000);
  ok(seen5.length && seen5[0].matchSecond>=2699 && seen5.some(e=>e.type==='SECOND_HALF') && !seen5.some(e=>e.type==='KICK_OFF' && e.matchSecond===0), 'seek then play emits from the seek point');
  pb.dispose(); pb2.dispose(); pb3.dispose(); pb4.dispose(); pb5.dispose();
  // what is DRAWN must move smoothly: frame-to-frame player movement at sceneSecond stays within a
  // sprint, except at a cut (end of a fast-forward), and the clock still races through the gaps
  {
    let prev = null, worst = 0, cuts = 0, ffFrames = 0, frames = 0, maxClockJump = 0, lastClock = 0;
    const pb6 = MD.createPlayback(p, { onFrame: (sec, state) => {
      frames++; if (state.fastForward) ffFrames++;
      maxClockJump = Math.max(maxClockJump, sec - lastClock); lastClock = sec;
      const s = sc.getSceneAt(state.sceneSecond);
      if (prev && state.sinceCut > 0.05 && prev.phase===s.phase){ for (const pl of s.players){ const q = prev.players.find(x=>x.id===pl.id); if (!pl.sentOff && !q.sentOff) worst = Math.max(worst, Math.hypot(pl.x-q.x, pl.y-q.y)); } }
      if (state.sinceCut < 0.02) cuts++;
      prev = s;
    } });
    pb6.play(); runFrames(1000/60, 20000); pb6.dispose();
    ok(worst < 0.03, 'drawn scene never jumps between frames (worst '+worst.toFixed(3)+' per frame) '+p.matchId);
    ok(ffFrames > 0 && maxClockJump > 1, 'the clock still fast-forwards (max '+maxClockJump.toFixed(1)+'s per frame)');
    ok(cuts >= 1, 'cuts happen at the end of fast-forwards ('+cuts+')');
  }
}

// ---- renderers, headless ----
let canvasLib = null; try { canvasLib = require('@napi-rs/canvas'); } catch(e){ console.log('(@napi-rs/canvas not available, skipping pixel checks)'); }
if (canvasLib){
  const fs = require('fs'); const outDir = process.env.SHOT_DIR || '/tmp/claude-0/-home-claude/5acce8f7-218f-53b1-be30-5c1ebfdf609c/scratchpad/shots'; fs.mkdirSync(outDir, { recursive:true });
  const p = samples.find(x=>x.official.homeGoals+x.official.awayGoals>=2) || samples[0];
  const sc = MD.createScene(p);
  const goal = p.events.find(e=>e.type==='GOAL');
  const shots = [['landscape', 640, 400, 1200], ['portrait', 390, 560, goal.matchSecond-6], ['goal-flash', 390, 560, goal.matchSecond+0.6], ['second-half', 640, 400, 3300]];
  for (const [name, w, h, t] of shots){
    for (const rid of ['canvas2d','wireframe']){
      const cv = canvasLib.createCanvas(w, h); const ctx = cv.getContext('2d');
      const scene = sc.getSceneAt(t);
      MD.renderers[rid].drawFrame(ctx, w, h, scene, { teams: p.teams, fastForward: name==='second-half' });
      const png = cv.toBuffer('image/png'); fs.writeFileSync(`${outDir}/${rid}-${name}.png`, png);
      const d = ctx.getImageData(0, 0, w, h).data; let green = 0, white = 0, ink = 0; for (let i=0;i<d.length;i+=16){ if (d[i+1]>d[i]+40 && d[i+1]>d[i+2]+20) green++; if (d[i]>220 && d[i+1]>220 && d[i+2]>220) white++; if (d[i+1]>150 && d[i]<120) ink++; }
      if (rid==='canvas2d'){ ok(green > (w*h/4)*0.3, rid+' '+name+' has grass'); ok(white > 20, rid+' '+name+' has markings'); }
      else { ok(ink > 40, rid+' '+name+' has phosphor ink ('+ink+')'); }
    }
  }
  // pixel-art renderer: world + sprites, both cameras, portrait and landscape; animation state persists
  {
    MD.sprites.setCanvasFactory((w,h)=>canvasLib.createCanvas(w,h));
    const goalE = p.events.find(e=>e.type==='GOAL');
    for (const [name, w, h, t, mode] of [['portrait-follow', 390, 560, 1200, 'follow'], ['portrait-whole', 390, 560, 1200, 'whole'], ['landscape-follow', 640, 400, goalE.matchSecond+1, 'follow'], ['landscape-whole', 640, 400, 3300, 'whole']]){
      const cv = canvasLib.createCanvas(w, h); const ctx = cv.getContext('2d');
      const lay = MD.renderers.pixelart.layoutFor(w, h); const world = MD.renderers.pixelart.buildWorld((a,b)=>canvasLib.createCanvas(a,b), w, h, lay, p.seed);
      const state = { anim: {} };
      for (let i=12;i>=0;i--) MD.renderers.pixelart.drawFrame(ctx, w, h, sc.getSceneAt(t - i*0.1), { teams: p.teams, lay, world, state, dtReal: 0.1, nowMs: 1000+i*100, cameraMode: mode, fastForward: i===0 && mode==='whole' });
      fs.writeFileSync(`${outDir}/pixelart-${name}.png`, cv.toBuffer('image/png'));
      const d = ctx.getImageData(0, 0, w, h).data; let green = 0, skin = 0; for (let i=0;i<d.length;i+=16){ if (d[i+1]>d[i]+40 && d[i+1]>d[i+2]+20) green++; if (Math.abs(d[i]-0xF2)<12 && Math.abs(d[i+1]-0xC9)<12 && Math.abs(d[i+2]-0xA0)<12) skin++; }
      ok(green > (w*h/4)*0.25, 'pixelart '+name+' has grass');
      ok(skin > 3, 'pixelart '+name+' drew sprites ('+skin+' skin samples)');
      ok(Object.keys(state.anim).length >= 20, 'pixelart '+name+' tracks animation state per player');
      ok(Object.values(state.anim).some(a=>a.dist>0), 'pixelart '+name+' advanced a run cycle');
    }
    ok(MD.sprites.cacheSize() > 30 && MD.sprites.cacheSize() < 2000, 'sprite cache bounded ('+MD.sprites.cacheSize()+')');
    // every pose and facing colours without error for an odd kit
    for (const facing of MD.sprites.FACINGS) for (const pose of MD.sprites.POSES) MD.sprites.get({ primary:'hsl(200,70%,42%)', secondary:'#FFFFFF' }, { skin:3, hair:4 }, facing, pose, 1);
    // a sprite has an outline and kit colours
    const spr = MD.sprites.get({ primary:'#DA291C', secondary:'#FFFFFF' }, { skin:0, hair:0 }, 'down', 'idle', 0);
    const sd = spr.getContext('2d').getImageData(0,0,24,24).data; let red = 0, dark = 0, clear = 0; for (let i=0;i<sd.length;i+=4){ if (sd[i+3]===0) clear++; else if (sd[i]>200 && sd[i+1]<60) red++; else if (sd[i]<40 && sd[i+1]<40) dark++; }
    ok(red > 30 && dark > 20 && clear > 200, 'sprite has shirt, outline and transparency ('+red+','+dark+','+clear+')');
  }
  // speed: a frame should be cheap
  const cv = canvasLib.createCanvas(390, 560); const ctx = cv.getContext('2d'); const lay = MD.renderers.common.layout(390, 560);
  const pitch = canvasLib.createCanvas(390, 560); MD.renderers.common.drawPitch(pitch.getContext('2d'), lay);
  const t0 = Date.now(); for (let i=0;i<300;i++) MD.renderers.canvas2d.drawFrame(ctx, 390, 560, sc.getSceneAt(1000+i*0.5), { teams: p.teams, lay, pitch });
  console.log(`300 frames in ${Date.now()-t0}ms (${((Date.now()-t0)/300).toFixed(2)}ms each, headless)`);
  console.log('screenshots in', outDir);
}

console.log(fails? `\n${fails} FAILURES` : '\nALL PLAYBACK/RENDERER TESTS PASSED');
process.exit(fails? 1 : 0);
