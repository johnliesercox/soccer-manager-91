#!/usr/bin/env node
'use strict';
// What the match pictures show, set beside the plan each side played (the tactics milestone, slice 3).
//
// It plays whole seasons through the engine, builds every match's timeline exactly as the game does (Matchday.capture and
// Matchday.withTimeline: the events the isometric highlights are drawn from), and measures each side's football AS DRAWN:
//   passing   passes in a spell of possession, how long they are, how many are long balls
//   pressing  where a side wins the ball back, and how long the other side is allowed to keep it
//   shooting  where its shots are struck from, how many from outside the area, how its goals are finished
//   the ball  its share of the passes drawn, against the possession the match engine gave it
// Each is then grouped by the side's own plan (and, for pressing, the plan of the side without the ball), so the question
// "does a Direct side look Direct?" has a number for an answer. It changes nothing; it only measures.
//
//   node tools/highlight-style.js                  3 worlds, one season each (about 2,900 matches; a minute or so)
//   node tools/highlight-style.js --worlds 6       more
//   node tools/highlight-style.js --out file.json  keep the figures
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const E = require(path.join(ROOT, 'engine.js')); globalThis.Engine = E;
for (const f of ['schema', 'capture', 'timeline']) require(path.join(ROOT, 'src', 'matchday', f + '.js'));
const MD = globalThis.Matchday, EV = MD.EVENT;
const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0? d : process.argv[i + 1]; };
const WORLDS = +arg('--worlds', 3), OUT = arg('--out', '');
const PX = 105, PY = 68, BOX = 16.5, HALF_BOX = 20.16;
const NAMES = { m: ['Defensive', 'Balanced', 'Attacking'], p: ['Short', 'Mixed', 'Direct'], r: ['Low press', 'Normal', 'High press'], s: ['Work it in', 'Balanced', 'On sight'] };
const SHOTS = new Set([EV.SHOT_SAVED, EV.SHOT_WIDE, EV.SHOT_BLOCKED, EV.SHOT_POST, EV.GOAL]);

// one side's football as drawn in one match (normal time only: the ends are simple there)
function measure(p){
  const H = p.teams.home.id, A = p.teams.away.id; const side = () => ({ passes: 0, passLen: 0, long: 0, forward: 0, spells: 0, spellPasses: [], won: 0, wonDist: 0, wonHigh: 0, shots: 0, shotDist: 0, outside: 0, headers: 0, goals: 0, goalDist: 0, goalOutside: 0, crosses: 0, clearances: 0 });
  const S = { [H]: side(), [A]: side() }; const dirOf = (team, sec) => { const hd = MD.homeDirAt(p, sec); return team === H? hd : -hd; };
  let holder = null, run = 0; const endRun = () => { if (holder && run){ S[holder].spells++; S[holder].spellPasses.push(run); } run = 0; };
  for (const e of p.events){ if (e.matchSecond > 90*60) break; const t = e.teamId; if (!S[t]) continue;
    if (e.type === EV.PASS || e.type === EV.CROSS){ if (!e.from || !e.to) continue; const s = S[t], dir = dirOf(t, e.matchSecond); const len = Math.hypot((e.to.x - e.from.x)*PX, (e.to.y - e.from.y)*PY);
      if (holder !== t){ endRun(); holder = t; } run++; s.passes++; s.passLen += len; if (len >= 30) s.long++; if ((e.to.x - e.from.x)*dir*PX >= 10) s.forward++; if (e.type === EV.CROSS) s.crosses++; }
    else if (e.type === EV.TACKLE && e.at){ const s = S[t], dir = dirOf(t, e.matchSecond); const d = (dir === 1? e.at.x : 1 - e.at.x)*PX; s.won++; s.wonDist += d; if (d > PX/2) s.wonHigh++; endRun(); holder = t; }
    else if (e.type === EV.INTERCEPTION && e.to){ const w = t === H? A : H, s = S[w], dir = dirOf(w, e.matchSecond); const d = (dir === 1? e.to.x : 1 - e.to.x)*PX; s.won++; s.wonDist += d; if (d > PX/2) s.wonHigh++; endRun(); holder = w; }
    else if (e.type === EV.CLEARANCE){ S[t].clearances++; }
    else if (SHOTS.has(e.type) && e.from){ const s = S[t], dir = dirOf(t, e.matchSecond); const gx = dir === 1? 1 : 0; const dx = Math.abs(gx - e.from.x)*PX, dy = Math.abs(0.5 - e.from.y)*PY, d = Math.hypot(dx, dy), out = dx > BOX || dy > HALF_BOX;
      s.shots++; s.shotDist += d; if (out) s.outside++; if (e.technique === 'header') s.headers++; if (e.type === EV.GOAL){ s.goals++; s.goalDist += d; if (out) s.goalOutside++; } endRun(); holder = null; } }
  endRun(); return S;
}

const groups = {}; const G = (key) => groups[key] || (groups[key] = { n: 0, passes: 0, passLen: 0, long: 0, forward: 0, spells: 0, sp: 0, one: 0, four: 0, won: 0, wonDist: 0, wonHigh: 0, shots: 0, shotDist: 0, outside: 0, headers: 0, goals: 0, goalDist: 0, goalOutside: 0, crosses: 0, allowed: 0, allowedSpells: 0 });
const add = (key, s, opp) => { const g = G(key); g.n++; for (const k of ['passes', 'passLen', 'long', 'forward', 'spells', 'won', 'wonDist', 'wonHigh', 'shots', 'shotDist', 'outside', 'headers', 'goals', 'goalDist', 'goalOutside', 'crosses']) g[k] += s[k]; for (const v of s.spellPasses){ g.sp += v; if (v === 1) g.one++; if (v >= 4) g.four++; } g.allowed += opp.passes; g.allowedSpells += opp.spells; };
let matches = 0, noPlan = 0; const possPairs = [];
const t0 = Date.now();
for (let w = 0; w < WORLDS; w++){ const st = E.newGame({ seed: 20261120 + w, userClub: 127 });
  for (let wk = 0; wk < E.CFG.WEEKS; wk++){ const res = E.advanceWeek(st); if (st.gameOver){ st.gameOver = null; st.sackOffer = null; }
    for (const m of res){ if (!m.tH || !m.tA){ noPlan++; continue; } const p = MD.withTimeline(MD.capture(st, m, st.lastWeekInfo)); const S = measure(p); const sh = S[p.teams.home.id], sa = S[p.teams.away.id]; matches++;
      for (const [s, o, t] of [[sh, sa, m.tH], [sa, sh, m.tA]]){ add('all', s, o); for (const k of ['m', 'p', 'r', 's']) add(k + t[k], s, o); }
      if (sh.passes + sa.passes > 20) possPairs.push([m.poss, sh.passes/(sh.passes + sa.passes)]); } } }
const f1 = x => x.toFixed(1), pc = x => (100*x).toFixed(1) + '%';
const line = (label, g) => `  ${label.padEnd(12)} ${String(g.n).padStart(5)} sides | passes a spell ${f1(g.sp/g.spells)} | a pass ${f1(g.passLen/g.passes)} m | long balls (30 m+) ${pc(g.long/g.passes).padStart(5)} | forward 10 m+ ${pc(g.forward/g.passes).padStart(5)} | crosses ${pc(g.crosses/g.passes).padStart(5)} | wins the ball ${f1(g.wonDist/g.won)} m from its own line, ${pc(g.wonHigh/g.won).padStart(5)} in the other half | lets the other side play ${f1(g.allowed/g.allowedSpells)} passes a spell | shots ${f1(g.shots/g.n)} a match from ${f1(g.shotDist/g.shots)} m, ${pc(g.outside/g.shots).padStart(5)} from outside the area, ${pc(g.headers/g.shots).padStart(5)} headers | goals from ${f1(g.goalDist/g.goals)} m, ${pc(g.goalOutside/g.goals).padStart(5)} from outside`;
console.log(`${matches} matches from ${WORLDS} season${WORLDS > 1? 's' : ''}, every side measured in normal time (${((Date.now() - t0)/1000).toFixed(0)} s)${noPlan? '; ' + noPlan + ' matches carried no plans and are left out' : ''}`);
console.log('\nEvery side:'); console.log(line('all', groups.all));
for (const k of ['p', 'r', 's', 'm']){ console.log('\nBy ' + { p: 'passing', r: 'pressing', s: 'shooting', m: 'mentality' }[k] + ' (the side\'s own plan):'); for (const v of [-1, 0, 1]) if (groups[k + v]) console.log(line(NAMES[k][v + 1], groups[k + v])); }
// the ball as drawn against the ball as the engine had it
const n = possPairs.length, mx = possPairs.reduce((a, q) => a + q[0], 0)/n, my = possPairs.reduce((a, q) => a + q[1], 0)/n; let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of possPairs){ sxy += (x - mx)*(y - my); sxx += (x - mx)*(x - mx); syy += (y - my)*(y - my); }
const corr = sxy/Math.sqrt(sxx*syy), sdx = Math.sqrt(sxx/n), sdy = Math.sqrt(syy/n);
console.log(`\nThe ball: the home side's possession in the match engine averages ${pc(mx)} (it varies by ${pc(sdx)} from match to match); its share of the passes drawn averages ${pc(my)} (varies by ${pc(sdy)}). The two move together with a correlation of ${corr.toFixed(2)} (1 would be "the pictures show the possession the engine gave", 0 "no connection").`);
// the spread between settings, in one line each: what a viewer could or could not tell apart
const spread = (k, f) => { const v = [-1, 0, 1].filter(x => groups[k + x]).map(x => f(groups[k + x])); return (Math.max(...v) - Math.min(...v)); };
const report = { matches, worlds: WORLDS, groups: {}, possession: { engineMean: mx, drawnMean: my, correlation: corr },
  spread: { passLenByPassing: spread('p', g => g.passLen/g.passes), longByPassing: spread('p', g => g.long/g.passes), spellByPassing: spread('p', g => g.sp/g.spells), wonDistByPressing: spread('r', g => g.wonDist/g.won), wonHighByPressing: spread('r', g => g.wonHigh/g.won), allowedByPressing: spread('r', g => g.allowed/g.allowedSpells), outsideByShooting: spread('s', g => g.outside/g.shots), shotDistByShooting: spread('s', g => g.shotDist/g.shots) } };
for (const k of Object.keys(groups)){ const g = groups[k]; report.groups[k] = { sides: g.n, passesASpell: g.sp/g.spells, passLen: g.passLen/g.passes, long: g.long/g.passes, forward: g.forward/g.passes, wonDist: g.wonDist/g.won, wonHigh: g.wonHigh/g.won, allowed: g.allowed/g.allowedSpells, shots: g.shots/g.n, shotDist: g.shotDist/g.shots, outside: g.outside/g.shots, headers: g.headers/g.shots, goalDist: g.goalDist/g.goals, goalOutside: g.goalOutside/g.goals }; }
const s = report.spread;
console.log(`\nThe difference between the settings of each control, as drawn:`);
console.log(`  passing (Short, Mixed, Direct):      a pass differs by ${f1(s.passLenByPassing)} m, long balls by ${pc(s.longByPassing)}, passes a spell by ${s.spellByPassing.toFixed(2)}`);
console.log(`  pressing (Low, Normal, High):        the ball is won ${f1(s.wonDistByPressing)} m apart, in the other half ${pc(s.wonHighByPressing)} apart, and the other side's passes a spell differ by ${s.allowedByPressing.toFixed(2)}`);
console.log(`  shooting (Work it in, Balanced, On sight): shots from outside the area differ by ${pc(s.outsideByShooting)}, the distance by ${f1(s.shotDistByShooting)} m`);
if (OUT){ fs.writeFileSync(OUT, JSON.stringify(report, null, 1)); console.log('written to ' + OUT); }
