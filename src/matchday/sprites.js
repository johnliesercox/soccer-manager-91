// ============================================================================
//  Matchday: pixel sprites
//  A tiny "paper doll" rasteriser that draws every player sprite in code:
//  no image files to download, nothing to license, and kits are a palette
//  swap. Each sprite is a 24 x 24 cell with the feet on row 22; the figure
//  is drawn as a list of coloured rectangles (palette indexes), then given a
//  one-pixel outline, then coloured for a kit and a skin/hair variant and
//  cached as a small canvas.
//
//  Facings: 'down' (towards the viewer), 'up', 'right', 'left' (a mirror of
//  right). Poses: idle, run (4 frames), kick, shoot, slide, dive, celebrate
//  (2 frames), booked, point, card, whistle. A renderer asks for
//  Matchday.sprites.get(kit, variant, facing, pose, frame) and blits the
//  returned canvas with image smoothing off.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const W = 24, H = 24, FEET = 22;
  // palette indexes
  const T = 0, SKIN = 1, HAIR = 2, SHIRT = 3, TRIM = 4, SHORTS = 5, SOCKS = 6, BOOTS = 7, EYE = 8, LINE = 9, CARDY = 10, CARDR = 11, BALL = 12;
  const SKINS = ['#F2C9A0', '#D9A066', '#8D5524', '#5C3A1E'];
  const HAIRS = ['#1C1C1C', '#5A3A1C', '#B8862B', '#C2552B', '#8B8B8B'];

  // ---- figure drawing: ops are [colour, x, y, w, h] in cell pixels ----
  function body(facing, pose, frame){
    const ops = [];
    const R = (c,x,y,w,h) => ops.push([c,x,y,w,h]);
    const side = facing==='right' || facing==='left';
    let bob = 0;   // vertical body offset (jumps, run bounce)
    // legs: returns a function drawing socks+boots for a leg at x with a lift
    const leg = (x, lift, w) => { w = w||2; R(SOCKS, x, 19-lift, w, 3); R(BOOTS, x, 22-lift, w, 1); };
    if (pose==='slide' || pose==='dive'){
      // horizontal figure facing right (mirrored later for left): head at the front
      const lift = pose==='dive'? 6 : 0;
      const y = 22 - lift;
      R(SOCKS, 1, y-4, 5, 3); R(BOOTS, 0, y-4, 1, 3);            // trailing legs
      R(SHORTS, 6, y-5, 4, 4);
      R(SHIRT, 10, y-6, 7, 5); R(TRIM, 10, y-6, 1, 5);            // torso with a collar stripe at the back
      R(HAIR, 17, y-8, 5, 3); R(SKIN, 17, y-6, 5, 4); R(EYE, 21, y-5, 1, 1);
      if (pose==='dive'){ R(SKIN, 22, y-3, 2, 2); R(SHIRT, 17, y-2, 5, 2); R(SKIN, 22, y-2, 2, 1); }   // arms stretched
      else { R(SHIRT, 12, y-9, 2, 3); R(SKIN, 12, y-11, 2, 2); }   // one arm up for balance
      return { ops, bob:0 };
    }
    // run bounce: the body lifts a pixel on the passing frames
    if (pose==='run') bob = (frame%2)? 1 : 0;
    if (pose==='celebrate') bob = frame? 2 : 0;
    if (pose==='set') bob = -2;                              // a crouch: the body sits lower
    const y0 = -bob;
    // ---- legs ----
    if (pose==='run'){
      const f = frame%4;
      if (!side){
        // facing the camera: alternate lifted leg
        const lifts = [[1,0],[0,0],[0,1],[0,0]][f];
        leg(9, lifts[0]); leg(13, lifts[1]);
      } else {
        // side on: stride front/back
        const stride = [[2,-2],[1,-1],[-1,2],[0,0]][f];
        leg(12+stride[0], f===0||f===2? 1 : 0); leg(10+stride[1], 0);
      }
    } else if (pose==='kick' || pose==='shoot'){
      const big = pose==='shoot';
      leg(9, 0);                                             // standing leg
      R(SOCKS, 12, 18, 2, 2); R(SOCKS, 14, 17-(big?1:0), 2, 2); R(SOCKS, 16, 16-(big?2:0), 2, 1); R(BOOTS, 17, 15-(big?2:0), 2, 1);   // swinging leg
    } else if (pose==='celebrate' && frame){
      leg(8, 0); leg(14, 0);                                 // legs apart in the jump
    } else if (pose==='receive'){
      if (side){ leg(9, 0); R(SOCKS, 13, 18, 2, 2); R(SOCKS, 15, 17, 2, 2); R(BOOTS, 16, 16, 2, 1); }   // front foot raised to trap the ball
      else { leg(9, 0); R(SOCKS, 13, 18, 2, 2); R(BOOTS, 13, 20, 2, 1); R(SOCKS, 14, 16, 2, 2); }
    } else if (pose==='block' || pose==='set'){
      leg(7, 0); leg(15, 0);                                 // feet planted wide
    } else if (side){
      leg(10, 0); leg(12, 0, 2);
    } else { leg(9, 0); leg(13, 0); }
    // ---- shorts ----
    if (side) R(SHORTS, 9, 16+y0, 6, 3); else R(SHORTS, 8, 16+y0, 8, 3);
    // ---- torso ----
    if (side){ R(SHIRT, 9, 10+y0, 6, 6); R(TRIM, 9, 10+y0, 1, 6); }
    else { R(SHIRT, 8, 10+y0, 8, 6); R(TRIM, 11, 10+y0, 2, 1); }
    // ---- arms ----
    const armDown = (x, swing) => { R(SHIRT, x, 10+y0+swing, 2, 3); R(TRIM, x, 12+y0+swing, 2, 1); R(SKIN, x, 13+y0+swing, 2, 3); };
    if (pose==='celebrate'){
      for (const x of [6,16]){ R(SHIRT, x, 8+y0, 2, 3); R(TRIM, x, 8+y0, 2, 1); R(SKIN, x, 3+y0, 2, 5); }
    } else if (pose==='block'){
      R(SHIRT, 4, 9+y0, 4, 2); R(SKIN, 2, 8+y0, 3, 2); R(SHIRT, 16, 9+y0, 4, 2); R(SKIN, 19, 8+y0, 3, 2);   // arms spread to block
    } else if (pose==='set'){
      R(SHIRT, 5, 12+y0, 3, 2); R(SKIN, 3, 13+y0, 3, 2); R(SHIRT, 16, 12+y0, 3, 2); R(SKIN, 18, 13+y0, 3, 2);   // keeper: arms out low, ready
    } else if (pose==='receive' && !side){
      R(SHIRT, 5, 10+y0, 2, 3); R(SKIN, 4, 13+y0, 2, 2); R(SHIRT, 17, 10+y0, 2, 3); R(SKIN, 18, 13+y0, 2, 2);   // arms out for balance
    } else if (pose==='booked'){
      for (const [x,hx] of [[6,8],[16,15]]){ R(SHIRT, x, 10+y0, 2, 2); R(SKIN, x, 12+y0, 2, 2); R(SKIN, hx, 14+y0, 1, 1); }
    } else if (pose==='card'){
      armDown(6, 0); R(SHIRT, 16, 8+y0, 2, 3); R(SKIN, 16, 4+y0, 2, 4); R(frame? CARDR : CARDY, 15, 0+y0, 3, 4);
    } else if (pose==='whistle'){
      armDown(6, 0); R(SHIRT, 16, 10+y0, 2, 2); R(SKIN, 14, 8+y0, 2, 2); R(SKIN, 16, 9+y0, 1, 2);
    } else if (pose==='point' && side){
      R(SHIRT, 13, 11+y0, 2, 2); R(SKIN, 15, 11+y0, 5, 2);
    } else if (pose==='run' && !side){
      const f = frame%4; const sw = [1,0,-1,0][f];
      armDown(6, sw); armDown(16, -sw);
    } else if (side){
      // the near arm, over the torso; swings when running or kicking
      const sw = pose==='run'? [2,0,-2,0][frame%4] : pose==='kick'||pose==='shoot'? -2 : 0;
      R(SHIRT, 13+sw/2, 10+y0, 2, 3); R(SKIN, 13+sw/2, 13+y0, 2, 3);
      if (pose==='kick'||pose==='shoot') R(SKIN, 7, 12+y0, 2, 2);   // the far arm out behind for balance
    } else { armDown(6, 0); armDown(16, 0); }
    // ---- head ----
    const lean = (pose==='kick'||pose==='shoot')? (facing==='right'? -1 : 0) : 0;
    if (facing==='down'){
      R(SKIN, 9, 3+y0, 6, 6); R(HAIR, 9, 2+y0, 6, 2); R(HAIR, 9, 4+y0, 1, 2); R(HAIR, 14, 4+y0, 1, 2);
      R(EYE, 10, 6+y0, 1, 1); R(EYE, 13, 6+y0, 1, 1);
    } else if (facing==='up'){
      R(SKIN, 9, 3+y0, 6, 6); R(HAIR, 9, 2+y0, 6, 5);
    } else {
      R(SKIN, 10+lean, 3+y0, 5, 6); R(HAIR, 9+lean, 2+y0, 5, 2); R(HAIR, 9+lean, 4+y0, 2, 4); R(EYE, 13+lean, 6+y0, 1, 1);
    }
    R(SKIN, 11, 9+y0, 2, 1);   // neck
    return { ops, bob };
  }

  // rasterise ops into a palette-index grid, add a 1px outline, mirror for 'left'
  function grid(facing, pose, frame){
    const g = new Uint8Array(W*H);
    const { ops } = body(facing==='left'? 'right' : facing, pose, frame);
    for (const [c,x,y,w,h] of ops) for (let yy=y; yy<y+h; yy++) for (let xx=x; xx<x+w; xx++) if (xx>=0 && xx<W && yy>=0 && yy<H) g[yy*W+xx] = c;
    const out = new Uint8Array(g);
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){
      if (g[y*W+x]) continue;
      const n = (x>0 && g[y*W+x-1]) || (x<W-1 && g[y*W+x+1]) || (y>0 && g[(y-1)*W+x]) || (y<H-1 && g[(y+1)*W+x]);
      if (n) out[y*W+x] = LINE;
    }
    if (facing==='left'){ const m = new Uint8Array(W*H); for (let y=0;y<H;y++) for (let x=0;x<W;x++) m[y*W+(W-1-x)] = out[y*W+x]; return m; }
    return out;
  }
  const gridCache = {};
  function gridFor(facing, pose, frame){ const k = facing+'|'+pose+'|'+frame; return gridCache[k] || (gridCache[k] = grid(facing, pose, frame)); }

  // ---- colouring and caching ----
  let createCanvas = (w,h) => { const c = root.document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const cache = new Map();
  function hex(c){ if (c[0]==='#') return c; const m = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(c); if (!m) return '#808080'; const h=+m[1]/360, s=+m[2]/100, l=+m[3]/100; const f=(n)=>{ const k=(n+h*12)%12; const a=s*Math.min(l,1-l); return Math.round(255*(l - a*Math.max(-1, Math.min(k-3, 9-k, 1)))); }; return '#'+[f(0),f(8),f(4)].map(v=>v.toString(16).padStart(2,'0')).join(''); }
  function rgb(c){ c = hex(c); return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]; }
  function paletteFor(kit, variant){
    const shirt = hex(kit.primary), trim = hex(kit.secondary);
    const lum = c => { const v = rgb(c); return (0.299*v[0]+0.587*v[1]+0.114*v[2])/255; };
    // shorts: the kit's second colour unless it is the shirt colour, socks match the shirt
    let shorts = trim; if (Math.abs(lum(shorts)-lum(shirt))<0.12) shorts = lum(shirt)>0.5? '#1F2A44' : '#F2F2F2';
    const line = lum(shirt)>0.8? '#2A2A2A' : '#101010';
    return [null, SKINS[variant.skin%SKINS.length], HAIRS[variant.hair%HAIRS.length], shirt, trim, shorts, shirt, '#161616', '#1A1A1A', line, '#F7D117', '#D81E1E', '#FFFFFF'];
  }
  // kit: { primary, secondary }  variant: { skin, hair }
  function get(kit, variant, facing, pose, frame){
    frame = frame||0;
    const key = kit.primary+'|'+kit.secondary+'|'+variant.skin+'|'+variant.hair+'|'+facing+'|'+pose+'|'+frame;
    let cv = cache.get(key); if (cv) return cv;
    const g = gridFor(facing, pose, frame);
    const pal = paletteFor(kit, variant);
    cv = createCanvas(W, H);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData? ctx.createImageData(W, H) : null;
    if (img && img.data){
      const d = img.data;
      for (let i=0;i<W*H;i++){ const c = g[i]; if (!c) continue; const [r,gg,b] = rgb(pal[c]); d[i*4] = r; d[i*4+1] = gg; d[i*4+2] = b; d[i*4+3] = 255; }
      ctx.putImageData(img, 0, 0);
    } else {   // a context without ImageData (test stubs): one rect per pixel
      for (let i=0;i<W*H;i++){ const c = g[i]; if (!c) continue; ctx.fillStyle = hex(pal[c]); ctx.fillRect(i%W, Math.floor(i/W), 1, 1); }
    }
    cache.set(key, cv);
    return cv;
  }
  // a deterministic look per player id
  function variantFor(id){ const h = MD.hashString('v'+id); return { skin: h%SKINS.length, hair: (h>>>3)%HAIRS.length }; }
  const REF_KIT = { primary:'#1A1A1A', secondary:'#F2F2F2' };

  MD.sprites = { W, H, FEET, get, gridFor, variantFor, REF_KIT, SKINS, HAIRS, body, setCanvasFactory(f){ createCanvas = f; cache.clear(); }, cacheSize(){ return cache.size; },
    POSES: ['idle','run','kick','shoot','slide','dive','celebrate','booked','point','card','whistle','receive','block','set'], FACINGS: ['down','up','right','left'] };
})(typeof window!=='undefined'? window : globalThis);
