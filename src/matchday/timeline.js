// ============================================================================
//  Matchday: timeline builder
//  Produces the event list for a presentation. The anchors (kick-off, goals,
//  cards, half-time, full-time, extra time, penalties) come straight from the
//  official record. Everything between them is illustrative choreography:
//  possession spells, passes, shots that miss or are saved, corners. All of it
//  is generated from the presentation's own seed, so the same match always
//  plays the same way, and the game's random generator is never touched.
//
//  Positions are absolute pitch coordinates (0..1). Home attack towards x=1 in
//  the first half and towards x=0 in the second half and extra time.
//
//  Timing convention: an event's matchSecond is the moment it RESOLVES. For an
//  event with from/to/duration (passes, shots, goals) the ball leaves `from` at
//  matchSecond - duration and arrives at `to` at matchSecond. So a GOAL's
//  matchSecond is the instant the ball crosses the line, which is when the
//  score changes and the commentary line fires.
//
//  Passes are aimed at where a teammate actually stands (the shared team-shape
//  model in schema.js), so the scene never has to make anyone sprint across
//  the pitch to meet the ball.
// ============================================================================
(function(root){
  const MD = root.Matchday; const EV = MD.EVENT; const P = MD.PERIODS;

  function attackDir(p, teamId, second){
    const secondHalfOrLater = second >= P.regulation.half;
    const homeDir = secondHalfOrLater? -1 : 1;
    return teamId===p.teams.home.id? homeDir : -homeDir;
  }
  // attacking-frame depth -> absolute
  function toAbs(dir, ax, y){ return { x: dir===1? ax : 1-ax, y }; }
  function teamName(p, teamId){ return teamId===p.teams.home.id? p.teams.home.name : p.teams.away.name; }
  function fullTimeText(p){
    const o = p.official, agg = o.aggregate;
    if (agg){
      if (o.extra) return 'Full time. Level on aggregate, so extra time.';
      const line = 'Full time. '+agg.home+'-'+agg.away+' on aggregate';
      if (agg.home===agg.away && o.winnerTeamId) return line+'. '+teamName(p, o.winnerTeamId)+' go through on away goals.';
      return line+(o.winnerTeamId? '. '+teamName(p, o.winnerTeamId)+' go through.' : '.');
    }
    if (o.extra) return 'Full time. Level, so extra time.';
    return 'Full time.';
  }

  function build(p){
    const rnd = MD.seededRandom(p.seed);
    const r = (a,b) => a + rnd()*(b-a);
    const ri = (a,b) => Math.floor(r(a,b+1));
    const H = p.teams.home.id, A = p.teams.away.id;
    const other = t => t===H? A : H;
    const anchors = MD.formationAnchors(p.players);
    const byTeam = { [H]: p.players.filter(x=>x.teamId===H), [A]: p.players.filter(x=>x.teamId===A) };
    const sentOff = new Set();
    const onPitch = teamId => byTeam[teamId].filter(x=>!sentOff.has(x.id));
    const gkOf = teamId => (byTeam[teamId].find(x=>x.role==='GK') || byTeam[teamId][0]);
    const clampAx = v => Math.max(0.03, Math.min(0.97, v));
    const clampY = v => Math.max(0.05, Math.min(0.95, v));

    // where a player of `teamId` stands, in that team's attacking frame, given the ball's depth in the same frame
    const standing = (pl, bAx, bY) => MD.shapePos(anchors[pl.id], pl.role, bAx, bY);
    // nearest on-pitch teammate to a point in the team's frame (optionally excluding one player and the keeper)
    function nearest(teamId, ax, y, bAx, bY, exclude, allowGK){
      let best = null, bd = Infinity;
      for (const pl of onPitch(teamId)){
        if (exclude && pl.id===exclude.id) continue;
        if (pl.role==='GK' && !allowGK) continue;
        const s = standing(pl, bAx, bY); const d = Math.hypot(s.x-ax, s.y-y) + (pl.role==='GK'? 0.3 : 0);
        if (d<bd){ bd = d; best = pl; }
      }
      return best || onPitch(teamId)[0] || null;
    }

    let n = 0; const events = [];
    const add = e => { e.id = 'ev-'+(++n); events.push(e); return e; };
    const official = (type, second, extra) => add(Object.assign({ type, matchSecond: second, provenance:'official' }, extra||{}));
    const illus = (type, second, extra) => add(Object.assign({ type, matchSecond: second, provenance:'illustrative' }, extra||{}));

    // ---- official anchors ----
    const anchorsList = [];
    const minuteStart = (minute, period) => period==='extraTime'? P.regulation.end + (Math.max(91, minute)-91)*60 : (minute-1)*60;
    const periodCap = period => (period==='extraTime'? P.extraTime.end : P.regulation.end) - 5;
    // the earliest a goal may be placed: inside its minute, and never within a build-up of a restart
    const periodStart = sec => sec>=P.extraTime.half? P.extraTime.half : sec>=P.regulation.end? P.regulation.end : sec>=P.regulation.half? P.regulation.half : 0;
    const goalLo = (minute, period) => { const ms = minuteStart(minute, period); return Math.max(ms + 2, periodStart(ms) + 26); };
    for (const s of p.official.scorers) anchorsList.push({ kind:'goal', second: Math.min(minuteStart(s.minute, s.period) + 30, periodCap(s.period)), lo: goalLo(s.minute, s.period), cap: periodCap(s.period), s });
    for (const c of p.official.cards) anchorsList.push({ kind:'card', second: Math.min((c.minute-1)*60 + 15, P.regulation.end-5), lo: (c.minute-1)*60 + 2, cap: P.regulation.end-5, c });
    anchorsList.sort((a,b)=>a.second-b.second || (a.kind==='goal'? -1 : 1));
    // two anchors in the same minute would collide (a goal needs its build-up): pull the earlier one
    // towards the start of its minute, and only if that is not enough push the later one on
    for (let i=anchorsList.length-2; i>=0; i--){
      const a = anchorsList[i], b = anchorsList[i+1];
      const gap = (a.kind==='goal' || b.kind==='goal')? 28 : 12;
      if (b.second - a.second < gap) a.second = Math.max(a.lo, b.second - gap);
    }
    for (let i=1; i<anchorsList.length; i++){
      const a = anchorsList[i-1], b = anchorsList[i];
      const gap = (a.kind==='goal' || b.kind==='goal')? 28 : 12;
      if (b.second - a.second < gap) b.second = Math.min(b.cap, a.second + gap);
    }

    const end = p.official.extra? P.extraTime.end : P.regulation.end;
    const breaks = [{ second: P.regulation.half, type:'half' }, { second: P.regulation.end, type:'ft' }];
    if (p.official.extra){ breaks.push({ second: P.extraTime.half, type:'ethalf' }); breaks.push({ second: P.extraTime.end, type:'etend' }); }

    // ---- choreography state ----
    let t = 0;                 // current match second
    let poss = H;              // team in possession
    let bAx = 0.5, bY = 0.5;   // ball, in the possession team's attacking frame
    let carrier = null;        // player on the ball
    const kickOff = (second, teamId, type) => {
      poss = teamId; bAx = 0.5; bY = 0.5; carrier = nearest(teamId, 0.5, 0.5, 0.5, 0.5, null, false);
      official(type, second, { teamId, playerId: carrier? carrier.id : null, at:{x:0.5,y:0.5}, text: type===EV.KICK_OFF? (second===0? 'Kick-off.' : 'Back under way.') : type===EV.SECOND_HALF? 'Second half under way.' : 'Extra time. Thirty more minutes.' });
    };
    const turnover = (ax, y) => { poss = other(poss); bAx = 1-ax; bY = y; carrier = nearest(poss, bAx, bY, bAx, bY, null, true); };

    // a pass from the current carrier to `target` (see receiverFor), arriving at second + dur
    const passFrom = (team, dir, target, second, dur) => {
      const text = (carrier && rnd()<0.3)? (target.ax>0.75? carrier.name+' finds '+target.pl.name+' in the box.' : target.ax-bAx>0.12? carrier.name+' plays it forward to '+target.pl.name+'.' : carrier.name+' to '+target.pl.name+'.') : null;
      const arrival = Math.ceil(second + dur);
      illus(EV.PASS, arrival, { teamId: team, playerId: carrier? carrier.id : null, toPlayerId: target.pl.id, from: toAbs(dir, bAx, bY), to: toAbs(dir, target.ax, target.y), duration: dur, text });   // ceil: the ball never leaves before the spell (or a restart) begins
      bAx = target.ax; bY = target.y; carrier = target.pl; lastArrival = arrival;
      return arrival;
    };
    let lastArrival = -10;
    const CONTROL_BEAT = 1.5;   // seconds a receiver keeps the ball before he can play it again
    // choose a receiver near a desired point (team frame) and aim the pass at where he stands
    const receiverFor = (team, wantAx, wantY, mustBe) => {
      const pl = mustBe || nearest(team, wantAx, wantY, wantAx, wantY, carrier, wantAx<0.25);
      const s = standing(pl, wantAx, wantY);
      return { pl, ax: clampAx(s.x + r(-0.03,0.03)), y: clampY(s.y + r(-0.03,0.03)) };
    };

    // one possession spell from `from`, finishing no later than `until`. If `goal` is given the
    // spell is scripted to end with that goal exactly at `until`. Returns the second it finished.
    function spell(from, until, goal){
      let second = from;
      const team = poss; const dir = attackDir(p, team, second);
      if (!carrier) carrier = nearest(team, bAx, bY, bAx, bY, null, true);
      const passes = goal? ri(3,4) : ri(2,4);
      const step = goal? Math.max(4, (until-from-3)/(passes+1)) : r(5,9);
      const dribble = () => { bAx = clampAx(bAx + r(0.01,0.05)); bY = clampY(bY + r(-0.06,0.06)); };
      const passTo = (target, second, dur) => passFrom(team, dir, target, second, dur);
      const receiver = (wantAx, wantY, mustBe) => receiverFor(team, wantAx, wantY, mustBe);
      for (let i=0;i<passes && second+step<until-3;i++){
        const fromFlag = bAx > 0.95 && (bY < 0.1 || bY > 0.9);   // a corner: it goes into the box
        if (!fromFlag) dribble();
        const wantAx = fromFlag? r(0.86,0.93) : goal? Math.min(0.9, bAx + (0.9-bAx)/(passes-i)) : clampAx(bAx + r(0.04,0.2));
        const wantY = fromFlag? r(0.35,0.65) : clampY(bY + r(-0.3,0.3));
        const dur = Math.min(2.5, Math.max(0.8, step*0.45));
        passTo(receiver(wantAx, wantY), second, dur);
        second = Math.max(second + step, lastArrival + CONTROL_BEAT);   // a first touch before the next pass
      }
      if (goal){
        const s = goal.s; const scorer = s.playerId? p.players.find(x=>x.id===s.playerId) : null;
        if (scorer && carrier && scorer.id!==carrier.id && Math.ceil(second + 2) + CONTROL_BEAT + 1.2 <= until){ dribble(); const tgt = receiver(Math.max(bAx, 0.82), clampY(0.5 + r(-0.2,0.2)), scorer); tgt.ax = Math.max(tgt.ax, 0.78); passTo(tgt, second, 2); second = lastArrival + CONTROL_BEAT; }
        else { dribble(); bAx = Math.max(bAx, 0.78); }
        official(EV.GOAL, until, { teamId: team, playerId: s.playerId, playerName: s.playerName, minute: s.minute, period: s.period, from: toAbs(dir, bAx, bY), to: toAbs(dir, 1, 0.5+r(-0.05,0.05)), duration: 1.2, eventRef: s.eventId,
          text: (s.playerName||'Goal')+' scores for '+teamName(p, team)+(s.period==='extraTime'? ' in extra time' : '')+'!' });
        poss = other(team); bAx = 0.5; bY = 0.5; carrier = null;
        return until;
      }
      // outcome of a spell that does not end in a goal
      dribble();
      const deep = bAx > 0.68; const roll = rnd();
      const at = toAbs(dir, bAx, bY);
      const who = carrier? carrier.name : 'A shot';
      if (deep && roll < 0.42){
        const gk = gkOf(other(team));
        const saveY = 0.5+r(-0.08,0.08); const saveSec = Math.round(second);
        illus(EV.SHOT_SAVED, saveSec, { teamId: team, playerId: carrier? carrier.id : null, keeperId: gk.id, from: at, to: toAbs(dir, 0.985, saveY), duration: 1, text: who+' tests '+gk.name+'. Saved.' });
        second += 6;
        if (rnd()<0.35 && Math.round(second)<=until-6){   // no corner right before a whistle
          const cy = rnd()<0.5? 0.03 : 0.97;
          // the keeper can only parry it: the ball runs out for a corner
          const cornerAt = Math.max(saveSec + 6, Math.round(second));
          // the parry starts half a second after the catch and the ball runs out a second before the corner
          illus(EV.DEFLECTION, cornerAt - 1, { teamId: other(team), playerId: gk.id, from: toAbs(dir, 0.985, saveY), to: toAbs(dir, 0.985, cy), duration: cornerAt - 1 - (saveSec + 0.5), text: null });
          bAx = 0.985; bY = cy; carrier = nearest(team, 0.985, cy, 0.9, cy, carrier, false);   // not the shooter
          illus(EV.CORNER, cornerAt, { teamId: team, playerId: carrier? carrier.id : null, at: toAbs(dir, 0.985, cy), text: 'Corner to '+teamName(p, team)+'.' }); second += 6;
        } else {
          // the keeper gathers and rolls it out to a defender: a real pass, not a hand-over
          turnover(0.92, 0.5);
          if (carrier && carrier.id!==gk.id && second + 8 <= until){ const tgt = { pl: carrier, ax: clampAx(standing(carrier, 0.1, bY).x), y: clampY(standing(carrier, 0.1, bY).y) }; carrier = gk; bAx = 0.03; bY = 0.5 + r(-0.05,0.05); second += 2.5; passFrom(poss, attackDir(p, poss, second), tgt, second, 1.6); second = lastArrival + CONTROL_BEAT; }
        }
      } else if (deep && roll < 0.7){
        illus(EV.SHOT_WIDE, Math.round(second), { teamId: team, playerId: carrier? carrier.id : null, from: at, to: toAbs(dir, 0.995, rnd()<0.5? r(0.1,0.3) : r(0.7,0.9)), duration: 1, text: who+' drags it wide.' });
        second += 5; turnover(0.94, 0.5);
        if (Math.round(second)<=until-6){ carrier = gkOf(poss); bAx = 0.06; bY = 0.5; illus(EV.GOAL_KICK, Math.round(second), { teamId: poss, playerId: carrier.id, at: toAbs(attackDir(p, poss, second), 0.06, 0.5), text: null }); second += 4; }
      } else if (deep && roll < 0.85){
        const bx = Math.min(0.97, bAx+0.06);
        const blocker = nearest(other(team), 1-bx, bY, 1-bx, bY, null, false);
        illus(EV.SHOT_BLOCKED, Math.round(second), { teamId: team, playerId: carrier? carrier.id : null, blockerId: blocker? blocker.id : null, from: at, to: toAbs(dir, bx, bY), duration: 0.6, text: blocker? 'Blocked by '+blocker.name+'.' : 'Blocked.' });
        second += 3; turnover(bx, bY); if (blocker) carrier = blocker;
      } else {
        const opp = nearest(other(team), 1-bAx, bY, 1-bAx, bY, null, false);
        illus(rnd()<0.5? EV.TACKLE : EV.CLEARANCE, Math.round(second), { teamId: other(team), playerId: opp? opp.id : null, at, text: opp? (opp.name+' wins it back.') : null });
        second += 3; turnover(bAx, bY); carrier = opp || carrier;
      }
      return second;
    }

    // ---- assemble ----
    kickOff(0, H, EV.KICK_OFF);
    let ai = 0;
    const cardAt = (c, second) => {
      official(EV.CARD, second, { teamId: c.teamId, playerId: c.playerId, playerName: c.playerName, card: c.card, minute: c.minute, at: toAbs(attackDir(p, other(c.teamId), second), bAx, bY), text: c.playerName+' is '+(c.card==='red'? 'sent off!' : 'booked.') });
      if (c.card==='red'){ official(EV.SENT_OFF, second+1, { teamId: c.teamId, playerId: c.playerId, text: teamName(p, c.teamId)+' are down to ten men.' }); if (c.playerId){ sentOff.add(c.playerId); if (carrier && carrier.id===c.playerId) carrier = null; } }
    };
    const nextStop = () => { const a = anchorsList[ai]; const b = breaks.find(x=>x.second>t); return (a && (!b || a.second<=b.second))? { kind:a.kind, second:a.second, a } : (b? { kind:b.type, second:b.second } : null); };
    let guard = 0;
    while (t < end && guard++ < 3000){
      const stop = nextStop(); if (!stop) break;
      if (stop.kind==='goal'){
        const buildUp = Math.min(24, stop.second - t);
        while (stop.second - t > buildUp + 8) t = spell(t, stop.second - buildUp, null);
        // the scoring side takes over for the scripted build-up: they win it back first
        if (poss!==stop.a.s.teamId){
          if (bAx > 0.9 && carrier){ const d0 = attackDir(p, poss, t); passFrom(poss, d0, receiverFor(poss, 0.86, 0.5, null), t, 2); t += 3; }   // a corner just awarded: take it first
          const opp = nearest(stop.a.s.teamId, 1-bAx, bY, 1-bAx, bY, null, false);
          const at = toAbs(attackDir(p, poss, t), bAx, bY);
          illus(EV.TACKLE, Math.round(t)+2, { teamId: stop.a.s.teamId, playerId: opp? opp.id : null, at, text: opp? (opp.name+' wins it back.') : null });
          t = Math.round(t)+3.5; poss = stop.a.s.teamId; bAx = 1-bAx; carrier = opp;
        }
        if (!carrier || carrier.teamId!==poss) carrier = nearest(poss, bAx, bY, bAx, bY, null, false);
        t = spell(Math.max(t, stop.second - buildUp), stop.second, stop.a);
        ai++;
        if (t + 12 < end && !breaks.some(b=>b.second>=t && b.second<t+12)){ t += 11; kickOff(t, poss, EV.KICK_OFF); }   // time to celebrate
      } else if (stop.kind==='card'){
        while (stop.second - t > 10) t = spell(t, stop.second - 4, null);
        // the offender fouls the player on the ball
        if (poss===stop.a.c.teamId){ poss = other(poss); bAx = 1-bAx; carrier = nearest(poss, bAx, bY, bAx, bY, null, false); }
        illus(EV.FOUL, Math.max(t, stop.second-2), { teamId: stop.a.c.teamId, playerId: stop.a.c.playerId, at: toAbs(attackDir(p, poss, stop.second), bAx, bY), text: null });
        cardAt(stop.a.c, stop.second); t = stop.second + 4; ai++;
      } else {
        while (stop.second - t > 8) t = spell(t, stop.second - 2, null);
        t = stop.second;
        if (stop.kind==='half'){ official(EV.HALF_TIME, t, { text: 'Half-time.' }); kickOff(t, A, EV.SECOND_HALF); }
        else if (stop.kind==='ft'){ official(EV.FULL_TIME, t, { text: fullTimeText(p) }); if (p.official.extra) kickOff(t, H, EV.ET_START); }
        else if (stop.kind==='ethalf'){ official(EV.ET_HALF, t, { text: 'Half-time in extra time.' }); kickOff(t, A, EV.ET_START); }
        else if (stop.kind==='etend'){ official(EV.ET_END, t, { text: p.official.extra==='pens'? 'Still level. Penalties.' : 'The final whistle in extra time.' }); }
      }
    }
    if (p.official.extra==='pens'){
      official(EV.PENALTIES, end, { text: 'A penalty shoot-out decides it.' });
      official(EV.SHOOTOUT_RESULT, end+1, { teamId: p.official.penaltiesWinnerTeamId, text: teamName(p, p.official.penaltiesWinnerTeamId)+' win on penalties.' });
    }
    // stable order: by second, then insertion order
    events.forEach((e,i)=>{ e._i = i; });
    events.sort((a,b)=>a.matchSecond-b.matchSecond || a._i-b._i);
    events.forEach(e=>{ delete e._i; });
    return events;
  }

  // Returns a new frozen presentation with events attached (the input is not modified).
  function withTimeline(p){
    const events = build(p);
    const out = Object.assign({}, p, { events: Object.freeze(events) });
    const v = MD.validate(out);
    if (!v.ok) throw new Error('matchday timeline invalid: '+v.errors.join('; '));
    return Object.freeze(out);
  }

  MD.buildTimeline = build; MD.withTimeline = withTimeline; MD.attackDir = attackDir; MD.teamName = teamName;
})(typeof window!=='undefined'? window : globalThis);
