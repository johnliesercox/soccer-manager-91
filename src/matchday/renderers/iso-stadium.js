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
      const bands = 16, sh = tex.image.height/bands, dh = h/bands; const rows = WAVE_ROWS[name] || WAVE_ROWS.other;
      for (let b=0;b<bands;b++){
        const u = (b + 0.5)/bands; const win = trapezoid(u, rows);      // the rows of fans, not the roof or the front wall
        // a wave running along the stand (each section a little behind the last), the rows out of step with each other
        const dy = win? -Math.round(bounce.amp*win*Math.max(0, Math.sin(bounce.phase - k*0.8 + b*0.35))) : 0;
        if (dy) ctx.drawImage(tex.image, 0, b*sh, tex.image.width, sh, x, Math.round(y + b*dh) + dy, w, Math.ceil(dh) + 1);
      }
      if (bounce.flashes) flashbulbs(ctx, x, y, w, h, k, bounce, FLASH_ROWS[name] || FLASH_ROWS.other, tex, cam.P);
    }
    return true;
  }
  // which rows of each painted piece hold fans (a share of its height from the top): the main stand's upper rows sit under
  // its roof, so only its lower half rises; the ends and the near terrace are fans from edge to edge
  const WAVE_ROWS = { far: [0.44, 0.52, 0.9, 0.96], other: [0.0, 0.08, 0.9, 0.97] };
  const FLASH_ROWS = { far: [0.5, 0.88], other: [0.08, 0.86] };
  const trapezoid = (u, r) => u <= r[0] || u >= r[3]? 0 : u < r[1]? (u - r[0])/(r[1] - r[0]) : u > r[2]? (r[3] - u)/(r[3] - r[2]) : 1;
  // camera flashes in the stand: a few white points a frame, each a twelfth of a second, scattered over the fans with a
  // hash of the section and the moment (so they are the same on every machine and never need storing)
  const hash = (a, b, c) => { let v = (a*73856093) ^ (b*19349663) ^ (c*83492791); v = (v ^ (v >>> 13)) * 1274126177; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  function flashbulbs(ctx, x, y, w, h, k, bounce, rows, tex, P){
    const AS = MD.isoAssets; const mask = AS.pieceMask(tex); if (!mask) return;
    const slot = Math.floor(bounce.age*12); const n = Math.round(bounce.flashes*(0.6 + 2.6*hash(k, slot, 1)));
    const size = Math.max(1, Math.round(P/12));                 // a couple of pixels at the close scale, one at the wide
    for (let i=0;i<n;i++){
      const u = hash(k, slot, 10 + i), v = rows[0] + (rows[1] - rows[0])*hash(k, slot, 40 + i);
      if (!AS.maskAt(mask, u, v)) continue;                      // a transparent corner of the piece: no stand there
      const fx = Math.round(x + u*w), fy = Math.round(y + v*h); const bright = 0.6 + 0.4*hash(k, slot, 70 + i);
      ctx.fillStyle = 'rgba(255,255,255,'+(bright*0.55).toFixed(2)+')'; ctx.fillRect(fx - size, fy, size*3, size); ctx.fillRect(fx, fy - size, size, size*3);
      ctx.fillStyle = 'rgba(255,255,255,'+bright.toFixed(2)+')'; ctx.fillRect(fx, fy, size, size);
    }
  }
  // the crowd rising for a goal: the scoring side's sections (the home support in the main stand and the X=0 end, the
  // away support in the X=105 end), a wave that builds in a third of a second and dies away over eight, with camera
  // flashes through its first five. Drawn over the cached ground, before the players.
  const CROWD_SIDES = { home: ['far', 'left', 'near'], away: ['right'] };
  const WAVE = { amp: 0.3, rise: 0.3, span: 8, flashes: 6 };     // amplitude as a share of a metre at the stand, in seconds
  function drawCrowdReaction(ctx, cam, side, age, intensity, clip){
    const amp = cam.P*WAVE.amp*(intensity||1)*Math.min(1, age/WAVE.rise)*Math.max(0, 1 - age/WAVE.span);
    if (amp < 0.6) return false;
    const flashes = age < WAVE.flashes? (intensity||1)*Math.max(0, 1 - age/WAVE.flashes) : 0;
    const L = DIM.L, W = DIM.W, m = DIM.runoff, sm = DIM.runoff + STAND.gap; const bounce = { amp, phase: age*7, age, flashes };
    let drew = false;
    for (const name of CROWD_SIDES[side]||[]){
      if (name==='far') drew = paintedRun(ctx, cam, 'far', -m - 2, L + m + 2, along => [along, -(DIM.runoff + STAND.gap), 0], clip, bounce) || drew;
      else if (name==='left') drew = paintedRun(ctx, cam, 'left', -m - 1, W + m - 2, along => [-sm, along, 0], clip, bounce) || drew;
      else if (name==='right') drew = paintedRun(ctx, cam, 'right', -m - 1, W + m - 2, along => [L + sm, along, 0], clip, bounce) || drew;
      else if (name==='near' && paintedRun(ctx, cam, 'near', -m + 2, L + m - 2, along => [along, W + sm, 0], clip, bounce)){ drew = true; paintedRun(ctx, cam, 'boards', -m, L + m, along => [along, W + m, 0], clip); }   // the hoardings stand in front of it
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
      // A tile takes only the strips that can reach it. The eight strips of this stand (four pictures, sitting and
      // risen) are looked up once and not once a place; a row is passed over when the box round its first and last
      // places, with the largest strip's size to spare (from the sheet's table, so no strip has to be made to know it),
      // misses the tile; and within a row a place is passed over the
      // same way before its strip is chosen. The places, the choice of strip and the test of the strip itself are as
      // they were, so what is drawn is the same.
      let strips = null; const stripAt = (variant, standing) => { if (!strips) strips = []; const i = variant*2 + (standing? 1 : 0); if (strips[i]===undefined) strips[i] = AS.crowdStrip(cam.P, fam, variant, standing, rnd.seed, colours) || probe; return strips[i]; };
      let reach = null; const reachOf = () => { if (!reach && AS.crowdReach) reach = AS.crowdReach(cam.P, fam); if (!reach){ let l = 0, t = 0, rr = 0, b = 0; for (let v=0; v<4; v++) for (const up of (jump? [false, true] : [false])){ const q = stripAt(v, up); l = Math.max(l, q.ox); t = Math.max(t, q.oy); rr = Math.max(rr, q.width - q.ox); b = Math.max(b, q.height - q.oy); } reach = { l: l + 1, t: t + 1, r: rr + 1, b: b + 1 }; } return reach; };
      const near = (x0, y0, x1, y1) => { const R = reachOf(); return inClip(clip, Math.min(x0, x1) - R.l, Math.min(y0, y1) - R.t, Math.abs(x1 - x0) + R.l + R.r, Math.abs(y1 - y0) + R.t + R.b); };
      const lean = !!clip && PITCH.culling();
      for (const r of order){
        const pa = lean? PR.project(...place(from, r, 0), cam) : null, pb = lean? PR.project(...place(to, r, 0), cam) : null;
        if (!lean || near(pa.sx, pa.sy, pb.sx, pb.sy)) for (let k=0, along=from; along < to; k++, along += probe.metres){
          const p = PR.project(...place(along, r, 0), cam); if (lean && !near(p.sx, p.sy, p.sx, p.sy)) continue;
          const variant = (r*3 + k) % 4; const standing = jump && ((r + k) % 3 !== 0);
          const strip = stripAt(variant, standing); const x = Math.round(p.sx) - strip.ox, y = Math.round(p.sy) - strip.oy;
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

  // ---- the four corners: a filled quarter terrace tucked into each, between the end of one stand and the start of the
  // next (rows parallel to the diagonal, each a little longer and higher than the one in front, rising at the pace of the
  // lower of its two neighbours so the taller stand's end face shows above it), with a crush barrier every fourth row, a
  // low wall at its front and a floodlight pylon behind it. The far corners' pylons are part of the ground (the stands
  // hide their feet); the near corners' pylons stand in front of the near terrace and are drawn per frame in depth order.
  const CORNER_T = 0.8, CORNER_ROWS = 12, CORNER_FIRST = 1;
  const TOWER = { side: 2.6, lit: '#B9BDC2', shade: '#8E9399', top: '#CDD1D5', door: '#3C4148' };
  const CORNERS = (() => {
    const m = DIM.runoff, L = DIM.L, W = DIM.W, sm = m + STAND.gap;
    return [
      { id: 'A', x0: -m - 2, y0: -m - 1, sx: -1, sy: -1, rise: STAND.rise*0.8, fam: 'far', near: false, tower: 9.5 },      // far stand and the X=0 end
      { id: 'B', x0: L + m + 2, y0: -m - 1, sx: 1, sy: -1, rise: STAND.rightRise, fam: 'right', near: false, tower: 4.8 },   // far stand and the X=105 end
      { id: 'C', x0: L + sm, y0: W + sm, sx: 1, sy: 1, rise: Math.min(STAND.rightRise, STAND.nearRise), fam: 'near', near: true, tower: 2.6 },   // the X=105 end and the near terrace
      { id: 'D', x0: -sm, y0: W + sm, sx: -1, sy: 1, rise: Math.min(STAND.nearRise, STAND.rise), fam: 'left', near: true, tower: 2.6 },         // the near terrace and the X=0 end
    ];
  })();
  const cornerPylonAt = c => ({ X: c.x0 + c.sx*(CORNER_ROWS*CORNER_T + 2.5), Y: c.y0 + c.sy*(CORNER_ROWS*CORNER_T + 2.5) });
  function cornerTerrace(ctx, cam, rnd, c, jump, clip, colours){
    const z = r => 0.5 + r*c.rise;
    const A = (r, zUp) => [c.x0 + c.sx*r*CORNER_T, c.y0, z(r) + (zUp||0)];        // the row's end along the first stand
    const B = (r, zUp) => [c.x0, c.y0 + c.sy*r*CORNER_T, z(r) + (zUp||0)];        // and along the second
    // far corners recede from the viewer (back rows first); near corners come towards him (front rows first)
    const order = []; if (c.near){ for (let r=CORNER_FIRST; r<CORNER_ROWS; r++) order.push(r); } else { for (let r=CORNER_ROWS-1; r>=CORNER_FIRST; r--) order.push(r); }
    const wall = () => { const a = A(CORNER_FIRST), b = B(CORNER_FIRST); PITCH.poly(ctx, cam, [a, b, [b[0], b[1], 0], [a[0], a[1], 0]], CONCRETE_DARK); };
    if (c.near) wall();
    for (const r of order) PITCH.poly(ctx, cam, [A(r), B(r), B(r+1), A(r+1)], r%2? CONCRETE : CONCRETE_DARK);
    if (!c.near) wall();
    // the people: a coat and a head each along the row, the kits' colours sprinkled in (the same figures as the generated terraces)
    const step = 0.3; const bw = Math.max(1, Math.round(cam.P*0.24)), bh = Math.max(2, Math.round(cam.P*0.3)), hw = Math.max(1, Math.round(cam.P*0.14)), hh = Math.max(1, Math.round(cam.P*0.13));
    const pal = COATS.concat(colours||[]); let drew = false;
    for (const r of order){
      const a = A(r, 0.6), b = B(r, 0.6); const len = Math.hypot(b[0]-a[0], b[1]-a[1]); const n = Math.floor(len/step);
      if (clip){ const pa = PR.project(a[0], a[1], a[2], cam), pb = PR.project(b[0], b[1], b[2], cam); const pad = cam.P*1.2; if (!inClip(clip, Math.min(pa.sx, pb.sx) - pad, Math.min(pa.sy, pb.sy) - bh - hh - pad, Math.abs(pb.sx - pa.sx) + 2*pad, Math.abs(pb.sy - pa.sy) + bh + hh + 2*pad)){ for (let i=0;i<n;i++){ rnd(); rnd(); rnd(); rnd(); rnd(); } continue; } }
      for (let i=0;i<n;i++){
        const u = rnd(), pick = rnd(); const col = u < 0.08? BRIGHT[Math.floor(pick*BRIGHT.length)] : pal[Math.floor(pick*pal.length)]; const sk = SKIN[Math.floor(rnd()*SKIN.length)];
        const gap = rnd() < 0.04; const up = rnd() < 0.6 && jump? 0.35 : 0;
        if (gap) continue;
        const f = (i + 0.5)/n; const X = a[0] + (b[0]-a[0])*f, Y = a[1] + (b[1]-a[1])*f;
        const q = PR.project(X, Y, a[2] + up, cam); const x = Math.round(q.sx - bw/2), y = Math.round(q.sy - bh);
        if (!inClip(clip, x, y - hh, bw, bh + hh)) continue;
        ctx.fillStyle = col; ctx.fillRect(x, y, bw, bh); ctx.fillStyle = sk; ctx.fillRect(Math.round(q.sx - hw/2), y - hh, hw, hh); drew = true;
      }
      if (r%4===1){ const pa = PR.project(...A(r, 1.0), cam), pb = PR.project(...B(r, 1.0), cam); const rr = new PITCH.Raster(ctx); rr.line(pa.sx, pa.sy, pb.sx, pb.sy, 1); rr.fill(RAIL); }
    }
    return drew;
  }

  // a corner tower at the junction of two stands in a far corner: a plain concrete stair block the height of the lower
  // neighbour or a little more, which closes the raw ends of the two terraces where they meet
  function cornerTower(ctx, cam, c){
    if (!c.tower) return;
    const a = c.x0, b = c.x0 + c.sx*TOWER.side, u = c.y0, v = c.y0 + c.sy*TOWER.side, h = c.tower;   // footprint between the junction and the terrace behind
    const xe = Math.max(a, b), xw = Math.min(a, b), ys = Math.max(u, v), yn = Math.min(u, v);         // east/west, south/north edges
    PITCH.poly(ctx, cam, [[xw, ys, 0], [xe, ys, 0], [xe, ys, h], [xw, ys, h]], TOWER.lit);            // the face towards the viewer (south)
    PITCH.poly(ctx, cam, [[xe, yn, 0], [xe, ys, 0], [xe, ys, h], [xe, yn, h]], TOWER.shade);          // the east face
    PITCH.poly(ctx, cam, [[xw, yn, h], [xe, yn, h], [xe, ys, h], [xw, ys, h]], TOWER.top);            // the flat roof
    PITCH.poly(ctx, cam, [[xw + 0.9, ys, 0], [xw + 1.7, ys, 0], [xw + 1.7, ys, 2.1], [xw + 0.9, ys, 2.1]], TOWER.door);   // a door
  }

  // the crowd strips the four stands will ask for at this scale, made beforehand (the renderer does it before the clock
  // starts): the same stands, seed and colours as the terrace calls in groundSteps below
  function warmCrowd(P, seed, colours){
    const AS = MD.isoAssets; if (!AS || !AS.crowdStrip) return 0; const c = colours || []; let n = 0;
    for (const [fam, cols] of [['far', c], ['left', c.slice(1)], ['right', c.slice(0, 1)], ['near', c]]) for (let v=0; v<4; v++) for (const up of [false, true]) if (AS.crowdStrip(P, fam, v, up, seed||1, cols)) n++;
    return n;
  }

  // The whole ground except the goals, for camera cam; clip is an optional canvas-pixel rectangle
  // (the renderer paints tiles). opts.colours are the two kits' primaries for the crowd.
  // Returns true when any spectators landed inside the clip (so a crowd-bounce variant is worth having).
  // opts.only (an array of 'pylons','far','roof','dugout','left','right','pitch','near','boards') draws just those layers; the
  // reference tool uses it to get a piece's exact silhouette. The rnd stream is kept identical either way.
  function drawGround(ctx, cam, seed, jump, clip, opts){
    let crowd = false; for (const step of groundSteps(ctx, cam, seed, jump, clip, opts)) crowd = step() || crowd; return crowd;
  }
  // The same painting as a list of steps to be run in order, one layer of the ground each, every one returning true when
  // it put spectators inside the clip. Run one after another without a pause they are drawGround; the renderer runs them
  // a few a frame when it paints a tile ahead of need, so that no frame carries a whole tile. Each step names the clip
  // to the primitives for its own duration only (PITCH.within), so frames drawn between two steps are not touched by it.
  // The clip, when given, must be the whole of the canvas being painted.
  function groundSteps(ctx, cam, seed, jump, clip, opts){
    const rnd = MD.seededRandom((seed||1) ^ 0x150); rnd.seed = (seed||1);
    const L = DIM.L, W = DIM.W, m = DIM.runoff; const colours = (opts && opts.colours) || [];
    const only = opts && opts.only; const on = k => !only || only.indexOf(k) >= 0;
    // painted pieces, when the style ships them, go over the generated art (holes in a texture show the generated art);
    // a reference render (only) wants the generated geometry alone
    const sm = DIM.runoff + STAND.gap; const steps = []; const step = fn => steps.push(() => PITCH.within(clip, fn) || false);
    if (on('pylons')) step(() => { for (const c of CORNERS) if (!c.near){ const q = cornerPylonAt(c); pylon(ctx, cam, q.X, q.Y); if (!only) placedPiece(ctx, cam, 'pylon'+c.id, clip); } });
    if (on('far')) step(() => terrace(ctx, cam, rnd, 'Y', -m - 2, L + m + 2, STAND.rows, jump, clip, colours));
    if (on('roof') || (on('far') && !only) || on('dugout')) step(() => { if (on('roof')) roof(ctx, cam, -m - 2, L + m + 2); if (on('far') && !only) paintedStand(ctx, cam, -m - 2, L + m + 2, clip); if (on('dugout')) for (const X0 of DUGOUT.from) drawDugout(ctx, cam, X0, clip); });
    if (on('left')) step(() => { const crowd = terrace(ctx, cam, rnd, 'X-', -m - 1, W + m - 2, STAND.endRows, jump, clip, colours.slice(1)); if (!only) paintedRun(ctx, cam, 'left', -m - 1, W + m - 2, along => [-sm, along, 0], clip); return crowd; });
    if (on('corners')) step(() => { let crowd = false; for (const c of CORNERS) if (!c.near){ crowd = cornerTerrace(ctx, cam, rnd, c, jump, clip, colours) || crowd; cornerTower(ctx, cam, c); if (!only) placedPiece(ctx, cam, 'corner'+c.id, clip); } return crowd; });   // the far corners: a terrace in the notch and a stair tower at the junction
    if (on('pitch')){ step(() => PITCH.drawGrass(ctx, cam)); step(() => PITCH.drawMarkings(ctx, cam)); }
    if (on('right')) step(() => { const crowd = terrace(ctx, cam, rnd, 'X+', -m - 1, W + m - 2, STAND.endRows, jump, clip, colours.slice(0, 1)); if (!only) paintedRun(ctx, cam, 'right', -m - 1, W + m - 2, along => [L + sm, along, 0], clip); return crowd; });   // nearer the viewer than the pitch, so after it
    if (on('near')) step(() => { const crowd = terrace(ctx, cam, rnd, 'Y+', -m + 2, L + m - 2, STAND.nearRows, jump, clip, colours); if (!only) paintedRun(ctx, cam, 'near', -m + 2, L + m - 2, along => [along, W + sm, 0], clip); return crowd; });
    if (on('boards')) step(() => { boards(ctx, cam); if (!only) paintedRun(ctx, cam, 'boards', -m, L + m, along => [along, W + m, 0], clip); });   // the hoardings stand in front of the near terrace's first row
    if (on('corners')) step(() => { let crowd = false; for (const c of CORNERS) if (c.near){ crowd = cornerTerrace(ctx, cam, rnd, c, jump, clip, colours) || crowd; cornerTower(ctx, cam, c); if (!only) placedPiece(ctx, cam, 'corner'+c.id, clip); } return crowd; });   // the near corners: a low terrace and a turnstile block, in front of the stands' painted ends
    return steps;
  }
  // (no floodlights in the near corners: in this view they would stand between the viewer and the corner flags)
  const nearPylons = () => [];
  const drawPylon = (ctx, cam, X, Y) => pylon(ctx, cam, X, Y);

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
  // a modelled piece (tools/visual-rnd/blender_pieces.py) placed by the world anchor its meta carries: the goal parts, the
  // corner terraces and towers, the floodlight pylons. True when drawn, so the caller can skip or keep its generated art.
  function placedPiece(ctx, cam, name, clip){
    const AS = MD.isoAssets; const tex = AS && AS.pieceTexture && AS.pieceTexture(cam.P, name);
    if (!tex || !tex.meta.anchorWorld) return false;
    const T = tex.meta; const f = cam.P/T.P; const a = PR.project(T.anchorWorld[0], T.anchorWorld[1], T.anchorWorld[2], cam);
    const x = Math.round(a.sx - T.anchor.x*f), y = Math.round(a.sy - T.anchor.y*f), w = Math.round(tex.image.width*f), h = Math.round(tex.image.height*f);
    if (clip && !inClip(clip, x, y, w, h)) return true;
    ctx.drawImage(tex.image, x, y, w, h); return true;
  }

  // the back net's state at this moment: '' when still, '-bulge<lane>' for the four tenths of a second after a goal went in
  // and '-settle<lane>' for the half second after that (lane 0 by the far post, 1 the middle, 2 by the near post, from
  // where the ball lies). The goal flash is the clock (the ball reaches the net on the goal's own second) and the ball
  // must be lying dead beyond that goal line. Only a goal moves the net: a save, a block, the woodwork and a ball over
  // the bar leave it still.
  function netState(scene, end){
    const f = scene && scene.flash, b = scene && scene.ball; if (!f || f.type!=='goal' || !b || b.state!=='dead') return '';
    if (!(end? b.x > 0.995 : b.x < 0.005)) return '';
    const age = f.age; if (!(age >= 0 && age < 0.9)) return '';
    const dy = b.y*DIM.W - DIM.W/2; const lane = dy < -1.18? 0 : dy > 1.18? 2 : 1;
    return (age < 0.4? '-bulge' : '-settle') + lane;
  }

  function drawGoal(ctx, cam, end, part, state){
    const g = goalGeometry(end);
    if (part==='back'){ if ((state && placedPiece(ctx, cam, 'goal'+end+'b'+state)) || placedPiece(ctx, cam, 'goal'+end+'b')) return; }
    else if (placedPiece(ctx, cam, 'goal'+end+'f')) return;
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

  MD.iso.stadium = { drawGround, groundSteps, warmCrowd, drawGoal, netState, goalGeometry, drawDugout, dugoutBox, placedPiece, CORNER_T, CORNER_ROWS, CORNER_FIRST, TOWER, drawCrowdReaction, nearPylons, drawPylon, CORNERS, cornerPylonAt, CROWD_SIDES, WAVE, WAVE_ROWS, DUGOUT, STAND, COATS, BRIGHT };
})(typeof window!=='undefined'? window : globalThis);
