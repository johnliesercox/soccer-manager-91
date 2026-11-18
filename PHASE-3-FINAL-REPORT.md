# Soccer Manager '91: Phase 3 final developer report

Written 18 November 2026, for review. It answers the eight points of section 18 of the Phase 3 brief.

**Status in one line: 1.7.0 is built, tested and ready for release, and has not been deployed.** The live site is 1.6.0. By John's decision of 18 November the next public release will be one combined release that also carries the Premium Dark management interface, under a version number still to be agreed. The sections marked "to complete at publication" at the end are left open for that release.

| | |
|---|---|
| Live site | 1.6.0, `main` at `97a0748`, tagged `v1.6.0` |
| Ready, not deployed | 1.7.0, branch `milestone-5`; the game file is `index.html`, 7,131,899 bytes, md5 `d86995b43e4a887d22f76d1a3d74264d` (`python3 build.py` reproduces it byte for byte) |
| Engine | unchanged since 1.6.0; the one approved change of the whole phase is `reconcileRecord` (minutes only, no random numbers consumed), made in 1.6.0; `legacy/engine.v150.js` is the engine as it was before it |
| Save format | 4, the same in 1.5.0, 1.6.0 and 1.7.0 |

## 1. What was built, by milestone

The brief's milestones against the commits that carry them. Paths are from the root of the repository.

| Milestone | What it delivered | Where | Commit |
|---|---|---|---|
| 0 Preflight, 1 Geometry prototype, 2 Stadium and sprites, 2A styles | the isometric projection and its inverse, a camera, the pitch and markings, the stadium, eight-direction players, kits recoloured by palette | `src/matchday/renderers/iso-projection.js`, `iso-pitch.js`, `iso-stadium.js`, `iso-actors.js`, `iso-camera.js`, `isometric.js`; `src/matchday/iso-sprites.js`, `iso-assets.js`; `tools/iso-art.js` | in `382dc2e` (1.5.0, 14 Nov) |
| 3 Ball and event presentation (run as 3A to 3D and a correction pass) | highlights chosen for variety, the animation set, reactions, the crowd, commentary lines, contact between foot and ball, record corrections, the cinematic camera, celebrations, transitions | `src/matchday/scene.js`, `behaviour.js`, `trajectories.js`, `interactions.js`, `timeline.js`, `capture.js`; checkpoint reports `PHASE-3-M3B-CHECKPOINT.md`, `-M3C-`, `-M3D-`, `PHASE-3-M3D-CORRECTIONS.md` | in `382dc2e` |
| Art approval (brief 7.3): the visual R&D day and Option E | Blender figures and ground painted through Floyo as style E: every pose and frame in three hair styles, keepers, referee, painted stands and corners, modelled goals, dead balls and locomotion; `reconcileRecord` in the engine | `assets/matchday/isometric/E/`, `engine.js`, `tools/visual-rnd/`, `PHASE-3-VISUAL-RND.md`, `PHASE-3-OPTION-E-CHECKPOINT.md` | `97a0748` (1.6.0, 16 Nov) |
| 4 Camera, controls and responsive UI | player selection by touch at every zoom, still frames when nothing is playing (turning the phone, a paused match), 44 px buttons on a phone held upright, short button labels, the five viewport presets | `isometric.js` (`pick`, still frames), `iso-camera.js`, `matchday-ui.js`, `ui.html`; `test-touch.js`, `tools/viewport-audit.js` | `1b0edc7`, `6634e93` (16 Nov) |
| 5 Full regressions and optimisation | rare situations in the isometric view (dismissals, stand-in keepers, extra time, shoot-outs), ends changing in extra time, kit clashes with keeper and referee colours chosen per match, fallback to Pixels when the isometric view fails, working ahead of cuts, the on-device measuring screen, memory and offline audits | `schema.js` (`MD.homeDirAt`), `capture.js`, `iso-actors.js` (`kitsFor`), `matchday-ui.js`, `isometric.js`; `test-situations.js`, `test-ahead.js`, `tools/soak-audit.js` | `4f86ed1`, `10c0847` (17 Nov) |
| 5, the phone smoothness pass | after the first measurement on a real phone: a ground tile paints only what is inside it and, ahead of need, a layer a frame; player pictures are written from a one-byte-a-pixel copy of their sheets and made before the frames that show them; the match screen tells the view of goals and cuts by one rule the tests share | `iso-pitch.js` (`within`), `iso-stadium.js` (`groundSteps`), `isometric.js` (`world.start`, `world.advance`, `warm`), `iso-assets.js` (`prime`), `playback.js` (`MD.lookAhead`); `test-smooth.js`, `tools/phone-probe.js`, `tools/tile-reference.js`, `tools/sprite-reference.js`, `tools/frame-reference.js` | `3f363f7`, `9a67800`, `21c7c2f` (17 Nov) |
| 6 Release and handover | this report, `PHASE-4-HANDOVER.md`, `ART-PIPELINE-ARCHIVES.md`, README and rollback notes. The release itself is held | the root of the repository | the commit that adds this file |

The engineering detail of every row is in `PHASE-3-ARCHITECTURE.md`; the evidence is in `PHASE-3-QA-REPORT.md`.

## 2. Source baseline

Commit `9115a15`, "Add source, build script and tests (1.4.0)", which was verified at the start of the phase to rebuild the then live `index.html` byte for byte. Everything since is on top of it. Releases since: 1.5.0 (`382dc2e`, `index.html` md5 `16c61cc2578c20470a57ba1287de53b9`), 1.6.0 (`97a0748`, md5 `7321f34080031caf23f96212644ed046`); exact copies of both are kept in `legacy/release-1.5.0/` and `legacy/release-1.6.0/`.

## 3. What changed in the presentation, and what was left alone in the simulation

**Left alone.** The match engine (`engine.js`) decides every official result: score, scorers, cards, periods, winner. Watching a match in any view, or taking the instant result, gives the same result and leaves the saved game the same (`test-equivalence.js`, `test-record.js`). No renderer reads the engine's random numbers or calls a function that decides an outcome. Management, finances, transfers, contracts, youth, the hall of fame and the save format are untouched by Phase 3. The one approved engine change is `reconcileRecord`: where the engine's own record of a match disagreed with itself about the minute of an event, the minutes are reconciled; it consumes no random numbers and changes no result.

**Changed.** Everything a watched match shows:

* a new isometric view, the default, drawn in the painted style E, alongside the three older views (Pixels, Canvas, Wireframe), which remain selectable and are the fallback when the isometric view cannot start;
* how a highlight is staged between the official events: who is where, how the ball travels, restarts, celebrations, the crowd. These are illustrations of the engine's record and are kept distinct in the code from official facts;
* teams change ends at half-time, for extra time and at its interval; the away side changes kit when shirts are alike; keepers and the referee wear colours chosen per match;
* the match screen: camera and view buttons, player selection by tap, the goal banner placed away from the goal, 44 px buttons on a phone, the measuring screen under What's new.

## 4. Automated tests: commands and results, then and now

All suites are run one at a time with `node <file>` from the root, after `npm install` and `python3 build.py` (`node test-hof.js` also needs a copy of `soccer-manager-91.html` at `/tmp/sm91-ladder-test.html`). Each ends on a line saying it passed.

| Stage | Suites | Result |
|---|---|---|
| 1.4.0 baseline | 9: `test-matchday`, `test-playback`, `test-matchday-ui`, `test-phase25`, `test-equivalence`, `test-regression`, `test-contracts`, `test-youth`, `test-hof` | all pass (rebuilt and rerun at the start of the phase) |
| 1.5.0 | 15: the nine and `test-isometric`, `test-highlights`, `test-contact`, `test-camera`, `test-record`, `test-restarts` | 15 of 15 |
| 1.6.0 | 17: and `test-deadball`, `test-locomotion` | 17 of 17 |
| Milestone 4 | 18: and `test-touch` | 18 of 18 |
| Milestone 5 | 20: and `test-situations` (2,410 matches of two seasons), `test-ahead` | 20 of 20 |
| 1.7.0 as it stands | 21: and `test-smooth` (41 checks) | 21 of 21, about 27 minutes |

Browser audits on the 1.7.0 build (they need Playwright):

| Command | What it checks | Result |
|---|---|---|
| `node tools/soak-audit.js . <out> all` | memory over ten matches and twenty view switches, four forced failures of the isometric view, offline, hot-seat, the measuring screen at three sizes, still frames | 44 of 44; JS memory 6.6 MB after matches 3 to 5 and 7.0 MB after matches 8 to 10 |
| `node tools/viewport-audit.js . <out>` | controls, labels, touch targets, tap selection, turning, the other views, the goal banner and full time at 360x640, 390x664, 844x390, 1366x768, 1920x1080 | passes at all five |
| `node tools/save-compat.js legacy/release-1.6.0 .` and the reverse | a single-manager and a three-manager hot-seat game saved on the live 1.6.0 load in 1.7.0, and back | 19 of 19 each way |
| `node tools/tile-reference.js`, `sprite-reference.js`, `frame-reference.js` with the files in `tools/reference/` | 1,717 ground tiles, 61,248 player pictures and 198 whole frames against the build before the smoothness pass | identical to the pixel |
| `node tools/phone-probe.js . 6` | a minute of play at phone size with the processor slowed six times | 0.1% to 0.3% of frames slower than 30 a second (4% before the pass) |

`PHASE-3-QA-REPORT.md` records exactly which of these ran on the final file and which on the build one small change earlier, and holds the brief's acceptance matrix row by row: 55 rows, none open. Rows marked "Manual" were checked by eye in captures.

One caution from this phase, kept here because it matters to anyone trusting the table above: for one milestone a test passed while the game was wrong, because the test carried its own copy of a rule from the match screen. The rule now lives in one function (`MD.lookAhead`) that both call. `test-youth.js` also failed about one run in seven until its club was pinned; that fault was in the test and older than this phase.

## 5. Real-device evidence

One phone: John's Samsung Galaxy S23 Ultra, Chrome 157, measured with the game's own measuring screen (What's new > Measure the match frame rate), one minute of play at normal speed.

| | 17 Nov 16:55, before the smoothness pass | 17 Nov 22:56, 1.7.0 as it stands |
|---|---|---|
| Frames a second | 49.9 | 59.6 |
| Slowest 5% of frames | 33.4 ms | 16.8 ms |
| Frames longer than 50 ms | 92 of 2,994 | 2 of 3,577 |
| Worst frame | 341.6 ms | 242 ms |
| Drawing a frame, average | 8.5 ms | 1.7 ms |
| JS memory | 37.8 MB | 42.6 MB |

Also on that phone: live 1.6.0 installed and played in airplane mode, closed and reopened with the game where it was left (17 Nov); John's check that the keeper and referee colours read well.

What this evidence does not cover: the brief asks for a mid-range Android phone and the S23 Ultra is a flagship; no iPhone and no other browser has been measured; touch selection and turning the phone are tested by emulation and John's own use, not by a scripted run on the device. The desktop figures (60.0 frames a second at 1366x768 and 1920x1080) are from headless Chromium.

## 6. Screenshots and recordings

* No recordings were made: John said the brief's videos are not wanted.
* No screenshots are stored in the repository. The audits write theirs to the folder named on their command line (`tools/viewport-audit.js` writes one set per screen size, `tools/soak-audit.js` the measuring panels and still frames), so a current set is one command away.
* The screenshots John reviewed were sent in the working chats with each checkpoint, and his two phone screenshots of the measuring screen are in the chat of 17 November. The checkpoint reports in the repository describe what each showed.
* Playable previews sent for review: `soccer-manager-91-1.7.0-preview-3.html` is the 1.7.0 game as it stands (md5 `4701b295114d128ae4360b14c325dbda`; `python3 build.py` writes the same file as `soccer-manager-91.html`).

## 7. Remaining bugs, known limitations, risks and next priorities

**Known limitations** (the full list with detail is in `PHASE-3-QA-REPORT.md`):

* Phone landscape is unchanged, by John's decision: the stage is 820x203 px, two or three players are in view, and the camera misses three of its checks there.
* The whole-pitch camera on an upright phone fills only the middle third of the stage.
* One long frame of about a quarter of a second remained in the measured minute on the phone; most of it was not the game's drawing. A full garbage collection costs a frame or two once or twice a minute on a slow device.
* The first frame of a match paints its whole screen before the clock starts; a seek paints the screen it lands on.
* Art: the near terrace is the right end's painting mirrored; the crowd figures are chunky; the referee's raised card is a few pixels.
* The smoothness pass costs about 10 MB of memory on a phone and 22 MB on a desktop stage while the page is open.

**No known bugs** are open in the matchday or the management game. That is a statement about what the suites and audits cover and what John has played, not a proof.

**Risks.**

* A slower phone than the one measured may not hold 30 frames a second; lower-detail settings (brief 10.3) are not built. The measuring screen and `tools/phone-probe.js` are the means to find out.
* The source is written as long lines; a `//` comment in the middle of a line silently removes the rest of it. This happened twice in the phase and both were caught by a check. Use `/* */` or a line of its own.
* The art cannot be repainted from the repository alone: the Blender reference renders are not on GitHub (`ART-PIPELINE-ARCHIVES.md`).
* Tags can only be created by John on the GitHub page; the working sessions cannot push them.

**Next priorities**, in the order agreed on 18 November:

1. The Premium Dark management interface, on its own branch from this baseline, starting with a checkpoint of Home, Squad and Transfer Market for John's approval.
2. One combined public release: Milestones 4 and 5, the smoothness pass, the Premium Dark interface and these documents, with the version number and release notes agreed first and John's explicit approval before anything is merged to `main`.
3. Before the final handover: a decision on permanent storage for the art archives; removing the old `milestone-4` branch once the combined release is live and verified.
4. Later, as wanted: a mid-range phone measurement; phone landscape; Phase 4 (a true 3D view), for which `PHASE-4-HANDOVER.md` is written.

## 8. Is 1.7.0 recommended for release?

Yes, technically: every suite and audit passes on it, saved games from the live 1.6.0 carry over and back, the picture is unchanged to the pixel by the last pass, and on the one phone measured it is markedly smoother than what is live. There is no blocker.

It is not being released on its own because John prefers one coordinated release with the new interface to two in quick succession. Nothing in 1.7.0 goes stale by waiting; it is the baseline the interface work starts from. Rolling back, should it ever be needed, is in `ROLLBACK.md`.

## To complete at publication

These are left open on purpose and are filled in when the combined release is approved and published:

* the released version number, its commit on `main`, the `index.html` size and md5, and the service worker cache name;
* the tag of that release and confirmation that GitHub Pages served it;
* John's check on his phone that the installed game shows the new version with his save intact;
* the final results of every suite and audit on the released file, including the interface work;
* the release notes shown under What's new.
