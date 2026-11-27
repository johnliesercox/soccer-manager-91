'use strict';
// Position retraining (Milestone 2, slice 3a: the rules, no screens).
//
// What this suite holds the engine to:
//   1. With nobody retrained the game is exactly the game before this slice: every match and the whole saved game.
//   2. With the rules switched off, second positions and courses are ignored and the game is the game before this slice.
//   3. What a man is worth: his own position always his best, a learned one 95% in the next line and 90% in the far line (as John
//      approved on the measured results, 27 November 2026), never less than he was worth before, goalkeepers apart.
//   4. Who may learn what: outfield players, another outfield position, one at a time; a goalkeeper nothing, nobody goalkeeper.
//   5. How long it takes: every row of the approved table, exactly, and the same with Light and Hard; no random number drawn.
//   6. Interruptions: an injury, low fitness, a pause and a change of intensity; work kept towards the same position, abandoned on a change of target.
//   7. All or nothing: worth what he was until the last week, then 95% or 90% for good; a second course replaces the first only when it finishes.
//   8. The trade-off: a learner has his ordinary chance of improving and nobody else's changes; the fitness cost is the priority player's.
//   9. No skill, potential, value or wage is touched, and the summer (ageing, decline, retirement) does not know of it.
//  10. Computer clubs never retrain; one fields a retrained man at what he has learned.
//  11. Hot-seat, a new job, the same seed; saves in format 4 both ways with the 1.8.0 and 1.7.1 engines.
//  12. The quick balance bench (tools/retraining-balance.js).
const path = require('path'), cp = require('child_process');
const fresh = f => { delete require.cache[require.resolve(f)]; return require(f); };
const EB = require('./legacy/engine.training2.js'), E180 = require('./legacy/engine.v180.js'), E171 = require('./legacy/engine.v171.js');   // the game before this slice, 1.8.0, 1.7.1
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c){ fails++; console.log('FAIL', m); } };
const sig = m => [m.home.id, m.away.id, m.gH, m.gA, m.extra, m.att, m.xgH, m.xgA, m.poss, m.scorers.map(s => s.side + s.p.id + '@' + s.min + (s.et? 'e' : '')).join(','), m.cards.map(c => c.side + c.p.id + c.type + c.min).join(','), m.injuries.map(p => p.id + ':' + p.injury).join(',')].join('|');
const unsack = s => { if (s.gameOver){ s.gameOver = null; s.sackOffer = null; } };
const whole = s => JSON.stringify(s, (k, v) => k === 'gameId'? 'x' : v);
const outfield = (E, st, c) => E.squadOf(st, c).filter(p => p.pos !== 'GK');
const WEEKS = { near: { 20: [17, 10, 8, 7], 26: [20, 12, 10, 8], 31: [25, 15, 12, 10] }, far: { 20: [28, 17, 13, 11], 26: [34, 20, 16, 13], 31: [42, 25, 20, 16] } };   // the approved table: weeks on Normal, by the coach's grade

// ---- 1. nobody retrained: the game before this slice, exactly ----
{
  const E = fresh('./engine.js'); let matches = 0, differ = 0, states = 0, worlds = 0;
  for (const opts of [{ seed: 11, userClub: 20 }, { seed: 22, userClub: 3 }, { seed: 33, userClub: 60 }, { seed: 5, managers: ['Ann', 'Bob', 'Cy'] }]){
    const a = E.newGame(opts), b = EB.newGame(opts), c = E180.newGame(opts); worlds++;
    if (opts.userClub !== undefined) for (const [X, s] of [[E, a], [EB, b], [E180, c]]){ X.setTraining(s, 'hard'); X.setStaff(s, 'coach', 3); if (X !== E180){ X.setFocus(s, 'MID'); X.setPriority(s, X.squadOf(s, s.clubs[s.userClub]).find(p => X.canImprove(p)).id); } }   // a focus and a priority player on extra coaching, as slices 1 and 2 left them
    for (let w = 0; w < 84; w++){ const ra = E.advanceWeek(a), rb = EB.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < Math.max(ra.length, rb.length); i++){ matches++; if (!ra[i] || !rb[i] || sig(ra[i]) !== sig(rb[i])) differ++; } }
    if (whole(a) === whole(b)) states++;
    ok(Object.values(a.players).every(p => !('pos2' in p) && !('learn' in p)) && a.clubs.every(k => !('retrain' in k)), 'nobody retrained: no player has a second position or a course, and no club a course, written into him');
  }
  ok(differ === 0, `nobody retrained: ${differ} of ${matches} matches differ from the game before this slice`); ok(states === worlds, `nobody retrained: the whole saved game is identical after two seasons in ${states} of ${worlds} worlds`);
  // and with training left alone too, it is still 1.8.0 (the record of training gains apart)
  { const a = E.newGame({ seed: 44, userClub: 20 }), b = E180.newGame({ seed: 44, userClub: 20 }); let d = 0, n = 0; for (let w = 0; w < 84; w++){ const ra = E.advanceWeek(a), rb = E180.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < ra.length; i++){ n++; if (sig(ra[i]) !== sig(rb[i])) d++; } }
    const noLog = s => JSON.stringify(s, (k, v) => k === 'trainLog'? undefined : k === 'gameId'? 'x' : v); ok(d === 0 && noLog(a) === noLog(b), `nothing chosen at all: ${n} matches and the saved game identical to 1.8.0`); matches += n; }
  console.log(`nobody retrained: ${matches} matches over ${worlds + 1} two-season worlds identical to the game before this slice (and to 1.8.0 with nothing chosen), with the whole saved game`);
}

// ---- 2. the rules switched off ----
{
  const E = fresh('./engine.js'); E.CFG.RETRAIN.on = false; let matches = 0, differ = 0;
  const a = E.newGame({ seed: 12, userClub: 20 }), b = EB.newGame({ seed: 12, userClub: 20 }); const c = a.clubs[20], men = outfield(E, a, c);
  for (const p of men.slice(0, 6)) p.pos2 = p.pos === 'MID'? 'DEF' : 'MID'; men[7].learn = { to: 'FWD', done: 3 }; c.priority = men[7].id; c.retrain = 'FWD'; b.clubs[20].priority = men[7].id;   // (with the rules off the place is simply extra coaching, as the game before had it)
  ok(men.slice(0, 6).every(p => E.slotWorth(p, p.pos2) === E.posPenalty(p.pos, p.pos2)) && E.learnerOf(a, c) === null && E.setRetrain(a, men[8].id, 'DEF') === false, 'rules off: a second position is worth nothing, a course is not a course and none can be set');
  for (let w = 0; w < 84; w++){ const ra = E.advanceWeek(a), rb = EB.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < ra.length; i++){ matches++; if (sig(ra[i]) !== sig(rb[i])) differ++; } }
  ok(differ === 0, `rules off: ${differ} of ${matches} matches differ from the game before this slice, with six second positions and a course written in and ignored`);
  ok(men[7].learn && men[7].learn.done === 3 && !men[7].pos2, 'rules off: the course does not move');
  console.log(`rules off: ${matches} matches with second positions and a course written in and ignored, identical to the game before this slice`);
}

// ---- 3. what a man is worth ----
{
  const E = fresh('./engine.js'), A = E.CFG.RETRAIN.AS, POS = ['GK', 'DEF', 'MID', 'FWD']; let n = 0; const far = (a, b) => (a === 'DEF' && b === 'FWD') || (a === 'FWD' && b === 'DEF');
  ok(A.near === 0.95 && A.far === 0.90, 'a learned position is worth 95% of his skill in the next line and 90% in the far line: ' + JSON.stringify(A));
  ok(A.far < A.near && A.near < 1 && A.near > 0.85 && A.far > 0.70, 'so his own position is always his best, the next line learned is worth more than the far line learned, and each is worth more learned than not');
  for (const pos of POS) for (const pos2 of [undefined, ...POS]) for (const slot of POS){ const p = { pos, pos2, skill: 70, fitness: 100, morale: 60 }, w = E.slotWorth(p, slot), old = E.posPenalty(pos, slot); n++;
    ok(w >= old && w <= 1 && (slot === pos? w === 1 : w < 1), `${pos} with ${pos2} in ${slot}: never less than before, never more than his own position (${w})`);
    if (pos2 === slot && slot !== pos && pos !== 'GK' && slot !== 'GK') ok(w === (far(pos, slot)? 0.90 : 0.95), `${pos} who has learned ${slot} is worth ${far(pos, slot)? '90%' : '95%'} there`);
    if (pos2 !== slot) ok(w === old, `${pos} with ${pos2} in ${slot}: a position he has not learned is worth what it was`);
    if (pos === 'GK' || slot === 'GK') ok(w === old, 'goalkeepers are apart: ' + pos + ' in ' + slot);
    ok(E.effSkill(p, slot) === 70*(0.8 + 0.2)*w*(0.92 + 0.13*0.6), 'and effective skill is skill, fitness, that worth and morale, as before'); }
  console.log(`what a man is worth: ${n} combinations of position, learned position and place; his own always 1, a learned one ${A.near} (next line) or ${A.far} (far line), everything else as it was`);
}

// ---- 4. who may learn what ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 4, userClub: 20 }), c = st.clubs[20], sq = E.squadOf(st, c), gk = sq.find(p => p.pos === 'GK'), d = sq.find(p => p.pos === 'DEF'), m = sq.find(p => p.pos === 'MID'), f = sq.find(p => p.pos === 'FWD');
  for (const [p, yes, no] of [[d, ['MID', 'FWD'], ['DEF', 'GK']], [m, ['DEF', 'FWD'], ['MID', 'GK']], [f, ['MID', 'DEF'], ['FWD', 'GK']], [gk, [], ['DEF', 'MID', 'FWD', 'GK']]]){
    for (const to of yes){ ok(E.canLearn(p, to) && E.setRetrain(st, p.id, to) === true && c.priority === p.id && c.retrain === to && E.learnerOf(st, c).p === p, `a ${p.pos} can learn ${to}`); E.setPriority(st, null); }
    for (const to of no){ const before = JSON.stringify(c); ok(!E.canLearn(p, to) && E.setRetrain(st, p.id, to) === false && JSON.stringify(c) === before, `a ${p.pos} cannot learn ${to}, and asking changes nothing`); } }
  ok(E.retrainKind(d, 'MID') === 'near' && E.retrainKind(m, 'DEF') === 'near' && E.retrainKind(m, 'FWD') === 'near' && E.retrainKind(f, 'MID') === 'near' && E.retrainKind(d, 'FWD') === 'far' && E.retrainKind(f, 'DEF') === 'far', 'defence and midfield, midfield and attack are the next line; defence and attack the far line');
  for (const bad of ['ATT', '', null, undefined, 'def', 0]) ok(E.setRetrain(st, d.id, bad) === false && !('retrain' in c), 'a position that is not one of the three is refused: ' + JSON.stringify(bad));
  ok(E.setRetrain(st, st.clubs[21].players[5], 'MID') === false && E.setRetrain(st, 999999, 'MID') === false, 'another club\'s player and a player who does not exist are refused');
  d.pos2 = 'MID'; ok(!E.canLearn(d, 'MID') && E.setRetrain(st, d.id, 'MID') === false && E.canLearn(d, 'FWD'), 'a position he has already learned cannot be learned again; the other one can'); delete d.pos2;
  // one place, one job
  E.setRetrain(st, d.id, 'MID'); ok(E.priorityOf(st, c) === d && E.learnerOf(st, c) && E.coachedOf(st, c) === null, 'a learner is the priority player, and is not on extra coaching');
  E.setPriority(st, d.id); ok(E.priorityOf(st, c) === d && E.learnerOf(st, c) === null && E.coachedOf(st, c) === d && !('retrain' in c), 'choosing extra coaching for him ends the learning: the place does one job at a time');
  E.setRetrain(st, m.id, 'FWD'); ok(c.priority === m.id && c.retrain === 'FWD', 'putting another man in to learn takes the place over'); E.resetTraining(st); ok(!('priority' in c) && !('retrain' in c), 'reset to default training clears it');
  console.log('who may learn what: every outfield move and no other; one place, one job at a time');
}

// ---- 5. how long it takes: the approved table, exactly ----
{
  const E = fresh('./engine.js'); let rows = 0, wrong = 0, drawn = 0; const realRandom = Math.random;
  for (const intensity of ['light', 'normal', 'hard']) for (const coach of [0, 1, 2, 3]) for (const age of [20, 26, 31]) for (const [from, to, kind] of [['DEF', 'MID', 'near'], ['MID', 'FWD', 'near'], ['FWD', 'MID', 'near'], ['MID', 'DEF', 'near'], ['DEF', 'FWD', 'far'], ['FWD', 'DEF', 'far']]){
    const st = E.newGame({ seed: 500 + coach, userClub: 20 }), c = st.clubs[20]; E.setTraining(st, intensity); E.setStaff(st, 'coach', coach); const p = E.squadOf(st, c).find(x => x.pos === from); p.age = age; p.fitness = 100; p.injury = 0; p.value = E.valueFor(p);
    const skill = p.skill, pot = p.pot, value = p.value, wage = p.wage; ok(E.setRetrain(st, p.id, to), 'set'); const said = E.retrainWeeks(c, p, to), saidLeft = E.learnerOf(st, c).weeksLeft;
    Math.random = () => { drawn++; return realRandom(); }; let weeks = 0, left = []; while (!p.pos2 && weeks < 200){ left.push(E.learnerOf(st, c).weeksLeft); E.retrainWeek(st, c); weeks++; } Math.random = realRandom;
    const want = intensity === 'normal'? WEEKS[kind][age][coach] : Math.ceil(E.CFG.RETRAIN.WORK[kind]/(E.CFG.RETRAIN.COACH[coach]*(age <= 23? 1.2 : age <= 29? 1 : 0.8)*E.CFG.RETRAIN.PACE[intensity]) - 1e-9); rows++;
    if (weeks !== want || said !== want || saidLeft !== want || p.pos2 !== to || left.some((x, i) => x !== want - i)) { wrong++; if (wrong < 4) console.log('  ', intensity, coach, age, from, to, 'took', weeks, 'said', said, 'want', want); }
    ok(p.skill === skill && p.pot === pot && p.value === value && p.wage === wage && E.valueFor(p) === value, 'the course leaves his skill, potential, value and wage alone'); ok(!('learn' in p) && !('retrain' in c) && !('priority' in c), 'when it is done the course is cleared and the place is free'); }
  ok(wrong === 0, `every course takes exactly the weeks of the table, and the count of weeks left is right in every week (${wrong} wrong of ${rows})`);
  ok(WEEKS.near[26][1] === 12 && WEEKS.far[26][1] === 20, 'the starting figures are 12 weeks for the next line and 20 for the far line');
  ok(drawn === 0, `no random number is drawn for a course (${drawn})`);
  const E2 = fresh('./engine.js'), st = E2.newGame({ seed: 9, userClub: 20 }), c = st.clubs[20], p = E2.squadOf(st, c).find(x => x.pos === 'DEF'); p.age = 26; E2.setRetrain(st, p.id, 'MID'); E2.retrainWeek(st, c);
  console.log(`how long it takes: ${rows} courses (three intensities, four coaches, three ages, six moves), each exactly the weeks it should be, with no luck in it`);
}

// ---- 6. interruptions ----
{
  const E = fresh('./engine.js'); const mk = (to = 'MID', from = 'DEF') => { const st = E.newGame({ seed: 61, userClub: 20 }), c = st.clubs[20], p = E.squadOf(st, c).find(x => x.pos === from); p.age = 26; p.fitness = 100; p.injury = 0; E.setRetrain(st, p.id, to); return { st, c, p }; };
  const wk = (o, n = 1) => { for (let i = 0; i < n; i++) E.retrainWeek(o.st, o.c); };
  { const o = mk(); wk(o, 5); ok(o.p.learn.done === 5, 'five weeks: five weeks of work'); o.p.injury = 3; wk(o, 3); ok(o.p.learn.done === 5 && E.learnerOf(o.st, o.c).working === false && E.learnerOf(o.st, o.c).weeksLeft === 7, 'three weeks injured: nothing added, nothing lost, still seven to go'); o.p.injury = 0; wk(o, 6); ok(!o.p.pos2 && o.p.learn.done === 11, 'six more: eleven'); wk(o); ok(o.p.pos2 === 'MID', 'and the twelfth week of work finishes it: 15 weeks on the calendar'); }
  { const o = mk(); wk(o, 4); o.p.fitness = 69; wk(o, 5); ok(o.p.learn.done === 4, 'under 70 fitness he is rested: the weeks do not count'); o.p.fitness = 70; wk(o); ok(o.p.learn.done === 5, 'at 70 they count again'); }
  { const o = mk(), other = E.squadOf(o.st, o.c).find(x => x.pos === 'FWD'); wk(o, 6); E.setPriority(o.st, other.id); wk(o, 10); ok(o.p.learn.to === 'MID' && o.p.learn.done === 6 && !o.p.pos2, 'paused (another man given extra coaching for ten weeks): his six weeks are kept'); E.setRetrain(o.st, o.p.id, 'MID'); ok(E.learnerOf(o.st, o.c).done === 6 && E.learnerOf(o.st, o.c).weeksLeft === 6, 'resumed: six done, six to go'); wk(o, 6); ok(o.p.pos2 === 'MID', 'and it finishes six weeks later'); }
  { const o = mk(); wk(o, 6); E.setPriority(o.st, null); wk(o, 4); E.setPriority(o.st, o.p.id); wk(o, 4); ok(o.p.learn.done === 6, 'nobody in the place, then the same man on extra coaching: the course waits'); E.setRetrain(o.st, o.p.id, 'MID'); wk(o, 6); ok(o.p.pos2 === 'MID', 'and picks up where it stopped'); }
  { const o = mk(); wk(o, 6); E.setTraining(o.st, 'hard'); ok(E.learnerOf(o.st, o.c).weeksLeft === 5, 'Normal to Hard half way: six weeks left become five'); wk(o, 4); ok(!o.p.pos2 && Math.abs(o.p.learn.done - 11) < 1e-9, 'four weeks of Hard: eleven of twelve'); wk(o); ok(o.p.pos2 === 'MID', 'the fifth finishes it: eleven weeks in all'); }
  { const o = mk(); wk(o, 6); E.setTraining(o.st, 'light'); ok(E.learnerOf(o.st, o.c).weeksLeft === 8, 'Normal to Light half way: six weeks left become eight'); wk(o, 7); ok(!o.p.pos2, 'not after seven'); wk(o); ok(o.p.pos2 === 'MID', 'after eight'); }
  { const o = mk(); wk(o, 6); E.setStaff(o.st, 'coach', 3); ok(E.learnerOf(o.st, o.c).weeksLeft === 4, 'a better coach half way: six weeks left become four'); E.setStaff(o.st, 'coach', 0); ok(E.learnerOf(o.st, o.c).weeksLeft === 10, 'a worse one: ten'); }
  // a change of target: the unfinished course is abandoned, at once, and work is never carried from one position to another
  { const o = mk(); wk(o, 9); ok(E.setRetrain(o.st, o.p.id, 'FWD') && !('learn' in o.p) && E.learnerOf(o.st, o.c).done === 0 && E.learnerOf(o.st, o.c).weeksLeft === 20, 'a change of target: nine weeks towards midfield are abandoned and attack starts from nothing, 20 weeks'); wk(o, 3); E.setRetrain(o.st, o.p.id, 'MID'); ok(E.learnerOf(o.st, o.c).done === 0, 'and changing back does not bring the nine weeks back'); }
  // through real weeks of the game: a banned man does not play, so he is neither hurt nor tired
  { const st = E.newGame({ seed: 62, userClub: 20 }), c = st.clubs[20], p = E.squadOf(st, c).find(x => x.pos === 'FWD'); p.age = 26; E.setRetrain(st, p.id, 'MID'); let weeks = 0; while (!p.pos2 && weeks < 40){ p.ban = 9; p.fitness = 100; p.injury = 0; E.advanceWeek(st); unsack(st); weeks++; } ok(weeks === 12 && p.pos2 === 'MID' && st.news.some(n => new RegExp(p.name + ' can now play in midfield').test(n.text)), `played through the game's own weeks it takes the same 12, and the news says so (${weeks})`); }
  console.log('interruptions: injury and low fitness do not count, a pause keeps the work, a change of intensity or coach changes the pace from then on, a change of target starts again');
}

// ---- 7. all or nothing, and a second course ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 71, userClub: 20 }), c = st.clubs[20], p = E.squadOf(st, c).find(x => x.pos === 'DEF'); p.age = 26; p.fitness = 100; p.injury = 0; E.setRetrain(st, p.id, 'FWD');
  let early = true; for (let i = 0; i < 19; i++){ E.retrainWeek(st, c); if (E.slotWorth(p, 'FWD') !== 0.7 || E.slotWorth(p, 'MID') !== 0.85) early = false; }
  ok(early && !p.pos2, 'for 19 of 20 weeks he is worth in attack exactly what he was: 70%'); E.retrainWeek(st, c); ok(p.pos2 === 'FWD' && E.slotWorth(p, 'FWD') === 0.90 && E.slotWorth(p, 'MID') === 0.85 && E.slotWorth(p, 'DEF') === 1, 'the twentieth week makes it 90% (the far line); midfield, which he has not learned, is still 85%, and defence is still his own');
  for (let i = 0; i < 60; i++) E.retrainWeek(st, c); ok(p.pos2 === 'FWD' && E.slotWorth(p, 'FWD') === 0.90, 'and it stays: nothing to keep up');
  // a second course: the first position is his until the second is finished, then it is replaced
  ok(E.setRetrain(st, p.id, 'MID'), 'he can then learn midfield'); for (let i = 0; i < 11; i++) E.retrainWeek(st, c); ok(p.pos2 === 'FWD' && E.slotWorth(p, 'FWD') === 0.90 && E.slotWorth(p, 'MID') === 0.85, 'while he learns it, attack is still his'); E.retrainWeek(st, c);
  ok(p.pos2 === 'MID' && E.slotWorth(p, 'MID') === 0.95 && E.slotWorth(p, 'FWD') === 0.7 && st.news.some(n => /can now play in midfield \(and no longer in attack\)/.test(n.text)), 'when it is finished midfield replaces attack: one learned position, and the news says which was lost');
  // the team picker prefers him to a man who has not learned the place
  const st2 = E.newGame({ seed: 72, userClub: 20 }), c2 = st2.clubs[20]; c2.formation = '5-4-1'; c2.xi = null; const defs = E.squadOf(st2, c2).filter(x => x.pos === 'DEF'); defs[0].injury = 4; const xi0 = E.autoSelect(st2, c2), before = xi0.find(x => x.slot === 'DEF' && x.p.pos !== 'DEF');
  const spare = E.squadOf(st2, c2).find(x => x.pos === before.p.pos && !(x.injury > 0) && !xi0.some(y => y.p === x));   // a team-mate from the same line who is not in the eleven
  spare.skill = before.p.skill; spare.fitness = before.p.fitness; spare.morale = before.p.morale;   // made his equal in everything but what he has learned
  const def0 = E.teamStrength(E.autoSelect(st2, c2)).def; spare.pos2 = 'DEF'; const xi1 = E.autoSelect(st2, c2), after = xi1.find(x => x.slot === 'DEF' && x.p.pos !== 'DEF');
  ok(before && spare && after.p === spare && E.effSkill(spare, 'DEF') > E.effSkill(before.p, 'DEF') && E.teamStrength(xi1).def > def0, 'short of a defender, the picker fields the man who has learned defence ahead of an equal man who has not, and the defence is the stronger for it');
  console.log('all or nothing: worth what he was until the last week, then 90% (far line) or 95% (next line) for good; a second course replaces the first only when it finishes');
}

// ---- 8. the trade-off: ordinary improvement, nobody else's changed, the same fitness cost ----
{
  const E = fresh('./engine.js'); let weeks = 0, bad = 0;
  for (const focus of [null, 'DEF', 'MID']) for (const seed of [81, 82]){ const st = E.newGame({ seed, userClub: 20 }), c = st.clubs[20]; E.setTraining(st, 'hard'); E.setStaff(st, 'coach', 3); E.setFocus(st, focus);
    for (let w = 0; w < 25; w++){ const sq = E.squadOf(st, c), noPri = sq.map(p => E.trainingChance(st, c, p)); const learner = outfield(E, st, c).find(p => E.canImprove(p) && !p.pos2) || outfield(E, st, c)[0];
      E.setRetrain(st, learner.id, learner.pos === 'MID'? 'DEF' : 'MID'); const withL = sq.map(p => E.trainingChance(st, c, p)); weeks++; if (withL.some((x, i) => x !== noPri[i])) bad++;
      E.setPriority(st, learner.id); const coached = E.trainingChance(st, c, learner); if (E.canImprove(learner) && learner.fitness >= 70 && !(coached > noPri[sq.indexOf(learner)])) bad++;
      E.setPriority(st, null); E.advanceWeek(st); unsack(st); } }
  ok(bad === 0, `with a learner in the place every player's chance of improving, his own included, is exactly what it is with nobody in it, with and without a focus (${bad} wrong of ${weeks} squad-weeks); on extra coaching the same man has more`);
  // the fitness cost is the priority player's: one point a week of sessions, nothing when rested or injured
  { const a = E.newGame({ seed: 83, userClub: 20 }), b = E.newGame({ seed: 83, userClub: 20 }), d = E.newGame({ seed: 83, userClub: 20 }); const p = outfield(E, a, a.clubs[20])[4]; E.setRetrain(a, p.id, p.pos === 'MID'? 'DEF' : 'MID'); E.setPriority(d, p.id); for (const s of [a, b, d]) s.players[p.id].fitness = 85;
    E.advanceWeek(a); E.advanceWeek(b); E.advanceWeek(d); const fa = a.players[p.id], fb = b.players[p.id], fd = d.players[p.id]; ok(fb.injury > 0? fa.fitness === fb.fitness : (fa.fitness === fb.fitness - 1 && fa.fitness === fd.fitness), 'a learner recovers one point of fitness less in a week of sessions, the same as a man on extra coaching');
    ok(a.clubs[20].players.every(id => id === p.id || a.players[id].fitness === b.players[id].fitness), 'and nobody else\'s fitness is touched'); }
  console.log(`the trade-off: a learner keeps his ordinary chance and nobody else's changes (${weeks} squad-weeks); the fitness cost is the priority player's`);
}

// ---- 9. no skill, potential, value or wage is touched ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 91, userClub: 20 }); let same = 0, n = 0, summer = 0;
  for (const p of Object.values(st.players).slice(0, 400)){ if (p.pos === 'GK') continue; const v = E.valueFor(p), w = E.wageFor(p.skill); p.pos2 = p.pos === 'MID'? 'FWD' : 'MID'; p.learn = { to: 'DEF', done: 5 }; n++; if (E.valueFor(p) === v && E.wageFor(p.skill) === w) same++; delete p.pos2; delete p.learn; }
  ok(same === n && n > 300, `a second position and a course change no player's value or wage (${same} of ${n})`);
  // and the summer does not know of it: the last week of a season and the close, played twice from the same saved game, once with a
  // second position and an unfinished course written on every player who cannot be picked that week (so that no eleven changes)
  { const base = E.newGame({ seed: 92, userClub: 20 }); while (base.week < E.CFG.WEEKS){ E.advanceWeek(base); unsack(base); }
    const a = JSON.parse(JSON.stringify(base)), b = JSON.parse(JSON.stringify(base)); let marked = 0, old = 0;
    for (const p of Object.values(b.players)) if (p.pos !== 'GK' && p.club >= 0 && (p.injury > 0 || p.ban > 0)){ p.pos2 = p.pos === 'MID'? 'DEF' : 'MID'; p.learn = { to: 'FWD', done: 7 }; marked++; if (p.age >= 27) old++; }
    E.restore(a); E.seedRng(9292); E.advanceWeek(a); E.restore(b); E.seedRng(9292); E.advanceWeek(b); const bare = st => JSON.stringify(st, (k, v) => k === 'pos2' || k === 'learn' || k === 'gameId'? undefined : v);
    ok(a.season === base.season + 1 && marked >= 20 && old >= 5, `the season closes, with ${marked} players marked (${old} of them 27 or over)`);
    ok(bare(a) === bare(b), 'the last week and the summer are identical to the last detail with and without second positions: ageing, decline, retirement, contracts, values and wages do not read them');
    ok(Object.values(b.players).filter(p => p.pos2).length > 0, 'and a second position survives the summer'); summer = marked; }
  console.log(`no value in it: ${n} players valued with and without a second position, the same to the pound; a season's close identical with ${summer} second positions written in`);
}

// ---- 10. computer clubs ----
{
  const E = fresh('./engine.js'); const a = E.newGame({ seed: 101, userClub: 20 }), b = EB.newGame({ seed: 101, userClub: 20 }); const k = a.clubs[30], q = outfield(E, a, k)[3]; k.priority = q.id; k.retrain = q.pos === 'MID'? 'DEF' : 'MID';
  let differ = 0; for (let w = 0; w < 42; w++){ const ra = E.advanceWeek(a), rb = EB.advanceWeek(b); unsack(a); unsack(b); for (let i = 0; i < ra.length; i++) if (sig(ra[i]) !== sig(rb[i])) differ++; }
  ok(differ === 0 && !q.pos2 && !q.learn, 'a computer club does not retrain anybody, even with a course written into it: a season identical to the game before');
  const st = E.newGame({ seed: 102, userClub: 20 }), c = st.clubs[31]; c.formation = '4-4-2'; const mids = E.squadOf(st, c).filter(x => x.pos === 'MID'); mids[0].injury = 5; mids[1].injury = 5; const fill = E.autoSelect(st, c).find(x => x.slot === 'MID' && x.p.pos !== 'MID'); const s0 = E.teamStrength(E.autoSelect(st, c)).mid; fill.p.pos2 = 'MID'; const xi1 = E.autoSelect(st, c), s1 = E.teamStrength(xi1).mid;
  ok(fill && s1 > s0 && xi1.some(x => x.p === fill.p && x.slot === 'MID'), 'a computer club that holds a retrained man fields him at what he has learned');
  console.log('computer clubs never retrain; one that holds a retrained man fields him at what he has learned');
}

// ---- 11. hot-seat, a new job, the same seed, saves ----
{
  const E = fresh('./engine.js'); const st = E.newGame({ seed: 5, managers: ['Ann', 'Bob', 'Cy'] }); const [ca, cb, cc] = st.managers.map(m => m.userClub); let ap, cp2;
  E.withManager(st, 0, s => { ap = outfield(E, s, s.clubs[ca]).find(p => p.pos === 'DEF'); E.setRetrain(s, ap.id, 'MID'); }); E.withManager(st, 2, s => { cp2 = outfield(E, s, s.clubs[cc]).find(p => p.pos === 'FWD'); E.setRetrain(s, cp2.id, 'DEF'); });
  ok(st.clubs[ca].retrain === 'MID' && st.clubs[ca].priority === ap.id && !('retrain' in st.clubs[cb]) && !('priority' in st.clubs[cb]) && st.clubs[cc].retrain === 'DEF', 'each manager\'s course is on his own club and nobody else\'s');
  E.withManager(st, 1, s => ok(E.setRetrain(s, ap.id, 'FWD') === false && st.clubs[ca].retrain === 'MID', 'one manager cannot set a course for another\'s player'));
  for (let w = 0; w < 6; w++){ E.advanceWeek(st); unsack(st); } ok((ap.learn && ap.learn.to === 'MID' && ap.learn.done > 0) || ap.pos2 === 'MID', 'and each moves on in its own club');
  const back = E.restore(JSON.parse(JSON.stringify(st))); ok(back.clubs[ca].retrain === st.clubs[ca].retrain && JSON.stringify(back.players[ap.id].learn) === JSON.stringify(ap.learn) && E.SAVE_VERSION === 4, 'a hot-seat save in format 4 keeps each course');
  const src = require('fs').readFileSync(path.join(__dirname, 'engine.js'), 'utf8'); ok(/c\.training = 'normal'; delete c\.focus; delete c\.priority; delete c\.retrain;/.test(src), 'a new job starts with no course');
  // the same seed and the same choices
  const run = to => { const s = E.newGame({ seed: 77, userClub: 20 }); const p = outfield(E, s, s.clubs[20]).find(x => x.pos === 'MID'); if (to) E.setRetrain(s, p.id, to); const out = []; for (let w = 0; w < 60; w++){ for (const m of E.advanceWeek(s)) out.push(sig(m)); unsack(s); } return out.join('\n') + whole(s); };
  const r1 = run('DEF'), r2 = run('DEF'), r3 = run(null); ok(r1 === r2, 'the same seed and the same course give the same game'); ok(r1 !== r3, 'and a course changes it');
  // saves: both ways with 1.8.0 and 1.7.1
  for (const [name, Old] of [['1.8.0', E180], ['1.7.1', E171]]){ const s = E.newGame({ seed: 63, userClub: 20 }), c = s.clubs[20], men = outfield(E, s, c); men[0].pos2 = men[0].pos === 'MID'? 'DEF' : 'MID'; E.setRetrain(s, men[1].id, men[1].pos === 'MID'? 'DEF' : 'MID'); for (let w = 0; w < 4; w++){ men[1].ban = 9; E.advanceWeek(s); unsack(s); } const done = men[1].learn.done;
    let o = Old.restore(JSON.parse(JSON.stringify(s))); let played = 0; for (let w = 0; w < 8; w++){ played += Old.advanceWeek(o).length; unsack(o); } o = JSON.parse(JSON.stringify(o)); ok(played > 0 && o.week === s.week + 8, `a save with a second position and a course opens in the ${name} engine and plays on`);
    const b2 = E.restore(o), m0 = b2.players[men[0].id], m1 = b2.players[men[1].id]; ok(m0.pos2 === men[0].pos2 && m1.learn && m1.learn.done === done && b2.clubs[20].retrain === c.retrain && E.learnerOf(b2, b2.clubs[20]), `and comes back from ${name} with the second position and the course as they were (no work is done there)`); E.advanceWeek(b2); ok(b2.week === s.week + 9, 'and plays on here'); }
  console.log('hot-seat: each manager\'s course his own; a new job starts with none; the same seed gives the same game; saves in format 4 go both ways with 1.8.0 and 1.7.1');
}

// ---- 12. the quick balance bench ----
{
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'tools', 'retraining-balance.js'), '--quick'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + (r.stderr || ''), miss = out.split('\n').filter(l => /^MISS/.test(l));
  ok(r.status === 0 && miss.length === 0, 'the quick balance bench meets its targets: ' + (miss.join(' | ') || out.split('\n').slice(-3).join(' ')));
  console.log('the quick balance bench: ' + (out.trim().split('\n').pop() || ''));
}

console.log(`${checks} checks, ${fails} failures`);
console.log(fails? 'RETRAINING TESTS FAILED' : 'RETRAINING TESTS OK');
process.exit(fails? 1 : 0);
