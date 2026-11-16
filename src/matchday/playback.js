// ============================================================================
//  Matchday: playback controller
//  Drives football time for a presentation: play, pause, speed, seek, skip
//  and the event stream for commentary. It owns no game state and never
//  touches the save: it only turns real seconds into match seconds.
//
//  A full match is 90 minutes of match time but should take about 75 real
//  seconds to watch, so time runs at two rates. Highlight windows (the
//  build-up to every goal, cards, a handful of chances, kick-offs and the
//  final whistle) run close to real time; everything else fast-forwards.
//  The time map is built once from the presentation and is deterministic.
//
//  Public surface (see ARCHITECTURE_MATCHDAY.md):
//    const pb = Matchday.createPlayback(presentation, { onFrame, onEvent, onEnd, onState });
//    pb.play(); pb.pause(); pb.toggle(); pb.setSpeed(2); pb.seek(sec); pb.skip(); pb.dispose();
//    pb.state() -> { playing, speed, matchSecond, ended, fastForward, realDuration }
// ============================================================================
(function(root){
  const MD = root.Matchday; const EV = MD.EVENT; const P = MD.PERIODS;

  const DEFAULTS = {
    baseSeconds: 30,         // real seconds a match takes before its highlights are counted
    perHighlight: 7,         // real seconds added per highlight (a goal or a chance; a card counts half)
    minSeconds: 50, maxSeconds: 112,   // bounds on the real length of a regulation match at 1x
    extraTimeSeconds: 24,    // added when there is extra time
    highlightRate: 1.7,      // match seconds per real second inside a highlight (raised for goal-heavy games)
    maxHighlightRate: 2.8,   // never faster than this inside a highlight, even in a goal glut (the match runs longer instead)
    hardMaxSeconds: 125,     // ...up to this real length; past it the highlights speed up again, to 3.5 at most
    ceilingRate: 3.5,
    highlightShare: 0.85,    // at most this share of the real time goes to highlights
    maxChances: 5,           // non-goal chances shown as highlights in a goalless match (fewer as goals mount up)
    endHold: 2.5,            // real seconds to sit on the final whistle before onEnd
  };
  // how much an incident deserves a highlight, by what happened (the picker also wants variety and spread)
  const DRAMA = { post: 10, bar: 10, line: 9, parry: 8, header: 7, volley: 6, catch: 5, slide: 5, interception: 3, tackle: 3, over: 3, wide: 3, blocked: 2 };

  function mergeWindows(w, end){
    w.sort((x,y)=>x.a-y.a);
    const out = [];
    for (const x of w){ const last = out[out.length-1]; if (last && x.a<=last.b){ last.b = Math.max(last.b, x.b); } else out.push({ a: Math.max(0, x.a), b: x.b }); }
    for (const x of out) x.b = Math.min(x.b, end);
    return out.filter(x=>x.b>x.a);
  }
  const span = ws => ws.reduce((s,x)=>s+(x.b-x.a), 0);

  // The chances in a timeline, each with its span and a drama score: the events that share a chanceId form one
  // sequence (approach, finish, outcome, aftermath); a lone shot is its own sequence.
  function chancesOf(p){
    const byId = new Map(); const singles = [];
    const isShot = t => t===EV.SHOT_SAVED || t===EV.SHOT_WIDE || t===EV.SHOT_BLOCKED || t===EV.SHOT_POST;
    for (const e of p.events){
      if (e.type===EV.GOAL) continue;
      if (e.chanceId){ let c = byId.get(e.chanceId); if (!c){ c = { id: e.chanceId, events: [] }; byId.set(e.chanceId, c); } c.events.push(e); }
      else if (isShot(e.type)) singles.push({ id: e.id, events: [e] });
    }
    // a chance that ends with a corner and the chance that the corner is swung into are one sequence: a window
    // that showed the corner won must show what came of it
    const groups = Array.from(byId.values()).concat(singles).sort((x,y)=>x.events[0].matchSecond-y.events[0].matchSecond);
    const merged = [];
    for (const c of groups){
      const prev = merged[merged.length-1]; const tail = prev && prev.events[prev.events.length-1];
      const head = c.events[0]; const headStart = head.matchSecond - (head.duration||0);
      if (tail && tail.type===EV.CORNER && headStart <= tail.matchSecond + 6){ prev.events = prev.events.concat(c.events); continue; }
      merged.push({ id: c.id, events: c.events.slice() });
    }
    const out = [];
    for (const c of merged){
      const shots = c.events.filter(e=>isShot(e.type));
      if (!shots.length && !c.events.some(e=>e.type===EV.INTERCEPTION || (e.type===EV.TACKLE && e.slide))) continue;
      let score = 0; const tags = new Set();
      for (const e of c.events){
        const tag = e.type===EV.SHOT_POST? e.woodwork : e.type===EV.SHOT_SAVED? e.save : e.type===EV.SHOT_WIDE? e.miss : e.type===EV.SHOT_BLOCKED? (e.line? 'line' : e.slide? 'slide' : 'blocked') : e.type===EV.INTERCEPTION? 'interception' : e.type===EV.TACKLE? 'tackle' : null;
        if (tag){ score = Math.max(score, DRAMA[tag]||2); tags.add(tag); }
        if (e.technique==='header' && (isShot(e.type) || e.type===EV.CLEARANCE)){ score = Math.max(score, DRAMA.header); tags.add('header'); }
        if (e.technique==='volley' && isShot(e.type)){ score = Math.max(score, DRAMA.volley); tags.add('volley'); }
        if (e.type===EV.CORNER) tags.add('corner');
        if (e.type===EV.CROSS) tags.add('cross');
      }
      score += 0.6*(shots.length - 1) + (tags.has('corner')? 1 : 0) + (tags.has('cross')? 0.5 : 0);
      const first = c.events[0], last = c.events[c.events.length-1];
      const start = Math.min(...c.events.map(e=>e.matchSecond - (e.duration||0)));
      out.push({ id: c.id, a: start - 6, b: last.matchSecond + 3.5, at: shots.length? shots[0].matchSecond : first.matchSecond, score, tags: Array.from(tags), shots: shots.length });
    }
    out.sort((x,y)=>x.at-y.at);
    return out;
  }

  // ---- time map ----
  // Segments [a,b,rate]: rate is match seconds per real second at 1x. Highlights (goals, cards, kick-offs,
  // whistles and the best chances) play at highlightRate; the rest fast-forwards. The real length of the match
  // grows with the number of highlights, so a quiet 0-0 is over sooner than a 4-3. Goal-heavy matches speed
  // the highlights up rather than overrun.
  function buildTimeMap(p, opts){
    const end = p.official.extra? P.extraTime.end : P.regulation.end;
    const must = [];
    must.push({ a:0, b:10 });
    must.push({ a:P.regulation.half-4, b:P.regulation.half+8 });
    must.push({ a:P.regulation.end-5, b:P.regulation.end + (p.official.extra? 8 : 0) });
    if (p.official.extra){ must.push({ a:P.extraTime.half-4, b:P.extraTime.half+6 }); must.push({ a:P.extraTime.end-5, b:P.extraTime.end }); }
    let counted = 0;
    for (const e of p.events){
      if (e.type===EV.GOAL){ must.push({ a:e.matchSecond-24, b:Math.min(end, e.matchSecond+11) }); counted++; }
      else if (e.type===EV.CARD){ must.push({ a:e.matchSecond-7, b:e.matchSecond+4 }); counted += 0.5; }
    }
    const all = chancesOf(p);
    // no window opens in the middle of a chance (a corner's window would otherwise cut into the shot that won it):
    // it backs up to the start of that chance
    const backUp = a => { const c = all.find(c=>c.a + 6 < a && a < c.b); return c? Math.min(a, c.a) : a; };
    for (const w of must) w.a = backUp(w.a);
    let windows = mergeWindows(must, end);
    // the best chances, for drama, variety and spread: a repeated kind counts for less, so does one close to a
    // window already chosen; picked deterministically from the timeline alone
    const inMust = c => windows.some(x=>c.at>=x.a-8 && c.at<=x.b+4);
    const chances = all.filter(c=>!inMust(c));
    // a goal-laden match needs fewer extra chances to fill its programme; a 0-0 shows the best of what it had
    const goals = p.events.filter(e=>e.type===EV.GOAL).length;
    const maxChances = Math.max(2, Math.round(opts.maxChances - 0.7*goals));
    const picked = []; const seen = {};
    // variety is about what happened (the outcome, the technique), not how the ball arrived: a cross or a corner is
    // not something the viewer has "seen enough of"
    const APPROACH = { cross: 1, corner: 1 };
    const note = (c, w) => { for (const tag of c.tags) if (!APPROACH[tag]) seen[tag] = (seen[tag]||0) + w; };
    // what the goal and card windows already show counts towards variety (a parry before a goal is a parry seen)
    for (const c of all) if (inMust(c)) note(c, 0.5);
    // highlights spread out from the incidents already shown (goals, cards, chances picked), not from the whistles
    const anchors = p.events.filter(e=>e.type===EV.GOAL || e.type===EV.CARD).map(e=>({ at: e.matchSecond }));
    for (let n=0; n<maxChances && chances.length; n++){
      let best = null, bestV = -1;
      for (const c of chances){
        if (picked.includes(c)) continue;
        let v = c.score;
        for (const tag of c.tags) if (seen[tag]) v *= Math.pow(0.6, seen[tag]);
        const near = picked.concat(anchors).reduce((m,x)=>Math.min(m, Math.abs(x.at - c.at)), 1e9);
        if (near < 120) v *= 0.5; else if (near < 300) v *= 0.8;
        if (v > bestV){ bestV = v; best = c; }
      }
      if (!best || bestV < 1.5) break;
      picked.push(best); note(best, 1);
    }
    for (const c of picked){ windows = mergeWindows(windows.concat([{ a: backUp(c.a), b: c.b }]), end); counted++; }
    const target = Math.max(opts.minSeconds, Math.min(opts.maxSeconds, opts.baseSeconds + opts.perHighlight*counted)) + (p.official.extra? opts.extraTimeSeconds : 0);
    const budget = target*opts.highlightShare;
    let rate = Math.max(opts.highlightRate, Math.min(opts.maxHighlightRate, span(windows)/budget));
    const gapMatch = end - span(windows);
    const gapMin = Math.max(6, gapMatch/600);                                  // the fast-forwards never run faster than 600x
    const hardMax = opts.hardMaxSeconds + (p.official.extra? opts.extraTimeSeconds : 0);
    if (span(windows)/rate + gapMin > hardMax) rate = Math.min(opts.ceilingRate, Math.max(rate, span(windows)/(hardMax - gapMin)));
    const hlReal = span(windows)/rate;
    const gapReal = Math.max(gapMin, target - hlReal);
    const ffRate = Math.min(600, Math.max(rate, gapMatch/gapReal));
    const segs = []; let t = 0;
    for (const x of windows){
      if (x.a>t) segs.push({ a:t, b:x.a, rate: ffRate, ff:true });
      segs.push({ a:x.a, b:x.b, rate, ff:false });
      t = x.b;
    }
    if (t<end) segs.push({ a:t, b:end, rate: ffRate, ff:true });
    const realDuration = segs.reduce((s,x)=>s+(x.b-x.a)/x.rate, 0);
    return { segs, end, realDuration, ffRate, highlightRate: rate, highlightSeconds: hlReal, target, highlights: windows.length, weight: counted, chances: picked.map(c=>({ id: c.id, at: c.at, score: c.score, tags: c.tags })) };
  }

  // ---- commentary lines ----
  // A line is spoken either as an action starts (`say`, at the launch of a flight) or as it resolves (`text`, at the
  // event's second). Each highlight window also opens with a lead-in naming the side coming forward, so the last
  // line of the previous passage never sits under a new attack.
  const LEAD = ['%T come forward.', '%T build an attack.', '%T on the ball.', '%T push up.'];
  function linesOf(p, map){
    const lines = [];
    const H = p.teams.home.id; const nameOf = id => (id===H? p.teams.home : p.teams.away).short || (id===H? p.teams.home : p.teams.away).name;
    for (const e of p.events){
      if (e.say) lines.push({ t: Math.round((e.matchSecond - (e.duration||0))*100)/100, text: e.say, eventId: e.id, official: e.provenance==='official' && e.type!==EV.GOAL, say: true });
      if (e.text) lines.push({ t: e.matchSecond, text: e.text, eventId: e.id, official: e.provenance==='official' });
    }
    const OPENERS = [EV.KICK_OFF, EV.SECOND_HALF, EV.ET_START, EV.HALF_TIME, EV.FULL_TIME, EV.ET_HALF, EV.ET_END, EV.CORNER, EV.GOAL_KICK, EV.PENALTIES, EV.SHOOTOUT_RESULT];
    const WITH_BALL = [EV.PASS, EV.CROSS, EV.SHOT_SAVED, EV.SHOT_WIDE, EV.SHOT_BLOCKED, EV.SHOT_POST, EV.GOAL, EV.INTERCEPTION, EV.CLEARANCE];
    const playerName = id => { const q = p.players.find(x=>x.id===id); return q? q.name : null; };
    const otherTeam = id => id===H? p.teams.away.id : H;
    for (const seg of map.segs){
      if (seg.ff || seg.b - seg.a < 7) continue;
      // a lead-in unless the window opens on a restart or a whistle, which speak for themselves
      if (p.events.some(e=>e.matchSecond >= seg.a && e.matchSecond <= seg.a + 1.5 && OPENERS.includes(e.type))) continue;
      const first = p.events.find(e=>e.matchSecond >= seg.a && e.matchSecond <= seg.b && WITH_BALL.includes(e.type) && e.teamId);
      const foul = first? null : p.events.find(e=>e.matchSecond >= seg.a && e.matchSecond <= seg.b && e.type===EV.FOUL && e.teamId);
      const team = first? first.teamId : foul? otherTeam(foul.teamId) : null;
      if (!team) continue;
      const pick = (MD.hashString? MD.hashString(p.matchId+':'+seg.a) : Math.round(seg.a)) % LEAD.length;
      lines.push({ t: seg.a + 0.2, text: LEAD[pick].replace('%T', nameOf(team)), eventId: null, official: false, lead: true });
    }
    lines.sort((a,b)=>a.t-b.t);
    // nobody shoots under a line more than a few seconds old: a build-up line names the man on the ball
    const extra = [];
    for (const e of p.events){
      if (!/SHOT|GOAL/.test(e.type) || !e.duration) continue;
      const launch = e.matchSecond - e.duration;
      const seg = map.segs.find(x=>launch >= x.a && launch < x.b); if (!seg || seg.ff) continue;
      if (lines.some(l=>l.t >= Math.max(seg.a, launch - 6) && l.t < launch)) continue;
      const feed = p.events.filter(x=>(x.type===EV.PASS || x.type===EV.CROSS) && x.matchSecond <= launch && x.matchSecond > launch - 12).pop();
      const who = feed && feed.toPlayerId? playerName(feed.toPlayerId) : null;
      extra.push({ t: Math.round(Math.max(seg.a + 0.3, launch - 2.2)*100)/100, text: who? who+' has it...' : nameOf(e.teamId)+' press forward.', eventId: null, official: false, lead: true });
    }
    for (const l of extra) lines.push(l);
    lines.sort((a,b)=>a.t-b.t);
    return lines;
  }

  function createPlayback(p, options){
    const opts = Object.assign({}, DEFAULTS, options||{});
    if (!p.events) throw new Error('createPlayback needs a presentation with events');
    const map = buildTimeMap(p, opts);
    const lines = linesOf(p, map);
    const finalSecond = p.events[p.events.length-1].matchSecond;   // SHOOTOUT_RESULT can sit 1s past the end
    // matchSecond is the official clock. sceneSecond is what the renderer should draw: the same
    // during highlights, but during fast-forward the picture keeps playing at normal pace from
    // where the gap started while the clock races ahead, then cuts to the next highlight.
    const st = { playing:false, speed:1, matchSecond:0, sceneSecond:0, ended:false, fastForward:false, realDuration: map.realDuration, endHold: 0, sinceCut: 99 };
    let curSeg = null, segVisual = 0;   // the segment being played and the visual seconds elapsed in it
    let raf = 0, lastTs = 0, nextEvent = 0, nextLine = 0, disposed = false;
    const emit = (name, ...args) => { const f = opts[name]; if (typeof f==='function') f(...args); };
    const segAt = s => { for (const x of map.segs) if (s>=x.a && s<x.b) return x; return map.segs[map.segs.length-1]; };

    function fireEventsUpTo(s, officialOnly){
      while (nextEvent < p.events.length && p.events[nextEvent].matchSecond <= s){
        const e = p.events[nextEvent++];
        // commentary: every official event; illustrative lines only inside highlights
        if (e.provenance==='official') emit('onEvent', e);
        else if (!officialOnly && e.text && !segAt(e.matchSecond).ff) emit('onEvent', e);
      }
    }
    function syncEventIndex(s){ nextEvent = 0; while (nextEvent < p.events.length && p.events[nextEvent].matchSecond <= s) nextEvent++; }
    // commentary: official lines always; the rest only inside highlights
    const audible = l => l.official || !segAt(l.t).ff;
    function fireLinesUpTo(s, officialOnly){
      while (nextLine < lines.length && lines[nextLine].t <= s){ const l = lines[nextLine++]; if (officialOnly? l.official : audible(l)) emit('onLine', l); }
    }
    // after a seek: the latest audible line at or before s is what the board should show
    function syncLineIndex(s){ nextLine = 0; let last = null; while (nextLine < lines.length && lines[nextLine].t <= s){ const l = lines[nextLine++]; if (audible(l)) last = l; } if (last) emit('onLine', last); }

    function frame(ts){
      raf = 0;
      if (disposed || !st.playing) return;
      const dt = lastTs? Math.min(0.1, (ts-lastTs)/1000) : 0; lastTs = ts;
      st.sinceCut += dt;
      if (st.matchSecond >= map.end){
        st.fastForward = false;
        // hold on the whistle (and the shoot-out line) before handing back
        st.endHold += dt;
        if (st.matchSecond < finalSecond){ st.matchSecond = finalSecond; fireEventsUpTo(finalSecond); fireLinesUpTo(finalSecond); }
        st.sceneSecond = st.matchSecond;
        emit('onFrame', st.matchSecond, st);
        if (st.endHold >= opts.endHold){ finish(); return; }
      } else {
        const seg = segAt(st.matchSecond);
        if (seg!==curSeg){ if (curSeg && curSeg.ff) st.sinceCut = 0; curSeg = seg; segVisual = 0; st.segA = seg.a; st.segB = seg.b; st.segFF = !!seg.ff; }   // a cut when a fast-forward ends
        st.fastForward = seg.ff;
        let adv = seg.rate * st.speed * dt;
        // do not let one real frame leap over a segment boundary at the wrong rate
        if (st.matchSecond + adv > seg.b) adv = Math.max(seg.b - st.matchSecond, 0.001);
        st.matchSecond = Math.min(map.end, st.matchSecond + adv);
        if (seg.ff){ segVisual += map.highlightRate * st.speed * dt; st.sceneSecond = Math.min(seg.b - 0.001, seg.a + segVisual); }
        else st.sceneSecond = st.matchSecond;
        fireEventsUpTo(st.matchSecond); fireLinesUpTo(st.matchSecond);
        emit('onFrame', st.matchSecond, st);
      }
      raf = root.requestAnimationFrame(frame);
    }
    function finish(){ if (st.ended) return; st.ended = true; st.playing = false; st.matchSecond = finalSecond; st.sceneSecond = finalSecond; fireEventsUpTo(finalSecond, true); fireLinesUpTo(finalSecond, true); emit('onFrame', st.matchSecond, st); emit('onState', st); emit('onEnd', st); }

    const pb = {
      play(){ if (disposed || st.ended) return; if (!st.playing){ st.playing = true; lastTs = 0; emit('onState', st); raf = root.requestAnimationFrame(frame); } },
      pause(){ if (!st.playing) return; st.playing = false; if (raf){ root.cancelAnimationFrame(raf); raf = 0; } emit('onState', st); },
      toggle(){ if (st.playing) pb.pause(); else pb.play(); },
      setSpeed(x){ st.speed = [1,2,4].includes(x)? x : 1; emit('onState', st); },
      seek(s){ s = Math.max(0, Math.min(finalSecond, s)); st.matchSecond = s; st.sceneSecond = s; curSeg = null; st.sinceCut = 0 /* a seek is a cut */; st.endHold = 0; { const sg = segAt(s); if (sg){ st.segA = sg.a; st.segB = sg.b; st.segFF = !!sg.ff; } } syncEventIndex(s); syncLineIndex(s); if (s>=finalSecond && !st.ended){ st.ended = true; st.playing = false; emit('onEnd', st); } else if (st.ended && s<finalSecond){ st.ended = false; } emit('onFrame', st.matchSecond, st); emit('onState', st); },
      skip(){ pb.pause(); st.matchSecond = finalSecond; finish(); },   // the official events still to come are emitted so the log is complete
      replay(){ st.ended = false; st.endHold = 0; st.matchSecond = 0; st.sceneSecond = 0; curSeg = null; syncEventIndex(0); nextLine = 0; emit('onState', st); emit('onFrame', 0, st); pb.play(); },
      state(){ return Object.assign({}, st); },
      timeMap(){ return map; },
      lines(){ return lines; },
      dispose(){ disposed = true; st.playing = false; if (raf){ root.cancelAnimationFrame(raf); raf = 0; } },
    };
    return pb;
  }

  MD.createPlayback = createPlayback; MD.buildTimeMap = buildTimeMap; MD.chancesOf = chancesOf; MD.linesOf = linesOf; MD.PLAYBACK_DEFAULTS = DEFAULTS;
})(typeof window!=='undefined'? window : globalThis);
