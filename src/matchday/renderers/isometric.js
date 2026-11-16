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
    const tiles = new Map(); const MAX = P >= 16? 40 : 30;             // 10 MB on a desktop, 7.5 MB on a phone, at most (two scales may be live)
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

  // Which player a tap means. Every figure whose drawn box is within `slop` pixels of the tap is a candidate, and the one
  // whose body is nearest the tap wins (the body sits a little below the middle of its box, above the feet), so of two
  // overlapping figures it is the one tapped on, not simply the one in front; in a dead heat the nearer figure (drawn
  // later) wins. A fingertip gets a wider slop than a mouse pointer.
  const TOUCH_SLOP = 14, POINTER_SLOP = 4;
  function pick(items, X, Y, slop){
    let best = null, bestD = Infinity; slop = slop || 0;
    for (let i=items.length-1; i>=0; i--){
      const it = items[i]; if (it.kind!=='player' || !it.box) continue; const b = it.box;
      const dx = Math.max(b.x - X, 0, X - (b.x + b.w)), dy = Math.max(b.y - Y, 0, Y - (b.y + b.h)); if (Math.hypot(dx, dy) > slop) continue;
      const d = Math.hypot(X - (b.x + b.w/2), Y - (b.y + b.h*0.6)); if (d < bestD - 0.5){ bestD = d; best = it; }
    }
    return best? best.pl : null;
  }

  const textW = (c, t) => { const m = c.measureText && c.measureText(t); return (m && m.width) || t.length * 7; };   // tolerant of stub contexts
  function drawFrame(ctx, w, h, scene, info){
    const st = info.state; const dt = info.dtReal===undefined? 1/60 : info.dtReal; const now = info.nowMs||0;
    const snap = !!info.snap || (info.sinceCut!==undefined && info.sinceCut < 0.02);
    if (snap) st.anim = {};
    const mode = info.cameraMode||'follow';
    const cam = ISO.camera.update(st, scene, w, h, mode, dt, snap, info.followP);
    // a cut inside a highlight (the restart after a goal, the cut to the scorer) dips through black like the cut into one
    if (st.snapped && (st.cutKind==='scene' || st.cutKind==='celebration') && !info.reducedMotion && !info.still) st.dipAt = now;
    const teams = info.teams; const home = teams.home, away = teams.away;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = OUTSIDE; ctx.fillRect(0, 0, w, h);
    // the ground
    // the generated crowd (the near terrace and any gap in the painted stands) jumps: fast through the goal flash, then
    // on the beat through the first five seconds of the celebration
    const crowdUp = !info.reducedMotion && !!((scene.flash && scene.flash.age < 2.4 && Math.floor(scene.flash.age*6)%2===0) || (scene.crowd && scene.crowd.age >= 2.4 && scene.crowd.age < 5 && Math.floor(scene.crowd.age*5)%2===0));
    const world = info.world && Math.abs(info.world.P - cam.P) < 1e-6? info.world : null;
    if (world) drawWorld(ctx, w, h, cam, world, crowdUp);
    else ISO.stadium.drawGround(ctx, cam, info.seed||1, crowdUp, null, { colours: [home.kit.primary, away.kit.primary] });
    // the goals' shadows lie on the grass under everything that stands on it (a modelled piece; styles without one draw none)
    for (const end of [0, 1]) ISO.stadium.placedPiece(ctx, cam, 'goal'+end+'s');
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
      if (it.kind==='goal'){ ISO.stadium.drawGoal(ctx, cam, it.end, it.part, ISO.stadium.netState(scene, it.end)); continue; }
      if (it.kind==='pylon'){ ISO.stadium.drawPylon(ctx, cam, it.X, it.Y); continue; }
      if (it.kind==='ball'){
        const half = cam.P >= 14? (cam.P >= 26? 8 : 4) : 3;
        if (it.z > 0.15){ ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(it.sx - 1, it.sy + half, 2, Math.max(1, it.gsy - it.sy - half)); }   // a faint trail down to the shadow
        drawBall(ctx, it.sx, it.sy, cam.P); continue;
      }
      const sp = it.sprite; const bx = it.sx - (sp.width>>1), by = it.sy - sp.feet;
      ctx.drawImage(sp, bx, by);
      it.box = { x: bx, y: by, w: sp.width, h: sp.height };
    }
    // a flash of contact: a header or volley struck, a catch, a parry, a block, the woodwork (two frames of a small burst,
    // then a fading ring), so the moment reads at gameplay scale
    if (scene.contact && scene.contact.age < 0.3 && !info.reducedMotion){
      const c = scene.contact; const m = PR.toMetres(c.x, c.y); const pt = PR.project(m.X, m.Y, Math.max(0, c.z||0)*PR.BALL_Z_M, cam);
      const r = Math.max(4, cam.P*0.45); const u = c.age/0.3;
      ctx.save(); ctx.translate(Math.round(pt.sx), Math.round(pt.sy)); ctx.strokeStyle = 'rgba(255,255,255,'+(0.95*(1-u)).toFixed(2)+')'; ctx.lineWidth = Math.max(1, Math.round(cam.P/14));
      if (c.age < 0.14){ ctx.beginPath(); for (let i=0;i<4;i++){ const a = i*Math.PI/2 + Math.PI/4; ctx.moveTo(Math.cos(a)*r*0.35, Math.sin(a)*r*0.35); ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, r*(0.5 + 0.9*u), 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }
    // the card: a plain yellow or red rectangle held up above the referee, big enough to be read on a phone
    if (scene.ref && (scene.ref.signal==='yellow' || scene.ref.signal==='red')){
      const it = items.find(x=>x.kind==='ref');
      if (it && it.box){ const w = Math.max(4, Math.round(cam.P*0.32)), h = Math.max(5, Math.round(cam.P*0.46)); const x = it.sx + Math.round(cam.P*0.22), y = it.box.y - h + Math.round(cam.P*0.2);
        ctx.fillStyle = '#141414'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = scene.ref.signal==='red'? '#e0261c' : '#f5d327'; ctx.fillRect(x, y, w, h); }
    }
    // tags
    const font = px => `700 ${Math.round(px)}px "Courier New",Courier,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (X, Y, text, bg, below) => { const fs = 12; ctx.font = font(fs); const tw = textW(ctx, text) + 8; const th = fs + 4;
      X = Math.max(tw/2 + 2, Math.min(w - tw/2 - 2, X)); if (Y - th - 2 < 2 && below!==undefined) Y = below + th + 4;   // kept inside the picture: slid along at an edge, hung under a figure at the top
      ctx.fillStyle = bg||'rgba(0,0,0,0.75)'; ctx.fillRect(Math.round(X - tw/2), Math.round(Y - th - 2), Math.round(tw), th); ctx.fillStyle = '#FFFFFF'; ctx.fillText(text, X, Y - th/2 - 1); };
    const sel = info.selected && info.selected.until > now? items.find(x=>x.kind==='player' && x.pl.id===info.selected.id) : null;
    if (sel && sel.box){ tag(sel.sx, sel.box.y, sel.pl.shirtNo+' '+sel.pl.name+(sel.pl.role? ' '+sel.pl.role : ''), 'rgba(230,110,0,0.9)', sel.box.y + sel.box.h); ctx.strokeStyle = '#FFD200'; ctx.lineWidth = 1; ctx.strokeRect(sel.box.x + 0.5, sel.box.y + 0.5, sel.box.w - 1, sel.box.h - 1); }
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
    const dip = st.dipAt!==undefined? (now - st.dipAt)/1000 : 9;
    const fadeIn = info.still? 1 : Math.min(info.sinceCut!==undefined? info.sinceCut/0.3 : 1, dip/0.25);   // a still frame (nothing is playing) is drawn complete
    if (fadeIn < 1){ ctx.save(); ctx.globalAlpha = 1 - Math.max(0, fadeIn); ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h); ctx.restore(); }
    if (info.fastForward){ ctx.save(); ctx.globalAlpha = 0.9; ctx.font = font(12); const label = '▶▶ NEXT HIGHLIGHT'; const bw = textW(ctx, label) + 16, bh = 20; ctx.fillStyle = '#111'; ctx.fillRect(Math.round(w/2 - bw/2), 6, Math.round(bw), bh); ctx.fillStyle = '#FFD200'; ctx.fillText(label, w/2, 6+bh/2+1); ctx.restore(); }
    return { cam, items, fading: fadeIn < 1 };
  }

  // ---- the renderer object ----
  // the sheets are decoded once per page; a renderer mounted while that is still in flight repaints its tiles when it lands
  let assetLoadP = null;
  function holdingFrame(ctx, w, h){
    ctx.fillStyle = OUTSIDE; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '700 13px "Courier New",Courier,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Preparing the ground...', Math.round(w/2), Math.round(h/2)); ctx.restore();
  }
  function assetLoad(url){ if (!assetLoadP){ assetLoadP = MD.isoAssets.load(url); assetLoadP.done = false; assetLoadP.then(() => { assetLoadP.done = true; }, () => { assetLoadP.done = true; }); } return assetLoadP; }
  function create(options){
    const opts = Object.assign({}, options||{});
    if (!opts.style && MD.isoDefaultStyle) opts.style = MD.isoDefaultStyle;   // a build may name the style the plain Iso view draws with (ISO_DEFAULT in build.py)
    let container = null, canvas = null, ctx = null, teams = null, seed = 1, ro = null, lastW = 0, lastH = 0, lastTs = 0, lastFrame = null, lastScene = null, selected = null, loopTs = -1e9, settle = 0;
    const worlds = new Map();                                   // P -> world image (at most two: follow and whole)
    let cameraMode = opts.camera || (function(){ try { return root.localStorage.getItem(CAM_KEY) || 'close'; } catch(e){ return 'close'; } })();   // the close camera is the default (Phase 3 art direction)
    const state = { anim: {}, cx: undefined, cy: undefined };
    const nowMs = () => (root.performance && root.performance.now)? root.performance.now() : Date.now();
    const makeCanvas = (w, h) => { const c = root.document.createElement('canvas'); c.width = w; c.height = h; return c; };
    // pixels per metre when following: wider stages get bigger figures (a desktop shows 16, a phone 12)
    // pixels per metre: 'follow' shows more pitch (16 on a desktop, 12 on a phone); 'close' sits nearer the play (24 / 16)
    // and drops to the wider scale for a highlight that needs it (chosen by the camera at the cut)
    const wideP = () => (canvas && canvas.width >= 700? 16 : ISO.camera.FOLLOW_P), closeP = () => (canvas && canvas.width >= 700? 24 : 16);
    const followP = (scene, hud) => {
      if (opts.followP) return opts.followP;
      if (cameraMode!=='close') return wideP();
      const snapNow = !!(hud && ((hud.sinceCut!==undefined && hud.sinceCut < 0.02) || hud.reducedMotion));
      return scene? ISO.camera.chooseP(state, scene, hud && hud.segment, canvas.width, canvas.height, closeP(), wideP(), snapNow) : closeP();
    };
    function worldFor(P){
      let wld = worlds.get(P); if (wld) return wld;
      if (worlds.size >= 2){ const k = worlds.keys().next().value; worlds.get(k).dispose(); worlds.delete(k); }
      wld = buildWorld(makeCanvas, P, seed, [teams.home.kit.primary, teams.away.kit.primary]); worlds.set(P, wld); return wld;
    }
    // Frames normally come from the playback loop. When nothing is playing (paused, full time) the picture still has to be
    // put right after a tap, a turn of the phone, a camera change or a cut that left it mid-fade: a still frame draws the
    // stored scene complete, without moving the camera on and without a fade.
    const playing = () => nowMs() - loopTs < 300;
    function still(){
      if (!ctx || !lastScene || !r.isReady()) return;
      const hud = r.lastHud || {}; const P = cameraMode==='whole'? PR.fit(canvas.width, canvas.height, DIM.runoff + 1.5).P : followP(lastScene, hud);
      lastFrame = drawFrame(ctx, canvas.width, canvas.height, lastScene, { teams, seed, world: worldFor(P), state, dtReal: 0, nowMs: nowMs(), cameraMode, selected, followP: P, fastForward: !!hud.fastForward, still: true, snap: !!hud.reducedMotion, reducedMotion: !!hud.reducedMotion });
    }
    const redraw = () => { if (!lastScene) return; if (playing()){ const t = loopTs; r.render(lastScene, r.lastHud||{}); loopTs = t; } else still(); };   // a redraw of its own is not a frame from the loop
    function onTap(e){
      if (!lastFrame || !canvas) return;
      const rect = canvas.getBoundingClientRect(); const k = canvas.width/rect.width; const X = (e.clientX - rect.left) * k, Y = (e.clientY - rect.top) * (canvas.height/rect.height);
      const finger = e.pointerType? (e.pointerType==='touch' || e.pointerType==='pen') : !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
      const best = pick(lastFrame.items, X, Y, (finger? TOUCH_SLOP : POINTER_SLOP) * k);
      if (best){ selected = { id: best.id, until: nowMs() + 3500 }; if (opts.onSelect) opts.onSelect(best); } else selected = null;
      // the tag appears with the loop's next frame; if the loop has just stopped (a tap straight after Pause) no frame is
      // coming, so the still frame is drawn once that is certain, and the camera is never stepped on by a tap
      if (!playing()) still();
      else if (root.setTimeout){ if (settle) root.clearTimeout(settle); settle = root.setTimeout(() => { settle = 0; if (!playing()) still(); }, 350); }
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
        redraw();   // sizing a canvas clears it: the picture is drawn again at once, playing or not (a phone turned while paused)
      },
      // the painted art of the style is still decoding: nothing generated is shown in its place, a plain holding frame
      // is drawn instead (the match screen waits for ready() before it starts the clock, so nothing is missed)
      ready(){ if (!MD.isoAssets || opts.style==='none' || !MD.isoAssets.expects(opts.style || 'B')) return Promise.resolve(); assetLoad(opts.assetUrl); return MD.isoAssets.styleReady(opts.style || 'B'); },
      isReady(){ return !MD.isoAssets || opts.style==='none' || MD.isoAssets.isReady(opts.style || 'B'); },
      render(scene, hud){
        if (!ctx) return;
        if (!r.isReady()){ holdingFrame(ctx, canvas.width, canvas.height); r.lastHud = hud; lastScene = scene; return; }
        const ts = nowMs(); const dt = lastTs? Math.min(0.1, (ts - lastTs)/1000) : 1/60; lastTs = ts;
        r.lastHud = hud; lastScene = scene; if (hud && hud.sinceCut!==undefined) loopTs = ts;   // the playback loop always says how long since the cut
        const P = cameraMode==='whole'? PR.fit(canvas.width, canvas.height, DIM.runoff + 1.5).P : followP(scene, hud);
        const world = worldFor(P);
        lastFrame = drawFrame(ctx, canvas.width, canvas.height, scene, { teams, seed, world, state, dtReal: dt, nowMs: ts, cameraMode, selected, followP: P, fastForward: !!(hud && hud.fastForward), sinceCut: hud? hud.sinceCut : undefined, snap: !!(hud && hud.reducedMotion), reducedMotion: !!(hud && hud.reducedMotion) });
        // a frame drawn part-way through a fade is completed even if no frame follows it (Skip ends the match on a cut)
        if (settle){ root.clearTimeout(settle); settle = 0; }
        if (lastFrame.fading && root.setTimeout) settle = root.setTimeout(() => { settle = 0; if (!playing()) still(); }, 350);
      },
      cameraModes: ['follow', 'close', 'whole'],
      setCamera(mode){ cameraMode = mode==='whole'? 'whole' : mode==='close'? 'close' : 'follow'; try { root.localStorage.setItem(CAM_KEY, cameraMode); } catch(e){} state.cx = undefined; redraw(); return cameraMode; },
      getCamera(){ return cameraMode; },
      debugItems(){ return (lastFrame && lastFrame.items)? lastFrame.items.map(it => ({ kind: it.kind, id: it.pl? it.pl.id : it.key, box: it.box||null, sx: it.sx, sy: it.sy })) : []; },   // for tooling: what was drawn where
      lastFrame(){ return lastFrame; },   // the camera and the drawn items of the last frame (for tools and tests)
      dispose(){ if (settle){ root.clearTimeout(settle); settle = 0; } if (ro){ ro.disconnect(); ro = null; } if (canvas){ canvas.removeEventListener('click', onTap); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); } for (const wld of worlds.values()) wld.dispose(); worlds.clear(); SP.clear(); canvas = ctx = container = lastFrame = lastScene = null; state.anim = {}; },
    };
    return r;
  }
  MD.renderers.isometric = { id:'isometric', name:'Isometric', short:'Iso', create, drawFrame, buildWorld, drawWorld, TILE, pick, TOUCH_SLOP, POINTER_SLOP, preload(url){ return MD.isoAssets? assetLoad(url) : Promise.resolve(); } };   // preload: decode the sheets while the player is still in the menus
  // the two visual directions and the procedural art, selectable as views while the look is being chosen
  MD.renderers['isometric-a'] = { id:'isometric-a', name:'Iso A', short:'Iso A', create: o => Object.assign(create(Object.assign({ style:'A' }, o||{})), { id:'isometric-a' }), drawFrame };
  MD.renderers['isometric-proc'] = { id:'isometric-proc', name:'Iso M2', short:'Iso M2', create: o => Object.assign(create(Object.assign({ style:'none' }, o||{})), { id:'isometric-proc' }), drawFrame };
  // the visual R&D styles (tools/visual-rnd): C = Option A (enhanced Floyo), D = Option B (Blender direct), E = Option E
  // (Blender geometry painted through Floyo, the production set), F = an R&D variant. Each is shown only when the build
  // inlines the style, and only under ?dev or in a review build (ISO_DEFAULT) where the plain Iso view draws the default
  for (const [st, nm] of [['C', 'Iso C'], ['D', 'Iso D'], ['E', 'Iso E'], ['F', 'Iso F']]) MD.renderers['isometric-'+st.toLowerCase()] = { id:'isometric-'+st.toLowerCase(), name:nm, short:nm, create: o => Object.assign(create(Object.assign({ style:st }, o||{})), { id:'isometric-'+st.toLowerCase() }), drawFrame };
})(typeof window!=='undefined'? window : globalThis);
