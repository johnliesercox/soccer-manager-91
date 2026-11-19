# Soccer Manager '91: handover for Phase 4 (a true 3D matchday) and for whoever works on the game next

Written 18 November 2026. Read `PHASE-3-FINAL-REPORT.md` first for where things stand; this note is what you need in order to start work without breaking anything.

## Where things stand

* **Live:** 1.7.0 (the combined release with the Premium Dark interface), `main` at `fe24d6c`, published 18 November 2026. GitHub Pages serves the root of `main`. 1.6.0 is the tag `v1.6.0` at `97a0748`; the tag `v1.7.0` is John's to create.
* **In hand (19 November 2026):** release 1.7.1, the hair fix (Milestone 0 of the roadmap), on the branch `milestone-0-hair`, built and tested, waiting for John's visual approval. Not merged, not deployed. `HAIR-FIX-1.7.1.md` is its checkpoint report.
* **Known limitation, goalkeepers' hair:** the keepers' painted sheet has one hairstyle (the short one) where the outfield sheet has three. A goalkeeper whose look says cropped or long is drawn short all match, which nobody can notice; an outfield player who goes in goal after his keeper is sent off (`src/matchday/scene.js` gives a defender the keeper's role from that second) is drawn from the keepers' sheet from then on, so his hairstyle becomes the short one while his hair colour and skin stay his own. Curing it means painting the keepers' 58 poses in the two other hairstyles (928 cells a size).
* **Start new work from `main`**, on a branch of its own. The branches `milestone-5` and `premium-dark` are wholly contained in it.
* **Next:** nothing is in hand. The roadmap after this release is John's brief of 18 November (a fix for hairstyles changing during a match, then tactics, training, match information, matchday variety); none of it is started, and each milestone needs his approval of its scope before any code. `RELEASE-CANDIDATE-1.7.0.md` is the report on the released file, `PREMIUM-DARK.md` the record of the interface, and `node tools/ui-parity.js` (with `--compare`, `--layout`, `--keys` and `--stage`) is how any change to a screen's presentation is checked against the build before it.

## The rules that stand

These are John's and they apply to everything.

1. **Nothing is merged to `main` or deployed without John's explicit approval.** Work on a branch.
2. **Live saves are never reset or overwritten.** The save format (4) does not change without his say; the game never clears storage on a version change; the service worker cache name changes with every release.
3. **The engine decides every official result.** A renderer never reads the engine's random numbers and never calls anything that decides an outcome. The only approved engine change of Phase 3 is `reconcileRecord`.
4. **For larger asks, break the work down and agree the scope with John before starting.** He is not a developer: report in plain language, lead with the outcome, and say plainly when something you told him earlier was wrong.
5. **Art is original only.** No club or brand names in prompts; boards in the ground are fictional and unreadable. Floyo is used only through his Personal Team. The animation library is final and is not regenerated.
6. **No em dashes** in anything written, code comments included.
7. **`.submit_secret` never leaves the repository**, and his email address is private.
8. **Tags are John's to create** on the GitHub page (Releases > new release > tag, target `main`). The working sessions can push branches; tag pushes are refused, and that is not to be worked around. Tag what is live before every release.

## How the game is put together

One offline HTML file. `python3 build.py` writes `index.html` (deployed) and `soccer-manager-91.html` (opens from disk) from `ui.html` (the management game and the shell), `engine.js` (the simulation) and `src/matchday/*` in the order of `MATCHDAY_FILES` in `build.py`, with the art of `assets/matchday/isometric/E/` inlined. The build is deterministic: the same source gives the same bytes, so an md5 identifies a build. `sw.js` caches it for offline play.

A watched match flows one way:

```
engine result -> capture.js (the official record, kits, seed)
              -> timeline.js (what is shown when)
              -> scene.js with behaviour.js, trajectories.js, interactions.js (where everyone and the ball are at time t, in metres)
              -> playback.js (the clock: highlights, fast-forwards, speed, seek)
              -> a renderer (draws the scene it is handed)
```

`ARCHITECTURE_MATCHDAY.md` is the authority up to the renderer contract, and its section "The one rule" is the one to read twice. `PHASE-3-ARCHITECTURE.md` covers the isometric renderer and every pass of Phase 3.

## What a 3D renderer plugs into

* **The contract.** A renderer is an entry in `Matchday.renderers` with `create(opts)` returning `{ mount(el, presentation), render(scene, hud), resize(), dispose() }`, plus optional extras the match screen uses when present: `ready()`, `isReady()`, `proceed()`, `setCamera()`, `getCamera()`, `prepare(scene, hud)`, `expectWave()`, `warm(sceneAt, from, span, segment)`, `preload(url)`. `ARCHITECTURE_MATCHDAY.md`, "Adding a renderer", has the steps; add the file to `MATCHDAY_FILES`.
* **The scene is in world units.** `scene.getSceneAt(t)` gives positions in metres on a 105 by 68 pitch, heights in metres, facing angles, poses and frames, the ball with its height, and what the camera should care about. It carries no screen-space values, so a 3D view replaces projection, camera, actors and ground with its own and keeps the rest. From the isometric files it needs nothing except, if useful, `iso-projection.toMetres` and `BALL_Z_M`.
* **What is coming.** `MD.lookAhead(scene, goalTimes, segsOf)` in `playback.js` tells a view, every frame, of a goal a few match seconds off and where the next cut will land. The match screen already calls `renderer.expectWave()` and `renderer.prepare(...)` from it. A 3D view should use the same calls to load or build whatever a cut needs before the cut.
* **Falling back.** If a view cannot start or throws during a match, the match screen moves to Pixels and the match carries on (`mountRenderer`, `viewFailed` in `matchday-ui.js`). A 3D view gets this for free and should keep it working: WebGL will be missing or lost on some phones.
* **Three ideas from the phone work that carry over to any renderer:** the match screen says what is coming; work ahead is done inside what is left of a frame, never as one long task; anything heavy that a moment needs is made before that moment.
* **What the brief asked of this phase for your sake:** the other three views still work and are tested (`test-matchday-ui.js`, C10); the skeleton the sprites were drawn from is exported in metres (`tools/visual-rnd/joints.json`, `export-joints.js`) and the stadium as boxes (`tools/visual-rnd/stadium-geometry.json`), which is a starting point for meshes.

A 3D engine (Three.js or another) is a large new dependency for an offline single file. The Phase 3 brief required a written comparison of size, performance and offline behaviour, and John's approval, before taking one on. Assume the same holds.

## Checking your work

Run suites one at a time; two UI suites at once share a temporary file.

| What | Command | Time |
|---|---|---|
| All 21 suites | `for f in test-*.js; do node $f; done` after `npm install`, `python3 build.py`, and `cp soccer-manager-91.html /tmp/sm91-ladder-test.html` | about 27 minutes (`test-locomotion.js` alone up to nine) |
| Results unchanged by watching | `node test-equivalence.js`, `node test-record.js` | seconds |
| Saves from the live release | `node tools/save-compat.js legacy/release-1.6.0 .` and the reverse | 2 minutes |
| The screens say, offer and do the same as another build | `node tools/ui-parity.js <site> <out>` on both, then `--compare`; `--layout <site>` for the five sizes; `--keys <site>` for the keyboard; `--stage <site>` for the match screen's boxes | 6 minutes a build; 20 for the sizes; 10 for the keyboard |
| Five screen sizes | `node tools/viewport-audit.js . <out>` | 5 minutes |
| Memory, forced failures, offline, hot-seat, measuring screen | `node tools/soak-audit.js . <out> all` | 12 minutes |
| Phone pacing between real measurements | `node tools/phone-probe.js . 6 out.json` | 90 seconds |
| The picture, pixel for pixel | `node tools/tile-reference.js`, `tools/sprite-reference.js`, `tools/frame-reference.js`, each with `. out.json tools/reference/<its file>` | 3 minutes in all |
| Hair drawn as hair, and every player's look held through matches (from 1.7.1) | `node tools/hair-audit.js .` | 8 minutes (1 with `--matches 0`) |

The browser tools need Playwright (`NODE_PATH` to wherever it is installed). Do not rebuild while a browser audit is running.

On a real phone: What's new > Measure the match frame rate, then watch a match at normal speed for a minute; the panel gives the figures. John's Galaxy S23 Ultra reads 59.6 frames a second on 1.7.0.

## Traps that cost time in Phase 3

* **A `//` comment in the middle of a line removes the rest of the line.** The source is written as long lines. Use `/* */` or a line of its own, and after editing search the changed lines for a comment followed by code.
* **A test that carries its own copy of a rule can pass while the game is wrong.** Call the game's function from the test (`MD.lookAhead` exists for this reason).
* **Headless Chromium is not a phone.** It was 60 frames a second when the phone was 50. Slowing the processor six times in `tools/phone-probe.js` reproduced the phone closely; trust a real measurement over both.
* **A tile painted alone is not the same pixels as that part of one big painting** (it never was). Compare tile with tile, as the reference tools do.
* **`test-hof.js` needs `/tmp/sm91-ladder-test.html`**, a copy of the built `soccer-manager-91.html`.
* **The sandbox cannot reach the live site or Floyo's file store.** Publication is confirmed through the GitHub deployments API; paintings travel through John as zip attachments (a picture pasted into a chat is recompressed and useless to the converter).
* **A phone held sideways** gives a stage about 200 px tall. It is a known open item left by decision; do not spend time on it unless asked.

## Open items handed on

* The combined release and its release-specific records (`PHASE-3-FINAL-REPORT.md`, "To complete at publication").
* Permanent storage for the art archives (`ART-PIPELINE-ARCHIVES.md`): John wants them preserved and will decide where.
* The `milestone-4` branch is wholly contained in `milestone-5`; John wants it kept until the combined release is live and verified.
* No mid-range phone has been measured; lower-detail settings (brief 10.3) are not built.
* Phone landscape, and the whole-pitch camera on an upright phone.

## Where to read more

| File | What it is |
|---|---|
| `README.md` | what is in the repository, how to rebuild, test and release |
| `ARCHITECTURE_MATCHDAY.md` | the matchday pipeline and the renderer contract |
| `PHASE-3-ARCHITECTURE.md` | the isometric renderer, pass by pass |
| `PHASE-3-QA-REPORT.md` | the acceptance matrix and every measurement |
| `PHASE-3-FINAL-REPORT.md` | the phase in one document |
| `ART-PIPELINE.md`, `tools/visual-rnd/README.md`, `ART-PIPELINE-ARCHIVES.md` | how the art was made, every Floyo run id, and what of it is not on GitHub |
| `ROLLBACK.md` | putting an earlier release back |
