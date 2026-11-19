# Soccer Manager '91: release 1.7.1, the hair fix. Milestone 0 checkpoint

**Status, 19 November 2026, afternoon: approved by John, kept on its branch, not deployed.** His decisions on the checkpoint: the hair is right; the one-line fix of section 6 stays in; the paintings are left as they are and the findings of section 5 go to an artwork-defect backlog (`ARTWORK-BACKLOG.md`); the hair audit stays in the standard regression; and there is no need to deploy this version, so 1.7.1 is not merged to `main` and the live site stays 1.7.0. He measured the 1.7.1 preview on his Galaxy phone (section 7). He created the tag `v1.7.0` on the live commit the same day.

Written 19 November 2026 for John's visual approval. **Nothing here is merged or deployed.** The work is on the branch `milestone-0-hair`, started from `main` at `cde3c8f` (the live 1.7.0). The live site and `main` are untouched.

Scope as approved on 19 November: Option A (repair the stored sheets) with the converter corrected alongside; a permanent audit of all 5,568 pictures as the game draws them; the hairstyles' shape assessed and reported, with no repainting unless John agrees; version 1.7.1 with the one approved line of What's new; full regression; the goalkeeper limitation documented.

## 1. The outcome in short

* **A player's hair is now his own colour in every pose, from every direction, at all three sizes.** In 1.7.0, 4,846 of the 5,568 pictures had some of the head's hair drawn black whatever the player's hair colour (73,680 pixels), and 5,155 had flecks of hair colour on legs, arms, neck or face (66,301 pixels). In 1.7.1 both counts are zero.
* **Eyes and mouths are kept.** Every face that showed a dark mark still shows one, with five exceptions that I looked at one by one: in each the "mark" was a dark fleck inside the hair, not an eye.
* **The same hair is no longer darker in some poses than others.** 467 heads were a tone or two off the rest (the cropped style's running, kicking and shooting frames were stored at the darkest tone throughout); every head is now on one level.
* **Nothing else moved.** No pixel was added to or removed from any figure, so every outline, limb and contact point is the same. With the old sheets, the new code draws all 198 reference frames and all 61,248 reference pictures exactly as 1.7.0 does. The engine file is byte for byte the same. Ten seeded matches have the same events and the same position, action and facing for every player at 8,179 moments in both versions.
* **The audit found one more thing, which I have fixed and need your yes or no on** (section 6): in 1.7.0 a player or the referee was sometimes drawn for a moment as the old generated figure instead of the painted one. It is a one-line change in the match drawing code, which was outside the scope you approved, so it is in a commit of its own and comes out cleanly if you would rather not have it in this release.
* **The hairstyles' shape** (section 5): the three styles stay distinct and each is steady in amount; the cropped style varies most. Separately from hair, the review shows that the painter did not always turn the head the way the body faces, and that six paintings have the head cut off. None of this is new in 1.7.1 and none of it needs repainting to release the fix; my recommendation is to leave the art as it is for now.

## 2. What was wrong

The painted sheets store, for every pixel, what it is (hair, skin, shirt, boots, eye and so on) and how light it is. The game then colours "hair" with the player's own hair colour and always draws "boots" and "eye" black.

The painter's hair is dark brown shading to near black. The converter that made the sheets (`tools/iso_paint.py`) chose each pixel's material by the nearest colour of the painter's kit, so:

* the dark part of the hair was filed as **boots**, the kit's only near-black colour;
* where the painted head was a little larger than the reference figure's, the hair's lower edge fell where the reference had skin, and the rule that turns dark marks on skin into eyes and mouths filed it as **eye**: a black band between hair and face;
* brown shadows on socks, knees and arms were filed as **hair**, and took the hair colour;
* a head's tones were set against the middle lightness of everything filed as hair in its painting, strays included, so some heads came out darker than others.

The game's choice of a look was never at fault: it is fixed by the player's id, and the audit confirms it is the same in every picture asked for (section 4).

## 3. Summary of the pixel-classification corrections

`python3 tools/hair_repair.py` rewrote the six painted sheets (players and keepers at 24, 16 and 12 pixels a metre). Of their 2,529,883 painted pixels it refiled 194,999 (7.7%), in 5,512 of the 5,568 cells. **Every changed pixel is hair before or after; none is anything else.** All six sheets keep their outlines exactly.

| From | To | Pixels | What it was |
|---|---|---|---|
| boots | hair | 35,742 | the dark side of the hair, drawn black |
| eye | hair | 37,939 | the hair's lower edge and dark strands, drawn black |
| skin, shorts, shirt, glove, outline | hair | 404 | small patches shut inside the hair (a sheen taken for shorts, a light strand taken for skin) |
| hair | skin | 35,880 | brown shadow on arms, knees, necks and faces |
| hair | socks | 10,155 | shadow on socks |
| hair | shorts | 10,088 | shadow on shorts |
| hair | shirt | 7,604 | shadow on shirts |
| hair | boots | 1,986 | hair colour at the feet |
| hair | collar and cuffs, glove | 588 | the same on trim and keepers' gloves |
| hair | hair, lightness only | 54,613 | heads brought to the common level |

How it decides (the full rule is in the script's header and in `ART-PIPELINE.md`): around the head, which it finds from the game's own skeleton, it takes the one blob of hair, boot black and eye black with the most hair close to the head joint; that is the head's hair. Black in it becomes hair, except the marks that are an eye or a mouth: a run of one or two pixels with skin at an end, or the dark pixels nearest to where the reference model has each eye. A face that had dark marks always keeps at least one. Hair anywhere else takes the material it sits on, in a dark tone, so a shadow stays a shadow. Running the script again on the repaired sheets changes nothing (0 cells).

**The converter is corrected too** (`classify()` in `tools/iso_paint.py`): boots only near where the reference has boots; hair only around the reference's hair; a dark pixel on or beside the reference's hair is hair unless it is at the reference's eye; eyes and mouths only on the face. And the converter now runs the repair at the end of every conversion of the painted style, so a future conversion cannot bring the fault back unnoticed. Because the raw paintings are not in the repository, the converter's new rule is tested on a made-up painting that has the faults in it (`tools/test_iso_paint_hair.py`): the corrected converter passes all seven checks, and the converter as released in 1.7.0 fails five of them. What I cannot show is a real conversion of the real paintings; the repair and the audit are the guarantee there.

## 4. The permanent hair audit, and its results

`node tools/hair-audit.js .` (about eight minutes; in the README's list of checks and the handover's table).

**It examines what the game draws, not what the sheets store.** It loads the built game in a browser and asks the game's own drawing call for every picture, three times over with different hair and skin colours. A pixel that changes with the hair colour is drawn as hair; one that changes with the skin colour is skin; one in the game's fixed boot black or eye black is black. Where the head is comes from the game's skeleton. It needs nothing outside the repository.

Part 1, all 5,568 pictures (58 poses and frames, 8 directions, 3 hairstyles for outfield players and the keepers' one, at 3 sizes). It fails on any of these:

| Check | 1.7.0 | 1.7.1 |
|---|---|---|
| The game has a picture for every cell | 0 missing | 0 missing |
| Every picture is its painted cell (no fallback to the generated figure in the sheets) | 0 | 0 |
| Every hairstyle has pictures of its own (no fallback to hairstyle 0) | 0 | 0 |
| Hair drawn in boot black | 35,742 px in 3,352 cells | **0** |
| A dark band joined to the hair drawn black | 37,938 px in 4,166 cells | **0** |
| Hair colour away from the head (legs, arms, neck, face) | 66,301 px in 5,155 cells | **0** |
| A patch of another material shut inside the hair | 822 px in 392 cells | **0** |
| A head of hair off the common lightness level | 467 heads | **0** |
| Hair on heads, in all | 309,927 px | 378,634 px |
| Faces shown from the front, and dark marks on them | 1,490 faces, 17,818 px (most of it the band) | 1,490 faces, 6,561 px |
| Faces that had a mark in 1.7.0 and have none in 1.7.1 | | 5, inspected: flecks inside the hair, not eyes |

Part 2, the look followed through matches: 20 seeded games, the first match of each, 27,197 moments drawn with the three cameras, 598,420 player pictures asked for, 440 players followed, 3 sendings-off.

| Check | 1.7.0 | 1.7.1 |
|---|---|---|
| Every picture asked for with the player's own skin, hair colour and hairstyle | all | all |
| Anybody's hairstyle changing during a match | 0 | 0 |
| A painted picture not found, the generated figure drawn instead | 98 for players, about 950 for the referee (952 and 939 in two runs) | **0 and 0** (section 6) |

The whole-pitch camera draws its figures smaller than the smallest painted sheet, so its 100,069 pictures in these matches are the small generated figure. That is how it was designed and is not counted as a fault.

**Unexpected hairstyle changes and fallbacks, in one place:** the look is right in every picture asked for; no hairstyle has to borrow another's pictures; no painted cell is missing. The only fallback that existed is the one in section 6, now fixed.

The audit also keeps a list of cells where the painting itself differs from its hairstyle's norm (section 5), recorded in `tools/reference/hair-shape-known.json`. It fails if a cell that is not on the list ever joins them, so new art cannot add to them unnoticed.

## 5. Hairstyle shape: what I found, and my recommendation

Pictures: `sm91-1.7.1-hairstyle-shape-review.png` (the three hairstyles through nineteen poses from five directions, with the listed cells outlined) and `sm91-1.7.1-heads-cut-off.png`.

**The hairstyles themselves.** With the colour right, each style reads as itself throughout.

* Amount of hair against the style's norm for its direction, close-up size: within a quarter of the norm in 93% of the short style's cells, 94% of the long style's and 86% of the cropped style's.
* The three stay distinct: in the same pose, frame and direction the long style has the most hair in 93% of cases and the cropped the least in 89%.
* The cropped style varies most. It is a neat cap standing still and a fuller mop in the running, kicking and shooting frames; between standing, walking and running its hair area varies by 1.25 to 1.6 times depending on direction, against 1.1 to 1.5 for the other two. It was the style worst hit by the colour fault (its running frames were black), so the change of shape was hidden before and is visible now. At match size it reads as hair moving; enlarged, it is plainly a different drawing.

**Three things in the paintings that are not hair faults**, all in the game since the painted art arrived in 1.6.0:

| What | How many (close-up size; much the same at the other two) | How often it is drawn (20 matches, 498,351 painted pictures) |
|---|---|---|
| The body faces the camera but the head is painted from behind (no face) | 137 of 696 front-facing cells, 19 of them standing, walking or running | 17,858 (3.6%) |
| The body faces away but the head is painted with a face | 45 by the audit's cautious count; by eye there are more | 20,199 (4.1%) |
| The head is cut off in the painting: parry 1, parry 2 and getting up 1, facing E and W only | 24 (6 poses and directions, in each hairstyle and for keepers) | 113 (0.02%) |
| Much less or much more hair than the style's norm (dives, the referee's poses) | 20 | 56 |

Why: the painter follows a depth map, and a depth map of a round head does not say which way it faces; and a figure lying full length is longer than the reference grid's cell, so its head fell outside.

**Recommendation: no repainting and no Floyo re-runs for 1.7.1.** None of these is needed for the hair fix and none is made worse by it. If you want them put right later, it would be an art job of its own: the head direction touches most of the 124 production grids, so it is close to repainting the players with a control that carries the face; the cut-off heads are a small job (the parry and getting-up grids, re-rendered with a wider cell and painted again). I would not start either without your decision, and I would suggest looking at the pictures first: at match size the first two are hard to see.

One small leftover you may notice enlarged: a few heads have a speck or two of grey at the edge of the hair (a blue sheen the converter took for shorts, not fully enclosed by hair, so the repair leaves it). It is in a handful of cells and I have left it rather than guess.

## 6. Found by the audit and fixed, for your decision: the generated figure appearing for a moment

You asked the audit to find any fallback to incorrect artwork. It found one in play.

**What happened in 1.7.0.** A few poses have a single frame: set, poke, block, booked, kneel, appeal, dismay, and the referee's whistle, card and point. When a player or the referee took one of these while still walking or running, the game asked for it with the frame number of his stride, which that pose does not have. The painted picture was not found and the old generated figure was drawn for those moments: a different, blockier drawing with its own hair. In the 20 matches that was 98 player pictures and about 950 referee pictures out of about half a million, so brief for players and fairly regular for a referee blowing up on the move.

**The fix.** One line in `src/matchday/renderers/iso-actors.js`: a pose is asked for by a frame it has. The 1.7.1 audit finds none.

**Why I am flagging it.** The approved scope said no changes to the matchday code. This one changes no movement, timing, contact or result (the scenes are identical, section 7); it only chooses the painted picture where the generated one was being drawn. It is in its own commit. **Tell me to keep it or take it out.** If you keep it, you may want a second line in What's new, for example: "The referee and players are always drawn in the painted style, including when they act on the move." I have not added it.

## 7. Confirmation that everything else is unchanged

| What | How it was checked | Result |
|---|---|---|
| The engine and results | `engine.js` byte for byte the same as 1.7.0; `test-equivalence.js`, `test-record.js`, `test-regression.js` | unchanged, pass |
| Player movements | ten seeded matches in both versions: every event, and every player's position, movement, action, phase and facing at four moments a second (8,179 moments, 10,514 events) | identical in all ten |
| Contacts | `tools/ball-audit.js` in both versions | output identical; `test-contact.js` passes |
| Limbs and outlines | the six sheets' outlines compared pixel for pixel | identical, so no limb or contact point moved |
| The picture apart from hair | new code with the old sheets: 198 frames and 61,248 pictures against the 1.7.0 references | identical to the pixel |
| The ground | 1,717 ground tiles against the reference | identical to the pixel |
| The picture with the new sheets | recorded as the new references (`tools/reference/frames-1.7.1.json`, `player-pictures-1.7.1.json`); 132 of the 198 frames differ from 1.7.0, the 66 whole-pitch frames do not | as intended |
| The 21 test suites | `node test-*.js` | 20 pass outright. The 21st, `test-phase25.js`, passes every check but its stopwatch (a match's scene must be built in under 400 ms). On today's machine that one check fails more often than it passes in both versions: 1.7.1 gave 519, 467, 448 and 468 ms and two passes in six runs; 1.7.0 gave 456, 419 and 425 ms in three. The code it times is not touched by this work |
| Saves | `tools/save-compat.js`: games played and saved on 1.7.0, resumed and played on in 1.7.1, and the reverse; the same with 1.6.0 | 19 checks, 0 failures, all four times |
| Screens | `tools/ui-parity.js`: the three journeys, 165 stops, phone and desktop, against 1.7.0; layout at five sizes; keyboard; the match screen's boxes at eleven sizes; `tools/viewport-audit.js` | the same words and controls at all 330 stops once the version number and the new What's new entry are allowed for; the saved games after the journeys are identical; nothing off screen or cut short; all 2,843 controls reached by keyboard; every box of the match screen where it was; viewport audit passes |
| Holding up over time, offline, hot-seat | `tools/soak-audit.js . out all` | 44 checks, 0 failures |
| Performance | `tools/phone-probe.js` (a stand-in for a Galaxy S23 Ultra with the processor slowed six times): the share of frames slower than 30 a second, limit 1% | three runs each, alternated: 1.7.1 0.3%, 0.2%, 0.3%; 1.7.0 0.5%, 0.3%, 0.4%. Two earlier runs of 1.7.1, straight after other heavy work on the machine, gave 1.9% (a fail) and 0.8%. No measurable difference; the sheets have the same dimensions and the drawing code is the same |
| Performance on a real phone | John's Galaxy, Chrome, the 1.7.1 preview opened from the phone, the game's own measuring panel over 60 seconds of play at normal speed, close camera (19 November) | 59.5 frames a second on average (59.6 on 1.7.0); a frame typically 16.7 ms, the slowest 5% 16.7 ms, the slowest 1% 16.8 ms; 2 of 3,572 frames longer than 34 ms, both longer than 50 ms, 300 ms at worst; drawing a match frame 1.9 ms on average, 7.2 ms for the slowest 5%; the target of 30 a second met; screen 384 by 692 at 3.8, 45.2 MB |

The build: `index.html` 7,098,673 bytes, md5 `ed64f8d845dba924c5e3bd5f4de1110e`; `soccer-manager-91.html` md5 `83c88a9210776446891b25525fc4dd98`; service worker cache `sm91-v1.7.1`; save format 4, unchanged. The file is 72,605 bytes smaller than 1.7.0's because the repaired sheets compress a little better.

## 8. The known limitation: goalkeepers have one hairstyle

Outfield players are painted in three hairstyles (short, cropped, long). Goalkeepers are painted in one, the short style: their sheet has 58 poses in 8 directions with one head of hair. So:

* **A goalkeeper whose look says cropped or long is drawn with short hair for the whole match.** His hair colour and skin are his own. Nothing changes during the match, so there is nothing to notice. 21 of the 40 goalkeepers followed in the audit's matches are in this position.
* **An outfield player who goes in goal changes hairstyle at that moment.** When a goalkeeper is sent off, a defender takes his place from that second (`src/matchday/scene.js`), puts on the keeper's colours and is drawn from the keepers' sheet. If his own style is cropped or long, his hair becomes the short style for the rest of the match; his hair colour and skin stay his own. The audit shows this directly (it puts an outfield player in goal in a real match scene and records what is drawn) and would report any real case in its matches; none of its 20 matches had a goalkeeper sent off (three outfield players were).

It is not a fault in the hair fix and it is unchanged from 1.6.0 and 1.7.0. Curing it means painting the keepers' poses in the two other hairstyles, 928 new cells at each size, through Floyo. It is recorded here, in `PHASE-4-HANDOVER.md` and in the audit's output. Out of scope unless you say otherwise.

## 9. What is in the branch

| File | Change |
|---|---|
| `assets/matchday/isometric/E/overrides-{24,16,12}.png`, `overrides-keepers-{24,16,12}.png` | the repaired sheets |
| `tools/hair_repair.py` | new: the repair |
| `tools/hair-audit.js`, `tools/reference/hair-shape-known.json` | new: the audit and its list of known cells |
| `tools/iso_paint.py`, `tools/test_iso_paint_hair.py` | the converter's corrected rule, and its test |
| `src/matchday/renderers/iso-actors.js` | the one-line fix of section 6 (its own commit) |
| `ui.html`, `sw.js` | version 1.7.1, one line of What's new ("A player's hair no longer changes colour as he moves."), cache name |
| `tools/reference/frames-1.7.1.json`, `player-pictures-1.7.1.json` | the picture references, recorded again |
| `legacy/release-1.7.0/` | the files served as 1.7.0, for rollback and for the save tests |
| `README.md`, `ART-PIPELINE.md`, `PHASE-4-HANDOVER.md`, `ROLLBACK.md`, this file | documents |
| `index.html`, `soccer-manager-91.html` | the built game |

Not touched: `engine.js`, the save format, the management screens, every other file under `src/matchday/`, the stadium art, the older art styles.

## 10. Rollback

Before any release, 1.7.0 is what is live and `legacy/release-1.7.0/` holds its exact files; `ROLLBACK.md` has the steps. The six sheets as they were are in `main`'s history. Saves are format 4 in both versions and were played across the update in both directions (section 7).

## 11. What I need from you

1. **Your eye on the pictures and the preview:** is the hair right?
2. **Section 6:** keep the one-line fix in 1.7.1, or take it out? If kept, a second line of What's new or not?
3. **Section 5:** agree to leave the paintings as they are for now, or tell me which of the three you want looked at.
4. Then, and only on your word: merge to `main` and deploy as 1.7.1.

Still open from 1.7.0 and not touched by this work: your checks on the live site and the Galaxy measurement, the tag `v1.7.0` (yours to create, and it should be made before 1.7.1 goes up), and where the nine art archives are kept.
