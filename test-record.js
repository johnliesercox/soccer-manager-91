'use strict';
// The match record keeps time (Milestone 3D, the one engine change since 1.5.0): nobody scores after he has been sent
// off, a second booking comes after the first, and nothing else moved: scores, scorers, cards, bans, statistics and
// money are identical to the 1.5.0 engine for the same seed, week after week. Only the minutes of the affected goals
// and cards differ, and no random number is consumed by the correction, so saves made on 1.5.0 play on identically.
const E = require('./engine.js'); const E150 = require('./legacy/engine.v150.js');
E.CFG.TACTICS.on = false;   // the comparison with 1.5.0 is of everything but the match plans (the tactics milestone), which test-tactics.js covers
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c){ fails++; console.log('FAIL', m); } };
const SEEDS = [1991, 7, 42, 2026];
let matches = 0, goals = 0, afterRed = 0, secondYellows = 0, outOfOrder = 0, movedGoals = 0, movedCards = 0, oddMinutes = 0;
for (const seed of SEEDS){
  const a = E.newGame({ seed, userClub: 3 }), b = E150.newGame({ seed, userClub: 3 });
  for (let w=0; w<42; w++){
    const ra = E.advanceWeek(a), rb = E150.advanceWeek(b);
    for (const s of [a, b]) if (s.gameOver){ s.gameOver = null; s.sackOffer = null; }
    ok(ra.length===rb.length, `seed ${seed} week ${w+1}: same number of matches`);
    for (let i=0;i<ra.length;i++){
      const m = ra[i], n = rb[i]; matches++;
      ok(m.home.id===n.home.id && m.away.id===n.away.id && m.gH===n.gH && m.gA===n.gA && m.extra===n.extra, `seed ${seed} week ${w+1}: same fixture and score (${m.home.name} ${m.gH}-${m.gA} ${m.away.name})`);
      ok(m.scorers.map(s=>s.side+s.p.id+(s.et?'e':'')).sort().join()===n.scorers.map(s=>s.side+s.p.id+(s.et?'e':'')).sort().join(), `seed ${seed} week ${w+1}: same scorers`);
      ok((m.cards||[]).map(c=>c.side+c.p.id+c.type).sort().join()===(n.cards||[]).map(c=>c.side+c.p.id+c.type).sort().join(), `seed ${seed} week ${w+1}: same cards`);
      ok((m.bans||[]).map(c=>c.p.id+':'+c.n).sort().join()===(n.bans||[]).map(c=>c.p.id+':'+c.n).sort().join(), `seed ${seed} week ${w+1}: same bans`);
      // minutes moved only where the old record contradicted itself
      const oldMin = {}; for (const s of n.scorers) oldMin['g'+s.side+s.p.id] = (oldMin['g'+s.side+s.p.id]||[]).concat(s.min); for (const c of n.cards||[]) oldMin['c'+c.side+c.p.id+c.type] = c.min;
      const reds = {}, yellows = {}; for (const c of m.cards||[]){ if (c.type==='R') reds[c.p.id] = c.min; else yellows[c.p.id] = c.min; }
      for (const c of m.cards||[]) if (c.type==='R' && yellows[c.p.id]!==undefined){ secondYellows++; if (c.min <= yellows[c.p.id]) outOfOrder++; if (oldMin['c'+c.side+c.p.id+'R']!==c.min) movedCards++; }
      for (const s of m.scorers){ goals++; if (reds[s.p.id]!==undefined && s.min >= reds[s.p.id]) afterRed++; if (!(oldMin['g'+s.side+s.p.id]||[]).includes(s.min)) movedGoals++;
        if (s.min < 1 || (!s.et && s.min > 90) || (s.et && (s.min < 91 || s.min > 120))) oddMinutes++; }
      for (const c of m.cards||[]) if (c.min < 1 || c.min > 120) oddMinutes++;
    }
  }
  // the same players with the same statistics and the same money at the end of a season
  const stats = st => Object.values(st.players).map(p=>[p.id, p.goals, p.yellows||0, p.reds||0, p.ban||0, p.apps].join(':')).join('|') + '#' + st.clubs.map(c=>[c.id, c.balance, c.pts, c.leaguePos].join(':')).join('|');
  ok(stats(a)===stats(b), `seed ${seed}: player statistics, bans, points and balances identical after a season`);
}
console.log(`${matches} matches, ${goals} goals: goals at or after the scorer's own dismissal ${afterRed}, second bookings not after the first ${outOfOrder} of ${secondYellows}; minutes moved: ${movedGoals} goals, ${movedCards} dismissals; minutes out of range ${oddMinutes}`);
ok(afterRed===0, 'nobody scores after he has been sent off');
ok(outOfOrder===0, 'a second booking comes after the first');
ok(oddMinutes===0, 'every minute is within its half');
ok(movedGoals > 0 && movedCards > 0, 'the correction did something in four seasons');
// determinism: the same seed twice gives the same record, minutes included
{
  const rec = seed => { const st = E.newGame({ seed, userClub: 3 }); const out = []; for (let w=0; w<10; w++){ for (const m of E.advanceWeek(st)) out.push(m.scorers.map(s=>s.p.id+'@'+s.min).join(',')+'/'+(m.cards||[]).map(c=>c.p.id+c.type+'@'+c.min).join(',')); if (st.gameOver){ st.gameOver=null; st.sackOffer=null; } } return out.join(';'); };
  ok(rec(5)===rec(5), 'deterministic: the same seed gives the same minutes');
}
console.log(checks+' checks, '+fails+' failures'); if (fails) process.exit(1); console.log('ALL RECORD TESTS PASSED');
