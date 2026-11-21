#!/usr/bin/env node
'use strict';
// A fingerprint of the match pictures of a fixed set of matches: every event of the timeline, and where every player stands
// once a second. It is how a later stage proves it has left something alone.
//
//   node tools/scene-reference.js --write tools/reference/scene-stage-a.json    record
//   node tools/scene-reference.js --check tools/reference/scene-stage-a.json    compare (exit 1 on a difference)
//   node tools/scene-reference.js --check tools/reference/scene-stage-a.json --stage-a    the same with stage B switched off
//
// Recorded at Stage A of tactics slice 3 (commit b718679), before Stage B moved the side without the ball. Three sets:
//   normal    twelve matches forced to plans that differ in passing and shooting but have NORMAL pressing on both sides.
//             Stage B must leave the timeline and every position exactly as they were.
//   default   six matches forced to the default plan on both sides (the 1.7.1 pictures): the same.
//   pressing  twelve matches as the game plays and six forced to High against Low. Stage B must not move one EVENT of
//             these. Where a side presses High or Low it does move the players, so the positions must differ from the
//             reference there (and be identical where both sides press Normal), and must be the reference again with
//             stage B switched off (--stage-a), which shows the switch gives Stage A back.
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'); const E = require(path.join(ROOT, 'engine.js')); globalThis.Engine = E;
for (const f of ['schema', 'capture', 'timeline', 'behaviour', 'trajectories', 'interactions', 'scene']) require(path.join(ROOT, 'src', 'matchday', f + '.js'));
const MD = globalThis.Matchday; const plan = (m, p, r, s) => ({ m, p, r, s });
const mode = process.argv[2], file = process.argv[3], STAGE_A = process.argv.includes('--stage-a'); if (STAGE_A && MD.STYLE) MD.STYLE.shape = false; if ((mode !== '--write' && mode !== '--check') || !file){ console.error('usage: scene-reference.js --write|--check file.json'); process.exit(2); }
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);
const SETS = [
  { name: 'normal', force: { home: plan(0, 1, 0, 1), away: plan(0, -1, 0, -1) }, seed: 5101, n: 12 },
  { name: 'default', force: { home: plan(0, 0, 0, 0), away: plan(0, 0, 0, 0) }, seed: 5102, n: 6 },
  { name: 'pressing as the game plays', force: null, seed: 5103, n: 12, moves: true },
  { name: 'pressing High against Low', force: { home: plan(0, 0, 1, 0), away: plan(0, 0, -1, 0) }, seed: 5104, n: 6, moves: true },
];
const out = {};
for (const S of SETS){ globalThis.__sm91StyleOverride = S.force; const st = E.newGame({ seed: S.seed, userClub: 3 }); const rows = [];
  for (let w = 0; w < 3 && rows.length < S.n; w++){ const res = E.advanceWeek(st); for (let i = 0; i < res.length && rows.length < S.n; i += 5){ const p = MD.withTimeline(MD.capture(st, res[i], st.lastWeekInfo));
    const row = { match: p.matchId, events: p.events.length, timeline: sha(JSON.stringify(p.events)), pressing: p.tactics? [p.tactics.home.r, p.tactics.away.r] : [0, 0] };
    { const sc = MD.createScene(p); const end = p.events[p.events.length - 1].matchSecond; let acc = ''; for (let t = 1; t < end; t += 1){ const s = sc.getSceneAt(t); acc += s.players.map(q => q.x + ',' + q.y).join(';') + '|' + s.ball.x + ',' + s.ball.y + '\n'; } row.positions = sha(acc); }
    rows.push(row); } }
  out[S.name] = rows; }
globalThis.__sm91StyleOverride = null;
if (mode === '--write'){ fs.writeFileSync(file, JSON.stringify(out, null, 1)); console.log('recorded', Object.keys(out).map(k => k + ': ' + out[k].length + ' matches').join('; ')); process.exit(0); }
const ref = JSON.parse(fs.readFileSync(file, 'utf8')); let bad = 0, n = 0;
for (const S of SETS){ const k = S.name, a = ref[k], b = out[k] || []; let same = 0, movedN = 0;
  for (let i = 0; i < a.length; i++){ n++; const tl = b[i] && a[i].match === b[i].match && a[i].timeline === b[i].timeline; const pos = tl && a[i].positions === b[i].positions; const moved = !!(S.moves && !STAGE_A && b[i] && (b[i].pressing[0] || b[i].pressing[1])); if (moved) movedN++;   // stage B moves the players where a side presses High or Low, and nowhere else
    const ok = tl && (moved? !pos : pos);
    if (ok) same++; else { bad++; console.log('  WRONG', k, a[i].match, !b[i]? 'missing' : !tl? 'the timeline differs' : moved? 'the players have not moved' : 'the positions differ'); } }
  console.log(`${same === a.length? 'ok  ' : 'FAIL'} ${k}: ${same} of ${a.length} matches as they should be: ${a.length - movedN} identical in the timeline and every position${movedN? ', ' + movedN + ' (a side pressing High or Low) with the same timeline and the players standing differently' : ''}`); }
console.log(bad? `\n${bad} of ${n} matches are not as they should be against the reference` : `\nall ${n} matches are as they should be against the reference${STAGE_A? ' (stage B switched off)' : ''}`); process.exit(bad? 1 : 0);
