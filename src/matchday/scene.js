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
  // what a renderer needs to know about an action beyond its name and phase: the ball height it meets, whether a
  // tackle or block is a slide or a goal-line clearance, what a reaction is about, whether a keeper was beaten
  const DETAIL_KEYS = ['z','slide','line','kind','beaten','firstTime','intercept','parry','variant'];
  function cueDetail(c){ let d = null; for (const k of DETAIL_KEYS) if (c[k]!==undefined){ (d||(d={}))[k] = c[k]; } return d; }
  const AHEAD = 0.3;               // metres a controlled ball is shown ahead of its owner's feet
  const ANIM_ALIAS = { pass:'kick', shoot:'shoot', volley:'volley', header:'header', dive:'dive', catch:'catch', getup:'getup', tackle:'slide', block:'block', receive:'receive', set:'set', celebrate:'celebrate', booked:'booked', dismay:'dismay' };
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
    // A launch key may carry z0 (height the ball leaves from), arc (how high the flight rises: 1 = a lofted pass,
    // 0.35 = a driven shot, 1.3 = a cross), technique and shot/parry/cross flags; an arrive key z1 (height it is
    // met at: a header, a volley, a save, the crossbar) and save/catch/out/block/post flags.
    const keys = [];
    const key = (t, pos, carrier, team, kind, extra) => { const k = { t, x: pos.x, y: pos.y, carrier: (carrier && !offSoFar.has(carrier))? carrier : null, team: team||null, kind: kind||'hold' }; if (extra) Object.assign(k, extra); keys.push(k); return k; };
    const centre = { x:0.5, y:0.5 };
    const cornerKeys = [], goalKeys = [];
    const z = pt => (pt && pt.z)? pt.z : 0;
    const flight = (e, extraLaunch, extraArrive, arriveCarrier, arriveTeam, arriveKind) => {
      const d = e.duration||0;
      key(e.matchSecond-d, e.from, e.playerId, e.teamId, 'launch', Object.assign({ eventId: e.id, z0: z(e.from), technique: e.technique||'kick' }, extraLaunch||{}));
      return key(e.matchSecond, e.to, arriveCarrier===undefined? null : arriveCarrier, arriveTeam||e.teamId, arriveKind||'arrive', Object.assign({ eventId: e.id, z1: z(e.to) }, extraArrive||{}));
    };
    for (const e of p.events){
      switch (e.type){
        case EV.SENT_OFF: offSoFar.add(e.playerId); break;
        case EV.KICK_OFF: case EV.SECOND_HALF: case EV.ET_START: key(e.matchSecond, centre, e.playerId||kicker(e.teamId), e.teamId, 'restart', Object.assign({ eventId: e.id }, (e.type!==EV.KICK_OFF || e.matchSecond > 0)? { cut:true } : {})); break;   // every restart from the centre but the first is a cut: everyone is placed for it
        case EV.PASS: case EV.RUN: flight(e, { arc: 1 }, {}, e.type===EV.RUN? e.playerId : e.toPlayerId, e.teamId); break;
        case EV.CROSS: flight(e, { arc: 1.3, cross: true }, { aerial: true, catch: !!e.catch }, e.toPlayerId, e.toTeamId||e.teamId); break;
        case EV.INTERCEPTION: flight(e, { arc: 0.9 }, { intercept: true }, e.toPlayerId, other(e.teamId)); break;
        case EV.DEFLECTION: {
          // off the woodwork to the keeper's hand: he dives and pushes it on (a parry where the ball reaches him)
          if (e.keeperId){ flight(e, { arc: 0.5 }, { save: true, parried: true, rebound: true }, e.keeperId, e.teamId); break; }
          // a rebound falls to whoever plays it next (a follow-up shot, a hacked clearance) within a couple of seconds
          let taker = null;
          if (e.rebound){ const nx = p.events.find(x=>x.matchSecond > e.matchSecond && x.from && x.playerId && x.matchSecond - (x.duration||0) <= e.matchSecond + 2.5 && x.matchSecond - (x.duration||0) >= e.matchSecond - 0.01); if (nx) taker = nx.playerId; }
          flight(e, { arc: e.rebound? 0.5 : 0.25, parry: true }, { out: !e.rebound, rebound: !!e.rebound }, taker, e.teamId); break; }
        case EV.SHOT_SAVED: flight(e, { arc: 0.35, shot: true }, { save: true, catch: e.save==='catch', parried: e.save==='parry' }, e.keeperId||null, e.teamId); break;
        case EV.SHOT_WIDE: flight(e, { arc: e.miss==='over'? 0.6 : 0.35, shot: true }, { out: true, miss: e.miss||'wide' }, null, e.teamId); break;
        case EV.SHOT_POST: flight(e, { arc: 0.35, shot: true }, { post: true, woodwork: e.woodwork||'post', keeper: e.keeperId||null }, null, e.teamId); break;
        case EV.SHOT_BLOCKED: flight(e, { arc: 0.3, shot: true }, { block: !!e.blockerId, slide: !!e.slide, line: !!e.line, keeper: e.keeperId||null }, e.blockerId||null, e.blockerId? other(e.teamId) : e.teamId, e.blockerId? 'hold' : 'arrive'); break;
        case EV.GOAL: if (e.from && e.to){ goalKeys.push(flight(e, { arc: 0.35, shot: true }, { scorer: e.playerId||null }, null, e.teamId, 'goal')); } break;
        case EV.CORNER: cornerKeys.push(key(e.matchSecond, e.at, e.playerId||anyOf(e.teamId,'MID'), e.teamId, 'restart', { corner:true, eventId: e.id })); break;
        case EV.GOAL_KICK: key(e.matchSecond, e.at, e.playerId||gkOf[e.teamId]||null, e.teamId, 'restart', { eventId: e.id }); break;
        case EV.TACKLE: key(e.matchSecond, e.at, e.playerId, e.teamId, 'hold', { tackle:true, slide: !!e.slide, eventId: e.id }); break;
        case EV.CLEARANCE: if (e.from && e.to) flight(e, { arc: 0.9, clearance: true }, { loose: true }, e.toPlayerId||null, e.teamId); else key(e.matchSecond, e.at, e.playerId, e.teamId, 'hold', { eventId: e.id }); break;
        case EV.FOUL: key(e.matchSecond, e.at, null, e.teamId, 'hold', { eventId: e.id }); break;
        default: break;
      }
    }
    keys.forEach((k,i)=>{ k.i = i; });
    keys.sort((a,b)=>a.t-b.t || a.i-b.i);
    keys.forEach((k,i)=>{ k.idx = i; delete k.i; });
    // a man cannot carry the ball further than his legs allow between taking it and striking it: a kick straight after
    // a restart is taken from the spot, a quick pass from where he collected it
    for (let i=1;i<keys.length;i++){
      const k = keys[i], pk = keys[i-1];
      if (k.kind!=='launch' || !k.carrier || pk.carrier!==k.carrier || !(pk.kind==='restart' || pk.kind==='hold' || pk.kind==='arrive')) continue;
      const dt = Math.max(0, k.t - pk.t); const dx = (k.x - pk.x)*105, dy = (k.y - pk.y)*68; const d = Math.sqrt(dx*dx + dy*dy); const allow = Math.min(7*dt, 2*dt*dt) + 0.3;   // from a standing start
      if (d > allow){ const u = allow/d; k.x = pk.x + (k.x - pk.x)*u; k.y = pk.y + (k.y - pk.y)*u; }
    }
    MD.interactions.standOffsets(keys); MD.interactions.presetControl(keys);
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
      if (ck.carrier){ targets[ck.carrier] = (kick && kick.carrier===ck.carrier && kick.sox!==undefined)? MD.interactions.standOf(kick) : { x: ck.x, y: ck.y }; band[ck.carrier] = B.BAND.SPRINT; }   // the taker gets out to the flag at whatever pace it takes
      const box = attackers.filter(x=>x.role==='FWD').concat(attackers.filter(x=>x.role==='DEF').slice(0,2)).concat(attackers.filter(x=>x.role==='MID').slice(0,1)).slice(0,5);
      box.forEach((pl,i)=>{ const ax = 0.9 + jitter(p.matchId+'c', i)*0.06, y = 0.36 + i*0.07 + jitter(p.matchId+'cy', i)*0.04; targets[pl.id] = toAbs(att, t, ax, y); band[pl.id] = B.BAND.RUN; });
      const edge = attackers.filter(x=>!box.includes(x)).filter(x=>x.role!=='DEF').slice(0,2);
      edge.forEach((pl,i)=>{ targets[pl.id] = toAbs(att, t, 0.78, i? 0.68 : 0.32); band[pl.id] = B.BAND.JOG; });
      const markers = teamOf(def).filter(x=>x.role!=='GK' && x.role!=='FWD' && !offAt(x.id, t)).slice(0,8);
      markers.forEach((pl,i)=>{ const ax = 0.075 + jitter(p.matchId+'d', i)*0.05, y = 0.33 + i*0.05 + jitter(p.matchId+'dy', i)*0.04; targets[pl.id] = toAbs(def, t, ax, y); band[pl.id] = B.BAND.RUN; });
      if (gkOf[def]){ targets[gkOf[def]] = toAbs(def, t, 0.025, 0.5 + (near? -0.03 : 0.03)); band[gkOf[def]] = B.BAND.JOG; }
      // whoever meets the corner (an attacker, a defender heading clear, the keeper claiming) waits where it will land
      const met = keys[ck.idx+2];
      if (kick && met && met.kind==='arrive' && met.carrier){ targets[met.carrier] = MD.interactions.standOf(met); band[met.carrier] = B.BAND.RUN; }
      // nobody takes up a corner position while the ball is still in play: the window opens at the last touch
      let j = ck.idx - 1; while (j > 0 && !keys[j].carrier) j--;
      const deadAt = keys[j].t;
      windows.push({ from: Math.max(t - 7, deadAt + 0.3), to: kickAt + 0.4, targets, band, anim: {}, kind:'corner' });
    }
    // ---- goal celebrations: four styles, chosen per goal from the seed, bigger for a goal that matters ----
    const goalEvents = p.events.filter(e=>e.type===EV.GOAL);
    for (const gk of goalKeys){
      const restart = keys.slice(gk.idx+1).find(k=>k.kind==='restart');
      const to = restart? restart.t - 0.5 : gk.t + 4.5;
      if (to - gk.t < 4) continue;   // a goal right before a whistle: no time to celebrate
      const team = gk.team, t = gk.t;
      const scorer = gk.scorer && byId[gk.scorer]? byId[gk.scorer] : null;
      const targets = {}, band = {}, anim = {};
      // how much it matters: an equaliser or a lead taken, late in the game, by a side that was behind
      const tally = tt => { let h=0, a=0; for (const g of goalEvents){ if (g.matchSecond<=tt){ if (g.teamId===H) h++; else a++; } } return { home:h, away:a }; };
      const before = tally(t - 0.5), after = tally(t + 0.5);
      const forH = team===H; const lead = (after.home - after.away)*(forH? 1 : -1), leadBefore = (before.home - before.away)*(forH? 1 : -1);
      const swing = (leadBefore < 0 && lead >= 0) || (leadBefore===0 && lead > 0);
      const late = t > P.regulation.end - 15*60 || t > P.regulation.end;
      const big = swing && late? 2 : (swing || late)? 1 : 0;
      const ge = goalEvents.find(e=>e.id===gk.eventId) || {}; const seed = MD.hashString(p.matchId+':'+(ge.id||t));
      const style = seed % 4;                                    // 0 arms aloft, 1 run to the crowd, 2 knee slide, 3 group hug
      const span = to - t;
      if (scorer){
        const shot = keys[gk.idx-1]; const sx = shot? shot.x : gk.x, sy = shot? shot.y : gk.y;
        const dir = dirAt(team, t); const sideY = sy < 0.5? 0.14 : 0.86;
        const crowd = { x: Math.max(0.06, Math.min(0.94, sx - dir*0.12)), y: sideY };            // towards the touchline, a little back from the goal
        const huddle = { x: Math.max(0.08, Math.min(0.92, sx - dir*0.16)), y: Math.max(0.2, Math.min(0.8, sy + (sy < 0.5? 0.12 : -0.12))) };
        const mates = teamOf(team).filter(x=>x.id!==scorer.id && x.role!=='GK' && !offAt(x.id, t))
          .map(x=>({ x, d: Math.hypot(anchorsAt(t)[x.id].x - anchorsAt(t)[scorer.id].x, anchorsAt(t)[x.id].y - anchorsAt(t)[scorer.id].y) })).sort((a,b)=>a.d-b.d).slice(0, 3 + big).map(o=>o.x);
        const ring = (c, i, n, r) => ({ x: Math.max(0.03, Math.min(0.97, c.x + r*Math.cos(i/n*Math.PI*2)*0.65)), y: Math.max(0.03, Math.min(0.97, c.y + r*Math.sin(i/n*Math.PI*2))) });
        if (style===1){
          // runs to the supporters with both arms up, the others chasing him; everybody up at the end
          targets[scorer.id] = crowd; band[scorer.id] = B.BAND.SPRINT;
          anim[scorer.id] = [{ from: 0.4, to: 4.2, action: 'celebrate', extra: { variant: 1 } }, { from: 4.2, to: span, action: 'celebrate', extra: { variant: 0 } }];
          mates.forEach((pl,i)=>{ targets[pl.id] = ring(crowd, i, mates.length, 0.03); band[pl.id] = B.BAND.SPRINT; anim[pl.id] = [{ from: 0.8, to: 4.6, action: 'celebrate', extra: { variant: 1 } }, { from: 4.6, to: span, action: 'celebrate', extra: { variant: 3 } }]; });
        } else if (style===2){
          // a short run and the knee slide towards the crowd, the others arriving to pile in
          const slideAt = { x: Math.max(0.06, Math.min(0.94, sx - dir*0.08)), y: sy < 0.5? 0.22 : 0.78 };
          targets[scorer.id] = slideAt; band[scorer.id] = B.BAND.SPRINT;
          anim[scorer.id] = [{ from: 0.4, to: 5.0, action: 'celebrate', extra: { variant: 2 }, aim: crowd }, { from: 5.0, to: span, action: 'celebrate', extra: { variant: 3 } }];
          mates.forEach((pl,i)=>{ targets[pl.id] = ring(slideAt, i, mates.length, 0.028); band[pl.id] = B.BAND.SPRINT; anim[pl.id] = [{ from: 0.8, to: 4.5, action: 'celebrate', extra: { variant: 1 } }, { from: 4.5, to: span, action: 'celebrate', extra: { variant: 3 } }]; });
        } else if (style===3){
          // turns and meets his teammates: a huddle
          targets[scorer.id] = huddle; band[scorer.id] = B.BAND.RUN;
          anim[scorer.id] = [{ from: 0.4, to: 2.6, action: 'celebrate', extra: { variant: 1 } }, { from: 2.6, to: span, action: 'celebrate', extra: { variant: 3 } }];
          mates.forEach((pl,i)=>{ targets[pl.id] = ring(huddle, i, mates.length, 0.024); band[pl.id] = B.BAND.SPRINT; anim[pl.id] = [{ from: 0.6, to: 3.0, action: 'celebrate', extra: { variant: 1 } }, { from: 3.0, to: span, action: 'celebrate', extra: { variant: 3 } }]; });
        } else {
          // arms aloft where he stands (a few steps on), the others come to him
          const spot = { x: Math.max(0.06, Math.min(0.94, sx - dir*0.06)), y: Math.max(0.1, Math.min(0.9, sy + (sy < 0.5? 0.05 : -0.05))) };
          targets[scorer.id] = spot; band[scorer.id] = B.BAND.RUN;
          anim[scorer.id] = [{ from: 0.4, to: span, action: 'celebrate', extra: { variant: 0 } }];
          mates.forEach((pl,i)=>{ targets[pl.id] = ring(spot, i, mates.length, 0.026); band[pl.id] = B.BAND.SPRINT; anim[pl.id] = [{ from: 0.8, to: 3.4, action: 'celebrate', extra: { variant: 1 } }, { from: 3.4, to: span, action: 'celebrate', extra: { variant: 3 } }]; });
        }
      }
      // the beaten side: the keeper fetches the ball and shows it; the nearest defender turns away with his hands on his head
      const beaten = gkOf[other(team)]; if (beaten){ targets[beaten] = { x: gk.x, y: gk.y }; band[beaten] = B.BAND.JOG; anim[beaten] = [{ from: 1.2, to: Math.min(span, 5.5), action: 'dismay', extra: { variant: seed % 2? 1 : 0 } }]; }
      const defs = teamOf(other(team)).filter(x=>x.role!=='GK' && !offAt(x.id, t)).map(x=>({ x, d: Math.hypot((anchorsAt(t)[x.id].x - gk.x), (anchorsAt(t)[x.id].y - gk.y)) })).sort((a,b)=>a.d-b.d).slice(0, 1 + (big? 1 : 0)).map(o=>o.x);
      defs.forEach((pl,i)=>{ anim[pl.id] = [{ from: 0.8, to: Math.min(span, 4.5), action: 'dismay', extra: { variant: (seed + i + 1) % 3 } }]; });
      windows.push({ from: t, to, targets, band, anim, kind:'celebration', teamId: team, style, big, focusId: scorer? scorer.id : null });
    }
    windows.sort((a,b)=>a.from-b.from);
    const windowAt = t => { const i = lastIndex(windows, t, w=>w.from); const w = i>=0? windows[i] : null; return (w && t<=w.to)? w : null; };

    // ---- the context the planner, trajectories and interactions share ----
    const offTimeOf = id => offTime[id]===undefined? null : offTime[id];
    const offTimeIdx = players.map(pl=>offTimeOf(pl.id));
    const offAtIdx = (i, t) => offTimeIdx[i]!==null && t >= offTimeIdx[i];
    const ctx = { p, events: p.events, players, index, byId, H, A, other, gkOf, keys, carries, windows, windowAt, cutTimes, cutFloor, end, anchorsAt, roleAt, offAt, offAtIdx, offTimeOf, offSpot, dirAt, attackAt, lastIndex };
    ctx.ballAt = t => MD.interactions.ballAt(ctx, t);
    // bookings: the referee walks to the offender and shows the card beside him; the offender stands and takes it
    // fouls: the offender runs at the man on the ball and brings him down where the ball is; the victim goes down
    const fouls = p.events.filter(e=>e.type===EV.FOUL && e.playerId!==null && e.playerId!==undefined && index[e.playerId]!==undefined && e.at).map(e=>{ const b = ctx.ballAt(e.matchSecond - 0.05); return { t: e.matchSecond, from: e.matchSecond - 3.2, to: e.matchSecond + 0.3, x: e.at.x, y: e.at.y, playerId: e.playerId, victimId: (b.carrier && b.carrier!==e.playerId)? b.carrier : null }; });
    const foulAt = t => { const i = lastIndex(fouls, t, f=>f.from); const f = i>=0? fouls[i] : null; return (f && t<=f.to)? f : null; };
    const cards = p.events.filter(e=>e.type===EV.CARD && e.playerId!==null && e.playerId!==undefined && index[e.playerId]!==undefined).map(e=>{ const f = fouls.filter(x=>x.playerId===e.playerId && x.t <= e.matchSecond && e.matchSecond - x.t < 8).pop(); return { from: Math.max(e.matchSecond - 4.5, f? f.t + 0.7 : -1), to: e.matchSecond + 2.7, playerId: e.playerId }; });
    const cardAt = t => { const i = lastIndex(cards, t, c=>c.from); const c = i>=0? cards[i] : null; return (c && t<=c.to)? c : null; };
    ctx.fouls = fouls; ctx.foulAt = foulAt; ctx.cardAt = cardAt;
    const traj = MD.trajectories.build(ctx);
    MD.interactions.controlTimes(ctx, traj);
    const cues = MD.interactions.actions(ctx);
    // the moments a renderer may mark with a flash of contact: a header or volley struck, a catch, a parry, a block, a
    // goal-line clearance, the woodwork; each with where it happens and how high
    const contacts = [];
    for (let i=0;i<keys.length;i++){
      const k = keys[i];
      if (k.kind==='launch' && (k.technique==='header' || k.technique==='volley')) contacts.push({ t: k.t, x: k.x, y: k.y, z: k.z0||0, kind: k.technique });
      else if (k.kind==='arrive' && k.save) contacts.push({ t: k.t, x: k.x, y: k.y, z: k.z1||0, kind: k.catch? 'catch' : 'parry' });
      else if (k.block) contacts.push({ t: k.t, x: k.x, y: k.y, z: k.z1||0, kind: k.line? 'line' : 'block' });
      else if (k.post) contacts.push({ t: k.t, x: k.x, y: k.y, z: k.z1||0, kind: 'woodwork' });
    }
    const contactAt = t => { const i = lastIndex(contacts, t, c=>c.t); if (i < 0) return null; const c = contacts[i]; const age = t - c.t; return age < 0.5? Object.assign({ age }, c) : null; };

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
    // the facing a player is drawn with: his movement facing, or towards the aim of his current action
    function facingOf(id, q, t){
      let f = q.facing; const cl = cues[id]; const ci = lastIndex(cl, t, c=>c.from);
      if (ci>=0 && t<=cl[ci].to){ const c = cl[ci]; if (c.aimX!==undefined && c.action!=='celebrate' && c.action!=='booked'){ const d = Math.hypot((c.aimY - q.y)*B.PY, (c.aimX - q.x)*B.PX); if (d > 0.3) f = Math.atan2((c.aimY - q.y)*B.PY, (c.aimX - q.x)*B.PX); } }
      return f;
    }
    const flashAt = t => { const g = goals.filter(g=>g.matchSecond<=t).pop(); return (g && t - g.matchSecond < 2.5)? { type:'goal', teamId: g.teamId, age: t - g.matchSecond } : null; };
    // the camera's interest now, with where it will be 0.8 s on (the scene is known, so a camera can lead the play)
    function interestAt(ball, t, win, flash, noLead){
      const focusOf = w => (w && w.focusId && w.targets[w.focusId])? Object.assign({ id: w.focusId }, w.targets[w.focusId]) : null;
      const ci = MD.interactions.cameraInterest(ctx, ball, t, win, flash, focusOf(win));
      if (noLead) return ci;
      const t2 = Math.min(duration, t + 0.8); const b2 = ctx.ballAt(t2); const w2 = windowAt(t2);
      const fl2 = flashAt(t2);
      const a = MD.interactions.cameraInterest(ctx, b2, t2, w2, fl2, focusOf(w2));
      ci.ahead = { x: a.x, y: a.y, kind: a.kind };
      return ci;
    }
    function displayedBall(ball, s, t){
      if (ball.state!=='controlled' || !ball.carrier || ball.placed) return ball;   // a placed ball stays on its spot
      const i = index[ball.carrier]; if (i===undefined) return ball;
      const q = s.players[i];
      // a controlled ball sits a touch ahead of its owner's feet along the facing he is drawn with, so it shows at the front foot
      const fa = facingOf(ball.carrier, q, t); const feet = { x: q.x + Math.cos(fa)*AHEAD/B.PX, y: q.y + Math.sin(fa)*AHEAD/B.PY };
      const k0 = ball.from, k1 = ball.to;
      const ct = k0? (k0.controlT||k0.t) : t;
      let x = feet.x, y = feet.y;
      const dist = k0? B.dm(feet.x, feet.y, k0.x, k0.y) : 0;
      const inBlend = Math.min(0.9, 0.3 + dist/9);
      if (t - ct < inBlend){ const u = smooth((t - ct)/inBlend); x = lerp(k0.x, feet.x, u); y = lerp(k0.y, feet.y, u); }   // gathering it
      // setting it for the kick, or losing it in a challenge: the ball is exactly at the key point when the key comes
      if (k1 && k1.carrier!==undefined && ((k1.kind==='launch' && k1.carrier===ball.carrier) || k1.tackle || k1.block)){
        const d1 = B.dm(feet.x, feet.y, k1.x, k1.y); const outBlend = Math.min(1.0, 0.3 + d1/9);
        if (k1.t - t < outBlend){ const u = smooth(1 - (k1.t - t)/outBlend); x = lerp(x, k1.x, u); y = lerp(y, k1.y, u); }
      }
      return Object.assign({}, ball, { x, y });
    }

    function getSceneAt(t){
      t = Math.max(0, t);
      const s = traj.sample(t);
      const ball = displayedBall(ctx.ballAt(t), s, t);
      const phase = phaseAt(t);
      const flash = flashAt(t);
      const win = windowAt(t);
      // the crowd's moment: the celebration window (or the goal flash before it), for the scoring side
      const contact = contactAt(t);
      const crowd = (win && win.kind==='celebration')? { teamId: win.teamId, age: t - win.from, intensity: 1 + 0.5*(win.big||0) } : (flash? { teamId: flash.teamId, age: flash.age, intensity: 1 } : null);
      const out = players.map((pl, i)=>{
        const q = s.players[i];
        let x = q.x, y = q.y;
        const off = offAt(pl.id, t);
        if (off){ const sp = offSpot(pl.id); if (Math.hypot(x-sp.x, y-sp.y) < 0.002){ x = sp.x; y = sp.y; } }
        let action = 'none', actionPhase = 0, aim = null, actionDetail = null;
        const cl = cues[pl.id]; const ci = lastIndex(cl, t, c=>c.from);
        if (ci>=0 && t<=cl[ci].to){ const c = cl[ci]; action = c.action; actionPhase = (t - c.from)/Math.max(0.01, c.to - c.from); if (c.aimX!==undefined) aim = { x: c.aimX, y: c.aimY }; actionDetail = cueDetail(c); }
        const speed = q.speed; const movement = movementOf(speed);                      // a dismissed man walks off, he does not slide
        let facingAngle = q.facing;
        if (aim && action!=='celebrate' && action!=='booked'){ const d = Math.hypot((aim.y - y)*B.PY, (aim.x - x)*B.PX); if (d > 0.3) facingAngle = Math.atan2((aim.y - y)*B.PY, (aim.x - x)*B.PX); }
        return { id: pl.id, teamId: pl.teamId, name: pl.name, shirtNo: pl.shirtNo, role: roleAt(i, t), x, y, vx: q.vx, vy: q.vy, speedMs: speed, movement, facingAngle, action, actionPhase, actionDetail, anim: ANIM_ALIAS[action]||'idle', aim, intent: q.role, hasBall: ball.carrier===pl.id, sentOff: off };
      });
      const si = lastIndex(signals, t, s=>s.from); const sig = (si>=0 && t<=signals[si].to)? signals[si].signal : null;
      const r = s.ref;
      const ref = { x: r.x, y: r.y, vx: r.vx, vy: r.vy, speedMs: Math.hypot(r.vx*B.PX, r.vy*B.PY), movement: movementOf(Math.hypot(r.vx*B.PX, r.vy*B.PY)), facingAngle: r.facing, signal: sig };
      return {
        t, phase, phaseLabel: PHASE_LABEL[phase]||phase, clock: clockAt(t), score: scoreAt(t),
        possession: ball.team, attackDir: { [H]: dirAt(H, t), [A]: dirAt(A, t) }, attack: { [H]: attackAt(H, t), [A]: attackAt(A, t) }, formations,
        ball: { x: ball.x, y: ball.y, z: ball.z, inFlight: ball.inFlight, carrierId: ball.carrier, state: ball.state, actionId: ball.from? (ball.from.eventId||null) : null },
        players: out, ref, setPiece: win? win.kind : null, crowd, contact,
        celebration: celebrationCutAt(t), cameraInterest: interestAt(ball, t, win, flash), frame: frameAt(t), frameAt, lastCut: lastCutAt(t),   // frameAt: so the camera can look ahead when it chooses its scale
        flash, live: phase==='firstHalf'||phase==='secondHalf'||phase==='extraTime1'||phase==='extraTime2',
      };
    }
    // ---- what a camera must keep in view at t (Milestone 3D): normalised points, z in metres ----
    // The ball always; the man about to strike it and both posts in the second before a shot and while it flies at the
    // goal (and while the keeper deals with it); the taker and the goalmouth while a corner is in the air; the man on
    // the ball and the man about to challenge him around a tackle; the offender, the man he fouled and the referee
    // from a foul to the card; the scorer and the nearest of his teammates through a celebration.
    const posAt = (id, t) => { const i = index[id]; if (i===undefined) return null; const q = traj.sample(t).players[i]; return { x: q.x, y: q.y }; };
    const goalPosts = gx => [{ x: gx, y: 0.5 - 3.66/B.PY, z: 2.44 }, { x: gx, y: 0.5 + 3.66/B.PY, z: 2.44 }];
    // Each point has a weight: 'hard' (never out of the inner view: the ball, or the scorer through a celebration),
    // 'must' (kept in view and counted when the scale is chosen) or 'nice' (kept in view when it costs nothing).
    // the celebration the camera is in at t, if any: a celebration holds the camera until the restart cuts away, not
    // just until its window closes half a second before the kick-off
    const celebrationAt = (t, ball) => {
      let win = windowAt(t);
      if (!win && ball.state==='dead'){ const i = lastIndex(windows, t, w=>w.from); const lw = i>=0? windows[i] : null; if (lw && lw.kind==='celebration' && t - lw.to < 1.0) win = lw; }
      return (win && win.kind==='celebration' && win.focusId)? win : null;
    };
    const CELEB_CUT = 1.2;                                       // the net first, then the cut to the scorer
    function frameAt(t){
      const ball = ctx.ballAt(t); const win = celebrationAt(t, ball);
      const celebrating = !!win;
      const settled = celebrating && t - win.from > CELEB_CUT;
      const pts = [{ x: ball.x, y: ball.y, z: Math.max(0, ball.z||0)*3, what: 'ball', weight: settled? 'nice' : 'hard' }];
      const k0 = ball.from, k1 = ball.to;
      const add = (p, what, weight) => { if (p) pts.push({ x: p.x, y: p.y, z: 0, what, weight: weight||'must' }); };
      if (ball.carrier) add(posAt(ball.carrier, t), 'carrier');
      // a shot: from a second before the strike until the keeper, the net, the woodwork or the line has dealt with it
      const shotNext = !!(k1 && k1.kind==='launch' && k1.shot && k1.t - t < 2.6);   // notice, so the camera has time to compose it
      const shotNow = !!(ball.inFlight && k0 && k0.shot);
      if (shotNext || shotNow){
        const sk = shotNext? k1 : k0; const target = shotNext? keys[keys.indexOf(k1)+1] : k1;
        const gx = target? (target.x > 0.5? 1 : 0) : (sk.x > 0.5? 1 : 0);
        add(posAt(sk.carrier, t), 'striker'); for (const g of goalPosts(gx)) pts.push(Object.assign({ what: 'post', weight: 'must' }, g));
      }
      if (k0 && (k0.save || k0.post || k0.kind==='goal' || (k0.out && k0.miss)) && t - k0.t < 1.2){ const gx = k0.x > 0.5? 1 : 0; for (const g of goalPosts(gx)) pts.push(Object.assign({ what: 'post', weight: 'must' }, g)); if (k0.carrier) add(posAt(k0.carrier, t), 'keeper'); }
      // a cross or a corner in the air: where it is going, and the goalmouth if it costs nothing
      if (ball.inFlight && k0 && k0.cross && k1){ add({ x: k1.x, y: k1.y }, 'landing'); const gx = k1.x > 0.5? 1 : 0; for (const g of goalPosts(gx)) pts.push(Object.assign({ what: 'post', weight: 'nice' }, g)); }
      // a challenge: the man coming in, from a second before to half a second after
      if (k1 && (k1.tackle || k1.block) && k1.carrier && k1.t - t < 1.0) add(posAt(k1.carrier, t), 'challenger');
      if (k0 && (k0.tackle || k0.block) && k0.carrier && t - k0.t < 0.6) add(posAt(k0.carrier, t), 'challenger');
      // a foul and the card that follows
      const foul = foulAt(t); const card = cardAt(t);
      if (foul){ add(posAt(foul.playerId, t), 'offender'); if (foul.victimId) add(posAt(foul.victimId, t), 'victim'); }
      if (card){ add(posAt(card.playerId, t), 'offender'); const r = traj.sample(t).ref; pts.push({ x: r.x, y: r.y, z: 1.8, what: 'referee' }); }
      // a celebration: the scorer above all (never out of the inner view once the camera has left the net), where he
      // is running to (so a run to the supporters or a knee slide has room in front of it), and the two teammates
      // nearest him when they fit
      if (celebrating){
        const sc = posAt(win.focusId, t); add(sc, 'scorer', t - win.from > CELEB_CUT + 0.5? 'hard' : 'must');   // half a second for the camera to reach him after the cut
        if (sc){
          const ahead = posAt(win.focusId, Math.min(t + 0.7, win.to)); if (ahead && B.dm(ahead.x, ahead.y, sc.x, sc.y) > 0.5) add(ahead, 'lead', 'nice');
          const goal = win.targets && win.targets[win.focusId]; if (goal && B.dm(goal.x, goal.y, sc.x, sc.y) < 14) add(goal, 'lead', 'nice');
          const mates = Object.keys(win.targets).filter(id => id!==win.focusId && win.anim && win.anim[id]).map(id => ({ id, p: posAt(id, t) })).filter(m=>m.p).sort((a,b)=>B.dm(a.p.x,a.p.y,sc.x,sc.y)-B.dm(b.p.x,b.p.y,sc.x,sc.y)).slice(0, 2); for (const m of mates) add(m.p, 'teammate', 'nice');
        }
      }
      return pts;
    }
    // the cut to the scorer inside a celebration, for the camera's choice of scale: { cut, end } while the camera is on him
    const celebrationCutAt = t => { const win = celebrationAt(t, ctx.ballAt(t)); return (win && t - win.from > CELEB_CUT)? { cut: win.from + CELEB_CUT, end: win.to + 1.0 } : null; };
    // the camera's cuts are the scene's: every restart from the centre spot after the first (a half placed rather than run
    // to, the kick-off after a goal), where the picture cuts to the centre circle rather than whipping across the pitch
    const lastCutAt = t => { let c = -1; for (const x of cutTimes){ if (x <= t) c = x; else break; } return c; };
    return { getSceneAt, frameAt, duration, keyframes: keys, anchors: anchorSets[0].anchors, anchorSets, phases, windows, formations, trajectory: traj, cutTimes };
  }

  MD.createScene = createScene; MD.PHASE_LABEL = PHASE_LABEL;
})(typeof window!=='undefined'? window : globalThis);
