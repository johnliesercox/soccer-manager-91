// ============================================================================
//  Matchday: Canvas2DRenderer (Phase 1)
//  Draws a scene (see scene.js) on a 2D canvas: striped pitch, markings,
//  goals, numbered team markers and a ball with a shadow. It knows nothing
//  about the match beyond the scene handed to it and the two kits.
//
//  Renderer contract (every renderer implements exactly this):
//    const r = Matchday.renderers.canvas2d.create(options);
//    r.mount(containerElement, presentation);  // build DOM, read kits
//    r.render(scene, hud);                     // draw one frame
//    r.resize();                               // container size changed
//    r.dispose();                              // remove DOM, listeners, caches
//  hud: { fastForward, speed, reducedMotion, homeIsUser } (presentation hints only)
//
//  drawFrame(ctx, w, h, scene, frameInfo) is a pure function so it can be
//  exercised headlessly (see test-renderers.js).
// ============================================================================
(function(root){
  const MD = root.Matchday;
  MD.renderers = MD.renderers || {};

  // ---- shared layout helpers (used by every canvas renderer) ----
  // Fits a 105 x 68 pitch inside w x h with a margin, portrait when the box is taller than wide.
  function layout(w, h, margin){
    margin = margin===undefined? Math.round(Math.min(w,h)*0.055) : margin;
    const availW = w - 2*margin, availH = h - 2*margin;
    const ratio = 105/68;
    // whichever orientation gives the bigger pitch
    const fit = (a, b) => { let L = a, W = L/ratio; if (W>b){ W = b; L = W*ratio; } return { L, W }; };
    const land = fit(availW, availH), port = fit(availH, availW);
    const portrait = port.L > land.L*1.02;
    const { L, W } = portrait? port : land;   // L along the pitch length (x axis), W across it (y axis)
    const ox = portrait? (w-W)/2 : (w-L)/2, oy = portrait? (h-L)/2 : (h-W)/2;
    const proj = portrait? ((x,y)=>({ X: ox + y*W, Y: oy + x*L })) : ((x,y)=>({ X: ox + x*L, Y: oy + y*W }));
    return { w, h, portrait, L, W, ox, oy, margin, m: L/105, proj };
  }
  function luminance(c){ const v = rgb(c); return (0.299*v[0] + 0.587*v[1] + 0.114*v[2])/255; }
  function rgb(c){ if (c[0]==='#'){ return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]; } const m = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(c); if (!m) return [128,128,128]; const h=+m[1]/360, s=+m[2]/100, l=+m[3]/100; const f=(n)=>{ const k=(n+h*12)%12; const a=s*Math.min(l,1-l); return Math.round(255*(l - a*Math.max(-1, Math.min(k-3, 9-k, 1)))); }; return [f(0),f(8),f(4)]; }
  const inkOn = c => luminance(c) > 0.55? '#111111' : '#FFFFFF';

  const PALETTE = { grassA:'#2F8F3C', grassB:'#298534', line:'#F2F7F2', surround:'#1E5F2A', net:'#DDE6DD', ball:'#FFFFFF', ballInk:'#222222', shadow:'rgba(0,0,0,0.35)' };

  // ---- pitch (cached per size) ----
  function drawPitch(ctx, lay){
    const { w, h, L, W, m, proj, portrait } = lay;
    ctx.fillStyle = PALETTE.surround; ctx.fillRect(0,0,w,h);
    // stripes across the pitch length
    const bands = 12;
    for (let i=0;i<bands;i++){
      const a = proj(i/bands, 0), b = proj((i+1)/bands, 1);
      ctx.fillStyle = i%2? PALETTE.grassA : PALETTE.grassB;
      ctx.fillRect(Math.min(a.X,b.X), Math.min(a.Y,b.Y), Math.abs(b.X-a.X), Math.abs(b.Y-a.Y));
    }
    ctx.strokeStyle = PALETTE.line; ctx.lineWidth = Math.max(1.5, m*0.45); ctx.lineCap = 'butt';
    const rect = (x0,y0,x1,y1) => { const a = proj(x0,y0), b = proj(x1,y1); ctx.strokeRect(Math.min(a.X,b.X), Math.min(a.Y,b.Y), Math.abs(b.X-a.X), Math.abs(b.Y-a.Y)); };
    const line = (x0,y0,x1,y1) => { const a = proj(x0,y0), b = proj(x1,y1); ctx.beginPath(); ctx.moveTo(a.X,a.Y); ctx.lineTo(b.X,b.Y); ctx.stroke(); };
    const circle = (x,y,rm,fill) => { const c = proj(x,y); ctx.beginPath(); ctx.arc(c.X, c.Y, rm*m, 0, Math.PI*2); if (fill){ ctx.fillStyle = PALETTE.line; ctx.fill(); } else ctx.stroke(); };
    rect(0,0,1,1);
    line(0.5,0,0.5,1);
    circle(0.5,0.5,9.15,false); circle(0.5,0.5,0.5,true);
    const pa = 16.5/105, paw = 40.32/68, six = 5.5/105, sixw = 18.32/68, spot = 11/105;
    for (const side of [0,1]){
      const x0 = side? 1 : 0, dir = side? -1 : 1;
      rect(x0, 0.5-paw/2, x0+dir*pa, 0.5+paw/2);
      rect(x0, 0.5-sixw/2, x0+dir*six, 0.5+sixw/2);
      circle(x0+dir*spot, 0.5, 0.5, true);
      // penalty arc: the part of the 9.15m circle outside the area
      const sp = proj(x0+dir*spot, 0.5); const r = 9.15*m;
      const edge = proj(x0+dir*pa, 0.5);
      const d = Math.hypot(edge.X-sp.X, edge.Y-sp.Y); const half = Math.acos(Math.min(1, d/r));
      const base = Math.atan2(edge.Y-sp.Y, edge.X-sp.X);
      ctx.beginPath(); ctx.arc(sp.X, sp.Y, r, base-half, base+half); ctx.stroke();
      // goal: 7.32m wide, drawn 2.2m deep behind the line, with a hatched net
      const gw = 7.32/68, gd = 2.2/105;
      const g0 = proj(x0, 0.5-gw/2), g1 = proj(x0-dir*gd, 0.5+gw/2);
      const gx = Math.min(g0.X,g1.X), gy = Math.min(g0.Y,g1.Y), gW = Math.abs(g1.X-g0.X), gH = Math.abs(g1.Y-g0.Y);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(gx, gy, gW, gH);
      ctx.save(); ctx.strokeStyle = PALETTE.net; ctx.lineWidth = 1; ctx.beginPath();
      const stepPx = Math.max(3, m*0.9);
      if (portrait){ for (let x=gx; x<=gx+gW; x+=stepPx){ ctx.moveTo(x, gy); ctx.lineTo(x, gy+gH); } }
      else { for (let y=gy; y<=gy+gH; y+=stepPx){ ctx.moveTo(gx, y); ctx.lineTo(gx+gW, y); } }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = PALETTE.line; ctx.lineWidth = Math.max(2, m*0.6); ctx.strokeRect(gx, gy, gW, gH); ctx.lineWidth = Math.max(1.5, m*0.45);
    }
    // corner arcs
    for (const [cx,cy] of [[0,0],[0,1],[1,0],[1,1]]){ const c = proj(cx,cy); ctx.beginPath(); ctx.arc(c.X, c.Y, 1*m, 0, Math.PI*2); ctx.stroke(); }
  }

  // ---- one frame ----
  // frameInfo: { teams: {home:{id,kit,short}, away:{...}}, fastForward, flash, lay, pitch (cached canvas) }
  function drawFrame(ctx, w, h, scene, info){
    const lay = info.lay || layout(w, h);
    const { m, proj } = lay;
    if (info.pitch) ctx.drawImage(info.pitch, 0, 0, w, h); else drawPitch(ctx, lay);
    const home = info.teams.home, away = info.teams.away;
    const r = Math.max(6, m*2.6);                       // player marker radius
    const font = (px) => `700 ${Math.round(px)}px "Courier New",Courier,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    // players: home are discs, away are rounded squares (shape backs up colour)
    const players = scene.players.slice().sort((a,b)=>a.y-b.y);
    for (const pl of players){
      const team = pl.teamId===home.id? home : away;
      const isHome = team===home;
      let pos;
      if (pl.sentOff){ pos = proj(pl.x, 1.0); pos = lay.portrait? { X: pos.X + (isHome? -1.3 : 1.3)*r, Y: pos.Y } : { X: pos.X, Y: pos.Y + 1.4*r }; }
      else pos = proj(pl.x, pl.y);
      const fill = pl.role==='GK'? team.kit.secondary : team.kit.primary;
      const stroke = pl.role==='GK'? team.kit.primary : team.kit.secondary;
      ctx.save();
      if (pl.sentOff) ctx.globalAlpha = 0.45;
      // ground shadow
      ctx.fillStyle = PALETTE.shadow; ctx.beginPath(); ctx.ellipse(pos.X+r*0.15, pos.Y+r*0.35, r*0.95, r*0.55, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.5, r*0.22);
      ctx.beginPath();
      if (isHome) ctx.arc(pos.X, pos.Y, r, 0, Math.PI*2);
      else roundRect(ctx, pos.X-r*0.92, pos.Y-r*0.92, r*1.84, r*1.84, r*0.35);
      ctx.fill(); ctx.stroke();
      if (pl.hasBall){ ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1, r*0.14); ctx.beginPath(); ctx.arc(pos.X, pos.Y, r*1.45, 0, Math.PI*2); ctx.stroke(); }
      ctx.fillStyle = inkOn(fill); ctx.font = font(r*1.15);
      ctx.fillText(String(pl.shirtNo), pos.X, pos.Y+r*0.05);
      ctx.restore();
    }
    // ball with elevation
    const b = scene.ball; const bp = proj(b.x, b.y); const br = Math.max(3, r*0.48);
    const lift = (b.z||0) * m * 6;
    ctx.fillStyle = PALETTE.shadow; ctx.beginPath(); ctx.ellipse(bp.X+lift*0.25, bp.Y+br*0.6, br*0.9, br*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = PALETTE.ball; ctx.strokeStyle = PALETTE.ballInk; ctx.lineWidth = Math.max(1, br*0.25);
    ctx.beginPath(); ctx.arc(bp.X, bp.Y-lift, br*(1+(b.z||0)*0.35), 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PALETTE.ballInk; ctx.beginPath(); ctx.arc(bp.X, bp.Y-lift, br*0.28, 0, Math.PI*2); ctx.fill();
    // goal flash
    if (scene.flash && scene.flash.type==='goal'){
      const team = scene.flash.teamId===home.id? home : away;
      const a = Math.max(0, 1 - scene.flash.age/2.5);
      ctx.save(); ctx.globalAlpha = 0.28*a*(0.6+0.4*Math.abs(Math.sin(scene.flash.age*9))); ctx.fillStyle = team.kit.primary; ctx.fillRect(0,0,w,h); ctx.restore();
      ctx.save(); ctx.globalAlpha = Math.min(1, a*1.6);
      const size = Math.min(w,h)*0.17;
      ctx.font = font(size); ctx.lineWidth = Math.max(3, size*0.12); ctx.strokeStyle = '#111'; ctx.fillStyle = team.kit.primary;
      const cx = w/2, cy = h/2 - size*0.1;
      ctx.strokeText('GOAL!', cx, cy); ctx.fillText('GOAL!', cx, cy);
      ctx.fillStyle = '#FFFFFF'; ctx.font = font(size*0.42); ctx.strokeText(team.short.toUpperCase(), cx, cy+size*0.75); ctx.fillText(team.short.toUpperCase(), cx, cy+size*0.75);
      ctx.restore();
    }
    // a quick fade in from black after a cut (end of a fast-forward)
    if (info.sinceCut!==undefined && info.sinceCut < 0.3){ ctx.save(); ctx.globalAlpha = 1 - info.sinceCut/0.3; ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h); ctx.restore(); }
    // fast-forward marker
    if (info.fastForward){
      ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = '#111'; const bw = Math.max(34, m*8), bh = Math.max(16, m*3.4);
      ctx.fillRect(w-bw-6, 6, bw, bh); ctx.fillStyle = '#FFD200'; ctx.font = font(bh*0.7); ctx.fillText('▶▶', w-bw/2-6, 6+bh/2+1); ctx.restore();
    }
  }
  function roundRect(ctx, x, y, w, h, r){ ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); }

  // ---- the renderer object ----
  function create(options){
    const opts = Object.assign({ pixelDensity: 'retro' }, options||{});   // 'retro' = 1 canvas px per CSS px, 'sharp' = device pixels
    let container = null, canvas = null, ctx = null, teams = null, lay = null, pitch = null, ro = null, lastW = 0, lastH = 0;
    function makePitch(){
      if (!canvas) return;
      const cv = typeof root.document!=='undefined'? root.document.createElement('canvas') : null;
      if (!cv) { pitch = null; return; }
      cv.width = canvas.width; cv.height = canvas.height;
      drawPitch(cv.getContext('2d'), lay); pitch = cv;
    }
    const r = {
      id: 'canvas2d',
      mount(el, presentation){
        container = el; teams = presentation.teams;
        canvas = root.document.createElement('canvas');
        canvas.className = 'md-canvas'; canvas.setAttribute('role','img'); canvas.setAttribute('aria-label', presentation.teams.home.name+' v '+presentation.teams.away.name+', animated pitch view');
        canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%';
        if (opts.pixelDensity==='retro') canvas.style.imageRendering = 'pixelated';
        container.appendChild(canvas);
        ctx = canvas.getContext('2d');
        r.resize();
        if (root.ResizeObserver){ ro = new root.ResizeObserver(()=>r.resize()); ro.observe(container); }
      },
      resize(){
        if (!container || !canvas) return;
        const cw = Math.max(1, container.clientWidth), ch = Math.max(1, container.clientHeight);
        const dpr = opts.pixelDensity==='sharp'? (root.devicePixelRatio||1) : 1;
        const bw = Math.round(cw*dpr), bh = Math.round(ch*dpr);
        if (bw===lastW && bh===lastH && pitch) return;
        lastW = bw; lastH = bh; canvas.width = bw; canvas.height = bh;
        lay = layout(bw, bh); makePitch();
      },
      render(scene, hud){
        if (!ctx || !lay) return;
        drawFrame(ctx, canvas.width, canvas.height, scene, { teams, lay, pitch, fastForward: !!(hud && hud.fastForward), sinceCut: hud? hud.sinceCut : undefined });
      },
      dispose(){
        if (ro){ ro.disconnect(); ro = null; }
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null; ctx = null; pitch = null; container = null; lay = null;
      },
    };
    return r;
  }

  MD.renderers.common = { layout, drawPitch, luminance, inkOn, roundRect, PALETTE };
  MD.renderers.canvas2d = { id:'canvas2d', name:'Markers', create, drawFrame };
})(typeof window!=='undefined'? window : globalThis);
