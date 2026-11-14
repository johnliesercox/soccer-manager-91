// ============================================================================
//  Matchday: isometric actors (Phase 3)
//  Turns one scene into a depth-sorted list of things to draw: players and
//  the referee as eight-direction sprites with ground shadows, the ball with
//  its shadow pinned to its ground coordinate while it lifts, and the two
//  goals split into a back part (far post, crossbar, back net) and a front
//  part (near post) so players and the ball can pass between them. Depth is
//  the world's X + Y; ties break on a stable key so two players crossing
//  never flicker. The only state kept is animation state per actor (the
//  current heading, run distance) in info.state.anim, reset on cuts.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const PR = MD.iso.projection; const DIM = PR.DIM; const SP = MD.isoSprites; const STAD = MD.iso.stadium;
  const STRIDE_M = 0.9;            // metres per run frame
  const HYST = 0.2;                // radians of screen angle before a heading changes

  // Pose and frame for a scene player: locomotion by distance covered, actions by their phase.
  // Nothing here reads a wall clock, so a paused or rewound match shows the same frame again.
  // Pose and frame for a scene player's action. The header's jump is added here (a lift in metres, apex at the
  // contact) so the player meets the ball where it is. Celebrations and reactions come in variants chosen by the
  // scene (actionDetail.variant), so the same incident does not always look the same.
  const JUMP = { base: 0.18, maxExtra: 0.55, headHeight: 1.7 };
  function poseFor(pl, a, t){
    let pose = 'idle', frame = 0, lift = 0;
    const mv = pl.movement || 'idle';
    const runFrame = n => Math.floor(a.dist/(STRIDE_M*0.75))%n;
    if (mv==='walk'){ pose = 'walk'; frame = Math.floor(a.dist/(STRIDE_M*0.7))%SP.POSES.walk; }
    else if (mv==='jog' || mv==='run' || mv==='sprint'){ pose = 'run'; frame = runFrame(SP.POSES.run); }
    const ph = pl.actionPhase||0; const d = pl.actionDetail||{}; const v = d.variant||0;
    switch (pl.action){
      case 'pass': case 'shoot': pose = pl.action==='pass'? 'kick' : 'shoot'; frame = ph < 0.42? 0 : ph < 0.66? 1 : ph < 0.86? 2 : 3; break;
      case 'volley': pose = 'volley'; frame = ph < 0.35? 0 : ph < 0.7? 1 : 2; break;
      case 'header': {
        pose = 'header'; frame = ph < 0.3? 0 : ph < 0.72? 1 : 2;
        const ballZ = (d.z||0)*PR.BALL_Z_M;                     // metres; a ball above head height needs a jump
        const h = JUMP.base + Math.max(0, Math.min(JUMP.maxExtra, ballZ - JUMP.headHeight));
        lift = h*Math.max(0, Math.sin(Math.PI*Math.min(1, ph)));   // the apex is the contact, at phase 0.5
        break;
      }
      case 'receive': pose = 'receive'; frame = ph < 0.45? 0 : 1; break;
      case 'tackle': if (d.slide===false){ pose = 'poke'; } else { pose = 'slide'; frame = ph < 0.3? 0 : 1; } break;
      case 'block': if (d.slide){ pose = 'slide'; frame = ph < 0.35? 0 : 1; } else pose = 'block'; break;
      case 'dive': if (d.parry){ pose = 'parry'; frame = ph < 0.6? 0 : 1; } else { pose = 'dive'; frame = ph < 0.25? 0 : ph < 0.7? 1 : 2; } break;
      case 'catch': pose = 'catch'; frame = ph < 0.5? 0 : 1; break;
      case 'set': pose = 'set'; break;
      case 'getup': pose = 'getup'; frame = ph < 0.5? 0 : 1; break;
      case 'celebrate': {
        // variants: arms aloft (0), running to the crowd (1), the knee slide (2), the group hug (3)
        if (v===1 || (v===2 && ph < 0.45)){ pose = 'runcheer'; frame = runFrame(SP.POSES.runcheer); }
        else if (v===2){ pose = 'kneeslide'; frame = ph < 0.7? 0 : 1; }
        else if (v===3){ pose = 'hug'; frame = ph < 0.4? 0 : 1; }
        else { pose = 'celebrate'; frame = Math.floor((t||0)*3)%2; }
        break;
      }
      case 'booked': pose = 'booked'; break;
      case 'dismay': pose = v===1? 'kneel' : v===2? 'appeal' : 'dismay'; break;   // head in hands, down on the knees, arms out appealing
      default: break;
    }
    return { pose, frame, lift };
  }
  function refPose(r, a){
    let pose = 'idle', frame = 0;
    const mv = r.movement || 'idle';
    if (mv==='walk'){ pose = 'walk'; frame = Math.floor(a.dist/(STRIDE_M*0.7))%SP.POSES.walk; }
    else if (mv==='jog' || mv==='run' || mv==='sprint'){ pose = 'run'; frame = Math.floor(a.dist/(STRIDE_M*0.75))%SP.POSES.run; }
    if (r.signal==='yellow' || r.signal==='red') pose = 'card';
    else if (r.signal==='whistle') pose = 'whistle';
    else if (r.signal==='goal') pose = 'point';
    return { pose, frame };
  }

  // Draw-order depth for something on the ground at (X, Y) metres. Normally X + Y, but anyone in the
  // goalmouth in front of the X=105 goal is lifted above that whole goal: its net is nearer the viewer
  // than its line, and seeing a keeper through the mesh reads as "inside the net".
  const ZONE = { depth: 3.5, half: 5.0 };
  function goalmouthDepth(X, Y){
    const g = STAD.goalGeometry(1);
    if (X < g.gx && X > g.gx - ZONE.depth && Math.abs(Y - g.cy) < ZONE.half) return g.frontDepth + 0.02 + (X + Y - g.gx - g.cy)*0.001;
    return PR.depth(X, Y);
  }

  // the world angle from a player towards a point (normalised scene coordinates), in metre space
  const angleTo = (pl, pt) => Math.atan2((pt.y - pl.y)*DIM.W, (pt.x - pl.x)*DIM.L);

  // one actor (player or referee) -> item
  function actorItem(kind, pl, kit, variant, st, t, cam, spr){
    const a = st.anim[kind+':'+(pl.id||'ref')] || (st.anim[kind+':'+(pl.id||'ref')] = { dir:'S', dist:0, lx: pl.x, ly: pl.y });
    const moved = Math.hypot((pl.x - a.lx)*DIM.L, (pl.y - a.ly)*DIM.W); if (moved < 3) a.dist += moved; a.lx = pl.x; a.ly = pl.y;
    const act = pl.action||'none';
    if (pl.aim && (act==='pass' || act==='shoot' || act==='volley' || act==='header' || act==='dive' || act==='catch' || act==='tackle' || act==='block' || act==='receive') && Math.hypot((pl.aim.x - pl.x)*DIM.L, (pl.aim.y - pl.y)*DIM.W) > 0.4){
      a.dir = PR.dir8(angleTo(pl, pl.aim), a.dir, 0.05);         // face the ball for a kick, a trap, a block; fly towards it for a dive or a slide
    } else if (pl.facingAngle!==undefined && (pl.speedMs > 0.2 || act!=='none')) a.dir = PR.dir8(pl.facingAngle, a.dir, HYST);
    const dv = (pl.actionDetail && pl.actionDetail.variant)||0;
    if (act==='booked' || act==='dismay' || (act==='celebrate' && (dv===0 || dv===3))) a.dir = 'S';
    else if (act==='celebrate' && dv===2 && (pl.actionPhase||0) >= 0.45 && pl.aim){ a.dir = PR.dir8(angleTo(pl, pl.aim), a.dir, 0.05); }   // the knee slide faces the crowd
    const { pose, frame, lift } = kind==='ref'? refPose(pl, a) : poseFor(pl, a, t);
    const k = kind==='ref' && pose==='card'? Object.assign({}, kit, { card: pl.signal }) : kit;
    const m = PR.toMetres(pl.x, pl.y); const g = PR.project(m.X, m.Y, 0, cam); const p = lift? PR.project(m.X, m.Y, lift, cam) : g;
    const sprite = (MD.isoAssets && MD.isoAssets.get(k, variant, a.dir, pose, frame, spr)) || SP.get(k, variant, a.dir, pose, frame, spr);
    return { kind, key: kind+':'+(pl.id||'ref'), pl, depth: goalmouthDepth(m.X, m.Y), sx: Math.round(p.sx), sy: Math.round(p.sy), gsx: Math.round(g.sx), gsy: Math.round(g.sy), lift: lift||0, sprite, dir: a.dir, pose };
  }

  function build(scene, teams, st, now, cam, spr){
    const items = [], shadows = []; const t = scene.t||0;
    const home = teams.home, away = teams.away;
    let carrier = null;
    for (const pl of scene.players){
      if (pl.sentOff) continue;                                 // off the pitch: not drawn
      const kit = pl.teamId===home.id? home.kit : away.kit;
      const gk = pl.role==='GK'? { primary: kit.secondary, secondary: kit.primary, pattern:'plain', gk:true } : kit;
      const it = actorItem('player', pl, gk, SP.variantFor(pl.id), st, t, cam, spr);
      items.push(it); shadows.push({ sx: it.gsx, sy: it.gsy, w: 0.9, ring: !!pl.hasBall });
      if (pl.hasBall) carrier = it;
    }
    if (scene.ref){ const it = actorItem('ref', scene.ref, SP.REF_KIT, { skin:1, hair:0, style:1 }, st, t, cam, spr); items.push(it); shadows.push({ sx: it.gsx, sy: it.gsy, w: 0.9 }); }
    // the ball: shadow at its ground point, the ball itself lifted by its height. A controlled ball sits a
    // touch ahead of its owner's feet along his heading so it shows at the front foot.
    const b = scene.ball; let bm = PR.toMetres(b.x, b.y); const bz = Math.max(0, b.z||0)*PR.BALL_Z_M;
    if (carrier && b.state==='controlled' && b.carrierId===carrier.pl.id && carrier.pl.facingAngle!==undefined){ const ang = carrier.pl.facingAngle; bm = { X: bm.X + Math.cos(ang)*0.3, Y: bm.Y + Math.sin(ang)*0.3 }; }
    const bg = PR.project(bm.X, bm.Y, 0, cam), bp = PR.project(bm.X, bm.Y, bz, cam);
    shadows.push({ sx: Math.round(bg.sx), sy: Math.round(bg.sy), w: 0.5, ball: true });
    items.push({ kind:'ball', key:'ball', depth: goalmouthDepth(bm.X, bm.Y) + 0.06, sx: Math.round(bp.sx), sy: Math.round(bp.sy), gsx: Math.round(bg.sx), gsy: Math.round(bg.sy), z: bz });
    // goals
    for (const end of [0, 1]){ const g = STAD.goalGeometry(end); items.push({ kind:'goal', key:'goal'+end+'b', end, part:'back', depth: g.backDepth }); items.push({ kind:'goal', key:'goal'+end+'f', end, part:'front', depth: g.frontDepth }); }
    items.sort((p, q) => (p.depth - q.depth) || (p.key < q.key? -1 : p.key > q.key? 1 : 0));
    return { items, shadows };
  }

  MD.iso.actors = { build, poseFor, refPose, goalmouthDepth, STRIDE_M, HYST, ZONE, JUMP };
})(typeof window!=='undefined'? window : globalThis);
