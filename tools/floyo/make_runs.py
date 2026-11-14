#!/usr/bin/env python3
"""
Floyo run builder for the isometric art pipeline.

Reads a jobs file (json: a list of {stem, kind, frames, gk, hair, preprocessor?, seed?, prompt?}) and the
Z-Image Turbo ControlNet template, and writes one Comfy API workflow json per job plus a manifest, ready to
submit with Floyo's run API or MCP (`run_workflow` with the json as `workflow`). Inputs are expected under
Floyo files at --input-prefix (the folder the reference PNGs were uploaded to).

  python3 tools/floyo/make_runs.py --jobs tools/floyo/jobs-2026-11-14.json --out <dir> --input-prefix '#inputs/soccer-manager/sm91-batch-2'

Prompts are built from the pose list below so that every frame of a character is described the same way;
the only per-image parts are the pose sentence and the grid shape.
"""
import argparse, json, os, copy

POSE = {
  'idle': 'standing still and relaxed with the arms at the sides', 'set': 'standing ready in a slight crouch',
  'walk': 'walking', 'run': 'running mid-stride', 'receive': 'stopping with one foot raised to trap an imaginary ball, no ball in the picture',
  'kick': 'kicking with the leg swinging through, no ball in the picture', 'shoot': 'striking a hard shot with a big leg swing, no ball in the picture',
  'celebrate': 'celebrating with both arms raised', 'slide': 'sliding along the ground in a sliding tackle, one leg outstretched',
  'block': 'crouched with the arms wide to block', 'booked': 'standing with the hands on the hips and the head down',
  'whistle': 'standing with one hand raised to the mouth blowing a whistle', 'card': 'holding a small rectangular yellow card high in one hand',
  'point': 'pointing firmly with one arm stretched straight out',
  'dive': 'a goalkeeper diving full length to one side with the arms stretched out',
  'gkset': 'a goalkeeper standing ready', 'gkblock': 'a goalkeeper crouched ready with the arms wide',
  # Milestone 3B
  'header': 'heading an imaginary ball: crouching to jump, then leaping with the head thrown forward and the legs tucked, then landing, no ball in the picture',
  'volley': 'striking a volley with the kicking leg swung high off the ground and the body leaning back, no ball in the picture',
  'poke': 'making a standing tackle, one leg stretched out low along the ground, the body low and leaning forward',
  'catch': 'a goalkeeper catching: both arms raised forward to gather an imaginary ball, then clutching it to the chest, no ball in the picture',
  'parry': 'a goalkeeper diving to one side with one arm stretched up high to push an imaginary ball away, then down on the ground, no ball in the picture',
  'getup': 'getting up off the ground: on hands and knees, then rising on one knee',
  'kneeslide': 'celebrating a goal by sliding along the grass on both knees with the chest up and both arms spread wide',
  'runcheer': 'running in celebration with both arms held straight up',
  'hug': 'celebrating with both arms held out forward to embrace a teammate, then hopping into the hug',
  'dismay': 'in despair with both hands clasped on top of the head and the head bowed',
  'kneel': 'slumped down on both knees, sitting back on the heels with the head bowed and the hands on the thighs',
  'appeal': 'appealing with both arms spread wide and the palms turned up, the head tilted back',
}
HAIR = { 0: 'short dark brown hair', 1: 'very short cropped dark hair, almost shaved at the sides' }
KIT = 'bright red short-sleeved shirt with white collar and cuffs, royal blue shorts, yellow socks, black boots'
STYLE = ('Chunky pixel art with a limited palette, crisp black outlines, flat colours with simple shading, no anti-aliasing blur, '
         'no gradients, no ground shadow, no text, no logos, no background objects.')

def figure_prompt(frames, gk, hair, wide):
    poses = []
    for f in frames:
        p = f.split(':')[0]
        if gk and p == 'set': p = 'gkset'
        if gk and p == 'block': p = 'gkblock'
        if POSE[p] not in poses: poses.append(POSE[p])
    n = 8*len(frames)
    grid = 'arranged in a grid of four rows of two' if wide else ('arranged in a grid of two rows of four' if n == 8 else 'arranged in a grid of four rows of four')
    if len(poses) == 1: posetxt = poses[0]
    elif len(frames) == 2: posetxt = f'the top two rows {poses[0]}, the bottom two rows {poses[1]}'
    else: posetxt = ', '.join(poses)
    who = 'goalkeeper' if gk else 'footballer'
    gloves = ', wearing white goalkeeper gloves' if gk else ''
    return (f'Retro 16-bit video game sprite sheet of a {who}, {n} views of the same character {grid} on a plain flat light grey background. '
            f'Same character in every cell, {posetxt}{gloves}, each cell seen from a different angle in an isometric three-quarter view from above, '
            f'in the style of classic 1990s console football games. Stylised chunky proportions, slightly large round head, {HAIR[hair]}, light skin, small simple face. '
            f'Kit: {KIT}. {STYLE}')

PIECE_PROMPT = {
  'far':   'Isometric pixel art of one section of a packed football stadium terrace seen from above at a 2:1 isometric angle, retro 16-bit video game style, matching the given layout exactly. Stepped concrete terrace rows crowded with standing fans in colourful winter coats, scarves and bobble hats, crush barriers across the rows, a low front wall, and a grey cantilever roof with a red painted edge over the back rows. Bright flat colours, limited palette, crisp outlines, plain flat light grey background outside the terrace, no text, no logos, no players, no pitch.',
  'near':  'Isometric pixel art of one section of a low open football terrace seen from behind and above at a 2:1 isometric angle, retro 16-bit video game style, matching the given layout exactly: ten shallow stepped rows packed with standing fans seen from the back, colourful winter coats, scarves and bobble hats, crush barriers, a low wall at the front. Bright flat colours, limited palette, crisp outlines, plain flat light grey background outside the terrace, no text, no logos, no players, no pitch.',
  'left':  'Isometric pixel art of one section of a packed football stadium end terrace seen from above at a 2:1 isometric angle, retro 16-bit video game style, matching the given layout exactly: stepped concrete rows crowded with standing fans in colourful winter coats, scarves and bobble hats, crush barriers, a low front wall. Bright flat colours, limited palette, crisp outlines, plain flat light grey background outside the terrace, no text, no logos, no players, no pitch.',
  'right': 'Isometric pixel art of one section of a low open football end terrace seen from behind and above at a 2:1 isometric angle, retro 16-bit video game style, matching the given layout exactly: ten shallow stepped rows packed with standing fans seen from the back, colourful winter coats, scarves and bobble hats, crush barriers, a low wall at the front. Bright flat colours, limited palette, crisp outlines, plain flat light grey background outside the terrace, no text, no logos, no players, no pitch.',
  'boards': 'Isometric pixel art of a run of 1990s football pitch-side advertising hoardings seen from above at a 2:1 isometric angle, retro 16-bit video game style, matching the given layout exactly: a low row of rectangular boards in bold flat colours (red, white, blue, yellow, green), each with simple made-up abstract logos and blocky unreadable lettering, a white top rail, grass in front. Limited palette, crisp outlines, plain flat light grey background elsewhere, no real brand names, no readable words, no people.',
  'dugout': 'Isometric pixel art of a small football dugout seen from above at a 2:1 isometric angle, retro 16-bit video game style, matching the given layout exactly: a low grey concrete shelter open towards the viewer, its flat translucent perspex roof on a white frame seen mostly from above, a wooden bench and a dark interior shadow visible under the front edge of the roof. Limited palette, crisp outlines, plain flat light grey background elsewhere, no people, no text.',
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--jobs', required=True); ap.add_argument('--out', required=True); ap.add_argument('--input-prefix', required=True)
    ap.add_argument('--template', default=os.path.join(os.path.dirname(__file__), 'z-image-turbo-controlnet.template.json'))
    ap.add_argument('--seed', type=int, default=19910502)
    a = ap.parse_args()
    tpl = json.load(open(a.template)); jobs = json.load(open(a.jobs)); os.makedirs(a.out, exist_ok=True)
    manifest = []
    for j in jobs:
        w = copy.deepcopy(tpl)
        stem = j['stem']; kind = j.get('kind', 'figure')
        if kind == 'figure':
            prompt = j.get('prompt') or figure_prompt(j['frames'], j.get('gk', False), j.get('hair', 0), j.get('wide', False)); pre = j.get('preprocessor', 'none')
            if j.get('extra'): prompt = prompt.replace(' Kit:', ' ' + j['extra'].strip() + ' Kit:')   # an extra sentence before the kit
        else:
            prompt = j.get('prompt') or PIECE_PROMPT[j['piece']]; pre = j.get('preprocessor', 'DepthAnythingV2Preprocessor')
        seed = j.get('seed', a.seed)
        w['58']['inputs']['image'] = f"{a.input_prefix}/sm91-{j.get('input', stem)}.png"
        w['45']['inputs']['text'] = prompt; w['9']['inputs']['filename_prefix'] = f'sm91-{stem}'
        w['73:70']['inputs']['preprocessor'] = pre; w['73:44']['inputs']['seed'] = seed
        json.dump(w, open(os.path.join(a.out, f'run-{stem}.json'), 'w'))
        manifest.append({ 'stem': stem, 'name': f'SM91 {stem}', 'input': w['58']['inputs']['image'], 'output_prefix': f'sm91-{stem}', 'preprocessor': pre, 'seed': seed, 'prompt': prompt })
    json.dump(manifest, open(os.path.join(a.out, 'manifest.json'), 'w'), indent=1)
    print(f'{len(manifest)} runs written to {a.out}')

if __name__ == '__main__':
    main()
