// ============================================================================
//  Matchday: isometric projection (Phase 3, pure maths)
//  The one place that knows how the world becomes a picture. World space is
//  the scene's: metres along the pitch, X down its 105 m length, Y across its
//  68 m width (Y grows towards the near touchline), Z metres up. The picture
//  is a 2:1 dimetric view, the classic 16-bit "isometric":
//
//      u = X - Y            one metre along X moves right and down (slope 1/2)
//      v = (X + Y) / 2      one metre along Y moves left and down (slope -1/2)
//      sx = ox + P * u      P = pixels per metre, (ox, oy) = where the world
//      sy = oy + P * (v - Z * HEIGHT)      origin (X=0, Y=0, Z=0) lands on screen
//
//  So the pitch is a diamond: the X=0 goal line runs up the left-hand edge
//  from the left corner to the top, the X=105 goal line down the right-hand
//  edge, the far touchline (Y=0) is the top-right edge and the near touchline
//  (Y=68) the bottom-left edge. Home attacks towards X=1 in the first half,
//  which is the lower-right goal. Depth for painter's ordering is X + Y:
//  bigger is nearer the viewer.
//
//  Everything here is a pure function of its arguments so it can be unit
//  tested, and nothing here reads the scene, the DOM or any renderer state.
//  A later 3D renderer replaces this file and nothing above it.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  MD.iso = MD.iso || {};

  // Real-world dimensions in metres, centralised so the pitch, the goals and any test agree.
  const DIM = {
    L: 105, W: 68,                 // pitch
    goalW: 7.32, goalH: 2.44, goalD: 1.9,   // goal mouth, crossbar height, net depth behind the line
    paD: 16.5, paW: 40.32,         // penalty area
    sixD: 5.5, sixW: 18.32,        // six-yard box
    spot: 11, circle: 9.15, corner: 1.0,
    runoff: 3.5,                   // grass beyond the lines before the boards
  };
  const HEIGHT = 1.0;              // screen pixels per metre of height, per pixel per metre of ground (1 = classic dimetric)
  const BALL_Z_M = 3.0;            // scene ball.z is normalised 0..1 over roughly three metres

  // normalised scene coordinates <-> metres
  function toMetres(x, y){ return { X: x*DIM.L, Y: y*DIM.W }; }
  function fromMetres(X, Y){ return { x: X/DIM.L, y: Y/DIM.W }; }

  // world (metres) -> screen pixels for a camera { P, ox, oy }
  function project(X, Y, Z, cam){
    return { sx: cam.ox + cam.P*(X - Y), sy: cam.oy + cam.P*((X + Y)*0.5 - (Z||0)*HEIGHT) };
  }
  // screen -> world on the ground plane (Z = 0)
  function unproject(sx, sy, cam){
    const u = (sx - cam.ox)/cam.P, v = (sy - cam.oy)/cam.P;
    return { X: v + u*0.5, Y: v - u*0.5, Z: 0 };
  }
  const depth = (X, Y) => X + Y;

  // the screen-space direction of a world facing (radians in metre space, as the scene gives it)
  function screenVector(angle){
    const dX = Math.cos(angle), dY = Math.sin(angle);
    return { dx: dX - dY, dy: (dX + dY)*0.5 };
  }
  // one of eight screen headings for a world facing; S faces the viewer. Hysteresis (radians of
  // screen angle) keeps the current heading unless the new direction has clearly left its sector.
  const angleDiff = (a, b) => Math.abs(((a - b + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);   // unsigned difference, 0..pi
  const DIRS = ['E','SE','S','SW','W','NW','N','NE'];         // by screen angle, atan2(dy, dx), 45 degrees each
  function dir8(angle, current, hysteresis){
    const v = screenVector(angle);
    if (Math.abs(v.dx) < 1e-9 && Math.abs(v.dy) < 1e-9) return current || 'S';
    const a = Math.atan2(v.dy, v.dx);                            // -pi..pi, screen y down
    if (current && hysteresis){
      const ci = DIRS.indexOf(current); if (ci >= 0){ const diff = angleDiff(a, ci*Math.PI/4); if (diff <= Math.PI/8 + hysteresis) return current; }
    }
    let idx = Math.round(a/(Math.PI/4)); idx = ((idx % 8) + 8) % 8;
    return DIRS[idx];
  }

  // The pixel extents of the world rectangle X0..X1, Y0..Y1 at scale P with the origin at (0,0).
  function extents(P, X0, Y0, X1, Y1){
    const pts = [[X0,Y0],[X1,Y0],[X0,Y1],[X1,Y1]].map(([X,Y]) => project(X, Y, 0, { P, ox:0, oy:0 }));
    const xs = pts.map(p=>p.sx), ys = pts.map(p=>p.sy);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  }
  // A camera that fits the pitch plus a margin of metres into w x h pixels, centred.
  function fit(w, h, marginM){
    const m = marginM===undefined? DIM.runoff : marginM;
    const e = extents(1, -m, -m, DIM.L + m, DIM.W + m);
    const P = Math.max(0.5, Math.min(w/(e.right - e.left), h/(e.bottom - e.top)));
    const ox = w/2 - P*(e.left + e.right)/2, oy = h/2 - P*(e.top + e.bottom)/2;
    return { P, ox, oy };
  }
  // A camera at scale P whose screen centre (w/2, h/2) sits over the world point (X, Y).
  function at(P, w, h, X, Y){
    const p = project(X, Y, 0, { P, ox:0, oy:0 });
    return { P, ox: Math.round(w/2 - p.sx), oy: Math.round(h/2 - p.sy) };
  }

  MD.iso.projection = { DIM, HEIGHT, BALL_Z_M, DIRS, angleDiff, toMetres, fromMetres, project, unproject, depth, screenVector, dir8, extents, fit, at };
})(typeof window!=='undefined'? window : globalThis);
