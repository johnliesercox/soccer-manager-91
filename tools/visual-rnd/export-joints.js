// Export the game's skeleton for the Visual R&D test frames, so a 3D model can be posed exactly as the sprites are.
//   node tools/visual-rnd/export-joints.js > tools/visual-rnd/joints.json
const path = require('path');
globalThis.window = undefined;
globalThis.Matchday = {}; for (const f of ['schema','sprites','renderers/iso-projection','iso-sprites']) require(path.resolve(__dirname, '../../src/matchday/'+f+'.js'));
const MD = globalThis.Matchday; const PR = MD.iso.projection; const SP = MD.isoSprites;
// every pose and frame the game has (the skeleton does not depend on the keeper flag; gloves are a material)
const out = { headings: {}, dirs: PR.DIRS, poses: {} };
for (const d of PR.DIRS) out.headings[d] = SP.HEADING[d];
for (const [pose, n] of Object.entries(SP.POSES)) for (let f=0; f<n; f++) out.poses[pose+':'+f] = { pose, frame: f, joints: SP.pose(pose, f) };
process.stdout.write(JSON.stringify(out));
