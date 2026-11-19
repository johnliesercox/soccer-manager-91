'use strict';
// The tactics screens (Milestone 1, slice 2), through the built game in the headless harness:
//   1. the Match plan card on the Squad screen: four controls, the for and against of the chosen setting, the easy default
//   2. what the card says is what the engine does (the figures in the words are checked against CFG.TACTICS)
//   3. Home: the plan in a line, and what the opponent is known for (one thing, never his plan)
//   4. after the match: each side's share of the ball and what its chances were worth, as the match record has them
//   5. a phone-width screen: the card is one line until it is opened
//   6. hot-seat: each manager sees and sets his own plan only
//   7. an old save, and the 1.7.1 rules switch: nothing of tactics is shown and nothing is needed
// Run after python3 build.py:  node test-tactics-ui.js
const { boot } = require('./harness.js');
const Eold = require('./legacy/engine.v171.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c){ fails++; console.log('FAIL', m); } };
const seeded = async (H, seed, club) => { const A = H.app(); const g = A.E.newGame({ seed, userClub: club }); g.managers[0].managerName = 'John'; A.S.state = g; A.go('home'); await H.sleep(80); return g; };
const q = (H, s) => Array.from(H.d.querySelectorAll(s));
const tac = (k, v) => `[data-a="tactic"][data-k="${k}"][data-v="${v}"]`;

(async () => {
  // ---- 1 to 4: one manager on a wide screen ----
  {
    const H = boot(); await H.start(['John']); const st = await seeded(H, 19911119, 50); const E = H.app().E, S = H.app().S, u = st.clubs[st.userClub];
    await H.click('[data-nav="squad"]');
    ok(H.has('section.plan') && q(H, '[data-a="tactic"]').length === 12, 'the Squad screen has the Match plan card, open on a wide screen, with four controls of three settings');
    const order = q(H, 'main section.card').map(e => e.className + '|' + (e.textContent.match(/Squad and tactics|Match plan|Training this week/) || [''])[0]);
    ok(order.findIndex(x => /Squad and tactics/.test(x)) < order.findIndex(x => /plan\|Match plan/.test(x)) && order.findIndex(x => /plan\|Match plan/.test(x)) < order.findIndex(x => /Training this week/.test(x)), 'the card sits between the formation and training');
    ok(q(H, '[data-a="tactic"].on').length === 4 && q(H, '[data-a="tactic"].on').every(b => b.dataset.v === '0') && /All Balanced\./.test(H.text()) && !H.has('[data-a="planreset"]') && u.tactics === undefined, 'a new game is all Balanced, with nothing to reset and nothing saved on the club');
    ok(q(H, '[data-a="tactic"].on').every(b => b.getAttribute('aria-pressed') === 'true') && q(H, '.plan [role="group"]').length === 4 && q(H, '.plan [role="group"]').every(g => H.d.getElementById(g.getAttribute('aria-labelledby'))), 'the chosen settings say so to a screen reader and each control has its name');
    // every setting of every control: it is stored, shown as chosen, and says what is for it and what is against it
    let said = 0;
    for (const k of E.PLAN_KEYS) for (const v of [-1, 1, 0]){ await H.click(tac(k, v)); const on = H.d.querySelector(tac(k, v)); const d = on.closest('.grid3').nextElementSibling;
      ok(E.planOf(u)[k] === v && on.classList.contains('on'), `setting ${k} to ${v} is stored on the club and shown as chosen`);
      if (v){ ok(d.querySelector('.pro') && d.querySelector('.con') && d.querySelector('.sut') && d.textContent.length > 80, `setting ${k} ${v} says what is for it, what is against it and what it suits`); said++; } else ok(!d.querySelector('.pro') && d.textContent.trim().length > 15, `the middle setting of ${k} says it changes nothing`); }
    ok(said === 8 && u.tactics === undefined, 'eight settings explained; back in the middle on all four leaves no plan on the club');
    // 2. the words against the engine
    const T = E.CFG.TACTICS; const words = async (k, v) => { await H.click(tac(k, v)); const t = H.d.querySelector(tac(k, v)).closest('.grid3').nextElementSibling.textContent; await H.click(tac(k, 0)); return t; };
    const tenth = x => x >= 0.08 && x <= 0.12, fifth = x => x >= 0.17 && x <= 0.23; const ball = r => 100*Math.pow(1 + T.PRESS_MID*r, E.CFG.MID_K)/(Math.pow(1 + T.PRESS_MID*r, E.CFG.MID_K) + 1) - 50;
    const att = await words('m', 1), def = await words('m', -1), hi = await words('r', 1), lo = await words('r', -1), sh = await words('p', -1), di = await words('p', 1), os = await words('s', 1), wi = await words('s', -1);
    ok(/attack counts for about a tenth more/.test(att) && /defence counts for about a tenth less/.test(att) && tenth(T.ATT_UP) && tenth(T.DEF_DOWN), 'Attacking: "about a tenth" each way is what the engine does');
    ok(/defence counts for about a tenth more/.test(def) && /attack counts for about a tenth less/.test(def) && tenth(T.DEF_UP) && tenth(T.ATT_DOWN), 'Defensive: "about a tenth" each way is what the engine does');
    ok(/About two points more of the ball/.test(hi) && Math.round(ball(1)) === 2 && /About two points less of the ball/.test(lo) && Math.round(ball(-1)) === -2, 'pressing: "about two points" of the ball is what the engine does (' + ball(1).toFixed(2) + ', ' + ball(-1).toFixed(2) + ')');
    ok(/loses 8 fitness in the match, not 7/.test(hi) && T.PRESS_FIT_HI === 1 && !/fitness|legs/.test(lo) && T.PRESS_FIT_LO === 0, 'a high press costs one fitness point more; a low press is not said to save any, and does not');
    ok(/about a fifth more bookings/.test(hi) && /about a fifth fewer bookings/.test(lo) && fifth(T.PRESS_CARD), 'pressing: "about a fifth" more or fewer bookings is what the engine does');
    ok(/More room behind your defence/.test(hi) && T.PRESS_DEF_HI > 0 && /firmer defence/.test(lo) && T.PRESS_DEF_LO > 0, 'pressing: the defence is weaker pressing high and firmer pressing low');
    ok(/more of the ball counts for more/.test(sh) && /less of the ball to make chances/.test(di) && T.PASS_POSS > 0 && /presses high wins it back/.test(sh) && /behind a high press/.test(di) && T.PASS_PRESS > 0, 'passing: the share of the ball counts for more Short and less Direct, and a high press is bad for Short and good for Direct');
    ok(/Midfielders score more/.test(os) && T.SHOOT_MID > 0 && /Forwards score more/.test(wi) && T.SHOOT_FWD > 0 && /Good against a Defensive side/.test(os) && /Good against an Attacking side/.test(wi) && T.SHOOT_BLOCK > 0 && /blank days/.test(os) && T.SHOOT_SD > 0, 'shooting: who scores, the wider luck, and which mentality each setting meets well');
    // the summary, the reset, opening and closing
    await H.click(tac('m', 1)); await H.click(tac('p', -1)); await H.click(tac('r', 1));
    ok(/Attacking, Short passing, High press\./.test(H.text()) && /Used in every match until you change it/.test(H.text()) && H.has('[data-a="planreset"]'), 'the card sums the plan up in words and offers the way back');
    await H.click('[data-a="planopen"]'); ok(q(H, '[data-a="tactic"]').length === 0 && /Attacking, Short passing, High press\./.test(H.text()) && H.d.querySelector('[data-a="planopen"]').getAttribute('aria-expanded') === 'false' && E.planOf(u).m === 1, 'closed, the card is its one line and the plan stands');
    await H.click('[data-a="planopen"]'); ok(q(H, '[data-a="tactic"]').length === 12, 'and it opens again');
    // one plan for every competition: the European XI view shows the same card and the same plan
    if (H.has('[data-a="ximode"][data-m="euro"]')){ await H.click('[data-a="ximode"][data-m="euro"]'); ok(q(H, '[data-a="tactic"].on').map(b => b.dataset.v).join() === '1,-1,1,0', 'the European XI view shows the one plan'); await H.click('[data-a="ximode"][data-m="league"]'); }
    // 3. Home
    await H.click('[data-nav="home"]'); const nf = E.nextFixture(st); const hint = E.styleHint(st, nf.opp);
    ok(/Match plan\s*Attacking, Short passing, High press/.test(H.text()), 'Home shows the plan in a line');
    const rep = (H.d.querySelector('.card.fx .rep') || {}).textContent || '';
    ok(hint? /^Known for [a-z ]+\.$/.test(rep) : rep === 'Not known for any one way of playing.', 'Home says what the opponent is known for: ' + rep);
    const full = E.clubStyle(nf.opp); const names = { p: ['keeping the ball', 'playing it long'], r: ['sitting deep', 'pressing high'], s: ['patience in front of goal', 'shooting on sight'] }; const told = Object.keys(names).filter(k => names[k].some(w => rep.includes(w)));
    ok(told.length <= 1 && (!hint || (told[0] === hint.k && rep.includes(names[hint.k][hint.v > 0? 1 : 0]) && full[hint.k] === hint.v)) && !/Defensive|Attacking|Balanced/.test(rep), 'it is one true thing about how they play, and never their mentality or their whole plan');
    // 4. the match and the figures after it
    await H.preseason(); await H.click('[data-a="play"]', 150); await H.throughMatchday('instant');
    const m = S.results.userMatch; const us = m.home.id === u.id; const mine = us? m.tH : m.tA;
    ok(mine.m === 1 && mine.p === -1 && mine.r === 1 && mine.s === 0, 'the match was played to the plan set on the screen');
    const figs = (H.d.querySelector('.figs') || {}).textContent || ''; const ph = Math.round(100*m.poss), f = x => (Math.round(10*x)/10).toFixed(1);
    ok(figs.includes(`${m.home.short} ${ph}%`) && figs.includes(`${m.away.short} ${100 - ph}%`) && figs.includes(`${m.home.short} ${f(m.xgH)} goals`) && figs.includes(`${m.away.short} ${f(m.xgA)}`), 'after the match: each side\'s share of the ball and what its chances were worth, as the match record has them (' + figs.slice(0, 96) + ')');
    ok(/match engine's own figures, not a count of passes or shots/.test(figs) && !/xG|expected goals/i.test(figs), 'and it says where the figures come from, in plain words');
    const kept = st.userResults[st.week - 1]; ok(kept && kept.poss === (us? ph : 100 - ph) && kept.plan.m === 1, 'the manager\'s result keeps them');
    if (H.has('[data-a="continue-week"]')) await H.click('[data-a="continue-week"]', 60);
    // the way back to the easy default
    await H.click('[data-nav="squad"]'); await H.click('[data-a="planreset"]');
    ok(u.tactics === undefined && /All Balanced\./.test(H.text()) && !H.has('[data-a="planreset"]') && /Back to all Balanced/.test(H.toast()), 'one tap puts everything back to Balanced');
    // How to play explains it
    await H.click('[data-nav="home"]'); await H.click('[data-a="help"]'); ok(/The match plan/.test(H.text()) && /something for it and something against it/.test(H.text()) && /not a count of passes or shots/.test(H.text()), 'How to play has the match plan');
    ok(H.errors.length === 0, 'no errors on the wide screen: ' + H.errors.join(' | '));
    console.log('one manager, wide screen: the card, every setting explained and checked against the engine, Home, the match played to the plan, the figures after it');
    console.log('   Home said of ' + nf.opp.name + ': "' + rep + '" (its style in full: passing ' + full.p + ', pressing ' + full.r + ', shooting ' + full.s + ')');
    console.log('   after the match: "' + figs + '"');
  }

  // ---- 5. a phone-width screen ----
  {
    const H = boot({ pre: w => { Object.defineProperty(w, 'innerWidth', { value: 390, configurable: true }); } }); await H.start(['John']); const st = await seeded(H, 19911119, 50); const E = H.app().E, u = st.clubs[st.userClub];
    await H.click('[data-nav="squad"]');
    ok(H.has('section.plan') && q(H, '[data-a="tactic"]').length === 0 && /All Balanced\./.test(H.text()) && H.d.querySelector('[data-a="planopen"]').textContent.trim() === 'Change', 'on a phone the card is one line with a Change button');
    await H.click('[data-a="planopen"]'); ok(q(H, '[data-a="tactic"]').length === 12 && H.d.querySelector('[data-a="planopen"]').textContent.trim() === 'Close', 'one tap opens it');
    await H.click(tac('r', -1)); await H.click('[data-a="planopen"]'); ok(/Low press\./.test(H.text()) && E.planOf(u).r === -1 && q(H, '[data-a="tactic"]').length === 0, 'set, closed, and the line says what was chosen');
    // a week played without ever opening the card again
    await H.click('[data-nav="home"]'); await H.playWeek('instant'); ok(st.week === 2 && H.errors.length === 0, 'and the week plays on: ' + H.errors.join(' | '));
    console.log('phone width: the card is one line until opened');
  }

  // ---- 6. hot-seat ----
  {
    const H = boot(); await H.start(['Ann', 'Bob']); const S = H.app().S, E = H.app().E, st = S.state; const [ca, cb] = st.managers.map(m => st.clubs[m.userClub]);
    const turn = async () => { if (H.has('[data-a="taketurn"]')) await H.click('[data-a="taketurn"]'); await H.preseason(); };
    await turn(); ok(st.clubs[st.userClub] === ca, 'Ann first'); await H.click('[data-nav="squad"]'); await H.click(tac('m', 1)); await H.click(tac('s', 1)); await H.click('[data-nav="home"]'); await H.click('[data-a="ready"]', 120);
    await turn(); ok(st.clubs[st.userClub] === cb, 'then Bob'); await H.click('[data-nav="squad"]');
    ok(q(H, '[data-a="tactic"].on').every(b => b.dataset.v === '0') && /All Balanced\./.test(H.text()), 'Bob sees his own plan, all Balanced, not Ann\'s');
    await H.click(tac('p', 1)); ok(JSON.stringify(E.planOf(ca)) === '{"m":1,"p":0,"r":0,"s":1}' && JSON.stringify(E.planOf(cb)) === '{"m":0,"p":1,"r":0,"s":0}', 'each plan is on its own club');
    await H.click('[data-nav="home"]'); await H.click('[data-a="ready"]', 150);
    for (let i = 0; i < 6 && !H.has('[data-a="nextround"]'); i++){ if (H.has('[data-a="taketurn"]')) await H.click('[data-a="taketurn"]'); await H.throughMatchday('instant'); }
    const ra = S.results.results.find(x => x.home.id === ca.id || x.away.id === ca.id), rb = S.results.results.find(x => x.home.id === cb.id || x.away.id === cb.id);
    ok(ra && rb && (ra.home.id === ca.id? ra.tH : ra.tA).m === 1 && (rb.home.id === cb.id? rb.tH : rb.tA).p === 1 && (rb.home.id === cb.id? rb.tH : rb.tA).m === 0, 'each manager\'s match was played to his own plan');
    ok(q(H, '.figs2').length === 2 && /Ball \d+% to \d+%\. Chances worth \d\.\d goals to \d\.\d\./.test(q(H, '.figs2')[0].textContent) && /home side first/.test(H.text()) && /not a count of passes or shots/.test(H.text()), 'the week\'s summary gives each manager\'s figures in short, and says where they come from');
    // a club with a human manager has no reputation to read
    ok(E.styleHint(st, ca) === null && E.styleHint(st, cb) === null, 'a human manager\'s club is known for nothing: the other manager cannot read it');
    ok(H.errors.length === 0, 'no errors in the hot-seat game: ' + H.errors.join(' | '));
    console.log('hot-seat: each manager sees, sets and plays his own plan');
  }

  // ---- 7. an old save, and the 1.7.1 rules ----
  {
    const H = boot(); await H.start(['John']); const A = H.app(); const old = Eold.newGame({ seed: 77, userClub: 40 }); for (let i = 0; i < 5; i++) Eold.advanceWeek(old);
    A.S.state = A.E.restore(JSON.parse(JSON.stringify(old))); A.go('home'); await H.sleep(80); const st = A.S.state, u = st.clubs[st.userClub];
    await H.click('[data-nav="squad"]'); ok(/All Balanced\./.test(H.text()) && u.tactics === undefined && st.v === 4, 'a save from 1.7.1 opens all Balanced, in format 4, with nothing written to it');
    await H.click(tac('m', -1)); await H.click('[data-nav="home"]'); await H.playWeek('instant'); ok(st.week === 7 && A.E.planOf(u).m === -1 && H.errors.length === 0, 'a plan set on it is used and the game plays on: ' + H.errors.join(' | '));
    const back = Eold.restore(JSON.parse(JSON.stringify(Object.assign({}, st, { lastResults: null, lastWeek: null })))); Eold.advanceWeek(back); ok(back.week === 8, 'and that save, plan and all, opens in the 1.7.1 engine and plays on');
  }
  {
    const H = boot({ url: 'http://localhost/?rules=1.7' }); await H.start(['John']); const st = await seeded(H, 19911119, 50);
    await H.click('[data-nav="squad"]'); ok(!H.has('section.plan') && !H.has('[data-a="tactic"]') && !/Match plan/.test(H.text()), 'with the 1.7.1 rules there is no plan card');
    await H.click('[data-nav="home"]'); ok(!/Match plan|Known for|Not known for/.test(H.text()), 'nor a plan or a reputation on Home');
    await H.playWeek('instant'); ok(!H.has('.figs') && st.week === 2, 'nor figures after the match');
    await H.click('[data-a="help"]'); ok(!/The match plan/.test(H.text()), 'nor a section in How to play'); ok(H.errors.length === 0, 'no errors: ' + H.errors.join(' | '));
    console.log('an old save opens all Balanced and plays on; with the 1.7.1 rules nothing of tactics is shown');
  }
  console.log(fails? `\n${fails} FAILURES of ${checks} checks` : `\nTACTICS SCREENS OK (${checks} checks)`); process.exit(fails? 1 : 0);
})().catch(e => { console.error('TEST FAIL', e.stack || e.message); process.exit(1); });
