// ============================================================================
//  Matchday: WireframeRenderer (proof of renderer swap)
//  A second, deliberately different implementation of the renderer contract:
//  a green-phosphor "tactics board" look. Home players are O, away players
//  are X, the ball is a dot. It shares only the layout helper with the 2D
//  renderer and reads only the scene, which is the whole point: a renderer
//  can be swapped without touching playMatch, the timeline or the scene.
//  It is also fully colour-independent, so it doubles as an accessibility
//  mode.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const C = MD.renderers.common;
  const INK = '#39FF7A', DIM = 'rgba(57,255,122,0.45)', BG = '#04140A';

  function drawFrame(ctx, w, h, scene, info){
    const lay = info.lay || C.layout(w, h);
    const { m, proj } = lay;
    ctx.fillStyle = BG; ctx.fillRect(0,0,w,h);
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y=0; y<h; y+=3) ctx.fillRect(0, y, w, 1);
    ctx.strokeStyle = DIM; ctx.lineWidth = 1;
    const rect = (x0,y0,x1,y1) => { const a = proj(x0,y0), b = proj(x1,y1); ctx.strokeRect(Math.min(a.X,b.X)+0.5, Math.min(a.Y,b.Y)+0.5, Math.abs(b.X-a.X), Math.abs(b.Y-a.Y)); };
    const line = (x0,y0,x1,y1) => { const a = proj(x0,y0), b = proj(x1,y1); ctx.beginPath(); ctx.moveTo(a.X,a.Y); ctx.lineTo(b.X,b.Y); ctx.stroke(); };
    rect(0,0,1,1); line(0.5,0,0.5,1);
    const c = proj(0.5,0.5); ctx.beginPath(); ctx.arc(c.X, c.Y, 9.15*m, 0, Math.PI*2); ctx.stroke();
    const pa = 16.5/105, paw = 40.32/68, gw = 7.32/68, gd = 2.2/105;
    rect(0, 0.5-paw/2, pa, 0.5+paw/2); rect(1, 0.5-paw/2, 1-pa, 0.5+paw/2);
    ctx.strokeStyle = INK; rect(0, 0.5-gw/2, -gd, 0.5+gw/2); rect(1, 0.5-gw/2, 1+gd, 0.5+gw/2);
    const home = info.teams.home;
    const r = Math.max(5, m*2.1);
    ctx.font = `700 ${Math.round(r*1.9)}px "Courier New",Courier,monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const pl of scene.players){
      if (pl.sentOff) continue;
      const p = proj(pl.x, pl.y);
      ctx.fillStyle = pl.hasBall? '#FFFFFF' : INK;
      ctx.fillText(pl.teamId===home.id? 'O' : 'X', p.X, p.Y);
      ctx.font = `700 ${Math.round(r*0.9)}px "Courier New",Courier,monospace`; ctx.fillStyle = DIM; ctx.fillText(String(pl.shirtNo), p.X, p.Y+r*1.5);
      ctx.font = `700 ${Math.round(r*1.9)}px "Courier New",Courier,monospace`;
    }
    const b = proj(scene.ball.x, scene.ball.y); const lift = (scene.ball.z||0)*m*6;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(b.X, b.Y-lift, Math.max(2, r*0.35), 0, Math.PI*2); ctx.fill();
    if (scene.flash && scene.flash.type==='goal'){
      const a = Math.max(0, 1-scene.flash.age/2.5);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = INK; ctx.font = `700 ${Math.round(Math.min(w,h)*0.16)}px "Courier New",Courier,monospace`;
      if (Math.floor(scene.flash.age*6)%2===0) ctx.fillText('GOAL', w/2, h/2); ctx.restore();
    }
    if (info.sinceCut!==undefined && info.sinceCut < 0.3){ ctx.save(); ctx.globalAlpha = 1 - info.sinceCut/0.3; ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h); ctx.restore(); }
    if (info.fastForward){ ctx.fillStyle = INK; ctx.font = `700 ${Math.round(Math.max(12, m*3))}px "Courier New",Courier,monospace`; ctx.textAlign = 'right'; ctx.fillText('>>', w-8, 14); ctx.textAlign = 'center'; }
  }

  function create(){
    let container = null, canvas = null, ctx = null, teams = null, lay = null, ro = null;
    const r = {
      id: 'wireframe',
      mount(el, presentation){
        container = el; teams = presentation.teams;
        canvas = root.document.createElement('canvas'); canvas.className = 'md-canvas';
        canvas.setAttribute('role','img'); canvas.setAttribute('aria-label', presentation.teams.home.name+' v '+presentation.teams.away.name+', tactics board view');
        canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.imageRendering = 'pixelated';
        container.appendChild(canvas); ctx = canvas.getContext('2d'); r.resize();
        if (root.ResizeObserver){ ro = new root.ResizeObserver(()=>r.resize()); ro.observe(container); }
      },
      resize(){ if (!container || !canvas) return; canvas.width = Math.max(1, container.clientWidth); canvas.height = Math.max(1, container.clientHeight); lay = C.layout(canvas.width, canvas.height); },
      render(scene, hud){ if (ctx && lay) drawFrame(ctx, canvas.width, canvas.height, scene, { teams, lay, fastForward: !!(hud && hud.fastForward), sinceCut: hud? hud.sinceCut : undefined }); },
      dispose(){ if (ro){ ro.disconnect(); ro = null; } if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); canvas = ctx = container = lay = null; },
    };
    return r;
  }
  MD.renderers.wireframe = { id:'wireframe', name:'Board', create, drawFrame };
})(typeof window!=='undefined'? window : globalThis);
