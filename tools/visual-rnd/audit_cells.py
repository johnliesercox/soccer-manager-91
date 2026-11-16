#!/usr/bin/env python3
"""
Defect audit of painted grids against their Blender references, cell by cell: the painted figure's silhouette (pixels that
differ from the grey background) against the reference mask, and the body parts the converter's own figure extraction
would leave out (it is the converter's function, so a converter rule that drops paint shows up here).
  python3 tools/visual-rnd/audit_cells.py --ref <refs dir> --painted <dir of <stem_>-painted.png> [--iou 0.72] [--extra 0.06] [--out report.json]
Flags: iou below the threshold (a lost or wrong pose), extra (paint well outside the reference silhouette: a stray ball, an
extra limb), ball (a ball painted into the figure), limb (a part of the reference body the painter left out: an arm, a sock,
a boot, the hair), empty (no figure). Prints the grids to re-roll.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from iso_paint import shadow_like, load_ref, extract_figure, MAT     # the converter's own rules and references

def ball_blobs(rgb, ppm, bg, refmat):
    """boolean map of the painted balls in a cell. The painter draws a ball big (1.1 to 1.9 times the 22 cm it should be),
    so once the white is closed over its patches a ball is a roughly round white blob of at least 0.9 nominal discs; a
    collar, cuff, sleeve patch or keeper's glove is well under 0.7 and, for the shirt details, sits on shirt material
    in the reference, and a keeper's gloves on glove material. The patches themselves are not relied on (at the feet they come out light grey)."""
    pf = rgb.astype(np.float64); lum = pf.mean(axis=-1); chroma = pf.max(axis=-1) - pf.min(axis=-1)
    bgdiff = np.sqrt(((pf - bg)**2).sum(axis=-1))
    white = (lum > 222) & (chroma < 34) & (bgdiff > 20)             # the flat background is light grey too, so keep it out
    d_ball = 0.22*ppm; disc = np.pi*(d_ball/2)**2; close = max(2, int(round(0.03*ppm)))
    closed = ndimage.binary_erosion(ndimage.binary_fill_holes(ndimage.binary_dilation(white, iterations=close)), iterations=close)
    out = np.zeros(white.shape, bool); lab, n = ndimage.label(closed)
    on_shirt = (refmat == MAT['SHIRT']) | (refmat == MAT['TRIM']); on_glove = refmat == MAT['GLOVE']
    for k in range(1, n + 1):
        U = lab == k; A = U.sum()
        if A < 0.9*disc: continue
        ys, xs = np.where(U); h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1; D = max(h, w)
        if not (0.8 <= D/d_ball <= 2.8) or not (0.6 <= w/h <= 1.6): continue
        if A/(np.pi*(D/2)**2) < 0.45: continue
        if (U & on_shirt).sum() > 0.6*A or (U & on_glove).sum() > 0.15*A: continue     # shirt details; a keeper's gloves (painted bigger than the reference hands)
        out |= U
    return out

def missing_parts(m, p, refmat, ppm, min_share=0.012, cover=0.5):
    """the parts of the reference body the painter left out. The reference material map splits the body into separate
    regions (each arm's bare skin, each sock, each boot, the hair, a keeper's gloves); a region the painted figure covers
    by less than `cover`, with a 3 cm tolerance for a limb drawn a little off its reference position, is missing. Slivers
    under `min_share` of the mask are ignored. Returns (list of descriptions, share of the mask left unpainted)."""
    tol = max(2, int(round(0.03*ppm))); pd = ndimage.binary_dilation(p, iterations=tol)
    out = []; area = max(1, m.sum())
    for mat in ('SKIN', 'SOCKS', 'BOOTS', 'HAIR', 'GLOVE'):
        lab, n = ndimage.label(refmat == MAT[mat])
        if not n: continue
        sizes = ndimage.sum(np.ones_like(lab, dtype=bool), lab, range(1, n + 1))
        for k in range(n):
            if sizes[k] < min_share*area: continue
            comp = lab == k + 1; cov = (comp & pd).sum()/sizes[k]
            if cov < cover: out.append(f'{mat.lower()} {int(sizes[k])}px {cov:.0%} covered')
    return out, float((m & ~pd).sum()/area)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', required=True); ap.add_argument('--painted', required=True); ap.add_argument('--iou', type=float, default=0.72)
    ap.add_argument('--extra', type=float, default=0.06); ap.add_argument('--cover', type=float, default=0.5, help='a reference body part covered by less than this share of painted figure is missing'); ap.add_argument('--out', default='')
    a = ap.parse_args(); report = { 'grids': {}, 'reroll': [] }
    for f in sorted(os.listdir(a.painted)):
        if not f.endswith('-painted.png'): continue
        stem = f[:-len('-painted.png')].replace('_', '+'); jp = os.path.join(a.ref, stem + '.json')
        if not os.path.exists(jp): print(f'  skip {f}: no reference'); continue
        meta, mask, refmat = load_ref(a.ref, stem)
        painted = np.array(Image.open(os.path.join(a.painted, f)).convert('RGB')); H, W, _ = painted.shape; s = W/meta['width']
        mask_p = np.array(Image.fromarray(mask.astype(np.uint8)*255).resize((W, H), Image.NEAREST)) > 127
        refmat_p = np.array(Image.fromarray((refmat + 1).astype(np.uint8)).resize((W, H), Image.NEAREST)).astype(np.int32) - 1
        far = ~ndimage.binary_dilation(mask_p, iterations=max(2, int(round(meta['refspr']*s*0.1))))
        bg = np.median(painted[far].reshape(-1, 3), axis=0) if far.any() else np.array(meta['bg'])
        fig = (np.sqrt(((painted.astype(np.float64) - bg)**2).sum(axis=-1)) > 30) & ~(shadow_like(painted, bg) & ~mask_p)
        fig = ndimage.binary_opening(fig, iterations=1)
        taken = extract_figure(painted, meta, mask_p, s)                 # what the converter will actually put in the sprite
        # a baked-in ball (ball_blobs): one that reaches the converter's keep zone (the silhouette grown by 5 cm) ends up
        # in the sprite and is a defect; one further out is dropped as a stray mark and is only noted
        ppm = meta['refspr']*s
        keep_zone = ndimage.binary_dilation(mask_p, iterations=max(2, int(round(ppm*0.05))))
        cells = []; bad = []; loose = []
        for c in meta['cells']:
            x0, y0 = int(round(c['x']*s)), int(round(c['y']*s)); x1, y1 = int(round((c['x'] + c['w'])*s)), int(round((c['y'] + c['h'])*s))
            m = mask_p[y0:y1, x0:x1]; p = fig[y0:y1, x0:x1]
            inter = (m & p).sum(); uni = (m | p).sum(); iou = inter/uni if uni else 0.0
            near = ndimage.binary_dilation(m, iterations=max(2, int(round(meta['refspr']*s*0.04))))
            extra = (p & ~near).sum()/max(1, m.sum())
            ball = None; balls = ball_blobs(painted[y0:y1, x0:x1], ppm, bg, refmat_p[y0:y1, x0:x1])
            if balls.any():
                lab, n = ndimage.label(balls); kz = keep_zone[y0:y1, x0:x1]
                for k in range(1, n + 1): ball = 'in' if (kz & (lab == k)).any() else (ball or 'loose')
            parts, unpainted = missing_parts(m, taken[y0:y1, x0:x1], refmat_p[y0:y1, x0:x1], ppm, cover=a.cover)
            flag = None
            if p.sum() < 0.2*m.sum(): flag = 'empty'
            elif iou < a.iou: flag = 'iou'
            elif extra > a.extra: flag = 'extra'
            elif ball == 'in': flag = 'ball'
            elif parts: flag = 'limb'
            cells.append({ 'pose': c['pose'], 'frame': c['frame'], 'dir': c['dir'], 'iou': round(float(iou), 3), 'extra': round(float(extra), 3), 'unpainted': round(unpainted, 3), 'ball': ball, 'parts': parts, 'flag': flag })
            if flag: bad.append(f"{c['pose']}:{c['frame']}:{c['dir']} {flag} iou {iou:.2f} extra {extra:.2f}" + (f" missing {'; '.join(parts)}" if parts else ''))
            elif ball == 'loose': loose.append(f"{c['pose']}:{c['frame']}:{c['dir']}")
        if loose: print(f"  {stem}: loose ball (dropped by the converter) in {', '.join(loose)}")
        report['grids'][stem] = { 'cells': cells, 'bad': bad, 'iouMean': round(float(np.mean([x['iou'] for x in cells])), 3) }
        if bad: report['reroll'].append(stem)
        print(f"  {stem}: iou {report['grids'][stem]['iouMean']:.2f}" + (f", {len(bad)} flagged: " + '; '.join(bad) if bad else ''))
    print(f"{len(report['grids'])} grids, {len(report['reroll'])} to re-roll: {', '.join(report['reroll'])}")
    if a.out: json.dump(report, open(a.out, 'w'), indent=1)

if __name__ == '__main__':
    main()
