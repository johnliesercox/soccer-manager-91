# Tactics, slice 1: the engine, the computer managers and the balance report

**Checkpoint for John, 19 November 2026.** Milestone 1 of the roadmap (advanced tactics), slice 1 of three, as approved on 19 November ("1. Approve 2. Plans for the computer managers 3. Rebalance now 4. That one line would be very useful 5. Stay at format 4"). The approved specification is `claude/sm91-milestone-1-tactics-spec.md` in the project.

**Status.** Built and tested on the branch `milestone-1-tactics`, which starts from `milestone-0-hair` (so it has the hair fix). Not merged to `main`, not deployed. The live site is still 1.7.0.

**Approved by John on 19 November 2026 (evening), with these decisions.** The computer managers' passing answer to the opposition's formation is approved and stays, with its balance tests. A low press giving no fitness benefit is approved; a high press keeps its fitness and bookings costs. The balance is accepted as it is, including the best whole plan being worth about 1.6 points at a club with the best physio; no further balancing for now, and the bench is kept so that later work cannot shift it unnoticed. One plan for domestic and European matches. The opponent's whole plan is not to be shown before every match, because scouting comes in a later milestone: slice 2 proposes a simpler presentation. The figures after a match are to be short, in ordinary words, and marked as the simulation's own. The camera test's limit (section 7) stays recorded for a later review and is not slice 2's business. Slice 3 is to consider how the plans show in the isometric highlights without changing results or breaking animations. The hair fix is on this development baseline and not on the public site: the version number and the release sequence are to be agreed before any deployment. Nothing is merged to `main` or deployed without his explicit approval. Slice 2 is reported in `TACTICS-SLICE-2.md`.

## 1. In short

* **The match rules now have tactics in them, and no screen yet.** Four controls (mentality, passing, pressing, shooting), each with three settings, act inside the match code. The six formations are rebalanced. The 128 computer managers have plans of their own. A match now records the two plans, the share of the ball and what each side's chances were worth, ready for the one line you asked for.
* **Nothing changes by default, and that is proved, not assumed.** With every side all-Balanced in 4-4-2 the game plays match for match exactly as 1.7.1 does: 9,640 matches over four two-season worlds, same scores, scorers, minutes, cards, injuries and crowds, and the same saved game at the end. With the new rules switched off altogether it is the 1.7.1 engine exactly.
* **Every balance target of the specification is met** (section 3), on the game's own match code, not on a copy of it.
* **I changed three things from the specification to get there, and you should know about each** (section 5):
  1. A computer manager's passing now answers your formation: Short if he has more midfielders than you, Direct if he has fewer. Without this, one formation and passing gained on every computer club all season, and 4-4-2 was never the right choice.
  2. A low press no longer saves legs. A high press still costs them. With the saving, a low press left on all season was worth nearly 2 points at a club with no physio, over the limit of 1.5.
  3. The new formation values apply only to a complete eleven. A side short of a man is valued exactly as before.
* **How much do tactics matter?** For scale, one more skill point on every player is worth about 1.4 points in a 30-match league season. The best single setting left on all season is worth about half a point. The best whole plan left on all season is worth about 1 to 2 points. Choosing the best plan match by match is worth about 2 to 3. The worst possible plan and formation costs 3 to 5. So tactics are worth about as much as two skill points a man, and players still matter more.
* **Two older tests were wrong and one is touchy, and the new matches showed it** (section 7). None is a fault in the game. Two are corrected; one is kept on its old sample and noted for slice 3.
* **What you can see in the preview:** very little, by design. There is no screen for a plan yet, so you play all-Balanced against computer managers who do have plans. Section 8 says what is visible.
* **Four things for you to decide** are in section 9.

## 2. What was built

All of it is in `engine.js`; no screen, no art, no save format change.

| Piece | What it does |
|---|---|
| A plan | Four settings, each one step below the middle, the middle, or one step above: mentality (Defensive, Balanced, Attacking), passing (Short, Mixed, Direct), pressing (Low, Normal, High), shooting (Work it in, Balanced, On sight). A manager's plan is kept on his club. A club with none plays all-Balanced, so old saves need nothing done to them. |
| Mentality | Attacking: your attack up 10%, your defence down 9%. Defensive: the reverse. More goals at both ends, or fewer. |
| Passing | Changes how much your share of the ball matters to your own chances. Short: more. Direct: less. |
| Pressing | High: your midfield counts 4% more (52% of the ball against an equal side), your defence 5% less, each of your players loses 8 fitness in the match instead of 7, and you collect a fifth more bookings. Low: midfield 4% less (48%), defence 5% more, a fifth fewer bookings. |
| Shooting | On sight: your chances are more hit and miss, and midfielders take more of your goals (51% against 44%). Work it in: steadier, and forwards take more (51% against 44%). |
| What answers what | Short gains against a low press and loses against a high one; Direct the reverse. On sight gains against a Defensive side and loses against an Attacking one; Work it in the reverse. |
| The formations | A complete eleven in one of the six formations is valued by a small table, set so that with equal players no formation has an edge over another. |
| The computer managers | Each club has a fixed style of passing, pressing and shooting, worked out from the club itself, so a club is the same kind of side all through a save and in every save. Its mentality follows the fixture: Attacking at home when clearly the stronger, Defensive away when clearly the weaker. Its passing answers a different number of midfielders (the first change in section 5). No random numbers are used. |
| The match record | Each match now keeps the two plans and the home side's share of the ball, with the expected goals it already had. For the manager's own matches the week's result keeps his possession (a whole per cent), what the two sides' chances were worth, and both plans. This is what the one line after the match will read in slice 2. |
| No new luck | A plan only changes the size of numbers the match already drew. No extra random number is drawn anywhere, which is why all-Balanced comes out identical. |

There is one switch for the comparison tools: opening the game with `?rules=1.7` on the address plays by the match rules of 1.7.1. It is how the checks in section 6 show that nothing else moved.

## 3. The balance targets

"Edge" below means your points a game minus the other side's, between equal sides unless it says otherwise. For scale: one skill point on every player is an edge of 0.09, home advantage is 0.63.

| | Target (as approved) | Result | Met |
|---|---|---|---|
| B1 | Everyone Balanced: identical to 1.7.1, match for match | 9,640 of 9,640 matches identical, and the saved game after two seasons, in four worlds. With the rules off: 7,230 of 7,230 with the manager in 3-5-2, and the whole game state. | Yes |
| B2 | With computer plans on, the league keeps its shape: goals within 0.10, home wins, draws and away wins each within 1.5 points, bookings and injuries within a tenth | Over 24 seasons from the same starts, 1.7.1 rules then the rules now: goals a game 2.73 to 2.70; home wins 46.2% to 46.8%; draws 27.8% to 28.0%; away wins 26.0% to 25.2%; bookings 2.44 to 2.43; injuries 0.56 to 0.57. The table follows the clubs' standing as closely as before (0.96 and 0.97; **corrected on 26 November 2026 to 0.65 and 0.65, see the note under this table**). | Yes |
| B3 | The largest edge of any plan over any other is no more than 0.30; the right plan against a known plan is worth 0.05 to 0.15 | Largest edge 0.293 (the most lopsided pair of all 6,561). The best reply to a known plan gains 0.13 typically; 0.03 at the least (against all-Balanced) and 0.29 at the most (against that most lopsided plan). | Yes |
| B4 | No dominant plan; all-Balanced never loses more than 0.05 to any plan | All 81 plans are beaten by some other plan. No plan is as good as all-Balanced against everything. All-Balanced loses at most 0.033 to any plan and is the safest plan of the 81. Against the computer managers' own plans it loses at most 0.028. | Yes |
| B5 | Each control does what its label says | Mentality moves the goals in a match by +12% and -11%. Attacking is worth +0.06 to the stronger side at home and Defensive +0.06 to the weaker side away, and each costs about 0.06 the wrong way round. Passing is worth 0.06 with the right midfield and costs 0.06 with the wrong one. A high press gains 0.06 against Short and loses 0.06 against Direct; a low press gains 0.05 against Direct and loses 0.07 against Short. On sight gains 0.03 against a Defensive side and loses 0.05 against an Attacking one; Work it in gains 0.04 and loses 0.03. In 20,000 matches a line played through the real match code: possession 52%, 50%, 48% by press; bookings 1.56, 1.30, 1.03 a match; fitness lost 8, 7, 7. | Yes |
| B6 | Over 1,000 seasons a setting, at each physio level, no setting left on all season beats all-Balanced by more than 1.5 points | The best at each level, from no physio to the best: Attacking +0.37, Attacking +0.51, Attacking +0.40, Short +0.56 (each good to about 0.3). A high press left on all season costs 2.4, 2.2, 0.8 and 0.5 points. Whole plans and formations left on are in section 4. | Yes |
| B7 | A side five skill points better still has the edge whatever the two plans | Its smallest edge over all 6,561 pairs of plans is +0.14 (all-Balanced both: +0.45). | Yes |
| B8 | Two sides swap exactly | Plan X against plan Y is the mirror of Y against X for every pair, to fourteen decimal places. | Yes |
| Formations (decision 3) | No formation more than 0.10 better than another with equal players; each with a match it suits | With equal players and all-Balanced the largest edge of any formation over any other is 0.002 (it was 0.67). Each is the outright best choice in some matches against the computer clubs and none in more than a third (section 4). No formation with any passing is worth more than 0.4 points a season over 4-4-2 if left on. | Yes |

**Correction, 26 November 2026 (found while preparing the 1.8.0 release candidate).** The league run behind B2 had a fault in the measuring tool, not in the game: `tools/tactics-balance.js` closed each season a second time by hand after the game had already closed it. So between the seasons it measured, every player aged two years instead of one and a round of promotion and relegation was worked out from an empty table; and the figure for how closely the final table follows the clubs' standing was read after the season had been closed, when the game has already re-ordered the clubs by standing, so it was close to 1 whatever happened. Both sets of rules were measured the same faulty way, so the comparison was like for like, but the figures were not those of the real league. With the tool corrected (one season end, and the final table read from each club's own record), the same 24 seasons give, for the 1.7.1 rules and then the rules now: goals a game 2.71 to 2.70; home wins 46.0% to 46.9%; draws 28.0% to 27.6%; away wins 26.0% to 25.5%; bookings 2.44 to 2.42; injuries 0.56 to 0.57. **B2 is still met, on every figure.** The table follows the clubs' standing at the start of the season at **0.65 under both sets of rules** (0.64 and 0.63 over 96 seasons): tactics have not changed how far quality tells, which is what the figure was there to show, but the 0.96 and 0.97 reported above overstated how closely a table follows standing and should be disregarded. Every other target in this table is untouched by the fault: no other tool or test closes a season by hand, and the tests that hold the game to 1.7.1 match for match (B1) do not use this run. The corrected output is `tools/reference/tactics-balance-1.8.0.txt`; `tools/reference/tactics-balance-slice-1.txt` is kept as it was recorded.

How the targets were measured: `tools/tactics-balance.js` asks the game's own match code what a match is drawn from (the two strengths, the two plans, the share of the ball, each side's expected goals and how wide its luck is) and works out the chances of every score exactly. It then checks that working against 100,000 matches really played (the largest gap was 0.55 of a percentage point, inside the noise). The league and season figures are whole seasons played through the game.

## 4. How much tactics are worth

Against the computer clubs as they now play, over a 30-match league season, worked out exactly with equal fitness (so a high press looks a little better here than it is):

| Your players against theirs | 4-4-2 all-Balanced | Best plan left on all season | Best plan chosen match by match | Worst plan and formation left on |
|---|---|---|---|---|
| 4 skill points worse | 34.7 points | +1.1 | +2.6 | -4.6 |
| Equal | 40.5 points | +1.3 | +2.3 | -3.3 |
| 4 skill points better | 45.2 points | +1.9 | +2.8 | -4.5 |

For scale: one more skill point on every player is worth +1.4 points a season, three are worth +3.4.

What those plans are makes football sense. The best plan for the better side is Attacking, Short, High press: it has more of the ball and is told to use it. For the weaker side it is Direct, Low press, Work it in: sit in and go long. So "know what kind of side you have" is worth 1 to 2 points a season, and reading each opponent is worth about another point on top.

**Whole plans and formations left on all season, played through the game** (1,000 seasons each, an above-average Division 2 club, at the ordinary physio and the best one, where a high press costs least):

| Left on all season | Ordinary physio | Best physio |
|---|---|---|
| 4-4-2, all-Balanced | 47.9 points | 48.2 points |
| Attacking, Short | +1.3 | +1.0 |
| Attacking, Short, High press, On sight | +1.1 | +1.6 |
| Attacking, Short, High press, Work it in | +0.7 | +1.5 |
| 4-3-3 with Attacking, Direct, High press, On sight | +0.5 | +1.5 |
| 4-3-3 with Attacking, Direct, High press, Work it in | +0.7 | +1.5 |
| 3-5-2 with Attacking, Short, Low press, Work it in | +0.3 | +0.2 |
| 4-3-3 with Direct and nothing else | 0.0 | +0.1 |
| 3-5-2 with Short and nothing else | -0.6 | -0.5 |
| A formation and nothing else: 4-3-3 | +0.3 | |
| 5-3-2 | -0.3 | |
| 5-4-1 | -0.9 | |
| 4-5-1 | -1.7 | |
| 3-5-2 | -1.8 | |

Each figure is good to about 0.3. Three things to read from it. First, this club is better than its division (48 points where the average is 41), and the plan for a better side, Attacking and Short, is worth 1.0 to 1.3 points to it all season; that is what the exact table above said it should be. Second, a high press pays only where the physio can carry it: with the best physio the best whole plan reaches +1.6, a little over the 1.5 that the specification allows any one setting, and I am reporting that, not tuning it away, because it is four settings chosen to suit the side and the point of the milestone is that such a choice should count. Whether that is the right size is decision 3 in section 9. Third, with real squads a formation is only as good as the men you have for it: this squad is built for 4-4-2, its fifth midfielder is a reserve, and 3-5-2 and 4-5-1 cost it nearly 2 points even though with equal players they are level. That is the squad, not the formation table, and it is as it should be.

**The formations now.** With equal players and all-Balanced, each formation against 4-4-2 is level on points; what differs is the kind of match:

| Formation | Goals each side against a 4-4-2 | Its passing | Against the computer clubs it is the outright best choice in (of 207 matches) | Within 0.02 points a game of the best in |
|---|---|---|---|---|
| 4-4-2 | 1.23 | any | 36 | 138 |
| 4-3-3 | 1.33, the open game | Direct | 68 | 111 |
| 3-5-2 | 1.33, the open game | Short | 37 | 99 |
| 5-4-1 | 1.05, the tight game | any | 57 | 99 |
| 5-3-2 | 1.13 | Direct | 4 | 54 |
| 4-5-1 | 1.13 | Short | 5 | 44 |

The 207 matches are your players 4 worse, equal and 4 better; at home, away and on neutral ground; against a club of each of the 23 styles in the league. The open formations suit the better side and the home side, because three points for a win rewards a match that is less likely to be drawn. The tight ones suit the weaker side away. 4-4-2 is the safe middle: seldom far from the best, and the only one that needs no thought about passing. 5-3-2 and 4-5-1 are the least often right, but each is the best choice somewhere and near the best in about a quarter of matches.

A formation with three or five in midfield now needs the passing that suits it. Against the computer clubs over a season, with equal players: 4-3-3 with Direct +0.4 points, left on Mixed -0.6, with Short -1.6; 3-5-2 with Short +0.2, on Mixed -0.7, with Direct -1.6.

## 5. The three changes from the specification

**1. A computer manager's passing answers your formation.** The specification gave each club a fixed passing style. When I worked out whole seasons, that left a standing answer: every computer club lines up 4-4-2, so 4-3-3 with Direct passing (or 3-5-2 with Short) gained on all of them, all season, with nothing to set against it: +1.2 points on its own and about +2.0 inside a whole plan, against +0.8 for the best plan in 4-4-2. And 4-4-2 was never the best choice in any of the 207 matches of section 4, and near the best in only 15. That is the old "3-5-2 beats everything" fault in a new coat. The cure that keeps the formations level is to let the computer manager do what you would: with more midfielders than you he keeps the ball (Short), with fewer he goes over the top (Direct), and with the same number he plays his club's own style. After the change the best formation and passing left on all season is worth +0.4, the best whole plan +1.3, and every formation has matches it suits. It only ever answers a human manager's formation, because computer clubs all line up 4-4-2, so matches between computer clubs are untouched by it.

**2. A low press does not save legs.** The specification had a high press cost one more fitness point a match and a low press save one. At a club with no physio, where players run at about 85 fitness, a low press left on all season lifted them to 95 and was worth +1.9 points on its own, and +2.5 inside a whole plan (1,000 seasons each). The cause is that one point is half of what such a club fails to recover each week. Now a high press costs the extra point and a low press saves nothing; what a low press gives is a firmer defence, fewer bookings and an answer to Direct passing. Left on all season it is now worth -0.1 to -0.4 at every physio level. If you would rather a low press rested legs, that is one number (`PRESS_FIT_LO`), at the price that it becomes the thing to leave on when you have no physio.

**3. The formation table applies to a complete eleven only.** A side that takes the field short (too few fit players) is valued by the old rule exactly as before. Without this, a ten-man 4-4-2 came out differently from 1.7.1 and the "identical when Balanced" proof failed in 1,619 of 9,640 matches.

Two smaller points of the same kind. A club with no plan is read as all-Balanced when the match is played, instead of having a plan written into old saves when they load; the effect is the same and an old save is not altered until its manager sets a plan. And there is one plan for all of a manager's matches; a separate plan for European ties (the formation has one) is a question for the screens.

## 6. Regression

Everything below was run on the build of this checkpoint (`index.html`, labelled 1.7.1-tactics1), and where it says "against 1.7.1" the other side is the build on `milestone-0-hair`.

| Check | Result |
|---|---|
| The 22 test suites (21 as before and the new `test-tactics.js`) | All pass. (`test-phase25.js` has a stopwatch that fails when this machine is busy, as it did for 1.7.0 and 1.7.1; run on its own it passes at 371 ms against a limit of 400. The code it times is not touched.) |
| `test-tactics.js`, new | 14,926 checks: identical to 1.7.1 with the rules off and with everyone all-Balanced; the same seed and plan give the same season; each hot-seat manager's plan is used for his own club only; a plan survives a save in format 4; a 1.7.1 save loads and plays all-Balanced; a save with a plan opens in the 1.7.1 engine and plays on; the computer managers' rule uses no random number; ten men are worth what they were; the quick balance bench; four seasons with the rules on. |
| The screens, against 1.7.1, with `?rules=1.7` | No differences in 330 stops (phone and desktop; a single manager, a hot-seat game and a long game): every stop says the same and offers the same controls, and the saved games at the end of the journeys are the same to the byte. So nothing but the match rules has moved. |
| The match pictures, against 1.7.1, with `?rules=1.7` | All 198 reference frames pixel for pixel. All 61,248 player pictures and all 1,717 ground tiles pixel for pixel. Every box on the match screen where it was at every size. |
| The same journeys with the new rules on | Run to the end with no page errors. They differ from 1.7.1 where they should: the results, and the team figures on the Squad screen for formations other than 4-4-2. |
| Layout, keyboard, Classic look, five screen sizes | Nothing wider than the screen, cut short or too small at any stop or size; every one of 2,846 controls reached by Tab with a name and a focus ring; the Classic look runs clean; all viewport checks pass. |
| Saves, both ways | Games started on 1.7.1, 1.7.0 and 1.6.0 (a single manager and a three-manager hot-seat, in slots and the autosave) resume on this build and play on with a watched match; games started on this build resume on 1.7.1, 1.7.0 and 1.6.0 and play on. 19 checks each way, six runs, all pass. Format 4 throughout. |
| Soak (memory, forced failures, offline, hot-seat, measuring screen) | 44 checks, all pass. |
| The hair audit and the converter's test (standard since 1.7.1) | Both pass: all 5,568 pictures, and every player followed through 20 seeded matches under the new rules; nobody's hair or hairstyle changes. |
| The phone stand-in (processor slowed six times) | Passes: 4.4 and 5.1 ms of the page's code a frame in two runs, against 5.4 for 1.7.1 on the same machine. No difference, as expected: the match pictures are not touched. |

One tool was corrected on the way: `tools/save-compat.js` checked the service worker's cache by looking for the old name anywhere in the list, and this build's cache name (`sm91-v1.7.1-tactics1`) begins with the old one (`sm91-v1.7.1`), so it reported the old cache as still present when it was gone. It now compares whole names.

Not run on a real phone: there is nothing new to see on one in this slice.

## 7. What the new matches showed up in older tests

Computer managers with plans mean a given seed no longer gives the same matches as in 1.7.1, so every test that watches "the matches of seed such-and-such" now watches different ones. Three objected. In each case I checked the same test against the 1.7.1 rules on other seeds before deciding what it meant.

* **`test-situations.js` assumed a penalty shoot-out always follows a level score on the day.** The second leg of a European tie goes to penalties when the two legs are level, whatever the score on the day (1-0 after 0-1, say). Its old two seasons happened to contain no such tie; with the 1.7.1 rules, three other seeds contain 2, 6 and 6. The game was right and the test was wrong. Corrected: level on the day, or level over two legs.
* **`test-phase25.js` assumed a match has one dismissal.** It compared the first red card with the last time the side changed shape. The first match with a dismissal in its sample now has two, one a side, and both reshapes are correct. Corrected to look at the reshape made at that dismissal.
* **`test-camera.js` is kept on its old sample.** Its limits (an empty pitch in no more than one frame in a thousand; both posts in view when a shot arrives) were set on twelve particular matches. On the new twelve, two phone stages miss by a little: 1.5 empty frames in a thousand on the smallest, and 56 of 59 shots with both posts on the other. With the 1.7.1 rules and a different seed the same check fails the same way (seed 1992: 1.5 in a thousand). So this is the camera on a narrow stage, it was there before, and tactics did not cause it. The camera is not mine to change in this slice. The test now plays its twelve matches by the 1.7.1 rules so that it goes on measuring the camera code, and the finding is recorded here for slice 3, which is where the match pictures are worked on.

`test-equivalence.js` and `test-record.js`, which compare the engine with frozen older engines, now do so with the new rules switched off; `test-tactics.js` (new, the 22nd suite) is what proves that "off" is the 1.7.1 engine exactly.

## 8. The preview

`soccer-manager-91.html` opens from disk as before. It calls itself **1.7.1-tactics1** on the title screen so that it cannot be mistaken for 1.7.1; that is a label for a development build, not a release number, which is yours to give.

What is different to look at, since there is no plan screen yet:

* On the Squad screen, the line "Team: defence, midfield, attack" shows the new formation values when you pick a formation other than 4-4-2. A lone forward is worth more than he was, a fifth defender more, a fifth midfielder less.
* Results. You are all-Balanced; the computer managers are not. If you play three or five in midfield they answer with their passing, and you cannot yet answer back, so until slice 2 the fair test of the preview is 4-4-2.
* Nothing else. Adding `?rules=1.7` to the address plays by the 1.7.1 match rules, and with it every screen and every picture is identical to 1.7.1 (section 6).

## 9. For you to decide

1. **The first change in section 5: computer managers answer your midfield with their passing.** It goes a little beyond "a fixed style for passing" as you approved it. I recommend keeping it: without it there is a best formation again. The alternative is to leave their passing fixed and accept that 4-3-3 with Direct is worth about 1.2 points a season against them on its own, about 2 inside a whole plan, and that 4-4-2 is never the right choice.
2. **The second change: a low press saves no legs.** I recommend keeping it. The alternative keeps the idea of resting legs at the cost of a setting to leave on all season at a club with no physio.
3. **Is this the right size for tactics?** About two skill points a man from best to ordinary, more from best to worst. Every effect is a number in one block at the top of `engine.js`, so stronger or weaker is a short job and a re-run of the bench, but it is easier now than after the screens exist.
4. **Go ahead with slice 2?** The Match plan card on the Squad screen, the opponent's plan before the match, the one line of figures after it, saves checked both ways, What's new. Two questions I would bring to that checkpoint rather than assume: whether you want a separate plan for European ties, and the wording of the one-line descriptions.

Still open from before, and unchanged: where the nine art archives are kept; the release number for the combined release (the hair fix and tactics).

## 10. Where things are

* Branch `milestone-1-tactics` on GitHub, from `milestone-0-hair`. `main` is untouched (1.7.0, tagged `v1.7.0`).
* The balance bench: `node tools/tactics-balance.js` (two minutes; `--play`, `--league`, `--seasons 1000` for the longer parts). Its full output for this checkpoint is `tools/reference/tactics-balance-slice-1.txt`.
* The tests: `node test-tactics.js`.
* Every number that sets how strong a control is: the `TACTICS` block near the top of `engine.js`.
