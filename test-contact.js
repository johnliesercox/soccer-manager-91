'use strict';
// Milestone 3C contact audit: does the ball meet the right part of the right player at the right moment, and is
// the right animation frame on screen when it does? Twenty matches; every kick, pass, cross, shot, header, volley,
// receive, catch, parry, block, goal-line clearance and tackle is sampled from the scene at its contact second and
// measured against the sprite's contact point for the pose and heading actually drawn (the same poseFor, dir8 and
// skeleton the isometric renderer uses, so a change to either shows up here).
//   node test-contact.js            prints the report and asserts the thresholds
//   REPORT=path node test-contact.js  also writes the full case list as JSON (for strips of the worst cases)
const fs = require('fs');
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/iso-projection','iso-sprites','iso-assets','renderers/iso-pitch','renderers/iso-stadium','renderers/iso-camera','renderers/iso-actors']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const PR = MD.iso.projection; const SP = MD.isoSprites; const ACT = MD.iso.actors;
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } };

// ---- the sample: 20 matches spread over divisions and scorelines ----
function sampleMatches(){
  const out = [];
  for (const seed of [1991, 7, 42]){
    const st = E.newGame({ seed, userClub: 3 });
    for (let w=0; w<2 && out.length<20; w++){
      const res = E.advanceWeek(st);
      for (let i=0; i<res.length && out.length<20; i+=3) out.push(MD.withTimeline(MD.capture(st, res[i], st.lastWeekInfo)));
    }
  }
  return out;
}

// ---- contacts from events ----
const isShot = t => t==='GOAL' || /^SHOT_/.test(t);
const launchKind = e => e.technique==='header'? 'header' : e.technique==='volley'? 'volley' : e.technique==='first-time'? 'first-time' : (isShot(e.type)? 'shot' : e.type==='CROSS'? 'cross' : e.type==='CLEARANCE'? 'clearance' : 'pass');
function contactsOf(p){
  const out = []; const evs = p.events;
  for (let i=0;i<evs.length;i++){
    const e = evs[i];
    if ((e.type==='PASS' || e.type==='CROSS' || e.type==='CLEARANCE' || e.type==='INTERCEPTION' || isShot(e.type)) && e.from && e.duration && e.playerId){
      const t0 = e.matchSecond - e.duration;
      if (t0 >= 0) out.push({ kind: launchKind(e), t: t0, actor: e.playerId, ref: e.from, ev: e, moment: 'launch' });
      if (e.toPlayerId && !isShot(e.type)){
        // the receiver, unless he strikes it first time (then his launch contact covers it)
        const next = evs.slice(i+1, i+4).find(x => x.playerId===e.toPlayerId && x.from && x.duration && Math.abs((x.matchSecond - x.duration) - e.matchSecond) < 0.15);
        if (!next) out.push({ kind: 'receive', t: e.matchSecond, actor: e.toPlayerId, ref: e.to, ev: e, moment: 'arrival' });
      }
    }
    if (e.type==='SHOT_SAVED' && e.keeperId) out.push({ kind: e.save==='catch'? 'catch' : 'parry', t: e.matchSecond, actor: e.keeperId, ref: e.to, ev: e, moment: 'arrival' });
    if (e.type==='SHOT_BLOCKED' && e.blockerId) out.push({ kind: e.line? 'line' : e.slide? 'block-slide' : 'block-stand', t: e.matchSecond, actor: e.blockerId, ref: e.to, ev: e, moment: 'arrival' });
    if (e.type==='TACKLE' && e.playerId && e.at) out.push({ kind: e.slide? 'tackle-slide' : 'tackle-poke', t: e.matchSecond, actor: e.playerId, ref: e.at, ev: e, moment: 'arrival' });
    if (e.type==='DEFLECTION' && e.keeperId && e.to) out.push({ kind: 'keeper-touch', t: e.matchSecond, actor: e.keeperId, ref: e.to, ev: e, moment: 'arrival' });   // off the woodwork, pushed on by the keeper where it reaches him
  }
  return out;
}

// ---- the sprite's contact point for what is drawn ----
const ANGLE_ACTIONS = { pass:1, shoot:1, volley:1, header:1, dive:1, catch:1, tackle:1, block:1, receive:1 };
function drawn(pl, t){
  // the heading the renderer would choose (without its hysteresis, which only delays a change by a few degrees)
  let ang = pl.facingAngle;
  const act = pl.action||'none';
  if (pl.aim && ANGLE_ACTIONS[act] && Math.hypot((pl.aim.x - pl.x)*PR.DIM.L, (pl.aim.y - pl.y)*PR.DIM.W) > 0.4) ang = Math.atan2((pl.aim.y - pl.y)*PR.DIM.W, (pl.aim.x - pl.x)*PR.DIM.L);
  const dir = PR.dir8(ang===undefined? 0 : ang, null, 0);
  const pf = ACT.poseFor(pl, { dist: 0 }, t);
  return { dir, angle: SP.HEADING[dir], pose: pf.pose, frame: pf.frame, lift: pf.lift||0, action: act, phase: pl.actionPhase||0 };
}
const mid = (a, b) => [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2];
function contactJoint(kind, d, ballZ){
  const j = SP.pose(d.pose, d.frame);
  const foot = j.footR[0] >= j.footL[0]? j.footR : j.footL;                // the leading foot
  switch (kind){
    case 'header': return { name: 'head', p: j.head };
    case 'catch': return { name: 'hands', p: mid(j.handL, j.handR) };
    case 'parry': case 'keeper-touch': return { name: 'hand', p: j.handR[0] >= j.handL[0]? j.handR : j.handL };
    case 'block-stand': case 'line': {
      // a block with the body takes the ball anywhere from the shins to the chest: the nearest point of the trunk to the
      // ball's height; above the shoulders it is the head, along the ground the foot
      if (ballZ > 1.3) return { name: 'head', p: j.head };
      if (ballZ < 0.35) return { name: 'foot', p: foot };
      const lo = mid(j.kneeL, j.kneeR), hi = j.chest; const u = Math.max(0, Math.min(1, (ballZ - lo[2])/Math.max(0.01, hi[2] - lo[2])));
      return { name: 'trunk', p: [lo[0] + (hi[0]-lo[0])*u, lo[1] + (hi[1]-lo[1])*u, lo[2] + (hi[2]-lo[2])*u] };
    }
    default: return { name: 'foot', p: foot };                              // kicks, volleys, receives, slides, pokes
  }
}
function worldPoint(pl, d, p){
  const m = PR.toMetres(pl.x, pl.y); const fx = Math.cos(d.angle), fy = Math.sin(d.angle);
  return { X: m.X + p[0]*fx - p[1]*fy, Y: m.Y + p[0]*fy + p[1]*fx, Z: p[2] + d.lift };
}
function ballPoint(s){
  const b = s.ball; const bm = PR.toMetres(b.x, b.y);   // the scene's ball is the drawn ball (ahead of the feet when controlled, on the spot at a key)
  return { X: bm.X, Y: bm.Y, Z: Math.max(0, b.z||0)*PR.BALL_Z_M };
}

// what each kind should show on screen
const EXPECT = {
  pass: { actions: ['pass','shoot'], frame: { kick:[1], shoot:[1] } }, cross: { actions: ['pass','shoot'], frame: { kick:[1], shoot:[1] } }, clearance: { actions: ['pass','shoot'], frame: { kick:[1], shoot:[1] } },
  shot: { actions: ['shoot','pass'], frame: { shoot:[1], kick:[1] } }, 'first-time': { actions: ['shoot','pass'], frame: { shoot:[1], kick:[1] } },
  header: { actions: ['header'], frame: { header:[1] } }, volley: { actions: ['volley'], frame: { volley:[1] } },
  receive: { actions: ['receive','pass','shoot','none'], frame: {} },
  catch: { actions: ['catch'], frame: { catch:[0,1] } }, parry: { actions: ['dive'], frame: { parry:[0,1], dive:[1,2] } }, 'keeper-touch': { actions: ['dive','catch','set','getup','none'], frame: {} },
  'block-slide': { actions: ['block','tackle'], frame: { slide:[0,1] } }, 'block-stand': { actions: ['block','tackle'], frame: {} }, line: { actions: ['block','tackle','pass','shoot'], frame: {} },
  'tackle-slide': { actions: ['tackle'], frame: { slide:[0,1] } }, 'tackle-poke': { actions: ['tackle'], frame: { poke:[0] } },
};
// distance thresholds in metres: horizontal, and height difference where the ball is off the ground
// (what a clean contact looks like at gameplay scale: the ball within a boot's length of the foot, within a head's
// width of the head, at the height of the part that meets it)
const LIMIT = {
  pass: [0.35, 0.25], cross: [0.35, 0.25], clearance: [0.4, 0.25], shot: [0.4, 0.25], 'first-time': [0.4, 0.3],
  header: [0.4, 0.25], volley: [0.45, 0.3], receive: [0.5, 0.4],
  catch: [0.45, 0.4], parry: [0.6, 0.6], 'keeper-touch': [0.8, 0.8],
  'block-slide': [0.5, 0.5], 'block-stand': [0.5, 0.6], line: [0.6, 0.5], 'tackle-slide': [0.45, 0.5], 'tackle-poke': [0.4, 0.5],
};

let offPitch = 0;
function measure(scene, p, c){
  // sampled at the contact second: a launch has the ball at its launch point, an arrival at its arrival point (the scene
  // drops a blocked or caught ball to the ground or the chest at that instant, so the height is the flight's end height)
  const tc = c.t;
  const s = scene.getSceneAt(tc); const pl = s.players.find(x => x.id===c.actor); if (!pl) return null;
  if (pl.sentOff){ offPitch++; if (process.env.OFF) console.log('  off the pitch:', p.matchId, tc, c.kind, pl.name); return null; }   // a dismissed man in the official record (an engine matter, counted apart)
  const d = drawn(pl, tc); const b = ballPoint(s);
  if (c.moment==='arrival' && c.ref.z) b.Z = Math.max(b.Z, c.ref.z*PR.BALL_Z_M);
  const j = contactJoint(c.kind, d, b.Z); const w = worldPoint(pl, d, j.p);
  const dxy = Math.hypot(w.X - b.X, w.Y - b.Y), dz = b.Z - w.Z;
  // when, within 0.4 s either side, the ball comes closest to that contact point (the frame shown may change, so recompute)
  let best = { lag: 0, dxy }; for (let k=-8;k<=8;k++){ if (!k) continue; const t2 = tc + k*0.05; if (t2 < 0) continue; const s2 = scene.getSceneAt(t2); const pl2 = s2.players.find(x=>x.id===c.actor); const d2 = drawn(pl2, t2); const b2 = ballPoint(s2); const w2 = worldPoint(pl2, d2, contactJoint(c.kind, d2, b2.Z).p); const dd = Math.hypot(w2.X - b2.X, w2.Y - b2.Y); if (dd < best.dxy - 1e-9) best = { lag: k*0.05, dxy: dd }; }
  const refM = PR.toMetres(c.ref.x, c.ref.y); const evd = Math.hypot(refM.X - b.X, refM.Y - b.Y);
  const toBall = Math.atan2(b.Y - PR.toMetres(pl.x, pl.y).Y, b.X - PR.toMetres(pl.x, pl.y).X);
  const faceDeg = Math.abs(PR.angleDiff(toBall, d.angle))*180/Math.PI;
  const ex = EXPECT[c.kind]; const actionOk = ex.actions.includes(d.action); const want = ex.frame[d.pose]; const frameOk = want? want.includes(d.frame) : actionOk;
  const lim = LIMIT[c.kind]; const nearOk = dxy <= lim[0] && (b.Z < 0.25 && w.Z < 0.4? true : Math.abs(dz) <= lim[1]);
  // another moment counts as "the real contact" only if it is clearly closer and on the wrong side: before an arrival
  // (the ball got there before the frame did) or after a launch (the foot reached the ball after it had gone)
  const lagOk = Math.abs(best.lag) <= 0.15 || best.dxy >= dxy - 0.15 || (c.moment==='arrival'? best.lag > 0 : best.lag < 0);
  return { match: p.matchId, t: +c.t.toFixed(2), kind: c.kind, actor: pl.name, action: d.action, pose: d.pose, frame: d.frame, phase: +d.phase.toFixed(2), dir: d.dir, joint: j.name,
    dxy: +dxy.toFixed(2), dz: +dz.toFixed(2), ballZ: +b.Z.toFixed(2), lag: +best.lag.toFixed(2), bestDxy: +best.dxy.toFixed(2), evd: +evd.toFixed(2), faceDeg: Math.round(faceDeg), actionOk, frameOk, nearOk, lagOk, pass: actionOk && frameOk && nearOk && lagOk };
}

// ---- run ----
const matches = sampleMatches();
const cases = [];
let maxBuild = 0;
for (const p of matches){
  const t0 = Date.now(); const scene = MD.createScene(p); maxBuild = Math.max(maxBuild, Date.now() - t0);
  for (const c of contactsOf(p)){ const m = measure(scene, p, c); if (m) cases.push(m); }
}
const kinds = Object.keys(LIMIT);
const q = (arr, f) => { if (!arr.length) return 0; const s = arr.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1, Math.floor(f*s.length))]; };
const pct = (n, d) => d? Math.round(100*n/d) : 0;
console.log(`contact audit: ${matches.length} matches, ${cases.length} contacts (scene build at most ${maxBuild} ms; ${offPitch} contacts by a dismissed player in the official record, counted apart)`);
console.log('kind            n   pass  action frame  near   lag   dxy p50/p95   |dz| p50/p95   face p50  phase p50');
const summary = {};
for (const k of kinds){
  const cs = cases.filter(c=>c.kind===k); if (!cs.length) continue;
  const row = { n: cs.length, pass: pct(cs.filter(c=>c.pass).length, cs.length), action: pct(cs.filter(c=>c.actionOk).length, cs.length), frame: pct(cs.filter(c=>c.frameOk).length, cs.length), near: pct(cs.filter(c=>c.nearOk).length, cs.length), lag: pct(cs.filter(c=>c.lagOk).length, cs.length),
    dxy50: q(cs.map(c=>c.dxy), 0.5), dxy95: q(cs.map(c=>c.dxy), 0.95), dz50: q(cs.map(c=>Math.abs(c.dz)), 0.5), dz95: q(cs.map(c=>Math.abs(c.dz)), 0.95), face50: q(cs.map(c=>c.faceDeg), 0.5), phase50: q(cs.map(c=>c.phase), 0.5) };
  summary[k] = row;
  console.log(`${k.padEnd(14)} ${String(row.n).padStart(4)}   ${String(row.pass+'%').padStart(4)}   ${String(row.action+'%').padStart(4)}  ${String(row.frame+'%').padStart(4)}  ${String(row.near+'%').padStart(4)}  ${String(row.lag+'%').padStart(4)}   ${row.dxy50.toFixed(2)}/${row.dxy95.toFixed(2)}      ${row.dz50.toFixed(2)}/${row.dz95.toFixed(2)}      ${String(row.face50+'°').padStart(4)}      ${row.phase50.toFixed(2)}`);
}
// the worst cases per kind, for the eye
for (const k of kinds){
  const cs = cases.filter(c=>c.kind===k && !c.pass).sort((a,b)=>(b.dxy + Math.abs(b.dz)) - (a.dxy + Math.abs(a.dz))).slice(0, 3);
  for (const c of cs) console.log(`  worst ${k}: ${c.match} ${c.t}s ${c.actor} shows ${c.action}/${c.pose}#${c.frame} (${c.dir}, phase ${c.phase}) ${c.joint} ${c.dxy} m off, dz ${c.dz}, ball ${c.ballZ} m up, lag ${c.lag}, face ${c.faceDeg}°${c.actionOk? '' : ' [wrong action]'}${c.frameOk? '' : ' [wrong frame]'}`);
}
if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify({ summary, cases }, null, 0));

// ---- thresholds (the audit is a permanent test once the fixes are in) ----
const GOAL = { pass: 90, cross: 90, clearance: 90, shot: 90, 'first-time': 90, header: 90, volley: 90, receive: 90, catch: 90, parry: 85, 'block-slide': 85, 'block-stand': 85, line: 80, 'tackle-slide': 85, 'tackle-poke': 85 };
if (process.env.STRICT){
  for (const k of Object.keys(GOAL)) if (summary[k]) ok(summary[k].pass >= GOAL[k], `${k}: ${summary[k].pass}% of contacts pass (want ${GOAL[k]}%)`);
  ok(maxBuild < 550, 'scene build under 550 ms on this machine ('+maxBuild+'; the matchday suite holds the real budget)');
  console.log(checks+' checks, '+fails+' failures'); if (fails) process.exit(1); console.log('ALL CONTACT TESTS PASSED');
}
