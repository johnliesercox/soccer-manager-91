'use strict';
// Matchday Milestone B tests: capture, timeline, scene.
//  - every real match of a season captures and validates
//  - GOAL events equal official goals; scorers, cards, aet, pens, aggregates reconcile
//  - the same match always produces the same timeline
//  - building presentations never consumes the game's RNG (seeded worlds stay identical)
//  - unknown scorers are tolerated
//  - scenes stay inside the pitch, scores never go backwards and end on the official score
const E = require('./engine.js');
globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday;

let fails = 0; const ok = (c, msg) => { if (!c){ fails++; console.log('FAIL', msg); } };

function runWorld(seed, weeks, withCapture, onMatch){
  const st = E.newGame({ seed, userClub: 3 });  // a div 1 club: more chance of Europe in season 2
  let count = 0;
  for (let w=0; w<weeks; w++){
    const res = E.advanceWeek(st);
    if (st.gameOver){ st.gameOver=null; st.sackOffer=null; st.clubs[st.userClub].confidence=E.CFG.CONF_START; st.clubs[st.userClub].overdraftWeeks=0; }
    if (withCapture){
      for (const m of res){
        const p = MD.capture(st, m, st.lastWeekInfo);
        const v0 = MD.validate(p); ok(v0.ok, 'capture invalid '+p.matchId+': '+v0.errors.join('; '));
        const full = MD.withTimeline(p);
        count++; if (onMatch) onMatch(m, full);
      }
    }
  }
  return { st, count };
}

// ---- 1. two seasons of real matches, every one captured and checked ----
const t0 = Date.now();
const kinds = { league:0, cup:0, euro:0, aet:0, pens:0, agg:0, cards:0, reds:0, unknownScorer:0, etGoals:0, matches:0 };
const counts = {}; let totalEvents = 0;
const samples = { pens:null, aet:null, red:null, league4:null, first:null, two:null };
function check(m, p){
  kinds.matches++;
  kinds[p.competition.kind]++;
  if (p.official.extra==='aet') kinds.aet++;
  if (p.official.extra==='pens') kinds.pens++;
  if (p.official.aggregate) kinds.agg++;
  kinds.cards += p.official.cards.length; kinds.reds += p.official.cards.filter(c=>c.card==='red').length;
  kinds.unknownScorer += p.official.scorers.filter(s=>!s.playerId).length;
  kinds.etGoals += p.official.scorers.filter(s=>s.period==='extraTime').length;
  for (const e of p.events){ counts[e.type]=(counts[e.type]||0)+1; totalEvents++; }
  if (!samples.first) samples.first = { m, p };
  if (!samples.two && p.official.scorers.length>=2) samples.two = { m, p };
  if (!samples.pens && p.official.extra==='pens') samples.pens = { m, p };
  if (!samples.aet && p.official.extra==='aet') samples.aet = { m, p };
  if (!samples.red && p.official.cards.some(c=>c.card==='red')) samples.red = { m, p };
  if (!samples.league4 && p.competition.kind==='league' && p.official.homeGoals+p.official.awayGoals>=4) samples.league4 = { m, p };
  // reconcile with the engine's record
  ok(p.official.homeGoals===m.gH && p.official.awayGoals===m.gA, 'score mismatch '+p.matchId);
  ok(p.official.scorers.length===m.gH+m.gA, 'scorer count '+p.matchId+' '+p.official.scorers.length+' vs '+(m.gH+m.gA));
  const goals = p.events.filter(e=>e.type===MD.EVENT.GOAL);
  ok(goals.length===m.gH+m.gA, 'GOAL events '+p.matchId);
  ok(goals.filter(g=>g.teamId===p.teams.home.id).length===m.gH, 'home GOAL events '+p.matchId);
  for (const g of goals){ const s = p.official.scorers.find(x=>x.eventId===g.eventRef); ok(s && s.teamId===g.teamId && s.playerId===g.playerId, 'goal ref '+p.matchId); ok(Math.abs(Math.floor(g.matchSecond/60)+1-s.minute)<=1 || (s.minute>90 && g.matchSecond>=5400) || g.matchSecond>=5395, 'goal minute '+p.matchId+' '+g.matchSecond+' vs '+s.minute); }
  const gs = goals.map(g=>g.matchSecond); ok(gs.every((v,i)=>i===0 || v-gs[i-1]>=20), 'goals at least 20s apart '+p.matchId+' '+gs.join(','));
  ok(p.events.filter(e=>e.type===MD.EVENT.CARD).length===p.official.cards.length, 'card events '+p.matchId);
  ok(p.events.filter(e=>e.type===MD.EVENT.SENT_OFF).length===p.official.cards.filter(c=>c.card==='red').length, 'sent off events '+p.matchId);
  const last = p.events[p.events.length-1];
  if (p.official.extra==='pens') ok(last.type===MD.EVENT.SHOOTOUT_RESULT && last.teamId===p.official.penaltiesWinnerTeamId, 'pens result '+p.matchId);
  else if (p.official.extra==='aet') ok(last.type===MD.EVENT.ET_END && last.matchSecond===7200, 'aet end '+p.matchId);
  else ok(last.type===MD.EVENT.FULL_TIME && last.matchSecond===5400, 'ft end '+p.matchId+' '+last.type);
  ok(p.events.filter(e=>e.type===MD.EVENT.HALF_TIME).length===1 && p.events.filter(e=>e.type===MD.EVENT.FULL_TIME).length===1, 'one half-time and one full-time '+p.matchId);
  if (m.agg){
    ok(p.official.aggregate.home===m.agg.b && p.official.aggregate.away===m.agg.a, 'aggregate orientation '+p.matchId);
    ok(p.official.winnerTeamId==='club-'+m.winner, 'winner '+p.matchId);
    const ft = p.events.find(e=>e.type===MD.EVENT.FULL_TIME); ok(/aggregate/.test(ft.text), 'aggregate commentary '+p.matchId);
  }
  ok(Object.isFrozen(p) && Object.isFrozen(p.events), 'frozen '+p.matchId);
  ok(p.teams.home.kit.primary!==p.teams.away.kit.primary, 'kit clash '+p.matchId);
}
const A = runWorld(4242, E.CFG.WEEKS*2, true, check);
console.log(`captured ${kinds.matches} matches in ${Date.now()-t0}ms`);
console.log('kinds', JSON.stringify(kinds));
console.log('events per match', (totalEvents/kinds.matches).toFixed(0), JSON.stringify(counts));
ok(kinds.league>0 && kinds.cup>0 && kinds.euro>0, 'all competition kinds seen');
ok(kinds.aet>0 && kinds.pens>0 && kinds.agg>0, 'aet, pens and aggregates seen');
ok(kinds.reds>0, 'a red card seen');
ok(kinds.unknownScorer===0, 'engine credits every goal (ET fix)');
ok(kinds.etGoals>0, 'extra-time goals credited');

// ---- 2. determinism ----
{
  const { m, p } = samples.two;
  const a = MD.withTimeline(MD.capture(A.st, m, { season:1, week:1 }));
  const b = MD.withTimeline(MD.capture(A.st, m, { season:1, week:1 }));
  ok(JSON.stringify(a)===JSON.stringify(b), 'same match, same timeline');
  const c = MD.withTimeline(MD.capture(A.st, m, { season:1, week:2 }));
  ok(JSON.stringify(a.events)!==JSON.stringify(c.events), 'different seed, different choreography');
  ok(a.official.homeGoals===c.official.homeGoals && a.events.filter(e=>e.type==='GOAL').length===c.events.filter(e=>e.type==='GOAL').length, 'different seed, same official facts');
}

// ---- 3. RNG isolation: a seeded world is identical with or without presentations ----
// (the engine's RNG is one module-level generator, so the two worlds run one after the other,
//  each reseeded by newGame; gameId is a timestamp and is ignored)
{
  const t1 = Date.now();
  const X = runWorld(777, 31, true), Y = runWorld(777, 31, false);
  X.st.gameId = Y.st.gameId = 'ignored';
  const sx = JSON.stringify(X.st), sy = JSON.stringify(Y.st);
  ok(sx===sy, 'presentation building changed the game state');
  ok(!/schemaVersion/.test(sx), 'no presentation leaked into the game state');
  ok(X.count>800, 'captured every match of 31 weeks ('+X.count+')');
  console.log(`isolation check ${Date.now()-t1}ms, state ${(sx.length/1024).toFixed(0)}KB`);
}

// ---- 4. unknown scorer tolerated ----
{
  const sample = samples.two.p;
  const o = JSON.parse(JSON.stringify(sample)); o.events = null;
  o.official.scorers[0].playerId = null; o.official.scorers[0].playerName = 'Own goal';
  const full = MD.withTimeline(o);
  const g = full.events.find(e=>e.type==='GOAL');
  ok(g.playerId===null && /Own goal/.test(g.text), 'unknown scorer handled');
  // and tampering with the score is caught
  const bad = JSON.parse(JSON.stringify(sample)); bad.events = null; bad.official.homeGoals++;
  let threw = false; try { MD.withTimeline(bad); } catch(e){ threw = true; }
  ok(threw, 'score tampering rejected');
}

// ---- 5. scenes ----
{
  const t2 = Date.now(); let calls = 0;
  const picks = [samples.pens, samples.aet, samples.red, samples.league4, samples.first].filter(Boolean);
  for (const { p } of picks){
    const sc = MD.createScene(p);
    let lastScore = { home:0, away:0 }, maxMove = 0, prevScene = null, carried = 0, frames = 0;
    for (let t=0; t<=sc.duration+1; t+=0.5){
      const s = sc.getSceneAt(t); calls++; frames++;
      ok(s.ball.x>=-0.03 && s.ball.x<=1.03 && s.ball.y>=0 && s.ball.y<=1, 'ball off pitch '+p.matchId+' t='+t);   // a scored ball sits just inside the net
      ok(s.players.length===p.players.length, 'player count');
      for (const pl of s.players){ if (pl.sentOff) continue; ok(pl.x>=0 && pl.x<=1 && pl.y>=0 && pl.y<=1, 'player off pitch '+pl.name+' t='+t+' '+pl.x+','+pl.y); }
      ok(s.score.home>=lastScore.home && s.score.away>=lastScore.away, 'score went backwards'); lastScore = s.score;
      if (s.ball.carrierId){ carried++; const c = s.players.find(x=>x.id===s.ball.carrierId); const dm = Math.hypot((c.x-s.ball.x)*105, (c.y-s.ball.y)*68); ok(dm < 3.0, 'carrier not on the ball ('+dm.toFixed(1)+'m) '+p.matchId+' t='+t); }
      if (prevScene && prevScene.phase===s.phase) for (const pl of s.players){ const q = prevScene.players.find(x=>x.id===pl.id); if (!pl.sentOff && !q.sentOff) maxMove = Math.max(maxMove, Math.hypot(pl.x-q.x, pl.y-q.y)); }
      prevScene = s;
    }
    const end = sc.getSceneAt(sc.duration+5);
    ok(end.score.home===p.official.homeGoals && end.score.away===p.official.awayGoals, 'final scene score '+p.matchId);
    ok(['fullTime','etEnd','final'].includes(end.phase), 'final phase '+end.phase);
    ok(sc.getSceneAt(0).phase==='firstHalf' && sc.getSceneAt(2700).phase==='secondHalf', 'phases');
    const sh = sc.getSceneAt(100), sh2 = sc.getSceneAt(2800);
    const gkH = p.players.find(x=>x.teamId===p.teams.home.id && x.role==='GK').id;
    ok(sh.players.find(x=>x.id===gkH).x<0.2 && sh2.players.find(x=>x.id===gkH).x>0.8, 'home keeper swaps ends at half-time');
    if (p.official.cards.some(c=>c.card==='red')){ const red = p.official.cards.find(c=>c.card==='red'); ok(end.players.find(x=>x.id===red.playerId).sentOff, 'sent-off player flagged'); }
    ok(carried/frames>0.4, 'ball mostly carried ('+(100*carried/frames).toFixed(0)+'%) '+p.matchId);
    // formation: each team's lines are spread across the full width and centred, per team
    const anchors = MD.formationAnchors(p.players);
    for (const teamId of [p.teams.home.id, p.teams.away.id]){
      for (const role of ['DEF','MID','FWD']){
        const ys = p.players.filter(x=>x.teamId===teamId && x.role===role).map(x=>anchors[x.id].y);
        if (ys.length<2) continue;
        const lo = Math.min(...ys), hi = Math.max(...ys);
        ok(hi-lo >= 0.2 && Math.abs((lo+hi)/2-0.5) < 0.01, `${role} line of ${teamId} centred and spread (${ys.map(v=>v.toFixed(2)).join(',')})`);
      }
    }
    ok(maxMove<0.1, 'player jumped '+maxMove.toFixed(3)+' in half a second '+p.matchId);
    // and at fine steps (a frame at the fastest highlight rate) nothing teleports
    let fine = 0, q0 = null; for (let t=0; t<=sc.duration; t+=0.05){ const s = sc.getSceneAt(t); if (q0 && q0.phase===s.phase) for (const pl of s.players){ const q = q0.players.find(x=>x.id===pl.id); if (!pl.sentOff && !q.sentOff) fine = Math.max(fine, Math.hypot(pl.x-q.x, pl.y-q.y)); } q0 = s; }
    ok(fine<0.02, 'no teleport at 50ms steps (worst '+fine.toFixed(3)+') '+p.matchId);
  }
  console.log(`scene calls ${calls} in ${Date.now()-t2}ms (${((Date.now()-t2)/calls*1000).toFixed(1)}us each)`);
}

console.log(fails? `\n${fails} FAILURES` : '\nALL MATCHDAY TESTS PASSED');
process.exit(fails? 1 : 0);
