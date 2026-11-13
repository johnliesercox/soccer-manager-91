const { boot } = require('./harness.js');
(async()=>{
  const H = boot(); await H.start(['John']);
  const st = H.app().S.state, E = H.app().E, u = st.clubs[st.userClub]; u.balance = 800000;
  await H.click('[data-nav="club"]'); await H.click('[data-a="ctab"][data-t="youth"]'); console.log('youth tab:', H.text().slice(0,120));
  await H.click('[data-a="academy"]', 80); console.log('upgrade:', H.toast(), '|', (H.text().match(/Builders in[^.]+\./)||[''])[0]);
  await H.click('[data-a="ctab"][data-t="staff"]'); console.log('youth coach row:', H.text().includes('Youth coach')); await H.click('[data-a="staff"][data-r="youth"][data-t="3"]', 60); console.log('staff total line:', (H.text().match(/Total [^ ]+ a week/)||[''])[0]);
  await H.click('[data-nav="home"]'); await H.playSeasons(1);
  await H.click('[data-nav="club"]'); await H.click('[data-a="ctab"][data-t="youth"]'); console.log('after a season:', H.text().match(/Youth team \(\d+\/10\)/)[0], '| academy grade line:', H.text().match(/Grade\d of 4/)[0]);
  const rs = E.reservesOf(st,u); console.log('reserves:', rs.map(p=>p.pos+' '+p.skill+'/'+p.pot).join(', '));
  await H.click(`tr[data-a="player"][data-id="${rs[0].id}"]`); console.log('reserve page:', H.text().slice(0,70));
  await H.click(`[data-a="promote"][data-id="${rs[0].id}"]`, 80); console.log('promote:', H.toast(), '| in squad', u.players.includes(rs[0].id), 'wage', rs[0].wage, '| screen', H.text().slice(0,15));
  if (rs[1]){ await H.click(`tr[data-a="player"][data-id="${rs[1].id}"]`); await H.click(`[data-a="releasereserve"][data-id="${rs[1].id}"]`); await H.click(`[data-a="releasereserve"][data-id="${rs[1].id}"]`, 80); console.log('release reserve:', H.toast(), '| reserves now', E.reservesOf(st,u).length); }
  await H.click('[data-nav="club"]'); console.log('money tab shows youth wages:', H.text().includes('Youth wages'));
  console.log('errors:', H.errors.length? H.errors : 'none');
})().catch(e=>{ console.error('TEST FAIL', e.message); process.exit(1); });
