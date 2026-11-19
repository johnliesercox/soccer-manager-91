#!/usr/bin/env python3
# The converter's hair rule (tools/iso_paint.py, classify), tested on a made-up painting so that nothing outside the
# repository is needed. The painting has what went wrong before 1.7.1: hair painted dark brown shading to near black, on
# a head a little larger than the reference's; brown shadows on an arm, a knee and a sock; and real eyes, a mouth and boots.
#   python3 tools/test_iso_paint_hair.py            pass or fail
#   python3 tools/test_iso_paint_hair.py --old F    the same painting through another copy of the converter (to show the fault)
import importlib.util, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
def load(path):
    spec = importlib.util.spec_from_file_location('iso_paint_under_test', path); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod
P = load(sys.argv[sys.argv.index('--old') + 1] if '--old' in sys.argv else os.path.join(HERE, 'iso_paint.py'))
MAT = P.MAT
KIT = { 'SKIN': (224, 172, 130), 'HAIR': (60, 38, 22), 'SHIRT': (220, 30, 30), 'TRIM': (245, 245, 245), 'SHORTS': (30, 60, 200), 'SOCKS': (240, 200, 20), 'BOOTS': (20, 20, 20), 'GLOVE': (245, 245, 245), 'EYE': (20, 20, 20), 'CARD': (240, 200, 20) }
H, W = 560, 160; yy, xx = np.mgrid[0:H, 0:W]            # the figure in the upper half, as a row of a painted grid is
def disc(cx, cy, r): return (xx - cx)**2 + (yy - cy)**2 <= r*r
def box(x0, y0, x1, y1): return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
# the reference figure: what Blender's material map says is where
ref = np.full((H, W), -1, dtype=np.int32)
ref[box(60, 70, 100, 150)] = MAT['SHIRT']; ref[box(40, 75, 60, 140)] = MAT['SKIN']; ref[box(100, 75, 120, 140)] = MAT['SKIN']          # trunk, arms
ref[box(60, 150, 100, 185)] = MAT['SHORTS']; ref[box(62, 185, 78, 215)] = MAT['SKIN']; ref[box(82, 185, 98, 215)] = MAT['SKIN']         # shorts, knees
ref[box(62, 215, 78, 255)] = MAT['SOCKS']; ref[box(82, 215, 98, 255)] = MAT['SOCKS']; ref[box(58, 255, 80, 268)] = MAT['BOOTS']; ref[box(82, 255, 104, 268)] = MAT['BOOTS']
ref[disc(80, 45, 20)] = MAT['SKIN']; ref[disc(80, 45, 21) & (yy < 40)] = MAT['HAIR']; ref[disc(72, 47, 2)] = MAT['EYE']; ref[disc(88, 47, 2)] = MAT['EYE']
figure = ref >= 0
# the painting: the same figure in the painter's colours, with a larger head of dark hair and brown shadows
img = np.zeros((H, W, 3), dtype=np.uint8)
for m, c in KIT.items(): img[ref == MAT[m]] = c
head = disc(80, 44, 23); hair = head & (yy < 42); figure = figure | head; img[head & ~hair & (ref < 0)] = KIT['SKIN']
shade = np.clip((xx - 60)/40.0, 0, 1)                                           # lit on the left, near black on the right
img[hair] = (np.array([60, 38, 22])[None, :]*(1 - shade[hair][:, None]) + np.array([18, 14, 12])[None, :]*shade[hair][:, None]).astype(np.uint8)
fringe = head & (yy >= 42) & (yy < 45) & (xx > 62) & (xx < 98); img[fringe] = (34, 22, 14)                    # the hair's lower edge, over the reference's skin
eyes = disc(72, 48, 2) | disc(88, 48, 2); mouth = box(76, 57, 85, 59); img[eyes] = (20, 20, 20); img[mouth] = (60, 30, 30)
arm = box(100, 100, 112, 140); knee = box(82, 200, 98, 215); sock = box(82, 240, 98, 255); img[arm] = (90, 60, 40); img[knee] = (96, 66, 44); img[sock] = (70, 52, 12)
mat, tone = P.classify(img, figure, P.nearest_fill(np.where(figure, ref, -1), figure), KIT)
name = lambda sel: {P.MATS[k]: int(((mat == k) & sel).sum()) for k in np.unique(mat[sel]) if k >= 0}
bad = 0
def check(ok, text):
    global bad
    print(('ok   ' if ok else 'FAIL ') + text); bad += 0 if ok else 1
allhair = hair | fringe
check(((mat == MAT['HAIR']) & allhair).sum() >= 0.97*allhair.sum(), 'the painted hair, dark side and lower edge included, is filed as hair: %s' % name(allhair))
check(((mat == MAT['BOOTS']) & head).sum() == 0, 'no boots on the head')
check(((mat == MAT['EYE']) & eyes).sum() >= 0.8*eyes.sum() and ((mat == MAT['EYE']) & mouth).sum() >= 0.8*mouth.sum(), 'the eyes and the mouth are still eye: %s, %s' % (name(eyes), name(mouth)))
body = arm | knee | sock
check(((mat == MAT['HAIR']) & ~head).sum() == 0, 'no hair away from the head: %s' % name(body))
check(((mat == MAT['SKIN']) & (arm | knee)).sum() == (arm | knee).sum() and ((mat == MAT['SOCKS']) & sock).sum() == sock.sum(), 'brown shadow on an arm and a knee stays skin, on a sock stays sock')
boots = ref == MAT['BOOTS']
check(((mat == MAT['BOOTS']) & boots).sum() == boots.sum(), 'the boots are boots')
sk = (mat == MAT['SKIN']) & arm
check(sk.any() and int(tone[sk].max()) <= 1, 'and the shadow is kept as a dark tone of the skin')
print('the converter\'s hair rule passes' if not bad else '%d check(s) FAILED' % bad); sys.exit(1 if bad else 0)
