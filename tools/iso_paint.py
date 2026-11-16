#!/usr/bin/env python3
"""
Isometric art: turn painted reference grids (from an image model or an artist) into override sheets.

A reference grid (tools/iso-art.js --ref) is a large render of one or two frames in eight headings, with a
depth map the model follows, a mask and a material map. The painted result comes back at the same layout
(any size: the model may have rescaled it). This script cuts each cell out, classifies every painted pixel
into a template material and tone (the ref material map is the prior, the painted colour can override it,
luminance against the kit colour gives the tone), box-downsamples to 24, 16 and 12 px per metre, aligns the
feet to the sheet cell's anchor, adds the one-pixel outline and writes the cell into
assets/matchday/isometric/<style>/overrides-<spr>.png (and overrides-keepers-<spr>.png for keeper frames).
The game's loader replaces a generated cell with an override cell wherever one is painted.

Usage: python3 tools/iso_paint.py --ref <ref dir> --painted <dir of <stem>-painted.png> [--style B] [--out assets/matchday/isometric]
       python3 tools/iso_paint.py --ref <ref dir> --piece near --painted-piece <painted.png> [--piececrop 2,28] [--fmt png|webp]
Stadium pieces (tools/iso-piece-ref.js references: near, left, right, boards, dugout) become piece-<name>-<spr>.png
textures with a json that says where the piece's anchor corner sits; the renderer tiles a stand or a run of boards
along its axis and places a dugout as a sprite. The far stand keeps the older --stand route (stand-<spr>.png).
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

MATS = ['SKIN','HAIR','SHIRT','TRIM','SHORTS','SOCKS','BOOTS','GLOVE','EYE','CARD','LINE','COAT','HAT','SCARF']
MAT = {m: i for i, m in enumerate(MATS)}
CLASSES = ['SKIN','HAIR','SHIRT','TRIM','SHORTS','SOCKS','BOOTS','GLOVE','CARD']
ZONED = ('TRIM', 'GLOVE', 'CARD')           # only where the reference has them (collar, sock tops, gloves, the referee's card)
DOWN_CLASSES = CLASSES + ['EYE']
BOOST = { 'EYE': 2.5 }                     # small features that must survive the downsample
TONES = 5
TONE_EDGES = [0.58, 0.82, 1.12, 1.40]      # luminance ratio to the material's flat colour -> tone 0..4 (2 = flat)

def lum(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return 0.2126*c[..., 0] + 0.7152*c[..., 1] + 0.0722*c[..., 2]

def chroma(c):
    c = np.asarray(c, dtype=np.float64) + 1e-6
    s = c[..., 0] + c[..., 1] + c[..., 2]
    return np.stack([c[..., 0]/s, c[..., 1]/s], axis=-1)

def classify(painted, figure, refmat, kit):
    """painted HxWx3 uint8, figure HxW bool, refmat HxW int (material index or -1). Returns mat HxW int, tone HxW int."""
    H, W, _ = painted.shape
    pix = painted.astype(np.float64)
    L = lum(pix); ch = chroma(pix)
    best = np.full((H, W), -1, dtype=np.int32); bestd = np.full((H, W), 1e9)
    # white trim and gloves only where the reference has them (collar, sock tops, keeper's hands), so a painted
    # highlight on a shirt stays a shirt highlight rather than becoming a patch of the second kit colour
    zone = {}
    for m in ZONED:
        has = refmat == MAT[m]
        zone[m] = ndimage.binary_dilation(has, iterations=max(3, int(round(H*0.015)))) if has.any() else np.zeros_like(has)
    # the painter's head is a little larger than the reference's: around the reference hair, a dark pixel that the reference
    # does not call shirt is hair rather than the shirt's shadow (short dark hair and a red shirt's dark tones are close)
    hairzone = ndimage.binary_dilation(refmat == MAT['HAIR'], iterations=max(4, int(round(H*0.02)))) & (refmat != MAT['SHIRT']) if (refmat == MAT['HAIR']).any() else np.zeros((H, W), dtype=bool)
    for m in CLASSES:
        if m not in kit: continue
        base = np.array(kit[m], dtype=np.float64); bl = lum(base); bc = chroma(base)
        d = 3.0*np.hypot(ch[..., 0] - bc[0], ch[..., 1] - bc[1]) + 0.6*np.abs(L - bl)
        # the reference material is the prior: half its distance
        d = np.where(refmat == MAT[m], d*0.45, d)
        if m == 'SHIRT': d = np.where(hairzone, d + 1.0, d)
        if m == 'TRIM': d = np.where(hairzone & (refmat != MAT['TRIM']), d + 2.0, d)     # a white mark on the head (the painter's stray ball) is not collar
        # achromatic classes need the luminance to agree; zoned classes stay near where the reference has them (the card
        # shares the socks' yellow, so outside its zone a yellow pixel is a sock)
        if m in ('TRIM', 'GLOVE'): d = np.where(L < 0.55, d + 1.0, d)
        if m in ZONED: d = np.where(zone[m], d, d + 2.0)
        if m == 'BOOTS': d = np.where(L > 0.35, d + 1.0, d)
        if m == 'HAIR': d = np.where(L > 0.45, d + 0.6, d)
        better = d < bestd; bestd = np.where(better, d, bestd); best = np.where(better, MAT[m], best)
    # very dark pixels inside bright materials are the model's own outlines and creases: keep the material, tone 0;
    # dark marks on skin are the eyes and mouth, which the game draws in their own material
    best = np.where((best == MAT['SKIN']) & (L < 0.33), MAT['EYE'], best)
    mat = np.where(figure, best, -1)
    # tone: the painted pixel against the flat colour the painter used for that material in this image (its median),
    # so the game's mid tone is the flat colour and the painter's shading and highlights land either side of it
    baseL = np.zeros((H, W))
    for m in CLASSES + ['EYE']:
        sel = mat == MAT[m]
        if sel.any(): baseL = np.where(sel, max(float(np.median(L[sel])), 0.08), baseL)
    ratio = np.where(baseL > 0, L/np.maximum(baseL, 1e-6), 1.0)
    tone = np.digitize(ratio, TONE_EDGES).astype(np.int32)
    return mat, tone

def load_ref(refdir, stem):
    meta = json.load(open(os.path.join(refdir, stem + '.json')))
    mask = np.array(Image.open(os.path.join(refdir, stem + '-mask.png')).convert('L')) > 127
    matimg = np.array(Image.open(os.path.join(refdir, stem + '-mat.png')).convert('RGBA'))
    refmat = np.where(matimg[..., 3] > 0, (matimg[..., 0].astype(np.int32) - 8)//16, -1)
    return meta, mask, refmat

def nearest_fill(mat, figure):
    """give figure pixels outside the ref silhouette the material of the nearest ref pixel"""
    have = mat >= 0
    if have.all(): return mat
    idx = ndimage.distance_transform_edt(~have, return_distances=False, return_indices=True)
    filled = mat[idx[0], idx[1]]
    return np.where(figure & ~have, filled, mat)

def cell_rows(manifest, gk):
    rows = manifest['keepers']['rows'] if gk else manifest['rows']
    out = {}
    for pose, frame, hair, y, cellW, cellH, feet in rows:
        for i, d in enumerate(manifest['dirs']):
            out[(pose, frame, hair, d)] = (i*cellW, y, cellW, cellH, feet)
    return out

def encode(mat, tone):
    """template colours: R = material*16+8, G = tone*40+20, B = 128, alpha where a material exists"""
    H, W = mat.shape
    out = np.zeros((H, W, 4), dtype=np.uint8)
    has = mat >= 0
    out[..., 0] = np.where(has, mat*16 + 8, 0); out[..., 1] = np.where(has, np.clip(tone, 0, TONES-1)*40 + 20, 0)
    out[..., 2] = np.where(has, 128, 0); out[..., 3] = np.where(has, 255, 0)
    return out

def outline(mat, tone):
    """one dark pixel around the silhouette, as the generator draws for style B"""
    has = mat >= 0
    ring = ndimage.binary_dilation(has, structure=np.array([[0,1,0],[1,1,1],[0,1,0]])) & ~has
    mat = np.where(ring, MAT['LINE'], mat); tone = np.where(ring, 1, tone)
    return mat, tone

def extract_figure(painted, meta, mask_p, s):
    """the painted figure as the converter takes it: paint that differs from the flat background, within 5 cm of the
    reference silhouette, the painter's ground shadow keyed out, holes filled; then, cell by cell, stray marks dropped.
    A blob is kept when it is the main body or lies mostly inside the silhouette (an arm held away from the trunk is its own
    blob and must stay; before 15 Nov 2026 only the largest blob was kept and 11% of the cells lost an arm that way) and is
    dropped when it lies mostly outside (a shadow, a loose ball, a speck). The referee's raised card is the one thing kept
    outside the silhouette. Shared with the audit, so the audit sees exactly what the sprite will hold."""
    H, W, _ = painted.shape
    ppm = meta['refspr']*s                                   # painted pixels per metre
    grow = max(2, int(round(ppm*0.05)))
    near = ndimage.binary_dilation(mask_p, iterations=grow)
    # background colour from the painted pixels well away from any figure
    far = ~ndimage.binary_dilation(mask_p, iterations=grow*2)
    bg = np.median(painted[far].reshape(-1, 3), axis=0) if far.any() else np.array(meta['bg'])
    diff = np.sqrt(((painted.astype(np.float64) - bg)**2).sum(axis=-1))
    # the painter's ground shadow (neutral grey, darker than the background) is not figure where it lies outside the
    # reference silhouette; inside the silhouette dark greys are the figure's own (boot edges, hair) and stay
    figure = near & (diff > 30) & ~(shadow_like(painted, bg) & ~mask_p)
    figure = ndimage.binary_opening(figure, iterations=1)
    figure = ndimage.binary_fill_holes(figure)
    inside = ndimage.binary_dilation(mask_p, iterations=max(2, int(round(ppm*0.02))))   # 2 cm of tolerance for a limb drawn a little off
    keep = np.zeros_like(figure)
    for cell in meta['cells']:
        x0, y0 = int(round(cell['x']*s)), int(round(cell['y']*s)); x1, y1 = int(round((cell['x'] + cell['w'])*s)), int(round((cell['y'] + cell['h'])*s))
        sub = figure[y0:y1, x0:x1]; lab, n = ndimage.label(sub)
        if n > 1:
            sizes = ndimage.sum(sub, lab, range(1, n + 1)); big = 1 + int(np.argmax(sizes)); ins = inside[y0:y1, x0:x1]
            body = lab == big
            for k in range(1, n + 1):
                if k == big: continue
                comp = lab == k
                if (comp & ins).sum() >= 0.5*sizes[k-1]: body |= comp
            if cell['pose'] == 'card':
                # the raised card can float clear of the hand: keep any small yellow mark in the upper half of the cell
                px = painted[y0:y1, x0:x1].astype(np.float64); half = (y1 - y0)//2
                for k in range(1, n + 1):
                    if k == big: continue
                    comp = lab == k; ys_ = np.where(comp)[0]
                    if ys_.max() >= half or sizes[k-1] > 0.05*sizes[big-1]: continue
                    r, g, b = px[comp].mean(axis=0)
                    if r > 150 and g > 110 and b < 110 and r - b > 80: body |= comp
            sub = body
        keep[y0:y1, x0:x1] = sub
    return keep

def process(refdir, painted_path, stem, manifest_by_spr, sheets, kit_override=None, dirs=None, cells=None):
    meta, mask, refmat = load_ref(refdir, stem)
    painted = np.array(Image.open(painted_path).convert('RGB'))
    H, W, _ = painted.shape
    s = W/meta['width']
    if abs(H/meta['height'] - s) > 0.02: print(f'  warning: {stem} painted aspect differs from the reference ({W}x{H} vs {meta["width"]}x{meta["height"]})')
    # bring the mask and material map to the painted size
    mask_p = np.array(Image.fromarray(mask.astype(np.uint8)*255).resize((W, H), Image.NEAREST)) > 127
    mat_p = np.array(Image.fromarray((refmat + 1).astype(np.uint8)).resize((W, H), Image.NEAREST)).astype(np.int32) - 1
    ppm = meta['refspr']*s                                   # painted pixels per metre
    figure = extract_figure(painted, meta, mask_p, s)
    kit = kit_override or meta['kit']
    mat_f = nearest_fill(np.where(figure | mask_p, mat_p, -1), figure)
    mat, tone = classify(painted, figure, mat_f, kit)
    gk = bool(meta.get('gk')); hair = int(meta.get('hair', 0))
    written = 0
    for cell in meta['cells']:
        if dirs and cell['dir'] not in dirs: continue          # a re-roll for a few headings only
        if cells and (cell['pose'], int(cell['frame']), cell['dir']) not in cells: continue   # or for named cells only
        x0, y0 = int(round(cell['x']*s)), int(round(cell['y']*s)); x1, y1 = int(round((cell['x'] + cell['w'])*s)), int(round((cell['y'] + cell['h'])*s))
        cm = mat[y0:y1, x0:x1].copy(); ct = tone[y0:y1, x0:x1]
        # the referee's card is held up at the top of the cell, where the reference clips it (so the material map has no
        # card zone there): in the card pose any sock-yellow pixel in the upper half of the cell is the card
        if cell['pose'] == 'card':
            top = cm[:int(0.5*(y1 - y0))]; top[top == MAT['SOCKS']] = MAT['CARD']
        for spr, manifest in manifest_by_spr.items():
            rows = cell_rows(manifest, gk)
            key = (cell['pose'], cell['frame'], 0 if gk else hair, cell['dir'])      # the keeper sheet has one hair style
            if key not in rows: continue
            sx, sy, cw, chh, feet = rows[key]
            k = spr/ppm                                              # target pixels per painted pixel
            tw, th = max(1, int(round((x1 - x0)*k))), max(1, int(round((y1 - y0)*k)))
            # box-filter the material one-hots and the tone
            has = (cm >= 0).astype(np.float32)
            cov = np.array(Image.fromarray(has).resize((tw, th), Image.BOX))
            best = np.full((th, tw), -1, dtype=np.int32); bestc = np.zeros((th, tw), dtype=np.float32)
            for m in DOWN_CLASSES:
                oh = (cm == MAT[m]).astype(np.float32)
                c = np.array(Image.fromarray(oh).resize((tw, th), Image.BOX))*BOOST.get(m, 1.0)
                better = c > bestc; bestc = np.where(better, c, bestc); best = np.where(better, MAT[m], best)
            tsum = np.array(Image.fromarray((np.clip(ct, 0, TONES-1)*has).astype(np.float32)).resize((tw, th), Image.BOX))
            tmean = np.where(cov > 0, tsum/np.maximum(cov, 1e-6), 2)
            tmat = np.where(cov >= 0.5, best, -1)
            ttone = np.rint(tmean).astype(np.int32)
            tmat, ttone = outline(tmat, ttone)
            # align the painted cell's feet line and centre to the sheet cell's anchor
            fx = (cell['w']*s/2)*k; fy = (cell['feet']*s)*k
            ox = int(round(cw/2 - fx)); oy = int(round(feet - fy))
            sheet = sheets[(spr, gk)]
            sheet[sy:sy+chh, sx:sx+cw] = 0                           # a converted cell replaces whatever the sheet held there
            # paste with clipping to the sheet cell
            for ty in range(th):
                yy = sy + oy + ty
                if yy < sy or yy >= sy + chh: continue
                for tx in range(tw):
                    xx = sx + ox + tx
                    if xx < sx or xx >= sx + cw: continue
                    if tmat[ty, tx] < 0: continue
                    sheet[yy, xx] = (tmat[ty, tx]*16 + 8, int(np.clip(ttone[ty, tx], 0, TONES-1))*40 + 20, 128, 255)
            written += 1
    return written

def stand(refdir, painted_path, outdir, sprs, crop=None):
    """a painted far-stand segment (tools/iso-stand-ref.js reference) -> stand-<spr>.png + json for the renderer to tile.
    crop = (a, b): keep only metres a..b of the segment (the model tends to paint an end wall at the edges)"""
    meta = json.load(open(os.path.join(refdir, 'stand-far-%d.json' % 24)))
    P = meta['P']; W, H = meta['width'], meta['height']
    img = Image.open(painted_path).convert('RGB').resize((W, H), Image.LANCZOS)
    arr = np.array(img)
    a, b = crop if crop else (0.0, meta['metres']); x_from, x_to = meta['from'] + a, meta['from'] + b
    # the segment's silhouette from the world box, as the reference did: keep a pixel if some Z in [0, zTop] lands in the box
    ox = meta['anchor']['x'] - P*(meta['from'] - meta['yFront']); oy = meta['anchor']['y'] - P*((meta['from'] + meta['yFront'])/2)
    ys, xs = np.mgrid[0:H, 0:W]
    u = (xs - ox)/P; v0 = (ys - oy)/P; X0 = (u + 2*v0)/2; Y0 = (2*v0 - u)/2
    lo = np.maximum.reduce([x_from - X0, meta['yBack'] - Y0, np.zeros_like(X0)]); hi = np.minimum.reduce([x_to - X0, meta['yFront'] - Y0, np.full_like(X0, meta['zTop'])])
    inside = lo <= hi
    # the painter's flat background, flood-filled from the image border, is transparent even where it reaches inside the
    # box (the model draws the roof and end walls a little short): the generated stand shows through those holes
    bg = np.median(arr[~inside].reshape(-1, 3), axis=0) if (~inside).any() else np.array(meta['bg'])
    near_bg = np.sqrt(((arr.astype(np.float64) - bg)**2).sum(axis=-1)) < 26
    lab, n = ndimage.label(near_bg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    background = np.isin(lab, list(border)) if border else np.zeros_like(near_bg)
    keep = inside & ~background
    rgba = np.dstack([arr, np.where(keep, 255, 0).astype(np.uint8)])
    inside = keep
    # crop to the kept pixels and move the anchor with it
    yy, xx = np.where(inside); x0, x1, y0, y1 = int(xx.min()), int(xx.max()) + 1, int(yy.min()), int(yy.max()) + 1
    rgba = rgba[y0:y1, x0:x1]; W, H = x1 - x0, y1 - y0
    anchor = { 'x': meta['anchor']['x'] + P*a - x0, 'y': meta['anchor']['y'] + P*a/2 - y0 }      # the front-bottom corner at X = x_from
    metres = b - a
    base = Image.fromarray(np.ascontiguousarray(rgba), 'RGBA')
    info = { 'piece': 'far', 'axis': 'X', 'metres': metres, 'from': x_from, 'anchor': anchor }
    for spr in sprs: save_texture(base, os.path.join(outdir, f'stand-{spr}'), spr, P, 'png', info)

def shadow_like(arr, bg):
    """pixels that read as the painter's ground shadow on the flat grey background: nearly neutral, and darker than the
    background but nowhere near black (black boots and dark hair are far darker or carry colour)"""
    pf = arr.astype(np.float64); lum = pf.mean(axis=-1); chroma = pf.max(axis=-1) - pf.min(axis=-1)
    return (chroma < 28) & (lum > 85) & (lum < float(np.mean(bg)) - 25)

def keyed_background(arr, outside, tol=26):
    """the painter's flat background, flood-filled from the image border, so it can be made transparent even where it
    reaches inside the piece's box (the model draws roofs and end walls a little short); outside = pixels known to be
    background, used to measure its colour"""
    bg = np.median(arr[outside].reshape(-1, 3), axis=0) if outside.any() else np.array([200, 200, 200])
    near_bg = np.sqrt(((arr.astype(np.float64) - bg)**2).sum(axis=-1)) < tol
    lab, n = ndimage.label(near_bg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(border)) if border else np.zeros_like(near_bg)

def save_texture(base, path_stem, spr, P, fmt, meta):
    """scale a P px/m RGBA texture to spr px/m and write it as png (128 colours) or webp (lossy, about a quarter of the bytes)"""
    k = spr/P; W, H = base.size
    if spr == P: im = base
    else:
        # scale colour and coverage apart: transparent pixels first take the colour of their nearest opaque neighbour, so the
        # filter does not drag the (black) transparent colour into the edges; coverage is then cut at a half for a crisp edge
        arr = np.array(base); alpha = arr[..., 3] > 0
        idx = ndimage.distance_transform_edt(~alpha, return_distances=False, return_indices=True); rgb = arr[..., :3][idx[0], idx[1]]
        size = (max(1, int(round(W*k))), max(1, int(round(H*k))))
        rgb_s = Image.fromarray(np.ascontiguousarray(rgb), 'RGB').resize(size, Image.LANCZOS)
        a_s = np.array(Image.fromarray((alpha*255).astype(np.uint8), 'L').resize(size, Image.BOX)) >= 128
        im = rgb_s.convert('RGBA'); im.putalpha(Image.fromarray((a_s*255).astype(np.uint8), 'L'))
    if fmt == 'webp':
        im.save(path_stem + '.webp', 'WEBP', quality=82, method=6)
        out = path_stem + '.webp'
    else:
        # a 255-colour palette PNG with one index reserved for transparency: the pixel-art look and about a third of the
        # bytes of the same image stored as 32-bit RGBA. The palette is median cut over the opaque pixels alone, with the
        # saturated ones counted six times over, so small bright details (a yellow coat among grey concrete) keep their colour
        arr = np.array(im); alpha = arr[..., 3] > 0; N = 255
        op = arr[..., :3][alpha]; chroma = op.astype(int).max(1) - op.astype(int).min(1); px = np.concatenate([op] + [op[chroma > 80]]*6)
        side = int(np.ceil(np.sqrt(len(px)))); sq = np.zeros((side*side, 3), dtype=np.uint8); sq[:len(px)] = px; sq[len(px):] = px[-1]
        palimg = Image.fromarray(sq.reshape(side, side, 3), 'RGB').quantize(N, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        q = Image.fromarray(np.ascontiguousarray(arr[..., :3]), 'RGB').quantize(palette=palimg, dither=Image.Dither.NONE)
        pal = (palimg.getpalette() + [0]*768)[:N*3] + [0, 0, 0]*(256 - N)
        ix = np.array(q, dtype=np.uint8); ix[~alpha] = N
        pim = Image.fromarray(ix, 'P'); pim.putpalette(pal); pim.save(path_stem + '.png', optimize=True, transparency=N); out = path_stem + '.png'
        back = np.array(Image.open(out).convert('RGBA'))[..., 3] > 0
        assert (back == alpha).all(), 'palette quantisation changed the transparency mask'
    meta = dict(meta); meta.update({ 'P': spr, 'anchor': { 'x': meta['anchor']['x']*k, 'y': meta['anchor']['y']*k }, 'width': im.width, 'height': im.height })
    json.dump(meta, open(path_stem + '.json', 'w'))
    print(f'  wrote {os.path.basename(out)} ({im.width}x{im.height}, {os.path.getsize(out)//1024} KB)')

def piece_cut(refdir, name, painted_path, crop=None):
    """one painted stadium piece -> (rgba array, anchor px, metres kept, from, axis, P): the painter's background keyed out,
    the box narrowed to metres a..b along the axis, cropped tight, with the anchor (front-bottom corner at the start of
    the kept run) located in texture pixels"""
    meta = json.load(open(os.path.join(refdir, f'piece-{name}-24.json')))
    P = meta['P']; W, H = meta['width'], meta['height']; box = meta['box']; axis = meta['axis']
    arr = np.array(Image.open(painted_path).convert('RGB').resize((W, H), Image.LANCZOS))
    mask = np.array(Image.open(os.path.join(refdir, f'piece-{name}-24-mask.png')).convert('L')) > 127
    a, b = crop if (crop and axis) else (0.0, meta['metres'])
    xa, xb, ya, yb = box['xa'], box['xb'], box['ya'], box['yb']
    if axis == 'X': xa, xb = meta['from'] + a, meta['from'] + b
    elif axis == 'Y': ya, yb = meta['from'] + a, meta['from'] + b
    # the box narrowed to the kept metres: a pixel stays if some Z in [0, zTop] along its view line lands inside
    ys, xs = np.mgrid[0:H, 0:W]
    u = (xs - meta['ox'])/P; v0 = (ys - meta['oy'])/P; X0 = (u + 2*v0)/2; Y0 = (2*v0 - u)/2
    lo = np.maximum.reduce([xa - X0, ya - Y0, np.zeros_like(X0)]); hi = np.minimum.reduce([xb - X0, yb - Y0, np.full_like(X0, box['zTop'])])
    inside = mask & (lo <= hi)
    keep = inside & ~keyed_background(arr, ~mask)
    if not keep.any(): raise SystemExit(f'piece {name}: nothing left after masking')
    rgba = np.dstack([arr, np.where(keep, 255, 0).astype(np.uint8)])
    yy, xx = np.where(keep); x0, x1, y0, y1 = int(xx.min()), int(xx.max()) + 1, int(yy.min()), int(yy.max()) + 1
    rgba = np.ascontiguousarray(rgba[y0:y1, x0:x1])
    aw = list(meta['anchorWorld'])
    if axis == 'X': aw[0] = meta['from'] + a
    elif axis == 'Y': aw[1] = meta['from'] + a
    anchor = { 'x': meta['ox'] + P*(aw[0] - aw[1]) - x0, 'y': meta['oy'] + P*((aw[0] + aw[1])/2 - aw[2]) - y0 }
    return rgba, anchor, ((b - a) if axis else meta['metres']), ((meta['from'] + a) if axis else meta['from']), axis, P

def piece(refdir, name, painted_paths, outdir, sprs, crop=None, fmt='png'):
    """painted stadium piece(s) (tools/iso-piece-ref.js reference piece-<name>-24) -> piece-<name>-<spr>.<fmt> + json.
    Several paintings of the same reference are laid end to end along the piece's axis into one longer texture, so a run
    of boards repeats less often. crop = (a, b): keep only metres a..b of each (stands: the painter tends to add an end wall)"""
    cuts = [piece_cut(refdir, name, pth, crop) for pth in painted_paths]
    rgba, anchor, metres, frm, axis, P = cuts[0]
    if len(cuts) > 1:
        if not axis: raise SystemExit(f'piece {name}: only pieces with an axis can be joined')
        # the k-th painting starts k*metres further along the axis: along X the anchor moves (+P*m, +P*m/2) px, along Y (-P*m, +P*m/2)
        offs = []
        for k, c in enumerate(cuts):
            d = k*metres; dx = (P*d if axis == 'X' else -P*d); dy = P*d/2
            offs.append((anchor['x'] + dx - c[1]['x'], anchor['y'] + dy - c[1]['y']))     # where this cut's top-left lands relative to the first cut's top-left
        minx = min(0, min(o[0] for o in offs)); miny = min(0, min(o[1] for o in offs))
        maxx = max(o[0] + c[0].shape[1] for o, c in zip(offs, cuts)); maxy = max(o[1] + c[0].shape[0] for o, c in zip(offs, cuts))
        Wc, Hc = int(np.ceil(maxx - minx)), int(np.ceil(maxy - miny))
        canvas = Image.new('RGBA', (Wc, Hc), (0, 0, 0, 0))
        for o, c in zip(offs, cuts):
            im = Image.fromarray(c[0], 'RGBA'); canvas.paste(im, (int(round(o[0] - minx)), int(round(o[1] - miny))), im)
        rgba = np.array(canvas); anchor = { 'x': anchor['x'] - minx, 'y': anchor['y'] - miny }; metres = metres*len(cuts)
    base = Image.fromarray(rgba, 'RGBA')
    info = { 'piece': name, 'axis': axis, 'metres': metres, 'from': frm, 'anchor': anchor }
    for spr in sprs: save_texture(base, os.path.join(outdir, f'piece-{name}-{spr}'), spr, P, fmt, info)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', required=True); ap.add_argument('--painted', required=False, default='')
    ap.add_argument('--style', default='B'); ap.add_argument('--out', default='assets/matchday/isometric')
    ap.add_argument('--sprs', default='24,16,12'); ap.add_argument('--only', default='')
    ap.add_argument('--dirs', default='', help='convert only these headings, e.g. N,NE,NW (a re-roll of a few cells)')
    ap.add_argument('--cells', default='', help='convert only these cells: pose:frame:dirs, several separated by ;  e.g. header:1:S')
    ap.add_argument('--erase', default='', help='clear painted cells so the generated art shows: pose:frame:dirs[:gk], e.g. dive:0:N,NW:gk;parry:1:N,NW:gk')
    ap.add_argument('--stand', default='', help='painted far-stand image to turn into stand-<spr>.png')
    ap.add_argument('--standcrop', default='', help='metres a,b of the painted segment to keep (default all)')
    ap.add_argument('--piece', default='', help='near|left|right|boards|dugout: convert --painted-piece with the piece-<name>-24 reference')
    ap.add_argument('--painted-piece', default='', help='painted image(s), comma-separated: several are laid end to end'); ap.add_argument('--piececrop', default='', help='metres a,b along the axis to keep')
    ap.add_argument('--fmt', default='png', help='texture format for pieces: png or webp')
    a = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = os.path.join(root, a.out, a.style) if not os.path.isabs(a.out) else os.path.join(a.out, a.style)
    sprs = [int(x) for x in a.sprs.split(',')]
    if a.piece:
        piece(a.ref, a.piece, a.painted_piece.split(','), outdir, sprs, tuple(float(x) for x in a.piececrop.split(',')) if a.piececrop else None, a.fmt)
        if not a.painted: return
    if a.stand:
        stand(a.ref, a.stand, outdir, sprs, tuple(float(x) for x in a.standcrop.split(',')) if a.standcrop else None)
        if not a.painted: return
    manifest_by_spr = {spr: json.load(open(os.path.join(outdir, f'players-{spr}.json'))) for spr in sprs}
    sheets = {}
    for spr, m in manifest_by_spr.items():
        for gk in (False, True):
            name = f'overrides-keepers-{spr}.png' if gk else f'overrides-{spr}.png'
            p = os.path.join(outdir, name)
            w, h = (m['keepers']['width'], m['keepers']['height']) if gk else (m['width'], m['height'])
            sheet = np.zeros((h, w, 4), dtype=np.uint8)
            if os.path.exists(p):
                # keep what is painted already; the sheet may have grown new rows since (poses are only ever appended)
                old = np.array(Image.open(p).convert('RGBA'))
                oh, ow = min(old.shape[0], h), min(old.shape[1], w)
                sheet[:oh, :ow] = old[:oh, :ow]
            sheets[(spr, gk)] = sheet
    total = 0
    if a.erase:
        for spec in a.erase.split(';'):
            parts = spec.split(':'); pose, frame, dirs = parts[0], int(parts[1]), parts[2].split(','); gk = len(parts) > 3 and parts[3] == 'gk'
            for spr, m in manifest_by_spr.items():
                rows = cell_rows(m, gk)
                for hair in (0, 1):
                    for d in dirs:
                        key = (pose, frame, hair, d)
                        if key not in rows: continue
                        sx, sy, cw, chh, feet = rows[key]
                        sheets[(spr, gk)][sy:sy+chh, sx:sx+cw] = 0
            print(f'  erased {pose}:{frame} {",".join(dirs)}{" (keepers)" if gk else ""}')
    if not a.painted:
        for (spr, gk), arr in sheets.items():
            name = f'overrides-keepers-{spr}.png' if gk else f'overrides-{spr}.png'
            Image.fromarray(arr).save(os.path.join(outdir, name), optimize=True)
            try:
                sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from iso_pack import pack
                print(f'  wrote {name} ({pack(os.path.join(outdir, name))})')
            except Exception as e: print(f'  wrote {name} (not packed: {e})')
        return
    for f in sorted(os.listdir(a.painted)):
        if not f.endswith('-painted.png'): continue
        stem = f[:-len('-painted.png')].replace('_', '+')
        if a.only and stem not in a.only.split(','): continue
        if not os.path.exists(os.path.join(a.ref, stem + '.json')):
            print(f'  skip {f}: no reference {stem}.json'); continue
        cells = None
        if a.cells:
            cells = set()
            for spec in a.cells.split(';'):
                pose, frame, ds = spec.split(':')[:3]
                for d in ds.split(','): cells.add((pose, int(frame), d))
        n = process(a.ref, os.path.join(a.painted, f), stem, manifest_by_spr, sheets, dirs=set(a.dirs.split(',')) if a.dirs else None, cells=cells)
        print(f'  {stem}: {n} cells written'); total += n
    for (spr, gk), arr in sheets.items():
        name = f'overrides-keepers-{spr}.png' if gk else f'overrides-{spr}.png'
        if arr[..., 3].any():
            Image.fromarray(arr).save(os.path.join(outdir, name), optimize=True)
            try:
                sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from iso_pack import pack       # lossless palette PNG, about a third of the bytes
                print(f'  wrote {name} ({pack(os.path.join(outdir, name))})')
            except Exception as e: print(f'  wrote {name} (not packed: {e})')
    print(f'{total} cells in total')

if __name__ == '__main__':
    main()
