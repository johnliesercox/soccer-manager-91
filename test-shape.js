// ============================================================================
//  Tests: where the side without the ball stands (the tactics milestone, slice 3, stage B)
//
//  Stage B moves the players of a side that presses High or Low, and nothing else. John approved it on 21 November 2026
//  as scoped in TACTICS-SLICE-3-STAGE-B-SCOPE.md: the lines 4.7 m higher or deeper, a High press closing down at a run,
//  a Low press standing off in the far part of the pitch. What this file holds it to:
//
//   1. Nothing else moves. Against the fingerprint taken from the Stage A code (tools/reference/scene-stage-a.json):
//      with Normal pressing on both sides, and with the default plan on both sides, the timeline and every player's
//      position are identical; where a side presses High or Low the timeline is still identical, event for event, and
//      only the players stand differently; and with stage B switched off every match is Stage A again.
//   2. The rule for where a player stands is the old rule when nothing is passed for the new shift.
//   3. The agreed differences show, measured by tools/shape-style.js: a High press's back line and midfield stand at
//      least 5 m higher than a Low press's with the ball in the middle third, a man on the ball has a High-pressing
//      opponent within 3 m at least 8 points more often than a Low-pressing one, and a Low press stands off in the far
//      third. It looks offside no more often than it did.
//
//  node test-shape.js   (about two minutes)
// ============================================================================
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const E = require('./engine.js'); globalThis.Engine = E;
for (const f of ['schema', 'capture', 'timeline', 'behaviour']) require('./src/matchday/' + f + '.js');
const MD = globalThis.Matchday;
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c){ fails++; console.log('FAIL', m); } };
const run = (tool, args) => cp.spawnSync(process.execPath, [path.join(__dirname, 'tools', tool)].concat(args), { encoding: 'utf8' });
const last = r => (r.stdout || '').trim().split('\n').pop();

// ---- 1. nothing else moves ----
{ const ref = path.join(__dirname, 'tools', 'reference', 'scene-stage-a.json');
  const on = run('scene-reference.js', ['--check', ref]); ok(on.status === 0, 'against the Stage A fingerprint: Normal pressing and the default plan are identical in every position, and no event has moved anywhere: ' + last(on) + (on.status? '\n' + on.stdout : ''));
  ok(/pressing High against Low: 6 of 6 matches as they should be: 0 identical/.test(on.stdout || ''), 'and where a side presses High or Low the players do stand differently');
  const off = run('scene-reference.js', ['--check', ref, '--stage-a']); ok(off.status === 0, 'with stage B switched off every match is Stage A again, position for position: ' + last(off));
  const rel = run('scene-reference.js', ['--check', path.join(__dirname, 'tools', 'reference', 'scene-1.8.0.json'), '--exact']); ok(rel.status === 0, 'the match pictures are the ones approved for 1.8.0, event for event and position for position, in all 36 matches: ' + last(rel) + (rel.status? '\n' + rel.stdout : ''));
  console.log('nothing else moves: ' + last(on)); }

// ---- 2. the standing rule ----
{ const rnd = MD.seededRandom('shape'); let same = 0, n = 0, keeper = 0, shifted = 0, shiftN = 0;
  for (let i = 0; i < 4000; i++){ const role = ['GK', 'DEF', 'MID', 'FWD'][i % 4]; const a = { x: 0.1 + 0.6*rnd(), y: rnd() }, bx = rnd(), by = rnd(), att = rnd();
    const old = MD.shapePos(a, role, bx, by, att), zero = MD.shapePos(a, role, bx, by, att, 0), up = MD.shapePos(a, role, bx, by, att, 0.045);
    n++; if (old.x === zero.x && old.y === zero.y) same++;
    if (role === 'GK'){ if (up.x === old.x && up.y === old.y) keeper++; }
    else if (old.x > 0.31 && old.x < 0.9){ shiftN++;   /* (clear of the floor each line holds near its own goal, and of the far end) */ if (Math.abs(up.x - old.x - 0.045) < 1e-9 && up.y === old.y) shifted++; } }
  ok(same === n, `with no shift the rule for where a player stands is the old rule (${same} of ${n})`);
  ok(keeper === 1000, 'a goalkeeper is never shifted');
  ok(shifted === shiftN && shiftN > 1500, `an outfield player is shifted straight up the pitch by exactly the amount, and not across it (${shifted} of ${shiftN})`);
  const S = MD.STYLE; ok(S.LINE[1] === 0 && S.LINE[0] === -S.LINE[2] && Math.abs(S.LINE[2]*105 - 4.7) < 0.05, `the shift is the one agreed: ${(S.LINE[2]*105).toFixed(1)} m each way, none for Normal`); }

// ---- 3. the agreed differences ----
{ const out = path.join(os.tmpdir(), 'sm91-shape-' + process.pid + '.json'); const r = run('shape-style.js', ['--matches', '40', '--out', out]); ok(r.status === 0, 'the measurement ran: ' + (r.stderr || '').slice(0, 200));
  const g = JSON.parse(fs.readFileSync(out, 'utf8')).groups; fs.unlinkSync(out); const [lo, no, hi] = g;
  const m = (b, k) => b[k]/b.n, close = b => b.close/Math.max(1, b.carried), mid = x => x.band[1], far = x => x.band[2];
  const dDef = m(mid(hi), 'def') - m(mid(lo), 'def'), dMid = m(mid(hi), 'mid') - m(mid(lo), 'mid'), dClose = close(hi.all) - close(lo.all);
  ok(dDef >= 5, `the back line of a High press stands ${dDef.toFixed(1)} m higher than a Low press's with the ball in the middle third (at least 5): ${m(mid(lo), 'def').toFixed(1)}, ${m(mid(no), 'def').toFixed(1)}, ${m(mid(hi), 'def').toFixed(1)} m`);
  ok(dMid >= 5, `and its midfield ${dMid.toFixed(1)} m higher (at least 5): ${m(mid(lo), 'mid').toFixed(1)}, ${m(mid(no), 'mid').toFixed(1)}, ${m(mid(hi), 'mid').toFixed(1)} m`);
  ok(dDef <= 9.5 && dMid <= 9.5, 'neither by more than the shift agreed (4.7 m each way)');
  ok(m(mid(no), 'def') > m(mid(lo), 'def') + 2 && m(mid(hi), 'def') > m(mid(no), 'def') + 2, 'Normal stands between the two');
  ok(dClose >= 0.08, `the man on the ball has a High-pressing opponent within 3 m ${(100*dClose).toFixed(1)} points more often than a Low-pressing one (at least 8): ${(100*close(lo.all)).toFixed(1)}%, ${(100*close(no.all)).toFixed(1)}%, ${(100*close(hi.all)).toFixed(1)}%`);
  ok(close(far(lo)) <= close(far(no)) - 0.10, `a Low press stands off with the ball in the far third: a man within 3 m ${(100*close(far(lo))).toFixed(1)}% of the time against ${(100*close(far(no))).toFixed(1)}% for Normal`);
  const offs = [lo, no, hi].map(x => x.all.off/x.all.n); ok(offs.every(x => x <= 0.01) && offs[0] <= offs[1] + 0.005 && offs[2] <= offs[1] + 0.005, `it looks offside no more often than it did (an attacker beyond the last defender in ${offs.map(x => (100*x).toFixed(1) + '%').join(', ')} of moments)`);
  console.log(`the shape shows: back line ${m(mid(lo), 'def').toFixed(1)} / ${m(mid(no), 'def').toFixed(1)} / ${m(mid(hi), 'def').toFixed(1)} m and midfield ${m(mid(lo), 'mid').toFixed(1)} / ${m(mid(no), 'mid').toFixed(1)} / ${m(mid(hi), 'mid').toFixed(1)} m from the side's own goal line with the ball in the middle third (Low / Normal / High); a man within 3 m of the ball ${(100*close(lo.all)).toFixed(1)} / ${(100*close(no.all)).toFixed(1)} / ${(100*close(hi.all)).toFixed(1)}%`); }

console.log(fails? `\n${fails} FAILURES of ${checks} checks` : `\nSHAPE OK (${checks} checks)`);
process.exit(fails? 1 : 0);
