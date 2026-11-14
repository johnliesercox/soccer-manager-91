// ============================================================================
//  Matchday: isometric sprites (Phase 3, Milestone 2)
//  Original eight-direction footballers drawn in code. A figure is a small
//  skeleton in its own metres (forward, sideways, up) posed by a pose
//  function (run cycle, kick, dive, slide, celebrate and so on), dressed in
//  capsules and discs (head, hair, torso, arms, shorts, legs, boots), turned
//  to a world heading, pushed through the same dimetric projection as the
//  pitch (iso-projection.js), sorted by depth and rasterised into whole
//  pixels with two-tone shading and a one-pixel outline. No bitmap is ever
//  mirrored or rotated: a figure facing away shows the back of his head.
//
//  Matchday.isoSprites.get(kit, variant, dir, pose, frame, spr) returns a
//  cached canvas with .feet (anchor row) and .spr; dir is one of the eight
//  screen headings ('S' faces the viewer); variant {skin, hair, style} comes
//  from variantFor(id) so a player looks the same in every renderer; kit may
//  carry pattern 'plain' | 'stripes' | 'hoops' | 'halves' | 'quarters' and
//  gk: true for gloves. POSES lists every pose and its frame count.
// ============================================================================
(function(root){
  const MD = root.Matchday;
  const PR = MD.iso.projection;
  const SPR = 12;                                  // default pixels per metre (the phone follow scale)
  const SKINS = MD.sprites.SKINS, HAIRS = MD.sprites.HAIRS;
  const REF_KIT = { primary:'#1A1A1A', secondary:'#F2F2F2', pattern:'plain' };
  let createCanvas = (w, h) => { const c = root.document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const cache = new Map(); const CACHE_MAX = 2400;
  // The first fifteen poses are the Milestone 2A set; the Milestone 3B set follows (appended, so the sheet rows of the
  // painted frames keep their places): the header with its jump, the volley, a standing poke tackle, the keeper's
  // catch, parry and recovery, and the reactions (knee slide, running celebration, group hug, head in hands,
  // kneeling, appealing).
  const POSES = { idle:1, walk:4, run:6, kick:4, shoot:4, receive:2, slide:2, block:1, dive:3, set:1, celebrate:2, booked:1, whistle:1, card:1, point:1,
    header:3, volley:3, poke:1, catch:2, parry:2, getup:2, kneeslide:2, runcheer:4, hug:2, dismay:1, kneel:1, appeal:1 };
  const WIDE = { slide:1, dive:1, parry:1, point:0 };       // poses that stretch along the ground need a wider cell

  // cell size and ground anchor row for a scale (and a wide pose)
  function cell(spr, pose){ const wide = !!WIDE[pose]; const W = Math.round((wide? 4.6 : 2.9)*spr), H = Math.round(3.1*spr); return { W, H, FEET: H - Math.max(2, Math.round(spr*0.25)) }; }

  // the world heading whose screen direction is the centre of each eight-way sector
  const HEADING = {};
  (function(){
    for (let i=0;i<PR.DIRS.length;i++){
      const want = i*Math.PI/4; let best = 0, bd = 1e9;
      for (let k=0;k<720;k++){ const a = k/720*Math.PI*2; const v = PR.screenVector(a); const d = PR.angleDiff(Math.atan2(v.dy, v.dx), want); if (d < bd){ bd = d; best = a; } }
      HEADING[PR.DIRS[i]] = best;
    }
  })();

  // ---- the skeleton: joints in (forward, side, up) metres, stylised 16-bit proportions ----
  function skeleton(){
    return {
      footL:[0,-0.12,0.05], footR:[0,0.12,0.05], kneeL:[0,-0.11,0.5], kneeR:[0,0.11,0.5], hipL:[0,-0.11,0.95], hipR:[0,0.11,0.95],
      pelvis:[0,0,0.93], chest:[0,0,1.36], neck:[0,0,1.56], head:[0.03,0,1.77],
      shL:[0,-0.29,1.47], shR:[0,0.29,1.47], elL:[0.02,-0.32,1.2], elR:[0.02,0.32,1.2], handL:[0.06,-0.3,0.98], handR:[0.06,0.3,0.98],
      lean:0, headTilt:0,
    };
  }
  const lerp = (a, b, u) => a + (b - a)*u;
  // bend a leg: the foot goes to (f, z) and the knee follows a little ahead of the straight line
  function leg(j, side, f, z, kneeAhead){ const hip = j['hip'+side]; j['foot'+side] = [f, hip[1], z]; j['knee'+side] = [(hip[0]+f)/2 + (kneeAhead||0), hip[1], (hip[2]+z)/2 + 0.02]; }
  function arm(j, side, f, s, z, elF, elS, elZ){ j['hand'+side] = [f, s, z]; j['el'+side] = [elF, elS, elZ]; }
  function leanBody(j, f, dz){ for (const k of ['pelvis','chest','neck','head','shL','shR','elL','elR','handL','handR']) { j[k][0] += f*(j[k][2]/1.5); j[k][2] += dz||0; } }

  function pose(name, frame){
    const j = skeleton();
    const ph = (frame/(POSES[name]||1))*Math.PI*2;
    switch (name){
      case 'run': {                                           // six frames: a stride each way with a lift on the swing
        const sw = Math.sin(ph), lift = v => 0.16*Math.max(0, v);
        leg(j, 'L', 0.34*sw, 0.05 + lift(sw), 0.08*Math.max(0, sw)); leg(j, 'R', -0.34*sw, 0.05 + lift(-sw), 0.08*Math.max(0, -sw));
        arm(j, 'L', -0.28*sw + 0.05, -0.3, 1.1 + 0.08*Math.abs(sw), -0.12*sw + 0.02, -0.33, 1.25);
        arm(j, 'R', 0.28*sw + 0.05, 0.3, 1.1 + 0.08*Math.abs(sw), 0.12*sw + 0.02, 0.33, 1.25);
        leanBody(j, 0.1, 0.02*Math.abs(Math.cos(ph)));
        break; }
      case 'walk': {
        const sw = Math.sin(ph);
        leg(j, 'L', 0.16*sw, 0.05 + 0.05*Math.max(0, sw)); leg(j, 'R', -0.16*sw, 0.05 + 0.05*Math.max(0, -sw));
        arm(j, 'L', -0.1*sw + 0.05, -0.3, 0.98, -0.04*sw + 0.02, -0.32, 1.2); arm(j, 'R', 0.1*sw + 0.05, 0.3, 0.98, 0.04*sw + 0.02, 0.32, 1.2);
        break; }
      case 'kick': case 'shoot': {                           // wind-up, contact, follow-through, recover (right foot)
        const big = name==='shoot'? 1.25 : 1;
        if (frame===0){ leg(j, 'R', -0.42*big, 0.28*big, -0.1); leanBody(j, -0.06, 0); arm(j, 'L', 0.2, -0.45, 1.3, 0.1, -0.42, 1.3); arm(j, 'R', -0.15, 0.4, 1.15, -0.1, 0.38, 1.25); }
        else if (frame===1){ leg(j, 'R', 0.42*big, 0.18, 0.1); leanBody(j, 0.04, 0); arm(j, 'L', 0.3, -0.48, 1.25, 0.15, -0.42, 1.3); arm(j, 'R', -0.2, 0.38, 1.1, -0.1, 0.36, 1.25); }
        else if (frame===2){ leg(j, 'R', 0.5*big, 0.55*big, 0.15); leanBody(j, -0.08, 0); arm(j, 'L', 0.25, -0.5, 1.35, 0.1, -0.45, 1.35); arm(j, 'R', -0.25, 0.35, 1.05, -0.15, 0.36, 1.2); }
        else { leg(j, 'R', 0.18, 0.1, 0.05); arm(j, 'L', 0.08, -0.34, 1.05, 0.04, -0.33, 1.22); }
        break; }
      case 'receive': {                                        // foot up to meet the ball, then the trap
        if (frame===0){ leg(j, 'R', 0.32, 0.3, 0.12); leanBody(j, 0.06, 0); arm(j, 'L', 0.1, -0.42, 1.15, 0.05, -0.38, 1.28); arm(j, 'R', 0.1, 0.42, 1.15, 0.05, 0.38, 1.28); }
        else { leg(j, 'R', 0.3, 0.08, 0.1); leanBody(j, 0.08, 0); arm(j, 'L', 0.1, -0.38, 1.1, 0.05, -0.36, 1.25); arm(j, 'R', 0.1, 0.38, 1.1, 0.05, 0.36, 1.25); }
        break; }
      case 'slide': {                                          // on the ground along the heading, one leg out
        const u = frame===0? 0.6 : 1.0;                        // frame 0 is still going down
        j.pelvis = [0, 0, 0.32*u + 0.2*(1-u)]; j.chest = [-0.42*u, 0, 0.5*u + 0.9*(1-u)]; j.neck = [-0.62*u, 0, 0.6*u + 1.1*(1-u)]; j.head = [-0.78*u, 0, 0.72*u + 1.3*(1-u)];
        j.hipL = [0, -0.11, 0.3*u + 0.2*(1-u)]; j.hipR = [0, 0.11, 0.3*u + 0.2*(1-u)];
        j.footR = [0.85, 0.12, 0.08]; j.kneeR = [0.42, 0.12, 0.22]; j.footL = [-0.25, -0.2, 0.08]; j.kneeL = [0.05, -0.2, 0.3];
        j.shL = [-0.45*u, -0.26, 0.6*u + 1.0*(1-u)]; j.shR = [-0.45*u, 0.26, 0.6*u + 1.0*(1-u)];
        j.elL = [-0.3, -0.42, 0.3]; j.handL = [-0.1, -0.5, 0.06]; j.elR = [-0.2, 0.4, 0.75]; j.handR = [0.1, 0.45, 0.95];
        break; }
      case 'dive': {                                           // launch, full stretch in the air, down on the ground
        const z = frame===0? 0.5 : frame===1? 0.95 : 0.28; const str = frame===0? 0.55 : 1;
        j.pelvis = [0.1*str, 0, z]; j.chest = [0.5*str, 0, z + 0.08*str]; j.neck = [0.7*str, 0, z + 0.1*str]; j.head = [0.9*str, 0, z + 0.12*str];
        j.hipL = [0.05, -0.11, z - 0.02]; j.hipR = [0.05, 0.11, z - 0.02];
        j.kneeL = [-0.3*str, -0.14, z - 0.1*str + (frame===0? -0.25 : 0)]; j.footL = [-0.6*str, -0.16, z - 0.15*str + (frame===0? -0.4 : 0)];
        j.kneeR = [-0.25*str, 0.14, z - 0.05*str + (frame===0? -0.3 : 0)]; j.footR = [-0.5*str, 0.18, z - 0.1*str + (frame===0? -0.45 : 0)];
        j.shL = [0.6*str, -0.26, z + 0.05*str]; j.shR = [0.6*str, 0.26, z + 0.05*str];
        j.elL = [0.95*str, -0.22, z + 0.12*str]; j.handL = [1.3*str, -0.15, z + 0.18*str]; j.elR = [0.95*str, 0.22, z + 0.12*str]; j.handR = [1.3*str, 0.15, z + 0.18*str];
        break; }
      case 'block': {                                          // braced, legs apart, arms spread
        j.footL = [0.05, -0.3, 0.05]; j.footR = [0.05, 0.3, 0.05]; j.kneeL = [0.08, -0.25, 0.45]; j.kneeR = [0.08, 0.25, 0.45];
        for (const k of ['pelvis','chest','neck','head','shL','shR']) j[k][2] -= 0.12;
        arm(j, 'L', 0.1, -0.62, 1.05, 0.05, -0.5, 1.28); arm(j, 'R', 0.1, 0.62, 1.05, 0.05, 0.5, 1.28); leanBody(j, 0.06, 0);
        break; }
      case 'set': {                                            // the keeper's crouch, arms out low
        j.footL = [0.05, -0.24, 0.05]; j.footR = [0.05, 0.24, 0.05]; j.kneeL = [0.15, -0.22, 0.42]; j.kneeR = [0.15, 0.22, 0.42];
        for (const k of ['pelvis','chest','neck','head','shL','shR']) j[k][2] -= 0.2;
        arm(j, 'L', 0.3, -0.48, 0.72, 0.15, -0.46, 0.98); arm(j, 'R', 0.3, 0.48, 0.72, 0.15, 0.46, 0.98); leanBody(j, 0.12, 0);
        break; }
      case 'celebrate': {
        if (frame===0){ arm(j, 'L', 0.05, -0.36, 2.05, 0.03, -0.4, 1.75); arm(j, 'R', 0.05, 0.36, 2.05, 0.03, 0.4, 1.75); }
        else { arm(j, 'L', 0.05, -0.34, 2.1, 0.03, -0.4, 1.78); arm(j, 'R', 0.2, 0.42, 1.2, 0.1, 0.4, 1.3); for (const k of Object.keys(j)) if (Array.isArray(j[k])) j[k][2] += 0.1; }
        break; }
      case 'booked': { arm(j, 'L', 0.05, -0.3, 0.98, 0.02, -0.46, 1.15); arm(j, 'R', 0.05, 0.3, 0.98, 0.02, 0.46, 1.15); j.head[0] += 0.04; break; }   // hands on hips
      case 'whistle': { arm(j, 'R', 0.18, 0.06, 1.7, 0.2, 0.36, 1.35); break; }
      case 'card': { arm(j, 'R', 0.05, 0.28, 2.15, 0.03, 0.34, 1.8); break; }
      case 'point': { arm(j, 'R', 0.6, 0.25, 1.45, 0.3, 0.3, 1.45); break; }
      // ---- Milestone 3B ----
      case 'header': {                                         // crouch to jump, the leap with the head thrown at the ball, landing
        if (frame===0){
          j.footL = [0, -0.14, 0.05]; j.footR = [0.05, 0.14, 0.05]; j.kneeL = [0.18, -0.13, 0.42]; j.kneeR = [0.2, 0.13, 0.42];
          for (const k of ['pelvis','chest','neck','head','shL','shR']) j[k][2] -= 0.18;
          leanBody(j, 0.08, 0); arm(j, 'L', -0.3, -0.34, 0.9, -0.15, -0.36, 1.1); arm(j, 'R', -0.3, 0.34, 0.9, -0.15, 0.36, 1.1);
        } else if (frame===1){                                 // the jump itself is added by the renderer, timed to the ball
          j.footL = [-0.2, -0.14, 0.32]; j.footR = [-0.12, 0.16, 0.26]; j.kneeL = [0.1, -0.13, 0.58]; j.kneeR = [0.16, 0.14, 0.52];
          for (const k of ['pelvis','chest','neck','head','shL','shR']) j[k][2] += 0.1;
          j.neck[0] += 0.1; j.head[0] += 0.24; j.head[2] -= 0.05;
          arm(j, 'L', -0.22, -0.5, 1.3, -0.1, -0.46, 1.42); arm(j, 'R', -0.22, 0.5, 1.3, -0.1, 0.46, 1.42);
        } else {
          j.kneeL = [0.1, -0.12, 0.44]; j.kneeR = [0.1, 0.12, 0.44];
          for (const k of ['pelvis','chest','neck','head','shL','shR']) j[k][2] -= 0.1;
          arm(j, 'L', 0.1, -0.55, 1.05, 0.05, -0.46, 1.25); arm(j, 'R', 0.1, 0.55, 1.05, 0.05, 0.46, 1.25);
        }
        break; }
      case 'volley': {                                         // the leg swung back and high, the horizontal contact, the high follow-through
        if (frame===0){ leg(j, 'R', -0.45, 0.45, -0.15); leanBody(j, 0.05, 0); arm(j, 'L', 0.35, -0.42, 1.4, 0.15, -0.42, 1.35); arm(j, 'R', -0.25, 0.4, 1.1, -0.15, 0.38, 1.25); }
        else if (frame===1){ leg(j, 'R', 0.6, 0.68, 0.22); leanBody(j, -0.16, -0.05); arm(j, 'L', 0.15, -0.6, 1.3, 0.05, -0.5, 1.35); arm(j, 'R', -0.3, 0.45, 1.05, -0.15, 0.4, 1.2); }
        else { leg(j, 'R', 0.35, 0.95, 0.3); leanBody(j, -0.22, -0.08); arm(j, 'L', 0.2, -0.6, 1.25, 0.05, -0.5, 1.3); arm(j, 'R', -0.2, 0.55, 1.15, -0.1, 0.45, 1.25); }
        break; }
      case 'poke': {                                           // a standing tackle: one leg stretched low at the ball, body low and forward
        leg(j, 'R', 0.72, 0.08, 0.28); j.footL = [-0.15, -0.12, 0.05]; j.kneeL = [0.0, -0.12, 0.4];
        for (const k of ['pelvis','chest','neck','head','shL','shR']) j[k][2] -= 0.22;
        leanBody(j, 0.26, 0); arm(j, 'L', 0.35, -0.4, 0.95, 0.15, -0.4, 1.1); arm(j, 'R', -0.3, 0.38, 1.0, -0.15, 0.38, 1.15);
        break; }
      case 'catch': {                                          // arms up and forward to meet the ball, then clutched to the chest
        if (frame===0){ arm(j, 'L', 0.46, -0.16, 1.78, 0.28, -0.34, 1.5); arm(j, 'R', 0.46, 0.16, 1.78, 0.28, 0.34, 1.5); j.kneeL = [0.1, -0.12, 0.46]; j.kneeR = [0.1, 0.12, 0.46]; for (const k of ['pelvis','chest','neck','head','shL','shR']) j[k][2] -= 0.06; }
        else { arm(j, 'L', 0.26, -0.08, 1.18, 0.2, -0.32, 1.12); arm(j, 'R', 0.26, 0.08, 1.18, 0.2, 0.32, 1.12); leanBody(j, 0.1, -0.08); j.head[0] += 0.05; j.head[2] -= 0.05; }
        break; }
      case 'parry': {                                          // a dive with one hand thrown at the ball, then down
        const z = frame===0? 0.92 : 0.3; const str = 1;
        j.pelvis = [0.1, 0, z]; j.chest = [0.5, 0, z + 0.08]; j.neck = [0.7, 0, z + 0.1]; j.head = [0.9, 0, z + 0.12];
        j.hipL = [0.05, -0.11, z - 0.02]; j.hipR = [0.05, 0.11, z - 0.02];
        j.kneeL = [-0.3, -0.14, z - 0.1]; j.footL = [-0.6, -0.16, z - 0.15]; j.kneeR = [-0.25, 0.14, z - 0.05]; j.footR = [-0.5, 0.18, z - 0.1];
        j.shL = [0.6, -0.26, z + 0.05]; j.shR = [0.6, 0.26, z + 0.05];
        j.elR = [0.95, 0.2, z + 0.3]; j.handR = [1.25, 0.12, z + 0.55];     // the saving hand, up and forward
        j.elL = [0.55, -0.4, z - 0.15]; j.handL = [0.35, -0.5, z - 0.3];    // the other arm trails
        if (frame===1){ j.handR = [1.3, 0.12, z + 0.12]; j.elR = [0.98, 0.2, z + 0.1]; }
        break; }
      case 'getup': {                                          // on hands and knees, then rising on one knee
        if (frame===0){
          j.pelvis = [0, 0, 0.56]; j.hipL = [0, -0.11, 0.54]; j.hipR = [0, 0.11, 0.54];
          j.kneeL = [0.0, -0.13, 0.12]; j.kneeR = [0.0, 0.13, 0.12]; j.footL = [-0.42, -0.13, 0.1]; j.footR = [-0.42, 0.13, 0.1];
          j.chest = [0.45, 0, 0.72]; j.neck = [0.65, 0, 0.8]; j.head = [0.82, 0, 0.88];
          j.shL = [0.5, -0.26, 0.74]; j.shR = [0.5, 0.26, 0.74]; j.elL = [0.65, -0.28, 0.4]; j.elR = [0.65, 0.28, 0.4]; j.handL = [0.8, -0.26, 0.05]; j.handR = [0.8, 0.26, 0.05];
        } else {
          j.pelvis = [0.02, 0, 0.68]; j.hipL = [0.02, -0.11, 0.66]; j.hipR = [0.02, 0.11, 0.66];
          j.kneeL = [-0.1, -0.12, 0.12]; j.footL = [-0.48, -0.12, 0.08]; j.footR = [0.36, 0.14, 0.05]; j.kneeR = [0.3, 0.14, 0.46];
          j.chest = [0.15, 0, 1.06]; j.neck = [0.2, 0, 1.26]; j.head = [0.26, 0, 1.46];
          j.shL = [0.15, -0.27, 1.16]; j.shR = [0.15, 0.27, 1.16]; j.elL = [0.2, -0.32, 0.92]; j.handL = [0.22, -0.3, 0.7]; j.elR = [0.3, 0.3, 0.9]; j.handR = [0.45, 0.2, 0.62];
        }
        break; }
      case 'kneeslide': {                                      // sliding on the knees, chest up, arms wide
        j.kneeL = [0.05, -0.13, 0.12]; j.kneeR = [0.05, 0.13, 0.12]; j.footL = [-0.45, -0.14, 0.12]; j.footR = [-0.45, 0.14, 0.12];
        j.pelvis = [0, 0, 0.6]; j.hipL = [0, -0.11, 0.6]; j.hipR = [0, 0.11, 0.6];
        j.chest = [0.05, 0, 1.0]; j.neck = [0.05, 0, 1.2]; j.head = [frame? -0.08 : -0.03, 0, frame? 1.42 : 1.4]; j.shL = [0.05, -0.28, 1.1]; j.shR = [0.05, 0.28, 1.1];
        if (frame===0){ j.elL = [0.08, -0.5, 1.1]; j.handL = [0.1, -0.75, 1.25]; j.elR = [0.08, 0.5, 1.1]; j.handR = [0.1, 0.75, 1.25]; }
        else { j.elL = [0.05, -0.5, 1.25]; j.handL = [0.05, -0.7, 1.58]; j.elR = [0.05, 0.5, 1.25]; j.handR = [0.05, 0.7, 1.58]; }
        break; }
      case 'runcheer': {                                       // running with both arms straight up
        const sw = Math.sin(ph), lift = v => 0.16*Math.max(0, v);
        leg(j, 'L', 0.34*sw, 0.05 + lift(sw), 0.08*Math.max(0, sw)); leg(j, 'R', -0.34*sw, 0.05 + lift(-sw), 0.08*Math.max(0, -sw));
        arm(j, 'L', 0.05, -0.58, 2.0, 0.03, -0.46, 1.68); arm(j, 'R', 0.05, 0.58, 2.0, 0.03, 0.46, 1.68);   // a wide V, unlike hands on the head
        leanBody(j, 0.06, 0.02*Math.abs(Math.cos(ph)));
        break; }
      case 'hug': {                                            // arms out to embrace, then the hop into it
        if (frame===0){ arm(j, 'L', 0.55, -0.36, 1.4, 0.3, -0.42, 1.4); arm(j, 'R', 0.55, 0.36, 1.4, 0.3, 0.42, 1.4); leanBody(j, 0.08, 0); }
        else { arm(j, 'L', 0.5, -0.12, 1.46, 0.3, -0.36, 1.42); arm(j, 'R', 0.5, 0.12, 1.46, 0.3, 0.36, 1.42); j.kneeL = [0.1, -0.12, 0.5]; j.kneeR = [0.1, 0.12, 0.5]; j.footL = [-0.05, -0.12, 0.14]; j.footR = [-0.05, 0.12, 0.14]; for (const k of ['pelvis','chest','neck','head','shL','shR']) j[k][2] += 0.1; }
        break; }
      case 'dismay': {                                         // both hands on the head, head down
        arm(j, 'L', 0.12, -0.1, 1.95, 0.1, -0.4, 1.65); arm(j, 'R', 0.12, 0.1, 1.95, 0.1, 0.4, 1.65); j.head[0] += 0.08; j.head[2] -= 0.06; leanBody(j, 0.06, 0);
        break; }
      case 'kneel': {                                          // on the knees, sat back, head down, hands on the thighs
        j.kneeL = [0.05, -0.13, 0.12]; j.kneeR = [0.05, 0.13, 0.12]; j.footL = [-0.4, -0.14, 0.1]; j.footR = [-0.4, 0.14, 0.1];
        j.pelvis = [-0.15, 0, 0.5]; j.hipL = [-0.15, -0.11, 0.5]; j.hipR = [-0.15, 0.11, 0.5];
        j.chest = [-0.05, 0, 0.9]; j.neck = [0, 0, 1.08]; j.head = [0.1, 0, 1.2]; j.shL = [-0.05, -0.27, 1.0]; j.shR = [-0.05, 0.27, 1.0];
        j.elL = [0.05, -0.3, 0.78]; j.handL = [0.2, -0.15, 0.55]; j.elR = [0.05, 0.3, 0.78]; j.handR = [0.2, 0.15, 0.55];
        break; }
      case 'appeal': {                                         // arms out wide, palms up, head back
        arm(j, 'L', 0.2, -0.72, 1.1, 0.1, -0.46, 1.26); arm(j, 'R', 0.2, 0.72, 1.1, 0.1, 0.46, 1.26); j.head[0] -= 0.05; j.head[2] += 0.02;
        break; }
      default: break;                                          // idle
    }
    return j;
  }

  // ---- dressing the skeleton: parts in depth order ----
  function figure(name, frame, opts){
    const j = pose(name, frame); const parts = [];
    const cap = (a, b, t, col, tag) => parts.push({ kind:'cap', a, b, t, col, tag });
    const disc = (c, r, col, tag) => parts.push({ kind:'disc', c, r, col, tag });
    const style = (opts && opts.style) || 0, gk = !!(opts && opts.gk);
    for (const s of ['L','R']){
      cap(j['hip'+s], j['knee'+s], 0.16, 'SHORTS');
      cap(j['knee'+s], j['foot'+s], 0.13, 'SOCKS');
      const k = j['knee'+s], f = j['foot'+s]; cap(k, [lerp(k[0],f[0],0.2), lerp(k[1],f[1],0.2), lerp(k[2],f[2],0.2)], 0.14, 'TRIM');   // sock top
      const toe = [f[0] + 0.14, f[1], f[2] - 0.02]; cap(f, toe, 0.12, 'BOOTS');
    }
    cap(j.pelvis, [j.pelvis[0], j.pelvis[1], j.pelvis[2] - 0.16], 0.44, 'SHORTS');
    cap(j.chest, j.pelvis, 0.46, 'SHIRT', 'torso');
    cap(j.neck, j.chest, 0.3, 'SHIRT', 'torso');
    disc([j.neck[0], j.neck[1], j.neck[2] - 0.02], 0.12, 'TRIM');
    for (const s of ['L','R']){ cap(j['sh'+s], j['el'+s], 0.13, 'SHIRT'); cap(j['el'+s], j['hand'+s], 0.1, gk? 'GLOVE' : 'SKIN'); }
    // head: hair behind, face, a fringe or a cap of hair over the top, eyes
    const h = j.head;
    const hairR = style===1? 0.2 : style===2? 0.27 : 0.24, hairBack = style===2? -0.09 : -0.05, hairUp = style===2? 0.03 : 0.05;
    disc([h[0] + hairBack, h[1], h[2] + hairUp], hairR, 'HAIR');
    disc([h[0] + 0.03, h[1], h[2] - 0.02], 0.22, 'SKIN', 'face');
    if (style!==1) disc([h[0] - 0.02, h[1], h[2] + 0.16], 0.14, 'HAIR');                         // the top of the head
    disc([h[0] + 0.19, h[1] - 0.09, h[2] + 0.0], 0.05, 'EYE'); disc([h[0] + 0.19, h[1] + 0.09, h[2] + 0.0], 0.05, 'EYE');
    if (name==='card'){ const hd = j.handR; parts.push({ kind:'rect', c:[hd[0], hd[1], hd[2] + 0.12], w: 0.16, h: 0.22, col:'CARD' }); }
    return parts;
  }

  // ---- rasteriser ----
  function worldOf(p, angle, spr, c){
    const fx = Math.cos(angle), fy = Math.sin(angle);               // forward in metre space
    const rx = -fy, ry = fx;                                        // the figure's right-hand side
    const X = p[0]*fx + p[1]*rx, Y = p[0]*fy + p[1]*ry;
    return { X, Y, Z: p[2], sx: c.W/2 + spr*(X - Y), sy: c.FEET + spr*((X + Y)*0.5 - p[2]*PR.HEIGHT), depth: X + Y };
  }
  function gridFor(dir, name, frame, spr, opts){
    spr = spr||SPR; const c0 = cell(spr, name); const { W, H } = c0;
    const angle = HEADING[dir]===undefined? HEADING.S : HEADING[dir];
    const grid = new Array(W*H).fill(null);
    const pattern = (opts && opts.pattern) || 'plain';
    const vf = PR.screenVector(angle), vr = PR.screenVector(angle + Math.PI/2);
    const girth = Math.sqrt(0.5*(Math.hypot(vf.dx, vf.dy)**2 + Math.hypot(vr.dx, vr.dy)**2))/1.1;
    const parts = figure(name, frame, opts).map(p => {
      if (p.kind==='disc'){ const c = worldOf(p.c, angle, spr, c0); return { kind:'disc', c, r: p.r*spr, col: p.col, tag: p.tag, depth: c.depth + p.c[2]*0.02 }; }
      if (p.kind==='rect'){ const c = worldOf(p.c, angle, spr, c0); return { kind:'rect', c, w: p.w*spr, h: p.h*spr, col: p.col, depth: c.depth + 0.5 }; }
      const a = worldOf(p.a, angle, spr, c0), b = worldOf(p.b, angle, spr, c0);
      return { kind:'cap', a, b, r: p.t*spr*girth/2, col: p.col, tag: p.tag, depth: (a.depth + b.depth)/2 + (p.a[2] + p.b[2])*0.01 };
    });
    parts.sort((p, q) => p.depth - q.depth);                        // far parts first
    const stripeW = Math.max(1, Math.round(spr*0.14)), hoopH = Math.max(1, Math.round(spr*0.14));
    const put = (x, y, col, shade) => { grid[y*W+x] = col + (shade||''); };
    for (const p of parts){
      if (p.kind==='rect'){ const x0 = Math.round(p.c.sx - p.w/2), y0 = Math.round(p.c.sy - p.h/2); for (let y=Math.max(0,y0); y<Math.min(H, y0 + Math.max(1, Math.round(p.h))); y++) for (let x=Math.max(0,x0); x<Math.min(W, x0 + Math.max(1, Math.round(p.w))); x++) put(x, y, p.col); continue; }
      if (p.kind==='disc'){
        const r = p.r, x0 = Math.max(0, Math.floor(p.c.sx - r - 1)), x1 = Math.min(W-1, Math.ceil(p.c.sx + r + 1)), y0 = Math.max(0, Math.floor(p.c.sy - r - 1)), y1 = Math.min(H-1, Math.ceil(p.c.sy + r + 1));
        for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){ const dx = x + 0.5 - p.c.sx, dy = y + 0.5 - p.c.sy; if (dx*dx + dy*dy <= r*r){ const shade = (p.col==='EYE' || p.col==='TRIM')? '' : (dx < -r*0.25 && dy < -r*0.1)? '+' : (dx > r*0.45 || dy > r*0.55)? '-' : ''; put(x, y, p.col, shade); } }
      } else {
        const r = Math.max(0.55, p.r); const ax = p.a.sx, ay = p.a.sy, bx = p.b.sx, by = p.b.sy;
        const x0 = Math.max(0, Math.floor(Math.min(ax,bx) - r - 1)), x1 = Math.min(W-1, Math.ceil(Math.max(ax,bx) + r + 1)), y0 = Math.max(0, Math.floor(Math.min(ay,by) - r - 1)), y1 = Math.min(H-1, Math.ceil(Math.max(ay,by) + r + 1));
        const vx = bx - ax, vy = by - ay, len2 = vx*vx + vy*vy || 1e-9; const len = Math.sqrt(len2); const nx = -vy/len, ny = vx/len;   // unit normal (screen)
        const topY = Math.min(ay, by) - r;
        for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
          const px = x + 0.5, py = y + 0.5; let u = ((px-ax)*vx + (py-ay)*vy)/len2; u = Math.max(0, Math.min(1, u));
          const dx = px - (ax + u*vx), dy = py - (ay + u*vy); if (dx*dx + dy*dy > r*r) continue;
          let col = p.col;
          if (p.tag==='torso' && pattern!=='plain'){
            const lateral = dx*nx + dy*ny;                            // signed distance across the body on screen
            const alt = pattern==='stripes'? (Math.floor((lateral + 100*stripeW)/stripeW) % 2)===0 : pattern==='hoops'? (Math.floor((py - topY)/hoopH) % 2)===0 : pattern==='halves'? lateral < 0 : (lateral < 0) !== ((py - topY) < (p.a.sy - topY + 0.2*r));
            if (alt) col = 'TRIM';
          }
          // two-tone shading: light from the upper left of the screen
          const lat = dx*nx + dy*ny; const shade = (col==='TRIM' || col==='EYE' || col==='BOOTS')? '' : (lat < -r*0.3 || (dy < -r*0.4 && Math.abs(vx) > Math.abs(vy)))? '+' : (lat > r*0.42)? '-' : '';
          put(x, y, col, shade);
        }
      }
    }
    // one-pixel outline round the silhouette
    const out = grid.slice();
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){ if (grid[y*W+x]) continue; const n = (x>0 && grid[y*W+x-1]) || (x<W-1 && grid[y*W+x+1]) || (y>0 && grid[(y-1)*W+x]) || (y<H-1 && grid[(y+1)*W+x]); if (n) out[y*W+x] = 'LINE'; }
    return out;
  }

  // ---- colours ----
  function hex(c){ if (c[0]==='#') return c; const m = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(c); if (!m) return '#808080'; const h=+m[1]/360, s=+m[2]/100, l=+m[3]/100; const f=n=>{ const k=(n+h*12)%12; const a=s*Math.min(l,1-l); return Math.round(255*(l - a*Math.max(-1, Math.min(k-3, 9-k, 1)))); }; return '#'+[f(0),f(8),f(4)].map(v=>v.toString(16).padStart(2,'0')).join(''); }
  function rgb(c){ c = hex(c); return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]; }
  const lum = c => { const v = rgb(c); return (0.299*v[0]+0.587*v[1]+0.114*v[2])/255; };
  const tone = (c, k) => { const v = rgb(c).map(x => Math.max(0, Math.min(255, Math.round(k > 0? x + (255 - x)*k : x*(1 + k))))); return '#'+v.map(x=>x.toString(16).padStart(2,'0')).join(''); };
  function paletteFor(kit, variant){
    const shirt = hex(kit.primary), trim = hex(kit.secondary);
    let shorts = trim; if (Math.abs(lum(shorts)-lum(shirt)) < 0.12) shorts = lum(shirt) > 0.5? '#1F2A44' : '#F2F2F2';
    const line = lum(shirt) > 0.8? '#2A2A2A' : '#101010';
    const base = { SKIN: SKINS[variant.skin%SKINS.length], HAIR: HAIRS[variant.hair%HAIRS.length], SHIRT: shirt, TRIM: trim, SHORTS: shorts, SOCKS: shirt, BOOTS: '#161616', EYE: '#1A1A1A', GLOVE: '#E6E6E6', CARD: kit.card==='red'? '#D81E1E' : '#F7D117', LINE: line };
    const pal = {};
    for (const k of Object.keys(base)){ pal[k] = base[k]; pal[k+'+'] = tone(base[k], 0.22); pal[k+'-'] = tone(base[k], -0.24); }
    return pal;
  }

  function get(kit, variant, dir, name, frame, spr){
    frame = frame||0; name = POSES[name]? name : 'idle'; spr = spr||SPR; frame = frame % POSES[name];
    const key = kit.primary+'|'+kit.secondary+'|'+(kit.pattern||'')+'|'+(kit.gk?'g':'')+'|'+(kit.card||'')+'|'+variant.skin+'|'+variant.hair+'|'+(variant.style||0)+'|'+dir+'|'+name+'|'+frame+'|'+spr;
    let cv = cache.get(key); if (cv) return cv;
    const { W, H, FEET } = cell(spr, name);
    const g = gridFor(dir, name, frame, spr, { pattern: kit.pattern, gk: kit.gk, style: variant.style }), pal = paletteFor(kit, variant);
    cv = createCanvas(W, H); const ctx = cv.getContext('2d'); cv.feet = FEET; cv.spr = spr;
    const img = ctx.createImageData? ctx.createImageData(W, H) : null;
    if (img && img.data){
      const d = img.data;
      for (let i=0;i<W*H;i++){ const c = g[i]; if (!c) continue; const [r,gg,b] = rgb(pal[c]||'#FF00FF'); d[i*4] = r; d[i*4+1] = gg; d[i*4+2] = b; d[i*4+3] = 255; }
      ctx.putImageData(img, 0, 0);
    } else {
      for (let i=0;i<W*H;i++){ const c = g[i]; if (!c) continue; ctx.fillStyle = hex(pal[c]||'#FF00FF'); ctx.fillRect(i%W, Math.floor(i/W), 1, 1); }
    }
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, cv);
    return cv;
  }
  // a deterministic look per player id: skin and hair as the pixel view, plus a hair style
  function variantFor(id){ const v = MD.sprites.variantFor(id); const h = MD.hashString('style'+id); return { skin: v.skin, hair: v.hair, style: h % 3 }; }

  MD.isoSprites = { SPR, cell, POSES, WIDE, HEADING, get, gridFor, figure, pose, paletteFor, REF_KIT, variantFor,
    setCanvasFactory(f){ createCanvas = f; cache.clear(); }, cacheSize(){ return cache.size; }, clear(){ cache.clear(); } };
})(typeof window!=='undefined'? window : globalThis);
