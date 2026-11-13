# Matchday architecture

How the animated match viewer fits into Soccer Manager '91, and how to extend it (Phase 1 markers, Phase 2 pixel-art players and Phase 2.5 believable football are done; an isometric view or a 3D renderer come next) without touching the simulation. Read this before changing anything under `src/matchday/`. Section **Phase 3 handover contract** at the end is the part a renderer author needs.

## The one rule

**The simulation is authoritative; the viewer is replaceable.** `playMatch` in `engine.js` decides every goal, scorer, card, injury, attendance, extra-time and penalty outcome. The viewer only *illustrates* a result that has already been applied to the game and saved. Nothing in `src/matchday/` may:

* call `playMatch` or `advanceWeek`,
* read or advance the engine's random generator (`rand` in `engine.js`),
* mutate a player, club or state object,
* write to the save,
* change a score, scorer, minute or winner.

The tests enforce the important parts (see Testing).

## Data flow

```
advanceWeek(state)            engine.js, once per week, results applied and saved
      |
      v  results[] (finished match records)
capture(state, m, info)       capture.js  -> MatchPresentation (frozen, events: null)
      |
      v
withTimeline(presentation)    timeline.js -> presentation with events[] (frozen, validated)
      |
      v
createScene(presentation)     scene.js: ball keyframes + set pieces, then
   behaviour.js                 roles and targets per quarter-second tick (press, cover, support, receiver, keeper, referee)
   trajectories.js              bounded paths in m/s with facing, stepped ONCE at build time and recorded
   interactions.js              control times, action beats (pass, shoot, receive, tackle, block, dive, set), ball state, camera interest
                              -> getSceneAt(matchSecond): a pure lookup
      |
      v
createPlayback(presentation)  playback.js -> real time -> match seconds, event stream, highlight cuts
      |
      v
renderer.render(scene, hud)   renderers/* -> pixels
```

`matchday-ui.js` glues these to the existing screens; `sprites.js` supplies the pixel art to `renderers/pixelart.js`. Everything is plain scripts concatenated into the single HTML file by `build.py` (no modules, no bundler), so the GitHub Pages deployment and the service worker are unchanged.

## Modules

### `schema.js`: the contract
Defines `Matchday.SCHEMA_VERSION` (1), the `EVENT` types, `PERIODS` (regulation 0 to 5400 s, extra time 5400 to 7200 s), `validate(presentation)`, `hashString`, `seededRandom`, and the shared team-shape model (`formationAnchors`, `shapePos`).

A **MatchPresentation**:

```js
{
  schemaVersion: 1,
  matchId: 's1-w3-12-8-cup-lc',      // season, week, home club id, away club id, competition
  seed: 123456789,                    // hashString(matchId): drives every illustrative choice
  competition: { kind: 'league'|'cup'|'euro', key, name, round?, leg?, final?, neutral?, division? },
  period: { regulationMinutes: 90, hasExtraTime, hasPenalties },
  teams: { home: { id:'club-12', clubId:12, name, short, kit:{ primary, secondary, changed? } }, away: {...} },
  players: [ { id:'4021', teamId:'club-12', name, role:'GK'|'DEF'|'MID'|'FWD', naturalRole, shirtNo, skill } ],
  official: {                         // the authoritative record, copied from the engine
    homeGoals, awayGoals,
    scorers: [ { eventId:'goal-1', teamId, playerId|null, playerName, minute, period:'regulation'|'extraTime' } ],
    extra: 'aet'|'pens'|null, penaltiesWinnerTeamId,
    cards: [ { eventId:'card-1', teamId, playerId, playerName, minute, card:'yellow'|'red' } ],
    injuries, attendance,
    aggregate: { home, away }|null,   // second legs only, oriented to THIS match's home/away
    winnerTeamId|null                 // ties decided over two legs
  },
  events: null | [ ... ]              // filled by the timeline builder
}
```

**Events** (`events[]`, sorted by `matchSecond`, ids unique):

```js
{ id:'ev-17', type:'PASS', matchSecond: 83, provenance:'illustrative',
  teamId, playerId, toPlayerId?, from:{x,y}, to:{x,y}, duration: 1.8, text: null }
```

* `provenance` is `official` for anything that comes from the engine's record (KICK_OFF, HALF_TIME, SECOND_HALF, FULL_TIME, ET_START, ET_HALF, ET_END, PENALTIES, SHOOTOUT_RESULT, GOAL, CARD, SENT_OFF) and `illustrative` for choreography (PASS, RUN, TACKLE, CLEARANCE, SHOT_SAVED, SHOT_WIDE, SHOT_BLOCKED, CORNER, GOAL_KICK, FOUL). `validate` refuses the wrong provenance for a type.
* Coordinates are normalised **absolute** pitch coordinates, `x` along the length, `y` across, both 0..1. The home side attacks towards `x = 1` in the first half and towards `x = 0` after half-time. Events store the direction they were played in, so renderers never need to know the half. `z` (0..1, elevation) is reserved and is produced by the scene for ball flight.
* Timing: `matchSecond` is when an event **resolves**. An event with `from`/`to`/`duration` describes the ball leaving `from` at `matchSecond - duration` and arriving at `to` at `matchSecond`. A GOAL's `matchSecond` is the instant the ball crosses the line, which is when the score changes and the commentary fires.
* `eventRef` on a GOAL points at the `official.scorers[].eventId` it represents. The number of GOAL events always equals `homeGoals + awayGoals`; `validate` checks it.

### `capture.js`: official record to presentation
`capture(state, m, info)` reads a finished match record `m` (as returned by `advanceWeek`) and `state.lastWeekInfo`. It copies the XIs (`m.xiH`, `m.xiA`), scorers, cards, injuries, attendance, extra, aggregate and winner, assigns shirt numbers by slot, looks up kit colours (`KITS` table, with a deterministic fallback colour per club id) and resolves kit clashes (away side wears its second colour, then a neutral yellow). It returns a frozen object with `events: null`.

Call it only after the week has fully resolved: European second legs are adjusted (score, extra, aggregate, winner) after `playMatch` returns, and the capture must see the final figures. The UI does this after `advanceWeek` and `save()` have both completed.

### `timeline.js`: anchors plus choreography
`withTimeline(p)` returns a new frozen presentation with `events`. Official anchors are placed from the record: goals at `(minute - 1) * 60 + 30` (capped before the whistle), cards at `(minute - 1) * 60 + 15`, the period boundaries from `PERIODS`, PENALTIES and SHOOTOUT_RESULT after extra time. Between anchors it writes possession spells (passes, a dribble, then a save, a shot wide, a block or a tackle) using `seededRandom(p.seed)` and nothing else. The build-up to each goal is scripted so the GOAL event lands exactly on its anchor, with the official scorer taking the shot (or the current carrier when the scorer is unknown). Passes are aimed at where a teammate actually stands according to the shared shape model, so the scene never has to make anyone sprint.

Red cards remove the player from the pool of candidates for the rest of the match (`SENT_OFF`). Two anchors in the same minute are separated (a goal needs room for its build-up): the earlier one is pulled towards the start of its minute, and only if that is not enough is the later one pushed on, so a logged minute can be out by one in that rare case. Goals are never placed within 26 seconds of a period start.

`validate` runs on the result and the builder throws if it fails, so a presentation that reaches a renderer is always consistent with the official score.

### `scene.js`, `behaviour.js`, `trajectories.js`, `interactions.js`: the football
`createScene(p)` builds the whole match once and returns `getSceneAt(matchSecond)`:

```js
{ t, phase, phaseLabel, clock:{ minute, second, label, extraTime }, score:{ home, away },
  possession: teamId, attackDir: { [teamId]: 1|-1 }, attack: { [teamId]: 0..1 }, formations: { [teamId]: '4-4-2' },
  ball: { x, y, z, state:'controlled'|'travelling'|'loose'|'dead', carrierId, inFlight, actionId },
  players: [ { id, teamId, name, shirtNo, role, x, y, vx, vy, speedMs, movement:'idle'|'walk'|'jog'|'run'|'sprint',
               facingAngle, action:'none'|'pass'|'shoot'|'receive'|'tackle'|'block'|'dive'|'set'|'celebrate'|'booked',
               actionPhase: 0..1, aim:{x,y}|null, intent, hasBall, sentOff } ],
  ref: { x, y, vx, vy, speedMs, movement, facingAngle, signal: null|'goal'|'yellow'|'red'|'whistle' },
  cameraInterest: { x, y, kind:'openPlay'|'attack'|'setPiece'|'goal', participants:[playerId] },
  setPiece: null|'corner'|'celebration', flash: { type:'goal', teamId, age }|null, live: bool }
```

How it is built, in order:

1. **Ball keyframes** (`scene.js`). Every timeline event becomes one or two keyframes: a `launch` (the instant the ball leaves a foot) and an `arrive` (where and when it gets there, and who takes it), `hold` (a tackle or clearance), `restart` (kick-off, corner, goal kick; `cut` marks a new period), `goal`. Keys carry `eventId`, and flags such as `shot`, `save`, `block`, `tackle`, `parry`, `out`.
2. **Set pieces** (`scene.js`). Corners pull five attackers into the box, two to its edge and eight defenders back to mark with the keeper on his line; a goal sends the scorer towards the touchline with his three nearest teammates while the beaten keeper fetches the ball. These are targets with speed bands; the planner treats them like any other job.
3. **Roles and targets** (`behaviour.js`). Every quarter of a second the planner decides, from the current planned positions, what each player should do: the **carrier** tracks the ball path; the **receiver** of the next pass (or the collector of a loose ball) heads to the arrival point at the speed he needs; the two attackers nearest the ball by shape **support** by offering an angle a third of the way towards it (never inside seven metres); the nearest defender **presses** to 1.6 m from the ball and the next nearest **covers** eight metres goal-side; everyone else holds the team **shape** (formation anchor, slid with a one-second-lagged ball, stretched when attacking and compacted when defending, with lines that never collapse onto their own goal); **keepers** stay goal-oriented, come off the line when play is far and **set** themselves while a shot is in the air; the **referee** keeps up from a little inside and never within four metres of the ball. Press and cover have hysteresis so they do not flicker, and a possession change takes effect after 0.4 s. A keeper who is sent off is replaced by a defender for the rest of the match (`roleAt`).
4. **Bounded paths** (`trajectories.js`). The match is stepped once, tick by tick: each actor accelerates towards its target at no more than 6.5 m/s², within its band (walk 1.6, jog 3.6, run 6.0, sprint 8.0 m/s), brakes to arrive, is nudged at most 0.18 m per tick away from anyone closer than 1.4 m, and is only ever placed instantly at a cut (the start of a period). Each actor's facing turns at a limited rate and holds when he stands still. When a pass is struck, its arrival point is pulled up to seven metres towards where its receiver can actually get to, and his following dribble shifts with it; shots and goals are never moved. Positions and facings are recorded in typed arrays (about 1.5 MB per match) and sampled by interpolation, so `getSceneAt` is a pure lookup in any order and the velocities it reports are slopes of recorded paths.
5. **Beats and ball state** (`interactions.js`). A hand-over only takes effect when its new carrier is within 1.6 m of the ball (`controlT`, up to 1.6 s of grace, during which the ball is `loose`); action windows with a normalised phase are derived per player (`pass`/`shoot` from 0.5 s before contact to 0.35 s after, `receive` around the first touch, `set` and `dive` for keepers, `tackle`, `block`, `celebrate`, `booked`); the displayed ball sits at its carrier's feet while controlled, blending into and out of the pinned launch and arrival points; and `cameraInterest` leans towards the receiver before a pass, towards the goal during shots and goals.

`score` counts official GOAL events at or before `t`, so a renderer cannot show a score the match has not earned. Nothing in these modules reads or changes game state.

### `playback.js`: time and controls
`createPlayback(p, { onFrame, onEvent, onState, onEnd })` maps real seconds to match seconds with `requestAnimationFrame`. A regulation match takes about 78 real seconds at 1x (plus 24 for extra time): highlight windows (every goal build-up, cards, kick-offs, whistles and a handful of chances chosen from the seed) run at 1.7x to 3.2x real time; everything else fast-forwards. The map is built once, deterministically, from the presentation (`buildTimeMap`).

The controller keeps two clocks. `matchSecond` is the official clock shown on the scoreboard. `sceneSecond` is what the renderer draws: identical during a highlight, but during a fast-forward the picture keeps playing at highlight pace from where the gap started while the clock races ahead, and when the next highlight begins the picture cuts to it (`sinceCut` goes to 0 and the renderers fade in from black for 0.3 s). Drawing the scene at the racing clock instead would make the players teleport every frame; `test-playback.js` measures frame-to-frame movement of what is drawn to make sure this stays fixed.

Controls: `play`, `pause`, `toggle`, `setSpeed(1|2|4)`, `seek(sec)`, `skip()`, `replay()`, `dispose()`. Events fire through `onEvent` as the clock passes them: every official event, and illustrative lines only inside highlight windows. `skip()` emits the remaining official events so the log is complete and ends at exactly the same second as a watched match. The controller never touches game state.

### `renderers/`: the swap point
Every renderer implements:

```js
const r = Matchday.renderers.<id>.create(options);
r.mount(containerElement, presentation);   // create DOM, read kits/names
r.render(scene, hud);                      // draw one frame; hud = { fastForward, speed, reducedMotion, sinceCut }
r.resize();                                // container size changed
r.dispose();                               // remove DOM, observers, caches, audio
```

and registers itself as `Matchday.renderers[id] = { id, name, create, drawFrame }`. `drawFrame(ctx, w, h, scene, info)` is a pure function used by the headless tests and screenshot tooling.

* `canvas2d.js` (`id: 'canvas2d'`): the Phase 1 top-down pitch. Striped grass, full markings, goals with nets, home players as discs and away players as rounded squares (shape backs up colour for colour-blind players), shirt numbers, keepers in inverted colours, a ball with a shadow that lifts with `z`, a goal flash, and a fast-forward marker. It caches the pitch to an offscreen canvas per size and draws at 1 canvas pixel per CSS pixel with `image-rendering: pixelated` for the retro look (`pixelDensity: 'sharp'` uses device pixels). It picks portrait or landscape by whichever gives the larger pitch. It also exports `Matchday.renderers.common` (layout, pitch drawing, palette) for other canvas renderers.
* `pixelart.js` (`id: 'pixelart'`, the default view since 1.3): the stadium. A world image (pitch plus stands and a seeded crowd, cached per size, with a second copy where the crowd jumps for goals), 22 directional sprites from `sprites.js` in kit colours, a referee, a ball that sits at its carrier's feet with a restrained possession ring and lifts with `z` in flight, name tags, and a camera that frames `cameraInterest` at integer zoom 2 (or shows the whole pitch; the choice persists in `localStorage['sm91-matchday-camera']`) with a dead zone, a capped pan speed, goal-mouth framing during attacks, and snaps only on cuts, seeks and mode switches. Per actor it keeps only animation state: a four-way facing chosen from the scene's `facingAngle` with hysteresis, and a run cycle advanced by metres covered (walk frames at a slower cadence). Poses come from the scene's `action` and `actionPhase`: the kick pose spans the contact window of a pass or shot, `receive` is a raised foot at the first touch, `set` a keeper's crouch, `dive`, `slide`, `block`, `celebrate`, `booked`. During a fast-forward it shows a "NEXT HIGHLIGHT" banner and fades in from black at the cut; the goal overlay appears a beat after the ball crosses the line, in the half of the view away from the goal. Tap a player to select him: the renderer calls `onSelect(player)` and draws a tag for 3.5 s. Integer zoom and image smoothing off keep every pixel crisp.
* `wireframe.js` (`id: 'wireframe'`): the proof that the contract is real. A green-phosphor tactics board with O and X markers, built without touching anything but the scene. Selectable in the viewer with the View button.

The renderer may not calculate goals, decide winners, generate events, mutate players or save anything. It only draws scenes.

### `sprites.js`: pixel sprites drawn in code
A "paper doll" rasteriser. Every sprite is a 24 x 24 cell with the feet on row 22, built from a list of coloured rectangles (palette indexes) per facing (`down`, `up`, `right`; `left` is a mirror) and pose (`idle`, `run` x4, `kick`, `shoot`, `slide`, `dive`, `celebrate` x2, `booked`, `point`, `card` x2, `whistle`), given a one-pixel outline, then coloured for a kit (shirt, trim, shorts, socks derived from the kit's two colours) and a skin/hair variant chosen from the player id, and cached as a small canvas. `Matchday.sprites.get(kit, variant, facing, pose, frame)` returns the canvas; `setCanvasFactory` lets Node tests supply `@napi-rs/canvas`. There are no image files, so the service worker list is unchanged and nothing needs licensing. To replace the look with hand-drawn art later, keep `get()`'s signature and return slices of a loaded sheet instead.

### `audio.js`
WebAudio only: a square-wave whistle and a filtered-noise crowd that swells for goals and chances. Off by default; the choice is stored in `localStorage['sm91-matchday-sound']`. Nodes are created on the first user gesture and torn down by `stop()` when the viewer closes.

### `matchday-ui.js`: the screens
`Matchday.ui.install(ctx)` receives the shell's helpers (`S`, `SCREENS`, `go`, `render`, `esc`, `$`, `toast`, `user`, `mgr`, `multi`, `euroComp`, `Track`) and adds three screens:

* `matchpick`: the fixture, venue and two buttons, **Watch the match** or **Instant result**. No score, no header (the balance and week are hidden so cup prize money cannot hint at the result).
* `matchview`: scoreboard, clock and phase (with the name of the player on the ball; during a fast-forward the clock is prefixed with ▶▶ and turns orange), the renderer stage, a commentary line (`aria-live`; a tapped player's name, position and number appear here too), an event log, Camera, View and Sound buttons, and the action bar with Pause/Play, 1x, 2x, 4x and Skip. The Camera button is hidden for renderers without `setCamera`. The screen opens immediately and the football is planned in a following tick (about 300 ms on a desktop, "Preparing the match..." meanwhile). On screens 900 px and wider (and at least 600 px tall) the shell widens to 1240 px (1500 px from 1600 px wide) for this screen only (`body.md-wide`) and `.md-wrap` becomes a two-column grid: the stage fills the left column to the height of the window (capped at 820 px), with commentary, the event log and the Camera/View/Sound buttons in a 300 px column on the right, so nothing needs scrolling on a desktop. Keyboard: space pauses, `s` skips, `1`/`2`/`4` set the speed. `prefers-reduced-motion` keeps the viewer but redraws at most five times a second.
* `matchresult`: the official result card (score, scorers, extra time, penalties, aggregate, cards, injuries) and Continue.

Week flow, called by the shell's `playWeek()` after `advanceWeek` and `save()`:

* Single manager: for each of the manager's matches this week (league or cup, then Europe): `matchpick` → (`matchview` →) `matchresult`; then the existing `weekdone` screen.
* Hot-seat: `startWeek` builds a **matchday round** of every active manager with a game. For each: the `pass` screen (labelled "Matchday"), then that manager's `matchpick`/`matchview`/`matchresult`. Only after the round does the shared `weekmulti` board appear, so no result leaks early. Managers with no game that week are skipped. The round uses `setCurrent` to switch managers, exactly like a normal turn.

Navigation is blocked while a matchday is in progress (`inMatchday()` in the shell), and `go()` disposes the viewer whenever the screen changes. Nothing about the viewer is saved: a reload mid-match lands on the normal post-week flow with the results already applied ("watch it now or lose it", by design).

## Adding a renderer

1. Create `src/matchday/renderers/<id>.js` implementing the contract above and registering `Matchday.renderers.<id>`. Read only the `scene` and the `presentation.teams` you were given in `mount`.
2. Add the file to `MATCHDAY_FILES` in `build.py` (after `canvas2d.js` if you use `Matchday.renderers.common`).
3. It appears automatically in the viewer's View toggle; the choice persists in `localStorage['sm91-matchday-view']`.
4. Add a `drawFrame`-style pure function so `test-playback.js` can exercise it headlessly with `@napi-rs/canvas`.

The **pixel-art** renderer (Phase 2, done) is the worked example: it keeps per-player animation state (facing, run cycle) and reads `vx/vy`, `anim` and `aim` from the scene. If hand-drawn sprite sheets replace the generated ones, keep `Matchday.sprites.get()`'s signature; as image files they would go under `assets/matchday/` and into the service worker shell list.

For an **isometric** renderer: project `(x, y, z)` through an isometric matrix inside the renderer; nothing upstream changes. For **3D** (Three.js/WebGL): same contract, `mount` creates the WebGL canvas, `render` updates object transforms from the scene. Camera, lighting and models are renderer-private.

What would need a new engine, not a new renderer: a genuinely live simulation where player decisions produce the result (Phase 4+). That means a spatial match engine with its own tick and new balance tests; the schema's `official` block and the renderer contract could be kept, but `playMatch` would be replaced, not wrapped.

## Testing

* `node test-matchday.js`: captures every match of two seeded seasons (2,400+), validates each presentation, reconciles scorers, cards, extra time, penalties and aggregates against the engine record, checks determinism (same seed, same timeline), checks that building presentations does not change a seeded world (RNG isolation), tolerates unknown scorers, rejects a tampered score, checks every team's formation lines are centred and spread, and walks scenes at half-second and 50 ms steps for pitch bounds, monotonic score, correct final score, end swapping, sent-off handling and movement speed (no teleports, set pieces included).
* `node test-playback.js`: time map shape and duration, event emission order and completeness, skip/pause/speed/seek behaviour, frame-to-frame smoothness of what is drawn, and headless renders of all three renderers at several sizes, phases and camera modes, plus sprite generation for every pose and facing (writes PNGs to the scratchpad).
* `node test-matchday-ui.js`: the viewer inside the real UI in jsdom (single manager, three-manager hot-seat, reduced motion), including a check that watching changes nothing in the game state.
* `node test-phase25.js`: the Phase 2.5 acceptance matrix. Order-independent sampling (forward, backward, shuffled, and a rebuilt scene), speed and acceleration limits in metres per second, separation, one ball owner at the feet, ball state transitions, receivers meeting the ball, kickers on the ball at contact with a pass/shoot action, score and ball position at the official goal second, ten men and a stand-in keeper after a dismissal, no teleports at 50 ms steps, build time, and headless renderer checks (rare facing changes, smooth camera, old renderers still drawing).
* `node test-equivalence.js`: the 1.2.0 engine against the 1.1.2 engine for the same seeds; identical for whole seasons with extra-time crediting switched off, and identical up to the first extra-time match with it on.
* `node test-regression.js`, `test-contracts.js`, `test-youth.js`, `test-hof.js`: the existing suites, now driving the new matchday screens.

## Known limitations (after Phase 2.5)

* Shoot-outs are a single line ("X win on penalties"); the engine records only the winner, not the kicks.
* Injuries have no minute in the engine, so they are not animated; they appear on the result card.
* The choreography is illustrative: there is no offside, no throw-ins or free kicks (fouls only precede cards). About 2% of hand-overs are reached late (the ball waits loose up to 1.6 s, then is gathered from up to a few metres), and in a handful of moments per match the controlled ball can sit up to 4 m from its owner while blending to a pinned kick point.
* The planner steps at 0.25 s, so speed changes happen in quarter-second steps (acceleration up to about 12 m/s² when separation nudges coincide with a direction change).
* Sprites are generated, not hand-drawn: one body shape, four facings, and kits reduced to two colours (no stripes or hoops).
* The scene build takes about 300 ms on a desktop (a second or so on a mid-range phone) when Watch is tapped; the screen opens first.

## Phase 3 handover contract

What an isometric (or 3D) renderer can rely on. Nothing here depends on the pixel renderer.

1. **World space and units.** Positions are normalised `0..1` over a 105 × 68 m pitch: `x` along the length, `y` across; metres are `x*105`, `y*68`. The home side attacks towards `x = 1` in the first half and `x = 0` afterwards (`scene.attackDir`). Ball height `z` is `0..1` (about 0 to 3 m); the ground shadow belongs under `(x, y)`. `facingAngle` is radians in metre space (`atan2(dy*68, dx*105)`), `vx/vy` are pitch units per second, `speedMs` metres per second.
2. **Time.** `matchSecond` is the official clock; `sceneSecond` (from the playback controller) is what to draw, which differs only during a fast-forward. `getSceneAt` is pure and random-access; `playback.state().sinceCut` is 0 at a cut, seek or replay, and that is the only moment a renderer should snap anything.
3. **Players.** Stable `id` per player and `teamId` per side; `role` is the role in play (a stand-in keeper reports `GK`); `sentOff` players are drawn off the pitch at `y > 1`; `movement` is the speed band, `action`/`actionPhase` the beat and its normalised progress, `aim` the point a kick, shot, dive or slide is directed at, `intent` the planner's job (`carrier`, `receiver`, `support`, `press`, `cover`, `line`, `zone`, `keeper`, `set`, `setPiece`, `shape`, `off`).
4. **Ball.** `state` is `controlled` (at `carrierId`'s feet), `travelling` (no owner, `z` may be above 0, `inFlight`), `loose` (no owner, on the ground, waiting to be collected) or `dead` (in the net or between a whistle and a restart). `actionId` names the timeline event the ball is part of.
5. **Camera interest.** `cameraInterest` gives the point to frame and its kind; `participants` are the players that matter now. A renderer chooses its own projection and zoom; goal kinds should keep the goal mouth in view.
6. **Official versus illustrative.** Score, scorers, cards, extra time and the result come only from `presentation.official` and the official events; everything else is choreography. Renderers draw scenes and never alter ownership, score or events.
7. **Renderer swap proof.** `canvas2d.js`, `wireframe.js` and `pixelart.js` all draw the same scenes; `test-playback.js` and `test-phase25.js` render them headlessly. A new `renderers/isometric.js` implementing `create/mount/render/resize/dispose` and `drawFrame(ctx, w, h, scene, info)` registers itself as `Matchday.renderers.isometric` and appears in the View toggle after it is added to `build.py`.
* There is no replay after the result: no snapshot is kept in the save (by decision), so the viewer exists only between `advanceWeek` and the result card.
* The retro pixel density draws at 1 canvas pixel per CSS pixel, which is deliberately chunky on high-DPI screens; set `pixelDensity: 'sharp'` in `mountRenderer` for crisp output.
