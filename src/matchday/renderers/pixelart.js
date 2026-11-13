// ============================================================================
//  Matchday: PixelArtRenderer (Phase 2)
//  The same renderer contract as canvas2d.js, drawn with the pixel sprites
//  from sprites.js: a stadium with stands and a crowd, a pitch, 22 directional
//  animated players, a referee, a ball that lifts with height, and a camera
//  that follows the ball (or shows the whole pitch).
//
//  It owns its own animation state (facing, run cycle distance, camera
//  position, selection) and nothing else: everything it draws comes from the
//  scene it is handed. Integer zoom and image smoothing off keep every pixel
//  crisp. drawFrame(ctx, w, h, scene, info) is pure and is what the headless
//  tests call; info.state carries the renderer's animation state between
//  frames.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const C = MD.renderers.common;
  const SP = MD.sprites;
  const CAM_KEY = 'sm91-matchday-camera';
  const FOLLOW_ZOOM = 2;            // integer so the world image and the sprites stay crisp
  const CROWD = ['#E8C070','#D04040','#F2F2F2','#4A7BD0','#3B3B3B','#F0A030','#70C070','#C070C0','#8B5A2B','#F5E6C8'];

  // ---- the world image: stands + pitch at base resolution, cached per size ----
  function layoutFor(w, h){ return C.layout(w, h, Math.round(Math.min(w,h)*0.13)); }
  function drawStands(ctx, lay, seed, jump){
    const { w, h, ox, oy, L, W, portrait } = lay;
    const px0 = portrait? ox : ox, py0 = portrait? oy : oy;
    const pw = portrait? W : L, ph = portrait? L : W;
    const rnd = MD.seededRandom(seed);
    const bands = [ { x:0, y:0, bw:w, bh:py0 }, { x:0, y:py0+ph, bw:w, bh:h-(py0+ph) }, { x:0, y:py0, bw:px0, bh:ph }, { x:px0+pw, y:py0, bw:w-(px0+pw), bh:ph } ];
    for (const b of bands){
      if (b.bw<=0 || b.bh<=0) continue;
      ctx.fillStyle = '#3A3F47'; ctx.fillRect(b.x, b.y, b.bw, b.bh);                 // concrete
      // a lighter front wall around the pitch
      ctx.fillStyle = '#5B6168';
      // crowd: rows of 2px heads, every other row offset, a seeded colour each
      const gap = 3; const inset = 4;
      for (let y=b.y+inset; y<b.y+b.bh-inset; y+=gap){
        const off = (Math.floor((y-b.y)/gap)%2)? 1 : 0;
        for (let x=b.x+inset+off; x<b.x+b.bw-inset; x+=gap){
          const c = CROWD[Math.floor(rnd()*CROWD.length)];
          const up = jump && rnd()<0.5? 1 : 0;
          ctx.fillStyle = c; ctx.fillRect(x, y-up, 2, 2);
        }
      }
    }
    // the wall between crowd and pitch
    ctx.strokeStyle = '#8C9299'; ctx.lineWidth = 2; ctx.strokeRect(px0-2, py0-2, pw+4, ph+4);
    // floodlight pylons in the corners
    ctx.fillStyle = '#C9CED4';
    for (const [cx,cy] of [[px0-6, py0-6],[px0+pw+4, py0-6],[px0-6, py0+ph+4],[px0+pw+4, py0+ph+4]]){ ctx.fillRect(cx, cy, 3, 3); }
  }
  function buildWorld(createCanvas, w, h, lay, seed){
    const make = jump => { const cv = createCanvas(w, h); const ctx = cv.getContext('2d'); ctx.fillStyle = '#3A3F47'; ctx.fillRect(0,0,w,h); C.drawPitch(ctx, lay); drawStands(ctx, lay, seed, jump); return cv; };
    return { still: make(false), jump: make(true) };
  }

  // ---- camera ----
  // A round pixel ball: a seven-cell circle with a dark outline and the hint of panels,
  // drawn cell by cell so it stays crisp at every integer zoom. (X, Y) is its centre.
  const BALL = ['..111..', '.12221.', '1223221', '1232321', '1223221', '.12221.', '..111..'];
  const BALL_INK = { '1':'#111111', '2':'#FFFFFF', '3':'#3A3A3A' };
  function drawBall(ctx, X, Y, s){
    const x0 = X - 3*s, y0 = Y - 3*s;
    for (const ch of ['1','2','3']){ ctx.fillStyle = BALL_INK[ch]; for (let r=0;r<7;r++){ const row = BALL[r]; for (let c=0;c<7;c++) if (row[c]===ch) ctx.fillRect(x0 + c*s, y0 + r*s, s, s); } }
  }

  // Frames the scene's camera interest (ball plus whoever is about to matter, see interactions.js)
  // rather than the raw ball: a dead zone stops small movements panning, the pan speed is capped,
  // goal situations keep the goal mouth in view, and the only snaps are cuts, seeks and mode switches.
  const DEAD_ZONE = 0.09;           // fraction of the view in which the interest may wander without a pan
  const PAN_MAX = 1.25;             // view widths per second
  function camera(state, lay, scene, dtReal, mode, snap){
    const z = mode==='follow'? FOLLOW_ZOOM : 1;
    const ci = scene.cameraInterest || { x: scene.ball.x, y: scene.ball.y, kind:'openPlay' };
    let target = lay.proj(ci.x, ci.y);
    const vw = lay.w/z, vh = lay.h/z, halfW = vw/2, halfH = vh/2;
    // keep the goal mouth in frame during attacks and goals
    if (z>1 && (ci.kind==='attack' || ci.kind==='goal')){
      const g = lay.proj(scene.ball.x < 0.5? 0 : 1, 0.5);
      const marginX = vw*0.12, marginY = vh*0.12;
      if (g.X < target.X - halfW + marginX) target.X = g.X + halfW - marginX;
      if (g.X > target.X + halfW - marginX) target.X = g.X - halfW + marginX;
      if (g.Y < target.Y - halfH + marginY) target.Y = g.Y + halfH - marginY;
      if (g.Y > target.Y + halfH - marginY) target.Y = g.Y - halfH + marginY;
    }
    const clampX = v => Math.max(halfW, Math.min(lay.w - halfW, v)), clampY = v => Math.max(halfH, Math.min(lay.h - halfH, v));
    let tx = clampX(target.X), ty = clampY(target.Y);
    if (z===1){ tx = lay.w/2; ty = lay.h/2; }
    if (snap || state.camX===undefined || state.camZ!==z){ state.camX = tx; state.camY = ty; state.camZ = z; }
    else {
      // dead zone: no pan while the interest stays near the centre of the view
      const dx = tx - state.camX, dy = ty - state.camY;
      const outX = Math.max(0, Math.abs(dx) - vw*DEAD_ZONE), outY = Math.max(0, Math.abs(dy) - vh*DEAD_ZONE);
      if (outX > 0 || outY > 0){
        const k = 1 - Math.exp(-dtReal/0.55);
        let mx = Math.sign(dx)*outX*k, my = Math.sign(dy)*outY*k;
        const maxStep = PAN_MAX*vw*dtReal; const step = Math.hypot(mx, my);
        if (step > maxStep){ mx *= maxStep/step; my *= maxStep/step; }
        state.camX += mx; state.camY += my;
      }
    }
    const camX = state.camX, camY = state.camY;
    const toScreen = (x, y) => { const p = lay.proj(x, y); return { X: Math.round((p.X - camX)*z + lay.w/2), Y: Math.round((p.Y - camY)*z + lay.h/2) }; };
    return { z, camX, camY, toScreen, srcX: camX - halfW, srcY: camY - halfH, srcW: vw, srcH: vh };
  }

  // ---- sprites from scene players ----
  // screen-space direction of a pitch-space facing angle (radians, in metres)
  function screenDir(lay, x, y, angle){ const a = lay.proj(x, y), b = lay.proj(x + Math.cos(angle)/105*2, y + Math.sin(angle)/68*2); return { dX: b.X - a.X, dY: b.Y - a.Y }; }
  const FACING_ANGLE = { right:0, down:Math.PI/2, left:Math.PI, up:-Math.PI/2 };
  // pick one of four facings; keep the current one unless the direction has clearly moved away from it
  function facingFrom(dX, dY, current, hysteresis){
    if (Math.abs(dX) < 1e-6 && Math.abs(dY) < 1e-6) return current;
    const ang = Math.atan2(dY, dX);
    if (current && hysteresis){ let diff = Math.abs(ang - FACING_ANGLE[current]); if (diff > Math.PI) diff = 2*Math.PI - diff; if (diff < Math.PI/4 + hysteresis) return current; }
    return Math.abs(dX) >= Math.abs(dY)? (dX>0? 'right' : 'left') : (dY>0? 'down' : 'up');
  }
  function sideOf(dX, fallback){ if (Math.abs(dX)<1e-6) return fallback==='left'? 'left' : 'right'; return dX>0? 'right' : 'left'; }
  const STRIDE_M = 0.85;   // metres per run frame

  function drawFrame(ctx, w, h, scene, info){
    const st = info.state; const lay = info.lay || layoutFor(w, h);
    const dt = info.dtReal===undefined? 1/60 : info.dtReal;
    const cam = camera(st, lay, scene, dt, info.cameraMode||'whole', info.snap || (info.sinceCut!==undefined && info.sinceCut < 0.02));
    ctx.imageSmoothingEnabled = false;
    // world
    const crowdUp = scene.flash && Math.floor(scene.flash.age*7)%2===0;
    const world = info.world? (crowdUp? info.world.jump : info.world.still) : null;
    if (world) ctx.drawImage(world, cam.srcX, cam.srcY, cam.srcW, cam.srcH, 0, 0, w, h);
    else { ctx.fillStyle = '#2F8F3C'; ctx.fillRect(0,0,w,h); }
    const s = cam.z;   // sprite scale: integer, same as the zoom
    const home = info.teams.home, away = info.teams.away;
    const now = info.nowMs===undefined? 0 : info.nowMs;
    // player screen positions and animation: facing from the scene's facing angle (with a hold so
    // it does not flicker), the run cycle from distance covered, poses from the scene's action beats
    const items = [];
    for (const pl of scene.players){
      if (pl.sentOff) continue;
      const pos = cam.toScreen(pl.x, pl.y);
      const a = st.anim[pl.id] || (st.anim[pl.id] = { facing: pl.teamId===home.id? (scene.attackDir[home.id]===1? 'right':'left') : (scene.attackDir[away.id]===1? 'right':'left'), dist: 0, lx: pl.x, ly: pl.y });
      const movedM = Math.hypot((pl.x - a.lx)*105, (pl.y - a.ly)*68); a.lx = pl.x; a.ly = pl.y;
      if (movedM < 12) a.dist += movedM; else a.dist = 0;   // a cut: restart the cycle
      let facing = a.facing;
      if (pl.facingAngle!==null && pl.facingAngle!==undefined){ const d = screenDir(lay, pl.x, pl.y, pl.facingAngle); facing = facingFrom(d.dX, d.dY, a.facing, pl.movement==='idle'? 0.6 : 0.25); }
      const runFrame = Math.floor(a.dist/STRIDE_M)%4;
      let pose = 'idle', frame = 0;
      const mv = pl.movement || (pl.hasBall? 'jog' : 'idle');
      if (mv==='walk'){ pose = 'run'; frame = Math.floor(a.dist/(STRIDE_M*1.6))%4; }
      else if (mv!=='idle'){ pose = 'run'; frame = runFrame; }
      const ph = pl.actionPhase||0;
      switch (pl.action){
        case 'pass': case 'shoot':
          if (ph < 0.3){ if (mv==='idle') pose = 'idle'; }                 // plant the feet
          else if (ph < 0.82) pose = pl.action==='shoot'? 'shoot' : 'kick';   // contact window
          break;
        case 'receive': if (ph < 0.85) pose = 'receive'; break;
        case 'set': pose = 'set'; break;
        case 'dive': pose = 'dive'; break;
        case 'tackle': pose = 'slide'; break;
        case 'block': pose = 'block'; break;
        case 'celebrate': pose = 'celebrate'; frame = Math.floor(now/300)%2; facing = 'down'; break;
        case 'booked': pose = 'booked'; facing = 'down'; break;
        default: break;
      }
      if (pl.aim && (pose==='dive' || pose==='slide')){ const ap = lay.proj(pl.aim.x, pl.aim.y), v0 = lay.proj(pl.x, pl.y); facing = sideOf(ap.X - v0.X, a.facing); }
      a.facing = facing;
      const kit = pl.teamId===home.id? home.kit : away.kit;
      const gk = pl.role==='GK'? { primary: kit.secondary, secondary: kit.primary } : kit;
      items.push({ kind:'player', pl, pos, sprite: SP.get(gk, SP.variantFor(pl.id), facing, pose, frame), y: pos.Y, facing });
    }
    // referee
    if (scene.ref){
      const r = scene.ref; const pos = cam.toScreen(r.x, r.y);
      const a = st.anim.ref || (st.anim.ref = { facing:'down', dist:0, lx:r.x, ly:r.y });
      const movedM = Math.hypot((r.x-a.lx)*105, (r.y-a.ly)*68); a.lx = r.x; a.ly = r.y; if (movedM<12) a.dist += movedM; else a.dist = 0;
      const v0 = lay.proj(r.x, r.y);
      let pose = 'idle', frame = 0, facing = a.facing;
      if (r.facingAngle!==null && r.facingAngle!==undefined){ const d = screenDir(lay, r.x, r.y, r.facingAngle); facing = facingFrom(d.dX, d.dY, a.facing, 0.3); }
      if ((r.movement||'idle')!=='idle'){ pose = 'run'; frame = Math.floor(a.dist/STRIDE_M)%4; }
      if (r.signal==='goal'){ const c = lay.proj(0.5, 0.5); pose = 'point'; facing = sideOf(c.X - v0.X, a.facing); }
      else if (r.signal==='yellow' || r.signal==='red'){ pose = 'card'; frame = r.signal==='red'? 1 : 0; facing = 'down'; }
      else if (r.signal==='whistle'){ pose = 'whistle'; facing = 'down'; }
      a.facing = facing;
      items.push({ kind:'ref', pos, sprite: SP.get(SP.REF_KIT, { skin:1, hair:0 }, facing, pose, frame), y: pos.Y });
    }
    items.sort((p,q)=>p.y-q.y);
    const SW = SP.W*s, SH = SP.H*s, FX = 12*s, FY = SP.FEET*s;
    const b = scene.ball; const controlled = b.state? b.state==='controlled' : !!b.carrierId;
    for (const it of items){
      // shadow, and a restrained ring under the player on the ball
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(it.pos.X - 4*s, it.pos.Y - 1*s, 8*s, 2*s);
      if (it.kind==='player' && it.pl.hasBall && info.possessionRing!==false){ ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = s; ctx.beginPath(); ctx.ellipse(it.pos.X, it.pos.Y, 9*s, 4*s, 0, 0, Math.PI*2); ctx.stroke(); }
      ctx.drawImage(it.sprite, 0, 0, SP.W, SP.H, it.pos.X - FX, it.pos.Y - FY, SW, SH);
    }
    // ball: at the carrier's feet (a touch ahead of him) when controlled, lifted by its height in flight
    let bp = cam.toScreen(b.x, b.y);
    if (controlled && b.carrierId){ const it = items.find(x=>x.kind==='player' && x.pl.id===b.carrierId); if (it){ const off = it.facing==='right'? [3*s, 0] : it.facing==='left'? [-3*s, 0] : it.facing==='down'? [1*s, 1*s] : [-1*s, -1*s]; bp = { X: it.pos.X + off[0], Y: it.pos.Y + off[1] }; } }
    const lift = Math.round((b.z||0)*10*s);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bp.X - 3*s, bp.Y - 1*s, 6*s, 2*s);
    const br = 3*s;
    if (b.state==='travelling' && b.z > 0.05){ ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bp.X - s, bp.Y - lift + br, 2*s, Math.max(s, lift - br)); }   // a faint trail down to the shadow
    drawBall(ctx, bp.X, bp.Y - lift, s);
    // tags: the player on the ball, and the selected player
    const font = px => `700 ${Math.round(px)}px "Courier New",Courier,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (X, Y, text, bg) => { const fs = Math.max(10, 7*s); ctx.font = font(fs); const tw = ctx.measureText(text).width + 8; const th = fs + 4; ctx.fillStyle = bg||'rgba(0,0,0,0.75)'; ctx.fillRect(Math.round(X - tw/2), Math.round(Y - th - 2), Math.round(tw), th); ctx.fillStyle = '#FFFFFF'; ctx.fillText(text, X, Y - th/2 - 1); };
    const sel = info.selected && info.selected.until > now? scene.players.find(x=>x.id===info.selected.id) : null;
    if (sel && !sel.sentOff){ const p = cam.toScreen(sel.x, sel.y); tag(p.X, p.Y - FY, sel.name+' '+sel.shirtNo, 'rgba(230,110,0,0.9)'); ctx.strokeStyle = '#FFD200'; ctx.lineWidth = s; ctx.strokeRect(p.X - FX, p.Y - FY, SW, SH); }
    // goal flash: a beat after the ball crosses the line, and in the half of the view away from the goal
    if (scene.flash && scene.flash.type==='goal' && scene.flash.age > 0.35){
      const team = scene.flash.teamId===home.id? home : away;
      const age = scene.flash.age - 0.35; const a = Math.max(0, 1 - age/2.2);
      ctx.save(); ctx.globalAlpha = Math.min(1, a*1.6); ctx.lineJoin = 'round';
      const size = Math.min(w,h)*0.15; ctx.font = font(size); ctx.lineWidth = Math.max(3, size*0.12); ctx.strokeStyle = '#111'; ctx.fillStyle = team.kit.primary;
      const goalPt = cam.toScreen(scene.ball.x < 0.5? 0 : 1, 0.5);
      const cx = goalPt.X < w/2? w*0.68 : goalPt.X > w/2? w*0.32 : w/2;
      const cy = goalPt.Y < h/2? h*0.7 : h*0.3;
      ctx.strokeText('GOAL!', cx, cy); ctx.fillText('GOAL!', cx, cy);
      ctx.fillStyle = '#FFFFFF'; ctx.font = font(size*0.42); ctx.strokeText(team.short.toUpperCase(), cx, cy+size*0.75); ctx.fillText(team.short.toUpperCase(), cx, cy+size*0.75);
      ctx.restore();
    }
    if (info.sinceCut!==undefined && info.sinceCut < 0.3){ ctx.save(); ctx.globalAlpha = 1 - info.sinceCut/0.3; ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h); ctx.restore(); }
    if (info.fastForward){ ctx.save(); ctx.globalAlpha = 0.9; ctx.font = font(12); const label = '\u25B6\u25B6 NEXT HIGHLIGHT'; const bw = ctx.measureText(label).width + 16, bh = 20; ctx.fillStyle = '#111'; ctx.fillRect(Math.round(w/2 - bw/2), 6, Math.round(bw), bh); ctx.fillStyle = '#FFD200'; ctx.fillText(label, w/2, 6+bh/2+1); ctx.restore(); }
    return cam;
  }

  // ---- the renderer object ----
  function create(options){
    const opts = Object.assign({}, options||{});
    let container = null, canvas = null, ctx = null, teams = null, lay = null, world = null, ro = null, lastW = 0, lastH = 0, seed = 1, lastCam = null, lastTs = 0;
    let cameraMode = opts.camera || (function(){ try { return root.localStorage.getItem(CAM_KEY) || 'follow'; } catch(e){ return 'follow'; } })();
    const state = { anim: {}, camX: undefined, camY: undefined };
    let selected = null, lastScene = null;
    function onTap(e){
      if (!lastScene || !lastCam || !canvas) return;
      const rect = canvas.getBoundingClientRect(); const X = (e.clientX - rect.left) * (canvas.width/rect.width), Y = (e.clientY - rect.top) * (canvas.height/rect.height);
      let best = null, bd = 1e9;
      for (const pl of lastScene.players){ if (pl.sentOff) continue; const p = lastCam.toScreen(pl.x, pl.y); const d = Math.hypot(p.X - X, (p.Y - 11*lastCam.z) - Y); if (d < bd){ bd = d; best = pl; } }
      if (best && bd < 22*lastCam.z){ selected = { id: best.id, until: nowMs() + 3500 }; if (opts.onSelect) opts.onSelect(best); }
      else selected = null;
      if (lastScene) r.render(lastScene, r.lastHud||{});
    }
    const nowMs = () => (root.performance && root.performance.now)? root.performance.now() : Date.now();
    const r = {
      id: 'pixelart',
      mount(el, presentation){
        container = el; teams = presentation.teams; seed = presentation.seed;
        canvas = root.document.createElement('canvas'); canvas.className = 'md-canvas';
        canvas.setAttribute('role','img'); canvas.setAttribute('aria-label', presentation.teams.home.name+' v '+presentation.teams.away.name+', pixel art match view');
        canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.imageRendering = 'pixelated'; canvas.style.touchAction = 'manipulation';
        container.appendChild(canvas); ctx = canvas.getContext('2d');
        canvas.addEventListener('click', onTap);
        r.resize();
        if (root.ResizeObserver){ ro = new root.ResizeObserver(()=>r.resize()); ro.observe(container); }
      },
      resize(){
        if (!container || !canvas) return;
        const cw = Math.max(1, container.clientWidth), ch = Math.max(1, container.clientHeight);
        if (cw===lastW && ch===lastH && world) return;
        lastW = cw; lastH = ch; canvas.width = cw; canvas.height = ch;
        lay = layoutFor(cw, ch);
        world = buildWorld((w,h)=>{ const c = root.document.createElement('canvas'); c.width = w; c.height = h; return c; }, cw, ch, lay, seed);
        state.camX = undefined;
      },
      render(scene, hud){
        if (!ctx || !lay) return;
        const ts = nowMs(); const dt = lastTs? Math.min(0.1, (ts - lastTs)/1000) : 1/60; lastTs = ts;
        r.lastHud = hud; lastScene = scene;
        lastCam = drawFrame(ctx, canvas.width, canvas.height, scene, { teams, lay, world, state, dtReal: dt, nowMs: ts, cameraMode, selected, fastForward: !!(hud && hud.fastForward), sinceCut: hud? hud.sinceCut : undefined, snap: !!(hud && hud.reducedMotion) });
      },
      setCamera(mode){ cameraMode = mode==='whole'? 'whole' : 'follow'; try { root.localStorage.setItem(CAM_KEY, cameraMode); } catch(e){} state.camX = undefined; if (lastScene) r.render(lastScene, r.lastHud||{}); return cameraMode; },
      getCamera(){ return cameraMode; },
      dispose(){ if (ro){ ro.disconnect(); ro = null; } if (canvas){ canvas.removeEventListener('click', onTap); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); } canvas = ctx = container = lay = world = null; },
    };
    return r;
  }
  MD.renderers.pixelart = { id:'pixelart', name:'Pixels', create, drawFrame, layoutFor, buildWorld };
})(typeof window!=='undefined'? window : globalThis);
