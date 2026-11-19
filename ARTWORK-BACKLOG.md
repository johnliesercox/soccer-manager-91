# Soccer Manager '91: artwork-defect backlog

Opened 19 November 2026, at the close of Milestone 0 (the hair fix, 1.7.1). John's decision that day: **no repainting as part of 1.7.1**; keep the findings here so a later, targeted art pass can be decided on its merits. Nothing in this file is authorised work.

Everything here is a matter of the **painted player artwork** (Blender reference figures painted through Floyo, `ART-PIPELINE.md`). None of it is a colouring fault: the hair fix put the colours right and left the paintings as they were. All of it has been in the game since the painted art arrived in 1.6.0.

## How the list is kept

`node tools/hair-audit.js <site dir>` measures every one of the 5,568 player pictures as the game draws it and lists the cells where the painting differs from its hairstyle's norm. The list as it stood at 1.7.1 is recorded in `tools/reference/hair-shape-known.json` (690 cells over the three sizes). The audit fails if a cell that is not on the list ever joins them, so new art cannot add to these unnoticed. When a repaint cures some, run the audit with `--record` to write the shorter list, and say so in the commit.

The three sizes (24, 16 and 12 pixels a metre) are the same paintings made smaller, so a defect in a painting shows at all three. The counts below are for the close-up size unless they say otherwise; the smaller sizes trip the audit's thresholds a little differently, which is why the totals differ by size.

Names are the pipeline's: a painting ("grid") holds two frames of one pose in eight directions, sixteen cells, and is named by its frames counted from 0 (`run-1+run-2`), with `-h1` for the cropped hairstyle, `-h2` for the long one, `-gk` for the keepers and no suffix for the short style. Directions are on screen: SE, S and SW face the camera, NW, N and NE face away, E and W are side on.

"How often drawn" comes from the audit's 20 seeded matches at 1.7.1: 498,351 painted pictures drawn (the close and following cameras on a desktop screen; a phone's following camera uses the small size instead of the medium one).

| | Category | Cells listed (24 / 16 / 12) | Paintings touched | How often drawn | Size of the cure |
|---|---|---|---|---|---|
| A | Head facing the wrong way for the body | 182 / 180 / 190 | 74 of the 124 | 7.6% of pictures | large: most of the library |
| B | Hairstyle shape varying | 20 / 26 / 29 listed, plus the cropped style's change between standing and moving | 9 for the listed cells; the cropped style's moving frames (about 20 paintings) for the rest | under 0.1% for the listed cells | medium for the cropped style, small for the rest |
| C | Head partly missing or cut off | 24 / 24 / 24 | 8 | 0.02% of pictures, but nearly half of all parries | small |
| D | Goalkeepers have one hairstyle | not a defect of a cell: missing art | 62 new paintings | every match, though only a keeper sent off makes it visible | medium: new art, no repaint |

## A. Incorrect head-facing directions

**What it is.** The body faces one way and the head is painted the other way round: a figure facing the camera with the back of a head and no face, or a figure facing away with a face. The painter follows a depth map of the reference figure, and a depth map of a round head does not say which way it faces, so the painter guessed. `ART-PIPELINE.md` says the model keeps the heading from the depth map reliably; that holds for the body, not always for the head.

**Facing the camera, no face shown: 137 cells in 59 paintings** (155 and 181 at the smaller sizes). By direction: S 58, SW 46, SE 33. By sheet: short style 31, cropped 23, long 44, keepers 39. Nineteen of them are standing, walking or running. Some of the rest are honest (a head bowed in a dive or a knee-slide hides the face anyway).

Paintings, with the number of cells in each: `parry-0+parry-1` 6 in each of the four sheets; `celebrate-1+booked-0` 4, 3 (h1), 4 (h2), 3 (gk); `set-0+celebrate-0` 3 in each of the four; `dive-2` 3 in each of the four; `header-1+header-2` 3, 3 (h2), 3 (gk); `kick-3+shoot-0` 3, 1 (h1), 1 (h2), 2 (gk); `runcheer-2+runcheer-3` 2, 1 (h1), 3 (h2), 4 (gk); `runcheer-0+runcheer-1` 3 (h2), 1 (gk); `idle-0+walk-0` 1, 1 (h1), 3 (h2), 2 (gk); `walk-1+walk-2` 1 (h1), 3 (h2), 2 (gk); `walk-3+run-0` 2 (h2), 2 (gk); `shoot-3+receive-0` 1, 3 (h2), 1 (gk); `getup-0+getup-1` 2, 2 (h1), 2 (gk); `dive-1` 2 (h2); `volley-2+poke-0` 2 (gk); `run-5+kick-0` 1, 1 (h2), 1 (gk); `appeal-0` 1, 1 (h2); and one cell each in `point-0+header-0`, `run-1+run-2-h1`, `run-3+run-4-h2`, `kick-1+kick-2-gk`, `kneeslide-0+kneeslide-1-gk`, `shoot-1+shoot-2-h2`, `slide-0+slide-1-h1`, `whistle-0+card-0-h2`.

**Facing away, a face shown: 45 cells in 28 paintings** by the audit's cautious rule (a clear area of face skin with an eye mark); by eye there are more. By direction: NW 25, N 13, NE 7. It is mostly the cropped style: 31 of the 45, against 6 for the short style, none for the long and 8 for the keepers.

Paintings: `celebrate-1+booked-0-h1`, `run-5+kick-0-h1`, `walk-3+run-0-h1`, `whistle-0+card-0-h1` 3 each; `idle-0+walk-0-h1`, `kick-1+kick-2-h1`, `receive-1+block-0-h1`, `run-1+run-2-h1`, `shoot-1+shoot-2-h1`, `walk-1+walk-2-h1`, `parry-0+parry-1-gk`, `run-5+kick-0-gk`, `runcheer-2+runcheer-3-gk` 2 each; and one cell each in `celebrate-1+booked-0`, `run-5+kick-0`, `runcheer-0+runcheer-1`, `runcheer-2+runcheer-3`, `walk-3+run-0`, `whistle-0+card-0`, `kick-3+shoot-0-h1`, `point-0+header-0-h1`, `run-3+run-4-h1`, `runcheer-2+runcheer-3-h1`, `shoot-3+receive-0-h1`, `volley-0+volley-1-h1`, `volley-2+poke-0-h1`, `runcheer-0+runcheer-1-gk`, `volley-0+volley-1-gk`.

**How often drawn.** Front without a face: 17,858 pictures (3.6%). Back with a face: 20,199 (4.1%). At match size both are hard to see; enlarged they are plain. `sm91-1.7.1-hairstyle-shape-review.png` (sent to John on 19 November) outlines them.

**What a cure would take.** A repaint with a control that tells the painter where the face is: for example a second reference alongside the depth map (Blender's flat-colour render already marks the eyes and the hair), or a prompt per direction. It touches 74 of the 124 paintings, which is close to painting the players again, with the audits and re-rolls that took in Phase 3. A cheaper partial cure, repainting only the standing, walking and running paintings (the ones seen most), would be about a dozen paintings. Either needs the limb, contact and hair audits run again on the result.

## B. Hairstyle-shape inconsistencies

**What it is.** The same hairstyle drawn with visibly more or less hair from one pose to another.

**The cropped style changes between standing and moving.** It is a neat cap standing still and a fuller mop in the running, kicking and shooting frames. Measured at the close-up size, between standing, walking and running its hair area varies by 1.25 to 1.6 times depending on direction, against 1.1 to 1.5 for the other two styles; 86% of its cells are within a quarter of the norm for their direction, against 93% for the short style and 94% for the long. Before 1.7.1 its running frames were drawn black, which hid this. At match size it reads as hair moving. The three styles stay distinct all the same: in the same pose, frame and direction the long style has the most hair in 93% of cases and the cropped the least in 89%. This is a property of the cropped style's moving paintings as a set (about 20 of its 31), not of single cells, so it is not on the audit's list.

**Cells with far less or far more hair than the style's norm: 20** (19 less, 1 more; 26 and 29 at the smaller sizes), in 9 paintings: `whistle-0+card-0-h1` 6; `dive-0` 1, 2 (h1), 3 (h2), 3 (gk); `appeal-0` 2 (h1), 1 (gk); `kneeslide-0+kneeslide-1-h1` 1; `parry-0+parry-1` 1 (more). Mostly a head seen end on in a dive, where little hair shows whatever the style. Drawn 56 times in the 20 matches.

**A small leftover from the hair fix.** A few heads have a speck or two of the kit's second colour at the edge of the hair (a blue sheen in the painting that the converter took for shorts, not fully enclosed by hair, so the repair leaves it rather than guess). A handful of cells; visible only enlarged.

**What a cure would take.** For the cropped style: repaint its moving paintings with the standing head as a reference for the hair, about 20 paintings. For the 20 listed cells: nothing is really wrong in most; look again only if the dives are repainted for another reason.

## C. Partially missing or clipped heads

**What it is.** The head, and in the parry the outstretched arms, were cut off in the painting. The figure lying full length is longer than the cell of the reference grid it was rendered into, so the head fell outside before the painter ever saw it.

**24 cells at each size, in 8 paintings:** parry 1 and parry 2 (`parry-0+parry-1`), facing E and W, in all three hairstyles and for the keepers (16 cells); getting up 1 (`getup-0` in `getup-0+getup-1`), facing E and W, likewise (8 cells). The same poses in the other six directions are whole.

**How often drawn.** 113 pictures in the 20 matches (0.02% of all pictures), so it is on screen for about a second a match. But it is not rare among parries: of the 176 parries drawn, 77 faced E or W (W alone 59), and of the 123 getting-up pictures 67 did. So when a keeper parries, nearly half the time it is one of these. Of the four categories this is the one most worth curing for its size.

**What a cure would take.** Small. The dives and the slide were rendered into wide reference cells and the parry and getting-up grids were not, which is why only these lost their heads. Re-render those two grids per sheet with a wide cell in Blender, paint the 8 grids again, convert, and run the audits. The game's own cell already has room: the parry's is 110 pixels wide at the close-up size with the head due at 85 and the painting stopping at about 78; getting up 1 fits its 70-pixel cell with the head due at 63. `sm91-1.7.1-heads-cut-off.png` shows them.

## D. The goalkeeper hairstyle limitation

**What it is.** Outfield players are painted in three hairstyles (short, cropped, long). Goalkeepers are painted in one, the short style: their sheet has the 58 poses in 8 directions with one head of hair. This is missing art, not a faulty cell.

**What the player sees.**

* A goalkeeper whose look says cropped or long is drawn with short hair for the whole match. His hair colour and skin are his own. Nothing changes during the match, so there is nothing to notice. 21 of the 40 goalkeepers in the audit's matches are in this position.
* An outfield player who goes in goal changes hairstyle at that moment. When a goalkeeper is sent off, a defender takes his place from that second (`src/matchday/scene.js`), wears the keeper's colours and is drawn from the keepers' sheet (`src/matchday/renderers/iso-actors.js`, `src/matchday/iso-assets.js`). If his own style is cropped or long, his hair becomes the short style for the rest of the match; hair colour and skin stay his own. The audit shows this directly and reports any real case in its matches; none of its 20 had a goalkeeper sent off.

**What a cure would take.** New art, no repainting: the keepers' 31 paintings in each of the two other hairstyles, 62 paintings, 928 cells a size, through the same pipeline; then one line in `iso-assets.js` to look the hairstyle up for keepers as it does for outfield players. The audit's check of this limitation would then become a check that it is gone.

## If a repaint is ever decided

1. It needs John's approval of a scope first, as any milestone does, and Floyo only through his Personal Team.
2. The painted library is otherwise final. Repaint only the paintings named, and keep the rest byte for byte.
3. Every conversion now ends with the hair repair (`tools/iso_paint.py` runs `tools/hair_repair.py`), and `tools/hair-audit.js` must pass, with the known list recorded again and shorter, not longer.
4. The limb and ball-contact audits and the player-picture and frame references apply as for any change to the sheets.
5. The raw paintings and Blender references are in the nine art archives (`ART-PIPELINE-ARCHIVES.md`); where those are kept for good is still to be decided.
