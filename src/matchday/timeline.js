// ============================================================================
//  Matchday: timeline builder
//  Produces the event list for a presentation. The anchors (kick-off, goals,
//  cards, half-time, full-time, extra time, penalties) come straight from the
//  official record. Everything between them is illustrative choreography:
//  possession spells, passes, crosses, chances that are saved, missed, blocked
//  or hit the woodwork, corners, tackles and interceptions. All of it is
//  generated from the presentation's own seed, so the same match always plays
//  the same way, and the game's random generator is never touched.
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
//
//  Chances (Phase 3, Milestone 3): a possession spell either stays in midfield
//  and ends with a turnover (an interception, a tackle, a clearance), or it
//  reaches the final third and becomes a chance: an approach (a through ball,
//  a cross from the flank, a cut-back, a shot from range, a corner), a finish
//  (kick, first-time, volley, header) and an outcome (caught, parried with a
//  rebound, wide, over, post, bar, blocked, cleared off the line, cut out
//  before the shot, a last-ditch tackle). How many chances a match gets is a
//  budget drawn from its official goals and cards plus the seed, so a quiet
//  match stays quiet. An official goal ends a scripted spell whose finish is
//  one of several kinds (through ball, cross and header, corner and header,
//  volley, rebound, solo run, long shot); the scorer always applies the final
//  touch and the ball crosses the line at the official second.
// ============================================================================
(function(root){
  const MD = root.Matchday; const EV = MD.EVENT; const P = MD.PERIODS;
  const POST_Y = 3.66/68;          // half the goal width, normalised across the pitch
  const BAR_Z = 2.44/3.0;          // the crossbar on the 0..1 (three metre) height channel
  const HEAD_Z = 1.75/3.0;         // a header is met at about head height
  const VOLLEY_Z = 0.55/3.0;       // a volley is struck around knee height

  function attackDir(p, teamId, second){
    const secondHalfOrLater = second >= P.regulation.half;
    const homeDir = secondHalfOrLater? -1 : 1;
    return teamId===p.teams.home.id? homeDir : -homeDir;
  }
  // attacking-frame depth -> absolute
  function toAbs(dir, ax, y, z){ const o = { x: dir===1? ax : 1-ax, y }; if (z!==undefined) o.z = z; return o; }
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
  // weighted pick: table is { key: weight }
  function pickWeighted(rnd, table){
    let total = 0; for (const k in table) total += table[k];
    let r = rnd()*total; for (const k in table){ r -= table[k]; if (r <= 0) return k; }
    return Object.keys(table).pop();
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
    // a defender of `teamId` near a point given in the OPPONENTS' attacking frame
    const defenderNear = (teamId, oppAx, y, exclude) => nearest(teamId, 1-oppAx, y, 1-oppAx, y, exclude, false);

    let n = 0; const events = []; let chanceSeq = 0, chanceId = null;
    const add = e => { e.id = 'ev-'+(++n); if (chanceId && e.chanceId===undefined) e.chanceId = chanceId; events.push(e); return e; };
    const official = (type, second, extra) => add(Object.assign({ type, matchSecond: second, provenance:'official' }, extra||{}));
    const illus = (type, second, extra) => add(Object.assign({ type, matchSecond: second, provenance:'illustrative' }, extra||{}));
    const beginChance = () => { chanceId = 'ch-'+(++chanceSeq); return chanceId; };
    const endChance = () => { chanceId = null; };

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

    // ---- the match's appetite for chances ----
    // Shots that are not goals: a quiet 0-0 gets a handful, a 4-3 a crowd of them. Drawn once from the official
    // record and the seed, then spent through the match so the spells between anchors know how often to go deep.
    const goalsTotal = p.official.scorers.length, cardsTotal = p.official.cards.length;
    const shotsTarget = Math.round(Math.max(4, Math.min(18, 5 + 2.2*goalsTotal + 0.6*cardsTotal + r(-3, 4))) * (p.official.extra? 1.25 : 1));
    let shotsSoFar = 0;
    // the match's temperament, drawn from the seed: one day the keepers have everything covered, another the woodwork
    // keeps ringing, another the defenders throw themselves at everything. Scales the outcome tables below.
    const temper = { gk: 0.75 + r(0, 0.6), wood: 0.6 + r(0, 0.9), miss: 0.75 + r(0, 0.6), block: 0.75 + r(0, 0.6) };
    const TEMPER_OF = { catch: 'gk', parry: 'gk', post: 'wood', bar: 'wood', wide: 'miss', over: 'miss', blocked: 'block', line: 'block' };
    const outcomeTable = t => { const out = {}; for (const k in OUTCOMES[t]) out[k] = OUTCOMES[t][k]*(temper[TEMPER_OF[k]]||1); return out; };

    // ---- choreography state ----
    let t = 0;                 // current match second
    let poss = H;              // team in possession
    let bAx = 0.5, bY = 0.5;   // ball, in the possession team's attacking frame
    let carrier = null;        // player on the ball
    let cornerPending = false; // a corner has just been awarded: the next spell takes it
    const kickOff = (second, teamId, type) => {
      poss = teamId; bAx = 0.5; bY = 0.5; carrier = nearest(teamId, 0.5, 0.5, 0.5, 0.5, null, false); cornerPending = false;
      official(type, second, { teamId, playerId: carrier? carrier.id : null, at:{x:0.5,y:0.5}, text: type===EV.KICK_OFF? (second===0? 'Kick-off.' : 'Back under way.') : type===EV.SECOND_HALF? 'Second half under way.' : 'Extra time. Thirty more minutes.' });
    };
    const turnover = (ax, y) => { poss = other(poss); bAx = 1-ax; bY = y; carrier = nearest(poss, bAx, bY, bAx, bY, null, true); };
    // the other side takes the ball at a point given in the current side's frame, with a named new carrier
    const turnoverTo = (ax, y, pl) => { poss = other(poss); bAx = 1-ax; bY = y; carrier = pl || nearest(poss, bAx, bY, bAx, bY, null, true); };

    // a pass from the current carrier to `target` (see receiverFor), arriving at second + dur
    let lastArrival = -10;
    const CONTROL_BEAT = 1.5;   // seconds a receiver keeps the ball before he can play it again
    const passFrom = (team, dir, target, second, dur, extra, exactArrival) => {
      const text = (carrier && rnd()<0.3)? (target.ax>0.75? carrier.name+' finds '+target.pl.name+' in the box.' : target.ax-bAx>0.12? carrier.name+' plays it forward to '+target.pl.name+'.' : carrier.name+' to '+target.pl.name+'.') : null;
      const arrival = exactArrival? Math.round((second + dur)*10)/10 : Math.ceil(second + dur);   // a scripted ball lands to the tenth
      const ex = Object.assign({}, extra||{}); if (ex.text!==undefined){ ex.say = ex.text; delete ex.text; }
      illus(EV.PASS, arrival, Object.assign({ teamId: team, playerId: carrier? carrier.id : null, toPlayerId: target.pl.id, from: toAbs(dir, bAx, bY), to: toAbs(dir, target.ax, target.y), duration: dur, say: text }, ex));   // ceil: the ball never leaves before the spell (or a restart) begins
      bAx = target.ax; bY = target.y; carrier = target.pl; lastArrival = arrival;
      return arrival;
    };
    // choose a receiver near a desired point (team frame) and aim the pass at where he stands
    const receiverFor = (team, wantAx, wantY, mustBe) => {
      const pl = mustBe || nearest(team, wantAx, wantY, wantAx, wantY, carrier, wantAx<0.25);
      const s = standing(pl, wantAx, wantY);
      return { pl, ax: clampAx(s.x + r(-0.03,0.03)), y: clampY(s.y + r(-0.03,0.03)) };
    };
    // a high ball into the box for `target` to meet at height z (a header or a volley). The target may be a
    // defender (headed clear) or the keeper (claimed); the possession then passes to his side.
    const crossTo = (team, dir, target, second, dur, z, extra) => {
      const arrival = Math.ceil(second + dur);
      const who = carrier? carrier.name : teamName(p, team);
      const ex = Object.assign({}, extra||{}); const say = ex.text!==undefined? ex.text : who+' swings it into the box.'; delete ex.text;
      illus(EV.CROSS, arrival, Object.assign({ teamId: team, playerId: carrier? carrier.id : null, toPlayerId: target.pl.id, from: toAbs(dir, bAx, bY), to: toAbs(dir, target.ax, target.y, z), duration: dur, say }, ex));
      bAx = target.ax; bY = target.y; lastArrival = arrival;
      return arrival;
    };

    // who picks up a clearance for the side that made it: `team` is the side cleared against, `away` is where it lands in their frame
    const collectorFor = (team, away, clearer) => nearest(other(team), 1-away.ax, away.y, 1-away.ax, away.y, clearer||null, true);

    // the carrier runs with the ball towards a point (team frame), at a pace a player can keep up with; if a
    // deadline is given the carry stops wherever he has got to by then. Returns the second he has it there.
    const CARRY_MS = 6.5; const DIM = { L: 105, W: 68 };
    const carryTo = (ax, y, second, deadline) => {
      let dx = (ax - bAx)*DIM.L, dy = (y - bY)*DIM.W; let d = Math.hypot(dx, dy);
      if (deadline!==undefined){ const dmax = Math.max(0, deadline - second)*CARRY_MS; if (d > dmax){ const f = dmax/d; dx *= f; dy *= f; d = dmax; } }
      bAx = clampAx(bAx + dx/DIM.L); bY = clampY(bY + dy/DIM.W);
      return second + d/CARRY_MS;
    };

    // ---- shots ----
    // A shot from the ball's current point by `carrier`, struck with `technique` from height z0, with the given
    // outcome. Everything after the shot (rebounds, corners, goal kicks, the keeper's distribution) is written here
    // too. Returns the second at which open play resumes. The possession state is left consistent.
    function shoot(team, dir, second, technique, z0, outcome, until, opts){
      opts = opts||{};
      const at = toAbs(dir, bAx, bY, z0 || undefined);
      const who = carrier? carrier.name : 'A shot';
      const shooter = carrier;
      const gk = gkOf(other(team));
      const dur = opts.close? 0.7 : (bAx > 0.82? 0.8 : 1.0);
      const how = technique==='header'? ' heads it' : technique==='volley'? ' volleys' : technique==='first-time'? ' hits it first time' : ' shoots';
      const strike = who + how + (technique==='header'? '...' : '!');
      const launch = Math.round(second*10)/10; const sec = Math.round((launch + dur)*10)/10;   // struck at `second`, resolves dur later
      if (sec > until){
        // no time to resolve a shot before the whistle (or the scripted build-up): the chance is snuffed out instead
        const def = defenderNear(other(team), Math.min(0.97, bAx + 0.03), bY, gk);
        const s = Math.min(until, Math.round(second*2)/2);
        illus(EV.TACKLE, s, { teamId: other(team), playerId: def? def.id : null, at, slide: false, text: def? def.name+' gets a foot in.' : null });
        turnoverTo(bAx, bY, def); return s + 2;
      }
      shotsSoFar++;
      const afterKeeperHolds = s => {
        // the keeper gathers and rolls it out to a defender: a real pass, not a hand-over
        turnover(0.92, 0.5);
        if (carrier && carrier.id!==gk.id && s + 8 <= until){ const tgt = { pl: carrier, ax: clampAx(standing(carrier, 0.1, bY).x), y: clampY(standing(carrier, 0.1, bY).y) }; carrier = gk; bAx = 0.03; bY = 0.5 + r(-0.05,0.05); s += 2.5; passFrom(poss, attackDir(p, poss, s), tgt, s, 1.6); s = lastArrival + CONTROL_BEAT; }
        return s;
      };
      const goalKick = s => {
        turnover(0.94, 0.5);
        if (Math.round(s)<=until-6){ carrier = gkOf(poss); bAx = 0.06; bY = 0.5; illus(EV.GOAL_KICK, Math.round(s), { teamId: poss, playerId: carrier.id, at: toAbs(attackDir(p, poss, s), 0.06, 0.5), text: null }); s += 4; }
        return s;
      };
      // the ball at fromPt (from time fromT, the shot's resolution unless given) runs behind for a corner at `s` or soon after
      const corner = (s, cy, fromPt, fromT) => {
        const d = 1.2; const arr = Math.round(((fromT!==undefined? fromT : sec) + 0.3 + d)*10)/10;
        const cornerAt = Math.max(Math.round(s), Math.ceil(arr + 2.5));
        if (cornerAt + 1 > until){ turnover(0.9, 0.5); return s; }
        // the ball runs behind quickly and lies by the flag until the corner is taken
        illus(EV.DEFLECTION, arr, { teamId: other(team), playerId: null, from: fromPt, to: toAbs(dir, 0.985, cy), duration: d, text: null });
        bAx = 0.985; bY = cy; carrier = nearest(team, 0.985, cy, 0.9, cy, shooter, false);   // not the shooter
        illus(EV.CORNER, cornerAt, { teamId: team, playerId: carrier? carrier.id : null, at: toAbs(dir, 0.985, cy), text: 'Corner to '+teamName(p, team)+'.' });
        cornerPending = true;
        return cornerAt + 1;   // the corner itself is taken by the next spell
      };
      // the ball drops back into the box after a parry or off the woodwork: a scramble
      const rebound = (s, fromPt, fromZ, offWoodwork) => {
        const rAx = r(0.86, 0.93), rY = clampY(0.5 + r(-0.18, 0.18));
        const roll = rnd();
        if (roll < 0.22 && Math.round(s) + 7 <= until){
          if (!offWoodwork) return corner(s + 2, rY < 0.5? 0.03 : 0.97, fromPt, sec - 0.3);   // the keeper parried it behind (the ball leaves his hand as he touches it)
          // off the woodwork the ball can only go behind for a corner if someone touches it: the keeper, scrambling, turns it round the post
          const hand = toAbs(dir, 0.985, 0.5 + (fromPt.y < 0.5? -0.03 : 0.03), r(0.1, 0.4));
          const touch = Math.round((s + 0.8)*10)/10;
          illus(EV.DEFLECTION, touch, { teamId: other(team), playerId: gk.id, keeperId: gk.id, from: fromPt, to: hand, duration: Math.round((touch - sec)*10)/10, rebound: true, text: gk.name+' gets a hand to the rebound and turns it behind!' });
          return corner(s + 2.8, rY < 0.5? 0.03 : 0.97, hand, touch);
        }
        if (Math.round(s*2)/2 + 1 > until){ turnover(0.9, 0.5); return s; }          // the whistle beats the scramble
        // the ball comes off the hand or the woodwork at the moment of contact and drops back into the box
        illus(EV.DEFLECTION, Math.round(s*2)/2 + 1, { teamId: other(team), playerId: null, from: fromPt, to: toAbs(dir, rAx, rY), duration: Math.round((Math.round(s*2)/2 + 1 - sec)*10)/10, rebound: true, text: null });
        s = Math.round(s*2)/2 + 1;
        bAx = rAx; bY = rY;
        if (roll < 0.55 || s + 6 > until || shotsSoFar >= shotsTarget + 2){
          // a defender gets there first and hacks it clear
          const def = defenderNear(other(team), rAx, rY, gk);
          const away = { ax: clampAx(rAx - r(0.25, 0.4)), y: clampY(rY + r(-0.3, 0.3)) };
          if (s + 2.2 > until){ turnover(away.ax, away.y); return s; }
          const col = collectorFor(team, away, def);
          illus(EV.CLEARANCE, s + 2.2, { teamId: other(team), playerId: def? def.id : null, toPlayerId: col? col.id : null, from: toAbs(dir, rAx, rY), to: toAbs(dir, away.ax, away.y), duration: 1.2, technique: 'kick', say: def? def.name+' hacks it clear.' : 'Cleared.' });
          turnoverTo(away.ax, away.y, col); return s + 2.2 + CONTROL_BEAT;
        }
        // an attacker follows up, first time
        const att = nearest(team, rAx, rY, rAx, rY, null, false); carrier = att || shooter;
        const second2 = pickWeighted(rnd, { catch: 30, wide: 25, over: 15, blocked: 22, line: 8 });
        return shoot(team, dir, s + 1.4, 'first-time', 0, second2, until, { close: true, followUp: true });
      };
      const base = { teamId: team, playerId: shooter? shooter.id : null, from: at, technique, chanceId };
      if (outcome==='catch' || outcome==='parry'){
        const saveY = 0.5 + r(-0.045, 0.045), saveZ = outcome==='catch'? r(0.45, 0.6) : r(0.25, 0.55);   // inside the posts; a catch is taken at head height, arms up; a parry with the hand thrown out at waist height or above
        illus(EV.SHOT_SAVED, sec, Object.assign({}, base, { keeperId: gk.id, to: toAbs(dir, 0.985, saveY, saveZ), duration: dur, save: outcome, say: strike, text: outcome==='catch'? gk.name+' holds it.' : gk.name+' can only parry!' }));
        if (outcome==='catch') return afterKeeperHolds(sec + 4);
        return rebound(sec + 0.5, toAbs(dir, 0.985, saveY, saveZ), saveZ);
      }
      if (outcome==='wide' || outcome==='over'){
        const over = outcome==='over';
        // wide means wide of the post, by half a metre to six (a header or a volley less), either side; over means just over the bar
        const margin = (technique==='header' || technique==='volley')? r(0.5, 3.5)/68 : r(0.5, 6)/68;
        const to = over? toAbs(dir, 0.999, 0.5 + r(-0.06, 0.06), 0.95) : toAbs(dir, 0.995, 0.5 + (rnd()<0.5? -1 : 1)*(POST_Y + margin), r(0, 0.3));
        illus(EV.SHOT_WIDE, sec, Object.assign({}, base, { to, duration: dur, miss: outcome, say: strike, text: over? 'Over the bar!' : 'Wide!' }));
        return goalKick(sec + 5);
      }
      if (outcome==='post' || outcome==='bar'){
        const bar = outcome==='bar';
        const to = bar? toAbs(dir, 0.999, 0.5 + r(-0.04, 0.04), BAR_Z) : toAbs(dir, 0.999, 0.5 + (rnd()<0.5? -1 : 1)*POST_Y, r(0.05, 0.6));
        illus(EV.SHOT_POST, sec, Object.assign({}, base, { keeperId: gk.id, to, duration: dur, woodwork: outcome, say: strike, text: bar? 'Off the crossbar!' : 'Off the post!' }));
        if (rnd() < 0.4){ if (sec + 1.2 <= until) illus(EV.DEFLECTION, sec + 1.2, { teamId: other(team), playerId: null, from: to, to: toAbs(dir, 1, to.y < 0.5? r(0.22, 0.38) : r(0.62, 0.78)), duration: 1.0, text: null }); return goalKick(sec + 5); }   // and away behind for a goal kick
        return rebound(sec + 0.2, to, to.z, true);
      }
      if (outcome==='line'){
        // beats the keeper, cleared off the line by a defender
        const def = defenderNear(other(team), 0.99, 0.5, gk);
        const onLine = toAbs(dir, 0.99, 0.5 + r(-0.03, 0.03), r(0.05, 0.4));
        illus(EV.SHOT_BLOCKED, sec, Object.assign({}, base, { keeperId: gk.id, blockerId: def? def.id : null, to: onLine, duration: dur, line: true, beaten: true, say: strike, text: (def? def.name : 'A defender')+' clears it off the line!' }));
        const away = { ax: clampAx(0.99 - r(0.25, 0.45)), y: clampY(0.5 + r(-0.35, 0.35)) };
        // a high ball is headed away at once; a low one is hacked clear once it has dropped to his feet
        const headed = rnd() < 0.5 && onLine.z >= 0.45; const clearAt = headed? Math.round((sec + 0.2)*10)/10 : sec + 1.3;
        if (clearAt > until){ turnover(away.ax, away.y); return sec; }
        const col = collectorFor(team, away, def);
        illus(EV.CLEARANCE, clearAt, { teamId: other(team), playerId: def? def.id : null, toPlayerId: col? col.id : null, from: headed? onLine : Object.assign({}, onLine, { z: 0 }), to: toAbs(dir, away.ax, away.y), duration: 0.8, technique: headed? 'header' : 'kick', text: null });
        if (rnd() < 0.45 && sec + 10 <= until){ return corner(sec + 4, away.y < 0.5? 0.03 : 0.97, toAbs(dir, away.ax, away.y), clearAt); }   // the clearance runs behind
        turnoverTo(away.ax, away.y, col); return clearAt + CONTROL_BEAT;
      }
      // blocked: a defender throws himself in the way (sliding) or stands in it
      const bx = Math.min(0.97, bAx + 0.05);
      const blocker = defenderNear(other(team), bx, bY, null);
      const slide = rnd() < 0.55;
      illus(EV.SHOT_BLOCKED, sec, Object.assign({}, base, { blockerId: blocker? blocker.id : null, to: toAbs(dir, bx, bY, slide? 0.05 : 0.2), duration: 0.5, slide, say: strike, text: blocker? (slide? blocker.name+' slides in to block!' : 'Blocked by '+blocker.name+'.') : 'Blocked.' }));
      if (rnd() < 0.3 && sec + 10 <= until) return corner(sec + 3, bY < 0.5? 0.03 : 0.97, toAbs(dir, bx, bY, 0.2));   // deflected behind
      turnoverTo(bx, bY, blocker); return sec + 3;
    }

    // outcome tables by how the shot is struck
    const OUTCOMES = {
      header:      { catch: 24, parry: 14, wide: 20, over: 22, post: 6, bar: 4, blocked: 4, line: 6 },
      volley:      { catch: 18, parry: 17, wide: 20, over: 20, post: 7, bar: 4, blocked: 9, line: 5 },
      'first-time':{ catch: 20, parry: 17, wide: 19, over: 14, post: 7, bar: 3, blocked: 15, line: 5 },
      kick:        { catch: 22, parry: 18, wide: 18, over: 10, post: 6, bar: 3, blocked: 18, line: 5 },
      long:        { catch: 25, parry: 15, wide: 22, over: 25, post: 4, bar: 4, blocked: 5, line: 0 },
    };

    // ---- a chance: approach, finish, outcome ----
    // Called with the ball in the final third (team frame bAx, bY) and a carrier. `kind` picks the approach.
    // Returns the second open play resumes.
    function chance(team, dir, second, until, kind){
      const gk = gkOf(other(team));
      const passTo = (target, s, dur, extra) => passFrom(team, dir, target, s, dur, extra);
      const receiver = (wantAx, wantY, mustBe) => receiverFor(team, wantAx, wantY, mustBe);
      // a cross from the flank into the box, met by an attacker, cleared by a defender or claimed by the keeper
      const deliverCross = (s, fromCorner) => {
        const dur = fromCorner? 1.9 : r(1.5, 2.0);
        const over = shotsSoFar >= shotsTarget;                       // the match has had its share of shots: the defence wins more of these
        const roll = rnd()*(over? 0.6 : 1);
        const tAx = r(0.9, 0.955), tY = clampY(0.5 + r(-0.14, 0.14));
        if (roll < 0.3){
          // a defender rises first and heads it clear
          const def = defenderNear(other(team), tAx, tY, gk);
          const arr = crossTo(team, dir, { pl: def, ax: tAx, y: tY }, s, dur, HEAD_Z, { toTeamId: other(team), text: (carrier? carrier.name : teamName(p, team))+' crosses...' });
          const away = { ax: clampAx(tAx - r(0.2, 0.35)), y: clampY(tY + r(-0.3, 0.3)) };
          if (arr + 1.3 > until){ turnoverTo(tAx, tY, def); return arr; }
          if (rnd() < 0.25 && arr + 8 <= until){
            // headed behind for a corner
            const cy = tY < 0.5? 0.03 : 0.97; const cornerAt = Math.ceil(arr + 5.5);   // time for a man to get across from the other flag
            illus(EV.CLEARANCE, arr + 0.1 + 1.0, { teamId: other(team), playerId: def? def.id : null, from: toAbs(dir, tAx, tY, HEAD_Z), to: toAbs(dir, 0.985, cy), duration: 1.0, technique: 'header', say: (def? def.name : 'A defender')+' heads it behind.' });
            bAx = 0.985; bY = cy; carrier = nearest(team, 0.985, cy, 0.9, cy, null, false);
            illus(EV.CORNER, cornerAt, { teamId: team, playerId: carrier? carrier.id : null, at: toAbs(dir, 0.985, cy), text: 'Corner to '+teamName(p, team)+'.' });
            cornerPending = true; return cornerAt + 1;
          }
          const col = collectorFor(team, away, def);
          illus(EV.CLEARANCE, arr + 0.1 + 1.2, { teamId: other(team), playerId: def? def.id : null, toPlayerId: col? col.id : null, from: toAbs(dir, tAx, tY, HEAD_Z), to: toAbs(dir, away.ax, away.y), duration: 1.2, technique: 'header', say: (def? def.name : 'A defender')+' heads it away.' });
          turnoverTo(away.ax, away.y, col); return arr + 1.3 + CONTROL_BEAT;
        }
        if (roll < 0.4){
          // the keeper comes and claims it
          const arr = crossTo(team, dir, { pl: gk, ax: Math.max(tAx, 0.94), y: clampY(0.5 + r(-0.08, 0.08)) }, s, dur, HEAD_Z, { toTeamId: other(team), catch: true, text: (carrier? carrier.name : teamName(p, team))+' crosses... claimed by '+gk.name+'.' });
          poss = other(team); bAx = 1-bAx; carrier = gk;
          // and rolls it out
          if (arr + 8 <= until){ const d2 = attackDir(p, poss, arr); const tgt = receiverFor(poss, 0.14, clampY(0.5 + r(-0.3, 0.3)), null); bAx = 0.03; bY = 0.5 + r(-0.05,0.05); passFrom(poss, d2, tgt, arr + 2.5, 1.6); return lastArrival + CONTROL_BEAT; }
          return arr + 3;
        }
        // an attacker meets it: a header (most) or a volley
        const technique = rnd() < 0.6? 'header' : 'volley';
        const z = technique==='header'? HEAD_Z : VOLLEY_Z;
        const att = nearest(team, tAx, tY, tAx, tY, carrier, false);
        const arr = crossTo(team, dir, { pl: att, ax: tAx, y: tY }, s, dur, z, { text: (carrier? carrier.name : teamName(p, team))+' crosses...' });
        carrier = att;
        return shoot(team, dir, arr + 0.15, technique, z, pickWeighted(rnd, outcomeTable(technique)), until, { close: true });
      };
      switch (kind){
        case 'corner': {
          // the taker swings it in (the corner spot is where the ball lies)
          return deliverCross(second, true);
        }
        case 'cross': {
          // out to the flank first if the ball is not already there
          const wideY = bY < 0.5? r(0.08, 0.2) : r(0.8, 0.92);
          if (Math.abs(bY - 0.5) < 0.28){ passTo(receiver(r(0.82, 0.9), wideY), second, r(1.2, 1.8)); second = lastArrival + CONTROL_BEAT; }
          else second = carryTo(clampAx(Math.max(bAx, r(0.84, 0.9))), clampY(bY + (bY<0.5? -0.03 : 0.03)), second, until - 4.5);
          return deliverCross(second);
        }
        case 'cutback': {
          const sideY = bY < 0.5? r(0.12, 0.2) : r(0.8, 0.88);
          passTo(receiver(r(0.93, 0.96), sideY), second, r(1.2, 1.8)); second = lastArrival + CONTROL_BEAT;
          second = carryTo(0.955, sideY, second, until - 3.5);                 // to the byline
          if (bAx < 0.9) return shoot(team, dir, second, 'kick', 0, pickWeighted(rnd, outcomeTable('kick')), until, {});   // ran out of time to get there: has a go instead
          const edge = receiver(r(0.84, 0.88), clampY(0.5 + r(-0.08, 0.08)));
          if (rnd() < 0.15){ // cut out at the near post
            const def = defenderNear(other(team), edge.ax + 0.03, edge.y, gk);
            illus(EV.INTERCEPTION, Math.ceil(second + 1.1), { teamId: team, playerId: carrier? carrier.id : null, toPlayerId: def? def.id : null, from: toAbs(dir, bAx, bY), to: toAbs(dir, edge.ax + 0.03, edge.y), duration: 1.1, text: (def? def.name : 'A defender')+' reads it and cuts it out.' });
            turnoverTo(edge.ax + 0.03, edge.y, def); return Math.ceil(second + 1.1) + CONTROL_BEAT;
          }
          passTo(edge, second, 1.1, { text: (carrier? carrier.name : 'The ball')+' pulls it back...' }); second = lastArrival + 0.1;
          return shoot(team, dir, second, 'first-time', 0, pickWeighted(rnd, outcomeTable('first-time')), until, { close: true });
        }
        case 'long': {
          bAx = clampAx(Math.min(bAx, 0.78));
          return shoot(team, dir, second, 'kick', 0, pickWeighted(rnd, outcomeTable('long')), until, {});
        }
        default: {   // 'through': a ball in behind for a runner, or a dribble and shot if already close
          if (bAx < 0.84){
            const run = receiver(r(0.86, 0.93), clampY(0.5 + r(-0.2, 0.2)));
            const roll = rnd();
            if (roll < 0.14){
              // a defender steps in front of it
              const def = defenderNear(other(team), run.ax - 0.03, run.y, gk);
              illus(EV.INTERCEPTION, Math.ceil(second + 1.4), { teamId: team, playerId: carrier? carrier.id : null, toPlayerId: def? def.id : null, from: toAbs(dir, bAx, bY), to: toAbs(dir, run.ax - 0.03, run.y), duration: 1.4, text: (def? def.name : 'A defender')+' intercepts.' });
              turnoverTo(run.ax - 0.03, run.y, def); return Math.ceil(second + 1.4) + CONTROL_BEAT;
            }
            passTo(run, second, r(1.2, 1.7), { text: (carrier? carrier.name : 'A ball')+' slides it through for '+run.pl.name+'.' });
            if (roll < 0.26){
              // a last-ditch sliding tackle as he shapes to shoot
              const def = defenderNear(other(team), run.ax, run.y, gk);
              const s = lastArrival + 0.9;
              illus(EV.TACKLE, Math.round(s*2)/2, { teamId: other(team), playerId: def? def.id : null, at: toAbs(dir, run.ax, run.y), slide: true, text: (def? def.name : 'A defender')+' slides in. Last-ditch stuff.' });
              turnoverTo(run.ax, run.y, def); return Math.round(s*2)/2 + 2.5;
            }
            const firstTime = rnd() < 0.45;
            second = lastArrival + (firstTime? 0.1 : CONTROL_BEAT);
            return shoot(team, dir, second, firstTime? 'first-time' : 'kick', 0, pickWeighted(rnd, outcomeTable(firstTime? 'first-time' : 'kick')), until, { close: bAx > 0.88 });
          }
          bAx = clampAx(bAx + r(0.01, 0.04)); bY = clampY(bY + r(-0.05, 0.05));
          return shoot(team, dir, second, 'kick', 0, pickWeighted(rnd, outcomeTable('kick')), until, { close: true });
        }
      }
    }

    // ---- the official goal: a scripted finish that lands at `until` exactly ----
    // how a goal can be finished, by the time available before the official second
    const goalKinds = (scorer, room) => ({ through: 34, crossHeader: (scorer && room >= 9)? 12 : 0, crossVolley: (scorer && room >= 9)? 6 : 0, cornerHeader: (scorer && room >= 19)? 6 : 0, rebound: (scorer && room >= 10)? 12 : 0, solo: 10, long: 8 });
    const GOAL_RESERVE = { through: 8, crossHeader: 10, crossVolley: 10, cornerHeader: 20, rebound: 11, solo: 8, long: 8 };   // seconds the finish needs
    function scoreGoal(team, dir, second, until, goal, kindWanted){
      const s = goal.s; const scorer = s.playerId? p.players.find(x=>x.id===s.playerId) : null;
      const gk = gkOf(other(team));
      const room = until - second;
      const receiver = (wantAx, wantY, mustBe) => receiverFor(team, wantAx, wantY, mustBe);
      const text = (s.playerName||'Goal')+' scores for '+teamName(p, team)+(s.period==='extraTime'? ' in extra time' : '')+'!';
      const goalTo = () => toAbs(dir, 1, 0.5 + r(-0.045, 0.045), r(0.05, 0.5));
      const finish = (fromAx, fromY, z0, technique, dur) => {
        const who = s.playerName || 'The striker';
        const say = technique==='header'? who+' rises to head it...' : technique==='volley'? who+' volleys!' : technique==='first-time'? who+' hits it first time!' : who+' shoots!';
        official(EV.GOAL, until, { teamId: team, playerId: s.playerId, playerName: s.playerName, minute: s.minute, period: s.period, from: toAbs(dir, fromAx, fromY, z0 || undefined), to: goalTo(), duration: dur, technique, eventRef: s.eventId, say, text });
        poss = other(team); bAx = 0.5; bY = 0.5; carrier = null;
        return until;
      };
      let onBall = scorer && carrier && scorer.id===carrier.id;
      const kinds = goalKinds(scorer, room);
      const kind = room < 6? 'solo' : (kindWanted && kinds[kindWanted])? kindWanted : pickWeighted(rnd, kinds);
      // a scorer who already has the ball with time in hand lays it off and gets it back, rather than dribbling for ten seconds
      if (onBall && room >= 8 && (kind==='through' || kind==='solo' || kind==='long')){
        const mate = receiver(clampAx(bAx + r(-0.04, 0.06)), clampY(bY + r(-0.25, 0.25)), null);
        passFrom(team, dir, mate, second, r(1.0, 1.4)); second = lastArrival + CONTROL_BEAT; onBall = false;
      }
      switch (kind){
        case 'crossHeader': case 'crossVolley': {
          const header = kind==='crossHeader';
          const wideY = bY < 0.5? r(0.08, 0.2) : r(0.8, 0.92);
          const crossDur = 1.8, finDur = header? 0.8 : 0.7; const z = header? HEAD_Z : VOLLEY_Z;
          const crossArr = Math.round((until - finDur - 0.2)*10)/10;   // the cross lands, the finish is immediate
          const crossLaunch = crossArr - crossDur;
          // the crosser is a wide man, never the scorer; the ball reaches him in time to deliver (room >= 9 guarantees it)
          const wideMan = nearest(team, 0.86, wideY, 0.86, wideY, scorer, false);
          const crosserTarget = receiver(r(0.82, 0.9), wideY, wideMan);
          if (!carrier || carrier.id!==wideMan.id){ const dur = Math.min(1.8, Math.max(1.0, crossLaunch - CONTROL_BEAT - 1 - second)); passFrom(team, dir, crosserTarget, second, dur); }
          else carryTo(crosserTarget.ax, crosserTarget.y, second, crossLaunch - 0.3);
          const tAx = r(0.9, 0.95), tY = clampY(0.5 + r(-0.1, 0.1));
          illus(EV.CROSS, crossArr, { teamId: team, playerId: carrier? carrier.id : null, toPlayerId: scorer.id, from: toAbs(dir, bAx, bY), to: toAbs(dir, tAx, tY, z), duration: crossDur, text: (carrier? carrier.name : 'The cross')+' crosses for '+scorer.name+'...' });
          carrier = scorer; bAx = tAx; bY = tY;
          return finish(tAx, tY, z, header? 'header' : 'volley', finDur);
        }
        case 'cornerHeader': {
          // a shot by a teammate is parried behind, the corner comes in and the scorer heads it home (room >= 19)
          const other1 = nearest(team, 0.85, 0.5, 0.85, 0.5, scorer, false) || carrier;
          const cornerAt = until - 9, finDur = 0.8, crossDur = 1.9;
          if (!carrier || carrier.id!==other1.id){ passFrom(team, dir, { pl: other1, ax: clampAx(Math.max(bAx, r(0.8, 0.86))), y: clampY(0.5 + r(-0.2, 0.2)) }, second, 1.2); second = lastArrival + 0.3; }
          else second = carryTo(Math.max(bAx, r(0.8, 0.86)), clampY(0.5 + r(-0.2, 0.2)), second, cornerAt - 8);
          const shotSec = Math.max(second + 0.9, cornerAt - 7);
          const saveY = 0.5 + r(-0.06, 0.06), saveZ = r(0.2, 0.6); const cy = saveY < 0.5? 0.03 : 0.97;
          illus(EV.SHOT_SAVED, Math.round(shotSec), { teamId: team, playerId: other1? other1.id : null, keeperId: gk.id, from: toAbs(dir, bAx, bY), to: toAbs(dir, 0.985, saveY, saveZ), duration: 0.9, save: 'parry', technique: 'kick', say: (other1? other1.name : 'A shot')+' shoots!', text: gk.name+' parries it behind!' });
          illus(EV.DEFLECTION, cornerAt - 1, { teamId: other(team), playerId: null, from: toAbs(dir, 0.985, saveY, saveZ), to: toAbs(dir, 0.985, cy), duration: Math.max(0.8, cornerAt - 1 - (Math.round(shotSec) + 0.5)), text: null });
          const taker = nearest(team, 0.985, cy, 0.9, cy, scorer, false);
          illus(EV.CORNER, cornerAt, { teamId: team, playerId: taker? taker.id : null, at: toAbs(dir, 0.985, cy), text: 'Corner to '+teamName(p, team)+'.' });
          carrier = taker; bAx = 0.985; bY = cy;
          const crossArr = Math.round((until - finDur - 0.2)*10)/10; const tAx = r(0.9, 0.95), tY = clampY(0.5 + r(-0.1, 0.1));
          illus(EV.CROSS, crossArr, { teamId: team, playerId: taker? taker.id : null, toPlayerId: scorer.id, from: toAbs(dir, bAx, bY), to: toAbs(dir, tAx, tY, HEAD_Z), duration: crossDur, text: (taker? taker.name : 'The corner')+' swings it in...' });
          carrier = scorer; bAx = tAx; bY = tY;
          return finish(tAx, tY, HEAD_Z, 'header', finDur);
        }
        case 'rebound': {
          // a teammate's shot comes back off the keeper or the post and the scorer is first to it
          const first = nearest(team, 0.86, 0.5, 0.86, 0.5, scorer, false) || carrier;
          const finDur = 0.7; const reboundAt = until - finDur - 1.2;          // the scorer has 1.2 s on the loose ball
          const shotSec = Math.round((reboundAt - 1.0)*2)/2;
          if (first && (!carrier || carrier.id!==first.id)){ passFrom(team, dir, { pl: first, ax: clampAx(Math.max(bAx, r(0.8, 0.86))), y: clampY(0.5 + r(-0.15, 0.15)) }, second, 1.3); second = lastArrival + CONTROL_BEAT; }
          else second = carryTo(Math.max(bAx, r(0.8, 0.86)), bY, second, shotSec - 0.5);
          carrier = first || carrier;
          const rAx = r(0.88, 0.93), rY = clampY(0.5 + r(-0.12, 0.12));
          const woodwork = rnd() < 0.4;
          const hit = woodwork? toAbs(dir, 0.999, 0.5 + (rnd()<0.5? -1 : 1)*POST_Y, r(0.1, 0.6)) : toAbs(dir, 0.985, 0.5 + r(-0.07, 0.07), r(0.1, 0.5));
          if (woodwork) illus(EV.SHOT_POST, shotSec, { teamId: team, playerId: first? first.id : null, keeperId: gk.id, from: toAbs(dir, bAx, bY), to: hit, duration: 0.8, woodwork: 'post', technique: 'kick', say: (first? first.name : 'A shot')+' shoots!', text: 'Off the post!' });
          else illus(EV.SHOT_SAVED, shotSec, { teamId: team, playerId: first? first.id : null, keeperId: gk.id, from: toAbs(dir, bAx, bY), to: hit, duration: 0.8, save: 'parry', technique: 'kick', say: (first? first.name : 'A shot')+' shoots!', text: gk.name+' parries!' });
          illus(EV.DEFLECTION, reboundAt, { teamId: other(team), playerId: null, from: hit, to: toAbs(dir, rAx, rY), duration: reboundAt - shotSec, rebound: true, text: null });
          carrier = scorer; bAx = rAx; bY = rY;
          return finish(rAx, rY, 0, 'first-time', finDur);
        }
        case 'long': {
          if (scorer && (!carrier || carrier.id!==scorer.id) && until - second > 5){ passFrom(team, dir, receiver(clampAx(Math.max(0.66, bAx)), clampY(0.5 + r(-0.2, 0.2)), scorer), second, 1.4); second = lastArrival + CONTROL_BEAT; }
          carryTo(clampAx(Math.min(Math.max(bAx, 0.7), 0.8)), bY, second, until - 1.2); carrier = scorer || carrier;
          return finish(bAx, bY, 0, 'kick', 1.2);
        }
        case 'solo': {
          if (scorer && (!carrier || carrier.id!==scorer.id) && until - second > 5){ passFrom(team, dir, receiver(clampAx(Math.max(0.74, bAx)), clampY(0.5 + r(-0.2, 0.2)), scorer), second, 1.4); second = lastArrival + CONTROL_BEAT; }
          carryTo(clampAx(Math.max(bAx, 0.84) + r(0, 0.04)), clampY(0.5 + (bY - 0.5)*0.5), second, until - 1.0); carrier = scorer || carrier;
          return finish(bAx, bY, 0, 'kick', 1.0);
        }
        default: {   // through ball to the scorer, struck first time or after a touch
          const firstTime = rnd() < 0.5; const finDur = 1.0;
          if (scorer && !onBall && until - second > 4){
            const arr = Math.round((until - finDur - (firstTime? 0.2 : CONTROL_BEAT))*10)/10; const dur = Math.min(1.8, Math.max(1.0, arr - second));
            const tgt = receiver(r(0.85, 0.92), clampY(0.5 + r(-0.18, 0.18)), scorer); tgt.ax = Math.max(tgt.ax, 0.8);
            passFrom(team, dir, tgt, arr - dur, dur, { text: (carrier? carrier.name : 'A pass')+' slides it through for '+scorer.name+'...' }, true);
          } else { carryTo(clampAx(Math.max(bAx, 0.8) + r(0, 0.04)), bY, second, until - finDur); carrier = scorer || carrier; }
          return finish(bAx, bY, 0, firstTime && scorer && !onBall? 'first-time' : 'kick', finDur);
        }
      }
    }

    // one possession spell from `from`, finishing no later than `until`. If `goal` is given the
    // spell is scripted to end with that goal exactly at `until`. Returns the second it finished.
    function spell(from, until, goal){
      let second = from;
      const team = poss; const dir = attackDir(p, team, second);
      if (!carrier) carrier = nearest(team, bAx, bY, bAx, bY, null, true);
      const fromCorner = cornerPending; cornerPending = false;
      const scorer = goal && goal.s.playerId? p.players.find(x=>x.id===goal.s.playerId) : null;
      const goalKind = goal? pickWeighted(rnd, goalKinds(scorer, until - from)) : null;
      const passUntil = goal? until - GOAL_RESERVE[goalKind] : until;        // the build-up passes stop in time for the finish
      const passes = fromCorner? 0 : goal? Math.max(1, Math.min(4, Math.floor((passUntil - from)/4))) : ri(2,4);
      const step = goal? Math.max(3.5, (passUntil - from - 1)/passes) : r(4,8);
      const dribble = small => { const k = small? 0.3 : 1; bAx = clampAx(bAx + r(0.01,0.05)*k); bY = clampY(bY + r(-0.06,0.06)*k); };
      const passTo = (target, s, dur) => passFrom(team, dir, target, s, dur);
      const receiver = (wantAx, wantY, mustBe) => receiverFor(team, wantAx, wantY, mustBe);
      // how far up the pitch this spell wants to get: a chance needs the final third; most spells do not get there
      const remainingSpells = Math.max(1, (end - second)/26);
      const pShot = Math.max(0.005, Math.min(0.7, (shotsTarget - shotsSoFar)/remainingSpells));
      const wantsChance = goal? true : fromCorner? true : rnd() < pShot;
      for (let i=0;i<passes && second+step<passUntil-(goal? 0.5 : 3);i++){
        dribble(i===0);
        const wantAx = goal? Math.min(0.86, bAx + (0.86-bAx)/(passes-i)) : wantsChance? clampAx(bAx + r(0.08, 0.2)) : clampAx(bAx + r(-0.04, 0.14));
        const wantY = clampY(bY + r(-0.3,0.3));
        const dur = Math.min(2.2, Math.max(0.8, step*0.4));
        const last = i===passes-1 || second+2*step>=passUntil-(goal? 0.5 : 3);
        passTo(receiver(wantAx, wantY, (goal && last && scorer && (!carrier || carrier.id!==scorer.id))? scorer : null), second, dur);
        second = Math.max(second + step, lastArrival + CONTROL_BEAT);   // a first touch before the next pass
      }
      if (goal){ beginChance(); const s = scoreGoal(team, dir, second, until, goal, goalKind); endChance(); return s; }
      if (!fromCorner) dribble();
      const deep = bAx > 0.68;
      if ((wantsChance && deep && second + 9 <= until) || fromCorner){   // nine seconds: approach, shot and whatever comes back off the keeper
        beginChance();
        const kind = fromCorner? 'corner' : Math.abs(bY - 0.5) > 0.26? (rnd() < 0.7? 'cross' : 'cutback') : bAx < 0.76? (rnd() < 0.5? 'long' : 'through') : 'through';
        const s = chance(team, dir, second, until, kind);
        endChance(); return s;
      }
      // the spell dies in midfield: cut out, tackled, or hoofed clear
      const at = toAbs(dir, bAx, bY);
      const roll = rnd();
      if (roll < 0.4 && second + 4 <= until){
        const tgt = receiver(clampAx(bAx + r(0.06, 0.16)), clampY(bY + r(-0.25, 0.25)));
        const def = defenderNear(other(team), tgt.ax, tgt.y, null);
        const dur = r(1.0, 1.5);
        illus(EV.INTERCEPTION, Math.ceil(second + dur), { teamId: team, playerId: carrier? carrier.id : null, toPlayerId: def? def.id : null, from: at, to: toAbs(dir, tgt.ax - 0.02, tgt.y), duration: dur, text: rnd() < 0.5 && def? def.name+' cuts it out.' : null });
        turnoverTo(tgt.ax - 0.02, tgt.y, def); return Math.ceil(second + dur) + CONTROL_BEAT;
      }
      if (roll < 0.75){
        const opp = defenderNear(other(team), bAx, bY, null);
        illus(EV.TACKLE, Math.round(second), { teamId: other(team), playerId: opp? opp.id : null, at, slide: rnd() < 0.25, text: opp && rnd() < 0.5? (opp.name+' wins it back.') : null });
        turnoverTo(bAx, bY, opp); return second + 3;
      }
      const opp = defenderNear(other(team), bAx, bY, null);
      const away = { ax: clampAx(bAx - r(0.15, 0.3)), y: clampY(bY + r(-0.3, 0.3)) };
      const col = collectorFor(team, away, opp);
      illus(EV.CLEARANCE, Math.round(second) + 1, { teamId: other(team), playerId: opp? opp.id : null, toPlayerId: col? col.id : null, from: at, to: toAbs(dir, away.ax, away.y), duration: 1.2, technique: 'kick', text: null });
      turnoverTo(away.ax, away.y, col); return Math.round(second) + 1 + CONTROL_BEAT;
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
          if (cornerPending && carrier){ const d0 = attackDir(p, poss, t); passFrom(poss, d0, receiverFor(poss, 0.86, 0.5, null), t, 2); t += 3; cornerPending = false; }   // a corner just awarded: take it short first
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
        const victim = carrier; const foulLines = [' brings down ', ' goes through the back of ', ' catches ', ' clatters into '];
        illus(EV.FOUL, Math.max(t, stop.second-2), { teamId: stop.a.c.teamId, playerId: stop.a.c.playerId, at: toAbs(attackDir(p, poss, stop.second), bAx, bY), text: stop.a.c.playerName + foulLines[ri(0, foulLines.length-1)] + (victim? victim.name : 'his man') + '.' });
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
  MD.TIMELINE_GEOMETRY = { POST_Y, BAR_Z, HEAD_Z, VOLLEY_Z };
})(typeof window!=='undefined'? window : globalThis);
