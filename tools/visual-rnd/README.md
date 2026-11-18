# Visual R&D kit (the graphics test day before Milestone 4)

Two ways of making the match-day art, judged inside the real renderer on the same 23 frames, 8 headings, 3 scales:

| Style | What it is | How it is made |
|---|---|---|
| B | the shipped Phase 3 art | `tools/iso-art.js` references painted by Z-Image Turbo + ControlNet on Floyo (see `tools/floyo/README.md`) |
| C | Option A, enhanced Floyo | the same references, the concept-led prompt, **Qwen Image 2512 + Fun ControlNet Union 2602** (the best of four routes tried) |
| D | Option B, Blender direct | `blender_figure.py` and `blender_pieces.py`: the game's own skeleton and stadium boxes modelled and rendered in the game's projection, converted by `iso_paint.py` as if painted |
| E | Option B through Floyo | the Blender renders of D as the control images for the Qwen route |

Styles C, D and E hold only what differs from B (an `inherit` file names the parent; `build.py` writes `@parent/spr/field` references instead of a second copy of the stadium art and `iso-assets.js` resolves them). They ship only when `ISO_STYLES` names them and show only under `?dev`.

## Files

The large reference sets (the Blender renders behind every painting) are zipped under `archives/` so the repository can go
up through GitHub's web page; `archives/README.md` says what each one restores. Unzip them in place before re-running a
painting step; the game and the tests need none of them.

**The archives are not on GitHub yet** (18 November 2026). `ART-PIPELINE-ARCHIVES.md` at the root of the repository says
exactly what is missing, where it is kept and how every folder is made again from the scripts here.


| File | What it is |
|---|---|
| `frames.json` | the 13 test grids: run 0–5, kick 0–3, header 0–2, volley 0–2, slide 0–1, knee slide 0–1, keeper dive 0–2 |
| `refs-a/` | `iso-art.js` references for those grids at 108 px/m (colour, depth, mask, material map, json), Option A's control images |
| `export-joints.js`, `joints.json` | the game's skeleton per pose and frame (figure-local metres), exported for Blender |
| `isocam.py` | the game's projection as a Blender camera (see the note in the file: the view is a reflected (1, 1, 1) orthographic view, so the scene is reflected through X = Y and a physical camera looks at it) |
| `blender_figure.py` | the footballer in Blender from `joints.json`: metaball limbs, mesh head, hair, template kit; renders colour, material map and depth per cell into the `refs-a` grid layout → `refs-b/` |
| `blender_pieces.py`, `stadium-geometry.json`, `refs-pieces/` | the main-stand section (terrace, crowd, barriers, roof), the goal frame and net at each end as back and front parts, the dugout; piece images in the renderer's formats |
| `make_runs_rnd.py` | Comfy API graphs for the four Floyo routes (z Z-Image, q Qwen 2512, f Flux CN 2.0, nb Nano Banana Pro) from the grid references; `--input-suffix` and `--tag` for the Blender set |
| `runs-a.json` | every Floyo run id of the day, by route and grid |

## Reproducing a style

```
# references (A) and the Blender set (B); the bpy venv is tools/visual-rnd/bpyenv (python 3.11 + bpy 5.0, Pillow, numpy)
node tools/iso-art.js --ref run:0,run:1 --refspr 108 --cols 4 --refout tools/visual-rnd/refs-a        # one grid; frames.json lists them all
bpyenv/bin/python tools/visual-rnd/blender_figure.py --joints tools/visual-rnd/joints.json --frames tools/visual-rnd/frames.json --out tools/visual-rnd/refs-b
bpyenv/bin/python tools/visual-rnd/blender_pieces.py --geometry tools/visual-rnd/stadium-geometry.json --out <dir>

# Floyo (Personal Team): upload refs-a/<stem>-depth.png as sm91-<stem_>.png (and -colour as sm91-<stem_>-c.png) to a folder,
# make the graphs, submit them with the Floyo MCP run_workflow, download sm91-<route>-<stem_>_00001_.png
python3 tools/visual-rnd/make_runs_rnd.py --frames tools/visual-rnd/frames.json --out <dir> --input-prefix '#inputs/soccer-manager/<folder>' --routes q

# convert (the painted file is named <stem_>-painted.png; a converted cell replaces whatever the sheet held)
python3 tools/iso_paint.py --ref tools/visual-rnd/refs-a --painted <painted dir> --style C
python3 tools/iso_paint.py --ref tools/visual-rnd/refs-b --painted <refs-b colour renders as -painted.png> --style D
python3 tools/iso_paint.py --ref tools/visual-rnd/refs-pieces --stand <far-painted.png> --standcrop 0,24 --style D
cp <dir>/piece-goal*-{24,16,12}.{png,json} <dir>/piece-dugout-*.{png,json} assets/matchday/isometric/D/

# build and look
ISO_STYLES=B,C,D,E python3 build.py
open index.html?dev&seed=1991&club=3&view=isometric-e
```

The style E of the test day was made from the Blender colour renders through Floyo's DepthAnythingV2 preprocessor (the depth pass uploaded that afternoon was flat; `blender_figure.py` now writes a correct one, `refs-b/*-depth.png`, which is the control image to use in production).

## Production (Option E, after the R&D sign-off)

The approved route is E: Blender geometry, its true depth map as the only control image, Qwen Image 2512 + Fun ControlNet
Union 2602 (8-step Lightning, strength 0.85, seed 19910502; re-rolls 19910509). The production set lives in `stage1/`
(figures) and `stage2/` (ground). The stands use the image-to-image route (`i`, denoise 0.6 over the Blender colour render)
with the crowd-only treatment, chosen on 15 Nov 2026: the depth-only route left the corner crowds grey, and letting the
painting in only where the crowd mask is keeps Blender's steps, barriers and roof exact.

| Folder | What it holds |
|---|---|
| `stage0/` | the look test John approved: two grids in three hair styles, depth-only (E) against image-to-image (F) |
| `stage1/frames.json` | the 124 production grids: every pose and frame of `sprites.js`, in hair styles 0 short, 1 cropped, 2 long (`-h1`, `-h2`), plus the keeper set (`-gk`, hair 0); the referee's whistle and card are player poses, recoloured by the game |
| `stage1/refs/` | their Blender renders at 108 px/m (colour, depth, mask, material map, json) |
| `stage1/sheets.json`, `sheets-r2.json` | which painting sits where on the contact sheets of the first roll and the re-roll |
| `stage1/runs-stage1.json` | every Floyo run id of the production (batches, sheets, re-rolls) and the FloTime notes |
| `stage2/pieces/` | the Blender ground: the four stands with crowd masks and depth maps, corners A–D, pylons A/B, goals, dugout |
| `batch_runs.py` | merges single-image graphs into runs of four or eight (shared loaders, per-grid chains), so 140 paintings are about 35 submissions |
| `sheet_runs.py`, `split_sheets.py` | contact sheets on Floyo (core ImageStitch, 24 px red strips) so 140 paintings come down as nine files, and the exact split back into the originals |
| `audit_cells.py` | the defect pass over the paintings: cell IoU against the Blender mask, paint outside the silhouette (the ground shadow keyed out first), empty cells, and a baked-in ball (a round white blob of ball size that is not a shirt detail or a keeper's glove); prints the grids to re-roll |
| `ingest_stage1.py` | a download folder to style E in one go: first roll and re-rolls sorted, both audited, the first roll converted, then only the flagged cells taken from the re-roll |
| `paint_pieces.py` | turns the painted stands and corners into E's textures, with the crowd-only or full treatment |

```
# 1. render (bpy venv; about 14 s a grid at --samples 6)
bpyenv/bin/python tools/visual-rnd/blender_figure.py --joints tools/visual-rnd/joints.json --frames tools/visual-rnd/stage1/frames.json --out tools/visual-rnd/stage1/refs --samples 6
bpyenv/bin/python tools/visual-rnd/blender_pieces.py --geometry tools/visual-rnd/stadium-geometry.json --out tools/visual-rnd/stage2/pieces
# 2. upload: stage1/refs/<stem>-depth.png as sm91-<stem_>.png, the stands' <piece>-depth.png as sm91-<piece>.png and
#    <piece>-painted.png as sm91-<piece>-c.png, all in one folder (#inputs/soccer-manager/sm91-stage1)
# 3. graphs, batched, submitted with the Floyo MCP run_workflow (names "SM91 s1 batch NN: ...")
python3 tools/visual-rnd/make_runs_rnd.py --frames tools/visual-rnd/stage1/frames.json --out <dir>/rnd-stage1 --input-prefix '#inputs/soccer-manager/sm91-stage1' --routes q --tag s1
python3 tools/visual-rnd/make_runs_pieces.py --out <dir>/rnd-stage2 --input-prefix '#inputs/soccer-manager/sm91-stage1'
python3 tools/visual-rnd/batch_runs.py --manifest <dir>/rnd-stage1/manifest.json --out <dir>/rnd-stage1/batches --size 8 --tag s1
python3 tools/visual-rnd/batch_runs.py --manifest <dir>/rnd-stage2/manifest.json --out <dir>/rnd-stage2/batches --size 4 --tag s2
# 4. contact sheets (one run each, about 6 s), downloaded as sm91-sheet-NN_00001_.png and split back into the originals
python3 tools/visual-rnd/sheet_runs.py --names <file: one output name per line> --out <dir>/sheets --per 16
python3 tools/visual-rnd/split_sheets.py --sheets <dir>/sheets/sheets.json --download <dir with the sheets> --out <dir>/singles
# 5. audit, convert, re-roll: ingest does the audit and the conversion; the grids it lists are painted again with another
#    seed and the output tag -s1-r2 (prompts without the word "ball"), sheeted and split the same way into a folder next to
#    the first roll, and a second ingest over the parent folder takes only the flagged cells from the re-roll
python3 tools/visual-rnd/ingest_stage1.py --download <dir> --work <dir>/work --style E
python3 tools/visual-rnd/paint_pieces.py --blender tools/visual-rnd/stage2/pieces --painted <dir>/singles --route i --style E --treatment crowd
# 6. the review build: E draws the plain Iso view, C stays as the comparison view, B is the fallback inside E
ISO_STYLES=B,C,E ISO_DEFAULT=E python3 build.py
```

Getting the paintings out of Floyo. The sandbox cannot reach Floyo's file CDN, so the outputs travel through John. Two
things bite: an image attached to the chat is shrunk to 8000 px and re-encoded as JPEG, which the colour-classifying
converter cannot use (a `.7z` or `.zip` of the same PNG arrives byte for byte), and the Google Drive connector refuses files
over 10 MB (a 16-grid sheet is 14 to 17 MB). So: sheets, archived, attached; or sheets of at most 10 pictures through Drive.

Two cell-layout notes. The Blender grid cell is 2.125 m above the feet, the generator's reference layout, except where a pose reaches
higher (the raised card, the two-armed celebration): `blender_figure.py` grows that grid's cell and `iso_paint.py` aligns by each
cell's own feet line, so nothing is clipped. And the Qwen graph works at one megapixel, so a painting comes back at the grid's
aspect but not its size; the converter scales by the json's width. On a contact sheet every picture after the first is scaled to
the first one's height, aspect kept, which the same rule absorbs.

The converter's stray-mark rule (15 Nov 2026). `iso_paint.extract_figure` is the one place the painted figure is taken
from a painting, shared by the converter and the audit. It used to keep only the largest blob of paint in a cell; an arm
held clear of the trunk is its own blob and was dropped, in 209 of 1,856 cells. It now keeps any blob that lies mostly inside
the reference silhouette (2 cm of tolerance) and drops only what lies mostly outside, and the audit's limb check measures
that figure, so a rule that loses paint shows up as `limb` in the report.

What the first roll of the 124 grids taught (15 Nov 2026): 113 grids were clean; the painter put a ball on the head in the
header frame of all four variants (same seed, same defect), a ball at the foot in some receive and shoot headings, and read
one long-hair dive frame as a standing figure. Eleven grids were painted again with the new seed and prompts that never
mention a ball, all passed, and 99 cells were taken from them. The ground shadow the painter adds is keyed out (neutral
grey, darker than the background, outside the silhouette) in both the audit and the converter.

## Stage B (16 Nov 2026): the crowd's second generation and the goals

The crowd was the weakest part of E: the R&D spectators were a cone, a cylinder and a sphere, and the painter could only do so
much with them. `blender_pieces.py --crowd 2` builds the second generation (`person2_mesh`, `spectator_factory2`): a bevelled
torso with shoulders, thighs and legs, a neck, a hair cap, arms down, one raised or both raised, a scarf on a third of them,
hats, children at a smaller scale, a slight turn here and there, and seated rows under the main stand's roof. The renders of all
four stands and four corners (colour, crowd mask, depth) are in `stage2b/pieces/`. Two paintings of them were put to John:

| Option | Route | Prompt | Style |
|---|---|---|---|
| 1 | image to image, denoise 0.6, crowd-only treatment | the production pixel-art prompt | E |
| 2 | image to image, denoise 0.8, crowd-only treatment | `--prompt-style illustrated`: an early-1990s box-art crowd | F (inherits E) |

```
bpyenv/bin/python tools/visual-rnd/blender_pieces.py --geometry tools/visual-rnd/stadium-geometry.json --out tools/visual-rnd/stage2b/pieces --only far,near,left,right,corners --samples 24 --crowd 2
# upload <piece>-depth.png as sm91-<piece>.png and <piece>-painted.png as sm91-<piece>-c.png to #inputs/soccer-manager/sm91-stage2b
python3 tools/visual-rnd/make_runs_pieces.py --out <dir>/o1 --input-prefix '#inputs/soccer-manager/sm91-stage2b' --routes i --denoise 0.6 --tag s2b-o1
python3 tools/visual-rnd/make_runs_pieces.py --out <dir>/o2 --input-prefix '#inputs/soccer-manager/sm91-stage2b' --routes i --denoise 0.8 --prompt-style illustrated --tag s2b-o2
python3 tools/visual-rnd/batch_runs.py --manifest <dir>/o1/manifest.json --out <dir>/o1/batches --size 4 --tag s2b-o1   # and o2; run ids in stage2b/runs-stage2b.json
python3 tools/visual-rnd/sheet_runs.py --names <names> --out <dir>/sheets --per 9 --prefix sm91-sheet-s2b-o1               # stage2b/sheets-o1.json, sheets-o2.json
python3 tools/visual-rnd/split_sheets.py --sheets <dir>/sheets/sheets.json --download <download> --out <download>/o1
python3 tools/visual-rnd/paint_pieces.py --blender tools/visual-rnd/stage2b/pieces --painted <download>/o1 --route i --style E --treatment crowd
python3 tools/visual-rnd/paint_pieces.py --blender tools/visual-rnd/stage2b/pieces --painted <download>/o2 --route i --style F --treatment crowd
ISO_STYLES=B,E,F ISO_DEFAULT=E python3 build.py      # the comparison build: Iso draws E, the next View is Iso F
```

The whole round was 17 paintings in five submissions (about six and a half minutes of FloTime) and two contact sheets of 7.5
and 9.6 MB, both under the Drive limit. John chose Option 1 on 16 Nov 2026: it is style E's crowd now; Option 2's converted
textures are kept in `stage2b/option2-F/` (copy them into `assets/matchday/isometric/F/` to bring the comparison view back). The painted stands are still pictures, so the crowd cannot wear the home side's colours;
it is club-neutral in both options.

The goals are Blender alone. `build_goal` now models round posts and a crossbar with rounded joints and ground sockets, angled
steel stanchions from the post tops to a back rail and uprights at the back, and the nets as surfaces (`surface`) carrying a
procedural grid (`net_material`: a transparent shader mixed in by the fractional texture coordinate, so the strands are lines
of one translucent sheet and shadow rays pass through the holes). The roof net sags, the back net bellies, the side nets draw
in. Three parts per end: `s` (the shadow on the grass alone, from a shadow catcher under the frame with every object casting
but unseen, drawn on the ground before anything stands on it; alpha quantised to sixteen levels and lightened to 0.7),
`b` (back net, far side net, far post, far stanchion and upright, back rail) and `f` (roof net, near side net, near post,
crossbar, near stanchion and upright). `--net-states` renders the back net pushed out where a goal went in, in three lanes
across the goal and two phases (`-bulge<k>` 0.65 m, `-settle<k>` 0.26 m); `iso-stadium.js netState` picks the piece from the
goal flash's age (bulge to 0.4 s, settle to 0.9 s) and where the ball lies dead. The net pieces are lossy WebP at quality 88
(the soft strands make a PNG five times the size); the shadow stays PNG. All 54 goal pieces are 362 KB, about what the twelve
tube-net PNGs were. One Floyo pass over the goal (image to image at denoise 0.35, `goal_floyo_ref.py` makes the pair) coarsened
the mesh and bent the frame for no gain, so it was not adopted.

```
bpyenv/bin/python tools/visual-rnd/blender_pieces.py --geometry tools/visual-rnd/stadium-geometry.json --out <dir> --only goal --samples 64 --net-states
cp <dir>/piece-goal* assets/matchday/isometric/E/
```
