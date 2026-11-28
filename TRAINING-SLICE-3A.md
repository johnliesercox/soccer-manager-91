# Training, slice 3a: position retraining, the rules and the balance

**Checkpoint for John, 27 November 2026.** Milestone 2 (training and player development), slice 3a, as you approved it on 27 November: the rules for learning a second position, and the measurements. There are no screens for it; that is slice 3b, which is not started. Your decisions are at the head of `TRAINING-SLICE-3-PROPOSAL.md`.

> **Reviewed by John on 27 November 2026 (evening). The overall Slice 3a approach is approved, with one adjustment to positional effectiveness, which is now made:**
>
> * **95% in a neighbouring position** (defender to midfielder, for example), **90% in a distant position** (defender to attacker), **100% in the natural position.** His reasons: 90% everywhere would make some retraining too weak, 95% everywhere gives slightly too much in the long-term 5-4-1 case, and the split is a sensible distinction between an adjacent role and a different area of the pitch.
>
> **Two accepted exceptions. They are exceptions; the original targets are not changed.**
>
> | Target as written | Measured at the approved value | John's decision |
> |---|---|---|
> | R3, continuous: never worth more than 1 league point a season | 5-4-1, best pick: 0.83 on average, **1.08 in its best single season** | Accepted. "I don't think we should reduce the benefits further simply to eliminate that small difference." |
> | R3, one retraining: no more than 0.5 of a league point a season | Ten-season average 0.29 at most; **best single season 0.61** in 5-4-1 | Accepted, "provided the longer-term average remains within the intended balance". |
>
> The bench holds both: at the approved value these two lines read ACCEPTED, not MET, and a result beyond the measured figures reads MISS again.
>
> **The principles he restated:** retraining must not become a dominant strategy, natural positions must retain an advantage, and no formation should become disproportionately powerful.
>
> **The rest of his decisions (his message arrived in two parts; the second on 28 November):**
>
> * **Changing an unfinished course: the rule as built is approved.** A change of target discards the unfinished work towards the previous position. A course that is only paused and later resumed with the same target keeps its progress. The Slice 3b screens must explain the difference clearly. If completed weeks are about to be lost, the game must show exactly how many and ask for confirmation first. The same applies when a completed secondary position is about to be replaced.
> * **Completing a course: the rule as built is approved.** The priority place becomes empty. He is not switched to extra coaching automatically. The completion appears in the club news, and the manager chooses what to do next, so that the game makes no training decision on his behalf.
> * **Final 3a check:** only the agreed positional adjustment, the benchmarks run again, and six confirmations (section 10). No other mechanic changed and no further restriction added.
> * **Slice 3b is the next step, but not yet started:** "please stop after the revised balance checkpoint before beginning Slice 3b, so I can formally approve the final values." His requirements for it are at the end of section 10.
> * **Production unchanged:** live 1.7.0 untouched, the candidate frozen at `6baa8d0`, development only on `milestone-2-training`, no merges into `main`, deployments or tags without his explicit approval.
>
> Section 10 is the revised balance checkpoint. Sections 1 to 9 are the report as he read it, when the game still used 95% for both.

**Status (28 November 2026).** Built and tested on the branch `milestone-2-training`, with the final values in the game: 95% neighbouring, 90% distant. **Nothing has gone to production.** The live site is 1.7.0, `main` has not moved, and the 1.8.0 candidate is still frozen at `6baa8d0`. **This stops at the revised balance checkpoint (section 10) for your formal approval of the final values. Slice 3b is not started.**

## 1. In short

* **The rules are built as you decided them,** and a game in which nobody is retrained is identical to the game before this slice, match for match and to the last detail of the saved game.
* **Retraining adds no skill, no potential, no value and no wage,** and a player's own position is always his best. All four are proved exactly, not estimated.
* **At 95% every target is met except one.** A manager who retrains continuously for ten seasons, plays 5-4-1 and picks his best eleven by hand each week gains 1.17 league points a season on average, and 1.47 in his best season. The limit we set was 1 point. In the other five formations the most it is ever worth is 0.9 of a point in a season.
* **At 90% every target is met,** but learning the next line becomes barely worth the priority place (in 4-4-2, 0.06 to 0.16 of a point a season).
* **The excess at 95% comes from far-line moves,** your defender-to-attacker case. A far-line course lifts a man from 70% to 95% of his skill, two and a half times what a next-line course gives. So I also measured a third option: **95% for the next line and 90% for the far line.** It leaves the common case as you preferred it and brings 5-4-1 down to 0.83 on average (1.08 in its best season).
* **It is not a dominant long-term strategy at any of the three values.** The worth is reached in the second or third season, once four to seven players have a second position, and does not grow after that however long the manager carries on.
* **Natural positions still matter, but less at 95% than at 90%.** A squad assembled with no regard to position and then fully retrained gives up 2.0 to 3.6 league points a season at 95%, against 5.9 to 8.5 today. At 90% it gives up 4.2 to 6.6.
* **No formation becomes the one to play; older players benefit and age exactly as before; computer clubs are untouched; values, wages, bids and squad strength do not move.** Section 4 takes your six questions in turn.
* **Three things for you to decide** are in section 8. The first is the value.

## 2. What is built

Everything is in the engine. Nothing on any screen can start a course yet, so the preview file plays exactly as slice 2 did.

| You decided | What is built |
|---|---|
| Every outfield move; goalkeepers excluded both ways | A defender can learn midfield or attack, a midfielder defence or attack, an attacker midfield or defence. A goalkeeper can learn nothing and nobody can learn goalkeeper. Whatever a saved game says, a goalkeeper is worth outfield what he always was and nobody is worth more in goal. |
| One learned position, and he keeps his own | His own position is worth 100% of his skill, the learned one 95%, any other what it was (85% the next line, 70% the far line). |
| The priority place does one job at a time | The priority player is either on extra coaching or learning a position. Choosing one ends the other. |
| He keeps ordinary improvement, loses the doubling; same fitness cost and eligibility | A learner's weekly chance of improving is exactly what it would be with nobody in the priority place, and so is everybody else's. He recovers one point of fitness less in a week, as a man on extra coaching does. Injured or under 70 fitness he is rested: no work, no cost. |
| 12 and 20 weeks, adjusted by coach, age and intensity; no luck | Every row of the table you approved, exactly, on Light, Normal and Hard (216 courses tested). No random number is drawn. |
| All or nothing | Until the last week of work is done he is worth exactly what he was. Then 95%, for good, with nothing to keep up. |
| A later position replaces the earlier one | The earlier learned position is still his while he learns the new one. It is replaced in the week the new course is finished, and the news says which was lost. The confirmation you asked for belongs to the screens (3b). |
| Work is kept if the course is paused and resumed | The work done stays with the player. It is kept when another man is given the place, when he is moved to extra coaching, when the place is emptied, and while he is injured or rested. |
| A clear rule for unfinished work when the target changes | **Proposed and built: changing the target abandons the unfinished work at once.** Nine weeks towards midfield do not count towards attack, and changing back does not bring them back. Decision 2 in section 8. |

Two small things I had to settle, both simple to change:

* **When a course finishes, the priority place is left empty** and the news says so ("can now play in midfield. His place with the coach is free."). The alternative is to move him to extra coaching without being asked. Decision 3.
* **The engine now holds the value of a learned position as two numbers,** one for the next line and one for the far line. Both are 95%. I did this so that the bench could measure the third option; it changes nothing in the game.

## 3. The measurements

### How it was measured

One manager's club in Division 2, 50 worlds of ten seasons in each of the six formations, Normal training and an Average coach. The manager buys and sells nobody, so the only thing that varies is what the priority place is used for. The tool is `tools/retraining-balance.js` and the full output is kept in `tools/reference/retraining-balance-slice-3a.txt`.

**The worth of retraining is measured directly.** In every week the eleven is picked twice from the same squad on the same day, once counting the learned positions and once ignoring them. The difference is what retraining is worth that week, with no luck in it. Effective skill turns into league points by the rule of thumb from the tactics milestone: one point of skill on every man is about 1.4 league points a season. The figures below are firm to about a tenth of a point.

**Two managers.** Each figure is given twice:

* **The game's pick:** the manager leaves selection to the game, which puts natural players first, as a computer club does.
* **The best pick:** the manager chooses his eleven by hand every week for the highest total, which the selection rules allow. He is free to leave a weak natural player out for a stronger man who has learned the position. This is the shrewdest use of retraining and it is worth about twice as much.

**The policies.** "One" is a single course at the start for the spare man who would help the shortest line most. "Continuous" is a course whenever the place is free, for ten seasons. "The ceiling" hands every outfield player a second position, free and at once; no amount of retraining can beat it.

### Continuous retraining for ten seasons

League points a season: the game's pick, then the best pick, then the best pick's best single season in brackets. The limit we set was that it should never be worth more than 1 point a season.

| Formation | 95% | 90% | 95% next line, 90% far line |
|---|---|---|---|
| 4-4-2 | 0.10 / 0.32 (0.41) | 0.06 / 0.16 (0.22) | 0.08 / 0.26 (0.31) |
| 4-3-3 | 0.08 / 0.25 (0.39) | 0.06 / 0.13 (0.20) | 0.07 / 0.22 (0.33) |
| 5-3-2 | 0.37 / 0.72 (0.85) | 0.25 / 0.42 (0.51) | 0.31 / 0.56 (0.70) |
| 3-5-2 | 0.25 / 0.53 (0.61) | 0.14 / 0.27 (0.32) | 0.24 / 0.52 (0.61) |
| 5-4-1 | 0.60 / **1.17 (1.47)** | 0.46 / 0.74 (0.96) | 0.47 / 0.83 (**1.08**) |
| 4-5-1 | 0.28 / 0.72 (0.90) | 0.14 / 0.34 (0.46) | 0.27 / 0.66 (0.85) |

The ceiling, on the ten-season average, for the best pick: 0.28 to 1.28 at 95%, 0.13 to 0.82 at 90%, 0.24 to 0.94 with the split.

**It does not keep growing.** In 5-4-1 at 95%, the best pick, season by season: 0.56, 1.32, 1.47, 1.46, 1.40, 1.19, 1.12, 1.05, 1.15, 0.99. Over the same seasons the squad goes from 2 second positions to 4, 7, 9 and finally nearly 14, which is every outfield player. The first few courses, for the spare men who cover the short line, are the ones that count. The rest add nothing, and the manager has given up extra coaching for the whole time.

### One retraining

The limit was half a league point a season. The ten-season average is under it everywhere, at all three values. The best single season is over it in 5-4-1 at all three values, which I count as a deviation (section 5).

| Formation | 95% | 90% | 95% next line, 90% far line |
|---|---|---|---|
| 4-4-2 | 0.02 / 0.06 (0.14) | 0.02 / 0.04 (0.09) | 0.02 / 0.04 (0.09) |
| 4-3-3 | 0.02 / 0.04 (0.09) | 0.01 / 0.01 (0.04) | 0.02 / 0.04 (0.09) |
| 5-3-2 | 0.11 / 0.17 (0.49) | 0.07 / 0.11 (0.30) | 0.08 / 0.13 (0.36) |
| 3-5-2 | 0.07 / 0.13 (0.32) | 0.03 / 0.06 (0.15) | 0.07 / 0.13 (0.32) |
| 5-4-1 | 0.26 / 0.40 (**0.85**) | 0.20 / 0.29 (**0.61**) | 0.20 / 0.29 (**0.61**) |
| 4-5-1 | 0.07 / 0.16 (0.40) | 0.03 / 0.08 (0.18) | 0.07 / 0.16 (0.40) |

### Far-line moves, your defender-to-attacker case

A far-line course is the valuable one, because the player starts from further back: 70% to 95% is 25 points of his skill, against 10 for the next line. Going from 95% to 90% therefore halves the worth of a next-line course (10 points to 5) and takes only a fifth off a far-line one (25 to 20).

Continuous retraining with far-line courses only, league points a season, the game's pick and the best pick:

| Formation | Far line at 95% | Far line at 90% |
|---|---|---|
| 4-4-2 | 0.08 / 0.26 | 0.06 / 0.15 |
| 4-3-3 | 0.06 / 0.15 | 0.04 / 0.08 |
| 5-3-2 | 0.38 / 0.65 | 0.27 / 0.46 |
| 3-5-2 | 0.03 / 0.07 | 0.02 / 0.04 |
| 5-4-1 | 0.68 / **1.23** | 0.54 / 0.89 |
| 4-5-1 | 0.12 / 0.37 | 0.10 / 0.22 |

In 5-4-1 and 5-3-2 almost the whole worth of retraining is spare attackers learning to defend. That is where the 95% figure goes over the limit, and it is why the split option brings it back without touching the other formations much.

## 4. Your six questions

### 1. 95% or 90%?

| | 95% | 90% | 95% next line, 90% far line |
|---|---|---|---|
| One retraining, ten-season average (limit 0.5) | met, 0.40 at most | met, 0.29 at most | met, 0.29 at most |
| Continuous, never over 1 point | **missed in 5-4-1:** 1.17 average, 1.47 best season | met: 0.74 average, 0.96 best season | 0.83 average; 1.08 in its best season |
| Next-line retraining worth the place? | yes: 0.5 to 0.7 in 3-5-2 and 4-5-1 | hardly: 0.3 | yes: as at 95% |
| What natural positions keep of their worth, in the extreme test | about 40% | about 75% | about 40% (the extreme test is all next-line moves) |

The tests support 95% in five formations of six and not in 5-4-1 for the shrewdest manager. My recommendation is in section 8.

### 2. Does repeated retraining make squad composition or natural positions less important?

Less important, yes; unimportant, no.

**An ordinary squad, retrained continuously.** Effective skill the eleven gives up to the position rule, a match:

| Formation | Nobody retrained | At 95% | At 90% | With the split |
|---|---|---|---|---|
| 4-4-2 | 2.1 | 1.1 | 1.4 | 1.2 |
| 4-3-3 | 1.9 | 1.0 | 1.4 | 1.1 |
| 5-3-2 | 4.7 | 2.2 | 3.5 | 2.8 |
| 3-5-2 | 4.1 | 2.1 | 3.6 | 2.1 |
| 5-4-1 | 7.2 | 2.9 | 4.3 | 4.0 |
| 4-5-1 | 5.1 | 2.5 | 3.7 | 2.7 |

At 95% a manager who keeps at it gets back about half of what the position rule costs him. At 90%, between an eighth and two fifths.

**The extreme case: a squad built with no regard to position.** I took each starting squad and called every outfield player a midfielder, then compared it with the same men arranged as a squad built for the formation.

| | League points a season given up |
|---|---|
| No regard to position, nothing learned (today) | 5.9 to 8.5 |
| No regard to position, every man retrained, at 95% | 2.0 to 3.6 |
| No regard to position, every man retrained, at 90% | 4.2 to 6.6 |

So at 95% building the squad properly is still worth two to three and a half points a season even against a manager who has retrained every man he needs, which takes him two to three seasons of the priority place. At 90% it is worth four to six and a half. This is the plainest measure of the difference between the two values.

### 3. Does any formation become disproportionately advantageous?

No. The formations that need five men in one line gain the most, because they are the ones the position rule hurts most today. Retraining narrows that handicap and does not turn it into an advantage: in the table above, 5-4-1 retrained at 95% still gives up more to the position rule (2.9) than 4-4-2 does with nobody retrained (2.1).

Counted directly, the six formations stand between 41.1 and 42.5 points a season with nobody retrained. Adding the most each can gain from continuous retraining at 95% puts them between 41.8 and 42.7, and the same formation (4-3-3) stands highest before and after. (The direct counts are good to about 0.4 of a point, so I rest this on the table above more than on these.)

### 4. Do older players benefit, without undermining the ageing system?

**They benefit.** A manager who only ever sends players of 28 or over on a course gets 0.04 to 0.22 of a point a season with the game's pick and 0.12 to 0.36 with the best pick at 95%: a third to a half of what retraining every age gives. He completes about one course a season. For these players it is the only thing the priority place can do, since extra coaching does nothing from 28.

**Ageing is untouched, and that is proved exactly.** The last week of a season and the summer were played twice from the same saved game, once with second positions written on 82 players: ageing, decline, retirement, contracts, values and wages came out identical to the last detail. In the bench, players of 28 or over with a second position changed by -2.52 points of skill in the summer, and players of the same ages without one by -2.47, over 13,735 summers. The average age of the eleven moves by a tenth of a year at most.

### 5. Does it change the balance between human and computer clubs?

Computer clubs never retrain anybody (proved: a season with a course written into a computer club is identical to the game before). So the manager gains on them exactly what section 3 shows: up to 0.4 of a point of effective skill a man with the game's pick and 0.8 with the best pick, in 5-4-1 at 95%; 0.1 to 0.2 in 4-4-2.

For scale, slice 1 measured the advantage a manager already has from training over a club that does none: 4.6 points of skill a man after ten seasons on ordinary settings. Retraining adds one or two percent to that in 4-4-2 and a little under a fifth at the very most.

One small thing flows the other way. A player the manager retrained keeps his second position if he moves on, and a computer club fields him at it. With continuous retraining, about three such players are at other clubs at any season's end.

### 6. Does it affect values, wages, transfers or long-term squad strength?

**Not directly, and that is exact:** no player's value or wage is changed by a second position or a course (350 players valued with and without, the same to the pound), and nothing in the transfer market reads it.

**Not measurably in the long run either.** Retraining continuously at 95% against nobody retrained, the same world against itself, all six formations (300 pairs of ten seasons):

| | Difference |
|---|---|
| Average skill of the squad | -0.08 (give or take 0.29) |
| Skill gained in training a season | -0.08 (give or take 0.17) |
| Squad value | +0.6% (give or take 1.6%) |
| Wage bill | +0.8% (give or take 1.7%) |
| Bids received a season | +0.01 (give or take 0.24) |
| Players leaving in the summer | -0.01 (give or take 0.04) |
| League points a season, counted directly | +0.1 (give or take 0.3) |

Every one is zero within its margin. The figures at 90% and with the split are the same in kind.

One indirect effect exists and is not new: a player who plays more matches can ask for a regular's wage at his next contract. That is the game's existing rule about appearances and it applies to a retrained player as to anyone.

## 5. Targets, and where the results differ from them

| | Target | Result at 95% |
|---|---|---|
| R1 | Identity with nobody retrained | **Met, exactly.** 12,050 matches over five two-season worlds identical to the game before this slice, with the whole saved game; and with nothing chosen at all, identical to 1.8.0. |
| R2 | Natural is best; never more than 95% | **Met, exactly.** All 80 combinations of position, learned position and place. |
| R3 | One retraining no more than 0.5 a season; continuous never more than 1 | **Partly.** See below. |
| R4 | No skill added or moved | **Met, exactly.** Every player's chance of improving, the learner's included, is what it is with nobody in the place, with and without a focus. |
| R5 | No money in it | **Met, exactly.** |
| R6 | The weeks are the weeks | **Met, exactly.** 216 courses, each the weeks it should be, and the count of weeks left right in every week. |
| R7 | Goalkeepers untouched | **Met, exactly.** |
| R8 | Computer clubs untouched | **Met, exactly.** |
| R9 | Saves, hot-seat and the switch | **Met.** Section 7. |
| | No formation becomes the one to play | **Met.** |
| | Ageing not softened | **Met, exactly.** |

**Deviations, all in R3:**

1. **Continuous retraining in 5-4-1 at 95% is over the limit** for a manager who picks his best eleven by hand: 1.17 points a season on average and over 1 point in eight of the ten seasons. With the game's own pick it is 0.60. It is under the limit in every other formation.
2. **One retraining is over 0.5 in its best single season in 5-4-1,** at all three values (0.85, 0.61, 0.61), though under it on the ten-season average. The proposal's wording ("a season") did not say which, so I report both.
3. **The proposal understated the worth.** It said "at most about half a league point a season". That was one retraining with the game's own pick, and the measured figure for that is 0.02 to 0.26. I had not then measured a manager who picks by hand, nor continuous retraining, and both are higher.
4. **I measured an option you did not ask for** (95% next line, 90% far line), because the results pointed to it. Nothing in the game uses it.

## 6. The tests you asked for

`test-retraining.js` is the 28th suite: 1,008 checks, no failures.

| You asked for | What the test does |
|---|---|
| Interrupted retraining | Six weeks done, the place given to another man for ten weeks, then resumed: six done, six to go, finished six weeks later. The same with the place emptied, and with the man moved to extra coaching and back. |
| Injuries | Five weeks done, three weeks injured (nothing added, nothing lost, still seven to go), then finished on the twelfth week of work: 15 weeks on the calendar. |
| Low fitness | Under 70 the weeks do not count and cost nothing; at 70 they count again. |
| Changes of intensity | Normal to Hard half way: six weeks left become five, and it finishes in eleven in all. Normal to Light: six become eight. A better or worse coach half way changes the weeks left in the same manner. |
| A change of target | Nine weeks towards midfield, then attack chosen: the nine are gone, attack starts at 20 weeks, and choosing midfield again starts from nothing. |
| Replacing a learned position | Attack stays his while he learns midfield, and is replaced in the week midfield is finished. |

Also held: all or nothing (19 of 20 weeks at exactly 70%, then 95%); the game's team picker fields a retrained man ahead of an equal man who has not learned the place; each hot-seat manager's course is his own; a new job starts with none; the same seed gives the same game; saves in format 4 open and play on in the 1.8.0 and 1.7.1 engines and come back with the second position and the course as they were; with the rules switched off, second positions written into a saved game are ignored.

## 7. Regression

Everything below was run on the build of this checkpoint (`index.html`, labelled 1.8.0-training3, md5 `a80bee2071f96dca4517c0f295ab8763`). "The candidate" is the frozen 1.8.0 release candidate. Fifty-four checks ran; fifty-three passed outright and the other is the comparison that is meant to show four differences.

| What has to be kept | Result |
|---|---|
| **Identical behaviour when retraining is unused** | 12,050 matches identical to the game before this slice, with the whole saved game. With nothing chosen at all, identical to 1.8.0. |
| **The screens are exactly slice 2's** | All 360 stops (180 on a phone, 180 on a desktop) identical to the slice 2 build: no differences. This slice draws nothing. |
| **The screens against the candidate, with the 1.8.0 rules switch** | 356 of 360 identical. The four that differ are the Help screen, and the only words changed are the sentence about age that you asked to be corrected in slice 1. |
| **Save compatibility and an unchanged format** | Format 4. In the browser: games from the candidate, 1.7.0 and 1.6.0 resume and play on in this build, and games from this build resume and play on in each (six runs, 21 or 22 checks each, no failures). A save with a second position and a course opens in the 1.8.0 and 1.7.1 engines, plays on, and comes back with both as they were. |
| **Hot-seat** | Each manager's course is on his own club; one manager cannot set a course for another's player; a hot-seat save keeps each course. The soak's hot-seat run passes. |
| **No change to the match engine, tactics, matchday artwork or official results** | `src/` is not touched. With the 1.7.1 rules switch: all 198 match frames, all 61,248 player pictures and all 1,717 ground tiles identical to the pixel. The approved football: all 36 matches identical in every event and every position. The tactics bench gives its recorded output line for line. |
| **No change to training as approved** | The training bench (200 worlds, ten seasons) gives, line for line, the output recorded at slice 1: all 104 lines. `test-training.js` and `test-training-ui.js` pass unchanged. |
| **Mobile and desktop usability** | Layout at five sizes: nothing wider than the screen, off it, cut short or too small. Keyboard: every control at every stop reached by Tab, named, ringed and in view (3,529 and 3,692 controls). The match screen's boxes are where they were at every size. The viewport audit passes (the one-off touch failure noted on the testing backlog did not recur). |

| Other checks | Result |
|---|---|
| The 28 test suites (27 as before and the new `test-retraining.js`) | All pass. No older test was changed. |
| Soak (memory, forced failures, offline, hot-seat, measuring screen) | 44 checks, all pass. |
| The hair audit and the converter's test | Both pass. |
| Speed: the phone stand-in | 58.6 frames a second, 0.3% of frames slow. |
| The style preview and the rules switches | Unreachable in this build and mentioned nowhere a player can see, as before. The two switches also turn retraining off. |

## 8. For you to decide

**1. The value of a learned position.** Three options, all measured:

* **95% for everything,** your stated preference. It is within every limit in five formations and over the ten-season limit in 5-4-1 for the shrewdest manager, by about a fifth of a point a season on average and half a point in his best season.
* **90% for everything.** Within every limit. Natural positions keep three quarters of their worth in the extreme test. But next-line retraining, the commonest kind, becomes too small to be worth choosing over extra coaching in most formations.
* **95% for the next line, 90% for the far line.** The common case stays as you preferred. The far-line jump, which is where the excess comes from, is trimmed. 5-4-1 comes down to 0.83 on average and 1.08 in its best season. It costs one more number on the screen ("can play in attack at 90%").

**I recommend the third.** It is the smallest change that deals with what the measurements found, and it answers the case you named: a defender who learns to attack is a bigger change than a defender who steps into midfield, and it is reasonable that he is a little less good at it. If you would rather keep one number, 95% is defensible: the excess is confined to one formation and one way of playing it, and it does not grow with time. I would not choose 90% for everything.

Whichever you choose, I will change only that number and bring you the bench again.

**2. Unfinished work when the target is changed.** Built: it is abandoned at once, and the screen in 3b would say how many weeks will be lost and ask for confirmation, as it will for a learned position that is to be replaced. The alternative is to keep the work towards each position separately, which is kinder and is one more thing to show and explain. I recommend the rule as built.

**3. When a course finishes.** Built: the priority place is left empty and the news says so. The alternative is to move the player to extra coaching automatically. I recommend the rule as built, because the game then does nothing the manager did not choose.

**Then, when you are ready: slice 3b, the screens.** Not started. From this slice it would need to show, besides what the proposal listed: the two confirmations (a learned position about to be replaced, and unfinished work about to be lost); and, on the team selection screen, where a man who has learned a position will play, since the best use of retraining is choosing him ahead of a weaker natural player.

## 9. The preview, and where things are

The file is `soccer-manager-91-1.8.0-training3.html`. **There is nothing new to see in it:** this slice has no screens, and no course can be started from the game. It is there so that you can confirm on your Galaxy that the game is as slice 2 left it.

* Branch `milestone-2-training`, development commits only. `main` is at `cde3c8f` (live 1.7.0). The 1.8.0 candidate is at `6baa8d0` on `milestone-1-tactics` and `release-1.8.0-rc1`, unmoved. No tag, no deployment, no merge.
* No work was done on the testing backlog or the matchday.
* New in the repository: `test-retraining.js`, `tools/retraining-balance.js`, `tools/reference/retraining-balance-slice-3a.txt`, `legacy/engine.training2.js` (the game before this slice, for the identity proof), and this report.

## 10. The revised balance checkpoint (28 November 2026)

**In short: the agreed adjustment is the only change, every benchmark has been run again on it, and all six things you asked me to confirm are confirmed. There is one small item to report under "differences", a test of mine that I corrected. This stops here for your formal approval of the final values. Slice 3b is not started.**

### The final values

| | Worth, as a share of his skill |
|---|---|
| His natural position | 100% |
| A learned neighbouring position (defender and midfielder, midfielder and attacker) | 95% |
| A learned distant position (defender and attacker) | 90% |
| A neighbouring position he has not learned | 85%, as today |
| A distant position he has not learned | 70%, as today |
| Weeks of work | 12 neighbouring, 20 distant, by coach, age and intensity, as approved |

The build is labelled `1.8.0-training3.1`. There are still no screens for retraining.

### Your six confirmations

| You asked me to confirm | Result |
|---|---|
| **The neighbouring and distant values are applied correctly** | **Confirmed.** All 80 combinations of natural position, learned position and place on the pitch are checked: a defender who has learned midfield is worth 95% there; a defender who has learned attack 90%; an attacker who has learned defence 90%; a midfielder who has learned defence or attack 95%; the natural position is always 100%; a place he has not learned is worth what it always was; goalkeepers are untouched both ways. A far-line course is also played through: 19 of its 20 weeks at exactly 70%, then 90%. |
| **The long-term balance is consistent with the figures reported** | **Confirmed, to the last digit.** The bench at the game's own value gives exactly the third column of section 3. The table is below. |
| **All existing retraining, training and tactics tests pass** | **Confirmed.** All 28 suites pass, among them `test-retraining.js` (1,009 checks), `test-training.js`, `test-training-ui.js` (89), `test-tactics.js` (14,933) and `test-tactics-ui.js` (80). The tactics bench and the training bench each give their recorded output line for line. |
| **The original game is identical when nobody has been retrained** | **Confirmed.** 12,050 matches over five two-season worlds identical to the game before this slice, with the whole saved game; with nothing chosen at all, identical to 1.8.0. Every screen (360 stops) is identical to slice 2. |
| **Skills, potential, wages, transfer values and ageing are unaffected** | **Confirmed, exactly.** No course changes a player's skill, potential, value or wage (216 courses). 350 players are valued the same to the pound with and without a second position. Every player's chance of improving is the same with a learner in the priority place as with nobody in it. A season's close played with 82 second positions written in is identical in ageing, decline, retirement, contracts, values and wages. |
| **Hot-seat and save compatibility are intact** | **Confirmed.** Each manager's course is his own and a hot-seat save keeps each. The format is still 4. Games from the candidate, 1.7.0 and 1.6.0 resume and play on in this build, and games from this build in each (six runs, no failures). A save with a second position and a course opens in the 1.8.0 and 1.7.1 engines, plays on, and comes back with both as they were. |

### The balance at the final values

League points a season: the game's pick, then the best pick, then the best pick's best single season in brackets. 50 worlds of ten seasons in each formation. The record is `tools/reference/retraining-balance-approved.txt`.

| Formation | One retraining | Continuous, ten seasons | The ceiling |
|---|---|---|---|
| 4-4-2 | 0.02 / 0.04 (0.09) | 0.08 / 0.26 (0.31) | 0.11 / 0.31 |
| 4-3-3 | 0.02 / 0.04 (0.09) | 0.07 / 0.22 (0.33) | 0.08 / 0.24 |
| 5-3-2 | 0.08 / 0.13 (0.36) | 0.31 / 0.56 (0.70) | 0.41 / 0.73 |
| 3-5-2 | 0.07 / 0.13 (0.32) | 0.24 / 0.52 (0.61) | 0.32 / 0.71 |
| 5-4-1 | 0.20 / 0.29 (**0.61**) | 0.47 / 0.83 (**1.08**) | 0.50 / 0.94 |
| 4-5-1 | 0.07 / 0.16 (0.40) | 0.27 / 0.66 (0.85) | 0.32 / 0.77 |

The two figures in bold are your accepted exceptions, and the bench reports them as accepted exceptions and not as met.

**Your three principles, at the final values:**

* **Not a dominant strategy.** The most it is worth in any formation is 0.83 of a point a season on the ten-season average. It is reached in the second or third season and does not grow after that. In 4-4-2, season by season for the best pick: 0.08, 0.23, 0.28, 0.29, 0.28, 0.31, 0.31, 0.27, 0.24, 0.27.
* **Natural positions retain an advantage.** A natural player is always worth 5% or 10% more than the same player in a learned position. A squad built with no regard to position and then fully retrained still gives up 2.0 to 3.6 league points a season against the same men built for the formation. An ordinary squad retrained continuously still gives up 1.1 to 4.0 points of effective skill a match to the position rule (2.1 to 7.2 with nobody retrained).
* **No formation disproportionately powerful.** The five-in-a-line formations gain most because the position rule costs them most today, and none overtakes: counted directly, the six formations span 1.3 league points with nobody retrained and 0.9 with continuous retraining, and the same formation stands highest before and after.

**The wider game, at the final values.** Continuous retraining against nobody retrained, the same world against itself, 300 pairs of ten seasons: average skill of the squad -0.14 (give or take 0.28); skill gained in training a season -0.03 (0.17); squad value +0.2% (1.5%); wage bill +0.3% (1.7%); bids received a season +0.06 (0.25); players leaving in the summer +0.01 (0.04); average age of the eleven -0.01 (0.07). Every one is zero within its margin. Older players: the summer's change for men of 28 or over is -2.52 with a second position and -2.47 for men of the same ages without, over 13,770 summers.

### Differences from the expected results

* **In the game and the balance: none.** Every figure at the final values is the figure reported for the split option in section 3.
* **One correction to a test of mine.** The check that the team picker prefers a retrained man "to an equal man" had not in fact made the two men equal, because a line of the test had been swallowed by a comment. It passed at 95% by a narrow margin and failed at 90%, which is how I found it. It is repaired and now tests what it says. The game was right throughout.
* **The bench's default changed.** It now measures the game's own value. The three-value comparison you decided on is kept as it was (`tools/reference/retraining-balance-slice-3a.txt`) and can be run again with `--as 0.95,0.9,0.95/0.9`.

### Everything run on this build

`index.html` md5 `60c17b8617316c717a22a8b20f5cf558`. Part was run on the evening of 27 November and the rest on the morning of 28 November, on the same files.

| Check | Result |
|---|---|
| The 28 test suites | All pass. |
| The retraining bench at the game's own value | The reported figures exactly; two accepted exceptions; every other target met. |
| The tactics bench and the training bench | Each gives its recorded output line for line. (The training record includes the slice 1 findings you accepted then; they are unchanged.) |
| The screens against slice 2 | All 360 stops identical. |
| The screens against the candidate, with the 1.8.0 rules switch | 356 of 360 identical; the four are the Help sentence about age, as before. |
| Match frames, player pictures, ground tiles (1.7.1 rules switch); the approved football | 198, 61,248 and 1,717 identical to the pixel; all 36 matches identical in every event and position. |
| Saves, both ways, against the candidate, 1.7.0 and 1.6.0 | Six runs, 21 or 22 checks each, no failures. |
| Layout at five sizes; keyboard; the match screen's boxes; the viewport audit | All pass (3,529 and 3,692 controls reached by keyboard). |
| Soak; the hair audit; the converter's test; speed | All pass. |

### Slice 3b: what I understand you want, for when you approve the values

Not started. This is your brief as I have it, so that your approval can also confirm the scope:

1. **The simple approach already agreed.** One priority place. A choice between **Extra coaching** and **Learn a position**. Clear progress. Nothing to do week by week.
2. **Progress.** What he is learning, the weeks done and the weeks to go, and a plain word when he is rested or injured and the weeks are not counting.
3. **Pause against change, explained clearly.** Pausing (giving the place to someone else, or to extra coaching) keeps his work; changing what he is learning discards it.
4. **Confirmation before anything is lost,** showing exactly how many completed weeks will be lost; and the same before a completed secondary position is replaced, naming it.
5. **Completion.** In the club news; the place left empty; the manager chooses what comes next.
6. **Secondary positions during squad selection,** which you are particularly interested in: how a completed secondary position is displayed, and whether it is obvious at a glance when a retrained player would be a better choice than a natural one. I will bring you options for this at the checkpoint and not settle it silently, because it is the one part that touches a screen you already know well.
7. **The same safeguards as every slice:** saves and hot-seat preserved, the default game unchanged, phone and desktop layout checked, a playable preview, and a stop for your review.

**Waiting for you:** your formal approval of the final values, and with it the go-ahead for Slice 3b.
