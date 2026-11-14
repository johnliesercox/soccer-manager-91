// ============================================================================
//  Ball-contact audit (Phase 3, Milestone 3C)
//  Measures, in the scene the renderers draw, whether the ball is where the
//  animation says it is at every contact: a kick leaves from the kicking foot,
//  a header is met by the head of a man who has jumped to it, a volley by a
//  raised foot, a catch lands in the keeper's hands, a parry on his
//  outstretched hand, a block on the blocker's body. For each contact it
//  takes the scene at the contact instant, works out the pose frame the
//  isometric renderer shows (the same rules as iso-actors.poseFor), places
//  that frame's skeleton in the world at the player's position and heading,
//  and measures the distance from the striking part to the ball, the ball's
//  height against the pose, whether the contact frame is the one showing,
//  and the ball's heading in the first fifth of a second after contact
//  against the flight it is meant to be on.
//
//    node tools/ball-audit.js [--matches 20] [--seed 1991] [--json out.json] [--worst 6]
//
//  Prints a table per contact class and the worst cases; --json writes the
//  whole measurement set (test-ball-contact.js reads the same functions).
// ============================================================================
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js')); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback']) require(path.join(__dirname, '..', 'src', 'matchday', f + '.js'));
for (const f of ['iso-projection']) require(path.join(__dirname, '..', 'src', 'matchday', 'renderers', f + '.js'));
require(path.join(__dirname, '..', 'src', 'matchday', 'sprites.js'));
require(path.join(__dirname, '..', 'src', 'matchday', 'iso-sprites.js'));
const MD = globalThis.Matchday; const EV = MD.EVENT; const PR = MD.iso.projection; const SP = MD.isoSprites;
const DIM = PR.DIM; const BALL_Z_M = PR.BALL_Z_M;

// ---- the renderer's choice of pose frame for a player record (mirrors iso-actors.poseFor, without the run cycle) ----
const JUMP = { base: 0.18, maxExtra: 0.55, headHeight: 1.7 };
function poseFor(pl){
  const ph = pl.actionPhase||0; const d = pl.actionDetail||{}; const v = d.variant||0;
  let pose = 'idle', frame = 0, lift = 0;
  switch (pl.action){
    case 'pass': case 'shoot': pose = pl.action==='pass'? 'kick' : 'shoot'; frame = ph < 0.42? 0 : ph < 0.66? 1 : ph < 0.86? 2 : 3; break;
    case 'volley': pose = 'volley'; frame = ph < 0.35? 0 : ph < 0.7? 1 : 2; break;
    case 'header': { pose = 'header'; frame = ph < 0.3? 0 : ph < 0.72? 1 : 2; const ballZ = (d.z||0)*BALL_Z_M; const h = JUMP.base + Math.max(0, Math.min(JUMP.maxExtra, ballZ - JUMP.headHeight)); lift = h*Math.max(0, Math.sin(Math.PI*Math.min(1, ph))); break; }
    case 'receive': pose = 'receive'; frame = ph < 0.45? 0 : 1; break;
    case 'tackle': if (d.slide===false){ pose = 'poke'; } else { pose = 'slide'; frame = ph < 0.3? 0 : 1; } break;
    case 'block': if (d.slide){ pose = 'slide'; frame = ph < 0.35? 0 : 1; } else pose = 'block'; break;
    case 'dive': if (d.parry){ pose = 'parry'; frame = ph < 0.6? 0 : 1; } else { pose = 'dive'; frame = ph < 0.25? 0 : ph < 0.7? 1 : 2; } break;
    case 'catch': pose = 'catch'; frame = ph < 0.5? 0 : 1; break;
    case 'set': pose = 'set'; break;
    case 'getup': pose = 'getup'; frame = ph < 0.5? 0 : 1; break;
    default: break;
  }
  return { pose, frame, lift };
}
// the renderer's heading for a player record (iso-actors.actorItem, without the hysteresis of the previous frame)
const AIMED = new Set(['pass','shoot','volley','header','dive','catch','tackle','block','receive']);
const angleTo = (pl, pt) => Math.atan2((pt.y - pl.y)*DIM.W, (pt.x - pl.x)*DIM.L);
function headingFor(pl){
  const act = pl.action||'none';
  if (pl.aim && AIMED.has(act) && Math.hypot((pl.aim.x - pl.x)*DIM.L, (pl.aim.y - pl.y)*DIM.W) > 0.4) return PR.dir8(angleTo(pl, pl.aim), 'S', 0);
  if (pl.facingAngle!==undefined) return PR.dir8(pl.facingAngle, 'S', 0);
  return 'S';
}
// the skeleton of (pose, frame) placed in the world: joints in metres {X, Y, Z}
function skeletonInWorld(pl, pose, frame, lift){
  const j = SP.pose(pose, frame); const dir = headingFor(pl); const a = SP.HEADING[dir];
  const m = PR.toMetres(pl.x, pl.y); const fx = Math.cos(a), fy = Math.sin(a), sx = -Math.sin(a), sy = Math.cos(a);
  const out = {};
  for (const k in j){ const v = j[k]; if (!Array.isArray(v)) continue; out[k] = { X: m.X + v[0]*fx + v[1]*sx, Y: m.Y + v[0]*fy + v[1]*sy, Z: v[2] + (lift||0) }; }
  out.dir = dir; return out;
}
const dist3 = (a, b) => Math.sqrt((a.X-b.X)**2 + (a.Y-b.Y)**2 + (a.Z-b.Z)**2);
const dist2 = (a, b) => Math.sqrt((a.X-b.X)**2 + (a.Y-b.Y)**2);
const ballWorld = b => { const m = PR.toMetres(b.x, b.y); return { X: m.X, Y: m.Y, Z: (b.z||0)*BALL_Z_M }; };

// ---- the contact classes ----
// each: which events, the contact instant, the player, the striking joints, the action expected and the frame that is the contact
const CLASSES = {
  kick:   { joints: ['footR','footL'], actions: ['pass','shoot'], frame: 1, maxDist: 0.6, zMax: 0.4 },
  header: { joints: ['head'], actions: ['header'], frame: 1, maxDist: 0.55, zMin: 1.3 },
  volley: { joints: ['footR','footL'], actions: ['volley'], frame: 1, maxDist: 0.6, zMin: 0.2, zMax: 1.3 },
  catch:  { joints: ['handR','handL'], actions: ['catch'], frame: 0, maxDist: 0.6 },
  parry:  { joints: ['handR','handL'], actions: ['dive'], frame: 0, maxDist: 0.75 },
  block:  { joints: ['footR','footL','kneeR','kneeL','pelvis','handR','handL'], actions: ['block'], frame: null, maxDist: 0.8 },
};
const isShot = t => t===EV.SHOT_SAVED || t===EV.SHOT_WIDE || t===EV.SHOT_BLOCKED || t===EV.SHOT_POST || t===EV.GOAL;

function contactsOf(p){
  const out = [];
  for (const e of p.events){
    if (!e.from || !e.duration) continue;
    const launch = Math.round((e.matchSecond - e.duration)*100)/100;
    const strikes = isShot(e.type) || e.type===EV.PASS || e.type===EV.CROSS || e.type===EV.CLEARANCE;
    if (strikes && e.playerId){
      const cls = e.technique==='header'? 'header' : e.technique==='volley'? 'volley' : 'kick';
      out.push({ cls, t: launch, playerId: e.playerId, e, phase: 'launch' });
    }
    if (e.type===EV.SHOT_SAVED && e.keeperId) out.push({ cls: e.save==='catch'? 'catch' : 'parry', t: e.matchSecond, playerId: e.keeperId, e, phase: 'arrive' });
    if (e.type===EV.SHOT_BLOCKED && e.blockerId) out.push({ cls: 'block', t: e.matchSecond, playerId: e.blockerId, e, phase: 'arrive' });
  }
  return out;
}

function measure(scene, c){
  const C = CLASSES[c.cls];
  const s = scene.getSceneAt(c.t); const pl = s.players.find(x=>x.id===c.playerId); if (!pl) return null;
  const ball = ballWorld(s.ball);
  const { pose, frame, lift } = poseFor(pl); const sk = skeletonInWorld(pl, pose, frame, lift);
  let best = Infinity, bestJ = null; for (const jn of C.joints){ if (!sk[jn]) continue; const d = dist3(sk[jn], ball); if (d < best){ best = d; bestJ = jn; } }
  const feet = { X: (sk.footL.X + sk.footR.X)/2, Y: (sk.footL.Y + sk.footR.Y)/2, Z: 0 };
  const ground = dist2({ X: PR.toMetres(pl.x, pl.y).X, Y: PR.toMetres(pl.x, pl.y).Y }, ball);
  const actionOk = C.actions.includes(pl.action);
  const frameOk = C.frame===null? true : (actionOk && frame===C.frame);
  const zOk = (C.zMin===undefined || ball.Z >= C.zMin) && (C.zMax===undefined || ball.Z <= C.zMax);
  // the ball's heading after a strike against the flight it is on (launches only)
  let headingErr = null;
  if (c.phase==='launch'){
    const s2 = scene.getSceneAt(c.t + 0.2); const b2 = ballWorld(s2.ball);
    const want = Math.atan2((c.e.to.y - c.e.from.y)*DIM.W, (c.e.to.x - c.e.from.x)*DIM.L);
    const got = Math.atan2(b2.Y - ball.Y, b2.X - ball.X);
    const moved = dist2(b2, ball);
    headingErr = moved < 0.3? null : Math.abs(((got - want + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI)*180/Math.PI;
  }
  return { cls: c.cls, t: c.t, matchId: scene.matchId, player: pl.name, playerId: pl.id, event: c.e.type, technique: c.e.technique||'', action: pl.action, phase: +(pl.actionPhase||0).toFixed(2), pose, frame, dir: sk.dir, joint: bestJ, dist: +best.toFixed(2), ground: +ground.toFixed(2), ballZ: +ball.Z.toFixed(2), lift: +(lift||0).toFixed(2), actionOk, frameOk, zOk, headingErr: headingErr===null? null : +headingErr.toFixed(0), pass: actionOk && frameOk && zOk && best <= C.maxDist && (headingErr===null || headingErr <= 25) };
}

function auditMatch(p){
  const scene = MD.createScene(p); scene.matchId = p.matchId;
  const rows = [];
  for (const c of contactsOf(p)){ const m = measure(scene, c); if (m) rows.push(m); }
  return rows;
}

function summarise(rows){
  const by = {};
  for (const r of rows){ (by[r.cls] = by[r.cls]||[]).push(r); }
  const q = (arr, f) => { const s = arr.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1, Math.floor(s.length*f))]; };
  const out = {};
  for (const cls in by){
    const list = by[cls]; const d = list.map(r=>r.dist);
    out[cls] = { n: list.length, pass: list.filter(r=>r.pass).length, actionOk: list.filter(r=>r.actionOk).length, frameOk: list.filter(r=>r.frameOk).length, zOk: list.filter(r=>r.zOk).length,
      headingOk: list.filter(r=>r.headingErr===null || r.headingErr <= 25).length, median: q(d, 0.5), p95: q(d, 0.95), max: Math.max(...d), maxDist: CLASSES[cls].maxDist,
      worst: list.slice().sort((a,b)=>b.dist-a.dist) };
  }
  return out;
}

// the matches: with a club, that club's first n matches (the ones a player of that club would watch, reproducible in
// the game from the seed); without, the first n matches of the world's first week(s)
function matches(seed, n, club){
  const st = E.newGame({ seed, userClub: club===undefined? 3 : club }); const pres = [];
  let guard = 0;
  while (pres.length < n && guard++ < 60){
    const res = E.advanceWeek(st);
    if (st.gameOver){ st.gameOver = null; st.sackOffer = null; st.clubs[st.userClub].confidence = E.CFG.CONF_START; st.clubs[st.userClub].overdraftWeeks = 0; }
    for (const m of res){
      if (pres.length >= n) break;
      const pr = MD.withTimeline(MD.capture(st, m, st.lastWeekInfo));
      if (club===undefined || pr.teams.home.clubId===club || pr.teams.away.clubId===club) pres.push(pr);
    }
  }
  return pres;
}

if (require.main === module){
  const arg = (k, d) => { const i = process.argv.indexOf('--'+k); return i>=0? process.argv[i+1] : d; };
  const N = +arg('matches', 20), seed = +arg('seed', 1991), worstN = +arg('worst', 6), jsonOut = arg('json', ''); const club = arg('club', ''); 
  const pres = matches(seed, N, club===''? undefined : +club); const rows = [];
  for (const p of pres) rows.push(...auditMatch(p));
  const sum = summarise(rows);
  console.log(`ball-contact audit: ${pres.length} matches (seed ${seed}${club!==''? ', club '+club+': '+pres.map(p=>p.matchId.replace('-league','')).join(' ') : ''}), ${rows.length} contacts\n`);
  console.log('class    n    pass   action  frame   height  heading  median   p95    max   limit');
  for (const cls of Object.keys(CLASSES)){ const s = sum[cls]; if (!s) continue;
    const pc = v => (100*v/s.n).toFixed(0).padStart(3)+'%';
    console.log(`${cls.padEnd(7)} ${String(s.n).padStart(4)}  ${pc(s.pass)}   ${pc(s.actionOk)}   ${pc(s.frameOk)}   ${pc(s.zOk)}    ${pc(s.headingOk)}   ${s.median.toFixed(2)}m  ${s.p95.toFixed(2)}m  ${s.max.toFixed(2)}m  ${s.maxDist.toFixed(2)}m`);
  }
  console.log('\nworst cases (distance from the striking part to the ball at the contact instant):');
  for (const cls of Object.keys(CLASSES)){ const s = sum[cls]; if (!s) continue;
    for (const r of s.worst.slice(0, worstN)) console.log(`  ${cls.padEnd(7)} ${r.matchId} t=${r.t} ${r.player} ${r.event}${r.technique? ' ('+r.technique+')' : ''} action=${r.action}@${r.phase} ${r.pose}/${r.frame} ${r.dir} ${r.joint}: ${r.dist}m (ground ${r.ground}m, ball z ${r.ballZ}m${r.lift? ', jump '+r.lift+'m' : ''})${r.headingErr!==null? ' heading off by '+r.headingErr+'°' : ''}${r.actionOk? '' : ' WRONG ACTION'}${r.frameOk? '' : ' WRONG FRAME'}${r.zOk? '' : ' WRONG HEIGHT'}`);
  }
  if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify({ seed, matches: pres.map(p=>p.matchId), rows, summary: Object.fromEntries(Object.entries(sum).map(([k,v])=>[k, Object.assign({}, v, { worst: v.worst.slice(0, 20) })])) }, null, 1));
}
module.exports = { contactsOf, measure, auditMatch, summarise, matches, CLASSES, poseFor, headingFor, skeletonInWorld };
