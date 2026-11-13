'use strict';
// Matchday Milestone D: the viewer inside the real UI (jsdom), single and hot-seat.
const { boot } = require('./harness.js');
let fails = 0; const ok = (c, msg) => { if (!c){ fails++; console.log('FAIL', msg); } };
(async()=>{
  // ---- single manager: watch, controls, skip, result, then instant ----
  {
    const H = boot({ realCanvas:false }); await H.start(['John']);
    const app = H.app(); const S = app.S, E = app.E; const st = S.state;
    const u = st.clubs[st.userClub]; const bal0 = u.balance, wk0 = st.week;
    await H.preseason();
    await H.click('[data-a="play"]', 150);
    ok(S.screen==='matchpick', 'matchpick after play, got '+S.screen);
    ok(!/\d+\s*-\s*\d+/.test(H.text().replace(/week \d+/i,'')), 'no score on the pick screen: '+H.text().slice(0,120));
    const m = S.md.queue[0].m;
    const snapshot = JSON.stringify({ gH:m.gH, gA:m.gA, sc:m.scorers.map(s=>s.p.id+':'+s.min), inj:m.injuries.map(p=>p.id), bal:u.balance, week:st.week, goals: E.squadOf(st,u).map(p=>p.goals) });
    await H.click('[data-a="md-watch"]', 120);
    ok(S.screen==='matchview', 'matchview open');
    ok(H.has('canvas.md-canvas'), 'renderer mounted a canvas');
    const v = S.md.viewer; ok(v && v.playback && v.playback.state().playing, 'playback running');
    ok(H.d.querySelector('#md-score').textContent.trim()==='0 - 0', 'score hidden at kick-off');
    await H.click('[data-a="md-play"]', 40); ok(!v.playback.state().playing, 'pause works');
    await H.click('[data-a="md-play"]', 40); ok(v.playback.state().playing, 'resume works');
    await H.click('[data-a="md-speed"][data-s="4"]', 40); ok(v.playback.state().speed===4, 'speed 4x');
    ok(S.md.viewer.renderer.id==='pixelart', 'pixel art is the default view ('+S.md.viewer.renderer.id+')');
    ok(H.d.querySelector('#md-camera').textContent.includes('follow'), 'camera button shows follow mode');
    await H.click('[data-a="md-camera"]', 40); ok(S.md.viewer.renderer.getCamera()==='whole' && H.d.querySelector('#md-camera').textContent.includes('whole'), 'camera toggles to whole pitch');
    await H.click('[data-a="md-camera"]', 40); ok(S.md.viewer.renderer.getCamera()==='follow', 'camera toggles back');
    await H.click('[data-a="md-view"]', 60); ok(S.md.viewer.renderer.id==='canvas2d', 'renderer swapped to '+S.md.viewer.renderer.id);
    ok(H.d.querySelector('#md-camera').style.display==='none', 'camera button hidden for a renderer without a camera');
    await H.click('[data-a="md-view"]', 60); ok(S.md.viewer.renderer.id==='wireframe', 'renderer swapped on to '+S.md.viewer.renderer.id);
    await H.click('[data-a="md-view"]', 60); ok(S.md.viewer.renderer.id==='pixelart', 'renderer cycles back to pixel art');
    await H.click('[data-a="md-sound"]', 40); ok(H.d.querySelector('#md-sound').textContent.includes('on'), 'sound toggled on');
    await H.click('[data-a="md-sound"]', 40); ok(H.d.querySelector('#md-sound').textContent.includes('off'), 'sound toggled off');
    await H.sleep(300);
    await H.click('[data-a="md-skip"]', 120);
    ok(H.has('[data-a="md-fulltime"]'), 'full time button after skip');
    ok(H.d.querySelector('#md-score').textContent.trim()===`${m.gH} - ${m.gA}`, 'board shows the official score after skip: '+H.d.querySelector('#md-score').textContent);
    const logGoals = H.d.querySelectorAll('#md-log div').length;
    ok(logGoals>=m.scorers.length, 'event log has the goals');
    await H.click('[data-a="md-fulltime"]', 60);
    ok(S.screen==='matchresult', 'result card');
    ok(H.text().includes(`${m.gH} - ${m.gA}`), 'result card shows the score');
    ok(!S.md.viewer, 'viewer disposed');
    ok(!H.has('canvas'), 'canvas removed');
    const after = JSON.stringify({ gH:m.gH, gA:m.gA, sc:m.scorers.map(s=>s.p.id+':'+s.min), inj:m.injuries.map(p=>p.id), bal:u.balance, week:st.week, goals: E.squadOf(st,u).map(p=>p.goals) });
    ok(snapshot===after, 'watching changed nothing in the game state');
    await H.click('[data-a="md-continue"]', 60);
    ok(S.screen==='weekdone', 'weekdone after the queue, got '+S.screen);
    ok(st.week===wk0+1, 'one week advanced');
    await H.click('[data-a="continue-week"]', 60);
    // next week instant
    await H.click('[data-a="play"]', 150); ok(S.screen==='matchpick', 'pick again');
    await H.click('[data-a="md-instant"]', 60); ok(S.screen==='matchresult', 'instant result');
    await H.click('[data-a="md-continue"]', 60); ok(S.screen==='weekdone', 'weekdone after instant');
    // a saved game resumes normally
    const saved = H.w.localStorage.getItem('sm91-save'); ok(saved && saved.length>1000, 'save present');
    console.log('single-manager flow ok; errors:', H.errors.length? H.errors : 'none');
    ok(H.errors.length===0, 'no console errors');
  }
  // ---- hot-seat: each manager gets their own matchday, no leakage ----
  {
    const H = boot(); await H.start(['Ann','Bob','Cat']);
    const app = H.app(); const S = app.S, E = app.E; const st = S.state;
    // each manager readies up
    for (let i=0;i<3;i++){ if (H.has('[data-a="taketurn"]')) await H.click('[data-a="taketurn"]'); await H.preseason(); await H.click('[data-a="ready"]', 150); }
    ok(S.screen==='pass' && H.text().includes('Matchday'), 'matchday pass screen first: '+S.screen+' '+H.text().slice(0,80));
    const order = [];
    for (let i=0;i<3;i++){
      const name = st.managers[st.cur].managerName; order.push(name);
      ok(H.text().includes(name), 'pass screen names '+name);
      await H.click('[data-a="taketurn"]', 60);
      ok(S.screen==='matchpick', 'pick for '+name);
      const txt = H.text();
      const mine = S.md.queue[0].m; const inTie = [mine.home.name, mine.away.name];   // a human v human fixture legitimately names both
      const others = st.managers.filter(m=>m.managerName!==name).map(m=>st.clubs[m.userClub].name).filter(n=>!inTie.includes(n));
      ok(!others.some(n=>txt.includes(n)), 'no other manager\'s club on the pick screen');
      if (i===1){ await H.click('[data-a="md-watch"]', 100); ok(S.screen==='matchview', 'Bob watches'); await H.click('[data-a="md-skip"]', 100); await H.click('[data-a="md-fulltime"]', 60); }
      else await H.click('[data-a="md-instant"]', 60);
      ok(S.screen==='matchresult', 'result for '+name);
      ok(!H.text().includes('Matchday'), 'result card not leaking the pass text');
      await H.click('[data-a="md-continue"]', 60);
    }
    ok(S.screen==='weekmulti', 'shared results board after the round, got '+S.screen);
    ok(order.join()==='Ann,Bob,Cat', 'managers took the matchday in order: '+order.join());
    await H.click('[data-a="nextround"]', 60);
    ok(S.screen==='pass' && !H.text().includes('Matchday'), 'normal pass screen for the next week');
    console.log('hot-seat flow ok; errors:', H.errors.length? H.errors : 'none');
    ok(H.errors.length===0, 'no console errors (multi)');
  }
  // ---- reduced motion still works ----
  {
    const H = boot({ reduced:true }); await H.start(['Ray']); const S = H.app().S;
    await H.preseason(); await H.click('[data-a="play"]', 150); ok(H.text().includes('reduced motion'), 'pick screen mentions reduced motion');
    await H.click('[data-a="md-watch"]', 100); ok(S.screen==='matchview' && S.md.viewer.reduced, 'viewer in reduced mode');
    await H.sleep(400); await H.click('[data-a="md-skip"]', 100); await H.click('[data-a="md-fulltime"]', 60); await H.click('[data-a="md-continue"]', 60);
    ok(S.screen==='weekdone', 'reduced-motion flow completes');
    ok(H.errors.length===0, 'no console errors (reduced)');
  }
  console.log(fails? `\n${fails} FAILURES` : '\nALL MATCHDAY UI TESTS PASSED');
  process.exit(fails? 1 : 0);
})().catch(e=>{ console.error('TEST FAIL', e.message, e.stack.split('\n').slice(0,3).join('\n')); process.exit(1); });
