# Training, slice 1: the rules and the balance report

**Checkpoint for John, 26 November 2026.** Milestone 2 of the roadmap (training and player development), slice 1, as you approved it on 26 November: team focus and one priority player, the mechanics and the balance only, no screens. The approved proposal is `claude/sm91-milestone-2-training-proposal.md` in the project.

**Status.** Built and tested on a new branch, `milestone-2-training`, started from the frozen 1.8.0 candidate. The candidate (`6baa8d0`) has not moved, `main` has not moved, and the live site is still 1.7.0. Nothing is merged and nothing is deployed. **This stops here for your review of the measured results. No training screen has been started.**

## 1. In short

* **The rules are built, with no screen yet.** A manager's club can have a training focus (Goalkeepers, Defenders, Midfielders, Attackers, or none) and one priority player. Both are in the match-week rules only; nothing on screen sets them.
* **Nothing changes by default, and that is proved.** With no focus and no priority player the game plays exactly as 1.8.0: 12,050 matches over five two-season worlds, one of them a three-manager hot-seat, on the settings that train most. Every match is the same and so is the whole saved game.
* **A choice moves training and never adds to it.** Each week the squad's total chance of improving is exactly what it would have been, less 5% under a focus, to the last decimal place (12,960 squad-weeks checked). Over 800 seasons a focus left on gives 95 to 97% of what Balanced gives.
* **It does what it says to who improves.** On ordinary settings a season's focus lifts the chosen group by about 40% (goalkeepers by 91%) and costs every other group 18 to 24%.
* **It does not make stronger teams, and I want to be plain about that.** A manager using every lever for his first eleven never had an eleven more than 0.1 of a skill point a man better than the same manager on Balanced, in any of ten seasons. In league points the new choices are worth nothing that can be measured. They shape a squad. They do not strengthen it. That is what "redistribute, do not add" means in practice, and it is the first thing for you to judge.
* **The manager's long-term advantage over the computer clubs comes entirely from the weekly training that is already in the game, and it is larger than I had put a number on.** After ten seasons his first eleven is 4.6 skill points a man better than it would be with no weekly training, on the settings every game starts with, and 7.9 with the best coach. The new choices add nothing to that. Section 5.
* **Four targets of the proposal are not met as I wrote them.** None is a fault in the rules; each is a finding, and section 4 sets them out with the options. In brief: the lift a focus gives shrinks to about 20% on Hard with the best coach, because players reach their ceilings; the choices are not worth the 0.1 of a league point I said they should be; "nobody gains more than eight points in a season" cannot be promised by a weekly chance (and today's game already produces seasons of 15); and the best prospect's value can be raised 17% more than today's best, against a limit of 15%.
* **Seven decisions for you** are in section 9.

## 2. What was built

All of it is in `engine.js`. No screen, no art, no change to the save format, nothing in the match or the match pictures.

| Piece | What it does |
|---|---|
| A focus | One of Goalkeepers, Defenders, Midfielders, Attackers, kept on the manager's club. A club with none trains as it always has, so old saves need nothing done to them. |
| What a focus gives | Each man of the chosen group who can still improve has **one and a half times** his usual chance of a point that week (a goalkeeper **twice**). The rest of the squad share what is left equally, and the whole is set **5% below** what the squad would have had. |
| The priority player | One first-team player of the manager's own. His chance is **doubled**, on top of his group's. It is paid for by the rest of the squad; there is no 5% charge for a priority player alone. |
| His fitness | In a week of extra sessions he recovers **one point less**. Under 70 fitness, or injured, he is rested: no extra coaching, and nothing charged. |
| The ceilings | Nobody's chance in a week is above **20%** (today's most is 12%). Nobody passes his potential. Nobody of 28 or over gains, as now. |
| The floor | Nobody's chance falls below **40%** of what it would have been. Where the favoured men would take more than that leaves, they are scaled down instead. This was not in the proposal; see section 6. |
| Who it applies to | The first-team squad of a manager's club. The youth team keeps its own rule. Computer clubs do not train in the week, as now, whatever is written into them. |
| Housekeeping | A player who is sold, released, retired or sent to the youth team stops being the priority at the next training. A new job starts with no focus and no priority player, as it already starts on Normal. Each hot-seat manager's choices are his own club's. |
| The switch | Opening the game with `?rules=1.8` on the address plays the 1.8.0 training rules whatever is chosen, as `?rules=1.7` plays the 1.7.1 match rules. Neither is mentioned anywhere a player can see. |
| No new luck | A choice changes only the size of a chance the game already drew. The same number of random numbers is drawn, which is why "nothing chosen" comes out identical. |

Also done, as you asked: the Help screen now says players improve in training "up to the age of 27", where it said "until about 30".

Every number above is one line in a block near the top of `engine.js` (`TRAINING`).

## 3. How each factor acts, measured

200 worlds for each line, the game's own match weeks, one manager's club in Division 2. The manager buys and sells nobody and the game picks his team, so the only thing that differs between lines is training.

**Skill gained in weekly training by the whole squad, a season, and by group**

| | Total | Of Balanced | Goalkeepers | Defenders | Midfielders | Attackers |
|---|---|---|---|---|---|---|
| **Normal, average coach.** Balanced | 9.9 | | 1.3 | 3.0 | 3.0 | 2.6 |
| Focus on goalkeepers | 9.5 | 96% | **2.5** | 2.5 | 2.5 | 2.1 |
| Focus on defenders | 9.5 | 96% | 1.0 | **4.3** | 2.3 | 1.9 |
| Focus on midfielders | 9.5 | 96% | 1.0 | 2.4 | **4.3** | 1.9 |
| Focus on attackers | 9.4 | 95% | 1.0 | 2.5 | 2.4 | **3.5** |
| **Hard, best coach.** Balanced | 26.6 | | 3.9 | 8.1 | 7.8 | 6.8 |
| Focus on goalkeepers | 25.2 | 95% | **4.9** | 7.0 | 6.9 | 6.4 |
| Focus on defenders | 25.9 | 97% | 3.4 | **9.5** | 6.9 | 6.1 |
| Focus on midfielders | 25.7 | 97% | 3.3 | 7.0 | **9.4** | 6.0 |
| Focus on attackers | 25.6 | 96% | 3.4 | 7.1 | 6.9 | **8.3** |

**The best prospect in the squad (the man with most room to improve): what a season gives him**

| | As the game is | As the priority player | Priority player, and his group's focus |
|---|---|---|---|
| Normal, average coach: skill | +1.2 | +1.6 | +2.0 |
| his value | +8% | +11% | +14% |
| Normal, best coach: skill | +2.8 | +3.8 | +4.4 |
| his value | +20% | +27% | +33% |
| Hard, best coach: skill | +4.6 | +5.2 | +5.0 |
| his value | +36% | +43% | +41% |

How to read the six factors you asked about:

* **Coach.** Still the largest lever by far: the best coach doubles everything in both tables. A focus and a priority player multiply whatever the coach gives.
* **Intensity.** Hard still gains about a third more than Normal with the same coach, at the fitness cost measured in the proposal. That is unchanged.
* **Potential.** It is the limit that bites. With the best coach on Hard, players are already close to their ceilings, so there is little left for a focus or a priority player to add: the prospect gains 5.2 instead of 4.6, and adding his group's focus on top gives nothing more.
* **Age.** Unchanged. Nobody of 28 or over can be improved by any choice, and the game will have to say so when one is picked.
* **Focus.** Clear on ordinary settings (about +40% for the group), weaker where the coach and intensity already bring players to their ceilings (about +20%).
* **The priority player.** A third more for him on ordinary settings (+1.2 to +1.6), two thirds more with his group's focus as well (+2.0). His fitness runs two points lower than it would (96 against 98 on Normal; 85 against 87 on Hard, where he is under 70 and rested in a fifth of the weeks).

## 4. The targets

These are the targets of the proposal, as written there. I have not adjusted any to fit the result.

| | Target | Result | Met |
|---|---|---|---|
| T1 | Nothing chosen: identical to 1.8.0 | 12,050 of 12,050 matches, and the whole saved game, in five two-season worlds including a three-manager hot-seat. With the new rules switched off and a focus and priority player set and ignored: 4,820 of 4,820. | Yes |
| T2 | Nothing is added: under any focus the squad's total is 93 to 97% of Balanced | A focus left on: 95 to 97%, at both settings. Exact every week by construction. A priority player alone carries no charge and comes out at 98 to 104%: see the note below. | Yes |
| T3 | Each group responds: its own group up at least 40%, no other down more than 35% | Normal, average coach: goalkeepers +91%, defenders +41%, midfielders +42%, attackers +38%; the others down 18 to 24% (worst 26%). **Hard, best coach: only +17 to +27%.** | **Partly** |
| T4 | No runaway: every lever never gives a first eleven more than one skill point a man over Balanced | Most in any of ten seasons: +0.1. On average -0.3 to -0.4, which is the 5% charge adding up. | Yes |
| T5 | Worth 0.1 to 0.5 league points a season | By the skill it adds: none (about -0.5, which is the 5% charge). Counted directly over 2,000 seasons a side: -0.3 and -0.1, each good to about 0.3. **Not worth points.** | **No** (under the range, not over it) |
| T6 | Nobody passes his potential | None, in any line of the bench (some 20 million player-weeks). | Yes |
| T6 | Nobody gains more than eight points in a season from training | The most one player gained in a season: 12 on Normal with the average coach, 16 with the best, 15 on Hard. **As the game is today the same figures are 6, 11 and 15.** | **No** |
| T7 | The best prospect, trained with every lever for a season, gains no more than 15% above the best that can be done today | Today's best (Hard, best coach): +36% of his value. With every lever: +43%. **That is 17% more.** | **No**, by a little |
| T8 | The youth team and the summer rule untouched | The youth team gains the same in every line (0.1 to 0.2 a season at a first-grade academy). The summer rule is not touched by the code, and T1 proves it draws the same. | Yes |
| T9 | Saves, hot-seat and the switch | Section 7. | Yes |

**Four things to understand about the ones not met.**

1. **T3 on Hard with the best coach.** A focus gives each chosen man one and a half times his chance, on every setting. What shrinks is what the chance can buy: with the hardest training most young players are already near their ceilings and a bigger share cannot take them past. I think this is right as it is, and it argues against the settings that train hardest being the place a focus matters.
2. **T5.** I set a floor of 0.1 of a point so that the choice would not be meaningless. Measured, it is not worth points at all. I should have seen this before measuring: if the total is fixed, the eleven's average is fixed too, because most of the players who can improve are already in the eleven. What a focus really buys is *which* players are better: a young goalkeeper brought on, a weak line strengthened, a prospect brought to his peak years sooner. Those matter to a manager who is also buying, selling and choosing a plan. They do not show in a bench where he does none of that.
3. **T6.** A weekly chance cannot promise a season's maximum; I wrote the target loosely. The ceiling of 20% a week gives a player about eight a season *on average* if he is at the ceiling all year, and now and then far more. Today's game is the same: 15 has happened with no new rule. What is certain is that nobody passes his potential.
4. **T7.** A prospect's value can now be raised a little faster than today's fastest. He is still worth no more in the end, because his potential has not moved: he gets there sooner. On ordinary settings the change is larger in proportion (+8% a season to +14%) and smaller in size.

**A note on T2.** Week by week the total is exact. Over a season a priority player alone can come out a little over 100% (104% with the best coach). The reason is that he is the man with most room, so the training moved to him is training that would otherwise have gone to men about to reach their ceilings and stop. It is a small reward for pointing the coach at a player who can use him, and a fixed focus pays 3 to 5% the other way.

## 5. The manager's advantage over the computer clubs, over ten seasons

You asked for this to be examined and kept under review. The computer clubs do not train in the week; a manager's club does. To measure what that is worth, one line plays the manager's club with its weekly training switched off, which is what a computer club gets. Everything else is the same.

**Average skill of the first eleven at the end of each season**

| Season | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| No weekly training (as a computer club) | 64.3 | 64.1 | 63.8 | 63.6 | 62.6 | 61.7 | 60.9 | 59.6 | 58.9 | 58.3 |
| Normal, average coach, Balanced (where every game starts) | 65.0 | 65.5 | 65.7 | 65.6 | 64.9 | 64.4 | 64.1 | 63.3 | 63.0 | 62.9 |
| **The advantage** | **+0.7** | +1.4 | +1.9 | +2.0 | +2.3 | +2.7 | +3.2 | +3.7 | +4.1 | **+4.6** |
| Normal, best coach, Balanced | 66.0 | 67.0 | 67.5 | 67.3 | 66.1 | 65.9 | 66.2 | 66.0 | 66.0 | 66.2 |
| **The advantage** | **+1.7** | +2.9 | +3.7 | +3.7 | +3.5 | +4.2 | +5.3 | +6.4 | +7.1 | **+7.9** |
| Normal, best coach, every lever for the first eleven | 65.9 | 66.9 | 67.4 | 67.2 | 65.7 | 65.6 | 65.4 | 65.2 | 65.4 | 65.8 |
| Against Balanced | -0.1 | -0.1 | -0.1 | -0.1 | -0.4 | -0.3 | -0.8 | -0.8 | -0.6 | -0.4 |

What it says:

* **The advantage is real and it grows every season:** about half a skill point a man a season on the starting settings, and nearly one with the best coach. For scale, one skill point on every man is worth about 1.4 league points a season between equal sides.
* **It shows in the league, but less than that arithmetic suggests,** because a club that improves is promoted and meets better sides. After ten seasons the club with no weekly training is on average in Division 2.2, the club on the starting settings in 1.9 and the club with the best coach in 1.7, all on about 41 or 42 points a season.
* **The new choices do not add to it.** The last row is the strongest thing a manager can do for his eleven with them, and it is never ahead.
* **A caution on the absolute figures.** This manager buys nobody, so his squad ages and the eleven drifts down after season four even with training. A real manager buys. The rows are fair against each other; they are not a forecast of a real career.

I have changed nothing here, as you decided. If you want it narrowed one day, there are two honest routes and both are a rebalancing of the whole league, not a training feature: give the computer clubs weekly training, or lower what a manager's training gives.

## 6. Where I departed from the proposal

1. **A floor.** The proposal said the rest of the squad "share what is left". With a small squad of improvable players, a focus and a priority player together could leave the rest almost nothing, or less than nothing. So nobody falls below 40% of his usual chance, and the favoured men are scaled down to pay for that. On ordinary settings a focus alone meets the floor in about 3 weeks of a season; a focus and a priority player stacked on one group meet it in about 20.
2. **No hard limit on a season's gain.** The proposal said "about eight points in a season". What is built is the weekly ceiling of 20%. A true season limit needs a counter saved on every player. It is decision 3.
3. **No charge for a priority player alone.** The proposal said the total "does not rise", and it does not. I applied the 5% only to a focus, as its "price of specialising".

## 7. Regression

Everything below was run on the build of this checkpoint (`index.html`, labelled 1.8.0-training1, md5 `39ed227ddaf49fe7aa659aaf8da600ba`). "The candidate" is the frozen 1.8.0 release candidate.

| Check | Result |
|---|---|
| The 26 test suites (25 as before and the new `test-training.js`) | All 26 pass, first time. |
| `test-training.js`, new | 25,382 checks: nothing chosen is the 1.8.0 engine exactly; the rules switched off ignore a focus and a priority player; the total is exact every week and the ceilings and floor hold; only the four groups and a first-team player of one's own are accepted; a player who leaves stops being the priority; computer clubs are untouched; the priority player's fitness; the same seed and choices give the same seasons; each hot-seat manager's choices are his own; saves; the quick bench. |
| The screens against the candidate (173 stops on a phone and on a desktop: one manager through a season, three managers in hot-seat, the Big job with Europe) | 342 of 346 stops identical. The four that differ are the Help screen, twice on each device, and the only words changed are the sentence about age ("until about 30" to "up to the age of 27"). The three saved games at the end of the journeys are identical to the candidate's. The same again with `?rules=1.8`. |
| The match pictures against 1.7.1, with `?rules=1.7` | All 198 frames, all 61,248 player pictures and all 1,717 ground tiles identical to the pixel. Every box on the match screen where it was. |
| The approved football (`tools/reference/scene-1.8.0.json`) | All 36 matches identical in every event and every position. `src/` is not touched on this branch. |
| Tactics | `test-tactics.js` and `test-tactics-ui.js` pass; the tactics bench gives, line for line, its 1.8.0 record. |
| Layout, keyboard, five screen sizes | Nothing wider than the screen, off it, cut short or too small at any stop or size; every control reached by Tab, named and ringed (3,181 and 3,265 visited); all viewport checks pass. |
| Saved games, both ways, in the browser (a single manager and a three-manager hot-seat, in slots and the autosave, resumed and played on with a watched match) | From the candidate, 1.7.0 and 1.6.0 to this build, and from this build back to each: six runs, 21 or 22 checks each, no failures. |
| Saved games with a focus and a priority player in them | They open in the 1.8.0 and 1.7.1 engines, play on there, and come back with the choices as they were. The save format is still 4. |
| Hot-seat | Three managers, each with his own focus and priority player or none, kept apart through 20 weeks and a save. The soak's three-manager hot-seat passes. |
| Soak (memory, forced failures, offline, hot-seat, measuring screen) | 44 checks, all pass, first time. The check that failed once on the candidate now looks again when it lands on a fade, as you asked; nothing in the game was changed for it. |
| The hair audit and the converter's test | Both pass. |
| Speed: the phone stand-in (processor slowed six times) | 59.6 frames a second; the page's own work 3.6 ms a frame. In line with the candidate (58 frames a second, 5 ms), as expected: nothing in the match is touched. |
| The style preview and the rules switches | No preview button and its actions do nothing in this build either. A new check holds that no screen, link, manifest entry or offline rule mentions a rules switch, and that the engine reads one only from the typed address. |

Not run on a real phone: there is nothing new to see on one in this slice.

## 8. The preview

`soccer-manager-91-1.8.0-training1.html` opens from disk as before and calls itself **1.8.0-training1** so that it cannot be mistaken for the frozen candidate. **There is nothing new to see in it:** no screen sets a focus or a priority player yet, so every game in it plays exactly as 1.8.0. The one visible change is the Help sentence about age.

## 9. For you to decide

1. **Is "it shapes the squad, it does not strengthen it" what you want?** I recommend yes. It is what you approved in principle, it keeps the manager's lead from growing, and the worth of the choice will lie in squad building, which the screens can make visible (who improved this season, and by how much). The alternative is to let a focus add a little, which makes it worth points and widens the gap in section 5.
2. **The size of a focus: one and a half times (as built) or twice?** Measured with twice (goalkeepers three times): the chosen group gains 64 to 74% on ordinary settings (goalkeepers 139%) and the others lose 30 to 37%, over the 35% limit. I recommend staying at one and a half until you have seen it on screen; it is one number.
3. **A hard limit on what one player can gain from training in a season?** I recommend no. Potential is the limit that matters and it is never passed, and today's game already produces seasons of 15. If you want one, it costs a small saved counter on each player.
4. **The priority player: twice (as built) or one and a half times?** With one and a half: the prospect gains +1.4 instead of +1.6 on ordinary settings, and his value +9% instead of +11%. On Hard with the best coach it makes almost no difference, because potential is the limit there. I recommend staying at twice and accepting T7 at 17%.
5. **The 5% charge for a focus: keep it?** With no charge a focus gives 99 to 102% of Balanced. I recommend keeping it: it is what makes Balanced the right default for an even squad, and over ten seasons it costs a manager who never switches a focus off about a third of a skill point a man.
6. **The manager's advantage (section 5).** No action now, as you decided. Do you want it on a list for a later balancing milestone?
7. **Go ahead with slice 2, the screens?** It would hold: the training card on the Squad screen (Light, Normal, Hard as now, the focus, the priority player), a mark on the priority player's row, a plain line when a choice can do nothing (a player of 28, a man at his ceiling), the weekly and end-of-season feedback from real gains, Help and What's new wording, and the phone, keyboard and hot-seat checks. As before I would bring you a short scope for it first if you prefer.

## 10. Where things are

* Branch `milestone-2-training` on GitHub, from the frozen candidate. `main` is untouched (1.7.0, tagged `v1.7.0`). The candidate is `6baa8d0`, marked by the branches `milestone-1-tactics` and `release-1.8.0-rc1`, neither of which has moved.
* The rules: the `TRAINING` block near the top of `engine.js`, and `trainingShare` beside `setTraining`.
* The tests: `node test-training.js` (the 26th suite; 25,382 checks).
* The bench: `node tools/training-balance.js` (most of an hour for 200 worlds; `--quick` for a minute; `--set FOCUS=2,PRIORITY=1.5,COST=0` to try other numbers). Its full output for this checkpoint is `tools/reference/training-balance-slice-1.txt`.
* The 1.8.0 engine, frozen for the comparison: `legacy/engine.v180.js`.
