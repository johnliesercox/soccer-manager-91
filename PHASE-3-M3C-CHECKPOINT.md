# Milestone 3C checkpoint: the ball meets the man

Status: for your review. Nothing deployed beyond 1.5.0; this build is `1.6.0-m3c preview`. The engine is untouched; every result, scorer, minute, booking and dismissal is the engine's and the reconciliation suites prove it.

## The short version

You asked for measurable proof that the ball makes proper contact with the player at kicks, headers, volleys, saves and blocks, and that the animation shown is the right one at that moment. There is now a permanent test for it, `test-contact.js`: it takes twenty matches, finds every contact in them (38,700 of them: every pass, cross, shot, header, volley, first touch, catch, parry, block, goal-line clearance and tackle), samples the scene at the contact second and measures the ball against the exact point of the sprite that should be meeting it, for the pose and heading the renderer actually draws. The first run measured the game as it was; the fixes that followed are in this build; the suite now holds the thresholds and will fail if anyone regresses them.

Headline numbers, before and after, per kind of contact (the distance is from the ball to the foot, head or hands that should be on it, in metres; "pass" is the share within a boot's length and at the right height, with the right frame on screen, and no better contact moment elsewhere):

| Contact | n | Pass before | Pass after | Ball to contact point, typical / worst 5% (before) | (after) |
|---|---|---|---|---|---|
| Pass | 17,100 | 91% | 100% | 0.16 / 0.40 | 0.11 / 0.22 |
| Cross | 40 | 33% | 100% | 0.43 / 0.43 | 0.11 / 0.25 |
| Clearance | 1,190 | 94% | 99% | 0.21 / 0.43 | 0.19 / 0.21 |
| Shot | 190 | 68% | 100% | 0.32 / 0.52 | 0.11 / 0.31 |
| First-time shot | 85 | 96% | 99% | 0.22 / 0.34 | 0.11 / 0.25 |
| Header | 25 | 0% | 100% | 0.24 / 0.33 (and 0.30 too low) | 0.00 / 0.20 (height exact) |
| Volley | 10 | 100% | 100% | 0.25 / 0.35 | 0.11 / 0.25 |
| First touch | 18,300 | 98% | 100% | 0.17 / 0.40 | 0.11 / 0.12 |
| Catch | 57 | 83% | 100% | 0.14 / 0.22 (0.41 off in height) | 0.00 / 0.11 |
| Parry | 44 | 96% | 100% | 0.37 / 0.54 | 0.12 / 0.16 |
| Block, sliding | 22 | 6% | 100% | 0.61 / 0.66 | 0.28 / 0.30 |
| Block, standing | 14 | 100% | 100% | 0.27 / 0.41 | 0.03 / 0.07 |
| Goal-line clearance | 9 | 38% | 100% | 0.58 / 0.67 | 0.09 / 0.31 |
| Slide tackle | 430 | 2% | 93% | 0.58 / 0.68 | 0.12 / 0.71 |
| Standing tackle | 1,250 | 10% | 98% | 0.45 / 0.54 | 0.12 / 0.12 |

The facing is now exact too: at the contact, the man faces the ball to within a degree, on average, for every kind (it was 9 to 23 degrees off).

## What was wrong, and what changed

Nine things, found by the audit rather than by eye:

1. **Everyone was a quarter of a second ahead of himself.** The simulation planned each man's step from his position at a tick and then recorded the position *after* the step as the position *at* that tick. So a receiver planned to arrive at the ball at second 16.0 was drawn arriving at 15.75 and already stepping off with it at 16.0; a kicker was drawn moving away as he kicked. Recording positions before the step, not after, fixed the first touch (worst 5% from 0.40 m to 0.12 m), the facing (72 degrees to 0) and a good deal of everything else. This is the single biggest change and it costs nothing.
2. **The ball hopped back at every kick.** The scene set the ball on the kicking spot, then the renderer drew it a further 30 cm ahead of the kicker's feet, so at the instant of the kick the drawn ball jumped 30 cm backwards to where the flight starts. The ahead-of-the-feet offset now lives in the scene, where the blends onto the kicking spot and the tackle spot include it. The pixel-art view, which places its ball on its own, is unchanged.
3. **The kicker sprinted off at the instant of the kick**, because the plan for the kick tick already saw the ball gone. He now holds his follow-through for half a second.
4. **Tacklers stood on the ball.** A slide tackle's foot reaches 85 cm; the tackler was placed on the spot where the ball is won, so his foot overshot it by that much, and the ball then jumped to his feet. A slide now comes in from the side of the ball's path (from the inside), the foot reaches the ball where it is won, the ball lies there for half a second while he finishes the slide and gets up to it. A standing tackle meets the ball head on from 62 cm.
5. **Blocks the same**: a sliding block from 60 cm so the leading foot is on the ball's line, a standing block takes it on the shins, and a blocked ball drops where it hits rather than jumping to the blocker's feet.
6. **Headers were met below the head.** Every header was at exactly 1.75 m with the jump added on top, so the head was 30 cm above the ball. Headers are now met between 2.0 and 2.45 m (varied per header), and the jump is sized so the head arrives exactly at the ball: a visible leap for every header.
7. **Catches were all taken with the arms up**, including a shot at chest height. The keeper now reaches up for a high ball, gathers one at chest height to his chest, and crouches for one along the ground; he stands the right distance behind each.
8. **Corner takers stood on the ball** (foot 43 cm off, body turned 44 degrees from it). The taker and the man who meets the corner now wait where their foot or head will meet it.
9. **The kick's contact frame came too early**: the foot was on the ball for a seventh of a second before the ball left. The wind-up now runs until the ball goes, and the contact frame appears as it goes.
10. **The keeper hung in the air.** He was at full stretch half a second before the ball got to him. He now stays set until a quarter of a second before it, springs, is at full stretch as it arrives, and is down a third of a second later; a low shot is parried low. And a ball in the air at a man's hands or head is now drawn in front of him rather than vanishing behind his sprite for a frame.

## Bookings read from the picture

The 3B recordings showed the referee walking to the offender, but the audit's fixtures showed something worse: the foul happened wherever the ball was, and the man booked was often sixty metres from it (the engine names the offender and the minute; the choreography did not bring the two together). Now:

* Before a booking the ball is played into the offender's part of the pitch, the man who gets it runs at him, and the offender goes in with a slide where the ball is (101 of 105 bookings within 3 m of the foul; the four others are men already sent off, see below).
* The man fouled goes down on his knees for a couple of seconds.
* The referee makes straight for the offender from the whistle (sprinting if he has been left behind by a long ball) and shows the card from a metre and a half, beside him: 105 of 105.
* The card itself is drawn large above the referee's hand, yellow or red, with a dark outline, readable on a phone; and a badge appears over the picture for four seconds, "BOOKED  Declan Allen" with a yellow swatch or "RED CARD  Alan Hunt" with a red one. Goals get the same badge: "GOAL!  Kenny Reid  2 - 1".
* These are checked in `test-highlights.js` section 7.

## Contact emphasis

A header or volley struck, a catch, a parry, a block, a goal-line clearance and the woodwork now get a two-frame burst at the point of contact and a ring that fades over a third of a second, so the moment reads at gameplay scale without the commentary. It is skipped under reduced motion. The ball's trail down to its shadow when it is in the air was already there.

## What to look at

| File | What it is |
|---|---|
| `recordings/tottenham-v-leeds-desktop-*.mp4` and `-phone-*.mp4` | A whole match through the real game (Tottenham v Leeds, seed 1991): a jumped header, a catch at chest height, a parry, the bar, three bookings with the referee walking in and the card held up, slide tackles from the side, the contact flashes and the badges. The timestamps of each are in `recordings/README.md`. |
| `contacts/*.png` | Frame-by-frame strips of single contacts from that match, three times life size: a slide tackle, a header with the burst, a chest-high catch, a booking. |
| `contact-audit-before.txt`, `contact-audit-after.txt` | The audit's full output on the old and the new build, with the worst cases named. |
| `soccer-manager-91-m3c-preview.html` | The build. Not for uploading. |
| `source.zip` | The full source. |

## Tests and performance

* New: `test-contact.js` (the audit, 16 checks, about 15 s). `test-highlights.js` gained section 7 (bookings). `test-isometric.js` samples more frames in its coverage check.
* All twelve suites pass one at a time on this build, including the two-season regression and the engine equivalence check (the engine is byte-for-byte the 1.5.0 engine).
* Performance is unchanged: 60 fps on every viewport measured, 0.4 to 1.5 ms of drawing per frame, 25 to 37 MB of heap after a whole match, half a second to load, 5.4 MB.

## One thing for you to decide: two defects in the engine's own record

The audit found four contacts by men who were off the pitch. Tracing them back, the engine's match record can contradict itself, in two ways:

1. **A player scores after his own red card.** The engine picks scorers and their minutes separately from cards and their minutes, so Micky Bradshaw can be sent off in the 7th minute and score in the 40th. Over four seasons of 4,820 matches that happened 40 times (0.3% of goals, 0.8% of matches). The matchday shows what the record says: a man who has walked off comes back to score.
2. **A second yellow before the first.** When a player is sent off for two bookings, the second booking's minute is drawn independently of the first, and 95 of 341 such dismissals over those seasons have the "second" yellow at an earlier minute than the first, so the match report reads "sent off 50', booked 80'".

Both are in `engine.js`, which you asked me to leave alone, so I have not touched it. The fix is small and changes no result: for (1), move such a goal's minute to before the dismissal, derived from the numbers already drawn (no new random draws, so every result in every save stays identical); for (2), swap the two minutes. If you would like me to make that change in 3D, say so; otherwise the matchday will keep following the record as it is.

## What is next

3D as agreed: the cinematic camera (headers, shots, saves and celebrations as the named cases), celebrations with more impact, a crowd wave that is seen, transitions and presentation; then the ten demonstrations with recordings. No deployment until you have reviewed those.
