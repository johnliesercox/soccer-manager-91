# Premium Dark: the management reskin

Master specification: John's "Premium Dark Management UI Reskin" brief of 18 November 2026 and its six concept images. The existing game is the source of truth for every word, figure, action and flow. This file records how the brief is being carried out.

**Status: Checkpoint C done on 18 November; the release candidate awaits John's approval.** Checkpoints A and B were approved the same day. `RELEASE-CANDIDATE-1.7.0.md` has the candidate's hashes, the coverage table, every test result and the known issues; this file is the record of how the reskin is built. Branch `premium-dark`, from the tested 1.7.0 baseline (`milestone-5`). Nothing is merged or deployed.

## How it is built

* **One switch.** `render()` in `ui.html` puts the class `pd` on `<body>`. All the new rules sit under `body.pd` in the stylesheet: one block headed "Premium Dark" for the management screens and one at the end for the match screen. Adding `?classic` to the address leaves the class off and draws every screen in the old look, for comparison. That is a developer's aid, not a setting: the game offers no choice of look.
* **One markup.** The screens' markup gained wrappers (`section.card`, `.cols`, `.flow`, `.grp`), a few class names, inline SVG icons, and four `<label>` elements where a field's caption was a paragraph. The old stylesheet gives none of them any style and hides the icons, so the same markup draws in either look.
* **Grouping by one helper.** `cards(html, options)` takes what a screen already writes and wraps it: the page heading stays on top, and each `<h2>` with what follows it becomes one card. It adds, removes and reorders nothing. Most screens are grouped by that one call, so a screen's words and controls are still written in one place, as they were.
* **Buttons take their role from their action.** Which buttons are amber, blue or the warning colour is decided in the stylesheet from the button's existing `data-a` name. No button was given a new name, class or handler.
* **The match screen is styled from the stylesheet alone.** No file under `src/` is changed. Every size on that screen is the old size, so the stage and the picture on it are exactly what they were (`tools/ui-parity.js --stage` checks every box). The goal and card banner and the measuring panel over the pitch take the new colours and type as well (Checkpoint C).
* **Keyboard and screen reader support is one function and two listeners** (`a11y()`, a `keydown` and a `pointerdown` listener in `ui.html`), added at Checkpoint C. They add names, states and focus handling and change nothing that a tap or a click does.
* **One newer CSS feature.** `:has()` is used once, to round the corners of a table that sits directly in a card. A browser without it (before 2022) shows the same table with square corners.
* **Nothing else.** No click handler, action name, id, label, figure, saved field, engine call or matchday file is changed. `git diff milestone-5 -- engine.js src/ sw.js build.py assets/ manifest.webmanifest` is empty.
* **To undo it:** make `pdOn` return false (or delete the two "Premium Dark" blocks); the wrappers are inert.

## Design tokens (CSS variables on `body.pd`)

| Variable | Value | Used for | Contrast on its background |
|---|---|---|---|
| `--pg` | `#07131E` | page background | |
| `--panel` | `#102637` | cards | |
| `--panel2` | `#18354A` | buttons at rest, table heads, chips, the balance row | |
| `--line` / `--line2` | `#466C82` / the same at half strength | button borders / card borders and rules | |
| `--tx` | `#F4F7FA` | primary text, figures | 14.4 : 1 on a card, 17.4 : 1 on the page |
| `--tx2` | `#B6CFDE` | secondary text, the label of a figure | 9.6 : 1 on a card, 7.9 : 1 on the balance row |
| `--mut` | `#7EA8BF` | the small line under a name, the week tag in the ledger | 6.1 : 1 |
| `--sky` | `#86C5EE` | section labels, table heads, icons (not in the brief's table; the concepts use it for exactly these) | 8.3 : 1 on a card, 6.8 : 1 on a table head |
| `--amber` | `#FFAC22` | the chosen option, the active section, the way forward, key figures, the managed club's row | 8.3 : 1 on a card; 6.2 : 1 on the managed club's row; dark text on amber 9.8 : 1 |
| `--warn` | `#F08A75` | an overdrawn balance, a ground restriction, a ban, the injured and suspended lines, a sponsor's clawback, the "Really?" state of a destructive button | 6.3 : 1 on a card; dark text on it 7.4 : 1 |
| (blue) | `#1B5C96` | a button that confirms a decision (see Components) | white on it 7.0 : 1 |
| (field) | `#EAF1F6` | text fields | typed text 15.5 : 1, placeholder 5.3 : 1 |
| `--ok` | `#75C5A6` | defined, not used: the game marks nothing as "positive" that amber does not already mark | |
| `--ink` | `#1B1205` | text on amber | |

Every pair meets WCAG AA for normal text (4.5 : 1); the lowest is 5.2 : 1.

**Type.** The system sans-serif (`system-ui`, then the usual fallbacks): nothing is downloaded. Figures use `font-variant-numeric: tabular-nums` so pounds, skills, points and ages line up. The wordmark is the same face, heavy italic capitals with '91 in amber and two slanted stripes, as the concepts have it.

## Components

| Component | Class or rule | Notes |
|---|---|---|
| Shell: wordmark, status, balance | `header .brand`, `.wm`, `.st`, `.bal` | the same three lines of status as before; the balance turns to the warning colour when overdrawn |
| Shell: club | `header .clubbar`, `.club` | the club's real name; the manager's name under it in a multi-manager game, as before. A drawn stadium silhouette (inline SVG, 1.8 KB, held once in `--stad`) sits behind it and across the top of the title screen |
| Card | `section.card`; `.row2` with a leading icon; `.kvs` Home's status rows; `.kvl` a list of results; `.tb` holding a table; `.nw` news with an amber edge | a table directly inside a plain card runs edge to edge |
| Page title | `h1.pg` | capitals with an amber rule |
| Name or headline | `h1.hero` | a player's name (with an icon tile), the week's result |
| Section label | `h2` inside a card, `h1.lab`, `.lab` | small capitals in `--sky` |
| A figure and its label | `.kv` | label left in `--tx2`, figure right in `--tx`; `.kv.lead` is the balance at the head of Finances. Home keeps the rows it was approved with (icon and bold label) |
| Button | `.b` | quiet by default; `.on` amber (chosen); `.amber` outlined amber (Buy, Set them yourself); focus ring amber |
| Button: the way forward | amber fill | Start, Take the job, the first button of the title screen, "I'm (name)", Watch the match, Pick for or Drop from the XI on a player's page, and the action bar as before |
| Button: confirming a decision | blue fill | list or unlist a player, bid, sign, offer a contract, rename, promote, upgrade the academy, save a game, take or repay a loan's settlement, accept an offer or a job, join the ladder, Send him out |
| Button: destructive | warning fill once tapped | Resign, Abandon, Retire, Release, Let him go, Delete a save: quiet until tapped, then the warning colour with the "Really?" wording the game already used |
| Choice group | `.grid2`, `.grid3`, `.tabs` | 40 px tall or more; the eight "how many managers" buttons become two rows of four on a phone so each is a fingertip wide |
| Field | `input`, `label` | light field, dark text, amber focus ring; the four name fields now have real labels |
| Table | `table`, `table.tight`, `th`, `td.n`, `td.wrap`, `.pos` chip, `.tick`, `tr.sel`, `.sk` (a skill with the rise he could make, ▲, in a slot of its own in front of it, so the skills line up down the column) | `tr.me` (the managed club, the current week, your row on the ladder) in amber; promotion and relegation lines as dashes |
| Meter | `.bar` | ground safety and average fill |
| Title, hand-over, end of a job | `.title`, `.logo`, `.sub` | the wordmark large; a manager's name or "Sacked" in the same style |
| Scoreboard | `.clock`, `.score`, `.events`, `.md-tie` | the match result and the fixture card before a match |
| Match screen surround | `.md-board`, `.md-clock`, `.md-comm`, `.md-log`, `.md-controls`, `.md-controls2` | colour and type only; every size is the old one. The chosen speed is now marked (amber outline), which the old look did not show |
| Navigation | `nav button`, `.on` | icon over label on a phone, beside it on a desktop |
| Main action | `.action .b` | amber, 50 px |
| Toast, update bar | `.toast`, `.toast.top`, `#updatebar` | restyled. In the new look the toast shows over the club's name in the header (`toastPlace()`), or at the top of a screen with no header, so it covers no figure, row or button; on the match screen it stays low, where it was |
| Banner and measuring panel over the pitch | `.md-badge`, `.md-meter` | new colours and type; the old text sizes and padding |
| Keyboard focus | `:focus-visible` on `.b`, `nav button`, `input`, `tr.tap` | an amber ring; a focused row is tinted |

Icons are 20 hand-drawn line paths in `ICONS` (`ui.html`), drawn by `ic(name)`, always beside a visible label and hidden from screen readers (`aria-hidden`).

**Wide screens (900 px and up).** The app widens from 520 px to 1,180 px. Home and Squad use two fixed columns (`.cols`). Screens made of several cards let them run in two balanced columns (`.flow`): a player's page, League tables, the five Club tabs, Records, How to play, What's new, Pre-season, the season review. Screens that are one list or one decision keep to a centred 760 px column: the title, setup, Hall of fame, fixtures, results, saves, the managers' table, the hand-over, the match choice and result. The navigation spells its labels beside the icons. Below 900 px, including a phone held sideways, the layout is the single column it was.

**The browser's bar colour** (`theme-color`) follows the look: dark navy, or the old blue with `?classic`. An installed copy's splash screen and bar take the same navy from `manifest.webmanifest` (changed at Checkpoint C for the release); the app icons are unchanged.

## Asset inventory

Nothing is fetched at run time and no image file was added. The whole reskin is text inside `index.html`: about 27 KB of CSS (1.8 KB of it the stadium drawing) and 1.3 KB of icon paths. `index.html` grows from 7,131,899 bytes (1.7.0) to 7,166,508, about 35 KB or half of one percent.

The app icons are unchanged and still blue; a new icon would be new artwork and is out of scope.

## Coverage: every screen and where it is checked

`tools/ui-parity.js` plays two seeded games (one manager through a whole season and into the next summer; two managers through a week) and stops 123 times. "Stops" below are the names it records under.

| Brief's area | Screens and states | Stops |
|---|---|---|
| Title and welcome | title; Hall of fame from the title (ladder unreachable, a second board, Your careers empty); What's new; How to play | `title`, `hof-ladder`, `hof-board`, `hof-mine`, `whatsnew`, `help` |
| New-game setup | one manager with the five starts, a start chosen, three managers, two managers | `setup`, `setup-mode`, `setup-three`, `hotseat/setup-two` |
| Home | week 1, after business (overdrawn), week 2, Resign asked and lapsed, second season with pre-season pending, hot-seat with Retire | `home-week1`, `home-after`, `home-week2`, `home-resign-really`, `home-resign-lapsed`, `home-season2`, `home-season2-week2`, `hotseat/home-hotseat`, `hotseat/home-retire-really`, `hotseat/home-second`, `hotseat/home-hotseat-week2` |
| Pre-season decisions | three sponsors and four ticket prices, sponsor signed, both done, the second season's | `preseason`, `preseason-sponsor`, `preseason-done`, `preseason-season2`, `preseason-season2-done` |
| Fixtures and results | fixtures before a ball is kicked, after a week, in the second season; results none, league by division, cup, the week screen with a league game, a cup game and no game; the match result | `fixtures`, `fixtures-week2`, `fixtures-season2`, `results-none`, `results`, `results-div1`, `weekdone`, `seen-weekdone-league`, `seen-weekdone-cup`, `seen-weekdone-no-match`, `matchresult`, `seen-matchresult-league`, `seen-matchresult-cup` |
| Saved games | none saved, one saved, Delete asked, deleted | `saves`, `saves-one`, `saves-really`, `saves-deleted` |
| Squad and tactics | as at Checkpoint A, plus the second week and second season | `squad`, `squad-433`, `squad-hard`, `squad-dropped`, `squad-week2`, `squad-season2` |
| Player detail | own player: listed, unlisted, contract terms chosen, contract offered, Release asked, renamed, picked; another club's player and a bid; a listed player; a free agent and his signing; a youth player, Let him go asked, promoted; a rival manager's player and a bid | `player-mine`, `player-listed`, `player-unlisted`, `player-terms`, `player-contract`, `player-release-really`, `player-renamed`, `player-toggled`, `player-second-listed`, `player-other`, `player-bid`, `player-for-sale`, `player-free`, `player-free-signed`, `player-youth`, `player-youth-really`, `player-youth-promoted`, `hotseat/player-rival`, `hotseat/player-rival-bid` |
| Transfer market | For sale, Buy, Free (empty and 21 in the summer), Offers (empty, with an offer, rejected, from a rival), Scout brief, a scout's report, browse a division, Europe without the scout for it, a club's squad, rivals' lists | `market-for-sale`, `market-after-buy`, `market-free`, `market-free-summer`, `market-offers`, `seen-offers`, `seen-offers-rejected`, `hotseat/market-offers-rival`, `hotseat/market-offers-rejected`, `market-scout`, `market-scout-brief`, `market-scout-report`, `market-scout-div3`, `market-scout-europe`, `market-scout-club`, `market-week2`, `hotseat/market-hotseat`, `hotseat/market-rival-club` |
| League tables | own division, another, with scorers, the second season; the managers' table | `table`, `table-div1`, `table-week2`, `table-season2`, `hotseat/standings`, `hotseat/standings-week1` |
| Records and Hall of Fame | empty and after a season; Hall of fame in a game | `records`, `records-season2`, `hof-in-game` |
| Club: Money | at the start, a loan taken, settled, week 2, the second season (overdrawn, 25 ledger lines, a past season) | `club-money`, `club-money-loan`, `club-money-repaid`, `club-money-week2`, `club-money-season2` |
| Club: Ground | ticket advice, a price change, safety work, a stand ordered, home crowds after a game | `club-ground`, `club-ground-ticket`, `club-ground-safety`, `club-ground-build`, `club-ground-week2` |
| Club: Staff | four roles, a scout hired | `club-staff`, `club-staff-scout` |
| Club: Youth | empty, an upgrade ordered, the summer intake | `club-youth`, `club-youth-upgrade`, `club-youth-intake` |
| Club: Name | own club renamed, another club chosen, cancelled | `club-name`, `club-renamed`, `club-name-other`, `club-name-cancelled` |
| Season end | the review with the final table and the ladder prompt | `review` |
| Hot-seat | the hand-over (three times), the shared week screen, results | `hotseat/pass`, `hotseat/pass-second`, `hotseat/pass-week2`, `hotseat/weekmulti`, `hotseat/results-hotseat` |
| Matchday | the choice before a match, the match screen at full time | `matchpick`, `matchview-ended` |

**Not reached by the journeys.** These states need luck or several seasons and did not come up in the seeded games: a job offer (on Home and in the review), being sacked and "One door closes", the game-over screen, a European tie and the European XI switch on Squad, builders or a ground warning on Home, a results or week screen with European games, a player who "has left the league", a ladder that answers (it needs the network, which the tool blocks), and a rival manager's player listed for sale. Each is drawn from the same components as states that were reached. The first four and Offers were also looked at on screen by setting the game into that state by hand (not part of the record). They are on the list for Checkpoint C.

## How it is checked

* **Same words, same controls, same game.** `node tools/ui-parity.js <site> <out>` records, at each of the 123 stops and at a phone and a desktop size: every word on the screen, every control with its action, attributes and label, and at the end a checksum of each whole saved game. `--compare` compares two builds. The clock stands still and the random numbers are seeded, so two runs of one build are the same run.
* **The old look is still the old look.** The same journeys with `?classic`, compared picture by picture with the 1.7.0 baseline.
* **Sizes.** `node tools/ui-parity.js --layout <site>` walks the same 123 stops at 360x640, 390x664, 844x390, 1366x768 and 1920x1080 and reports anything wider than the screen, off the screen, cut short, a table wider than its card, or a control under 40 px tall or 36 px wide.
* **The match screen's boxes.** `node tools/ui-parity.js --stage <site>` puts the old and new looks side by side at eleven window sizes, during play and at full time, and compares the position and size of the stage, its canvas, the scoreboard, the clock, the commentary, the log, the action bar and every button.
* **The match picture.** `tools/frame-reference.js`: 198 whole frames against the reference taken before the smoothness pass.
* The project's 21 suites, the save-compatibility test both ways, the viewport audit and the phone stand-in, as at every milestone.

## Checkpoint B results (18 November 2026)

Build: `index.html` 7,166,508 bytes, md5 `5b8d09ce0b432446faa5afd460d6a80b`; `soccer-manager-91.html` md5 `8b7e5d4ac28805cb4c4b201885b2527a`, sent to John as `soccer-manager-91-premium-dark-checkpoint-B.html`. Every check below ran on that file.

| Check | Result |
|---|---|
| Same words, controls and saved games (`tools/ui-parity.js`, 123 stops, phone and desktop, against the 1.7.0 baseline) | no differences in 246 stops, apart from the five words added on purpose at Checkpoint A; both saved games identical (one manager into the second season, two managers after a week) |
| The old look is still there (`?classic` against the baseline, picture by picture) | 363 of 382 pictures identical to the pixel. The 19 others: the Squad team line, whose figures now sit in their own element and are smoothed differently (12); a toast caught mid-fade (6); one footballer at a different instant of his standing animation at full time (1) |
| The three approved screens against the Checkpoint A build, picture by picture | 101 of 116 identical. The 15 others: "Send him out" now blue (10); an offer now in a card with a blue Accept (4); a toast mid-fade (1) |
| Five screen sizes (`--layout`, 123 stops at each) | nothing wider than the screen, off it, cut short or too small, at any stop or size |
| The match screen's boxes (`--stage`, old look against new at eleven sizes, during play and at full time) | every box in the same place and the same size; the canvas has the same number of pixels |
| The match picture (`tools/frame-reference.js`, 198 whole frames against the reference) | identical to the pixel |
| The match screen at five sizes (`tools/viewport-audit.js`) | passes at all five |
| Matchday pacing on the phone stand-in (`tools/phone-probe.js . 6`) | 56.2, 57.4 and 57.5 frames a second over three runs, 0.4 to 0.5% of frames slower than 30 a second. The 1.7.0 baseline in the same hour: 53.6 and 57.6, 0.3 to 1.2%. No difference beyond the spread between runs |
| Engine, matchday source, service worker, build script, art, manifest | not one line changed |
| All 21 suites | pass |
| Saves from the live 1.6.0, and back (`tools/save-compat.js`) | 19 of 19 each way |
| Contrast of every text and background pair | 5.2 : 1 or better |

### After John's review (18 November, 14:42)

John asked for two tidy-ups and found everything else right.

1. **The possible rise in skill (▲) pushed the skill out of line.** In every table the rise now sits first, in a slot of its own, and the skill keeps its place at the right of the column. The words are the same and in the same order in the page; only where they are drawn changed. The old look is unaffected.
2. **On a desktop, the Scout card on Club, Staff started lower than the Coach card.** The line "Paid weekly, no notice needed" sat inside the left column. It now sits above both columns, so the four cards start level.

Build: `index.html` 7,166,780 bytes, md5 `e465b18dc30dfef6b725877d721fcccc`; `soccer-manager-91.html` md5 `ed19a60331a74568b68218e96649f9ec`, sent to John as `soccer-manager-91-premium-dark-checkpoint-B2.html`.

Checked on that file: the same words, controls and saved games as the 1.7.0 baseline at all 246 stops; the five screen sizes at all 123 stops. Checked on the file one rule earlier (the rule narrows the slot on phones under 380 px wide and touches nothing else): the match screen's boxes at eleven sizes; the 198 match frames; the old look against the baseline (369 of 385 pictures identical, the rest as before); `test-matchday-ui`, `test-contracts`, `test-youth`, `test-hof` and `test-touch`; saves from 1.6.0 and back, 19 of 19 each way. Against the build John reviewed, the pictures that changed are the squad, market, scout and youth tables (the skill column) and Club, Staff on a desktop. The full set of checks runs again on the release candidate at Checkpoint C.

Not done at this checkpoint, and due at Checkpoint C: the states listed as not reached; a keyboard-only pass and a screen-reader pass (field captions beyond the four name fields have no label of their own, as before); the soak audit; a look on a real phone other than John's own review; the installed app's colours if John wants them changed.

## Where the build differs from the concepts, and why

The concepts are generated pictures and the brief says the game wins wherever they disagree.

1. **No club crest and no shirt number.** The concepts show a shield beside the club's name and a numbered shirt beside a player's. The game holds neither, and the brief rules out inventing them. A player's page has a plain figure icon in that place.
2. **The game's own wording.** "League: Walsall at home", not "Walsall (H)"; "DEF", not "Defender"; "■ picked" in the Squad note; every status line and warning as the game writes it.
3. **Two headings added:** the wordmark in the header and "Next fixture" over the fixture on Home. Neither is data or a control. Nothing was added at Checkpoint B.
4. **Less on one screen than the pictures show.** The concepts draw text about 8 px tall and controls about 18 px tall at phone size. The brief asks for readable type and touch targets of about 44 px. So a player's details run in one column on a phone where the picture has two, and each screen scrolls further than the picture suggests.
5. **Section headings are the small blue capitals approved at Checkpoint A**, where the player concept has amber ones; amber is kept for what is chosen and what to do next.
6. **No icons beside the headings of Finances**, where that concept has coins, a bank and a list. Icons are used where they were approved: the navigation, Home's rows and a few buttons.
7. **The stadium is a drawn silhouette**, not a photographic banner (John's decision, 18 November: the drawn one is enough).
8. **On a desktop the layout uses columns**; the concepts only show a phone.

## Changes to the three screens approved at Checkpoint A

Compared picture by picture with the Checkpoint A build, the three approved screens differ in two ways only, both from applying the Checkpoint B components to them: "Send him out" on the Scout tab is now a blue confirming button, and an offer on the Offers tab sits in a card with a blue Accept.

## Checkpoint C (18 November)

Scope: section 3 of John's brief "Completion of current milestones, combined release and next development roadmap". Results: `RELEASE-CANDIDATE-1.7.0.md`.

* **Rare states.** `tools/ui-parity.js` gained a third journey (`big`: the Big job start, in Europe from week one, a ladder that answers through canned replies, states set by hand and put back, a resignation) and the hot-seat journey grew to three managers with a listing and a retirement. 165 stops in all. The states the Checkpoint B list called "not reached" are now seen, apart from the three named in the candidate's report.
* **Keyboard.** `--keys` presses Tab through every stop and requires every control to be reached, named, ringed and in view, then works the game from the keyboard. What it found on the build before this checkpoint, and what was done: rows that could only be tapped were not reachable (768 visits over the journeys; now focusable, with Enter and Space); four kinds of field had no name (the amount, the wage, a player's name, a save's name; now named); focus was lost at every redraw (now kept, when the keyboard is in use).
* **Screen reader.** The tick reads "picked" or "not picked"; a chosen option is `aria-pressed`; the current section is `aria-current`; the toast is a live region; the decorative meter is hidden from it. The buttons that ask "Really?" are not marked as pressed.
* **Toast, banner, panel, installed colours, What's new:** as described above and in the candidate's report.

## Decisions on the questions raised at Checkpoint B (John, 18 November)

* The goal and card banner and the measuring panel take the new look. Done at Checkpoint C.
* An installed copy's colours change at release; the app icon is out of scope. Done in the candidate.
