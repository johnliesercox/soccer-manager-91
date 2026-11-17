// ============================================================================
//  Matchday: isometric pitch (Phase 3)
//  The playing surface and its markings, built from real-world geometry in
//  metres and pushed through iso-projection: mowing stripes are strips of the
//  pitch, the centre circle is a 9.15 m circle sampled in the world, the
//  boxes, spots and arcs sit where the laws of the game put them. Lines are
//  rasterised with Bresenham into whole pixels so they stay crisp and take
//  the classic 2:1 stair-step on the diagonals. Nothing here is skewed from a
//  flat picture; change the projection and the pitch follows.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const ISO = MD.iso; const PR = ISO.projection; const DIM = PR.DIM;
  const GRASS = { a:'#3C9A46', b:'#358B3F', runoff:'#2F7D38', line:'#F4F8F2', spot:'#F4F8F2' };

  // ---- painting one part of the ground ----
  // The ground is painted a tile at a time, and every tile used to draw the whole stadium and leave the canvas to throw
  // away what fell outside it: a few milliseconds on a desktop, about 45 on a phone. While a tile is being painted the
  // stadium painter names the rectangle of canvas that is the tile (within(clip, fn)), and the primitives here leave out
  // whatever lies wholly outside it, with a pixel to spare: a polygon by the box round its corners, a line by its box
  // and then pixel by pixel. What is left out could not have put a pixel on the canvas, so the picture is the same to
  // the pixel (tools/tile-reference.js holds every tile to that). The rectangle must be the whole of the canvas being
  // painted; nothing is left out when none is named, which is how everything outside the ground painter draws.
  // (culling(false) turns the leaving-out off, for the test that paints each tile both ways and compares them)
  let CLIP = null, CULL = true;
  function within(clip, fn){ const was = CLIP; CLIP = CULL? (clip||null) : null; try { return fn(); } finally { CLIP = was; } }
  const culling = on => { if (on!==undefined) CULL = !!on; return CULL; };
  const outside = (x0, y0, x1, y1) => !!CLIP && (x1 < CLIP.x - 1 || x0 > CLIP.x + CLIP.w + 1 || y1 < CLIP.y - 1 || y0 > CLIP.y + CLIP.h + 1);

  // ---- crisp primitives ----
  // all whole-pixel line segments gathered into one path, then filled once
  function Raster(ctx){ this.ctx = ctx; this.n = 0; this.clip = CLIP; ctx.beginPath(); }
  Raster.prototype.px = function(x, y, w){ const c = this.clip; if (c){ const s = w||1; if (x + s < c.x - 1 || x > c.x + c.w + 1 || y + s < c.y - 1 || y > c.y + c.h + 1) return; } this.ctx.rect(x, y, w||1, w||1); this.n++; };
  Raster.prototype.line = function(x0, y0, x1, y1, w){
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const c = this.clip; if (c){ const s = w||1; if (Math.max(x0, x1) + s < c.x - 1 || Math.min(x0, x1) > c.x + c.w + 1 || Math.max(y0, y1) + s < c.y - 1 || Math.min(y0, y1) > c.y + c.h + 1) return; }
    const dx = Math.abs(x1-x0), dy = -Math.abs(y1-y0), sx = x0<x1? 1 : -1, sy = y0<y1? 1 : -1; let err = dx + dy;
    for (let guard=0; guard<100000; guard++){
      this.px(x0, y0, w);
      if (x0===x1 && y0===y1) break;
      const e2 = 2*err; if (e2 >= dy){ err += dy; x0 += sx; } if (e2 <= dx){ err += dx; y0 += sy; }
    }
  };
  Raster.prototype.fill = function(colour){ this.ctx.fillStyle = colour; this.ctx.fill(); this.ctx.beginPath(); this.n = 0; };

  function poly(ctx, cam, pts, colour){
    if (CLIP){
      const q = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [X,Y,Z] of pts){ const p = PR.project(X, Y, Z||0, cam); const x = Math.round(p.sx), y = Math.round(p.sy); q.push(x, y); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (outside(x0, y0, x1, y1)) return;
      ctx.beginPath(); for (let i=0;i<q.length;i+=2){ if (i) ctx.lineTo(q[i], q[i+1]); else ctx.moveTo(q[i], q[i+1]); }
      ctx.closePath(); ctx.fillStyle = colour; ctx.fill(); return;
    }
    ctx.beginPath();
    pts.forEach(([X,Y,Z], i) => { const p = PR.project(X, Y, Z||0, cam); if (i) ctx.lineTo(Math.round(p.sx), Math.round(p.sy)); else ctx.moveTo(Math.round(p.sx), Math.round(p.sy)); });
    ctx.closePath(); ctx.fillStyle = colour; ctx.fill();
  }
  // is the world rectangle X0..X1, Y0..Y1 on the ground wholly outside the part being painted?
  function groundOutside(cam, X0, Y0, X1, Y1){
    if (!CLIP) return false; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const X of [X0, X1]) for (const Y of [Y0, Y1]){ const p = PR.project(X, Y, 0, cam); if (p.sx < x0) x0 = p.sx; if (p.sx > x1) x1 = p.sx; if (p.sy < y0) y0 = p.sy; if (p.sy > y1) y1 = p.sy; }
    return outside(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  }

  // ---- the surface ----
  function drawGrass(ctx, cam){
    const m = DIM.runoff; const bands = 14;
    if (groundOutside(cam, -m, -m, DIM.L + m, DIM.W + m)) return;   // no grass in this part of the ground
    const tex = MD.isoAssets && MD.isoAssets.grass(cam.P);
    if (tex){
      // the texture is rendered at cam.P pixels per metre, so under the dimetric shear it maps one to one
      ctx.save(); ctx.setTransform(1, 0.5, -1, 0.5, cam.ox, cam.oy); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = ctx.createPattern(tex, 'repeat');
      ctx.fillRect(-m*cam.P, -m*cam.P, (DIM.L + 2*m)*cam.P, (DIM.W + 2*m)*cam.P);
      ctx.restore();
      // the run-off is a shade darker, and alternate mowing bands a touch darker still
      const ring = [[[-m,-m],[DIM.L+m,-m],[DIM.L+m,0],[-m,0]], [[-m,DIM.W],[DIM.L+m,DIM.W],[DIM.L+m,DIM.W+m],[-m,DIM.W+m]], [[-m,0],[0,0],[0,DIM.W],[-m,DIM.W]], [[DIM.L,0],[DIM.L+m,0],[DIM.L+m,DIM.W],[DIM.L,DIM.W]]];
      for (const q of ring) poly(ctx, cam, q, 'rgba(0,0,0,0.16)');
      for (let i=1;i<bands;i+=2){ const x0 = DIM.L*i/bands, x1 = DIM.L*(i+1)/bands; poly(ctx, cam, [[x0,0],[x1,0],[x1,DIM.W],[x0,DIM.W]], 'rgba(0,0,0,0.075)'); }
      return;
    }
    poly(ctx, cam, [[-m,-m],[DIM.L+m,-m],[DIM.L+m,DIM.W+m],[-m,DIM.W+m]], GRASS.runoff);
    for (let i=0;i<bands;i++){
      const x0 = DIM.L*i/bands, x1 = DIM.L*(i+1)/bands;
      poly(ctx, cam, [[x0,0],[x1,0],[x1,DIM.W],[x0,DIM.W]], i%2? GRASS.a : GRASS.b);
    }
  }

  // ---- the markings, as world-space polylines ----
  function markings(){
    const L = DIM.L, W = DIM.W, cy = W/2; const lines = [];
    const rect = (x0,y0,x1,y1) => lines.push([[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]);
    rect(0, 0, L, W);
    lines.push([[L/2, 0],[L/2, W]]);
    // centre circle: sampled in the world so it projects to a true 2:1 ellipse
    const circ = (cx, cyy, r, n, keep) => { const pts = []; for (let i=0;i<=n;i++){ const a = i/n*Math.PI*2; const p = [cx + r*Math.cos(a), cyy + r*Math.sin(a)]; if (!keep || keep(p)) pts.push(p); else if (pts.length){ lines.push(pts.slice()); pts.length = 0; } } if (pts.length) lines.push(pts); };
    circ(L/2, cy, DIM.circle, 64);
    // penalty areas, six-yard boxes
    rect(0, cy - DIM.paW/2, DIM.paD, cy + DIM.paW/2); rect(L - DIM.paD, cy - DIM.paW/2, L, cy + DIM.paW/2);
    rect(0, cy - DIM.sixW/2, DIM.sixD, cy + DIM.sixW/2); rect(L - DIM.sixD, cy - DIM.sixW/2, L, cy + DIM.sixW/2);
    // penalty arcs: the part of a 9.15 m circle round the spot that lies outside the area
    circ(DIM.spot, cy, DIM.circle, 64, p => p[0] > DIM.paD + 0.01); circ(L - DIM.spot, cy, DIM.circle, 64, p => p[0] < L - DIM.paD - 0.01);
    // corner arcs
    const corner = (cx, cyy, a0) => { const pts = []; for (let i=0;i<=8;i++){ const a = a0 + i/8*Math.PI/2; pts.push([cx + DIM.corner*Math.cos(a), cyy + DIM.corner*Math.sin(a)]); } lines.push(pts); };
    corner(0, 0, 0); corner(L, 0, Math.PI/2); corner(L, W, Math.PI); corner(0, W, -Math.PI/2);
    return { lines, spots: [[L/2, cy],[DIM.spot, cy],[L - DIM.spot, cy]] };
  }
  const MARK = markings();

  function drawMarkings(ctx, cam){
    const w = cam.P >= 16? 2 : 1;
    const r = new Raster(ctx);
    for (const pl of MARK.lines){
      for (let i=1;i<pl.length;i++){ const a = PR.project(pl[i-1][0], pl[i-1][1], 0, cam), b = PR.project(pl[i][0], pl[i][1], 0, cam); r.line(a.sx, a.sy, b.sx, b.sy, w); }
    }
    r.fill(GRASS.line);
    const s = Math.max(2, Math.round(cam.P*0.22));
    ctx.fillStyle = GRASS.spot;
    for (const [X,Y] of MARK.spots){ const p = PR.project(X, Y, 0, cam); ctx.fillRect(Math.round(p.sx - s/2), Math.round(p.sy - s/2), s, s); }
  }

  function draw(ctx, cam){ drawGrass(ctx, cam); drawMarkings(ctx, cam); }

  MD.iso.pitch = { draw, drawGrass, drawMarkings, markings: MARK, GRASS, Raster, poly, within, outside, culling, clip: () => CLIP };
})(typeof window!=='undefined'? window : globalThis);
