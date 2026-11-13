// ============================================================================
//  Matchday: interactions
//  The beats of every ball action, decided before anything is drawn:
//    setup -> set feet -> CONTACT -> flight or roll -> receive/control,
//    save, block or miss -> recovery.
//  From the ball keyframes it derives, per player, timed action windows
//  with a normalised phase (pass, shoot, receive, tackle, block, dive, set,
//  celebrate, booked), the ball's state at any moment (controlled,
//  travelling, loose, dead), when a loose ball is actually brought under
//  control by the player the timeline hands it to, and a camera interest
//  point. Renderers read these; they never work any of it out themselves.
// ============================================================================
(function(root){
  const MD = root.Matchday; const B = MD.behaviour;
  const CONTROL_RADIUS = 1.6;     // metres: within this the carrier has the ball
  const CONTROL_GRACE = 1.6;      // seconds a loose ball waits for its new owner before we give up and snap

  // Decide when each hand-over key really takes effect: the ball waits (loose) at the key point
  // until its new carrier is close, up to a grace period. traj.at(i, t) gives planned positions.
  function controlTimes(ctx, traj){
    const keys = ctx.keys;
    for (let i=0;i<keys.length;i++){
      const k = keys[i];
      k.controlT = k.t;
      if (!k.carrier || k.kind==='launch') continue;
      if (k.kind==='restart' || k.cut) continue;           // restarts are placed, not chased
      const pi = ctx.index[k.carrier]; if (pi===undefined) continue;
      const next = keys[i+1]; const limit = Math.min(k.t + CONTROL_GRACE, next? next.t - 0.2 : k.t + CONTROL_GRACE);
      let tt = k.t, found = k.t;
      while (tt <= limit){ const q = traj.at(pi, tt); if (B.dm(q.x, q.y, k.x, k.y) <= CONTROL_RADIUS){ found = tt; break; } tt += traj.dt; found = tt; }
      k.controlT = Math.max(k.t, Math.min(found, limit));
    }
  }

  // Per-player action windows: { from, to, action, aimX, aimY, contact }
  function actions(ctx){
    const keys = ctx.keys; const cues = {}; for (const pl of ctx.players) cues[pl.id] = [];
    const add = (id, from, to, action, extra) => { if (id && cues[id]) cues[id].push(Object.assign({ from, to, action }, extra||{})); };
    for (let i=0;i<keys.length;i++){
      const k = keys[i]; const nk = keys[i+1], pk = keys[i-1];
      if (k.kind==='launch' && k.carrier && !k.parry){
        add(k.carrier, k.t-0.5, k.t+0.35, k.shot? 'shoot' : 'pass', { aimX: nk? nk.x : k.x, aimY: nk? nk.y : k.y, contact: k.t });
        // the keeper facing a shot sets himself as it is struck
        if (k.shot && nk && (nk.save || nk.kind==='goal') && nk.carrier) add(nk.carrier, k.t-1.0, nk.t-0.5, 'set', { aimX: k.x, aimY: k.y });
        if (k.shot && nk && nk.kind==='goal'){ const gk = ctx.gkOf[ctx.other(k.team)]; if (gk) { add(gk, k.t-1.0, nk.t-0.45, 'set', { aimX: k.x, aimY: k.y }); add(gk, nk.t-0.45, nk.t+0.8, 'dive', { aimX: k.x, aimY: k.y }); } }
      }
      if (k.kind==='arrive' && k.carrier && !k.save && !k.block){ add(k.carrier, (k.controlT||k.t)-0.15, (k.controlT||k.t)+0.55, 'receive', { aimX: pk? pk.x : k.x, aimY: pk? pk.y : k.y, contact: k.controlT||k.t }); }
      if (k.save && k.carrier){ add(k.carrier, k.t-0.5, k.t+0.8, 'dive', { aimX: pk? pk.x : k.x, aimY: pk? pk.y : k.y, contact: k.t }); }
      if (k.block && k.carrier){ add(k.carrier, k.t-0.4, k.t+0.6, 'block', { aimX: pk? pk.x : k.x, aimY: pk? pk.y : k.y, contact: k.t }); }
      if (k.tackle && k.carrier){ add(k.carrier, k.t-0.5, k.t+0.55, 'tackle', { aimX: pk? pk.x : k.x, aimY: pk? pk.y : k.y, contact: k.t }); }
      if (k.kind==='restart' && k.carrier){ const n2 = keys.slice(i+1).find(x=>x.kind==='launch'); if (n2 && n2.carrier===k.carrier && n2.t - k.t < 12) add(k.carrier, n2.t-0.5, n2.t+0.35, 'pass', { aimX: keys[n2.idx+1]? keys[n2.idx+1].x : n2.x, aimY: keys[n2.idx+1]? keys[n2.idx+1].y : n2.y, contact: n2.t }); }
    }
    for (const e of ctx.events){ if (e.type===MD.EVENT.CARD && e.playerId) add(e.playerId, e.matchSecond-0.5, e.matchSecond+2.5, 'booked'); }
    for (const w of ctx.windows) for (const id in w.anim) add(id, w.from+0.8, w.to-1.8, w.anim[id]);
    for (const id in cues) cues[id].sort((a,b)=>a.from-b.from);
    return cues;
  }

  // The ball at t, honouring control times: {x,y,z,carrier,team,state,inFlight,from,to,progress}
  function ballAt(ctx, t){
    const keys = ctx.keys;
    const i = ctx.lastIndex(keys, t, k=>k.t);
    if (i<0) return { x:0.5, y:0.5, z:0, carrier:null, team: ctx.H, state:'dead', inFlight:false, from:null, to:null, progress:0 };
    const k0 = keys[i], k1 = keys[i+1];
    const lerp = (a,b,u) => a + (b-a)*u; const smooth = u => u<0? 0 : u>1? 1 : u*u*(3-2*u);
    const held = !k1 || k1.t<=k0.t || k1.cut;
    const dead = k0.kind==='goal' || k0.out || (held && k0.kind!=='restart' && k0.kind!=='hold' && k0.kind!=='arrive');
    if (k0.kind==='launch' && k1){
      const u = (t-k0.t)/(k1.t-k0.t); const dist = Math.hypot(k1.x-k0.x, k1.y-k0.y);
      const z = Math.sin(Math.PI*u) * Math.min(1, dist*1.6) * (k1.kind==='goal'? 0.35 : k0.parry? 0.25 : 1);
      return { x: lerp(k0.x,k1.x,u), y: lerp(k0.y,k1.y,u), z, carrier:null, team:k0.team, state:'travelling', inFlight:true, from:k0, to:k1, progress:u };
    }
    // a hand-over waits for its carrier: loose at the key point until controlT
    const ct = k0.controlT||k0.t;
    if (t < ct) return { x:k0.x, y:k0.y, z:0, carrier:null, team:k0.team, state:'loose', inFlight:false, from:k0, to:k1, progress:0 };
    if (held){
      const x = k0.kind==='goal'? k0.x + (k0.x>0.5? 0.012 : -0.012) : k0.x;   // in the net
      return { x, y:k0.y, z:0, carrier:k0.carrier, team:k0.team, state: k0.carrier? 'controlled' : (dead? 'dead' : 'loose'), inFlight:false, from:k0, to:null, progress:1 };
    }
    const u = smooth((t-ct)/Math.max(0.01, k1.t-ct));
    const state = k0.carrier? 'controlled' : (k0.kind==='goal'? 'dead' : 'loose');
    // the ball rolls to the next key (a dribble when carried, a slow roll when loose); a dead ball stays in the net until the restart
    if (k0.kind==='goal'){ const x = k0.x + (k0.x>0.5? 0.012 : -0.012); const u2 = Math.max(0, (t - (k1.t-2))/2); return { x: lerp(x, k1.x, smooth(u2)), y: lerp(k0.y, k1.y, smooth(u2)), z:0, carrier:null, team:k0.team, state: u2>0? 'dead' : 'dead', inFlight:false, from:k0, to:k1, progress:u2 }; }
    return { x: lerp(k0.x,k1.x,u), y: lerp(k0.y,k1.y,u), z:0, carrier:k0.carrier, team:k0.team, state, inFlight:false, from:k0, to:k1, progress:u };
  }

  // Where the camera should look: the ball plus whoever is about to matter
  function cameraInterest(ctx, ball, t, win, flash){
    let x = ball.x, y = ball.y, kind = 'openPlay'; const participants = [];
    if (ball.carrier) participants.push(ball.carrier);
    if (flash){ kind = 'goal'; }
    else if (win){ kind = 'setPiece'; }
    if (ball.inFlight && ball.to){
      // anticipate the arrival a little
      const k1 = ball.to; x = ball.x + (k1.x-ball.x)*0.35; y = ball.y + (k1.y-ball.y)*0.35;
      if (k1.carrier) participants.push(k1.carrier);
      if (k1.save || k1.kind==='goal' || (ball.from && ball.from.shot)){ kind = flash? 'goal' : 'attack'; const gx = k1.x>0.5? 1 : 0; x = (ball.x + gx)/2; y = (ball.y + 0.5)/2; }
    } else if (ball.to && ball.to.t - t < 1.2 && ball.from && ball.from.carrier){
      // a pass is about to be played: lean towards the receiver
      const k1 = ball.to; x = ball.x + (k1.x-ball.x)*0.2; y = ball.y + (k1.y-ball.y)*0.2; if (k1.carrier) participants.push(k1.carrier);
    }
    if (kind==='openPlay' && (ball.x < 0.22 || ball.x > 0.78)) kind = 'attack';
    return { x, y, kind, participants };
  }

  MD.interactions = { controlTimes, actions, ballAt, cameraInterest, CONTROL_RADIUS, CONTROL_GRACE };
})(typeof window!=='undefined'? window : globalThis);
