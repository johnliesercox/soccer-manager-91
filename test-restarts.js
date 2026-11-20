'use strict';
// Restarts: over the matches of two league weeks, every kick-off (the first, after a goal, the second half, extra time)
// and every corner is checked against the laws as the scene draws them.
//   kick-offs: the conceding side restarts after a goal; at the restart every man is in his own half but the taker,
//              the receiving side is outside the centre circle, the ball is on the spot and still until it is kicked,
//              the celebration has finished, nobody drifts before the kick, and the camera has a cut there
//   corners:   the ball lies inside the one-metre quarter circle at the flag on the side the ball went out, still until
//              the kick; the taker stands beside it and the cross leaves from the arc; all four flags are used
//   node test-restarts.js
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const EV = MD.EVENT;
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } };
const PX = 105, PY = 68, CIRCLE = 9.15;
const dm = (a, b) => Math.hypot((a.x - b.x)*PX, (a.y - b.y)*PY);

function matches(){
  const out = []; const st = E.newGame({ seed: 1991, userClub: 3 });
  for (let w=0; w<2; w++){ const res = E.advanceWeek(st); for (let i=0; i<res.length; i+=2) out.push(MD.withTimeline(MD.capture(st, res[i], st.lastWeekInfo))); }
  return out;
}

const T = { kickoffs: 0, goals: 0, corners: 0, flags: new Set(), cornerSides: 0, wrongSide: 0, cornerBallMax: 0, cornerDrift: 0, untaken: 0, takerMax: 0, kickoffDrift: 0, celebLate: 0, offHalf: 0, inCircle: 0, wrongTaker: 0, noCut: 0, ballOff: 0, ballMoved: 0, quick: 0 };
for (const p of matches()){
  const scene = MD.createScene(p); const H = p.teams.home.id, A = p.teams.away.id; const other = id => id===H? A : H;
  const keys = scene.keyframes; const goals = p.events.filter(e=>e.type===EV.GOAL);
  const dirAt = (teamId, t) => scene.getSceneAt(t).attackDir[teamId];
  // ---- kick-offs ----
  for (const k of keys){
    if (k.kind!=='restart' || k.corner || Math.abs(k.x - 0.5) > 1e-6 || Math.abs(k.y - 0.5) > 1e-6) continue;   // the centre spot
    T.kickoffs++;
    const launch = keys[k.idx+1]; const kickT = launch && launch.kind==='launch'? launch.t : k.t + 1;
    const t0 = Math.min(k.t + 0.3, kickT - 0.05);               // after the placement, before the kick
    const s0 = scene.getSceneAt(t0);
    // after a goal: the side that conceded kicks off, and the celebration window has closed
    const g = goals.filter(x => x.matchSecond < k.t && k.t - x.matchSecond < 30).pop();
    if (g){ T.goals++; if (k.team!==other(g.teamId)) T.wrongTaker++; const win = scene.windows.find(w => w.kind==='celebration' && w.from <= k.t && w.to > k.t); if (win) T.celebLate++; if (k.t > 0 && !scene.cutTimes.includes(k.t)) T.noCut++; }
    // everyone in his own half but the taker; the receiving side outside the circle; the ball on the spot
    for (const q of s0.players){
      if (q.sentOff) continue; if (q.id===k.carrier) continue;
      const dir = dirAt(q.teamId, t0); const ax = dir===1? q.x : 1-q.x;
      if (ax > 0.5 + 0.3/PX) T.offHalf++;
      if (q.teamId!==k.team && dm(q, { x: 0.5, y: 0.5 }) < CIRCLE - 0.3) T.inCircle++;
    }
    if (dm(s0.ball, { x: 0.5, y: 0.5 }) > 0.3) T.ballOff++;
    if (kickT - k.t < 0.9) T.quick++;                            // a kick within a second of the cut reads as no restart at all
    // still until it is kicked: the ball on the spot, nobody but the taker and his first receiver moving more than a stride
    const sK = scene.getSceneAt(Math.max(t0, kickT - 0.05));
    if (dm(sK.ball, { x: 0.5, y: 0.5 }) > 0.35) T.ballMoved++;
    const nextArrive = launch? keys[launch.idx+1] : null;
    for (const q of s0.players){ if (q.sentOff || q.id===k.carrier || (nextArrive && q.id===nextArrive.carrier)) continue; const q2 = sK.players.find(x=>x.id===q.id); if (q2 && dm(q, q2) > 1.5) T.kickoffDrift++; }
  }
  // ---- corners ----
  for (const k of keys){
    if (!(k.kind==='restart' && k.corner)) continue;
    T.corners++;
    const flag = { x: k.x < 0.5? 0 : 1, y: k.y < 0.5? 0 : 1 }; T.flags.add(flag.x+','+flag.y);
    // A corner awarded in the last few seconds of a half is not always taken: the whistle goes first, and the next thing the ball
    // does is the kick-off. (The builder has always done this, about one corner in four hundred; the sample here did not happen to
    // hold one until the match pictures began to lean with the plans, when its matches were drawn differently.) Such a corner is
    // held to the same laws up to the whistle, and is not asked for a kick it never has.
    const next = keys[k.idx+1]; const whistle = !!(next && next.kind==='restart' && !next.corner); if (whistle) T.untaken++;
    const kick = whistle? null : next; const kickT = kick && kick.kind==='launch'? kick.t : whistle? Math.min(k.t + 2, next.t - 0.1) : k.t + 2;
    // where it went out: the arrival before the restart that put it behind
    const outKey = keys[k.idx-1];
    if (outKey){ T.cornerSides++; if ((outKey.y < 0.5) !== (k.y < 0.5)) T.wrongSide++; }
    // the ball inside the arc from the moment it is dead until the kick, and still
    let first = null;
    for (let t = outKey? outKey.t + 0.05 : k.t; t <= kickT - 0.05; t += 0.25){
      const s = scene.getSceneAt(t); const d = dm(s.ball, flag); T.cornerBallMax = Math.max(T.cornerBallMax, d);
      if (first===null) first = s.ball; else if (dm(first, s.ball) > 0.2) T.cornerDrift++;
    }
    // the taker beside the ball as he kicks it, within a stride, and the cross leaves the arc
    const sK = scene.getSceneAt(kickT - 0.02); const taker = sK.players.find(q=>q.id===(kick? kick.carrier : k.carrier));
    if (taker) T.takerMax = Math.max(T.takerMax, dm(taker, sK.ball));
    if (kick && dm(kick, flag) > 1.0) T.cornerBallMax = Math.max(T.cornerBallMax, dm(kick, flag));
  }
}
console.log(`${T.kickoffs} kick-offs (${T.goals} after a goal), ${T.corners} corners at ${T.flags.size} flags`);
console.log(`kick-offs: wrong side restarting ${T.wrongTaker}, celebration still running ${T.celebLate}, no cut ${T.noCut}, men in the wrong half ${T.offHalf}, receiving men inside the circle ${T.inCircle}, ball off the spot ${T.ballOff}, ball moved before the kick ${T.ballMoved}, men drifting before the kick ${T.kickoffDrift}`);
console.log(`corners: wrong flag for the side the ball went out ${T.wrongSide} of ${T.cornerSides}, ball furthest from the flag ${T.cornerBallMax.toFixed(2)} m, ball drifting before the kick ${T.cornerDrift}, taker furthest from the ball at the kick ${T.takerMax.toFixed(2)} m`);
ok(T.kickoffs >= 20 && T.goals >= 10 && T.corners >= 12, 'enough restarts sampled');
ok(T.wrongTaker===0, 'the side that conceded restarts after a goal ('+T.wrongTaker+' wrong)');
ok(T.celebLate===0, 'every celebration has finished before the restart ('+T.celebLate+' late)');
ok(T.noCut===0, 'every restart after a goal is a cut ('+T.noCut+' without)');
ok(T.offHalf===0, 'everyone but the taker in his own half at a kick-off ('+T.offHalf+' men over the line)');
ok(T.inCircle===0, 'the receiving side outside the centre circle ('+T.inCircle+' inside)');
ok(T.ballOff===0 && T.ballMoved===0, 'the ball on the centre spot and still until it is kicked ('+T.ballOff+' off, '+T.ballMoved+' moved)');
ok(T.kickoffDrift===0, 'nobody drifts before the kick-off ('+T.kickoffDrift+' men)');
ok(T.quick===0, 'a beat on the spot before every kick-off is taken ('+T.quick+' kicked within a second of the cut)');
ok(T.flags.size===4, 'corners are taken at all four flags ('+T.flags.size+')');
ok(T.wrongSide===0, 'the corner is at the flag on the side the ball went out ('+T.wrongSide+' wrong)');
ok(T.cornerBallMax <= 1.0, 'the ball lies inside the one-metre arc from the moment it is dead until the kick (furthest '+T.cornerBallMax.toFixed(2)+' m)');
ok(T.cornerDrift===0, 'the ball is still at the flag until the kick ('+T.cornerDrift+' moved)');
ok(T.takerMax <= 1.0, 'the taker is at the ball when he kicks it (furthest '+T.takerMax.toFixed(2)+' m)');
ok(T.untaken <= Math.max(1, Math.round(T.corners*0.05)), 'a corner goes untaken only when the whistle for the end of a half comes first, and rarely ('+T.untaken+' of '+T.corners+')');
console.log(checks+' checks, '+fails+' failures'); if (fails) process.exit(1); console.log('ALL RESTART TESTS PASSED');
