# Tactics milestone, slice 3, Stage A: checkpoint

20 November 2026. Branch `milestone-1-tactics`, build `1.8.0-dev3`. Live site untouched (1.7.0). Nothing merged, nothing deployed.

## The outcome

**Stage A is built, tested and stops here for your eyes.** The play between the official moments of a match now leans the way each side's plan points: a Direct side plays fewer, longer passes, a High press wins the ball further up the pitch, a side told to shoot on sight shoots from further out, and the time each side has the ball follows the possession the engine gave it.

**What you asked me to confirm:**

* **The default plan gives exactly the same matchday as before.** With the default plan on both sides, every event of every match is identical to the 1.7.1 pictures (376 matches, each built three ways: no plans on the record, the default plan on both sides, the lean switched off; all 1,128 identical). With `?rules=1.7` every reference frame is identical pixel for pixel. When your opponent has a style of his own, his style shows, as the proposal said.
* **Goals, scorers, timings, cards and results are unchanged.** The engine file is byte for byte the slice 2 file.
* **Every goal is the same goal it was.** Over 6,771 goals, each compared with the same match drawn with no lean: same second, same scorer, same kind of goal (corner, header, volley, rebound, through ball, solo run, long shot), same finish, same moves in the same order. Shoot on sight does not turn a header into a long shot. This is now a permanent test.
* **Seven of the nine agreed objectives are met. Two are missed by a little, and I have not pushed past them:** the gap in pass length between Direct and Short is 7.8 m against 8, and the gap in shots from outside the area is 19 points against 20. Section 2 has the table and section 6 the reasons.
* **The phone camera is no worse for Direct football.** I measured it first, as you asked, and again on the finished work. Section 4 has the table. I have not changed the camera and have not reduced any tactical difference on its account.

**What I need from you:** watch it (section 1), then tell me whether it reads as football, whether any of it should be more or less, and whether you want Stage B. I do nothing further until you say.

## 1. How to look at it

Open the preview file, start any game, and on Home press **"Preview: compare two styles"** (in the card marked "Development build", just above the News). Choose how each side plays, press **Watch the friendly**, and afterwards swap the two plans or change them and watch again.

* The friendly is your club against its next opponent, with both clubs' own players. It does not count: no result, injury, card or tired legs is kept, and nothing is saved. A test confirms the game in hand is exactly as it was afterwards.
* The preview appears only in development builds. The 1.8.0 release will not show it.
* Suggested pairs: Direct against Short (passing left at Normal press), High press against Low press, Shoot on sight against Work it in, and then the opposite corners: Direct, Low press, Shoot on sight against Short, High press, Work it in.
* In your own season, the computer clubs already play their own styles, so every match you watch now leans.

## 2. What now shows

Measured on 2,410 matches as the game plays them (computer managers' own plans), by `node tools/highlight-style.js`. "Today" is the same matches drawn with no lean.

| | Today | Agreed objective | Measured |
|---|---|---|---|
| **Passing** (Short / Mixed / Direct) | | | |
| Length of a pass | 19.8 m for all | Direct at least 8 m longer than Short | 16.9 / 19.8 / 24.7 m: **7.8 m** (missed by 0.2) |
| Long balls of 30 m or more | 5.7% | at least 12 points more | 1.4 / 6.1 / 25.9%: **24.5 points** |
| Passes in a spell | 3.1 | at least 1.2 fewer | 3.70 / 3.00 / 2.35: **1.35 fewer** |
| Mixed stays as today | | within 1 m and 0.2 passes | 19.8 m and 3.0 passes: **yes** |
| **Pressing** (Low / Normal / High) | | | |
| Where the ball is won, from the side's own line | 40.1 m | High at least 8 m further up than Low | 35.6 / 39.1 / 44.6 m: **9.0 m** |
| Won in the other side's half | 30% | at least 15 points more | 22.0 / 29.2 / 41.0%: **19.0 points** |
| Passes the other side gets in a spell | 3.1 | at least 0.8 fewer | 3.37 / 2.98 / 2.54: **0.84 fewer** |
| **Shooting** (Work it in / Balanced / On sight) | | | |
| Shots from outside the area | 47.3% | On sight at least 20 points more than Work it in | 35.8 / 47.5 / 54.9%: **19.1 points** (missed by 0.9) |
| **Possession** | | | |
| Time on the ball against the engine's possession | no link (0.08) | moves with it (0.6 or better), within 4 points | **0.96**, within **2.0 points** on average |
| Time on the ball by passing style | | must not follow the number of passes | Short 49.8%, Mixed 50.3%, Direct 49.6% |

One figure to look at with your own eyes: a Direct side now plays a quarter of its passes as long balls (the proposal said "over 15%"). That is what gives Direct its length. If it looks like too much hoofing, it is one number to turn down.

## 3. Possession, measured the way you asked

Possession is now the time each side controls the ball, not its share of the passes. A side's spells last as long as its possession says, whatever its style makes of them: a Short side fits more passes into the same time, a Direct side fewer. So the line after the match ("Possession: 44%, 56%") matches what was watched, and short passing does not by itself read as more of the ball. Had I used the share of passes instead, it would have agreed with the engine only loosely (0.54) and been 6 points out on average.

## 4. The phone camera, measured first

I measured before settling the lean and again on the finished work: 72 matches for the default plan and for each of eight styles (both sides on the style), about a million frames each, on five screen sizes. The two figures below are the ones the phone camera has always sat near its limit on. The limits are the existing ones: an empty pitch in at most 1 frame in a thousand, and both posts in view at 95% of shots.

**The smallest phone (360 px wide), which is the hard case:**

| Both sides playing | Empty pitch, frames in a thousand | Both posts in view when the shot arrives |
|---|---|---|
| Default plan (today's pictures) | 1.05 | 96.7% |
| Direct | 0.82 | 95.4% |
| Short | 0.78 | 96.6% |
| High press | 0.94 | 94.7% |
| Low press | 1.17 | 95.4% |
| Shoot on sight | 0.62 | 96.5% |
| Work it in | 0.96 | 94.0% |
| Direct, Low, On sight against Short, High, Work it in | 0.70 | 93.6% |
| The same two plans the other way round | 0.49 | 95.1% |

**How I read it.**

* **Direct football does not make the phone camera worse.** It shows an empty pitch less often than today's pictures (0.82 against 1.05), on both phone sizes. The longer passes are accommodated, so the condition you set for stopping was not met and I carried on.
* **An empty pitch:** seven of the eight styles show one less often than the default plan. A Low press shows one slightly more often (1.17 against 1.05), which is well inside the spread between samples of the default plan itself (0.4 to 2.1).
* **Both posts in view:** this is where I cannot give you a clean "no worse". The default plan is at 96.7% and the styles are between 93.6% and 96.6%. The lowest are Work it in (94.0%) and one of the mixed pairs (93.6%), which is 10 to 13 shots more in about 365 where a post is cut off on the narrowest phone. The samples are too small to be sure it is real (the default plan itself misses the 95% line in two samples of six), but Work it in came out about 2.5 points lower in all three rounds of measurement, so I believe it is a small real effect: those shots are struck from closer in and arrive sooner, so the camera has less time to bring both posts in.
* **On the larger phone (390 px)** every style is above 95% for the posts (95.8 to 98.3% against 98.9%) and under 0.7 for an empty pitch (default 0.51).
* **The ball itself** is in view in 100.0% of frames on both phones for every style, and the striker and ball are in view at 100% of strikes.
* **Desktop** is unaffected: an empty pitch in under 0.05 frames in a thousand and the posts at 98.6% or better for every style.
* **A phone held sideways** remains the known open limit it was (posts about 84 to 87% for the default plan and every style alike).

**Your options on the camera.** (a) Leave it: the differences are at the edge of what can be measured, and I doubt the eye will find them. This is what I recommend until you have watched it. (b) Turn Work it in down a little, if on your phone you see a post cut off at shots more often than you like. (c) The separate camera work from the proposal (section 6 there), which would lift the default plan and every style together, as its own controlled piece with its own tests. I have done none of these.


## 5. Ball contacts, movement and speed

Every matchday suite was run as the game plays (section 9) and then again four more times with every match drawn to a forced pair of plans: the two opposite corners (Direct, Low press, On sight against Short, High press, Work it in, and the reverse), everyone Attacking, Direct, High press and On sight, and everyone Defensive, Short, Low press and Work it in. That is 13 suites four times over.

**What held in all four:**

* **Ball contacts.** About 40,000 contacts a run. Every kind of contact passes between 94% and 100% of the time (today: 93% to 100%).
* **Movement.** No gliding, no frozen legs and no treadmill in 5.6 million frames a run.
* **Restarts, dead balls, touch selection, extra time and shoot-outs, playback, the isometric view:** all pass.
* **Nothing official moves** in any of them: the validator that refuses a timeline whose goals or cards differ from the record never fired.

**A closer look at contacts**, on 60 matches, counting passes received more than a metre from the ball: 34 in 55,300 with no lean; 31 in 54,800 as the game plays; 77 in 50,500 with both sides forced Direct. So ordinary play is as clean as before, and when everybody hits long balls about one in 650 arrives a stride ahead of its man, against one in 1,600 today.

**What objected, and what each turned out to be.** Eight of the 52 runs had an objection besides the stopwatch (which cannot be trusted while other tests share the machine: see Speed below). I looked at every one:

| Objection | Where | What it is |
|---|---|---|
| A carrier drawn 6.5 m from the ball | everyone Attacking and Direct, one moment in one match | An old rarity: a man named to take a corner who has to cross the pitch to reach it. With no lean it happens too (in 128 matches: once, by 13 m). No more common with the lean. |
| The ball not at the kicker's feet before a kick | the same style, one kick | Old: one of six other samples objects the same way with no lean. |
| A burst of acceleration of 13.5 m/s2, limit 13.0 | the reverse corner, one player, one moment | **Slightly worse with the lean.** With no lean the sharpest burst on three samples was 12.3 to 13.0. With the lean, on nine samples, it was 11.3 to 14.2, and four were over the line by 0.3 to 1.2. One player, one quarter of a second, about a tenth sharper than the limit. |
| One highlights programme made only of routine incidents | everyone Defensive and Work it in, one match in 60 | Old: one in 240 with no lean, and the same as the game plays. |
| One frame painting four ground tiles, limit three | one corner, desktop size only | One frame in 2,334. The same match with no lean paints three in its worst frame, and with everyone Direct only one. The phone size is clean in every run. |
| Fewer player pictures ready at a cut than the test wants | three of the four styles | **Slightly worse with the lean.** Over eight matches, the pictures still to be made in the first frames after a cut were 4.3 a cut with no lean, 5.1 as the game plays, and 5.1 and 5.6 under the two corners. About one more picture a cut. The suite's own match passes as the game plays. |

So two things are measurably a little worse, both small: the sharpest burst of acceleration, and about one more player picture to make at a cut. Everything else that objected is something the pictures have always done once in a long while, which these fixed samples had not happened to hold.

**Speed.**

* **Building a match's pictures** (once, before kick-off): 276 ms on average with no lean and 284 ms as the game plays, on this machine with nothing else running. The slowest match took 321 ms before and 347 ms now; under the four forced pairs the slowest was 371 ms. The limit is 400 ms. (The play between the official moments is now worked out twice when a side has a plan, once as before to record each goal and once leaning: 7 ms becomes 15 ms.)
* **Events in a match:** 1,057 with no lean, 1,060 as the game plays. The extremes are 956 (everyone Direct, High press, On sight) and 1,165 (everyone Short, Low press, Work it in), which is 10% either way. The limits were 10% on average and 20% for any one style.
* **The phone stand-in** (a minute of play with the processor slowed six times, which lands on the figures your phone gave on 17 November), five runs on each build: the page's own work in a frame averages 5.2 ms on 1.7.1 and 5.3 ms on this build, and frames slower than 30 a second are 0.2 to 0.3% on both. The limit is 1%. The difference between the builds is smaller than the difference between two runs of the same build.



## 6. Where this differs from the proposal, and why

1. **"Goals from outside the area" is withdrawn as a target.** The proposal had On sight scoring more of its goals from range. You asked that every goal stay the goal it was, so goals are not leaned at all. The share of goals from outside the area is the same for every shooting setting (27 to 29%).
2. **Pass length: 7.8 m against 8.** A Short side's pass cannot be drawn shorter than about 17 m without moving team-mates closer to the man on the ball. Where players stand is Stage B, which you deferred. Making Direct longer instead would mean more long balls, already a quarter of its passes.
3. **Shots from outside: 19 points against 20.** An earlier build measured 25, but part of that was a fault the tests caught: a side shooting on sight from close in was drawn shooting from 23 m, so the ball jumped back. A shot from range is now struck from where the ball is. Reaching 20 honestly would need shots from 35 m and more, which I do not think you want.
4. **Passes are never hurried.** A leaned pass is never played sooner after the last one than it is today (four seconds), because the next man needs that long to get to where the ball is going. With a shorter gap, passes received a stride away from the ball were three times as common. A spell short of time plays fewer passes, not quicker ones.
5. **Before a goal, the scoring side keeps the ball.** A goal's build-up has to begin on the second it always began, so that the goal is drawn exactly as before. The leaning play before it can finish some seconds early, and the scoring side now plays a pass or two among themselves in that time instead of standing on the ball.
6. **Four test assumptions were corrected.** Because almost every match is now drawn differently, four fixed samples held things they had not held before. Each is in the 1.7.1 pictures too, and I measured how often: a corner awarded in the last seconds of a half is not always taken (1 corner in 400); a goal kick placed just before a booking can be lost before it is taken (1 match in 2,000); a shot against the woodwork with no time left has no rebound drawn (1 strike in 10,000); and the touch test did not count a figure half off the stage as a neighbour. The tests now allow for each and hold it rare. I have not cured the three blemishes: curing them would change matches with the default plan, which this slice must leave exactly as they were. They can go on the backlog if you want them cured later.

## 7. Remaining limitations

* **Where players stand does not lean.** A High press wins the ball further up, but the defensive line stands where it always did. That is Stage B.
* **Goals do not lean,** by your instruction. A Direct side's goals are built up exactly as they were.
* **Mentality does not lean.** The number of chances already follows the goals, so an Attacking side is already drawn with more shots.
* **Two objectives are missed by a little** (7.8 m against 8; 19 points against 20), and two things are measurably a little worse (section 5): the sharpest burst of acceleration, and about one more player picture to make at a cut.
* **Work it in on the narrowest phone:** a post is cut off at a shot a little more often (section 4).
* **Forced Direct on both sides:** about one long ball in 650 arrives a stride ahead of its man (section 5).
* **Before a goal** the play is quiet for more than five seconds a little more often than today (14% of goals against 10%), and never for longer than today's longest.
* **The preview** picks each club's eleven and formation for you. It is a development aid and is not in the release.
* **Nobody has watched it yet.** Everything above is measurement. Whether it reads as football is yours to say.


## 8. Decisions for you

1. **Does Stage A read as football?** Anything to turn up or down is a number in one table (`STYLE` in `src/matchday/timeline.js`) and a re-run of the measurement. I will not go beyond the agreed objectives without your word.
2. **The two near misses** (7.8 m against 8; 19 points against 20). I recommend accepting both as they are.
3. **Stage B** (where the defence stands: a High press holding a higher line, a Low press sitting deeper). It is the part most like "pressing" to the eye and the riskiest, because it moves all twenty outfield players. Not started.
4. **The camera** (section 4).
5. **The three old blemishes** in point 6 of section 6: leave, or put on the backlog.

After that, on your word only: the 1.8.0 release candidate, with the What's new entry for your approval.

## 9. The evidence

All on the final build (`1.8.0-dev3`), 20 November 2026.

| Check | Result |
|---|---|
| All 24 test suites, as the game plays | all pass |
| `test-style.js` (new, the 24th): identity, the official record, every goal the same goal, the established actions still drawn, all 81 plans against three kinds of opponent, the agreed differences, possession by time, passes not hurried, cost | 89 checks pass |
| `test-tactics.js` (the engine against 1.7.1) and the balance bench | 14,933 checks pass; bench output identical to its reference |
| The engine file | byte for byte the slice 2 file |
| Match pictures with `?rules=1.7` against 1.7.1 | all 198 reference frames identical pixel for pixel |
| Player pictures and ground tiles | 61,248 and 1,717 identical pixel for pixel |
| Every screen with `?rules=1.7` against 1.7.1, phone and desktop | 344 stops, no differences; the saved games after the journeys identical |
| Layout at five screen sizes, with the new preview screen included | nothing wider than the screen, off it, cut short or too small (the audit caught the preview's two buttons overflowing a 360 px phone; they are now stacked) |
| Keyboard | every control reached, named, ringed and in view |
| Saves, both ways, against 1.7.1, 1.7.0 and 1.6.0 | all six pass; format stays 4 |
| Soak (long play), viewport and hair audits | pass |
| The preview friendly leaves the game in hand untouched | confirmed by test (the whole saved state compared before and after) |
| The style sweep: 13 matchday suites under four forced pairs of plans | section 5 |
| The camera: 72 matches for the default plan and each of eight styles | section 4 |

To run them again: `node test-style.js` (ten minutes); `node tools/highlight-style.js` for the table in section 2; `SM91_STYLE="0,1,-1,1/0,-1,1,-1" node -r ./tools/style-preload.js test-contact.js` for any suite under a forced pair of plans (home/away: mentality, passing, pressing, shooting, each -1, 0 or 1). The README lists the rest.

**Where the work is.** Everything is on `milestone-1-tactics`. The lean is the `STYLE` table and the lines marked `L?` in `src/matchday/timeline.js`. `legacy/matchday-1.7.1/` is the frozen builder the identity test compares against. `main` is untouched and 1.7.0 is still what is live.

