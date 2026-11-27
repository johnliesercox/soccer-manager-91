'use strict';
// The training screens (Milestone 2, slice 2), through the built game in the headless harness:
//   1. the Squad screen: Light, Normal, Hard as they were, and under them the focus and the priority player; a new game shows
//      the default, has nothing to reset and has nothing written on the club
//   2. the focus: five settings, the chosen one marked, its for and against in words, and what the screen sets is what the engine uses
//   3. the priority player: chosen from a list of the first team, marked on the squad list, changed, cleared, and set from his own page
//   4. the warnings: a player of 28 or over, one at his potential, one injured, one under 70 fitness; a focus on a group with nobody to coach
//   5. the feedback: what the card, the squad list and the player's page say he gained is the engine's own record, to the point
//   6. reset to default training
//   7. a phone-width screen: one line until it is opened
//   8. hot-seat: each manager sees and sets his own only
//   9. the 1.8.0 rules switch, and an old save: nothing of it is shown and nothing is needed
// Run after python3 build.py:  node test-training-ui.js
const { boot } = require('./harness.js');
const E180 = require('./legacy/engine.v180.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c){ fails++; console.log('FAIL', m); } };
const seeded = async (H, seed, club) => { const A = H.app(); const g = A.E.newGame({ seed, userClub: club }); g.managers[0].managerName = 'John'; A.S.state = g; A.go('home'); await H.sleep(80); return g; };
const q = (H, s) => Array.from(H.d.querySelectorAll(s));
const foc = g => `[data-a="focus"][data-g="${g}"]`;
const panel = H => (H.d.querySelector('.tplan') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim();

(async () => {
  // ---- 1 to 6: one manager on a wide screen ----
  {
    const H = boot(); await H.start(['John']); const st = await seeded(H, 19911127, 50); const E = H.app().E, S = H.app().S, u = st.clubs[st.userClub];
    await H.click('[data-nav="squad"]');
    ok(q(H, '[data-a="training"]').length === 3 && q(H, '[data-a="training"]').map(b => b.textContent).join() === 'Light,Normal,Hard' && q(H, '[data-a="training"].on').length === 1 && q(H, '[data-a="training"].on')[0].dataset.t === 'normal', 'Light, Normal and Hard are where they were, on Normal');
    ok(H.has('.tplan') && q(H, '[data-a="focus"]').length === 5 && q(H, '[data-a="focus"]').map(b => b.textContent).join() === 'Balanced,Goalkeepers,Defenders,Midfielders,Attackers', 'under them, open on a wide screen: the five focus settings by name');
    ok(q(H, '[data-a="focus"].on').length === 1 && q(H, '[data-a="focus"].on')[0].dataset.g === '' && /Balanced\. No priority player\./.test(panel(H)) && /equal share of the coach/.test(panel(H)), 'a new game is on Balanced with no priority player, and says so');
    ok(!H.has('[data-a="trainreset"]') && !('focus' in u) && !('priority' in u) && !('trainLog' in u), 'with nothing to reset and nothing written on the club');
    ok(/Nobody has gained a point of skill in training yet this season/.test(panel(H)) && /really gained in weekly training/.test(panel(H)), 'the record starts empty and says what it counts');
    const tp = H.d.querySelector('.tplan'), sec = tp.closest('section'); ok(/Training this week/.test(sec.textContent) && sec.querySelector('[data-a="training"]').compareDocumentPosition(tp) & 4, 'it is part of the training card, below the intensity');
    ok(q(H, '.tplan [role="group"]').every(g => H.d.getElementById(g.getAttribute('aria-labelledby'))) && q(H, '[data-a="focus"]').every(b => b.getAttribute('aria-pressed') === String(b.classList.contains('on'))) && H.d.querySelector('[data-a="trainopen"]').getAttribute('aria-expanded') === 'true', 'the group has its name, the chosen setting says so, and the Change button says whether it is open');

    // ---- 2. the focus ----
    for (const [g, name, men, fast] of [['GK', 'Goalkeepers', 'goalkeepers', 'twice as fast'], ['DEF', 'Defenders', 'defenders', 'half as fast again'], ['MID', 'Midfielders', 'midfielders', 'half as fast again'], ['FWD', 'Attackers', 'attackers', 'half as fast again']]){
      await H.click(foc(g)); const t = panel(H);
      ok(u.focus === g && E.focusOf(u) === g && q(H, '[data-a="focus"].on').length === 1 && q(H, '[data-a="focus"].on')[0].dataset.g === g, name + ': set on the club and marked as chosen');
      ok(new RegExp(name + ' first\\.').test(t) && new RegExp('For Your ' + men + ' who can still improve do so ' + fast).test(t) && /Against The rest of the squad improve more slowly to pay for it, and the squad as a whole gains a little less/.test(t) && /Suits /.test(t) && /Stays this way until you change it/.test(t), name + ': the card gives its for and against in words');
      // what the words say is what the engine does: the multiple, and a total a little lower
      const sq = E.squadOf(st, u), el = sq.filter(p => E.canImprove(p)), base = E.CFG.TRAIN_BASE*E.CFG.COACH_MULT[u.staff.coach]*E.CFG.TRAIN[u.training].gain, own = el.find(p => p.pos === g), oth = el.find(p => p.pos !== g);
      if (own && oth){ const tot = sq.reduce((a, p) => a + E.trainingChance(st, u, p), 0); ok(E.trainingChance(st, u, own) > base && E.trainingChance(st, u, oth) < base && Math.abs(tot/(el.length*base) - 0.95) < 1e-9 && (g === 'GK'? E.CFG.TRAINING.FOCUS.GK === 2 : E.CFG.TRAINING.FOCUS[g] === 1.5), name + ': and the engine gives that group more, the rest less and the squad 5% less'); }
      ok(H.has('[data-a="trainreset"]'), name + ': the way back to the default is offered'); }
    await H.click(foc('')); ok(!('focus' in u) && E.trainingShare(st, u) === null && /Balanced\. No priority player\./.test(panel(H)) && !H.has('[data-a="trainreset"]'), 'Balanced clears it: nothing on the club, the old rule, nothing to reset');
    console.log('the focus: five settings, each set on the club, marked, explained, and matched by what the engine does');

    // ---- 3. the priority player ----
    ok(/Nobody\. One player can have extra coaching/.test(panel(H)) && H.has('[data-a="trainpick"]'), 'no priority player: the card says what one is and offers the choice');
    await H.click('[data-a="trainpick"]', 80); const squad = E.squadOf(st, u);
    ok(S.screen === 'trainpick' && /Priority player/.test(H.text()) && q(H, '[data-a="priority"]').length === squad.length && /improves twice as fast/.test(H.text()) && /point of fitness each week/.test(H.text()) && /Under 70 fitness he is rested/.test(H.text()), 'the list is the whole first team, with the cost said plainly');
    ok(q(H, '[data-a="priority"]').every(b => /^Make .+ the priority player$/.test(b.getAttribute('aria-label'))), 'every Choose button names its player');
    const pick = squad.find(p => E.coachingNote(p) === null && p.pos === 'MID'); await H.click(`[data-a="priority"][data-id="${pick.id}"]`, 80);
    ok(u.priority === pick.id && E.priorityOf(st, u) === pick && S.screen === 'squad' && new RegExp(pick.name + ' is the priority player\\.$').test(H.toast()), 'choosing one sets him on the club, says so and comes back to the Squad screen');
    ok(new RegExp('Priority player: ' + pick.name + '\\.').test(panel(H)) && new RegExp(pick.name + ' MID, ' + pick.age + '\\. No gain in training yet this season').test(panel(H)) && !/Note/.test(panel(H)), 'the card names him, with what he has gained so far and no warning');
    ok(q(H, 'tr .pill.pri').length === 1 && q(H, 'tr .pill.pri')[0].closest('tr').textContent.includes(pick.name), 'and the squad list marks him, and only him');
    await H.click('[data-a="trainpick"]', 80); const row = q(H, 'tr.sel'); ok(row.length === 1 && row[0].textContent.includes(pick.name) && /Chosen/.test(row[0].textContent) && H.has('[data-a="nopriority"]'), 'in the list he is shown as chosen, and "No priority player" is offered');
    const other = squad.find(p => E.coachingNote(p) === null && p.id !== pick.id); await H.click(`[data-a="priority"][data-id="${other.id}"]`, 80);
    ok(u.priority === other.id && q(H, 'tr .pill.pri').length === 1 && q(H, 'tr .pill.pri')[0].closest('tr').textContent.includes(other.name), 'choosing another replaces him: there is one priority player');
    await H.click('[data-a="nopriority"]', 60); ok(!('priority' in u) && /No priority player\./.test(panel(H)) && q(H, 'tr .pill.pri').length === 0 && H.toast() === 'No priority player.', 'and "No priority player" clears him');
    // from the player's own page
    await H.click(`[data-a="player"][data-id="${pick.id}"]`, 60); ok(/Training/.test(H.text()) && /One player can have extra coaching/.test(H.text()) && H.d.querySelector('[data-a="priority"]').textContent === 'Make him the priority player', 'a player\'s own page has a Training part with the same choice');
    await H.click('[data-a="priority"]', 60); ok(u.priority === pick.id && S.screen === 'player' && /He is your priority player: twice the coaching, and a point of fitness a week/.test(H.text()) && H.d.querySelector('[data-a="nopriority"]').textContent === 'Stop his extra coaching', 'set from there, it says what that means and offers to stop');
    await H.click('[data-a="back"]', 60); await H.click(`[data-a="player"][data-id="${other.id}"]`, 60); ok(new RegExp('Your priority player is ' + pick.name + '; choosing this player replaces him').test(H.text()), 'another player\'s page says who would be replaced');
    await H.click('[data-a="back"]', 60);
    console.log('the priority player: chosen from the first team, marked, replaced, cleared, and set from his own page');

    // ---- 4. the warnings ----
    const old = squad.find(p => p.age >= 28), full = squad.find(p => p.age < 28 && p.skill >= p.pot) || (() => { const p = squad.find(x => x.age < 28 && x.id !== pick.id); p.pot = p.skill; return p; })();
    const say = async (p, re, short, what) => { await H.click('[data-a="trainpick"]', 60); const r = q(H, 'tr').find(x => x.textContent.includes(p.name)); ok(r && short.test(r.textContent), what + ': the list says so before he is chosen'); await H.click(`[data-a="priority"][data-id="${p.id}"]`, 60); ok(u.priority === p.id && re.test(panel(H)) && /Note/.test(panel(H)) && /Note:/.test(H.toast()), what + ': he can be chosen, and the card and the message both warn that it does nothing'); await H.click(`[data-a="player"][data-id="${p.id}"]`, 60); ok(re.test(H.text()), what + ': and so does his own page'); await H.click('[data-a="back"]', 60); };
    await say(old, /Training does not raise a player's skill from the age of 28, so extra coaching does nothing for him/, /28 or over: training cannot raise his skill/, 'a player of 28 or over');
    await say(full, /He has reached his potential, so extra coaching does nothing for him/, /At his potential: nothing left to gain/, 'a player at his potential');
    const fitMan = squad.find(p => E.coachingNote(p) === null && p.id !== pick.id); fitMan.injury = 3; await say(fitMan, /He is injured\. His extra coaching starts again when he is fit/, /Injured: no coaching until he is fit/, 'an injured player'); fitMan.injury = 0;
    fitMan.fitness = 60; await say(fitMan, /His fitness is under 70, so he is being rested\. His extra coaching starts again when he recovers/, /Under 70 fitness: rested until he recovers/, 'a player under 70 fitness'); fitMan.fitness = 100;
    ok(E.coachingNote(old) === 'age' && E.coachingNote(full) === 'potential' && E.trainingChance(st, u, old) === 0 && E.trainingChance(st, u, full) === 0, 'and the warnings are true: the engine gives those two no chance at all');
    await H.click('[data-a="nopriority"]', 60);
    // a focus on a group with nobody left to coach
    const keep = []; for (const p of squad) if (p.pos === 'GK'){ keep.push([p, p.pot]); p.pot = p.skill; } await H.click(foc('GK'));
    ok(/Note None of your goalkeepers can improve any further, so this focus gives nothing and costs the others a little/.test(panel(H)) && E.focusCount(st, u, 'GK') === 0, 'a focus on a group with nobody left to coach says it gives nothing');
    for (const [p, pot] of keep) p.pot = pot; await H.click(foc('')); await H.click(foc('DEF')); ok(!/Note None/.test(panel(H)), 'and a focus with someone to coach carries no such note'); await H.click(foc(''));
    console.log('the warnings: 28 or over, at his potential, injured, under 70 fitness, and a focus with nobody to coach, each on the list, the card, the message and his own page');

    // ---- 5. the feedback is the engine's record ----
    E.setTraining(st, 'hard'); E.setStaff(st, 'coach', 3); E.setFocus(st, 'MID'); E.setPriority(st, pick.id); const before = new Map(E.squadOf(st, u).map(p => [p.id, p.skill])), week0 = st.week;
    for (let w = 0; w < 14; w++){ E.advanceWeek(st); if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } } H.app().go('squad'); await H.sleep(80);
    const rec = E.trainingRecord(st, u).now, real = {}, pos = { GK: 0, DEF: 0, MID: 0, FWD: 0 }; let total = 0; for (const p of E.squadOf(st, u)){ const d = p.skill - (before.has(p.id)? before.get(p.id) : p.skill); if (d > 0){ real[p.id] = d; pos[p.pos] += d; total += d; } }
    ok(st.season === 1 && st.week === week0 + 14 && total > 5 && rec.n === total && JSON.stringify(rec.pos) === JSON.stringify(pos), `14 weeks of Hard with the best coach: the record is the skill really gained (${total} points)`);
    const t5 = panel(H); ok(new RegExp('Squad \\+' + total + '\\. Goalkeepers \\+' + pos.GK + ', Defenders \\+' + pos.DEF + ', Midfielders \\+' + pos.MID + ', Attackers \\+' + pos.FWD + '\\.').test(t5), 'the card gives the squad\'s total and each group\'s, and they are those figures: ' + (t5.match(/Squad \+[^.]*\.[^.]*\./) || [''])[0]);
    const tops = Object.keys(real).map(id => [st.players[id], real[id]]).sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).slice(0, 3); ok(new RegExp('Most improved: ' + tops.map(x => x[0].name + ' \\+' + x[1]).join(', ') + '\\.').test(t5), 'and the three who gained most, by name');
    const rows = q(H, 'tr.tap'); let rowsRight = 0, rowsSeen = 0; for (const p of E.squadOf(st, u)){ const r = rows.find(x => x.textContent.includes(p.name)); if (!r) continue; rowsSeen++; const m = r.textContent.match(/\+(\d+) trained/); if ((m? +m[1] : 0) === (real[p.id] || 0)) rowsRight++; }
    ok(rowsSeen >= 16 && rowsRight === rowsSeen, `every row of the squad list shows what that player really gained, or nothing (${rowsRight} of ${rowsSeen})`);
    const pg = real[pick.id] || 0; ok(new RegExp(pick.name + ' MID, ' + pick.age + '\\. ' + (pg? '\\+' + pg + ' in training this season' : 'No gain in training yet this season')).test(t5), 'the priority player\'s own gain is on the card');
    const gainer = tops[0][0]; await H.click(`[data-a="player"][data-id="${gainer.id}"]`, 60); ok(new RegExp('\\+' + real[gainer.id] + ' in training this season\\.').test(H.text()), 'and a player\'s own page gives his'); await H.click('[data-a="back"]', 60);
    await H.click('[data-a="trainpick"]', 60); const pr = q(H, 'tr').find(x => x.textContent.includes(gainer.name)); ok(pr && new RegExp('\\+' + real[gainer.id] + ' trained').test(pr.textContent), 'and so does the list of players to choose from'); await H.click('[data-a="back"]', 60);
    // last season
    while (st.season === 1){ E.advanceWeek(st); if (st.gameOver){ st.gameOver = null; st.sackOffer = null; } } const last = E.trainingRecord(st, st.clubs[st.userClub]).last; H.app().go('squad'); await H.sleep(80);
    ok(last && last.s === 1 && last.n >= total && new RegExp('Last season: squad \\+' + last.n + '\\. Goalkeepers \\+' + last.pos.GK + ', Defenders \\+' + last.pos.DEF + ', Midfielders \\+' + last.pos.MID + ', Attackers \\+' + last.pos.FWD + '\\.').test(panel(H)) && /Nobody has gained a point of skill in training yet this season/.test(panel(H)), 'after the season ends the card starts again from nothing and keeps last season\'s totals: squad +' + (last && last.n));
    H.app().go('review'); await H.sleep(80); ok(new RegExp('Training ?Squad \\+' + last.n + ' skill: GK \\+' + last.pos.GK + ', DEF \\+' + last.pos.DEF + ', MID \\+' + last.pos.MID + ', ATT \\+' + last.pos.FWD).test(H.text()), 'and the season review gives the season\'s training in a line, the same figures'); H.app().go('squad'); await H.sleep(60);
    console.log(`the feedback: the card, the squad list, the player's page and the picker all give the engine's own record (${total} points in 14 weeks, ${last && last.n} in the season)`);

    // ---- 6. reset ----
    const cu = st.clubs[st.userClub]; E.setTraining(st, 'hard'); E.setFocus(st, 'DEF'); const pp = E.squadOf(st, cu).find(p => E.coachingNote(p) === null); E.setPriority(st, pp.id); H.app().go('squad'); await H.sleep(60);
    ok(H.has('[data-a="trainreset"]') && /Reset to default training/.test(H.d.querySelector('[data-a="trainreset"]').textContent), 'with anything changed, "Reset to default training" is there');
    await H.click('[data-a="trainreset"]', 60); ok(cu.training === 'normal' && !('focus' in cu) && !('priority' in cu) && E.trainingShare(st, cu) === null && q(H, '[data-a="training"].on')[0].dataset.t === 'normal' && /Balanced\. No priority player\./.test(panel(H)) && !H.has('[data-a="trainreset"]') && /Training reset to the default: Normal, balanced, no priority player/.test(H.toast()), 'one tap puts back Normal, Balanced and no priority player, says so, and the button goes');
    await H.click('[data-a="training"][data-t="hard"]'); ok(H.has('[data-a="trainreset"]'), 'Hard alone is enough for the reset to be offered'); await H.click('[data-a="trainreset"]', 60);
    ok(H.errors.length === 0, 'no errors on the wide screen: ' + H.errors.join(' | '));
    console.log('reset: one tap back to Normal, Balanced and no priority player');
  }

  // ---- 7. a phone-width screen ----
  {
    const H = boot({ pre: w => { Object.defineProperty(w, 'innerWidth', { value: 390, configurable: true }); } }); await H.start(['John']); const st = await seeded(H, 19911127, 50); const E = H.app().E, u = st.clubs[st.userClub];
    await H.click('[data-nav="squad"]');
    ok(H.has('.tplan') && q(H, '[data-a="focus"]').length === 0 && /Balanced\. No priority player\./.test(panel(H)) && H.d.querySelector('[data-a="trainopen"]').textContent === 'Change' && H.d.querySelector('[data-a="trainopen"]').getAttribute('aria-expanded') === 'false' && q(H, '[data-a="training"]').length === 3, 'on a phone the new part is one line and a Change button; Light, Normal, Hard are always there');
    await H.click('[data-a="trainopen"]'); ok(q(H, '[data-a="focus"]').length === 5 && H.d.querySelector('[data-a="trainopen"]').textContent === 'Close', 'Change opens it');
    await H.click(foc('DEF')); await H.click('[data-a="trainopen"]'); ok(q(H, '[data-a="focus"]').length === 0 && /Defenders first\. No priority player\./.test(panel(H)) && u.focus === 'DEF', 'closed again, the one line gives what is chosen');
    ok(H.errors.length === 0, 'no errors at phone width: ' + H.errors.join(' | '));
    console.log('a phone-width screen: one line until it is opened');
  }

  // ---- 8. hot-seat ----
  {
    const H = boot(); await H.start(['Ann', 'Bob']); const S = H.app().S, E = H.app().E, st = S.state; const [ca, cb] = st.managers.map(m => st.clubs[m.userClub]);
    const turn = async () => { if (H.has('[data-a="taketurn"]')) await H.click('[data-a="taketurn"]'); await H.preseason(); };
    await turn(); ok(st.clubs[st.userClub] === ca, 'Ann first'); await H.click('[data-nav="squad"]'); await H.click(foc('FWD')); const ap = E.squadOf(st, ca).find(p => E.coachingNote(p) === null); await H.click('[data-a="trainpick"]', 60); await H.click(`[data-a="priority"][data-id="${ap.id}"]`, 60);
    ok(ca.focus === 'FWD' && ca.priority === ap.id, 'Ann sets a focus and a priority player'); await H.click('[data-nav="home"]'); await H.click('[data-a="ready"]', 120);
    await turn(); ok(st.clubs[st.userClub] === cb, 'then Bob'); await H.click('[data-nav="squad"]');
    ok(/Balanced\. No priority player\./.test(panel(H)) && q(H, '[data-a="focus"].on')[0].dataset.g === '' && q(H, 'tr .pill.pri').length === 0 && !H.text().includes(ap.name), 'Bob sees his own training, the default, and nothing of Ann\'s');
    await H.click('[data-a="trainpick"]', 60); ok(q(H, '[data-a="priority"]').length === E.squadOf(st, cb).length && q(H, '[data-a="priority"]').every(b => E.squadOf(st, cb).some(p => String(p.id) === b.dataset.id)), 'his list is his own players only'); await H.click('[data-a="back"]', 60);
    await H.click(foc('GK')); ok(ca.focus === 'FWD' && ca.priority === ap.id && cb.focus === 'GK' && !('priority' in cb), 'each manager\'s choices are on his own club');
    await H.click('[data-nav="home"]'); await H.click('[data-a="ready"]', 150);
    for (let i = 0; i < 6 && !H.has('[data-a="nextround"]'); i++){ if (H.has('[data-a="taketurn"]')) await H.click('[data-a="taketurn"]'); await H.throughMatchday('instant'); }
    ok(ca.focus === 'FWD' && ca.priority === ap.id && cb.focus === 'GK', 'and they are still there after the week is played');
    ok(H.errors.length === 0, 'no errors in the hot-seat game: ' + H.errors.join(' | '));
    console.log('hot-seat: each manager sees and sets his own training only');
  }

  // ---- 9. the 1.8.0 rules switch, and an old save ----
  {
    const H = boot({ url: 'http://localhost/?rules=1.8' }); await H.start(['John']); const st = await seeded(H, 19911127, 50); const E = H.app().E, S = H.app().S, u = st.clubs[st.userClub];
    u.focus = 'DEF'; u.priority = u.players[3]; await H.click('[data-nav="squad"]');
    ok(!H.has('.tplan') && q(H, '[data-a="focus"]').length === 0 && q(H, '.pill.pri').length === 0 && !/priority|trained/i.test(H.text()) && q(H, '[data-a="training"]').length === 3, 'with the 1.8.0 rules the Squad screen has Light, Normal, Hard and nothing else of training, even with choices in the save');
    await H.click(`[data-a="player"][data-id="${u.players[3]}"]`, 60); ok(!/priority player|in training this season/.test(H.text()) && !H.has('[data-a="priority"]'), 'nor does a player\'s page'); await H.click('[data-a="back"]', 60);
    S.screen = 'trainpick'; H.app().render(); await H.sleep(40); ok(!/Priority player/.test(H.text()), 'and the list of players cannot be reached');
    await H.click('[data-nav="help"]').catch(async () => { H.app().go('help'); await H.sleep(40); }); ok(!/Training focus and the priority player/.test(H.text()) && /up to the age of 27/.test(H.text()), 'Help says nothing of it there');
    ok(H.errors.length === 0, 'no errors with the 1.8.0 rules: ' + H.errors.join(' | '));
    // with the rules on, Help explains it
    const H2 = boot(); await H2.start(['John']); await seeded(H2, 19911127, 50); H2.app().go('help'); await H2.sleep(40);
    ok(/Training focus and the priority player/.test(H2.text()) && /decide who improves, not how much/.test(H2.text()) && /28 or over/.test(H2.text()) && /you can leave it there for good/.test(H2.text()), 'Help explains the focus and the priority player in the game\'s own words');
    // a save made by 1.8.0 opens on the default with nothing to do
    const old = E180.newGame({ seed: 7, userClub: 30 }); for (let w = 0; w < 5; w++) E180.advanceWeek(old); const A = H2.app(); A.S.state = A.E.restore(JSON.parse(JSON.stringify(old))); A.go('squad'); await H2.sleep(80);
    const cu = A.S.state.clubs[A.S.state.userClub]; ok(/Balanced\. No priority player\./.test(panel(H2)) && !H2.has('[data-a="trainreset"]') && !('focus' in cu) && !('priority' in cu) && /Nobody has gained a point of skill in training yet this season/.test(panel(H2)), 'a save made by 1.8.0 opens on the default: nothing chosen, nothing to reset, nothing written');
    ok(H2.errors.length === 0, 'no errors with an old save: ' + H2.errors.join(' | '));
    console.log('the 1.8.0 rules switch hides all of it; Help explains it; a 1.8.0 save opens on the default');
  }

  console.log(fails? `${fails} FAILURES of ${checks} checks` : `TRAINING SCREENS OK (${checks} checks)`);
  process.exit(fails? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
