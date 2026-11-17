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
  const cache = new Map(); const CACHE_MAX = 2400; let builtCount = 0;   // builtCount: every frame recoloured since the page loaded (for tools)
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
  // (a kit's table is the same for every picture of a player, so the quick way works it out once: tableFor below)
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

  // ---- the sheets at one byte a pixel ----
  // A player's picture used to be made by drawing his cell of the sheet onto a small canvas and reading its pixels back,
  // and a second cell for the pattern of a striped shirt: thousands of pictures in the first minute of a match (3,500 on
  // a phone, which holds two scales), each a read-back from a five-megapixel image that the browser may have to decode
  // again first. On John's phone that was a few milliseconds on most frames and the best part of a tenth of a second at
  // a cut, when twenty new pictures are wanted at once. prime(scale) reads each sheet once, a band at a time, into one
  // byte a pixel: 0 for a clear pixel, otherwise the material and tone the recolouring looks up, and for a shirt pixel
  // the pattern sheet's value as well. A picture is then written from those bytes and the kit's table with nothing
  // drawn and nothing read back. The pixels are the same (tools/sprite-reference.js holds every cell of every sheet to
  // that for a spread of kits). A sheet with a half-clear pixel or a material outside the table cannot be held this
  // way and keeps the old way, as does any picture asked for before its sheet has been read.
  const PLANE_SHIRT = 113, BAND = 96;   // 1..112: material*8 + tone + 1; 113..255: a shirt pixel, pattern value*8 + tone
  const pause = () => new Promise(r => (root.setTimeout || (f => f()))(r, 0));
  async function planeOf(src, patterns, gk){
    const w = src.width, h = src.height; if (!w || !h) return null; const data = new Uint8Array(w*h);
    if (!gk && patterns && (patterns.width!==w || patterns.height!==h)) return null;   // a pattern sheet of another size: the old way
    const usePat = !gk && !!patterns;
    const cv = createCanvas(w, Math.min(BAND, h)); const ctx = cv.getContext('2d', { willReadFrequently: true }); const pc = usePat? createCanvas(w, Math.min(BAND, h)) : null; const pctx = pc? pc.getContext('2d', { willReadFrequently: true }) : null;
    for (let y0=0; y0<h; y0+=BAND){
      const bh = Math.min(BAND, h - y0); ctx.clearRect(0, 0, w, BAND); ctx.drawImage(src, 0, y0, w, bh, 0, 0, w, bh); const d = ctx.getImageData(0, 0, w, bh).data;
      let md = null; if (pctx){ pctx.clearRect(0, 0, w, BAND); pctx.drawImage(patterns, 0, y0, w, bh, 0, 0, w, bh); md = pctx.getImageData(0, 0, w, bh).data; }
      for (let i=0, o=y0*w; i<d.length; i+=4, o++){
        const a = d[i+3]; if (a===0) continue; if (a!==255) return null;                       // a half-clear pixel: the old way keeps its alpha
        const m = d[i] >> 4; if (m >= MATS.length) return null;                                 // outside the table: the old way leaves it as drawn
        const k = Math.max(0, Math.min(7, Math.round((d[i+1] - 20)/40)));
        if (m===2){ const pat = md && md[i+3]? Math.round(md[i]/60) : 0; if (pat > 17) return null; data[o] = PLANE_SHIRT + pat*8 + k; } else data[o] = 1 + m*8 + k;
      }
      await pause();
    }
    return { w, h, data, patterned: !!usePat };
  }
  // reads the sheets of one scale; resolves when they are ready (or cannot be held this way), never rejects
  function prime(spr, st){
    const set = sheets[st||style] && sheets[st||style][spr]; if (!set) return Promise.resolve(false);
    if (!set.priming) set.priming = (async () => {
      try { set.plane = set.img? await planeOf(set.img, set.patterns, false) : null; } catch(e){ set.plane = null; }
      try { set.keeperPlane = set.keepers? await planeOf(set.keepers, null, true) : null; } catch(e){ set.keeperPlane = null; }
      // a striped kit asked of a sheet that came with no pattern sheet is plain either way; pictures made the old way stay as they are
      return !!(set.plane && set.keeperPlane);
    })();
    return set.priming;
  }
  const planeState = (spr, st) => { const set = sheets[st||style] && sheets[st||style][spr]; return !set? 'no sheets' : !set.priming? 'not read' : (set.plane===undefined || set.keeperPlane===undefined)? 'reading' : (set.plane && set.keeperPlane)? 'ready' : 'old way'; };
  // a kit's table for one look, three bytes an entry, worked out once (a few hundred bytes each; a match uses about thirty)
  const tables = new Map(); const tableFor = (kit, variant, K) => { const k = style+'|'+kit.primary+'|'+kit.secondary+'|'+(kit.card||'')+'|'+variant.skin+'|'+variant.hair+'|'+K; let t = tables.get(k); if (!t){ if (tables.size >= 256) tables.clear(); const p = paletteFor(kit, variant, K); t = new Uint8Array(p.length*3); for (let i=0;i<p.length;i++){ t[i*3] = p[i][0]; t[i*3+1] = p[i][1]; t[i*3+2] = p[i][2]; } tables.set(k, t); } return t; };
  // one pixel buffer per cell size, written in full every time
  const scratch = new Map(); const scratchImage = (ctx, w, h) => { const k = w+'x'+h; let im = scratch.get(k); if (!im){ im = ctx.createImageData(w, h); scratch.set(k, im); } return im; };

  // ---- frames ----
  // a recoloured frame for a kit and variant; null when the sheet or frame is missing (caller falls back)
  function get(kit, variant, dir, pose, frame, spr){
    const set = sheets[style] && sheets[style][spr]; if (!set) return null;
    const pattern = kit.gk? 'plain' : (kit.pattern||'plain'); const hs = (variant.style||0);
    const key = style+'|'+spr+'|'+kit.primary+'|'+kit.secondary+'|'+pattern+'|'+(kit.gk?'g':'')+'|'+(kit.card||'')+'|'+variant.skin+'|'+variant.hair+'|'+hs+'|'+dir+'|'+pose+'|'+frame;
    let cv = cache.get(key); if (cv){ cache.delete(key); cache.set(key, cv); return cv; }   // the one given up when the cache is full is the one longest unused
    const f = kit.gk? set.index.get('gk|'+pose+'|'+frame+'|0|'+dir) : (set.index.get(pose+'|'+frame+'|'+hs+'|'+dir) || set.index.get(pose+'|'+frame+'|0|'+dir));
    if (!f) return null;
    builtCount++;
    const bit = pattern==='stripes'? 1 : pattern==='hoops'? 2 : pattern==='quarters' || pattern==='halves'? 4 : 0;
    const SHIRT = 2, TRIM = 3;
    const plane = kit.gk? set.keeperPlane : set.plane;
    if (plane && f.x >= 0 && f.y >= 0 && f.x + f.w <= plane.w && f.y + f.h <= plane.h){
      // the quick way: the cell is read from the sheet's one-byte-a-pixel copy and written straight to its canvas
      cv = createCanvas(f.w, f.h); const ctx = cv.getContext('2d'); const img = scratchImage(ctx, f.w, f.h); const d = img.data; const src = plane.data, W = plane.w; const table = tableFor(kit, variant, set.manifest.tones);
      const stripe = !kit.gk && pattern!=='plain' && plane.patterned? bit : 0;
      for (let y=0, o=0; y<f.h; y++){ let i = (f.y + y)*W + f.x; for (let x=0; x<f.w; x++, i++, o+=4){
        const v = src[i]; if (!v){ d[o] = 0; d[o+1] = 0; d[o+2] = 0; d[o+3] = 0; continue; }
        let m, k; if (v < PLANE_SHIRT){ m = (v - 1) >> 3; k = (v - 1) & 7; } else { const u = v - PLANE_SHIRT; k = u & 7; m = ((u >> 3) & stripe)? TRIM : SHIRT; }
        const c = (m*8 + k)*3; d[o] = table[c]; d[o+1] = table[c+1]; d[o+2] = table[c+2]; d[o+3] = 255; } }
      ctx.putImageData(img, 0, 0); cv.feet = f.feet; cv.spr = spr;
    } else {
    const src = kit.gk? set.keepers : set.img;
    cv = createCanvas(f.w, f.h); const ctx = cv.getContext('2d'); ctx.drawImage(src, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    const img = ctx.getImageData(0, 0, f.w, f.h); const d = img.data; const table = paletteFor(kit, variant, set.manifest.tones);
    let mask = null;
    if (!kit.gk && pattern!=='plain' && set.patterns){ const mc = createCanvas(f.w, f.h); const mx = mc.getContext('2d'); mx.drawImage(set.patterns, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h); mask = mx.getImageData(0, 0, f.w, f.h).data; }
    for (let i=0;i<d.length;i+=4){ if (d[i+3]===0) continue; let m = d[i] >> 4; const k = Math.round((d[i+1] - 20)/40); if (mask && m===SHIRT && mask[i+3] && (Math.round(mask[i]/60) & bit)) m = TRIM; const c = table[m*8 + Math.max(0, Math.min(7, k))]; if (!c) continue; d[i] = c[0]; d[i+1] = c[1]; d[i+2] = c[2]; }
    ctx.putImageData(img, 0, 0); cv.feet = f.feet; cv.spr = spr;
    }
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
  // how far a strip of this stand can reach from the point it is placed at, from the sheet's own table (so that a
  // painter can pass over places that cannot touch its canvas without having the strips made first); null if unknown
  function crowdReach(spr, fam){
    const set = sheets[style] && sheets[style][spr]; const list = set && set.manifest && set.manifest.crowd && set.manifest.crowd.strips? set.manifest.crowd.strips.filter(x => x.fam===fam) : null; if (!list || !list.length) return null;
    let l = 0, t = 0, r = 0, b = 0; for (const q of list){ l = Math.max(l, q.ox); t = Math.max(t, q.oy); r = Math.max(r, q.w - q.ox); b = Math.max(b, q.h - q.oy); } return { l: l + 1, t: t + 1, r: r + 1, b: b + 1 };
  }
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

  MD.isoAssets = { MATS, load, register, has, get, crowdStrip, crowdReach, grass, standTexture, pieceTexture, pieceMask, maskAt, MASK_N, available, paletteFor, toneRGB,
    setStyle(s){ style = s; cache.clear(); texCache.clear(); }, getStyle(){ return style; },
    setCanvasFactory(f){ createCanvas = f; cache.clear(); texCache.clear(); scratch.clear(); }, cacheSize(){ return cache.size; }, built(){ return builtCount; }, prime, planeState, clear(){ cache.clear(); texCache.clear(); }, styleReady, isReady, expects };
})(typeof window!=='undefined'? window : globalThis);
