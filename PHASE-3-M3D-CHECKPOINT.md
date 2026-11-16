# Milestone 3D checkpoint: the record, the camera, the celebration, the crowd

Status: for your review. Nothing deployed beyond 1.5.0; this build is `1.6.0-m3d preview`. No recordings or strips, as agreed: the preview build, what changed, the test results, and where to look.

## The short version

* **The two engine record defects are fixed.** A player can no longer score after his own dismissal, and the two bookings of a second-yellow dismissal are in order. Every result, scorer, booking, statistic and balance is unchanged (proved against the frozen 1.5.0 engine over four seasons), old saves play on identically and are not rewritten.
* **A cinematic camera.** The scene now says what must be in the picture at every instant (the ball, the striker and both posts through a shot, the keeper as he deals with it, both men at a tackle, the offender, the victim and the referee from the foul to the card, the scorer and his nearest teammates through a celebration) and the camera composes to that, on a spring with a pan cap, choosing the close or the wide scale per highlight and cutting to the close scale for the celebration.
* **Celebrations hold the picture.** The net for a second, then a cut (or a pan, when the scorer is near) to the scorer, framed with room in front of his run, and the camera stays with him until the restart, which is a cut through black rather than a whip pan back to the centre circle.
* **The crowd rises.** The scoring side's painted stands run a wave along their length, with camera flashes in the rows, for eight seconds; the near terrace joins in for home goals; the generated crowd underneath jumps on the beat.
* **Transitions.** Every cut inside a highlight (the restart after a goal, the cut to the scorer, the second half placed) dips through black like the cut into a highlight; the camera never whips across the pitch to find a restart.
* **Contact.** The slide-tackle residual is gone (100%, from 93%), and the audit, run on the fixtures the engine fix produced, found and fixed four more choreography defects, the most visible of which was the long-range goal: a fifth of all goals were struck from over thirty metres (some from seventy) because a deep scorer was found at his feet; it is two per cent now.

## What changed

### The engine (`engine.js`, `reconcileRecord`)

One function, called after the cards are sorted in `playMatch` and after extra-time goals are credited in a European tie. Deterministic and derived only from numbers already drawn, so it changes no result and consumes no random numbers: a goal at or after its scorer's dismissal moves to `1 + (minute mod (red minute minus 1))`; a goal in extra time pushes the dismissal after it instead; a dismissal in minute 1 is pushed after the goal; a second yellow drawn earlier than the first swaps minutes with it. `test-record.js` runs four seeds for 42 weeks (4,820 matches, 13,459 goals) against `legacy/engine.v150.js`: identical fixtures, scores, scorers, cards, bans, statistics, points and balances; no goal at or after its scorer's dismissal; every second yellow after the first; 35 goal minutes and 100 dismissal minutes moved; the same on a second run. Saved games are left as they are: a match already in a save keeps its record, and the audit counts contacts by a dismissed man in such a record apart (there are none in new matches).

### The camera (`scene.frameAt`, `iso-camera.js`, `isometric.js`, `playback.js`, `matchday-ui.js`)

* The scene exposes framing points with weights: hard (never out of the inner view), must (kept in view, counted when the scale is chosen), nice (kept when it costs nothing). The ball is hard, except through a celebration, where the scorer is.
* The camera clamps its centre into the intersection of the intervals those points allow (hard, then must, then nice), leads the interest 0.45 s (0.6 through a goal), moves on a critically damped spring capped at 1.1 stage widths a second (2.2 while a shot flies), and snaps only at cuts.
* The scale is chosen once per highlight by sampling the framing over the whole highlight (close when the must points fit, wide when a shot from distance or a corner swung in needs it), and again at the cut to the scorer, so a goal from thirty metres is watched wide and celebrated close. The ground never re-tiles except at a cut.
* The restart after a goal and the second half are camera cuts; a cut inside a highlight dips through black for a quarter of a second.
* `test-camera.js` runs the camera at 60 fps over the highlights of a dozen matches on a desktop stage and a phone stage and holds: the ball in view 100%; the striker and the ball at the strike 100%; both posts as the shot arrives 100% desktop, 98.4% phone; the offender and the referee through a booking 100% and 99.9%; the scorer through a celebration 99.4% and 97.8%; both men at a challenge 100%; the man on the ball 100%; no empty pitch; over the pan cap 2 and 4 frames in 139,450; the scale changing only at a cut; celebrations at the close scale.

### Celebrations

The four styles from 3B are unchanged (arms aloft, the run to the supporters, the knee slide, the huddle). What is new is the framing: the ball is hard for 1.2 s (the net, the keeper on the ground, the GOAL badge), then the picture cuts to the scorer when he is some way from the goalmouth, or pans to him when he is near; he is kept in the inner view with a point ahead of his run and his destination in the frame when they fit, and the two teammates nearest him; the camera stays with him through the half second before the kick-off and the restart is a cut.

### The crowd (`iso-stadium.js`, `iso-assets.pieceMask`)

The wave was there in 3C at a twelfth of a metre, on the far stand and the X=0 end only, with roofs moving as much as fans. Now: a third of a metre at the stand's scale, running along the stand with the rows out of step, drawn in sixteen bands per section with a window per piece so that the main stand's rows under its roof and every front wall stay still; the near terrace joins in for home goals (its hoardings redrawn in front); camera flashes for six seconds, hashed from the section and the moment and placed only where the piece has paint; the generated crowd under the pieces jumps on the beat through the first five seconds. All skipped under reduced motion. It costs 1 to 3 ms a frame on a phone through a celebration, 4.7 on a desktop at the close scale; 60 fps holds everywhere.

### The timeline, after the audit

The contact audit run on the new fixtures turned up four choreography defects that the 3C sample had not shown:

1. Before a booking, when the offender's own side had the ball, possession changed hands silently and the man about to be fouled "kicked" a ball twelve metres away. The other side now wins it with a tackle where the ball is.
2. A spell-ending tackle or clearance went to the nearest man by formation, who had sometimes just been twenty metres away on the ball himself. The timeline now remembers where each man was last put by an event and gives the ball to one who can reach it.
3. A dismissed keeper kept making saves. The timeline hands the gloves to the same defender the scene puts in goal.
4. The long-range goal (above). A named receiver who stands well behind or wide of the point wanted is played in ahead of himself, up to thirty metres and into the channel (the planner starts his run nine seconds before the ball arrives); a scripted build-up's passes go to men not standing behind the ball; the long-range finish carries in towards goal. Over 1,218 goals: from over thirty metres 21% before, 2.2% now; the longest 75 m before, 43 m now; the median 14 m.

Also: a slide tackle on a man taking his first touch (the ball not yet moved on) comes in across the line the ball arrived on, which was the whole of the slide-tackle residual; the keeper's touch on a woodwork rebound is a parry where the ball reaches him, 1.7 s after the shot, rather than a dive at the post.

### Review aids (in the build, harmless to players)

* `?seed=1991&club=3` on the address starts the same game every time (the club is an index into the shuffled list); `&t=1640` opens the first match watched at that match second.
* In the match, with a keyboard: `,` and `.` step fifteen seconds back and forward; `g`, `c`, `k`, `h`, `w` jump to five seconds before the next goal, card, save, header or volley at goal, or shot against the woodwork. `s` still skips to the next highlight, space pauses, `1`, `2`, `4` set the speed. On a phone the skip button and `?t=` do the same job.

## Tests, performance and outstanding issues

* All fourteen suites pass one at a time on this build (`test-results.txt` has the last lines of each): matchday, playback, matchday-ui, phase25, isometric, highlights, contact (16 checks), camera (20 checks), record (19,457 checks), contracts, hof, youth, equivalence, regression.
* Contact audit on this build: pass 100%, cross 100%, clearance 99%, shot 99%, first-time 100%, header 100%, volley 100%, first touch 100%, catch 100%, parry 100%, keeper's touch 100%, sliding block 95% (19 of 20), standing block 100%, goal-line clearance 93% (14 of 15), slide tackle 100%, standing tackle 100%.
* Performance (headless Chromium, 360x640, 390x664, 844x390, 1366x768): 58.8 to 60.3 fps, p95 frame 18 to 20 ms, 0.4 to 1.7 ms of render per ordinary frame, 1.2 to 4.7 ms through a celebration, 27 to 38 MB of heap after a whole-match tour, load under half a second, 5.42 MB.
* Outstanding, for you to judge in play rather than for me to measure: whether the wave reads at the wide scale on a phone (it is proportional to the scale, so it is a third of a metre at every scale); whether the cut to the scorer feels right when he is near the goalmouth (it pans then); the composition on a wide desktop stage when the celebration is near a touchline (the ground clamp keeps the stand in the corner of the frame rather than letting the void show). The goal-line clearance and sliding block samples are small (15 and 20); one case each sits just over the threshold.
* Not in this build: the ten demonstrations (the next stage; to be agreed in the no-recording format), the 1.6.0 changelog entry (written at release), neighbours pre-painted at cuts (Milestone 5).

## Where to look

Open `soccer-manager-91-m3d-preview.html` with `?seed=1991&club=3` (Leeds, away at Tottenham in week 1) and choose a one-player game; the other rows are other seeds with the same club index. The incidents below are match seconds for `&t=`; the clock in brackets.

| Seed (club 3) | Fixture | Incidents |
|---|---|---|
| 1991 | Tottenham v Leeds 1-0 | header at goal 455 (7:35); bar, first time 805 (13:25); goal from 22 m with a knee slide 1640 (27:20); parry 2455 (40:55) and a volley off the bar 2468 (41:08); bookings 2885 (48:05), 4505 (75:05), 4685 (78:05) |
| 4 | Leeds v QPR 3-1 | volley and a run to the crowd 140 (2:20); header 1160 (19:20); run to the crowd 2120 (35:20), with the main stand behind the celebration; knee slide 5360 (89:20); parries 1150, 2120, 2410, 5035 |
| 6 | Leeds v Crystal Palace 1-1 | knee slide 440 (7:20); huddle 560 (9:20); booking 65 (1:05); red card 3605 (60:05) with the badge; post 4580 (76:20) |
| 7 | Norwich v Leeds 2-4 | six goals: huddle 560, run to the crowd 980 and 1280 (a header), arms aloft 1880, knee slide 2120 and 5000; two bookings a minute apart 3475 and 3487 (58:03); headers saved 2283 and 4297 |
| 10 | Leeds v Arsenal 3-1 | four goals all arms aloft; woodwork four times: 1872, 3816, 4650, 5354 (a header off the bar, 89:20) |
| 13 | Leeds v Nottingham Forest 4-3 | seven goals; the knee slides 560 and 5300; the woodwork 1646, 3154, 5300 |
| 1 | Liverpool v Leeds 1-2 | six catches (first at 38); a goal from 24 m first time with a knee slide 2240 (37:20); a volley 2600 |

The two scales: on a phone a shot from distance (seed 10, 5300 s, from 25 m) should be watched at the wide scale and its celebration at the close one; on a desktop most highlights stay close throughout.

## Files

| File | What it is |
|---|---|
| `soccer-manager-91-m3d-preview.html` | The build. Not for uploading. |
| `test-results.txt` | The last lines of each of the fourteen suites on this build. |
| `source.zip` | The full source, including `legacy/` (the frozen engines the record and equivalence suites compare against). |
| `PHASE-3-ARCHITECTURE.md`, `PHASE-3-QA-REPORT.md` | Updated for 3D (in the source, and copied here). |
