const { boot } = require('./harness.js');
(async()=>{
  const H = boot({ file:'/tmp/sm91-ladder-test.html', url:'https://example.github.io/sm91/', capture:true, fetchReply:{ ok:true, rows:[{rank:1,nick:'Ann',score:120,detail:{manager:'Ann',club:'Leeds',division:1,seasons:4}}] } });
  await H.sleep(100);
  await H.click('[data-a="hof"]', 120); console.log('title hof:', H.text().slice(0,90));
  H.d.querySelector('#nick').value = 'Johnny C'; await H.click('[data-a="setnick"]', 120); console.log('nick set:', H.toast(), '| rows shown:', H.d.querySelectorAll('tr').length-1);
  await H.click('[data-a="board"][data-b="fastest_title"]', 120); console.log('board switch:', H.text().includes('Fastest to the title'));
  await H.click('[data-a="hoftab"][data-t="mine"]'); console.log('local tab:', H.text().slice(13,60));
  await H.click('[data-a="title"]'); await H.start(['John']);
  const st = H.app().S.state, E = H.app().E; const m = st.managers[0];
  // fake a decorated career so submissions cover all boards
  m.trophies.fa = 1; m.trophies.ec = 1; m.career.titles[1] = 1; m.career.firstTitle = 1; m.career.firstEuro = 1;
  await H.playSeasons(1);
  const posts = H.sent.filter(x=>/submit/.test(x.url)).map(x=>JSON.parse(x.body)); console.log('posted boards:', posts.map(p=>p.board+'='+p.score).join(', '), '| nick', posts[0] && posts[0].nick, '| sig len', posts[0] && posts[0].sig.length);
  const local = JSON.parse(H.w.localStorage.getItem('sm91-hof')); console.log('local hof entries:', Object.keys(local).length, 'score', Object.values(local)[0].score);
  await H.click('[data-nav="table"]'); await H.click('[data-a="records"]'); console.log('records:', H.text().slice(0,140));
  console.log('has roll of honour:', H.text().includes('Roll of honour'), '| scorers table:', H.text().includes('All-time scorers'));
  await H.click('[data-a="back"]'); await H.click('[data-a="hof"]', 120); console.log('in-game hof:', H.text().slice(0,40));
  // no-URL build: local only, no network
  const H2 = boot({ capture:true }); await H2.sleep(100); await H2.click('[data-a="hof"]', 80); console.log('no-ladder build:', H2.text().slice(0,60), '| network calls', H2.sent.length);
  console.log('errors:', H.errors.length? H.errors : 'none', '|', H2.errors.length? H2.errors : 'none');
})().catch(e=>{ console.error('TEST FAIL', e.message); process.exit(1); });
