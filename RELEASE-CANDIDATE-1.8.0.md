# Release candidate 1.8.0: tactics, and the hair fix

26 November 2026. **For John's approval. Nothing is merged and nothing is deployed.** The live site is 1.7.0 (`main` at `cde3c8f`, tagged `v1.7.0`) and has not been touched. This candidate is on the branch `milestone-1-tactics`.

**John's decisions, 26 November 2026 (afternoon). This note is on the training branch only; the candidate itself is frozen and does not carry it.**

1. **1.8.0 RC1 is accepted as the completed development baseline. It is not approved for deployment.** Nothing is to be merged to `main` or published. Live 1.7.0 stays untouched. He will do his own final review on his Galaxy before approving any public release.
2. **The exact candidate is preserved.** It is the commit `6baa8d0`. Two branches point at it and neither is to move: `milestone-1-tactics`, and `release-1.8.0-rc1`, made on 26 November for no other purpose than to mark it. The files: `index.html` md5 `1d935315ec7b561e4d976f2ed8da71d5`, `soccer-manager-91.html` md5 `17ce37bc3a47f5210c06881b8f5ebee3`, `sw.js` md5 `bde83a6b4dcf171657da4fbf44f06367`. A copy of the playable file was sent to him as `soccer-manager-91-1.8.0-rc1.html`.
3. **The What's new wording is approved as it stands.**
4. **The style preview's code stays in the file,** completely disabled and unreachable in the public game, and the automated checks that keep it so are to be retained (`test-tactics-ui.js`, part 8).
5. **`?rules=1.7` stays,** for regression testing. It must remain undocumented in the player's interface and impossible to trigger by accident. Checked on the candidate: no screen, link, manifest entry or offline rule mentions it; it is read only from an address typed by hand; an installed copy has no address bar. A test now holds that (`test-tactics-ui.js`, on the training branch).
6. **The league-figure correction is accepted,** and the soak check that failed once is accepted as a limitation of the test and not a release blocker. The test is to be improved when convenient, without changing the approved game to satisfy it. Done on the training branch: the check looks again when it lands on a fade (`tools/soak-audit.js`).
7. **The nine art archives are to be preserved permanently, apart from the repository.** The plan is in `ART-PIPELINE-ARCHIVES.md`. Nothing is uploaded now.
8. **Training (milestone 2) proceeds on its own branch, `milestone-2-training`, started from this candidate. It must not be part of the eventual 1.8.0 release.**

When he approves publication, the steps of "What happens after approval" below apply to the frozen commit, not to the training branch.

## The outcome

**The candidate is built and it passes the complete release regression.** It is the hair fix and all three slices of the tactics milestone, with the development-only style preview taken out of reach.

Two things you should know before the detail, both set out in full under the test results:

* **One of the soak's 44 checks failed on its first run and passed on four reruns.** It is the test's way of looking, not the game.
* **A figure I gave you on 19 November was wrong:** how closely the league table follows the clubs' standing is 0.65, not 0.96. The fault was in my measuring tool. The conclusion it supported still holds, and the candidate is not affected.

Three things need your word before it can go out: the What's new wording (below), two small points about what stays inside the file (section "Decisions for you"), and the go-ahead itself.

## The candidate

| | |
|---|---|
| Version shown in the game | 1.8.0 |
| Branch and commit | `milestone-1-tactics`, the game file was built at `f03785f` |
| `index.html` (the file that would be deployed) | 7,138,149 bytes, md5 `1d935315ec7b561e4d976f2ed8da71d5` |
| `soccer-manager-91.html` (the file that opens from disk, sent to you) | md5 `17ce37bc3a47f5210c06881b8f5ebee3` |
| `sw.js` | md5 `bde83a6b4dcf171657da4fbf44f06367`; cache name `sm91-v1.8.0` (the one change in it) |
| `manifest.webmanifest` and the two icons | the same files as 1.7.0 |
| Save format | 4, unchanged |

## What is in it

| Piece | Approved | In the candidate, and how I know |
|---|---|---|
| **The hair fix** (built as 1.7.1, never released on its own) | 19 November | Its commit `1a12ae6` is an ancestor of the candidate. The hair audit passes on the candidate file: all 5,568 player pictures as the game draws them, and every player followed through 20 seeded matches; nobody's hair changes. |
| **Tactics slice 1: the match rules.** Four controls (mentality, passing, pressing, shooting), the six formations rebalanced, a plan for every computer manager | 19 November | `engine.js` is byte for byte the file approved at slice 2 (md5 `9e64dbc1546af777235e129918d85219`, last changed at `ad538ff`). `test-tactics.js`: 14,933 checks, among them 9,640 matches with every side on the default plan identical to the 1.7.1 engine. |
| **Tactics slice 2: the screens.** The Match plan card, "Known for" on Home, possession and chances after a match | 20 November | `test-tactics-ui.js`: 78 checks. |
| **Tactics slice 3, Stage A: the match pictures lean** to each side's passing, pressing and shooting, and time on the ball follows the engine's possession | 21 November | `test-style.js`: 89 checks, among them every goal the same goal with and without the lean. |
| **Tactics slice 3, Stage B: the side without the ball** stands 4.7 m higher for a High press and 4.7 m deeper for a Low press; a High press closes down at a run, a Low press stands off | 26 November | `test-shape.js`: 16 checks. Measured again on the candidate: back line 17.2, 20.4 and 24.1 m from its own goal line for Low, Normal and High; a man within 3 m of the ball 45.7%, 47.7% and 58.2% of the time. `src/matchday` is byte for byte what you watched and approved (not one line changed since `47ef203`). |

**What changed between the build you approved (1.8.0-dev4) and this candidate.** Three things in the game, all in `ui.html` and `sw.js`, and one in the tests. Nothing in the match rules or the match pictures.

1. The version reads 1.8.0, and the offline cache is named for it.
2. **The style preview is out of reach.** "Preview: compare two styles" does not appear on Home, and the four actions behind it do nothing in a release build even if something asks for them. A new test proves both, and I checked that the test catches a preview left reachable.
3. **What's new** has its 1.8.0 entry, below, for your approval. The separate heading for 1.7.1 is gone, since 1.7.1 was never public; its one line is now the last line of 1.8.0.
4. In the tests: a fingerprint of the approved match pictures was recorded (`tools/reference/scene-1.8.0.json`: 36 matches, every event and every player's position once a second) and `test-shape.js` now checks it. It is how later work will show it has left the approved football alone.

## What's new, for your approval

This is the text exactly as the candidate shows it. Every name in it is the name on the screen.

> **1.8.0** November 2026 (this one)
>
> * Tactics. You now decide how your team plays as well as its formation. On the Squad screen, under Match plan, there are four choices: Mentality (Defensive, Balanced, Attacking), Passing (Short, Mixed, Direct), Pressing (Low, Normal, High) and Shooting (Work it in, Balanced, Shoot on sight). Each one tells you what it gains you, what it costs and whom it suits.
> * Every choice has a price. Attack more and you concede more. Press high and you see more of the ball, but your players tire faster and collect more bookings. Short passing rewards a midfield that is on top; direct passing does without one. No plan is best against everybody, and the right one depends on your squad and on whom you are playing.
> * Leave it alone if you like. The default plan leans no way: it gains nothing and costs nothing, and Reset to default plan puts it back at any time. Your saved games carry on, on the default plan until you change it.
> * The other managers have plans too. Every club has a way of playing, and the fixture on Home tells you one thing your next opponent is known for. It is one thing, not the whole plan.
> * You can see it in the match. A direct side hits longer passes and a short-passing side keeps the ball moving. A high press wins the ball further up the pitch, holds its defence higher and runs at the man in possession; a low press sits deep and waits. A side told to shoot on sight shoots from further out.
> * Possession and chances after every match. The result now shows how much of the ball each side had and what its chances were worth. They are estimates from the match simulation, not counts of individual passes and shots.
> * Formations are better balanced. With plans in the game the six formations were weighed again, so that with equal players no shape has an edge on its own.
> * A player's hair no longer changes colour as he moves.

Any line can be reworded, cut or reordered. A change of wording means a rebuild and a rerun of the screen checks, about an hour, not the whole regression.

## Test results

All on the candidate file above, 26 November 2026.

| Check | Result |
|---|---|
| **The 25 test suites** | All 25 pass, first time. |
| **With the 1.7.1 rules switched on (`?rules=1.7`), the screens against 1.7.1** (172 stops on a phone and on a desktop: one manager through a season, three managers in hot-seat, the Big job with Europe) | No differences in 344 stops, apart from What's new, changed on purpose (192 words added, none lost, the same controls). The three saved games at the end of the journeys are identical to 1.7.1's. So nothing but tactics has moved. |
| **The match pictures against 1.7.1, same switch** | All 198 whole frames, all 61,248 player pictures and all 1,717 ground tiles identical to the pixel. Every box on the match screen where it was, at every size. |
| **The approved football** (`tools/reference/scene-1.8.0.json`, and the Stage A fingerprint) | All 36 matches identical in every event and every position. With Stage B switched off, every match is Stage A again. |
| **The same journeys with tactics on** | 173 stops, run to the end with no page errors. |
| **Five screen sizes** (360x640, 390x664, 844x390, 1366x768, 1920x1080) | Nothing wider than the screen, off it, cut short or too small, at any stop or size. |
| **Keyboard and screen reader** | Every control at every stop reached by Tab, named, ringed and in view: 3,181 and 3,265 controls visited. |
| **The match screen at five sizes** | All viewport checks pass. |
| **Saved games, both ways** (a single manager and a three-manager hot-seat, in slots and the autosave, resumed and played on with a watched match) | From 1.7.0, 1.7.1 and 1.6.0 to the candidate: 21 of 21 checks each. From the candidate back to each: 22 of 22 each. Six runs, no failures. From the live 1.7.0: the offline cache swaps to `sm91-v1.8.0`, What's new is flagged, every slot is intact, the games play on, and a plan set after the update is saved and played to. |
| **A plan survives a spell back on 1.7.0** | A game with a plan set, played five weeks in the 1.7.0 engine and saved there, comes back with the plan as it was. |
| **Soak: memory** | Ten matches and twenty view switches: 6.8 MB after matches 3 to 5, 7.2 MB after matches 8 to 10. No animation loop, observer, listener or canvas left behind. |
| **Soak: offline** | With the network cut after one visit, the game loads again, starts a game, shows a match, plays on and resumes from its autosave. |
| **Soak: hot-seat** | Three managers, each match watched, nothing given away at a hand-over. |
| **Soak: the match view made to fail four ways, the measuring screen, six awkward situations** | Pass. The whole soak is 44 checks: **43 passed on the first run and all 44 on the second.** See "One check that failed once" below. |
| **Hair audit and the converter's test** | Both pass. No hair drawn black, no hair colour away from the head, every picture its own painted cell. |
| **Speed: the phone stand-in** (processor slowed six times, three runs) | 58.1 and 58.4 frames a second; 0.2% of frames slower than 30 a second (limit 1%); the page's own work 5.1 to 5.6 ms a frame. The build you approved gave 5.0 ms. |
| **Speed: building a match's pictures** | 257 ms on average, 287 ms at the slowest (limit 400 ms), on the quiet machine. |
| **The balance bench** | The bench as it stood gives, line for line, the output recorded at slice 1: the balance of the match rules has not moved. Then see "A correction" below. |
| **The match rules and the match pictures** | `engine.js` unchanged since slice 2; `src/matchday` unchanged since the build you approved. Not one line. |
| **The style preview in a release** | No button; its actions do nothing; a game in hand is untouched by them. Proved by a new test, which fails if the gate is taken out. |

### One check that failed once

On the first run of the soak, one of its 44 checks objected: "painted art never arrives: the match is still shown". That check deliberately stops the painted art from loading and then looks at the match picture twice. It tells a drawn picture from a blank one by counting colours at 192 points.

Its second look landed on the darkest instant of the fade that follows a jump to the next highlight, when every point is black. The screenshot it took a moment later shows the match drawn and fading back in. I ran that check three more times on its own and then the whole soak again: it passed every time. The game is not seeded in this check, so each run is a different match and the look falls somewhere else.

It is the test's rule of thumb, the same colour count that the backlog already notes for the touch test, and it is recorded there now. The code under it is unchanged since the build you approved.

### A correction to a figure I gave you on 19 November

Preparing the training audit, I found a fault in my own measuring tool. It is in the tool, not in the game, and it does not affect the candidate.

* **What was wrong.** The bench's league run (target B2 of slice 1: "the league keeps its shape with the computer managers' plans on") closed each season twice. So between the seasons it measured, players aged two years and a round of promotion was worked out from an empty table. It also read the final table after the season had closed, by which time the game has put the clubs back in order of standing.
* **What I told you that was wrong.** "The table follows the clubs' standing as closely as before (0.96 and 0.97)." The true figure is **0.65 under both sets of rules**. Tactics have not changed how far quality tells, which is what the figure was there to show, and that conclusion stands. But 0.96 overstated how closely a final table follows standing. A table follows it at about two thirds, not almost exactly.
* **What still holds.** B2 is met on every figure with the tool corrected: goals a game 2.71 with the 1.7.1 rules and 2.70 now; home wins 46.0% and 46.9%; draws 28.0% and 27.6%; away wins 26.0% and 25.5%; bookings 2.44 and 2.42; injuries 0.56 and 0.57. Over 96 seasons the two sets of rules are closer still.
* **What it did not touch.** No other tool or test closes a season by hand. Every other target of slice 1, and every "identical to 1.7.1" proof, is unaffected.
* **What I did.** Corrected the tool, kept the slice 1 record as it was, saved the corrected output beside it (`tools/reference/tactics-balance-1.8.0.txt`), and put a dated correction in `TACTICS-SLICE-1.md` under B2.

## Known issues and accepted limitations

**From the tactics milestone, all decided by you and recorded in `MATCHDAY-BACKLOG.md`:**

* Two objectives missed by a little and accepted: a Direct side's pass is 7.8 m longer than a Short side's (objective 8), and a Shoot on sight side takes 19 points more of its shots from outside the area than a Work it in side (objective 20).
* The phone camera is left as it is: on the 360 px phone both posts are in view at 94.0% of shots when both sides Work it in (limit 95%).
* A high defensive line leaves space behind it and the pictures do not punish it (the result does). The side with the ball does not change shape for the other side's pressing. Mentality does not lean in the pictures.
* Three old blemishes of the play between the official moments, all in 1.7.0 as well: a corner given seconds before half-time and never taken (about 1 in 450 corners), a goal kick lost before it is taken (1 in 1,900 matches), and a woodwork strike with no rebound (1 in 10,000).
* A player's sharpest burst of acceleration is a little over the test's limit on some samples, and about one more player picture is made in the first frames after a cut.

**Carried from 1.7.0, unchanged:**

* Goalkeepers have one painted hairstyle. An outfield player who goes in goal after a sending-off is drawn with it from then on. The artwork backlog has this and the other art items (`ARTWORK-BACKLOG.md`).
* Phone landscape is unchanged, by your decision. The whole-pitch camera on an upright phone fills only the middle third of the stage.
* No mid-range Android phone and no iPhone has been measured. Lower-detail settings are not built.
* Pinch-zoom is switched off for the whole page, as it always has been. The pitch itself has no description for a screen reader; the commentary line and the event log are read out.

**Not seen on screen in the journeys** (drawn by the same components as states that were): a European final or a shoot-out in Europe; a hot-seat game with eight managers (three were played).

## For your Galaxy

The file is `soccer-manager-91-1.8.0-rc1.html`. Opened from your files it keeps its own saved games, apart from the live site's, so nothing you do in it can touch a real save.

1. The title screen says Version 1.8.0. What's new reads as above.
2. Start a game. Squad, Match plan: change a choice or two, then play the match. The result shows possession and chances.
3. Home shows what your next opponent is known for.
4. Home has **no** "Preview: compare two styles".
5. Watch a match with a High press. Watch a player's hair.
6. If you have a minute: title screen, What's new, "Measure the match frame rate", watch a match for a minute and send me the panel. The figure to compare with is the one from the 1.7.0 candidate: 59.6 frames a second.

What only the live site can show is the update itself: an installed copy of 1.7.0 fetching 1.8.0 and carrying its saves across. That is covered here by the save tests and the offline test, and it is the first thing to verify once the release is up.

## Decisions for you

1. **The What's new wording.** Approve, or tell me what to change.
2. **The style preview's code stays inside the file, switched off.** A release shows no button for it and its actions do nothing. I kept the code so that a future maintenance build can compare two styles again by adding "-dev" to its version label. If you would rather it were deleted outright from 1.8.0, say so: it is a small amount of code, and the screen checks would be rerun.
3. **The `?rules=1.7` switch stays.** Typing it after the address plays the 1.7.1 match rules and hides tactics. It is how the tests prove that nothing else changed, and it would let a player's report be checked against the old rules. Nobody finds it by accident. Say if you want it removed.
4. **When to deploy.** Yours to decide. Nothing changes in the candidate between your approval and the merge.
5. **Still open from before:** where the nine art archives are kept.

## What happens after approval

Each step waits for your word.

1. Confirm `main` is still `cde3c8f`, the `v1.7.0` tag. (The step "tag what is live" is already done.)
2. Add `legacy/release-1.8.0/`, the exact files that will be served, as for the last three releases.
3. **With your explicit permission:** move `main` forward to the candidate. It is a straight continuation of `main`; nothing is rewritten.
4. Verify the live site: the version, the update from 1.7.0 on an installed copy, an old save carrying on with the default plan, a new game with a plan, a watched match, offline, hot-seat.
5. You create the tag `v1.8.0` on the GitHub page. (I cannot create tags.)
6. A short signed-off summary.

If it ever had to be withdrawn: `ROLLBACK.md`, "To put 1.7.0 back after 1.8.0". Saves are safe in both directions, and a manager's plan survives a spell back on 1.7.0.
