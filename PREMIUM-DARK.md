# Premium Dark: the management reskin

Master specification: John's "Premium Dark Management UI Reskin" brief of 18 November 2026 and its six concept images. The existing game is the source of truth for every word, figure, action and flow. This file records how the brief is being carried out.

**Status: Checkpoint A, awaiting John's visual approval.** Home, Squad and the Transfer Market (all four of its tabs) wear the new look, on a phone and on a desktop. Every other screen, and the whole of matchday, is drawn as before. Branch `premium-dark`, from the tested 1.7.0 baseline (`milestone-5`). Nothing is merged or deployed; the version is still 1.7.0 and the What's new screen is untouched.

## How it is built

* **One switch.** `render()` in `ui.html` puts the class `pd` on `<body>` when the screen being drawn is in `PD_SCREENS` (`home`, `squad`, `transfers` at Checkpoint A). All the new rules sit under `body.pd` in one block of the stylesheet headed "Premium Dark". A screen not in the list, and every matchday screen, never has the class, so its rules are exactly the old ones.
* **One markup.** The three screens' markup gained wrappers (`section.card`, `.cols`), a few class names and inline SVG icons. The old stylesheet gives none of them any style and hides the icons, so the same markup draws in either look. Adding `?classic` to the address draws everything in the old look, for comparison. That is a developer's aid, not a setting: the game offers no choice of look.
* **Nothing else.** No click handler, action name, id, label, figure, saved field, engine call or matchday file is changed. `git diff milestone-5 -- engine.js src/ sw.js` is empty.
* **To undo it:** empty `PD_SCREENS` (or delete the "Premium Dark" block); the wrappers are inert.
* **To extend it (Checkpoint B):** add each screen's name to `PD_SCREENS` once its markup carries the same wrappers, then restyle what is particular to it.

## Design tokens (CSS variables on `body.pd`)

| Variable | Value | Used for | Contrast on its background |
|---|---|---|---|
| `--pg` | `#07131E` | page background | |
| `--panel` | `#102637` | cards | |
| `--panel2` | `#18354A` | buttons at rest, table heads, chips | |
| `--line` / `--line2` | `#466C82` / the same at half strength | button borders / card borders and rules | |
| `--tx` | `#F4F7FA` | primary text | 14.4 : 1 on a card |
| `--tx2` | `#B6CFDE` | secondary text, the right-hand side of a status row | 9.6 : 1 |
| `--mut` | `#7EA8BF` | the small line under a player's name | 6.1 : 1 |
| `--sky` | `#86C5EE` | labels, table heads, icons (not in the brief's table; the concepts use it for exactly these) | 8.3 : 1 on a card, 6.8 : 1 on a table head |
| `--amber` | `#FFAC22` | the chosen option, the active section, the one main action, key figures | 8.3 : 1; dark text on amber 9.8 : 1 |
| `--warn` | `#F08A75` | an overdrawn balance, a warning in the news, a ground restriction, the "Really?" state of Resign, Abandon and Retire | 6.3 : 1 |
| `--ok` | `#75C5A6` | defined, not yet used (no positive status on these three screens) | |
| `--ink` | `#1B1205` | text on amber | |

Every pair meets WCAG AA for normal text.

**Type.** The system sans-serif (`system-ui`, then the usual fallbacks): nothing is downloaded. Figures use `font-variant-numeric: tabular-nums` so pounds, skills and ages line up. The wordmark is the same face, heavy italic capitals with '91 in amber and two slanted stripes, as the concepts have it.

## Components

| Component | Class | Notes |
|---|---|---|
| Shell: wordmark, status, balance | `header .brand`, `.wm`, `.st`, `.bal` | the same three lines of status as before; the balance turns to the warning colour when overdrawn |
| Shell: club | `header .clubbar`, `.club` | the club's real name; the manager's name under it in a multi-manager game, as before. A drawn stadium silhouette (inline SVG, about 2 KB) sits behind it at the right |
| Card | `section.card`; `.row2` with a leading icon; `.kvs` for status rows; `.tb` holding a table; `.nw` news with an amber edge | |
| Label | `h1.lab`, `.lab`, `h2` inside a card | small capitals in `--sky` |
| Page title | `h1.pg` | capitals with an amber rule (Transfer market) |
| Button | `.b` | quiet by default; `.on` amber (chosen); `.amber` outlined amber (a secondary call to act: Buy, Set them yourself); `.danger.on` warning colour; focus ring amber |
| Choice group | `.grid2`, `.grid3`, `.tabs` | 40 px tall, as tall as they were; a button on its own is 44 px |
| Status row | `.kv` | label with icon left, value right |
| Table | `table`, `th`, `td.n` (figures), `td.wrap` (name and its small line), `.pos` chip, `.tick` checkbox, `tr.sel` picked row | the tick is the old ■ or □ character restyled; the character is still in the page |
| Navigation | `nav button`, `.on` | icon over label on a phone, beside it on a desktop |
| Main action | `.action .b` | amber, 50 px |
| Toast | `.toast` | restyled while a Premium Dark screen is showing |

Icons are 20 hand-drawn line paths in `ICONS` (`ui.html`), drawn by `ic(name)`, always beside a visible label and hidden from screen readers (`aria-hidden`).

**Wide screens (900 px and up).** The app widens from 520 px to 1,180 px; Home and Squad use two columns (`.cols`); the Transfer Market is a centred 900 px column; the navigation spells its labels beside the icons. Below 900 px, including a phone held sideways, the layout is the single column it was.

## Asset inventory

Nothing is fetched at run time and no image file was added. The whole reskin so far is text inside `index.html`: about 14.5 KB of CSS (2 KB of it the stadium drawing) and 1.3 KB of icon paths. `index.html` grows from 7,131,899 to about 7,150,500 bytes.

## Coverage at Checkpoint A

| Screen | State | Reskinned | Checked by `tools/ui-parity.js` |
|---|---|---|---|
| Home | week 1 (first-season sponsor line, update note), after a signing (overdrawn), week 2 (league position, news) | yes | yes |
| Home | job offer, European tie, builders, ground warning, pre-season pending, multi-manager, no match this week | yes by construction (same components) | not yet reached by the journey |
| Squad | six formations, pick best, clear, three training levels, team line, the roster with every annotation, the player button | yes | yes |
| Squad | European XI switch | yes by construction | not yet reached |
| Transfer Market | For sale (and Buy), Free, Offers (empty), Scout brief, browse by division, a club's squad | yes | yes |
| Transfer Market | Offers with offers, rival managers' lists, scout results | yes by construction | not yet reached |
| Everything else, and matchday | | no: unchanged until Checkpoint A is approved | |

"By construction" means the state is drawn from the same components and has not been looked at on screen yet. Each will be looked at and added to the journey at Checkpoint B.

## How it is checked

* `node tools/ui-parity.js <site> <out>` plays one seeded game through a fixed journey over the three screens and records, at 17 stops and at a phone and a desktop size: every word on the screen, every control with its action, attributes and label, and a checksum of the whole saved game at the end. `node tools/ui-parity.js --compare before/record.json after/record.json "<added words>"` compares two builds. Result for Checkpoint A against the 1.7.0 baseline: the same words at every stop apart from the five the reskin adds on purpose ("Soccer Manager '91" in the header and the heading "Next fixture"), the same controls, and the same saved game.
* With `?classic` the build draws the old look: 37 of the tool's 49 pictures are identical to the pixel to the baseline's; the rest differ by a toast caught mid-fade or by the smoothing of a figure that now sits in its own element.
* Five screen sizes (360x640, 390x664, 844x390, 1366x768, 1920x1080): no content wider than the screen, nothing off screen, no clipped label, no button under 40 px tall on the three screens (the arrow that opens a player is 36 px wide and 44 px tall on a phone; it was about 26 px wide before).

## Checkpoint A results (18 November 2026)

Build: `index.html` 7,150,956 bytes, md5 `ce3eb4d2cf8b2fe2a809ee8d2e6fc805`; `soccer-manager-91.html` md5 `732268b5f7bc63a989465b58bc09440f`, sent to John as `soccer-manager-91-premium-dark-checkpoint-A.html`.

| Check | Result |
|---|---|
| Same words, controls and saved game (`tools/ui-parity.js`, 17 stops, phone and desktop, against the 1.7.0 baseline) | the same, apart from the five words added on purpose |
| The match picture (`tools/frame-reference.js`, 198 whole frames against the reference) | identical to the pixel |
| The match screen at five sizes (`tools/viewport-audit.js`) | passes at all five |
| Matchday pacing on the phone stand-in (`tools/phone-probe.js . 6`) | 58.1 frames a second, 0.2% of frames slower than 30 a second: as before the reskin |
| Engine, matchday source, service worker | not one line changed |
| All 21 suites | pass. They ran on the build one stylesheet rule earlier (room for squad names on a phone); after that rule `test-matchday-ui`, `test-contracts`, `test-youth` and `test-hof` were run again and pass |
| Saves from the live 1.6.0, and back (`tools/save-compat.js`) | 19 of 19 each way, on the build one stylesheet rule earlier |
| The three screens at five sizes | nothing clipped, off screen or wider than the screen |

Not done at this checkpoint, and due at Checkpoint C: a look on a real phone other than John's own review; the soak audit; a keyboard-only and a screen-reader pass; the states marked "not yet reached" above.

## Where the build differs from the concepts, and why

The concepts are generated pictures and the brief says the game wins wherever they disagree.

1. **No club crest.** The concepts show a shield beside the club's name. The game holds no crest for any club, and the brief rules out inventing one.
2. **The game's own wording.** "League: Walsall at home", not "Walsall (H)"; "■ picked" in the Squad note; the status lines as the game writes them.
3. **Two headings added:** the wordmark in the header and "Next fixture" over the fixture. Neither is data or a control.
4. **Less on one screen than the pictures show.** The concepts draw controls about 18 px tall at phone size. The brief asks for touch targets of about 44 px, and the game's were 40. Choice buttons are 40 px and single buttons 44 px, so a phone shows three or four squad rows under the tactics where the picture shows eight.
5. **The stadium is a drawn silhouette**, not the photographic banner of the concepts: original, 2 KB, offline. A painted banner through Floyo is possible later if John wants one.
6. **On a desktop the layout uses two columns**; the concepts only show a phone.

## Open questions for John (none blocks Checkpoint A)

* Should the match screens' surround (scoreboard, buttons, result) take the new look at Checkpoint B? The brief places matchday outside the reskin, so today they stay as they are.
* A painted stadium banner, or keep the drawn one?
* The browser's own bar colour on a phone (`theme-color`) is still the old blue; it changes with the title screen at Checkpoint B.
