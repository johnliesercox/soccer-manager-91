#!/usr/bin/env node
'use strict';
// The balance bench for training focus and the priority player (milestone 2, slice 1). It plays whole seasons through the
// game's own engine with one manager's club left to a fixed training policy, and measures what the policy really does:
// who improves and by how much, what it costs, and how far the manager's club pulls away from the computer clubs.
// The manager buys and sells nobody and the game picks his team, so the only thing that differs between arms is training.
//
//   node tools/training-balance.js --quick           a small run with loose limits (about a minute; test-training.js uses it)
//   node tools/training-balance.js                   the full run: 40 worlds, 10 seasons for the long arms (most of an hour, two processes)
//   node tools/training-balance.js --worlds 60 --seasons 10
//   node tools/training-balance.js --set FOCUS=2,GK=3,PRIORITY=1.5,COST=0     the same with other numbers, to see what they would do
//
// The targets are the ones of the scope proposal (claude/sm91-milestone-2-training-proposal.md in the project, section 4), as written
// there. A MISS is a finding to report, not a number to tune away.
//
// The arms (each at three settings: Normal with the average coach, Normal with the best, Hard with the best):
//   none      the manager's first team gets no weekly training at all: what a computer club gets
//   balanced  no focus, no priority player: the game as it is in 1.8.0
//   GK DEF MID FWD   that focus left on, no priority player
//   priority  no focus; the priority player is the man with the most room to improve
//   eleven    every lever for the first eleven: each week the focus is the group whose likely starters have most room, and the
//             priority player is the starter with most room
//   stack     every lever on one man: the best prospect is the priority player and the focus is his group
const path = require('path'), cp = require('child_process');
const args = process.argv.slice(2), flag = f => args.includes(f), num = (f, d) => { const i = args.indexOf(f); return i >= 0? +args[i + 1] : d; }, str = (f, d) => { const i = args.indexOf(f); return i >= 0? args[i + 1] : d; };
const QUICK = flag('--quick'), WORLDS = num('--worlds', QUICK? 6 : 40), LONG = num('--seasons', QUICK? 3 : 10), SHORT = Math.min(LONG, QUICK? 3 : 4), U = num('--club', 20);
const SETTINGS = { N1: ['normal', 1, 'Normal, average coach'], N3: ['normal', 3, 'Normal, best coach'], H3: ['hard', 3, 'Hard, best coach'] };
const POS = ['GK', 'DEF', 'MID', 'FWD'], LONG_ARMS = ['none', 'balanced', 'priority', 'eleven', 'stack'], ARMS = QUICK? ['balanced', 'DEF', 'priority', 'eleven', 'stack'] : LONG_ARMS.concat(POS);

// --set FOCUS=2,GK=3,PRIORITY=1.5,COST=0 tries other numbers without touching the engine's own (FOCUS sets the three outfield groups)
function tune(E){ const T = E.CFG.TRAINING; for (const kv of (str('--set', '') || '').split(',').filter(Boolean)){ const [k, v] = kv.split('='); if (k === 'FOCUS'){ T.FOCUS.DEF = T.FOCUS.MID = T.FOCUS.FWD = +v; } else if (k === 'GK') T.FOCUS.GK = +v; else if (k in T) T[k] = +v; else throw new Error('no such number: ' + k); } return E; }
function runSetting(key){
  const E = tune(require(path.join(__dirname, '..', 'engine.js'))); const [intensity, coach] = SETTINGS[key], W = E.CFG.WEEKS;
  const room = p => E.canImprove(p)? p.pot - p.skill : 0;
  const best = (list) => list.filter(p => room(p) > 0).sort((a, b) => room(b) - room(a) || a.age - b.age || a.id - b.id)[0] || null;
  const eleven = (st, c) => E.autoSelect(st, c).map(x => x && x.p).filter(Boolean);
  const xiSkill = (st, c) => { const xi = eleven(st, c); return xi.reduce((a, p) => a + p.skill, 0)/Math.max(1, xi.length); };
  const unsack = st => { if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } };
  const out = {};
  for (const arm of ARMS){ if (arm === 'none' && key !== 'N1') continue; if (POS.includes(arm) && key === 'N3') continue;
    const seasons = LONG_ARMS.includes(arm)? LONG : SHORT, R = out[arm] = { seasons: [] }; for (let s = 0; s < seasons; s++) R.seasons.push({ gain: [], byPos: { GK: [], DEF: [], MID: [], FWD: [] }, xi: [], xiDiv: [], pts: [], div: [], pro: [], proVal: [], proFit: [], proLow: [], top: [], res: [], over: 0, floor: 0 });
    const keepGain = E.CFG.TRAIN.normal.gain; if (arm === 'none') E.CFG.TRAIN.normal.gain = 0;
    for (let w0 = 0; w0 < WORLDS; w0++){ const st = E.newGame({ seed: 20000 + w0, userClub: U });
      for (let s = 0; s < seasons; s++){ const S = R.seasons[s], season = st.season; let c = st.clubs[st.userClub]; E.setTraining(st, arm === 'none'? 'normal' : intensity); E.setStaff(st, 'coach', coach);
        const start = new Map(E.squadOf(st, c).map(p => [p.id, p.skill])), gains = new Map(); let total = 0; const byPos = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        const prospect = best(E.squadOf(st, c)), pro0 = prospect? { skill: prospect.skill, value: E.valueFor(prospect) } : null; let fitSum = 0, fitN = 0, low = 0, resGain = 0, xiEnd = 0, divEnd = 0, pts = 0;
        while (st.season === season){ c = st.clubs[st.userClub]; const sq = E.squadOf(st, c), last = st.week >= W;
          // the policy for the week
          if (arm === 'priority'){ const cur = E.priorityOf(st, c); if (!cur || room(cur) <= 0){ const b = best(sq); E.setPriority(st, b? b.id : null); } }
          else if (arm === 'eleven'){ const xi = eleven(st, c); let g = null, gr = 0; for (const k of POS){ const r = xi.filter(p => p.pos === k).reduce((a, p) => a + room(p), 0); if (r > gr){ gr = r; g = k; } } E.setFocus(st, g); const b = best(xi) || best(sq); E.setPriority(st, b? b.id : null); }
          else if (arm === 'stack'){ let cur = E.priorityOf(st, c); if (!cur || room(cur) <= 0){ cur = best(sq); E.setPriority(st, cur? cur.id : null); } E.setFocus(st, cur? cur.pos : null); }
          else if (POS.includes(arm)) E.setFocus(st, arm);
          if (last){ xiEnd = xiSkill(st, c); const cl = st.clubs.filter(x => x.div === c.div && x.id !== c.id); divEnd = cl.reduce((a, x) => a + xiSkill(st, x), 0)/Math.max(1, cl.length);
            S.gain.push(total); for (const k of POS) S.byPos[k].push(byPos[k]); let top = 0; for (const v of gains.values()) top = Math.max(top, v); S.top.push(top); S.res.push(resGain);
            if (prospect && pro0){ S.pro.push(prospect.club === c.id? prospect.skill - pro0.skill : NaN); S.proVal.push(prospect.club === c.id? E.valueFor(prospect)/pro0.value : NaN); S.proFit.push(fitN? fitSum/fitN : NaN); S.proLow.push(fitN? low/fitN : NaN); }
            const uid = c.id; E.advanceWeek(st); unsack(st); const h = st.clubs[uid].history, hl = h[h.length - 1]; S.xi.push(xiEnd); S.xiDiv.push(divEnd); S.pts.push(hl? hl.pts : NaN); S.div.push(hl? hl.div : NaN); break; }
          const before = new Map(sq.map(p => [p.id, p.skill])), resBefore = new Map(E.reservesOf(st, c).map(p => [p.id, p.skill]));
          if (prospect && prospect.club === c.id && !(prospect.injury > 0)){ fitSum += prospect.fitness; fitN++; if (prospect.fitness < 70) low++; }
          if (E.trainingShare(st, c)){ const el = sq.filter(p => E.canImprove(p)); if (el.some(p => Math.abs(E.trainingChance(st, c, p)/(E.CFG.TRAIN_BASE*E.CFG.COACH_MULT[c.staff.coach]*E.CFG.TRAIN[c.training].gain) - E.CFG.TRAINING.FLOOR) < 1e-9)) S.floor++; }
          E.advanceWeek(st); unsack(st);
          for (const p of sq){ if (p.club !== c.id) continue; const d = p.skill - before.get(p.id); if (d){ total += d; byPos[p.pos] += d; gains.set(p.id, (gains.get(p.id) || 0) + d); } if (p.skill > p.pot) S.over++; }
          for (const p of E.reservesOf(st, c)) if (resBefore.has(p.id)) resGain += p.skill - resBefore.get(p.id); } } }
    E.CFG.TRAIN.normal.gain = keepGain; }
  return out; }

const CHILD = flag('--child'); if (CHILD) process.stdout.write(JSON.stringify(runSetting(str('--child'))), () => process.exit(0));   // (exit only once the pipe has taken it all)

// ---------- the parent: one process a setting, then the report ----------
const keys = QUICK? ['H3'] : ['N1', 'N3', 'H3'];
const jobs = CHILD? [new Promise(() => {})] : keys.map(k => new Promise((res, rej) => { const ch = cp.spawn(process.execPath, [__filename, '--child', k].concat(args), { stdio: ['ignore', 'pipe', 'inherit'] }); let buf = ''; ch.stdout.on('data', d => buf += d); ch.on('close', code => code? rej(new Error(k + ' exit ' + code)) : res([k, JSON.parse(buf)])); }));
const mean = a => { const b = a.filter(x => x === x); return b.length? b.reduce((x, y) => x + y, 0)/b.length : NaN; }, sd = a => { const b = a.filter(x => x === x), m = mean(b); return Math.sqrt(mean(b.map(x => (x - m)*(x - m)))); }, se = a => sd(a)/Math.sqrt(Math.max(1, a.filter(x => x === x).length));
const pct = (a, q) => { const b = a.filter(x => x === x).sort((x, y) => x - y); return b.length? b[Math.min(b.length - 1, Math.floor(q*b.length))] : NaN; }, max = a => a.filter(x => x === x).reduce((x, y) => Math.max(x, y), -Infinity);
const f = (x, n = 1) => x === x? x.toFixed(n) : 'n/a', sgn = (x, n = 1) => (x >= 0? '+' : '') + f(x, n);
const all = (R, key, from = 0, to = 99) => [].concat(...R.seasons.slice(from, to).map(S => S[key]));
let miss = 0; const target = (name, okk, text) => { if (!okk) miss++; console.log((okk? 'MET   ' : 'MISS  ') + name + ': ' + text); };

Promise.all(jobs).then(list => { const D = Object.fromEntries(list); const E = tune(require(path.join(__dirname, '..', 'engine.js'))), T = E.CFG.TRAINING;
  console.log(`Soccer Manager '91: the balance bench for training focus and the priority player${QUICK? ' (quick)' : ''}`);
  console.log(`club ${U} (Division 2), ${WORLDS} worlds, ${LONG} seasons for the long arms and ${SHORT} for the fixed focuses; the manager buys and sells nobody`);
  console.log(`the numbers under test: a focus gives its group x${T.FOCUS.DEF} (goalkeepers x${T.FOCUS.GK}) at a cost of ${T.COST*100}% of the total; the priority player x${T.PRIORITY}, ${T.PRIORITY_FIT} fitness a week, rested under ${T.FIT_MIN}; floor ${T.FLOOR}; ceiling ${T.CAP} a week`);
  for (const k of keys){ const A = D[k], B = A.balanced; console.log(`\n=== ${SETTINGS[k][2]} ===`);
    console.log('1. Skill gained in weekly training, the whole squad, a season (first ' + SHORT + ' seasons), and by group');
    for (const arm of ARMS){ const R = A[arm]; if (!R) continue; const g = all(R, 'gain', 0, SHORT), b = all(B, 'gain', 0, SHORT);
      console.log(`   ${arm.padEnd(9)} ${f(mean(g)).padStart(5)} (${f(se(g), 2)})  ${(arm === 'balanced' || arm === 'none'? '' : f(100*mean(g)/mean(b), 0) + '% of balanced').padEnd(18)} ${POS.map(p => p + ' ' + f(mean([].concat(...R.seasons.slice(0, SHORT).map(S => S.byPos[p])))).padStart(4)).join('  ')}   youth team ${f(mean(all(R, 'res', 0, SHORT)))}   weeks at the floor ${f(R.seasons.slice(0, SHORT).reduce((a, S) => a + S.floor, 0)/(SHORT*WORLDS), 1)}   past potential ${R.seasons.reduce((a, S) => a + S.over, 0)}`); }
    console.log('2. The best prospect (the man with most room at the start of the season): what a season of training gives him');
    for (const arm of ['balanced', 'priority', 'stack', 'eleven']){ const R = A[arm]; if (!R) continue; const g = all(R, 'pro'), v = all(R, 'proVal'), t = all(R, 'top');
      console.log(`   ${arm.padEnd(9)} skill ${sgn(mean(g))} (95 in 100 seasons: ${f(pct(g, 0.95), 0)} or fewer; most: ${f(max(g), 0)})   value x${f(mean(v), 2)} (95 in 100: x${f(pct(v, 0.95), 2)}; most x${f(max(v), 2)})   his fitness ${f(mean(all(R, 'proFit')), 0)}, under 70 for ${f(100*mean(all(R, 'proLow')), 0)}% of weeks   | the most any one player gained in a season: ${f(mean(t))} on average, ${f(max(t), 0)} at most`); }
    console.log('3. The first eleven at the end of each season (average skill), and the average computer club of the same division');
    for (const arm of LONG_ARMS){ const R = A[arm]; if (!R) continue; console.log(`   ${arm.padEnd(9)} ${R.seasons.map(S => f(mean(S.xi)).padStart(5)).join(' ')}`); }
    console.log(`   ${'(division)'.padEnd(9)} ${B.seasons.map(S => f(mean(S.xiDiv)).padStart(5)).join(' ')}`);
    console.log('4. League points a season, and the average division the club is in');
    for (const arm of LONG_ARMS){ const R = A[arm]; if (!R) continue; console.log(`   ${arm.padEnd(9)} ${R.seasons.map(S => f(mean(S.pts)).padStart(5)).join(' ')}   all seasons ${f(mean(all(R, 'pts')))} (${f(se(all(R, 'pts')), 1)})   division ${R.seasons.map(S => f(mean(S.div))).join(' ')}`); } }

  console.log('\n=== The targets ===');
  const lo = QUICK? 0.75 : 0.90, hi = QUICK? 1.12 : 1.00, trick = { today: 1, now: 1, where: '' };
  for (const k of keys){ if (k === 'N3' && !QUICK) continue; const A = D[k], b = mean(all(A.balanced, 'gain', 0, SHORT)), name = SETTINGS[k][2];
    const ratios = ARMS.filter(a => a !== 'balanced' && a !== 'none' && A[a]).map(a => [a, mean(all(A[a], 'gain', 0, SHORT))/b]);
    const noise = Math.sqrt(2)*se(all(A.balanced, 'gain', 0, SHORT))/b; target('T2 nothing is added (' + name + ')', ratios.every(r => r[1] <= (QUICK? hi : 1 + 2*noise)) && ratios.filter(r => POS.includes(r[0])).every(r => r[1] >= lo - 2*noise), ratios.map(r => r[0] + ' ' + f(100*r[1], 0) + '%').join(', ') + ' of balanced (each good to about ' + f(100*Math.sqrt(2)*se(all(A.balanced, 'gain', 0, SHORT))/b, 0) + ' points)');
    const resp = POS.filter(p => A[p]).map(p => { const own = mean([].concat(...A[p].seasons.slice(0, SHORT).map(S => S.byPos[p])))/mean([].concat(...A.balanced.seasons.slice(0, SHORT).map(S => S.byPos[p]))); const oth = POS.filter(q => q !== p).map(q => mean([].concat(...A[p].seasons.slice(0, SHORT).map(S => S.byPos[q])))/mean([].concat(...A.balanced.seasons.slice(0, SHORT).map(S => S.byPos[q])))); return [p, own, Math.min(...oth), oth.reduce((x, y) => x + y, 0)/oth.length]; });
    if (resp.length) target('T3 each group responds: its own group at least +40%, no other more than -35% (' + name + ')', resp.every(r => r[1] >= (QUICK? 1.1 : 1.40)) && resp.every(r => r[2] >= (QUICK? 0.4 : 0.65)), resp.map(r => `${r[0]}: own group ${sgn(100*(r[1] - 1), 0)}%, the others ${sgn(100*(r[3] - 1), 0)}% (worst ${sgn(100*(r[2] - 1), 0)}%)`).join('; '));
    const dXI = A.balanced.seasons.map((S, i) => mean(A.eleven.seasons[i].xi) - mean(S.xi)), dMax = Math.max(...dXI), dMean = mean(dXI);
    target('T4 no runaway: never more than one skill point a man over balanced (' + name + ')', dMax <= (QUICK? 2 : 1.0), `every lever for the first eleven against balanced: first eleven ${dXI.map(x => sgn(x)).join(' ')} skill a man by season (most ${sgn(dMax)}, average ${sgn(dMean)})`);
    const ptsD = mean(all(A.eleven, 'pts')) - mean(all(A.balanced, 'pts')), ptsSE = Math.sqrt(se(all(A.eleven, 'pts'))**2 + se(all(A.balanced, 'pts'))**2);
    target('T5 worth 0.1 to 0.5 league points a season over balanced (' + name + ')', QUICK? dMean*1.4 <= 1.5 : (dMean*1.4 <= 0.5 && dMean*1.4 >= 0.1), `by the skill it adds, about ${sgn(dMean*1.4, 2)} league points a season (1.4 points for a skill point on every man); counted directly ${sgn(ptsD)} (good to about ${f(ptsSE)})`);
    const over = Object.values(A).reduce((a, R) => a + R.seasons.reduce((x, S) => x + S.over, 0), 0);
    target('T6a nobody passes his potential (' + name + ')', over === 0, `${over} in any arm`);
    const tops = ['balanced', 'priority', 'stack'].map(a => max(all(A[a], 'top'))); target('T6b nobody gains more than eight points in a season from training (' + name + ')', QUICK? true : Math.max(tops[1], tops[2]) <= 8, `the most one player gained in a season: ${f(tops[0], 0)} as the game is, ${f(tops[1], 0)} as the priority player, ${f(tops[2], 0)} with his group's focus as well`);
    const vS = mean(all(A.stack, 'proVal')), vB = mean(all(A.balanced, 'proVal')), vP = mean(all(A.priority, 'proVal'));
    trick.today = Math.max(trick.today, vB); if (Math.max(vS, vP) > trick.now){ trick.now = Math.max(vS, vP); trick.where = name; } console.log('      T7, this setting (' + name + '):', `a season adds ${f(100*(vB - 1), 0)}% to the best prospect's value as the game is, ${f(100*(vP - 1), 0)}% as the priority player, ${f(100*(vS - 1), 0)}% with his group's focus as well`);
    const res = ARMS.filter(a => A[a]).map(a => mean(all(A[a], 'res', 0, SHORT)));
    target('T8 the youth team is untouched (' + name + ')', Math.max(...res) - Math.min(...res) <= (QUICK? 3 : 1.5), `its gain a season across the arms: ${f(Math.min(...res))} to ${f(Math.max(...res))}`); }
  target('T7 the best prospect, trained with every lever for a season, gains no more than 15% above the best that can be done today', (trick.now - 1)/(trick.today - 1) <= (QUICK? 3 : 1.15), `today's most, with the settings that train hardest: +${f(100*(trick.today - 1), 0)}% of his value in a season; with every lever: +${f(100*(trick.now - 1), 0)}% (${trick.where}); that is ${f(100*((trick.now - 1)/(trick.today - 1) - 1), 0)}% more`);
  console.log(miss? `\n${miss} target${miss > 1? 's' : ''} missed` : '\nevery target met');
  process.exit(0); }).catch(e => { console.error(e); process.exit(2); });
