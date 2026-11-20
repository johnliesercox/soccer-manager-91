# Tactics, slice 3: the match pictures. Findings and proposal

**John's decision, 20 November 2026: Stage A approved, with conditions.** Possession is to be measured by the time each side controls the ball, not its share of the passes. Goals, scorers, timings, cards and results stay completely unchanged, and so does the kind of every goal and the established actions (headers, volleys, penalties, corners, rebounds, saves, clearances), with tests for it; so the "goals from outside the area" part of S4 is withdrawn. The targets below are the initial objectives and are not to be exceeded without asking him. The camera is option C2: measure before building, and stop with findings and options if the longer passes cannot be accommodated. Stage B is deferred until he has seen Stage A. A playable preview comparing opposing styles; no video. Stop after Stage A for his visual approval before Stage B, any camera change or the release candidate. The report on Stage A as built is `TACTICS-SLICE-3-STAGE-A.md`. What follows is the proposal as he read it.

**For John's approval, 20 November 2026.** Nothing in the match pictures has been changed. This is the measurement of what the highlights show today, what I propose to change, the risks, and the tests the work would have to pass. The camera limit is section 7, on its own.

## 1. In short

* **Today the pictures do not know the plans exist.** Measured over 3,615 matches (7,230 sides): a Short side and a Direct side are drawn with the same passes to the first decimal place, a High press and a Low press win the ball in the same place, and On sight and Work it in shoot from the same distance. Section 2 has the figures.
* **The pictures also draw every match as half the ball each**, whatever possession the engine gave.
* **I propose to lean the drawn football toward each side's plan in the one place it is made up: the illustrative play between the official moments.** Goals, scorers, minutes, cards and scores are not touched, and `engine.js` is not opened at all in this slice.
* **Two stages, with a stop between them.** Stage A is passing, shooting and where the ball is won, all inside the timeline builder (low risk). Stage B, only if you want more after seeing A, is where the defence stands when pressing high or low (higher risk, because it moves players).
* **The safety rule is the one slice 1 used.** With both sides on the default plan, or with the 1.7.1 rules, the pictures are identical to today's, frame for frame. So everything already proved about ball contacts, movement and performance stays proved for the default, and the new work is tested as an addition.
* **The main risk is the phone camera.** Long balls are the very thing its known limit is about. Section 6 says how that is kept from getting worse, and section 7 treats the camera itself separately.

## 2. What the highlights show today

Measured with a new tool, `tools/highlight-style.js`, which plays whole seasons through the engine, builds each match's pictures exactly as the game does, and measures each side's football as drawn, grouped by the plan that side played. It changes nothing.

**3,615 matches from three seasons, every side measured in normal time.**

| As drawn | Every side | Short | Mixed | Direct |
|---|---|---|---|---|
| Passes in a spell of possession | 3.1 | 3.1 | 3.1 | 3.1 |
| Length of a pass | 19.8 m | 19.8 m | 19.8 m | 19.8 m |
| Long balls (30 m or more) | 5.7% | 5.7% | 5.7% | 5.7% |

| As drawn | Low press | Normal | High press |
|---|---|---|---|
| Where the side wins the ball, from its own goal line | 40.1 m | 40.1 m | 40.0 m |
| Won in the other side's half | 30.6% | 30.5% | 30.1% |
| Passes the other side is allowed in a spell | 3.1 | 3.1 | 3.1 |

| As drawn | Work it in | Balanced | On sight |
|---|---|---|---|
| Shots from outside the penalty area | 47.3% | 47.3% | 47.3% |
| Distance of a shot | 18.2 m | 18.1 m | 18.1 m |
| Goals scored from outside the area | 28.9% | 28.4% | 28.0% |

| The ball | In the match engine | As drawn |
|---|---|---|
| Home side's share | 50.0% on average, varying by 8.3 points from match to match | 50.1% of the passes, varying by 0.9 |
| How far the two move together (1 is fully, 0 is not at all) | | 0.10 |

Two things do already follow the engine, because they follow the official record: the number of shots drawn goes up and down with the goals (an Attacking side is drawn with 8.8 shots a match, a Defensive one with 7.4), and every goal is finished by its official scorer at its official second.

**Why.** The play between the official moments is made up by one builder (`src/matchday/timeline.js`) from the match's own seed: spells of possession, each a few passes, ending in a turnover or a chance. Its choices (how many passes, how far forward each goes, how the spell ends, what kind of chance, how a goal is finished) are drawn from fixed tables. The match record now carries both plans and the possession (slice 1), but the builder never reads them.

## 3. What I propose to change

All of it is illustration. The builder would read each side's plan and the engine's possession from the match record, and lean its existing choices. No new kind of event, no new animation, no new art: the same passes, runs, tackles, interceptions, clearances, crosses, shots and saves as now, in different proportions.

**Stage A: in the timeline builder only.**

| Control | What changes in the drawing | Today | Short / Low / Work it in | Direct / High / On sight |
|---|---|---|---|---|
| Passing (the side with the ball) | Passes in a spell | 3.1 | about 4 | about 2.3 |
| | Length of a pass | 19.8 m | about 15 m | about 26 m |
| | Long balls of 30 m or more | 5.7% | under 3% | over 15% |
| | How a chance is reached | fixed mix | more cut-backs and passes threaded through | more balls played forward early and over the top of the midfield |
| Pressing (the side without the ball) | Where it wins the ball, from its own line | 40 m | about 35 m, more clearances | about 46 m, more tackles and interceptions |
| | Won in the other side's half | 30% | about 22% | about 40% |
| | Passes the other side gets in a spell | 3.1 | about half a pass more | about half a pass fewer |
| Shooting (the side with the ball) | Shots from outside the area | 47% | about 35% | about 60% |
| | Goals finished from outside the area | 28% | about 20% | about 38% |
| The ball (both sides) | Each side's share of the passes drawn | 50% each | follows the engine's possession, so the line "Possession 56%" after the match matches what was watched | |

The two sides' plans work on the same spell: a Short side against a High press has its longer spells cut back, which is the engine's own story (a high press hurts short passing). Mentality is left alone: the number of chances already follows the goals.

**Stage B, optional, after you have watched Stage A: where the defence stands.** Today one defender presses the man on the ball, one covers, and the lines hold their zones (`src/matchday/behaviour.js`). Stage B would have a High press hold its midfield and back line a few metres higher and close down sooner, and a Low press sit a few metres deeper. This is the part most like "pressing" to the eye, and also the riskiest, because it moves twenty players and so touches everything the movement audits measure. I recommend deciding it only after seeing Stage A on your phone.

**The size of the lean is a short table of numbers in one place**, like the `TACTICS` block in the engine, so "more" or "less" after you have watched it is a small change and a re-run of the measurement.

## 4. What does not change

* **The engine is the authority and is not touched.** `engine.js` is not edited in this slice. The balance bench must give the same output as at slices 1 and 2, and `test-tactics.js` must pass unchanged.
* **Every official moment.** Goals at their second by their scorer, cards, the score at every instant, extra time and penalties. The presentation's validator already refuses a timeline whose goals or cards differ from the record, and stays as it is.
* **The default plan.** With both sides on the default plan the timeline is identical to today's, event for event. With `?rules=1.7` every frame is identical to 1.7.1.
* **The animation library, the sprites, the pitch, the camera code (in Stage A), the sound, the screens.**
* **The line on the match screen** that says shots, passes, tackles and corners are illustration and not official.

## 5. Acceptance criteria

Measured by `tools/highlight-style.js` (S2 to S5), the existing suites and tools (S1, S6 to S9), on at least 3,000 matches.

| | Criterion | Today |
|---|---|---|
| S1 | **Identity.** Default plan on both sides: every event of every timeline identical to today's. `?rules=1.7`: all 198 reference frames pixel for pixel. | holds by definition |
| S2 | **Passing shows.** Direct against Short: a pass at least 8 m longer; long balls at least 12 points more; at least 1.2 fewer passes a spell. Mixed stays within 1 m and 0.2 passes of today. | 0.0 m, 0.0, 0.00 |
| S3 | **Pressing shows.** High against Low: the ball won at least 8 m further up; at least 15 points more of it in the other half; the other side at least 0.8 fewer passes a spell. | 0.1 m, 0.4, 0.01 |
| S4 | **Shooting shows.** On sight against Work it in: at least 20 points more shots from outside the area, and at least 12 points more goals from outside it. | 0.1, 0.9 |
| S5 | **The ball.** Each side's share of the passes drawn moves with the engine's possession: correlation at least 0.6, and within 4 points of it on average. | 0.10 |
| S6 | **Nothing official moves.** In every match the goals, scorers, seconds and cards in the pictures equal the record; the engine file is byte for byte the slice 2 file; the balance bench output is unchanged. | holds |
| S7 | **Ball contacts and movement no worse, for every style.** The contact audit (today: 39,119 contacts in 20 matches, every kind between 93% and 100% on every measure) and the movement audit (no gliding, frozen legs or treadmill in 5.6 million frames) pass on ordinary matches and again on a style sweep: matches with each setting forced on both sides, and the four corners (Short and High against Direct and Low, and so on). All the other matchday suites pass on both. | pass |
| S8 | **Performance no worse.** A scene still builds inside the suite's limit (400 ms on this machine), events in a match within 10% of today's on average and no style more than 20% above it, and the phone stand-in within its limits and within 5% of today's frame time. | 367 ms; 5.0 ms a frame |
| S9 | **The phone camera no worse for any style** than it is today for the default on the same matches: ball in view, an empty pitch, both posts at the arrival (section 7 has today's figures). If Direct football cannot meet this, I stop and bring you the choice in section 6 before going on. | see section 7 |
| S10 | **You watch it.** A preview with a way to pick both sides' plans for a watched match, so you can see Short against Direct, High against Low and On sight against Work it in on your phone and say whether it reads as football. | |

## 6. Risks

| Risk | How likely | What I would do about it |
|---|---|---|
| **Long balls and the phone camera.** The camera's known limit is "a loose ball rolling clear for a moment on a narrow stage". Direct football makes more of exactly that. | Likely to show | Measure S9 first, before anything else in the slice. Keep a long ball inside a length the phone stage follows today. If Direct still breaches the limit, the choice is yours: a smaller lean for Direct on narrow stages is not available (the pictures must not depend on the screen), so it is either a milder Direct for everyone, or the camera work of section 7. |
| **Ball contacts on longer passes.** A receiver has to be where the ball arrives, and the first touch has to meet it. | Possible | Passes are already aimed at where a team-mate actually stands; a long ball uses the same rule with a further team-mate. Long balls stay along the ground or low, because there is no animation for bringing a high ball down and the library is final. S7 runs the contact audit on every style. |
| **Fixed-sample tests object again**, as three did in slice 1, because almost every match's pictures change (94% of sides play something other than the default). | Certain for some | The same method as slice 1: for each objection, run the same check with default plans and on other seeds to tell a real fault from a sample that moved, and report each one. |
| **A quiet match stops being quiet**, or a spell runs out of time before an official moment. | Low | The number of chances stays a budget drawn from the official goals and cards. The builder already ends every spell in time for the next official moment; that code is not changed, only the choices inside a spell. |
| **Pressing does not read as pressing** from where the ball is won alone. | Possible | That is what Stage B is for, and why it is a separate decision after you have watched Stage A. |
| **The pictures are taken for the cause.** A manager sees a long ball lead to a goal and concludes Direct "made" it. | Inherent | The pictures stay an illustration of a result the engine has already decided, and the match screen goes on saying so. The lean only makes the illustration agree with the plan; it cannot make a plan look better than it was. |
| **Performance.** Short football draws more passes. | Low | S8. The number of events is held near today's by letting spells last longer in time as well as in passes, not by adding spells. |

## 7. The camera limit, separately

This is the limit recorded at slice 1, measured again on four different sets of twelve matches under the current rules. It is a property of the camera on narrow screens and has nothing to do with tactics, except that Direct football would lean on it (section 6).

| Stage | Limit in the test | Four samples |
|---|---|---|
| Phone 360 wide, upright | A frame with no player in view: at most 1 in 1,000 | 1.5, 1.3, under 1.0, 2.1 |
| | Both posts in view when a shot arrives: at least 95% | 96.6%, 94.6%, 98.4%, 96.6% |
| Phone 390 wide, upright | No player in view: at most 1 in 1,000 | under 1.0, under 1.0, under 1.0, 1.6 |
| | Both posts at the arrival: at least 95% | 94.9%, 94.6%, 98.4%, 98.3% |
| Phone on its side (already listed as open before 1.7.0) | No player in view | 2.4 to 5.9 in 1,000 |
| | Both posts at the arrival | 82% to 86% |
| Desktop | Both | 100%, and no empty frames to speak of |

So on an upright phone the camera sits right on its two limits: sometimes just inside, sometimes just outside, depending on the matches. The test passes on its fixed sample because the limits were set there.

Options, none of them part of the tactics work unless you say so:

* **C0. Leave it.** Record the true range (above) as the camera's known behaviour on phones, and judge slice 3 by "no worse than today" (S9).
* **C1. A small camera change for narrow stages, as its own piece of work with its own acceptance:** follow a loose ball by keeping the nearest player in frame, and frame the goal a moment earlier when a shot is struck. It would be measured on several samples, not one, and would have to leave desktop frames identical.
* **C2. Decide after Stage A,** when S9 has shown whether Direct football makes it matter.

I recommend C2.

## 8. How the work would go

1. S9 first: a throwaway measurement of Direct-style long balls against the phone camera, to know before building whether the lean has room. Report if it does not.
2. Stage A in the timeline builder, with the identity test (S1) written first.
3. The style sweep through every matchday suite (S7), performance (S8), the measurement (S2 to S5).
4. A preview where you can set both sides' plans for a watched match (S10), and a checkpoint report. Stop.
5. Then, on your word: Stage B or not, the camera or not, and the 1.8.0 release candidate (What's new, the hair fix and the three slices together, the full regression, saves, and your phone).

## 9. For you to decide

1. **Stage A as described: go ahead?**
2. **The possession share in the pictures (the last row of the table in section 3):** include it? I recommend yes; it is what makes the line after the match agree with what was watched.
3. **Stage B:** decide after watching Stage A (my recommendation), or include it now, or rule it out.
4. **The camera:** C0, C1 or C2.
5. **The targets in section 5.** They are my judgement of "clearly visible but still the same game". If you would rather the styles differ more, or less, say so now and I will set the table to that.
