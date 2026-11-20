# Tactics, slice 2: the screens

**Checkpoint for John, 19 November 2026.** Milestone 1 of the roadmap (advanced tactics), slice 2 of three, as you approved it on 19 November after the slice 1 report (`TACTICS-SLICE-1.md`).

**Status.** Built and tested on the branch `milestone-1-tactics`. Not merged to `main`, not deployed. The live site is still 1.7.0.

**Approved by John on 20 November 2026, with these decisions, all now applied.** The card stays one line with a Change button on a phone and open on a desktop. The explanations use more natural football language with the numbers kept ("Makes your attack approximately 10% stronger"), and the tests that hold them to the engine stay. The button reads "Reset to default plan" and the plan with nothing set is called the default plan, because its settings are not all named Balanced. The opponent's reputation is approved as option A (one known characteristic), leaving the rest for a future scouting module; no previous-match intelligence yet. After a match the line says "Possession", stays compact including in the hot-seat summary, and keeps the note that the figures are estimates from the simulation, not counted from individual passes and shots. **The next release is 1.8.0**: the hair fix and all three tactics slices together, with no separate 1.7.1; 1.7.0 stays the live baseline and nothing is merged or deployed until the whole milestone is complete, tested and approved. Development builds are labelled 1.8.0-dev and a number. Slice 3 begins with a measurement and a proposal: `TACTICS-SLICE-3-PROPOSAL.md`.

The report below is as it was at the checkpoint, except that section 3 and the quoted lines show the wording as refined.

## 1. In short

* **The Match plan card is on the Squad screen**, between the formation and training, in the Premium Dark system. Four controls, three settings each, one tap to change one.
* **Every setting says what is for it, what is against it and what it suits**, in a line each. What the card says is checked against what the engine does: if a number in the engine changes, the test that reads the card fails until the words are put right.
* **The easy default is kept.** A new game is all Balanced. On a phone the card is a single line ("Default plan. Leave it as it is and the side plays as it always has.") with a Change button, so the squad list stays where it was. On a desktop there is room, so the card is open. "Reset to default plan" is one tap.
* **One plan for every match**, domestic and European, as you decided.
* **The opponent: a reputation, not a plan.** Before a match you are told one true thing a club is known for ("Known for pressing high."), and only one. Never its mentality, never its whole plan, never how it will answer your formation. That is my proposal for your review (section 4), with the alternatives.
* **After the match: one line.** "Possession: Tottenham 44%, Leeds 56%. Chances worth: Tottenham 1.7 goals, Leeds 1.3." with a smaller line under it: "Estimates from the match simulation, not counted from individual passes and shots."
* **Nothing else moved.** With the 1.7.1 rules switch every screen is identical to 1.7.1. Saves work both ways, now tested with plans set, and stay at format 4. The balance bench is unchanged and still passes.
* **Five things for you to decide** are in section 7.

## 2. What you will see

Pictures are attached with this report: the Squad screen on a phone with the card shut and open, the same on a desktop, Home, and the screen after a match.

**Squad screen.** Under the formation buttons, a card headed "Match plan".

* Shut (the phone's default): the plan in words and a Change button. "Default plan." for a manager who has set nothing; otherwise, for example, "Attacking, Short passing, High press."
* Open: four rows headed Mentality, Passing, Pressing and Shooting. Each row is three buttons, the chosen one in amber like the formation and training buttons. Under each row, the chosen setting's three lines: For (green), Against (red), Suits (blue). The colours are an extra; the words For, Against and Suits carry the meaning. The middle setting has one line saying it changes nothing.
* At the foot of the open card: "Reset to default plan" (only when something is set), and the next fixture with what the opponent is known for, so the hint is beside the decision.
* It works with the keyboard and a screen reader like every other control: each row is announced by its name and the chosen setting says it is chosen.

**Home.** Under the next fixture: what the opponent is known for. Among the rows (League, Board, cups, Selected): "Match plan" with the plan in words, so you can see what you are about to play without opening Squad.

**After the match.** Under the scorers, the line of figures above. In a hot-seat game the week's summary gives each manager's figures in short ("Possession 55% to 45%. Chances worth 2.9 goals to 1.0.") with one note below saying home side first and where the figures come from.

**How to play** has a short section on the match plan.

## 3. What each setting says

These are the words on the card. They are yours to change; each is held to the engine by a test.

| Control | Setting | For | Against | Suits |
|---|---|---|---|---|
| Mentality | Defensive | Makes your defence approximately 10% stronger, so you concede fewer. | Makes your attack approximately 10% weaker. | The weaker side, and playing away. |
| | Balanced | No lean either way. | | |
| | Attacking | Makes your attack approximately 10% stronger. | Makes your defence approximately 10% weaker: more goals at both ends. | The stronger side, and playing at home. |
| Passing | Short | Makes possession count: the more of the ball you have, the more chances you create. | With less of the ball you create less, and a high press wins it back from you. | A stronger midfield. Good against a low press. |
| | Mixed | A mix of short and long. Possession matters as usual. | | |
| | Direct | You create chances without needing much possession, and long balls get in behind a high press. | Wastes a midfield that is on top, and a deep defence deals with long balls comfortably. | A weaker midfield. Good against a high press. |
| Pressing | Low | Makes your defence approximately 5% stronger, with around 20% fewer bookings. | Around 2% less possession. | Good against direct passing, poor against short. |
| | Normal | No extra running, no extra risk. | | |
| | High | Around 2% more possession. | Leaves space behind (your defence is approximately 5% weaker), tires your players (each loses 8 fitness per match instead of 7) and brings around 20% more bookings. | Good against short passing, poor against direct. Needs a fit squad. |
| Shooting | Work it in | More consistent in front of goal: fewer off days. Your forwards score a bigger share of the goals. | Fewer days when everything goes in, and a deep defence is harder to break down. | Good against an Attacking side. |
| | Balanced | Shoot when the chance is on. Goals shared between forwards and midfielders as usual. | | |
| | On sight | More days when everything flies in. Your midfielders score a bigger share of the goals. | More off days too, and an Attacking side punishes the wasted possession. | Good against a Defensive side. |

High pressing is the example you gave: it says the gain in possession beside the tired legs, the bookings and the room left behind.

## 4. The opponent: my proposal, and the alternatives

You asked for a simple way to give an opponent's likely style without handing over perfect information, and without making scouting redundant later.

**What is built (A): a reputation.** Each computer club has a fixed style of passing, pressing and shooting (slice 1). A club is "known for" one of those, chosen by the club itself and the same in every game: keeping the ball, playing it long, sitting deep, pressing high, patience in front of goal, or shooting on sight. A club whose style is in the middle on all three is "Not known for any one way of playing." Of the 128 clubs, 110 are known for something and 18 for nothing. For 53 of the 110, the thing they are known for is the only marked thing about their style; the other 57 have one or two more that the game does not tell you.

What it does not tell you, and what scouting could later sell:

* the club's other traits (Burnley are "known for playing it long", and are also patient in front of goal, which the game does not say);
* its mentality for this match, which depends on where it is played and how strong you are;
* that it will change its passing to answer three or five in your midfield;
* anything at all about a club that says "not known for any one way of playing".

So a reputation is a true hint that rewards attention, and it is perhaps a third of the picture. For a club with a human manager (hot-seat) it says only who manages it.

**The alternatives.**

| | What the manager sees | For | Against |
|---|---|---|---|
| A, built | One thing the club is known for | Simple, true, and leaves most of the plan for scouting | A club with one marked trait is fully read on that trait |
| B | Nothing until scouting exists | Leaves everything for scouting | Pressing and shooting are answers to the other side; with nothing to go on they are guesses, and the after-match line becomes the only clue |
| C | The whole plan, as in the sample pictures of the specification | Most to think about now | Makes scouting redundant, which you ruled out |
| D | A, plus what they did against you once you have played them | A reason to remember the first meeting | More on the screen; better decided with scouting |

I recommend A. Changing between A, B and C is small: the rule is one function in the engine (`styleHint`) and one line on two screens.

## 5. What changed in the code

* `ui.html`: the card, its three actions (choose a setting, back to Balanced, open or shut), the reputation line on Home and on the card, the plan row on Home, the figures after a match (single game and hot-seat summary), the section in How to play, and the styles for both looks. All of it is hidden when the 1.7.1 rules switch is on.
* `engine.js`: `styleHint` (what a club is known for; arithmetic on the club's id, no random number), `resetTactics`, and `setTactics` now leaves no entry on a club whose four settings are all back in the middle, so trying the card and putting it back leaves a save exactly as it was. Nothing that a match is drawn from has changed since slice 1; the balance bench gives the same figures.
* `tools/save-compat.js` now sets match plans before saving, on a build that has them, and checks they come through an update either way. `tools/ui-parity.js` has stops for the card open, set, reset and shut.
* The build calls itself **1.7.1-tactics2**: a development label, not a release number.

Not done, on purpose: no entry in What's new yet, because it would have to sit under a version number and the number and the release sequence are still to be agreed (section 7). The wording I would propose is there.

## 6. Testing

Everything below was run on the build of this checkpoint (`index.html`, labelled 1.7.1-tactics2); "against 1.7.1" means the build on `milestone-0-hair`.

| Check | Result |
|---|---|
| The 23 test suites (the 22 of slice 1 and the new `test-tactics-ui.js`) | All pass. |
| `test-tactics-ui.js`, new: the screens, driven through the built game | 70 checks. The card and where it sits; every one of the twelve settings stored, shown as chosen and explained; **the words on the card against the engine's numbers** ("about a tenth", "about two points of the ball", "8 fitness, not 7", "about a fifth" of bookings, who scores, which setting answers which); the summary line, the reset, opening and shutting; one plan in the European view; Home's plan row and the reputation line (one true thing, never the mentality or the whole plan); the match played to the plan set on the screen; the figures after it equal to the match record and marked as the engine's; a phone-width screen; a hot-seat game where each manager sees, sets and plays only his own plan; a 1.7.1 save opened, a plan set on it, and that save opened again in the 1.7.1 engine; and nothing of tactics shown under the 1.7.1 rules switch. |
| `test-tactics.js` | 14,933 checks, with new ones for the reputation rule (one true thing about a club's style or nothing, the same in every game, none for a human's club, no random number) and for a plan put back to Balanced leaving no trace. The quick balance bench inside it: 14 targets met. |
| The balance bench in full (`--play --league --worth`) | Every target met, and the output is the same as at slice 1, line for line: nothing a match is drawn from has changed. |
| The screens, against 1.7.1, with `?rules=1.7` | No differences in 340 stops (phone and desktop; the journeys now include five stops for the plan card, which are the plain Squad screen when the rules are off). The saved games at the end are the same to the byte. |
| The same journeys with the rules on | Run to the end with no page errors, on both looks. They differ from 1.7.1 where they should: the card, the plan row and reputation on Home, the figures after matches, How to play, and results. |
| Layout at every stop, at five screen sizes from 360 wide to 1920 (two phones upright, a phone on its side, two desktops), including the card open, set, reset and shut | Nothing wider than the screen, off it, cut short or too small. |
| Keyboard | Every control at every stop reached by Tab, with a name and a focus ring, in view: 3,153 on the phone journey and 3,237 on the desktop one (2,846 before the card). |
| The match pictures, against 1.7.1, with `?rules=1.7` | All 198 frames, all 61,248 player pictures and all 1,717 ground tiles pixel for pixel. Every box on the match screen where it was. All viewport checks pass. |
| Saves, both ways, now with plans | From 1.7.1, 1.7.0 and 1.6.0 to this build: games resume exactly, and a plan set after the update is saved and the next match is played to it (21 checks each). From this build to 1.7.1, 1.7.0 and 1.6.0: games saved with plans set (a single manager's, and one of three hot-seat managers') resume exactly, plans still in the save, and play on without them (22 checks each). Format 4 throughout. |
| Soak | 44 checks, all pass. |
| The hair audit and the converter's test | Both pass. |
| The phone stand-in (processor slowed six times) | Passes: 5.1 and 5.0 ms of the page's code a frame in two runs, 5.3 for 1.7.1. `test-phase25.js`, whose stopwatch is touchy on a busy machine, passes on its own at 367 ms against 400. |

**After the wording refinements of 20 November (the build labelled 1.8.0-dev2):** all 23 suites pass again, with `test-tactics-ui.js` now checking the new words against the engine ("approximately 10%" for mentality, "approximately 5%" for the defence when pressing, "around 2%" possession, "around 20%" bookings, "8 fitness per match instead of 7"); the screens with `?rules=1.7` show no differences from 1.7.1 in 340 stops; the layout check finds nothing wider than the screen, cut short or too small at any of the five sizes with the longer lines; the keyboard check reaches all 3,153 and 3,237 controls; saves pass both ways against 1.7.1 and 1.7.0 with plans set; the 198 reference frames are pixel for pixel; the hair audit passes. Nothing in the engine changed, so the balance bench was not affected.

**Not tested, and why you are the test:** how the card feels under a thumb. The tools prove it fits, works and says true things at every size; whether one line with a Change button is the right default on your phone is for you to judge (decision 1).

## 7. For you to decide

1. **The card on a phone: one line with a Change button, opening to the full card.** I chose this so that the squad list, which is what a manager uses most, is not pushed a screen and a half down. The alternative is always open, as on the desktop. Say after you have tried it on your phone.
2. **The wording in section 3.** Any line you would put differently.
3. **The opponent's reputation (section 4): keep A, or B or C?**
4. **The line after the match.** "Share of the ball" and "Chances worth ... goals" are the plainest words I could find for possession and the quality of chances. If you would rather "Possession 44% to 56%", that is a one-word change.
5. **What's new, and the release.** Proposed wording, for whichever version this goes out as: "Tell them how to play. A match plan on the Squad screen: mentality, passing, pressing and shooting, each setting with what is for it and against it. All Balanced is the side as it was. Other managers have plans too, the formations are evened up, and after a match you see each side's share of the ball and what its chances were worth." As you said, the hair fix is on this branch and not on the public site, so the first release from here carries both; the number and the order are yours to set before anything is deployed.

And then: **go ahead with slice 3?** The match pictures leaning the way the plans point (a Direct side should not pass short all through a highlight), without changing a result or an animation. I would start it, as with the others, by measuring what the pictures do today and bringing you a short proposal before changing anything. The camera limit recorded in `TACTICS-SLICE-1.md` (section 7) waits there for that slice, as you asked.

## 8. Where things are

* Branch `milestone-1-tactics` on GitHub. `main` is untouched (1.7.0, tagged `v1.7.0`).
* The screen tests: `node test-tactics-ui.js`. The engine tests and the balance bench: `node test-tactics.js`, `node tools/tactics-balance.js`.
* The words on the card: the `PLAN` table in `ui.html`. What a club is known for: `styleHint` in `engine.js` and `REPUTE` in `ui.html`.
