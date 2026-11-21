# Tactics milestone, slice 3, Stage B: checkpoint

21 November 2026. Branch `milestone-1-tactics`, build `1.8.0-dev4`. Live site untouched (1.7.0). Nothing merged, nothing deployed.

## The outcome

**Stage B is built as you approved it, tested, and stops here for your eyes.** The side without the ball now stands differently by its pressing: a High press holds its lines 4.7 m further up and closes the man on the ball down at a run; a Low press holds them 4.7 m deeper and does not chase in the far part of the pitch.

* **All three objectives are met**, by the margins the trial showed (section 2).
* **Nothing else moved.** Against a fingerprint taken from the Stage A code: with Normal pressing on both sides, and with the default plan on both sides, the timeline and every player's position are identical. Where a side presses High or Low, not one event of the match has moved: only where the players stand.
* **So everything you approved in Stage A is exactly as it was:** goals, cards, results, the kind of every goal, passing, shooting, where the ball is won, possession.
* **The phone camera is no worse** than at Stage A for a High press, a Low press, or one against the other (section 4).
* **Nothing new objected.** Every check that objected under forced pressing objects in the same way on the Stage A code, with two exceptions that I looked into and that are not faults (section 5).

**What I need from you:** watch it in the preview and tell me whether a High press now looks like one, and a Low press like one. Then, on your word, the 1.8.0 release candidate.

## 1. How to look at it

The same as before: open the preview file, start any game, and on Home press **"Preview: compare two styles"**. The clearest pair is **High press against Low press** with everything else left alone, then swap them. Watch the side without the ball:

* **High press:** the back four stand nearer halfway, the midfield is up against the ball, and the nearest man runs at whoever has it.
* **Low press:** the whole side sits deeper, and when the other side has the ball in its own third nobody goes after it.

## 2. What now shows

60 matches as the game plays them, 641,000 moments of open play (`node tools/shape-style.js`). The side without the ball, with the ball in the middle third:

| Its pressing | Back line, from its own goal line | Midfield | An opponent within 3 m of the man on the ball (all of the pitch) |
|---|---|---|---|
| Low | 17.2 m (was 20.1) | 42.0 m (was 44.5) | 45.1% (was 49.3%) |
| Normal | 20.4 m (unchanged) | 45.5 m (unchanged) | 48.5% (unchanged) |
| High | 24.2 m (was 20.6) | 48.5 m (was 45.7) | 57.5% (was 50.1%) |

| Objective | Agreed | Measured |
|---|---|---|
| Back line, High over Low | at least 5 m | **7.0 m** |
| Midfield, High over Low | at least 5 m | **6.5 m** |
| Pressure on the ball, High over Low | at least 8 points | **12.4 points** |
| Normal | identical to Stage A | **identical, position for position** |

Two more things you can see:

* **A Low press standing off.** With the ball in the far third, a Low-pressing side has a man within 3 m of it 21% of the time, against 47% for Normal.
* **It looks offside no more often than before.** An attacker is beyond the last defender in 0.8%, 0.5% and 0.5% of moments (Low, Normal, High); before, 0.9%, 0.5% and 0.5%.

## 3. What did not change, and how I know

Before changing anything I recorded a fingerprint of 36 matches from the Stage A code: every event of each timeline, and where every player stands once a second. Stage B is checked against it by a permanent test (`test-shape.js`):

| Matches | Result |
|---|---|
| 12 with different passing and shooting but Normal pressing on both sides | identical: the timeline and every position |
| 6 with the default plan on both sides (the 1.7.1 pictures) | identical: the timeline and every position |
| 12 as the game plays, 2 of which have Normal pressing on both sides | those 2 identical; the other 10 have the same timeline, event for event, with the players standing differently |
| 6 forced to High against Low | the same timeline, event for event, with the players standing differently |
| All 36 again with Stage B switched off | identical to Stage A: the timeline and every position |

The engine file, the timeline builder's behaviour and the camera code are untouched. Stage B is a few lines in `behaviour.js`, one added argument in `schema.js`, and five numbers in the `STYLE` table.

## 4. The phone camera

Six samples of twelve matches, both sides on the setting, on the 360 px phone. "Stage A" is the Stage A code on the same matches.

| Both sides | Empty pitch, frames in a thousand | Both posts in view when the shot arrives |
|---|---|---|
| High press | 0.81 (Stage A 0.94) | 95.0% (Stage A 94.7%) |
| Low press | 1.15 (Stage A 1.17) | 95.4% (Stage A 95.4%) |
| High against Low | 1.04 (Stage A 1.16) | 94.8% (Stage A 94.8%) |

No worse on any figure. On the 390 px phone it is the same story (empty pitch 0.41, 0.67 and 0.62; posts 96.9%, 97.0% and 97.0%). The ball is in view in 100.0% of frames on both phones. Your decision of this morning stands: the camera is left as it is for now.

## 5. Ball contacts, movement and speed

All 25 suites pass as the game plays. The 13 matchday suites were then run four more times with every match forced to High against Low, Low against High, High against High, and Low against Low.

**What held in all four:** the contact audit, the movement audit (no gliding, frozen legs or treadmill in 5.6 million frames a run), restarts, dead balls, extra time and shoot-outs, playback, the isometric view, the paint-ahead test, and the match tests.

**A closer look at contacts**, on 60 matches, counting passes received more than a metre from the ball, Stage B beside the Stage A code on the same matches:

| | Stage B | Stage A code |
|---|---|---|
| As the game plays | 32 in 54,800 | 31 |
| High against Low | 42 in 56,200 | 41 |
| High against High | 37 in 51,200 | 37 |
| Low against Low | 41 in 61,000 | 41 |

The same. Passes, clearances and tackles drawn away from the ball are also the same in every row (none, or one or two in several thousand).

**What objected under forced pressing.** I ran every one of these on the Stage A code under the same forced pressing:

| Objection | Where | On the Stage A code |
|---|---|---|
| A corner not followed to its outcome | High against Low | The same. It is the corner given seconds before half-time and never taken (backlog item A). |
| A woodwork strike with no rebound, and a shooter who does not react to one | Low against High, Low against Low | The same (backlog item C). |
| A burst of acceleration of 13.3 m/s2, limit 13.0 | High against High | The same, to the decimal, in the same match. |
| Fewer player pictures ready at a cut than the test wants | High against Low, Low against High | The same. |
| The same, Low against Low | Low against Low | **Passes on the Stage A code.** See below. |
| "The picture after a paused tap is complete" | Low against Low | **Passes on the Stage A code.** See below. |

The two that are new:

* **Pictures ready at a cut.** On the suite's one match under Low against Low, more pictures were still to be made after a cut than the test allows. Over eight matches, though, Stage B is no worse than the Stage A code and slightly better: 4.1 pictures a cut against 4.4 under Low against Low, 4.4 against 4.8 under High against Low, and 4.9 against 5.1 as the game plays. So it is that one sample, which Stage B happens to draw differently.
* **The paused picture.** The touch test tells a complete picture from a blank one by counting the colours at 120 points, and wants more than four. Under Low against Low its one paused moment shows a lone man on open grass, and the count is exactly four. The picture is complete; the test's rule of thumb is too coarse for that view. The test passes as the game plays, so I have left it alone.

**Speed.**

* **Building a match's pictures:** 320 ms on average as the game plays, against 318 ms for the Stage A code, timed together on the quiet machine. The slowest match took 370 ms (Stage A 363 ms). The limit is 400 ms.
* **The phone stand-in,** three runs on each build: the page's own work in a frame averages 5.0 ms on the Stage A build and 5.0 ms on this one, and frames slower than 30 a second are 0.2 to 0.3% on both. The limit is 1%.

## 6. Remaining limitations

* **A high line leaves visible space behind it**, and the pictures do not punish it. The engine already did, in the result. This is the part only your eye can judge.
* **The side with the ball does not change shape** for the other side's pressing. A team facing a High press does not, for instance, drop a midfielder to help.
* **Mentality still does not lean** in the pictures.
* Everything left "for now" at Stage A still stands (`MATCHDAY-BACKLOG.md`): the two near misses, the camera, the three old blemishes.

## 7. Decisions for you

1. **Does Stage B read as pressing?** More or less is one number each: the 4.7 m, the 5 m from which a High press runs, and the 38% of the pitch a Low press leaves alone.
2. **The 1.8.0 release candidate.** With your approval of Stage B the tactics milestone is complete: the hair fix and the three slices. The release candidate would be the preview button removed, the What's new entry for your approval, the full regression, saves, and your phone. Not started.

## 8. The evidence

All on the final build (`1.8.0-dev4`), 21 November 2026.

| Check | Result |
|---|---|
| All 25 test suites, as the game plays | all pass |
| `test-shape.js` (new, the 25th): the Stage A fingerprint, the standing rule, the agreed differences, the offside look | 15 checks pass (run again on its own after I corrected a slip in the test file itself; the game was not touched in between) |
| `test-style.js` (Stage A's tests, untouched) | 89 checks pass |
| The engine file | byte for byte the slice 2 file |
| Match pictures with `?rules=1.7` against 1.7.1 | all 198 reference frames identical pixel for pixel |
| Player pictures and ground tiles | identical pixel for pixel |
| Every screen with `?rules=1.7` against 1.7.1, phone and desktop | 344 stops, no differences |
| Layout at five screen sizes, keyboard, viewport | pass |
| Saves, both ways, against 1.7.1, 1.7.0 and 1.6.0 | all six pass; format stays 4 |
| Soak, hair audit, balance bench | pass; bench output identical to its reference |
| The forced-pressing sweep: 13 matchday suites four times | section 5 |
| The camera: six samples for High, Low, and High against Low, on Stage B and on the Stage A code | section 4 |

To run them again: `node test-shape.js` (two minutes); `node tools/shape-style.js` for the table in section 2; `node tools/scene-reference.js --check tools/reference/scene-stage-a.json` for the fingerprint.
