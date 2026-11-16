# Milestone 3D correction pass: kick-offs, corners, and the corners of the ground

Status: for your final Milestone 3 sign-off. Nothing deployed beyond 1.5.0; this build is `1.6.0-m3d2 preview`. No recordings or strips: the preview build, what changed, the test results, and where to look.

## The three corrections

### 1. Kick-offs

Every restart from the centre spot after the first is now a cut, placed rather than run to, as a new half already was. At the cut:

* both sides are in their own halves in their formations, squeezed towards their own goals (a forward on the halfway line, the back four deep), nobody but the taker over the line;
* the receiving side is outside the centre circle;
* the taker stands on the ball with his partner a stride beside him; the referee is a few metres off;
* the ball is on the spot and does not move, and nobody drifts, until the kick, which comes a beat (a second) after the cut: a short tap to the partner, before any build-up, tackle or booking can touch the ball;
* the side that conceded takes it (it always did; it is now checked);
* the celebration has closed, and the camera cuts from the scorer to the centre circle through a quarter-second of black, as it does into a highlight.

The same placement serves the first kick-off, the second half and extra time, so every restart from the centre looks the same. The wait for twenty-two men to walk back is gone; the picture simply cuts to the restart.

### 2. Corners

* The ball lies 0.6 m in from each line, 0.85 m from the flag, inside the one-metre quarter circle (it was 1.6 m and 2 m in, 2.6 m from the flag).
* The flag is the one on the side of the goal line the ball crossed. Two of the four corner paths chose it from the rebound's random landing point instead; all four now use where the ball went out (the keeper's parry, the woodwork rebound turned round the post, the header behind, the scripted corner goal).
* The taker is a man who can be at the flag by the kick (not the nearest by formation, who could be in the six-yard box), he sprints there, and the corner comes 3.5 s after the ball is dead (5.5 after a header behind). He stands a boot behind the ball, a stride off the pitch (the planner no longer pins everyone inside the lines), and the audit shows his foot on the ball (crosses 98%, 0.26 m at the 95th percentile).
* The ball is placed: it waits on the arc, untouched by the taker's approach, until the cross leaves it; all four flags are used.

### 3. The corners of the ground

Each corner now holds a filled quarter terrace in the notch between the end of one stand and the start of the next: rows parallel to the diagonal, each a little longer and higher than the one in front, rising at the pace of the lower of its two neighbours so the main stand's gable shows above it; the same coats-and-heads crowd as the generated terraces, a crush barrier every fourth row, a low wall at the front. At each junction a concrete block closes the raw ends: a stair tower in the far corners (tall by the main stand and the X=0 end, lower by the shallow X=105 end), a turnstile block in the near corners, low enough to stay under the hoardings' line to the pitch. The two floodlight pylons stand behind the far corner terraces. There are none in the near corners: in this view a floodlight there would stand between you and the corner flag, which was the one thing you asked these structures never to do.

Everything is painted into the ground tiles, so it costs nothing per frame and can never be drawn over a player or the ball. The geometry, the Floyo pieces and the renderer are as they were; the corner pieces are generated in the stands' palette. If you would like them painted through Floyo to match the stands' hand-painted look, that is a job for the visual R&D day rather than this pass.

### Also found by the new tests

* When a spell ran out of time (the whistle beating a scramble, a booking due), the ball used to move 25 to 40 m without an event: the clearance there was no time to show. It now stays where it is with the man who reached it. The highlight suite's "the ball is never teleported between events" caught these on the new fixtures.

## Tests, performance and remaining limitations

* New: `test-restarts.js` (165 kick-offs, 101 of them after a goal, and 72 corners over two league weeks; 14 checks). `test-isometric.js` E01 checks that no corner structure stands inside the run-off, that no tower rises into the projected pitch, and that the only floodlights are in the far corners. `test-matchday.js` and `test-playback.js` treat a placed restart as a cut in their no-teleport checks.
* All fifteen suites pass one at a time on this build (`test-results.txt`): matchday, playback, matchday-ui, phase25, isometric (61 checks), highlights, restarts (14), camera (20), record (19,457), contracts, hof, youth, equivalence, regression, contact (16).
* Contact audit on this build: every kind at 96 to 100%, slide tackles 100%. Camera audit: the ball in view 100%, the striker and the ball at every strike, both posts at every arrival, bookings 100% and 99.9%, celebrations 99.4% and 96.8%, the man on the ball 100%.
* Performance (headless Chromium, 360x640, 390x664, 844x390, 1366x768): 60 fps everywhere, p95 frame 17.5 to 21.5 ms, 0.3 to 2.7 ms of render per ordinary frame, 0.7 to 3.4 ms through a celebration, 3.2 to 5.0 ms per ground tile, 30 to 38 MB of heap after a whole-match tour, 5.43 MB.
* Remaining, for the later QA milestones rather than this pass: the corner structures are generated art beside painted stands (a Floyo-painted set would match better); on the phone stage both men at a challenge are in frame 94% of the time (the narrow stage, a long ball into a tackle); a loose ball can roll clear of everyone for a second on a phone (38 frames in 139,000); the goal-line clearance sample is small (14 of 15 pass).

## Where to look

Open `soccer-manager-91-m3d2-preview.html` with `?seed=…&club=3` and, if you like, `&t=` a match second; in the match, `,` and `.` step 15 s, `g` `c` `k` `h` `w` jump to the next goal, card, save, header or woodwork. The times below are five seconds before the incident.

| Seed (club 3) | Fixture | What to look at |
|---|---|---|
| 1991 | Tottenham v Leeds 1-0 | the goal and the kick-off after it (`t=1640`: the celebration, the cut to the centre circle, the placed sides, the tap); a corner at the near-right flag `t=420` and at the far-left flag `t=2456` (the ball on the arc, the taker off the pitch); the second-half restart `t=2695` |
| 4 | Leeds v QPR 3-1 | four goals and four restarts (`t=140`, `1160`, `2120`, `5360`); corners at the far-right flag `t=1467` and the near-left flag `t=625`, `2462` |
| 2 | Leeds v Crystal Palace 2-1 | corners at the near-left flag `t=2505`, `3020` and the far-left flag `t=780`, `1029`; a goal and its restart `t=205` |
| 7 | Norwich v Leeds 2-4 | six goals and six restarts (`t=565` to `t=5000`); headers scored `t=1880`, `2120`; a far-right corner `t=1875` |
| any | the ground | the Whole camera (the camera button) shows all four corners: the stair towers and terraces in the far corners, the turnstile blocks in the near ones |

## Files

| File | What it is |
|---|---|
| `soccer-manager-91-m3d2-preview.html` | The build. Not for uploading. |
| `test-results.txt` | The last lines of each suite on this build, and the contact audit's table. |
| `source.zip` | The full source, including `legacy/`. |
| `PHASE-3-ARCHITECTURE.md`, `PHASE-3-QA-REPORT.md` | Updated (in the source, and copied here). |
