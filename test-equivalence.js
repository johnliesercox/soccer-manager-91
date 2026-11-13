'use strict';
// Pre-feature equivalence: the 1.2.0 engine produces the same results as 1.1.2 for the same seed,
// right up to the first extra-time match (where 1.2.0 now draws scorers for extra-time goals,
// which is the one intentional engine change of this release).
const Enew = require('./engine.js'); const Eold = require('./legacy/engine.v112.js');
let fails = 0; const ok = (c,m) => { if (!c){ fails++; console.log('FAIL', m); } };
const slim = st => JSON.stringify(st.lastSlim) + '|' + JSON.stringify(st.clubs.map(c=>[c.balance, c.pts, c.leaguePos, c.players.length]));
let totalWeeks = 0, divergedAt = [];
for (const seed of [11, 22, 33, 44, 55, 66]){
  const a = Enew.newGame({ seed, userClub: 20 }), b = Eold.newGame({ seed, userClub: 20 });
  let week = 0, firstET = null;
  for (; week < 84; week++){
    Enew.advanceWeek(a); Eold.advanceWeek(b);
    for (const s of [a,b]) if (s.gameOver){ s.gameOver=null; s.sackOffer=null; }
    const etNow = b.lastSlim.some(m=>m.extra==='aet');   // an extra-time match this week (old engine's view, identical up to that match)
    if (slim(a)!==slim(b)){ ok(etNow, `seed ${seed}: diverged at week ${week+1} with no extra-time match that week`); firstET = week+1; break; }
    ok(!etNow || a.lastSlim.every((m,i)=>m.gH===b.lastSlim[i].gH && m.gA===b.lastSlim[i].gA), 'scores identical');
    totalWeeks++;
  }
  divergedAt.push(`seed ${seed}: identical for ${week} weeks${firstET? ', then an extra-time match in week '+firstET+' drew its scorers (expected)' : ''}`);
}
console.log(divergedAt.join('\n'));
console.log(`identical weeks: ${totalWeeks}`);

// With extra-time crediting switched off, the new engine must be identical to 1.1.2 for whole seasons:
// proof that nothing else in the engine moved.
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8').replace(/function creditExtraTime\(scorers, xiH, xiA, eH, eA\)\{[\s\S]*?\n\}/, 'function creditExtraTime(){}');
  const tmp = path.join(process.env.SCRATCH || '/tmp', 'engine-noet.js'); fs.writeFileSync(tmp, src);
  const Enoet = require(tmp);
  let same = 0;
  for (const seed of [11, 22, 33]){
    const a = Enoet.newGame({ seed, userClub: 20 }), b = Eold.newGame({ seed, userClub: 20 });
    for (let week=0; week<84; week++){ Enoet.advanceWeek(a); Eold.advanceWeek(b); for (const s of [a,b]) if (s.gameOver){ s.gameOver=null; s.sackOffer=null; } if (slim(a)!==slim(b)){ ok(false, `seed ${seed}: engines differ at week ${week+1} with extra-time crediting off`); break; } same++; }
    a.gameId = b.gameId = 'x'; ok(JSON.stringify(a)===JSON.stringify(b), `seed ${seed}: full state identical after two seasons`);
  }
  console.log(`with extra-time crediting off: ${same} identical weeks over three two-season worlds`);
}
console.log(fails? `\n${fails} FAILURES` : '\nENGINE EQUIVALENCE OK');
process.exit(fails? 1 : 0);
