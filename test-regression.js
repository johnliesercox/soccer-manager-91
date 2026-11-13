const { boot } = require('./harness.js');
const fs = require('fs');
(async()=>{
  // 1. single player, eight seasons with contracts handled by renewing worried players at ask
  {
    const H = boot(); await H.start(['John']); const st = H.app().S.state, E = H.app().E;
    for (let s=0;s<8;s++){
      await H.playSeasons(1);
      // renew everyone who is worried, at their ask, like an engaged manager would
      const u = st.clubs[st.userClub]; for (const p of E.squadOf(st,u)) if (p.years<=1 && !p.requested) E.offerContract(st, p.id, E.contractAsk(st,p), 3);
    }
    const u = st.clubs[st.userClub]; const m = st.managers[0];
    console.log('8 seasons:', H.hdr(), '| squad', u.players.length, '| reserves', E.reservesOf(st,u).length, '| career', JSON.stringify(E.careerSummary(st,m).trophies), '| honours', st.honours.length, '| records scorers', E.topClubScorers(st,u,1).map(x=>x.name+' '+x.goals)[0]);
    console.log('   errors:', H.errors.length? H.errors : 'none');
    // save/resume
    const saved = H.w.localStorage.getItem('sm91-save'); console.log('   save size', saved.length, 'v', JSON.parse(saved).v);
    const H2 = boot({ pre: w=>w.localStorage.setItem('sm91-save', saved) }); await H2.sleep(150); await H2.click('[data-a="continue"]', 80); console.log('   resumed:', H2.hdr()); await H2.playWeek(); console.log('   played after resume, errors:', H2.errors.length? H2.errors : 'none');
  }
  // 2. three managers, two seasons, cross bids and a resignation
  {
    const H = boot(); await H.start(['Ann','Bob','Cat']); const st = H.app().S.state, E = H.app().E;
    let turns = 0, matchdays = 0;
    for (let i=0;i<400 && st.season<3;i++){
      await H.throughMatchday('instant');
      if (H.has('[data-a="nextround"]')){ await H.click('[data-a="nextround"]', 50); if (H.has('[data-a="back"]') && H.text().startsWith("Managers' table")) await H.click('[data-a="back"]', 40); continue; }
      if (H.has('[data-a="taketurn"]')){ const matchday = H.text().includes('Matchday'); await H.click('[data-a="taketurn"]'); if (matchday){ await H.throughMatchday(i%3===0? 'watch' : 'instant'); matchdays++; continue; } turns++; }
      if (H.has('[data-a="preseason"]') && H.act().includes('Pre-season')){ await H.preseason(); }
      if (H.has('[data-a="acceptjob"]')) await H.click('[data-a="declinejob"]');
      if (H.has('[data-a="newseason"]')) await H.click('[data-a="newseason"]', 60);
      if (H.has('[data-a="takesack"]')) await H.click('[data-a="takesack"]', 60);
      if (H.has('[data-a="skipladder"]')) await H.click('[data-a="skipladder"]');
      if (turns===2 && H.has('[data-a="ready"]')){ // Bob bids for one of Ann's players
        await H.click('[data-nav="transfers"]'); await H.click('[data-a="ttab"][data-t="scout"]'); const btn = Array.from(H.d.querySelectorAll('[data-a="scoutclub"]')).find(b=>b.textContent.includes('(Ann)')); if (btn){ btn.click(); await H.sleep(30); await H.click('tr[data-a="player"]'); H.d.querySelector('#amt').value='1000'; await H.click('[data-a="bid"]', 60); } await H.click('[data-nav="home"]'); }
      if (turns===4 && H.has('[data-a="ready"]')){ await H.click('[data-nav="transfers"]'); await H.click('[data-a="ttab"][data-t="offers"]'); if (H.has('[data-a="accept"]')) { await H.click('[data-a="accept"]', 60); console.log('   human sale:', H.toast()); } await H.click('[data-nav="home"]'); }
      if (H.has('[data-a="ready"]')) await H.click('[data-a="ready"]', 120);
    }
    console.log('multiplayer: season', st.season, 'turns', turns, 'matchday turns', matchdays, '| active', E.activeManagers(st).length, '| errors:', H.errors.length? H.errors : 'none');
  }
  // 3. migration of a 1.0.4 save
  {
    const Eold = require('./legacy/engine.v104.js'); const old = Eold.newGame({seed: 77}); for (let i=0;i<50;i++) Eold.advanceWeek(old);
    const copy = Object.assign({}, old, { lastResults:null, lastWeek:null, v:3, app:'1.0.4' }); copy.clubs = old.clubs.map(c=>Object.assign({}, c, { xi:null }));
    const saved = JSON.stringify(copy);
    const H = boot({ pre: w=>w.localStorage.setItem('sm91-save', saved) }); await H.sleep(150); await H.click('[data-a="continue"]', 80);
    const st = H.app().S.state, E = H.app().E; const u = st.clubs[st.userClub];
    console.log('migrated 1.0.4 save:', H.hdr(), '| v', st.v, '| players have contracts:', E.squadOf(st,u).every(p=>p.years>=1 && p.morale!==undefined), '| academy', u.academy, '| career', JSON.stringify(E.careerSummary(st, st.managers[0]).clubs));
    await H.playSeasons(1); console.log('   played a season on, now', H.hdr(), '| errors:', H.errors.length? H.errors : 'none');
    await H.click('[data-nav="squad"]'); await H.click('[data-a="player"]'); console.log('   player page ok:', H.text().includes('Contract'));
  }
})().catch(e=>{ console.error('TEST FAIL', e.message, e.stack.split('\n')[1]); process.exit(1); });
