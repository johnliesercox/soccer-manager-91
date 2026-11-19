'use strict';
// Tactics and the rebalanced formations (Milestone 1, slice 1: the engine, no screens).
//
// What this suite holds the engine to:
//   1. With the new rules off, the engine is the 1.7.1 engine exactly: every match, and the whole game state.
//   2. With the rules on and every side all-Balanced in 4-4-2, every match is still drawn exactly as in 1.7.1: the plans
//      and the formation table are "times one" there and draw no random number.
//   3. The same seed and the same plans give the same matches; a plan changes them only through the plan.
//   4. A plan belongs to a manager's club, survives a save, and nothing but the three values -1, 0, +1 gets in.
//   5. Computer managers: a club's style is fixed by its id, its mentality follows the fixture, its passing answers a
//      different number in midfield, and no random number is used.
//   6. A side short of a man is valued exactly as before.
//   7. The balance targets that can be worked out exactly (tools/tactics-balance.js, quick mode) are met.
//   8. Seasons play through with the rules on, and the figures a match was drawn from are kept for the manager.
const path = require('path'), cp = require('child_process');
const fresh = f => { delete require.cache[require.resolve(f)]; return require(f); };
const Eold = require('./legacy/engine.v171.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c){ fails++; console.log('FAIL', m); } };
const sig = m => [m.home.id, m.away.id, m.gH, m.gA, m.extra, m.att, m.xgH, m.xgA, m.scorers.map(s => s.side + s.p.id + '@' + s.min + (s.et? 'e' : '')).join(','), m.cards.map(c => c.side + c.p.id + c.type + c.min).join(','), m.injuries.map(p => p.id + ':' + p.injury).join(',')].join('|');
const unsack = s => { if (s.gameOver){ s.gameOver = null; s.sackOffer = null; } };

// ---- 1. rules off: the 1.7.1 engine exactly ----
{
  const E = fresh('./engine.js'); E.CFG.TACTICS.on = false; let matches = 0, differ = 0, states = 0;
  for (const seed of [11, 22, 33]){
    const a = E.newGame({ seed, userClub: 20 }), b = Eold.newGame({ seed, userClub: 20 }); a.clubs[20].formation = b.clubs[20].formation = '3-5-2';     // a formation the new table would value differently
    for (let w = 0; w < 84; w++){ const ra = E.advanceWeek(a), rb = Eold.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < Math.max(ra.length, rb.length); i++){ matches++; if (!ra[i] || !rb[i] || sig(ra[i]) !== sig(rb[i])) differ++; } }
    a.gameId = b.gameId = 'x'; if (JSON.stringify(a) === JSON.stringify(b)) states++;
  }
  ok(differ === 0, `rules off: ${differ} of ${matches} matches differ from the 1.7.1 engine`); ok(states === 3, `rules off: the whole game state is identical to 1.7.1 after two seasons in ${states} of 3 worlds`);
  console.log(`rules off: ${matches} matches over three two-season worlds (the manager in 3-5-2) identical to the 1.7.1 engine, and so is the whole game state`);
}

// ---- 2. rules on, everyone all-Balanced and in 4-4-2: still drawn exactly as in 1.7.1 ----
{
  const E = fresh('./engine.js'); E.CFG.TACTICS.computer = false; let matches = 0, differ = 0, states = 0, kept = 0;
  for (const seed of [11, 22, 33, 1991]){
    const a = E.newGame({ seed, userClub: 20 }), b = Eold.newGame({ seed, userClub: 20 });
    for (let w = 0; w < 84; w++){ const wk = a.week, ra = E.advanceWeek(a), rb = Eold.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < Math.max(ra.length, rb.length); i++){ matches++; if (!ra[i] || !rb[i] || sig(ra[i]) !== sig(rb[i])) differ++; else { ok(ra[i].poss > 0 && ra[i].poss < 1 && ra[i].tH && ra[i].tA && E.PLAN_KEYS.every(k => ra[i].tH[k] === 0 && ra[i].tA[k] === 0), 'an all-Balanced match records its plans and its possession'); } }
      // the saved game differs only by the figures now kept with the manager's own result of the week
      const r = a.userResults[wk], q = b.userResults[wk]; if (r && r.poss !== undefined){ kept++; const bare = Object.assign({}, r); delete bare.poss; delete bare.xg; delete bare.plan; delete bare.oppPlan; ok(JSON.stringify(bare) === JSON.stringify(q), 'the manager\'s result is the 1.7.1 result with the figures added'); } }
    // at the end the two games are the same game (the screens never save the last week's match records, which now carry the plans)
    const strip = st => JSON.stringify(Object.assign({}, st, { lastResults: null, gameId: 'x' })); if (strip(a) === strip(b)) states++;
  }
  ok(differ === 0, `rules on, all-Balanced 4-4-2: ${differ} of ${matches} matches differ from the 1.7.1 engine`); ok(states === 4, `rules on, all-Balanced: the saved game is identical to 1.7.1 after two seasons in ${states} of 4 worlds`); ok(kept > 0, 'the match figures are kept with the manager\'s results');
  console.log(`rules on, everyone all-Balanced in 4-4-2: ${matches} matches over four two-season worlds identical to the 1.7.1 engine, and so is the saved game after two seasons; along the way the manager's results carry the new match figures (${kept} of them) and nothing else differs`);
}

// ---- 3. the same seed and the same plans, the same matches; a different plan, different matches ----
{
  const run = plan => { const E = fresh('./engine.js'); const st = E.newGame({ seed: 314, userClub: 20 }); if (plan) st.clubs[20].tactics = plan; let s = ''; for (let w = 0; w < 42; w++){ for (const m of E.advanceWeek(st)) s += sig(m) + JSON.stringify(m.tH) + JSON.stringify(m.tA) + '\n'; unsack(st); } return s; };
  const a = run(null), b = run(null), c = run({ m: 1, p: -1, r: 1, s: 0 }), d = run({ m: 1, p: -1, r: 1, s: 0 });
  ok(a === b, 'the same seed plays the same season twice'); ok(c === d, 'the same seed and the same plan play the same season twice'); ok(a !== c, 'a different plan plays a different season');
  console.log('the same seed and plan give the same season; another plan gives another');
}

// ---- 4. whose plan: the manager's club, through a save, and only the three values ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 5, managers: ['Ann', 'Bob'] }); const [ca, cb] = st.managers.map(m => m.userClub);
  ok(ca !== cb, 'two managers, two clubs');
  E.setCurrent(st, 0); E.setTactics(st, 'm', 1); E.setTactics(st, 'p', -1); E.setCurrent(st, 1); E.setTactics(st, 'r', 1); E.setTactics(st, 's', 7); E.setTactics(st, 'x', 1);
  ok(JSON.stringify(E.planOf(st.clubs[ca])) === '{"m":1,"p":-1,"r":0,"s":0}', 'the first manager\'s plan is on his club'); ok(JSON.stringify(E.planOf(st.clubs[cb])) === '{"m":0,"p":0,"r":1,"s":0}', 'the second manager\'s plan is on his, and a value that is not -1, 0 or +1 is Balanced');
  ok(st.clubs[cb].x === undefined && !('x' in st.clubs[cb].tactics), 'an unknown control is ignored');
  const res = E.advanceWeek(st); const ma = res.find(m => m.home.id === ca || m.away.id === ca), mb = res.find(m => m.home.id === cb || m.away.id === cb);
  const pa = ma.home.id === ca? ma.tH : ma.tA, pb = mb.home.id === cb? mb.tH : mb.tA; ok(pa.m === 1 && pa.p === -1 && pb.r === 1, 'each manager\'s match was played to his own plan');
  const back = E.restore(JSON.parse(JSON.stringify(st))); ok(JSON.stringify(E.planOf(back.clubs[ca])) === JSON.stringify(E.planOf(st.clubs[ca])) && back.v === 4, 'a plan survives a save, and the save is still format 4');
  const old = Eold.newGame({ seed: 5, userClub: 20 }); Eold.advanceWeek(old); const loaded = E.restore(JSON.parse(JSON.stringify(old)));
  ok(loaded.clubs.every(c => c.tactics === undefined) && E.PLAN_KEYS.every(k => E.planOf(loaded.clubs[20])[k] === 0), 'a save from 1.7.1 has no plans and plays all-Balanced'); E.advanceWeek(loaded); ok(true, 'and plays on');
  ok(JSON.stringify(E.cleanPlan({ m: 2, p: 'x', r: null, s: -1 })) === '{"m":0,"p":0,"r":0,"s":-1}' && E.cleanPlan(null) === E.BALANCED, 'anything else in a plan is read as Balanced');
  // a newer save opened by the older engine: it ignores the plans and plays on
  const older = Eold.restore(JSON.parse(JSON.stringify(st))); Eold.advanceWeek(older); ok(older.week === st.week + 1, 'a save with plans opens in the 1.7.1 engine and plays on (all-Balanced there)');
  // back to the middle leaves no entry at all, by one setting at a time or by the reset
  E.setCurrent(st, 0); E.setTactics(st, 'm', 0); E.setTactics(st, 'p', 0); ok(st.clubs[ca].tactics === undefined, 'a plan put back to all-Balanced leaves no entry on the club');
  E.setCurrent(st, 1); E.resetTactics(st); ok(st.clubs[cb].tactics === undefined && E.planOf(st.clubs[cb]) === E.BALANCED, 'the reset removes the plan');
  console.log('a plan is its manager\'s, survives a save in format 4, and a 1.7.1 save plays all-Balanced');
}

// ---- 5. computer managers ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 77, userClub: 20 }); const st2 = E.newGame({ seed: 78, userClub: 3 });
  ok(st.clubs.every((c, i) => JSON.stringify(E.clubStyle(c)) === JSON.stringify(E.clubStyle(st2.clubs[i]))), 'a club\'s style is the same in every game');
  const count = { p: [0, 0, 0], r: [0, 0, 0], s: [0, 0, 0] }; for (const c of st.clubs){ const s = E.clubStyle(c); for (const k of ['p', 'r', 's']) count[k][s[k] + 1]++; }
  ok(['p', 'r', 's'].every(k => count[k][0] >= 20 && count[k][2] >= 20 && count[k][1] >= 50), 'the styles are spread: ' + JSON.stringify(count));
  // working out plans and the match model draws no random number
  const d1 = st.clubs.filter(c => c.div === 1); const A = d1[2], B = d1[11]; const xa = E.autoSelect(st, A), xb = E.autoSelect(st, B);
  const snap = () => JSON.stringify([A, B].map(c => E.squadOf(st, c).map(p => [p.fitness, p.injury, p.ban, p.yellows, p.reds, p.goals, p.apps]))); const before = snap(); const put = s => { const v = JSON.parse(s); [A, B].forEach((c, i) => E.squadOf(st, c).forEach((p, j) => { [p.fitness, p.injury, p.ban, p.yellows, p.reds, p.goals, p.apps] = v[i][j]; })); };
  E.seedRng(9); const m1 = sig(E.playMatch(st, A, B, { xiH: xa, xiA: xb })); put(before);
  E.seedRng(9); for (let i = 0; i < 50; i++){ E.matchModel(st, A, B, xa, xb, {}); E.clubStyle(A); E.planFor(st, B, E.teamStrength(xb), E.teamStrength(xa), 'away'); } const m2 = sig(E.playMatch(st, A, B, { xiH: xa, xiA: xb })); put(before);
  ok(m1 === m2, 'working out the plans and the match model uses no random number');
  // mentality follows the fixture
  const strong = E.teamStrength(xa), weak = { gk: strong.gk*0.9, def: strong.def*0.9, mid: strong.mid*0.9, att: strong.att*0.9, defEff: strong.defEff*0.9 };
  ok(E.planFor(st, A, strong, weak, 'home').m === 1 && E.planFor(st, A, weak, strong, 'home').m === 0 && E.planFor(st, A, weak, strong, 'away').m === -1 && E.planFor(st, A, strong, weak, 'away').m === 0 && E.planFor(st, A, strong, strong, 'home').m === 0, 'a computer manager attacks at home when clearly the stronger and defends away when clearly the weaker');
  const s = E.clubStyle(A), t = E.planFor(st, A, strong, strong, 'home'); ok(t.p === s.p && t.r === s.r && t.s === s.s, 'and keeps his club\'s passing, pressing and shooting');
  // ...unless the two sides line up with different numbers in midfield: then he keeps the ball with more, and goes long with fewer
  { const all = st.clubs.filter(c => !E.isHuman(st, c.id)); const sS = all.find(c => E.clubStyle(c).p === 1), sD = all.find(c => E.clubStyle(c).p === -1); const own = c => E.teamStrength(E.autoSelect(st, c, '4-4-2'));
    const f = n => E.teamStrength(E.autoSelect(st, st.clubs[20], n)); ok(f('4-3-3').nMid === 3 && f('3-5-2').nMid === 5 && f('4-4-2').nMid === 4, 'a complete eleven knows how many midfielders it has');
    ok(E.planFor(st, sS, own(sS), f('4-3-3'), 'home').p === -1 && E.planFor(st, sS, own(sS), f('5-3-2'), 'away').p === -1, 'against three in midfield a computer manager plays Short, whatever his club\'s style');
    ok(E.planFor(st, sD, own(sD), f('3-5-2'), 'home').p === 1 && E.planFor(st, sD, own(sD), f('4-5-1'), 'away').p === 1, 'against five in midfield he plays Direct, whatever his club\'s style');
    ok(E.planFor(st, sS, own(sS), f('4-4-2'), 'home').p === 1 && E.planFor(st, sD, own(sD), f('5-4-1'), 'home').p === -1, 'against four in midfield he plays his club\'s own passing');
    const ten = E.autoSelect(st, st.clubs[20], '4-3-3').slice(0, 10); ok(E.teamStrength(ten).nMid === 0 && E.planFor(st, sS, own(sS), E.teamStrength(ten), 'home').p === 1, 'and a side short of a man is not read as a formation'); }
  // what a club is known for: one thing from its style and only one, fixed by the club, never for a human's club, no random number
  { const hints = st.clubs.map(c => E.styleHint(st, c)); let one = 0, none = 0, wrong = 0, noStyleButHint = 0;
    st.clubs.forEach((c, i) => { const s = E.clubStyle(c), h = hints[i]; const marked = ['p', 'r', 's'].filter(k => s[k]); if (E.isHuman(st, c.id)){ if (h) wrong++; return; } if (!marked.length){ none++; if (h) noStyleButHint++; return; } if (!h || !marked.includes(h.k) || h.v !== s[h.k] || Object.keys(h).length !== 2) wrong++; else one++; });
    ok(wrong === 0 && noStyleButHint === 0 && one > 90 && none > 5, `a club is known for one true thing about its style, or for nothing if it has none (${one} clubs known for something, ${none} for nothing, ${wrong} wrong)`);
    ok(st.clubs.every((c, i) => JSON.stringify(E.styleHint(st2, st2.clubs[i])) === JSON.stringify(E.isHuman(st2, c.id) || E.isHuman(st, c.id)? E.styleHint(st2, st2.clubs[i]) : hints[i])), 'and for the same thing in every game');
    ok(E.styleHint(st, st.clubs[20]) === null, 'a human manager\'s club has no reputation to read');
    E.seedRng(31); const a1 = E.playMatch(st, A, B, { xiH: xa, xiA: xb }); put(before); E.seedRng(31); for (const c of st.clubs) E.styleHint(st, c); const a2 = E.playMatch(st, A, B, { xiH: xa, xiA: xb }); put(before); ok(sig(a1) === sig(a2), 'reading reputations uses no random number');
    E.CFG.TACTICS.on = false; ok(E.styleHint(st, A) === null, 'and there is none with the rules off'); E.CFG.TACTICS.on = true; }
  // a human's club is never given a computer plan, and the caller's plans (the bench) are used as given
  ok(JSON.stringify(E.planFor(st, st.clubs[20], strong, weak, 'home')) === JSON.stringify(E.BALANCED), 'a manager who has set nothing plays all-Balanced, whatever the fixture');
  E.seedRng(4); const g1 = E.playMatch(st, A, B, { xiH: xa, xiA: xb, tH: { m: 1, p: 1, r: 1, s: 1 }, tA: { m: -1, p: -1, r: -1, s: -1 } }); ok(g1.tH.m === 1 && g1.tA.s === -1, 'plans given by the caller are the plans played'); put(before);
  // it makes no difference whose club it is: the same plans from a manager's club and from the caller give the same match
  const hs = E.newGame({ seed: 5, managers: ['Ann', 'Bob'] }); const [ca, cb] = hs.managers.map(m => m.userClub); const H = hs.clubs[ca], W = hs.clubs[cb]; const xh = E.autoSelect(hs, H), xw = E.autoSelect(hs, W);
  const keep = JSON.stringify([H, W].map(c => E.squadOf(hs, c).map(p => [p.fitness, p.injury, p.ban, p.yellows, p.reds, p.goals, p.apps]))); const restore = () => { const v = JSON.parse(keep); [H, W].forEach((c, i) => E.squadOf(hs, c).forEach((p, j) => { [p.fitness, p.injury, p.ban, p.yellows, p.reds, p.goals, p.apps] = v[i][j]; })); };
  const P1 = { m: 1, p: -1, r: 1, s: 0 }, P2 = { m: -1, p: 1, r: 0, s: 1 }; H.tactics = P1; W.tactics = P2; E.seedRng(21); const own = sig(E.playMatch(hs, H, W, { xiH: xh, xiA: xw })); restore();
  H.tactics = undefined; W.tactics = undefined; E.seedRng(21); const given = sig(E.playMatch(hs, H, W, { xiH: xh, xiA: xw, tH: P1, tA: P2 })); restore();
  ok(own === given, 'the same two plans give the same match whether they are the managers\' own or given by the caller');
  console.log('computer managers: styles fixed by the club, mentality by the fixture, no random number; a human\'s plan is only ever his own');
}

// ---- 6. a side short of a man, and a complete 4-4-2, are worth what they were ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 12, userClub: 20 }); const c = st.clubs.filter(x => x.div === 2)[5]; const xi = E.autoSelect(st, c); const same = (a, b) => ['gk', 'def', 'mid', 'att', 'defEff'].every(k => a[k] === b[k]);
  ok(same(E.teamStrength(xi), Eold.teamStrength(xi)), 'a complete 4-4-2 is worth exactly what it was');
  for (const slot of ['DEF', 'MID', 'FWD']){ const ten = xi.filter((x, i) => i !== xi.findIndex(y => y.slot === slot)); ok(ten.length === 10 && same(E.teamStrength(ten), Eold.teamStrength(ten)), 'ten men (one ' + slot + ' short) are worth exactly what they were'); }
  const x352 = E.autoSelect(st, c, '3-5-2'), n = E.teamStrength(x352), o = Eold.teamStrength(x352); ok(n.mid < o.mid && n.def < o.def, 'a complete 3-5-2 is valued by the new table (midfield ' + o.mid.toFixed(1) + ' to ' + n.mid.toFixed(1) + ')');
  const x451 = E.autoSelect(st, c, '4-5-1'), n2 = E.teamStrength(x451), o2 = Eold.teamStrength(x451); ok(n2.att > o2.att, 'a lone forward is worth more than he was (attack ' + o2.att.toFixed(1) + ' to ' + n2.att.toFixed(1) + ')');
  console.log('a 4-4-2 side, eleven men or ten, is worth exactly what it was; the other formations are valued by the table');
}

// ---- 7. the balance targets that can be worked out exactly ----
{
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'tools', 'tactics-balance.js')], { encoding: 'utf8' }); const out = r.stdout || '';
  const lines = out.split('\n').filter(l => /^(ok|FAIL)/.test(l)); ok(r.status === 0 && lines.length >= 12 && !lines.some(l => /^FAIL/.test(l)), 'the balance bench (quick mode) meets every target: ' + lines.filter(l => /^FAIL/.test(l)).join(' / '));
  console.log(`the balance bench, quick mode: ${lines.filter(l => /^ok/.test(l)).length} targets met, ${lines.filter(l => /^FAIL/.test(l)).length} not`);
}

// ---- 8. seasons with the rules on ----
{
  const E = fresh('./engine.js'); let n = 0, goals = 0, hw = 0, plans = 0, nonBal = 0, figs = 0;
  for (const seed of [8, 9]){ const st = E.newGame({ seed, userClub: 20 }); st.clubs[20].tactics = { m: 0, p: 1, r: -1, s: 1 }; st.clubs[20].formation = '5-3-2';
    for (let w = 0; w < 84; w++){ const wk = st.week; for (const m of E.advanceWeek(st)){ ok(E.PLAN_KEYS.every(k => [-1, 0, 1].includes(m.tH[k]) && [-1, 0, 1].includes(m.tA[k])) && m.poss > 0.05 && m.poss < 0.95 && isFinite(m.xgH) && isFinite(m.xgA), 'a match has two plans, a sane possession share and its expected goals'); plans += 2; if (E.PLAN_KEYS.some(k => m.tH[k])) nonBal++; if (E.PLAN_KEYS.some(k => m.tA[k])) nonBal++; if (!m.cupKey && !m.euro && !m.neutral){ n++; goals += m.gH + m.gA; if (m.gH > m.gA) hw++; } }
      unsack(st); const r = st.userResults[wk]; if (r && r.poss !== undefined){ figs++; ok(Number.isInteger(r.poss) && r.poss > 5 && r.poss < 95 && r.xg.length === 2 && r.plan.p === 1 && r.plan.r === -1 && r.oppPlan && [-1, 0, 1].includes(r.oppPlan.m), 'the manager\'s result keeps his possession, the chances and the two plans'); } } }
  ok(goals/n > 2.4 && goals/n < 3.0 && hw/n > 0.42 && hw/n < 0.51, `four seasons with the rules on keep the league's shape (${(goals/n).toFixed(2)} goals a game, ${(100*hw/n).toFixed(1)}% home wins)`); ok(nonBal/plans > 0.5, 'most computer managers play a plan of their own'); ok(figs > 60, 'the figures are kept for the manager\'s matches');
  console.log(`four seasons with the rules on: ${n} league matches, ${(goals/n).toFixed(2)} goals a game, ${(100*hw/n).toFixed(1)}% home wins; ${(100*nonBal/plans).toFixed(0)}% of sides played something other than all-Balanced; figures kept for ${figs} of the manager's matches`);
}

console.log(fails? `\n${fails} FAILURES of ${checks} checks` : `\nTACTICS OK (${checks} checks)`);
process.exit(fails? 1 : 0);
