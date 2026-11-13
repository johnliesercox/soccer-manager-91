// ============================================================================
//  Matchday: audio
//  Synthesised whistle and crowd using WebAudio only (no files to cache, no
//  licences). Off by default; the choice persists in localStorage. Every
//  node is created lazily on the first user gesture so autoplay rules are
//  respected, and stop() tears everything down when the viewer closes.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const KEY = 'sm91-matchday-sound';
  let ctx = null, crowd = null, crowdGain = null, enabled = false, loaded = false;

  function load(){ if (loaded) return; loaded = true; try { enabled = root.localStorage.getItem(KEY)==='on'; } catch(e){ enabled = false; } }
  function save(){ try { root.localStorage.setItem(KEY, enabled? 'on' : 'off'); } catch(e){} }
  function ac(){
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch(e){ ctx = null; }
    return ctx;
  }
  function noiseBuffer(c, seconds){
    const n = Math.floor(c.sampleRate*seconds), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i=0;i<n;i++){ const w = Math.random()*2-1; last = (last + 0.02*w)/1.02; d[i] = last*3.5; }   // brown-ish noise
    return buf;
  }
  function startCrowd(){
    const c = ac(); if (!c || crowd) return;
    crowd = c.createBufferSource(); crowd.buffer = noiseBuffer(c, 4); crowd.loop = true;
    const filt = c.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 420; filt.Q.value = 0.5;
    crowdGain = c.createGain(); crowdGain.gain.value = 0.0001;
    crowd.connect(filt); filt.connect(crowdGain); crowdGain.connect(c.destination);
    crowd.start();
    crowdGain.gain.setTargetAtTime(0.09, c.currentTime, 0.8);
  }
  function stopCrowd(){ if (!crowd) return; try { crowdGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); const s = crowd; setTimeout(()=>{ try { s.stop(); } catch(e){} }, 600); } catch(e){} crowd = null; crowdGain = null; }
  function beep(freq, when, dur, gain){
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(freq, when); o.frequency.linearRampToValueAtTime(freq*1.02, when+dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(gain, when+0.02); g.gain.exponentialRampToValueAtTime(0.0001, when+dur);
    o.connect(g); g.connect(c.destination); o.start(when); o.stop(when+dur+0.05);
  }
  const A = {
    get enabled(){ load(); return enabled; },
    setEnabled(on){ load(); enabled = !!on; save(); if (!enabled) stopCrowd(); else if (A.live) startCrowd(); },
    live: false,
    // a match is being watched: crowd murmur on (if enabled)
    start(){ load(); A.live = true; if (enabled){ const c = ac(); if (c && c.state==='suspended') c.resume(); startCrowd(); } },
    stop(){ A.live = false; stopCrowd(); },
    whistle(kind){ load(); if (!enabled) return; const c = ac(); if (!c) return; const t = c.currentTime;
      if (kind==='end'){ beep(2200, t, 0.35, 0.12); beep(2200, t+0.4, 0.35, 0.12); beep(2300, t+0.8, 0.7, 0.12); }
      else beep(2200, t, 0.45, 0.12); },
    goal(){ load(); if (!enabled) return; const c = ac(); if (!c) return; if (crowdGain){ const t = c.currentTime; crowdGain.gain.cancelScheduledValues(t); crowdGain.gain.setTargetAtTime(0.5, t, 0.08); crowdGain.gain.setTargetAtTime(0.09, t+1.8, 0.9); } },
    chance(){ load(); if (!enabled || !crowdGain) return; const t = ctx.currentTime; crowdGain.gain.cancelScheduledValues(t); crowdGain.gain.setTargetAtTime(0.22, t, 0.1); crowdGain.gain.setTargetAtTime(0.09, t+0.6, 0.5); },
  };
  MD.audio = A;
})(typeof window!=='undefined'? window : globalThis);
