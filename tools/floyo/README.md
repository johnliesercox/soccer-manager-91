# Floyo asset generation for the isometric art (Phase 3)

Everything painted in the game came through this loop. It is reproducible from the files in this folder plus
Floyo's Z-Image Turbo ControlNet workflow; no step depends on anything done by hand in the Floyo app except
uploading the reference images and downloading the outputs (the build sandbox cannot reach Floyo's CDN).

## The pieces

| File | What it is |
|---|---|
| `z-image-turbo-controlnet.template.json` | The Comfy API graph of Floyo's public workflow "Z-Image Turbo + Fun ControlNet Union 2.1" (`workflow_LWNCLV1BQKD9kghK`), with the per-run fields left for `make_runs.py` to fill: the input image (node `58`), the prompt (`45`), the output prefix (`9`), the preprocessor (`73:70`) and the seed (`73:44`). Everything else (9 steps, cfg 1, `res_multistep`/`simple`, shift 3, ControlNet strength 1, max dimension 1024) is fixed. |
| `make_runs.py` | Builds one run json per job and a `manifest.json`. Prompts are assembled from a fixed vocabulary (pose sentences, hair styles, the template kit, the style sentence), so every frame of a character is described the same way and only the pose sentence and grid shape change per image. Stadium pieces have one prompt each (`PIECE_PROMPT`). |
| `jobs-2026-11-13-trial.json` | The trial: 15 figure grids (28 of 34 frames, hair 0, outfield and keeper) and the far stand. |
| `jobs-2026-11-14.json` | Batch 2: the six remaining frames plus two re-rolls (hair 0), every frame in hair style 1, every keeper frame, and the near, left and right stands, the boards and the dugout, each piece with two seeds. 47 runs. |
| `jobs-2026-11-14b.json` | Batch 3: the corrected right end (now a shallow terrace), the near terrace with its corrected row order and the far-side dugout, two seeds each; three further near-terrace attempts (two seeds with a prompt that asks for hundreds of small fans, one with the Canny preprocessor); and two denser-crowd attempts each for the left stand and the right end. 13 runs. |
| `jobs-2026-11-14c.json`, `runs-batch-4/` | Batch 4 (Milestone 3B): the animation set. Ten two-frame images in each hair style (header 0+1, header 2+volley 0, volley 1+2, poke+getup 0, getup 1+dismay, kneeslide 0+1, runcheer 0+1, runcheer 2+3, hug 0+1, kneel+appeal), five keeper images (catch 0+1, parry 0, parry 1, getup 0+1, dismay+appeal) and the three keeper dive frames re-rolled on seed 19910506 with an extra line insisting on a horizontal body. 28 runs, about 6.5 minutes of FloTime, plus two re-rolls of header 0+1 on seed 19910503 (the first seed painted a football for the head in the south-facing jump; the re-roll painted balls on two other heads, so only its south-facing jump cell was taken, with `--cells header:1:S`). The job files carry an optional `extra` sentence, placed before the kit line. The uploads went to `#inputs/soccer-manager/floyo-batch-4-uploads/`. |

## What was used in the end

| Piece | Painting | Conversion |
|---|---|---|
| Far stand | trial `stand-depth` | `--stand ... --standcrop 2,23` |
| Left stand (X=0 end) | `piece-left-24` (seed 19910502; the denser-prompt attempts `s3`/`s4` came out sparser, one on pale grey steps that match the far stand but read half empty) | `--piece left --piececrop 3,26` |
| Right end (X=105) | `piece-right-b-24-s2` (`s3`/`s4` with the denser prompt were no better) | `--piece right --piececrop 2,26` with the `ref4` reference |
| Near terrace | `piece-near-b-24-s3` (the "hundreds of small fans" prompt, seed 19910504) | `--piece near --piececrop 2,28` with the `ref4` reference |
| Boards | `piece-boards-24` and `piece-boards-24-s2`, joined end to end | `--piece boards --painted-piece a.png,b.png --piececrop 1,14` |
| Dugout | `piece-dugout-b-24-s2` | `--piece dugout` with the `ref4` reference |
| Figures | the trial batch, then batch 2 on top (`run-2` and `receive` re-rolled), then batch 4 (the 3B poses) | `--ref <trial refs> --painted <trial>` then `--ref <batch-2 refs> --painted <batch 2>` then `--ref <batch-4 refs> --painted <batch 4>`; the dive re-roll with `--dirs NE`; the header re-roll with `--cells header:1:S`; `--erase "dive:0:N,NW:gk;dive:1:N,NW:gk;dive:2:N,NW:gk;parry:0:N,NW:gk;parry:1:N,NW:gk"` |

Lessons from the figures (batch 4): a body lying along the line of sight (a keeper diving away from the camera, headings N and NW) projects as a short upright silhouette, and every seed paints it as a standing man; those cells are erased with `--erase` so the generated figure shows, which does render the foreshortened body. The painter also likes to add a football: on a head thrown forward towards the camera, or at a volleying foot; the converter now treats a white mark on the head as hair, and a cell that still reads as a ball is erased or re-rolled on the next seed. The sheet rows of new poses are appended, so earlier paintings keep their places and the converter pads an older override sheet to the new height.

Lessons from the pieces: the depth preprocessor reads a tall stepped stand well and a low flat terrace as a slab (four near-terrace paintings came back as one row of giant figures until the prompt asked for "hundreds of small standing fans, many rows deep"); the Canny preprocessor gives a structureless sea of heads; a run of boards benefits from two seeds joined, so the made-up logos repeat half as often; the painter adds an end wall to every stand, which the crop removes.

## The loop

1. **References.** Figures: `node tools/iso-art.js --ref <frames> --refspr 108 --cols 4 --refout <dir> [--gk 1] [--refhair 1]` writes, per image, a colour render, a true depth map (the control image), a mask, a material map and a json (cell layout, feet line, kit). Two frames per image (16 cells), wide poses (slide, dive) one frame of 8 cells in two columns. Stadium pieces: `node tools/iso-piece-ref.js --piece near|left|right|boards|dugout --out <dir>` renders the piece exactly as the game draws it, masked to its world box, with a json that records the box, the anchor corner and the axis it tiles along. (The far stand used the older `tools/iso-stand-ref.js`.)
2. **Upload.** The depth maps (figures) and colour renders (pieces) are uploaded to Floyo Files as `sm91-<stem>.png` under one folder, e.g. `#inputs/soccer-manager/sm91-batch-2/`. Stems join frames with `_` where the reference uses `+` (`run-2_run-3-h1` for `run-2+run-3-h1`).
3. **Runs.** `python3 tools/floyo/make_runs.py --jobs tools/floyo/jobs-2026-11-14.json --out <dir> --input-prefix '#inputs/soccer-manager/sm91-batch-2'` writes `run-<stem>.json` files. Each is submitted as the `workflow` of Floyo's run API or the MCP `run_workflow` call, named `SM91 <stem>`. Figures use preprocessor `none` (the depth map is already a depth map); pieces use `DepthAnythingV2Preprocessor` at resolution 1024 on the colour render. Seed 19910502 throughout, 19910503 for the second seed of a piece. Warm runs take about five seconds of FloTime; the first run of a session about a minute.
4. **Download.** The outputs appear in Files → outputs as `sm91-<stem>_00001_.png`. They are downloaded and placed in a folder as `<stem>-painted.png` (with `_` turned back into `+`), e.g. `run-2+run-3-h1-painted.png`.
5. **Convert.** Figures: `python3 tools/iso_paint.py --ref <ref dir> --painted <painted dir>` classifies every painted pixel into a template material and tone, downsamples to 24, 16 and 12 px/m with the feet on the sheet anchor, and writes `assets/matchday/isometric/B/overrides-<spr>.png` and `overrides-keepers-<spr>.png`. Later cells overwrite earlier ones, so the trial batch is converted first and batch 2 on top (re-rolls win). Pieces: `python3 tools/iso_paint.py --ref <ref dir> --piece near --painted-piece <png> --piececrop a,b [--fmt webp]` writes `piece-near-<spr>.<fmt>` + json; the far stand keeps `--stand <png> --standcrop 2,23`.
6. **Pack and build.** `python3 tools/iso_pack.py assets/matchday/isometric/B` rewrites the template-coded sheets as lossless palette PNGs (about a third of the bytes; `iso_paint.py` does it for the sheets it writes), then `python3 build.py` inlines whatever override sheets and piece textures exist. Every piece has a generated fallback, so a partial set is always playable.

## Rules kept throughout

* Only original art: the references are the game's own renders, the prompts name no game, club, brand or person, and the advertising boards ask for made-up abstract logos and unreadable lettering.
* The fixed template kit (red shirt, white collar and cuffs, royal blue shorts, yellow socks, black boots) is what lets the converter decode materials; a different kit in the prompt breaks the recolouring.
* One seed and one prompt vocabulary per character, so frames match each other. A frame that comes out wrong is re-rolled on its own with the next seed and converted on top.
* Runs go through the owner's personal Floyo team; the run names start `SM91` so they can be listed (`list_team_runs`, search `SM91`).
