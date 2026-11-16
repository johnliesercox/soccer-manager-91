// ============================================================================
//  Matchday: trajectories
//  Turns the behaviour planner's targets into bounded, deterministic paths.
//  The whole match is stepped ONCE, at scene build time, in quarter-second
//  ticks: every actor accelerates towards its target within a speed band
//  (walk, jog, run, sprint, in metres per second on a 105 x 68 m pitch),
//  decelerates to arrive, keeps a little separation from everyone else, and
//  is only ever placed instantly at a genuine cut (the start of a period).
//  Each actor also carries a facing (radians, metre space) that turns at a
//  limited rate and holds when he stops, so renderers get a stable heading.
//  The recorded positions are then sampled by interpolation, so
//  getSceneAt(t) is a pure lookup whatever order it is called in, and the
//  velocity it reports is the slope of the path, never a finite-difference
//  spike.
// ============================================================================
(function(root){
  const MD = root.Matchday; const B = MD.behaviour;
  const DT = 0.25;               // planning tick (match seconds)
  const ACCEL = 6.5;             // m/s^2, also the braking limit
  const SEPARATION = 1.4;        // metres; actors closer than this are nudged apart
  const SEP_MAX = 0.15;          // metres per tick an actor can be nudged (keeps speeds honest)
  const TURN_RATE = 9.0;         // radians per second a facing may turn
  const SET_OFF = 1.0, PULL_UP = 0.3;   // metres: a man who has stopped sets off only once his target is this far away, and stops this close (no creeping after a drifting shape target)
  const PRECISE = { carrier: 1, receiver: 1, setPiece: 1, off: 1 };   // roles steered to the point regardless
  const FACE_SPEED = 1.2;        // m/s above which movement sets the facing
  const PX = B.PX, PY = B.PY;

  // ctx: see scene.js. Returns { sample(t), at(i,t), dt, ticks, stats, bytes }
  function build(ctx){
    const players = ctx.players, n = players.length;
    const end = ctx.end;
    const ticks = Math.floor(end/DT) + 12;   // a few ticks past the final whistle, so everyone brakes rather than freezes
    const X = new Float32Array(ticks*n), Y = new Float32Array(ticks*n), F = new Float32Array(ticks*n);
    const RX = new Float32Array(ticks), RY = new Float32Array(ticks), RF = new Float32Array(ticks);
    const role = new Uint8Array(ticks*n);
    // state in pitch units for position, metres per second for velocity
    const px = new Float64Array(n), py = new Float64Array(n), vx = new Float64Array(n), vy = new Float64Array(n), face = new Float64Array(n);
    let rpx = 0.5, rpy = 0.62, rvx = 0, rvy = 0, rface = 0;
    const mem = {};
    let maxSpeed = 0, maxAccel = 0;
    const offTime = players.map(pl => ctx.offTimeOf(pl.id));
    const onAt = (i, t) => offTime[i]===null || t < offTime[i];
    const pos = players.map(()=>({ x:0, y:0 }));
    let out = null;

    // put everyone on their kick-off spots: each side in its own half in its formation, squeezed towards its own goal
    // (a forward on the halfway line), the receiving side outside the centre circle, the taker on the ball with a
    // partner beside him, the referee a few metres off
    const CIRCLE_M = 9.15;
    function placeAll(t){
      const anchors = ctx.anchorsAt(t); const b = ctx.ballAt(t); const kicking = b.carrier? b.team : null;
      const taker = b.carrier!==null && b.carrier!==undefined? ctx.index[b.carrier] : undefined;
      let partner = -1, pd = Infinity;
      for (let i=0;i<n;i++){
        const pl = players[i];
        if (!onAt(i, t)){ const s = ctx.offSpot(pl.id); px[i] = s.x; py[i] = s.y; vx[i] = vy[i] = 0; continue; }
        const dir = ctx.dirAt(pl.teamId, t); const role = ctx.roleAt(i, t); const sp = MD.shapePos(anchors[pl.id], role, 0.5, 0.5, 0.5);
        let ax = role==='GK'? sp.x : Math.min(0.47, sp.x*0.68), y = sp.y;      // own half: the forwards up to the line, the rest behind them
        if (pl.teamId!==kicking || taker===undefined){                            // not the side kicking off: outside the circle
          const dym = (y - 0.5)*PY; const need = Math.sqrt(Math.max(0, CIRCLE_M*CIRCLE_M - dym*dym)) + 0.4;
          ax = Math.min(ax, 0.5 - need/PX);
        }
        px[i] = dir===1? ax : 1-ax; py[i] = y; vx[i] = vy[i] = 0;
        face[i] = dir===1? 0 : Math.PI;   // facing the goal they attack
        if (pl.teamId===kicking && i!==taker && role==='FWD'){ const d = Math.abs(y - 0.5); if (d < pd){ pd = d; partner = i; } }
      }
      // the kick-off taker stands on the ball, his partner a stride beside him, both facing the goal they attack
      if (taker!==undefined){
        px[taker] = b.x; py[taker] = b.y;
        if (partner >= 0){ const dir = ctx.dirAt(players[taker].teamId, t); px[partner] = b.x - dir*1.2/PX; py[partner] = b.y + (py[partner] >= 0.5? 1 : -1)*1.6/PY; }
      }
      rpx = 0.5; rpy = 0.62; rvx = rvy = 0; rface = -Math.PI/2;
    }
    // steer a velocity towards a target within a band, with acceleration and braking limits
    let nvx = 0, nvy = 0;
    function steer(x, y, cvx, cvy, tx, ty, band){
      const dxm = (tx - x)*PX, dym = (ty - y)*PY; const d = Math.sqrt((dxm)*(dxm) + (dym)*(dym));
      let sx = 0, sy = 0;
      if (band > 0 && d > 0.05){
        const arrive = Math.min(band, Math.sqrt(2*ACCEL*d)*0.9, d/DT);   // brake to arrive, never overshoot
        sx = dxm/d*arrive; sy = dym/d*arrive;
      }
      let ax = sx - cvx, ay = sy - cvy; const a = Math.sqrt((ax)*(ax) + (ay)*(ay)); const amax = ACCEL*DT;
      if (a > amax){ ax *= amax/a; ay *= amax/a; }
      nvx = cvx + ax; nvy = cvy + ay;
      const sp = Math.sqrt((nvx)*(nvx) + (nvy)*(nvy)); if (sp > maxSpeed) maxSpeed = sp; if (a/DT > maxAccel) maxAccel = a/DT;
    }
    // turn a facing towards a heading at a limited rate
    function turn(cur, target){
      let d = target - cur; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
      const max = TURN_RATE*DT; if (d > max) d = max; else if (d < -max) d = -max;
      let f = cur + d; if (f > Math.PI) f -= 2*Math.PI; else if (f < -Math.PI) f += 2*Math.PI; return f;
    }

    // ---- pass targeting: when a pass is struck, aim it where its receiver can actually be ----
    // The timeline aimed each pass at the receiver's shape position; by now the planner may have
    // him elsewhere. At the launch tick the arrival point is pulled towards him so that he can
    // meet the ball (at most REAIM metres from the original spot), and the keys of his following
    // run with the ball (dribble, next pass) shift by the same amount so the chain stays short.
    // Shots and goals are never moved (the shooter carries the ball to the official spot), except a strike
    // played first time from the arriving ball, which must start where that ball lands.
    const REAIM = 7, REAIM_CLEAR = 22, REAIM_REBOUND = 14;
    let nextLaunch = 0; const launches = ctx.keys.filter(k=>k.kind==='launch' && !k.shot && (!k.parry || (ctx.keys[k.idx+1] && ctx.keys[k.idx+1].carrier)));
    function reaim(k, t){
      const a = ctx.keys[k.idx+1]; if (!a || a.kind!=='arrive' || !a.carrier) return;
      const i = ctx.index[a.carrier]; if (i===undefined || !onAt(i, t)) return;
      // a ball met first time (a header, a volley, a first-time shot) cannot wait for him: no grace then
      const after = ctx.keys[a.idx+1]; const struckNow = !!(after && after.kind==='launch' && after.carrier===a.carrier && after.t - a.t < 0.6);
      const flight = Math.max(0.3, a.t - k.t) + (struckNow? 0.05 : 0.4);
      const dx = (a.x + (a.sox||0) - px[i])*PX, dy = (a.y + (a.soy||0) - py[i])*PY; const d = Math.sqrt((dx)*(dx) + (dy)*(dy));
      const reach = B.BAND.SPRINT*0.95*flight;
      if (d <= reach) return;
      // move the arrival point along the line towards the receiver, by at most REAIM metres (a clearance is a
      // hoof towards a team-mate rather than a pass to a spot, so it may land a good deal nearer him)
      const move = Math.min(k.clearance? REAIM_CLEAR : k.parry? REAIM_REBOUND : REAIM, d - reach); const ux = dx/d, uy = dy/d;
      const nx = Math.max(0.01, Math.min(0.99, a.x - ux*move/PX)), ny = Math.max(0.01, Math.min(0.99, a.y - uy*move/PY));
      const ddx = nx - a.x, ddy = ny - a.y; a.x = nx; a.y = ny;
      // (a first-time strike moves with its arrival so the ball stays continuous; a shot after a carry does not)
      for (let j=a.idx+1; j<ctx.keys.length; j++){ const kk = ctx.keys[j]; if (kk.carrier!==a.carrier || kk.kind==='restart' || kk.cut) break; if (kk.shot && kk.t - a.t > 0.6 && kk.technique!=='first-time') break; if (kk.kind!=='hold' && kk.kind!=='launch') break; kk.x = Math.max(0.01, Math.min(0.99, kk.x + ddx)); kk.y = Math.max(0.01, Math.min(0.99, kk.y + ddy)); if (kk.shot) break; }
    }

    placeAll(0);
    const moving = new Uint8Array(n); let refMoving = 0;
    let cutIdx = 0;
    const cuts = ctx.cutTimes;
    for (let k=0;k<ticks;k++){
      const t = k*DT;
      // a new period: everyone is placed, not run, to the kick-off (the camera cuts here too)
      while (cutIdx < cuts.length && cuts[cutIdx] <= t){ placeAll(cuts[cutIdx]); cutIdx++; mem.press = mem.cover = undefined; }
      while (nextLaunch < launches.length && launches[nextLaunch].t <= t + DT){ reaim(launches[nextLaunch], t); nextLaunch++; }
      for (let i=0;i<n;i++){ pos[i].x = px[i]; pos[i].y = py[i]; }
      pos.ref = { x: rpx, y: rpy };
      // the positions at this tick are the ones the plan is made from; the step below takes everyone to the next tick
      for (let i=0;i<n;i++){ X[k*n+i] = px[i]; Y[k*n+i] = py[i]; F[k*n+i] = face[i]; }
      RX[k] = rpx; RY[k] = rpy; RF[k] = rface;
      out = B.plan(ctx, t, pos, mem, out);
      if (typeof process!=='undefined' && process.env && process.env.TRACE_ID){ const ti = ctx.index[process.env.TRACE_ID]; const [ta, tb] = (process.env.TRACE_T||'0,0').split(',').map(Number); if (ti!==undefined && t >= ta && t <= tb){ const tg = out[ti]; console.log('trace', t.toFixed(2), 'at', (px[ti]*PX).toFixed(2), (py[ti]*PY).toFixed(2), 'target', (tg.x*PX).toFixed(2), (tg.y*PY).toFixed(2), 'band', tg.band, tg.role); } }
      if (t >= end){ for (let i=0;i<n;i++) out[i].band = 0; out.ref.band = 0; }   // the whistle has gone: pull up
      for (let i=0;i<n;i++){
        const tg = out[i];
        if (tg.role==='off'){
          const s = ctx.offSpot(players[i].id);
          if (Math.hypot((px[i]-s.x)*PX, (py[i]-s.y)*PY) < 0.5){ px[i] = s.x; py[i] = s.y; vx[i] = vy[i] = 0; }
          else { steer(px[i], py[i], vx[i], vy[i], tg.x, tg.y, B.BAND.JOG); vx[i] = nvx; vy[i] = nvy; px[i] += nvx*DT/PX; py[i] += nvy*DT/PY; }
        } else {
          let band = tg.band;
          if (!PRECISE[tg.role]){
            const d = Math.sqrt(((tg.x - px[i])*PX)**2 + ((tg.y - py[i])*PY)**2);
            if (moving[i]){ if (d < PULL_UP) moving[i] = 0; } else if (d > SET_OFF) moving[i] = 1;
            if (!moving[i]) band = 0;
          } else moving[i] = 1;
          steer(px[i], py[i], vx[i], vy[i], tg.x, tg.y, band); vx[i] = nvx; vy[i] = nvy; px[i] += nvx*DT/PX; py[i] += nvy*DT/PY;
        }
        role[k*n+i] = B.ROLE_CODE[tg.role]||0;
      }
      // separation: nudge pairs apart a little (never more than SEP_MAX per tick), carrier stays put
      const ball = out.ball || ctx.ballAt(t);
      const bx = SEPARATION/PX, by = SEPARATION/PY;
      for (let i=0;i<n;i++){
        if (!onAt(i, t)) continue;
        const xi = px[i], yi = py[i];
        for (let j=i+1;j<n;j++){
          if (px[j]-xi > bx || xi-px[j] > bx || py[j]-yi > by || yi-py[j] > by) continue;   // far apart: the common case
          if (!onAt(j, t)) continue;
          const dxm = (px[j]-xi)*PX, dym = (py[j]-yi)*PY; const d = Math.sqrt((dxm)*(dxm) + (dym)*(dym));
          if (d >= SEPARATION || d < 1e-6) continue;
          const push = Math.min(SEP_MAX, (SEPARATION - d)*0.5); const ux = dxm/d, uy = dym/d;
          const iFixed = ball.carrier===players[i].id, jFixed = ball.carrier===players[j].id;
          if (!iFixed){ const m = jFixed? Math.min(SEP_MAX, push*2) : push; px[i] -= ux*m/PX; py[i] -= uy*m/PY; }
          if (!jFixed){ const m = iFixed? Math.min(SEP_MAX, push*2) : push; px[j] += ux*m/PX; py[j] += uy*m/PY; }
        }
        px[i] = Math.max(0.003, Math.min(0.997, px[i]));
        if (onAt(i, t)) py[i] = Math.max(0.003, Math.min(0.997, py[i]));
      }
      // facing: follows the direction of travel when moving, holds when still
      for (let i=0;i<n;i++){ const sp = Math.sqrt((vx[i])*(vx[i]) + (vy[i])*(vy[i])); if (sp > FACE_SPEED) face[i] = turn(face[i], Math.atan2(vy[i], vx[i])); }
      // referee
      { const r = out.ref; const rd = Math.sqrt(((r.x - rpx)*PX)**2 + ((r.y - rpy)*PY)**2); if (refMoving){ if (rd < PULL_UP) refMoving = 0; } else if (rd > SET_OFF) refMoving = 1; steer(rpx, rpy, rvx, rvy, r.x, r.y, refMoving? r.band : 0); rvx = nvx; rvy = nvy; rpx += rvx*DT/PX; rpy += rvy*DT/PY; rpx = Math.max(0.01, Math.min(0.99, rpx)); rpy = Math.max(0.01, Math.min(0.99, rpy)); if (Math.sqrt((rvx)*(rvx) + (rvy)*(rvy)) > FACE_SPEED) rface = turn(rface, Math.atan2(rvy, rvx)); }
    }

    // ---- sampling ----
    const outP = players.map(()=>({ x:0, y:0, vx:0, vy:0, speed:0, facing:0, role:'shape' }));
    const ref = { x:0, y:0, vx:0, vy:0, facing:0 };
    const lerpAngle = (a, b, u) => { let d = b - a; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return a + d*u; };
    function sample(t){
      const tt = Math.max(0, Math.min(t, (ticks-2)*DT)); const k = Math.floor(tt/DT); const u = (tt - k*DT)/DT;
      const base0 = k*n, base1 = (k+1)*n;
      // never interpolate across a cut: hold the last tick before it
      let cutBetween = false; for (const c of cuts){ if (c > k*DT && c <= (k+1)*DT && c > tt){ cutBetween = true; break; } }
      for (let i=0;i<n;i++){
        const x0 = X[base0+i], y0 = Y[base0+i], x1 = X[base1+i], y1 = Y[base1+i];
        const o = outP[i];
        if (cutBetween){ o.x = x0; o.y = y0; o.vx = 0; o.vy = 0; o.facing = F[base0+i]; }
        else { o.x = x0 + (x1-x0)*u; o.y = y0 + (y1-y0)*u; o.vx = (x1-x0)/DT; o.vy = (y1-y0)/DT; o.facing = lerpAngle(F[base0+i], F[base1+i], u); }
        o.speed = Math.sqrt((o.vx*PX)*(o.vx*PX) + (o.vy*PY)*(o.vy*PY));
        o.role = B.ROLES[role[base0+i]]||'shape';
      }
      if (cutBetween){ ref.x = RX[k]; ref.y = RY[k]; ref.vx = ref.vy = 0; ref.facing = RF[k]; }
      else { ref.x = RX[k] + (RX[k+1]-RX[k])*u; ref.y = RY[k] + (RY[k+1]-RY[k])*u; ref.vx = (RX[k+1]-RX[k])/DT; ref.vy = (RY[k+1]-RY[k])/DT; ref.facing = lerpAngle(RF[k], RF[k+1], u); }
      return { players: outP, ref };
    }
    // position of one player at a tick (for control timing)
    const at = (i, t) => { const k = Math.max(0, Math.min(ticks-1, Math.round(t/DT))); return { x: X[k*n+i], y: Y[k*n+i] }; };
    return { sample, at, dt: DT, ticks, stats: { maxSpeed, maxAccel }, bytes: (X.byteLength+Y.byteLength+F.byteLength+RX.byteLength+RY.byteLength+RF.byteLength+role.byteLength) };
  }

  MD.trajectories = { build, DT, ACCEL, SEPARATION, SEP_MAX, TURN_RATE };
})(typeof window!=='undefined'? window : globalThis);
