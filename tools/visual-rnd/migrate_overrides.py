#!/usr/bin/env python3
"""Move painted override cells from one sheet layout to another (a sheet regenerated with more hair styles interleaves new
rows, so y positions move): every (pose, frame, hair) row of the source manifest is copied to the same row of the target.
  python3 tools/visual-rnd/migrate_overrides.py --src assets/matchday/isometric/B --dst assets/matchday/isometric/E [--sprs 24,16,12]"""
import argparse, json, os
import numpy as np
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('--src', required=True); ap.add_argument('--dst', required=True); ap.add_argument('--sprs', default='24,16,12')
a = ap.parse_args()
for spr in [int(x) for x in a.sprs.split(',')]:
    ms = json.load(open(os.path.join(a.src, f'players-{spr}.json'))); md = json.load(open(os.path.join(a.dst, f'players-{spr}.json')))
    for gk in (False, True):
        name = f'overrides-keepers-{spr}.png' if gk else f'overrides-{spr}.png'
        sp = os.path.join(a.src, name)
        if not os.path.exists(sp): continue
        rows_s = ms['keepers']['rows'] if gk else ms['rows']; rows_d = md['keepers']['rows'] if gk else md['rows']
        W, H = (md['keepers']['width'], md['keepers']['height']) if gk else (md['width'], md['height'])
        src = np.array(Image.open(sp).convert('RGBA')); dst = np.zeros((H, W, 4), dtype=np.uint8)
        index = { (r[0], r[1], r[2]): r for r in rows_d }; moved = 0
        for r in rows_s:
            t = index.get((r[0], r[1], r[2]))
            if not t: continue
            pose, f, hs, y, cw, ch, feet = r; ty = t[3]; w = min(cw*8, src.shape[1], W)
            dst[ty:ty+ch, :w] = src[y:y+ch, :w]; moved += 1
        Image.fromarray(dst).save(os.path.join(a.dst, name), optimize=True)
        print(f'  {name}: {moved} rows moved into the {W}x{H} layout')
