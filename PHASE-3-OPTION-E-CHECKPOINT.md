# Phase 3: the Option E visual checkpoint

*15 November 2026. A playable preview for approval before Milestone 4. The live 1.5.0 on GitHub Pages is untouched; nothing here is deployed.*

## What you are looking at

`soccer-manager-91-e-preview.html` is the whole game, offline, with the match viewer drawing in **style E**: Blender figures and ground, painted through Floyo (Qwen Image 2512 with the Fun ControlNet Union, depth map only, the route you approved in the look test). The View button on the match screen cycles Iso (E), Pixels, **Iso C** (the comparison style from the R&D day), Canvas and Wireframe, so E and C are a tap apart on the same highlight. Style B, the 1.5.0 art, ships inside the file as the fallback: any cell E lacked would come from B, though today none does. The version label reads `1.6.0-e preview`.

Nothing in the simulation or the architecture changed. The engine, the timeline, the scene, the contact points, the camera and the animation system are the ones that passed the Milestone 3D checks; E is a set of textures that fits the existing manifests, feet lines and contact points exactly. Saved games are unaffected (`SAVE_VERSION` is still 4).

## The artwork

| | Count | Notes |
|---|---|---|
| Figure grids painted | 124 | every pose and frame of the animation set, eight headings each |
| Hair styles | 3 | short, cropped, long (B has two); the game picks per player as before |
| Keeper set | complete | all keeper poses, gloves, in the keeper's own sheet |
| Referee | complete | whistle and card poses, recoloured by the game as before |
| Sprite cells written | 5,568 | 174 player rows and 58 keeper rows, eight headings, three scales (24, 16, 12) |
| Kits | 92 clubs | recoloured at draw time from the material map, as in 1.5.0; nothing per club was painted |
| Stands | 4 | far, near, left, right: Blender architecture, painted spectators |
| Corners | 4 | terraces and towers, painted spectators |
| Goals, dugout | from the Blender set | the parts that replaced the vector net in the R&D build, now in E's own folder |
| Pitch | unchanged | geometry and markings as 1.5.0; a painted grass tile stays an option |

Cells replaced after the audit: 99 of 5,568, in 11 grids, from a second roll with a different seed. All 5,568 were converted again after the missing-arm fix below.

## What improved against 1.5.0

* **Figures with volume.** Every frame comes from the same Blender body in the same light, so a player keeps his build and shading from heading to heading and frame to frame; the generated figure in B was flat by comparison and its painted test frames were a handful. The painted figure sits on the game's skeleton: silhouette overlap with the game's own figure is 0.85 on average (B 0.86, C 0.89) and 0.82 at the tenth percentile, better than B's 0.77 (the worst cells are no longer the ones with a lost arm), and the feet land closer to the feet line than B's (mean error 3.3 px against 4.2 at the large scale, worst case the same 6 px).
* **A crowd.** The stands and corners now hold painted spectators in coats and scarves, rows of individual people, in place of the cylinders. The steps, barriers and roofs are Blender's, so the ground still fits the goals, dugouts and pitch to the pixel.
* **Defects you named are gone.** The header frame carried a ball on the head in the first roll (all four variants, same seed); the receive and shoot frames carried a ball at the foot in some headings; one long-hair dive frame had drifted into a standing figure. All were caught by the audit and painted again; none remains. The painter's ground shadow is keyed out before conversion.
* **An audit that can see.** The defect pass now measures each cell against its Blender mask (silhouette overlap, paint outside it, empty cells), looks for a baked-in ball by shape, size and material, inside the silhouette as well as outside, and checks every part of the reference body (each arm's skin, each sock and boot, the hair, a keeper's gloves) for coverage by the figure the converter actually takes. It flagged 11 grids out of 124 in the first roll and 0 of 11 in the second; the shirt patches and keeper gloves it first mistook for balls are excluded by the material map.
* **The missing-arm bug.** You spotted a figure with one arm in the first preview. The paintings were whole; the converter's "one figure per cell" rule kept only the largest blob of paint and threw away an arm held clear of the body, which is its own blob. It had done so in 209 cells (11% of the set, 36 grids, up to 22% of a figure in the two-arms-out poses) and the audit could not see it because it measured the painting, not what the converter kept. The rule now keeps any blob that lies mostly inside the reference silhouette and drops only what lies mostly outside; the audit measures the converter's own figure; no cell is missing a part and the largest unpainted share of any body is 1%.

## Limitations, honestly

* **Corner crowds.** The corner terraces read more cylindrical than the stands because their Blender figures are larger and the img2img painter follows geometry closely. That is a geometry fix (smaller corner figures, re-render, re-paint four pictures), not a painting problem, and it is small on screen.
* **Style C is partial.** C only ever painted the R&D test frames; the rest of C is B. It is there to compare the painting route on the frames both have, not as a second complete set.
* **File size.** The preview is 11.98 MB because it carries B, C and E. A release build with E alone would be smaller than today's live file carries B; that choice is for Milestone 4.
* **Pitch.** Untouched by design. If you want the painted grass tile, it is one more Floyo painting and a build.
* **The painter's taste.** Qwen draws balls big and likes to add one; the prompts for the re-rolled grids no longer mention a ball at all, and the audit catches any that return. A future re-paint should start from those prompts.

## Production costs

| Item | FloTime | Notes |
|---|---|---|
| Stage 0 look test (9 runs) | 4.8 min | the two-grid test you approved |
| Stage 1 figures (124 grids, 22 runs) | 19.7 min | about 4 s a grid once a worker is warm; cold starts of 60 to 180 s dominate |
| Stage 2 stands and corners (16 paintings, 5 runs) | 5.0 min | both routes, so the comparison could be made |
| Re-rolls (11 grids, 2 runs) | 5.0 min | |
| Contact sheets (10 runs) | 1.1 min | 140 paintings as nine files |
| **Total recorded on the runs** | **35.7 min** | |

Partner Nodes: nothing ($19.69 before, $19.69 after). The plan balance moved from 10,242,610 ms at the start of Stage 1 to 9,017,397 ms now, 20.4 minutes, which is less than the runs' own FloTime total; the difference is cold-start time Floyo did not bill. Blender rendering was local CPU: about 30 minutes for the 124 grids at 6 samples plus the ground pieces. No paid assets, no third-party art; every prompt describes a generic footballer and a generic ground.

## Tests and measurements

Regression, all on the preview build (`ISO_STYLES=B,C,E ISO_DEFAULT=E`): 15 of 15 suites pass. After the missing-arm fix the set was converted again and the suites that read the art (`test-isometric`, `test-matchday-ui`, `test-contact`) were run again and pass; the others do not touch the pixels.

| Suite | Result | What it covers |
|---|---|---|
| test-matchday | pass, 30 s | timeline, scene, isolation of the match state (919 KB) |
| test-playback | pass, 11 s | deterministic playback, 300 frames headless |
| test-matchday-ui | pass, 14 s | the match screen, both manager flows, the view and camera buttons |
| test-phase25 | pass, 27 s | hand-overs met 100%, facing changes |
| test-isometric | pass, 13 s | 67 checks on the renderer, assets, inheritance, placed pieces |
| test-highlights | pass, 24 s | celebrations, bookings, keeper reactions, crowd frames 520/520 |
| test-restarts | pass, 10 s | kick-offs and corners, 14 checks |
| test-camera | pass, 12 s | ball in view 100% on phone and desktop over 141,198 frames |
| test-record | pass, 1 s | 4,820 matches, 19,457 checks on the official record |
| test-contracts, test-hof, test-youth | pass | the management screens |
| test-equivalence | pass, 2 s | the engine's results identical with the viewer on and off, 252 weeks |
| test-regression | pass, 234 s | eight seasons, three managers, a 1.0.4 save migrated and played on (saved-game compatibility) |
| test-contact | pass, 14 s | 38,931 contacts in 20 matches: pass, receive, shot, header, volley, tackle 100% at the right frame and point; catch 96%, line clearance 93%, as at Milestone 3D |

`test-matchday-ui` now derives the view cycle from what the build ships, so it passes on both the review build (with Iso C) and the production build.

Art metrics over all 1,856 frame cells at the large scale (`style-metrics`, after the missing-arm fix): E silhouette overlap 0.85 mean, 0.82 at the tenth percentile (B 0.86 and 0.77, C 0.89 and 0.79); feet error 3.3 px mean, 6 px at the 95th percentile; height spread across the eight headings 2.0 px; 0 missing cells. Asset bytes inlined: B 3.57 MB, C 0.91 MB, E 3.95 MB.

Performance on the real match stage (`style-perf`, headless Chromium, close camera): 

| Build and view | Device | Frame | Celebration frame | Whole-match tour, per frame | Heap | Load |
|---|---|---|---|---|---|---|
| Production 1.5-style build (B only, 5.4 MB), Iso | iPhone 390x664 | 1.37 ms | 2.39 ms | 1.10 ms | 28.6 MB | 446 ms |
| | Desktop 1366x768 | 1.60 ms | 1.69 ms | 5.66 ms | 37.1 MB | 470 ms |
| Preview build (B, C, E, 11.98 MB), Iso = E | iPhone | 0.96 ms | 0.81 ms | 0.58 ms | 51.0 MB | 616 ms |
| | Desktop | 0.82 ms | 0.75 ms | 4.73 ms | 52.4 MB | 563 ms |
| Preview build, Iso C | iPhone | 0.94 ms | 1.67 ms | 1.09 ms | 43.7 MB | 616 ms |
| | Desktop | 1.48 ms | 1.66 ms | 5.28 ms | 51.8 MB | 563 ms |

E draws no slower than B (a painted cell is one cached image where the generated figure is several). The heap is higher in the preview because it decodes three styles; a release with E alone would sit near B's figure. The production build (B only) was rebuilt and re-tested after the change set: `test-matchday-ui` and `test-isometric` pass on it.

## What is in the hand-over

* `soccer-manager-91-e-preview.html`: the preview, one offline file. Open it on the phone or the desktop; it is not the live file.
* `source.zip`: the repository as it stands (source, assets, tools, references, docs, `legacy/`), without the built HTML files. `python3 build.py` makes the production file and `ISO_STYLES=B,C,E ISO_DEFAULT=E python3 build.py` the preview, so nothing in the zip can replace the live 1.5.0 by being dragged to GitHub.
* `PHASE-3-OPTION-E-CHECKPOINT.md`: this report. `test-results.txt`, `metrics.json`, `perf.txt` and `stands-comparison.png` are the measurements it quotes.

## Reproducibility

The whole pipeline is in `tools/visual-rnd/README.md` under "Production": Blender render, upload, batched Floyo graphs, contact sheets down and split, audit, re-roll, conversion, build. Every Floyo run id is in `tools/visual-rnd/stage1/runs-stage1.json`; the sheet layouts in `stage1/sheets.json` and `sheets-r2.json`; the Blender references (colour, depth, mask, material map, json for all 124 grids and the ground) in `stage1/refs/` and `stage2/pieces/`. The 140 first-roll paintings and the 11 re-rolls are in your Floyo outputs and in your Drive folder; the repository keeps what is needed to repaint, not the paintings.

## What I need from you

1. Play with the preview: a few matches, the View button between Iso and Iso C, the three cameras, a celebration, a booking, a keeper save.
2. Say whether E is approved as the Milestone 4 look, and whether you want the corner-crowd geometry fix and the grass tile before or after Milestone 4.
3. Which styles the release should carry: E alone, or E with B kept as the fallback.

---

# Correction and polish pass (16 November 2026)

*The six-point brief after the Option E checkpoint, in one pass: two bugs fixed with permanent checks (Stage A), the crowd and the goals improved (Stage B), and this checkpoint (Stage C). The live 1.5.0 on GitHub Pages is untouched; nothing here is deployed.*

## What you are looking at

`soccer-manager-91-e-preview.html` (version label "1.6.0-e preview 4") is the whole game, offline, with the match viewer drawing in style E: the painted figures of the last checkpoint, the new crowd you chose (Option 1), and the rebuilt goals. The View button cycles Iso (E), Pixels (the 1.5.0 look) and the two debugging views; style C and the second crowd option are no longer in the build. Nothing in the simulation changed: the engine, the record and every official result are the ones that passed the Milestone 3D checks, and `test-equivalence` and `test-regression` say so again below.

## 1. The ball that went behind (fixed, with a permanent test)

Once the ball crosses the goal line it is dead. A shot wide or over is a goal kick to the defending side unless a defender's touch sent it over, which is a corner; the keeper takes the goal kick from his goal area, the ball lies still until he does, and nobody tackles or picks it up behind the goal. Before, the timeline only gave a goal kick when six seconds remained before the spell's deadline and otherwise handed possession to a defender at the edge of the box while the scene rolled the dead ball back into play; the fix is in `timeline.js` (`goalKick`, `hardStop`, `restartHeld`, `winBack`), `interactions.ballAt` and `behaviour.js`. `test-deadball.js` follows every miss and every deflection in 192 matches (953 dead balls) to a goal kick, a corner after a defender's touch, or the whistle, and checks the scene never moves, carries or brings back a dead ball except at the restart. The restart, highlight and camera suites were extended where the change showed (a corner before a card, the shot budget, an untaken corner at the whistle).

## 2. Players gliding (fixed, with a permanent check)

Three causes. An action drawn standing (receive, set, celebrate, dismay, booked, block, getup) overrode the run cycle for its whole cue, so a receiver slid the last two metres and the celebrating side converged standing still; the stride counter reset on every camera cut; and off-the-ball men were planned at speeds the animation never saw. Now a standing pose is drawn only once the man has stopped (`iso-actors.js`), the stride survives cuts (`iso-camera.js`), and the planner's speed bands and the animation agree (`trajectories.js`, `scene.js`). `test-locomotion.js` steps six matches the way the renderer does, at 60 and 30 frames a second, at playback 1x, 2x and 4x and the highlight rates, and fails on any man who travels a metre without legs, runs with a frozen leg frame, or runs on the spot. Creep went from 23.6% of player-frames to 2.0% (the rest is the half-step into and out of a strike, which is drawn as the strike).

Also rolled in from your note: the opening screen no longer shows the generated figures for a second or two before the painted ones. The painted set is decoded first and in the menus (`iso-assets.js`, `isometric.js`, `matchday-ui.js`); the viewer holds a "Preparing the ground" frame until it is ready, and measured in a real browser the painted art is ready 252 ms after the page opens, long before anyone reaches a match.

## 3. The crowd

The spectators are new geometry: shoulders, arms (one or both raised on a few), scarves, hats, children, a slight turn here and there, seated rows under the main stand's roof, in place of the cone-and-sphere figures. Blender keeps the steps, barriers, roofs and corner towers exactly; Floyo painted only the people (one focused round: 17 paintings, 6.5 minutes of FloTime, two contact sheets). You chose Option 1 (the new figures through the proven route: denoise 0.6, the pixel-art prompt, dark winter coats with scattered colour) over Option 2 (an illustrated, brighter repaint at denoise 0.8); Option 2 stays on record in `tools/visual-rnd/stage2b/option2-F/`. The crowd is club-neutral: the painted stands are still pictures and cannot wear the home side's colours.

## 4. The goals

Rebuilt in Blender, no Floyo: round posts and crossbar with rounded joints and ground sockets, angled steel stanchions from the post tops to a back rail and uprights at the back, the nets as translucent sheets of fine mesh (the roof sags, the back net bellies, the side nets draw in) instead of tubes, and the frame's shadow as a net on the grass. The back net bulges where the ball goes in, in three lanes across the goal, and settles over the next half second; only a goal moves it. The ball still lies in the net where it did, the goalmouth is as visible as before, and the keeper, ball and net sort in the same depth order (the pieces split into back and front halves exactly as the old goal did, with the shadow drawn on the ground under everyone). One Floyo pass over the goal at low denoise coarsened the mesh and bent the frame for no gain, so it was not used. The 54 goal pieces (three scales, two ends, the shadow, the still and six moving nets) are 362 KB, about what the twelve tube-net pictures were.

## 5. Scope

Nothing else was touched: the animation library is the one you approved, the figures were not repainted, the original concept images remain the reference.

## Tests and measurements

All 17 suites pass on the final build (`test-results.txt`): the 15 of the last checkpoint plus `test-deadball.js` and `test-locomotion.js`. `test-equivalence` confirms the engine's results are byte for byte what 1.5.0 produces for the same seeds; `test-regression` plays eight seasons, a multiplayer league and a migrated 1.0.4 save with no errors. Performance on the phone viewports is in `perf.txt`: an ordinary frame 0.6 ms on the phone viewport and 1.1 ms on the desktop, a celebration frame 0.9 and 1.4 ms, 44 and 37 MB of heap, the painted art decoded 221 ms after the page opens, all in the range of the last checkpoint.

## Production costs

| Item | FloTime |
|---|---|
| Stage B crowd, two options (16 paintings, 4 runs) | 5.7 min |
| Goal paint test (1 run) | 0.5 min |
| Contact sheets (2 runs) | 0.2 min |
| **This pass** | **6.4 min** |

Partner Nodes: nothing. Blender rendering was local CPU (about 4 minutes for the stands and corners, 1 minute for the 54 goal pieces).

## What is in the hand-over

* `soccer-manager-91-e-preview.html`: the preview, one offline file; not the live file.
* `source.zip`: the repository without the built HTML files, so nothing in it can replace the live 1.5.0 by being dragged to GitHub. `python3 build.py` makes the production file (style B, as live today); `ISO_STYLES=B,E ISO_DEFAULT=E python3 build.py` makes this preview.
* `PHASE-3-OPTION-E-CHECKPOINT.md` (this report, appended), `test-results.txt`, `perf.txt`.

## What I need from you

1. Play a few matches: a miss that goes behind, a goal (watch the net), a celebration, the close camera by either end for the crowd.
2. Say whether this is approved for deployment as 1.6.0 and which styles the release carries (E alone, or E with B as the fallback). Nothing goes live until you say so.
