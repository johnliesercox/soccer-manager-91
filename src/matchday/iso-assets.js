// ============================================================================
//  Matchday: isometric art assets (Phase 3, Milestone 2A)
//  Loads the sprite sheets and textures rendered by tools/iso-art.js and
//  serves frames with the same contract as the procedural generator:
//  Matchday.isoAssets.get(kit, variant, dir, pose, frame, spr) returns a
//  cached canvas with .feet and .spr. The sheets hold TEMPLATE colours (red
//  channel = material, green = tone); a frame is recoloured on first use for
//  its kit, skin and hair, so one sheet serves every club and every player.
//  When no sheet is loaded for a scale, or a frame is missing, the caller
//  falls back to the procedural figures (iso-sprites.js), so the view always
//  draws something. Textures: crowd strips and a grass tile per style.
//
//  Assets arrive either inlined in the build (Matchday.isoAssetData, data
//  URIs written by build.py) or from files under assets/matchday/isometric/.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const MATS = ['SKIN','HAIR','SHIRT','TRIM','SHORTS','SOCKS','BOOTS','GLOVE','EYE','CARD','LINE','COAT','HAT','SCARF'];
  const SKINS = MD.sprites.SKINS, HAIRS = MD.sprites.HAIRS;
  const sheets = {};                               // style -> spr -> { img, manifest, keepers, crowd, grass, index }
  const cache = new Map(); const CACHE_MAX = 2400;
  let createCanvas = (w, h) => { const c = root.document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let style = 'B';

  // ---- colours ----
  function hex(c){ if (!c) return '#808080'; if (c[0]==='#') return c; const m = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(c); if (!m) return '#808080'; const h=+m[1]/360, s=+m[2]/100, l=+m[3]/100; const f=n=>{ const k=(n+h*12)%12; const a=s*Math.min(l,1-l); return Math.round(255*(l - a*Math.max(-1, Math.min(k-3, 9-k, 1)))); }; return '#'+[f(0),f(8),f(4)].map(v=>v.toString(16).padStart(2,'0')).join(''); }
  function rgb(c){ c = hex(c); return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]; }
  const lum = c => { const v = rgb(c); return (0.299*v[0]+0.587*v[1]+0.114*v[2])/255; };
  // tone k of K for a base colour: from darkest (-0.42) to lightest (+0.28), middle tones near the base
  function toneRGB(base, k, K){
    const [r, g, b] = rgb(base); const u = K<=1? 0.5 : k/(K-1); const f = -0.42 + u*0.70;
    const t = x => Math.max(0, Math.min(255, Math.round(f > 0? x + (255 - x)*f : x*(1 + f))));
    return [t(r), t(g), t(b)];
  }
  function paletteFor(kit, variant, K){
    const shirt = hex(kit.primary), trim = hex(kit.secondary);
    let shorts = trim; if (Math.abs(lum(shorts)-lum(shirt)) < 0.12) shorts = lum(shirt) > 0.5? '#1F2A44' : '#F2F2F2';
    const line = style==='A'? '#000000' : (lum(shirt) > 0.8? '#2A2A2A' : '#14161C');
    const base = { SKIN: SKINS[variant.skin%SKINS.length], HAIR: HAIRS[variant.hair%HAIRS.length], SHIRT: shirt, TRIM: trim, SHORTS: shorts, SOCKS: shirt, BOOTS: '#1A1A1A', GLOVE: '#E6E6E6', EYE: '#101010', CARD: kit.card==='red'? '#D81E1E' : '#F7D117', LINE: line, COAT:'#444', HAT:'#333', SCARF:'#C8102E' };
    const table = new Array(MATS.length*8);
    for (let m=0;m<MATS.length;m++) for (let k=0;k<8;k++){ const mat = MATS[m]; table[m*8+k] = (mat==='LINE')? rgb(line) : (mat==='EYE')? rgb(base.EYE) : toneRGB(base[mat], Math.min(k, K-1), K); }
    return table;
  }

  // ---- loading ----
  function loadImage(src){ return new Promise((res, rej) => { const im = new root.Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
  // register a sheet set (already-loaded images) for a style and scale
  function register(st, spr, parts){
    // an artist's overrides sheet (same layout, template colours): any cell that holds a painted pixel replaces the
    // generated cell outright, so a thinner painted figure does not show generated pixels around it
    const dirs = parts.manifest.dirs;
    const overlay = (base, over, rows) => {
      const cv = createCanvas(base.width, base.height); const ctx = cv.getContext('2d'); ctx.drawImage(base, 0, 0);
      const ov = createCanvas(over.width, over.height); const octx = ov.getContext('2d'); octx.drawImage(over, 0, 0);
      let cells = 0;
      for (const [pose, frame, hair, y, cellW, cellH] of rows) for (let i=0;i<dirs.length;i++){
        const x = i*cellW; if (x + cellW > ov.width || y + cellH > ov.height) continue;
        const d = octx.getImageData(x, y, cellW, cellH).data; let any = false; for (let k=3;k<d.length;k+=4) if (d[k]){ any = true; break; }
        if (!any) continue;
        ctx.clearRect(x, y, cellW, cellH); ctx.drawImage(ov, x, y, cellW, cellH, x, y, cellW, cellH); cells++;
      }
      cv.overrideCells = cells; return cv;
    };
    if (parts.overrides){ try { parts = Object.assign({}, parts, { img: overlay(parts.img, parts.overrides, parts.manifest.rows) }); } catch(e){ /* keep the generated sheet */ } }
    if (parts.overridesKeepers){ try { parts = Object.assign({}, parts, { keepers: overlay(parts.keepers, parts.overridesKeepers, parts.manifest.keepers.rows) }); } catch(e){ /* keep the generated sheet */ } }
    // painted stadium pieces: { name: { image, meta } }; the far stand may arrive on the older stand/standMeta fields
    const pieces = Object.assign({}, parts.pieces || {});
    if (parts.stand && parts.standMeta && !pieces.far) pieces.far = { image: parts.stand, meta: parts.standMeta };
    parts = Object.assign({}, parts, { pieces });
    const idx = new Map();
    const expand = (rows, prefix) => { for (const [pose, frame, hair, y, cellW, cellH, feet] of rows) dirs.forEach((dir, i) => idx.set(prefix+pose+'|'+frame+'|'+hair+'|'+dir, { x: i*cellW, y, w: cellW, h: cellH, feet })); };
    expand(parts.manifest.rows, ''); expand(parts.manifest.keepers.rows, 'gk|');
    sheets[st] = sheets[st] || {}; sheets[st][spr] = Object.assign({ index: idx }, parts); cache.clear(); texCache.clear();
  }
  // load from the inlined data (build) or from files; resolves when done, never rejects (missing assets = fallback)
  // per style: how many sheet sets the build carries and how many have landed (decoded or failed), so a renderer can wait
  // for its own style and draw nothing generated in the meantime
  const styleDone = {};
  const noteStyle = st => { if (!styleDone[st]){ let resolve; const promise = new Promise(r => { resolve = r; }); styleDone[st] = { expected: 0, done: 0, resolve, promise }; } return styleDone[st]; };
  const expects = st => !!(MD.isoAssetData && Object.keys(MD.isoAssetData).some(k => k.split('/')[0]===st));
  const isReady = st => !expects(st) || (styleDone[st] && styleDone[st].done >= styleDone[st].expected && styleDone[st].expected > 0) || false;
  const styleReady = st => expects(st)? noteStyle(st).promise : Promise.resolve();
  async function load(baseUrl){
    const data = MD.isoAssetData || null;
    // the style the plain Iso view draws is decoded first, the comparison styles after it
    const first = MD.isoDefaultStyle || 'B';
    const list = data? Object.keys(data).sort((a, b) => (a.split('/')[0]===first? 0 : 1) - (b.split('/')[0]===first? 0 : 1)) : [];
    for (const key of list) noteStyle(key.split('/')[0]).expected++;
    const jobs = []; const firstJobs = [];
    // a field may be a '@style/spr/field[/name]' reference to another style's data (a style that inherits its stadium
    // art, say), so the build carries one copy; resolved here, images decoded once and shared
    const deref = v => { let guard = 0; while (typeof v === 'string' && v[0]==='@' && guard++ < 8){ const [st, spr, ...path] = v.slice(1).split('/'); let x = data[st+'/'+spr]; for (const k of path) x = x? x[k] : undefined; v = x; } return v; };
    const imgCache = new Map(); const loadShared = src => { if (!src) return null; if (!imgCache.has(src)) imgCache.set(src, loadImage(src)); return imgCache.get(src); };
    for (const key of list){                              // key: "B/16"
      const [st, sprS] = key.split('/'); const spr = +sprS; const d = data[key];
      jobs.push((async () => { try {
        const f = k => deref(d[k]);
        const [img, patterns, keepers, crowd, grass, overrides, overridesKeepers, stand] = await Promise.all([loadShared(f('players')), loadShared(f('patterns')), loadShared(f('keepers')), loadShared(f('crowd')), loadShared(f('grass')), loadShared(f('overrides')), loadShared(f('overridesKeepers')), loadShared(f('stand'))]);
        // painted pieces load one by one so a single bad texture costs only that piece
        const pieces = {}; const pd = d.pieces || {}; const names = Object.keys(pd);
        await Promise.all(names.map(async n => { try { const p = deref(pd[n]); const image = await loadShared(p.image); pieces[n] = { image, meta: p.meta }; } catch(e){ /* generated art for this piece */ } }));
        register(st, spr, { img, patterns, keepers, crowd, grass, overrides, overridesKeepers, stand, standMeta: f('standMeta'), pieces, manifest: f('manifest') }); } catch(e){ /* fallback */ }
        finally { const sd = noteStyle(st); sd.done++; if (sd.done >= sd.expected) sd.resolve(); } })());
      if (st===first){ firstJobs.push(jobs[jobs.length-1]); if (firstJobs.length===list.filter(k => k.split('/')[0]===first).length) await Promise.all(firstJobs); }   // the default style lands before the rest start decoding
    }
    if (!data && baseUrl){
      for (const st of ['A','B']) for (const spr of [16, 12]) jobs.push((async () => { try { const m = await (await root.fetch(`${baseUrl}/${st}/players-${spr}.json`)).json(); const [img, patterns, keepers, crowd, grass] = await Promise.all([loadImage(`${baseUrl}/${st}/players-${spr}.png`), loadImage(`${baseUrl}/${st}/patterns-${spr}.png`), loadImage(`${baseUrl}/${st}/keepers-${spr}.png`), loadImage(`${baseUrl}/${st}/crowd-${spr}.png`), loadImage(`${baseUrl}/${st}/grass-${spr}.png`)]); register(st, spr, { img, patterns, keepers, crowd, grass, manifest: m }); } catch(e){ /* fallback */ } })());
    }
    await Promise.all(jobs);
    return available();
  }
  const available = () => Object.keys(sheets).map(st => st+': '+Object.keys(sheets[st]).join(','));
  function has(spr, st){ const s = sheets[st||style]; return !!(s && s[spr]); }

  // ---- frames ----
  // a recoloured frame for a kit and variant; null when the sheet or frame is missing (caller falls back)
  function get(kit, variant, dir, pose, frame, spr){
    const set = sheets[style] && sheets[style][spr]; if (!set) return null;
    const pattern = kit.gk? 'plain' : (kit.pattern||'plain'); const hs = (variant.style||0);
    const key = style+'|'+spr+'|'+kit.primary+'|'+kit.secondary+'|'+pattern+'|'+(kit.gk?'g':'')+'|'+(kit.card||'')+'|'+variant.skin+'|'+variant.hair+'|'+hs+'|'+dir+'|'+pose+'|'+frame;
    let cv = cache.get(key); if (cv) return cv;
    const f = kit.gk? set.index.get('gk|'+pose+'|'+frame+'|0|'+dir) : (set.index.get(pose+'|'+frame+'|'+hs+'|'+dir) || set.index.get(pose+'|'+frame+'|0|'+dir));
    if (!f) return null;
    const src = kit.gk? set.keepers : set.img;
    cv = createCanvas(f.w, f.h); const ctx = cv.getContext('2d'); ctx.drawImage(src, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    const img = ctx.getImageData(0, 0, f.w, f.h); const d = img.data; const table = paletteFor(kit, variant, set.manifest.tones);
    let mask = null;
    if (!kit.gk && pattern!=='plain' && set.patterns){ const mc = createCanvas(f.w, f.h); const mx = mc.getContext('2d'); mx.drawImage(set.patterns, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h); mask = mx.getImageData(0, 0, f.w, f.h).data; }
    const bit = pattern==='stripes'? 1 : pattern==='hoops'? 2 : pattern==='quarters' || pattern==='halves'? 4 : 0;
    const SHIRT = 2, TRIM = 3;
    for (let i=0;i<d.length;i+=4){ if (d[i+3]===0) continue; let m = d[i] >> 4; const k = Math.round((d[i+1] - 20)/40); if (mask && m===SHIRT && mask[i+3] && (Math.round(mask[i]/60) & bit)) m = TRIM; const c = table[m*8 + Math.max(0, Math.min(7, k))]; if (!c) continue; d[i] = c[0]; d[i+1] = c[1]; d[i+2] = c[2]; }
    ctx.putImageData(img, 0, 0); cv.feet = f.feet; cv.spr = spr;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, cv); return cv;
  }

  // ---- textures ----
  const COATS = ['#2B2F3A','#3A3A3A','#4A3A2A','#5A5E66','#6B5B4A','#3B4A6B','#8A8A8A','#D04040','#F2C230','#F2F2F2','#4A7BD0','#E07030','#8A4AC0','#3AA060','#C8102E','#1D5BA4','#F0E0B0','#20B0C0','#D86090','#E8E8E8'];
  const HATS = ['#2A2A2A','#3B2E2A','#1E2A44','#444','#6B1F1F'];
  const texCache = new Map();
  // a crowd strip (family 'x' along the touchlines or 'y' along the ends, variant 0..3, standing or not),
  // recoloured with a seed and the two kits' colours; null without assets. .ox/.oy is where the strip's
  // world origin lands in the image, .metres its length.
  function crowdStrip(spr, fam, variant, up, seed, colours){
    const set = sheets[style] && sheets[style][spr]; if (!set) return null;
    const key = 'crowd|'+style+'|'+spr+'|'+fam+'|'+variant+'|'+(up?1:0)+'|'+seed+'|'+(colours||[]).join(',');
    let cv = texCache.get(key); if (cv) return cv;
    const s = set.manifest.crowd.strips.find(x => x.fam===fam && x.up===!!up && (set.manifest.crowd.strips.filter(y=>y.fam===fam && y.up===!!up).indexOf(x)===(variant%4))); if (!s) return null;
    cv = createCanvas(s.w, s.h); const ctx = cv.getContext('2d'); ctx.drawImage(set.crowd, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
    const img = ctx.getImageData(0, 0, s.w, s.h); const d = img.data; const rnd = MD.seededRandom((seed||1) ^ (variant*7919) ^ (fam.length*0x3f3f));
    const K = set.manifest.tones; const pal = COATS.concat(colours||[], colours||[]);
    const people = []; for (let i=0;i<s.people+1;i++){ const u = rnd(); people.push({ coat: pal[Math.floor(rnd()*pal.length)], hat: HATS[Math.floor(rnd()*HATS.length)], skin: SKINS[Math.floor(rnd()*SKINS.length)], hair: HAIRS[Math.floor(rnd()*HAIRS.length)], scarf: colours && colours.length && u < 0.6? colours[Math.floor(rnd()*colours.length)] : '#C8102E' }); }
    const line = rgb(style==='A'? '#000000' : '#14161C');
    for (let i=0;i<d.length;i+=4){ if (d[i+3]===0) continue; const m = MATS[d[i] >> 4], k = Math.max(0, Math.min(7, Math.round((d[i+1] - 20)/40))); const person = people[Math.max(0, Math.min(people.length-1, d[i+2] - 129))];
      let c; if (m==='LINE') c = line; else if (m==='COAT') c = toneRGB(person.coat, Math.min(k, K-1), K); else if (m==='HAT') c = toneRGB(person.hat, Math.min(k, K-1), K); else if (m==='SKIN') c = toneRGB(person.skin, Math.min(k, K-1), K); else if (m==='HAIR') c = toneRGB(person.hair, Math.min(k, K-1), K); else if (m==='SCARF') c = toneRGB(person.scarf, Math.min(k, K-1), K); else c = [200, 0, 200];
      d[i] = c[0]; d[i+1] = c[1]; d[i+2] = c[2]; }
    ctx.putImageData(img, 0, 0); cv.ox = s.ox; cv.oy = s.oy; cv.metres = s.metres;
    texCache.set(key, cv); return cv;
  }
  function grass(spr){ const set = sheets[style] && sheets[style][spr]; return set? set.grass : null; }
  // a painted stadium piece (tools/iso_paint.py --stand / --piece): 'far', 'near', 'left', 'right' stands, 'boards',
  // 'dugout'. The image plus its meta: where the piece's front-bottom anchor corner sits in it (anchor.x/y at meta.P
  // px per metre), how many metres it covers along its axis, and where that run starts. Null when the style ships
  // without one, so the caller draws the generated art instead.
  function pieceTexture(spr, name){
    const sets = sheets[style]; if (!sets) return null;
    const exact = sets[spr]; if (exact && exact.pieces && exact.pieces[name]) return exact.pieces[name];
    // any scale (the whole-pitch camera, say): the nearest scale that ships the piece, drawn scaled by the caller via meta.P
    let best = null; for (const k of Object.keys(sets)){ const set = sets[k]; const p = set.pieces && set.pieces[name]; if (!p) continue; if (!best || Math.abs(+k - spr) < Math.abs(best.meta.P - spr)) best = p; }
    return best;
  }
  const standTexture = spr => pieceTexture(spr, 'far');
  // where a painted piece has paint: a coarse grid of its alpha (MASK_N squared cells), made once per piece, so that effects laid
  // over it (the camera flashes of a celebration) land on the stand and never on its transparent corners. Null where no
  // canvas can be read, in which case the caller draws nothing.
  const MASK_N = 48;
  function pieceMask(piece){
    if (!piece || !piece.image) return null; if (piece.mask!==undefined) return piece.mask;
    let mask = null;
    try {
      const c = createCanvas(MASK_N, MASK_N); const g = c.getContext('2d'); g.drawImage(piece.image, 0, 0, MASK_N, MASK_N);
      const d = g.getImageData(0, 0, MASK_N, MASK_N).data; mask = new Uint8Array(MASK_N*MASK_N); for (let i=0;i<mask.length;i++) mask[i] = d[i*4+3] > 160? 1 : 0;
    } catch(e){ mask = null; }
    piece.mask = mask; return mask;
  }
  const maskAt = (mask, u, v) => mask[Math.min(MASK_N-1, Math.floor(v*MASK_N))*MASK_N + Math.min(MASK_N-1, Math.floor(u*MASK_N))]===1;

  MD.isoAssets = { MATS, load, register, has, get, crowdStrip, grass, standTexture, pieceTexture, pieceMask, maskAt, MASK_N, available, paletteFor, toneRGB,
    setStyle(s){ style = s; cache.clear(); texCache.clear(); }, getStyle(){ return style; },
    setCanvasFactory(f){ createCanvas = f; cache.clear(); texCache.clear(); }, cacheSize(){ return cache.size; }, clear(){ cache.clear(); texCache.clear(); }, styleReady, isReady, expects };
})(typeof window!=='undefined'? window : globalThis);
