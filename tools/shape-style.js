#!/usr/bin/env node
'use strict';
// Where the side WITHOUT the ball stands in the match pictures, set beside its pressing setting (the tactics milestone,
// slice 3, stage B). It changes nothing; it only measures.
//
// It plays matches through the engine, builds each one's scene exactly as the game does, and twice a second of open play
// looks at the side that has not got the ball:
//   the lines     how far from its own goal line its defenders and its midfielders stand, and how long the side is from back to front
//   the squeeze   how far its back line is from the ball
//   closing down  how near its nearest outfield player is to the man on the ball, and how often somebody is within 3 m of him
//   offside look  how often an attacker is standing beyond its last defender, ahead of the ball, in its half (the pictures have
//                 no offside law: this is only how often it would LOOK offside)
// grouped by that side's pressing (Low, Normal, High), and by where the ball is (its own third, the middle, the far third).
//
//   node tools/shape-style.js                       60 matches as the game plays them
//   node tools/shape-style.js --matches 120
//   node tools/shape-style.js --force "0,0,1,0/0,0,-1,0"    every match drawn with these plans, home/away (mentality,passing,pressing,shooting)
//   node tools/shape-style.js --src some/dir        take the matchday modules from another folder (to measure a trial copy)
//   node tools/shape-style.js --out file.json
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const E = require(path.join(ROOT, 'engine.js')); globalThis.Engine = E;
const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0? d : process.argv[i + 1]; };
const SRC = path.resolve(arg('--src', path.join(ROOT, 'src', 'matchday'))), N = +arg('--matches', 60), OUT = arg('--out', ''), FORCE = arg('--force', '');
for (const f of ['schema', 'capture', 'timeline', 'behaviour', 'trajectories', 'interactions', 'scene']) require(path.join(SRC, f + '.js'));
const MD = globalThis.Matchday;
const planFrom = q => { const v = q.split(',').map(Number); return { m: v[0]|0, p: v[1]|0, r: v[2]|0, s: v[3]|0 }; };
if (FORCE) globalThis.__sm91StyleOverride = { home: planFrom(FORCE.split('/')[0]), away: planFrom(FORCE.split('/')[1] || FORCE.split('/')[0]) };
const PX = 105, PY = 68; const dm = (a, b) => Math.hypot((a.x - b.x)*PX, (a.y - b.y)*PY);
const NAMES = ['Low press', 'Normal', 'High press'], BANDS = ['ball in its own third', 'ball in the middle third', 'ball in the far third'];
const blank = () => ({ n: 0, def: 0, mid: 0, len: 0, gap: 0, carried: 0, near: 0, close: 0, off: 0 });
const G = [0, 1, 2].map(() => ({ all: blank(), band: [blank(), blank(), blank()] }));
let matches = 0, samples = 0;
const seeds = [1991, 7, 42, 1992, 2001, 2002, 2003, 2004];
outer: for (let w = 0; w < 6; w++) for (const seed of seeds){
  const st = E.newGame({ seed: seed + w*1000, userClub: 3 }); for (let k = 0; k <= w % 3; k++) E.advanceWeek(st); const res = E.advanceWeek(st);
  for (let i = 0; i < res.length; i += 4){ if (matches >= N) break outer;
    const p = MD.withTimeline(MD.capture(st, res[i], st.lastWeekInfo)); if (!p.tactics) continue; const sc = MD.createScene(p); matches++;
    const H = p.teams.home.id; const end = p.events[p.events.length - 1].matchSecond;
    for (let t = 2; t < end; t += 0.5){ const s = sc.getSceneAt(t); if (!s.live || s.setPiece || s.ball.state === 'dead' || !s.possession) continue;
      const D = s.possession === H? p.teams.away.id : H; const dir = s.attackDir[D]; const depth = q => (dir === 1? q.x : 1 - q.x)*PX;   // metres from the defending side's own goal line
      const tac = D === H? p.tactics.home : p.tactics.away; const g = G[tac.r + 1]; const bd = depth(s.ball); const band = bd < 35? 0 : bd < 70? 1 : 2;
      const own = s.players.filter(q => q.teamId === D && !q.sentOff), opp = s.players.filter(q => q.teamId !== D && !q.sentOff);
      const mean = a => a.length? a.reduce((x, q) => x + depth(q), 0)/a.length : NaN;
      const def = mean(own.filter(q => q.role === 'DEF')), mid = mean(own.filter(q => q.role === 'MID')), fwd = mean(own.filter(q => q.role === 'FWD'));
      if (!(def === def) || !(mid === mid)) continue;
      const out = own.filter(q => q.role !== 'GK'); const carrier = s.ball.carrierId? s.players.find(q => q.id === s.ball.carrierId) : null;
      const depths = own.map(depth).sort((a, b) => a - b); const lastMan = depths.length > 1? depths[1] : depths[0];       // the second man back, the keeper counted: the offside line
      const offside = opp.some(q => q.role !== 'GK' && depth(q) < lastMan - 0.5 && depth(q) < bd - 0.5 && depth(q) < PX/2);
      for (const b of [g.all, g.band[band]]){ b.n++; b.def += def; b.mid += mid; b.len += (fwd === fwd? fwd : mid) - def; b.gap += bd - def; if (offside) b.off++;
        if (carrier && carrier.teamId !== D){ const d = Math.min.apply(null, out.map(q => dm(q, carrier))); b.carried++; b.near += d; if (d <= 3) b.close++; } }
      samples++; } } }
const f = (x, d = 1) => x.toFixed(d), pc = x => (100*x).toFixed(1) + '%';
const row = b => b.n? `back line ${f(b.def/b.n)} m, midfield ${f(b.mid/b.n)} m from its goal line | back to front ${f(b.len/b.n)} m | back line to the ball ${f(b.gap/b.n)} m | nearest man to the carrier ${f(b.near/Math.max(1, b.carried))} m, within 3 m ${pc(b.close/Math.max(1, b.carried))} | an attacker beyond the last defender ${pc(b.off/b.n)}` : 'no samples';
console.log(`${matches} matches${FORCE? ' forced to ' + FORCE : ' as the game plays them'}, ${samples} moments of open play (modules from ${path.relative(ROOT, SRC) || '.'})`);
console.log('\nThe side WITHOUT the ball, by its pressing:');
G.forEach((g, r) => { console.log(`  ${NAMES[r].padEnd(10)} (${g.all.n} moments)  ${row(g.all)}`); });
BANDS.forEach((name, k) => { console.log(`\n  with the ${name}:`); G.forEach((g, r) => console.log(`    ${NAMES[r].padEnd(10)} ${row(g.band[k])}`)); });
const d = k => G[2].all.n && G[0].all.n? G[2].all[k]/G[2].all.n - G[0].all[k]/G[0].all.n : NaN;
console.log(`\nHigh press against Low press: back line ${f(d('def'))} m higher, midfield ${f(d('mid'))} m higher.`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ matches, samples, force: FORCE || null, groups: G.map((g, r) => ({ press: NAMES[r], all: g.all, band: g.band })) }, null, 1));
