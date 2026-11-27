#!/usr/bin/env node
'use strict';
// The balance bench for position retraining (milestone 2, slice 3a). It plays whole seasons through the game's own engine with
// one manager's club in one formation and a fixed retraining policy, and measures what the policy really does to the eleven.
// The manager buys and sells nobody, so the only thing that differs between the lines is what the priority place is used for.
//
//   node tools/retraining-balance.js --quick              a small run with loose limits (well under a minute; test-retraining.js uses it)
//   node tools/retraining-balance.js                      the full run: 50 worlds of 10 seasons, six formations, at three values (most of an hour)
//   node tools/retraining-balance.js --as 0.95            one value only
//   node tools/retraining-balance.js --as 0.95,0.9,0.95/0.9    the full run's three: 95%, 90%, and 95% for the next line with 90% for the far line
//   node tools/retraining-balance.js --worlds 60 --seasons 10 --save out.json
//
// The lines (Normal training, an Average coach):
//   none     nobody in the priority place
//   coach    the place used the other way: extra coaching for the man with most room to improve
//   one      one course at the start, for the spare man who would help the shortest line most; then nothing
//   always   a course whenever the place is free, spare men to the shortest line first, until every outfield player has a second position
//   old      the same, but only players of 28 or over are ever sent on a course
//   far      the same, but only far-line courses (defender to attacker, attacker to defender)
//   all      the ceiling: every outfield player simply handed a second position, free and at once. No amount of retraining can beat it.
//
// How the worth is measured. In every week the eleven is picked twice from the same squad on the same day: once with the learned
// positions counted and once with them ignored. The difference is what retraining is worth that week, with nothing else in it
// (no luck, no different injuries). It is done for two managers: "the game's pick", who leaves selection to the game as a
// computer club does (natural players first), and "the best pick", who chooses by hand each week the eleven with the highest
// total effective skill the selection rules allow, which is free to leave a weak natural player out for a strong retrained one.
// Effective skill a man turns into league points by the rule of thumb measured in the tactics milestone: 1.4 points a season.
//
// The targets are those of TRAINING-SLICE-3-PROPOSAL.md section 4 and John's questions of 27 November 2026, as written.
// A MISS is a finding to report, not a number to tune away.
const path = require('path'), cp = require('child_process');
const args = process.argv.slice(2), flag = f => args.includes(f), num = (f, d) => { const i = args.indexOf(f); return i >= 0? +args[i + 1] : d; }, str = (f, d) => { const i = args.indexOf(f); return i >= 0? args[i + 1] : d; };
const QUICK = flag('--quick'), WORLDS = num('--worlds', QUICK? 6 : 50), SEASONS = num('--seasons', QUICK? 3 : 10), U = num('--club', 20);
const AS = str('--as', QUICK? '0.95' : '0.95,0.9,0.95/0.9').split(',');   // each is one number, or next line/far line
const asOf = spec => { const [a, b] = String(spec).split('/').map(Number); return { near: a, far: b === undefined? a : b }; };
const FORMS = QUICK? ['4-4-2', '5-4-1'] : ['4-4-2', '4-3-3', '5-3-2', '3-5-2', '5-4-1', '4-5-1'], PLAIN = QUICK? ['none'] : ['none', 'coach'], RE = QUICK? ['one', 'always', 'all'] : ['one', 'always', 'old', 'far', 'all'];
const KEYS = ['eff', 'gAuto', 'gBest', 'best', 'lost', 'outW', 'near', 'far', 'old', 'raw', 'age', 'gain', 'sq', 'value', 'wages', 'pts', 'div', 'left', 'joined', 'offers', 'pos2', 'done', 'cpuPos2'];

function runFormation(fm){
  const E = require(path.join(__dirname, '..', 'engine.js')), R = E.CFG.RETRAIN, F = E.FORMATIONS[fm], need = { DEF: F.d, MID: F.m, FWD: F.f }, LINES = ['DEF', 'MID', 'FWD'];
  const unsack = st => { if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } };
  const room = p => E.canImprove(p)? p.pot - p.skill : 0, fit = p => p.injury === 0 && !(p.ban > 0);
  const effOf = xi => xi.reduce((a, x) => a + E.effSkill(x.p, x.slot), 0)/11;
  const ignoring = fn => { R.on = false; try { return fn(); } finally { R.on = true; } };
  // the best eleven a manager can pick by hand: start from the game's pick and swap one man at a time for as long as the total rises
  const bestPick = (st, c) => { let ids = E.buildXI(st, c, [], fm).map(x => x.p.id), cur = effOf(E.buildXI(st, c, ids, fm)); const pool = E.squadOf(st, c).filter(fit).map(p => p.id);
    for (let again = true, guard = 0; again && guard < 8; guard++){ again = false; for (let i = 0; i < ids.length; i++) for (const b of pool){ if (ids.includes(b)) continue; const t = ids.slice(); t[i] = b; const v = effOf(E.buildXI(st, c, t, fm)); if (v > cur + 1e-9){ ids = t; cur = v; again = true; } } }
    return E.buildXI(st, c, ids, fm); };
  // whom to send on a course, and where: the line with the least cover gets the best man who can be spared from the line with most
  const choose = (st, c, only) => { const sq = E.squadOf(st, c).filter(p => p.pos !== 'GK'), nat = {}, cover = {}; for (const L of LINES){ nat[L] = sq.filter(p => p.pos === L).length; cover[L] = nat[L] + sq.filter(p => p.pos2 === L).length; }
    const lines = LINES.slice().sort((a, b) => (cover[a] - need[a]) - (cover[b] - need[b]) || need[b] - need[a]);
    for (const T of lines){ const rank = p => sq.filter(q => q.pos === p.pos && q.skill > p.skill).length, spare = p => rank(p) >= need[p.pos];
      const cands = sq.filter(p => p.pos !== T && !p.pos2 && E.canLearn(p, T) && (only !== 'old' || p.age >= 28) && (only !== 'far' || E.retrainKind(p, T) === 'far')).sort((a, b) => (spare(b) - spare(a)) || ((nat[b.pos] - need[b.pos]) - (nat[a.pos] - need[a.pos])) || b.skill - a.skill || a.id - b.id);
      if (cands.length) return [cands[0], T]; } return null; };
  const out = {};
  const play = (arm, as) => { R.AS = asOf(as); const res = [], ageing = { n: {}, y: {} }; for (let s = 0; s < SEASONS; s++){ const S = {}; for (const k of KEYS) S[k] = []; res.push(S); }
    for (let w0 = 0; w0 < WORLDS; w0++){ const st = E.newGame({ seed: 40000 + w0, userClub: U }); let started = false; const seen = new Set();
      for (let s = 0; s < SEASONS; s++){ const S = res[s], season = st.season; let c = st.clubs[st.userClub]; E.setTraining(st, 'normal'); E.setStaff(st, 'coach', 1);
        const A = { eff: 0, gAuto: 0, lost: 0, outW: 0, near: 0, far: 0, old: 0, raw: 0, age: 0 }; let weeks = 0, gBest = 0, best = 0, bw = 0, done = 0, offers = 0;
        while (st.season === season){ c = st.clubs[st.userClub]; c.formation = fm; const last = st.week >= E.CFG.WEEKS;
          if (arm === 'coach'){ const cur = E.coachedOf(st, c); if (!cur || room(cur) <= 0){ const b = E.squadOf(st, c).filter(p => room(p) > 0).sort((a, b2) => room(b2) - room(a) || a.age - b2.age || a.id - b2.id)[0]; E.setPriority(st, b? b.id : null); } }
          else if (arm === 'all'){ for (let pick; (pick = choose(st, c)); ) pick[0].pos2 = pick[1]; }
          else if ((arm === 'one' && !started) || arm === 'always' || arm === 'old' || arm === 'far'){ if (!E.learnerOf(st, c)){ const pick = choose(st, c, arm); if (pick){ E.setRetrain(st, pick[0].id, pick[1]); started = true; } } }
          const had = new Set(E.squadOf(st, c).filter(p => p.pos2).map(p => p.id + p.pos2));
          if (!last){ const xi = E.buildXI(st, c, st.userSel || [], fm), on = effOf(xi); let any = false; weeks++; A.eff += on; A.gAuto += on - ignoring(() => effOf(E.buildXI(st, c, st.userSel || [], fm)));
            for (const x of xi){ const w = E.slotWorth(x.p, x.slot); A.lost += E.effSkill(x.p, x.slot)/w*(1 - w); A.raw += x.p.skill/11; A.age += x.p.age/11; if (x.slot !== x.p.pos){ if (x.p.pos2 === x.slot && x.p.pos !== 'GK' && x.slot !== 'GK'){ A[E.retrainKind(x.p, x.slot)]++; if (x.p.age >= 28) A.old++; } else any = true; } }
            if (any) A.outW++;
            if (arm !== 'none' && arm !== 'coach' && st.week % 3 === 1){ const b = effOf(bestPick(st, c)); best += b; gBest += b - ignoring(() => effOf(bestPick(st, c))); bw++; }
 }
          let snap = null, ids = null; if (last){ const sq = E.squadOf(st, c); S.value.push(sq.reduce((a, p) => a + E.valueFor(p), 0)); S.wages.push(sq.reduce((a, p) => a + p.wage, 0)); S.pos2.push(sq.filter(p => p.pos2).length); S.gain.push(E.trainingRecord(st, c).now.n); S.sq.push(sq.reduce((a, p) => a + p.skill, 0)/sq.length); ids = new Set(c.players);
            S.cpuPos2.push(Object.values(st.players).filter(p => p.pos2 && p.club !== c.id && p.club >= 0 && !p.retired).length); snap = sq.filter(p => p.age >= 27).map(p => [p, p.skill, !!p.pos2]); }
          const uid = c.id; E.advanceWeek(st); unsack(st);
          for (const o of st.offers || []){ const k = [o.pid, o.club, o.expires, o.season].join('|'); if (!seen.has(k)){ seen.add(k); offers++; } }
          for (const p of E.squadOf(st, st.clubs[uid])) if (p.pos2 && !had.has(p.id + p.pos2)) done++;
          if (last){ const k = st.clubs[uid], h = k.history, hl = h[h.length - 1]; S.pts.push(hl? hl.pts : NaN); S.div.push(hl? hl.div : NaN); S.left.push([...ids].filter(id => !k.players.includes(id)).length); S.joined.push(k.players.filter(id => !ids.has(id)).length);
            for (const x of snap){ const t = ageing[x[2]? 'y' : 'n'], a = x[0].age; t[a] = t[a] || [0, 0]; t[a][0] += x[0].skill - x[1]; t[a][1]++; } } }   // the summer's change in skill, by the age he has just reached
        for (const k in A) S[k].push(A[k]/weeks); if (bw){ S.gBest.push(gBest/bw); S.best.push(best/bw); } S.done.push(arm === 'all'? NaN : done); S.offers.push(offers); } }
    out['ageing:' + arm + (PLAIN.includes(arm)? '' : '@' + as)] = ageing; return res; };
  for (const arm of PLAIN) out[arm] = play(arm, AS[0]);
  for (const as of AS) for (const arm of RE) out[arm + '@' + as] = play(arm, as);
  // squad composition: what a squad built with no regard to position gives up. The best eleven is picked from the starting squad
  // (a) as it really is, (b) with the same men as a squad built for this formation, (c) with every outfield player called a
  // midfielder and nothing learned, and (d) all midfielders, each having learned defence or attack.
  const comp = { real: [], ideal: [], mono: [] }; for (const as of AS) comp['mono@' + as] = [];
  for (let w0 = 0; w0 < WORLDS; w0++){ const st = E.newGame({ seed: 40000 + w0, userClub: U }), c = st.clubs[U]; c.formation = fm; comp.real.push(effOf(bestPick(st, c)));
    const men = E.squadOf(st, c).filter(p => p.pos !== 'GK').sort((a, b) => b.skill - a.skill);
    const want = [].concat(...LINES.map(L => Array(need[L]).fill(L))); men.forEach((p, i) => { p.pos = want[i % want.length]; }); comp.ideal.push(effOf(bestPick(st, c)));   // the same men, as a squad built for this formation
    for (const p of men) p.pos = 'MID'; comp.mono.push(effOf(bestPick(st, c)));
    const order = []; for (let i = 0; i < Math.max(need.DEF, need.FWD); i++){ if (i < need.DEF) order.push('DEF'); if (i < need.FWD) order.push('FWD'); }
    men.slice().reverse().forEach((p, i) => { p.pos2 = order[i % order.length]; });   // the weaker men first: the selection rules send the least skilful extra man out of his line
    for (const as of AS){ R.AS = asOf(as); comp['mono@' + as].push(effOf(bestPick(st, c))); } }
  out.comp = comp; return out; }

const CHILD = flag('--child'); if (CHILD) process.stdout.write(JSON.stringify(runFormation(str('--child'))), () => process.exit(0));

// ---------- the parent: one process a formation, two at a time, then the report ----------
const mean = a => { const b = a.filter(x => x === x); return b.length? b.reduce((x, y) => x + y, 0)/b.length : NaN; }, sd = a => { const b = a.filter(x => x === x), m = mean(b); return Math.sqrt(mean(b.map(x => (x - m)*(x - m)))); }, se = a => sd(a)/Math.sqrt(Math.max(1, a.filter(x => x === x).length));
const f = (x, n = 1) => x === x? x.toFixed(n) : 'n/a', sgn = (x, n = 2) => x === x? (x >= 0? '+' : '') + x.toFixed(n) : 'n/a';
const all = (R, key, from = 0, to = 99) => [].concat(...R.slice(from, to).map(S => S[key])), bySeason = (R, key) => R.map(S => mean(S[key]));
let miss = 0; const target = (name, okk, text) => { if (!okk) miss++; console.log((okk? 'MET   ' : 'MISS  ') + name + ': ' + text); };
const PTS = 1.4, pc = spec => { const a = asOf(spec); return a.near === a.far? Math.round(a.near*100) + '%' : `${Math.round(a.near*100)}% next line and ${Math.round(a.far*100)}% far line`; };
async function main(){
  const D = {}; const queue = FORMS.slice(), work = async () => { while (queue.length){ const fm = queue.shift(); D[fm] = await new Promise((res, rej) => { const ch = cp.spawn(process.execPath, [__filename, '--child', fm].concat(args), { stdio: ['ignore', 'pipe', 'inherit'] }); let buf = ''; ch.stdout.on('data', d => buf += d); ch.on('close', code => code? rej(new Error(fm + ' exit ' + code)) : res(JSON.parse(buf))); }); } };
  await Promise.all([work(), work()]);
  if (str('--save', '')) require('fs').writeFileSync(str('--save'), JSON.stringify(D));
  const E = require(path.join(__dirname, '..', 'engine.js')), R0 = E.CFG.RETRAIN, A0 = AS[0];
  console.log(`Soccer Manager '91: the balance bench for position retraining${QUICK? ' (quick)' : ''}`);
  console.log(`club ${U} (Division 2), ${WORLDS} worlds of ${SEASONS} seasons for each formation and line; Normal training, an Average coach; the manager buys and sells nobody`);
  console.log(`a learned position worth ${AS.map(pc).join('; ')} of a man's skill (unlearned: the next line 85%, the far line 70%); ${R0.WORK.near} weeks of work for the next line, ${R0.WORK.far} for the far line`);
  console.log(`"worth" is the eleven picked with the learned positions counted, less the eleven picked from the same squad on the same day with them ignored, in effective skill a man; x ${PTS} for league points a season`);
  const ageingOf = key => { const n = {}, y = {}; for (const fm of FORMS) for (const [src, dst] of [[D[fm]['ageing:' + key].n, n], [D[fm]['ageing:' + key].y, y]]) for (const a in src){ dst[a] = dst[a] || [0, 0]; dst[a][0] += src[a][0]; dst[a][1] += src[a][1]; }
    let w = 0, m = 0, cnt = 0; const rows = []; for (const a of Object.keys(y).map(Number).sort((p, q) => p - q)){ if (a < 29 || !n[a] || !n[a][1]) continue; w += y[a][0]; m += y[a][1]*n[a][0]/n[a][1]; cnt += y[a][1]; rows.push([a, y[a][0]/y[a][1], n[a][0]/n[a][1]]); } return { withIt: w/cnt, matched: m/cnt, n: cnt, rows }; };
  const g = (fm, arm, as, key) => mean(all(D[fm][arm + '@' + as], key)), top = (fm, arm, as, key) => Math.max(...bySeason(D[fm][arm + '@' + as], key));

  for (const as of AS){ console.log(`\n==================== a learned position worth ${pc(as)} ====================`);
    console.log('\n1. What retraining is worth, in league points a season (the game\'s pick / the best pick)');
    console.log('   ' + 'formation'.padEnd(10) + RE.map(a => a.padStart(16)).join(''));
    for (const fm of FORMS) console.log('   ' + fm.padEnd(10) + RE.map(a => (sgn(g(fm, a, as, 'gAuto')*PTS) + ' / ' + sgn(g(fm, a, as, 'gBest')*PTS)).padStart(16)).join(''));
    console.log('\n   One retraining, season by season (the best pick): ' + FORMS.map(fm => `${fm} ${bySeason(D[fm]['one@' + as], 'gBest').map(x => sgn(x*PTS)).join(' ')}`).join('\n' + ' '.repeat(53)));
    console.log('\n2. Season by season, retraining continuously ("always"): league points a season, the game\'s pick then the best pick; and second positions held in the squad');
    for (const fm of FORMS){ const A = D[fm]['always@' + as]; console.log(`   ${fm}: ${bySeason(A, 'gAuto').map(x => sgn(x*PTS)).join(' ')}`); console.log(`   ${' '.repeat(fm.length)}  ${bySeason(A, 'gBest').map(x => sgn(x*PTS)).join(' ')}`); console.log(`   ${' '.repeat(fm.length)}  held ${bySeason(A, 'pos2').map(x => f(x)).join(' ')}; courses finished a season ${f(mean(all(A, 'done')))}`); }
    console.log('\n3. Men out of position, with nobody retrained and retraining continuously');
    for (const fm of FORMS){ const N = D[fm].none, A = D[fm]['always@' + as], C = D[fm]['all@' + as]; console.log(`   ${fm}: a man out of position and unlearned in ${f(100*mean(all(N, 'outW')), 0)}% of weeks, then ${f(100*mean(all(A, 'outW')), 0)}% (ceiling ${f(100*mean(all(C, 'outW')), 0)}%); effective skill given up to the position rule ${f(mean(all(N, 'lost')))} a match, then ${f(mean(all(A, 'lost')))} (ceiling ${f(mean(all(C, 'lost')))}); men in a learned position a week: next line ${f(mean(all(A, 'near')), 2)}, far line ${f(mean(all(A, 'far')), 2)}`); }
    if (!QUICK){ console.log('\n4. Far-line courses only (defender to attacker and back), continuously: league points a season, the game\'s pick / the best pick; and men in a far-line learned position a week');
      for (const fm of FORMS){ const A = D[fm]['far@' + as]; console.log(`   ${fm}: ${sgn(g(fm, 'far', as, 'gAuto')*PTS)} / ${sgn(g(fm, 'far', as, 'gBest')*PTS)}; ${f(mean(all(A, 'far')), 2)} a week; held at the end ${f(mean(A[SEASONS - 1].pos2))}`); }
      console.log('\n5. Older players: only men of 28 or over sent on a course');
      for (const fm of FORMS){ const O = D[fm]['old@' + as]; console.log(`   ${fm}: ${sgn(g(fm, 'old', as, 'gAuto')*PTS)} / ${sgn(g(fm, 'old', as, 'gBest')*PTS)} points a season (every age: ${sgn(g(fm, 'always', as, 'gAuto')*PTS)} / ${sgn(g(fm, 'always', as, 'gBest')*PTS)}); men of 28 or over in a learned position ${f(mean(all(O, 'old')), 2)} a week; courses finished a season ${f(mean(all(O, 'done')))}; held at a season's end ${f(mean(all(O, 'pos2')))}; average age of the eleven ${f(mean(all(D[fm].none, 'age')))} and ${f(mean(all(O, 'age')))}`); }
      const ag = ageingOf('old@' + as); console.log(`   the summer's change in skill for the same men (all formations): with a second position ${f(ag.withIt, 2)} a man (${ag.n} summers); men of the same ages without one ${f(ag.matched, 2)}`);
      console.log('   by the age reached, with and without: ' + ag.rows.map(r => `${r[0]}: ${f(r[1], 2)} and ${f(r[2], 2)}`).join(', ')); }
    console.log('\n' + (QUICK? '4' : '6') + '. Squad composition: the best eleven from the same men as a squad built for the formation, and as a squad built with no regard to position (every outfield player a midfielder)');
    for (const fm of FORMS){ const c = D[fm].comp, ideal = mean(c.ideal), real = mean(c.real), mono = mean(c.mono), re = mean(c['mono@' + as]); console.log(`   ${fm}: built for it ${f(ideal, 2)} a man (the squad as it really is ${f(real, 2)}); no regard to position, nothing learned ${sgn((mono - ideal)*PTS, 1)} points a season; no regard to position, every man retrained ${sgn((re - ideal)*PTS, 1)} points: natural positions keep ${f(100*(ideal - re)/(ideal - mono), 0)}% of their worth`); } }

  // differences between two lines, world against the same world (the same starting squad), all formations together: the mean and its standard error
  const paired = (key, armKey, rel) => { const d = []; for (const fm of FORMS) for (let w = 0; w < WORLDS; w++){ const m = k => mean(D[fm][k].map(S => S[key][w])); const a = m(armKey), b = m('none'); d.push(rel? 100*(a/b - 1) : a - b); } return [mean(d), se(d)]; };
  const pm = (x, n = 2, unit = '') => `${sgn(x[0], n)}${unit} (give or take ${f(2*x[1], n)}${unit})`;
  if (!QUICK){ console.log('\n==================== the wider game ====================');
    console.log('\n7. League points counted directly (each figure good to about ' + f(se(all(D[FORMS[0]].none, 'pts'))) + ' of a point, so a cross-check and no more)');
    for (const fm of FORMS) console.log(`   ${fm}: none ${f(mean(all(D[fm].none, 'pts')))} (div ${f(mean(all(D[fm].none, 'div')), 2)}), coach ${f(mean(all(D[fm].coach, 'pts')))}, ` + AS.map(as => `always at ${pc(as)} ${f(mean(all(D[fm]['always@' + as], 'pts')))}, ceiling ${f(mean(all(D[fm]['all@' + as], 'pts')))}`).join('; '));
    console.log('\n8. Retraining continuously against nobody retrained: the same world against itself, all six formations together (' + (FORMS.length*WORLDS) + ' pairs of ten seasons)');
    for (const as of AS){ const k = 'always@' + as; console.log(`   at ${pc(as)}: league points a season ${pm(paired('pts', k), 1)}; average skill of the squad ${pm(paired('sq', k))}; skill gained in training a season ${pm(paired('gain', k))}; squad value ${pm(paired('value', k, true), 1, '%')}; wage bill ${pm(paired('wages', k, true), 1, '%')}; bids received a season ${pm(paired('offers', k))}; players leaving in the summer ${pm(paired('left', k))}; average age of the eleven ${pm(paired('age', k))}`); }
    console.log(`   extra coaching instead (the other use of the place): league points a season ${pm(paired('pts', 'coach'), 1)}; average skill of the squad ${pm(paired('sq', 'coach'))}; skill gained in training a season ${pm(paired('gain', 'coach'))}; squad value ${pm(paired('value', 'coach', true), 1, '%')}`);
    console.log('\n9. Computer clubs: none retrains (exact, in test-retraining.js), so the manager gains on them exactly what section 1 shows. Players with a second position at other clubs at a season\'s end (men the manager retrained who have moved on): ' + FORMS.map(fm => `${fm} ${f(mean(all(D[fm]['always@' + A0], 'cpuPos2')), 1)}`).join(', ')); }

  console.log('\n=== The targets ===');
  for (const as of AS){ const lim = QUICK? 3 : 1; console.log(`at ${pc(as)}:`);
    const one = FORMS.map(fm => [fm, g(fm, 'one', as, 'gAuto')*PTS, g(fm, 'one', as, 'gBest')*PTS, top(fm, 'one', as, 'gBest')*PTS]);
    target('R3a one retraining is worth no more than 0.5 of a league point a season in any formation', one.every(x => Math.max(x[1], x[2]) <= 0.5*lim), one.map(x => `${x[0]} ${sgn(x[1])} / ${sgn(x[2])} (best season ${sgn(x[3])})`).join(', '));
    const alw = FORMS.map(fm => [fm, g(fm, 'always', as, 'gAuto')*PTS, g(fm, 'always', as, 'gBest')*PTS, Math.max(top(fm, 'always', as, 'gAuto'), top(fm, 'always', as, 'gBest'))*PTS]);
    target('R3b a manager who retrains somebody continuously for ten seasons is never worth more than 1 point a season over one who does not', alw.every(x => x[3] <= 1*lim), alw.map(x => `${x[0]} ${sgn(x[1])} / ${sgn(x[2])} on average, ${sgn(x[3])} in its best season`).join('; '));
    const ceil = FORMS.map(fm => [fm, g(fm, 'all', as, 'gAuto')*PTS, g(fm, 'all', as, 'gBest')*PTS]); console.log('      the ceiling (every outfield player with a second position, free): ' + ceil.map(x => `${x[0]} ${sgn(x[1])} / ${sgn(x[2])}`).join(', '));
    if (!QUICK){ const pn = FORMS.map(fm => mean(all(D[fm].none, 'pts'))), add = FORMS.map(fm => Math.max(g(fm, 'always', as, 'gAuto'), g(fm, 'always', as, 'gBest'))*PTS), est = FORMS.map((fm, i) => pn[i] + add[i]), bestN = Math.max(...pn), spread = a => Math.max(...a) - Math.min(...a);
      target('Rf no formation becomes the one to play: with continuous retraining none stands more than half a point above the best formation without it', Math.max(...est) - bestN <= 0.5, FORMS.map((fm, i) => `${fm} ${f(pn[i])} to ${f(est[i])}`).join(', ') + `; the six formations span ${f(spread(pn))} points without retraining and ${f(spread(est))} with`);
      const ag = ageingOf('old@' + as); target('Ra the ageing rule is not softened: a man of 28 or over changes the same in the summer with a second position as a man of the same age without', Math.abs(ag.withIt - ag.matched) < 0.15, `${f(ag.withIt, 2)} with, ${f(ag.matched, 2)} without (${ag.n} summers)`); } }
  if (!QUICK){ const k = 'always@' + A0, within = x => Math.abs(x[0]) <= 2.5*x[1], gn = paired('gain', k), sq = paired('sq', k), va = paired('value', k, true), wa = paired('wages', k, true);
    target('R4 no skill added: the squad gains the same in training, and is as skilful, with a learner as with nobody in the place', within(gn) && within(sq), `skill gained a season ${pm(gn)}, average skill of the squad ${pm(sq)} (exact, week by week, in test-retraining.js)`);
    target('R5 no money in it: squad value and wages the same with and without', within(va) && within(wa), `value ${pm(va, 1, '%')}, wages ${pm(wa, 1, '%')} (no player's value or wage changes: exact in test-retraining.js)`);
    target('R8 computer clubs are untouched', true, 'none retrains (exact in test-retraining.js)'); }
  console.log(miss? `\n${miss} target${miss > 1? 's' : ''} missed` : '\nevery target met'); }
if (!CHILD) main().catch(e => { console.error(e); process.exit(2); });
