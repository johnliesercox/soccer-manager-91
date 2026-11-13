// ============================================================================
//  Matchday: scene model
//  createScene(presentation) returns an object whose getSceneAt(second) gives
//  the state of the pitch at any match second: where every player, the
//  referee and the ball are, who has possession, what each player is doing
//  (action and phase), how fast they move, the phase of the match and the
//  score as it stood at that moment. It is deterministic and random-access:
//  the same second always gives the same scene whatever was sampled before.
//
//  How it is built (once, at createScene):
//    1. ball keyframes from the timeline's events (this file);
//    2. set-piece targets for corners and goal celebrations (this file);
//    3. behaviour.js decides roles and targets tick by tick, trajectories.js
//       turns them into bounded paths in metres per second, recorded for the
//       whole match;
//    4. interactions.js decides when a loose ball is really under control,
//       and the action beats (pass, shoot, receive, tackle, block, dive, set,
//       celebrate, booked) every renderer animates.
//
//  Renderers consume scenes and nothing else. Coordinates are absolute (0..1
//  across the pitch; 105 x 68 m); the home side attacks towards x = 1 in the
//  first half and the scene mirrors formations after half-time.
// ============================================================================
(function(root){
  const MD = root.Matchday; const EV = MD.EVENT; const P = MD.PERIODS; const B = MD.behaviour;

  const PHASE_LABEL = { pre:'Kick-off', firstHalf:'First half', halfTime:'Half-time', secondHalf:'Second half', fullTime:'Full time', extraTime1:'Extra time', etBreak:'Extra time break', extraTime2:'Extra time', etEnd:'End of extra time', penalties:'Penalties', final:'Full time' };
  const POSSESSION_EASE = 2.5;        // seconds for a shape to switch between attacking and defending
  const lerp = (a,b,t) => a + (b-a)*t;
  const smooth = t => t<0? 0 : t>1? 1 : t*t*(3-2*t);
  const ANIM_ALIAS = { pass:'kick', shoot:'shoot', dive:'dive', tackle:'slide', block:'block', receive:'receive', set:'set', celebrate:'celebrate', booked:'booked' };
  const movementOf = s => s < 0.5? 'idle' : s < 2.4? 'walk' : s < 4.8? 'jog' : s < 7.2? 'run' : 'sprint';

  function lastIndex(arr, t, get){ // last i with get(arr[i]) <= t, binary search
    let lo = 0, hi = arr.length-1, ans = -1;
    while (lo<=hi){ const mid = (lo+hi)>>1; if (get(arr[mid])<=t){ ans = mid; lo = mid+1; } else hi = mid-1; }
    return ans;
  }

  function createScene(p){
    if (!p.events) throw new Error('createScene needs a presentation with events');
    const H = p.teams.home.id, A = p.teams.away.id;
    const other = id => id===H? A : H;
    const players = p.players; const index = {}; players.forEach((pl,i)=>{ index[pl.id] = i; });
    const byId = {}; for (const pl of players) byId[pl.id] = pl;
    const gkOf = {}; for (const pl of players) if (pl.role==='GK' && !gkOf[pl.teamId]) gkOf[pl.teamId] = pl.id;
    const teamOf = id => players.filter(x=>x.teamId===id);
    const dirAt = (teamId, t) => (teamId===H? (t >= P.regulation.half? -1 : 1) : (t >= P.regulation.half? 1 : -1));
    const toAbs = (teamId, t, ax, y) => ({ x: dirAt(teamId, t)===1? ax : 1-ax, y });
    const end = p.official.extra? P.extraTime.end : P.regulation.end;

    // ---- dismissals: who is off from when, and the formation of the ten that remain ----
    const offs = p.events.filter(e=>e.type===EV.SENT_OFF && e.playerId);
    const offTime = {}; for (const o of offs) offTime[o.playerId] = o.matchSecond;
    const offAt = (id, t) => offTime[id]!==undefined && t >= offTime[id];
    const offSpot = id => ({ x: byId[id].teamId===H? 0.3 : 0.7, y: 1.04 });
    // a dismissed keeper is replaced in goal by a defender (the XI has no substitute to bring on)
    const anchorSets = [{ t: 0, anchors: MD.formationAnchors(players), roles: {} }];
    for (const o of offs){
      const remaining = players.filter(x=>!(offTime[x.id]!==undefined && offTime[x.id] <= o.matchSecond));
      const roles = Object.assign({}, anchorSets[anchorSets.length-1].roles);
      for (const teamId of [H, A]){ if (!remaining.some(x=>x.teamId===teamId && (roles[x.id]||x.role)==='GK')){ const d = remaining.find(x=>x.teamId===teamId && (roles[x.id]||x.role)==='DEF') || remaining.find(x=>x.teamId===teamId); if (d) roles[d.id] = 'GK'; } }
      const a = MD.formationAnchors(remaining.map(x=>roles[x.id]? Object.assign({}, x, { role: roles[x.id] }) : x));
      for (const pl of players) if (!a[pl.id]) a[pl.id] = anchorSets[0].anchors[pl.id];
      anchorSets.push({ t: o.matchSecond, anchors: a, roles });
    }
    const setAt = t => anchorSets[Math.max(0, lastIndex(anchorSets, t, s=>s.t))];
    const anchorsAt = t => setAt(t).anchors;
    const roleAt = (i, t) => setAt(t).roles[players[i].id] || players[i].role;
    const formations = anchorSets[0].anchors.formations || {};
    const offSoFar = new Set();
    const on = x => !offSoFar.has(x.id);
    const kicker = teamId => { const f = players.find(x=>x.teamId===teamId && x.role==='FWD' && on(x)) || players.find(x=>x.teamId===teamId && x.role!=='GK' && on(x)); return f? f.id : null; };
    const anyOf = (teamId, role) => { const f = players.find(x=>x.teamId===teamId && x.role===role && on(x)) || players.find(x=>x.teamId===teamId && on(x)); return f? f.id : null; };

    // ---- ball keyframes: {t, x, y, carrier, team, kind, ...} ----
    const keys = [];
    const key = (t, pos, carrier, team, kind, extra) => { const k = { t, x: pos.x, y: pos.y, carrier: (carrier && !offSoFar.has(carrier))? carrier : null, team: team||null, kind: kind||'hold' }; if (extra) Object.assign(k, extra); keys.push(k); return k; };
    const centre = { x:0.5, y:0.5 };
    const cornerKeys = [], goalKeys = [];
    for (const e of p.events){
      const d = e.duration||0;
      switch (e.type){
        case EV.SENT_OFF: offSoFar.add(e.playerId); break;
        case EV.KICK_OFF: case EV.SECOND_HALF: case EV.ET_START: key(e.matchSecond, centre, e.playerId||kicker(e.teamId), e.teamId, 'restart', e.type!==EV.KICK_OFF? { cut:true } : null); break;
        case EV.PASS: case EV.RUN: key(e.matchSecond-d, e.from, e.playerId, e.teamId, 'launch', { eventId: e.id }); key(e.matchSecond, e.to, e.type===EV.RUN? e.playerId : e.toPlayerId, e.teamId, 'arrive', { eventId: e.id }); break;
        case EV.DEFLECTION: key(e.matchSecond-d, e.from, e.playerId, e.teamId, 'launch', { parry:true, eventId: e.id }); key(e.matchSecond, e.to, null, e.teamId, 'arrive', { out:true, eventId: e.id }); break;
        case EV.SHOT_SAVED: key(e.matchSecond-d, e.from, e.playerId, e.teamId, 'launch', { shot:true, eventId: e.id }); key(e.matchSecond, e.to, e.keeperId||null, e.teamId, 'arrive', { save:true, eventId: e.id }); break;
        case EV.SHOT_WIDE: key(e.matchSecond-d, e.from, e.playerId, e.teamId, 'launch', { shot:true, eventId: e.id }); key(e.matchSecond, e.to, null, e.teamId, 'arrive', { out:true, eventId: e.id }); break;
        case EV.SHOT_BLOCKED: key(e.matchSecond-d, e.from, e.playerId, e.teamId, 'launch', { shot:true, eventId: e.id }); key(e.matchSecond, e.to, e.blockerId||null, e.blockerId? other(e.teamId) : e.teamId, e.blockerId? 'hold' : 'arrive', { block: !!e.blockerId, eventId: e.id }); break;
        case EV.GOAL: if (e.from && e.to){ key(e.matchSecond-d, e.from, e.playerId, e.teamId, 'launch', { shot:true, eventId: e.id }); goalKeys.push(key(e.matchSecond, e.to, null, e.teamId, 'goal', { scorer: e.playerId||null, eventId: e.id })); } break;
        case EV.CORNER: cornerKeys.push(key(e.matchSecond, e.at, e.playerId||anyOf(e.teamId,'MID'), e.teamId, 'restart', { corner:true, eventId: e.id })); break;
        case EV.GOAL_KICK: key(e.matchSecond, e.at, e.playerId||gkOf[e.teamId]||null, e.teamId, 'restart', { eventId: e.id }); break;
        case EV.TACKLE: key(e.matchSecond, e.at, e.playerId, e.teamId, 'hold', { tackle:true, eventId: e.id }); break;
        case EV.CLEARANCE: key(e.matchSecond, e.at, e.playerId, e.teamId, 'hold', { eventId: e.id }); break;
        case EV.FOUL: key(e.matchSecond, e.at, null, e.teamId, 'hold', { eventId: e.id }); break;
        default: break;
      }
    }
    keys.forEach((k,i)=>{ k.i = i; });
    keys.sort((a,b)=>a.t-b.t || a.i-b.i);
    keys.forEach((k,i)=>{ k.idx = i; delete k.i; });
    const cutTimes = keys.filter(k=>k.cut).map(k=>k.t);
    const cutFloor = t => { let f = 0; for (const c of cutTimes){ if (c<=t) f = c; else break; } return f; };
    // possession changes with the eased value each blend starts from, so a quick turnover never jumps
    const possChanges = [];
    for (let i=0;i<keys.length;i++){ if (keys[i].team && (i===0 || keys[i].team!==keys[i-1].team)) possChanges.push({ t: keys[i].t, team: keys[i].team }); }
    { let sH = 0.5, sA = 0.5; for (let i=0;i<possChanges.length;i++){ const c = possChanges[i]; if (i>0){ const pc = possChanges[i-1]; const u = smooth((c.t - pc.t)/POSSESSION_EASE); sH = lerp(pc.startH, pc.team===H? 1 : 0, u); sA = lerp(pc.startA, pc.team===A? 1 : 0, u); } c.startH = sH; c.startA = sA; } }
    const attackAt = (teamId, t) => { const i = lastIndex(possChanges, t, c=>c.t); if (i<0) return 0.5; const c = possChanges[i]; const u = smooth((t - c.t)/POSSESSION_EASE); return lerp(teamId===H? c.startH : c.startA, c.team===teamId? 1 : 0, u); };
    const carries = {}; for (const pl of players) carries[pl.id] = [];
    keys.forEach((k,i)=>{ if (k.carrier && carries[k.carrier]) carries[k.carrier].push(i); });

    // ---- set pieces: target spots and speed bands for a window of time ----
    const windows = [];
    const jitter = (seed, i) => ((MD.hashString(seed+':'+i) % 1000)/1000 - 0.5);
    for (const ck of cornerKeys){
      const kick = keys[ck.idx+1]; const kickAt = kick? Math.min(kick.t, ck.t + 12) : ck.t + 8;
      const att = ck.team, def = other(att), t = ck.t;
      const targets = {}, band = {};
      const near = ck.y < 0.5;
      const attackers = teamOf(att).filter(x=>x.role!=='GK' && x.id!==ck.carrier && !offAt(x.id, t));
      if (ck.carrier){ targets[ck.carrier] = { x: ck.x, y: ck.y }; band[ck.carrier] = B.BAND.RUN; }
      const box = attackers.filter(x=>x.role==='FWD').concat(attackers.filter(x=>x.role==='DEF').slice(0,2)).concat(attackers.filter(x=>x.role==='MID').slice(0,1)).slice(0,5);
      box.forEach((pl,i)=>{ const ax = 0.9 + jitter(p.matchId+'c', i)*0.06, y = 0.36 + i*0.07 + jitter(p.matchId+'cy', i)*0.04; targets[pl.id] = toAbs(att, t, ax, y); band[pl.id] = B.BAND.RUN; });
      const edge = attackers.filter(x=>!box.includes(x)).filter(x=>x.role!=='DEF').slice(0,2);
      edge.forEach((pl,i)=>{ targets[pl.id] = toAbs(att, t, 0.78, i? 0.68 : 0.32); band[pl.id] = B.BAND.JOG; });
      const markers = teamOf(def).filter(x=>x.role!=='GK' && x.role!=='FWD' && !offAt(x.id, t)).slice(0,8);
      markers.forEach((pl,i)=>{ const ax = 0.075 + jitter(p.matchId+'d', i)*0.05, y = 0.33 + i*0.05 + jitter(p.matchId+'dy', i)*0.04; targets[pl.id] = toAbs(def, t, ax, y); band[pl.id] = B.BAND.RUN; });
      if (gkOf[def]){ targets[gkOf[def]] = toAbs(def, t, 0.025, 0.5 + (near? -0.03 : 0.03)); band[gkOf[def]] = B.BAND.JOG; }
      windows.push({ from: t - 7, to: kickAt + 0.4, targets, band, anim: {}, kind:'corner' });
    }
    for (const gk of goalKeys){
      const restart = keys.slice(gk.idx+1).find(k=>k.kind==='restart');
      const to = restart? restart.t - 0.5 : gk.t + 4.5;
      if (to - gk.t < 4) continue;   // a goal right before a whistle: no time to celebrate
      const team = gk.team, t = gk.t;
      const scorer = gk.scorer && byId[gk.scorer]? byId[gk.scorer] : null;
      const targets = {}, band = {}, anim = {};
      if (scorer){
        const shot = keys[gk.idx-1]; const sx = shot? shot.x : gk.x, sy = shot? shot.y : gk.y;
        const dir = dirAt(team, t); const sideY = sy < 0.5? 0.16 : 0.84;
        const tx = Math.max(0.05, Math.min(0.95, sx - dir*0.2));
        targets[scorer.id] = { x: tx, y: sideY }; band[scorer.id] = B.BAND.SPRINT; anim[scorer.id] = 'celebrate';
        const mates = teamOf(team).filter(x=>x.id!==scorer.id && x.role!=='GK' && !offAt(x.id, t))
          .map(x=>({ x, d: Math.hypot(anchorsAt(t)[x.id].x - anchorsAt(t)[scorer.id].x, anchorsAt(t)[x.id].y - anchorsAt(t)[scorer.id].y) })).sort((a,b)=>a.d-b.d).slice(0,3).map(o=>o.x);
        mates.forEach((pl,i)=>{ targets[pl.id] = { x: Math.max(0.05, Math.min(0.95, tx + dir*0.035*(i+1))), y: sideY + (sideY<0.5? 1 : -1)*(0.035 + 0.03*i) }; band[pl.id] = B.BAND.RUN; anim[pl.id] = 'celebrate'; });
      }
      const beaten = gkOf[other(team)]; if (beaten){ targets[beaten] = { x: gk.x, y: gk.y }; band[beaten] = B.BAND.JOG; }
      windows.push({ from: t, to, targets, band, anim, kind:'celebration' });
    }
    windows.sort((a,b)=>a.from-b.from);
    const windowAt = t => { const i = lastIndex(windows, t, w=>w.from); const w = i>=0? windows[i] : null; return (w && t<=w.to)? w : null; };

    // ---- the context the planner, trajectories and interactions share ----
    const offTimeOf = id => offTime[id]===undefined? null : offTime[id];
    const offTimeIdx = players.map(pl=>offTimeOf(pl.id));
    const offAtIdx = (i, t) => offTimeIdx[i]!==null && t >= offTimeIdx[i];
    const ctx = { p, events: p.events, players, index, byId, H, A, other, gkOf, keys, carries, windows, windowAt, cutTimes, cutFloor, end, anchorsAt, roleAt, offAt, offAtIdx, offTimeOf, offSpot, dirAt, attackAt, lastIndex };
    ctx.ballAt = t => MD.interactions.ballAt(ctx, t);
    const traj = MD.trajectories.build(ctx);
    MD.interactions.controlTimes(ctx, traj);
    const cues = MD.interactions.actions(ctx);

    // referee signals
    const signals = [];
    for (const e of p.events){
      if (e.type===EV.GOAL) signals.push({ from: e.matchSecond, to: e.matchSecond+2.5, signal:'goal' });
      else if (e.type===EV.CARD) signals.push({ from: e.matchSecond-0.3, to: e.matchSecond+2.7, signal: e.card==='red'? 'red' : 'yellow' });
      else if (e.type===EV.HALF_TIME || e.type===EV.FULL_TIME || e.type===EV.ET_HALF || e.type===EV.ET_END) signals.push({ from: e.matchSecond-0.8, to: e.matchSecond+1.2, signal:'whistle' });
      else if (e.type===EV.KICK_OFF || e.type===EV.SECOND_HALF || e.type===EV.ET_START) signals.push({ from: e.matchSecond-0.6, to: e.matchSecond+0.8, signal:'whistle' });
    }
    // phase boundaries
    const phases = [{ t:-1, phase:'pre' }];
    let etStarts = 0;
    for (const e of p.events){
      if (e.type===EV.KICK_OFF && e.matchSecond===0) phases.push({ t:e.matchSecond, phase:'firstHalf' });
      else if (e.type===EV.HALF_TIME) phases.push({ t:e.matchSecond, phase:'halfTime' });
      else if (e.type===EV.SECOND_HALF) phases.push({ t:e.matchSecond, phase:'secondHalf' });
      else if (e.type===EV.FULL_TIME) phases.push({ t:e.matchSecond, phase:'fullTime' });
      else if (e.type===EV.ET_START){ etStarts++; phases.push({ t:e.matchSecond, phase: etStarts===1? 'extraTime1' : 'extraTime2' }); }
      else if (e.type===EV.ET_HALF) phases.push({ t:e.matchSecond, phase:'etBreak' });
      else if (e.type===EV.ET_END) phases.push({ t:e.matchSecond, phase:'etEnd' });
      else if (e.type===EV.PENALTIES) phases.push({ t:e.matchSecond, phase:'penalties' });
      else if (e.type===EV.SHOOTOUT_RESULT) phases.push({ t:e.matchSecond, phase:'final' });
    }
    const goals = p.events.filter(e=>e.type===EV.GOAL);
    const duration = p.events.length? p.events[p.events.length-1].matchSecond : P.regulation.end;
    const phaseAt = t => { let ph = phases[0]; for (const x of phases){ if (x.t<=t) ph = x; else break; } return ph.phase; };
    const scoreAt = t => { let h=0, a=0; for (const g of goals){ if (g.matchSecond<=t){ if (g.teamId===H) h++; else a++; } } return { home:h, away:a }; };
    const clockAt = t => { const et = t>=P.regulation.end && p.official.extra; const base = et? Math.min(t, P.extraTime.end) : Math.min(t, P.regulation.end); const m = Math.floor(base/60), s = Math.floor(base%60); return { minute: m, second: s, label: (m<10?'0':'')+m+':'+(s<10?'0':'')+s, extraTime: !!et }; };

    // The displayed ball: a controlled ball sits at its carrier's feet (the planned trajectory is
    // the truth for players; the keyframes only pin the ball at the instants it is struck or
    // arrives), with short blends into and out of those pinned points so nothing ever jumps.
    function displayedBall(ball, s, t){
      if (ball.state!=='controlled' || !ball.carrier) return ball;
      const i = index[ball.carrier]; if (i===undefined) return ball;
      const q = s.players[i]; const feet = { x: q.x, y: q.y };
      const k0 = ball.from, k1 = ball.to;
      const ct = k0? (k0.controlT||k0.t) : t;
      let x = feet.x, y = feet.y;
      const dist = k0? B.dm(feet.x, feet.y, k0.x, k0.y) : 0;
      const inBlend = Math.min(0.9, 0.3 + dist/9);
      if (t - ct < inBlend){ const u = smooth((t - ct)/inBlend); x = lerp(k0.x, feet.x, u); y = lerp(k0.y, feet.y, u); }   // gathering it
      if (k1 && k1.kind==='launch' && k1.carrier===ball.carrier){
        const d1 = B.dm(feet.x, feet.y, k1.x, k1.y); const outBlend = Math.min(1.0, 0.3 + d1/9);
        if (k1.t - t < outBlend){ const u = smooth(1 - (k1.t - t)/outBlend); x = lerp(x, k1.x, u); y = lerp(y, k1.y, u); }   // setting it for the kick
      }
      return Object.assign({}, ball, { x, y });
    }

    function getSceneAt(t){
      t = Math.max(0, t);
      const s = traj.sample(t);
      const ball = displayedBall(ctx.ballAt(t), s, t);
      const phase = phaseAt(t);
      const lastGoal = goals.filter(g=>g.matchSecond<=t).pop();
      const flash = (lastGoal && t - lastGoal.matchSecond < 2.5)? { type:'goal', teamId: lastGoal.teamId, age: t - lastGoal.matchSecond } : null;
      const win = windowAt(t);
      const out = players.map((pl, i)=>{
        const q = s.players[i];
        let x = q.x, y = q.y;
        const off = offAt(pl.id, t);
        if (off){ const sp = offSpot(pl.id); if (Math.hypot(x-sp.x, y-sp.y) < 0.002){ x = sp.x; y = sp.y; } }
        let action = 'none', actionPhase = 0, aim = null;
        const cl = cues[pl.id]; const ci = lastIndex(cl, t, c=>c.from);
        if (ci>=0 && t<=cl[ci].to){ const c = cl[ci]; action = c.action; actionPhase = (t - c.from)/Math.max(0.01, c.to - c.from); if (c.aimX!==undefined) aim = { x: c.aimX, y: c.aimY }; }
        const speed = q.speed; const movement = off? 'idle' : movementOf(speed);
        let facingAngle = q.facing;
        if (aim && action!=='celebrate' && action!=='booked'){ const d = Math.hypot((aim.y - y)*B.PY, (aim.x - x)*B.PX); if (d > 0.3) facingAngle = Math.atan2((aim.y - y)*B.PY, (aim.x - x)*B.PX); }
        return { id: pl.id, teamId: pl.teamId, name: pl.name, shirtNo: pl.shirtNo, role: roleAt(i, t), x, y, vx: q.vx, vy: q.vy, speedMs: speed, movement, facingAngle, action, actionPhase, anim: ANIM_ALIAS[action]||'idle', aim, intent: q.role, hasBall: ball.carrier===pl.id, sentOff: off };
      });
      const si = lastIndex(signals, t, s=>s.from); const sig = (si>=0 && t<=signals[si].to)? signals[si].signal : null;
      const r = s.ref;
      const ref = { x: r.x, y: r.y, vx: r.vx, vy: r.vy, speedMs: Math.hypot(r.vx*B.PX, r.vy*B.PY), movement: movementOf(Math.hypot(r.vx*B.PX, r.vy*B.PY)), facingAngle: r.facing, signal: sig };
      return {
        t, phase, phaseLabel: PHASE_LABEL[phase]||phase, clock: clockAt(t), score: scoreAt(t),
        possession: ball.team, attackDir: { [H]: dirAt(H, t), [A]: dirAt(A, t) }, attack: { [H]: attackAt(H, t), [A]: attackAt(A, t) }, formations,
        ball: { x: ball.x, y: ball.y, z: ball.z, inFlight: ball.inFlight, carrierId: ball.carrier, state: ball.state, actionId: ball.from? (ball.from.eventId||null) : null },
        players: out, ref, setPiece: win? win.kind : null,
        cameraInterest: MD.interactions.cameraInterest(ctx, ball, t, win, flash),
        flash, live: phase==='firstHalf'||phase==='secondHalf'||phase==='extraTime1'||phase==='extraTime2',
      };
    }
    return { getSceneAt, duration, keyframes: keys, anchors: anchorSets[0].anchors, anchorSets, phases, windows, formations, trajectory: traj, cutTimes };
  }

  MD.createScene = createScene; MD.PHASE_LABEL = PHASE_LABEL;
})(typeof window!=='undefined'? window : globalThis);
