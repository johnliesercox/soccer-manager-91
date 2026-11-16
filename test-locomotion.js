'use strict';
// Locomotion: a player who travels is seen to run or walk; a player who stands still is not seen running.
// The scene is stepped the way the isometric renderer steps it (a frame cadence in scene seconds, the same
// per-actor animation state: distance accumulator, facing, pose and frame), at 60 and 30 frames a second, at
// playback speeds 1, 2 and 4, and at the highlight fast-forward rates (1.7 and 3.5). Over every one-second window:
//   gliding:   the man travelled a metre or more, at walking pace or faster, and was drawn standing, receiving,
//              celebrating, dismayed, booked or in any other pose without legs for most of the window
//   frozen:    he was drawn walking or running over a metre and a half and the leg frame never changed
//   treadmill: he was drawn walking or running for a whole window while covering under ten centimetres
// Covers open play, celebrations, bookings, corners and goal kicks, because the matches sampled hold all of them.
//   node test-locomotion.js
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema','capture','timeline','behaviour','trajectories','interactions','scene','playback','sprites','renderers/iso-projection','iso-sprites','iso-assets','renderers/iso-pitch','renderers/iso-stadium','renderers/iso-camera','renderers/iso-actors']) require('./src/matchday/'+f+'.js');
const MD = globalThis.Matchday; const EV = MD.EVENT; const ACT = MD.iso.actors;
let fails = 0, checks = 0; const ok = (c, msg) => { checks++; if (!c){ fails++; if (fails <= 30) console.log('FAIL', msg); } return c; };
const DIM = { L: 105, W: 68 };
const LEGS = new Set(['walk', 'run', 'runcheer', 'slide', 'kneeslide', 'dive', 'parry', 'catch']);   // poses that carry a man along (a keeper flies in a parry and steps into a catch)
const STRIKES = new Set(['kick', 'shoot', 'volley', 'header', 'poke']);                   // short actions a running man may strike in

function matches(weeks, seed){
  const out = []; const st = E.newGame({ seed, userClub: 3 });
  for (let w=0; w<weeks; w++){ const res = E.advanceWeek(st); for (let i=0; i<res.length; i+=2) out.push(MD.withTimeline(MD.capture(st, res[i], st.lastWeekInfo))); }
  return out;
}

// step one match at one cadence; returns the findings
function run(p, scene, fps, rate){
  const dt = rate/fps; const anim = {}; const hist = {};                                   // per player: ring of {t, x, y, pose, frame, action}
  const found = { glide: [], frozen: [], treadmill: [] }; const seen = { frames: 0, windows: 0 };
  let lastCut = -1;
  for (let t = 0; t <= scene.duration; t += dt){
    const s = scene.getSceneAt(t); seen.frames++;
    const cut = s.lastCut!==undefined && s.lastCut > t - dt && s.lastCut <= t;
    for (const pl of s.players){
      if (pl.sentOff) continue;
      // the renderer's own animation state, updated the way actorItem does it
      const a = anim[pl.id] || (anim[pl.id] = { dir:'S', dist:0, lx: pl.x, ly: pl.y });
      const moved = Math.hypot((pl.x - a.lx)*DIM.L, (pl.y - a.ly)*DIM.W); if (!cut && moved < 12) a.dist += moved; a.lx = pl.x; a.ly = pl.y;
      const { pose, frame } = ACT.poseFor(pl, a, t);
      const h = hist[pl.id] || (hist[pl.id] = []);
      h.push({ t, x: pl.x, y: pl.y, pose, frame, action: pl.action, speed: pl.speedMs, movement: pl.movement, cut });
      // a one-second window ending now
      while (h.length && h[0].t < t - 1.0 - 1e-9) h.shift();
      if (h.length < 3 || h[0].t > t - 0.9) continue;
      if (h.some(e=>e.cut)) continue;                                                       // a camera cut in the window: positions jump, not a glide
      seen.windows++;
      // frame by frame: how far he moved into this frame, and whether he was drawn with legs for it
      let dist = 0, glideDist = 0, glideTime = 0;
      for (let i=1;i<h.length;i++){
        const step = Math.hypot((h[i].x - h[i-1].x)*DIM.L, (h[i].y - h[i-1].y)*DIM.W); const sdt = h[i].t - h[i-1].t; dist += step;
        if (step/sdt >= 0.6 && !LEGS.has(h[i].pose) && !STRIKES.has(h[i].pose)){ glideDist += step; glideTime += sdt; }
      }
      const span = h[h.length-1].t - h[0].t; const v = dist/span;
      const legs = h.filter(e=>LEGS.has(e.pose)).length, n = h.length;
      const label = `${p.teams.home.name} v ${p.teams.away.name} ${fps}fps x${rate} ${pl.name} ${Math.floor(t/60)}:${String(Math.round(t%60)).padStart(2,'0')}`;
      // gliding: half a second or more of the window travelling at walking pace or faster without legs, covering 0.8 m
      if (dt <= 0.25 && glideTime >= 0.5 && glideDist >= 0.8){                                 // frames further apart than a plan tick cannot tell a step from a start
        const poses = {}; for (const e of h) poses[e.pose+'/'+e.action] = (poses[e.pose+'/'+e.action]||0)+1;
        found.glide.push(`${label}: ${glideDist.toFixed(1)} m over ${glideTime.toFixed(2)}s without legs (window ${dist.toFixed(1)} m at ${v.toFixed(1)} m/s) drawn ${Object.entries(poses).sort((x,y)=>y[1]-x[1]).slice(0,2).map(([k,c])=>k+' '+c).join(', ')} of ${n} frames`);
      }
      // frozen legs: walking or running the whole window, over a metre and a half, on one leg frame (a dive, a slide, a parry
      // or a catch holds its frame while it carries the man, and frames further apart than a fifth of a second alias the cycle)
      const STRIDES = h.every(e=>e.pose==='walk' || e.pose==='run' || e.pose==='runcheer');
      if (dt <= 0.2 && dist >= 1.5 && STRIDES){
        const frames = new Set(h.map(e=>e.pose+':'+e.frame)); if (frames.size===1) found.frozen.push(`${label}: ${dist.toFixed(1)} m in ${[...frames][0]} with the leg frame never changing`);
      }
      // running on the spot: only judged when frames are close enough together to see a step (a quarter-second plan tick)
      if (dt <= 0.1 && dist < 0.1 && legs === n && !h.some(e=>e.pose==='slide' || e.pose==='dive' || e.pose==='kneeslide')) found.treadmill.push(`${label}: ${[...new Set(h.map(e=>e.pose))].join('/')} for ${span.toFixed(1)}s while moving ${(dist*100).toFixed(0)} cm`);
    }
  }
  return { found, seen };
}

const totals = { frames: 0, windows: 0, glide: 0, frozen: 0, treadmill: 0 }; const examples = { glide: [], frozen: [], treadmill: [] }; const byCause = {};
const ps = matches(1, 1991).slice(0, 6);
const cadences = [[60, 1], [30, 1], [60, 2], [30, 4], [60, 1.7], [30, 3.5], [30, 4*3.5]];                 // fps, scene seconds per real second
for (const p of ps){
  const scene = MD.createScene(p);
  for (const [fps, rate] of cadences){
    const { found, seen } = run(p, scene, fps, rate);
    totals.frames += seen.frames; totals.windows += seen.windows;
    for (const k of ['glide', 'frozen', 'treadmill']){ totals[k] += found[k].length; for (const f of found[k]){ if (examples[k].length < 6) examples[k].push(f); const m = /drawn (\S+)/.exec(f); if (k==='glide' && m) byCause[m[1]] = (byCause[m[1]]||0)+1; } }
  }
}
console.log(`${ps.length} matches x ${cadences.length} cadences: ${totals.frames} frames, ${totals.windows} player-windows`);
console.log(`gliding ${totals.glide}, frozen legs ${totals.frozen}, treadmill ${totals.treadmill}`);
if (Object.keys(byCause).length) console.log('gliding by pose/action:', Object.entries(byCause).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(', '));
for (const k of ['glide', 'frozen', 'treadmill']) for (const f of examples[k]) console.log('  e.g.', k, f);
ok(totals.glide===0, `players gliding without a running or walking animation (${totals.glide} windows)`);
ok(totals.frozen===0, `players running with frozen legs (${totals.frozen} windows)`);
ok(totals.treadmill===0, `players running on the spot (${totals.treadmill} windows)`);
console.log(`${checks} checks, ${fails} failures`);
console.log(fails? 'LOCOMOTION TESTS FAILED' : 'ALL LOCOMOTION TESTS PASSED'); process.exit(fails? 1 : 0);
