#!/usr/bin/env python3
"""
Pack the isometric art sheets losslessly: any RGBA PNG with at most 256 distinct colours (the template-coded player,
keeper, pattern and override sheets have about 50) is rewritten as a palette PNG with identical pixels, at roughly a
third of the bytes. Sheets with more colours (the crowd strips carry a person index in the blue channel) are left alone.

  python3 tools/iso_pack.py assets/matchday/isometric/B [more dirs or files...]
"""
import os, sys
import numpy as np
from PIL import Image

def pack(path):
    im = Image.open(path)
    if im.mode == 'P': return 'already palette'
    rgba = im.convert('RGBA'); cols = rgba.getcolors(256)
    if cols is None: return 'more than 256 colours, left as is'
    before = np.array(rgba)
    # a full RGBA palette (PIL stores alpha per entry when the palette mode is RGBA); transparent pixels share one entry
    colours = [c for _, c in cols]
    lut = { c: i for i, c in enumerate(colours) }
    flat = before.reshape(-1, 4); keys = [tuple(p) for p in flat]
    idx = np.fromiter((lut[k] for k in keys), dtype=np.uint8, count=len(keys)).reshape(before.shape[:2])
    pim = Image.fromarray(idx, 'P'); pal = []
    for c in colours: pal.extend(c)
    pim.putpalette(pal, rawmode='RGBA')
    tmp = path + '.tmp.png'; pim.save(tmp, 'PNG', optimize=True)
    after = np.array(Image.open(tmp).convert('RGBA'))
    if not (after == before).all(): os.remove(tmp); return 'FAILED: pixels differ, left as is'
    old = os.path.getsize(path); os.replace(tmp, path); return f'{old//1024} KB -> {os.path.getsize(path)//1024} KB'

if __name__ == '__main__':
    targets = []
    for a in sys.argv[1:]:
        if os.path.isdir(a): targets += [os.path.join(a, f) for f in sorted(os.listdir(a)) if f.endswith('.png')]
        else: targets.append(a)
    for t in targets: print(f'  {os.path.basename(t)}: {pack(t)}')
