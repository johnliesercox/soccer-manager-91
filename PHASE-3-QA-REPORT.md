# Phase 3 QA report (interim, updated through Milestone 3D)

Source baseline: commit 9115a15 ("Add source, build script and tests (1.4.0)"), verified to rebuild the live `index.html` byte for byte. Milestones 1, 2 and 2A are on top of it in the working tree (preview build `1.5.0-m2a preview`, not deployed). Test commands: `node test-isometric.js`, plus every existing suite (`test-matchday.js`, `test-playback.js`, `test-matchday-ui.js`, `test-phase25.js`, `test-equivalence.js`, `test-regression.js`, `test-contracts.js`, `test-youth.js`, `test-hof.js`). Run them one at a time: two UI suites running at once share a temporary file and can trip each other.

Status words: **Pass** (automated, on this build), **Manual** (checked by eye in captures or recordings), **Open** (not yet covered; the milestone that will), **N/A**.

## A. Geometry / projection

| | Test | Status | Evidence |
|---|---|---|---|
| A01 | Projection deterministic | Pass | same point, camera, viewport twice |
| A02 | 105:68 metric mapping; centre, corners, spots align | Pass | formula checks, spots 83 m apart |
| A03 | Centre circle, boxes, arcs follow world markings | Pass | 360 world samples project to a 2:1 ellipse (ratio 2.000); all markings inside the pitch rectangle |
| A04 | Inverse projection accurate for taps | Pass (ground) / Open (sprite boxes at every zoom, M4) | half a metre per six pixels at P 12; taps use drawn sprite boxes nearest-first |
| A05 | World to screen to world round trip | Pass | worst error 0 at P 5.2, 12, 16 over 1,500 points |
| A06 | Feet anchor stable across headings and poses | Pass | lowest filled row within 0.3 m of the anchor for 10 grounded poses, 8 headings, 2 scales |
| A07 | Stable depth order, no flicker | Pass | 30 s at 30 fps: no pair of players swaps draw order three times within a second |
| A08 | Ball shadow at ground coordinate while airborne | Pass | a two-metre ball rises exactly 2P px above its shadow |
| A09 | Goals and nets in correct order | Pass / Manual | back part sorts before front part; X=0 goal behind X=105 goal; sequences at both ends in `goal-sequence-*.png` |
| A10 | Attacking ends correct in both halves and extra time | Manual | first-half goal at the right end, second-half goal at the left end in the recording; extra time Open (M5) |

## B. Renderer and animation

| | Test | Status | Evidence |
|---|---|---|---|
| B01 | create/mount/render/resize/dispose clean up | Pass | jsdom lifecycle; tile sets and sprite cache cleared on dispose |
| B02 | Headless drawFrame from the same scenes | Pass | 180 frames over three matches, plus the whole-pitch camera |
| B03 | Every movement/action state has a frame or fallback | Pass | sampled 6+ actions and 4+ movement bands; unknown poses fall back to idle |
| B04 | Eight-way heading selection across 0/2π and diagonals | Pass | full turn visits each heading once; wrap-around equal; hysteresis holds then releases |
| B05 | No excessive facing flicker; contacts line up with ball movement | Manual | kick frames keyed to `actionPhase` (contact at 0.42 to 0.66); recording |
| B06 | Round ball legible across zoom and modes | Manual | 7 cells at P 12, 9 cells at P 16, both recordings |
| B07 | Kits, GK, referee distinct, kit clash | Manual / Open | stripes, hoops, quarters, swapped keeper colours with gloves, black referee; clash case Open (M5) |
| B08 | Sent-off player disappears, stand-in keeper exists | Open (M5) | scene already provides both (Phase 2.5 tests) |
| B09 | Goal shot, line crossing, celebration order | Manual | `goal-sequence-*.png`, both recordings (ball in net, GOAL overlay a beat later, celebration) |
| B10 | Corner and keeper dive framing and layering | Manual | corner at 36 s of the desktop recording; dives at both ends |
| B11 | Assets local, no runtime network | Pass | everything is generated in code; `C03` grep |

## C. Match logic and integrity

| | Test | Status | Evidence |
|---|---|---|---|
| C01 | Watching in ISO changes no game state | Pass | state JSON identical after capture, scene build and rendering |
| C02 | Official facts match playMatch | Pass | Phase 2.5 and matchday suites unchanged |
| C03 | Renderer never touches engine RNG or outcome functions | Pass | source grep of the seven isometric modules |
| C04 | Capture/timeline validations keep passing | Pass | `test-matchday.js`, `test-phase25.js` |
| C05 | Pause, speeds, skip, seek, replay emit events correctly | Pass | `test-playback.js`, `test-matchday-ui.js` |
| C06 | Random-access and shuffled sampling agree | Pass | `test-phase25.js` |
| C07 | Hot-seat spoiler-free; Instant result unchanged | Pass | `test-matchday-ui.js` |
| C08 | Extra time, penalties, aggregates, unknown scorers | Pass | `test-playback.js` samples |
| C09 | Save migration, youth, contracts, hall of fame, progression | Pass | regression, youth, contracts, hall of fame suites |
| C10 | Pixels/Markers/Board still selectable and passing | Pass | View cycle test; headless draws |

One scene change outside the renderer: `behaviour.js` no longer sends defenders to press a dead ball lying in the net (they used to walk into the goal after conceding). Illustrative only; every Phase 2.5 test still passes.

## D. Camera, interface, usability

| | Test | Status | Evidence |
|---|---|---|---|
| D01 | Follow and Whole Pitch work and persist; unknown stored view falls back | Pass | UI test toggles both; `getView` falls back to Pixels |
| D02 | Camera snaps on cuts/seeks, pans within its cap otherwise | Pass | 60 s at 60 fps within `PAN_MAX` (2.5x `PAN_MAX` while a shot is in flight); snap independent of prior state |
| D03 | Keeper, shot and goalmouth visible for `goal` interest | Pass / Manual | both posts on screen at every shot and goal of the seed 1991 match on 904x619 at P 24 and 366x425 at P 16 and 12 (`camdiag`); goal sequences at both ends in the captures; right-end goal sits low in frame by design (shallow near side) |
| D04 | Five viewports show required controls | Pass (Chromium) | 360x640, 390x664, 844x390, 1366x768, 1920x1080 with the Isometric view mounted |
| D05 | Phone touch selection at zoom levels | Open (M4) | click hit-test implemented, not yet exercised on touch |
| D06 | Reduced motion; official text accessible | Pass | `reducedMotion` snaps the camera; aria-live commentary unchanged |
| D07 | Fast-forward banner, clock, goal overlay, commentary legible | Manual | both recordings |
| D08 | Desktop side panel never pushes the action bar off | Pass | layout unchanged from 1.4.0 (two-column grid) |
| D09 | Rotation reflow | Open (M4) | `resize` rebuilds tiles for the new scale |

## E. Performance, packaging, deployment (headless Chromium, this machine)

| Viewport | Stage | Scale | fps | p95 frame | render/frame | tile paint | resident cap |
|---|---|---|---|---|---|---|---|
| 360x640 | 336x410 | 12 | 60.5 | 18.5 ms | 0.9 ms | 3.4 ms | 36 tiles, 9 MB |
| 390x664 | 366x425 | 12 | 60.5 | 18.2 ms | 0.9 ms | 2.8 ms | 36 tiles, 9 MB |
| 844x390 | 820x234 | 16 | 60.3 | 19.2 ms | 1.2 ms | 4.2 ms | 48 tiles, 12 MB |
| 1366x768 | 904x619 | 16 | 60.3 | 19.1 ms | 0.9 ms | 3.6 ms | 48 tiles, 12 MB |
| 1920x1080 | 1164x756 | 16 | 60.3 | 20.2 ms | 1.9 ms | 3.5 ms | 48 tiles, 12 MB |

The Milestone 1 world image (20 MB phone, 35 MB desktop, 35 to 67 ms to build) is gone: the ground is painted in 256 px tiles on demand with a least-recently-used cap, so a match typically holds far less than the cap. E01 Pass in headless Chromium; E02 (real Android) Open: the preview file is the way to measure it; E03 (no growth over opens and toggles) Open (M5), tile sets and the sprite cache are released on dispose; E04 scene generation untouched (about 320 ms); E05 to E09 Open (M5/M6).

## Milestone 2A additions (art assets)

| | Test | Status | Evidence |
|---|---|---|---|
| B03 | Every pose, frame and heading has a sheet frame with a feet anchor, both styles | Pass | 272 frames per style at 16 px/m |
| B07 | Keeper frames with gloves; stripes change the shirt | Pass | `test-isometric.js` |
| B11 | Crowd strips and grass textures available; no runtime network | Pass | assets inlined as data URIs |
| B02 | Frames draw with the asset sheets, both styles | Pass | 20 frames each, headless |
| E06 | Fallback: no style selected, or a missing sheet, draws the procedural art | Pass | `isoAssets.get` returns null, actors fall back |
| E07 | Clean checkout rebuilds the sheets and the game | Pass | `node tools/iso-art.js`, `python3 build.py` |
| E01 | 60 fps desktop with assets | Pass (headless) | 60.5 fps, 0.8 ms render, 3.8 ms per tile at 1366x768 |
| E02 | Real Android | Open | preview file |
| D02 | A shot in flight whips the camera to the goal on a phone (close camera) | Pass | `test-isometric.js` D02 shot cap; phone goalmouth captures show both posts, the keeper and the ball |
| B12 | A painted override cell replaces the generated cell and keeps its feet anchor | Pass | `test-isometric.js` (run frame, style B, 16 px/m) |
| B13 | The painted far-stand texture registers with its metres and anchor and tiles in the far stand | Pass / Manual | `test-isometric.js`; far-wing captures and recording |
| E06 | Fallback with painted art: a missing override cell draws the generated cell; a missing stand draws the generated stand | Pass | the loader's overlay is per cell; `standTexture` null = generated |

## Phase 3 art completion (14 November 2026): the full painted set

Build `1.5.0-phase3-art preview`, style B only, 4.2 MB (the trial preview was 6.1 MB with both styles; the template-coded sheets are now lossless palette PNGs and the painted textures 255-colour palette PNGs, which took 2.8 MB out of the file at no visible cost).

| | Test | Status | Evidence |
|---|---|---|---|
| B14 | Painted stadium pieces register per name, fall back to the nearest scale, and tile from their anchor corner | Pass | `test-isometric.js` B14 (synthetic near-stand texture lands just above its anchor) |
| B15 | Dugouts are ground on the far side, open towards the viewer; the generated shelter draws without a painted piece | Pass | `test-isometric.js` B15 |
| B16 | Every frame the game uses is painted: 496 of 544 outfield cells (the 48 unpainted are the outfield dive rows, which only keepers use), 248 of 272 keeper cells (the 24 unpainted are referee poses) | Pass | manifest coverage count |
| B17 | The second hair style (the referee's) and the card material convert; a maroon-hair artefact (short dark hair read as shirt shadow) is corrected by a shirt penalty around the reference hair | Pass | review sheets at 2x, both hair styles, keepers |
| C01/C03 | Watching changes nothing; the isometric modules never touch the engine or the save | Pass | unchanged |
| D10 | Camera/View/Sound row fully visible above the action bar with a 40-line log | Pass | Playwright at 360x640, 390x664, 844x390, 1366x768: controls 491..525 px against an action bar from 579 px on the narrowest phone |
| D11 | Isometric view with the close camera is the default; Iso A is left out of the View cycle when the build ships style B only | Pass | `test-matchday-ui.js` |
| E01 | 60 fps with the complete art | Pass (headless) | table below |
| E08 | Every suite passes one at a time on the final build | Pass | contracts, equivalence, hof, matchday, phase 2.5, playback, regression, isometric (55 checks), matchday UI, youth (now on a fixed seed) |

Performance and memory with the complete art (headless Chromium, `--enable-precise-memory-info`; "tour" renders a frame every two match seconds from kick-off to the final whistle, so every tile the camera can reach is painted):

| Viewport | Stage | Camera | Scale | fps | p95 frame | render/frame | tour/frame | tile paint | resident tiles | JS heap after |
|---|---|---|---|---|---|---|---|---|---|---|
| 360x640 | 336x410 | close | 16 | 60.3 | 18.7 ms | 1.2 ms | 1.6 ms | 4.8 ms | 48 (12 MB) | 26 MB |
| 360x640 | 336x410 | follow | 12 | 60.3 | 18.2 ms | 0.8 ms | 1.1 ms | 3.5 ms | 36 (9 MB) | 23 MB |
| 390x664 | 366x425 | close | 16 | 60.3 | 18.6 ms | 0.9 ms | 1.9 ms | 3.7 ms | 48 (12 MB) | 28 MB |
| 390x664 | 366x425 | follow | 12 | 60.3 | 18.7 ms | 0.6 ms | 1.3 ms | 3.5 ms | 36 (9 MB) | 28 MB |
| 844x390 | 820x203 | close | 24 | 59.3 | 19.2 ms | 0.9 ms | 6.5 ms | 5.5 ms | 48 (12 MB) | 35 MB |
| 844x390 | 820x203 | follow | 16 | 60.0 | 19.0 ms | 0.7 ms | 1.8 ms | 3.6 ms | 48 (12 MB) | 36 MB |
| 1366x768 | 904x619 | close | 24 | 59.8 | 20.0 ms | 1.3 ms | 10.6 ms | 5.5 ms | 48 (12 MB) | 31 MB |
| 1366x768 | 904x619 | follow | 16 | 60.3 | 19.7 ms | 0.9 ms | 4.1 ms | 3.4 ms | 48 (12 MB) | 29 MB |

The page loads in about 0.5 s from disk; the JS heap is 15 MB before a match and 23 to 36 MB after a whole-match tour with a full sprite cache (2,400 recoloured frames). Per-frame cost is unchanged from Milestone 2A because the painted textures are blitted into the same cached tiles; the 24 px tiles cost 1 to 2 ms more to paint than before (the stand textures are scaled on the way in), which only shows on a cut.

Stadium corrections made on the way: the X=105 end stand had collapsed into one band since Milestone 2 (its slope lay along the line of sight) and is now a shallow terrace; the rows of the two terraces that rise towards the viewer are painted nearest-the-pitch first; the hoardings stand in front of the near terrace instead of behind its first row; the dugouts moved to the far side, where their open fronts face the viewer.

## Milestone 3A (14 November 2026): chances and highlight selection

| # | Check | Result |
|---|---|---|
| 3A.1 | Shots per match follow the official record (season of 731 matches: 0 goals 7.3 shots, 2 goals 12, 4 goals 17, never more than 25) | pass |
| 3A.2 | Every shot has a technique (kick 63%, first-time 28%, header 6%, volley 4%) and belongs to a tagged chance; every outcome occurs (catch, parry, wide, over, post, bar, line, sliding and standing block) | pass |
| 3A.3 | Woodwork strikes land on the post or bar at the real geometry and the ball comes back; catches are held; parries rebound; line clearances start on the line; blocks happen on the ball's path | pass |
| 3A.4 | Goals: official second and scorer unchanged (`test-matchday.js` still reconciles every match of two seasons); finished in every technique (kick 40%, first-time 34%, header 19%, volley 8%); the last pass reaches the scorer; a headed goal comes from a cross at head height | pass |
| 3A.5 | Scene choreography: headers met in the air by the header action, volleys off the ground, first-time strikes from where the ball lands, catches end in the keeper's hands, the woodwork is struck and the ball comes back with the shooter reacting, blocks on the ball's path (samples of 10 matches) | pass |
| 3A.6 | Highlight selection deterministic; every goal, card, kick-off and whistle inside a highlight; each chosen chance shown whole; the shown chances outscore the skipped ones in every one of 60 matches; kinds varied in 54 of 60, spread in 56 of 60 | pass |
| 3A.7 | A goalless match runs shorter (73 s) with fewer incidents (10 windows) than a five-goal match (111 s, 13 windows); the longest possible programme (8 goals, 4 cards, extra time) stays under 150 s | pass |
| 3A.8 | Scene build time 266 ms per match (was 437 ms before the planner's distance maths and take lookup were tightened), so the 400 ms budget holds with 20% more keyframes | pass |
| 3A.9 | All earlier suites pass unchanged in meaning: `test-matchday`, `test-phase25` (new actions allowed, players brake after the whistle), `test-playback` (length bounds raised to the new design), `test-isometric` (flicker counted only for overlapping pairs), `test-matchday-ui`, `test-regression`, `test-equivalence`, `test-contracts`, `test-hof`, `test-youth` | pass |

## Milestone 3B (14 November 2026): the animation set, reactions, crowd, commentary, rules

| # | Check | Result |
|---|---|---|
| 3B.1 | Twelve new poses in both hair styles and for the keeper, painted through Floyo batch 4 (28 runs plus two re-rolls, of which one cell each was taken); every cell painted except the dive and parry headings a painter cannot read, which fall back to the generated figure by design | pass |
| 3B.2 | Season audit (731 matches): the ball never teleports between events; every corner follows a touch by the defending side; every goal kick follows the attackers putting it behind; no live ball lands beyond the lines; no caught shot rebounds | pass |
| 3B.3 | Commentary: every shot (652 of 652 in 40 matches) is called as it is struck and its outcome as it lands; every highlight that opens on open play has a lead-in; no shot is struck under a line more than eight seconds old | pass |
| 3B.4 | Celebrations: all four styles occur across a twelve-match sample; the scorer celebrates through every window; at least three teammates join; the beaten keeper reacts to every goal; the crowd signal names the scoring side; missed chances draw three kinds of reaction | pass |
| 3B.5 | Choreography on the painted frames: headers met in the air, volleys off the ground, first-time strikes from where the ball lands, catches held, the woodwork struck and the ball back, blocks on the ball's path (samples of 10 matches) | pass |
| 3B.5a | A corner shown is followed to its outcome in the same window; the one volley in a match is not passed over for a repeat of a routine catch (selection sample of 60 matches: 54 fully varied, 58 spread, drama kept 58/58) | pass |
| 3B.5b | A booking reads from the picture: the referee beside the offender with the card up (strips of the three fixtures); a shot wide lands within six metres of the post (three and a half for a header or volley) | pass |
| 3B.6 | All eleven suites pass one at a time on the final build; the camera interest gains a `celebration` kind; the build is 5.37 MB (the sheets are 70% taller) | pass |
| 3B.6a | Performance with the taller sheets (headless Chromium): 60 fps at 360x640, 390x664, 844x390 and 1366x768, p95 frame 18 to 19 ms, 0.7 to 1.4 ms of render per frame, 2.7 to 4.9 ms per ground tile, 25 to 38 MB of JS heap after a whole-match tour (17 MB before the match, was 15), load 0.5 s | pass |
| 3B.7 | Desktop (1366x768) and phone (iPhone 13) recordings of whole matches at 1x through the real UI, in `phase3-m3b/recordings/` | see the checkpoint |

## Milestone 3C (14 November 2026): the contact audit

| # | Check | Result |
|---|---|---|
| 3C.1 | `test-contact.js`: 20 matches, 38,700 contacts measured against the drawn sprite's contact point; per-kind pass rates after the fixes: pass 100%, cross 100%, clearance 99%, shot 100%, first-time 99%, header 100%, volley 100%, first touch 100%, catch 98%, parry 97%, sliding block 100%, standing block 100%, goal-line clearance 100%, slide tackle 93%, standing tackle 98% (before: 91, 33, 94, 68, 96, 0, 100, 98, 83, 96, 6, 100, 38, 2, 10) | pass |
| 3C.2 | Typical ball-to-contact distance after: 0.11 m for kicks and first touches, 0.00 for headers and catches, 0.12 for parries and tackles; facing at the contact within 1 degree for every kind | pass |
| 3C.3 | Bookings (105 in 40 matches with a foul): the offender within 3 m of the foul 101, the foul shown as a slide 105, the victim down 102, the referee beside the offender when the card is shown 105 | pass |
| 3C.4 | All twelve suites pass one at a time on the final build; engine equivalence holds | pass |
| 3C.5 | Performance (headless Chromium): 60 fps at 360x640, 390x664, 844x390 and 1366x768, p95 frame 18 to 20 ms, 0.4 to 1.5 ms of render per frame, 25 to 37 MB heap after a match, load 0.5 s, 5.4 MB | pass |
| 3C.6 | Engine record defects noted for John's decision (not changed): 40 goals by a player after his own red card and 95 second yellows before the first, over 4,820 matches | noted |

## Milestone 3D (15 November 2026): the record, the camera, the celebration, the crowd

| # | Check | Result |
|---|---|---|
| 3D.1 | `test-record.js`: four seeds, 42 weeks each (4,820 matches, 13,459 goals) against the frozen 1.5.0 engine: identical fixtures, scores, scorers, bookings, dismissals, bans, statistics, points and balances; no goal at or after its scorer's dismissal; every second yellow after the first; minutes in range; 35 goal minutes and 100 dismissal minutes moved; deterministic | pass (19,457 checks) |
| 3D.2 | `test-camera.js` on the desktop stage (904x560, 146 highlights, 139,450 frames at 60 fps): the ball in view 100%; the striker and the ball at the strike 100% of 91; both posts as the shot arrives 100% of 61; the offender and the referee through a booking 100%; the scorer through a celebration 99.4%; both men at a challenge 100%; the man on the ball 100%; no frame without a player; over the pan cap 2 frames; the scale changes only at a cut (24 cuts, 0 elsewhere); celebration frames at the close scale 89% (the rest are the 1.2 s on the net before the cut) | pass |
| 3D.3 | The same on the phone stage (390x430): ball 100%, strike 100%, arrival 98.4%, booking 99.9%, celebration 97.8%, challenge 100%, man on the ball 100%, 41 frames of 139,450 with no player in view (a loose ball rolling clear for 0.7 s on the narrow stage), over the cap 4 frames, 28 scale cuts, all at a goal | pass |
| 3D.4 | `test-contact.js` after the timeline fixes (20 matches, 38,879 contacts): every kind at 99 to 100% except the small samples (sliding block 19 of 20, goal-line clearance 14 of 15); slide tackle 100% (was 93%, worst 0.71 m, now 0.13 m at the 95th percentile); no contact by a dismissed man; the three outliers the new fixtures showed (a man kicking a ball 12 m away before a booking, a clearance by a man 8 m away, a sent-off keeper saving) fixed | pass (16 checks) |
| 3D.4a | Goals from distance (14 seeds, every match of week 1, 1,218 goals): shots from over 30 m were 21% of goals in 3C (101 from over 40 m, the longest 75 m, after a pass back to a deep scorer); now 2.2% (4 from over 40 m, the longest 43 m); the median goal from 14 m, the 90th percentile 23 m | pass |
| 3D.5 | All fourteen suites pass one at a time on the final build (matchday, playback, matchday-ui, phase25, isometric, highlights, contact, camera, record, contracts, hof, youth, equivalence, regression); the engine equivalence suite passes as before | pass |
| 3D.6 | Performance (headless Chromium, 360x640, 390x664, 844x390, 1366x768): 58.8 to 60.3 fps, p95 frame 18.3 to 20.1 ms, 0.4 to 1.7 ms of render per ordinary frame and 1.2 to 4.7 ms through a celebration (the wave and the flashes), 3.4 to 5.2 ms per ground tile, 27 to 38 MB of heap after a whole-match tour, load 0.45 to 0.49 s, 5.42 MB | pass |
| 3D.7 | Browser smoke (desktop and phone): the four views cycle, the match plays, no console errors | pass |

## Milestone 3D correction pass (15 November 2026): restarts, corners, the corners of the ground

| # | Check | Result |
|---|---|---|
| 3D.8 | `test-restarts.js`: 165 kick-offs (101 after a goal) over two league weeks: the conceding side restarts 101 of 101; the celebration closed before every restart; a cut at every restart after a goal; everyone but the taker in his own half (0 over the line); the receiving side outside the centre circle (0 inside); the ball on the spot and still until the kick (0 off, 0 moved); nobody drifting before the kick (0 men); a beat on the spot before every kick | pass |
| 3D.9 | The same suite, 72 corners at all four flags: at the flag on the side the ball went out 72 of 72; the ball inside the one-metre arc from the moment it is dead until the kick (furthest 0.85 m from the flag) and still; the taker within 0.45 m of the ball as he kicks it | pass |
| 3D.10 | `test-contact.js` on the final build (20 matches, 38,931 contacts): every kind at 96 to 100%, the small samples included (goal-line clearance 14 of 15); slide tackles 100% | pass (16 checks) |
| 3D.11 | `test-isometric.js` E01: every corner structure stands beyond the run-off; no corner tower rises into the projected pitch at the close scale; floodlights in the far corners only | pass (61 checks) |
| 3D.12 | `test-highlights.js`: the ball is never teleported between events (the four out-of-time turnovers that moved it 25 to 40 m without an event are gone) | pass |
| 3D.13 | All fifteen suites pass one at a time on the final build; `test-camera.js` unchanged in substance (ball 100%; the striker and the ball at the strike 100% of 100; both posts at the arrival 100% of 63; bookings 100% desktop and 99.9% phone; celebrations 99.4% and 96.8%; both men at a challenge 100% and 94.3%; the man on the ball 100%; over the pan cap 1 and 3 frames in 139,000) | pass |
| 3D.14 | Performance (headless Chromium, four viewports): see the checkpoint; the corner structures are painted into the ground tiles and cost nothing per frame | pass |

## Manual scenarios (Section 14)

Covered so far by the recordings and captures: 1 kick-off, 2 midfield passing, 4 shot saved, 5 goal, 6 corner (desktop recording, 36 s), 8 ends swap (second-half goal at the left end), 12 next-highlight cut. Open: 3 counter-attack framing review, 7 red card, 9 extra time/penalties, 10 hot-seat in ISO, 11 view switching mid-match (passes the UI test), 13 offline mobile, 14 long log desktop (layout unchanged), 15 weak-browser fallback.

## Known limitations after the Phase 3 art completion

* The near terrace is the right end's painting mirrored (a packed pen of fans seen from behind): the depth preprocessor reads the low flat near terrace as a slab and painted it as one row of giant figures four times over; a dedicated painting can replace it in seconds if a later attempt comes out right.
* The crowd figures in the painted stands are chunky (a head is about a player's head), in the 16-bit manner. (Since 3D the painted stands rise in a wave for a goal, with camera flashes; the main stand's rows under its roof stay still.)
* The referee's raised card is a few pixels and is not painted from the W heading (the painter hid the arm behind the body).
* A cut or seek can paint up to twenty tiles in one frame (about 70 ms on a desktop close camera); neighbours will be pre-painted in Milestone 5.
* Frame pacing is from headless Chromium; no real-device numbers yet (the preview file is the way to get them).
