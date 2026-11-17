# Phase 3 QA report (interim, updated through Milestone 5)

Source baseline: commit 9115a15 ("Add source, build script and tests (1.4.0)"), verified to rebuild the live `index.html` byte for byte. Milestones 1, 2 and 2A are on top of it in the working tree (preview build `1.5.0-m2a preview`, not deployed). Test commands: `node test-isometric.js`, plus every existing suite (`test-matchday.js`, `test-playback.js`, `test-matchday-ui.js`, `test-phase25.js`, `test-equivalence.js`, `test-regression.js`, `test-contracts.js`, `test-youth.js`, `test-hof.js`). Run them one at a time: two UI suites running at once share a temporary file and can trip each other.

Status words: **Pass** (automated, on this build), **Manual** (checked by eye in captures or recordings), **Open** (not yet covered; the milestone that will), **N/A**.

## A. Geometry / projection

| | Test | Status | Evidence |
|---|---|---|---|
| A01 | Projection deterministic | Pass | same point, camera, viewport twice |
| A02 | 105:68 metric mapping; centre, corners, spots align | Pass | formula checks, spots 83 m apart |
| A03 | Centre circle, boxes, arcs follow world markings | Pass | 360 world samples project to a 2:1 ellipse (ratio 2.000); all markings inside the pitch rectangle |
| A04 | Inverse projection accurate for taps | Pass | half a metre per six pixels at P 12 on the ground; since Milestone 4 a tap is resolved by `pick()` against the drawn sprite boxes at every camera scale on the stage of each of the five viewport presets (`test-touch.js`: a tap on a figure's body selects it in 11 views, overlapped or not, after the camera has panned) |
| A05 | World to screen to world round trip | Pass | worst error 0 at P 5.2, 12, 16 over 1,500 points |
| A06 | Feet anchor stable across headings and poses | Pass | lowest filled row within 0.3 m of the anchor for 10 grounded poses, 8 headings, 2 scales |
| A07 | Stable depth order, no flicker | Pass | 30 s at 30 fps: no pair of players swaps draw order three times within a second |
| A08 | Ball shadow at ground coordinate while airborne | Pass | a two-metre ball rises exactly 2P px above its shadow |
| A09 | Goals and nets in correct order | Pass / Manual | back part sorts before front part; X=0 goal behind X=105 goal; sequences at both ends in `goal-sequence-*.png` |
| A10 | Attacking ends correct in both halves and extra time | Pass | since Milestone 5 ends change at half-time, for extra time and at its interval (`MD.homeDirAt`); `test-situations.js`: 56 of 56 matches that went to extra time, and every one of their goals is scored at the end its scorer attacks |

## B. Renderer and animation

| | Test | Status | Evidence |
|---|---|---|---|
| B01 | create/mount/render/resize/dispose clean up | Pass | jsdom lifecycle; tile sets and sprite cache cleared on dispose |
| B02 | Headless drawFrame from the same scenes | Pass | 180 frames over three matches, plus the whole-pitch camera |
| B03 | Every movement/action state has a frame or fallback | Pass | sampled 6+ actions and 4+ movement bands; unknown poses fall back to idle |
| B04 | Eight-way heading selection across 0/2π and diagonals | Pass | full turn visits each heading once; wrap-around equal; hysteresis holds then releases |
| B05 | No excessive facing flicker; contacts line up with ball movement | Manual | kick frames keyed to `actionPhase` (contact at 0.42 to 0.66); recording |
| B06 | Round ball legible across zoom and modes | Manual | 7 cells at P 12, 9 cells at P 16, both recordings |
| B07 | Kits, GK, referee distinct, kit clash | Pass | `test-situations.js` over 2,410 matches: no colour of one side's shirt is close to a colour of the other's (stripes, hoops and quarters counted as two colours), no keeper wears a colour of the opposing side or his own, the keepers differ, the referee is told from all four, nobody is in pitch-green |
| B08 | Sent-off player disappears, stand-in keeper exists | Pass | `test-situations.js`: 71 dismissals drawn on the whole-pitch camera (18 of goalkeepers, 24 matches with two): the player is never drawn again, his side is a man short for each man lost, a team-mate is in goal in the keeper's kit |
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
| D04 | Five viewports show required controls | Pass (Chromium, repeatable) | `tools/viewport-audit.js` at 360x640, 390x664, 844x390, 1366x768, 1920x1080 in the Isometric view: all 11 controls on screen, unclipped and uncovered while playing, after a turn and at full time; nothing scrolls sideways; no button label cut off in any camera (labels also checked at twelve widths from 320 to 768 px) |
| D05 | Phone touch selection at zoom levels | Pass (emulated touch) / Manual on the phone | `test-touch.js` and `tools/viewport-audit.js`: a fingertip up to 14 px outside a figure selects it, the figure whose body is tapped wins among overlapping ones (all 22 on the whole-pitch camera on a phone), a tap on a control never selects a player, taps while paused do not move the picture. Real-finger check: John's phone, with the 1.7.0 preview |
| D06 | Reduced motion; official text accessible | Pass | `reducedMotion` snaps the camera; aria-live commentary unchanged; since Milestone 4 the generated crowd holds still too (`test-touch.js`) |
| D07 | Fast-forward banner, clock, goal overlay, commentary legible | Manual | both recordings |
| D08 | Desktop side panel never pushes the action bar off | Pass | layout unchanged from 1.4.0 (two-column grid) |
| D09 | Rotation reflow | Pass (emulated) / Manual on the phone | the stage is redrawn at once at the new size while playing, paused, in a fast-forward and at full time, the camera still on the same play (`test-touch.js`, `tools/viewport-audit.js` turns each preset both ways) |

## E. Performance, packaging, deployment (headless Chromium, this machine)

| Viewport | Stage | Scale | fps | p95 frame | render/frame | tile paint | resident cap |
|---|---|---|---|---|---|---|---|
| 360x640 | 336x410 | 12 | 60.5 | 18.5 ms | 0.9 ms | 3.4 ms | 36 tiles, 9 MB |
| 390x664 | 366x425 | 12 | 60.5 | 18.2 ms | 0.9 ms | 2.8 ms | 36 tiles, 9 MB |
| 844x390 | 820x234 | 16 | 60.3 | 19.2 ms | 1.2 ms | 4.2 ms | 48 tiles, 12 MB |
| 1366x768 | 904x619 | 16 | 60.3 | 19.1 ms | 0.9 ms | 3.6 ms | 48 tiles, 12 MB |
| 1920x1080 | 1164x756 | 16 | 60.3 | 20.2 ms | 1.9 ms | 3.5 ms | 48 tiles, 12 MB |

The Milestone 1 world image (20 MB phone, 35 MB desktop, 35 to 67 ms to build) is gone: the ground is painted in 256 px tiles on demand with a least-recently-used cap, so a match typically holds far less than the cap. E01 Pass in headless Chromium; E02 (real Android) measured on 17 November and still open (see "E02 on John's phone"); E03 (no growth over opens and toggles) Open (M5), tile sets and the sprite cache are released on dispose; E04 scene generation untouched (about 320 ms); E05 to E09 Open (M5/M6).

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
| E02 | Real Android | Open: measured 17 November, the average is met and the slow frames are not | John's Samsung Galaxy, 49.9 frames a second, slowest 5% at 33.4 ms against 33.3; see "E02 on John's phone" below |
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

## Milestone 4 (16 November 2026): touch, turning the phone, the five viewports

Scope agreed with John on 16 November: an audit first, then touch selection, rotation, the camera at the real stage sizes and the small interface items of section 9. Phone landscape is left as it is by his decision (see the limitations below). Version 1.7.0.

The audit of 1.6.0 (`tools/viewport-audit.js`, Playwright Chromium, phones emulated with touch) found every control on screen at all five sizes, and five faults, each now fixed and held by a test:

| | Fault in 1.6.0 | Fix | Held by |
|---|---|---|---|
| D09 | Turning the phone (or resizing the window) while paused left the stage blank until Play: sizing a canvas clears it, and a paused match draws no frames | `resize()` redraws at once; when nothing is playing the renderer draws a still frame (the stored scene, complete, the camera not moved on). Pixels, Markers and Board had the same fault: the match screen now redraws the paused picture after a resize for every view | `test-touch.js`, the audit (turns while paused, playing, in a fast-forward, at full time; the other three views turned while paused) |
| D09 | After Skip the stage stayed black at full time, with the last event's badge on it: the match ends on a cut, a cut fades in from black over several frames, and only one frame is drawn | a frame drawn part-way through a fade is completed 350 ms later if no frame follows; badges are not raised for the events Skip jumps past (the log still has them) | `test-touch.js`, the audit (full time must show the ground and no badge) |
| D05 | Taps on the stage while paused slid the picture (20 to 49 px over a handful of taps): each tap redrew, and each redraw stepped the camera | a still frame passes no time to the camera (`dtReal` 0 holds it exactly); a tap never draws a loop frame of its own | `test-touch.js`, the audit (the paused picture must not move) |
| D05 | Selection had no tolerance (4 px outside a figure's box missed) and the front-most box won, so overlapping figures on the whole-pitch camera could not be told apart on a phone | `pick()`: every figure within reach of the tap is a candidate (14 px for a fingertip, 4 px for a pointer) and the one whose body is nearest wins | `test-touch.js` (11 views), the audit (every figure on screen tapped on its body: 22 of 22 on the whole-pitch camera) |
| 9 | "Camera: follow" was cut off at 384 and 390 px wide, "View: Isometric" at 412 px, and Camera, View and Sound were 34 to 35 px tall (Play, the speeds and Skip 40 px) | `Cam:` and `Iso` labels below 480 px with the full wording as the accessible label; 44 px buttons on a phone held upright, the stage giving up 14 px | the audit (labels in every camera, touch target sizes); twelve widths from 320 to 768 px checked by hand-run script |

Also in the milestone: the tag over a selected player now reads number, name and position and stays inside the picture; under reduced motion the generated crowd no longer flickers through a goal (the painted stands already held still).

Checked and found sound, so not changed: the goal badge never sits on the goal at either end at any of the five sizes (the audit measures it against the posts and bar at the moment it appears); the `GOAL!` lettering is placed in the half of the picture away from the goal.

The camera at the real stage sizes (`test-camera.js`, a dozen matches at 60 frames a second, now on the stage of each preset instead of two approximations): at 336x396, 366x411, 904x619 and 1164x756 the ball is in view in 100% of frames, the striker and ball at every strike (95 of 95), both posts at every arrival (63 of 63), the man on the ball 100%, and the view never runs off the painted ground. Manual scenario 3 (counter-attack) reviewed on film strips of the fastest break of a match on a phone and a desktop (one frame a second): the carrier, the ball in flight, the receivers and the defenders ahead of him are in the picture throughout, and the pan stays within its cap.

Saved games: `tools/save-compat.js legacy/release-1.6.0 .` 19 of 19 (single and three-manager hot-seat games, slots and autosave, played on after the update), and 19 of 19 with the two folders swapped (the rollback direction). The tool now reads both version numbers from the files it serves.

On the final 1.7.0 build (`index.html` 7,083,243 bytes): all 18 suites pass one at a time (the 17 of 1.6.0 and `test-touch.js`, 61 checks), and `tools/viewport-audit.js` passes at all five sizes.

Not checked here and left to John's phone: a real finger on a real screen (the emulation sends true touch events but a finger is not a point), and load time.

## Milestone 5 (17 November 2026): the rare situations, failure, and the phone

Scope agreed with John on 17 November, built on top of the Milestone 4 work as he decided (both go out as one release, 1.7.0, when he says). An audit first (`test-situations.js` and `tools/soak-audit.js`, no change to the game), a checkpoint on its findings, then the fixes.

What the audit found sound, and what now holds it:

| | Checked | Result |
|---|---|---|
| E03 | Ten matches opened and closed and twenty view switches in Chromium (`soak-audit.js leak`) | JS memory 6.4 MB after matches 3 to 5 and 6.8 MB after matches 8 to 10; no animation loop, observer, resize listener, canvas or viewer left behind after any match |
| E05 | One visit, then the network cut (`soak-audit.js offline`) | the game reloads from its cache, a new game starts, its first match is painted in the isometric view, the next week plays, and reopening carries on from the autosave |
| E05, scenario 13 | **On John's Samsung Galaxy, live 1.6.0, 17 November**: the installed app in airplane mode | passed: a game played, the app closed and reopened, the same place resumed, the match graphics all as expected |
| scenario 10 | A three-manager hot-seat week (`soak-audit.js hotseat`) | each match opens in the isometric view; no score on a handover screen, on the screen before kick-off or on the scoreboard at kick-off; each ends on the engine's score |
| scenario 9 | Extra time and penalties (`test-situations.js`) | six matches drawn to the last second with no error; 30 of 30 shoot-outs show the Penalties stage, name the official winner, invent no kick and keep the score level |
| scenario 7, B08 | Dismissals | see B08 above |

What it found wrong, each fixed and held by a test:

| | Fault | Fix | Held by |
|---|---|---|---|
| 10.2, scenario 15 | An error in the isometric view in the middle of a match froze the picture and left no way off the match screen but a reload | the view is marked broken for that match and the next takes over at the same second (Pixels first); if nothing can draw, the viewer closes onto the result with a message | `soak-audit.js fallback` (the view made to throw after ninety frames) |
| 10.2 | If the isometric view could not be created or mounted, the match went straight to its result, at every match | the same chain: Pixels is shown, with a message once | `soak-audit.js fallback` (two faults) |
| E06 | If the painted art never arrived, the whole match played behind "Preparing the ground..." | after the six-second wait the renderer draws with the generated figures and stands wherever a painted one is missing | `soak-audit.js fallback` |
| A10 | Ends were not changed in extra time: both periods were played the way of the second half | one rule for ends, shared by the timeline and the scene; John asked for the change at the interval too | `test-situations.js` |
| B07 | A striped, hooped or quartered shirt shared a colour with the other side's shirt in 423 of 2,410 matches; a keeper (in his club's second colour) was close to the opposing shirt in 1,115; twelve dark colours were close to the referee's black across 1,045; one club's keeper was green on the grass | the clash rule counts both colours of a patterned shirt and treats an all-green shirt as a clash; keepers and the referee are dressed per match from short lists to stand clear of everyone (agreed by John: keepers no longer wear club colours) | `test-situations.js` (and a count over 7,230 matches of six seasons from three seeds while tuning: no violation) |
| scenario 9 | At the interval of extra time the commentary said "Extra time. Thirty more minutes." a second time | "The second period of extra time. Fifteen more minutes." | read in the still |

Working ahead of cuts (item 5 of the scope). The fault was wider than the note left for this milestone: a cut cost several frames not only because up to twenty ground tiles were painted on it but because the camera sampled the whole highlight to choose its scale on the same frame, and the moment of a goal did that again for the cut to the scorer and painted the risen stands at once. Both are now done ahead, a little a frame (see `PHASE-3-ARCHITECTURE.md`). `test-ahead.js` plays a half through a mounted renderer as the match screen does: without it a cut paints up to 12 tiles on its frame on a phone stage and 24 on the largest desktop stage; with it no cut paints more than the one tile every frame is allowed, the worst frame in play paints 3 tiles on the phone stage and 5 on the desktop one (13 before), and the picture is identical frame for frame.

Frame pacing, from the game's own measuring screen (`What's new > Measure the match frame rate`; sixty seconds of play; **headless Chromium, which says nothing about a real phone**):

| Window | Stage | Frames a second | Typical frame | Slowest 5% | Slowest 1% | Slower than 30 a second | Drawing, average / slowest 5% |
|---|---|---|---|---|---|---|---|
| 390x664 | 366x411 | 60.0 | 16.7 ms | 16.7 ms | 16.8 ms | 0 of 3,600 | 1.0 / 3.4 ms |
| 1366x768 | 904x619 | 59.7 (59.1 before) | 16.7 ms | 16.7 ms | 16.8 ms | 4 of 3,584 (13 before) | 1.5 / 7.2 ms |
| 1920x1080 | 1164x756 | 59.7 (58.0 before) | 16.7 ms | 16.7 ms | 16.8 ms (33.3 before) | 4 of 3,582 (25 before) | 2.1 / 9.1 ms |

The drawing figure for the slowest 5% is higher than before (3.6 ms at 1366x768) because a tile is now painted on many frames instead of twenty on one; it stays well inside a frame.

On the final build of 17 November (`index.html` 7,108,283 bytes): all 20 suites pass one at a time (the 18 of Milestone 4, `test-situations.js` with 20 checks and `test-ahead.js` with 14), `tools/soak-audit.js` passes 44 of 44, `tools/viewport-audit.js` passes at all five sizes, and `tools/save-compat.js` passes 19 of 19 from 1.6.0 to this build and 19 of 19 back.

### E02 on John's phone (17 November)

John ran the measuring screen in the 1.7.0 preview (`index.html` md5 `56337bd2d3f0b8491f1ceee6b7a72165`, opened from a file) on his Samsung Galaxy: Chrome 157, a screen of 384x692 CSS px at a pixel ratio of 3.75 (reported as 3.8), stage 360x465, isometric view, close camera, one minute of play at normal speed from kick-off. The model of the phone is not in the figures (Chrome hides it) and is still to be recorded. The second column is headless Chromium at the same screen size with the processor slowed six times (`tools/phone-probe.js . 6`), which lands close enough to the phone to stand in for it while the cause is worked on.

| | John's phone | Headless, slowed 6x |
|---|---|---|
| Frames a second, average | 49.9 | 51.0 |
| Typical frame | 16.7 ms | 16.7 ms |
| Slowest 5% | 33.4 ms | 33.4 ms |
| Slowest 1% | 83.4 ms | 83.3 ms |
| Worst frame | 341.6 ms | 366.6 ms |
| Slower than 30 a second | 175 of 2,994 (5.8%) | 157 of 3,058 (5.1%) |
| Slower than 20 a second | 92 (3.1%) | 86 (2.8%) |
| Drawing a frame: average, slowest 5%, worst | 8.5, 36.8, 241.3 ms | 6.5, 24.3, 354.5 ms |
| Ground tiles held, memory | 74, 37.8 MB | 74 |

**Reading.** The brief asks for a consistent 30 frames a second or better with the slowest 5% of frames at 33.3 ms or less. The average is well clear of 30. The slowest 5% sit on one doubled frame of a 60 Hz screen (33.33 ms, shown as 33.4), which is on the line and not under it, and behind that 3.1% of frames took 50 ms or more and the worst a third of a second. Those are stutters a viewer can see, so the row stays open and is not argued into a pass on the rounding.

**Cause, from the slowed run** (`tools/phone-probe.js` logs every frame; `tools/phone-probe-report.py` sorts them):

* Painting a ground tile is the slow frame. 141 tiles were painted in the minute, one a frame since Milestone 5, at about 45 ms each at this speed (a few milliseconds on the desktop). Of the 119 drawings that took over 33.3 ms, 118 were frames that painted a tile. A frame that paints nothing takes 3.5 ms on average.
* Inside a tile the time goes on the terraces (51%) and the pitch with its markings (38%): each tile paints the whole ground and lets the canvas throw away what falls outside it.
* The worst stall was three frames within a second that painted 3, 3 and 6 tiles, nine seconds into a highlight: a move of the camera that the working ahead did not see coming.
* The players' pictures are recoloured for the two kits as they are first needed: 2,384 of them over the first 35 seconds, on 712 frames. That lowers the average early in a match (a few milliseconds a frame) and is not what makes the slow frames.

Working ahead (Milestone 5) took the painting off the frame of a cut, which was the fault on the desktop, but a whole tile in one frame is still too much for a phone. The remedy keeps the picture as it is: paint only what lies inside a tile, and spread a tile over several frames. Lower detail (brief 10.3) is the fallback if that is not enough. Not yet done: it is scoped with John first.

## Manual scenarios (Section 14)

Covered so far by the recordings and captures: 1 kick-off, 2 midfield passing, 4 shot saved, 5 goal, 6 corner (desktop recording, 36 s), 8 ends swap (second-half goal at the left end), 12 next-highlight cut. Since Milestone 4: 3 counter-attack framing (film strips, phone and desktop). Since Milestone 5: 7 red card and 9 extra time and penalties (`test-situations.js`, stills), 10 hot-seat in the isometric view and 15 a failing view (`tools/soak-audit.js`), 13 offline mobile (John's phone, 17 November), 11 view switching mid-match and 14 the long log on a desktop (`tools/viewport-audit.js` and the leak run switch views twenty times; the audit checks the full log at both desktop sizes). None open.

## Known limitations after the Phase 3 art completion

* Phone landscape (844x390) is unchanged and open, by John's decision at Milestone 4. The stage is 820x203 px at the desktop scales: two or three players are in view, the commentary line is below the fold (the match column scrolls by 64 px), and the camera does not meet three of its checks there (ball in view 98.8% of frames, both posts at the arrival of 53 of 63 shots, 411 frames in 141,525 with no player in view). Lower scales do worse, not better (the view cannot follow play to the ends without leaving the painted ground on so wide a stage), so landscape needs its own piece of work on the camera bounds and the layout, not a change of zoom. `test-camera.js` reports these figures on every run without failing on them.
* The whole-pitch camera on a phone held upright fills only the middle third of the stage (about 1.7 to 1.9 px per metre): a wide diamond in a tall stage.

* The near terrace is the right end's painting mirrored (a packed pen of fans seen from behind): the depth preprocessor reads the low flat near terrace as a slab and painted it as one row of giant figures four times over; a dedicated painting can replace it in seconds if a later attempt comes out right.
* The crowd figures in the painted stands are chunky (a head is about a player's head), in the 16-bit manner. (Since 3D the painted stands rise in a wave for a goal, with camera flashes; the main stand's rows under its roof stay still.)
* The referee's raised card is a few pixels and is not painted from the W heading (the painter hid the arm behind the body).
* Since Milestone 5 a cut paints no ground on its own frame and does not stop to choose its scale. What is left: the first frame of a match paints its whole screen (before the clock starts), a seek paints the screen it lands on, and on the largest desktop stage a fast pan just after a cut can paint up to five tiles in one frame.
* On John's phone (17 November) the match averages 49.9 frames a second, but 5.8% of frames are slower than 30 a second and 3.1% slower than 20, nearly all of them frames that paint a ground tile (see "E02 on John's phone"). The desktop figures are from headless Chromium.
