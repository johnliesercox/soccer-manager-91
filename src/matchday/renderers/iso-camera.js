// ============================================================================
//  Matchday: isometric camera (Phase 3)
//  Renderer-private: decides the scale and where the world origin lands on
//  the canvas. 'whole' fits the ground into the stage and never moves.
//  'follow' frames the scene's cameraInterest at a fixed scale with a dead
//  zone, a critically damped approach and a capped pan speed, keeps the goal
//  mouth in view during attacks, and is clamped to the painted ground so no
//  bare canvas shows. It snaps only when told to (cuts, seeks, first frame,
//  mode or stage changes). It reads the scene and writes only its own state.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const PR = MD.iso.projection; const DIM = PR.DIM;
  const FOLLOW_P = 12;              // pixels per metre when following: a two-metre figure is 24 pixels
  const DEAD_ZONE = 0.09;           // fraction of the view the interest may wander without a pan
  const PAN_MAX = 1.25;             // view widths per second
  const SHOT_PAN = 2.5;             // times PAN_MAX while a shot is in flight: the camera whips to the goal before the ball arrives
  const BOUNDS = { x0: -26, y0: -36, x1: DIM.L + 26, y1: DIM.W + 14 };   // the painted ground, metres (stands included, their height folded into Y/X)
  // How far the view may look past each edge of the ground, as a fraction of the view: the near
  // side and the right-hand end have only boards and a low rail, so the view stops short there.
  const EDGE = { far: { Y: BOUNDS.y0, over: 0.12 }, left: { X: BOUNDS.x0, over: 0.12 }, near: { Y: DIM.W + DIM.runoff + 1.2 + 10*0.8, over: 0.12 }, right: { X: DIM.L + DIM.runoff + 9, over: 0.22 } };   // the near side and the right end have terraces behind them

  // Keep a view of w x h centred at (cx, cy) (origin-at-zero screen space, scale P) over the ground.
  // The ground is a diamond, so each edge is a screen line of slope +1/2 or -1/2; the view's
  // corners are held inside them with the allowed overshoot. When the view is bigger than the
  // ground in a direction, it is centred instead.
  function clampToGround(cx, cy, w, h, P){
    const o = { P, ox:0, oy:0 };
    const lineY = (Y, sx) => { const a = PR.project(0, Y, 0, o); return a.sy + (sx - a.sx)*0.5; };     // a touchline-parallel edge, slope +1/2
    const lineX = (X, sx) => { const a = PR.project(X, 0, 0, o); return a.sy - (sx - a.sx)*0.5; };     // a goal-line-parallel edge, slope -1/2
    // vertical: the top corners must stay below the far and left edges, the bottom corners above the near and right edges
    const top = Math.max(lineY(EDGE.far.Y, cx + w/2), lineX(EDGE.left.X, cx - w/2)) + h/2 - h*EDGE.far.over;
    const bottom = Math.min(lineY(EDGE.near.Y, cx - w/2), lineX(EDGE.right.X, cx + w/2)) - h/2 + h*EDGE.near.over;
    cy = bottom < top? (top + bottom)/2 : Math.max(top, Math.min(bottom, cy));
    // horizontal: the left and right corners of the diamond
    const L = PR.project(EDGE.left.X, EDGE.near.Y, 0, o).sx, R = PR.project(EDGE.right.X, EDGE.far.Y, 0, o).sx;
    const left = L + w/2 - w*EDGE.left.over, right = R - w/2 + w*EDGE.right.over;
    cx = right < left? (left + right)/2 : Math.max(left, Math.min(right, cx));
    return { cx, cy };
  }

  function update(state, scene, w, h, mode, dtReal, snap, followP){
    if (mode==='whole'){
      const cam = PR.fit(w, h, DIM.runoff + 1.5);
      cam.ox = Math.round(cam.ox); cam.oy = Math.round(cam.oy); cam.mode = 'whole';
      state.cx = undefined; return cam;
    }
    const P = followP || FOLLOW_P;
    const o = { P, ox:0, oy:0 };
    const ci = scene.cameraInterest || { x: scene.ball.x, y: scene.ball.y, kind:'openPlay' };
    const m = PR.toMetres(ci.x, ci.y); let tX = m.X, tY = m.Y;
    const attacking = ci.kind==='attack' || ci.kind==='goal';
    const gX = scene.ball.x < 0.5? 0 : DIM.L, gY = DIM.W/2;
    if (attacking){
      // compose the attacker, the ball and the goalmouth: lean the centre towards the goal, up to a third of the way
      const dx = gX - tX, dy = gY - tY; const dist = Math.hypot(dx, dy) || 1; const k = Math.min(0.34, 12/dist);
      tX += dx*k; tY += dy*k;
    } else {
      // open play: lead a little in the direction the side in possession is attacking
      const dir = scene.attackDir && scene.possession!==undefined? (scene.attackDir[scene.possession] || 0) : 0;
      tX += dir*4;
    }
    const t = PR.project(tX, tY, 0, o);
    let cx = t.sx, cy = t.sy;
    const keep = (pt, mx, my) => { if (pt.sx < cx - w/2 + mx) cx = pt.sx - w/2 + mx; if (pt.sx > cx + w/2 - mx) cx = pt.sx + w/2 - mx; if (pt.sy < cy - h/2 + my) cy = pt.sy - h/2 + my; if (pt.sy > cy + h/2 - my) cy = pt.sy + h/2 - my; };
    // soft: both posts of the goal mouth (at crossbar height, so the keeper stays in) during attacks and goals
    if (attacking){ keep(PR.project(gX, gY - DIM.goalW/2, 1.5, o), w*0.1, h*0.16); keep(PR.project(gX, gY + DIM.goalW/2, 1.5, o), w*0.1, h*0.16); }
    // hard: the interest itself never leaves the inner view
    keep(PR.project(m.X, m.Y, 0, o), w*0.18, h*0.22);
    // stay over the painted ground
    ({ cx, cy } = clampToGround(cx, cy, w, h, P));
    if (snap || state.cx===undefined || state.w!==w || state.h!==h){ state.cx = cx; state.cy = cy; state.w = w; state.h = h; }
    else {
      const dx = cx - state.cx, dy = cy - state.cy;
      const outX = Math.max(0, Math.abs(dx) - w*DEAD_ZONE), outY = Math.max(0, Math.abs(dy) - h*DEAD_ZONE);
      if (outX > 0 || outY > 0){
        const shot = attacking && scene.ball.state==='travelling';   // a shot in flight: a narrow (phone) view must reach the goal in under half a second
        const k = 1 - Math.exp(-dtReal/(shot? 0.2 : 0.55));
        let mx = Math.sign(dx)*outX*k, my = Math.sign(dy)*outY*k;
        const maxStep = PAN_MAX*(shot? SHOT_PAN : 1)*w*dtReal; const step = Math.hypot(mx, my);
        if (step > maxStep){ mx *= maxStep/step; my *= maxStep/step; }
        state.cx += mx; state.cy += my;
      }
    }
    return { P, ox: Math.round(w/2 - state.cx), oy: Math.round(h/2 - state.cy), mode: 'follow' };
  }

  MD.iso.camera = { update, clampToGround, FOLLOW_P, BOUNDS, EDGE, DEAD_ZONE, PAN_MAX, SHOT_PAN };
})(typeof window!=='undefined'? window : globalThis);
