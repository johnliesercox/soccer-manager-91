# Isometric art pipeline (Phase 3, Milestones 2A and 3B)

How the match view's artwork is made, stored, coloured and extended. The aim is a pixel-art asset set that is consistent across eight headings and every animation frame, that one artist can retouch without touching code, and that serves every club from one sheet.

## Where the art lives

```
tools/iso-art.js                      the generator (Node, @napi-rs/canvas): model, poses, lighting, palette, packing
assets/matchday/isometric/<style>/    the production assets, one folder per visual style (A, B)
  players-<spr>.png                   player sheet in TEMPLATE colours, 8 headings across, one row per (pose, frame, hair)
  patterns-<spr>.png                  same layout: per shirt pixel, which of stripes / hoops / quarters would show trim
  keepers-<spr>.png                   the same poses with gloves on
  crowd-<spr>.png                     32 crowd strips: four families (far, near, left, right) x four variants x still / standing
  grass-<spr>.png                     a tileable 4 m grass tile
  players-<spr>.json                  manifest: rows [pose, frame, hair, y, cellW, cellH, feet], headings, tones, strips, grass
src/matchday/iso-assets.js            run-time loader, recolouring, frame cache, crowd and grass textures, fallback
build.py                              inlines the chosen styles' sheets as data URIs (ISO_STYLES=B by default), so the game stays one offline file
```

`<spr>` is pixels per metre: 24 (close camera on a desktop), 16 (follow camera on a desktop, close on a phone) and 12 (follow on a phone). Pixel art does not scale fractionally, so each scale is rendered on its own.

## How a frame is made

1. **Pose.** `Matchday.isoSprites.pose(name, frame)` (the same functions the game uses) returns joint positions for the skeleton: feet, knees, hips, pelvis, chest, neck, head, shoulders, elbows, hands. Twenty-seven poses, 58 frames (the fifteen of Milestone 2A, then the twelve of Milestone 3B appended: header, volley, poke, catch, parry, getup, kneeslide, runcheer, hug, dismay, kneel, appeal; the keeper's sheet carries the subset he uses).
2. **Model.** `figureModel` dresses the skeleton as a small 3D model: chains of spheres with tapering radii for limbs (shorts over the thigh, a bare thigh, a sock top in the trim colour, a sock, a flattened boot), a tapering torso, short sleeves, a collar of beads, hands or gloves, a head with a hair cap that is kept only above the hairline and behind the face, and two eyes.
3. **Heading.** The model is turned to one of eight world headings whose screen direction is the centre of an eight-way sector (`isoSprites.HEADING`).
4. **Ray cast.** For each pixel of the cell, a ray along the dimetric view direction (1, 1, 1) is intersected with every sphere; the hit nearest the viewer gives the material, the surface point and the normal. There is no painter's sorting and no bitmap rotation or mirroring: a figure facing away shows the back of his head because that is what the ray hits.
5. **Light.** A key light from the screen's upper left plus an ambient term; style B darkens surfaces that face away from the viewer (a rim). The shade is reduced to the style's tone count (A: 3, B: 5).
6. **Template colours.** Each pixel is written as a code, not a colour: red = material index, green = tone index, blue = 128. Materials: skin, hair, shirt, trim, shorts, socks, boots, glove, eye, card, outline, coat, hat, scarf.
7. **Outline.** One pixel around the silhouette (A black, B a dark tone the game chooses by the shirt's brightness).
8. **Patterns.** For shirt pixels the generator also records, in the pattern sheet, whether stripes (by the body's sideways coordinate), hoops (by height) or quarters would show the trim colour at that point.

## How a frame is coloured in the game

`isoAssets.get(kit, variant, dir, pose, frame, spr)` copies the frame from the sheet, decodes each pixel's material and tone, and writes the kit's colour for that material at that tone (five tones from 42% darker to 28% lighter): shirt and socks from the primary, trim from the secondary, shorts from the secondary or a contrasting default when the two are too close, skin and hair from the player's variant, gloves white, outline by brightness. If the kit has a pattern, shirt pixels flagged in the pattern sheet take the trim colour. The result is cached per (style, scale, kit, pattern, skin, hair, heading, pose, frame), capped at 2,400 frames, and cleared when the renderer is disposed. Recolouring a 48 x 52 frame takes well under a millisecond; a match uses a few hundred frames.

Crowd strips are recoloured the same way, with a per-person index in the blue channel so each spectator gets his own coat, hat, skin, hair and scarf from a seeded palette that includes the two kits' colours. The grass tile is drawn through a shear transform so one tile paints the whole pitch under the projection.

## Expanding to the whole game

* **All teams.** Nothing to add: kits are colours plus a pattern name in `capture.js` (`stripes`, `hoops`, `quarters` for the clubs that wore them in 1991; `plain` otherwise, and always plain for a change kit). A new pattern (a sash, a chest band) is one line in the generator's pattern test and one bit in the mask.
* **All players.** Skin and hair come from `variantFor(id)`; the sheet is shared. Hair styles are a generator option (`--hair 0,1,2`); only the cap style ships to keep the sheet small.
* **Eight directions and frames.** Add a pose to `isoSprites.pose` (joint positions per frame) and the generator renders it in all eight headings at all scales; the manifest and the game pick it up by name. A new frame costs about 40 ms to render at 24 px per metre.
* **Stadium variations.** Crowd strips are generated from a seed and a family; a second set (an away end in the away colours, a sparse midweek crowd, a cup final) is another manifest entry. Terrace geometry stays in `iso-stadium.js`; boards, roof and pylons are drawn from world geometry and can be varied per club later.
* **Retouching.** Because the sheets are ordinary PNGs with a documented layout, an artist can repaint any frame in template colours, or add an `overrides-<spr>.png` in the same layout that the loader lays over the generated sheet. The generator never overwrites an override.
* **Rendering the lot.** `node tools/iso-art.js --style both --spr 24,16,12` renders every asset in about six minutes; `ISO_STYLES=B python3 build.py` ships one style.

## Costs and safeguards

* Shipped size: with the complete painted set (style B, three scales, override sheets, the four stands, boards and dugout) `index.html` is 4.2 MB. The template-coded sheets are lossless palette PNGs (`tools/iso_pack.py`) and the painted textures 255-colour palette PNGs, which is what keeps it there; stored as 32-bit PNGs the same art came to 7 MB. The service worker caches it, so it is a one-off download. Dropping the 24 px scale would take out about 1.3 MB if size ever matters.
* Memory: the decoded sheets are 2 to 4 MB per scale; recoloured frames a few MB; ground tiles are capped at 12 MB (desktop) or 9 MB (phone).
* Fallback: if the sheets are missing, fail to decode or a frame is not in the manifest, the procedural figures and crowd from Milestone 2 draw in their place, frame by frame, with no mode switch and no error.
* Performance: unchanged from Milestone 2 in headless Chromium (60 fps at all five viewports, 0.4 to 1 ms per frame, 2.5 to 3.8 ms per ground tile), because the per-frame work is the same blits.

## Painting over the generated frames with an image model (Floyo)

The generator's frames are also the references an image model paints over, and `tools/iso_paint.py` turns what comes back into override sheets and stadium textures. This is the production art route for Phase 3 (approved after the trial of 13 November); the generated sprites and the generated stadium stay in the build as the fallback for anything not painted. The whole process, with the job files and prompts, is in `tools/floyo/README.md`; in short:

1. **References.** `node tools/iso-art.js --ref run:2,walk:0+walk:1,... --refspr 108 --cols 4 --refout <dir> [--gk 1] [--refhair 1]` renders, per image, one or two frames in all eight headings at 108 px/m (a 216 px figure): a lit colour render, a true ray-cast **depth map** (the control image), a mask and a material map, plus a json with the cell layout. `node tools/iso-piece-ref.js --piece near|left|right|boards|dugout` renders a stadium piece exactly as the game draws it, masked to its world box, with its anchor corner and tiling axis in a json (the far stand came through the older `tools/iso-stand-ref.js`).
2. **Floyo.** The depth maps go to the Z-Image Turbo + Fun ControlNet Union workflow with the preprocessor set to `none`; the stadium pieces send their colour render through a depth preprocessor. One prompt vocabulary and one seed for a whole character, a fixed template kit (red shirt, white collar and cuffs, royal blue shorts, yellow socks) so the kit can be decoded afterwards, the pose named per image; the boards are asked for made-up abstract logos and unreadable lettering. `tools/floyo/make_runs.py` writes the run json for every job from a jobs file, so a batch is reproducible to the seed. About five seconds of FloTime per image once the model is warm.
3. **Conversion.** `python3 tools/iso_paint.py --ref <dir> --painted <dir of <stem>-painted.png>` cuts each cell out, classifies every painted pixel into a template material (the reference material map is the prior, the painted colour can override it; white trim, gloves and the referee's card only where the reference has them) and a tone (the pixel against the painter's flat colour for that material, so the game's mid tone is the painted flat colour), keeps one figure per cell, box-downsamples to 24, 16 and 12 px/m with the feet on the sheet anchor, adds the outline and writes `overrides-<spr>.png` and `overrides-keepers-<spr>.png`; the reference json's hair style picks the sheet row, so hair 0 and hair 1 (the referee's style) are painted sets of their own. Later cells overwrite earlier ones, so a re-rolled frame is simply converted on top. `--piece <name> --painted-piece <png> --piececrop a,b` turns a painted stadium piece into `piece-<name>-<spr>.png` + json (the far stand: `--stand <png> --standcrop 2,23`): the painter's flat background is keyed out even inside the box, the segment is cropped to the metres given (the model paints an end wall at the edges of a stand), and the texture is written as a 255-colour palette PNG whose palette is chosen from the opaque pixels with the saturated ones weighted, so a yellow coat among grey concrete keeps its colour at about a third of the bytes of a 32-bit PNG.
4. **In the game.** `build.py` inlines whatever exists. The loader replaces a generated cell outright wherever an override cell is painted. The stadium renderer tiles a painted stand or run of boards along its axis from its anchor corner (a whole number of tiles, scaled a touch, spans the run exactly) over the generated art, whose pixels show through any transparent hole; the two dugouts are painted sprites placed at their world corner on the far side, set into the front of the main stand either side of the halfway line and open towards the pitch (towards the viewer, so the bench shows), part of the ground like the stands, with a plain generated shelter when the style ships no painted one. The hoardings are drawn in front of the near terrace's first row, as they stand.

What the trial and the full batch showed: the model keeps the heading, pose and size from the depth map reliably, a character stays consistent across its grids with one seed and prompt, and hair, collar, face and limb shapes survive the downsample to 48 px. The painter sometimes adds a ball or a ground shadow (dropped as a stray component) and paints a stand's ends short (hence the crops). Re-running one image costs seconds, so a frame can be re-rolled with a new seed until it fits.

What the Milestone 3B batch added: the new poses are appended rows, so an older override sheet is padded to the new height and every earlier painting keeps its place; `--dirs` converts a subset of headings from an image (a re-roll that only improved one view), `--cells pose:frame:dirs` only the named cells, and `--erase pose:frame:dirs[:gk]` clears painted cells so the generated figure shows through. That last is the answer to a body lying along the line of sight: a keeper diving away from the camera (N, NW) projects as a short upright silhouette and every seed paints it as a standing man, whereas the generated figure, drawn from the model, lies down properly. The painter also likes to put a football where the depth map shows a head thrown towards the camera, so the converter treats a white mark inside the head as hair and such a cell is re-rolled on another seed.

## Where the ceiling is

A model-and-light generator gives consistency, eight headings, any number of frames and cheap recolouring, and it gets to the look of pre-rendered 16-bit sprites. It does not get to hand-painted character: expressive faces, folds in a shirt, a particular way of running. The route to that is painting over the generated frames, by an image model through the loop above or by a pixel artist, rather than more generator features; the layout, anchors and template palette are in place for both.
