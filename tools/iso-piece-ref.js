// ============================================================================
//  Isometric art: reference renders of stadium pieces for an image model to paint over.
//  A piece is a world box (a stand segment, a run of advertising boards, a dugout) drawn exactly as
//  the game draws it at P px per metre into a tight canvas, masked to the box, with a json that says
//  where the piece's anchor corner projects, so tools/iso_paint.py --piece can turn the painted result
//  into a texture the renderer places or tiles. Usage:
//    node tools/iso-piece-ref.js --piece far|near|left|right|boards|dugout [--P 24] [--from 30] [--metres 24] [--out <dir>] [--seed 1991]
//  Stands and the dugout are drawn by the game's own stadium code (steps, crowd strips, barriers, roof, shelter).
// ============================================================================
const fs = require('fs'); const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
globalThis.window = undefined; globalThis.Matchday = {};
for (const f of ['schema.js','sprites.js','renderers/iso-projection.js','iso-sprites.js','iso-assets.js','renderers/iso-pitch.js','renderers/iso-stadium.js']) eval(fs.readFileSync(path.join(ROOT, 'src/matchday', f), 'utf8'));
const MD = globalThis.Matchday; const PR = MD.iso.projection; const DIM = PR.DIM; const ST = MD.iso.stadium; const PITCH = MD.iso.pitch;
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf('--'+k); return i>=0? args[i+1] : d; };
const piece = opt('piece', 'far'), P = +opt('P', 24), seed = +opt('seed', 1991), out = path.resolve(ROOT, opt('out', 'assets/matchday/isometric/ref'));
MD.isoAssets.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas); MD.sprites.setCanvasFactory(createCanvas);

// the world box of each piece: { xa, xb, ya, yb, zTop, anchor, axis, metres }
function boxFor(piece, from, metres){
  const m = DIM.runoff + ST.STAND.gap, L = DIM.L, W = DIM.W, S = ST.STAND;
  const to = from + metres;
  if (piece==='far'){ const yFront = -m, yBack = -(m + (S.rows + 1.5)*S.tread), zTop = 0.5 + S.rows*S.rise + 2.6; return { xa: from, xb: to, ya: yBack, yb: yFront, zTop, anchor: [from, yFront, 0], axis: 'X', from, metres }; }
  if (piece==='near'){ const yFront = W + m, yBack = W + m + (S.nearRows + 1)*S.tread, zTop = 0.5 + S.nearRows*S.nearRise + 1.2; return { xa: from, xb: to, ya: yFront, yb: yBack, zTop, anchor: [from, yFront, 0], axis: 'X', from, metres }; }
  if (piece==='left'){ const xFront = -m, xBack = -(m + (S.endRows + 1)*S.tread), zTop = 0.5 + S.endRows*S.rise + 1.2; return { xa: xBack, xb: xFront, ya: from, yb: to, zTop, anchor: [xFront, from, 0], axis: 'Y', from, metres }; }
  if (piece==='right'){ const xFront = L + m, xBack = L + m + (S.endRows + 1)*S.tread, zTop = 0.5 + S.endRows*S.rightRise + 1.2; return { xa: xFront, xb: xBack, ya: from, yb: to, zTop, anchor: [xFront, from, 0], axis: 'Y', from, metres }; }
  if (piece==='boards'){ const y = W + DIM.runoff; return { xa: from, xb: to, ya: y - 0.05, yb: y + 0.35, zTop: 1.0, anchor: [from, y, 0], axis: 'X', from, metres }; }
  if (piece==='dugout'){ const d = ST.dugoutBox(from); return { xa: d.xa, xb: d.xb, ya: d.ya, yb: d.yb, zTop: d.zTop, anchor: [d.xa, d.ya, 0], axis: null, from, metres: ST.DUGOUT.metres }; }
  throw new Error('unknown piece '+piece);
}

// the dugout is drawn by the game's own stadium code (iso-stadium.js drawDugout, its generated fallback)

(async () => {
  const from = +opt('from', piece==='far'? 30 : piece==='near'? 36 : piece==='boards'? 40 : piece==='dugout'? 41 : 20);
  const metres = +opt('metres', piece==='boards'? 15 : piece==='dugout'? 5 : piece==='near'? 30 : piece==='far'? 24 : 28);
  const b = boxFor(piece, from, metres);
  const dir = path.join(ROOT, 'assets/matchday/isometric/B'); const man = JSON.parse(fs.readFileSync(path.join(dir, `players-${P}.json`)));
  const [img, patterns, keepers, crowd, grass] = await Promise.all(['players','patterns','keepers','crowd','grass'].map(n => loadImage(path.join(dir, `${n}-${P}.png`))));
  MD.isoAssets.register('B', P, { img, patterns, keepers, crowd, grass, manifest: man }); MD.isoAssets.setStyle('B');
  const corners = []; for (const X of [b.xa, b.xb]) for (const Y of [b.ya, b.yb]) for (const Z of [0, b.zTop]) corners.push([X, Y, Z]);
  const cam0 = { P, ox: 0, oy: 0 }; const pts = corners.map(c => PR.project(...c, cam0));
  const minX = Math.floor(Math.min(...pts.map(p => p.sx))) - 2, maxX = Math.ceil(Math.max(...pts.map(p => p.sx))) + 2;
  const minY = Math.floor(Math.min(...pts.map(p => p.sy))) - 2, maxY = Math.ceil(Math.max(...pts.map(p => p.sy))) + 2;
  const W = maxX - minX, H = maxY - minY; const cam = { P, ox: -minX, oy: -minY };
  // 1. the piece alone on a transparent canvas gives its exact silhouette (the mask the converter will use)
  const only = { far: ['far', 'roof'], near: ['near'], left: ['left'], right: ['right'], boards: ['boards'], dugout: ['dugout'] }[piece];
  const alone = createCanvas(W, H); const actx = alone.getContext('2d');
  ST.drawGround(actx, cam, seed, false, { x: 0, y: 0, w: W, h: H }, { colours: ['#FFF200', '#0053A0'], only });
  // 2. the full scene for the painter's context, then everything outside the box AND outside the silhouette is background
  const cv = createCanvas(W, H); const ctx = cv.getContext('2d'); ctx.fillStyle = '#C8C8C8'; ctx.fillRect(0, 0, W, H);
  ST.drawGround(ctx, cam, seed, false, { x: 0, y: 0, w: W, h: H }, { colours: ['#FFF200', '#0053A0'] });
  const id = ctx.getImageData(0, 0, W, H); const d = id.data; const ad = actx.getImageData(0, 0, W, H).data; const mask = createCanvas(W, H); const mctx = mask.getContext('2d'); const mi = mctx.createImageData(W, H);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++){
    const i = (y*W + x)*4;
    const u = (x - cam.ox)/P, v0 = (y - cam.oy)/P; const X0 = (u + 2*v0)/2, Y0 = (2*v0 - u)/2;
    const lo = Math.max(b.xa - X0, b.ya - Y0, 0), hi = Math.min(b.xb - X0, b.yb - Y0, b.zTop);
    const inside = lo <= hi && ad[i+3] > 0;
    if (!inside){ d[i] = 200; d[i+1] = 200; d[i+2] = 200; d[i+3] = 255; }
    mi.data[i] = mi.data[i+1] = mi.data[i+2] = inside? 255 : 0; mi.data[i+3] = 255;
  }
  ctx.putImageData(id, 0, 0); mctx.putImageData(mi, 0, 0);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `piece-${piece}-${P}-mask.png`), mask.toBuffer('image/png'));
  fs.mkdirSync(out, { recursive: true });
  const anchor = PR.project(...b.anchor, cam);
  fs.writeFileSync(path.join(out, `piece-${piece}-${P}-colour.png`), cv.toBuffer('image/png'));
  fs.writeFileSync(path.join(out, `piece-${piece}-${P}.json`), JSON.stringify({ piece, P, seed, width: W, height: H, ox: cam.ox, oy: cam.oy, box: { xa: b.xa, xb: b.xb, ya: b.ya, yb: b.yb, zTop: b.zTop }, anchorWorld: b.anchor, anchor: { x: anchor.sx, y: anchor.sy }, axis: b.axis, from: b.from, metres: b.metres, bg: [200, 200, 200] }));
  console.log(`piece ${piece}: ${W}x${H} at P ${P}, ${b.metres} m from ${b.from}, anchor ${anchor.sx.toFixed(1)},${anchor.sy.toFixed(1)}`);
})();
