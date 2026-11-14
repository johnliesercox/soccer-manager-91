// ============================================================================
//  Matchday: IsometricRenderer (Phase 3)
//  The same renderer contract as the other three (create/mount/render/
//  resize/dispose, with a pure drawFrame for headless tests), drawing the
//  scene as a 2:1 dimetric pixel-art ground: iso-projection does the maths,
//  iso-pitch and iso-stadium paint the world once per camera scale into a
//  cached image, iso-camera decides the framing, iso-actors turns a scene
//  into depth-sorted sprites, and this file blits them in order with
//  shadows, the round ball, tags and the HUD overlays. It keeps animation
//  and camera state only; everything it shows comes from the scene it is
//  handed, so it can never invent a goal or move a player.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const C = MD.renderers.common;
  const ISO = MD.iso; const PR = ISO.projection; const DIM = PR.DIM; const SP = MD.isoSprites;
  const CAM_KEY = 'sm91-matchday-camera';
  const OUTSIDE = '#2B3036';            // the concourse beyond the painted ground
  const BALL7 = ['..111..', '.12221.', '1223221', '1232321', '1223221', '.12221.', '..111..'];
  const BALL9 = ['...111...', '..12221..', '.1222221.', '122232221', '123222321', '122232221', '.1222221.', '..12221..', '...111...'];
  const BALL_INK = { '1':'#111111', '2':'#FFFFFF', '3':'#3A3A3A' };

  // ---- the ground, painted in 256-pixel tiles on demand and kept in a small least-recently-used cache ----
  // A tile set belongs to one scale. Tiles are keyed in a grid fixed to the world origin, so a pan only
  // uncovers new tiles at the edge; a crowd-bounce variant is rendered only for tiles that hold spectators.
  const TILE = 256;
  function buildWorld(createCanvas, P, seed, colours){
    const tiles = new Map(); const MAX = P >= 16? 48 : 36;             // 12 MB on a desktop, 9 MB on a phone, at most
    function get(tx, ty, jump){
      const base = tx+':'+ty; const key = (jump? 'j' : 's') + base;
      let t = tiles.get(key); if (t){ tiles.delete(key); tiles.set(key, t); return t; }
      if (jump){ const still = tiles.get('s' + base); if (still && !still.crowd) return still; }
      const cv = createCanvas(TILE, TILE); const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = OUTSIDE; ctx.fillRect(0, 0, TILE, TILE);
      const crowd = ISO.stadium.drawGround(ctx, { P, ox: -tx*TILE, oy: -ty*TILE }, seed, jump, { x:0, y:0, w:TILE, h:TILE }, { colours });
      t = { cv, crowd };
      if (tiles.size >= MAX) tiles.delete(tiles.keys().next().value);
      tiles.set(key, t); return t;
    }
    return { P, TILE, get, size: () => tiles.size, max: MAX, dispose(){ tiles.clear(); } };
  }
  function drawWorld(ctx, w, h, cam, world, jump){
    const T = world.TILE; const tx0 = Math.floor(-cam.ox/T), tx1 = Math.floor((w - cam.ox)/T), ty0 = Math.floor(-cam.oy/T), ty1 = Math.floor((h - cam.oy)/T);
    for (let ty=ty0; ty<=ty1; ty++) for (let tx=tx0; tx<=tx1; tx++){ const t = world.get(tx, ty, jump); ctx.drawImage(t.cv, cam.ox + tx*T, cam.oy + ty*T); }
  }

  // ---- crisp helpers ----
  // the round ball: seven cells up to 14 px per metre, nine above, doubled on very large scales
  function drawBall(ctx, X, Y, P){
    const pat = P >= 14? BALL9 : BALL7, n = pat.length, s = P >= 26? 2 : 1, half = (n>>1)*s;
    const x0 = X - half, y0 = Y - half;
    for (const ch of ['1','2','3']){ ctx.fillStyle = BALL_INK[ch]; for (let r=0;r<n;r++){ const row = pat[r]; for (let c=0;c<n;c++) if (row[c]===ch) ctx.fillRect(x0 + c*s, y0 + r*s, s, s); } }
    return half;
  }
  function shadow(ctx, sx, sy, rx, ry, colour){ ctx.fillStyle = colour; for (let dy=-ry; dy<=ry; dy++){ const hw = Math.round(rx*Math.sqrt(Math.max(0, 1 - (dy/(ry+0.5))*(dy/(ry+0.5))))); if (hw>0) ctx.fillRect(sx - hw, sy + dy, 2*hw, 1); } }
  function ring(ctx, sx, sy, rx, ry, colour){ ctx.fillStyle = colour; for (let dy=-ry; dy<=ry; dy++){ const f = Math.sqrt(Math.max(0, 1 - (dy/(ry+0.5))*(dy/(ry+0.5)))); const hw = Math.round(rx*f); const inner = Math.round((rx-1.5)*f); if (hw>0){ ctx.fillRect(sx - hw, sy + dy, hw - inner, 1); ctx.fillRect(sx + inner, sy + dy, hw - inner, 1); } } }

  const textW = (c, t) => { const m = c.measureText && c.measureText(t); return (m && m.width) || t.length * 7; };   // tolerant of stub contexts
  function drawFrame(ctx, w, h, scene, info){
    const st = info.state; const dt = info.dtReal===undefined? 1/60 : info.dtReal; const now = info.nowMs||0;
    const snap = !!info.snap || (info.sinceCut!==undefined && info.sinceCut < 0.02);
    if (snap) st.anim = {};
    const mode = info.cameraMode||'follow';
    const cam = ISO.camera.update(st, scene, w, h, mode, dt, snap, info.followP);
    const teams = info.teams; const home = teams.home, away = teams.away;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = OUTSIDE; ctx.fillRect(0, 0, w, h);
    // the ground
    const crowdUp = !!(scene.flash && scene.flash.age < 2.4 && Math.floor(scene.flash.age*6)%2===0);
    const world = info.world && Math.abs(info.world.P - cam.P) < 1e-6? info.world : null;
    if (world) drawWorld(ctx, w, h, cam, world, crowdUp);
    else ISO.stadium.drawGround(ctx, cam, info.seed||1, crowdUp, null, { colours: [home.kit.primary, away.kit.primary] });
    // the scoring side's supporters rise (painted stands; the generated crowd under them still jumps in any hole)
    if (scene.crowd && !info.reducedMotion) ISO.stadium.drawCrowdReaction(ctx, cam, scene.crowd.teamId===home.id? 'home' : 'away', scene.crowd.age, scene.crowd.intensity, { x: 0, y: 0, w, h });
    // actors
    // sprites are generated at the camera's scale when following; the whole-pitch view keeps them readable
    const spr = cam.mode==='whole'? Math.max(7, Math.round(cam.P*1.5)) : Math.round(cam.P);
    const { items, shadows } = ISO.actors.build(scene, teams, st, now, cam, spr);
    const rx = Math.max(2, Math.round(spr*0.55)), ry = Math.max(1, Math.round(rx/2));
    for (const s of shadows){
      if (s.ball){ shadow(ctx, s.sx, s.sy, Math.max(1, Math.round(cam.P*0.25)), Math.max(1, Math.round(cam.P*0.12)), 'rgba(0,0,0,0.4)'); continue; }
      shadow(ctx, s.sx, s.sy, rx, ry, 'rgba(0,0,0,0.28)');
      if (s.ring && info.possessionRing!==false) ring(ctx, s.sx, s.sy, Math.round(rx*1.6), Math.max(2, Math.round(ry*1.6)), 'rgba(255,255,255,0.55)');
    }
    for (const it of items){
      if (it.kind==='goal'){ ISO.stadium.drawGoal(ctx, cam, it.end, it.part); continue; }
      if (it.kind==='ball'){
        const half = cam.P >= 14? (cam.P >= 26? 8 : 4) : 3;
        if (it.z > 0.15){ ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(it.sx - 1, it.sy + half, 2, Math.max(1, it.gsy - it.sy - half)); }   // a faint trail down to the shadow
        drawBall(ctx, it.sx, it.sy, cam.P); continue;
      }
      const sp = it.sprite; const bx = it.sx - (sp.width>>1), by = it.sy - sp.feet;
      ctx.drawImage(sp, bx, by);
      it.box = { x: bx, y: by, w: sp.width, h: sp.height };
    }
    // tags
    const font = px => `700 ${Math.round(px)}px "Courier New",Courier,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (X, Y, text, bg) => { const fs = 12; ctx.font = font(fs); const tw = textW(ctx, text) + 8; const th = fs + 4; ctx.fillStyle = bg||'rgba(0,0,0,0.75)'; ctx.fillRect(Math.round(X - tw/2), Math.round(Y - th - 2), Math.round(tw), th); ctx.fillStyle = '#FFFFFF'; ctx.fillText(text, X, Y - th/2 - 1); };
    const sel = info.selected && info.selected.until > now? items.find(x=>x.kind==='player' && x.pl.id===info.selected.id) : null;
    if (sel && sel.box){ tag(sel.sx, sel.box.y, sel.pl.name+' '+sel.pl.shirtNo, 'rgba(230,110,0,0.9)'); ctx.strokeStyle = '#FFD200'; ctx.lineWidth = 1; ctx.strokeRect(sel.box.x + 0.5, sel.box.y + 0.5, sel.box.w - 1, sel.box.h - 1); }
    // goal flash: a beat after the ball crosses the line, in the part of the view away from that goal
    if (scene.flash && scene.flash.type==='goal' && scene.flash.age > 0.35){
      const team = scene.flash.teamId===home.id? home : away;
      const age = scene.flash.age - 0.35; const a = Math.max(0, 1 - age/2.2);
      ctx.save(); ctx.globalAlpha = Math.min(1, a*1.6); ctx.lineJoin = 'round';
      const size = Math.min(w,h)*0.15; ctx.font = font(size); ctx.lineWidth = Math.max(3, size*0.12); ctx.strokeStyle = '#111'; ctx.fillStyle = team.kit.primary;
      const g = PR.project(scene.ball.x < 0.5? 0 : DIM.L, DIM.W/2, 0, cam);
      const cx = g.sx < w/2? w*0.68 : w*0.32, cy = g.sy < h/2? h*0.72 : h*0.28;
      ctx.strokeText('GOAL!', cx, cy); ctx.fillText('GOAL!', cx, cy);
      ctx.fillStyle = '#FFFFFF'; ctx.font = font(size*0.42); ctx.strokeText(team.short.toUpperCase(), cx, cy+size*0.75); ctx.fillText(team.short.toUpperCase(), cx, cy+size*0.75);
      ctx.restore();
    }
    if (info.sinceCut!==undefined && info.sinceCut < 0.3){ ctx.save(); ctx.globalAlpha = 1 - info.sinceCut/0.3; ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h); ctx.restore(); }
    if (info.fastForward){ ctx.save(); ctx.globalAlpha = 0.9; ctx.font = font(12); const label = '▶▶ NEXT HIGHLIGHT'; const bw = textW(ctx, label) + 16, bh = 20; ctx.fillStyle = '#111'; ctx.fillRect(Math.round(w/2 - bw/2), 6, Math.round(bw), bh); ctx.fillStyle = '#FFD200'; ctx.fillText(label, w/2, 6+bh/2+1); ctx.restore(); }
    return { cam, items };
  }

  // ---- the renderer object ----
  // the sheets are decoded once per page; a renderer mounted while that is still in flight repaints its tiles when it lands
  let assetLoadP = null;
  function assetLoad(url){ if (!assetLoadP){ assetLoadP = MD.isoAssets.load(url); assetLoadP.done = false; assetLoadP.then(() => { assetLoadP.done = true; }, () => { assetLoadP.done = true; }); } return assetLoadP; }
  function create(options){
    const opts = Object.assign({}, options||{});
    let container = null, canvas = null, ctx = null, teams = null, seed = 1, ro = null, lastW = 0, lastH = 0, lastTs = 0, lastFrame = null, lastScene = null, selected = null;
    const worlds = new Map();                                   // P -> world image (at most two: follow and whole)
    let cameraMode = opts.camera || (function(){ try { return root.localStorage.getItem(CAM_KEY) || 'close'; } catch(e){ return 'close'; } })();   // the close camera is the default (Phase 3 art direction)
    const state = { anim: {}, cx: undefined, cy: undefined };
    const nowMs = () => (root.performance && root.performance.now)? root.performance.now() : Date.now();
    const makeCanvas = (w, h) => { const c = root.document.createElement('canvas'); c.width = w; c.height = h; return c; };
    // pixels per metre when following: wider stages get bigger figures (a desktop shows 16, a phone 12)
    // pixels per metre: 'follow' shows more pitch (16 on a desktop, 12 on a phone), 'close' sits nearer the play (24 / 16)
    const followP = () => opts.followP || (cameraMode==='close'? (canvas && canvas.width >= 700? 24 : 16) : (canvas && canvas.width >= 700? 16 : ISO.camera.FOLLOW_P));
    function worldFor(P){
      let wld = worlds.get(P); if (wld) return wld;
      if (worlds.size >= 2){ const k = worlds.keys().next().value; worlds.get(k).dispose(); worlds.delete(k); }
      wld = buildWorld(makeCanvas, P, seed, [teams.home.kit.primary, teams.away.kit.primary]); worlds.set(P, wld); return wld;
    }
    function onTap(e){
      if (!lastFrame || !canvas) return;
      const rect = canvas.getBoundingClientRect(); const X = (e.clientX - rect.left) * (canvas.width/rect.width), Y = (e.clientY - rect.top) * (canvas.height/rect.height);
      // nearest-first: the last drawn sprite whose box holds the tap wins
      let best = null;
      for (let i=lastFrame.items.length-1; i>=0; i--){ const it = lastFrame.items[i]; if (it.kind!=='player' || !it.box) continue; if (X >= it.box.x && X <= it.box.x + it.box.w && Y >= it.box.y && Y <= it.box.y + it.box.h){ best = it.pl; break; } }
      if (best){ selected = { id: best.id, until: nowMs() + 3500 }; if (opts.onSelect) opts.onSelect(best); } else selected = null;
      if (lastScene) r.render(lastScene, r.lastHud||{});
    }
    const r = {
      id: 'isometric',
      mount(el, presentation){
        container = el; teams = presentation.teams; seed = presentation.seed;
        if (MD.isoAssets){ MD.isoAssets.setStyle(opts.style || 'B'); if (opts.style!=='none'){ const ld = assetLoad(opts.assetUrl); if (!ld.done) ld.then(() => { if (!canvas) return; for (const wld of worlds.values()) wld.dispose(); worlds.clear(); SP.clear(); if (lastScene) r.render(lastScene, r.lastHud||{}); }); } }
        canvas = root.document.createElement('canvas'); canvas.className = 'md-canvas';
        canvas.setAttribute('role','img'); canvas.setAttribute('aria-label', presentation.teams.home.name+' v '+presentation.teams.away.name+', isometric match view');
        canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.imageRendering = 'pixelated'; canvas.style.touchAction = 'manipulation';
        container.appendChild(canvas); ctx = canvas.getContext('2d');
        canvas.addEventListener('click', onTap);
        r.resize();
        if (root.ResizeObserver){ ro = new root.ResizeObserver(()=>r.resize()); ro.observe(container); }
      },
      resize(){
        if (!container || !canvas) return;
        const cw = Math.max(1, container.clientWidth), ch = Math.max(1, container.clientHeight);
        if (cw===lastW && ch===lastH) return;
        lastW = cw; lastH = ch; canvas.width = cw; canvas.height = ch; state.cx = undefined;
        for (const wld of worlds.values()) wld.dispose(); worlds.clear();   // the whole-pitch scale depends on the stage size
      },
      render(scene, hud){
        if (!ctx) return;
        const ts = nowMs(); const dt = lastTs? Math.min(0.1, (ts - lastTs)/1000) : 1/60; lastTs = ts;
        r.lastHud = hud; lastScene = scene;
        const P = cameraMode==='whole'? PR.fit(canvas.width, canvas.height, DIM.runoff + 1.5).P : followP();
        const world = worldFor(P);
        lastFrame = drawFrame(ctx, canvas.width, canvas.height, scene, { teams, seed, world, state, dtReal: dt, nowMs: ts, cameraMode, selected, followP: followP(), fastForward: !!(hud && hud.fastForward), sinceCut: hud? hud.sinceCut : undefined, snap: !!(hud && hud.reducedMotion), reducedMotion: !!(hud && hud.reducedMotion) });
      },
      cameraModes: ['follow', 'close', 'whole'],
      setCamera(mode){ cameraMode = mode==='whole'? 'whole' : mode==='close'? 'close' : 'follow'; try { root.localStorage.setItem(CAM_KEY, cameraMode); } catch(e){} state.cx = undefined; if (lastScene) r.render(lastScene, r.lastHud||{}); return cameraMode; },
      getCamera(){ return cameraMode; },
      lastFrame(){ return lastFrame; },   // the camera and the drawn items of the last frame (for tools and tests)
      dispose(){ if (ro){ ro.disconnect(); ro = null; } if (canvas){ canvas.removeEventListener('click', onTap); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); } for (const wld of worlds.values()) wld.dispose(); worlds.clear(); SP.clear(); canvas = ctx = container = lastFrame = lastScene = null; state.anim = {}; },
    };
    return r;
  }
  MD.renderers.isometric = { id:'isometric', name:'Isometric', short:'Iso', create, drawFrame, buildWorld, drawWorld, TILE };
  // the two visual directions and the procedural art, selectable as views while the look is being chosen
  MD.renderers['isometric-a'] = { id:'isometric-a', name:'Iso A', short:'Iso A', create: o => Object.assign(create(Object.assign({ style:'A' }, o||{})), { id:'isometric-a' }), drawFrame };
  MD.renderers['isometric-proc'] = { id:'isometric-proc', name:'Iso M2', short:'Iso M2', create: o => Object.assign(create(Object.assign({ style:'none' }, o||{})), { id:'isometric-proc' }), drawFrame };
})(typeof window!=='undefined'? window : globalThis);
