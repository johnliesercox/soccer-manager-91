// ============================================================================
//  Matchday: behaviour (role and target planner)
//  For a moment in the match, decides what every player should be doing and
//  where they should be heading: the carrier keeps the ball, the intended
//  receiver moves to meet the pass, two teammates offer support, the rest of
//  the attacking side keeps its shape, one defender presses, one covers, the
//  back line and midfield hold their zones, keepers stay goal-oriented and the
//  referee keeps up with play from a polite distance.
//
//  It is a pure function of (time, current positions, planner memory) and the
//  precomputed timeline, so the trajectory builder can step it once per tick
//  and the result is deterministic. It never moves anyone itself; it only
//  returns targets and speed bands, which trajectories.js turns into bounded
//  movement in metres per second. Hot code: it runs ~30,000 times per match
//  at build time, so it writes into reusable output records.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const PX = 105, PY = 68;                       // pitch in metres
  const BAND = { STILL:0, WALK:1.6, JOG:3.6, RUN:6.0, SPRINT:8.0 };   // m/s
  const dm = (ax, ay, bx, by) => Math.hypot((ax-bx)*PX, (ay-by)*PY);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ROLES = ['shape','carrier','receiver','support','press','cover','line','zone','keeper','set','setPiece','off','ref'];
  const ROLE_CODE = {}; ROLES.forEach((r,i)=>{ ROLE_CODE[r] = i; });

  // ctx: see scene.js. pos: current positions [{x,y}]. mem: planner memory across ticks.
  // out: reusable records [{x,y,band,role}] plus out.ref; returns out.
  function plan(ctx, t, pos, mem, out){
    const { players, H, A } = ctx;
    const n = players.length;
    const ball = ctx.ballAt(t);
    const next = ball.to;                                  // next ball keyframe
    const P = ball.team || mem.lastTeam || H; const D = P===H? A : H;
    if (mem.lastTeam!==P){ mem.possSince = t; mem.lastTeam = P; }
    const possAge = t - (mem.possSince||0);
    const anchors = ctx.anchorsAt(t);
    const shapeBall = ctx.ballAt(Math.max(ctx.cutFloor(t), t-1));   // the shape follows the ball with a little lag
    const win = ctx.windowAt(t);
    const attackH = ctx.attackAt(H, t), attackA = ctx.attackAt(A, t);
    const dirH = ctx.dirAt(H, t), dirA = ctx.dirAt(A, t);
    if (!out){ out = new Array(n); for (let i=0;i<n;i++) out[i] = { x:0, y:0, band:0, role:'shape' }; out.ref = { x:0.5, y:0.6, band:BAND.RUN, role:'ref' }; }

    // the shape position of player i (writes into sx/sy)
    let sx = 0, sy = 0;
    const shapeFor = i => {
      const pl = players[i]; const dir = pl.teamId===H? dirH : dirA;
      const sp = MD.shapePos(anchors[pl.id], ctx.roleAt(i, t), dir===1? shapeBall.x : 1-shapeBall.x, shapeBall.y, pl.teamId===H? attackH : attackA);
      sx = dir===1? sp.x : 1-sp.x; sy = sp.y;
    };
    const ownGoalX = i => ((players[i].teamId===H? dirH : dirA)===1? 0 : 1);

    // the next key at which this player takes the ball: an arrive, hold or restart, or a launch
    // handed to him by someone else (a keeper rolling it out, a loose ball he collects)
    const nextTake = i => {
      const list = ctx.carries[players[i].id]; if (!list.length) return null;
      let lo = 0, hi = list.length-1, ans = -1;
      while (lo<=hi){ const mid = (lo+hi)>>1; if (ctx.keys[list[mid]].t > t){ ans = mid; hi = mid-1; } else lo = mid+1; }
      if (ans<0) return null;
      const k = ctx.keys[list[ans]];
      if (k.kind==='launch'){ const pk = ctx.keys[k.idx-1]; if (!pk || pk.carrier===k.carrier) return null; }   // already his
      return k;
    };

    // defending side: who presses, who covers (with hysteresis so roles do not flicker)
    let press = -1, cover = -1, best = 1e9, second = 1e9;
    const distBall = i => dm(pos[i].x, pos[i].y, ball.x, ball.y);
    for (let i=0;i<n;i++){ const pl = players[i]; if (pl.teamId!==D || ctx.roleAt(i, t)==='GK' || ctx.offAtIdx(i, t)) continue; const d = distBall(i); if (d < best){ second = best; cover = press; best = d; press = i; } else if (d < second){ second = d; cover = i; } }
    if (mem.press!==undefined && mem.press>=0 && mem.press!==press && players[mem.press].teamId===D && !ctx.offAtIdx(mem.press, t) && distBall(mem.press) < best + 3){ if (cover===mem.press) cover = press; press = mem.press; }
    if (mem.cover!==undefined && mem.cover>=0 && mem.cover!==cover && mem.cover!==press && players[mem.cover].teamId===D && !ctx.offAtIdx(mem.cover, t) && distBall(mem.cover) < second + 3) cover = mem.cover;
    mem.press = press; mem.cover = cover;
    // attacking side: the two closest outfield teammates (by shape) support the carrier
    let s1 = -1, s2 = -1, d1 = 1e9, d2 = 1e9;
    for (let i=0;i<n;i++){ const pl = players[i]; if (pl.teamId!==P || ctx.roleAt(i, t)==='GK' || ball.carrier===pl.id || ctx.offAtIdx(i, t)) continue; shapeFor(i); const d = dm(sx, sy, ball.x, ball.y); if (d < d1){ d2 = d1; s2 = s1; d1 = d; s1 = i; } else if (d < d2){ d2 = d; s2 = i; } }

    for (let i=0;i<n;i++){
      const pl = players[i]; const o = out[i];
      let tx, ty, band = BAND.JOG, role = 'shape';
      if (ctx.offAtIdx(i, t)){ const spot = ctx.offSpot(pl.id); tx = spot.x; ty = spot.y; band = BAND.JOG; role = 'off'; }
      else if (win && win.targets[pl.id]){ const tg = win.targets[pl.id]; tx = tg.x; ty = tg.y; band = win.band && win.band[pl.id]? win.band[pl.id] : BAND.RUN; role = 'setPiece'; }
      else if (ball.carrier===pl.id){ const ahead = ctx.ballAt(t + 0.25); tx = ahead.x; ty = ahead.y; band = BAND.SPRINT; role = 'carrier'; }
      else if (ball.state==='loose' && ball.from && ball.from.carrier===pl.id){ tx = ball.x; ty = ball.y; band = BAND.RUN; role = 'receiver'; }   // the loose ball is his to collect
      else {
        const take = nextTake(i);
        if (take && take.t - t < 9){
          const d = dm(pos[i].x, pos[i].y, take.x, take.y); const need = d/Math.max(0.2, take.t - t);
          tx = take.x; ty = take.y; band = clamp(need*1.15, BAND.WALK, BAND.SPRINT); role = 'receiver';
          if (need < BAND.WALK*0.6 && take.t - t > 3){ shapeFor(i); tx = (sx+take.x)/2; ty = (sy+take.y)/2; band = BAND.WALK; }   // no hurry yet
        } else if (ctx.roleAt(i, t)==='GK'){
          const dir = pl.teamId===H? dirH : dirA; const gx = ownGoalX(i);
          const ballAx = dir===1? ball.x : 1-ball.x;                       // ball depth from this keeper's goal
          const off = ballAx < 0.3? 0.015 : ballAx < 0.6? 0.04 : 0.06;     // come off the line when play is far away
          const gy = 0.5 + clamp(ball.y - 0.5, -0.5, 0.5)*0.3;
          tx = gx + (dir===1? off : -off); ty = clamp(gy, 0.43, 0.57); band = BAND.JOG; role = 'keeper';
          if (next && (next.save || next.kind==='goal') && ball.inFlight){ tx = pos[i].x; ty = pos[i].y; band = BAND.STILL; role = 'set'; }
        } else if (pl.teamId===D){
          if (i===press && possAge > 0.4){ const d = distBall(i); const u = d>1e-6? 1.6/d : 0; tx = ball.x + (pos[i].x-ball.x)*u; ty = ball.y + (pos[i].y-ball.y)*u; band = d > 14? BAND.RUN : BAND.JOG; role = 'press'; }
          else if (i===cover && possAge > 0.4){ const gx = ownGoalX(i); const d = dm(ball.x, ball.y, gx, 0.5); const u = d>1e-6? Math.min(1, 8/d) : 0; tx = ball.x + (gx-ball.x)*u; ty = ball.y + (0.5-ball.y)*u; band = BAND.JOG; role = 'cover'; }
          else { shapeFor(i); tx = sx; ty = sy; band = BAND.JOG; role = pl.role==='DEF'? 'line' : 'zone'; }
        } else {
          shapeFor(i);
          if (i===s1 || i===s2){
            // offer an angle: a third of the way to the ball, never inside seven metres of it
            tx = sx + (ball.x - sx)*0.33; ty = sy + (ball.y - sy)*0.33;
            const d = dm(tx, ty, ball.x, ball.y); if (d < 7){ const dd = dm(ball.x, ball.y, sx, sy); const u = dd>1e-6? 7/dd : 0; tx = ball.x + (sx-ball.x)*u; ty = ball.y + (sy-ball.y)*u; }
            band = BAND.JOG; role = 'support';
          } else { tx = sx; ty = sy; band = BAND.JOG; role = 'shape'; }
        }
      }
      o.x = clamp(tx, 0.005, 0.995); o.y = role==='off'? ty : clamp(ty, 0.005, 0.995); o.band = band; o.role = role;
    }
    // referee: behind play, a little inside, never within four metres of the ball
    const attDir = P===H? dirH : dirA;
    let rx = ball.x - attDir*0.07, ry = ball.y + (0.5 - ball.y)*0.35;
    const dr = dm(rx, ry, ball.x, ball.y); if (dr < 4){ const u = dr>1e-6? 4/dr : 0; rx = ball.x + (rx-ball.x)*u; ry = ball.y + (ry-ball.y)*u; if (dr<1e-6){ rx = ball.x; ry = ball.y + 4/PY; } }
    out.ref.x = clamp(rx, 0.02, 0.98); out.ref.y = clamp(ry, 0.02, 0.98); out.ref.band = BAND.RUN; out.ref.role = 'ref';
    out.press = press; out.cover = cover; out.possession = P;
    return out;
  }

  MD.behaviour = { plan, BAND, PX, PY, dm, ROLES, ROLE_CODE };
})(typeof window!=='undefined'? window : globalThis);
