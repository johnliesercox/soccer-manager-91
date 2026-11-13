// ============================================================================
//  Matchday: UI integration
//  Wires the viewer into the existing screens. The game shell calls
//  Matchday.ui.install(ctx) once with the handful of helpers it already has
//  (state, screens table, go/render, formatting), then hands every finished
//  week to Matchday.ui.startWeek(). Everything here is presentation flow:
//  it reads results the engine has already applied and saved, and never
//  calls playMatch, advanceWeek or touches the save.
//
//  Flow per week (after advanceWeek + save):
//    single manager:  matchpick -> (matchview ->) matchresult, per match, then weekdone
//    hot-seat:        for each manager with a game: pass -> matchpick -> ... ; then weekmulti
// ============================================================================
(function(root){
  const MD = root.Matchday; const EV = MD.EVENT;
  const VIEW_KEY = 'sm91-matchday-view';
  let C = null;   // context from the shell

  const VIEW_ORDER = ['pixelart', 'canvas2d', 'wireframe'];
  const getView = () => { try { const v = root.localStorage.getItem(VIEW_KEY); return (v && MD.renderers[v])? v : 'pixelart'; } catch(e){ return 'pixelart'; } };
  const setView = v => { try { root.localStorage.setItem(VIEW_KEY, v); } catch(e){} };
  const reducedMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function compLabel(m, week){
    const E = C.E;
    if (m.euro) return `${C.euroComp(m.euro.comp).name} ${E.euroRoundName(m.euro.comp, m.euro.round)}${m.euro.leg? ', '+(m.euro.leg===1?'first':'second')+' leg' : m.euro.final? ' final' : ''}`;
    if (m.cup!==undefined) return `${E.CFG.CUPS[m.cupKey].name} ${E.CUP_ROUND_NAMES[m.cup]}`;
    return `League, week ${week}`;
  }
  function matchesFor(results, clubId){
    const a = results.find(m=>!m.euro && (m.home.id===clubId||m.away.id===clubId)) || null;
    const b = results.find(m=>m.euro && (m.home.id===clubId||m.away.id===clubId)) || null;
    return [a,b].filter(Boolean);
  }

  // ---------- week flow ----------
  function startWeek(){
    const S = C.S, st = S.state, E = C.E;
    const results = S.results.results;
    let round;
    if (C.multi()) round = E.activeManagers(st).map(m=>st.managers.indexOf(m)).filter(i=>matchesFor(results, st.managers[i].userClub).length);
    else round = [st.cur];
    S.md = { round, ri: -1, queue: [], passing: false, viewer: null, current: null };
    nextManager();
  }
  function nextManager(){
    const S = C.S, st = S.state, E = C.E;
    const md = S.md; md.ri++;
    if (md.ri >= md.round.length){
      if (C.multi()){ C.go('weekmulti'); return; }
      const u = C.user(); const ms = matchesFor(S.results.results, u.id);
      S.results.userMatch = ms.find(m=>!m.euro) || null; S.results.euroMatch = ms.find(m=>m.euro) || null;
      C.go('weekdone'); return;
    }
    const idx = md.round[md.ri];
    if (C.multi()){ E.saveCurrent(st); E.setCurrent(st, idx); md.passing = true; C.go('pass'); }
    else startManager();
  }
  function afterPass(){ C.S.md.passing = false; startManager(); }
  function startManager(){
    const S = C.S; const u = C.user();
    S.md.queue = matchesFor(S.results.results, u.id).map(m=>({ m }));
    nextMatch();
  }
  function nextMatch(){ const S = C.S; if (!S.md.queue.length) nextManager(); else C.go('matchpick'); }

  // ---------- viewer ----------
  function openViewer(m){
    const S = C.S, st = S.state;
    let pres;
    try { pres = MD.withTimeline(MD.capture(st, m, st.lastWeekInfo)); }
    catch(err){ console.error('matchday capture failed', err); return null; }
    // the football is planned once, up front (a few hundred milliseconds); the screen opens first so
    // the tap feels immediate, then the plan is built and playback starts
    const v = { pres, scene: null, renderer: null, playback: null, lastDraw: 0, reduced: reducedMotion(), done: false, stat: {}, building: true };
    S.md.viewer = v;
    C.go('matchview');
    const commEl = C.$('#md-comm'); if (commEl) commEl.textContent = 'Preparing the match...';
    root.setTimeout(() => { if (S.md.viewer!==v) return; try { startViewer(v, m); } catch(err){ console.error('matchday build failed', err); C.toast('Could not build the match view. Showing the result.'); act('md-fulltime', {}); } }, 30);
    return v;
  }
  function startViewer(v, m){
    const S = C.S; const pres = v.pres;
    const t0 = (root.performance && root.performance.now)? root.performance.now() : Date.now();
    const scene = MD.createScene(pres); v.scene = scene; v.building = false;
    v.stat.buildMs = Math.round(((root.performance && root.performance.now)? root.performance.now() : Date.now()) - t0);
    mountRenderer(getView());
    const us = C.user(); const usHome = pres.teams.home.clubId===us.id;
    const log = C.$('#md-log'), comm = C.$('#md-comm');
    const lineFor = (e, score) => {
      const team = e.teamId===pres.teams.home.id? pres.teams.home : e.teamId===pres.teams.away.id? pres.teams.away : null;
      const ours = team && team.clubId===us.id;
      const min = e.minute || Math.min(120, Math.floor(e.matchSecond/60)+1);
      switch (e.type){
        case EV.GOAL: return { cls: ours? 'us':'', html: `${min}' GOAL ${C.esc(e.playerName||'')} (${C.esc(team.short)}) ${score.home}-${score.away}` };
        case EV.CARD: return { cls: ours? 'us':'', html: `<span class="dim">${min}'</span> ${e.card==='red'? '<span class="mark">RED CARD</span>' : 'Booked'} ${C.esc(e.playerName||'')} (${C.esc(team.short)})` };
        case EV.HALF_TIME: return { cls:'dim', html: `Half-time ${score.home}-${score.away}` };
        case EV.FULL_TIME: return { cls:'dim', html: C.esc(e.text) };
        case EV.ET_START: return e.matchSecond===5400? { cls:'dim', html:'Extra time' } : null;
        case EV.ET_END: return { cls:'dim', html: `End of extra time ${score.home}-${score.away}` };
        case EV.SHOOTOUT_RESULT: return { cls: ours? 'us':'', html: C.esc(e.text) };
        default: return null;
      }
    };
    let lastBoard = '';
    const board = (s, drawn, ff) => {
      const onBall = drawn && drawn.ball.carrierId? drawn.players.find(x=>x.id===drawn.ball.carrierId) : null;
      const key = s.clock.label+'|'+s.score.home+'|'+s.score.away+'|'+s.phaseLabel+'|'+(onBall? onBall.id : '')+'|'+(ff? 1:0);
      if (key===lastBoard) return; lastBoard = key;
      const sc = C.$('#md-score'); if (sc) sc.textContent = s.score.home+' - '+s.score.away;
      const ck = C.$('#md-clock'); if (ck){ ck.textContent = (ff? '\u25B6\u25B6 ' : '')+s.clock.label+(s.clock.extraTime? ' ET' : '')+'  '+s.phaseLabel+(onBall && !ff? '  \u00b7  '+onBall.name : ''); ck.classList.toggle('ff', !!ff); }
    };
    v.playback = MD.createPlayback(pres, {
      onFrame: (sec, state) => {
        const now = (root.performance && root.performance.now)? root.performance.now() : Date.now();
        if (v.reduced && now - v.lastDraw < 200 && !state.ended) return;
        v.lastDraw = now;
        const s = scene.getSceneAt(state.sceneSecond===undefined? sec : state.sceneSecond);   // the picture
        if (v.renderer) v.renderer.render(s, { fastForward: state.fastForward, speed: state.speed, reducedMotion: v.reduced, sinceCut: state.sinceCut });
        board(scene.getSceneAt(sec), s, state.fastForward);                                     // the clock and score (the clock races during a fast-forward)
      },
      onEvent: (e) => {
        if (e.text && comm){ comm.textContent = e.text; }
        const s = scene.getSceneAt(e.matchSecond);
        const line = lineFor(e, s.score);
        if (line && log){ log.insertAdjacentHTML('beforeend', `<div class="${line.cls}">${line.html}</div>`); log.scrollTop = log.scrollHeight; }
        if (e.type===EV.GOAL) MD.audio.goal();
        else if (e.type===EV.KICK_OFF || e.type===EV.SECOND_HALF || e.type===EV.ET_START) MD.audio.whistle('start');
        else if (e.type===EV.HALF_TIME || e.type===EV.ET_HALF || e.type===EV.ET_END) MD.audio.whistle('half');
        else if (e.type===EV.FULL_TIME) MD.audio.whistle('end');
        else if (e.type===EV.SHOT_SAVED || e.type===EV.SHOT_WIDE) MD.audio.chance();
      },
      onState: (state) => { const b = C.$('#md-play'); if (b) b.textContent = state.playing? 'Pause' : (state.ended? 'Ended' : 'Play'); for (const x of [1,2,4]){ const sb = C.$('#md-speed-'+x); if (sb) sb.classList.toggle('on', state.speed===x); } },
      onEnd: () => { v.done = true; MD.audio.stop(); const act = C.$('#act'); if (act) act.innerHTML = `<button class="b" data-a="md-fulltime">Full time</button>`; },
    });
    MD.audio.start();
    v.playback.play();
    if (C.Track) C.Track.send('match_watched', { competition: pres.competition.kind, extra: pres.official.extra||'none', view: getView(), reduced_motion: v.reduced, build_ms: v.stat.buildMs });
  }
  function mountRenderer(id){
    const v = C.S.md && C.S.md.viewer; if (!v) return;
    const stage = C.$('#md-stage'); if (!stage) return;
    if (v.renderer){ try { v.renderer.dispose(); } catch(e){} v.renderer = null; }
    const def = MD.renderers[id] || MD.renderers.pixelart;
    v.renderer = def.create({ onSelect: pl => { const comm = C.$('#md-comm'); if (comm) comm.textContent = pl.name+', '+({GK:'goalkeeper',DEF:'defender',MID:'midfielder',FWD:'forward'}[pl.role]||pl.role)+', number '+pl.shirtNo+'.'; } });
    v.renderer.mount(stage, v.pres);
    const cb = C.$('#md-camera'); if (cb){ const has = typeof v.renderer.setCamera==='function'; cb.style.display = has? '' : 'none'; if (has) cb.textContent = 'Camera: '+(v.renderer.getCamera()==='follow'? 'follow' : 'whole'); }
    const state = v.playback? v.playback.state() : { matchSecond:0, sceneSecond:0, fastForward:false, speed:1 };
    if (v.scene) v.renderer.render(v.scene.getSceneAt(state.sceneSecond===undefined? state.matchSecond : state.sceneSecond), { fastForward: state.fastForward, speed: state.speed, reducedMotion: v.reduced });
    const vb = C.$('#md-view'); if (vb) vb.textContent = 'View: '+def.name;
  }
  function closeViewer(){
    const S = C.S; const v = S.md && S.md.viewer; if (!v) return;
    try { if (v.playback) v.playback.dispose(); } catch(e){}
    try { if (v.renderer) v.renderer.dispose(); } catch(e){}
    MD.audio.stop();
    S.md.viewer = null;
  }

  // ---------- screens ----------
  function screens(){
    const S = C.S, E = C.E, esc = C.esc;
    return {
      matchpick(){
        const st = S.state, u = C.user(); const q = S.md.queue[0]; const m = q.m;
        const us = m.home.id===u.id;
        const where = m.euro && m.euro.final? 'Neutral ground' : m.neutral? 'Neutral ground' : us? 'At home' : 'Away';
        const reduced = reducedMotion();
        return { main: `<h1>Matchday</h1><p class="dim">${compLabel(m, S.results.week)}. ${where}.</p>
          <div class="md-tie"><span class="${us?'hot':''}">${esc(m.home.name)}</span><br><span class="dim" style="font-size:14px">v</span><br><span class="${!us?'hot':''}">${esc(m.away.name)}</span></div>
          <button class="b" data-a="md-watch">Watch the match<br><span class="dim">About a minute and a half${reduced? ', with reduced motion' : ''}. Skip to the result at any time.</span></button>
          <button class="b" data-a="md-instant">Instant result</button>
          ${C.multi()? `<p class="dim">${esc(C.mgr().managerName)}'s game. Nobody else's result is shown until everyone has had their turn.</p>` : ''}` };
      },
      matchview(){
        const v = S.md.viewer; const p = v.pres; const u = C.user();
        const usH = p.teams.home.clubId===u.id;
        const sound = MD.audio.enabled;
        return { main: `<div class="md-wrap"><div class="md-board"><span class="t ${usH?'hot':''}">${esc(p.teams.home.short)}</span><span class="s" id="md-score" aria-live="polite">0 - 0</span><span class="t a ${!usH?'hot':''}">${esc(p.teams.away.short)}</span></div>
          <div class="md-clock" id="md-clock">00:00  Kick-off</div>
          <div class="md-stage" id="md-stage"></div>
          <div class="md-comm" id="md-comm" aria-live="polite" role="status">${esc(compLabel(S.md.queue[0].m, S.results.week))}${p.official.attendance? ' Attendance '+E.fmt(p.official.attendance)+'.' : ''}</div>
          <div class="md-log" id="md-log" aria-label="Match events"></div>
          <div class="md-controls2"><button class="b quiet" data-a="md-camera" id="md-camera">Camera</button><button class="b quiet" data-a="md-view" id="md-view">View</button><button class="b quiet" data-a="md-sound" id="md-sound" aria-pressed="${sound}">Sound: ${sound? 'on' : 'off'}</button></div></div>`,
          action: `<div class="md-controls"><button class="b" data-a="md-play" id="md-play" aria-label="Play or pause">Pause</button><button class="b quiet on" data-a="md-speed" data-s="1" id="md-speed-1" aria-label="Normal speed">1x</button><button class="b quiet" data-a="md-speed" data-s="2" id="md-speed-2" aria-label="Double speed">2x</button><button class="b quiet" data-a="md-speed" data-s="4" id="md-speed-4" aria-label="Four times speed">4x</button><button class="b quiet" data-a="md-skip">Skip</button></div>` };
      },
      matchresult(){
        const m = S.md.current; const u = C.user(); const us = m.home.id===u.id;
        const res = m.gH===m.gA && !m.extra? 'Draw' : (m.gH>m.gA || m.extra==='pens-H')===us? 'Win' : 'Defeat';
        const title = m.euro? (m.winner!==undefined? (m.winner===u.id? 'Through' : 'Out') : res) : res;
        const scorers = m.scorers.map(s=>`<div class="${(s.side==='H')===us?'us':''}">${s.min}' GOAL ${esc(s.p.name)} (${esc(s.side==='H'?m.home.short:m.away.short)})${s.et? ' <span class="dim">aet</span>' : ''}</div>`).join('');
        let extra = '';
        if (m.extra==='aet') extra = `<div class="dim">After extra time.</div>`;
        else if (m.extra && m.extra.startsWith('pens')) extra = `<div>Level after extra time. ${esc(m.extra==='pens-H'?m.home.short:m.away.short)} win on penalties.</div>`;
        const agg = m.agg? `<div class="dim">Aggregate ${us? (m.home.id===u.id? `${m.agg.b}-${m.agg.a}` : `${m.agg.a}-${m.agg.b}`) : `${m.agg.b}-${m.agg.a}`}.</div>` : '';
        const reds = (m.cards||[]).filter(c=>c.type==='R').map(c=>`<div class="${(c.side==='H')===us?'us':''}"><span class="mark">Sent off:</span> ${esc(c.p.name)} ${c.min}'</div>`).join('');
        const yellows = (m.cards||[]).filter(c=>c.type==='Y'); const booked = yellows.length? `<div class="dim">Booked: ${yellows.map(c=>esc(c.p.name)).join(', ')}</div>` : '';
        const inj = m.injuries.filter(p=>p.club===u.id);
        return { main: `<p class="dim" style="text-align:center">${compLabel(m, S.results.week)}</p>
          <div class="clock">${title}</div>
          <div class="score"><span class="${us?'hot':''}">${esc(m.home.short)}</span> ${m.gH} - ${m.gA} <span class="${!us?'hot':''}">${esc(m.away.short)}</span><small>Attendance ${E.fmt(m.att)}</small></div>
          <div class="events">${scorers||'<div class="dim">No goals.</div>'}${extra}${agg}${reds}${booked}${inj.length? `<div class="hot">Injured: ${inj.map(p=>esc(p.name)+' ('+p.injury+' wk)').join(', ')}</div>`:''}</div>`,
          action: `<button class="b" data-a="md-continue">Continue</button>` };
      },
    };
  }

  // ---------- actions ----------
  async function act(a, d){
    const S = C.S;
    const v = S.md && S.md.viewer;
    switch (a){
      case 'md-watch': { const q = S.md.queue[0]; const ok = openViewer(q.m); if (!ok){ C.toast('Could not build the match view. Showing the result.'); S.md.current = S.md.queue.shift().m; C.go('matchresult'); } break; }
      case 'md-instant': { S.md.current = S.md.queue.shift().m; if (C.Track) C.Track.send('match_instant', {}); C.go('matchresult'); break; }
      case 'md-fulltime': { closeViewer(); S.md.current = S.md.queue.shift().m; C.go('matchresult'); break; }
      case 'md-continue': nextMatch(); break;
      case 'md-play': if (v && v.playback && !v.done) v.playback.toggle(); break;
      case 'md-speed': if (v && v.playback) v.playback.setSpeed(+d.s); break;
      case 'md-skip': if (v && v.playback && !v.done) v.playback.skip(); break;
      case 'md-sound': { MD.audio.setEnabled(!MD.audio.enabled); const b = C.$('#md-sound'); if (b){ b.textContent = 'Sound: '+(MD.audio.enabled? 'on' : 'off'); b.setAttribute('aria-pressed', String(MD.audio.enabled)); } if (MD.audio.enabled && v && !v.done) MD.audio.start(); break; }
      case 'md-view': { const ids = VIEW_ORDER.filter(k=>MD.renderers[k]).concat(Object.keys(MD.renderers).filter(k=>k!=='common' && !VIEW_ORDER.includes(k))); const cur = getView(); const next = ids[(ids.indexOf(cur)+1)%ids.length]; setView(next); mountRenderer(next); break; }
      case 'md-camera': { if (v && v.renderer && v.renderer.setCamera){ const mode = v.renderer.setCamera(v.renderer.getCamera()==='follow'? 'whole' : 'follow'); const cb = C.$('#md-camera'); if (cb) cb.textContent = 'Camera: '+(mode==='follow'? 'follow' : 'whole'); } break; }
    }
  }
  function onKey(e){
    const S = C.S; if (S.screen!=='matchview' || !S.md || !S.md.viewer) return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.key===' '){ e.preventDefault(); act('md-play', {}); }
    else if (e.key==='s' || e.key==='S') act('md-skip', {});
    else if (e.key==='1' || e.key==='2' || e.key==='4') act('md-speed', { s: e.key });
  }

  function install(ctx){
    C = ctx;
    Object.assign(C.SCREENS, screens());
    root.document.addEventListener('keydown', onKey);
  }

  MD.ui = { install, startWeek, afterPass, act, closeViewer, mountRenderer, getView, compLabel, matchesFor };
})(typeof window!=='undefined'? window : globalThis);
