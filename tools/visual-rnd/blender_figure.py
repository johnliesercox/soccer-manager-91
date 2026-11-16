#!/usr/bin/env python3
"""
Visual R&D, Option B: a Blender footballer posed by the game's own skeleton, rendered into the reference-grid layout
that tools/iso_paint.py already understands (colour, depth, mask, material map and json per grid), so the result
can be converted straight into an asset style (D) or sent through Floyo as a better control image (E).

Runs under a Python with the bpy module (tools/visual-rnd/bpyenv):
  bpyenv/bin/python tools/visual-rnd/blender_figure.py --joints tools/visual-rnd/joints.json --frames tools/visual-rnd/frames.json \
      --out tools/visual-rnd/refs-b [--only run-0+run-1] [--refspr 108] [--samples 48] [--engine CYCLES|WORKBENCH]

The view is the game's 2:1 dimetric projection: screen x = X - Y, screen y (down) = (X + Y)/2 - Z, `refspr` pixels per
metre, which an orthographic camera reproduces exactly at azimuth 45 degrees, elevation 40.9 degrees, with the pixel
aspect set so a metre of height is `refspr` pixels. The light comes from the same direction as the generator's.
"""
import argparse, json, math, os, sys, tempfile
import bpy, bmesh
from mathutils import Vector, Matrix, Quaternion

# ---- the game's conventions (tools/iso-art.js) ----
KIT = { 'SKIN':(224,172,130), 'HAIR':(60,38,22), 'SHIRT':(220,30,30), 'TRIM':(245,245,245), 'SHORTS':(30,60,200), 'SOCKS':(240,200,20),
        'BOOTS':(20,20,20), 'GLOVE':(245,245,245), 'EYE':(20,20,20), 'CARD':(240,200,20) }
MATS = ['SKIN','HAIR','SHIRT','TRIM','SHORTS','SOCKS','BOOTS','GLOVE','EYE','CARD','LINE','COAT','HAT','SCARF']
TEMPLATE = { m: (i*16 + 8, 2*40 + 20, 128) for i, m in enumerate(MATS) }     # material-coded colour (tone 2) for the mat map
BG = (200, 200, 200)
HEAD_R = 0.19
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from isocam import camera_canvas, add_sun, reflect_all_but_camera_and_lights   # the game's projection (see isocam.py)

def srgb(c): return tuple((v/255.0)**2.2 for v in c) + (1.0,)

def mid(a, b, u): return [a[i] + (b[i]-a[i])*u for i in range(3)]

# ---- scene ----
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'; s.render.image_settings.color_depth = '8'
    s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'
    s.display_settings.display_device = 'sRGB'
    return s

def make_material(name, rgb, emission=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = srgb(rgb)
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Specular IOR Level'].default_value = 0.2 if 'Specular IOR Level' in bsdf.inputs else 0.2
    m.diffuse_color = srgb(rgb)                                 # what Workbench draws with color_type MATERIAL
    return m

# ---- the figure: metaballs per material (they blend into smooth limbs and joints), meshes for the head and hair ----
class Figure:
    def __init__(self, mats):
        self.mats = mats; self.mbs = {}; self.objs = []
    def mb(self, mat):
        if mat not in self.mbs:
            data = bpy.data.metaballs.new('mb_'+mat); data.resolution = 0.06; data.render_resolution = 0.018; data.threshold = 0.6
            o = bpy.data.objects.new('mb_'+mat, data); bpy.context.scene.collection.objects.link(o); o.data.materials.append(self.mats[mat])
            self.mbs[mat] = o; self.objs.append(o)
        return self.mbs[mat].data
    def ball(self, c, r, mat):
        # a metaball element of radius R with the default stiffness shows a surface at about 0.78 R: scale up so the visible radius is r
        e = self.mb(mat).elements.new(); e.type = 'BALL'; e.co = Vector(c); e.radius = r/0.78; e.stiffness = 2.0
    def chain(self, a, b, r0, r1, mat):
        ln = math.dist(a, b); n = max(2, math.ceil(ln/(0.3*min(r0, r1))) + 1)
        for i in range(n):
            u = i/(n-1); self.ball(mid(a, b, u), r0 + (r1-r0)*u, mat)
    def ellipsoid(self, c, r, sx, sz, mat):
        e = self.mb(mat).elements.new(); e.type = 'ELLIPSOID'; e.co = Vector(c); e.radius = r/0.78; e.size_x = sx; e.size_y = 1.0; e.size_z = sz; e.stiffness = 2.0
    def sphere_mesh(self, c, r, mat, name):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=c)
        o = bpy.context.active_object; o.name = name; o.data.materials.append(self.mats[mat])
        for p in o.data.polygons: p.use_smooth = True
        self.objs.append(o); return o
    def hair(self, head, hr, style):
        # a cap clipped out of a slightly bigger sphere: 0 short (top and back), 1 cropped (close, high), 2 longer (down the
        # neck and over the ears, with a fringe above the brow); colour is the HAIR material, recoloured per player in the game
        r = hr + (0.012 if style == 1 else 0.03 if style == 2 else 0.02)
        front = -0.05 if style == 1 else -0.01 if style == 2 else -0.035
        top = 0.12 if style == 1 else 0.07 if style == 2 else 0.095
        low = -0.17 if style == 2 else -0.01 if style == 1 else -0.07
        c = (head[0] - 0.015, head[1], head[2] + 0.015)
        o = self.sphere_mesh(c, r, 'HAIR', 'hair')
        bm = bmesh.new(); bm.from_mesh(o.data)
        kill = []
        for v in bm.verts:
            w = o.matrix_world @ v.co; rel = w - Vector(head); f = rel.x
            keep = (f < front or rel.z > top) and rel.z >= low
            if style == 2 and f >= front and rel.z > 0.06 and abs(rel.y) < 0.12: keep = True      # the fringe
            if not keep: kill.append(v)
        bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(o.data); bm.free()
        return o

def build_figure(mats, j, gk, hair_style, pose=None):
    """the footballer on the game's skeleton: proportions between the generator's chunky figure and the concept art
    (a smaller head, slimmer limbs, longer boots), a modelled face and three hair styles"""
    F = Figure(mats); HR = HEAD_R
    for s in ('L', 'R'):
        hip, knee, foot = j['hip'+s], j['knee'+s], j['foot'+s]
        F.chain(hip, mid(hip, knee, 0.5), 0.1, 0.088, 'SHORTS')
        F.chain(mid(hip, knee, 0.5), knee, 0.084, 0.072, 'SKIN')
        F.chain(mid(knee, foot, 0.08), mid(knee, foot, 0.2), 0.073, 0.071, 'TRIM')           # the sock top
        F.chain(mid(knee, foot, 0.2), foot, 0.069, 0.054, 'SOCKS')
        F.ellipsoid((foot[0] + 0.045, foot[1], foot[2] - 0.005), 0.068, 1.75, 0.62, 'BOOTS')
    pelvis, chest, neck, head = j['pelvis'], j['chest'], j['neck'], j['head']
    F.chain(pelvis, [pelvis[0], pelvis[1], pelvis[2] - 0.13], 0.18, 0.175, 'SHORTS')
    F.chain(mid(pelvis, chest, 0.1), chest, 0.165, 0.205, 'SHIRT')
    F.chain(chest, neck, 0.205, 0.135, 'SHIRT')
    F.chain(neck, mid(neck, head, 0.55), 0.06, 0.06, 'SKIN')
    for i in range(12):
        a = i/12*math.pi*2; F.ball((neck[0] + 0.095*math.cos(a), neck[1] + 0.095*math.sin(a), neck[2] - 0.005), 0.034, 'TRIM')   # the collar
    for s in ('L', 'R'):
        sh, el, hd = j['sh'+s], j['el'+s], j['hand'+s]
        F.ball(sh, 0.072, 'SHIRT')
        F.chain(sh, mid(sh, el, 0.55), 0.064, 0.058, 'SHIRT')
        F.ball(mid(sh, el, 0.57), 0.063, 'TRIM')                     # the cuff
        F.chain(mid(sh, el, 0.57), el, 0.056, 0.052, 'SKIN')
        F.chain(el, hd, 0.052, 0.045, 'SKIN')
        F.ball(hd, 0.075 if gk else 0.055, 'GLOVE' if gk else 'SKIN')
    # the head: an egg, ears, a nose and a brow for the depth map to carry, eyes
    h = F.sphere_mesh(head, HR, 'SKIN', 'head'); h.scale = (0.96, 0.94, 1.08)
    for sy in (-HR*0.98, HR*0.98): F.sphere_mesh((head[0] - 0.01, head[1] + sy, head[2] - 0.01), 0.03, 'SKIN', 'ear')
    F.sphere_mesh((head[0] + HR*0.93, head[1], head[2] - 0.02), 0.028, 'SKIN', 'nose')
    F.ellipsoid((head[0] + HR*0.8, head[1], head[2] + 0.055), 0.03, 1.0, 0.5, 'SKIN')          # the brow ridge (y scale 1 across, flat)
    F.hair(head, HR, hair_style)
    for sy in (-0.065, 0.065):
        F.sphere_mesh((head[0] + HR*0.86, head[1] + sy, head[2] + 0.015), 0.022, 'EYE', 'eye')
    if pose == 'card':                                                   # the referee's card, a flat rectangle held above the right hand (as the generator draws it)
        hd = j['handR']; bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts: v.co = Vector((hd[0] + v.co.x*0.012, hd[1] + v.co.y*0.16, hd[2] + 0.14 + v.co.z*0.22))
        me = bpy.data.meshes.new('card'); bm.to_mesh(me); bm.free(); me.materials.append(mats['CARD'])
        o = bpy.data.objects.new('card', me); bpy.context.scene.collection.objects.link(o); F.objs.append(o)
    return F

def rotate_all(objs, angle):
    R = Matrix.Rotation(angle, 4, 'Z')
    for o in objs: o.matrix_world = R @ o.matrix_world

# ---- rendering one cell: colour (Cycles), mat (Workbench flat), depth (Z pass) ----
def depth_material():
    # emission = camera-space depth mapped 248..252 m -> 0..1 (isocam puts the camera 250 m out along the view direction),
    # rendered through the Raw view transform so the file holds the value linearly; the figure's own range is rescaled later
    m = bpy.data.materials.new('depth'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); cam = nt.nodes.new('ShaderNodeCameraData'); mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 248.0; mr.inputs['From Max'].default_value = 252.0; mr.inputs['To Min'].default_value = 0.0; mr.inputs['To Max'].default_value = 1.0
    nt.links.new(cam.outputs['View Z Depth'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], em.inputs['Color']); em.inputs['Strength'].default_value = 1.0
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m

def render_depth(path, objs):
    s = bpy.context.scene; dm = depth_material()
    for o in objs:
        if hasattr(o.data, 'materials'):
            for i in range(len(o.data.materials)): o.data.materials[i] = dm
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 1; s.cycles.use_denoising = False; s.cycles.use_adaptive_sampling = False
    s.cycles.max_bounces = 0; s.view_settings.view_transform = 'Raw'
    if s.world: s.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 0.0
    s.render.filepath = path; bpy.ops.render.render(write_still=True)

def render(path, engine, samples):
    s = bpy.context.scene; s.render.engine = 'BLENDER_WORKBENCH' if engine == 'WORKBENCH' else engine
    if engine == 'CYCLES':
        s.cycles.device = 'CPU'; s.cycles.samples = samples; s.cycles.use_denoising = True; s.cycles.use_adaptive_sampling = True
        try: s.cycles.denoiser = 'OPENIMAGEDENOISE'
        except Exception: pass
    s.render.filepath = path; bpy.ops.render.render(write_still=True)

def render_mat(path, mats):
    # the material map: every material drawn flat in its template code (R = index*16 + 8), no lighting, no anti-aliasing,
    # written through the Raw view transform so the file holds the codes exactly
    s = bpy.context.scene; s.render.engine = 'BLENDER_WORKBENCH'
    for m, mat in mats.items(): mat.diffuse_color = tuple(v/255.0 for v in TEMPLATE[m]) + (1.0,)
    s.view_settings.view_transform = 'Raw'
    sh = s.display.shading; sh.light = 'FLAT'; sh.color_type = 'MATERIAL'; sh.show_shadows = False; sh.show_cavity = False
    s.display.render_aa = 'OFF'; s.render.filepath = path; bpy.ops.render.render(write_still=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--joints', required=True); ap.add_argument('--frames', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--only', default=''); ap.add_argument('--refspr', type=int, default=108); ap.add_argument('--samples', type=int, default=48)
    ap.add_argument('--engine', default='CYCLES'); ap.add_argument('--hair', type=int, default=0); ap.add_argument('--cols', type=int, default=4)
    a = ap.parse_args()
    J = json.load(open(a.joints)); groups = json.load(open(a.frames))['groups']
    if a.only: groups = [g for g in groups if g['stem'] in a.only.split(',')]
    os.makedirs(a.out, exist_ok=True)
    from PIL import Image
    import numpy as np
    refspr = a.refspr
    dirs = J['dirs']; headings = J['headings']
    tmp = tempfile.mkdtemp(prefix='sm91-blender-')
    def top_of(spec):
        # the highest point of a pose: head, hands (and the referee's card above the right hand), with the limb radius
        jj = J['poses'][spec]['joints']; t = max(jj['head'][2] + HEAD_R, jj['handL'][2] + 0.07, jj['handR'][2] + 0.07)
        if spec.startswith('card:'): t = max(t, jj['handR'][2] + 0.14 + 0.12)
        return t
    for g in groups:
        wide = bool(g.get('wide')); gk = bool(g.get('gk')); hair = int(g.get('hair', a.hair))   # the hair style per grid when frames.json says so
        cellW = round((4.0 if wide else 2.0)*refspr); cols = max(1, round(a.cols/2)) if wide else a.cols
        # the cell is 2.125 m above the feet (the generator's reference layout) unless a pose in the grid reaches higher
        # (the raised card, the two-armed celebration): then it grows, and the converter aligns by each cell's own feet line
        above = max(2.125, max(top_of(s) for s in g['frames']) + 0.12)
        cellH = round((above + 0.25)*refspr); FEET = cellH - round(refspr*0.25)
        n = len(g['frames'])*len(dirs); rows = math.ceil(n/cols); W, H = cellW*cols, cellH*rows
        colour = Image.new('RGB', (W, H), BG); depth = Image.new('L', (W, H), 0); mask = Image.new('L', (W, H), 0); matimg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        cells = []; idx = 0
        for spec in g['frames']:
            pose, frame = spec.split(':'); joints = J['poses'][spec]['joints']
            for d in dirs:
                i = idx; idx += 1; x0, y0 = (i % cols)*cellW, (i//cols)*cellH
                reset_scene(); mats = { m: make_material(m, KIT[m]) for m in KIT }
                camera_canvas(cellW, cellH, cellW/2, FEET, refspr); add_sun()
                F = build_figure(mats, joints, gk, hair, pose); rotate_all(F.objs, headings[d]); reflect_all_but_camera_and_lights()
                base = os.path.join(tmp, f'{g["stem"].replace("+","_")}-{d}-{frame}')
                render(base + '-c.png', a.engine, a.samples)
                render_mat(base + '-m.png', mats)
                c = Image.open(base + '-c.png').convert('RGBA'); al = np.array(c)[..., 3] > 32
                rgb = np.array(c)[..., :3].copy(); rgb[~al] = BG
                # depth from the emission render (nearest = brightest, 60..255 over the figure's own range)
                render_depth(base + '-z.png', F.objs)
                z = np.array(Image.open(base + '-z.png').convert('RGB'))[..., 0].astype(np.float32)
                dz = np.zeros(al.shape, dtype=np.uint8); zz = z[al]
                if zz.size:
                    zmin, zmax = float(zz.min()), float(zz.max()); span = max(1.0, zmax - zmin)
                    dz[al] = np.clip(60 + 195*(1 - (z[al] - zmin)/span), 0, 255).astype(np.uint8)
                m = Image.open(base + '-m.png').convert('RGBA'); marr = np.array(m).copy(); marr[~al] = 0; marr[al, 3] = 255
                colour.paste(Image.fromarray(rgb), (x0, y0)); depth.paste(Image.fromarray(dz), (x0, y0)); mask.paste(Image.fromarray((al*255).astype(np.uint8)), (x0, y0)); matimg.paste(Image.fromarray(marr), (x0, y0))
                cells.append({ 'pose': pose, 'frame': int(frame), 'dir': d, 'x': x0, 'y': y0, 'w': cellW, 'h': cellH, 'feet': FEET })
                print(f'  {g["stem"]} {spec} {d}', flush=True)
        stem = g['stem']
        colour.save(os.path.join(a.out, f'{stem}-colour.png')); depth.save(os.path.join(a.out, f'{stem}-depth.png')); mask.save(os.path.join(a.out, f'{stem}-mask.png')); matimg.save(os.path.join(a.out, f'{stem}-mat.png'))
        json.dump({ 'frames': [{ 'pose': s.split(':')[0], 'frame': int(s.split(':')[1]) } for s in g['frames']], 'gk': gk, 'hair': hair, 'refspr': refspr, 'cellW': cellW, 'cellH': cellH, 'feet': FEET,
                    'width': W, 'height': H, 'cols': cols, 'cells': cells, 'kit': { k: list(v) for k, v in KIT.items() }, 'bg': list(BG), 'source': 'blender' }, open(os.path.join(a.out, f'{stem}.json'), 'w'))
        print(f'ref {stem}: {W}x{H}, {len(cells)} cells', flush=True)

if __name__ == '__main__':
    main()
