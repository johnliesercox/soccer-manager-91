# The art pipeline: what is on GitHub, what is not, and what it takes to make the art again

Written 18 November 2026, at John's request, so that the Blender and Floyo work is not lost and nothing is uploaded blindly. Where a statement could not be checked from the repository it says so.

## In short

* **The game needs none of the missing files.** Every picture the game draws is in the repository, and the build and all the tests run from a clean checkout.
* **The method is in the repository in full:** every script, every prompt and setting, every Floyo run id, the audit results, and the lists of what was painted.
* **What is not on GitHub is the bulk material the method produced along the way:** the Blender reference renders (94 MB in nine zip files) and the raw paintings as they came out of Floyo. They are the exact record of how the art was made, and they save about an hour of work if a painting ever has to be redone. They can be made again from what is in the repository, with one caveat set out below.

## What is on GitHub

| What | Where | Notes |
|---|---|---|
| The finished art the game draws | `assets/matchday/isometric/E/` (178 files) | the painted production set: player, keeper and pattern sheets at three scales, painted stands, corners, goals, dugout, with their layout files |
| The earlier styles | `assets/matchday/isometric/B/` (60 files), `A/` (18 files), `rnd-styles-CDF.zip` (3.4 MB: comparison styles C, D and F) | B is the 1.5.0 art and the fallback inside E; `ISO_STYLES=B python3 build.py` still builds it |
| The Blender scripts | `tools/visual-rnd/blender_figure.py`, `blender_pieces.py`, `isocam.py` | the footballer from the game's own skeleton, the stands, corners, goals and dugout, and the game's projection as a Blender camera |
| What the scripts read | `tools/visual-rnd/joints.json` (and `export-joints.js`, which writes it from the game), `stadium-geometry.json`, `frames.json`, `stage1/frames.json` (the 124 production grids) | everything the renders are made from |
| The Floyo side | `make_runs_rnd.py`, `make_runs_pieces.py`, `batch_runs.py`, `sheet_runs.py`, `split_sheets.py` | the workflow graphs with their prompts, model names, strengths and seeds, the batching, and the contact sheets |
| Every Floyo run | `runs-a.json` (the R&D day), `stage1/runs-stage1.json` (production and re-rolls), `stage2b/runs-stage2b.json` (the second crowd and the goals), `tools/floyo/` (the style B runs) | run ids, FloTime, notes |
| From painting to game art | `tools/iso_paint.py`, `tools/iso_pack.py`, `ingest_stage1.py`, `paint_pieces.py`, `audit_cells.py`, `migrate_overrides.py` | the converter, the defect audit and the packer |
| What the audit found | `stage1/audit-first-roll.json`, `audit-rerolls.json`, `sheets.json`, `sheets-r2.json`, `stage2b/sheets-o1.json`, `sheets-o2.json` | which grids were re-rolled and which cells were taken from the re-roll |
| A small part of the reference renders | `tools/visual-rnd/refs-pieces/` (16 files) | the R&D pieces only |
| The write-ups | `ART-PIPELINE.md`, `tools/visual-rnd/README.md`, `PHASE-3-VISUAL-RND.md`, `PHASE-3-OPTION-E-CHECKPOINT.md` | the method, step by step, with the commands |

## What is not on GitHub

Checked on 18 November against the branch `milestone-5`: none of these folders has a single file in the repository.

| Missing | What it is | Made by |
|---|---|---|
| `tools/visual-rnd/archives/` | nine zip files, 94 MB in all, each under 19 MB so that it could go up through GitHub's web page, with an `archives/README.md` saying what each restores. `.gitignore` already makes an exception for them, so they will be accepted the day they are added | zipped from the folders below |
| `tools/visual-rnd/stage1/refs/` | the Blender renders of the 124 production grids at 108 px a metre: colour, depth map, mask, material map and a layout file for each. The depth maps are what Floyo painted over | `blender_figure.py` |
| `tools/visual-rnd/stage2/pieces/`, `stage2b/pieces/` | the Blender ground: the four stands with crowd masks and depth maps, the four corners, pylons, goals, dugout; and the second-generation crowd | `blender_pieces.py` |
| `tools/visual-rnd/stage0/`, `refs-a/`, `refs-b/` | the look test John approved and the R&D day's reference sets | `iso-art.js`, `blender_figure.py` |
| The raw paintings | the pictures as they came out of Floyo (about 140 for production, on nine contact sheets, plus the re-rolls and the R&D day's) before they were converted into the game's sheets | Floyo |
| `tools/visual-rnd/bpyenv/` | the Python environment the Blender scripts ran in | `pip` (see below); never meant for the repository |

The pipeline README refers to `archives/README.md`, which is among the missing files; this document stands in for it until the archives are stored.

## Where the missing files are retained

* **The nine archives:** in `upload-2-tools.zip`, one of the four upload files produced in the chat that prepared release 1.6.0 (16 November 2026). **John still has it, and sent it on 18 November; it was checked the same day** (next section). An earlier version of this note said ten archives. That was a miscount: the tenth, `rnd-styles-CDF.zip`, was already in the repository.
* **The raw paintings:** in the output folder of John's Floyo Personal Team, under the run ids listed in the three run files, for as long as Floyo keeps them; and in the zip files John downloaded and attached during the art work. The files uploaded to Floyo as inputs are under `#inputs/soccer-manager/` there.
* **The working chats** hold the attachments that passed through them. The art pipeline was developed in the chat titled "Reverse engineering retro Amiga game for mobile" (https://claude.ai/chat/c1bfd279-0d2a-48a7-9a6b-0a0579a9f497).
* **Nothing is retained on the machines the work ran on.** Each working session starts from a clean clone of the repository.

## The archive file, as checked on 18 November 2026

`upload-2-tools.zip`: 93,905,413 bytes, SHA-256 `d94aebd9bd38e59e17a6c9e47a18cdc684327910d5803da6b7614bae4fbc93dd`. It opens without error, and so does every archive inside it. The copy checked was the one John attached to the working chat; a working session keeps nothing, so **John's own copy is the one that counts** until a permanent home is chosen.

| Archive | Bytes | Files | Restores | SHA-256 (first 16) |
|---|---|---|---|---|
| `stage1-refs-1.zip` | 18,610,082 | 223 | `stage1/refs/` | `e830115d81869fab` |
| `stage1-refs-2.zip` | 18,621,720 | 184 | `stage1/refs/` | `0c0e7a53a9822f87` |
| `stage1-refs-3.zip` | 18,435,598 | 175 | `stage1/refs/` | `a6cf32d9b6c75faa` |
| `stage1-refs-4.zip` | 3,711,316 | 38 | `stage1/refs/` | `01471a09339d5d7f` |
| `stage2-pieces.zip` | 9,032,962 | 64 | `stage2/pieces/` | `50853d60caacca92` |
| `stage2b-pieces.zip` | 11,164,108 | 86 | `stage2b/pieces/`, `stage2b/option2-F/` | `4356a11471458d64` |
| `refs-a.zip` | 4,870,222 | 65 | `refs-a/` | `3787afd5fadcd1f6` |
| `refs-b.zip` | 5,967,952 | 65 | `refs-b/` | `162a9e095c90459b` |
| `stage0.zip` | 2,910,504 | 33 | `stage0/` | `4770f8365c2b2da2` |

* 933 files in all. The four `stage1-refs` archives hold 620 files between them, which is five files for each of the 124 production grids, as expected.
* The file also holds `archives/README.md` (what each archive restores) and a copy of the pipeline's scripts as they stood at 1.6.0. 44 of those 47 files are byte for byte what the repository holds today. `tools/save-compat.js` and `tools/visual-rnd/README.md` have been updated in the repository since, and one is a leftover Python cache file that was never meant to be kept.
* **Not in the file:** the raw paintings as they came out of Floyo, and the Blender Python environment. The first are covered below; the second is rebuilt with `pip`.

## What it takes to make the artwork again

Everything below is in the repository. The commands, in order and in full, are in `tools/visual-rnd/README.md` under "Production (Option E)".

1. **The Python environment for Blender:** Python 3.11 with `bpy` 5.0, Pillow and numpy, in `tools/visual-rnd/bpyenv`. No Blender licence or account is needed.
2. **Render the references:** `blender_figure.py` for the 124 grids (about 14 seconds a grid at 6 samples, half an hour of processor time in all) and `blender_pieces.py` for the ground. This restores `stage1/refs/` and `stage2/pieces/`.
3. **Upload the depth maps to Floyo** (John's Personal Team, `#inputs/soccer-manager/`). The sandbox cannot reach Floyo's file store, so John uploads.
4. **Paint:** the graphs from `make_runs_rnd.py` and `make_runs_pieces.py`, batched by `batch_runs.py`. Figures: Qwen Image 2512 with the Fun ControlNet Union 2602, depth map only, 8-step Lightning, strength 0.85, seed 19910502 (re-rolls 19910509, with prompts that never mention a ball). Stands: image to image at denoise 0.6 over the Blender colour render, crowd-only treatment. The production cost was 35.7 minutes of FloTime and no Partner Nodes spend.
5. **Bring the paintings back** as contact sheets in a zip (`sheet_runs.py`, then `split_sheets.py`); a picture pasted into a chat is recompressed and cannot be used.
6. **Audit and convert:** `ingest_stage1.py` and `paint_pieces.py`, then `python3 build.py`.

**The caveat.** Steps 1 and 2 give the same renders again, near enough for the purpose. Step 4 does not promise the same paintings: the same graph and seed on Floyo give the same picture only while the same model files are served, and that is outside this project's control. So a repaint would give art of the same kind, not the identical pixels. The identical pixels of the art that shipped are safe, because the finished art is in the repository; what the archives add is the exact intermediate record.

It also follows that the animation library, which John has said is final and is not to be regenerated, does not depend on the archives in any way.

## Options for permanent storage (John's decision, before the final handover)

| Option | For | Against |
|---|---|---|
| Add the nine zips to the repository | one place for everything; `.gitignore` is ready; each file is under GitHub's web-upload limit | 94 MB added to every clone for good; only useful to someone repainting |
| Attach them to a GitHub Release (for example on the tag of the combined release) | kept with the project and its history without weighing on the repository; a release asset may be up to 2 GB | one more place to know about; this note would point to it |
| Keep them in Google Drive or similar, with the link recorded here | simplest today | depends on an account outside the project |
| Let them go, and rely on re-rendering | nothing to store | loses the exact record and the raw paintings; a repaint starts from step 1 |

My suggestion is the second: a release asset on the combined release, with the raw paintings added to the same place if John still has the zips he downloaded from Floyo. It is his call, and nothing needs deciding until then.
