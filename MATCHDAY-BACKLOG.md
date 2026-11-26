# Soccer Manager '91: match-picture backlog

Opened 21 November 2026, at John's approval of Stage A of tactics slice 3. Things known about the match pictures that are **not being worked on**, kept here so that a later, deliberate piece of work can pick them up. Nothing here affects a result: the engine decides every score, scorer and card, and the pictures only illustrate them.

**John's decision, 26 November 2026, at his approval of Stage B and of the tactics milestone as complete:** everything on this list stays here. It goes out with 1.8.0 as it is, and is to be looked at again "as targeted improvements in a future maintenance milestone rather than reopening the matchday development now". He also asked that the approved pictures be kept as they are and not changed simply to improve a measured figure: the 4.7 m by which a pressing side's lines move, the 5 m from which a High press runs at the man on the ball, and the 38% of the pitch a Low press leaves alone all stay. No item here is authorised for work.

The artwork has its own list (`ARTWORK-BACKLOG.md`).

## 1. Three old blemishes in the play between the official moments

All three are in the 1.7.0 and 1.7.1 pictures. They came to light on 20 November 2026 when Stage A drew almost every match differently and fixed test samples held them for the first time. John's decision, 21 November: **backlog for now.** They were not cured in the tactics milestone because curing them changes matches played with the default plan, which that milestone had to leave exactly as they were. Whoever cures them must expect the identity test (`test-style.js`, part 1) and the 1.7.1 reference frames to need a new, agreed baseline.

| | What is seen | How often (measured with no lean) | Where it comes from |
|---|---|---|---|
| A | A corner is given in the last few seconds of a half and never taken: the whistle goes first, and the next thing the ball does is the kick-off. | 8 of 3,651 corners, about 1 in 450 | `src/matchday/timeline.js`: a spell may award a corner up to its own end, and the scheduler starts no further spell with under 8 seconds left in the half. |
| B | A goal kick is placed, and in the same second the keeper is drawn a few metres off his spot losing the ball. It happens when a booking is due a few seconds later. | 16 of 30,712 matches, about 1 in 1,900 | The scheduler's card branch: a spell begun from a held goal kick with 4 to 4.5 seconds in hand plays no pass, "dribbles" and is tackled. |
| C | A shot hits the post or bar and no rebound is drawn: the keeper simply has the ball. It happens when there is no time left for the rebound before the next official moment. | 1 of 10,045 woodwork strikes | `shoot()`: "no time for that and the keeper gathers it". |

How the tests treat them today: `test-restarts.js` (A), `test-highlights.js` (B and C) count each apart from its rule and hold it rare. Each file has a note at the place.

Two more rarities of the same kind turned up in the Stage A style sweep and are also old: a man named to take a corner who has to cross the pitch to reach it and is drawn metres from the ball when it is given (once in 128 matches with no lean, by 13 m), and the ball not quite at a kicker's feet before a kick (one sample of seven with no lean). Both are the same root: a man is judged able to reach a spot at a flat 7 metres a second (`reachable` in `timeline.js`), which he cannot always do as drawn.

## 2. Left as they are, from Stage A (John, 21 November 2026; confirmed for 1.8.0 on 26 November)

These are decisions, not faults. They were looked at again when 1.8.0 was prepared, and John confirmed on 26 November that they go out as they are.

* **Two objectives missed by a little, accepted for now:** the pass of a Direct side is 7.8 m longer than a Short side's (objective 8), and a Shoot on sight side takes 19 points more of its shots from outside the area than a Work it in side (objective 20). Reasons in `TACTICS-SLICE-3-STAGE-A.md`, section 6.
* **The phone camera, left for now.** On the 360 px phone, both posts are in view at 94.0% of shots when both sides Work it in, against 96.7% for the default plan (limit 95%). The options were: leave, turn Work it in down a little, or the separate camera work of `TACTICS-SLICE-3-PROPOSAL.md`, section 7.
* **Two things measurably a little worse with the lean:** a player's sharpest burst of acceleration (up to 14.2 m/s2 on some samples against a limit of 13.0), and about one more player picture to make in the first frames after a cut (5.1 against 4.3).

## 3. From Stage B (the side without the ball), left as they are (John, 26 November 2026)

What the pictures do not do. These are limits of what was built, not faults:

* **A high line leaves space behind it, and the pictures do not punish it.** The engine does, in the result. John watched it and approved it as it is.
* **The side with the ball does not change shape for the other side's pressing.** A team facing a High press does not, for instance, drop a midfielder to help.
* **Mentality does not lean in the pictures.** Passing, pressing and shooting do. Mentality acts in the result only.

What the fixed test samples object to when every match is forced to one pressing pair. The 25 suites pass as the game plays; these appear only when a suite's own sample matches are forced to High or Low pressing on both sides, which the game does not do. The last row is the exception: it is a check of the soak audit, and it can object as the game plays:

| Objection | Forced to | What it is |
|---|---|---|
| A corner not followed to its outcome | High against Low | Item A above. The same on the Stage A code. |
| A woodwork strike with no rebound, and a shooter who does not react to one | Low against High, Low against Low | Item C above. The same on the Stage A code. |
| A burst of acceleration of 13.3 m/s2 against a limit of 13.0 | High against High | The same on the Stage A code, in the same match. It is the acceleration item of section 2. |
| Fewer player pictures ready at a cut than the test wants | High against Low, Low against High, Low against Low | The same on the Stage A code for the first two. For Low against Low it is the suite's one sample match: over eight matches Stage B makes slightly fewer pictures after a cut than Stage A did (4.1 against 4.4). |
| "The picture after a paused tap is complete" | Low against Low | The test's rule of thumb, not the picture. It counts colours at 120 points and wants more than four; its one paused moment under Low against Low shows a lone man on open grass and the count is exactly four. The picture is complete. If the touch test is ever reworked, this rule wants a better measure. |
| "Painted art never arrives: the match is still shown" (the soak audit, not a suite) | As the game plays, once in five runs on the 1.8.0 candidate | The same rule of thumb. This check stops the painted art from loading on purpose, then counts colours at 192 points of the picture. One run looked at the darkest instant of the fade that follows a jump to the next highlight, when every point is black; the screenshot a moment later shows the match drawn. The check plays a different match each run. A better measure would look twice, or wait out a fade. |

The phone camera after Stage B is no worse than after Stage A on any figure (`TACTICS-SLICE-3-STAGE-B.md`, section 4), so the camera item of section 2 is unchanged: both posts are in view at 94.7 to 95.4% of shots under forced pressing on the 360 px phone, against a limit of 95%.

## 4. How a maintenance milestone would start

Any cure for an item in section 1 changes matches played with the default plan, so it changes the baseline the tactics milestone was held to. Before work starts, agree which items, and expect to record new baselines for: the identity test against the 1.7.1 pictures (`test-style.js`, part 1), the 198 reference frames (`tools/reference/frames-1.7.1.json`), and the fingerprint of the approved 1.8.0 pictures (`tools/reference/scene-1.8.0.json`, checked by `test-shape.js`). That last file was recorded from the 1.8.0 release candidate on 26 November 2026: 36 matches, every event and every player's position once a second. It is how later work shows it has left the approved football alone, or shows exactly what it moved.
