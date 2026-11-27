# Training, slice 2: the screens

**Checkpoint for John, 27 November 2026.** Milestone 2 (training and player development), slice 2, as you approved it on 27 November: the interface for the training focus and the priority player, in the Premium Dark design. Slice 1 (the rules and their balance) is `TRAINING-SLICE-1.md`.

**Status.** Built and tested on the branch `milestone-2-training`. **Nothing has gone to production.** The live site is 1.7.0, `main` has not moved, and the 1.8.0 candidate is still frozen at `6baa8d0`. Position retraining and every other optional feature are untouched. **This stops here for you to look at how the controls look and feel.**

## 1. In short

* **The training controls are on the Squad screen, inside the training card that was already there.** Light, Normal and Hard are exactly where they were. Under them is one new line, "Focus and priority player", with a Change button.
* **Set once and left.** Nothing asks for attention each week. A manager who never opens it plays on Balanced with no priority player.
* **The default still plays exactly as 1.8.0:** every match and every player's skill, proved again on this build (section 5). One thing is new in the saved game and you should know of it: a small record of the skill gained in training, which is what the feedback reads. Section 3.
* **Everything you listed is in** (section 2), and **the feedback is real:** every figure of improvement on screen is the engine's own count of points gained in weekly training. A test compares each one with the skill the players actually gained.
* **The balance has not moved.** The rules for who improves are not changed by this slice, and the bench gives, line for line, the output recorded at slice 1.
* **Four small things for you to decide** are in section 6.

## 2. What you asked for, and where it is

| You asked for | What is built |
|---|---|
| Team training focus: Balanced, Goalkeepers, Defenders, Midfielders, Attackers | Five buttons under "Training focus". On a phone they sit three and two. |
| One priority player per club | "Choose a player" opens a list of the first team. One tap chooses and returns to the Squad screen. The same choice is on each player's own page ("Make him the priority player"). Choosing another replaces the first. |
| Light, Normal and Hard, unchanged | Untouched: the same three buttons, the same words under them, in the same place. |
| Clear indications of what is selected | The chosen focus is the lit button. A line at the top says it in words, for example "**Defenders first. Priority player: Roy Slater.**", and that line shows even when the part is closed. The priority player has a "priority" mark on the squad list and in the picker. |
| An obvious way back to the default | "Reset to default training" appears whenever anything differs from the default. One tap puts back Normal, Balanced and no priority player, and says so. With nothing changed there is no button, because there is nothing to reset. |
| Clear explanations of benefits and trade-offs | Under the chosen focus, in the For, Against, Suits form of the Match plan card. For Defenders: "**For** Your defenders who can still improve do so half as fast again. **Against** The rest of the squad improve more slowly to pay for it, and the squad as a whole gains a little less. **Suits** Young defenders you are building the side around." The priority player's cost is said wherever he is chosen: twice as fast, the rest pay for it, a point of fitness a week, rested under 70. |
| Warnings when a selected player cannot improve | Four, each in plain words, on the list before he is chosen, in the message when he is, on the card afterwards and on his own page: he is 28 or over; he has reached his potential; he is injured; he is under 70 fitness and being rested. He can still be chosen; the game does not hide that it will do nothing. A fifth: a focus on a group in which nobody can improve says it gives nothing and costs the others a little. |
| Feedback showing actual development over time | "This season in training" on the card: the squad's total, each group's total, and the three players who have gained most. Each player's own gain is on his row of the squad list ("+2 trained"), on his page, and in the picker. Last season's totals stay on the card for comparison, and the end-of-season review has a Training line. |
| How much an individual player or a positional group has improved | As above. The card might read: "**Squad +8.** Goalkeepers +1, Defenders +1, Midfielders +5, Attackers +1. Most improved: Alun Bailey +4, Dave Harrison +1, Keith Palmer +1." |
| Recorded development, not projections | Every figure is the engine's record of points really gained. Nothing on any screen forecasts what a choice will do in numbers. The card says what it counts: "Points of skill really gained in weekly training. The summer's changes are not counted." |
| Keep it simple; set once and leave | One line when closed. On a phone it stays closed until Change is tapped, like the Match plan. On a wide screen it is open. |

Help has a new part, "Training focus and the priority player", in the game's own words. It says the choices "decide who improves, not how much".

## 3. The record of training gains, and what "identical to 1.8.0" means now

To show real development the game has to remember it, so the engine now writes down each point of skill gained in weekly training as it happens: by player and by group, for the current season, with last season's totals kept beside it.

* **It is a record only.** Nothing reads it to decide anything, and no random number is drawn for it. A game plays the same matches and every player has the same skill with it or without it.
* **It is the one difference in a saved game when nothing is chosen.** The identity test compares the whole saved game with the 1.8.0 engine's and leaves this record out; a second test holds the record itself to the truth, week by week, against the skill the players actually gained (369 weeks over nine seasons, exact for every player and every group).
* **The save format is still 4.** 1.8.0 and 1.7.0 ignore the record and carry it along. With the 1.8.0 rules switched on by the tests, nothing is written at all.
* It is kept for a manager's club only, and it is a few dozen numbers.

## 4. The wording, for your review

These are the exact words on screen. Any of them can be changed.

* Summary line: "Balanced. No priority player. Every player has an equal share of the coach." / "Defenders first. Priority player: Roy Slater. Stays this way until you change it."
* Balanced: "Every player who can still improve has an equal share of the coach. Nothing gained and nothing given up."
* A focus: "For: Your defenders who can still improve do so half as fast again." (goalkeepers: "twice as fast") "Against: The rest of the squad improve more slowly to pay for it, and the squad as a whole gains a little less." "Suits: Young defenders you are building the side around." (goalkeepers: "A young goalkeeper you want ready sooner.")
* No priority player: "Nobody. One player can have extra coaching: he improves twice as fast, the rest of the squad a little more slowly, and the extra sessions cost him a point of fitness each week."
* The picker: "One player can have extra coaching. He improves twice as fast in training. The rest of the squad pay for it by improving a little more slowly, and the extra sessions cost him a point of fitness each week. Under 70 fitness he is rested until he recovers. He stays your priority player until you change it."
* The warnings: "He is 28. Training does not raise a player's skill from the age of 28, so extra coaching does nothing for him." / "He has reached his potential, so extra coaching does nothing for him." / "He is injured. His extra coaching starts again when he is fit." / "His fitness is under 70, so he is being rested. His extra coaching starts again when he recovers." / "None of your goalkeepers can improve any further, so this focus gives nothing and costs the others a little."
* The record: "Squad +8. Goalkeepers +1, Defenders +1, Midfielders +5, Attackers +1." / "Most improved: ..." / "Nobody has gained a point of skill in training yet this season." / "Last season: squad +32. ..."
* Reset: "Reset to default training", then "Training reset to the default: Normal, balanced, no priority player."

## 5. Regression

Everything below was run on the build of this checkpoint (`index.html`, labelled 1.8.0-training2, md5 `a8fdfebf5baf5e7d130cd5645a1e30b6`). "The candidate" is the frozen 1.8.0 release candidate.

| What you asked to be kept | Result |
|---|---|
| **Identical behaviour to 1.8.0 when the new options are unused** | 12,050 matches over five two-season worlds identical to the 1.8.0 engine, with the whole saved game (the record of section 3 apart). With the 1.8.0 rules switched on, the journeys through the built game end in saved games identical to the candidate's, byte for byte, on phone and desktop. |
| **Save compatibility and an unchanged format** | Format 4. In the browser: games from the candidate, 1.7.0 and 1.6.0 resume and play on in this build, and games from this build resume and play on in each (six runs, 21 or 22 checks each, no failures). A save with a focus and a priority player opens in the 1.8.0 and 1.7.1 engines, plays on, and comes back with the choices as they were. A save made by 1.8.0 opens on the default with nothing to do. |
| **Hot-seat, each manager's choices separate** | In the built game: one manager sets a focus and a priority player, the next sees the default and a list of his own players only, each choice is on its own club, and both are still there after the week is played. In the engine: three managers through 20 weeks and a save. The soak's three-manager hot-seat passes. |
| **No change to the match engine, tactics, matchday artwork or official results** | `src/` is not touched on this branch (not one line since the candidate). With the 1.7.1 rules switch: all 198 match frames, all 61,248 player pictures and all 1,717 ground tiles identical to the pixel. The approved football: all 36 matches identical in every event and position. `test-tactics.js` (14,933 checks) and `test-tactics-ui.js` pass, and the tactics bench gives its 1.8.0 record line for line. |
| **No unintentional increase in total player development** | The rules for who improves are as slice 1 left them. The full bench (200 worlds, ten seasons, every policy at three settings) gives, line for line, the output recorded at slice 1: all 104 lines. A focus still gives 95 to 97% of Balanced, and nobody passes his potential. |
| **Mobile and desktop usability, including the keyboard** | Layout at five sizes from a 360 px phone to 1920 px: nothing wider than the screen, off it, cut short or too small, at any of 180 stops, the new part and the picker among them. Keyboard: every control at every stop reached by Tab, named, ringed and in view (3,529 and 3,692 visited, 350 to 430 more than before). The chosen focus and the open or closed state are announced to a screen reader, and every Choose button names its player. |

| Other checks | Result |
|---|---|
| The 27 test suites (26 as before and the new `test-training-ui.js`) | All pass. See "Three tests adjusted" below. |
| `test-training-ui.js`, new | 84 checks: section 2 of this report, item by item, and every figure of improvement on screen against the skill really gained. I broke a figure on purpose to see the test object, and it did. |
| The screens against the candidate, with the 1.8.0 rules switch | 356 of 360 stops identical. The four that differ are the Help screen, and the only words changed are the sentence about age that you asked to be corrected. Nothing of training is drawn. |
| The screens against the candidate, as the game now plays | 288 of 360 stops identical. Every one that differs is a Squad screen, a player's page, Help, a season review or one of the new training stops. Home, the market, the table, the club screens, the match and everything else are word for word the candidate's. |
| Soak (memory, forced failures, offline, hot-seat, measuring screen) | 44 checks, all pass. |
| The hair audit and the converter's test | Both pass. |
| Speed: the phone stand-in | 57.4 frames a second, under 1% of frames slow. In line with the candidate; nothing in the match is touched. |
| The style preview and the rules switches | Unreachable in this build, and mentioned nowhere a player can see, as before. |

**Three tests adjusted.** Three older suites compare the whole saved game with frozen older engines after switching the newer rules off (`test-equivalence.js`, `test-record.js`, `test-tactics.js`). They now switch the training record off as well, in the same line where they switch tactics off. Before that, `test-equivalence.js` failed on the first run, correctly: the saved game had the new record in it. Nothing in the game was changed for this.

**One check that failed once, in the match view, which this slice does not touch.** The viewport audit taps on every player in the paused match picture. On its first run, on the 360 px phone with the whole-pitch camera, 21 of 22 players took a tap on the body and one did not. At that size a player is 20 pixels wide and another can be drawn over him. The audit plays a different match each run; I ran it twice more and it passed both times, 22 of 22. The match code is byte for byte the candidate's. You asked for the matchday backlog to be left alone, so I have not added this to it; say if you want it recorded there.

## 6. For you to decide

1. **How it looks and feels on your Galaxy.** That is the purpose of this checkpoint. Section 7 says what to try.
2. **The wording** in section 4.
3. **The "reached his potential" warning shows even to a manager with no scout.** Elsewhere the game shows how far a player can go only if you employ a scout. This warning tells a manager without one a single fact about a single player, and only once he has chosen him. I recommend keeping it: an honest warning is worth more than that small secret, and every game starts with a scout. The alternative is to show it only with a scout, and let a manager without one find out from the lack of improvement.
4. **Each player's gain on every row of the squad list ("+2 trained").** It answers "who is improving" at a glance, and it lengthens some rows on a phone. Keep it there, or keep it to the card and the player's page?

Not built, and waiting on you: a What's new entry for training. It belongs with the version this is released in, and the number is yours to give.

## 7. To try on your Galaxy

The file is `soccer-manager-91-1.8.0-training2.html`. Opened from your files it keeps its own saved games, apart from the live site's.

1. Start a game and go to Squad. Under Light, Normal, Hard: "Focus and priority player". Tap Change.
2. Tap each focus and read the For and Against. Tap Balanced to put it back.
3. "Choose a player". Look for a player of 28 or over in the list; choose him and read the warning. Then choose a young player.
4. Find his "priority" mark on the squad list. Open his page: the Training part is there.
5. Play a few weeks, on Hard if you want to see figures sooner. Come back to Squad: "This season in training", and "+1 trained" under the names.
6. "Reset to default training".
7. If you have a hot-seat game to hand: each manager's Squad screen shows only his own.

## 8. Where things are

* Branch `milestone-2-training` on GitHub. `main` is untouched (1.7.0, tagged `v1.7.0`). The 1.8.0 candidate is `6baa8d0`, marked by `milestone-1-tactics` and `release-1.8.0-rc1`, neither of which has moved. No tag has been created.
* The screens: `trainingPanel`, `playerTraining`, `reviewTraining` and the `trainpick` screen in `ui.html`.
* The record: `logTraining` and `trainingRecord` in `engine.js`. The rules for who improves are as slice 1 left them.
* The tests: `node test-training-ui.js` (the 27th suite) and `node test-training.js`.
* The automated journeys now walk the new part and the picker, so the layout and keyboard audits cover them at every size.
* The gameplay-balancing backlog you asked for: `BALANCE-BACKLOG.md`, with the manager's advantage over the computer clubs as its first item.
