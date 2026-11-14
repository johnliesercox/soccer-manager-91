// every painted frame recoloured through the game, one kit, eight headings, at 3x: node tools/iso-sheet-review.js <out.png> [spr] [hair style 0|1] [scale]
const fs = require('fs'); const path = require('path'); const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..'); globalThis.window = undefined; globalThis.Matchday = {};
for (const f of ['schema.js','sprites.js','renderers/iso-projection.js','iso-sprites.js','iso-assets.js']) eval(fs.readFileSync(path.join(ROOT, 'src/matchday', f), 'utf8'));
const MD = globalThis.Matchday; const PR = MD.iso.projection; const AS = MD.isoAssets; AS.setCanvasFactory(createCanvas); MD.isoSprites.setCanvasFactory(createCanvas); MD.sprites.setCanvasFactory(createCanvas);
(async () => {
  const [out, sprS, hairS, scaleS] = process.argv.slice(2); const spr = +(sprS||24); const hs = +(hairS||0); const scale = +(scaleS||3);
  const dir = path.join(ROOT, 'assets/matchday/isometric/B'); const man = JSON.parse(fs.readFileSync(path.join(dir, `players-${spr}.json`)));
  const parts = { manifest: man }; for (const n of ['players','patterns','keepers','crowd','grass']) parts[n==='players'? 'img' : n] = await loadImage(path.join(dir, `${n}-${spr}.png`));
  for (const [k, n] of [['overrides','overrides'], ['overridesKeepers','overrides-keepers']]){ const p = path.join(dir, `${n}-${spr}.png`); if (fs.existsSync(p)) parts[k] = await loadImage(p); }
  AS.register('B', spr, parts); AS.setStyle('B');
  const kit = { primary:'#C8102E', secondary:'#FFFFFF', pattern:'plain' }, gkKit = { primary:'#1D9A3C', secondary:'#FFFFFF', pattern:'plain', gk:true };
  const items = []; for (const [pose, frame, hair] of man.rows) if (hair===hs) items.push({ pose, frame, gk:false }); if (hs===0) for (const [pose, frame, hair] of man.keepers.rows) if (hair===0) items.push({ pose, frame, gk:true });
  const cellW = Math.round(4.6*spr), cellH = Math.round(3.1*spr); const W = (PR.DIRS.length*cellW + 90)*scale, H = items.length*cellH*scale;
  const cv = createCanvas(W, H); const ctx = cv.getContext('2d'); ctx.fillStyle = '#2E8B3A'; ctx.fillRect(0,0,W,H); ctx.imageSmoothingEnabled = false;
  items.forEach((it, row) => {
    const y = row*cellH*scale; ctx.fillStyle = row%2? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0)'; ctx.fillRect(0, y, W, cellH*scale);
    PR.DIRS.forEach((d, i) => { const c = AS.get(it.gk? gkKit : kit, { skin: 1, hair: 0, style: hs }, d, it.pose, it.frame, spr); if (!c) return; const x = (90 + i*cellW)*scale; ctx.drawImage(c, 0, 0, c.width, c.height, x + Math.round((cellW - c.width)/2)*scale, y + (cellH - c.height - 2)*scale, c.width*scale, c.height*scale); });
    ctx.fillStyle = '#fff'; ctx.font = `${10*scale}px sans-serif`; ctx.fillText((it.gk? 'gk ' : '') + it.pose + ' ' + it.frame, 6, y + 14*scale);
  });
  ctx.fillStyle = '#fff'; PR.DIRS.forEach((d, i) => ctx.fillText(d, (90 + i*cellW + 2)*scale, 12*scale));
  fs.writeFileSync(out, cv.toBuffer('image/png')); console.log('wrote', out, W, H, items.length, 'rows');
})();
