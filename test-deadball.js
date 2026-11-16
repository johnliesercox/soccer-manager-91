'use strict';
// Dead balls: once the ball has crossed the goal line it is dead, and play resumes only with the right restart.
//   timeline, over the matches of many league weeks (thousands of chances):
//     after every shot that goes wide or over, and every deflection that runs behind, the next thing that touches the
//     ball is the restart: a goal kick taken by the side defending that goal from its own goal area, or a corner only
//     when a defender's touch sent the ball behind; or the period ends with the ball dead. Nobody passes, carries,
//     tackles or shoots in between.
//   scene, over the matches of two weeks (sampled every tenth of a second):
//     a ball that is beyond the goal line stays dead and uncarried, and only comes back inside the pitch on a restart
//     key (a goal kick, a corner, a kick-off); it never rolls back into play to be collected.
//   node test-deadball.js
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const EV = MD.EVENT;
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; if (fails <= 40 || (msg.startsWith('scene') && fails <= 60)) console.log('FAIL', msg); } return c; };

function matches(weeks, seed){
  const out = []; const st = E.newGame({ seed, userClub: 3 });
  for (let w=0; w<weeks; w++){ const res = E.advanceWeek(st); for (let i=0; i<res.length; i+=2) out.push(MD.withTimeline(MD.capture(st, res[i], st.lastWeekInfo))); }
  return out;
}
const BALL = new Set([EV.PASS, EV.RUN, EV.CROSS, EV.INTERCEPTION, EV.TACKLE, EV.CLEARANCE, EV.SHOT_SAVED, EV.SHOT_WIDE, EV.SHOT_POST, EV.SHOT_BLOCKED, EV.GOAL, EV.DEFLECTION, EV.FOUL]);
const RESTART = new Set([EV.GOAL_KICK, EV.CORNER, EV.KICK_OFF, EV.SECOND_HALF, EV.ET_START]);
const BREAK = new Set([EV.HALF_TIME, EV.FULL_TIME, EV.ET_HALF, EV.ET_END, EV.PENALTIES]);

// ---- timeline ----
const T = { misses: 0, behind: 0, goalKicks: 0, corners: 0, whistle: 0, bad: 0 };
let matchCount = 0;
for (const seed of [1991, 7, 4242]){
  for (const p of matches(4, seed)){
    matchCount++;
    const H = p.teams.home.id, A = p.teams.away.id; const other = id => id===H? A : H;
    const ev = p.events;
    for (let i=0;i<ev.length;i++){
      const e = ev[i];
      // the ball goes behind: a miss, or a deflection to the goal line that is not a rebound
      const miss = e.type===EV.SHOT_WIDE;
      const behind = e.type===EV.DEFLECTION && !e.rebound && !e.keeperId && e.to && (e.to.x < 0.002 || e.to.x > 0.998);
      if (!miss && !behind) continue;
      if (miss) T.misses++; else T.behind++;
      const attacker = miss? e.teamId : other(e.teamId); const outT = e.matchSecond;   // a deflection is tagged with the deflecting side
      // the next event that touches the ball, and any restart or break before it
      let next = null, restart = null, brk = null;
      for (let j=i+1;j<ev.length;j++){
        const x = ev[j];
        if (RESTART.has(x.type) && !restart) restart = x;
        if (BREAK.has(x.type) && !brk) brk = x;
        if (BALL.has(x.type)){ next = x; break; }
        if (restart || brk) break;
      }
      const where = `${p.teams.home.name} v ${p.teams.away.name} ${Math.floor(outT/60)}:${String(Math.round(outT%60)).padStart(2,'0')} (${e.type}${e.miss? ' '+e.miss : ''})`;
      if (next && !restart && !brk){ T.bad++; ok(false, `${where}: the ball went behind, then ${next.type} at +${(next.matchSecond - outT).toFixed(1)}s with no restart`); continue; }
      if (brk && !restart){ T.whistle++; ok(brk.matchSecond >= outT, `${where}: the whistle came before the ball went behind`); continue; }
      ok(!!restart, `${where}: no restart and no whistle after the ball went behind`);
      if (!restart) continue;
      const seconds = restart.matchSecond - outT;
      ok(seconds >= 2 && seconds <= 8, `${where}: restart ${restart.type} ${seconds.toFixed(1)}s after the ball went behind`);
      if (restart.type===EV.GOAL_KICK){
        T.goalKicks++;
        ok(restart.teamId===other(attacker), `${where}: goal kick given to the attacking side`);
        // from their own goal area: within 6 m of their own goal line, inside the box width
        const dir = restart.at.x < 0.5? 1 : -1; const nearOwnLine = dir===1? restart.at.x : 1 - restart.at.x;
        ok(nearOwnLine*105 <= 7 && Math.abs(restart.at.y - 0.5)*68 <= 10, `${where}: goal kick taken from (${restart.at.x.toFixed(3)}, ${restart.at.y.toFixed(3)})`);
        ok(restart.playerId && p.players.find(x=>x.id===restart.playerId && x.teamId===restart.teamId), `${where}: goal kick taker is not on the restarting side`);
      } else if (restart.type===EV.CORNER){
        T.corners++;
        // a corner after a miss can only follow a defender's touch; a bare miss never earns one
        ok(!miss, `${where}: a corner after a shot that went straight wide`);
      } else {
        ok(false, `${where}: restart after the ball went behind was ${restart.type}`);
      }
    }
  }
}
console.log(`timeline: ${matchCount} matches, ${T.misses} misses and ${T.behind} deflections behind: ${T.goalKicks} goal kicks, ${T.corners} corners, ${T.whistle} ended by the whistle, ${T.bad} resumed without a restart`);

// ---- scene ----
const S = { samples: 0, outSpans: 0, carriedOut: 0, backInPlay: 0, maxOutMetres: 0 };
for (const p of matches(2, 1991)){
  const scene = MD.createScene(p); const dur = scene.duration; const byId = {}; for (const e of p.events) byId[e.id] = e;
  let wasOut = false, outSince = 0;
  for (let t = 0; t <= dur; t += 0.1){
    const s = scene.getSceneAt(t); const b = s.ball; S.samples++;
    const out = b.x < 0 || b.x > 1 || b.y < 0 || b.y > 1;
    if (out){
      if (!wasOut){ S.outSpans++; outSince = t; }
      ok(b.state==='dead' && !b.carrierId, `scene ${p.teams.home.name} v ${p.teams.away.name} ${t.toFixed(1)}s: ball out at (${b.x.toFixed(3)}, ${b.y.toFixed(3)}) but ${b.state}${b.carrierId? ' carried' : ''}`) || S.carriedOut++;
      const over = Math.max(b.x > 1? (b.x - 1)*105 : b.x < 0? -b.x*105 : 0, b.y > 1? (b.y - 1)*68 : b.y < 0? -b.y*68 : 0); if (over > S.maxOutMetres) S.maxOutMetres = over;
      ok(over <= 6, `scene ${p.teams.home.name} v ${p.teams.away.name} ${t.toFixed(1)}s: ball ${over.toFixed(1)} m beyond the line`);
    } else if (wasOut){
      // back inside only on a restart: the ball sits on a restart spot (goal area, corner arc, centre spot), placed
      const e = b.actionId? byId[b.actionId] : null; const restartNow = !!(e && RESTART.has(e.type) && t - e.matchSecond <= 0.2);
      if (!restartNow){ S.backInPlay++; ok(false, `scene ${p.teams.home.name} v ${p.teams.away.name} ${t.toFixed(1)}s: ball came back into play at (${b.x.toFixed(3)}, ${b.y.toFixed(3)}) ${b.state} without a restart, ${(t - outSince).toFixed(1)}s after going out`); }
    }
    wasOut = out;
  }
}
// and between a miss (or a deflection behind) and its restart the ball lies dead where it went out: nobody carries it,
// it does not roll back into play, it moves no more than its run-on
const D = { spells: 0, moved: 0, live: 0 };
for (const p of matches(2, 7)){
  const scene = MD.createScene(p); const ev = p.events; const H = p.teams.home.id, A = p.teams.away.id;
  for (let i=0;i<ev.length;i++){
    const e = ev[i];
    const miss = e.type===EV.SHOT_WIDE; const behind = e.type===EV.DEFLECTION && !e.rebound && !e.keeperId && e.to && (e.to.x < 0.002 || e.to.x > 0.998);
    if (!miss && !behind) continue;
    let until = null; for (let j=i+1;j<ev.length;j++){ const x = ev[j]; if (RESTART.has(x.type) || BREAK.has(x.type)){ until = x.matchSecond; break; } if (BALL.has(x.type)){ until = x.matchSecond - (x.duration||0); break; } }
    if (until===null) continue;
    D.spells++; let worst = 0, liveAt = null;
    for (let t = e.matchSecond + 1.0; t < until - 0.05; t += 0.1){
      const b = scene.getSceneAt(t).ball; const d = Math.hypot((b.x - e.to.x)*105, (b.y - e.to.y)*68); if (d > worst) worst = d;
      if ((b.state!=='dead' || b.carrierId) && liveAt===null) liveAt = { t, state: b.state, carrier: b.carrierId };
    }
    const where = `scene ${p.teams.home.name} v ${p.teams.away.name} ${Math.floor(e.matchSecond/60)}:${String(Math.round(e.matchSecond%60)).padStart(2,'0')} (${e.type}${e.miss? ' '+e.miss : ''})`;
    if (!ok(worst <= 4.5, `${where}: the dead ball moved ${worst.toFixed(1)} m before the restart ${(until - e.matchSecond).toFixed(1)}s later`)) D.moved++;
    if (!ok(!liveAt, liveAt? `${where}: the ball was ${liveAt.state}${liveAt.carrier? ' by '+liveAt.carrier : ''} at ${liveAt.t.toFixed(1)}s, before the restart at ${until}` : '')) D.live++;
  }
}
console.log(`scene: ${D.spells} dead-ball spells after a miss: ${D.moved} where the ball moved, ${D.live} where it was live or carried before the restart`);
console.log(`scene: ${S.samples} samples, ${S.outSpans} spells out of play, ${S.carriedOut} carried while out, ${S.backInPlay} came back without a restart, furthest ${S.maxOutMetres.toFixed(1)} m beyond the line`);
console.log(`${checks} checks, ${fails} failures`);
console.log(fails? 'DEAD BALL TESTS FAILED' : 'ALL DEAD BALL TESTS PASSED'); process.exit(fails? 1 : 0);
