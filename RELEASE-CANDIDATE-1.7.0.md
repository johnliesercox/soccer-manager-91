# Release candidate 1.7.0: Premium Dark Checkpoint C

**Released.** John gave the go-ahead to merge and deploy at 18:38 on 18 November 2026; this candidate, unchanged, was published on 18 November 2026: `main` was moved forward from `97a0748` (1.6.0) to `fe24d6c` at 18:39, with John's explicit go-ahead, and GitHub Pages reported that commit served at 18:40 (deployment 7892734120). The rest of this report is as it was written for his approval earlier that evening, when nothing was merged or deployed and the live game was 1.6.0. The brief this answers is section 3 of "Completion of current milestones, combined release and next development roadmap" (18 November).

## The candidate

| | |
|---|---|
| Version shown in the game | 1.7.0 (agreed with John on 18 November: it has never been public) |
| Branch and commit | `premium-dark`, the game file was built at `8078a95` |
| `index.html` (the deployed file) | 7,171,278 bytes, md5 `7976271030be0bb85d7fd7cf38b11f8d` |
| `soccer-manager-91.html` (the file that opens from disk, sent to John) | md5 `bbd574cee2d50d3bd728d8e8874e9113` |
| `manifest.webmanifest` | md5 `544fc28982b88987ac67c443fec92959` (the two colours changed to the new navy; nothing else) |
| `sw.js` | md5 `9d698e8d052096b1dcbcefc90a4c5aff`, unchanged; cache name `sm91-v1.7.0` |
| Save format | 4, unchanged |

What it contains: Milestones 4 and 5 and the phone smoothness pass (the tested 1.7.0 baseline, `milestone-5`), the Premium Dark interface on every screen, and the Checkpoint C work below. No feature of the roadmap's Part II is in it. `engine.js`, `src/`, `sw.js`, `build.py` and the art are byte for byte the baseline's.

## What Checkpoint C added

1. **The states that had not been seen** are now reached and recorded: Europe from the first week (the European XI, European fixtures, a European week on Home, its result and results page), a job offer on Home and in the season review, a ground the FA has restricted, a player who has left the league, game over, the sack with and without a club to go to, a real resignation and the job that follows, a ladder that answers, a rival manager's listed player, a manager retiring from a hot-seat game, a forty-name scout report and a European club's squad.
2. **Keyboard and screen reader.** Every control on every screen is reached with Tab, shows a focus ring, has a name and is in view when focused. New in this checkpoint: a row that could only be tapped (pick a player, open a player) is reached with Tab and worked with Enter or Space; focus stays on the control just used when the screen redraws, and moves to the new screen when the screen changes (only when the keyboard is in use: a finger or mouse sees no difference); the tick reads "picked" or "not picked"; a chosen option reads as pressed and the current section as current; fields that had only a heading or a placeholder have a name; the toast is announced.
3. **The toast** now shows over the club's name in the header (at the top of a screen with no header), where it covers no figure, row or button. On the match screen it stays where it was.
4. **The goal and card banner and the measuring panel** over the pitch take the new colours and type. Their sizes, and every other box on the match screen, are unchanged.
5. **What's new** has one line added at the top of 1.7.0, "A new look", as sent to John.
6. **An installed copy** takes the new navy for its splash screen and bar. The app icons are unchanged.

`?classic` in the address still draws the old look, for comparison through release QA.

## Coverage

The journeys in `tools/ui-parity.js` play three seeded games: one manager through a season into the next summer (`single`), three managers through a week and a retirement (`hotseat`), and the "Big job" start with Europe, the forced rare states and a resignation (`big`). 165 stops, each on a phone and a desktop.

| Area | States seen | Stops |
|---|---|---|
| Title, help, What's new | title; help from the title and in a game; What's new | 4 |
| Hall of fame and ladder | ladder unreachable; a ladder that answers, with a nickname and on a second board; Your careers; in a game | 7 |
| New game | one manager with the five starts; a start chosen; three managers; Big job | 5 |
| Home | first week; overdrawn; later weeks; Resign asked and lapsed; pre-season pending; a European week; a job offer; a ground warning; after a resignation; hot-seat with Retire | 17 |
| Pre-season | three sponsors, four prices, signed, done, second season | 5 |
| Fixtures and results | fixtures at three points and with Europe; results empty, by division, with Europe, hot-seat; the week screen for a league game, a cup game, a European game and no game; the match result for league and cup | 22 |
| Saves | none, one, Delete asked, deleted | 4 |
| Squad | formations, training, picking, later weeks; the European XI switch, empty and picked | 9 |
| Player | own player (list, unlist, terms, contract, Release asked, rename, pick); another club's, a bid; a listed one; a free agent, signed; a youth player, Let him go asked, promoted; a rival manager's, a bid; a European player; a player who has left the league | 22 |
| Market | For sale, Buy, Free empty and full, Offers empty, with an offer, rejected, from a rival; Scout brief, reports of ten and forty names, a division, Europe with and without the scout for it, a club, a European club; rivals' lists empty and with a player | 24 |
| Tables | own division, another, with scorers, second season, with Europe; managers' table at three points, one with a manager who walked away | 8 |
| Records | empty, after a season | 2 |
| Club | Money (start, loan, settled, later, second season); Ground (advice, price, safety, stand, crowds, restricted); Staff (start, scout hired, excellent); Youth (empty, upgrade, intake); Name (own, another, cancelled) | 21 |
| Season end | review; review with a job offer; game over; sacked with a club offered, with none, resigned | 7 |
| Hot-seat | the hand-over four times (the last after a retirement), the shared week screen, Home after a retirement | 6 |
| Matchday | the choice before a match; the match screen at full time | 2 |

**Still not seen on screen:** a results page and week screen for a European final or a penalty shoot-out in Europe; a hot-seat game with eight managers (three were played); the builders' line on Home at the same time as a job offer. Each is drawn by the same components as states that were seen.

**Set by hand, not reached by play:** the job offer, the ground restriction, the departed player, game over and the two sack screens were put on screen by setting the game into that state, identically in the old and new builds, and putting it back. The seeded Big job season ended third and the board kept the manager on, so the sack was not reached by play; the resignation was real.

## Test results

All on the candidate file above.

| Check | Result |
|---|---|
| Same words, controls and saved games as the 1.7.0 baseline (`tools/ui-parity.js`, 165 stops, phone and desktop) | no differences in 330 stops, apart from the line added on purpose to What's new (43 words added, none lost, the same controls) and the five words added at Checkpoint A. The three saved games are identical: one manager into a second season, three managers after a week and a retirement, the Big job after a season and a resignation |
| The old look is still there (`?classic` against the baseline, picture by picture) | 486 of 513 pictures identical to the pixel. The 27 others: the Squad team line, smoothed differently (18); the What's new line (2); a toast or a ladder reply caught mid-change (7) |
| Five screen sizes (`--layout`, 165 stops at each of 360x640, 390x664, 844x390, 1366x768, 1920x1080) | nothing wider than the screen, off it, cut short or too small, at any stop or size |
| Keyboard (`--keys`, Tab through all 165 stops at a phone and a desktop size, then a walk-through) | every control reached, named, ringed and in view: 2,843 controls visited at each size; the nine walk-through checks pass. The same check on the build before this checkpoint flagged 96 of 330 stops: 768 visits to rows that Tab could not reach and four kinds of field with no name |
| The match screen's boxes (`--stage`, old look against new at eleven sizes, in play and at full time) | every box in the same place and the same size |
| The match picture (`tools/frame-reference.js`, 198 whole frames) | identical to the pixel |
| The match screen at five sizes (`tools/viewport-audit.js`), including the banner clear of the goal | passes at all five |
| The 21 suites | 20 passed first time. `test-phase25` failed one of its checks, a stopwatch on building a match scene (421 ms against a limit of 400), then failed it three more times straight after the soak audit (400 to 427 ms) and passed four times once the machine was idle (343 to 394 ms). The code it times is byte for byte the 1.7.0 baseline's and gave 379 and 380 ms earlier in the day; this is the test machine's speed, not the candidate. Every other check in that suite passed every time |
| Saves from the live 1.6.0 and back (`tools/save-compat.js`: the service worker swaps its cache, saves resume and play on) | 19 of 19 each way |
| Soak audit (`tools/soak-audit.js . out all`): memory over ten matches, the isometric view made to fail four ways, offline, a three-manager hot-seat, the measuring screen, six awkward situations | passed, every part. Offline: with no network the game loads again, starts a game, shows a match, plays on and resumes from its autosave |
| Matchday pacing on the phone stand-in (`tools/phone-probe.js . 6`, twice) | 58.5 and 57.4 frames a second, 0.3% of frames slower than 30 a second |
| Engine, matchday source, service worker, build script, art | not one line changed from the 1.7.0 baseline |

## Known issues and accepted limitations

None of these is new in this candidate.

* **A footballer's hairstyle can change during a match.** Reported by John; it is the first item of the roadmap after release (Milestone 0) and is not fixed here.
* Phone landscape is unchanged, by John's decision: the stage is 820 by 203 px and two or three players are in view.
* The whole-pitch camera on an upright phone fills only the middle third of the stage.
* One long frame of about a quarter of a second remained in the measured minute on the Galaxy S23 Ultra; most of it was not the game's drawing.
* No mid-range Android phone and no iPhone has been measured. Lower-detail settings are not built.
* Art: the near terrace is the right end's painting mirrored; the crowd figures are chunky; the referee's raised card is a few pixels.
* Pinch-zoom is switched off for the whole page, as it always has been. A player who needs larger type has the browser's own text size setting. Left as it is; say if it should change.
* The football pitch itself is a picture and has no description for a screen reader; the commentary line and the event log beside it are read out as they change.
* A browser from before 2022 shows a table's head row with square corners inside its rounded card.

## For your Galaxy

1. Open `soccer-manager-91-1.7.0-rc1.html` in Chrome.
2. Title screen, What's new, "Measure the match frame rate", then watch any match for a minute and send the panel that appears. The figure to compare with is 59.6 frames a second, slowest 5% 16.8 ms, 2 frames longer than 50 ms.
3. While there: a goal or a booking shows the banner in its new look; the toast shows over the club's name.

The installed-app colours and the update from 1.6.0 can only be seen on the live site; they are covered here by the save and offline tests and are on the list to verify the moment the release is live.

## What happens after approval

In the order of the brief's section 4, each with your go-ahead where it says so: confirm `main` is still the `v1.6.0` tag; complete the release sections of the Milestone 6 documents; decide where the nine art archives live; **your explicit permission to merge and deploy**; verify the live site (update from 1.6.0, version, matchday, offline, an old save and a new one, hot-seat); you tag the live commit; a short signed-off summary. Nothing in the candidate changes between your approval and the merge.
