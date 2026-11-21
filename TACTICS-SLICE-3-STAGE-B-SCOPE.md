# Tactics milestone, slice 3, Stage B: scope for approval

**John's decision, 21 November 2026: go ahead as proposed, with the shift at 4.7 m each way and all three parts.** The report on Stage B as built is `TACTICS-SLICE-3-STAGE-B.md`. What follows is the scope as he read it.

**For John's go-ahead, 21 November 2026.** Nothing in the game has been changed. I measured where the side without the ball stands today, tried the change in a scratch copy outside the repository, and ran the audits on that copy. This is what I propose to build, with the numbers from the trial.

## 1. In short

* **Today the defence stands in the same place whatever its pressing.** With the ball in the middle third, the back line is 20 m from its own goal line for a Low, Normal and High press alike (20.1, 20.4, 20.6 m).
* **Stage B moves two things for the side without the ball:** how high its lines stand, and how readily its nearest man goes to the man on the ball.
* **The trial went cleanly.** Every matchday suite passes on the trial copy as the game plays (the stopwatch aside, which cannot be trusted while other tests share the machine; timed alone it is level with Stage A). The phone camera figures are the same as Stage A's. Nothing objected that does not already object in Stage A.
* **The timeline is not touched.** So everything Stage A settled stays exactly as you approved it: goals, cards, results, the kind of every goal, passing, shooting, where the ball is won, possession.
* **A side on Normal pressing is drawn exactly as in Stage A**, player for player.

## 2. What I measured today

60 matches as the game plays them, 641,000 moments of open play (`node tools/shape-style.js`, which only measures). The side without the ball, with the ball in the middle third of the pitch:

| Its pressing | Back line, from its own goal line | Midfield | An opponent within 3 m of the man on the ball |
|---|---|---|---|
| Low | 20.1 m | 44.5 m | 49.7% of the time |
| Normal | 20.4 m | 45.5 m | 48.8% |
| High | 20.6 m | 45.7 m | 50.5% |

No difference. Stage A changed where the ball is won, but the eye still sees the same shape.

## 3. What I propose

All of it is for the side **without** the ball, and all of it is three numbers in the same table as Stage A's.

1. **The lines.** A High press holds its defenders, midfielders and forwards about 4.7 m further up the pitch. A Low press holds them about 4.7 m deeper. The shift comes in over the two and a half seconds a side already takes to change from attacking shape to defending shape, so nobody lurches. It fades to nothing as the ball comes within about 20 m of the side's own goal, where every side is deep anyway.
2. **Closing down, High press.** The nearest man goes to the man on the ball at a run from 5 m out. Today he only jogs once he is inside 14 m.
3. **Standing off, Low press.** Nobody chases the man on the ball in the far 38% of the pitch (roughly the other side's defensive third and a little more). The side keeps its shape and waits.

**In the trial, with the ball in the middle third:**

| Its pressing | Back line | Midfield | An opponent within 3 m of the man on the ball |
|---|---|---|---|
| Low | 17.2 m | 42.0 m | 48.1% |
| Normal | 20.4 m (unchanged) | 45.5 m (unchanged) | 48.8% (unchanged) |
| High | 24.2 m | 48.5 m | 58.2% |

So a High press stands 7 m higher than a Low press at the back and puts a man on the ball ten points more often.

**Proposed objectives** (as minimums, like Stage A's, and not to be exceeded far without asking you):

* Back line: High at least 5 m higher than Low. Midfield: at least 5 m.
* Pressure on the ball: High at least 8 points more often than Low.
* Normal: identical to Stage A.

## 4. What does not change

* The engine, results, goals, scorers, cards, timings.
* The timeline: every pass, shot, tackle and goal is the same event at the same second as in Stage A.
* The side with the ball, the goalkeepers, set pieces, the referee.
* A match with Normal pressing on both sides. A match with the default plan on both sides (still identical to 1.7.1).
* The camera code.

## 5. Risks, and what the trial showed

| Risk | What the trial showed |
|---|---|
| **Ball contacts.** A defender who stands somewhere new still has to be at the ball for his tackle or interception. | No change. Passes received more than a metre from the ball: 32 in 54,800, against 31 in Stage A. The contact audit passes as the game plays and with High against Low both ways round. |
| **Movement.** Twenty players' targets move. | The movement audit (gliding, frozen legs, treadmill) passes as the game plays and with High against Low. The acceleration limit was not exceeded on the samples run. |
| **The phone camera.** A deeper defence could leave the stage empty more often. | No change on six samples. Empty pitch on the 360 px phone: High 0.81 frames in a thousand (Stage A 0.94), Low 1.15 (Stage A 1.17). Both posts in view: High 95.0% (94.7%), Low 95.4% (95.4%). |
| **It looks offside.** A higher line with attackers beyond it. | An attacker beyond the last defender in 0.5 to 0.8% of moments, the same as today. The pictures have no offside law; this is only how it looks. |
| **Speed.** | The scene builds in the same time: about 300 ms on average, the slowest 356 ms, for Stage A and the trial alike (limit 400). The phone stand-in has not been run on the trial. |
| **A high line leaves visible space behind it**, and the pictures do not punish it (the engine already did, in the result). | Inherent. This is the part only your eye can judge. |
| **Fixed samples object again.** | Three did under forced pressing in the trial. All three also object in Stage A under the same forced pressing: two are the old blemishes now on the backlog (a corner not taken before half-time, a woodwork strike with no rebound), and the third is the count of player pictures ready at a cut, which Stage A already reported as a little worse. |

## 6. Acceptance tests

1. **Identity.** With Normal pressing on both sides, every player's position at every sampled moment is identical to Stage A's. With the default plan on both sides, and with `?rules=1.7`, the reference frames are identical to 1.7.1 pixel for pixel.
2. **The timeline is Stage A's**, event for event, for every match. So every Stage A measurement is unchanged, and `test-style.js` passes untouched.
3. **The objectives in section 3**, measured by `tools/shape-style.js`, as a permanent test.
4. **It looks offside no more often than today.**
5. **Ball contacts and movement:** every matchday suite as the game plays, and again with High against Low both ways round, High against High, and Low against Low. Each objection examined as before.
6. **Speed:** scene build under 400 ms; the phone stand-in inside its limit and level with Stage A.
7. **Camera:** High and Low on six samples, both phones, no worse than Stage A's figures. If worse, I stop and bring you the findings before changing anything.
8. **The full regression** as at Stage A: all suites, frames, screens, layout, keyboard, saves both ways, soak, hair, balance bench, engine file untouched.
9. **The same preview** ("Preview: compare two styles"), a short report, and a stop for your eyes.

## 7. What I need from you

1. **Go ahead as proposed?**
2. **The size of the shift.** I propose 4.7 m each way, as trialled. Subtler (3 m) or bolder (6 m) is one number. Bolder has not been trialled.
3. **All three parts, or the lines only?** I recommend all three: the lines alone show a shape, and the closing down is what reads as pressing.

After Stage B, on your word only: the 1.8.0 release candidate.
