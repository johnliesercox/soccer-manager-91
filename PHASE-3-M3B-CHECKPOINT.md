# Milestone 3B checkpoint: the animation set, reactions, crowd, commentary and the rules audit

Status: approved 14 November 2026 (this is the final 3B package, with the header re-roll cells converted and the recordings made on that build). Nothing deployed, the live game is still 1.4.0. The engine is untouched; every result, scorer, minute, booking and dismissal still comes from it, and the reconciliation tests prove it on every match of two seasons.

## The short version

The match now looks like what the commentary says it is. Headers are met in the air by a man who has jumped for the ball, volleys are struck off the ground with the leg back and high, the keeper catches with his arms up and clutches it, or dives and throws a hand at it and gets up afterwards; a tackle is a tackle. When a goal goes in, the scorer celebrates in one of four ways (arms aloft where he stands, a run to the supporters with the others chasing, a short run and a knee slide, a huddle), his teammates come to him, the beaten keeper has his head in his hands or is down on his knees, the nearest defender too, and the scoring side's stands rise in a wave that builds and dies away. A missed chance draws a reaction from the shooter. The commentary is spoken when the action starts ("Kendrick shoots!" at the kick) and resolved when it lands ("Davies holds it."), every highlight that opens on open play is introduced by a line naming the side coming forward, and no shot is struck under a stale line. A season's worth of matches was audited for the football rules you raised: a shot off the post that goes behind untouched is a goal kick, never a corner; a corner only ever follows a defending touch; nothing in play lands beyond the lines.

All of it is drawn with Floyo paintings of the twelve new poses (batch 4, 28 runs plus the two header re-rolls you downloaded, from which only the south-facing jump cell was taken), through the same pipeline as before, so any frame can be re-rolled on another seed in seconds. Every cell of every new pose is painted except the keeper's dives seen from directly behind, which are the generated figure on purpose (below).

## What to look at

| File | What it is |
|---|---|
| `recordings/*.mp4` | Six whole matches recorded through the real game at 1x, Isometric view, close camera: three on a desktop (1366x768) and the same three on a phone (iPhone 13, portrait). The clock, score, commentary line and the log are in frame. Each has a `.json` beside it with the fixture and the length. |
| `soccer-manager-91-m3b-preview.html` | The build (`1.5.0-m3b preview`, 5.4 MB). Watch any match. Not for uploading. |
| `programmes/<fixture>/strip-NN.png` | One strip per highlight of the three recorded fixtures, so you can see any incident frame by frame without scrubbing the video: build-up, the strike, the flight, the outcome, the celebration or the reaction, with the clock and the commentary line under each. |
| `floyo-batch-4/` | The 28 paintings as they came back, and `review-*.png` sheets of the converted cells beside the generated ones. |
| `source.zip` | The full source. |

## Where to find each of the things you asked to see

**Wimbledon v Norwich City 0-4 (seed 6)**, 91 s real time, 15 shots in the match, recordings `wimbledon-v-norwich-0-4-desktop-*.mp4` and `wimbledon-v-norwich-0-4-phone-*.mp4`.

| Video | Clock | What happens | Strip |
|---|---|---|---|
| 0:00 | 0' | kick-off | `strip-01.png` |
| 0:04 | 1' | Gerry Barton shoots, parried, corner, Jon Heywood crosses, Gerry Barton heads wide, goal kick | `strip-02.png` |
| 0:14 | 11' | Gerry Barton crosses, Stuart Griffiths scores with a header, kick-off | `strip-03.png` |
| 0:28 | 28' | Adrian Harrison hits the post, goal kick | `strip-04.png` |
| 0:34 | 34' | Stuart Griffiths scores, kick-off | `strip-05.png` |
| 0:48 | 45' | half-time | `strip-06.png` |
| 0:54 | 57' | Steve Wilson intercepts, red card for Alan Hunt | `strip-07.png` |
| 0:58 | 60' | Iain Duffy scores, kick-off | `strip-08.png` |
| 1:11 | 65' | Stuart Griffiths scores, kick-off | `strip-09.png` |
| 1:25 | 88' | yellow card for Phil Hughes | `strip-10.png` |
| 1:30 | 90' | full time | `strip-11.png` |

**Norwich City v Leeds United 2-4 (seed 7)**, 114 s real time, 20 shots in the match, recordings `norwich-v-leeds-2-4-desktop-*.mp4` and `norwich-v-leeds-2-4-phone-*.mp4`.

| Video | Clock | What happens | Strip |
|---|---|---|---|
| 0:00 | 0' | kick-off | `strip-01.png` |
| 0:04 | 9' | Craig Molloy tackles, Carlton Lewis scores with a first-time finish, kick-off | `strip-02.png` |
| 0:18 | 16' | Terry Clarke scores, kick-off | `strip-03.png` |
| 0:30 | 21' | Carl Dixon crosses, Kenny Reid scores with a header, kick-off | `strip-04.png` |
| 0:43 | 24' | Carl Dixon shoots (first time), parried, Jimmy Green's shot blocked | `strip-05.png` |
| 0:50 | 31' | Ian Parker scores, kick-off | `strip-06.png` |
| 1:02 | 35' | Carlton Lewis shoots, parried, corner, Carlton Lewis crosses, Terry Clarke scores with a header, kick-off | `strip-07.png` |
| 1:16 | 45' | half-time | `strip-08.png` |
| 1:21 | 52' | Carlton Lewis crosses, Terry Clarke hits the bar with a header, Carlton Lewis shoots over, goal kick | `strip-09.png` |
| 1:28 | 58' | yellow card for Ian Whitworth | `strip-10.png` |
| 1:32 | 58' | yellow card for Terry Clarke | `strip-11.png` |
| 1:39 | 83' | Terry Clarke hits the post, Craig Molloy scores with a first-time finish, kick-off | `strip-12.png` |
| 1:52 | 90' | full time | `strip-13.png` |

**Chelsea v Norwich City 0-0 (seed 1)**, 72 s real time, 10 shots in the match, recordings `chelsea-v-norwich-0-0-desktop-*.mp4` and `chelsea-v-norwich-0-0-phone-*.mp4`.

| Video | Clock | What happens | Strip |
|---|---|---|---|
| 0:00 | 0' | kick-off | `strip-01.png` |
| 0:04 | 3' | Derek Sharp crosses, Phil Bennett shoots (volley), caught | `strip-02.png` |
| 0:14 | 13' | Phil Bennett shoots, caught | `strip-03.png` |
| 0:24 | 18' | Trevor Lomax hits the bar, Gareth Blackmore's shot cleared off the line, Eamonn Rogers clears with a header | `strip-04.png` |
| 0:32 | 37' | Trevor Lomax's shot blocked, corner, Dave McDonald crosses, Trevor Lomax heads wide, goal kick | `strip-05.png` |
| 0:44 | 45' | half-time | `strip-06.png` |
| 0:50 | 49' | yellow card for Derek Sharp | `strip-07.png` |
| 0:57 | 74' | yellow card for Gary Knight | `strip-08.png` |
| 1:03 | 85' | Phil Bennett shoots over, goal kick | `strip-09.png` |
| 1:10 | 89' | Derek Sharp intercepts, full time | `strip-10.png` |

By the things you asked to see:

* **Headed goals**: Wimbledon v Norwich City 0-4 at 0:14; Norwich City v Leeds United 2-4 at 0:30; Norwich City v Leeds United 2-4 at 1:02.
* **Volleys and first-time finishes**: Norwich City v Leeds United 2-4 at 0:04; Norwich City v Leeds United 2-4 at 0:43; Norwich City v Leeds United 2-4 at 1:21; Norwich City v Leeds United 2-4 at 1:39; Chelsea v Norwich City 0-0 at 0:04; Chelsea v Norwich City 0-0 at 0:24.
* **Saves (catches and parries)**: Wimbledon v Norwich City 0-4 at 0:04; Norwich City v Leeds United 2-4 at 0:43; Norwich City v Leeds United 2-4 at 1:02; Chelsea v Norwich City 0-0 at 0:04; Chelsea v Norwich City 0-0 at 0:14.
* **Woodwork**: Wimbledon v Norwich City 0-4 at 0:28; Norwich City v Leeds United 2-4 at 1:21; Norwich City v Leeds United 2-4 at 1:39; Chelsea v Norwich City 0-0 at 0:24.
* **Blocks and goal-line clearances**: Norwich City v Leeds United 2-4 at 0:43; Chelsea v Norwich City 0-0 at 0:24; Chelsea v Norwich City 0-0 at 0:32.
* **Bookings and the sending-off**: Wimbledon v Norwich City 0-4 at 0:54; Wimbledon v Norwich City 0-4 at 1:25; Norwich City v Leeds United 2-4 at 1:28; Norwich City v Leeds United 2-4 at 1:32; Chelsea v Norwich City 0-0 at 0:50; Chelsea v Norwich City 0-0 at 0:57.
* **Missed chances**: Wimbledon v Norwich City 0-4 at 0:04; Norwich City v Leeds United 2-4 at 1:21; Chelsea v Norwich City 0-0 at 0:32; Chelsea v Norwich City 0-0 at 1:03.
* **Celebrations**: Wimbledon v Norwich City 0-4 at 0:14; Wimbledon v Norwich City 0-4 at 0:34; Wimbledon v Norwich City 0-4 at 0:58; Wimbledon v Norwich City 0-4 at 1:11; Norwich City v Leeds United 2-4 at 0:04; Norwich City v Leeds United 2-4 at 0:18; Norwich City v Leeds United 2-4 at 0:30; Norwich City v Leeds United 2-4 at 0:50; Norwich City v Leeds United 2-4 at 1:02; Norwich City v Leeds United 2-4 at 1:39.
* **Corners and what comes of them**: Wimbledon v Norwich City 0-4 at 0:04; Norwich City v Leeds United 2-4 at 1:02; Chelsea v Norwich City 0-0 at 0:32.

## The six points from your 3A approval

**1. Football rules and event continuity.** I audited a whole season (731 matches, about 9,000 shots) for the chains you described and fixed what the audit found:

* A shot off the post or bar that runs behind untouched is now a goal kick. The only woodwork-to-corner chain left is the one where the keeper gets a hand to the rebound and turns it behind, and that touch is now an event of its own with a line of its own ("Davies gets a hand to the rebound and turns it behind!"), so you see why it is a corner.
* Corners off parries, blocks, goal-line clearances and headed clearances all keep the defender's touch in the chain, and the ball sets off for the corner flag at the moment of that touch, never before the clearance that sent it there has landed.
* Nothing in play ends beyond the lines or on the advertising boards: a ball that goes behind travels to the line and is shown just past it, dead, until the restart. The audit checks every event's landing spot.
* A clearance names the man who collects it and never the man who cleared it, so nobody runs 30 metres to collect his own clearance.
* A corner that is shown is followed: the corner and the chance it is swung into are one sequence for the picker, so a window never closes as the ball arrives at the near post. (I found this one in the first set of recordings, in the Chelsea match, and re-recorded all six.) While there, the variety rule stopped counting "cross" and "corner" as things the viewer has seen enough of, so the one volley in a match is not passed over for a third routine catch, and the spacing rule measures from goals and cards rather than the whistles.
* Two more things the recordings showed up: a shot wide could land twenty metres wide of the post (it now goes half a metre to six wide, a header or volley at most three and a half), and the referee showed a card from wherever he happened to be standing. He now walks to the offender and shows it from a metre and a half, with the offender standing for it, so a booking reads from the picture alone. A corner that follows straight after another corner, headed behind at the far post, gives the taker six seconds to get across rather than four.
* The audit is now a permanent test (`test-highlights.js`, section 4): no teleports between events, every corner after a defending touch, every goal kick after an attacking touch, no live ball beyond the lines, no caught shot that rebounds.

**2. Commentary synchronisation.** Lines now have two moments, the launch and the arrival. "Kick-off" or an old booking line cannot sit under an attack any more: every highlight that does not open on a restart or a whistle begins with a lead-in ("Norwich come forward."), and if nothing has been said in the six seconds before a shot, a build-up line names the man on the ball first. A seek re-synchronises the line. Measured over 40 matches: 652 of 652 shots are called at the kick and resolved at the landing, every open-play highlight has its lead-in, and no shot is struck under a line older than eight seconds.

**3. Visual clarity through the animation.** The twelve new poses: header (crouch, the leap with the head thrown at the ball, landing), volley (leg back, the horizontal contact, follow-through), standing tackle, catch (arms up, clutched), parry (the dive with one hand thrown at the ball), getting up, knee slide, running with the arms up (four frames), the hug, head in hands, kneeling, appealing. The header's jump is timed to the ball: a man meets a ball at 1.9 m with a 0.4 m leap and lands after the contact. The keeper's dive re-rolls came back and the one that improved (the dive seen from the north-east) was taken; the dives and parries seen from directly behind (headings N and NW) are now the generated figure rather than a painting, on purpose, see the limitations.

**4. Celebrations and emotions.** Four celebration styles chosen from the match and the goal, so the same scorer celebrates differently in different matches; the scale grows with the goal (an equaliser or a lead taken late brings four or five teammates rather than three); the camera moves ahead to where the scorer is heading so he runs into frame; the beaten keeper and the nearest defender react; a miss, the woodwork or a line clearance draws head-in-hands, kneeling or an appeal from the shooter. The scoring side's crowd rises in a travelling wave through the stands that hold its supporters (home: the main stand and the left end; away: the right end), bigger for a goal that matters, skipped under reduced motion.

**5. Highlight variety.** Each match draws a temperament from its seed (how good the keepers are, how often the woodwork is hit, how wayward the finishing is, how many shots are blocked), so a 1-0 one week reads nothing like a 1-0 the next; the shot budget's noise is wider too. Everything is still a pure function of the official record and the seed: replay the same match and you get the same programme, and the official result, scorers, minutes and cards are untouched (the reconciliation tests check every match).

**6. The 3B review recordings.** Above, with the map.

## How the numbers come out

Over a season of 731 matches: 9,700 shots, 62% kicked, 28% first time, 6% headed, 4% volleyed; 21% caught, 19% wide, 18% parried, 13% over, 8% blocked by a slide, 7% blocked standing, 6% off the post, 5% cleared off the line, 2% off the bar, with the per-match temperament moving each of those by up to half either way. Goals: through balls 34%, cross headed 12%, cross volleyed 6%, corner headed in 6%, rebounds 12%, solo runs 10%, long shots 8% (where the official timing allows them). Scene building takes about 270 ms per match on this machine, the frame rate is unchanged (the new frames are the same blits), and the build grew from 4.3 to 5.4 MB because the sprite sheets are 70% taller.

## What else changed

* `test-highlights.js` gained sections 4 (rules), 5 (commentary) and 6 (celebrations and crowd) and a check that a corner shown is followed to its outcome; `test-phase25.js` knows the new actions and the `celebration` camera kind; all eleven suites pass one at a time on this build.
* Performance is unchanged with the taller sheets: 60 fps on every viewport measured (360x640 up to 1366x768), under 1.5 ms of drawing per frame, 25 to 38 MB of heap after a whole match, half a second to load.
* `tools/iso_paint.py` pads older override sheets to the new height, converts a subset of headings from an image (`--dirs`) and erases cells (`--erase`); `tools/floyo/make_runs.py` takes an optional extra sentence per job. Documented in `tools/floyo/README.md` and `ART-PIPELINE.md`.
* `PHASE-3-ARCHITECTURE.md` has a Milestone 3B section; `PHASE-3-QA-REPORT.md` the 3B table.

## Known limitations

* The keeper's dive and parry seen from directly behind (headings N and NW): a body lying along the line of sight projects as a short upright shape, and every seed paints it as a standing man. Those cells are now deliberately the generated figure, which does lie down, and they are a small minority of dives (the camera is usually to the side of the goal).
* The near terrace does not join the crowd wave (it is drawn in front of the pitch and would cover the action); the three other stands do.
* The camera's pan during a celebration run can lag the scorer by a stride when he turns sharply; the cinematic camera work is the next milestone.

## What is next, as agreed

The rest of Milestone 3: the ball-to-feet instrumentation over 20 matches (3C) and the cinematic camera (3D), then the ten gameplay demonstrations with desktop and mobile recordings, tests and performance. No deployment until you say.

## What I need from you

1. Whether the animations read without the commentary: watch one of the phone recordings with the sound off and tell me which incidents you could not follow.
2. Whether the celebrations are the right size and length, and whether the crowd wave is too much or too little.
