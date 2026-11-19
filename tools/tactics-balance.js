// The balance bench for tactics and formations (Milestone 1). It measures the game's own match code: engine.js as it stands,
// through Engine.matchModel (everything a match is drawn from, before any random number) and Engine.playMatch (the draw).
//
// What each number in a match is drawn from is exact arithmetic, so most of the bench is exact too: from the two sides'
// expected goals and the width of their luck it works out the chances of a win, a draw and a defeat (the same goal draw
// and late-equaliser rule as playMatch), and it checks that working against real matches played through playMatch.
// "Edge" is your points a game minus theirs; two equal all-Balanced 4-4-2 sides on neutral ground have an edge of 0.
//
//   node tools/tactics-balance.js                 the quick bench: formations, each control, all 81 plans against all 81,
//                                                 the targets B1 to B8 that can be shown without playing seasons (2 minutes)
//   node tools/tactics-balance.js --play          also plays matches through playMatch: the check of the exact working, and
//                                                 what each control does to goals, possession, bookings, fitness and scorers
//   node tools/tactics-balance.js --league        also the league's shape over seeded seasons, old rules against new
//   node tools/tactics-balance.js --worth         also what tactics are worth in all over a season against the computer clubs, exactly
//   node tools/tactics-balance.js --seasons 300   also whole seasons with one setting left on all season (long: about 0.2 s a season)
//   node tools/tactics-balance.js --set '{"ATT_UP":0.12}'   try other values of Engine.CFG.TACTICS (for tuning; nothing is saved)
//   node tools/tactics-balance.js --out report.json
'use strict';
const path = require('path'), fs = require('fs');
const E = require(path.join(__dirname, '..', 'engine.js')); const T = E.CFG.TACTICS;
const args = process.argv.slice(2); const flag = n => { const i = args.indexOf(n); return i < 0? null : (args[i + 1] && !/^--/.test(args[i + 1])? args[i + 1] : true); };
if (flag('--set')) Object.assign(T, JSON.parse(flag('--set')));
const PLAY = !!flag('--play') || !!flag('--all'), LEAGUE = !!flag('--league') || !!flag('--all'), SEASONS = flag('--seasons')? +flag('--seasons') : 0, OUT = flag('--out'), PHYSIO = flag('--physio')? String(flag('--physio')).split(',').map(Number) : [1, 3], ONLY = flag('--only');
const report = { settings: JSON.parse(JSON.stringify(T)), targets: {} }; let bad = 0;
const say = (ok, id, text) => { console.log((ok? 'ok   ' : 'FAIL ') + id + '  ' + text); report.targets[id] = { ok, text }; if (!ok) bad++; };
const f3 = x => (x >= 0? '+' : '') + x.toFixed(3), f2 = x => (x >= 0? '+' : '') + x.toFixed(2);

// ---- exact chances from what a match is drawn from ----
const GH = [[-3.1909932018, 0.0000396069773], [-2.2665805845, 0.00494362428], [-1.4685532892, 0.0884745274], [-0.7235510188, 0.432651559], [0, 0.720235216], [0.7235510188, 0.432651559], [1.4685532892, 0.0884745274], [2.2665805845, 0.00494362428], [3.1909932018, 0.0000396069773]];   // Gauss-Hermite, 9 points
const NG = 16; const pois = lam => { const p = [Math.exp(-lam)]; for (let k = 1; k <= NG; k++) p.push(p[k-1]*lam/k); return p; };
function chances(M){
  let w = 0, d = 0, l = 0, gf = 0, ga = 0; const LE = E.CFG.LATE_EQUALISER;
  for (const [za, wa] of GH) for (const [zb, wb] of GH){ const wgt = wa*wb/Math.PI; const la = M.muH*Math.exp(Math.SQRT2*M.sdH*za), lb = M.muA*Math.exp(Math.SQRT2*M.sdA*zb); const pa = pois(la), pb = pois(lb); gf += wgt*la; ga += wgt*lb;
    for (let i = 0; i <= NG; i++) for (let j = 0; j <= NG; j++){ const p = wgt*pa[i]*pb[j]; if (i === j) d += p; else if (Math.abs(i - j) === 1){ d += p*LE; if (i > j) w += p*(1 - LE); else l += p*(1 - LE); } else if (i > j) w += p; else l += p; } }
  const dgf = d? 0 : 0; return { w, d, l, gf, ga, ppg: 3*w + d, opp: 3*l + d, edge: 3*(w - l) };
}

// ---- two made-to-measure sides in a real game world ----
const world = E.newGame({ seed: 7, userClub: 127 }); const div1 = world.clubs.filter(c => c.div === 1); const A = div1[6], B = div1[9];
const squad = c => E.squadOf(world, c);
const dress = (c, o) => { for (const p of squad(c)){ p.skill = o.skill; p.fitness = o.fit === undefined? 100 : o.fit; p.morale = 65; p.injury = 0; p.ban = 0; p.yellows = 0; p.reds = 0; p.goals = 0; p.apps = 0; } };
const Z = E.BALANCED; const PLANS = []; for (const m of [-1, 0, 1]) for (const p of [-1, 0, 1]) for (const r of [-1, 0, 1]) for (const s of [-1, 0, 1]) PLANS.push({ m, p, r, s });
const NAMES = { m: ['Defensive', 'Balanced', 'Attacking'], p: ['Short', 'Mixed', 'Direct'], r: ['Low press', 'Normal', 'High press'], s: ['Work it in', 'Balanced', 'On sight'] };
const planName = t => E.PLAN_KEYS.map(k => NAMES[k][t[k] + 1]).join(' / ');
const FORMS = Object.keys(E.FORMATIONS);
// a: {skill, f, plan}, b likewise; venue 'neutral', 'home' (a at home) or 'away' (a away). Returns chances from a's side.
function meet(a, b, venue){
  a = Object.assign({ skill: 72, f: '4-4-2', plan: Z }, a); b = Object.assign({ skill: 72, f: '4-4-2', plan: Z }, b); dress(A, a); dress(B, b);
  const xa = E.autoSelect(world, A, a.f), xb = E.autoSelect(world, B, b.f);
  if (venue === 'away'){ const c = chances(E.matchModel(world, B, A, xb, xa, { tH: b.plan, tA: a.plan })); return { w: c.l, d: c.d, l: c.w, gf: c.ga, ga: c.gf, ppg: c.opp, opp: c.ppg, edge: -c.edge }; }
  return chances(E.matchModel(world, A, B, xa, xb, venue === 'neutral'? { neutral: true, tH: a.plan, tA: b.plan } : { tH: a.plan, tA: b.plan }));
}
const one = (k, v) => Object.assign({}, Z, { [k]: v });

// one computer club of each style there is in the league (passing, pressing, shooting), dressed to order and left to choose its own plan
// for the fixture (matchModel asks planFor for it)
const rep = {}; for (const c of world.clubs){ if (c.id === A.id || c.id === B.id || E.isHuman(world, c.id)) continue; const t = E.clubStyle(c), k = t.p + ',' + t.r + ',' + t.s; (rep[k] = rep[k] || { c, n: 0, t }).n++; } const tot = Object.values(rep).reduce((x, r) => x + r.n, 0);
const vsComputer = (f, plan, sk, C, venue) => { dress(A, { skill: sk }); dress(C, { skill: 72 }); const xa = E.autoSelect(world, A, f), xc = E.autoSelect(world, C, '4-4-2'); return venue === 'away'? chances(E.matchModel(world, C, A, xc, xa, { tA: plan })).opp : chances(E.matchModel(world, A, C, xa, xc, venue === 'neutral'? { neutral: true, tH: plan } : { tH: plan })).ppg; };

// ---- 1. the formations ----
if (!ONLY || /form/.test(ONLY)){
  console.log('\n1. The formations: equal players, all-Balanced, neutral ground. The row\'s edge over the column, and the goals in a match against 4-4-2');
  console.log(''.padEnd(8) + FORMS.map(x => x.padStart(8)).join('') + '   goals'); let mx = 0; const fm = {};
  for (const a of FORMS){ fm[a] = {}; let row = a.padEnd(8); for (const b of FORMS){ const r = meet({ f: a }, { f: b }, 'neutral'); fm[a][b] = +r.edge.toFixed(4); mx = Math.max(mx, Math.abs(r.edge)); row += f2(r.edge).padStart(8); } const g = meet({ f: a }, {}, 'neutral'); console.log(row + '   ' + g.gf.toFixed(2) + '-' + g.ga.toFixed(2)); }
  report.formations = fm; say(mx <= 0.10, 'F1', `no formation more than 0.10 better than another with equal players (largest edge ${mx.toFixed(3)})`);
  const sits = [['4 better, at home', 76, 'home'], ['equal, at home', 72, 'home'], ['equal, neutral ground', 72, 'neutral'], ['equal, away', 72, 'away'], ['4 worse, away', 68, 'away']]; const suits = {}; const bestIn = new Set();
  console.log('   a match each suits: your points a game by formation against an all-Balanced 4-4-2 (the best in each line marked)');
  for (const [label, sk, venue] of sits){ const v = FORMS.map(a => meet({ f: a, skill: sk }, {}, venue).ppg); const hi = Math.max(...v); bestIn.add(FORMS[v.indexOf(hi)]); suits[label] = v.map(x => +x.toFixed(4)); console.log('   ' + label.padEnd(24) + FORMS.map((a, i) => (a + ' ' + v[i].toFixed(3) + (v[i] === hi? '*' : ' ')).padStart(15)).join('')); }
  report.formationSuits = suits;
  // against each formation, which formation and passing does best (the midfield count and the passing answer each other)
  const answers = {}; for (const b of FORMS){ let best = null; for (const a of FORMS) for (const p of [-1, 0, 1]){ const r = meet({ f: a, plan: one('p', p) }, { f: b }, 'neutral'); if (!best || r.edge > best.e) best = { e: r.edge, a, p }; } answers[b] = best; }
  console.log('   the best formation and passing against each all-Balanced formation: ' + FORMS.map(b => `${b}: ${answers[b].a} ${NAMES.p[answers[b].p + 1]} ${f2(answers[b].e)}`).join(' | '));
  const used = new Set(Object.values(answers).map(x => x.a)); report.formationAnswers = answers;
  // the wider question: over the matches the game really offers (your players 4 worse, equal, 4 better; home, away, a neutral final;
  // a computer club of each style, in its 4-4-2, choosing its plan as computer managers do), which formation, with the passing that
  // suits it best, earns the most points? One that is never near the top is never the right choice; one that always is, the only choice.
  const wins = {}, near = {}, ex = {}; for (const a of FORMS){ wins[a] = 0; near[a] = 0; } let nsit = 0;
  for (const sk of [68, 72, 76]) for (const venue of ['home', 'neutral', 'away']) for (const k of Object.keys(rep)){ nsit++; const v = FORMS.map(a => Math.max(...[-1, 0, 1].map(pp => vsComputer(a, one('p', pp), sk, rep[k].c, venue)))); const hi = Math.max(...v);
    FORMS.forEach((a, i) => { if (v[i] === hi){ wins[a]++; if (!ex[a] || (sk === 72 && ex[a].sk !== 72)) ex[a] = { sk, venue, t: rep[k].t }; } if (hi - v[i] <= 0.02) near[a]++; }); }
  console.log(`   over ${nsit} matches against computer clubs (your players 4 worse, equal, 4 better; home, neutral, away; each of the ${Object.keys(rep).length} club styles in the league), with your own best passing:`);
  const where = e => `${e.sk > 72? '4 better' : e.sk < 72? '4 worse' : 'equal'}, ${e.venue === 'home'? 'at home' : e.venue === 'away'? 'away' : 'neutral ground'}, against a ${NAMES.p[e.t.p + 1]} / ${NAMES.r[e.t.r + 1]} / ${NAMES.s[e.t.s + 1]} club`;
  for (const a of FORMS) console.log('   ' + a.padEnd(7) + `the best choice in ${String(wins[a]).padStart(3)}, within 0.02 points a game of the best in ${String(near[a]).padStart(3)}` + (ex[a]? ` | for example: ${where(ex[a])}` : ''));
  report.formationWins = { situations: nsit, wins, near, examples: ex };
  const out = FORMS.filter(a => near[a] < 0.1*nsit), most = Math.max(...Object.values(wins));
  say(out.length === 0 && most <= 0.5*nsit, 'F2', out.length? `formations that are hardly ever a good choice (within 0.02 points a game of the best in under a tenth of ${nsit} matches): ${out.join(', ')}` : `every formation is a good choice somewhere (within 0.02 points a game of the best in a tenth or more of the ${nsit} matches), and none is the best in more than half (the most is ${most}); never the outright best: ${FORMS.filter(a => !wins[a]).join(', ') || 'none'}`);
  // the standing question: every computer club plays 4-4-2, so a formation and passing that beat a 4-4-2 could be left on all season.
  // Points a season (30 league matches, half at home) gained over 4-4-2 Mixed, with equal players, against the computer clubs choosing as they do.
  { const season = (f, p) => { let pts = 0; for (const k of Object.keys(rep)) pts += rep[k].n/tot*15*(vsComputer(f, one('p', p), 72, rep[k].c, 'home') + vsComputer(f, one('p', p), 72, rep[k].c, 'away')); return pts; };
    const base = season('4-4-2', 0); const rows = []; for (const f of FORMS) for (const p of [-1, 0, 1]) rows.push({ f, p, gain: season(f, p) - base }); rows.sort((x, y) => y.gain - x.gain); report.formationSeason = rows;
    console.log('   points a season over 4-4-2 Mixed, equal players, against the computer clubs as they play: ' + FORMS.map(f => f + ' ' + [-1, 0, 1].map(p => NAMES.p[p + 1][0] + f2(rows.find(r => r.f === f && r.p === p).gain)).join(' ')).join(' | ') + '   (S Short, M Mixed, D Direct)');
    say(rows[0].gain <= 1.0, 'F3', `no formation and passing left on all season is worth more than 1.0 point a season over 4-4-2 Mixed, worked out exactly with equal players (the best is ${rows[0].f} ${NAMES.p[rows[0].p + 1]}, ${f2(rows[0].gain)}; the worst ${rows[rows.length - 1].f} ${NAMES.p[rows[rows.length - 1].p + 1]}, ${f2(rows[rows.length - 1].gain)})`); }
}

// ---- 2. each control on its own ----
if (!ONLY || /control/.test(ONLY)){
  console.log('\n2. One control changed, the rest Balanced, against an all-Balanced opponent: the change in your edge (and the goals)');
  const sits = [['equal sides, neutral ground', {}, {}, 'neutral'], ['you 4 better, neutral', { skill: 76 }, {}, 'neutral'], ['you 4 worse, neutral', { skill: 68 }, {}, 'neutral'], ['equal, you at home', {}, {}, 'home'], ['equal, you away', {}, {}, 'away'], ['you 4 better, at home', { skill: 76 }, {}, 'home'], ['you 4 worse, away', { skill: 68 }, {}, 'away'], ['you 3-5-2 against 4-4-2 (more midfield)', { f: '3-5-2' }, {}, 'neutral'], ['you 4-3-3 against 4-4-2 (less midfield)', { f: '4-3-3' }, {}, 'neutral']];
  const ctl = {};
  for (const [label, a, b, venue] of sits){ const base = meet(a, b, venue); let line = '   ' + label.padEnd(40) + 'Balanced ' + f3(base.edge) + ' |'; ctl[label] = { base: +base.edge.toFixed(4) };
    for (const k of E.PLAN_KEYS) for (const v of [-1, 1]){ const r = meet(Object.assign({}, a, { plan: one(k, v) }), b, venue); ctl[label][NAMES[k][v + 1]] = +(r.edge - base.edge).toFixed(4); line += ' ' + NAMES[k][v + 1] + ' ' + f3(r.edge - base.edge); }
    console.log(line); }
  report.controls = ctl;
  const g0 = meet({}, {}, 'neutral'), gA = meet({ plan: one('m', 1) }, {}, 'neutral'), gD = meet({ plan: one('m', -1) }, {}, 'neutral');
  const up = (gA.gf + gA.ga)/(g0.gf + g0.ga) - 1, dn = (gD.gf + gD.ga)/(g0.gf + g0.ga) - 1;
  say(up >= 0.05 && up <= 0.20 && dn <= -0.05 && dn >= -0.20, 'B5a', `mentality moves the goals in a match: Attacking ${(100*up).toFixed(1)}%, Defensive ${(100*dn).toFixed(1)}% (5% to 20% wanted each way)`);
  const c = ctl; const x1 = c['equal, you at home'].Attacking, x2 = c['equal, you away'].Defensive, x3 = c['you 4 better, at home'].Attacking, x4 = c['you 4 worse, away'].Defensive;
  say(x3 > 0 && x4 > 0 && x1 > c['equal, you away'].Attacking && x2 > c['equal, you at home'].Defensive, 'B5b', `mentality suits the situation: Attacking for the stronger side at home ${f3(x3)}, Defensive for the weaker side away ${f3(x4)}; equal sides: Attacking at home ${f3(x1)} against ${f3(c['equal, you away'].Attacking)} away, Defensive away ${f3(x2)} against ${f3(c['equal, you at home'].Defensive)} at home`);
  const p1 = c['you 3-5-2 against 4-4-2 (more midfield)'].Short, p2 = c['you 3-5-2 against 4-4-2 (more midfield)'].Direct, p3 = c['you 4-3-3 against 4-4-2 (less midfield)'].Direct, p4 = c['you 4-3-3 against 4-4-2 (less midfield)'].Short;
  say(p1 >= 0.05 && p3 >= 0.05 && p2 <= -0.05 && p4 <= -0.05, 'B5c', `passing is worth 0.05 or more when the midfields differ: Short with the bigger midfield ${f3(p1)} (Direct ${f3(p2)}), Direct with the smaller ${f3(p3)} (Short ${f3(p4)})`);
  const hp = meet({ plan: one('r', 1) }, { plan: one('p', -1) }, 'neutral').edge - meet({}, { plan: one('p', -1) }, 'neutral').edge, hd = meet({ plan: one('r', 1) }, { plan: one('p', 1) }, 'neutral').edge - meet({}, { plan: one('p', 1) }, 'neutral').edge;
  const lp = meet({ plan: one('r', -1) }, { plan: one('p', 1) }, 'neutral').edge - meet({}, { plan: one('p', 1) }, 'neutral').edge, ls = meet({ plan: one('r', -1) }, { plan: one('p', -1) }, 'neutral').edge - meet({}, { plan: one('p', -1) }, 'neutral').edge;
  say(hp >= 0.03 && hd <= -0.03 && lp >= 0.03 && ls <= -0.03, 'B5d', `pressing answers their passing: High press against Short ${f3(hp)}, against Direct ${f3(hd)}; Low press against Direct ${f3(lp)}, against Short ${f3(ls)} (0.03 or more wanted each way)`);
  const sd = meet({ plan: one('s', 1) }, { plan: one('m', -1) }, 'neutral').edge - meet({}, { plan: one('m', -1) }, 'neutral').edge, sa = meet({ plan: one('s', 1) }, { plan: one('m', 1) }, 'neutral').edge - meet({}, { plan: one('m', 1) }, 'neutral').edge;
  const wd = meet({ plan: one('s', -1) }, { plan: one('m', -1) }, 'neutral').edge - meet({}, { plan: one('m', -1) }, 'neutral').edge, wa = meet({ plan: one('s', -1) }, { plan: one('m', 1) }, 'neutral').edge - meet({}, { plan: one('m', 1) }, 'neutral').edge;
  say(sd >= 0.02 && wa >= 0.02 && sa < sd && wd < wa, 'B5e', `shooting answers their mentality: On sight against a Defensive side ${f3(sd)}, against an Attacking one ${f3(sa)}; Work it in against an Attacking side ${f3(wa)}, against a Defensive one ${f3(wd)}`);
  report.answers = { highVshort: hp, highVdirect: hd, lowVdirect: lp, lowVshort: ls, sightVdef: sd, sightVatt: sa, workVatt: wa, workVdef: wd };
}

// ---- 3. all 81 plans against all 81 ----
if (!ONLY || /plans/.test(ONLY)){
  console.log('\n3. All 81 plans against all 81: equal sides, 4-4-2, neutral ground');
  dress(A, { skill: 72 }); dress(B, { skill: 72 }); const xa = E.autoSelect(world, A, '4-4-2'), xb = E.autoSelect(world, B, '4-4-2');
  const grid = (xa, xb, opt) => PLANS.map(x => PLANS.map(y => chances(E.matchModel(world, A, B, xa, xb, Object.assign({ tH: x, tA: y }, opt))).edge));
  const X = grid(xa, xb, { neutral: true }); const z = PLANS.findIndex(t => !t.m && !t.p && !t.r && !t.s);
  let mx = -9, at = null; for (let i = 0; i < 81; i++) for (let j = 0; j < 81; j++) if (X[i][j] > mx){ mx = X[i][j]; at = [i, j]; }
  say(mx <= 0.30, 'B3a', `the largest edge of any plan over any other is no more than 0.30: ${mx.toFixed(3)} (${planName(PLANS[at[0]])} against ${planName(PLANS[at[1]])})`);
  const reply = PLANS.map((t, j) => { let b = 0; for (let i = 1; i < 81; i++) if (X[i][j] > X[b][j]) b = i; return X[b][j]; }); const rs = reply.slice().sort((a, b) => a - b);
  say(rs[40] >= 0.05 && rs[40] <= 0.15, 'B3b', `the right plan against a known plan is worth 0.05 to 0.15: the best reply gains ${rs[0].toFixed(3)} at least, ${rs[40].toFixed(3)} typically, ${rs[80].toFixed(3)} at most`);
  const beaten = PLANS.filter((t, j) => Math.max(...X.map(r => r[j])) >= 0.02).length; const dom = []; for (let i = 0; i < 81; i++){ if (i === z) continue; let d = true; for (let j = 0; j < 81; j++) if (X[i][j] < X[z][j] - 1e-9){ d = false; break; } if (d) dom.push(planName(PLANS[i])); }
  const always = []; for (let i = 0; i < 81; i++){ if (Math.min(...X[i]) >= -1e-9 && i !== z) always.push(planName(PLANS[i])); }
  const worstZ = Math.min(...X[z]); const safest = PLANS.map((t, i) => [Math.min(...X[i]), i]).sort((a, b) => b[0] - a[0]);
  say(beaten === 81 && dom.length === 0, 'B4a', `no dominant plan: ${beaten} of 81 plans are beaten by 0.02 or more by some other plan; plans at least as good as all-Balanced against everything: ${dom.length? dom.join(', ') : 'none'}`);
  say(worstZ >= -0.05, 'B4b', `all-Balanced never loses more than 0.05 to any plan: its worst case is ${worstZ.toFixed(3)} (the safest plan of all is ${planName(PLANS[safest[0][1]])}, worst case ${safest[0][0].toFixed(3)})`);
  const vsZ = PLANS.map((t, i) => [X[i][z], i]).sort((a, b) => b[0] - a[0]); console.log('   best against an all-Balanced side: ' + vsZ.slice(0, 3).map(([e, i]) => planName(PLANS[i]) + ' ' + f3(e)).join(' | ') + ' ; worst: ' + vsZ.slice(-2).map(([e, i]) => planName(PLANS[i]) + ' ' + f3(e)).join(' | '));
  report.plans = { largest: mx, largestPair: [PLANS[at[0]], PLANS[at[1]]], bestReply: { min: rs[0], median: rs[40], max: rs[80] }, balancedWorst: worstZ, bestVsBalanced: vsZ.slice(0, 5).map(([e, i]) => [planName(PLANS[i]), e]) };
  // against the plans computer managers actually use: at home, away, and by how often each style occurs
  const styles = {}; for (const c of world.clubs){ const s = E.clubStyle(c); const k = s.p + ',' + s.r + ',' + s.s; styles[k] = (styles[k] || 0) + 1; }
  let worstVsAI = 0, sumGain = 0, n = 0; for (const k of Object.keys(styles)){ const [p, r, s] = k.split(',').map(Number); for (const m of [-1, 0, 1]){ const j = PLANS.findIndex(t => t.m === m && t.p === p && t.r === r && t.s === s); worstVsAI = Math.min(worstVsAI, X[z][j]); if (m === 0){ sumGain += reply[j]*styles[k]; n += styles[k]; } } }
  console.log(`   against the computer managers' own plans: all-Balanced loses at most ${(-worstVsAI).toFixed(3)}; the best reply to a club's style gains ${(sumGain/n).toFixed(3)} on average over the ${n} clubs`); report.plans.vsComputer = { balancedWorst: worstVsAI, replyMean: sumGain/n };
  // B7: quality first
  dress(A, { skill: 77 }); dress(B, { skill: 72 }); const xa5 = E.autoSelect(world, A, '4-4-2'), xb5 = E.autoSelect(world, B, '4-4-2'); const X5 = grid(xa5, xb5, { neutral: true }); let mn = 9, mnAt = null; for (let i = 0; i < 81; i++) for (let j = 0; j < 81; j++) if (X5[i][j] < mn){ mn = X5[i][j]; mnAt = [i, j]; }
  say(mn > 0, 'B7', `a side five skill points better still has the edge whatever the two plans: its smallest edge is ${f3(mn)} (${planName(PLANS[mnAt[0]])} against ${planName(PLANS[mnAt[1]])}; all-Balanced both ${f3(X5[z][z])})`); report.plans.fiveBetterWorst = mn;
  // B8: no side is favoured for being a human's or for being named first
  dress(A, { skill: 72 }); dress(B, { skill: 72 }); let asym = 0; for (let i = 0; i < 81; i++) for (let j = 0; j < 81; j++) asym = Math.max(asym, Math.abs(X[i][j] + X[j][i]));
  say(asym < 1e-9, 'B8', `two sides swap exactly: plan X against plan Y is the mirror of Y against X for all 6,561 pairs (largest difference ${asym.toExponential(1)})`);
}

// ---- 4. matches played through playMatch ----
function play(a, b, venue, N){
  a = Object.assign({ skill: 72, f: '4-4-2', plan: Z }, a); b = Object.assign({ skill: 72, f: '4-4-2', plan: Z }, b); dress(A, a); dress(B, b);
  const o = { w: 0, d: 0, l: 0, gf: 0, ga: 0, poss: 0, yel: 0, yelOpp: 0, fit: 0, pos: { FWD: 0, MID: 0, DEF: 0, GK: 0 }, inj: 0 }; const slot = {};
  for (let i = 0; i < N; i++){ for (const c of [A, B]) for (const p of squad(c)){ p.fitness = 100; p.injury = 0; p.ban = 0; p.yellows = 0; p.reds = 0; p.goals = 0; p.apps = 0; }
    const xa = E.autoSelect(world, A, a.f), xb = E.autoSelect(world, B, b.f); for (const x of xa) slot[x.p.id] = x.slot;
    const m = E.playMatch(world, A, B, Object.assign({ xiH: xa, xiA: xb, tH: a.plan, tA: b.plan }, venue === 'neutral'? { neutral: true, finalAtt: 1000 } : {}));
    o.gf += m.gH; o.ga += m.gA; if (m.gH > m.gA) o.w++; else if (m.gH < m.gA) o.l++; else o.d++; o.poss += m.poss; o.yel += m.cards.filter(c => c.side === 'H').length; o.yelOpp += m.cards.filter(c => c.side === 'A').length; o.fit += 100 - xa.reduce((s, x) => s + x.p.fitness, 0)/xa.length; o.inj += m.injuries.filter(p => p.club === A.id).length;
    for (const s of m.scorers) if (s.side === 'H' && !s.et) o.pos[slot[s.p.id]]++; }
  const g = o.pos.FWD + o.pos.MID + o.pos.DEF + o.pos.GK || 1;
  return { w: o.w/N, d: o.d/N, l: o.l/N, gf: o.gf/N, ga: o.ga/N, edge: 3*(o.w - o.l)/N, poss: o.poss/N, cards: o.yel/N, fitLost: o.fit/N, mid: o.pos.MID/g, fwd: o.pos.FWD/g, inj: o.inj/N };
}
if (PLAY){
  const N = +(flag('--n') || 20000); E.seedRng(20261119);
  console.log(`\n4. Matches played through playMatch (${N} a line): the exact working checked, and what each control does`);
  let worst = 0; const checks = [[{}, {}, 'neutral'], [{}, {}, 'home'], [{ skill: 76, plan: { m: 1, p: -1, r: 1, s: -1 } }, { plan: { m: -1, p: 1, r: -1, s: 1 } }, 'home'], [{ f: '3-5-2', plan: one('p', -1) }, { f: '5-4-1', plan: one('m', -1) }, 'neutral'], [{ f: '4-3-3', plan: { m: 1, p: 1, r: 0, s: 1 } }, { f: '4-5-1', plan: { m: 0, p: -1, r: 1, s: 0 } }, 'home']]; const cv = [];
  for (const [a, b, v] of checks){ const ex = meet(a, b, v), pl = play(a, b, v, N); const dif = Math.max(Math.abs(ex.w - pl.w), Math.abs(ex.d - pl.d), Math.abs(ex.l - pl.l)); worst = Math.max(worst, dif); cv.push({ exact: [ex.w, ex.d, ex.l], played: [pl.w, pl.d, pl.l] }); console.log(`   exact W ${(100*ex.w).toFixed(1)} D ${(100*ex.d).toFixed(1)} L ${(100*ex.l).toFixed(1)} | played W ${(100*pl.w).toFixed(1)} D ${(100*pl.d).toFixed(1)} L ${(100*pl.l).toFixed(1)}`); }
  const tol = 3.5*Math.sqrt(0.25/N); say(worst <= tol, 'CHK', `the exact working agrees with matches really played, within the noise of ${N} matches (largest gap ${(100*worst).toFixed(2)} points, allowed ${(100*tol).toFixed(2)})`); report.check = cv;
  const base = play({}, {}, 'neutral', N); const rows = { Balanced: base };
  for (const k of E.PLAN_KEYS) for (const v of [-1, 1]) rows[NAMES[k][v + 1]] = play({ plan: one(k, v) }, {}, 'neutral', N);
  console.log('   your side, one control changed, against all-Balanced:   goals for-against | possession | bookings | fitness lost | goals by midfielders | by forwards');
  for (const k of Object.keys(rows)){ const r = rows[k]; console.log('   ' + k.padEnd(12) + `${r.gf.toFixed(2)}-${r.ga.toFixed(2)} | ${(100*r.poss).toFixed(1)}% | ${r.cards.toFixed(2)} | ${r.fitLost.toFixed(2)} | ${(100*r.mid).toFixed(1)}% | ${(100*r.fwd).toFixed(1)}%`); }
  report.played = rows; const R = rows;
  say(R['High press'].poss - base.poss >= 0.012 && base.poss - R['Low press'].poss >= 0.012, 'B5f', `pressing moves possession: High ${(100*R['High press'].poss).toFixed(1)}%, Normal ${(100*base.poss).toFixed(1)}%, Low ${(100*R['Low press'].poss).toFixed(1)}%`);
  say(R['High press'].cards/base.cards >= 1.1 && R['Low press'].cards/base.cards <= 0.9, 'B5g', `pressing moves bookings: High ${R['High press'].cards.toFixed(2)} a match, Normal ${base.cards.toFixed(2)}, Low ${R['Low press'].cards.toFixed(2)}`);
  say(Math.abs(R['High press'].fitLost - base.fitLost - T.PRESS_FIT_HI) < 0.05 && Math.abs(base.fitLost - R['Low press'].fitLost - T.PRESS_FIT_LO) < 0.05 && T.PRESS_FIT_HI >= 1, 'B5h', `a high press costs legs: fitness lost in a match High ${R['High press'].fitLost.toFixed(1)}, Normal ${base.fitLost.toFixed(1)}, Low ${R['Low press'].fitLost.toFixed(1)}`);
  say(R['On sight'].mid - base.mid >= 0.05 && R['Work it in'].fwd - base.fwd >= 0.03, 'B5i', `shooting moves who scores: midfielders' share of the goals On sight ${(100*R['On sight'].mid).toFixed(1)}%, Balanced ${(100*base.mid).toFixed(1)}%, Work it in ${(100*R['Work it in'].mid).toFixed(1)}%; forwards' share ${(100*R['On sight'].fwd).toFixed(1)}%, ${(100*base.fwd).toFixed(1)}%, ${(100*R['Work it in'].fwd).toFixed(1)}%`);
}

// ---- 5. the league's shape: the rules of 1.7.1 against the rules now ----
function leagueShape(on, seeds, seasons){
  const keep = { on: T.on }; T.on = on; let n = 0, hw = 0, d = 0, goals = 0, yel = 0, red = 0, inj = 0; const plans = { m: [0, 0, 0], p: [0, 0, 0], r: [0, 0, 0], s: [0, 0, 0] }; const rank = []; const fitness = [];
  for (const seed of seeds){ const st = E.newGame({ seed, userClub: 20 }); for (let s = 0; s < seasons; s++){ const pres = {}; for (const c of st.clubs) if (c.div >= 1) pres[c.id] = c.prestige;
      for (let w = 0; w < E.CFG.WEEKS; w++) for (const m of E.advanceWeek(st)){ if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } if (m.cup !== undefined || m.euro) continue; n++; goals += m.gH + m.gA; if (m.gH > m.gA) hw++; else if (m.gH === m.gA) d++; yel += m.cards.filter(c => c.type === 'Y').length; red += m.cards.filter(c => c.type === 'R').length; inj += m.injuries.length; if (m.tH) for (const t of [m.tH, m.tA]) for (const k of E.PLAN_KEYS) plans[k][t[k] + 1]++; }
      // does quality still tell: how well the final table follows the clubs' standing at the start (rank correlation, by division)
      for (const dv of [1, 2, 3, 4]){ const cl = st.clubs.filter(c => c.div === dv); const a = cl.slice().sort((x, y) => pres[y.id] - pres[x.id]).map(c => c.id), b = cl.slice().sort((x, y) => (x.leaguePos || 99) - (y.leaguePos || 99)).map(c => c.id); let s2 = 0; for (let i = 0; i < a.length; i++){ const dd = i - b.indexOf(a[i]); s2 += dd*dd; } rank.push(1 - 6*s2/(a.length*(a.length*a.length - 1))); }
      E.endSeason(st); if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } } }
  T.on = keep.on; const r = { n, home: hw/n, draw: d/n, away: 1 - hw/n - d/n, goals: goals/n, yellows: yel/n, reds: red/n, injuries: inj/n, follows: rank.reduce((s, v) => s + v, 0)/rank.length, plans };
  return r;
}
if (LEAGUE){
  const seeds = [11, 22, 33, 44, 55, 66, 77, 88], seasons = 3; console.log(`\n5. The league's shape over ${seeds.length*seasons} seasons from the same starts: the rules of 1.7.1, then the rules now`);
  const a = leagueShape(false, seeds, seasons), b = leagueShape(true, seeds, seasons); const row = (name, r) => console.log('   ' + name.padEnd(18) + `${r.n} matches | home ${(100*r.home).toFixed(1)}% draw ${(100*r.draw).toFixed(1)}% away ${(100*r.away).toFixed(1)}% | goals ${r.goals.toFixed(2)} | bookings ${r.yellows.toFixed(2)} | sent off ${r.reds.toFixed(3)} | injuries ${r.injuries.toFixed(2)} | the table follows the clubs' standing ${r.follows.toFixed(2)}`); row('rules of 1.7.1', a); row('rules now', b);
  const P = b.plans; const sh = k => P[k].map(v => (100*v/(P[k][0] + P[k][1] + P[k][2])).toFixed(0) + '%').join('/'); console.log(`   what the computer managers chose: mentality Defensive/Balanced/Attacking ${sh('m')}; passing Short/Mixed/Direct ${sh('p')}; pressing Low/Normal/High ${sh('r')}; shooting ${sh('s')}`);
  report.league = { before: a, now: b };
  say(Math.abs(b.goals - a.goals) <= 0.10 && Math.abs(b.home - a.home) <= 0.015 && Math.abs(b.draw - a.draw) <= 0.015 && Math.abs(b.away - a.away) <= 0.015 && Math.abs(b.yellows/a.yellows - 1) <= 0.10 && Math.abs(b.injuries/a.injuries - 1) <= 0.10, 'B2', `with computer plans on the league keeps its shape: goals ${a.goals.toFixed(2)} to ${b.goals.toFixed(2)}, home wins ${(100*a.home).toFixed(1)}% to ${(100*b.home).toFixed(1)}%, draws ${(100*a.draw).toFixed(1)}% to ${(100*b.draw).toFixed(1)}%, away wins ${(100*a.away).toFixed(1)}% to ${(100*b.away).toFixed(1)}%, bookings ${a.yellows.toFixed(2)} to ${b.yellows.toFixed(2)}, injuries ${a.injuries.toFixed(2)} to ${b.injuries.toFixed(2)}`);
}

// ---- 6. a whole season with one setting left on ----
// ---- 7. what tactics are worth in all (--worth): a 30-match league season against the computer clubs as they play, worked out exactly ----
if (flag('--worth') || flag('--all')){
  console.log('\n7. What tactics are worth in all: a 30-match league season against the computer clubs as they play, worked out exactly (equal fitness, so the legs a high press costs are not counted)');
  const out = {}; const sits = []; for (const k of Object.keys(rep)) for (const venue of ['home', 'away']) sits.push({ k, venue, w: rep[k].n/tot*15 }); const sum = arr => arr.reduce((x, v, i) => x + v*sits[i].w, 0);
  for (const sk of [68, 72, 76]){ const val = {}; for (const f of FORMS) val[f] = PLANS.map(plan => sits.map(q => vsComputer(f, plan, sk, rep[q.k].c, q.venue)));
    const base = sum(val['4-4-2'][PLANS.findIndex(t => !t.m && !t.p && !t.r && !t.s)]); let fx = null, fxAny = null, worst = null;
    for (const f of FORMS) PLANS.forEach((plan, i) => { const v = sum(val[f][i]); if (f === '4-4-2' && (!fx || v > fx.v)) fx = { v, f, plan }; if (!fxAny || v > fxAny.v) fxAny = { v, f, plan }; if (!worst || v < worst.v) worst = { v, f, plan }; });
    const pm = sits.reduce((x, q, i) => x + q.w*Math.max(...val['4-4-2'].map(a => a[i])), 0), pmAny = sits.reduce((x, q, i) => x + q.w*Math.max(...FORMS.map(f => Math.max(...val[f].map(a => a[i])))), 0);
    out[sk - 72] = { base, fixed442: fx.v - base, fixedAny: fxAny.v - base, perMatch442: pm - base, perMatchAny: pmAny - base, worst: worst.v - base, bestFixed: fxAny.f + ' ' + planName(fxAny.plan), bestFixed442: planName(fx.plan), worstFixed: worst.f + ' ' + planName(worst.plan) };
    console.log(`   your players ${sk === 72? 'equal' : sk > 72? '4 better' : '4 worse'}: 4-4-2 all-Balanced ${base.toFixed(1)} points | the best plan left on all season ${f2(fx.v - base)} in 4-4-2 (${planName(fx.plan)}), ${f2(fxAny.v - base)} with any formation (${fxAny.f}, ${planName(fxAny.plan)}) | the best plan chosen match by match ${f2(pm - base)} in 4-4-2, ${f2(pmAny - base)} with any formation | the worst left on all season ${f2(worst.v - base)} (${worst.f}, ${planName(worst.plan)})`); }
  const pts = sk => { let t = 0; for (const q of sits) t += q.w*vsComputer('4-4-2', Z, sk, rep[q.k].c, q.venue); return t; }; const one1 = pts(73) - pts(72), three = pts(75) - pts(72); out.skill = { one: one1, three };
  console.log(`   for scale: one more skill point on every player is worth ${f2(one1)} points a season, three ${f2(three)}`); report.worth = out;
}
if (SEASONS){
  console.log(`\n6. A whole league season with one thing left on all season (${SEASONS} seasons a line, the same starts for every line; a Division 2 club)`); const U = 20; const policies = [['all-Balanced', null]];
  if (!flag('--no-singles')) for (const k of E.PLAN_KEYS) for (const v of [-1, 1]) policies.push([NAMES[k][v + 1] + ' always', one(k, v)]);
  // --plans "1,-1,-1,0;1,1,1,-1@4-3-3": whole plans left on all season (mentality, passing, pressing, shooting), with a formation after @
  if (flag('--plans')) for (const q0 of String(flag('--plans')).split(';')){ const [q, fm] = q0.split('@'); const v = q.split(',').map(Number); const plan = { m: v[0], p: v[1], r: v[2], s: v[3] }; policies.push([(fm? fm + ', ' : '') + E.PLAN_KEYS.map(k => NAMES[k][plan[k] + 1]).join(' + ') + ' always', plan, fm]); }
  if (flag('--formations')) for (const fm of FORMS) if (fm !== '4-4-2') policies.push([fm + ' always, all-Balanced', null, fm]);
  const res = {};
  for (const physio of PHYSIO){ res[physio] = {}; for (const [name, plan, fm] of policies){ let pts = 0, games = 0, fit = 0, nf = 0; const per = [];
      for (let s = 0; s < SEASONS; s++){ const st = E.newGame({ seed: 5000 + s, userClub: U }); const c = st.clubs[U]; c.staff.physio = physio; if (plan) c.tactics = plan; if (fm) c.formation = fm; let p0 = 0;
        for (let w = 0; w < E.CFG.WEEKS; w++) for (const m of E.advanceWeek(st)){ if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } if (m.cup !== undefined || m.euro || (m.home.id !== U && m.away.id !== U)) continue; const mine = m.home.id === U? m.gH : m.gA, theirs = m.home.id === U? m.gA : m.gH; const p = mine > theirs? 3 : mine === theirs? 1 : 0; pts += p; p0 += p; games++; for (const x of (m.home.id === U? m.xiH : m.xiA)){ fit += x.p.fitness; nf++; } }
        per.push(p0); }
      const mean = pts/SEASONS; const sd = Math.sqrt(per.reduce((s, v) => s + (v - mean)*(v - mean), 0)/(per.length - 1)); res[physio][name] = { points: mean, se: sd/Math.sqrt(SEASONS), fitness: fit/nf, per };
      console.log(`   physio ${physio}  ${name.padEnd(name.length > 28? 62 : 28)} ${mean.toFixed(2)} points (give or take ${(sd/Math.sqrt(SEASONS)).toFixed(2)}) | fitness at the next kick-off ${(fit/nf).toFixed(1)}`); }
    // the gain over all-Balanced, season by season from the same start, so the "give or take" is of the difference itself
    // B6 is about one setting left on (as approved). Whole plans and formations left on are reported beside it, not judged by it:
    // a plan that suits the side you have is meant to be worth something all season (TACTICS-SLICE-1.md, section 4).
    const b = res[physio]['all-Balanced']; const single = new Set(policies.filter(q => q[1] && !q[2] && E.PLAN_KEYS.filter(k => q[1][k]).length === 1).map(q => q[0]));
    let top = -9, topName = '', topSe = 0, wTop = -9, wName = '', wSe = 0;
    for (const k of Object.keys(res[physio])) if (k !== 'all-Balanced'){ const r = res[physio][k], d = r.per.map((v, i) => v - b.per[i]), md = d.reduce((x, y) => x + y, 0)/d.length; r.gain = md; r.gainSe = Math.sqrt(d.reduce((x, y) => x + (y - md)*(y - md), 0)/(d.length - 1)/d.length);
      if (single.has(k)){ if (md > top){ top = md; topName = k; topSe = r.gainSe; } } else if (md > wTop){ wTop = md; wName = k; wSe = r.gainSe; } }
    for (const k of Object.keys(res[physio])) delete res[physio][k].per;
    if (topName) say(top <= 1.5, 'B6.' + physio, `physio ${physio}: no one setting left on all season beats all-Balanced by more than 1.5 points (the best is ${topName}, ${f2(top)}, give or take ${topSe.toFixed(2)})`);
    if (wName) console.log(`note W.${physio}  physio ${physio}: the best whole plan or formation left on all season is ${wName}, ${f2(wTop)} (give or take ${wSe.toFixed(2)}); reported, not a target`); }
  report.seasons = res;
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(bad? `\n${bad} target(s) not met` : '\nevery target shown here is met'); process.exit(bad? 1 : 0);
