// ============================================================================
//  Matchday: schema
//  The MatchPresentation contract shared by the capture adapter, the timeline
//  builder, the scene model and every renderer. Versioned; validate() is the
//  gate every presentation passes before it is shown.
//
//  Coordinates: x and y are normalised 0..1 over the pitch. x runs along the
//  length of the pitch, y across it. In the FIRST HALF the home side attacks
//  towards x = 1 (left to right). At half-time the sides swap ends: the scene
//  model mirrors positions (x -> 1 - x) for the second half and extra time, so
//  events always store the direction they were played in, and renderers never
//  need to know which half it is. z is an optional elevation channel (0..1,
//  ground to high ball) reserved for later renderers.
// ============================================================================
(function(root){
  const MD = (root.Matchday = root.Matchday || {});
  const SCHEMA_VERSION = 1;

  // Event types. provenance is 'official' (from the game's authoritative
  // record) or 'illustrative' (choreography invented by the timeline builder;
  // it never changes a score or a statistic).
  const EVENT = {
    KICK_OFF:'KICK_OFF', HALF_TIME:'HALF_TIME', SECOND_HALF:'SECOND_HALF', FULL_TIME:'FULL_TIME',
    ET_START:'ET_START', ET_HALF:'ET_HALF', ET_END:'ET_END', PENALTIES:'PENALTIES', SHOOTOUT_RESULT:'SHOOTOUT_RESULT',
    GOAL:'GOAL', CARD:'CARD', SENT_OFF:'SENT_OFF',
    PASS:'PASS', RUN:'RUN', TACKLE:'TACKLE', SHOT_SAVED:'SHOT_SAVED', SHOT_WIDE:'SHOT_WIDE', SHOT_BLOCKED:'SHOT_BLOCKED', CORNER:'CORNER', CLEARANCE:'CLEARANCE', FOUL:'FOUL', GOAL_KICK:'GOAL_KICK', DEFLECTION:'DEFLECTION',
  };
  const OFFICIAL_TYPES = new Set([EVENT.KICK_OFF, EVENT.HALF_TIME, EVENT.SECOND_HALF, EVENT.FULL_TIME, EVENT.ET_START, EVENT.ET_HALF, EVENT.ET_END, EVENT.PENALTIES, EVENT.SHOOTOUT_RESULT, EVENT.GOAL, EVENT.CARD, EVENT.SENT_OFF]);

  // Periods in match seconds. Extra time is 2 x 15 minutes.
  const PERIODS = {
    regulation: { start: 0, half: 45*60, end: 90*60 },
    extraTime:  { start: 90*60, half: 105*60, end: 120*60 },
  };

  function isNum(v){ return typeof v==='number' && isFinite(v); }
  function inUnit(v){ return isNum(v) && v>=0 && v<=1; }

  // Validates a presentation. Returns { ok, errors }. Cheap enough to run on
  // every match; strict enough that a renderer can trust what it gets.
  function validate(p){
    const errors = [];
    const err = (m) => errors.push(m);
    if (!p || typeof p!=='object') return { ok:false, errors:['not an object'] };
    if (p.schemaVersion!==SCHEMA_VERSION) err('schemaVersion must be '+SCHEMA_VERSION);
    if (!p.matchId) err('matchId missing');
    if (!p.teams || !p.teams.home || !p.teams.away) err('teams.home and teams.away required');
    const teamIds = new Set(p.teams? [p.teams.home.id, p.teams.away.id] : []);
    if (teamIds.size!==2) err('team ids must be two distinct values');
    const playerIds = new Set();
    for (const pl of p.players||[]){
      if (!pl.id) err('player without id'); else if (playerIds.has(pl.id)) err('duplicate player id '+pl.id); else playerIds.add(pl.id);
      if (!teamIds.has(pl.teamId)) err('player '+pl.id+' has unknown team');
      if (!['GK','DEF','MID','FWD'].includes(pl.role)) err('player '+pl.id+' bad role');
    }
    const o = p.official;
    if (!o) err('official missing');
    else {
      if (!isNum(o.homeGoals) || !isNum(o.awayGoals)) err('official goals must be numbers');
      const h = (o.scorers||[]).filter(s=>s.teamId===p.teams.home.id).length, a = (o.scorers||[]).filter(s=>s.teamId===p.teams.away.id).length;
      if (h>o.homeGoals || a>o.awayGoals) err('more scorers than goals');
      for (const s of o.scorers||[]){
        if (!teamIds.has(s.teamId)) err('scorer with unknown team');
        if (s.playerId!==null && s.playerId!==undefined && !playerIds.has(s.playerId)) err('scorer '+s.playerId+' not in players');
        if (!isNum(s.minute) || s.minute<1 || s.minute>120) err('scorer minute out of range');
      }
      if (o.extra && !['aet','pens'].includes(o.extra)) err('official.extra must be aet, pens or null');
      if (o.extra==='pens' && !teamIds.has(o.penaltiesWinnerTeamId)) err('penalties need a winner team');
    }
    if (!p.period || !isNum(p.period.regulationMinutes)) err('period missing');
    if (!isNum(p.seed)) err('seed must be a number');
    if (p.events){
      const ids = new Set(); let last = -1;
      for (const e of p.events){
        if (!e.id) err('event without id'); else if (ids.has(e.id)) err('duplicate event id '+e.id); else ids.add(e.id);
        if (!EVENT[e.type]) err('unknown event type '+e.type);
        if (!isNum(e.matchSecond) || e.matchSecond<0) err('event '+e.id+' bad matchSecond');
        if (e.matchSecond < last) err('events out of order at '+e.id);
        last = e.matchSecond;
        if (!['official','illustrative'].includes(e.provenance)) err('event '+e.id+' bad provenance');
        if (OFFICIAL_TYPES.has(e.type) && e.provenance!=='official') err('event '+e.id+' type '+e.type+' must be official');
        if (!OFFICIAL_TYPES.has(e.type) && e.provenance!=='illustrative') err('event '+e.id+' type '+e.type+' must be illustrative');
        if (e.teamId!==undefined && e.teamId!==null && !teamIds.has(e.teamId)) err('event '+e.id+' unknown team');
        if (e.playerId!==undefined && e.playerId!==null && !playerIds.has(e.playerId)) err('event '+e.id+' unknown player');
        for (const k of ['from','to','at']) if (e[k] && !(inUnit(e[k].x) && inUnit(e[k].y))) err('event '+e.id+' '+k+' not in 0..1');
        const maxSec = (p.official && p.official.extra)? PERIODS.extraTime.end : PERIODS.regulation.end;
        if (e.type!==EVENT.SHOOTOUT_RESULT && e.type!==EVENT.PENALTIES && e.matchSecond > maxSec) err('event '+e.id+' beyond the final whistle');
      }
      const goals = p.events.filter(e=>e.type===EVENT.GOAL);
      if (p.official && goals.length !== p.official.homeGoals + p.official.awayGoals) err('GOAL events ('+goals.length+') must equal official goals');
    }
    return { ok: errors.length===0, errors };
  }

  // Deterministic 32-bit hash of a string (FNV-1a), used for presentation seeds.
  function hashString(s){ let h = 0x811c9dc5; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h>>>0; }
  // Small seeded generator for everything illustrative. Never the game's RNG.
  function seededRandom(seed){ let a = seed>>>0; return function(){ a = (a + 0x6D2B79F5)|0; let t = Math.imul(a ^ (a>>>15), 1|a); t = (t + Math.imul(t ^ (t>>>7), 61|t)) ^ t; return ((t ^ (t>>>14))>>>0) / 4294967296; }; }

  // ---- team shape, shared by the timeline builder and the scene model ----
  // Anchors are in the ATTACKING frame: x 0 = own goal line, 1 = the goal being attacked.
  // Each TEAM gets a real formation template chosen from the role counts of its XI (the engine's
  // formations: 4-4-2, 4-3-3, 5-3-2, 3-5-2, 5-4-1, 4-5-1 and 3-4-3), with full-backs, wingers and
  // strikers where a coach would put them. shapePos() then slides the whole shape with the ball
  // and stretches it when attacking or compacts it when defending.
  const TEMPLATES = {
    '4-4-2': { DEF:[[0.24,0.12],[0.2,0.37],[0.2,0.63],[0.24,0.88]], MID:[[0.47,0.1],[0.42,0.37],[0.42,0.63],[0.47,0.9]], FWD:[[0.68,0.38],[0.68,0.62]] },
    '4-3-3': { DEF:[[0.24,0.12],[0.2,0.37],[0.2,0.63],[0.24,0.88]], MID:[[0.44,0.28],[0.4,0.5],[0.44,0.72]], FWD:[[0.66,0.14],[0.72,0.5],[0.66,0.86]] },
    '4-5-1': { DEF:[[0.24,0.12],[0.2,0.37],[0.2,0.63],[0.24,0.88]], MID:[[0.49,0.1],[0.43,0.3],[0.4,0.5],[0.43,0.7],[0.49,0.9]], FWD:[[0.7,0.5]] },
    '5-3-2': { DEF:[[0.27,0.1],[0.2,0.3],[0.18,0.5],[0.2,0.7],[0.27,0.9]], MID:[[0.44,0.28],[0.42,0.5],[0.44,0.72]], FWD:[[0.68,0.38],[0.68,0.62]] },
    '3-5-2': { DEF:[[0.2,0.28],[0.18,0.5],[0.2,0.72]], MID:[[0.5,0.08],[0.42,0.3],[0.4,0.5],[0.42,0.7],[0.5,0.92]], FWD:[[0.68,0.38],[0.68,0.62]] },
    '5-4-1': { DEF:[[0.27,0.1],[0.2,0.3],[0.18,0.5],[0.2,0.7],[0.27,0.9]], MID:[[0.47,0.12],[0.42,0.38],[0.42,0.62],[0.47,0.88]], FWD:[[0.7,0.5]] },
    '3-4-3': { DEF:[[0.2,0.28],[0.18,0.5],[0.2,0.72]], MID:[[0.47,0.12],[0.42,0.38],[0.42,0.62],[0.47,0.88]], FWD:[[0.66,0.16],[0.72,0.5],[0.66,0.84]] },
  };
  const LINE_X = { DEF: 0.21, MID: 0.42, FWD: 0.68 };
  const WIDTHS = { 1:[0.5], 2:[0.36,0.64], 3:[0.22,0.5,0.78], 4:[0.14,0.38,0.62,0.86], 5:[0.1,0.3,0.5,0.7,0.9] };
  function lineYs(n){ if (WIDTHS[n]) return WIDTHS[n]; const step = 0.84/(n-1); return Array.from({length:n}, (_,i)=>0.08+i*step); }
  function formationAnchors(players){
    const out = {}; const names = {};
    const teams = Array.from(new Set(players.map(p=>p.teamId)));
    for (const teamId of teams){
      const byRole = { GK:[], DEF:[], MID:[], FWD:[] };
      for (const pl of players) if (pl.teamId===teamId) byRole[pl.role].push(pl);
      const name = byRole.DEF.length+'-'+byRole.MID.length+'-'+byRole.FWD.length;
      const tpl = TEMPLATES[name]; names[teamId] = tpl? name : name+' (custom)';
      byRole.GK.forEach((pl,i)=>{ out[pl.id] = { x: 0.05, y: i? 0.5+0.1*i : 0.5 }; });
      for (const role of ['DEF','MID','FWD']){
        const list = byRole[role]; const n = list.length; if (!n) continue;
        if (tpl){ list.forEach((pl,i)=>{ const a = tpl[role][i]; out[pl.id] = { x: a[0], y: a[1] }; }); continue; }
        const ys = lineYs(n);   // a shape the templates do not cover: spread the line
        list.forEach((pl,i)=>{ const outer = n>=3 && (i===0 || i===n-1); out[pl.id] = { x: LINE_X[role] + (outer? 0.035 : 0), y: ys[i] }; });
      }
    }
    Object.defineProperty(out, 'formations', { value: names, enumerable: false });
    return out;
  }
  // attack: 0 = this team is defending (deeper, narrower), 1 = attacking (higher, wider); 0.5 = neutral
  function shapePos(anchor, role, ballAx, ballY, attack){
    attack = attack===undefined? 0.5 : attack;
    const slide = role==='GK'? 0.04 : 0.32, sway = role==='GK'? 0.25 : 0.3;
    const c = v => Math.max(0.02, Math.min(0.98, v));
    const depth = role==='GK'? 0 : (-0.06 + 0.1*attack), width = role==='GK'? 1 : (0.84 + 0.26*attack);
    let x = anchor.x + depth + (ballAx-0.5)*slide;
    // a line never collapses onto its own goal: it holds its depth unless the ball is even deeper
    const floor = role==='DEF'? 0.1 : role==='MID'? 0.2 : role==='FWD'? 0.3 : 0;
    if (floor) x = Math.max(x, Math.min(floor, ballAx - 0.02));
    return { x: c(x), y: c(0.5 + (anchor.y-0.5)*width + (ballY-0.5)*sway) };
  }

  MD.SCHEMA_VERSION = SCHEMA_VERSION; MD.EVENT = EVENT; MD.OFFICIAL_TYPES = OFFICIAL_TYPES; MD.PERIODS = PERIODS;
  MD.validate = validate; MD.hashString = hashString; MD.seededRandom = seededRandom;
  MD.formationAnchors = formationAnchors; MD.shapePos = shapePos; MD.FORMATION_TEMPLATES = TEMPLATES;
})(typeof window!=='undefined'? window : globalThis);
