// ============================================================================
//  Matchday: isometric stadium (Phase 3, Milestone 2)
//  An original, modest early-1990s English ground around the projected
//  pitch: a stepped main terrace behind the far touchline with crush
//  barriers and a roof over its back rows, two open end terraces, boards and
//  a low rail with a few rows on the near side, floodlight pylons in the far
//  corners, and the goal frames with their nets. The crowd is thousands of
//  little people (a coat and a head each) in muted coats with the two kits'
//  colours sprinkled in, who stand up when a goal goes in. Everything is
//  placed in world metres (X, Y, Z) and projected, so the view angle is the
//  same for the crowd, the posts and the players.
//
//  drawGround paints the whole ground for a camera and can be given a clip
//  rectangle (in canvas pixels) so the renderer can paint it one tile at a
//  time; the goals are drawn per frame as depth-sorted objects.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const ISO = MD.iso; const PR = ISO.projection; const DIM = PR.DIM; const PITCH = ISO.pitch;
  const COATS = ['#2B2F3A','#1E2430','#3A3A3A','#4A3A2A','#2F3F2F','#5A5E66','#6B5B4A','#3B4A6B','#8A8A8A','#2A2A2A','#4F4F57','#7A6A5A'];
  const BRIGHT = ['#D04040','#F2C230','#F2F2F2','#4A7BD0','#F0A030','#70C070','#C070C0','#E8C070'];
  const SKIN = ['#F2C9A0','#D9A066','#8D5524','#5C3A1E','#E8B88A'];
  const CONCRETE = '#5C6269', CONCRETE_DARK = '#454A50', RAIL = '#AEB4BA', BOARD = ['#1F4FA8','#D9D9D9','#C8351E','#F2C230','#2A8A4A'];
  // metres: step height, step depth, gap from the run-off edge. In a 2:1 view a slope steeper than
  // one in two reads as a wall of faces rising behind the pitch, which is the look we want.
  // the near terrace is flat, so its people are seen in the foreground rather than stacked; so is the X=105 end, which rises
  // towards the viewer: at the far stand's slope its rows would lie along the line of sight and collapse into one band
  const STAND = { rows: 16, rise: 0.75, tread: 0.8, gap: 1.2, endRows: 10, nearRows: 10, nearRise: 0.25, rightRise: 0.3, roofRows: 6 };
  const NET = 'rgba(240,246,240,0.5)', POST = '#F7F9F7', POST_EDGE = '#8E948E';

  const inClip = (clip, x, y, w, h) => !clip || (x + w >= clip.x && x <= clip.x + clip.w && y + h >= clip.y && y <= clip.y + clip.h);

  // the dugouts: two shelters on the far side either side of the halfway line, set into the front of the far stand and open
  // towards the pitch, which in this view is towards the viewer, so their benches and interiors are seen (on the near side a
  // dugout would show the viewer only its back wall and roof, with the hoardings hiding the rest)
  const DUGOUT = { from: [41, 59], metres: 5, depth: 1.8, h: 2.1, roofT: 0.15 };
  function dugoutBox(X0){ const yb = -(DIM.runoff + 0.4); return { xa: X0, xb: X0 + DUGOUT.metres, ya: yb - DUGOUT.depth, yb, zTop: DUGOUT.h + 0.2 }; }

  // a painted piece (tools/iso_paint.py: 'far', 'near', 'left', 'right' stands or the 'boards') tiled along its run:
  // the texture holds `metres` of the piece at P px/m with its front-bottom anchor corner at anchor.x/y; place(along)
  // gives the world point of that corner at `along` metres. Tiles are scaled a touch so a whole number spans the run
  // exactly. Returns false (nothing drawn) when the style ships no such piece, so the generated art stands alone.
  // `bounce` (optional): { amp, phase } draws each tile in horizontal bands lifted by a travelling wave, the crowd
  // rising for a goal; the bottom wall and the top edge of the piece stay put
  function paintedRun(ctx, cam, name, from, to, place, clip, bounce){
    const AS = MD.isoAssets; const tex = AS && AS.pieceTexture && AS.pieceTexture(cam.P, name); if (!tex) return false;
    const T = tex.meta; const span = to - from; const n = Math.max(1, Math.round(span/T.metres)); const len = span/n; const f = (len/T.metres)*(cam.P/T.P);
    for (let k=0;k<n;k++){
      const a = PR.project(...place(from + k*len), cam);
      const x = Math.round(a.sx - T.anchor.x*f), y = Math.round(a.sy - T.anchor.y*f), w = Math.round(tex.image.width*f), h = Math.round(tex.image.height*f);
      if (!inClip(clip, x, y, w, h)) continue;
      if (!bounce){ ctx.drawImage(tex.image, x, y, w, h); continue; }
      const bands = 10, sh = tex.image.height/bands, dh = h/bands;
      for (let b=0;b<bands;b++){
        const u = (b + 0.5)/bands; const win = Math.sin(Math.PI*Math.max(0, Math.min(1, (u - 0.1)/0.75)));   // the fans, not the roof edge or the front wall
        const dy = -Math.round(bounce.amp*win*Math.max(0, Math.sin(bounce.phase + b*0.9 + k*1.3)));
        ctx.drawImage(tex.image, 0, b*sh, tex.image.width, sh, x, Math.round(y + b*dh) + dy, w, Math.ceil(dh) + 1);
      }
    }
    return true;
  }
  // the crowd rising for a goal: the scoring side's sections (the home support in the main stand and the X=0 end, the
  // away support in the X=105 end), a wave that builds in a third of a second and dies away over seven. Drawn over the
  // cached ground, before the players.
  const CROWD_SIDES = { home: ['far', 'left'], away: ['right'] };
  function drawCrowdReaction(ctx, cam, side, age, intensity, clip){
    const amp = cam.P*0.12*(intensity||1)*Math.min(1, age/0.3)*Math.max(0, 1 - age/7);
    if (amp < 0.6) return false;
    const L = DIM.L, W = DIM.W, m = DIM.runoff, sm = DIM.runoff + STAND.gap; const bounce = { amp, phase: age*9 };
    let drew = false;
    for (const name of CROWD_SIDES[side]||[]){
      if (name==='far') drew = paintedRun(ctx, cam, 'far', -m - 2, L + m + 2, along => [along, -(DIM.runoff + STAND.gap), 0], clip, bounce) || drew;
      else if (name==='left') drew = paintedRun(ctx, cam, 'left', -m - 1, W + m - 2, along => [-sm, along, 0], clip, bounce) || drew;
      else if (name==='right') drew = paintedRun(ctx, cam, 'right', -m - 1, W + m - 2, along => [L + sm, along, 0], clip, bounce) || drew;
    }
    return drew;
  }
  const paintedStand = (ctx, cam, from, to, clip) => paintedRun(ctx, cam, 'far', from, to, along => [along, -(DIM.runoff + STAND.gap), 0], clip);

  // a dugout at X0: the painted sprite when the style ships one, else a plain shelter (walls, bench, perspex roof). Part
  // of the ground, drawn after the far stand (it stands in front of its first rows) and before the pitch.
  function drawDugout(ctx, cam, X0, clip){
    const b = dugoutBox(X0);
    const AS = MD.isoAssets; const tex = AS && AS.pieceTexture && AS.pieceTexture(cam.P, 'dugout');
    if (tex){
      const T = tex.meta; const f = cam.P/T.P; const a = PR.project(b.xa, b.ya, 0, cam);
      const x = Math.round(a.sx - T.anchor.x*f), y = Math.round(a.sy - T.anchor.y*f), w = Math.round(tex.image.width*f), h = Math.round(tex.image.height*f);
      if (inClip(clip, x, y, w, h)) ctx.drawImage(tex.image, x, y, w, h);
      return;
    }
    const { xa, xb, ya, yb } = b; const h = DUGOUT.h, roofT = DUGOUT.roofT;   // ya is the back (away from the pitch), yb the open front
    PITCH.poly(ctx, cam, [[xa, ya, 0], [xb, ya, 0], [xb, ya, h], [xa, ya, h]], '#6B7078');                           // back wall, inside face
    PITCH.poly(ctx, cam, [[xa, ya, 0], [xa, yb, 0], [xa, yb, h], [xa, ya, h]], '#5A5F66');                           // left wall, inside face
    PITCH.poly(ctx, cam, [[xa, ya + 0.1, 0.45], [xb, ya + 0.1, 0.45], [xb, yb - 0.9, 0.45], [xa, yb - 0.9, 0.45]], '#C9A063');   // bench seat
    PITCH.poly(ctx, cam, [[xa, ya + 0.1, 0.45], [xb, ya + 0.1, 0.45], [xb, ya + 0.1, 1.0], [xa, ya + 0.1, 1.0]], '#B08850');     // bench back
    PITCH.poly(ctx, cam, [[xb, ya, 0], [xb, yb, 0], [xb, yb, h], [xb, ya, h]], '#80858C');                           // right wall, outside face (nearest the viewer)
    PITCH.poly(ctx, cam, [[xa, ya, h], [xb, ya, h], [xb, yb + 0.2, h], [xa, yb + 0.2, h]], '#AEB7C2');                 // roof slab, overhanging the front
    PITCH.poly(ctx, cam, [[xa, yb + 0.2, h], [xb, yb + 0.2, h], [xb, yb + 0.2, h + roofT], [xa, yb + 0.2, h + roofT]], '#E3E8EE');   // roof lip
  }

  function terrace(ctx, cam, rnd, axis, from, to, rows, jump, clip, colours){
    const m = DIM.runoff + STAND.gap; let drewCrowd = false;
    const rise = axis==='Y+'? STAND.nearRise : axis==='X+'? STAND.rightRise : STAND.rise;
    const place = (along, r, zUp) => {
      const d = m + r*STAND.tread; const Z = 0.5 + r*rise + (zUp||0);
      if (axis==='Y')  return [along, -d, Z];
      if (axis==='Y+') return [along, DIM.W + d, Z];
      if (axis==='X-') return [-d, along, Z];
      return [DIM.L + d, along, Z];
    };
    // rows farthest from the viewer first, so nearer rows paint over them: the back rows of the far stand and the X=0
    // end recede from the viewer, while the back rows of the near side and the X=105 end come towards the viewer
    const order = []; if (axis==='Y+' || axis==='X+'){ for (let r=0; r<rows; r++) order.push(r); } else { for (let r=rows-1; r>=0; r--) order.push(r); }
    const w0 = place(from, 0, 0), w1 = place(to, 0, 0);
    if (order[0]===0) PITCH.poly(ctx, cam, [w0, w1, [w1[0], w1[1], 0], [w0[0], w0[1], 0]], CONCRETE_DARK);   // the front wall, behind the steps when the terrace rises towards the viewer
    for (const r of order){
      const a = place(from, r, 0), b = place(to, r, 0), c = place(to, r+1, 0), d = place(from, r+1, 0);
      PITCH.poly(ctx, cam, [d, c, b, a], r%2? CONCRETE : CONCRETE_DARK);
    }
    if (order[0]!==0) PITCH.poly(ctx, cam, [w0, w1, [w1[0], w1[1], 0], [w0[0], w0[1], 0]], CONCRETE_DARK);   // the front wall, in front of the steps
    // pre-rendered crowd strips when the art assets are loaded for this scale
    const fam = axis==='Y'? 'far' : axis==='Y+'? 'near' : axis==='X-'? 'left' : 'right';
    const AS = MD.isoAssets; const probe = AS && AS.crowdStrip(cam.P, fam, 0, false, rnd.seed, colours);
    if (probe){
      for (const r of order){
        for (let k=0, along=from; along < to; k++, along += probe.metres){
          const variant = (r*3 + k) % 4; const standing = jump && ((r + k) % 3 !== 0);
          const strip = AS.crowdStrip(cam.P, fam, variant, standing, rnd.seed, colours) || probe;
          const p = PR.project(...place(along, r, 0), cam); const x = Math.round(p.sx) - strip.ox, y = Math.round(p.sy) - strip.oy;
          if (!inClip(clip, x, y, strip.width, strip.height)) continue;
          ctx.drawImage(strip, x, y); drewCrowd = true;
        }
        if (r%4===1){ const a = PR.project(...place(from, r, 1.0), cam), b = PR.project(...place(to, r, 1.0), cam); const rr = new PITCH.Raster(ctx); rr.line(a.sx, a.sy, b.sx, b.sy, 1); rr.fill(RAIL); }
      }
      return drewCrowd;
    }
    // spectators: a coat and a head each, muted coats with the kits' colours sprinkled in
    const step = 0.3; const bw = Math.max(1, Math.round(cam.P*0.24)), bh = Math.max(2, Math.round(cam.P*0.3)), hw = Math.max(1, Math.round(cam.P*0.14)), hh = Math.max(1, Math.round(cam.P*0.13));
    const pal = COATS.concat(colours||[]);
    for (const r of order){
      const off = (r%2)? step/2 : 0;
      if (clip){ const pa = PR.project(...place(from, r, 0.6), cam), pb = PR.project(...place(to, r, 0.6), cam); const pad = cam.P*1.2; if (!inClip(clip, Math.min(pa.sx, pb.sx) - pad, Math.min(pa.sy, pb.sy) - bh - hh - pad, Math.abs(pb.sx - pa.sx) + 2*pad, Math.abs(pb.sy - pa.sy) + bh + hh + 2*pad)){ for (let t=from+off; t<to; t+=step){ rnd(); rnd(); rnd(); rnd(); rnd(); } continue; } }
      for (let t=from+off; t<to; t+=step){
        const u = rnd(); const pick = rnd(); const c = u < 0.08? BRIGHT[Math.floor(pick*BRIGHT.length)] : pal[Math.floor(pick*pal.length)]; const sk = SKIN[Math.floor(rnd()*SKIN.length)];
        const gap = rnd() < 0.04; const up = rnd() < 0.6 && jump? 0.35 : 0;   // five draws per person whatever happens, so every tile and variant agrees
        if (gap) continue;                               // a gap here and there
        const p = PR.project(...place(t, r, 0.6 + up), cam);
        const x = Math.round(p.sx - bw/2), y = Math.round(p.sy - bh);
        if (!inClip(clip, x, y - hh, bw, bh + hh)) continue;
        ctx.fillStyle = c; ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = sk; ctx.fillRect(Math.round(p.sx - hw/2), y - hh, hw, hh);
        drewCrowd = true;
      }
      // a crush barrier every fourth row, in front of that row's people
      if (r%4===1){ const a = PR.project(...place(from, r, 1.0), cam), b = PR.project(...place(to, r, 1.0), cam); const rr = new PITCH.Raster(ctx); rr.line(a.sx, a.sy, b.sx, b.sy, 1); rr.fill(RAIL); }
    }
    return drewCrowd;
  }

  // a roof over the back rows of the far stand: the slab we see from above, a fascia along its front edge, and pillars
  function roof(ctx, cam, from, to){
    const m = DIM.runoff + STAND.gap; const r0 = STAND.rows - STAND.roofRows, r1 = STAND.rows + 1.5;
    const zTop = 0.5 + STAND.rows*STAND.rise + 2.6;
    const yFront = -(m + r0*STAND.tread), yBack = -(m + r1*STAND.tread);
    for (let x=from + 6; x<to; x+=12){ const a = PR.project(x, yFront, 0.5 + r0*STAND.rise, cam), b = PR.project(x, yFront, zTop, cam); ctx.fillStyle = '#9AA0A6'; ctx.fillRect(Math.round(a.sx) - 1, Math.round(b.sy), 2, Math.round(a.sy - b.sy)); }   // pillars
    PITCH.poly(ctx, cam, [[from, yFront, zTop], [to, yFront, zTop], [to, yBack, zTop], [from, yBack, zTop]], '#4B5057');       // the slab
    PITCH.poly(ctx, cam, [[from, yFront, zTop], [to, yFront, zTop], [to, yFront, zTop - 0.9], [from, yFront, zTop - 0.9]], '#6E7580');   // the fascia
    PITCH.poly(ctx, cam, [[from, yFront, zTop - 0.9], [to, yFront, zTop - 0.9], [to, yFront, zTop - 1.1], [from, yFront, zTop - 1.1]], '#C8351E');   // a painted edge
  }

  function boards(ctx, cam){
    // advertising boards along the near touchline, plain colour blocks (no brands)
    const y = DIM.W + DIM.runoff, h = 0.9, seg = 7.5;
    for (let x=-DIM.runoff; x<DIM.L + DIM.runoff; x+=seg){
      const x1 = Math.min(x+seg, DIM.L + DIM.runoff);
      PITCH.poly(ctx, cam, [[x, y, h],[x1, y, h],[x1, y, 0],[x, y, 0]], BOARD[Math.floor((x + 100)/seg)%BOARD.length]);
      PITCH.poly(ctx, cam, [[x, y, h],[x1, y, h],[x1, y+0.3, h],[x, y+0.3, h]], '#E8ECEF');
    }
  }

  function pylon(ctx, cam, X, Y){
    const base = PR.project(X, Y, 0, cam), top = PR.project(X, Y, 28, cam);
    ctx.fillStyle = '#C9CED4'; const w = Math.max(1, Math.round(cam.P*0.12));
    ctx.fillRect(Math.round(base.sx - w/2), Math.round(top.sy), w, Math.round(base.sy - top.sy));
    const lw = Math.max(3, Math.round(cam.P*1.1)), lh = Math.max(2, Math.round(cam.P*0.55));
    ctx.fillStyle = '#E9EDF0'; ctx.fillRect(Math.round(base.sx - lw/2), Math.round(top.sy - lh), lw, lh);
    ctx.fillStyle = '#FFF6C8'; ctx.fillRect(Math.round(base.sx - lw/2)+1, Math.round(top.sy - lh)+1, lw-2, Math.max(1, lh-2));
  }

  // The whole ground except the goals, for camera cam; clip is an optional canvas-pixel rectangle
  // (the renderer paints tiles). opts.colours are the two kits' primaries for the crowd.
  // Returns true when any spectators landed inside the clip (so a crowd-bounce variant is worth having).
  // opts.only (an array of 'pylons','far','roof','dugout','left','right','pitch','near','boards') draws just those layers; the
  // reference tool uses it to get a piece's exact silhouette. The rnd stream is kept identical either way.
  function drawGround(ctx, cam, seed, jump, clip, opts){
    const rnd = MD.seededRandom((seed||1) ^ 0x150); rnd.seed = (seed||1);
    const L = DIM.L, W = DIM.W, m = DIM.runoff; const colours = (opts && opts.colours) || [];
    const only = opts && opts.only; const on = k => !only || only.indexOf(k) >= 0;
    let crowd = false;
    // painted pieces, when the style ships them, go over the generated art (holes in a texture show the generated art);
    // a reference render (only) wants the generated geometry alone
    const sm = DIM.runoff + STAND.gap;
    if (on('pylons')){ pylon(ctx, cam, -m - 6, -m - 10); pylon(ctx, cam, L + m + 6, -m - 10); }
    if (on('far')){ crowd = terrace(ctx, cam, rnd, 'Y', -m - 2, L + m + 2, STAND.rows, jump, clip, colours) || crowd; }
    if (on('roof')) roof(ctx, cam, -m - 2, L + m + 2);
    if (on('far') && !only) paintedStand(ctx, cam, -m - 2, L + m + 2, clip);
    if (on('dugout')) for (const X0 of DUGOUT.from) drawDugout(ctx, cam, X0, clip);
    if (on('left')){ crowd = terrace(ctx, cam, rnd, 'X-', -m - 1, W + m - 2, STAND.endRows, jump, clip, colours.slice(1)) || crowd; if (!only) paintedRun(ctx, cam, 'left', -m - 1, W + m - 2, along => [-sm, along, 0], clip); }
    if (on('pitch')) PITCH.draw(ctx, cam);
    if (on('right')){ crowd = terrace(ctx, cam, rnd, 'X+', -m - 1, W + m - 2, STAND.endRows, jump, clip, colours.slice(0, 1)) || crowd; if (!only) paintedRun(ctx, cam, 'right', -m - 1, W + m - 2, along => [L + sm, along, 0], clip); }   // nearer the viewer than the pitch, so after it
    if (on('near')){ crowd = terrace(ctx, cam, rnd, 'Y+', -m + 2, L + m - 2, STAND.nearRows, jump, clip, colours) || crowd; if (!only) paintedRun(ctx, cam, 'near', -m + 2, L + m - 2, along => [along, W + sm, 0], clip); }
    if (on('boards')){ boards(ctx, cam); if (!only) paintedRun(ctx, cam, 'boards', -m, L + m, along => [along, W + m, 0], clip); }   // the hoardings stand in front of the near terrace's first row
    return crowd;
  }

  // ---- goals: posts, crossbar and net as world objects ----
  // end 0 is the X=0 goal, end 1 the X=105 goal. The net lies beyond the goal line, away from the pitch.
  // Two depth-sorted parts: 'back' = far post, back net and far side net (behind anyone in the goal);
  // 'front' = crossbar, roof, near post and near side net (over anyone inside the goal). For the X=105
  // goal the net is nearer the viewer than the goal line, so a keeper standing in front of that goal
  // would be seen through its mesh; iso-actors lifts anyone in that goalmouth zone above the whole
  // goal instead, which is what the eye expects (see actors.goalmouthDepth).
  function goalGeometry(end){
    const gx = end? DIM.L : 0, dir = end? 1 : -1;
    const cy = DIM.W/2, far = cy - DIM.goalW/2, near = cy + DIM.goalW/2, bx = gx + dir*DIM.goalD, H = DIM.goalH, HB = DIM.goalH*0.82;
    return { gx, dir, cy, far, near, bx, H, HB,
      backDepth: PR.depth(Math.min(gx, bx), far) - 0.2,
      frontDepth: PR.depth(Math.max(gx, bx), near) + 0.1 };
  }
  function drawGoal(ctx, cam, end, part){
    const g = goalGeometry(end);
    const r = new PITCH.Raster(ctx);
    const seg = (a, b, w) => { const p = PR.project(a[0], a[1], a[2], cam), q = PR.project(b[0], b[1], b[2], cam); r.line(p.sx, p.sy, q.sx, q.sy, w); };
    const pw = Math.max(1, Math.round(cam.P*0.14));
    const mesh = cam.P >= 14? 0.5 : 0.7;
    const sideZ = x => g.H - (g.H - g.HB)*(x/DIM.goalD);                // the side nets slope down towards the back
    if (part==='back'){
      for (let y=g.far; y<=g.near+1e-6; y+=mesh) seg([g.bx, y, 0], [g.bx, y, g.HB]);          // back net
      for (let z=0; z<=g.HB+1e-6; z+=mesh) seg([g.bx, g.far, z], [g.bx, g.near, z]);
      for (let x=0; x<=DIM.goalD+1e-6; x+=mesh/2){ const X = g.gx + g.dir*x; seg([X, g.far, 0], [X, g.far, sideZ(x)]); }   // far side net
      for (let z=0; z<=g.H+1e-6; z+=mesh) seg([g.gx, g.far, Math.min(z, g.H)], [g.bx, g.far, Math.min(z, g.HB)]);
      r.fill(NET);
      seg([g.bx, g.far, g.HB], [g.bx, g.near, g.HB], 1); r.fill('rgba(240,246,240,0.8)');     // the back rail
      seg([g.gx, g.far, 0], [g.gx, g.far, g.H], pw); r.fill(POST);                             // far post
    } else {
      for (let y=g.far + mesh; y<g.near-1e-6; y+=mesh*2) seg([g.gx, y, g.H], [g.bx, y, g.HB]);   // sparse roof strands
      for (let x=0; x<=DIM.goalD+1e-6; x+=mesh/2){ const X = g.gx + g.dir*x; seg([X, g.near, 0], [X, g.near, sideZ(x)]); }   // near side net
      for (let z=0; z<=g.H+1e-6; z+=mesh) seg([g.gx, g.near, Math.min(z, g.H)], [g.bx, g.near, Math.min(z, g.HB)]);
      r.fill(NET);
      seg([g.gx, g.far, g.H], [g.gx, g.near, g.H], pw); seg([g.gx, g.near, 0], [g.gx, g.near, g.H], pw);   // crossbar and near post
      r.fill(POST);
      const p = PR.project(g.gx, g.near, 0, cam), q = PR.project(g.gx, g.near, g.H, cam);        // a one-pixel edge on the near post for depth
      ctx.fillStyle = POST_EDGE; ctx.fillRect(Math.round(p.sx) + Math.ceil(pw/2), Math.round(q.sy), 1, Math.round(p.sy - q.sy));
    }
  }

  MD.iso.stadium = { drawGround, drawGoal, goalGeometry, drawDugout, dugoutBox, drawCrowdReaction, CROWD_SIDES, DUGOUT, STAND, COATS, BRIGHT };
})(typeof window!=='undefined'? window : globalThis);
