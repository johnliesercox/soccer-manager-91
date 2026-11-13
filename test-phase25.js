'use strict';
// Phase 2.5 acceptance tests: football behaviour, ball interactions, determinism, geometry.
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/canvas2d','renderers/pixelart','renderers/wireframe']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const B = MD.behaviour;
let fails = 0; const ok = (c, msg) => { if (!c){ fails++; console.log('FAIL', msg); } };
const PX = 105, PY = 68; const dm = (a, b) => Math.hypot((a.x-b.x)*PX, (a.y-b.y)*PY);

// a seeded week with a spread of situations
const st = E.newGame({ seed: 4242, userClub: 3 });
const all = [];
for (let w=0; w<6; w++){ const res = E.advanceWeek(st); for (const m of res) all.push({ m, p: MD.withTimeline(MD.capture(st, m, st.lastWeekInfo)) }); }
const pick = f => all.find(x=>f(x.p));
const samples = [pick(p=>p.official.cards.some(c=>c.card==='red')), pick(p=>p.official.extra==='pens'), pick(p=>p.official.homeGoals+p.official.awayGoals>=4), pick(p=>p.official.homeGoals+p.official.awayGoals===0), all[0], all[7]].filter(Boolean);
console.log('samples', samples.map(x=>x.p.matchId).join(' | '));

// ---- build cost ----
{
  const t0 = Date.now(); let n = 0; for (const { p } of all.slice(0, 40)){ MD.createScene(p); n++; }
  const per = (Date.now()-t0)/n; console.log(`createScene ${per.toFixed(0)}ms per match`);
  ok(per < 400, 'scene build under 400ms per match ('+per.toFixed(0)+')');
}

for (const { p } of samples){
  const sc = MD.createScene(p);
  const id = p.matchId;
  // ---- 1. order independence: forward, backward and shuffled sampling agree ----
  {
    const times = []; for (let t=0; t<=sc.duration; t+=37.3) times.push(t);
    const fwd = times.map(t=>JSON.stringify(sc.getSceneAt(t)));
    const bwd = times.slice().reverse().map(t=>JSON.stringify(sc.getSceneAt(t))).reverse();
    const rnd = MD.seededRandom(7); const order = times.map((t,i)=>i).sort(()=>rnd()-0.5); const shuf = new Array(times.length); for (const i of order) shuf[i] = JSON.stringify(sc.getSceneAt(times[i]));
    ok(fwd.every((s,i)=>s===bwd[i] && s===shuf[i]), 'getSceneAt is order independent '+id);
    const sc2 = MD.createScene(p); ok(JSON.stringify(sc2.getSceneAt(1234.5))===JSON.stringify(sc.getSceneAt(1234.5)), 'a rebuilt scene agrees '+id);
  }
  // ---- 2. speed and acceleration limits in metres per second ----
  {
    let worstV = 0, worstA = 0, frames = 0, overlaps = 0, pairs = 0, prev = null, prevV = null;
    const DT = 0.25;
    for (let t=0; t<=sc.duration; t+=DT){
      const s = sc.getSceneAt(t); frames++;
      const cut = sc.cutTimes.some(c=>c>t-DT && c<=t);
      const vNow = {};
      for (const pl of s.players){ if (pl.sentOff) continue;
        ok(pl.x>=0 && pl.x<=1 && pl.y>=0 && pl.y<=1, 'on pitch '+id);
        ok(['idle','walk','jog','run','sprint'].includes(pl.movement), 'movement band '+pl.movement);
        ok(['none','pass','shoot','receive','tackle','block','dive','set','celebrate','booked'].includes(pl.action), 'action '+pl.action);
        ok(pl.actionPhase>=0 && pl.actionPhase<=1.0001, 'action phase in range');
        if (prev && !cut){ const q = prev.players.find(x=>x.id===pl.id); if (q && !q.sentOff){ const v = dm(pl, q)/DT; worstV = Math.max(worstV, v); vNow[pl.id] = v; if (prevV && prevV[pl.id]!==undefined) worstA = Math.max(worstA, Math.abs(v - prevV[pl.id])/DT); } }
      }
      // separation: two players standing on the same spot
      const on = s.players.filter(x=>!x.sentOff);
      for (let i=0;i<on.length;i++) for (let j=i+1;j<on.length;j++){ pairs++; if (dm(on[i], on[j]) < 0.6) overlaps++; }
      // ball ownership
      const owners = s.players.filter(x=>x.hasBall); ok(owners.length<=1, 'at most one ball owner '+id);
      ok(['controlled','travelling','loose','dead'].includes(s.ball.state), 'ball state '+s.ball.state);
      if (s.ball.state==='controlled'){ ok(owners.length===1 && s.ball.carrierId===owners[0].id, 'controlled ball has its owner '+id); if (owners[0]) ok(dm(owners[0], s.ball) < 4.0, 'controlled ball at the feet ('+dm(owners[0], s.ball).toFixed(1)+'m) '+id+' t='+t); }
      else ok(owners.length===0 && !s.ball.carrierId, 'a ball that is not controlled has no owner '+id+' t='+t);
      if (s.ball.state==='travelling') ok(s.ball.inFlight, 'travelling means in flight');
      ok(isFinite(s.cameraInterest.x) && s.cameraInterest.x>=-0.05 && s.cameraInterest.x<=1.05 && s.cameraInterest.y>=0 && s.cameraInterest.y<=1 && ['openPlay','attack','setPiece','goal'].includes(s.cameraInterest.kind), 'camera interest sane');
      prev = s; prevV = vNow;
    }
    ok(worstV <= B.BAND.SPRINT*1.12, `no player faster than a sprint (${worstV.toFixed(1)} m/s) ${id}`);
    ok(worstA <= MD.trajectories.ACCEL*2.0, `acceleration bounded (${worstA.toFixed(1)} m/s2) ${id}`);
    ok(overlaps/pairs < 0.003, `players rarely share a spot (${(100*overlaps/pairs).toFixed(2)}% of pairs within 0.6m) ${id}`);
    console.log(`${id}: max speed ${worstV.toFixed(1)} m/s, max accel ${worstA.toFixed(1)} m/s2, overlaps ${(100*overlaps/pairs).toFixed(3)}%`);
  }
  // ---- 3. hand-overs: the receiver is there when the ball arrives (or very soon after) ----
  {
    let n = 0, within = 0, worst = 0, late = 0;
    for (const k of sc.keyframes){
      if (!k.carrier || k.kind==='launch' || k.kind==='restart' || k.cut) continue;
      const s = sc.getSceneAt((k.controlT||k.t) + 0.01); const pl = s.players.find(x=>x.id===k.carrier); if (!pl || pl.sentOff) continue;
      n++; const d = dm(pl, { x:k.x, y:k.y }); if (d <= MD.interactions.CONTROL_RADIUS + 0.3) within++; worst = Math.max(worst, d); if ((k.controlT||k.t) - k.t > 0.5) late++;
    }
    ok(within/n > 0.95, `receivers meet the ball (${within}/${n}, worst ${worst.toFixed(1)}m) ${id}`);
    console.log(`${id}: hand-overs ${n}, met within radius ${(100*within/n).toFixed(1)}%, late >0.5s ${late}, worst ${worst.toFixed(1)}m`);
  }
  // ---- 4. passes and shots: launched from the passer's feet, received by the right player, goals cross the line ----
  {
    for (const k of sc.keyframes.filter(k=>k.kind==='launch' && k.carrier && !k.parry).slice(0, 400)){
      const before = sc.getSceneAt(k.t - 0.02); const pl = before.players.find(x=>x.id===k.carrier);
      ok(pl && dm(pl, before.ball) < 4.0, 'ball at the kicker before contact '+id);
      ok(pl && (pl.action==='pass' || pl.action==='shoot'), 'kicker shows a pass/shoot action ('+(pl&&pl.action)+') '+id);
      const after = sc.getSceneAt(k.t + 0.1); ok(after.ball.state==='travelling' && !after.ball.carrierId, 'ball travelling after contact '+id);
    }
    for (const g of p.events.filter(e=>e.type==='GOAL')){
      const a = sc.getSceneAt(g.matchSecond - 0.05), b = sc.getSceneAt(g.matchSecond + 0.05);
      ok(a.score.home+a.score.away+1===b.score.home+b.score.away, 'score changes at the official goal second '+id);
      const gx = g.to.x > 0.5? 1 : 0; ok(Math.abs(b.ball.x - gx) < 0.03, 'ball at the goal line when the goal is given '+id);
      ok(!a.flash && b.flash && b.flash.type==='goal', 'flash only after the goal '+id);
    }
  }
  // ---- 5. dismissals: ten men, reshaped ----
  {
    const red = p.official.cards.find(c=>c.card==='red');
    if (red){
      const off = p.events.find(e=>e.type===MD.EVENT.SENT_OFF && e.playerId===red.playerId);
      const s = sc.getSceneAt(off.matchSecond + 30);
      const team = s.players.filter(x=>x.teamId===red.teamId);
      ok(team.filter(x=>!x.sentOff).length===team.length-1, 'ten on the pitch after a red card '+id);
      ok(team.find(x=>x.id===red.playerId).sentOff && team.find(x=>x.id===red.playerId).y > 1, 'the dismissed player is off the pitch '+id);
      ok(team.filter(x=>!x.sentOff && x.role==='GK').length===1, 'the ten still have someone in goal '+id);
      const after = sc.anchorSets[sc.anchorSets.length-1]; const isGK = p.players.find(x=>x.id===red.playerId).role==='GK'; ok(after.t===off.matchSecond && (isGK || after.anchors.formations[red.teamId]!==sc.anchorSets[0].anchors.formations[red.teamId]), 'the ten reshape ('+sc.anchorSets[0].anchors.formations[red.teamId]+' -> '+after.anchors.formations[red.teamId]+(isGK? ', keeper off' : '')+') '+id);
    }
  }
  // ---- 6. a 50ms walk: nothing drawn teleports (set pieces, hand-overs and turnovers included) ----
  {
    let worst = 0, q0 = null;
    for (let t=0; t<=sc.duration; t+=0.05){ const s = sc.getSceneAt(t); if (q0 && q0.phase===s.phase && !sc.cutTimes.some(c=>c>t-0.05 && c<=t)) for (const pl of s.players){ const q = q0.players.find(x=>x.id===pl.id); if (!pl.sentOff && !q.sentOff) worst = Math.max(worst, dm(pl, q)); } q0 = s; }
    ok(worst < 0.7, `no teleport at 50ms steps (worst ${worst.toFixed(2)}m) ${id}`);
  }
}

// ---- 7. renderer: facing holds, poses from actions (headless) ----
{
  let canvasLib = null; try { canvasLib = require('@napi-rs/canvas'); } catch(e){}
  if (canvasLib){
    MD.sprites.setCanvasFactory((w,h)=>canvasLib.createCanvas(w,h));
    const { p } = samples[2]; const sc = MD.createScene(p);
    const w = 390, h = 560; const lay = MD.renderers.pixelart.layoutFor(w, h); const world = MD.renderers.pixelart.buildWorld((a,b)=>canvasLib.createCanvas(a,b), w, h, lay, p.seed);
    const cv = canvasLib.createCanvas(w, h); const ctx = cv.getContext('2d'); const state = { anim: {} };
    let flips = 0, frames = 0; const last = {};
    for (let t=600; t<660; t+=1/30){ MD.renderers.pixelart.drawFrame(ctx, w, h, sc.getSceneAt(t), { teams: p.teams, lay, world, state, dtReal: 1/30, nowMs: t*1000, cameraMode: 'follow' }); frames++; for (const id in state.anim){ if (last[id] && last[id]!==state.anim[id].facing) flips++; last[id] = state.anim[id].facing; } }
    const perPlayerPerSec = flips/23/60;   // 60 s of play
    ok(perPlayerPerSec < 0.6, `facing changes are rare (${perPlayerPerSec.toFixed(2)} per player per second)`);
    console.log(`facing changes: ${perPlayerPerSec.toFixed(2)} per player per second over 60s`);
    // camera: never jumps between frames except on a cut
    let camJump = 0, prevCam = null;
    for (let t=600; t<700; t+=1/30){ const s = sc.getSceneAt(t); const cam = MD.renderers.pixelart.drawFrame(ctx, w, h, s, { teams: p.teams, lay, world, state, dtReal: 1/30, nowMs: t*1000, cameraMode: 'follow' }); if (prevCam) camJump = Math.max(camJump, Math.hypot(cam.camX-prevCam.camX, cam.camY-prevCam.camY)); prevCam = cam; }
    ok(camJump < lay.w*0.06, `camera pans smoothly (max ${camJump.toFixed(1)}px per frame)`);
    // old renderers still draw the new scene
    for (const rid of ['canvas2d','wireframe']){ const c2 = canvasLib.createCanvas(w, h); MD.renderers[rid].drawFrame(c2.getContext('2d'), w, h, sc.getSceneAt(650), { teams: p.teams }); ok(true, rid+' renders'); }
  }
}

console.log(fails? `\n${fails} FAILURES` : '\nALL PHASE 2.5 TESTS PASSED');
process.exit(fails? 1 : 0);
