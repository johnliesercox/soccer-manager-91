# Soccer Manager '91: match-picture backlog

Opened 21 November 2026, at John's approval of Stage A of tactics slice 3. Things known about the match pictures that are **not being worked on**, kept here so that a later, deliberate piece of work can pick them up. Nothing here affects a result: the engine decides every score, scorer and card, and the pictures only illustrate them.

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

## 2. Left as they are for now, from Stage A (John, 21 November 2026)

These are decisions, not faults. They are here so that they are looked at again before 1.8.0 is called finished.

* **Two objectives missed by a little, accepted for now:** the pass of a Direct side is 7.8 m longer than a Short side's (objective 8), and a Shoot on sight side takes 19 points more of its shots from outside the area than a Work it in side (objective 20). Reasons in `TACTICS-SLICE-3-STAGE-A.md`, section 6.
* **The phone camera, left for now.** On the 360 px phone, both posts are in view at 94.0% of shots when both sides Work it in, against 96.7% for the default plan (limit 95%). The options were: leave, turn Work it in down a little, or the separate camera work of `TACTICS-SLICE-3-PROPOSAL.md`, section 7.
* **Two things measurably a little worse with the lean:** a player's sharpest burst of acceleration (up to 14.2 m/s2 on some samples against a limit of 13.0), and about one more player picture to make in the first frames after a cut (5.1 against 4.3).
