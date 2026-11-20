'use strict';
// For the tests' style sweep (the tactics milestone, slice 3): draws every match's pictures to the plans named in SM91_STYLE,
// whatever plans the match was played to, so that each matchday suite can be run again on each style of football.
//   SM91_STYLE="0,1,0,0/0,-1,0,0" node -r ./tools/style-preload.js test-contact.js      home/away: mentality,passing,pressing,shooting
//   SM91_STYLE="0,1,1,1" ...                                                            the same plan for both sides
//   SM91_STYLE="0,0,0,0" ...                                                            the default plan: the pictures exactly as without it
// It only sets a value that src/matchday/capture.js reads; it changes no result and is not part of the game.
const q = process.env.SM91_STYLE || '';
if (q){ const plan = t => { const v = t.split(',').map(Number); return { m: v[0]|0, p: v[1]|0, r: v[2]|0, s: v[3]|0 }; }; const [h, a] = q.split('/'); globalThis.__sm91StyleOverride = { home: plan(h), away: plan(a || h) }; }
