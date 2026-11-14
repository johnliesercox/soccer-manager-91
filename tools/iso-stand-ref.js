// ============================================================================
//  Isometric art: a reference render of one far-stand segment for an image model to paint over.
//  Draws the far terrace (rows, crowd strips, barriers, roof) exactly as the game draws it at
//  P px per metre, for X = from .. from+metres, into a tight canvas, and writes a json with the
//  anchor (where the stand's front-bottom corner at X=from projects) so tools/iso-paint.js can
//  turn the painted result into a stand texture the renderer tiles along the stand.
//  Usage: node tools/iso-stand-ref.js [--P 24] [--from 30] [--metres 24] [--out <dir>] [--seed 1991]
// ============================================================================
const fs = require('fs'); const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
globalThis.window = undefined; globalThis.Matchday = {};
for (const f of ['schema.js','sprites.js','renderers/iso-projection.js','iso-sprites.js','iso-assets.js','renderers/iso-pitch.js','renderers/iso-stadium.js']) eval(fs.readFileSync(path.join(ROOT, 'src/matchday', f), 'utf8'));
const MD = globalThis.Matchday; const PR = MD.iso.projection; const DIM = PR.DIM; const ST = MD.iso.stadium;
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf('--'+k); return i>=0? args[i+1] : d; };
const P = +opt('P', 24), from = +opt('from', 30), metres = +opt('metres', 24), seed = +opt('seed', 1991), out = path.resolve(ROOT, opt('out', 'assets/matchday/isometric/ref'));
MD.isoAssets.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas); MD.sprites.setCanvasFactory(createCanvas);

(async () => {
  const dir = path.join(ROOT, 'assets/matchday/isometric/B'); const man = JSON.parse(fs.readFileSync(path.join(dir, `players-${P}.json`)));
  const [img, patterns, keepers, crowd, grass] = await Promise.all(['players','patterns','keepers','crowd','grass'].map(n => loadImage(path.join(dir, `${n}-${P}.png`))));
  MD.isoAssets.register('B', P, { img, patterns, keepers, crowd, grass, manifest: man }); MD.isoAssets.setStyle('B');
  // world box of the segment: X from..to, Y from the front wall to the back of the roof, Z 0..roof top
  const m = DIM.runoff + ST.STAND.gap, to = from + metres;
  const yFront = -m, yBack = -(m + (ST.STAND.rows + 1.5)*ST.STAND.tread), zTop = 0.5 + ST.STAND.rows*ST.STAND.rise + 2.6;
  const corners = [[from, yFront, 0], [to, yFront, 0], [from, yBack, zTop], [to, yBack, zTop], [from, yFront, zTop], [to, yBack, 0], [to, yFront, zTop], [from, yBack, 0]];
  const cam0 = { P, ox: 0, oy: 0 }; const pts = corners.map(c => PR.project(...c, cam0));
  const minX = Math.floor(Math.min(...pts.map(p => p.sx))) - 2, maxX = Math.ceil(Math.max(...pts.map(p => p.sx))) + 2;
  const minY = Math.floor(Math.min(...pts.map(p => p.sy))) - 2, maxY = Math.ceil(Math.max(...pts.map(p => p.sy))) + 2;
  const W = maxX - minX, H = maxY - minY; const cam = { P, ox: -minX, oy: -minY };
  const cv = createCanvas(W, H); const ctx = cv.getContext('2d'); ctx.fillStyle = '#C8C8C8'; ctx.fillRect(0, 0, W, H);
  // clip to the segment's parallelogram in X so neighbouring metres of stand do not leak in: draw the whole far stand, then mask
  ST.drawGround(ctx, cam, seed, false, { x: 0, y: 0, w: W, h: H }, { colours: ['#FFF200', '#0053A0'] });
  // mask everything outside X in [from, to] (lines of constant X are the direction (−1, −1/2) on screen... constant X: sx - 2*sy varies with Y and Z; use the world test per pixel)
  const id = ctx.getImageData(0, 0, W, H); const d = id.data;
  for (let y=0; y<H; y++) for (let x=0; x<W; x++){
    // a screen point maps to a line of world points; test the X range at Z=0 and at Z=zTop, Y free: X = (u + 2v)/2 with u = (x-ox)/P, v = (y-oy)/P + Z
    // the screen point is the line X = X0 + Z, Y = Y0 + Z (Z free); keep it if some Z in [0, zTop] lands in the box
    const u = (x - cam.ox)/P, v0 = (y - cam.oy)/P; const X0 = (u + 2*v0)/2, Y0 = (2*v0 - u)/2;
    const lo = Math.max(from - X0, yBack - Y0, 0), hi = Math.min(to - X0, yFront - Y0, zTop); const inside = lo <= hi;
    if (!inside){ const i = (y*W + x)*4; d[i] = 200; d[i+1] = 200; d[i+2] = 200; d[i+3] = 255; }
  }
  ctx.putImageData(id, 0, 0);
  fs.mkdirSync(out, { recursive: true });
  const anchor = PR.project(from, yFront, 0, cam);
  fs.writeFileSync(path.join(out, `stand-far-${P}-colour.png`), cv.toBuffer('image/png'));
  fs.writeFileSync(path.join(out, `stand-far-${P}.json`), JSON.stringify({ P, from, to, metres, seed, width: W, height: H, anchor: { x: anchor.sx, y: anchor.sy }, yFront, yBack, zTop, bg: [200, 200, 200] }));
  console.log(`stand ref: ${W}x${H} at P ${P}, X ${from}..${to}, anchor ${anchor.sx.toFixed(1)},${anchor.sy.toFixed(1)}`);
})();
