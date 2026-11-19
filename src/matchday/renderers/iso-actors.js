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
  const JUMP = { base: 0.1, maxExtra: 0.6, headHeight: 1.82 };
  // actions drawn standing: while the man is still travelling at a walk or faster he is drawn walking or running instead
  // (a receiver on his way to the ball, a teammate running to the celebration, the beaten side walking back), and the
  // action pose takes over when he has slowed to take it
  const STANDING = { receive: true, set: true, celebrate: true, dismay: true, booked: true, block: true, getup: true };
  function poseFor(pl, a, t){
    let pose = 'idle', frame = 0, lift = 0;
    const mv = pl.movement || 'idle';
    const runFrame = n => Math.floor(a.dist/(STRIDE_M*0.75))%n;
    if (mv==='walk'){ pose = 'walk'; frame = Math.floor(a.dist/(STRIDE_M*0.7))%SP.POSES.walk; }
    else if (mv==='jog' || mv==='run' || mv==='sprint'){ pose = 'run'; frame = runFrame(SP.POSES.run); }
    const ph = pl.actionPhase||0; const d = pl.actionDetail||{}; const v = d.variant||0;
    const moving = (pl.speedMs||0) >= 0.7;
    const act = pl.action||'none'; const dv = (pl.actionDetail && pl.actionDetail.variant)||0;
    if (STANDING[act] && moving && !(act==='celebrate' && (dv===1 || dv===2)) && !(act==='block' && pl.actionDetail && pl.actionDetail.slide)){
      if (act==='celebrate'){ pose = 'runcheer'; frame = runFrame(SP.POSES.runcheer); }      // on his way to the huddle, arms up
      return { pose, frame, lift };
    }
    switch (pl.action){
      // the kick cue runs from half a second before the ball leaves to a third of a second after, so the ball leaves at
      // phase 0.59: the wind-up until just before that, the contact frame as it goes, then the follow-through
      case 'pass': case 'shoot': pose = pl.action==='pass'? 'kick' : 'shoot'; frame = ph < 0.55? 0 : ph < 0.74? 1 : ph < 0.9? 2 : 3; break;
      case 'volley': pose = 'volley'; frame = ph < 0.35? 0 : ph < 0.7? 1 : 2; break;
      case 'header': {
        pose = 'header'; frame = ph < 0.3? 0 : ph < 0.72? 1 : 2;
        const ballZ = (d.z||0)*PR.BALL_Z_M;                     // metres; the head of the jump frame is at 1.82 m standing
        const h = Math.max(JUMP.base, Math.min(JUMP.maxExtra + JUMP.base, ballZ - JUMP.headHeight));   // so the head meets the ball
        lift = h*Math.max(0, Math.sin(Math.PI*Math.min(1, ph)));   // the apex is the contact, at phase 0.5
        break;
      }
      case 'receive': pose = 'receive'; frame = ph < 0.45? 0 : 1; break;
      case 'tackle': if (d.slide===false){ pose = 'poke'; } else { pose = 'slide'; frame = ph < 0.3? 0 : 1; } break;
      case 'block': if (d.slide){ pose = 'slide'; frame = ph < 0.35? 0 : 1; } else pose = 'block'; break;
      // the dive cue runs from half a second before the ball arrives to 0.8 s after (the ball arrives at phase 0.385): he is
      // set until a quarter of a second before it, springs, is at full stretch as it arrives, and is down a third of a second later
      case 'dive': if (d.parry){ const low = (d.z||0)*PR.BALL_Z_M < 0.9; pose = ph < 0.18? 'set' : 'parry'; frame = (low || ph >= 0.62)? 1 : 0; } else { pose = 'dive'; frame = ph < 0.2? 0 : ph < 0.62? 1 : 2; } break;   // a low shot is parried low, along the ground
      case 'catch': {                                             // reach for a high ball, gather one at the chest, crouch for one along the ground
        const zm = (d.z||0)*PR.BALL_Z_M;
        if (zm < 0.8){ pose = ph < 0.4? 'set' : 'catch'; frame = 1; }
        else if (zm < 1.45){ pose = 'catch'; frame = 1; }
        else { pose = 'catch'; frame = ph < 0.5? 0 : 1; }
        break;
      }
      case 'set': pose = 'set'; break;
      case 'getup': pose = 'getup'; frame = ph < 0.5? 0 : 1; break;
      case 'celebrate': {
        // variants: arms aloft (0), running to the crowd (1), the knee slide (2), the group hug (3)
        if (v===1 || (v===2 && ph < 0.45)){ if ((pl.speedMs||0) < 0.5){ pose = 'celebrate'; frame = Math.floor((t||0)*3)%2; } else { pose = 'runcheer'; frame = runFrame(SP.POSES.runcheer); } }   // arms up on the spot once he has stopped
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
    // the distance he has covered drives his leg frames; a placement (a cut to a restart, a seek) is not a stride, but a
    // long step at a high fast-forward rate is (it used to be dropped past three metres, which froze the legs of a sprinter
    // at the fastest playback)
    const moved = Math.hypot((pl.x - a.lx)*DIM.L, (pl.y - a.ly)*DIM.W); if (!st.sceneCut && moved < 12) a.dist += moved; a.lx = pl.x; a.ly = pl.y;
    const act = pl.action||'none';
    if (pl.aim && (act==='pass' || act==='shoot' || act==='volley' || act==='header' || act==='dive' || act==='catch' || act==='tackle' || act==='block' || act==='receive') && Math.hypot((pl.aim.x - pl.x)*DIM.L, (pl.aim.y - pl.y)*DIM.W) > 0.4){
      a.dir = PR.dir8(angleTo(pl, pl.aim), a.dir, 0.05);         // face the ball for a kick, a trap, a block; fly towards it for a dive or a slide
    } else if (pl.facingAngle!==undefined && (pl.speedMs > 0.2 || act!=='none')) a.dir = PR.dir8(pl.facingAngle, a.dir, HYST);
    const dv = (pl.actionDetail && pl.actionDetail.variant)||0;
    if (act==='booked' || act==='dismay' || (act==='celebrate' && (dv===0 || dv===3))) a.dir = 'S';
    else if (act==='celebrate' && dv===2 && (pl.actionPhase||0) >= 0.45 && pl.aim){ a.dir = PR.dir8(angleTo(pl, pl.aim), a.dir, 0.05); }   // the knee slide faces the crowd
    const pf = kind==='ref'? refPose(pl, a) : poseFor(pl, a, t); const pose = pf.pose, lift = pf.lift;
    // a pose is asked for by a frame it has: an action taken while walking or running came with the stride's frame, which a
    // one-frame pose (set, poke, block, booked, kneel, the referee's card) does not have, so the painted picture was not
    // found and the generated figure was drawn for those moments (found by tools/hair-audit.js, fixed in 1.7.1)
    const frame = (pf.frame||0) % (SP.POSES[pose]||1);
    const k = kind==='ref' && pose==='card'? Object.assign({}, kit, { card: pl.signal }) : kit;
    const m = PR.toMetres(pl.x, pl.y); const g = PR.project(m.X, m.Y, 0, cam); const p = lift? PR.project(m.X, m.Y, lift, cam) : g;
    const sprite = (MD.isoAssets && MD.isoAssets.get(k, variant, a.dir, pose, frame, spr)) || SP.get(k, variant, a.dir, pose, frame, spr);
    return { kind, key: kind+':'+(pl.id||'ref'), pl, depth: goalmouthDepth(m.X, m.Y), sx: Math.round(p.sx), sy: Math.round(p.sy), gsx: Math.round(g.sx), gsy: Math.round(g.sy), lift: lift||0, sprite, dir: a.dir, pose };
  }

  // Who wears what. The two sides wear the kits the presentation gives them. Each goalkeeper and the referee are dressed
  // here, for this match, so that nobody can be mistaken for anybody else. The referee wears black unless a shirt on the
  // pitch is dark. Each keeper wears the first colour of a short list that stands clear of the opposing side's shirt
  // above all, then of his own side's, the referee and the grass, and that differs from the other keeper's. Distances
  // are the same plain measure the kit-clash rule uses (110 apart is the game's line between two shirts being alike).
  const KEEPER_COLOURS = ['#F2C200', '#9AA0A6', '#F28C28', '#35B7E8', '#8A4FD0', '#E85D9A', '#C4E538', '#0FB5AE', '#F4F4F4', '#B0123B', '#1D3F8F', '#5B3A29'];   // yellow, grey, orange, sky, purple, pink, lime, teal, white, crimson, royal blue, brown
  const REFEREE_COLOURS = ['#1A1A1A', '#7B1E3A', '#C9CDD2', '#6A3FA0', '#E46A1F', '#F0F0F0', '#D9A400', '#E85D9A'];   // black, maroon, silver, purple, orange, white, gold, pink
  const GRASS_COLOUR = '#3C9A46'; const NEAR = 110;
  const rgbOf = c => MD.rgbOf? MD.rgbOf(c) : [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));   // club colours come as #rrggbb or hsl()
  const apart = (a, b) => { const x = rgbOf(a), y = rgbOf(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  // the first colour in the list that keeps every required distance; failing that, the one that comes nearest to doing so
  const clearest = (list, needs) => { let best = list[0], bestS = -1; for (const c of list){ let sc = Infinity; for (const [o, d] of needs) sc = Math.min(sc, apart(c, o)/d); if (sc >= 1) return c; if (sc > bestS){ bestS = sc; best = c; } } return best; };
  const kitMemo = typeof WeakMap!=='undefined'? new WeakMap() : null;
  function kitsFor(teams){
    let k = kitMemo && kitMemo.get(teams); if (k) return k;
    const shirts = c => (MD.shirtColours? MD.shirtColours(c) : [c.primary]); const hs = shirts(teams.home.kit), as = shirts(teams.away.kit);
    const ref = clearest(REFEREE_COLOURS, hs.concat(as).map(c => [c, NEAR]).concat([[GRASS_COLOUR, 100]]));
    const keeperOf = (own, opp, other) => clearest(KEEPER_COLOURS, opp.map(c => [c, NEAR]).concat(own.map(c => [c, 90]), [[ref, 90], [GRASS_COLOUR, 100]], other? [[other, 70]] : []));
    const hg = keeperOf(hs, as, null), ag = keeperOf(as, hs, hg);
    const keeper = c => ({ primary: c, secondary: '#1F2A44', pattern:'plain', gk: true });
    k = { home: teams.home.kit, away: teams.away.kit, homeGK: keeper(hg), awayGK: keeper(ag), ref: ref===SP.REF_KIT.primary? SP.REF_KIT : { primary: ref, secondary: '#F2F2F2', pattern:'plain' } };
    if (kitMemo) kitMemo.set(teams, k); return k;
  }

  function build(scene, teams, st, now, cam, spr){
    const items = [], shadows = []; const t = scene.t||0;
    const home = teams.home, away = teams.away; const kits = kitsFor(teams);
    let carrier = null;
    for (const pl of scene.players){
      if (pl.sentOff) continue;                                 // off the pitch: not drawn
      const kit = pl.teamId===home.id? home.kit : away.kit;
      const gk = pl.role==='GK'? (pl.teamId===home.id? kits.homeGK : kits.awayGK) : kit;
      const it = actorItem('player', pl, gk, SP.variantFor(pl.id), st, t, cam, spr);
      items.push(it); shadows.push({ sx: it.gsx, sy: it.gsy, w: 0.9, ring: !!pl.hasBall });
      if (pl.hasBall) carrier = it;
    }
    if (scene.ref){ const it = actorItem('ref', scene.ref, kits.ref, { skin:1, hair:0, style:1 }, st, t, cam, spr); items.push(it); shadows.push({ sx: it.gsx, sy: it.gsy, w: 0.9 }); }
    // the ball: shadow at its ground point, the ball itself lifted by its height (the scene already puts a controlled
    // ball a touch ahead of its owner's feet, and blends it onto the spot it is struck from or lost at)
    const b = scene.ball; const bm = PR.toMetres(b.x, b.y); const bz = Math.max(0, b.z||0)*PR.BALL_Z_M;
    const bg = PR.project(bm.X, bm.Y, 0, cam), bp = PR.project(bm.X, bm.Y, bz, cam);
    shadows.push({ sx: Math.round(bg.sx), sy: Math.round(bg.sy), w: 0.5, ball: true });
    // a ball in the air at a man's hands or head is drawn in front of him, not hidden behind his sprite (a lift of the
    // draw order by a stride of depth); on the ground it sorts with everything else
    items.push({ kind:'ball', key:'ball', depth: goalmouthDepth(bm.X, bm.Y) + (bz > 0.5? 1.2 : 0.06), sx: Math.round(bp.sx), sy: Math.round(bp.sy), gsx: Math.round(bg.sx), gsy: Math.round(bg.sy), z: bz });
    // goals
    if (STAD.nearPylons) STAD.nearPylons().forEach((q, i) => items.push({ kind:'pylon', key:'pylon'+i, X: q.X, Y: q.Y, depth: q.depth }));   // the near corners' floodlights, in front of the near terrace
    for (const end of [0, 1]){ const g = STAD.goalGeometry(end); items.push({ kind:'goal', key:'goal'+end+'b', end, part:'back', depth: g.backDepth }); items.push({ kind:'goal', key:'goal'+end+'f', end, part:'front', depth: g.frontDepth }); }
    items.sort((p, q) => (p.depth - q.depth) || (p.key < q.key? -1 : p.key > q.key? 1 : 0));
    return { items, shadows };
  }

  MD.iso.actors = { build, poseFor, refPose, goalmouthDepth, kitsFor, KEEPER_COLOURS, REFEREE_COLOURS, STRIDE_M, HYST, ZONE, JUMP };
})(typeof window!=='undefined'? window : globalThis);
