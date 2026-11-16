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
  const MD = root.Matchday;
  const DIM = { L: 105, W: 68 }; const B = MD.behaviour;
  const CONTROL_RADIUS = 1.6;     // metres: within this the carrier has the ball
  const CONTROL_GRACE = 1.6;      // seconds a loose ball waits for its new owner before we give up and snap

  // Decide when each hand-over key really takes effect: the ball waits (loose) at the key point
  // until its new carrier is close, up to a grace period. traj.at(i, t) gives planned positions.
  const challengeControl = (k, next) => Math.max(k.t, Math.min(k.t + 0.5, next? next.t - 0.2 : k.t + 0.5));
  // known before the simulation runs (the planner reads the ball's state while it plans): a challenge's control time
  function presetControl(keys){ for (let i=0;i<keys.length;i++){ const k = keys[i]; if ((k.tackle || k.block) && k.carrier) k.controlT = challengeControl(k, keys[i+1]); } return keys; }
  function controlTimes(ctx, traj){
    const keys = ctx.keys;
    for (let i=0;i<keys.length;i++){
      const k = keys[i];
      k.controlT = k.t;
      if (!k.carrier || k.kind==='launch') continue;
      if (k.kind==='restart' || k.cut) continue;           // restarts are placed, not chased
      const pi = ctx.index[k.carrier]; if (pi===undefined) continue;
      const next = keys[i+1];
      // a ball won in a tackle or stopped by a block lies where it was met while the man who met it gets up to it: it does
      // not jump to his feet at the instant of the challenge
      if (k.tackle || k.block){ k.controlT = challengeControl(k, next); continue; }
      const limit = Math.min(k.t + CONTROL_GRACE, next? next.t - 0.2 : k.t + CONTROL_GRACE);
      let tt = k.t, found = k.t;
      while (tt <= limit){ const q = traj.at(pi, tt); if (B.dm(q.x, q.y, k.x, k.y) <= CONTROL_RADIUS){ found = tt; break; } tt += traj.dt; found = tt; }
      k.controlT = Math.max(k.t, Math.min(found, limit));
    }
  }

  // Per-player action windows: { from, to, action, aimX, aimY, contact, ... }
  // Actions: pass, shoot, volley, header, receive, catch, dive, getup, block (slide/line flags), tackle (slide
  // flag), set, celebrate, booked, dismay. A renderer without art for one of them falls back to a near pose.
  function actions(ctx){
    const keys = ctx.keys; const cues = {}; for (const pl of ctx.players) cues[pl.id] = [];
    const add = (id, from, to, action, extra) => { if (id && cues[id]) cues[id].push(Object.assign({ from, to, action }, extra||{})); };
    const strikeAction = k => k.technique==='header'? 'header' : k.technique==='volley'? 'volley' : k.shot? 'shoot' : 'pass';
    for (let i=0;i<keys.length;i++){
      const k = keys[i]; const nk = keys[i+1], pk = keys[i-1];
      if (k.kind==='launch' && k.carrier && !k.parry){
        const act = strikeAction(k); const aerial = act==='header' || act==='volley';
        // the wind-up starts half a second before the strike, or just after the block or save he has only just made
        const lead = Math.min(aerial? 0.45 : 0.5, (pk && pk.carrier===k.carrier && (pk.block || pk.save || pk.tackle))? Math.max(0.1, k.t - pk.t - 0.15) : 9);
        add(k.carrier, k.t-lead, k.t+(aerial? 0.45 : 0.35), act, { aimX: nk? nk.x : k.x, aimY: nk? nk.y : k.y, contact: k.t, z: k.z0||0, firstTime: k.technique==='first-time' });
        if (k.shot && nk){
          const gk = nk.keeper || (nk.save? nk.carrier : null) || ctx.gkOf[ctx.other(k.team)];
          // the keeper facing a shot sets himself as it is struck, then saves, is beaten or dives in vain
          if (gk && (nk.save || nk.kind==='goal' || nk.post || nk.line)) add(gk, k.t-1.0, nk.t-0.45, 'set', { aimX: k.x, aimY: k.y });
          if (gk && (nk.kind==='goal' || nk.post || nk.line)){ add(gk, nk.t-0.45, nk.t+0.8, 'dive', { aimX: nk.x, aimY: nk.y, beaten: true }); add(gk, nk.t+0.8, nk.t+2.0, 'getup', {}); }
          // a miss, the woodwork or a last-gasp clearance: the shooter shows it, one of three ways
          if (nk.out || nk.post || nk.line){ const h = MD.hashString((k.eventId||'')+':'+k.carrier); const variant = nk.post? (h%2? 2 : 0) : (h%3); add(k.carrier, nk.t+0.6, nk.t+3.2, 'dismay', { kind: nk.post? 'woodwork' : nk.line? 'line' : (nk.miss||'wide'), variant }); }
        }
      }
      if (k.kind==='arrive' && k.carrier && !k.save && !k.block){
        // met in the air and struck straight away: the header/volley cue covers it; otherwise a first touch
        const struckNow = nk && nk.kind==='launch' && nk.carrier===k.carrier && nk.t - k.t < 0.6;
        if (k.catch) add(k.carrier, k.t-0.6, k.t+0.7, 'catch', { aimX: pk? pk.x : k.x, aimY: pk? pk.y : k.y, contact: k.t, z: k.z1||0 });
        else if (!struckNow){
          // the first touch; it ends before his next kick begins (a late-collected ball can run close to it)
          const ct = k.controlT||k.t; const nextKick = (nk && nk.kind==='launch' && nk.carrier===k.carrier)? nk.t - 0.5 : Infinity;
          const to = Math.min(ct + 0.55, nextKick - 0.05);
          if (to > ct - 0.15) add(k.carrier, ct-0.15, to, 'receive', { aimX: pk? pk.x : k.x, aimY: pk? pk.y : k.y, contact: ct, z: k.z1||0, intercept: !!k.intercept });
        }
      }
      if (k.save && k.carrier){
        if (k.catch) add(k.carrier, k.t-0.5, k.t+0.8, 'catch', { aimX: pk? pk.x : k.x, aimY: pk? pk.y : k.y, contact: k.t, z: k.z1||0 });
        else { add(k.carrier, k.t-0.5, k.t+0.8, 'dive', { aimX: k.x, aimY: k.y, contact: k.t, z: k.z1||0, parry: !!k.parried }); add(k.carrier, k.t+0.8, k.t+2.0, 'getup', {}); }
      }
      if (k.block && k.carrier){ add(k.carrier, k.t-0.4, k.t+0.6, 'block', { aimX: pk? pk.x : k.x, aimY: pk? pk.y : k.y, contact: k.t, slide: !!k.slide, line: !!k.line }); }
      if (k.tackle && k.carrier){ const aim = k.tackleFrom? k : (pk||k); add(k.carrier, k.t-0.5, k.t+0.55, 'tackle', { aimX: aim.x, aimY: aim.y, contact: k.t, slide: k.slide!==false }); }
      if (k.kind==='restart' && k.carrier){ const n2 = keys.slice(i+1).find(x=>x.kind==='launch'); if (n2 && n2.carrier===k.carrier && n2.t - k.t < 12) add(k.carrier, n2.t-0.5, n2.t+0.35, 'pass', { aimX: keys[n2.idx+1]? keys[n2.idx+1].x : n2.x, aimY: keys[n2.idx+1]? keys[n2.idx+1].y : n2.y, contact: n2.t }); }
    }
    for (const e of ctx.events){ if (e.type===MD.EVENT.CARD && e.playerId) add(e.playerId, e.matchSecond-0.5, e.matchSecond+2.5, 'booked'); }
    // a foul: a clumsy slide from the offender at the man on the ball, who goes down on his knees for a moment
    for (const f of (ctx.fouls||[])){
      add(f.playerId, f.t-0.45, f.t+0.6, 'tackle', { aimX: f.x, aimY: f.y, contact: f.t, slide: true });
      if (f.victimId!==null && f.victimId!==undefined) add(f.victimId, f.t+0.05, f.t+2.4, 'dismay', { variant: 1 });
    }
    // set-piece and celebration windows: a plain action name spans the window; a list gives timed segments with extras
    for (const w of ctx.windows) for (const id in w.anim){
      const an = w.anim[id];
      if (typeof an==='string') add(id, w.from+0.8, w.to-1.8, an);
      else for (const seg of an) add(id, w.from + seg.from, Math.min(w.to, w.from + seg.to), seg.action, Object.assign({}, seg.extra||{}, seg.aim? { aimX: seg.aim.x, aimY: seg.aim.y } : {}));
    }
    for (const id in cues) cues[id].sort((a,b)=>a.from-b.from);
    return cues;
  }

  // The ball at t, honouring control times: {x,y,z,carrier,team,state,inFlight,from,to,progress}
  // position along a move that accelerates over the first `ramp` of it, cruises, and brakes over the last `ramp`
  function trapezoid(u, ramp){
    if (ramp <= 0) return u; const flat = 1 - 2*ramp; const vmax = 1/(ramp + flat);   // distance = area under the speed profile = 1
    if (u < ramp) return vmax*u*u/(2*ramp);
    if (u < 1 - ramp) return vmax*(ramp/2 + (u - ramp));
    const r = 1 - u; return 1 - vmax*r*r/(2*ramp);
  }
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
      // a flight rises in an arc over the straight line from its launch height to the height it is met at
      const arc = k0.arc!==undefined? k0.arc : (k1.kind==='goal'? 0.35 : k0.parry? 0.25 : 1);
      const z = Math.min(1, Math.sin(Math.PI*u) * Math.min(1, dist*1.6) * arc + lerp(k0.z0||0, k1.z1||0, u));
      return { x: lerp(k0.x,k1.x,u), y: lerp(k0.y,k1.y,u), z, carrier:null, team:k0.team, state:'travelling', inFlight:true, from:k0, to:k1, progress:u };
    }
    // a ball that has gone out of play is dead where it crossed the line: it runs on for a moment with what is left of
    // its pace (behind the goal, towards the boards) and lies there until the restart places it on its spot. It never
    // rolls back into play to be collected (it used to drift to the next key, so a wide shot came back off the boards
    // to a defender's feet)
    if (k0.out){
      if (k0.rx===undefined){
        const pk = keys[i-1]; let dx = 0, dy = 0;
        if (pk && pk.kind==='launch'){ dx = (k0.x - pk.x)*105; dy = (k0.y - pk.y)*68; }
        const len = Math.hypot(dx, dy) || 1; const run = k0.miss==='over'? 2.5 : 2.2;   // metres of run-on, over the bar a touch more
        let rx = k0.x + dx/len*run/105, ry = k0.y + dy/len*run/68;
        // and at least a metre beyond the goal line, so it is seen to be out; a ball the timeline has already run to the
        // corner flag (behind for a corner) lies there as it is
        const atFlag = Math.abs(k0.y - 0.5) > 0.45;
        if (atFlag){ rx = k0.x; ry = k0.y; }
        else if (k0.x > 0.9) rx = Math.max(rx, 1 + 1.0/105); else if (k0.x < 0.1) rx = Math.min(rx, -1.0/105);
        k0.rx = rx; k0.ry = Math.max(0, Math.min(1, ry));
      }
      const u = Math.max(0, Math.min(1, (t - k0.t)/0.8)); const e = 1 - (1-u)*(1-u);
      return { x: lerp(k0.x, k0.rx, e), y: lerp(k0.y, k0.ry, e), z: 0, carrier: null, team: k0.team, state: 'dead', inFlight: false, from: k0, to: k1, progress: 0 };
    }
    // a hand-over waits for its carrier: loose at the key point until controlT
    const ct = k0.controlT||k0.t;
    if (t < ct) return { x:k0.x, y:k0.y, z: k0.z1||0, carrier:null, team:k0.team, state:'loose', inFlight:false, from:k0, to:k1, progress:0 };
    if (held){
      // in the net after a goal, a little behind the line
      const behind = k0.kind==='goal';
      const x = behind? k0.x + (k0.x>0.5? 0.012 : -0.012) : k0.x;
      // a restart nobody takes (the whistle goes first) stays placed on its spot
      return { x, y:k0.y, z: (k0.catch && k0.carrier && k0.save)? 1.15/3 : 0, carrier:k0.carrier, team:k0.team, state: k0.carrier? 'controlled' : (dead? 'dead' : 'loose'), placed: k0.kind==='restart', inFlight:false, from:k0, to:null, progress:1 };
    }
    // a restart is placed: the ball lies on its spot (the corner arc, the centre spot, the six-yard line) until it is kicked
    if (k0.kind==='restart' && k1 && k1.kind==='launch' && k1.carrier===k0.carrier) return { x:k0.x, y:k0.y, z:0, carrier:k0.carrier, team:k0.team, state:'controlled', placed:true, inFlight:false, from:k0, to:k1, progress:0 };
    // a carried ball moves at a steady pace with a short ease at each end (a smoothstep over a long carry peaks at one and a
    // half times the average speed, which the man carrying it cannot match, so he was left behind at the strike)
    const T = Math.max(0.01, k1.t-ct); const ramp = Math.min(0.3, 0.25*T)/T; const uu = Math.max(0, Math.min(1, (t-ct)/T));
    const u = k0.carrier? trapezoid(uu, ramp) : smooth(uu);
    const state = k0.carrier? 'controlled' : (k0.kind==='goal'? 'dead' : 'loose');
    const CHEST = 1.15/3;
    let zHold = (k0.z1 && k1.kind==='launch' && k1.t - k0.t < 0.6)? lerp(k0.z1, k1.z0||0, u) : (k0.z1 && k0.post)? k0.z1*(1-u) : 0;
    if (k0.catch && k0.carrier && k0.save){                      // caught and clutched to the chest, lowered as he rolls it out
      const down = k1.kind==='launch'? Math.max(0, Math.min(1, (t - (k1.t - 0.6))/0.6)) : 0;
      zHold = lerp(lerp(k0.z1||CHEST, CHEST, Math.min(1, (t - ct)/0.3)), k1.z0||0, down);
    }
    // the ball rolls to the next key (a dribble when carried, a slow roll when loose); a dead ball stays in the net until the
    // restart, which is a cut (it used to glide to the centre spot over the last two seconds, dragging the camera across an empty pitch)
    if (k0.kind==='goal'){ const x = k0.x + (k0.x>0.5? 0.012 : -0.012); return { x, y: k0.y, z:0, carrier:null, team:k0.team, state:'dead', inFlight:false, from:k0, to:k1, progress:0 }; }
    return { x: lerp(k0.x,k1.x,u), y: lerp(k0.y,k1.y,u), z: zHold, carrier:k0.carrier, team:k0.team, state, inFlight:false, from:k0, to:k1, progress:u };
  }

  // Where the camera should look: the ball plus whoever is about to matter
  function cameraInterest(ctx, ball, t, win, flash, focus){
    let x = ball.x, y = ball.y, kind = 'openPlay'; const participants = [];
    if (ball.carrier) participants.push(ball.carrier);
    if (win && win.kind==='celebration'){
      // a goal: the net first, then the camera moves ahead to where the scorer is heading, so he runs into the frame
      const age = t - win.from; kind = age < 1.5? 'goal' : 'celebration'; const u = Math.max(0, Math.min(1, (age - 0.8)/1.6));
      if (focus){ x = ball.x + (focus.x - ball.x)*u; y = ball.y + (focus.y - ball.y)*u; participants.push(focus.id); }
      return { x, y, kind, participants };
    }
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

  // ---- stand-offs: where a player stands so that the striking part of his pose meets the ball ----
  // The ball's keys are where the ball is. A kicker's foot is 0.42 m in front of him at the contact frame, a header is
  // met 0.27 m in front of the head's owner, a keeper's hands are 0.46 m in front of him for a catch and 1.25 m along
  // his body for a parry, a first touch is taken 0.32 m in front. Each key gets the offset (normalised units) from the
  // ball to where its player should stand, along the heading the renderer will give him; the planner and the
  // re-aiming use (k.x + k.sox, k.y + k.soy) as the player's spot. A key that moves keeps its offset.
  // how far behind the ball a man stands so that the contact point of the pose drawn (iso-sprites) meets it: the kicking foot
  // of the kick and shoot poses, the volley foot, the head thrown forward, the keeper's hands (reaching up for a high ball,
  // in front of the chest for one at chest height, low for one along the ground), the outstretched hand of a parry, the
  // receiving foot, the shins of a standing block, the leading foot of a sliding block, a slide tackle or a standing poke
  const STAND = { pass: 0.42, shoot: 0.52, volley: 0.6, header: 0.27, catch: 0.46, catchChest: 0.26, catchLow: 0.3, parry: 1.25, receive: 0.32, block: 0.1, slide: 0.6, tackle: 0.7, poke: 0.62 };
  const catchStand = z => { const zm = (z||0)*3; return zm < 0.8? STAND.catchLow : zm < 1.45? STAND.catchChest : STAND.catch; };
  // the world direction of the eight-way sprite heading a world direction is drawn with (iso-projection.dir8 and
  // iso-sprites.HEADING, in closed form): the screen direction of (dX, dY) is (dX - dY, (dX + dY)/2); the sector centre
  // at angle s has screen direction (cos s, sin s), which is the world direction ((cos s + 2 sin s)/2, (2 sin s - cos s)/2)
  function quantised(ux, uy){
    const sx = ux - uy, sy = (ux + uy)*0.5; if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return { x: ux, y: uy };
    const sector = Math.round(Math.atan2(sy, sx)/(Math.PI/4))*(Math.PI/4); const a = Math.cos(sector), b = Math.sin(sector);
    const wx = (a + 2*b)/2, wy = (2*b - a)/2; const d = Math.sqrt(wx*wx + wy*wy); return { x: wx/d, y: wy/d };
  }
  function standOffsets(keys){
    const PX = DIM.L, PY = DIM.W;
    const unit = (from, to) => { const dx = (to.x - from.x)*PX, dy = (to.y - from.y)*PY; const d = Math.sqrt(dx*dx + dy*dy); return d > 1e-6? quantised(dx/d, dy/d) : null; };
    const set = (k, u, off) => { if (!u){ k.sox = 0; k.soy = 0; return; } k.sox = -off*u.x/PX; k.soy = -off*u.y/PY; };
    for (let i=0;i<keys.length;i++){
      const k = keys[i], nk = keys[i+1], pk = keys[i-1];
      if (k.kind==='launch' && k.carrier && !k.parry && nk){
        const off = k.technique==='header'? STAND.header : k.technique==='volley'? STAND.volley : k.shot? STAND.shoot : STAND.pass;
        set(k, unit(k, nk), off);
        // met first time: he waits where the strike will be made, not where the ball lands
        if (pk && pk.kind==='arrive' && pk.carrier===k.carrier && k.t - pk.t < 0.6 && !pk.save){ pk.sox = k.sox; pk.soy = k.soy; }
      } else if (k.kind==='arrive' && k.save && k.carrier && pk){
        if (k.catch) set(k, unit(k, pk), catchStand(k.z1));                              // facing the shooter, hands in front at the ball's height
        else { const g = { x: k.x < 0.5? 0 : 1, y: 0.5 }; set(k, unit(g, k), STAND.parry); }   // diving from the middle of his goal at the ball
      } else if (k.kind==='arrive' && k.carrier && !k.save && !k.block && pk && pk.kind==='launch' && k.sox===undefined){
        set(k, unit(k, pk), STAND.receive);                                              // the first touch, facing the ball
      } else if (k.block && k.carrier && pk && pk.kind==='launch'){
        set(k, unit(k, pk), k.slide? STAND.slide : STAND.block);
      } else if (k.tackle && k.carrier && pk){
        // the line the ball is on: where it has come from since the last key, or, when it has not moved on yet (a man
        // tackled as he takes his first touch), the line it came in on; failing both, the line from the middle of the pitch
        const ppk = keys[i-2]; const centre = { x: 0.5, y: 0.5 };
        const path = unit(pk, k) || (ppk && unit(ppk, pk)) || unit(centre, k) || { x: 1, y: 0 };   // (a tackle on the centre spot itself: along the halfway line)
        if (k.slide===false) set(k, { x: -path.x, y: -path.y }, STAND.poke);             // a standing poke: he meets the ball head on
        else {
          // a sliding tackle comes in from the side of the ball's path (from the inside, towards the middle of the pitch),
          // the leading foot reaching the ball where it is won; the cue faces him at the ball along the same line
          let nx = -path.y, ny = path.x;                                                  // a normal to the path
          const cx = (0.5 - k.x)*PX, cy = (0.5 - k.y)*PY; if (nx*cx + ny*cy < 0){ nx = -nx; ny = -ny; }   // the one towards the middle
          const n = quantised(nx, ny); k.sox = -STAND.tackle*n.x/PX; k.soy = -STAND.tackle*n.y/PY; k.tackleFrom = { x: k.x + k.sox, y: k.y + k.soy };
        }
      }
    }
    return keys;
  }
  const standOf = k => ({ x: k.x + (k.sox||0), y: k.y + (k.soy||0) });

  MD.interactions = { controlTimes, presetControl, actions, ballAt, cameraInterest, standOffsets, standOf, STAND, catchStand, CONTROL_RADIUS, CONTROL_GRACE };
})(typeof window!=='undefined'? window : globalThis);
