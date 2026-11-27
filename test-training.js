'use strict';
// Training focus and the priority player (Milestone 2, slice 1: the rules, no screens).
//
// What this suite holds the engine to:
//   1. A club with no focus and no priority player trains exactly as in 1.8.0: every match, and the whole game state.
//   2. With the new rules switched off, a focus and a priority player are ignored and the engine is 1.8.0 exactly.
//   3. A focus moves training and never adds to it: every week the squad's total chance of improving is the old total,
//      less the cost of a focus, to the last decimal place; no man's chance is over the ceiling; nobody past improving gains.
//   4. Only the four groups and a first-team player of one's own get in; a player who leaves stops being the priority.
//   5. The priority player's extra sessions cost him one point of recovery a week, only while he is fit enough for them.
//   6. The same seed and the same choices give the same seasons.
//   7. Each hot-seat manager's choices are his own club's; a new job starts with none.
//   8. Saves stay at format 4 and go both ways with the 1.8.0 and 1.7.1 engines, the choices intact on the way back.
//   9. The quick balance bench (tools/training-balance.js) meets its targets.
const path = require('path'), cp = require('child_process');
const fresh = f => { delete require.cache[require.resolve(f)]; return require(f); };
const E180 = require('./legacy/engine.v180.js'), E171 = require('./legacy/engine.v171.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c){ fails++; console.log('FAIL', m); } };
const sig = m => [m.home.id, m.away.id, m.gH, m.gA, m.extra, m.att, m.xgH, m.xgA, m.poss, m.scorers.map(s => s.side + s.p.id + '@' + s.min + (s.et? 'e' : '')).join(','), m.cards.map(c => c.side + c.p.id + c.type + c.min).join(','), m.injuries.map(p => p.id + ':' + p.injury).join(',')].join('|');
const unsack = s => { if (s.gameOver){ s.gameOver = null; s.sackOffer = null; } };
// the whole game state, but for the game's random id and the record of training gains (a record only: part 1b holds it to the truth)
const strip = s => JSON.stringify(s, (k, v) => k === 'trainLog'? undefined : k === 'gameId'? 'x' : v);
const same = (a, b) => strip(a) === strip(b);
const young = (E, st, c) => E.squadOf(st, c).filter(p => E.canImprove(p));

// ---- 1. nothing chosen: the 1.8.0 engine exactly ----
{
  const E = fresh('./engine.js'); let matches = 0, differ = 0, states = 0, worlds = 0;
  for (const opts of [{ seed: 11, userClub: 20 }, { seed: 22, userClub: 3 }, { seed: 33, userClub: 60 }, { seed: 1991, userClub: 20 }, { seed: 5, managers: ['Ann', 'Bob', 'Cy'] }]){
    const a = E.newGame(opts), b = E180.newGame(opts); worlds++;
    if (opts.userClub !== undefined){ E.setTraining(a, 'hard'); E180.setTraining(b, 'hard'); E.setStaff(a, 'coach', 3); E180.setStaff(b, 'coach', 3); }   // the settings that train most
    for (let w = 0; w < 84; w++){ const ra = E.advanceWeek(a), rb = E180.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < Math.max(ra.length, rb.length); i++){ matches++; if (!ra[i] || !rb[i] || sig(ra[i]) !== sig(rb[i])) differ++; } }
    if (same(a, b)) states++;
    ok(a.clubs.every(c => !('focus' in c) && !('priority' in c)), 'nothing chosen: no club has a focus or a priority player written into it');
    ok(a.clubs.every(c => !c.trainLog || a.managers? true : c.id === a.userClub) && a.clubs.filter(c => c.trainLog).length <= (a.managers? a.managers.length : 1), 'only a manager\'s club keeps a record of training gains');
  }
  ok(differ === 0, `nothing chosen: ${differ} of ${matches} matches differ from the 1.8.0 engine`); ok(states === worlds, `nothing chosen: the whole game state is identical to 1.8.0 after two seasons in ${states} of ${worlds} worlds`);
  console.log(`nothing chosen: ${matches} matches over ${worlds} two-season worlds (one of them a three-manager hot-seat) identical to the 1.8.0 engine, and so is the whole game state`);
}

// ---- 1b. the record of training gains is the truth: every point gained in the week, by player and by group, and nothing else ----
{
  const E = fresh('./engine.js'); let weeks = 0, wrong = 0, points = 0, rolled = 0;
  for (const [seed, focus] of [[41, null], [42, 'DEF'], [43, 'GK']]){ const st = E.newGame({ seed, userClub: 20 }); E.setTraining(st, 'hard'); E.setStaff(st, 'coach', 3); E.setFocus(st, focus); if (focus) E.setPriority(st, young(E, st, st.clubs[20])[0].id);
    for (let s = 0; s < 3; s++){ const season = st.season, mine = {}, pos = { GK: 0, DEF: 0, MID: 0, FWD: 0 }; let n = 0;
      while (st.season === season){ const c = st.clubs[st.userClub], sq = E.squadOf(st, c), before = new Map(sq.map(p => [p.id, p.skill])), last = st.week >= E.CFG.WEEKS;
        if (last){ const rec = E.trainingRecord(st, c).now; E.advanceWeek(st); unsack(st); const after = E.trainingRecord(st, st.clubs[st.userClub]); if (after.now.n === 0 && after.last && after.last.s === season && after.last.n >= rec.n) rolled++; break; }
        E.advanceWeek(st); unsack(st); for (const p of sq){ const d = p.skill - before.get(p.id); if (d > 0){ mine[p.id] = (mine[p.id] || 0) + d; pos[p.pos] += d; n += d; } }
        const rec = E.trainingRecord(st, c).now; weeks++; points = Math.max(points, n);
        if (rec.n !== n || JSON.stringify(rec.pos) !== JSON.stringify(pos) || Object.keys(mine).some(id => rec.g[id] !== mine[id]) || Object.keys(rec.g).length !== Object.keys(mine).length) wrong++; } } }
  ok(wrong === 0 && weeks > 300 && points > 15, `the record agrees with the skill really gained, player by player and group by group, in every week (${wrong} wrong of ${weeks}; up to ${points} points in a season)`);
  ok(rolled === 9, `and at a season's end it becomes "last season" and a new one starts empty (${rolled} of 9)`);
  const st = E.newGame({ seed: 44, userClub: 20 }); ok(E.trainingRecord(st, st.clubs[20]).now.n === 0 && E.trainingRecord(st, st.clubs[20]).last === null && !('trainLog' in st.clubs[20]), 'a new game has an empty record and nothing written');
  console.log(`the record of training gains: ${weeks} weeks over nine seasons, exact for every player and every group`);
}

// ---- 2. the rules switched off: a focus and a priority player are ignored ----
{
  const E = fresh('./engine.js'); E.CFG.TRAINING.on = false; let matches = 0, differ = 0, states = 0;
  for (const seed of [11, 22]){
    const a = E.newGame({ seed, userClub: 20 }), b = E180.newGame({ seed, userClub: 20 }); const pr = young(E, a, a.clubs[20])[0];
    E.setFocus(a, 'DEF'); E.setPriority(a, pr.id); ok(a.clubs[20].focus === 'DEF' && a.clubs[20].priority === pr.id && E.focusOf(a.clubs[20]) === null && E.priorityOf(a, a.clubs[20]) === null && E.trainingShare(a, a.clubs[20]) === null, 'rules off: the choices are kept but count for nothing');
    for (let w = 0; w < 84; w++){ const ra = E.advanceWeek(a), rb = E180.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < Math.max(ra.length, rb.length); i++){ matches++; if (!ra[i] || !rb[i] || sig(ra[i]) !== sig(rb[i])) differ++; } }
    ok(!a.clubs.some(c => c.trainLog), 'rules off: no record of training gains is written'); delete a.clubs[20].focus; delete a.clubs[20].priority; { const x = a.gameId; a.gameId = b.gameId; if (JSON.stringify(a) === JSON.stringify(b)) states++; a.gameId = x; }
  }
  ok(differ === 0, `rules off: ${differ} of ${matches} matches differ from the 1.8.0 engine`); ok(states === 2, `rules off: the game state is identical to 1.8.0 but for the two unused fields in ${states} of 2 worlds`);
  console.log(`rules off: ${matches} matches with a focus and a priority player set and ignored, identical to the 1.8.0 engine`);
}

// ---- 3. a focus moves training and never adds to it ----
{
  const E = fresh('./engine.js'), T = E.CFG.TRAINING; let weeks = 0, worst = 0, capped = 0, over = 0, wasted = 0, up = 0, down = 0, floored = 0;
  for (const seed of [7, 8, 9, 10]) for (const intensity of ['light', 'normal', 'hard']) for (const coach of [0, 1, 2, 3]){
    const st = E.newGame({ seed: seed*100 + coach, userClub: 20 }); E.setTraining(st, intensity); E.setStaff(st, 'coach', coach);
    for (let w = 0; w < 30; w++){ const c = st.clubs[st.userClub], sq = E.squadOf(st, c), el = sq.filter(p => E.canImprove(p)); const base = E.CFG.TRAIN_BASE*E.CFG.COACH_MULT[coach]*E.CFG.TRAIN[intensity].gain;
      for (const focus of [null, 'GK', 'DEF', 'MID', 'FWD']) for (const withPri of [false, true]){ if (!focus && !withPri){ ok(E.trainingShare(st, c) === null && el.every(p => E.trainingChance(st, c, p) === base), 'nothing chosen: every man who can improve has the old chance, exactly'); continue; }
        E.setFocus(st, focus); E.setPriority(st, withPri && el.length? el[(w + seed) % el.length].id : null); const pri = E.priorityOf(st, c);
        const ch = sq.map(p => E.trainingChance(st, c, p)), total = ch.reduce((a, b) => a + b, 0), want = el.length*base*(focus? 1 - T.COST : 1), hitCap = ch.some(x => x >= T.CAP - 1e-12);
        weeks++; if (hitCap) capped++; else worst = Math.max(worst, Math.abs(total - want)/Math.max(1e-9, want));
        if (hitCap && total > want + 1e-12) over++; if (ch.some(x => x > T.CAP + 1e-12)) over++;
        if (sq.some((p, i) => !E.canImprove(p) && ch[i] !== 0)) wasted++;
        // the favoured men have their stated multiples and everybody else one equal, smaller chance; or, where that would leave the rest under the floor, the rest have the floor
        if (!hitCap && el.length){ const fit = pri && E.canImprove(pri) && pri.fitness >= T.FIT_MIN, mult = p => (focus && p.pos === focus? T.FOCUS[focus] : 1)*(fit && p.id === pri.id? T.PRIORITY : 1), favd = el.filter(p => mult(p) > 1), rest = el.filter(p => mult(p) === 1);
          if (favd.length && rest.length){ const o = E.trainingChance(st, c, rest[0])/base; ok(rest.every(p => Math.abs(E.trainingChance(st, c, p)/base - o) < 1e-12) && o <= 1 + 1e-12 && o >= T.FLOOR - 1e-12, 'everybody not favoured has one equal chance, no more than before and never under the floor (' + o.toFixed(3) + ')');
            if (o > T.FLOOR + 1e-9){ ok(favd.every(p => Math.abs(E.trainingChance(st, c, p)/base - mult(p)) < 1e-12), 'a favoured man has exactly his stated multiple of the old chance'); up++; if (o < 1 - 1e-9) down++; } else { floored++; ok(favd.every(p => E.trainingChance(st, c, p)/base <= mult(p) + 1e-12 && E.trainingChance(st, c, p) >= E.trainingChance(st, c, rest[0]) - 1e-15), 'at the floor the favoured men are scaled down, never up, and never below the rest'); } }
          if (!favd.length) ok(el.every(p => Math.abs(E.trainingChance(st, c, p)/base - (focus? 1 - T.COST : 1)) < 1e-12), 'a focus on a group with nobody to coach costs everybody the 5% and gives nothing; a rested priority player changes nothing'); } }
      E.setFocus(st, null); E.setPriority(st, null); E.advanceWeek(st); unsack(st); } }
  ok(worst < 1e-12, `the squad's total chance is the old total (less 5% under a focus) to the last decimal place: worst miss ${worst.toExponential(1)} over ${weeks - capped} squad-weeks`);
  ok(over === 0, `where the ceiling binds the total is lower, never higher, and no man is over ${T.CAP}: ${over} breaches in ${capped} capped squad-weeks`);
  ok(wasted === 0, 'an injured man, a man of 30 and a man at his potential have no chance at all, whatever is chosen');
  ok(up > 500 && down > 500 && floored > 0, `a choice raises the favoured men and lowers the rest (${up} and ${down} squad-weeks; the floor reached in ${floored})`);
  console.log(`a choice moves training and never adds to it: ${weeks} squad-weeks at every intensity, coach, focus and with and without a priority player; total exact in ${weeks - capped}, held under by the ceiling in ${capped}`);
}

// ---- 4. only the four groups and one's own first-team player get in ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 4, userClub: 20 }), c = st.clubs[20], other = st.clubs[21];
  for (const bad of ['ATT', 'def', '', 0, 1, null, undefined, {}, 'Balanced']){ E.setFocus(st, 'MID'); E.setFocus(st, bad); ok(!('focus' in c), 'a focus that is not one of the four clears it: ' + JSON.stringify(bad)); }
  for (const g of E.FOCUS_KEYS){ E.setFocus(st, g); ok(c.focus === g && E.focusOf(c) === g, 'focus ' + g); } E.setFocus(st, null);
  E.setPriority(st, other.players[0]); ok(!('priority' in c), 'another club\'s player cannot be the priority');
  E.setPriority(st, 999999); ok(!('priority' in c), 'nor a player who does not exist');
  c.balance = 5e6; E.upgradeAcademy(st); for (let w = 0; w < 100 && !E.reservesOf(st, c).length; w++){ E.advanceWeek(st); unsack(st); }   // the youth intake comes with a new season, once there is an academy to take it
  const res = E.reservesOf(st, c)[0]; if (res){ E.setPriority(st, res.id); ok(!('priority' in c), 'nor a reserve: the youth team has its own rule'); } ok(!!res, 'the club has a reserve to try it with');
  const p = E.squadOf(st, c)[5]; E.setPriority(st, p.id); ok(c.priority === p.id && E.priorityOf(st, c) === p, 'a first-team player of one\'s own can');
  const q = E.squadOf(st, c)[6]; E.setPriority(st, q.id); ok(c.priority === q.id, 'naming another replaces him: there is one priority player');
  E.releasePlayer(st, q.id); ok(E.priorityOf(st, c) === null, 'a released player counts for nothing at once'); E.advanceWeek(st); ok(!('priority' in c), 'and the choice is cleared at the next training');
  // a computer club is never trained in the week, whatever is written into it
  const E2 = fresh('./engine.js'); const a = E2.newGame({ seed: 4, userClub: 20 }), b = E180.newGame({ seed: 4, userClub: 20 }); a.clubs[30].focus = 'DEF'; a.clubs[30].priority = a.clubs[30].players[3];
  let differ = 0; for (let w = 0; w < 42; w++){ const ra = E2.advanceWeek(a), rb = E180.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < ra.length; i++) if (sig(ra[i]) !== sig(rb[i])) differ++; }
  ok(differ === 0, 'a computer club does not train in the week even with a focus written into it: a season identical to 1.8.0');
  console.log('only the four groups and a first-team player of one\'s own are accepted; a player who leaves stops being the priority; computer clubs are untouched');
}

// ---- 5. the priority player's fitness ----
{
  const E = fresh('./engine.js'), T = E.CFG.TRAINING; let less = 0, weeksFit = 0, rested = 0, others = 0, hurt = 0;
  for (const seed of [31, 32, 33]){
    const a = E.newGame({ seed, userClub: 20 }), b = E.newGame({ seed, userClub: 20 }); const pr = young(E, a, a.clubs[20])[2]; E.setPriority(a, pr.id); a.players[pr.id].fitness = b.players[pr.id].fitness = 85;   // so that the ceiling of 100 cannot hide the point
    // week 1: before any training has been drawn the two worlds are the same world, so only his fitness may differ
    E.advanceWeek(a); E.advanceWeek(b); const pa = a.players[pr.id], pb = b.players[pr.id];
    for (const id of a.clubs[20].players) if (id !== pr.id && a.players[id].fitness !== b.players[id].fitness) others++;
    if (pb.injury > 0){ if (pa.fitness !== pb.fitness) hurt++; } else { weeksFit++; if (pa.fitness === pb.fitness - T.PRIORITY_FIT) less++; }
    // a tired man is rested: no extra sessions, no cost
    const c = E.newGame({ seed, userClub: 20 }), d = E.newGame({ seed, userClub: 20 }); E.setPriority(c, pr.id); c.players[pr.id].fitness = d.players[pr.id].fitness = 40; c.clubs[20].xi = d.clubs[20].xi = null;
    E.advanceWeek(c); E.advanceWeek(d); if (c.players[pr.id].fitness === d.players[pr.id].fitness && c.players[pr.id].fitness < T.FIT_MIN) rested++;
  }
  ok(others === 0, 'naming a priority player changes nobody else\'s fitness'); ok(hurt === 0, 'an injured priority player pays nothing');
  ok(weeksFit > 0 && less === weeksFit, `the priority player recovers one point less in a week of extra sessions (${less} of ${weeksFit})`);
  ok(rested === 3, `under ${T.FIT_MIN} fitness he is rested and it costs him nothing (${rested} of 3)`);
  console.log('the priority player recovers one point of fitness less in a week of extra sessions, and nothing is charged while he is injured or rested');
}

// ---- 6. the same seed and the same choices give the same seasons; a choice changes them ----
{
  const E = fresh('./engine.js'); const run = (focus, pri) => { const st = E.newGame({ seed: 77, userClub: 20 }); E.setTraining(st, 'hard'); E.setStaff(st, 'coach', 3); E.setFocus(st, focus); if (pri) E.setPriority(st, young(E, st, st.clubs[20])[0].id); const out = []; for (let w = 0; w < 84; w++){ for (const m of E.advanceWeek(st)) out.push(sig(m)); unsack(st); } st.gameId = 'x'; return out.join('\n') + JSON.stringify(st); };
  const a = run('MID', true), b = run('MID', true), c = run(null, false), d = run('DEF', true);
  ok(a === b, 'the same seed and the same choices give the same two seasons and the same game state'); ok(a !== c && a !== d, 'and a different choice gives a different game');
  console.log('the same seed and choices give the same two seasons');
}

// ---- 7. hot-seat: each manager's choices are his own club's; a new job starts with none ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 5, managers: ['Ann', 'Bob', 'Cy'] }); const [ca, cb, cc] = st.managers.map(m => m.userClub);
  E.withManager(st, 0, s => { E.setFocus(s, 'DEF'); E.setPriority(s, young(E, s, s.clubs[ca])[0].id); }); E.withManager(st, 2, s => E.setFocus(s, 'FWD'));
  ok(st.clubs[ca].focus === 'DEF' && st.clubs[ca].priority != null && !('focus' in st.clubs[cb]) && !('priority' in st.clubs[cb]) && st.clubs[cc].focus === 'FWD' && !('priority' in st.clubs[cc]), 'each manager\'s focus and priority player are on his own club and nobody else\'s');
  for (let w = 0; w < 20; w++){ E.advanceWeek(st); unsack(st); }
  ok(st.clubs[ca].focus === 'DEF' && !('focus' in st.clubs[cb]) && st.clubs[cc].focus === 'FWD', 'and they stay there as the weeks are played');
  E.withManager(st, 1, s => ok(E.trainingShare(s, s.clubs[cb]) === null, 'the manager who chose nothing trains by the old rule'));
  const back = E.restore(JSON.parse(JSON.stringify(st))); ok(back.clubs[ca].focus === 'DEF' && back.clubs[ca].priority === st.clubs[ca].priority && back.clubs[cc].focus === 'FWD' && E.SAVE_VERSION === 4, 'a hot-seat save in format 4 keeps each manager\'s choices');
  // a new job: the line of code that resets Light, Normal, Hard also clears these
  const src = require('fs').readFileSync(path.join(__dirname, 'engine.js'), 'utf8'); ok(/c\.training = 'normal'; delete c\.focus; delete c\.priority;/.test(src), 'taking a new job clears the focus and the priority player with the training level');
  console.log('hot-seat: three managers, each with his own focus and priority player or none; a new job starts with none');
}

// ---- 8. saves: format 4, both ways with the 1.8.0 and 1.7.1 engines ----
{
  const E = fresh('./engine.js'); ok(E.SAVE_VERSION === 4 && E180.SAVE_VERSION === 4, 'the save format is still 4');
  // a 1.8.0 save carries on in this engine exactly as it would have in 1.8.0
  const old = E180.newGame({ seed: 61, userClub: 20 }); for (let w = 0; w < 10; w++) E180.advanceWeek(old); const a = E.restore(JSON.parse(JSON.stringify(old))), b = E180.restore(JSON.parse(JSON.stringify(old)));
  E.seedRng(4321); const ra = []; for (let w = 0; w < 20; w++){ for (const m of E.advanceWeek(a)) ra.push(sig(m)); unsack(a); } E180.seedRng(4321); const rb = []; for (let w = 0; w < 20; w++){ for (const m of E180.advanceWeek(b)) rb.push(sig(m)); unsack(b); }
  ok(ra.length > 100 && ra.join() === rb.join() && same(a, b), 'a 1.8.0 save carries on here exactly as it would have under 1.8.0: 20 weeks, every match and the game state');
  ok(!('focus' in a.clubs[20]) && E.trainingShare(a, a.clubs[20]) === null, 'a 1.8.0 save opens with nothing chosen and nothing written into it');
  for (const [name, Old] of [['1.8.0', E180], ['1.7.1', E171]]){
    const st = E.newGame({ seed: 62, userClub: 20 }); E.setFocus(st, 'MID'); const pr = young(E, st, st.clubs[20])[1]; E.setPriority(st, pr.id); E.setTactics(st, 'p', 1); for (let w = 0; w < 6; w++){ E.advanceWeek(st); unsack(st); }
    let o = Old.restore(JSON.parse(JSON.stringify(st))); let played = 0; for (let w = 0; w < 8; w++){ played += Old.advanceWeek(o).length; unsack(o); } o = JSON.parse(JSON.stringify(o));
    ok(played > 0 && o.week === st.week + 8, `a save with a focus and a priority player opens in the ${name} engine and plays on`);
    const back = E.restore(o); ok(back.clubs[20].focus === 'MID' && back.clubs[20].priority === pr.id && E.focusOf(back.clubs[20]) === 'MID', `and comes back from ${name} with the choices as they were`); E.advanceWeek(back); ok(back.week === st.week + 9, 'and plays on here');
  }
  console.log('saves: format 4; a 1.8.0 save opens with nothing chosen; a save with choices plays on in the 1.8.0 and 1.7.1 engines and comes back with them intact');
}

// ---- 9. the quick balance bench ----
{
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'tools', 'training-balance.js'), '--quick'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + (r.stderr || ''), miss = out.split('\n').filter(l => /^MISS/.test(l));
  ok(r.status === 0 && miss.length === 0, 'the quick balance bench meets its targets: ' + (miss.join(' | ') || out.split('\n').slice(-3).join(' ')));
  console.log('the quick balance bench: ' + (out.trim().split('\n').pop() || ''));
}

console.log(`${checks} checks, ${fails} failures`);
console.log(fails? 'TRAINING TESTS FAILED' : 'TRAINING TESTS OK');
process.exit(fails? 1 : 0);
