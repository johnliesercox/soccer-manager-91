#!/usr/bin/env node
'use strict';
// An audit of how positions are used as the game stands (first run on the training branch, 27 November 2026, for the scope
// proposal for position retraining). It plays whole seasons on the game's own engine with a manager's club left to the game's
// own team selection in one formation, and counts what really happens: how often a man starts out of his position and where,
// what that costs in effective skill, and how much of it one well-chosen second position would have given back. It also
// counts the same for the computer clubs. It changes nothing: no player is given a second position; the "would have given
// back" figures are arithmetic on the elevens the game really picked.
//
//   node tools/position-audit.js                       every formation, 30 worlds of 3 seasons
//   WORLDS=60 SEASONS=4 node tools/position-audit.js   the run the proposal quotes
const path = require('path'); const E = require(path.join(__dirname, '..', 'engine.js'));
const U = +process.env.U || 20, WORLDS = +process.env.WORLDS || 30, SEASONS = +process.env.SEASONS || 3, AS = +process.env.AS || 0.95;   // AS: what a learned position would be worth
const pen = (nat, slot) => nat === slot? 1 : nat === 'GK'? 0.5 : slot === 'GK'? 0.45 : ((nat === 'DEF' && slot === 'MID') || (nat === 'MID' && slot === 'DEF') || (nat === 'MID' && slot === 'FWD') || (nat === 'FWD' && slot === 'MID'))? 0.85 : 0.7;
const kind = (nat, slot) => nat === 'GK' || slot === 'GK'? 'goalkeeper' : pen(nat, slot) === 0.85? 'next line' : 'far line';
const unsack = st => { if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } };
const f = (x, n = 1) => x.toFixed(n);
function run(formation){
  const R = { weeks: 0, weeksOut: 0, starts: 0, out: {}, lost: 0, moves: {}, seasons: [], ageOut: { young: 0, mid: 0, old: 0 }, cpuSides: 0, cpuOut: 0, cpuStarts: 0, cpuOutStarts: 0, short: { DEF: 0, MID: 0, FWD: 0, GK: 0 } };
  for (let w0 = 0; w0 < WORLDS; w0++){ const st = E.newGame({ seed: 30000 + w0, userClub: U });
    for (let s = 0; s < SEASONS; s++){ const season = st.season, perMan = {}; let lostSeason = 0, weeksSeason = 0;
      while (st.season === season){ const c = st.clubs[st.userClub]; c.formation = formation; c.xi = null; const xi = E.autoSelect(st, c), fm = E.FORMATIONS[formation];
        if (st.week < E.CFG.WEEKS){ R.weeks++; weeksSeason++; let any = false; const avail = E.squadOf(st, c).filter(p => p.injury === 0 && !(p.ban > 0));
          for (const [slot, n] of [['GK', 1], ['DEF', fm.d], ['MID', fm.m], ['FWD', fm.f]]) if (avail.filter(p => p.pos === slot).length < n) R.short[slot]++;
          for (const x of xi){ R.starts++; if (x.slot !== x.p.pos){ any = true; const k = kind(x.p.pos, x.slot); R.out[k] = (R.out[k] || 0) + 1; const base = E.effSkill(x.p, x.slot)/pen(x.p.pos, x.slot), cost = base*(1 - pen(x.p.pos, x.slot)); R.lost += cost; lostSeason += cost;
              R.ageOut[x.p.age <= 23? 'young' : x.p.age <= 27? 'mid' : 'old']++; const mv = x.p.pos + ' to ' + x.slot; R.moves[mv] = (R.moves[mv] || 0) + 1;
              if (k !== 'goalkeeper'){ const key = x.p.id + ':' + x.slot; perMan[key] = (perMan[key] || 0) + base*(AS - pen(x.p.pos, x.slot)); } } }
          if (any) R.weeksOut++;
          if (w0 < 6) for (const k of st.clubs) if (k.div === c.div && k.id !== c.id){ const x2 = E.autoSelect(st, k); R.cpuSides++; const o = x2.filter(x => x.slot !== x.p.pos).length; if (o) R.cpuOut++; R.cpuStarts += x2.length; R.cpuOutStarts += o; } }
        E.advanceWeek(st); unsack(st); }
      const best = Object.values(perMan).sort((a, b) => b - a); R.seasons.push({ lost: lostSeason/weeksSeason, one: (best[0] || 0)/weeksSeason, two: ((best[0] || 0) + (best[1] || 0))/weeksSeason }); } }
  return R; }
const mean = a => a.reduce((x, y) => x + y, 0)/a.length;
console.log(`club ${U} (Division 2), ${WORLDS} worlds of ${SEASONS} seasons, the game's own team selection; a learned position taken as worth ${AS*100}% of a man's skill`);
console.log('as the game is: a man in the next line plays at 85% of his skill, in the far line at 70%, an outfield man in goal at 45%, a goalkeeper outfield at 50%');
let cpu = null;
for (const fm of Object.keys(E.FORMATIONS)){ const R = run(fm), n = R.seasons.length, one = mean(R.seasons.map(s => s.one)), two = mean(R.seasons.map(s => s.two)), lost = mean(R.seasons.map(s => s.lost)); if (!cpu) cpu = R;
  const outs = Object.values(R.out).reduce((a, b) => a + b, 0);
  console.log(`${fm}: a man out of position in ${f(100*R.weeksOut/R.weeks, 0)}% of weeks (${f(outs/R.weeks, 2)} men a week: ${Object.entries(R.out).map(([k, v]) => k + ' ' + f(100*v/outs, 0) + '%').join(', ') || 'none'}); most often ${Object.entries(R.moves).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + f(100*v/outs, 0) + '%').join(', ')}; short of natural men: DEF ${f(100*R.short.DEF/R.weeks, 0)}%, MID ${f(100*R.short.MID/R.weeks, 0)}%, FWD ${f(100*R.short.FWD/R.weeks, 0)}%, GK ${f(100*R.short.GK/R.weeks, 0)}% of weeks | effective skill lost to it ${f(lost, 1)} a match (${f(lost/11, 2)} a man) | one second position, well chosen, would give back ${f(one, 1)} a match (${f(one/11, 2)} a man, about ${f(one/11*1.4, 2)} league points a season); two would give back ${f(two, 1)} (${f(two/11*1.4, 2)} points) | of the men out of position: 23 and under ${f(100*R.ageOut.young/Math.max(1, outs), 0)}%, 24 to 27 ${f(100*R.ageOut.mid/Math.max(1, outs), 0)}%, 28 and over ${f(100*R.ageOut.old/Math.max(1, outs), 0)}%`); }
console.log(`the computer clubs of the same division (all in 4-4-2): a man out of position in ${f(100*cpu.cpuOut/cpu.cpuSides, 0)}% of their sides, ${f(100*cpu.cpuOutStarts/cpu.cpuStarts, 1)}% of their starts`);
