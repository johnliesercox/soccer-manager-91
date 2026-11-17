'use strict';
// Phase 3, Milestone 5: the rare match situations in the isometric view (acceptance A10, B07, B08; manual scenarios 7
// and 9). Two seasons of real matches from a fixed seed supply every case there is: extra time with and without goals,
// penalty shoot-outs, dismissals (outfield players and goalkeepers, one and two in a match) and every pairing of kits.
//   A10  the ends each side attacks in every period, extra time included, and every goal at the end its scorer attacks
//   9    extra time and penalties are drawn to the last second; nothing is invented for a shoot-out
//   B08  a dismissed player is no longer drawn; ten (or nine) are; a side that loses its keeper has a stand-in in goal
//   B07  as drawn, the two sides, the two keepers, the referee and the grass can all be told apart by colour
// Run: node test-situations.js
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/canvas2d','renderers/pixelart','renderers/wireframe','renderers/iso-projection','iso-sprites','iso-assets','renderers/iso-pitch','renderers/iso-stadium','renderers/iso-camera','renderers/iso-actors','renderers/isometric']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const ISO = MD.iso; const def = MD.renderers.isometric; const EV = MD.EVENT; const P = MD.PERIODS;
const { createCanvas } = require('@napi-rs/canvas');
MD.sprites.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas);
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL', msg); } };

// ---- two seasons, every match captured (the same world as test-matchday.js) ----
const all = []; { const st = E.newGame({ seed: 4242, userClub: 3 });
  for (let w = 0; w < E.CFG.WEEKS*2; w++){ const res = E.advanceWeek(st); if (st.gameOver){ st.gameOver = null; st.sackOffer = null; st.clubs[st.userClub].confidence = E.CFG.CONF_START; st.clubs[st.userClub].overdraftWeeks = 0; }
    for (const m of res) all.push(MD.capture(st, m, st.lastWeekInfo)); } }
const roleOf = (p, id) => (p.players.find(x => x.id===id)||{}).role;
const reds = p => p.official.cards.filter(c => c.card==='red' && c.playerId);
const extra = all.filter(p => p.official.extra), pens = extra.filter(p => p.official.extra==='pens'), aet = extra.filter(p => p.official.extra==='aet');
const redMatches = all.filter(p => reds(p).length), gkRed = redMatches.filter(p => reds(p).some(c => roleOf(p, c.playerId)==='GK')), twoRed = redMatches.filter(p => reds(p).length > 1);
console.log(all.length+' matches: '+aet.length+' decided in extra time, '+pens.length+' on penalties, '+extra.reduce((n, p) => n + p.official.scorers.filter(s => s.period==='extraTime').length, 0)+' goals in extra time, '+redMatches.length+' with a dismissal ('+gkRed.length+' of a goalkeeper, '+twoRed.length+' with two)');
ok(aet.length >= 5 && pens.length >= 5 && gkRed.length >= 3 && twoRed.length >= 3, 'the two seasons contain every situation several times over');

// a match's timeline and scene are built once (three quarters of a second each) and its ground is painted into tiles as the renderer does
const built = new Map(); const sceneOf = p => { let b = built.get(p.matchId); if (!b){ const full = MD.withTimeline(p); b = { full, sc: MD.createScene(full), worlds: {} }; built.set(p.matchId, b); } return b; };
const frameOf = (p, t, w, h, mode, state) => { const b = sceneOf(p); const cv = frameOf.cv[w+'x'+h] || (frameOf.cv[w+'x'+h] = createCanvas(w, h)); const P = mode==='whole'? ISO.projection.fit(w, h, ISO.projection.DIM.runoff + 1.5).P : 12;
  const world = b.worlds[P] || (b.worlds[P] = def.buildWorld(createCanvas, P, p.seed, [p.teams.home.kit.primary, p.teams.away.kit.primary]));
  return def.drawFrame(cv.getContext('2d'), w, h, b.sc.getSceneAt(t), { teams: p.teams, seed: p.seed, world, state: state||{ anim: {} }, dtReal: 1/30, nowMs: t*1000, cameraMode: mode, followP: 12, snap: true }); }; frameOf.cv = {};
const done = p => { const b = built.get(p.matchId); if (b){ for (const w of Object.values(b.worlds)) w.dispose(); built.delete(p.matchId); } };
const drawn = fr => fr.items.filter(it => it.kind==='player');
// the kit each figure is dressed in is what the sprite maker is asked for: the requests of the last frame are kept
let asked = []; { const real = MD.isoSprites.get; MD.isoSprites.get = function(kit){ asked.push(kit); return real.apply(this, arguments); }; }

// ---- A10: the ends in every period, and every goal at the end its scorer attacks ----
{
  // Ends change at half-time, again for extra time and again at its interval, as in the game itself: the home side
  // attacks the right-hand end first.
  const want = { firstHalf: 1, secondHalf: -1, extraTime1: 1, extraTime2: -1 }; const when = { firstHalf: 60, secondHalf: P.regulation.half + 60, extraTime1: P.extraTime.start + 60, extraTime2: P.extraTime.half + 60 };
  let endsOk = 0, goals = 0, goalsOk = 0, etGoals = 0, mirror = 0;
  for (const p of extra){
    const { full, sc } = sceneOf(p); const H = p.teams.home.id, A = p.teams.away.id; let good = true;
    for (const ph of Object.keys(want)){ const s = sc.getSceneAt(when[ph]); if (s.phase!==ph || s.attackDir[H]!==want[ph] || s.attackDir[A]!==-want[ph]) good = false; if (s.attackDir[H]!==-s.attackDir[A]) mirror++; }
    if (good) endsOk++;
    for (const g of full.events.filter(e => e.type===EV.GOAL)){
      const s = sc.getSceneAt(g.matchSecond + 0.05); goals++; if (g.matchSecond >= P.extraTime.start) etGoals++;
      const end = s.attackDir[g.teamId]===1? 1 : 0; if (Math.abs(s.ball.x - end) < 0.06) goalsOk++;   // the ball is in that goal as the goal is given
    }
  }
  ok(mirror===0, 'A10 the two sides always attack opposite ends ('+mirror+' samples where they did not)');
  ok(endsOk===extra.length, 'A10 ends change at half-time, for extra time and at its interval: '+endsOk+' of '+extra.length+' matches that went to extra time');
  ok(goals > 100 && goalsOk===goals, 'A10 every goal in those matches is scored at the end its scorer is attacking ('+goalsOk+' of '+goals+', '+etGoals+' of them in extra time)');
}

// ---- scenario 9: extra time and penalties drawn to the last second; nothing invented for a shoot-out ----
{
  let frames = 0, threw = 0, thin = 0, late = 0, wrongScore = 0, noPhase = 0, noWinner = 0;
  for (const p of aet.slice(0, 3).concat(pens.slice(0, 3))){
    const { sc } = sceneOf(p); const state = { anim: {} };
    for (let t = P.regulation.end - 30; t <= sc.duration; t += 2){ try { const fr = frameOf(p, t, 366, 411, 'follow', state); frames++; const s = sc.getSceneAt(t); if (s.live && drawn(fr).length < 1) thin++; } catch (e){ threw++; if (threw===1) console.log('   threw at '+t+' in '+p.matchId+': '+e.message); } }
    const end = sc.getSceneAt(sc.duration); if (end.score.home!==p.official.homeGoals || end.score.away!==p.official.awayGoals) wrongScore++;
  }
  for (const p of pens){
    const { full, sc } = sceneOf(p);
    late += full.events.filter(e => e.type===EV.GOAL && e.matchSecond > P.extraTime.end).length;   // no kick of a shoot-out is made up
    const pe = full.events.find(e => e.type===EV.PENALTIES), so = full.events.find(e => e.type===EV.SHOOTOUT_RESULT);
    if (!pe || sc.getSceneAt(pe.matchSecond + 0.5).phase!=='penalties' || sc.getSceneAt(pe.matchSecond + 0.5).phaseLabel!=='Penalties') noPhase++;
    if (!so || so.teamId!==p.official.penaltiesWinnerTeamId || !so.text || so.text.indexOf(p.teams[so.teamId===p.teams.home.id? 'home' : 'away'].name)===-1) noWinner++;
    const end = sc.getSceneAt(sc.duration); if (end.score.home!==p.official.homeGoals || end.score.away!==p.official.awayGoals || p.official.homeGoals!==p.official.awayGoals) wrongScore++;
  }
  for (const p of extra) done(p);
  ok(frames > 4000 && threw===0, 'scenario 9: extra time and penalties are drawn to the last second without an error ('+frames+' frames of six matches, '+threw+' errors)');
  ok(thin===0, 'scenario 9: there is always someone in the picture while play is live in extra time ('+thin+' empty frames)');
  ok(late===0 && noPhase===0 && noWinner===0 && wrongScore===0, 'scenario 9: '+pens.length+' shoot-outs: the stage says Penalties, the result names the official winner, no kick is invented and the score stays level ('+late+', '+noPhase+', '+noWinner+', '+wrongScore+' faults)');
}

// ---- B08 and scenario 7: dismissals as drawn (whole-pitch camera, so every player on the pitch is in the picture) ----
{
  const sample = gkRed.concat(twoRed.filter(p => !gkRed.includes(p)).slice(0, 10), redMatches.filter(p => !gkRed.includes(p) && !twoRed.includes(p)).slice(0, 20));
  let cases = 0, before = 0, gone = 0, count = 0, keeper = 0, keeperCases = 0, standIn = 0, keeperKit = 0;
  for (const p of sample){
    const { full, sc } = sceneOf(p); const offs = full.events.filter(e => e.type===EV.SENT_OFF).sort((a, b) => a.matchSecond - b.matchSecond);
    for (let i = 0; i < offs.length; i++){
      const off = offs[i]; cases++; const until = i + 1 < offs.length? offs[i + 1].matchSecond - 1 : sc.duration - 1; const wasGK = roleOf(p, off.playerId)==='GK';
      if (off.matchSecond > 20 && drawn(frameOf(p, off.matchSecond - 10, 904, 619, 'whole')).some(it => it.pl.id===off.playerId)) before++; else if (off.matchSecond <= 20) before++;
      let allGone = true, allCount = true, oneKeeper = true, kit = true;
      for (const t of [off.matchSecond + 8, off.matchSecond + 60, (off.matchSecond + until)/2, until].filter(t => t > off.matchSecond + 6 && t <= until)){
        const s = sc.getSceneAt(t); if (!s.live) continue; asked = []; const fr = frameOf(p, t, 904, 619, 'whole'); const side = drawn(fr).filter(it => it.pl.teamId===off.teamId);
        if (drawn(fr).some(it => it.pl.id===off.playerId)) allGone = false;
        const dismissedSoFar = offs.filter(o => o.teamId===off.teamId && o.matchSecond <= off.matchSecond).length; if (side.length!==11 - dismissedSoFar) allCount = false;
        const gks = side.filter(it => it.pl.role==='GK'); if (gks.length!==1) oneKeeper = false;
        if (wasGK && (gks.length!==1 || gks[0].pl.id===off.playerId || asked.filter(k => k && k.gk).length!==2)) kit = false;   // two figures in keeper's kit: one a side
      }
      if (allGone) gone++; if (allCount) count++; if (oneKeeper) keeper++; if (wasGK){ keeperCases++; if (oneKeeper) standIn++; if (kit) keeperKit++; }
    }
    done(p);
  }
  ok(before===cases, 'B08 a player is in the picture until he is sent off ('+before+' of '+cases+' dismissals)');
  ok(gone===cases, 'B08 a dismissed player is never drawn again ('+gone+' of '+cases+')');
  ok(count===cases, 'B08 his side is drawn a man short for every man it has lost ('+count+' of '+cases+')');
  ok(keeper===cases, 'B08 the side still has exactly one goalkeeper ('+keeper+' of '+cases+')');
  ok(keeperCases >= 10 && standIn===keeperCases, 'B08 when the goalkeeper is sent off a team-mate goes in goal ('+standIn+' of '+keeperCases+')');
  ok(keeperKit===keeperCases, 'B08 and the stand-in is drawn in the keeper\'s colours ('+keeperKit+' of '+keeperCases+')');
}

// ---- B07: the colours as drawn. Everyone on the pitch must be told from everyone he could be mistaken for. ----
{
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  const NEAR = 110;   // the game's own measure of two shirts being too alike (capture.js changes the away kit under it)
  const GREEN = 80;   // against the grass: under this a shirt is a green close to the pitch's own
  let matchesKeeperOpp = 0, matchesRef = 0, matchesShared = 0; const shirt = k => (k.pattern && k.pattern!=='plain')? [k.primary, k.secondary] : [k.primary];   // a striped, hooped or quartered shirt is two colours
  const GRASS = '#3C9A46', REF = MD.isoSprites.REF_KIT.primary;
  const kitsOf = ISO.actors.kitsFor || (teams => ({ home: teams.home.kit, away: teams.away.kit, homeGK: { primary: teams.home.kit.secondary }, awayGK: { primary: teams.away.kit.secondary }, ref: MD.isoSprites.REF_KIT }));   // as the renderer dresses them
  const bad = { sides: [], shared: [], keeperOpp: [], keeperOwn: [], keepers: [], ref: [], grass: [] }; const seen = k => { const s = new Set(); return x => { if (s.has(x)) return false; s.add(x); return true; }; };
  const once = {}; for (const k of Object.keys(bad)) once[k] = seen(k);
  for (const p of all){
    const K = kitsOf(p.teams); const h = K.home.primary, a = K.away.primary, hg = K.homeGK.primary, ag = K.awayGK.primary, r = (K.ref||MD.isoSprites.REF_KIT).primary; const id = p.teams.home.short+' v '+p.teams.away.short;
    if (dist(h, a) < NEAR && once.sides(h+a)) bad.sides.push(id+' '+h+' '+a);
    { const hs = shirt(K.home), as = shirt(K.away); if ((hs.length > 1 || as.length > 1) && hs.some(c1 => as.some(c2 => dist(c1, c2) < NEAR))){ matchesShared++; if (once.shared(hs.join('')+as.join(''))) bad.shared.push(id+' '+hs.join('/')+' '+(K.home.pattern||'plain')+' against '+as.join('/')+' '+(K.away.pattern||'plain')); } }
    if (dist(hg, a) < NEAR || dist(ag, h) < NEAR) matchesKeeperOpp++; if ([h, a, hg, ag].some(c => dist(c, r) < NEAR)) matchesRef++;
    for (const [g, opp, who] of [[hg, a, 'home keeper'], [ag, h, 'away keeper']]) if (dist(g, opp) < NEAR && once.keeperOpp(g+opp)) bad.keeperOpp.push(id+' '+who+' '+g+' against '+opp);
    for (const [g, own, who] of [[hg, h, 'home keeper'], [ag, a, 'away keeper']]) if (dist(g, own) < NEAR && once.keeperOwn(g+own)) bad.keeperOwn.push(id+' '+who+' '+g+' and his own side '+own);
    if (dist(hg, ag) < NEAR && once.keepers(hg+ag)) bad.keepers.push(id+' '+hg+' '+ag);
    for (const [c, who] of [[h, 'home'], [a, 'away'], [hg, 'home keeper'], [ag, 'away keeper']]){ if (dist(c, r) < NEAR && once.ref(c+r)) bad.ref.push(id+' '+who+' '+c+' and the referee '+r); if (dist(c, GRASS) < GREEN && once.grass(c)) bad.grass.push(id+' '+who+' '+c); }
  }
  const few = a => a.length? ': '+a.slice(0, 4).join('; ')+(a.length > 4? '; and '+(a.length - 4)+' more' : '') : '';
  ok(bad.sides.length===0, 'B07 the two sides never wear shirts too alike ('+bad.sides.length+' pairings)'+few(bad.sides));
  ok(bad.shared.length===0, 'B07 a striped, hooped or quartered shirt shares neither of its colours with the other side\'s shirt ('+matchesShared+' of '+all.length+' matches, '+bad.shared.length+' pairings)'+few(bad.shared));
  ok(bad.keeperOpp.length===0, 'B07 a goalkeeper never wears the colour of the opposing side ('+matchesKeeperOpp+' of '+all.length+' matches, '+bad.keeperOpp.length+' colour pairings)'+few(bad.keeperOpp));
  ok(bad.keeperOwn.length===0, 'B07 a goalkeeper never wears the colour of his own side ('+bad.keeperOwn.length+')'+few(bad.keeperOwn));
  ok(bad.ref.length===0, 'B07 nobody wears the colour of the referee ('+matchesRef+' of '+all.length+' matches, '+bad.ref.length+' colours)'+few(bad.ref));
  ok(bad.grass.length===0, 'B07 nobody wears the colour of the grass ('+bad.grass.length+' colours)'+few(bad.grass));
  console.log('   (the two keepers alike: '+bad.keepers.length+' pairings; they stand at opposite ends, so this is reported and not required)');
}

console.log(checks+' checks, '+fails+' failures');
if (fails){ console.log('SITUATION TESTS FAILED'); process.exit(1); }
console.log('ALL SITUATION TESTS PASSED');
