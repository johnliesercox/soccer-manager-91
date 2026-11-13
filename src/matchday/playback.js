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
    targetSeconds: 78,       // real seconds for a regulation match at 1x
    extraTimeSeconds: 24,    // added when there is extra time
    highlightRate: 1.7,      // match seconds per real second inside a highlight (raised for goal-heavy games)
    maxHighlightRate: 3.5,
    highlightShare: 0.8,     // at most this share of the real time goes to highlights
    maxChances: 7,           // non-goal chances shown as highlights
    endHold: 2.5,            // real seconds to sit on the final whistle before onEnd
  };

  function mergeWindows(w, end){
    w.sort((x,y)=>x.a-y.a);
    const out = [];
    for (const x of w){ const last = out[out.length-1]; if (last && x.a<=last.b){ last.b = Math.max(last.b, x.b); } else out.push({ a: Math.max(0, x.a), b: x.b }); }
    for (const x of out) x.b = Math.min(x.b, end);
    return out.filter(x=>x.b>x.a);
  }
  const span = ws => ws.reduce((s,x)=>s+(x.b-x.a), 0);

  // ---- time map ----
  // Segments [a,b,rate]: rate is match seconds per real second at 1x. Highlights (goals, cards,
  // kick-offs, whistles, a few chances) play at highlightRate; the rest fast-forwards so the
  // whole match fits the target. Goal-heavy matches speed the highlights up rather than overrun.
  function buildTimeMap(p, opts){
    const end = p.official.extra? P.extraTime.end : P.regulation.end;
    const target = opts.targetSeconds + (p.official.extra? opts.extraTimeSeconds : 0);
    const must = [];
    must.push({ a:0, b:10 });
    must.push({ a:P.regulation.half-4, b:P.regulation.half+8 });
    must.push({ a:P.regulation.end-5, b:P.regulation.end + (p.official.extra? 8 : 0) });
    if (p.official.extra){ must.push({ a:P.extraTime.half-4, b:P.extraTime.half+6 }); must.push({ a:P.extraTime.end-5, b:P.extraTime.end }); }
    for (const e of p.events){
      if (e.type===EV.GOAL) must.push({ a:e.matchSecond-22, b:Math.min(end, e.matchSecond+11) });
      else if (e.type===EV.CARD) must.push({ a:e.matchSecond-7, b:e.matchSecond+4 });
    }
    let windows = mergeWindows(must, end);
    const budget = target*opts.highlightShare;
    let rate = Math.max(opts.highlightRate, Math.min(opts.maxHighlightRate, span(windows)/budget));
    // chances fill whatever budget is left, spread through the match, chosen deterministically
    const chances = p.events.filter(e=>e.type===EV.SHOT_SAVED || e.type===EV.SHOT_WIDE || e.type===EV.SHOT_BLOCKED)
      .filter(e=>!windows.some(x=>e.matchSecond>=x.a-10 && e.matchSecond<=x.b+4));
    if (chances.length){
      const n = Math.min(opts.maxChances, chances.length);
      const rnd = MD.seededRandom(p.seed ^ 0x5a5a);
      const picked = [];
      for (let i=0;i<n;i++){ const lo = Math.floor(i*chances.length/n), hi = Math.max(lo, Math.floor((i+1)*chances.length/n)-1); picked.push(chances[lo + Math.floor(rnd()*(hi-lo+1))]); }
      for (const e of picked){
        const trial = mergeWindows(windows.concat([{ a:e.matchSecond-7, b:e.matchSecond+3 }]), end);
        if (span(trial)/rate <= budget) windows = trial;
      }
    }
    const hlReal = span(windows)/rate;
    const gapMatch = end - span(windows);
    const gapReal = Math.max(6, target - hlReal);
    const ffRate = Math.min(600, Math.max(rate, gapMatch/gapReal));
    const segs = []; let t = 0;
    for (const x of windows){
      if (x.a>t) segs.push({ a:t, b:x.a, rate: ffRate, ff:true });
      segs.push({ a:x.a, b:x.b, rate, ff:false });
      t = x.b;
    }
    if (t<end) segs.push({ a:t, b:end, rate: ffRate, ff:true });
    const realDuration = segs.reduce((s,x)=>s+(x.b-x.a)/x.rate, 0);
    return { segs, end, realDuration, ffRate, highlightRate: rate, highlightSeconds: hlReal };
  }

  function createPlayback(p, options){
    const opts = Object.assign({}, DEFAULTS, options||{});
    if (!p.events) throw new Error('createPlayback needs a presentation with events');
    const map = buildTimeMap(p, opts);
    const finalSecond = p.events[p.events.length-1].matchSecond;   // SHOOTOUT_RESULT can sit 1s past the end
    // matchSecond is the official clock. sceneSecond is what the renderer should draw: the same
    // during highlights, but during fast-forward the picture keeps playing at normal pace from
    // where the gap started while the clock races ahead, then cuts to the next highlight.
    const st = { playing:false, speed:1, matchSecond:0, sceneSecond:0, ended:false, fastForward:false, realDuration: map.realDuration, endHold: 0, sinceCut: 99 };
    let curSeg = null, segVisual = 0;   // the segment being played and the visual seconds elapsed in it
    let raf = 0, lastTs = 0, nextEvent = 0, disposed = false;
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

    function frame(ts){
      raf = 0;
      if (disposed || !st.playing) return;
      const dt = lastTs? Math.min(0.1, (ts-lastTs)/1000) : 0; lastTs = ts;
      st.sinceCut += dt;
      if (st.matchSecond >= map.end){
        st.fastForward = false;
        // hold on the whistle (and the shoot-out line) before handing back
        st.endHold += dt;
        if (st.matchSecond < finalSecond){ st.matchSecond = finalSecond; fireEventsUpTo(finalSecond); }
        st.sceneSecond = st.matchSecond;
        emit('onFrame', st.matchSecond, st);
        if (st.endHold >= opts.endHold){ finish(); return; }
      } else {
        const seg = segAt(st.matchSecond);
        if (seg!==curSeg){ if (curSeg && curSeg.ff) st.sinceCut = 0; curSeg = seg; segVisual = 0; }   // a cut when a fast-forward ends
        st.fastForward = seg.ff;
        let adv = seg.rate * st.speed * dt;
        // do not let one real frame leap over a segment boundary at the wrong rate
        if (st.matchSecond + adv > seg.b) adv = Math.max(seg.b - st.matchSecond, 0.001);
        st.matchSecond = Math.min(map.end, st.matchSecond + adv);
        if (seg.ff){ segVisual += map.highlightRate * st.speed * dt; st.sceneSecond = Math.min(seg.b - 0.001, seg.a + segVisual); }
        else st.sceneSecond = st.matchSecond;
        fireEventsUpTo(st.matchSecond);
        emit('onFrame', st.matchSecond, st);
      }
      raf = root.requestAnimationFrame(frame);
    }
    function finish(){ if (st.ended) return; st.ended = true; st.playing = false; st.matchSecond = finalSecond; st.sceneSecond = finalSecond; fireEventsUpTo(finalSecond, true); emit('onFrame', st.matchSecond, st); emit('onState', st); emit('onEnd', st); }

    const pb = {
      play(){ if (disposed || st.ended) return; if (!st.playing){ st.playing = true; lastTs = 0; emit('onState', st); raf = root.requestAnimationFrame(frame); } },
      pause(){ if (!st.playing) return; st.playing = false; if (raf){ root.cancelAnimationFrame(raf); raf = 0; } emit('onState', st); },
      toggle(){ if (st.playing) pb.pause(); else pb.play(); },
      setSpeed(x){ st.speed = [1,2,4].includes(x)? x : 1; emit('onState', st); },
      seek(s){ s = Math.max(0, Math.min(finalSecond, s)); st.matchSecond = s; st.sceneSecond = s; curSeg = null; st.sinceCut = 0 /* a seek is a cut */; st.endHold = 0; syncEventIndex(s); if (s>=finalSecond && !st.ended){ st.ended = true; st.playing = false; emit('onEnd', st); } else if (st.ended && s<finalSecond){ st.ended = false; } emit('onFrame', st.matchSecond, st); emit('onState', st); },
      skip(){ pb.pause(); st.matchSecond = finalSecond; finish(); },   // the official events still to come are emitted so the log is complete
      replay(){ st.ended = false; st.endHold = 0; st.matchSecond = 0; st.sceneSecond = 0; curSeg = null; syncEventIndex(0); emit('onState', st); emit('onFrame', 0, st); pb.play(); },
      state(){ return Object.assign({}, st); },
      timeMap(){ return map; },
      dispose(){ disposed = true; st.playing = false; if (raf){ root.cancelAnimationFrame(raf); raf = 0; } },
    };
    return pb;
  }

  MD.createPlayback = createPlayback; MD.buildTimeMap = buildTimeMap; MD.PLAYBACK_DEFAULTS = DEFAULTS;
})(typeof window!=='undefined'? window : globalThis);
