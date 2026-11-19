#!/usr/bin/env python3
# Hair repair for the painted player sheets (Milestone 0, release 1.7.1).
#
# The painted sheets store, for every pixel, what it is (hair, skin, shirt, boots, eye and so on) and how light it is; the
# game then colours hair with the player's own hair colour and always draws boots and eyes black. The converter that made
# the sheets (tools/iso_paint.py before 1.7.1) filed much of the painter's dark brown hair as "boots" or "eye", so that part
# of the hair was black whatever the player's hair colour, in some poses and not in others; and it filed brown shading on
# socks, knees and arms as "hair", so specks there took the hair colour. This script corrects the stored sheets in place:
#
#   1. on the head, pixels filed as boots that belong to the hair become hair;
#   2. on the head, the dark band filed as eye that is really the lower edge of the hair becomes hair, while the eyes and
#      the mouth (short dark marks with skin either side) stay exactly as they are;
#   3. away from the head, pixels filed as hair take the material they sit on (skin, sock, shirt and so on), as a shadow;
#   4. the lightness of repaired hair is put on the same footing as the hair that was right already.
#
# It never adds or removes a pixel, so every silhouette, outline, limb and contact point is unchanged.
#
#   python3 tools/hair_repair.py                      repair assets/matchday/isometric/E in place, print a summary
#   python3 tools/hair_repair.py --dry --report r.json   change nothing, write what would change
#   python3 tools/hair_repair.py --src DIR --out DIR     read the sheets from one folder, write to another
#
# Running it on sheets that are already repaired changes nothing (tools/hair-audit.js checks the result as the game draws it).
import argparse, json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

MATS = ['SKIN','HAIR','SHIRT','TRIM','SHORTS','SOCKS','BOOTS','GLOVE','EYE','CARD','LINE','COAT','HAT','SCARF']
MAT = {m: i for i, m in enumerate(MATS)}
SKIN, HAIR, SHIRT, TRIM, SHORTS, SOCKS, BOOTS, GLOVE, EYE, CARD, LINE = range(11)
HERE = os.path.dirname(os.path.abspath(__file__))
JOINTS = json.load(open(os.path.join(HERE, 'visual-rnd', 'joints.json')))
WIDE = {'slide', 'dive', 'parry'}
EIGHT = np.ones((3, 3), dtype=bool)
ROOT = os.path.join(os.path.dirname(HERE), 'assets', 'matchday', 'isometric', 'E')

# ---- where the head is: the game's own skeleton and projection (src/matchday/iso-sprites.js: cell, worldOf) ----
def jsround(v): return int(math.floor(v + 0.5))
def cell_size(spr, pose):
    W = jsround((4.6 if pose in WIDE else 2.9)*spr); H = jsround(3.1*spr)
    return W, H, H - max(2, jsround(spr*0.25))
def project(p, angle, spr, W, feet):
    fx, fy = math.cos(angle), math.sin(angle); rx, ry = -fy, fx
    X = p[0]*fx + p[1]*rx; Y = p[0]*fy + p[1]*ry
    return (W/2 + spr*(X - Y), feet + spr*((X + Y)*0.5 - p[2]))
def joints_of(pose, frame, d, spr):
    W, H, feet = cell_size(spr, pose); a = JOINTS['headings'][d]; j = JOINTS['poses']['%s:%d' % (pose, frame)]['joints']
    J = {k: project(v, a, spr, W, feet) for k, v in j.items() if isinstance(v, list) and len(v) == 3}
    # where the painter's reference model has its eyes (tools/visual-rnd/blender_figure.py: head radius 0.19 m, eyes 0.86 of it
    # forward, 6.5 cm either side, 1.5 cm up), and how squarely the face is turned to the camera (1 facing it, -1 facing away)
    h = j['head']; J['eyes'] = [project((h[0] + 0.19*0.86, h[1] + sy, h[2] + 0.015), a, spr, W, feet) for sy in (-0.065, 0.065)]
    J['facing'] = (math.cos(a) + math.sin(a))/math.sqrt(2)
    return J

# ---- the measures, in metres of the figure (so the three sizes are treated alike) ----
R_CORE = 0.30       # a blob of hair must have paint this close to the head joint to be the head's hair
R_FOOT = 0.24       # boots this close to a foot are boots
R_HAIR = {0: 0.42, 1: 0.40, 2: 0.46}   # hair, and dark paint that is hair, lies within this of the head joint (by hair style)
EYE_RUN = {24: 2, 16: 2, 12: 1}        # an eye or mouth is at most this many pixels wide
R_EYE = 0.08                           # dark paint this close to where the reference model has an eye, with skin beside it, is an eye
EYE_KEEP = {24: 3, 16: 2, 12: 1}       # and at most this many pixels of it for each eye
TONE_EDGES = [0.58, 0.82, 1.12, 1.40]
TONE_MID = [0.45, 0.70, 0.97, 1.26, 1.55]    # a lightness for each stored tone, as a share of the material's flat colour
BOOT_TO_HAIR = 0.5                     # the painter's boots against the painter's hair, in lightness
LEVEL = 1.6                            # the average tone of a head of hair (0 darkest, 4 lightest; 2 is the player's hair colour as given)
SHADE = True

def runs_bounded_by_skin(eye, m, maxlen):
    """pixels of `eye` in horizontal runs no longer than maxlen that have skin at one end and skin or the edge of the figure at the other"""
    H, W = eye.shape; out = np.zeros_like(eye)
    for y in range(H):
        x = 0
        while x < W:
            if not eye[y, x]: x += 1; continue
            x0 = x
            while x < W and eye[y, x]: x += 1
            left = m[y, x0-1] if x0 > 0 else -1; right = m[y, x] if x < W else -1
            ok = lambda v: v == SKIN
            edge = lambda v: v == LINE or v < 0
            if x - x0 <= maxlen and ((ok(left) and ok(right)) or (ok(left) and edge(right)) or (edge(left) and ok(right))): out[y, x0:x] = True
    return out

def repair_cell(m, t, J, spr, style):
    """m: material per pixel (-1 where empty), t: tone per pixel. Returns new m, new t and counts of what changed."""
    H, W = m.shape; m0 = m; m = m.copy(); t = t.copy()
    yy, xx = np.mgrid[0:H, 0:W]; px = xx + 0.5; py = yy + 0.5
    hx, hy = J['head']; dh = np.hypot(px - hx, py - hy)/spr
    dfoot = np.minimum(np.hypot(px - J['footL'][0], py - J['footL'][1]), np.hypot(px - J['footR'][0], py - J['footR'][1]))/spr
    st = {'boots_to_hair': 0, 'eye_to_hair': 0, 'eye_kept_on_head': 0, 'hair_to_body': 0, 'holes_to_hair': 0, 'retoned': 0, 'levelled': 0, 'hair_before': int(((m0 == HAIR) & (dh <= R_HAIR.get(style, 0.42))).sum())}
    R = R_HAIR.get(style, 0.42)
    # 1 and 2: the head's hair, with the dark paint that belongs to it: of the blobs of hair, boot black and eye black around
    # the head joint, the one with the most hair or boot black close to the joint
    isboot = (m == BOOTS) & (dfoot > R_FOOT); iseye = m == EYE; ishair = m == HAIR
    cand = (ishair | isboot | iseye) & (dh <= R)
    lab, n = ndimage.label(cand, structure=EIGHT)
    mass = np.zeros_like(cand)
    if n:
        counts = ndimage.sum((ishair | isboot) & (dh <= R_CORE), lab, range(1, n + 1)); k = int(np.argmax(counts))
        if counts[k] >= 3: mass = lab == k + 1
    b2h = mass & isboot
    eyes_in = mass & iseye
    facial = runs_bounded_by_skin(eyes_in, m, EYE_RUN.get(spr, 2)) & (py >= hy - 0.06*spr)
    if J['facing'] > -0.2:
        skin_n = ndimage.convolve((m == SKIN).astype(np.int32), np.ones((3, 3), dtype=np.int32), mode='constant')
        def keep_near(radius, need):
            for ex, ey in J['eyes']:
                de = np.hypot(px - ex, py - ey); ys, xs = np.where(eyes_in & (skin_n >= need) & ~facial & (de <= radius))
                for i in np.argsort(de[ys, xs], kind='stable')[:EYE_KEEP.get(spr, 2)]: facial[ys[i], xs[i]] = True
        keep_near(max(1.5, R_EYE*spr), 1)
        # a face that had dark marks keeps an eye: if none of them passed as an eye or a mouth, the dark paint nearest to
        # where the model has each eye, with skin beside it, stays
        face = (dh <= 0.28) & (py >= hy - 0.10*spr)
        if (iseye & face).any() and not ((iseye & face) & ~(eyes_in & ~facial)).any() and ((m == SKIN) & face).sum() >= max(3, round(10*(spr/24.0)**2)):
            keep_near(0.16*spr, 1)
            if not (facial & face).any():
                ys, xs = np.where(eyes_in & face & (skin_n >= 1))
                if len(ys):
                    de = np.minimum.reduce([np.hypot(px[ys, xs] - ex, py[ys, xs] - ey) for ex, ey in J['eyes']]); i = int(np.argsort(de, kind='stable')[0]); facial[ys[i], xs[i]] = True
    e2h = eyes_in & ~facial
    # an eye band counts as hair only where it touches hair (directly or through more of the band)
    hairlike = (mass & ishair) | b2h
    grow = hairlike.copy()
    while True:
        nxt = grow | (ndimage.binary_dilation(grow, structure=EIGHT) & e2h)
        if (nxt == grow).all(): break
        grow = nxt
    e2h = e2h & grow
    st['boots_to_hair'] = int(b2h.sum()); st['eye_to_hair'] = int(e2h.sum()); st['eye_kept_on_head'] = int((iseye & (dh <= R) & ~e2h).sum())
    # 4: lightness. Repaired pixels come in as shadow; where most of the head's hair was misfiled, the whole head is set
    # against its own average so that it is as light as the hair of the poses that were right
    was = mass & ishair; conv = b2h | e2h; allhair = was | conv
    if conv.any():
        tm = np.array(TONE_MID); k = np.clip(t, 0, 4)
        if was.sum() >= 0.30*allhair.sum():
            t[b2h] = np.digitize(BOOT_TO_HAIR*tm[k[b2h]], TONE_EDGES); t[e2h] = 0
        else:
            # nearly all of this head's hair was filed as boots: its shading is in the boots' tones, which stay as they are,
            # and the little that was filed as hair is its highlights
            t[e2h] = 0; t[was] = np.minimum(3, np.digitize(tm[k[was]]/BOOT_TO_HAIR, TONE_EDGES)); st['retoned'] = 1
        m[conv] = HAIR
    # small patches of other materials shut inside the hair (a blue or white sheen the converter took for shorts or collar, a
    # light strand it took for skin) are hair
    hairnow = (m == HAIR) & (dh <= R)
    holes = ndimage.binary_fill_holes(hairnow) & ~hairnow & (m >= 0)
    if holes.any():
        lab, n = ndimage.label(holes); cap = max(2, int(round(10*(spr/24.0)**2)))
        for kk in range(1, n + 1):
            comp = lab == kk
            if comp.sum() > cap or (comp & (m == EYE)).any(): continue          # an eye is never a patch of hair
            if (comp & (m == SKIN)).any() and J['facing'] > -0.2 and float(py[comp].max()) > hy - 0.03*spr: continue   # nor is skin at the level of the face, seen from the front or the side
            for mm, tt in ((SKIN, 3), (TRIM, 3), (SOCKS, 3), (SHORTS, 3), (GLOVE, 3), (CARD, 3), (SHIRT, 2), (BOOTS, 0), (LINE, 0)):
                sel = comp & (m == mm); t[sel] = tt
            m[comp] = HAIR; mass = mass | comp; st['holes_to_hair'] = st.get('holes_to_hair', 0) + int(comp.sum())
    # 3: hair that is not the head's hair takes the material it sits on
    hairnow = m == HAIR
    stray = hairnow & (dh > R)
    loose = hairnow & ~mass & (dh <= R)
    if loose.any():
        lab, n = ndimage.label(loose, structure=EIGHT)
        near = ndimage.sum(loose & (dh <= R_CORE), lab, range(1, n + 1)); size = ndimage.sum(loose, lab, range(1, n + 1))
        for k in range(1, n + 1):
            comp = lab == k
            # a separate tuft above the middle of the head is hair; specks on the face, the neck and the body are not
            tuft = near[k-1] >= 0.6*size[k-1] and size[k-1] >= max(3, spr//6) and float(py[comp].mean()) < hy
            if not tuft: stray |= comp
    if stray.any():
        body = (m >= 0) & (m != HAIR) & (m != LINE) & (m != EYE) & ~((m == BOOTS) & (dfoot > R_FOOT))
        if body.any():
            idx = ndimage.distance_transform_edt(~body, return_distances=False, return_indices=True)
            nm = m[idx[0], idx[1]]; ys, xs = np.where(stray)
            for y, x in zip(ys, xs):
                mm = int(nm[y, x]); k = int(np.clip(t[y, x], 0, 4))
                m[y, x] = mm; t[y, x] = 0 if mm in (SKIN, SOCKS, TRIM, GLOVE, CARD) else [0, 0, 1, 2, 2][k]
            st['hair_to_body'] = int(stray.sum())
    # 4: lightness. The converter set a head's tones against the middle lightness of everything it had filed as hair in the
    # painting, strays included, so some heads came out at the darkest tone throughout and others a tone darker than the rest:
    # the same hair, darker in some poses. Each head is put on the same level (its tones moved together), and a head left with
    # no shading at all is given the light from the upper left that the others have
    head = m == HAIR
    if head.any():
        before_t = t[head].copy(); tt = np.clip(t[head], 0, 4)
        if SHADE and np.bincount(tt, minlength=5).max() >= 0.85*tt.size and tt.size >= 6:
            dx = (px - hx)/spr; dy = (py - hy)/spr
            pat = np.full((H, W), 2, dtype=np.int32); pat[(dx > 0.07) | (dy > 0.03)] = 1; pat[(dx > 0.17) & (dy > -0.34)] = 0; pat[(dx < -0.02) & (dy < -0.24)] = 3
            t[head] = pat[head]
        for _ in range(5):
            shift = int(np.floor(LEVEL - float(np.clip(t[head], 0, 4).mean()) + 0.5))
            if not shift: break
            nt = np.clip(t[head] + shift, 0, 4)
            if (nt == t[head]).all(): break
            t[head] = nt
        st['levelled'] = int((t[head] != before_t).any())
    st['hair_after'] = int((m == HAIR).sum())
    return m, t, st

def decode(cell):
    a = cell[..., 3] > 0
    m = np.where(a, (cell[..., 0] >> 4).astype(np.int32), -1); t = np.clip(np.rint((cell[..., 1].astype(np.int32) - 20)/40.0), 0, 7).astype(np.int32)
    return m, t
def encode_into(cell, m, t):
    a = m >= 0
    cell[..., 0] = np.where(a, m*16 + 8, cell[..., 0]); cell[..., 1] = np.where(a, np.clip(t, 0, 4)*40 + 20, cell[..., 1])

def save_sheet(rgba, path):
    """as the sheets are kept: a palette PNG, one entry for each material and tone, entry 0 clear; read back and compared"""
    flat = rgba.reshape(-1, 4); flat = np.where(flat[:, 3:4] > 0, flat, 0)
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    assert len(cols) <= 256 and (cols[0] == 0).all()
    im = Image.fromarray(inv.reshape(rgba.shape[:2]).astype(np.uint8), 'P'); pal = np.zeros((256, 3), dtype=np.uint8); pal[:len(cols)] = cols[:, :3]
    im.putpalette(pal.reshape(-1).tolist()); im.save(path, optimize=True, transparency=0)
    back = np.array(Image.open(path).convert('RGBA')); back = np.where(back[..., 3:4] > 0, back, 0)
    assert (back == flat.reshape(rgba.shape)).all(), 'the sheet did not read back as written: ' + path

def cells_of(manifest, gk):
    rows = manifest['keepers']['rows'] if gk else manifest['rows']
    for pose, frame, hair, y, cw, ch, feet in rows:
        for i, d in enumerate(manifest['dirs']): yield pose, frame, hair, d, i*cw, y, cw, ch

def repair_sheets(src, out, sprs=(24, 16, 12), dry=False):
    report = {'sheets': {}, 'cells': []}; total = {}
    for spr in sprs:
        lay = os.path.join(src, 'players-%d.json' % spr)
        manifest = json.load(open(lay if os.path.exists(lay) else os.path.join(ROOT, 'players-%d.json' % spr)))
        for gk in (False, True):
            name = ('overrides-keepers-%d.png' if gk else 'overrides-%d.png') % spr
            sheet = np.array(Image.open(os.path.join(src, name)).convert('RGBA')); before = sheet.copy()
            agg = {}; ncell = 0; changed = 0
            for pose, frame, hair, d, x, y, cw, ch in cells_of(manifest, gk):
                cell = sheet[y:y+ch, x:x+cw]
                if not (cell[..., 3] > 0).any(): continue
                m, t = decode(cell); J = joints_of(pose, frame, d, spr)
                nm, nt, st = repair_cell(m, t, J, spr, hair)
                for _ in range(6):                         # until a further pass finds nothing (so a second run of the script changes nothing)
                    m2, t2, st2 = repair_cell(nm, nt, J, spr, hair)
                    if (m2 == nm).all() and (t2 == nt).all(): break
                    for k in ('boots_to_hair', 'eye_to_hair', 'hair_to_body', 'holes_to_hair'): st[k] += st2[k]
                    st['eye_kept_on_head'] = st2['eye_kept_on_head']; st['hair_after'] = st2['hair_after']; nm, nt = m2, t2
                else: raise SystemExit('a cell does not settle: %s %s %s %s' % (pose, frame, hair, d))
                assert ((nm >= 0) == (m >= 0)).all()
                ncell += 1
                if (nm != m).any() or (nt != t).any(): changed += 1; encode_into(cell, nm, nt)
                for k, v in st.items(): agg[k] = agg.get(k, 0) + v
                report['cells'].append([spr, 1 if gk else 0, pose, frame, hair, d, st['boots_to_hair'], st['eye_to_hair'], st['hair_to_body'], st['eye_kept_on_head'], st['retoned'], st['holes_to_hair'], st['levelled']])
            assert (before[..., 3] == sheet[..., 3]).all() and (before[..., 2] == sheet[..., 2]).all()
            agg['cells'] = ncell; agg['cells_changed'] = changed; agg['pixels_changed'] = int(((before[..., 0] != sheet[..., 0]) | (before[..., 1] != sheet[..., 1])).sum()); agg['pixels'] = int((sheet[..., 3] > 0).sum())
            report['sheets'][name] = agg
            for k, v in agg.items(): total[k] = total.get(k, 0) + v
            if not dry:
                os.makedirs(out, exist_ok=True); save_sheet(sheet, os.path.join(out, name))
            print('%-28s cells %5d  changed %5d  boots to hair %6d  eye band to hair %6d  patches inside hair %5d  stray hair to body %6d  eyes and mouths kept %6d' % (name, ncell, changed, agg.get('boots_to_hair', 0), agg.get('eye_to_hair', 0), agg.get('holes_to_hair', 0), agg.get('hair_to_body', 0), agg.get('eye_kept_on_head', 0)))
    report['total'] = total
    print('total: %d cells, %d changed, %d of %d painted pixels refiled' % (total['cells'], total['cells_changed'], total['pixels_changed'], total['pixels']))
    return report

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=ROOT); ap.add_argument('--out', default=''); ap.add_argument('--dry', action='store_true'); ap.add_argument('--report', default='')
    a = ap.parse_args()
    rep = repair_sheets(a.src, a.out or a.src, dry=a.dry)
    if a.report: json.dump(rep, open(a.report, 'w'))

if __name__ == '__main__': main()
