#!/usr/bin/env python3
"""
Floyo graphs that paint the Blender stadium pieces: the Qwen Image 2512 + Fun ControlNet Union route with the piece's depth
map as the control, either from an empty latent (route d) or from the Blender colour render (route i, image to image at
--denoise, which keeps the architecture's colours and lets the model repaint the crowd).
  python3 tools/visual-rnd/make_runs_pieces.py --out <dir> --input-prefix '#inputs/soccer-manager/<folder>' [--pieces far,near,left,right,cornerA,cornerB,cornerC,cornerD] [--routes d,i] [--denoise 0.6] [--tag s2]
Inputs are sm91-<piece>.png (depth) and sm91-<piece>-c.png (colour); outputs sm91-qs-<piece>-<route>[-tag]_00001_.png.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_runs_rnd import graph_q, graph_qi

STYLE = ('Detailed 16-bit pixel art in the style of classic 1990s Amiga and SNES football games: crisp dark outlines, cel shading with a lit '
         'side and a shadow side, a limited palette, clean readable shapes, no anti-aliasing blur, no text, no logos, no lettering of any kind, '
         'flat light grey background around the structure.')
CROWD = ('packed with standing supporters seen from above and behind their shoulders, in dark winter coats with a scatter of red, yellow, blue and '
         'white ones, woolly hats and scarves, each person a small distinct figure, no two alike, faces turned towards the pitch')
# the illustrative treatment (Stage B, option 2): a freer, hand-painted crowd in the manner of early-1990s game box art and
# loading screens, repainted from the Blender render at a higher denoise; the architecture is still kept from Blender by the
# crowd mask, so only the people change
STYLE_ILL = ('Hand-painted illustration in the manner of early-1990s computer game box art and loading screens: confident brush strokes, bold '
             'blocks of warm and cool colour, strong directional light with deep shadow, a limited harmonious palette, crisp edges, no photographic '
             'detail, no text, no logos, no lettering of any kind, flat light grey background around the structure.')
CROWD_ILL = ('packed with a lively illustrated crowd of standing supporters seen from above and behind their shoulders: characterful figures in '
             'winter coats of many colours, scarves held up, arms raised, woolly hats, a sea of faces and hats, every person distinct, painted '
             'with visible brushwork, faces turned towards the pitch')
PROMPTS = {
  'far':   f'Isometric view from above of one section of the main stand at a 1990s English football ground: sixteen rows of concrete terrace {CROWD}, white crush barriers across the rows, a corrugated grey roof on slim steel pillars over the back rows, a dark back wall. {STYLE}',
  'near':  f'Isometric view from above of a long low standing terrace at a 1990s English football ground: ten shallow rows of concrete {CROWD}, white crush barriers, a dark back wall, no roof. {STYLE}',
  'left':  f'Isometric view from above of an end terrace behind the goal at a 1990s English football ground: ten steep rows of concrete {CROWD}, white crush barriers, a dark back wall, no roof. {STYLE}',
  'right': f'Isometric view from above of a shallow end terrace behind the goal at a 1990s English football ground: ten low rows of concrete {CROWD}, white crush barriers, a dark back wall, no roof. {STYLE}',
}
for k in 'ABCD': PROMPTS['corner'+k] = f'Isometric view from above of a small quarter-circle corner terrace wedged between two stands at a 1990s English football ground: a dozen short rows of concrete {CROWD}, a plain grey concrete stair tower with a flat roof and a door at the junction. {STYLE}'

GOAL = ('Isometric view from above of a football goal on a grass pitch at a 1990s English football ground: white round posts and crossbar, '
        'grey steel stanchions and a back rail holding up a white box net of fine square mesh that sags a little, the net casting a soft '
        'shadow on the grass, the white goal line, nothing else. {STYLE}')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True); ap.add_argument('--input-prefix', required=True)
    ap.add_argument('--pieces', default='far,near,left,right,cornerA,cornerB,cornerC,cornerD'); ap.add_argument('--routes', default='d,i')
    ap.add_argument('--denoise', type=float, default=0.6); ap.add_argument('--seed', type=int, default=19910502); ap.add_argument('--tag', default='')
    ap.add_argument('--prompt-style', default='pixel', choices=('pixel', 'illustrated'), help='the crowd prompt: pixel (the production prompt) or illustrated (Stage B option 2)')
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True); manifest = []
    prompts = dict(PROMPTS); prompts['goal0'] = GOAL.replace('{STYLE}', STYLE)
    if a.prompt_style == 'illustrated': prompts = { k: v.replace(CROWD, CROWD_ILL).replace(STYLE, STYLE_ILL) for k, v in prompts.items() }
    for piece in a.pieces.split(','):
        depth = f'{a.input_prefix}/sm91-{piece}.png'; colour = f'{a.input_prefix}/sm91-{piece}-c.png'
        for route in a.routes.split(','):
            prefix = f'sm91-qs-{piece}-{route}' + (f'-{a.tag}' if a.tag else '')
            w = graph_q(depth, prompts[piece], prefix, a.seed) if route == 'd' else graph_qi(depth, colour, prompts[piece], prefix, a.seed, a.denoise)
            w['108']['inputs']['text'] = 'blurry, photographic, realistic, smooth gradients, text, letters, numbers, signs, watermark, people on the pitch, grass'
            json.dump(w, open(os.path.join(a.out, f'run-{piece}-{route}.json'), 'w'))
            manifest.append({ 'piece': piece, 'route': route, 'name': f'SM91 s2 {piece} {route}' + (f' {a.tag}' if a.tag else ''), 'output_prefix': prefix })
    json.dump(manifest, open(os.path.join(a.out, 'manifest.json'), 'w'), indent=1); print(f'{len(manifest)} runs written to {a.out}')

if __name__ == '__main__':
    main()
