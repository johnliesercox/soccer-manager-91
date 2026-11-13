const { boot } = require('./harness.js');
(async()=>{
  const H = boot();
  await H.start(['John']);
  const st = H.app().S.state; const E = H.app().E; const u = st.clubs[st.userClub];
  // squad screen shows contract tags
  await H.click('[data-nav="squad"]'); console.log('squad row sample:', H.d.querySelector('tr[data-a="toggle"] td.wrap').textContent.replace(/\s+/g,' ').trim());
  // open the best player, offer a contract below ask then at ask
  const best = E.squadOf(st,u).sort((a,b)=>b.skill-a.skill)[0];
  await H.click(`[data-a="player"][data-id="${best.id}"]`); console.log('player page has contract panel:', H.text().includes('Contract') && H.has('#cwage'), '| mood/discipline rows:', /Mood/.test(H.text()) && /Discipline/.test(H.text()));
  const ask = E.contractAsk(st, best);
  H.d.querySelector('#cwage').value = String(Math.round(ask*0.6)); await H.click('[data-a="cyears"][data-y="4"]'); await H.click(`[data-a="contract"][data-id="${best.id}"]`, 80); console.log('low offer:', H.toast());
  st.week++; // negotiations are once a week
  H.d.querySelector('#cwage').value = String(ask); await H.click(`[data-a="contract"][data-id="${best.id}"]`, 80); console.log('ask offer:', H.toast(), '| years', best.years, 'wage', best.wage);
  st.week--;
  // let go toggle on an expiring player
  await H.click('[data-a="back"]');
  const exp = E.squadOf(st,u).find(p=>p.years<=1 && p.id!==best.id);
  if (exp){ await H.click(`[data-a="player"][data-id="${exp.id}"]`); await H.click(`[data-a="letgo"][data-id="${exp.id}"]`, 80); console.log('let go:', H.toast(), '| flag', exp.letGo); await H.click('[data-a="back"]'); }
  // release with two taps
  const fringe = E.squadOf(st,u).sort((a,b)=>a.skill-b.skill)[0]; u.balance = 500000;
  await H.click(`[data-a="player"][data-id="${fringe.id}"]`); await H.click(`[data-a="release"][data-id="${fringe.id}"]`); await H.click(`[data-a="release"][data-id="${fringe.id}"]`, 80); console.log('release:', H.toast(), '| squad', u.players.length, '| he is free agent:', fringe.club===-2);
  // free agents tab, sign him back
  await H.click('[data-nav="transfers"]'); await H.click('[data-a="ttab"][data-t="free"]'); console.log('free tab:', H.text().slice(0,80), '| rows', H.d.querySelectorAll('tr[data-a="player"]').length);
  await H.click(`tr[data-a="player"][data-id="${fringe.id}"]`); console.log('free agent page:', H.text().slice(0,60), '| has sign:', H.has('[data-a="signfree"]'));
  H.d.querySelector('#cwage').value = String(E.contractAsk(st, fringe)); await H.click(`[data-a="signfree"][data-id="${fringe.id}"]`, 100); console.log('sign:', H.toast(), '| back in squad', fringe.club===u.id, '| screen', H.text().slice(0,20));
  // play a season and a bit, make sure cards show and bans happen
  await H.click('[data-nav="home"]');
  let cardsSeen = 0, bansSeen = 0;
  for (let i=0;i<45;i++){ await H.settle(); if (!H.has('[data-a="play"]')) continue; await H.preseason(); await H.click('[data-a="play"]', 150); if (H.has('[data-a="afteranim"]')){ const t = H.text(); if (/Booked|RED CARD|Sent off/.test(t)) cardsSeen++; await H.click('[data-a="afteranim"]'); } if (/Suspended:/.test(H.text())) bansSeen++; if (H.has('[data-a="continue-week"]')) await H.click('[data-a="continue-week"]', 60); }
  console.log('weeks with cards on match screen', cardsSeen, '| weeks with a suspension line', bansSeen, '| season', st.season, 'week', st.week);
  await H.settle(); console.log('news sample:', (st.news||[]).slice(0,5).map(n=>n.text).join(' | '));
  console.log('errors:', H.errors.length? H.errors : 'none');
})().catch(e=>{ console.error('TEST FAIL', e.message); process.exit(1); });
