# Soccer Manager '91: testing backlog

Opened 27 November 2026 at John's request, so that intermittent test failures are written down and not lost. These are things known about the **tests**, kept for a later, deliberate look. Nothing here is authorised for work, and none of it is a reason to change the approved game. The match pictures have their own list (`MATCHDAY-BACKLOG.md`, closed during training development), the balance its own (`BALANCE-BACKLOG.md`) and the artwork its own (`ARTWORK-BACKLOG.md`).

A rule for this list: an entry says what was seen, on which build, how often, what is known about the cause, and what an investigation would do first. "Passed on a rerun" is recorded as exactly that and not as "fixed".

## 1. Viewport audit: one player of 22 did not take a tap, once

**John's decision, 27 November 2026:** record it here for future investigation. It does not warrant reopening the matchday development, as the match code is unchanged and the test passed on reruns.

| | |
|---|---|
| Seen | 27 November 2026, on the training build `1.8.0-training2` (`830492e`), in the full regression run. |
| The check | `tools/viewport-audit.js` pauses a watched match and taps on the body of every player in the picture, in each camera, at five screen sizes. Every player should be picked by a tap on his own body. |
| What happened | On the 360x640 phone with the whole-pitch camera, 21 of 22 players took the tap and one did not. Every other camera and size passed. |
| How often | Once in three runs on that build (the two reruns gave 22 of 22). It passed on the 1.8.0 candidate on 26 November and on the first training build. |
| What is known | The match code (`src/`) is byte for byte the frozen 1.8.0 candidate's, so this is not something the training work introduced. The audit does not fix its match: every run watches a different one. In the whole-pitch camera on that phone a player is about 20 by 22 pixels, so two players standing together overlap. |
| What is not known | Which player it was, and what took the tap instead. The likeliest cause is another player drawn over him, with the tap going to the nearer one, which may be the right behaviour. That is a guess and has not been confirmed. |
| First step for an investigation | Give the audit a fixed match (a seed), so a failure can be replayed. Then have it record, for a missed tap, the two players' positions and which one was picked. That shows whether the rule for choosing between overlapping players is wrong or the test is asking for the impossible. |

## 2. Soak audit: "painted art never arrives: the match is still shown" failed once

| | |
|---|---|
| Seen | 26 November 2026, on the 1.8.0 release candidate, in the full regression run. |
| What happened | The check stops the painted art from loading on purpose and counts colours at 192 points of the match picture. One look landed on the darkest instant of the fade that follows a jump to the next highlight, when every point is black. The screenshot a moment later shows the match drawn. |
| How often | Once in five runs on the candidate. |
| Status | **Improved on the training branch** (`tools/soak-audit.js`): a look that sees too few colours looks again, up to three times; a truly blank stage still fails. It has passed on every run since (two full regressions). The frozen 1.8.0 candidate keeps the tool as it was. John, 26 November: a limitation of the test, not a release blocker. |
| Still open | The audit plays a different match each run, like the viewport audit. A fixed match would make both repeatable. |

## 3. The match-picture stopwatch fails on a busy machine

| | |
|---|---|
| The check | `test-phase25.js` times the building of a match's pictures against a limit of 400 ms. |
| What happens | It fails when the machine is doing other work at the same moment, and passes run alone (257 ms on average, 287 at the slowest, on the 1.8.0 candidate). Known since 1.7.0. |
| Status | Handled by rerunning it on a quiet machine and reporting both. The code it times has not changed since the tactics milestone. |
| A better measure | Count the work done instead of the time taken, or take the best of several timings. |

## 4. Two colour-counting rules of thumb in the suites

Recorded in `MATCHDAY-BACKLOG.md`, section 3, and noted here only so that this list is complete: `test-touch.js` judges "the picture after a paused tap is complete" by counting colours at 120 points and wants more than four, which a lone man on open grass can fail without anything being wrong. It is the same kind of measure as entry 2.
