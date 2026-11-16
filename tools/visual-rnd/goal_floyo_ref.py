# the goal of end 0 as one colour picture over grass, with its depth map, at 96 px/m: the reference pair for the Floyo
# image-to-image test (does a light repaint make the goal sit better with the painted figures and stands?)
import sys, os, json
sys.path.insert(0, 'tools/visual-rnd')
import bpy
import blender_pieces as BP
from isocam import camera_canvas, add_sun, project
OUT = sys.argv[1]; P = 96
G = json.load(open('tools/visual-rnd/stadium-geometry.json')); g = G['goals'][0]
BP.reset_scene(); BP.MATS.clear(); corners, anchorW = BP.build_goal(G, 0, 'b', None, 24)
sc = bpy.context.scene
for o in sc.objects:
    if o.type == 'MESH': o.visible_camera = True
# grass under and around the goal (the renderer's pitch green, a touch of stripe)
xa, xb = -3.2, 2.4; ya, yb = g['far'] - 2.6, g['near'] + 1.4
BP.surface('grass', lambda u, v: (xa + u*(xb - xa), ya + v*(yb - ya), -0.001), 1, 1, BP.material('grass', (62, 142, 66), 1.0), lambda u, v: (u, v))
line = BP.material('line', (240, 244, 240), 0.9)
BP.box(-0.06, 0.06, ya, yb, 0.0, 0.004, line, 'goalline')
corners = [(x, y, z) for x in (xa, xb) for y in (ya, yb) for z in (0, 2.6)]
W, H, ox, oy = BP.canvas_for(corners, P); camera_canvas(W, H, ox, oy, P); add_sun(2.6, 0.7, angle_deg=1.5)
BP.render(os.path.join(OUT, 'goal0-full.png'), 96)
BP.composite_grey(os.path.join(OUT, 'goal0-full.png'), os.path.join(OUT, 'goal0-painted.png'))
BP.render_depth_piece(os.path.join(OUT, 'goal0-depth.png'), [(x, y, z) for x in (min(g['gx'], g['bx']) - 0.5, max(g['gx'], g['bx']) + 0.5) for y in (g['far'] - 0.5, g['near'] + 0.5) for z in (0, g['H'])])
print('wrote', W, H)
