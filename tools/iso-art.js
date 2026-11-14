#!/usr/bin/env node
'use strict';
// ============================================================================
//  Soccer Manager '91: isometric art pipeline (Phase 3, Milestone 2A)
//
//  Renders the production sprite sheets and textures for the isometric match
//  view. Footballers are a small 3D model (a chain of spheres per limb, a head
//  with a hair cap, eyes, boots, gloves) posed by the same pose functions the
//  game uses (src/matchday/iso-sprites.js), lit by a key light and an ambient
//  term, ray-cast along the 2:1 dimetric view direction so every pixel has a
//  true surface and normal, then reduced to a small number of tones per
//  material and outlined. Colours in the sheets are TEMPLATE colours (one per
//  material and tone); the game recolours them per kit, skin and hair at run
//  time, so one sheet serves every club.
//
//  Two visual styles are produced from the same model and poses:
//    A  "Amiga": three tones a material, black outline, flat and bright.
//    B  "16-bit": five tones, rim shading, a dark (not black) outline.
//
//  Also rendered: crowd strips (little spectators in varied coats, a still
//  and a standing variant) and a tileable grass texture for style B.
//
//  Usage: node tools/iso-art.js [--style A|B|both] [--spr 16,12] [--out assets/matchday/isometric]
//  Output: <out>/<style>/players-<spr>.png + players-<spr>.json, crowd-<spr>.png, grass-<spr>.png
// ============================================================================
const fs = require('fs'); const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
globalThis.window = undefined; globalThis.Matchday = {};
for (const f of ['schema.js','sprites.js','renderers/iso-projection.js','iso-sprites.js']) eval(fs.readFileSync(path.join(ROOT, 'src/matchday', f), 'utf8'));
const MD = globalThis.Matchday; const PR = MD.iso.projection; const SP = MD.isoSprites;

const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf('--'+k); return i>=0? args[i+1] : d; };
const STYLES = (opt('style', 'both')==='both')? ['A','B'] : [opt('style')];
const SPRS = opt('spr', '16,12').split(',').map(Number);
const OUT = path.resolve(ROOT, opt('out', 'assets/matchday/isometric'));
const HAIR_STYLES = opt('hair', '0').split(',').map(Number);     // hair styles baked into the sheet (colour is recoloured at run time)

// ---- materials and template colours ----
// R encodes the material, G the tone, B is a marker; the game decodes them (iso-assets.js).
const MATS = ['SKIN','HAIR','SHIRT','TRIM','SHORTS','SOCKS','BOOTS','GLOVE','EYE','CARD','LINE','COAT','HAT','SCARF'];
const MAT = {}; MATS.forEach((m, i) => { MAT[m] = i; });
const template = (m, k) => [m*16 + 8, k*40 + 20, 128];
const STYLE = {
  A: { tones: 3, ambient: 0.5, rim: 0, outline: 'black', headR: 0.235, lineInside: false },
  B: { tones: 5, ambient: 0.32, rim: 0.16, outline: 'dark', headR: 0.22, lineInside: true },
};

// ---- the model: primitives in the figure's own metres (forward, side, up) ----
function chain(a, b, r0, r1, mat, out, extra){
  const len = Math.hypot(b[0]-a[0], b[1]-a[1], b[2]-a[2]); const n = Math.max(2, Math.ceil(len/(0.35*Math.min(r0, r1))) + 1);
  for (let i=0;i<n;i++){ const u = i/(n-1); out.push(Object.assign({ c:[a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u, a[2]+(b[2]-a[2])*u], r: r0+(r1-r0)*u, mat }, extra||{})); }
}
function figureModel(name, frame, o){
  const j = SP.pose(name, frame); const P = [];
  const gk = !!o.gk, style = o.style||'B', hair = o.hairStyle||0;
  const mid = (a, b, u) => [a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u, a[2]+(b[2]-a[2])*u];
  for (const s of ['L','R']){
    const hip = j['hip'+s], knee = j['knee'+s], foot = j['foot'+s];
    chain(hip, mid(hip, knee, 0.5), 0.115, 0.1, 'SHORTS', P);                    // shorts over the upper thigh
    chain(mid(hip, knee, 0.5), knee, 0.095, 0.08, 'SKIN', P);                    // bare thigh
    chain(mid(knee, foot, 0.08), mid(knee, foot, 0.18), 0.082, 0.08, 'TRIM', P);  // sock top
    chain(mid(knee, foot, 0.18), foot, 0.078, 0.06, 'SOCKS', P);
    const f = foot; const toe = [f[0] + 0.13, f[1], f[2] - 0.01];
    P.push({ c:[f[0], f[1], f[2]], r: 0.08, mat:'BOOTS', sz: 0.7 }); P.push({ c: toe, r: 0.075, mat:'BOOTS', sz: 0.65 });
  }
  chain(j.pelvis, [j.pelvis[0], j.pelvis[1], j.pelvis[2] - 0.12], 0.2, 0.19, 'SHORTS', P);
  chain(mid(j.pelvis, j.chest, 0.1), j.chest, 0.185, 0.235, 'SHIRT', P, { torso: true });
  chain(j.chest, j.neck, 0.235, 0.16, 'SHIRT', P, { torso: true });
  chain(j.neck, mid(j.neck, j.head, 0.5), 0.07, 0.07, 'SKIN', P);
  for (let i=0;i<8;i++){ const a = i/8*Math.PI*2; P.push({ c:[j.neck[0] + 0.11*Math.cos(a), j.neck[1] + 0.11*Math.sin(a), j.neck[2] - 0.01], r: 0.04, mat:'TRIM' }); }   // collar
  for (const s of ['L','R']){
    const sh = j['sh'+s], el = j['el'+s], hd = j['hand'+s];
    P.push({ c: sh, r: 0.1, mat:'SHIRT', torso: true });
    chain(sh, mid(sh, el, 0.55), 0.08, 0.07, 'SHIRT', P, { torso: true });        // short sleeve
    chain(mid(sh, el, 0.55), el, 0.065, 0.06, 'SKIN', P);
    chain(el, hd, 0.06, 0.05, 'SKIN', P);
    P.push({ c: hd, r: gk? 0.08 : 0.062, mat: gk? 'GLOVE' : 'SKIN' });
  }
  const h = j.head; const hr = STYLE[style].headR;
  P.push({ c: h, r: hr, mat:'SKIN' });
  // hair: a slightly bigger sphere kept only on the top and back of the head
  const hairR = hair===1? hr + 0.012 : hair===2? hr + 0.035 : hr + 0.022;
  // kept where the hit is behind the face (f < front) or above the hairline (z > top), and never below `low`
  P.push({ c:[h[0] - 0.02, h[1], h[2] + 0.02], r: hairR, mat:'HAIR', hair: { centre: h, front: hair===1? -0.06 : hair===2? -0.02 : -0.04, top: hair===1? 0.14 : hair===2? 0.09 : 0.11, low: hair===2? -0.18 : hair===1? -0.02 : -0.08 } });
  P.push({ c:[h[0] + hr*0.8, h[1] - 0.085, h[2] + 0.03], r: 0.03, mat:'EYE' }); P.push({ c:[h[0] + hr*0.8, h[1] + 0.085, h[2] + 0.03], r: 0.03, mat:'EYE' });
  if (name==='card'){ const hd = j.handR; P.push({ c:[hd[0], hd[1], hd[2] + 0.14], r: 0.07, mat:'CARD', sz: 1.6, sy: 0.25 }); }
  return P;
}
// a spectator for the crowd strips: coat, head, hat or hair, maybe a scarf, maybe arms up
function spectatorModel(rnd, up){
  const P = []; const h = 1.45 + rnd()*0.3; const coat = 'COAT';
  chain([0, 0, 0.55], [0, 0, h - 0.32], 0.2, 0.25, coat, P);
  P.push({ c:[0, -0.27, h - 0.4], r: 0.09, mat: coat }); P.push({ c:[0, 0.27, h - 0.4], r: 0.09, mat: coat });
  if (up){ chain([0, -0.27, h - 0.4], [0.05, -0.34, h + 0.25], 0.07, 0.06, coat, P); chain([0, 0.27, h - 0.4], [0.05, 0.34, h + 0.25], 0.07, 0.06, coat, P); P.push({ c:[0.05, -0.34, h + 0.28], r: 0.06, mat:'SKIN' }); P.push({ c:[0.05, 0.34, h + 0.28], r: 0.06, mat:'SKIN' }); }
  const hc = [0.02, 0, h - 0.12]; P.push({ c: hc, r: 0.15, mat:'SKIN' });
  const kind = rnd();
  if (kind < 0.3) P.push({ c:[hc[0] - 0.01, hc[1], hc[2] + 0.05], r: 0.16, mat:'HAT', sz: 0.75 });
  else P.push({ c:[hc[0] - 0.02, hc[1], hc[2] + 0.02], r: 0.165, mat:'HAIR', hair: { centre: hc, front: -0.03, top: 0.07, low: -0.06 } });
  if (rnd() < 0.3) chain([0.1, -0.2, h - 0.3], [0.1, 0.2, h - 0.3], 0.07, 0.07, 'SCARF', P);
  return P;
}

// ---- the figure turned to a world heading ----
function toWorld(prims, angle){
  const fx = Math.cos(angle), fy = Math.sin(angle), rx = -fy, ry = fx;
  const tr = p => [p[0]*fx + p[1]*rx, p[0]*fy + p[1]*ry, p[2]];
  return prims.map(p => { const q = Object.assign({}, p, { c: tr(p.c) }); if (p.hair){ q.hair = Object.assign({}, p.hair, { centre: tr(p.hair.centre), fwd: [fx, fy, 0] }); } return q; });
}

// ---- ray casting along the view direction (1, 1, 1) ----
const VIEW = [1/Math.sqrt(3), 1/Math.sqrt(3), 1/Math.sqrt(3)];
const LIGHT = (function(){ const v = [-0.106, 0.476, 0.873]; const n = Math.hypot(...v); return v.map(x=>x/n); })();
function hit(prims, ox, oy){
  // ray: X = ox + t, Y = oy + t, Z = t; nearest to the viewer = largest t
  let best = null, bt = -1e9;
  for (const p of prims){
    const sz = p.sz||1, sy = p.sy||1;
    const dx = ox - p.c[0], dy = (oy - p.c[1])/sy, dz = -p.c[2]/sz;             // origin relative to the centre, in the sphere's own scaled space
    const ddx = 1, ddy = 1/sy, ddz = 1/sz;
    const a = ddx*ddx + ddy*ddy + ddz*ddz, b = 2*(dx*ddx + dy*ddy + dz*ddz), c = dx*dx + dy*dy + dz*dz - p.r*p.r;
    const disc = b*b - 4*a*c; if (disc < 0) continue;
    const t = (-b + Math.sqrt(disc))/(2*a); if (t <= bt) continue;
    const hx = ox + t, hy = oy + t, hz = t;
    if (p.hair){ const H = p.hair; const rel = [hx - H.centre[0], hy - H.centre[1], hz - H.centre[2]]; const f = rel[0]*H.fwd[0] + rel[1]*H.fwd[1]; if (!(f < H.front || rel[2] > H.top) || rel[2] < H.low) continue; }
    // normal in world space (scaled sphere)
    let nx = (hx - p.c[0]), ny = (hy - p.c[1])/(sy*sy), nz = (hz - p.c[2])/(sz*sz); const nl = Math.hypot(nx, ny, nz)||1; nx/=nl; ny/=nl; nz/=nl;
    best = { p, t, n:[nx, ny, nz], pos:[hx, hy, hz] }; bt = t;
  }
  return best;
}
function shadeOf(h, st){
  const nl = Math.max(0, h.n[0]*LIGHT[0] + h.n[1]*LIGHT[1] + h.n[2]*LIGHT[2]);
  let s = st.ambient + (1 - st.ambient)*nl;
  const nv = h.n[0]*VIEW[0] + h.n[1]*VIEW[1] + h.n[2]*VIEW[2]; if (nv < 0.3) s -= st.rim;
  return Math.max(0, Math.min(0.999, s));
}

// ---- render one frame into a material/tone grid ----
function renderGrid(prims, W, H, FEET, spr, st, opts){
  const grid = new Array(W*H).fill(null);
  for (let py=0; py<H; py++) for (let px=0; px<W; px++){
    const u = (px + 0.5 - W/2)/spr, v = (py + 0.5 - FEET)/spr;
    const h = hit(prims, v + u/2, v - u/2); if (!h) continue;
    let mat = h.p.mat, m;
    if (h.p.torso && opts.mask && opts.local){
      const l = opts.local(h.pos);                                              // (forward, side, up) in the figure's frame
      const stripes = (Math.floor((l[1] + 2)/0.1) % 2)===0, hoops = (Math.floor((l[2] - 0.9)/0.11) % 2)===0, quarters = (l[1] < 0) !== (l[2] > 1.22);
      m = (stripes? 1 : 0) | (hoops? 2 : 0) | (quarters? 4 : 0);
    }
    const s = shadeOf(h, st); const k = Math.min(st.tones - 1, Math.floor(s*st.tones));
    grid[py*W + px] = { mat, k, m };
  }
  // outline
  const out = grid.slice();
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){ if (grid[y*W+x]) continue; const n = (x>0 && grid[y*W+x-1]) || (x<W-1 && grid[y*W+x+1]) || (y>0 && grid[(y-1)*W+x]) || (y<H-1 && grid[(y+1)*W+x]); if (n) out[y*W+x] = { mat:'LINE', k: st.outline==='black'? 0 : 1 }; }
  return out;
}
function blit(ctx, grid, W, H, x0, y0){
  const img = ctx.createImageData(W, H); const d = img.data;
  for (let i=0;i<W*H;i++){ const g = grid[i]; if (!g) continue; const [r, gg, b] = template(MAT[g.mat], g.k); d[i*4] = r; d[i*4+1] = gg; d[i*4+2] = b; d[i*4+3] = 255; }
  ctx.putImageData(img, x0, y0);
}

// ---- sheets ----
// players: one row per (pose, frame, hair style), eight headings across. Patterns are not baked in: a mask
// sheet with the same layout (hair 0) says, per shirt pixel, whether stripes, hoops or quarters would show
// the trim colour there, and the game applies the kit's pattern at recolour time.
function sheetRows(spr, hairs){
  const wide = SP.WIDE; let rowY = 0, sheetW = 0; const rows = [];
  for (const [pose, n] of Object.entries(SP.POSES)) for (let f=0; f<n; f++) for (const hs of hairs){
    const cellW = Math.round((wide[pose]? 4.6 : 2.9)*spr), cellH = Math.round(3.1*spr), FEET = cellH - Math.max(2, Math.round(spr*0.25));
    rows.push({ pose, f, hs, cellW, cellH, FEET, y: rowY }); rowY += cellH; sheetW = Math.max(sheetW, cellW*PR.DIRS.length);
  }
  return { rows, sheetW, sheetH: rowY };
}
function renderRows(style, spr, rows, sheetW, sheetH, gk, withMask){
  const st = STYLE[style]; const cv = createCanvas(sheetW, sheetH); const ctx = cv.getContext('2d'); const frames = [];
  const mcv = withMask? createCanvas(sheetW, sheetH) : null; const mctx = mcv? mcv.getContext('2d') : null;
  for (const row of rows){
    PR.DIRS.forEach((dir, i) => {
      const angle = SP.HEADING[dir]; const prims = toWorld(figureModel(row.pose, row.f, { style, hairStyle: row.hs, gk }), angle);
      const fx = Math.cos(angle), fy = Math.sin(angle); const toLocal = p => [p[0]*fx + p[1]*fy, -p[0]*fy + p[1]*fx, p[2]];
      const grid = renderGrid(prims, row.cellW, row.cellH, row.FEET, spr, st, { local: toLocal, mask: !!mctx });
      blit(ctx, grid, row.cellW, row.cellH, i*row.cellW, row.y);
      if (mctx){ const img = mctx.createImageData(row.cellW, row.cellH); const md = img.data; for (let k=0;k<grid.length;k++){ const g = grid[k]; if (!g || g.m===undefined) continue; md[k*4] = g.m*60; md[k*4+1] = g.m*60; md[k*4+2] = g.m*60; md[k*4+3] = 255; } mctx.putImageData(img, i*row.cellW, row.y); }
      frames.push({ pose: row.pose, frame: row.f, hair: row.hs, gk: !!gk, dir, x: i*row.cellW, y: row.y, w: row.cellW, h: row.cellH, feet: row.FEET });
    });
  }
  return { canvas: cv, mask: mcv, frames };
}
// rows are stored compactly: [pose, frame, hair, y, cellW, cellH, feet]; column i is heading DIRS[i] at x = i*cellW
const compact = rows => rows.map(r => [r.pose, r.f, r.hs, r.y, r.cellW, r.cellH, r.FEET]);
function playerSheet(style, spr){
  const { rows, sheetW, sheetH } = sheetRows(spr, HAIR_STYLES);
  const r = renderRows(style, spr, rows, sheetW, sheetH, false, true);
  return { canvas: r.canvas, mask: r.mask, manifest: { style, spr, tones: STYLE[style].tones, materials: MATS, dirs: PR.DIRS, rows: compact(rows), width: sheetW, height: sheetH, count: r.frames.length } };
}
function gloveSheet(style, spr){
  const { rows, sheetW, sheetH } = sheetRows(spr, [0]);
  const r = renderRows(style, spr, rows, sheetW, sheetH, true, false);
  return { canvas: r.canvas, rows: compact(rows), count: r.frames.length, width: sheetW, height: sheetH };
}

// crowd strips: spectators standing `step` metres apart along the X axis (family 'x', for the stands along
// the touchlines) or the Y axis (family 'y', for the end stands), rendered at the player scale so a strip can
// be drawn at a row's start point with no transform. Four still and four standing variants per family.
function crowdStrips(style, spr){
  const st = STYLE[style]; const people = 24, step = 0.3; const strips = []; const canvases = [];
  // families: 'far' (along X, facing +Y towards the pitch), 'near' (along X, facing -Y), 'left' (along Y, facing +X), 'right' (along Y, facing -X)
  const FAM = { far: { axis:'x', face: Math.PI/2 }, near: { axis:'x', face: -Math.PI/2 }, left: { axis:'y', face: 0 }, right: { axis:'y', face: Math.PI } };
  for (const fam of Object.keys(FAM)) for (let s=0; s<8; s++){
    const up = s >= 4; const prims = []; const axis = FAM[fam].axis;
    for (let i=0;i<people;i++){
      const r2 = MD.seededRandom(1000 + s*100 + i + Object.keys(FAM).indexOf(fam)*5000); const model = spectatorModel(r2, up && r2() < 0.7);
      const ang = FAM[fam].face + (r2() - 0.5)*0.7;                               // facing the pitch, roughly
      const fx = Math.cos(ang), fy = Math.sin(ang), rx = -fy, ry = fx; const along = i*step + 0.15;
      const tr = p => axis==='x'? [p[0]*fx + p[1]*rx + along, p[0]*fy + p[1]*ry, p[2]] : [p[0]*fx + p[1]*rx, p[0]*fy + p[1]*ry + along, p[2]];
      for (const p of model){ const q = Object.assign({}, p, { c: tr(p.c), coat: i }); if (p.hair) q.hair = Object.assign({}, p.hair, { centre: tr(p.hair.centre), fwd:[fx, fy, 0] }); prims.push(q); }
    }
    // the strip's image covers the world box along the axis; origin (ox, oy) is where (0,0,0) of the strip lands
    const L = people*step; const pad = 0.6;
    const corners = axis==='x'? [[-pad, -pad, 0], [L + pad, -pad, 0], [-pad, pad, 0], [L + pad, pad, 0], [-pad, 0, 2.4], [L + pad, 0, 2.4]] : [[-pad, -pad, 0], [-pad, L + pad, 0], [pad, -pad, 0], [pad, L + pad, 0], [0, -pad, 2.4], [0, L + pad, 2.4]];
    const pts = corners.map(([X, Y, Z]) => ({ sx: spr*(X - Y), sy: spr*((X + Y)/2 - Z) }));
    const minx = Math.floor(Math.min(...pts.map(p=>p.sx))), maxx = Math.ceil(Math.max(...pts.map(p=>p.sx))), miny = Math.floor(Math.min(...pts.map(p=>p.sy))), maxy = Math.ceil(Math.max(...pts.map(p=>p.sy)));
    const W = maxx - minx + 1, H = maxy - miny + 1, ox = -minx, oy = -miny;
    const grid = new Array(W*H).fill(null);
    for (let py=0; py<H; py++) for (let px=0; px<W; px++){ const u = (px + 0.5 - ox)/spr, v = (py + 0.5 - oy)/spr; const h = hit(prims, v + u/2, v - u/2); if (!h) continue; const sh = shadeOf(h, st); grid[py*W+px] = { mat: h.p.mat, k: Math.min(st.tones-1, Math.floor(sh*st.tones)), coat: h.p.coat }; }
    const out = grid.slice(); for (let y=0;y<H;y++) for (let x=0;x<W;x++){ if (grid[y*W+x]) continue; const n = (x>0 && grid[y*W+x-1]) || (x<W-1 && grid[y*W+x+1]) || (y>0 && grid[(y-1)*W+x]) || (y<H-1 && grid[(y+1)*W+x]); if (n) out[y*W+x] = { mat:'LINE', k: st.outline==='black'? 0 : 1 }; }
    const cv = createCanvas(W, H); const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H); const dd = img.data;
    for (let i=0;i<W*H;i++){ const g = out[i]; if (!g) continue; const [r, gg, b] = template(MAT[g.mat], g.k); dd[i*4] = r; dd[i*4+1] = gg; dd[i*4+2] = g.coat!==undefined? 129 + g.coat : b; dd[i*4+3] = 255; }
    ctx.putImageData(img, 0, 0);
    canvases.push(cv); strips.push({ fam, axis, up, w: W, h: H, ox, oy, people, step, metres: L });
  }
  // pack vertically
  const sheetW = Math.max(...canvases.map(c=>c.width)); const sheetH = canvases.reduce((a, c) => a + c.height, 0);
  const sheet = createCanvas(sheetW, sheetH); const sctx = sheet.getContext('2d'); let y = 0;
  canvases.forEach((c, i) => { sctx.drawImage(c, 0, y); strips[i].y = y; strips[i].x = 0; y += c.height; });
  return { canvas: sheet, strips, width: sheetW, height: sheetH };
}

// grass: a tileable texture at `spr` px per metre over 4 m: two greens blended by a Bayer dither driven by
// smooth noise (so it reads as turf, not static), with a few darker and lighter specks
function grassTexture(style, spr){
  const size = spr*4; const cv = createCanvas(size, size); const ctx = cv.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  const rnd = MD.seededRandom(31);
  const A = style==='A'? [62,158,72] : [60,150,70], B = style==='A'? [56,148,66] : [50,132,60], DARK = [40,112,50], LIGHT = [84,172,92];
  const bayer = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  const cells = 4; const lat = []; for (let i=0;i<cells*cells;i++) lat.push(rnd());               // smooth noise lattice, tileable
  const smooth = (x, y) => { const gx = x/size*cells, gy = y/size*cells; const x0 = Math.floor(gx), y0 = Math.floor(gy); const tx = gx - x0, ty = gy - y0; const s = (a, b) => lat[((b%cells)+cells)%cells*cells + ((a%cells)+cells)%cells]; const u = tx*tx*(3-2*tx), v = ty*ty*(3-2*ty); return (s(x0,y0)*(1-u) + s(x0+1,y0)*u)*(1-v) + (s(x0,y0+1)*(1-u) + s(x0+1,y0+1)*u)*v; };
  for (let y=0;y<size;y++) for (let x=0;x<size;x++){
    const i = y*size + x; const n = smooth(x, y); const th = bayer[y%4][x%4]/16;
    let c = (style==='A')? A : (n > th? A : B);                                   // style A keeps a flat, bright pitch; its stripes come from the painter
    const r = rnd(); if (style==='B' && r < 0.008) c = DARK; else if (style==='B' && r < 0.016) c = LIGHT;
    d[i*4] = c[0]; d[i*4+1] = c[1]; d[i*4+2] = c[2]; d[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: cv, size };
}

// ---- reference mode: large renders for an image model to paint over ----
// node tools/iso-art.js --ref run:2,walk:0+walk:1 --refspr 128 --refout <dir> [--cols 4] [--gk 1] [--refhair 1]
// Each comma group is one image; '+' packs several frames into the same image (eight headings per frame, rows
// continue). Writes <stem>-colour.png (a lit render in a template kit), <stem>-depth.png (true ray-cast depth,
// nearer = brighter, for a depth ControlNet), <stem>-mask.png and <stem>.json with the cell layout, so the painted
// result can be cut back into sheet cells (tools/iso-paint.js).
if (opt('ref')){
  const refspr = +opt('refspr', 128), refout = path.resolve(ROOT, opt('refout', 'assets/matchday/isometric/ref'));
  fs.mkdirSync(refout, { recursive: true });
  const KIT = { SKIN:[224,172,130], HAIR:[60,38,22], SHIRT:[220,30,30], TRIM:[245,245,245], SHORTS:[30,60,200], SOCKS:[240,200,20], BOOTS:[20,20,20], GLOVE:[245,245,245], EYE:[20,20,20], CARD:[240,200,20], LINE:[0,0,0] };
  const BG = [200, 200, 200];
  const cellH = Math.round(2.375*refspr), FEET = cellH - Math.round(refspr*0.25);
  const gk = !!opt('gk'); const refHair = +opt('refhair', 0);
  for (const group of opt('ref').split(',')){
    const frames = group.split('+').map(spec => { const [pose, f] = spec.split(':'); return { pose, frame: +(f||0) }; });
    const wide = frames.some(f => !!SP.WIDE[f.pose]); const cellW = Math.round((wide? 4.0 : 2.0)*refspr); const cols = wide? Math.max(1, Math.round(+opt('cols', 4)/2)) : +opt('cols', 4);
    const n = frames.length*PR.DIRS.length; const rows = Math.ceil(n/cols); const W = cellW*cols, H = cellH*rows;
    const colour = createCanvas(W, H), depth = createCanvas(W, H), mask = createCanvas(W, H), matc = createCanvas(W, H);
    const cctx = colour.getContext('2d'), dctx = depth.getContext('2d'), mctx = mask.getContext('2d'), xctx = matc.getContext('2d');
    cctx.fillStyle = `rgb(${BG.join(',')})`; cctx.fillRect(0, 0, W, H); dctx.fillStyle = '#000'; dctx.fillRect(0, 0, W, H); mctx.fillStyle = '#000'; mctx.fillRect(0, 0, W, H);
    const cells = []; let idx = 0;
    for (const { pose, frame } of frames) PR.DIRS.forEach((dir) => {
      const i = idx++; const angle = SP.HEADING[dir]; const prims = toWorld(figureModel(pose, frame, { style: 'B', hairStyle: refHair, gk }), angle);
      const x0 = (i%cols)*cellW, y0 = Math.floor(i/cols)*cellH;
      const hits = new Array(cellW*cellH).fill(null); let tmin = 1e9, tmax = -1e9;
      for (let py=0; py<cellH; py++) for (let px=0; px<cellW; px++){
        const u = (px + 0.5 - cellW/2)/refspr, v = (py + 0.5 - FEET)/refspr;
        const h = hit(prims, v + u/2, v - u/2); if (!h) continue; hits[py*cellW+px] = h; tmin = Math.min(tmin, h.t); tmax = Math.max(tmax, h.t);
      }
      const ci = cctx.createImageData(cellW, cellH), di = dctx.createImageData(cellW, cellH), mi = mctx.createImageData(cellW, cellH), xi = xctx.createImageData(cellW, cellH);
      for (let k=0;k<hits.length;k++){
        const h = hits[k]; if (!h){ ci.data[k*4] = BG[0]; ci.data[k*4+1] = BG[1]; ci.data[k*4+2] = BG[2]; ci.data[k*4+3] = 255; di.data[k*4+3] = 255; mi.data[k*4+3] = 255; continue; }
        const tpl = template(MAT[h.p.mat], Math.min(STYLE.B.tones - 1, Math.floor(shadeOf(h, STYLE.B)*STYLE.B.tones))); xi.data[k*4] = tpl[0]; xi.data[k*4+1] = tpl[1]; xi.data[k*4+2] = tpl[2]; xi.data[k*4+3] = 255;   // material and tone, template-coded
        const base = KIT[h.p.mat] || [255, 0, 255]; const s = 0.55 + 0.45*shadeOf(h, STYLE.B);
        ci.data[k*4] = Math.round(base[0]*s); ci.data[k*4+1] = Math.round(base[1]*s); ci.data[k*4+2] = Math.round(base[2]*s); ci.data[k*4+3] = 255;
        const dz = tmax > tmin? (h.t - tmin)/(tmax - tmin) : 1; const dv = Math.round(60 + 195*dz);     // nearer = brighter
        di.data[k*4] = dv; di.data[k*4+1] = dv; di.data[k*4+2] = dv; di.data[k*4+3] = 255;
        mi.data[k*4] = 255; mi.data[k*4+1] = 255; mi.data[k*4+2] = 255; mi.data[k*4+3] = 255;
      }
      cctx.putImageData(ci, x0, y0); dctx.putImageData(di, x0, y0); mctx.putImageData(mi, x0, y0); xctx.putImageData(xi, x0, y0);
      cells.push({ pose, frame, dir, x: x0, y: y0, w: cellW, h: cellH, feet: FEET });
    });
    const stem = frames.map(f => `${f.pose}-${f.frame}`).join('+') + (gk? '-gk' : '') + (refHair? `-h${refHair}` : '');
    fs.writeFileSync(path.join(refout, `${stem}-colour.png`), colour.toBuffer('image/png'));
    fs.writeFileSync(path.join(refout, `${stem}-depth.png`), depth.toBuffer('image/png'));
    fs.writeFileSync(path.join(refout, `${stem}-mask.png`), mask.toBuffer('image/png'));
    fs.writeFileSync(path.join(refout, `${stem}-mat.png`), matc.toBuffer('image/png'));
    fs.writeFileSync(path.join(refout, `${stem}.json`), JSON.stringify({ frames, gk, hair: refHair, refspr, cellW, cellH, feet: FEET, width: W, height: H, cols, cells, kit: KIT, bg: BG }));
    console.log(`ref ${stem}: ${W}x${H}, ${cells.length} cells, cell ${cellW}x${cellH}, feet ${FEET}`);
  }
  process.exit(0);
}

// ---- main ----
fs.mkdirSync(OUT, { recursive: true });
for (const style of STYLES){
  const dir = path.join(OUT, style); fs.mkdirSync(dir, { recursive: true });
  for (const spr of SPRS){
    const t0 = Date.now();
    const ps = playerSheet(style, spr); const gs = gloveSheet(style, spr);
    fs.writeFileSync(path.join(dir, `players-${spr}.png`), ps.canvas.toBuffer('image/png'));
    fs.writeFileSync(path.join(dir, `patterns-${spr}.png`), ps.mask.toBuffer('image/png'));
    fs.writeFileSync(path.join(dir, `keepers-${spr}.png`), gs.canvas.toBuffer('image/png'));
    const cs = crowdStrips(style, spr); fs.writeFileSync(path.join(dir, `crowd-${spr}.png`), cs.canvas.toBuffer('image/png'));
    const gt = grassTexture(style, spr); fs.writeFileSync(path.join(dir, `grass-${spr}.png`), gt.canvas.toBuffer('image/png'));
    const manifest = Object.assign(ps.manifest, { keepers: { rows: gs.rows, width: gs.width, height: gs.height }, crowd: { strips: cs.strips, width: cs.width, height: cs.height }, grass: { size: gt.size, metres: 4 }, template: 'R = material*16+8, G = tone*40+20, B = 128 (crowd: 129+person); patterns: bit0 stripes, bit1 hoops, bit2 quarters, value*60' });
    fs.writeFileSync(path.join(dir, `players-${spr}.json`), JSON.stringify(manifest));
    console.log(`style ${style} @${spr}px/m: ${ps.manifest.count} player frames (${ps.manifest.width}x${ps.manifest.height}), ${gs.count} keeper frames, ${cs.strips.length} crowd strips (${cs.width}x${cs.height}), grass ${gt.size}px, ${((Date.now()-t0)/1000).toFixed(1)}s`);
  }
}
