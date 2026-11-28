# Training, slice 3: position retraining

## Scope and feasibility proposal

> **Approved by John on 27 November 2026, with Slice 3a (the rules and the balancing) authorised and Slice 3b (the screens) not yet.** His decisions:
>
> 1. **Who can learn what.** Every outfield move: a defender can learn midfield or attack, a midfielder defence or attack, an attacker midfield or defence. Goalkeepers stay out, as learners and as a position to learn. One learned position, and he keeps his own.
> 2. **95% as the starting value, subject to the Slice 3a results.** Compare the long-term effect of 95% and 90%, above all for a distant move such as defender to attacker. Retraining must not make natural positions largely irrelevant or become the dominant long-term strategy. Keep 95% if the tests support it. No further balancing changes without bringing him the measured results.
> 3. **The priority place does one job at a time:** extra coaching or learning a position. No separate allocation.
> 4. **The trade-off.** A learner keeps his ordinary improvement and gives up the doubling. The same fitness cost and the same rules for who is working.
> 5. **Duration.** 12 weeks for the next line, 20 for the far line, adjusted by coach, age and intensity as proposed, with no luck in it. Tests to cover interrupted retraining, injuries, low fitness and changes of intensity.
> 6. **All or nothing.** Worth what he was out of position until the course is complete, then competent for good.
> 7. **One learned position.** A later one replaces it; the screen (3b) must say the earlier one will be lost and ask for confirmation. Work towards a position is kept if the course is paused and resumed. A clear rule is wanted for unfinished work when the target is changed (the rule built and proposed is in `TRAINING-SLICE-3A.md`).
> 8. **Balance is the most important part of 3a.** Keep every proposed test, the ten-season one above all. To be answered: 95% or 90%; whether repeated retraining makes squad composition or natural positions matter less; whether any formation becomes disproportionately strong; whether older players benefit without the ageing system being undermined; whether the balance between human and computer clubs changes; whether values, wages, transfers or long-term squad strength are affected. Retraining adds no skill and no potential, and a player's natural position always remains his most effective.
> 9. **Not yet:** the Slice 3b screens. **No more work on the testing backlog** unless a genuine regression appears. Matchday stays closed.
> 10. **Nothing to production.** Live 1.7.0 untouched, the 1.8.0 candidate frozen at `6baa8d0`, all work on `milestone-2-training`, no merges into `main`, no deployment, no tags. After 3b the next milestone on the roadmap is player ratings, match reports and opposition scouting.
>
> **Decided on the measured results, 27 November 2026 (evening):** a learned position is worth **95% in a neighbouring position and 90% in a distant one**; the natural position stays 100%. Two exceptions to target R3 are accepted and recorded as exceptions, with the targets left as written (continuous retraining in 5-4-1: 0.83 a season on average, 1.08 in its best season; one retraining: 0.61 in its best season with the average within the half point). Where the text below says 95% for every learned position, read this.
>
> **Also decided, 28 November 2026:** a change of target discards the unfinished work, and a pause keeps it (the rule as built); when a course finishes the priority place is left empty, the news says so, and the player is not moved to extra coaching automatically (the rule as built). For the screens (3b): explain the difference between pausing and changing; show exactly how many completed weeks will be lost and ask for confirmation, and the same before a completed secondary position is replaced; show completed secondary positions during squad selection so that it is obvious when a retrained player is the better choice. Slice 3b waits for his formal approval of the final values.
>
> The measured results are in `TRAINING-SLICE-3A.md`. The text below is the proposal as he read it.

27 November 2026. **A proposal only. Nothing is built, and nothing will be until you have approved a scope.** It follows your approval of training slices 1 and 2, and your note that this is "approval to investigate and propose Slice 3, not approval to implement it".

## The outcome

**It is feasible, and it is small in the rules.** One function in the game decides what a player is worth when he plays out of his position, and everything else (team selection, team strength, who scores) reads that function. A second position is a change to that one answer. Nothing in the match itself or in the match pictures would be touched.

**What I recommend:**

1. **Outfield players only.** A defender, midfielder or attacker can learn one other outfield position. Goalkeepers are left out, both ways.
2. **A learned position is played at 95% of his skill,** against 85% today for the next line and 70% for the far line. His natural position stays his best.
3. **It uses the one priority-player place you already have.** The priority player's extra work is either extra coaching, as now, or learning a position. There is no second thing to manage.
4. **It takes a fixed number of weeks,** shorter with a better coach, longer for the far line and for older players. No luck is involved, so the screen can say truthfully how many weeks are left.
5. **While he learns, he gives up the doubled coaching and nothing else.** A player of 28 or over gives up nothing, which makes this the one training choice that is worth making for an older player.
6. **Once learned, it is his for good,** with nothing to keep up week by week.

**How much it is worth, honestly.** It is the smallest of the three slices in effect. Measured on the game as it stands: almost nothing in 4-4-2 or 4-3-3, and about a quarter to half a league point a season in the four formations that need five men in one line. Its appeal is squad management: cover without a transfer, and a use for experienced players. Section 8 asks first whether that is worth a third slice.

Nine decisions for you are in section 8.

## 1. What the game does today

Measured on the game's own rules: one manager's club in Division 2, left to the game's own team selection in each formation, 60 worlds of four seasons each. The tool is `tools/position-audit.js` and it changes nothing.

**The present rules.** Every player has one position of four, and it never changes. Out of it he plays at a share of his skill:

| He is a | Played in the next line | Played in the far line | In goal |
|---|---|---|---|
| Defender, midfielder or attacker | 85% (defence and midfield, midfield and attack) | 70% (defence and attack) | 45% |
| Goalkeeper | 50% anywhere outfield | | |

The team picker fills each line with its natural players first, best first, and then fills any gap with whoever is left who is worth most there.

**How often it matters, and what it costs:**

| Formation | Weeks with a man out of position | Usually | Skill lost to it, a match | One second position, well chosen, would give back |
|---|---|---|---|---|
| 4-4-2 | 14% | an attacker in midfield | 1.9 points | 0.8 a match, about 0.10 league points a season |
| 4-3-3 | 13% | a midfielder in defence | 1.5 | 0.5, about 0.07 |
| 5-3-2 | 37% | a midfielder in defence | 5.1 | 1.9, about 0.24 |
| 3-5-2 | 36% | an attacker or defender in midfield | 4.2 | 1.6, about 0.21 |
| 5-4-1 | 42% | an attacker in defence | 7.6 | 3.5, about 0.45 |
| 4-5-1 | 39% | an attacker in midfield | 5.2 | 2.0, about 0.25 |

"Skill lost" is the effective skill the eleven gives up to the out-of-position rule, added over the eleven. "Would give back" is arithmetic on the elevens the game really picked: the one player and position that would have recovered most over the season, taken at 95%. It is chosen with hindsight, so it is the most one retraining could have done. League points are by the rule of thumb from tactics: one skill point on every man is worth about 1.4 points a season.

Five findings that shape the proposal:

1. **It hardly matters in 4-4-2 and 4-3-3, and matters often in the other four.** The starting squad has five defenders, five midfielders and four attackers. A formation that needs five in one line is short the moment one of them is injured or banned.
2. **When it happens it is felt:** four to eight points of effective skill, half a point a man.
3. **One second position recovers a third to a half of that.** So the worth of the feature is real and small: at most about half a league point a season, and close to nothing for a manager who stays in 4-4-2.
4. **Between a third and 44% of the men who play out of position are 28 or over,** depending on the formation. Experienced players are already the cover. That is the opening for older players you asked about.
5. **The computer clubs are rarely affected:** a man out of position in 11% of their sides, 1.2% of their starts. They all play 4-4-2.

One thing to know about the picker: it fills a gap with whoever is spare, and does not move a midfielder back to make room for a spare attacker in midfield. In 5-4-1, half the men out of position are attackers in defence at 70%. I am not proposing to change the picker, because that would change how every existing game picks a team. A manager who picks his own eleven already decides who covers, by whom he picks.

## 2. The proposal

The numbers here are starting values. As before, the rules would be built with a measuring bench first, and you would approve the measured figures before any screen exists.

### 2.1 Which changes are permitted

| From | Can learn | Kind |
|---|---|---|
| Defender | Midfield, or attack | next line, or far line |
| Midfielder | Defence, or attack | next line both |
| Attacker | Midfield, or defence | next line, or far line |
| Goalkeeper | Nothing | |
| Any outfield player | Not goalkeeper | |

**One second position for each player.** Learning another replaces the first, and the game asks before it does. A player's natural position never changes.

Goalkeepers are left out because the game treats them as a separate trade (45% and 50%), a squad carries two, and an outfield player who could keep goal at 95% would make the second goalkeeper pointless.

### 2.2 What a learned position is worth

**95% of his skill,** whichever line it is. Against today: 85% in the next line, 70% in the far line. So learning the far line gains more (25 points in the hundred against 10) and takes longer.

It is all or nothing: he plays at the old share until the last week is done, then at 95%. I considered letting it rise week by week. All or nothing is simpler to explain ("ready in five weeks"), simpler to prove correct, and gives no reason to check on it every week.

### 2.3 How long it takes

A fixed amount of work: **12 weeks for the next line, 20 for the far line,** at an Average coach, on Normal training, for a player of 24 to 29. Three things change the pace, and no luck is involved:

| | Slower | | Faster |
|---|---|---|---|
| **Coach** | Useless: takes two thirds longer | Average: as stated; Good: a quarter quicker | Excellent: three eighths quicker |
| **Age** | 30 and over: takes a quarter longer | 24 to 29: as stated | 23 and under: a sixth quicker |
| **Training** | Light: takes a third longer | Normal: as stated | Hard: a fifth quicker |

In weeks, on Normal training:

| | Useless coach | Average | Good | Excellent |
|---|---|---|---|---|
| Next line, aged 23 or under | 17 | 10 | 8 | 7 |
| Next line, 24 to 29 | 20 | 12 | 10 | 8 |
| Next line, 30 or over | 25 | 15 | 12 | 10 |
| Far line, aged 23 or under | 28 | 17 | 13 | 11 |
| Far line, 24 to 29 | 34 | 20 | 16 | 13 |
| Far line, 30 or over | 42 | 25 | 20 | 16 |

A season is 42 weeks, so two or three retrainings fit in a season with an Average coach, and three to five with an Excellent one, if nothing else is done with the priority place.

A week counts only if he is fit for it: not injured and not under 70 fitness, the same rule as the priority player's extra coaching. Work done is kept if he is taken off it and put back later.

### 2.4 The trade-off with normal development

**The priority player's place does one job at a time: extra coaching, or learning a position.**

* While he learns, he does **not** get the doubled coaching. He trains as an ordinary member of the squad, with his ordinary chance of improving.
* The extra sessions cost him the same point of fitness a week, and he is rested under 70, as now.
* Nobody else pays anything. With a learner in the priority place, the rest of the squad train exactly as they would with no priority player. So retraining **adds no skill and moves none.** The squad's total is untouched.

What that means in practice, from the slice 1 figures: a young prospect given a season of extra coaching gains about 1.6 points on ordinary settings instead of 1.2. A manager who spends ten or twelve of those weeks on retraining instead gives up roughly a tenth of a point of skill on that one player. The real cost is the place itself: while one man learns, no other can have extra coaching.

I considered a harsher rule, that a learner gains no skill at all. I do not recommend it. It would punish young players twice and change nothing for older ones.

### 2.5 How it is recorded, and how it affects team selection

* **On the player:** his second position, once learned; and while he is learning, what he is learning and how much work is done. Both are optional and absent on every player today.
* **In the rules:** the one function that says what a player is worth in a position answers 95% for a learned one. Team selection, team strength and the share of the goals all read it, so all three follow without being changed themselves.
* **The picker:** unchanged. It already fills a gap with whoever is worth most there, so a man who has learned the position is preferred as a matter of course.
* **The manager's own selection:** a player picked in his learned position plays at 95%, and the "@" mark for a man out of position would not be shown for it.
* **Value and wages: unchanged.** A second position does not raise what a player is worth or asks for. That closes the door on retraining players to sell them.
* **Computer clubs** never retrain anyone. A retrained player sold to one keeps what he learned.

### 2.6 How progress would be shown

No screen is designed here; only the shape, inside the part you have approved.

* Under "Priority player", once a player is chosen: two kinds of work, **Extra coaching** (as now) or **Learn a position**, with the one or two positions open to him.
* While he learns, a line of real progress: "**Learning midfield.** 7 of 12 weeks done, about 5 to go." Because nothing is left to luck, that is a count and not a forecast.
* When it is done: a line in the news, his place in the priority part freed, and both positions shown wherever his position is shown ("DEF / MID").
* The same warnings as now, and three new ones: a goalkeeper cannot learn another position; he already plays there; learning this one replaces the one he has.
* Nothing to do in any week. It is chosen once and finishes by itself.

### 2.7 Saved games, the match, balance and hot-seat

* **Saved games.** The format stays at 4. The new fields are optional and absent in every existing save. An older version ignores them: there, the player is simply what he always was. Saves would be checked both ways against 1.8.0 and 1.7.0, as for every slice so far.
* **The match engine.** The match code is not changed. One function outside it gives a different answer for a player who has learned a position, and only for him. With nobody retrained, every match must come out identical to the game before this slice, and that would be proved match for match, as "nothing chosen is 1.8.0" is proved now.
* **The match pictures.** Untouched. They draw a player in the place he is picked, as they do today.
* **Balance.** Section 4.
* **Hot-seat.** What a player has learned is kept on the player, and what the priority place is doing is kept on the club, so each manager's is his own. A retrained player sold from one manager to another keeps what he learned.

## 3. Older players

**Yes, and it is the best reason to build this.** Today training does nothing for a player of 28 or over, and the priority place is wasted on him. Retraining would be the one thing the coach can do for him, and it costs him nothing in skill, since he has none left to gain.

It also matches what the game already does. A third or more of the men who play out of position are 28 or over: the experienced players are the cover. Retraining lets a manager choose which of them covers where, and have them do it at 95% instead of 85% or 70%.

It is slower for them: a quarter longer from 30. And it does not stop the summer's decline. A 31-year-old midfielder who has learned defence is still a declining player; he is a more useful one.

## 4. Balance targets, and how they would be tested

| | Target |
|---|---|
| R1 | **Identity.** With nobody retrained, every match, every player's skill and the saved game are identical to the game before this slice, and with the earlier rules switched on, to 1.8.0. |
| R2 | **Natural is best.** No player is ever worth more in a learned position than in his own, and never more than 95% there. |
| R3 | **Worth having, never decisive.** One retraining is worth no more than 0.5 of a league point a season in any formation. A manager who retrains somebody continuously for ten seasons is never worth more than 1 point a season over the same manager who does not. |
| R4 | **No skill added or moved.** With a learner in the priority place, every player's chance of improving is exactly what it is with no priority player. |
| R5 | **No money in it.** A player's value and wage are the same with and without a second position. |
| R6 | **The weeks are the weeks.** Every row of the table in 2.3 is met exactly, and work is kept across an interruption. |
| R7 | **Goalkeepers are untouched:** nobody learns goalkeeper, no goalkeeper learns anything. |
| R8 | **Computer clubs are untouched,** except that one may field a player a manager retrained and sold. |
| R9 | **Saves, hot-seat and the switch,** as for slices 1 and 2. |

## 5. Risks

* **A squad that can all play anywhere.** One at a time, a patient manager could retrain most of his squad over several seasons, and the out-of-position rule would stop mattering to him. It is limited by 95%, by one second position a player, and by the priority place being unavailable for coaching meanwhile. R3's ten-season figure is there to measure it. If it proves too generous, the lever is the 95%.
* **The five-in-a-line formations become easier to run.** That is the point of the feature, but the formations were balanced in the tactics milestone with natural players. The bench would check that no formation becomes the one to play.
* **It touches what a team is worth in a match.** That is the most sensitive number in the game. The discipline is the same as for tactics: one switch, and a proof that nothing moves when the feature is unused.
* **More to read on a phone.** "DEF / MID" on a squad row is a few more characters where space is already tight. The layout audit would decide where it can go.
* **Small worth.** It may simply not be noticed by a manager who plays 4-4-2. That is decision 1.

## 6. Slices

| Slice | What | You would see |
|---|---|---|
| 3a | The rules and the bench. No screens. | A report with every target measured. |
| 3b | The screens, inside the approved training part. | A playable preview on your phone. |

Each stops for your approval, as slices 1 and 2 did.

## 7. Out of scope

Goalkeepers. A third position. Changing a player's natural position. A learned position fading if it is not used. Retraining by the computer clubs. Any change to how the picker arranges a team. Any effect on value or wages. Anything in the match pictures.

## 8. Decisions for you

1. **Is it worth a third slice?** My honest view: it is sound, low in risk and small in effect. It is worth building if you value the squad-management depth and a real use for older players. It is not needed for balance, and it could equally wait until after the next roadmap milestone. Either answer is reasonable.
2. **Which changes:** all outfield moves, next line and far line (recommended), or the next line only?
3. **What a learned position is worth:** 95% (recommended), or 90%, or 100%?
4. **The priority place does one job at a time** (recommended), or a separate place for retraining so that one player can have extra coaching while another learns? The second is more generous and one more thing to manage.
5. **A learner keeps his ordinary improvement** (recommended), or gains nothing while he learns?
6. **The weeks** in 2.3: 12 and 20 as the starting point?
7. **All or nothing** (recommended), or competence rising week by week?
8. **One second position a player** (recommended), or more?
9. **Order:** if yes to 1, start slice 3a now on `milestone-2-training`, or after 1.8.0 is published, or after the next milestone?

## Appendix: the audit

`WORLDS=60 SEASONS=4 node tools/position-audit.js`. One manager's club in Division 2 (the club the training bench uses), left to the game's own team selection in one formation for four seasons, in 60 different worlds, for each of the six formations. Each week it reads the eleven the game would pick and counts the men not in their own position, what each costs, and, for the season, the one player and position whose penalty cost most. Nobody is given a second position; the "would give back" figures are arithmetic on those elevens with that one penalty taken as 95%. The manager buys and sells nobody. The computer clubs' figure is from the other clubs of the same division in six of the worlds.
