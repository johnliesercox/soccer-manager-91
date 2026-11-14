// show override cells recoloured by the game next to the generated ones: node tools/iso-sheet-check.js <dir with overrides-<spr>.png> <out.png> <pose:frame[:gk],...> [spr]
const fs = require('fs'); const path = require('path'); const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = '/home/claude/mpsm'; globalThis.window = undefined; globalThis.Matchday = {};
for (const f of ['schema.js','sprites.js','renderers/iso-projection.js','iso-sprites.js','iso-assets.js']) eval(fs.readFileSync(path.join(ROOT, 'src/matchday', f), 'utf8'));
const MD = globalThis.Matchday; const PR = MD.iso.projection; const AS = MD.isoAssets; AS.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas); MD.sprites.setCanvasFactory(createCanvas);
(async () => {
  const [ovdir, out, specs, sprS] = process.argv.slice(2); const spr = +(sprS||24);
  const dir = path.join(ROOT, 'assets/matchday/isometric/B'); const man = JSON.parse(fs.readFileSync(path.join(dir, `players-${spr}.json`)));
  const parts = {}; for (const n of ['players','patterns','keepers','crowd','grass']) parts[n==='players'? 'img' : n] = await loadImage(path.join(dir, `${n}-${spr}.png`));
  const ovp = path.join(ovdir, `overrides-${spr}.png`), ovk = path.join(ovdir, `overrides-keepers-${spr}.png`);
  const overrides = fs.existsSync(ovp)? await loadImage(ovp) : null, overridesKeepers = fs.existsSync(ovk)? await loadImage(ovk) : null;
  const kits = [{ primary:'#FFF200', secondary:'#00A651', pattern:'plain' }, { primary:'#0053A0', secondary:'#FFFFFF', pattern:'hoops' }, { primary:'#C8102E', secondary:'#FFFFFF', pattern:'stripes' }, { primary:'#1D9A3C', secondary:'#FFFFFF', pattern:'plain', gk:true }];
  const list = specs.split(',').map(s => { const [pose, f] = s.split(':'); return { pose, frame: +(f||0), gk: s.endsWith('gk') }; });
  const scale = Math.max(1, Math.round(96/ (2.9*spr))); const cellW = Math.round(2.9*spr), cellH = Math.round(3.1*spr);
  const W = (PR.DIRS.length*cellW)*scale + 40, H = (list.length*2*kits.length*cellH)*scale;
  const cv = createCanvas(W, H); const ctx = cv.getContext('2d'); ctx.fillStyle = '#2E8B3A'; ctx.fillRect(0,0,W,H); ctx.imageSmoothingEnabled = false;
  let row = 0;
  for (const item of list) for (const kit of kits) for (const which of ['generated','painted']){
    AS.register('B', spr, Object.assign({ manifest: man }, parts, which==='painted'? { overrides, overridesKeepers } : {})); AS.setStyle('B');
    PR.DIRS.forEach((d, i) => { const k = item.gk? Object.assign({}, kit, { gk:true }) : kit; const c = AS.get(k, { skin: 1, hair: 2, style: 0 }, d, item.pose, item.frame, spr); if (!c) return; const x = 40 + i*cellW*scale, y = row*cellH*scale; ctx.drawImage(c, 0, 0, c.width, c.height, x + Math.round((cellW - c.width)/2)*scale, y + (cellH - c.height)*scale, c.width*scale, c.height*scale); });
    ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.fillText(which[0].toUpperCase(), 4, row*cellH*scale + 12); row++;
  }
  fs.writeFileSync(out, cv.toBuffer('image/png')); console.log('wrote', out, W, H);
})();
