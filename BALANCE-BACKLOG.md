# Soccer Manager '91: gameplay-balancing backlog

Opened 27 November 2026 at John's request. Things known about the balance of the game that are **not being worked on**, kept here so that a later, deliberate piece of work can pick them up. Nothing here is authorised for work. The match pictures have their own list (`MATCHDAY-BACKLOG.md`) and so has the artwork (`ARTWORK-BACKLOG.md`).

## 1. A manager's club develops its players faster than a computer club, and the gap grows every season

**John's decision, 27 November 2026:** the computer clubs' training behaviour is not to change in the training milestone. This is recorded "as a specific item for investigation". For now the existing behaviour is preserved.

**What is known.** It was measured for the training milestone (`TRAINING-SLICE-1.md`, section 5; `node tools/training-balance.js`, the line called "none").

* Only a manager's club trains during the season. The computer clubs' players change only in the summer. This has been so since before 1.8.0; the training milestone did not create it and does not add to it.
* On the settings every game starts with (Normal, an average coach), a manager's first eleven is 0.7 of a skill point a man better after one season than it would be with no weekly training, and 4.6 better after ten. With the best coach: 1.7 after one season and 7.9 after ten.
* For scale, one skill point on every man is worth about 1.4 league points a season between equal sides. In the league the effect is smaller than that arithmetic, because a club that improves is promoted and meets better sides: after ten seasons the club with no weekly training is on average in Division 2.2, the club on the starting settings in 1.9, and the club with the best coach in 1.7.
* The training focus and the priority player do not add to the gap. A manager using every lever for his first eleven was never more than 0.1 of a skill point a man ahead of the same manager on Balanced.
* A caution on the figures: the measured manager buys and sells nobody, so they are fair against each other and are not a forecast of a real career.

**The two honest routes, if it is ever to be narrowed.** Give the computer clubs weekly training, or lower what a manager's training gives. Either is a rebalancing of the whole league and not a training feature.

**What must be understood before anything is changed** (John's list):

* long careers: what twenty seasons look like for a manager and for the league;
* player development: the spread of skill and potential across the divisions, and whether the league's average skill drifts;
* transfers: values, wages and what the computer clubs can afford, since value rises steeply with skill;
* competition difficulty: promotion and relegation rates, and how hard each division is for a new manager;
* saved-game compatibility: a save made before the change must carry on sensibly after it, and the format should stay at 4.

**How it would start.** With a proposal and a measuring bench, as tactics and training did, and with a switch that plays the present rules so that "nothing else moved" can be proved.
