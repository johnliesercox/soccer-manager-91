#!/usr/bin/env python3
"""
Turn the painted stadium pieces into a style's textures.
  python3 tools/visual-rnd/paint_pieces.py --blender tools/visual-rnd/stage2/pieces --painted <dir of sm91-qs-<piece>-<route>_00001_.png> --route i --style E [--treatment crowd|full] [--pieces far,near,left,right,cornerA,...]
treatment `full`: the painted image is the piece; `crowd`: the Blender render keeps the architecture and the painting is let in only
where the crowd mask (the spectators, dilated a little) is, so the steps, roof and barriers stay exact.
Stands go through iso_paint.stand / iso_paint.piece (the game's own layouts and keying); corners are placed pieces: the Blender
render's alpha is their silhouette, the json their world anchor, and iso_paint.save_texture writes the three scales.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import iso_paint

def painted_for(blender_dir, painted_dir, piece, route, treatment, grow=2):
    base = Image.open(os.path.join(blender_dir, f'{piece}-painted.png')).convert('RGB'); W, H = base.size
    cands = [f for f in os.listdir(painted_dir) if f.startswith(f'sm91-qs-{piece}-{route}') and f.endswith('.png')]
    if not cands: raise SystemExit(f'no painting for {piece} route {route} in {painted_dir}')
    paint = Image.open(os.path.join(painted_dir, sorted(cands)[-1])).convert('RGB').resize((W, H), Image.LANCZOS)
    if treatment == 'full': return paint
    crowd = np.array(Image.open(os.path.join(blender_dir, f'{piece}-crowd.png')).convert('L')) > 128
    crowd = ndimage.binary_dilation(crowd, iterations=grow)
    out = np.array(base).copy(); p = np.array(paint); out[crowd] = p[crowd]
    return Image.fromarray(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--blender', required=True); ap.add_argument('--painted', required=True); ap.add_argument('--route', default='i'); ap.add_argument('--style', default='E')
    ap.add_argument('--treatment', default='crowd'); ap.add_argument('--pieces', default='far,near,left,right,cornerA,cornerB,cornerC,cornerD')
    ap.add_argument('--refs', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'refs-pieces')); ap.add_argument('--sprs', default='24,16,12'); ap.add_argument('--work', default='')
    a = ap.parse_args(); sprs = [int(x) for x in a.sprs.split(',')]
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); outdir = os.path.join(root, 'assets/matchday/isometric', a.style); os.makedirs(outdir, exist_ok=True)
    work = a.work or os.path.join(a.painted, 'composited'); os.makedirs(work, exist_ok=True)
    for piece in a.pieces.split(','):
        im = painted_for(a.blender, a.painted, piece, a.route, a.treatment); path = os.path.join(work, f'{piece}-{a.treatment}.png'); im.save(path)
        if piece == 'far':
            iso_paint.stand(a.refs, path, outdir, sprs, (0.0, 24.0))
        elif piece in ('near', 'left', 'right'):
            iso_paint.piece(a.refs, piece, [path], outdir, sprs, None, 'png')
        else:
            # a placed piece: silhouette and anchor from the Blender render at 24
            meta = json.load(open(os.path.join(a.blender, f'piece-{piece}-24.json'))); bl = np.array(Image.open(os.path.join(a.blender, f'piece-{piece}-24.png')).convert('RGBA'))
            rgb = np.array(im.convert('RGB')); alpha = bl[..., 3]
            rgba = np.dstack([rgb, alpha]).astype(np.uint8); base = Image.fromarray(rgba, 'RGBA')
            info = { 'piece': piece, 'axis': None, 'metres': 0, 'from': 0, 'anchor': meta['anchor'], 'anchorWorld': meta['anchorWorld'] }
            for spr in sprs: iso_paint.save_texture(base, os.path.join(outdir, f'piece-{piece}-{spr}'), spr, 24, 'png', info)
        print(f'  {piece}: {a.treatment} via route {a.route} -> {a.style}')

if __name__ == '__main__':
    main()
