// ============================================================================
//  Matchday: isometric camera (Phase 3, cinematic from Milestone 3D)
//  Renderer-private: decides the scale and where the world origin lands on
//  the canvas. 'whole' fits the ground into the stage and never moves.
//  'follow' and 'close' frame the scene: the camera leads the play (the scene
//  says where its interest will be 0.8 s on), keeps everything the scene
//  says must be seen inside the view (the ball, the striker and both posts
//  through a shot, the offender and the referee through a booking, the
//  scorer and his nearest teammates through a celebration), moves on a
//  critically damped spring so it never jerks, and never lets the ball out
//  of the inner view. The scale is chosen once per highlight, at the cut,
//  from what that highlight needs: the close scale unless something in it
//  (a long shot, a corner) would not fit, when the wider one is used. It is
//  clamped to the painted ground so no bare canvas shows, and snaps only when
//  told to (cuts, seeks, first frame, mode or stage changes). It reads the
//  scene and writes only its own state.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const PR = MD.iso.projection; const DIM = PR.DIM;
  const FOLLOW_P = 12;              // pixels per metre when following: a two-metre figure is 24 pixels
  const PAN_MAX = 1.1;              // view widths per second, the most the camera will ever pan
  const SHOT_PAN = 2.2;             // times PAN_MAX while a shot is in flight
  const OMEGA = 4.2;                // the spring: critically damped, settles in about a second
  const LEAD = 0.45;                // how far towards the 0.8 s lead the camera aims
  const MARGIN = { ball: [0.17, 0.21], post: [0.06, 0.12], soft: [0.12, 0.16] };   // fractions of the view a point stays inside
  const BOUNDS = { x0: -26, y0: -36, x1: DIM.L + 26, y1: DIM.W + 14 };   // the painted ground, metres (stands included, their height folded into Y/X)
  // How far the view may look past each edge of the ground, as a fraction of the view: the near
  // side and the right-hand end have only boards and a low rail, so the view stops short there.
  const EDGE = { far: { Y: BOUNDS.y0, over: 0.12 }, left: { X: BOUNDS.x0, over: 0.12 }, near: { Y: DIM.W + DIM.runoff + 1.2 + 10*0.8, over: 0.12 }, right: { X: DIM.L + DIM.runoff + 9, over: 0.22 } };

  // Keep a view of w x h centred at (cx, cy) (origin-at-zero screen space, scale P) over the ground.
  // The ground is a diamond, so each edge is a screen line of slope +1/2 or -1/2; the view's
  // corners are held inside them with the allowed overshoot. When the view is bigger than the
  // ground in a direction, it is centred instead.
  function clampToGround(cx, cy, w, h, P){
    const o = { P, ox:0, oy:0 };
    const lineY = (Y, sx) => { const a = PR.project(0, Y, 0, o); return a.sy + (sx - a.sx)*0.5; };     // a touchline-parallel edge, slope +1/2
    const lineX = (X, sx) => { const a = PR.project(X, 0, 0, o); return a.sy - (sx - a.sx)*0.5; };     // a goal-line-parallel edge, slope -1/2
    const top = Math.max(lineY(EDGE.far.Y, cx + w/2), lineX(EDGE.left.X, cx - w/2)) + h/2 - h*EDGE.far.over;
    const bottom = Math.min(lineY(EDGE.near.Y, cx - w/2), lineX(EDGE.right.X, cx + w/2)) - h/2 + h*EDGE.near.over;
    cy = bottom < top? (top + bottom)/2 : Math.max(top, Math.min(bottom, cy));
    const L = PR.project(EDGE.left.X, EDGE.near.Y, 0, o).sx, R = PR.project(EDGE.right.X, EDGE.far.Y, 0, o).sx;
    const left = L + w/2 - w*EDGE.left.over, right = R - w/2 + w*EDGE.right.over;
    cx = right < left? (left + right)/2 : Math.max(left, Math.min(right, cx));
    return { cx, cy };
  }

  // screen point of a normalised scene point at scale P (origin at zero)
  const screenOf = (pt, P) => { const m = PR.toMetres(pt.x, pt.y); return PR.project(m.X, m.Y, pt.z||0, { P, ox:0, oy:0 }); };

  // pull the centre (cx, cy) the least distance that brings pt inside the view less its margins; returns the new centre
  function keepIn(cx, cy, pt, w, h, mx, my){
    if (pt.sx < cx - w/2 + mx) cx = pt.sx + w/2 - mx; else if (pt.sx > cx + w/2 - mx) cx = pt.sx - w/2 + mx;
    if (pt.sy < cy - h/2 + my) cy = pt.sy + h/2 - my; else if (pt.sy > cy + h/2 - my) cy = pt.sy - h/2 + my;
    return { cx, cy };
  }

  // Does everything the scene insists on seeing at these instants fit in a w x h view at scale P?
  const marginOf = pt => pt.weight==='hard'? MARGIN.ball : pt.what==='post'? MARGIN.post : MARGIN.soft;
  function fits(scene, times, w, h, P){
    for (const t of times){
      const pts = scene.frameAt? scene.frameAt(t).filter(q=>q.weight!=='nice') : null; if (!pts || pts.length < 2) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const pt of pts){ const s = screenOf(pt, P); const m = marginOf(pt); x0 = Math.min(x0, s.sx - w*m[0]); x1 = Math.max(x1, s.sx + w*m[0]); y0 = Math.min(y0, s.sy - h*m[1]); y1 = Math.max(y1, s.sy + h*m[1]); }
      if (x1 - x0 > w || y1 - y0 > h) return false;
    }
    return true;
  }
  // The scale for a highlight: chosen at its cut from what it needs over its whole length (a shot from distance or a
  // corner swung in needs the wider view on a phone), and kept until the next cut so the ground never re-tiles mid-play.
  // A goal is the one cut inside a highlight: a second after the ball crosses the line the picture cuts from the goalmouth
  // to the scorer at the close scale (when the shot needed the wider one), and stays with him until the restart.
  // Working the scale out means sampling the scene up to eighty times across the highlight, which costs as much as
  // several frames, so the answer for a highlight is remembered per match (the restart after a goal returns to the same
  // highlight, and a reduced-motion device asks on every frame), and it can be worked out a few samples a frame before
  // the cut that needs it (planJob), so that neither a cut nor the moment of a goal has to stop and think.
  const plans = typeof WeakMap!=='undefined'? new WeakMap() : null;
  const planOf = scene => { if (!plans || !scene.frameAt) return null; let m = plans.get(scene.frameAt); if (!m){ m = new Map(); plans.set(scene.frameAt, m); } return m; };
  function planKey(scene, segment, w, h, closeP){ const celeb = scene.celebration || null; const base = segment? segment.a+':'+segment.b+':'+w+':'+h+':'+closeP : 'none:'+w+':'+h+':'+closeP; return celeb? base+':c'+celeb.cut : base; }
  function planTimes(scene, segment){
    const celeb = scene.celebration || null; const times = []; const t0 = scene.t||0;
    const a = celeb? Math.max(t0, celeb.cut) : (segment? segment.a : t0), b = celeb? Math.min(celeb.end, segment? segment.b : celeb.end) : (segment? segment.b : t0);
    if (b > a){ const step = Math.max(0.4, (b - a)/80); for (let t = a; t <= b; t += step) times.push(t); times.push(b); } else times.push(t0);
    return times;
  }
  const rememberable = (scene, segment) => !!(segment || scene.celebration);   // with neither, the answer depends on the instant asked
  function chooseP(state, scene, segment, w, h, closeP, wideP, snap){
    const key = planKey(scene, segment, w, h, closeP);
    if (!snap && state.pKey===key && state.P) return state.P;
    if (!snap && state.P && state.pKey && state.pKey.indexOf('none:')!==0 && !segment) return state.P;
    const memo = rememberable(scene, segment)? planOf(scene) : null; let P = memo? memo.get(key+':'+wideP) : undefined;
    if (P===undefined){
      P = closeP;
      if (closeP !== wideP && scene.frameAt && !fits(scene, planTimes(scene, segment), w, h, closeP)) P = wideP;
      if (memo) memo.set(key+':'+wideP, P);
    }
    state.P = P; state.pKey = key; return P;
  }
  // The same answer, worked out a little at a time: step(ms) samples for about that long and says whether it has finished.
  function planJob(scene, segment, w, h, closeP, wideP){
    const memo = rememberable(scene, segment)? planOf(scene) : null; const key = planKey(scene, segment, w, h, closeP)+':'+wideP;
    if (!memo || memo.has(key) || closeP===wideP || !scene.frameAt) return { step: () => true, done: true };
    const times = planTimes(scene, segment); let i = 0; const clock = () => (root.performance && root.performance.now)? root.performance.now() : Date.now();
    const job = { done: false, step(ms){
      if (job.done) return true; if (memo.has(key)){ job.done = true; return true; }
      const until = clock() + (ms||3);
      do { if (i >= times.length){ memo.set(key, closeP); job.done = true; return true; } if (!fits(scene, [times[i++]], w, h, closeP)){ memo.set(key, wideP); job.done = true; return true; } } while (clock() < until);
      return false; } };
    return job;
  }

  function update(state, scene, w, h, mode, dtReal, snap, followP){
    if (mode==='whole'){
      const cam = PR.fit(w, h, DIM.runoff + 1.5);
      cam.ox = Math.round(cam.ox); cam.oy = Math.round(cam.oy); cam.mode = 'whole';
      state.cx = undefined; return cam;
    }
    const P = followP || FOLLOW_P;
    const ci = scene.cameraInterest || { x: scene.ball.x, y: scene.ball.y, kind:'openPlay' };
    const kind = ci.kind;
    // where to look: the interest, led towards where it is going
    let ix = ci.x, iy = ci.y;
    if (ci.ahead){ const lead = (kind==='celebration' || kind==='goal')? 0.6 : LEAD; ix += (ci.ahead.x - ci.x)*lead; iy += (ci.ahead.y - ci.y)*lead; }
    const m = PR.toMetres(ix, iy); let tX = m.X, tY = m.Y;
    const attacking = kind==='attack' || kind==='goal';
    if (attacking){
      // compose the attacker, the ball and the goalmouth: lean the centre towards the goal, up to a third of the way
      const gX = scene.ball.x < 0.5? 0 : DIM.L, gY = DIM.W/2;
      const dx = gX - tX, dy = gY - tY; const dist = Math.hypot(dx, dy) || 1; const k = Math.min(0.34, 12/dist);
      tX += dx*k; tY += dy*k;
    } else if (kind==='openPlay'){
      const dir = scene.attackDir && scene.possession!==undefined? (scene.attackDir[scene.possession] || 0) : 0;
      tX += dir*3;
    }
    const tp = PR.project(tX, tY, 0, { P, ox:0, oy:0 });
    let cx = tp.sx, cy = tp.sy;
    // What the scene says must be seen. Each point, with its margin, allows the centre an interval on each axis; the
    // centre the interest asks for is clamped into the intersection: the hard points' interval first (the ball, or the
    // scorer through a celebration; it always fits), narrowed by the must points when that leaves room, and by the
    // nice-to-haves when that still does.
    const frame = scene.frame || []; const hard = [];
    const pts = frame.map(pt => ({ sp: screenOf(pt, P), mg: marginOf(pt), weight: pt.weight||'must' }));
    if (!frame.length){ pts.push({ sp: screenOf({ x: scene.ball.x, y: scene.ball.y, z: Math.max(0, scene.ball.z||0)*PR.BALL_Z_M }, P), mg: MARGIN.ball, weight: 'hard' }); }   // a scene without framing points: the ball
    const narrow = (iv, q) => { const lo = [q.sp.sx + w*q.mg[0] - w/2, q.sp.sy + h*q.mg[1] - h/2], hi = [q.sp.sx - w*q.mg[0] + w/2, q.sp.sy - h*q.mg[1] + h/2]; const n = { x0: Math.max(iv.x0, lo[0]), x1: Math.min(iv.x1, hi[0]), y0: Math.max(iv.y0, lo[1]), y1: Math.min(iv.y1, hi[1]) }; return (n.x0 <= n.x1 && n.y0 <= n.y1)? n : null; };
    let iv = { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity };
    for (const q of pts) if (q.weight==='hard'){ hard.push(q.sp); const n = narrow(iv, q); if (n) iv = n; }
    for (const q of pts) if (q.weight==='must'){ const n = narrow(iv, q); if (n) iv = n; }
    for (const q of pts) if (q.weight==='nice'){ const n = narrow(iv, q); if (n) iv = n; }
    if (isFinite(iv.x0) || isFinite(iv.x1)) cx = Math.max(iv.x0, Math.min(iv.x1, cx));
    if (isFinite(iv.y0) || isFinite(iv.y1)) cy = Math.max(iv.y0, Math.min(iv.y1, cy));
    ({ cx, cy } = clampToGround(cx, cy, w, h, P));
    // a cut inside the scene (a restart placed rather than run to) is a cut for the camera too
    const sceneCut = scene.lastCut!==undefined && state.lastSceneT!==undefined && scene.lastCut > state.lastSceneT && scene.lastCut <= scene.t;
    state.sceneCut = sceneCut;                                   // the actors read it: a cut is a placement, not a stride
    state.lastSceneT = scene.t;
    // the cut to the scorer: a cut when he is some way from the goalmouth the camera is on, a pan when he is near it
    const cel = scene.celebration; const celebCut = !!(cel && state.lastCelebCut!==cel.cut); if (cel) state.lastCelebCut = cel.cut;
    const far = state.cx!==undefined && Math.hypot(cx - state.cx, cy - state.cy) > 0.22*w;
    state.snapped = !!(snap || sceneCut || (celebCut && far) || state.cx===undefined || state.w!==w || state.h!==h || state.lastP!==P);
    state.cutKind = !state.snapped? null : snap? 'hud' : sceneCut? 'scene' : (celebCut && far)? 'celebration' : 'reset';
    if (state.snapped){
      state.cx = cx; state.cy = cy; state.vx = 0; state.vy = 0; state.w = w; state.h = h; state.lastP = P;
    } else {
      // a critically damped spring towards the target, its speed capped; a shot in flight may go faster
      const dt = dtReal===0? 0 : Math.min(0.05, Math.max(0.001, dtReal));   // no time has passed in a still frame (a tap or a turn while paused): the camera holds exactly where it is
      const shot = attacking && scene.ball.state==='travelling';
      const om = shot? OMEGA*1.6 : OMEGA;
      const ax = om*om*(cx - state.cx) - 2*om*state.vx, ay = om*om*(cy - state.cy) - 2*om*state.vy;
      state.vx += ax*dt; state.vy += ay*dt;
      const vmax = PAN_MAX*(shot? SHOT_PAN : 1)*w; const v = Math.hypot(state.vx, state.vy);
      if (v > vmax){ state.vx *= vmax/v; state.vy *= vmax/v; }
      state.cx += state.vx*dt; state.cy += state.vy*dt;
      // the hard points never leave the inner view, whatever the spring is doing
      for (const hp of hard){ const held = keepIn(state.cx, state.cy, hp, w, h, w*MARGIN.ball[0], h*MARGIN.ball[1]); state.cx = held.cx; state.cy = held.cy; }
      ({ cx: state.cx, cy: state.cy } = clampToGround(state.cx, state.cy, w, h, P));
    }
    return { P, ox: Math.round(w/2 - state.cx), oy: Math.round(h/2 - state.cy), mode: 'follow' };
  }

  MD.iso.camera = { update, chooseP, planJob, fits, clampToGround, FOLLOW_P, BOUNDS, EDGE, PAN_MAX, SHOT_PAN, OMEGA, MARGIN };
})(typeof window!=='undefined'? window : globalThis);
