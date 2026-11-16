# Visual R&D checkpoint: Option A (enhanced Floyo) against Option B (Blender + Floyo)

Status: for your decision before Milestone 4. Nothing deployed beyond 1.5.0; the preview is `1.6.0-rnd preview`. No recordings or screenshot packages: the preview build with all four styles behind a switch, sprite sheets taken straight from the game's asset loader, the measurements, and this write-up.

## The short version

* **Both options work end to end inside the real renderer.** The same 23 frames (run 0–5, kick 0–3, header 0–2, volley 0–2, slide 0–1, knee slide 0–1, keeper dive 0–2), eight headings, three scales, converted through the existing sprite pipeline and switchable in the match under `?dev`: **B** the shipped art, **C** Option A, **D** Blender direct, **E** Blender through Floyo. The match logic, architecture and gameplay are untouched; the only renderer change is a hook that lets a style ship a modelled goal.
* **Option A's winner is Qwen Image 2512 + ControlNet** (style C). Of the four routes tried on identical inputs it was the only one that kept every pose in every heading and painted crisp 16-bit figures. Z-Image (the Phase 3 model with the new prompt) is close to the current B; Flux ControlNet gave soft 3D-looking figures and drifted off two cells; Nano Banana Pro redrew whole grids in the wrong poses, so it is out for figures.
* **Option B's Blender figure is driven by the game's own skeleton**, so every joint lands where the contact logic expects it, and it renders every heading identically by construction. Rendered straight into the game (style D) it is the most faithful but the plainest: smooth, featureless faces, no hand-drawn character. Put through the Qwen route (style E) it keeps that geometry and gains the painted look, and it reads as the best of the four to my eye. Blender also produced the main-stand section, the goal with its net and the dugout as drop-in pieces.
* **Costs are small either way.** The whole day used about 32 minutes of FloTime by the runs' own clocks (your balance moved by 14.7 minutes) and $0.31 of Partner Nodes credit (the Nano Banana runs). A full production figure set is of the order of ten minutes of FloTime; Blender renders are free CPU time (seven minutes for the test set here).
* **Recommendation: E as the figure pipeline (Blender geometry, Qwen paint), D for the hard geometry (goal and net, dugout, stand structure), and a short follow-up before Milestone 4** to run the complete figure set through it with the true depth maps and settle the crowd treatment. Details and the reasons below.

## What was built

### The comparison kit

`tools/visual-rnd/frames.json` names 13 grids (two frames per grid, the wide slide and dive grids one frame). For each grid the kit holds the generator's reference (colour, true depth, mask, material map, cell layout) at 108 px per metre, which is the control image for Option A, and the Blender set rendered into the same layout, which is style D's source and Option B's control image. `make_runs_rnd.py` writes the Comfy API graphs for four Floyo routes from the same reference and the same concept-led prompt (16-bit Amiga/SNES football sprite sheet, cel shading with a lit and a shadow side, crisp dark outlines, limited palette, no ball, no shadow, no text):

| Route | Model | Control | Notes |
|---|---|---|---|
| z | Z-Image Turbo + Fun ControlNet Union 2.1 | depth map, preprocessor none | the Phase 3 route with the new prompt |
| q | Qwen Image 2512 + Fun ControlNet Union 2602, 8-step lightning | depth map, preprocessor none, strength 0.85 | **style C** |
| f | Flux.1 dev + Shakker Labs Union Pro 2.0 (depth) | depth map, strength 0.85, end 0.75 | |
| nb | Nano Banana Pro edit (Partner Nodes) | the colour render, "keep the grid and poses, redraw as pixel art" | $0.039 a grid |

All 52 runs completed first time. Floyo's inputs and outputs went through your Personal Team only; the prompts name no club, player or brand.

### The Blender side

`isocam.py` reproduces the game's projection exactly (px = P(X − Y), py = P((X + Y)/2 − Z)): a numerical check puts world points within a pixel of where the renderer puts them on all three axes. The projection turns out to be a reflected view along (1, 1, 1), so the scene is built in game coordinates, reflected through the X = Y plane, and a physical camera looks at it; the light is the generator's. (My first camera was mirrored and stretched ground depth by a fifth; I found it while placing the stadium pieces, fixed it, and re-rendered everything, which is why there were three uploads rather than two.)

`blender_figure.py` builds the footballer from `joints.json`, the game's skeleton exported per pose and frame: metaball limbs that blend at the joints, a mesh head, a clipped-sphere hair cap, the template kit materials, and a flat material-code pass so `iso_paint.py` classifies the pixels exactly as it classifies a painting. It writes colour, depth, mask and material map per grid in the generator's layout. Rendering: Cycles on the CPU, 32 samples, about two seconds a cell, seven minutes for the 184 cells.

`blender_pieces.py` builds the stadium pieces in the game's world units from `stadium-geometry.json` (exported from `iso-stadium.js`): the main-stand segment that `iso_paint.py --stand` expects (16 rows of terrace, 888 spectators in the game's coat palette, crush barriers every fourth row, a roof on pillars, a back parapet), the goal frame and net at each end split into the back part and the front part exactly as `drawGoal` splits them for depth sorting (net strands as thin cylinders, posts, crossbar, back rail), and the dugout. The goal and dugout are rendered with alpha at each scale and placed by their world anchor through the existing piece mechanism; the stand goes through the same converter as a painting.

### Renderer, build and tools (all behind flags, nothing in the live build changes behaviour)

* `build.py`: a style folder may hold an `inherit` file; any file it lacks is taken from the parent chain, and when the parent ships in the same build the entry is an `@parent/spr/field` reference, so the four-style preview is 10.1 MB rather than 15. Four new piece names (`goal0b`, `goal0f`, `goal1b`, `goal1f`).
* `iso-assets.js`: resolves those references and decodes each shared image once.
* `iso-stadium.js`: `drawGoal` draws a style's goal texture by its world anchor when the style ships one; otherwise the vector net as before.
* `isometric.js`, `matchday-ui.js`: views Iso C, Iso D, Iso E, shown only under `?dev` and only when the build inlines the style; `?view=<id>` on the address opens in a view.
* `iso_paint.py`: a converted cell now clears the sheet cell before it is written (previously a re-converted cell was drawn over the old one; the Phase 3 batches never hit this because every cell was written once or erased first).
* Tests: `test-isometric.js` gains E08 (inherited references resolve, images shared) and E09 (the goal texture lands by its anchor, depth keys kept); 66 checks. The full suite is in `test-results.txt`.

## Results

### Appearance

The sprite sheets in this folder are the game's own sprites at 24 px per metre, taken from the asset loader of the preview build, one row per style per pose, all eight headings:

* `sprites-styles-1.png`: run 0, kick 1, header 1 in B, C, D, E.
* `sprites-styles-2.png`: knee slide 0, slide 1, keeper dive 1 in B, C, D, E.
* `sprites-routes-1.png`, `sprites-routes-2.png`: the four Option A routes side by side (Xz, Xq, Xf, Xnb) with B and D, the same poses.
* `blender-pieces.png`, `blender-stand.png`: the goal parts composited, the dugout, and the main-stand section against the generator's version.

What I see in them, for you to confirm or overrule in the preview:

* **C** is the sharpest of the painted styles: bold outlines, the white cuffs, a readable face; the same man from every side. A few slide cells are muddled (the model lost the figure in the wide, low poses), which a re-roll of those cells would fix.
* **D** is perfectly steady from heading to heading and from frame to frame (it cannot be otherwise), with proper volume in the limbs, but it is smooth and generic: the five-tone quantisation gives it cel shading, not character. It would need shader and modelling work (outlines, a face, hair geometry) to carry a game on its own.
* **E** keeps D's geometry and adds C's paint: hair, a face, highlights, crisp edges. It is the closest of the four to the "Blender hybrid" concept image. One header cell has a ball painted on the head (the model ignored "no ball" once in 184 cells); again a re-roll.
* **B** (the current art) is the least consistent of the four: the figure's build changes a little between headings and the poses are the loosest.

### Animation consistency (measured)

Over all 184 test cells per style, against the game's own generated figure (the pose the match logic assumes when it places feet, hands and heads):

| Style | Silhouette overlap with the game's figure (IoU, mean) | Worst tenth | Figure height spread across the 8 headings (px, standing poses) |
|---|---|---|---|
| B (current) | 0.84 | 0.77 | 1.7 |
| C (Qwen) | 0.92 | 0.90 | 1.6 |
| D (Blender) | 0.93 | 0.92 | 1.7 |
| E (Blender + Qwen) | 0.90 | 0.87 | 1.5 |

C, D and E all sit a clear step above B in pose fidelity, which is what the contact audit cares about. E's control image on the day was the Blender colour render through Floyo's depth estimator rather than the true depth map (the depth pass in the third upload was flat; the script is fixed and `refs-b` now holds correct depth maps), so E's overlap should come up to D's with the true map. No style floats: the lowest painted row sits within the same 6 px of the sheet's feet line in every style (the pipeline anchors feet, not pixels).

### Performance (the real stage, headless Chromium, 60 fps target)

| View | Phone 390x664: ordinary frame / celebration frame (ms) | Desktop 1366x768: ordinary / celebration (ms) |
|---|---|---|
| Iso B | 0.94 / 1.43 | 1.51 / 1.78 |
| Iso C | 1.66 / 1.63 | 1.28 / 1.57 |
| Iso D | 0.90 / 2.39 | 0.82 / 0.75 |
| Iso E | 0.93 / 1.22 | 1.25 / 0.77 |

All within noise of each other and far inside the frame budget; the styles share the renderer and differ only in which sheets and piece textures are decoded. Asset weight: a style's own figure sheets are about 0.9 MB at three scales (C, E); D carries 1.6 MB because it also ships its stand, goals and dugout; B's full set is 3.6 MB. A shipped game carries one style, so the file stays near 5.4 MB whichever is chosen.

### Production complexity

| | Option A (C) | Option B direct (D) | Option B through Floyo (E) |
|---|---|---|---|
| New tooling | none: a prompt and a workflow change on the Phase 3 pipeline | `blender_figure.py`, `blender_pieces.py`, `isocam.py` (written today; bpy 5.0 in a venv, no Blender UI) | both of the above |
| A new pose or frame | add it to the game's sprite skeleton, render a reference, one Floyo run, convert, inspect, re-roll bad cells | add it to the skeleton, render; nothing else, no inspection for pose errors | as D plus one Floyo run, convert, inspect for paint defects |
| Determinism | seeded, but a re-roll changes the whole grid | fully deterministic | geometry deterministic, paint seeded |
| Defect rate seen today | a ball drawn once, two or three muddled slide cells | none | a ball drawn once |
| Hair and face variants | one run per hair style (as now) | a mesh variant, free | one run per hair style |
| Stadium pieces | paint over the generator's references (as the Phase 3 stands were) | exact geometry: goal and net, dugout, stand structure; crowd as modelled figures | Blender geometry painted over, if wanted |
| Human time per full figure set | an hour of uploads, downloads and inspection | ten minutes | an hour |
| Machine time per full figure set | ~10 min FloTime (after model warm-up, 5–10 s a grid) | ~30 min CPU at 32 samples | both |

### Scalability to all 92 clubs

Identical for every style: the pipeline classifies every painted or rendered pixel into a template material and tone, and the renderer recolours it per kit, pattern and skin or hair variant at draw time. No per-club art exists in any option. The painted stadium pieces are shared by every ground as before.

### Costs

| | FloTime | Partner Nodes |
|---|---|---|
| Option A, 52 runs (13 grids × 4 routes) | 19.7 min (Z-Image 4.6, Qwen 7.8, Flux 4.3, Nano Banana 3.0) | $0.51 (Nano Banana, $0.039 a grid) |
| Style E, 13 runs, twice (the mirrored set and the corrected one) plus one stray probe | 11.8 min | 0 |
| Blender | 0 (about 25 minutes of CPU here for figures and pieces) | 0 |
| **Day total** | **about 32 min by the runs' own clocks**; your balance reads 3 h 59 min of FloTime now, 14.7 min less than the 4 h 14 min I noted at the start (Floyo bills less than the wall-clock of a run) | **$0.31 by the balance** ($20.00 to $19.69; the per-run figures add to $0.51) |

The long individual runs (up to 131 s) were first-of-a-model loads; the Qwen grid settles at 5–10 s once warm. A full production set (all poses, two hair styles, keepers: about 70 grids) is roughly 10 minutes of FloTime on the Qwen route and no Partner Nodes credit at all.

## Recommendation

**Adopt E as the figure pipeline: Blender for the geometry, Qwen Image 2512 + ControlNet for the paint; and D for the hard geometry of the ground.**

* The figures' poses are then the game's poses by construction. The contact audit's residuals in Phase 3 were almost all pose drift in painted cells; D and E remove that class of defect, and E does it without giving up the painted look. New animations (Milestone 4 will want more of them) become a skeleton change and a render, with the Floyo pass as a finishing step rather than the thing that decides whether a cell is usable.
* The goal with a real net, the dugout and the stand structure are better as modelled pieces than as paintings over the generator's boxes, and they cost nothing to re-render when geometry changes.
* It costs the same as Option A to run, and the tooling exists now.
* The crowd is the one place I would keep painting: the Blender spectators are pills in coats, exactly as the generator's are; the hand-painted stands of B have more life. The natural step is to paint the Blender stand through the Qwen route (the stand's geometry is then right and the crowd is painted), which is one more run and a conversion that already exists. I did not do it today because it needs one more upload.

If you prefer the lighter path, **C on its own is a real improvement over B** at zero new tooling: switch the workflow and prompt, re-run the batches, re-roll the few bad cells. It keeps Option A's weakness, that pose fidelity depends on the model following the depth map, which it mostly does.

I would not take D alone: it is the most consistent and the cheapest to run, but it would need a shader and modelling pass to have any character, and that work is better spent on E.

### Before Milestone 4 (a short follow-up, not a milestone)

1. Run the complete figure set (all poses, keepers, both hair styles) through E with the true depth maps, and the painted-stand experiment above. Two uploads, two downloads.
2. Re-run the contact audit on the E figures and confirm the residuals drop as the overlap figures predict.
3. Decide the concept direction with the real sprites in front of you: E's figures are closer to the "Blender hybrid" image; a style-reference pass (IP-Adapter or a reference image in the Qwen graph) can pull the palette and outline weight towards whichever concept you choose.

## Where to look

Open `soccer-manager-91-rnd-preview.html` with `?dev&seed=1991&club=3&view=isometric-e` (or `isometric-c`, `isometric-d`, `isometric` for B). In the match the view button cycles Iso (B), Pixel art, Iso C, Iso D, Iso E and the others; `&t=` opens at a match second; `,` and `.` step fifteen seconds; `g`, `c`, `k`, `h`, `w` jump to the next goal, card, save, header or woodwork. Only the 23 test frames differ between the styles; every other pose is B's art in all four, so a running man is in the test set and a walking one is not.

| Seed (club 3) | Fixture | Worth comparing across the styles |
|---|---|---|
| 1991 | Tottenham v Leeds 1-0 | the goal from 22 m and the knee slide `t=1640`; a header at goal `t=455`; a parry `t=2455` and a volley off the bar `t=2468` (keeper dive, volley frames); the Whole camera for the stand, goals and dugouts in D and E |
| 4 | Leeds v QPR 3-1 | a volley `t=140`, a header `t=1160`, a knee slide `t=5360`; parries `t=1150`, `2410` |
| 7 | Norwich v Leeds 2-4 | headers scored `t=1880`, `2120`; slide tackles around the bookings `t=3475` |

## Files

| File | What it is |
|---|---|
| `soccer-manager-91-rnd-preview.html` | the four-style build (10.1 MB). Not for uploading. |
| `sprites-styles-1.png`, `sprites-styles-2.png` | B, C, D, E sprites from the game's loader, 24 px/m, eight headings |
| `sprites-routes-1.png`, `sprites-routes-2.png` | the four Option A routes against B and D |
| `blender-pieces.png`, `blender-stand.png` | the modelled goal, dugout and stand |
| `metrics.json`, `perf.txt`, `test-results.txt` | the measurements and the suite |
| `source.zip` | the full source including `legacy/`, `tools/visual-rnd/` and the C, D, E style folders |
