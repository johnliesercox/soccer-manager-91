#!/usr/bin/env node
'use strict';
// An audit of the training and development rules as they stand (first run on the 1.8.0 release candidate, 26 November 2026,
// for the training milestone's scope proposal). It plays whole seasons on the game's own engine with a manager's club left on
// one training intensity and one grade of coach, and counts what really happens: skill gained in weekly training by age and
// by position, the summer change for the manager's club and for the computer clubs, how many young players reach their
// potential, training knocks, the fitness of the best eleven, match injuries and first-season points. It changes nothing.
//
//   node tools/training-audit.js                      every intensity with every coach, 10 worlds of 5 seasons
//   SEEDS=12 SEASONS=6 node tools/training-audit.js   the run the proposal quotes (about ten minutes)
//   ONLY=hard3 node tools/training-audit.js           one row: light|normal|hard and the coach's grade 0 to 3
//
// "Training knocks" counts every injury that did not come from a match, so about one a season of it is the game's other
// misfortunes (it reads 1.0 on Light, where training itself injures nobody).
const E = require(require('path').join(__dirname, '..', 'engine.js'));
const U = +process.env.U || 20, SEEDS = +process.env.SEEDS || 10, SEASONS = +process.env.SEASONS || 5;
const band = a => a <= 21? '17-21' : a <= 24? '22-24' : a <= 27? '25-27' : a <= 30? '28-30' : '31+';
const BANDS = ['17-21', '22-24', '25-27', '28-30', '31+'], POS = ['GK', 'DEF', 'MID', 'FWD'];
const unsack = st => { if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } };
function run(intensity, coach, physio){
  const R = { wk: {}, wkN: {}, sum: {}, sumN: {}, cpuSum: {}, cpuSumN: {}, knocks: 0, playerSeasons: 0, fit: 0, fitN: 0, lowFit: 0, pts1: [], pos1: [], atPot: [], comp: { GK: 0, DEF: 0, MID: 0, FWD: 0 }, compN: 0, room: { GK: 0, DEF: 0, MID: 0, FWD: 0 }, roomN: { GK: 0, DEF: 0, MID: 0, FWD: 0 }, gainPos: { GK: 0, DEF: 0, MID: 0, FWD: 0 }, squadGain: [], matchInj: 0, valueUp: [] };
  for (const b of BANDS){ R.wk[b] = R.wkN[b] = R.sum[b] = R.sumN[b] = R.cpuSum[b] = R.cpuSumN[b] = 0; }
  for (let seed = 1; seed <= SEEDS; seed++){ const st = E.newGame({ seed: 9000 + seed, userClub: U });
    for (let s = 0; s < SEASONS; s++){ const u = st.clubs[st.userClub]; E.setTraining(st, intensity); E.setStaff(st, 'coach', coach); if (physio !== undefined) E.setStaff(st, 'physio', physio);
      const sq0 = u.players.map(id => st.players[id]); for (const p of sq0){ R.comp[p.pos]++; if (p.age <= 27){ R.roomN[p.pos]++; R.room[p.pos] += p.pot - p.skill; } } R.compN++;
      let seasonGain = 0; const v0 = sq0.reduce((a, p) => a + p.value, 0);
      const season = st.season; let snap = null, uid = st.clubs[st.userClub].id;
      while (st.season === season){ const uu = st.clubs[st.userClub]; const sq = uu.players.map(id => st.players[id]); const before = new Map(sq.map(p => [p.id, { s: p.skill, inj: p.injury }])); const last = st.week >= E.CFG.WEEKS;
        if (last){ uid = uu.id; R.playerSeasons += sq.length; R.squadGain.push(seasonGain); const young = sq.filter(p => p.age <= 27); R.atPot.push(young.length? young.filter(p => p.skill >= p.pot).length/young.length : 0);
          snap = new Map(); for (const c of st.clubs) for (const id of c.players){ const p = st.players[id]; snap.set(id, { s: p.skill, a: p.age, human: c.id === uu.id, div: c.div }); } }
        else { const fitMen = sq.filter(p => !p.injury).sort((a, b) => b.skill - a.skill).slice(0, 11); for (const p of fitMen){ R.fit += p.fitness; R.fitN++; if (p.fitness < 70) R.lowFit++; } }
        const res = E.advanceWeek(st); unsack(st); if (last) break;
        const hurt = new Set(); for (const m of res) for (const p of m.injuries) hurt.add(p.id); R.matchInj += res.filter(m => m.home.id === uu.id || m.away.id === uu.id).reduce((a, m) => a + m.injuries.filter(p => p.club === uu.id).length, 0);
        for (const p of sq){ const b = before.get(p.id); if (p.club !== uu.id) continue; const d = p.skill - b.s; R.wk[band(p.age)] += d; R.wkN[band(p.age)]++; R.gainPos[p.pos] += d; seasonGain += d; if (!b.inj && p.injury > 0 && !hurt.has(p.id)) R.knocks++; } }
      if (s === 0){ const h = st.clubs[uid].history; R.pts1.push(h[h.length - 1].pts); R.pos1.push(h[h.length - 1].pos); }
      for (const [id, o] of snap){ const p = st.players[id]; if (!p || p.retired) continue; const b = band(o.a); if (o.human){ R.sum[b] += p.skill - o.s; R.sumN[b]++; } else if (o.div >= 1 && o.div <= 4){ R.cpuSum[b] += p.skill - o.s; R.cpuSumN[b]++; } } } }
  return R; }
const mean = a => a.reduce((x, y) => x + y, 0)/a.length, sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m)*(x - m)))); };
const f = (x, n = 2) => x.toFixed(n);
const only = process.env.ONLY;
console.log(`club ${U}, ${SEEDS} worlds of ${SEASONS} seasons each, ${E.CFG.WEEKS} weeks a season`);
let first = true;
for (const intensity of ['light', 'normal', 'hard']) for (const coach of [0, 1, 2, 3]){ if (only && only !== intensity + coach) continue; const R = run(intensity, coach);
  if (first){ first = false; console.log('squad at the start of a season:', POS.map(k => k + ' ' + f(R.comp[k]/R.compN, 1)).join(', '), '| room to potential of the 27-and-unders:', POS.map(k => k + ' ' + f(R.room[k]/Math.max(1, R.roomN[k]), 1) + ' (' + f(R.roomN[k]/R.compN, 1) + ' men)').join(', '));
    console.log('summer change, the manager\'s club:', BANDS.map(b => b + ' ' + f(R.sum[b]/Math.max(1, R.sumN[b]))).join(', '), '| computer clubs:', BANDS.map(b => b + ' ' + f(R.cpuSum[b]/Math.max(1, R.cpuSumN[b]))).join(', ')); }
  console.log(`${intensity.padEnd(6)} coach ${coach}: weekly training, skill a player a season by age: ${BANDS.map(b => b + ' ' + f(R.wk[b]/Math.max(1, R.wkN[b])*E.CFG.WEEKS)).join(', ')} | squad total (41 weeks) a season ${f(mean(R.squadGain), 1)} (sd ${f(sd(R.squadGain), 1)}) | by position ${POS.map(k => k + ' ' + f(R.gainPos[k]/R.squadGain.length, 1)).join(', ')} | 27-and-unders at potential at season end ${f(mean(R.atPot)*100, 0)}% | training knocks a season ${f(R.knocks/R.squadGain.length, 1)} | fitness of the best eleven ${f(R.fit/R.fitN, 1)}, under 70: ${f(R.lowFit/R.fitN*100, 1)}% | match injuries a season ${f(R.matchInj/R.squadGain.length, 1)} | first-season points ${f(mean(R.pts1), 1)} (sd ${f(sd(R.pts1), 1)})`); }
