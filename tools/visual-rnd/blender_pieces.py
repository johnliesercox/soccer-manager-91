#!/usr/bin/env python3
"""
Visual R&D, Option B: stadium pieces modelled in Blender in the game's own world units and projection, written in the
piece formats the renderer already tiles and places (tools/iso_paint.py conventions):
  far      the main stand: one 24 m segment of terrace, crowd, barriers, roof, as the far-stand reference box
           (tools/visual-rnd/refs-pieces/stand-far-24.json) -> a painted-style image for `iso_paint.py --stand`
  goal     the goal frame and net at each end, split into the back part (back net, far side net, far post) and the
           front part (roof strands, near side net, crossbar, near post) exactly as iso-stadium.js drawGoal splits them,
           rendered with alpha at every scale -> piece-goal<end><b|f>-<spr>.png + json, placed by their world anchor
  dugout   the dugout box -> piece-dugout-<spr>.png + json
  bpyenv/bin/python tools/visual-rnd/blender_pieces.py --geometry tools/visual-rnd/stadium-geometry.json --out <dir> [--only far,goal,dugout] [--samples 48]
"""
import argparse, json, math, os, random, sys
import bpy, bmesh
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from isocam import camera_canvas, add_sun, project, reflect_all_but_camera_and_lights
BG = (200, 200, 200)

def srgb(c): return tuple((v/255.0)**2.2 for v in c) + (1.0,)
def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene; s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'; s.render.image_settings.color_depth = '8'
    s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'; s.display_settings.display_device = 'sRGB'
    return s

MATS = {}
def material(name, rgb, rough=0.85, emission=0.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = srgb(rgb); b.inputs['Roughness'].default_value = rough
    if emission: b.inputs['Emission Color'].default_value = srgb(rgb); b.inputs['Emission Strength'].default_value = emission
    if alpha < 1.0: b.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    MATS[name] = m; return m

def render_mask(path, flag='crowd'):
    """white where objects carrying the flag are, black elsewhere (the spectators, for the painted-crowd composite); after render()"""
    s = bpy.context.scene; white = material('mask_w', (255, 255, 255), emission=1.0); black = material('mask_b', (0, 0, 0))
    for o in s.objects:
        if o.type in ('CAMERA', 'LIGHT') or not hasattr(o.data, 'materials'): continue
        m = white if o.get(flag) else black
        for i in range(len(o.data.materials)): o.data.materials[i] = m
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 1; s.cycles.use_denoising = False; s.cycles.use_adaptive_sampling = False; s.cycles.max_bounces = 0
    s.view_settings.view_transform = 'Raw'; s.render.film_transparent = True
    if s.world: s.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 0.0
    s.render.filepath = path; bpy.ops.render.render(write_still=True)

def render_depth_piece(path, corners):
    """camera-space depth over the piece's own box, nearest brightest, as a control image; call after the colour render"""
    s = bpy.context.scene; cam = s.camera
    from isocam import Z_AXIS, SWAP
    ds = [(cam.matrix_world.translation - (SWAP @ Vector(c))).dot(Z_AXIS) for c in corners]; lo, hi = min(ds) - 0.5, max(ds) + 0.5
    m = bpy.data.materials.new('depthp'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); cd = nt.nodes.new('ShaderNodeCameraData'); mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = lo; mr.inputs['From Max'].default_value = hi; mr.inputs['To Min'].default_value = 1.0; mr.inputs['To Max'].default_value = 0.0
    nt.links.new(cd.outputs['View Z Depth'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    for o in s.objects:
        if o.type in ('CAMERA', 'LIGHT') or not hasattr(o.data, 'materials'): continue
        for i in range(len(o.data.materials)): o.data.materials[i] = m
    s.render.engine = 'CYCLES'; s.cycles.samples = 1; s.cycles.use_denoising = False; s.cycles.use_adaptive_sampling = False; s.cycles.max_bounces = 0
    s.view_settings.view_transform = 'Raw'; s.render.film_transparent = True
    if s.world: s.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 0.0
    s.render.filepath = path; bpy.ops.render.render(write_still=True)

def render(path, samples):
    reflect_all_but_camera_and_lights()
    s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = samples
    s.cycles.use_denoising = True; s.cycles.use_adaptive_sampling = True
    try: s.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    s.render.filepath = path; bpy.ops.render.render(write_still=True)

# ---- primitives in world units ----
def box(xa, xb, ya, yb, za, zb, mat, name='box'):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((xa + (v.co.x + 0.5)*(xb - xa), ya + (v.co.y + 0.5)*(yb - ya), za + (v.co.z + 0.5)*(zb - za)))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

def cylinder(a, b, r, mat, name='cyl', segs=10):
    a, b = Vector(a), Vector(b); d = b - a; ln = d.length
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=ln)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.matrix_world = Matrix.Translation((a + b)/2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4(); return o

def sphere(c, r, mat, name='sph'):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.location = Vector(c); return o

def person_mesh(coat, head, hat):
    """one spectator: coat as a rounded block, head, optional hat; the mesh is shared between many objects"""
    bm = bmesh.new()
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.17, radius2=0.2, depth=1.1)
    for v in r['verts']: v.co.z += 0.95
    legs = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.12, radius2=0.14, depth=0.42)
    for v in legs['verts']: v.co.z += 0.21
    hd = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=7, radius=0.13)
    for v in hd['verts']: v.co.z += 1.63
    me = bpy.data.meshes.new('person'); bm.to_mesh(me); bm.free()
    me.materials.append(coat); me.materials.append(head)
    nv = len(me.vertices)
    for p in me.polygons:
        z = sum(me.vertices[i].co.z for i in p.vertices)/len(p.vertices)
        p.material_index = 1 if z > 1.5 else 0
        p.use_smooth = z > 1.5
    if hat:
        bm = bmesh.new(); bm.from_mesh(me); h = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.15, radius2=0.11, depth=0.12)
        for v in h['verts']: v.co.z += 1.72
        bm.to_mesh(me); bm.free(); me.materials.append(hat)
        for p in me.polygons:
            z = sum(me.vertices[i].co.z for i in p.vertices)/len(p.vertices)
            if z > 1.66: p.material_index = 2
    return me

# ---- spectators, second generation (Stage B of the Option E polish pass) ----
# A person with shoulders: a bevelled torso, two legs, two arms (down, one raised, both raised), a head with a hair cap,
# a scarf on some, a cap on some; standing or seated. Meshes are shared by their look so a stand of 1,500 people stays light.
PERSON2_MESHES = {}
def person2_mesh(coat, trousers, skin, hair, scarf, hat, pose, seated):
    bm = bmesh.new()
    def cube(cx, cy, cz, sx, sy, sz, bevel=0.0):
        r = bmesh.ops.create_cube(bm, size=1.0); vs = r['verts']
        for v in vs: v.co = Vector((v.co.x*sx + cx, v.co.y*sy + cy, v.co.z*sz + cz))
        if bevel: bmesh.ops.bevel(bm, geom=[e for e in bm.edges if all(v in vs for v in e.verts)], offset=bevel, segments=2, affect='EDGES')
        return vs
    def cyl(a, b, r, segs=8):
        a, b = Vector(a), Vector(b); d = b - a
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=d.length)
        M = Matrix.Translation((a + b)/2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        for v in res['verts']: v.co = M @ v.co
        return res['verts']
    def ball(c, r, u=10, v=7):
        res = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
        for vv in res['verts']: vv.co += Vector(c)
        return res['verts']
    parts = []     # (verts, material index)
    zb = 0.0 if not seated else -0.42          # a seated man: everything but the legs comes down
    if not seated:
        parts.append((cyl((-0.09, 0, 0), (-0.09, 0, 0.92), 0.075), 1)); parts.append((cyl((0.09, 0, 0), (0.09, 0, 0.92), 0.075), 1))
    else:
        parts.append((cyl((-0.09, 0.05, 0.1), (-0.09, 0.3, 0.5), 0.07), 1)); parts.append((cyl((0.09, 0.05, 0.1), (0.09, 0.3, 0.5), 0.07), 1))   # thighs forward, shins down
    parts.append((cube(0, 0, 1.22 + zb, 0.44, 0.24, 0.64, bevel=0.06), 0))                 # torso with shoulders
    hz = 1.64 + zb
    parts.append((cyl((0, 0, 1.52 + zb), (0, 0, 1.58 + zb), 0.05, 6), 2))                   # neck
    parts.append((ball((0, 0, hz), 0.12), 2))                                              # head
    parts.append((ball((0, -0.02, hz + 0.035), 0.125, 10, 5), 3))                           # hair cap (upper half shows)
    sh = 1.47 + zb; aw = 0.26
    if pose == 0:   arms = [((-aw, 0, sh), (-aw - 0.02, 0.04, sh - 0.56)), ((aw, 0, sh), (aw + 0.02, 0.04, sh - 0.56))]
    elif pose == 1: arms = [((-aw, 0, sh), (-aw - 0.02, 0.04, sh - 0.56)), ((aw, 0, sh), (aw + 0.1, 0.02, sh + 0.42))]
    else:           arms = [((-aw, 0, sh), (-aw - 0.12, 0.02, sh + 0.42)), ((aw, 0, sh), (aw + 0.12, 0.02, sh + 0.42))]
    for a, b in arms: parts.append((cyl(a, b, 0.06), 0))
    for a, b in arms: parts.append((ball(b, 0.075, 8, 5), 2))                              # hands
    if scarf: parts.append((cube(0, 0.03, 1.5 + zb, 0.34, 0.3, 0.1, bevel=0.03), 4))
    if hat: parts.append((cyl((0, 0, hz + 0.09), (0, 0, hz + 0.15), 0.135, 10), 5))
    me = bpy.data.meshes.new('person2')
    # material index by part: the vert sets become face sets through a per-vertex tag
    tag = {}
    for verts, mi in parts:
        for v in verts: tag[v] = mi
    bm.to_mesh(me)
    for m in (coat, trousers, skin, hair, scarf or coat, hat or coat): me.materials.append(m)
    vtag = [0]*len(me.vertices); i = 0
    for v in bm.verts: vtag[i] = tag.get(v, 0); i += 1
    for pg in me.polygons:
        pg.material_index = vtag[pg.vertices[0]]; pg.use_smooth = pg.material_index in (2, 3)
    bm.free(); return me

def spectator_factory2(G, seed, seated_rows=None):
    """a callable that drops a second-generation spectator at (x, y, z) facing `facing`; seated_rows: a callable row -> bool"""
    rnd = random.Random(seed)
    coats = [hexrgb(c) for c in G['COATS']] + [hexrgb(c) for c in ('#D04040', '#F2C230', '#4A7BD0', '#E07030', '#3AA060', '#F2F2F2', '#7A3A8A', '#2A6A4A', '#E8D8B8', '#C9C2B6', '#9CB4D8', '#D8A8A0', '#B8C8A0', '#F0E0C0')]
    trousers = [hexrgb(c) for c in ('#23262C', '#2F3A52', '#3A332C', '#4A4E55', '#5C4A3A')]
    skins = [(224, 172, 130), (200, 150, 110), (150, 100, 70), (240, 200, 170), (120, 80, 55)]
    hairs = [hexrgb(c) for c in ('#2A1E14', '#4A3222', '#141414', '#8A6A3A', '#B0B0B0', '#C8A050')]
    scarves = [hexrgb(c) for c in ('#C8102E', '#1D5BA4', '#F2C230', '#F2F2F2', '#3AA060', '#E07030')]
    hats = [hexrgb(c) for c in ('#2A2A2A', '#3B2E2A', '#1E2A44', '#6B1F1F', '#D04040', '#8A8A8A')]
    def pm(key):
        if key not in PERSON2_MESHES:
            ci, ti, si, hi, sc, ha, pose, seated = key
            PERSON2_MESHES[key] = person2_mesh(material(f'coat{ci}', coats[ci]), material(f'trs{ti}', trousers[ti]), material(f'skin{si}', skins[si]), material(f'hair{hi}', hairs[hi]),
                                               material(f'scarf{sc}', scarves[sc]) if sc >= 0 else None, material(f'hat{ha}', hats[ha]) if ha >= 0 else None, pose, seated)
        return PERSON2_MESHES[key]
    def place(x, y, z, facing, row=None):
        ci = rnd.randrange(len(G['COATS'])) if rnd.random() < 0.62 else len(G['COATS']) + rnd.randrange(14)
        ti = rnd.randrange(len(trousers)); si = rnd.randrange(len(skins)); hi = rnd.randrange(len(hairs))
        sc = rnd.randrange(len(scarves)) if rnd.random() < 0.3 else -1; ha = rnd.randrange(len(hats)) if rnd.random() < 0.3 else -1
        r = rnd.random(); pose = 0 if r < 0.88 else 1 if r < 0.95 else 2
        seated = bool(seated_rows and row is not None and seated_rows(row) and rnd.random() < 0.85)
        o = bpy.data.objects.new('p', pm((ci, ti, si, hi, sc, ha, pose, seated))); bpy.context.scene.collection.objects.link(o); o['crowd'] = 1
        turn = rnd.uniform(-0.35, 0.35) if rnd.random() < 0.85 else rnd.choice((-1.2, 1.2))   # most face the pitch, a few talk to a neighbour
        o.location = (x, y, z); o.rotation_euler = (0, 0, facing + turn)
        sc_ = rnd.uniform(0.86, 1.08) if rnd.random() > 0.06 else rnd.uniform(0.68, 0.78)   # heights, and a child here and there
        o.scale = (sc_, sc_, sc_)
        return o
    place.rnd = rnd
    return place

# ---- the stands ----
PERSON_MESHES = {}
def spectator_factory(G, seed):
    """a callable that drops a spectator at (x, y, z) facing `facing` radians: coats from the game's palette, a few bright
    ones, hats and bare heads, meshes shared between the many objects; people are flagged for the crowd mask"""
    rnd = random.Random(seed)
    coats = [hexrgb(c) for c in G['COATS']] + [hexrgb(c) for c in ('#D04040', '#F2C230', '#4A7BD0', '#E07030', '#3AA060', '#F2F2F2')]
    skins = [(224, 172, 130), (200, 150, 110), (150, 100, 70), (240, 200, 170)]
    hats = [hexrgb(c) for c in ('#2A2A2A', '#3B2E2A', '#1E2A44', '#6B1F1F', '#D04040')]
    def pm(ci, si, hi):
        k = (ci, si, hi)
        if k not in PERSON_MESHES:
            PERSON_MESHES[k] = person_mesh(material(f'coat{ci}', coats[ci]), material(f'skin{si}', skins[si]), material(f'hat{hi}', hats[hi]) if hi >= 0 else None)
        return PERSON_MESHES[k]
    def place(x, y, z, facing):
        ci = rnd.randrange(len(G['COATS'])) if rnd.random() < 0.85 else len(G['COATS']) + rnd.randrange(6)
        si = rnd.randrange(len(skins)); hi = rnd.randrange(len(hats)) if rnd.random() < 0.35 else -1
        o = bpy.data.objects.new('p', pm(ci, si, hi)); bpy.context.scene.collection.objects.link(o); o['crowd'] = 1
        o.location = (x, y, z); o.rotation_euler = (0, 0, facing + rnd.uniform(-0.3, 0.3)); sc = rnd.uniform(0.92, 1.06); o.scale = (sc, sc, sc)
        return o
    place.rnd = rnd
    return place

def build_terrace(G, axis, frm, to, rows, rise, tread, place, roof=None, seed=1991):
    """a run of terrace from `frm` to `to` along the stand's axis: 'far' rows recede in -Y from the far touchline, 'near' in +Y
    from the near one, 'left' in -X beyond the X=0 goal line, 'right' in +X beyond X=105; steps, a front wall, a back wall,
    crush barriers every fourth row, spectators facing the pitch, and for the far stand a roof on pillars"""
    S = G['STAND']; m = G['DIM']['runoff'] + S['gap']; L, W = G['DIM']['L'], G['DIM']['W']
    concrete = material('concrete', hexrgb('#5C6269'), 0.9); concrete_d = material('concrete_d', hexrgb('#454A50'), 0.9)
    rail = material('rail', hexrgb('#AEB4BA'), 0.4); back = material('back', hexrgb('#3A3F46'), 0.9)
    # world coordinates from (along, depth d from the pitch edge, z)
    def P(along, d, z):
        if axis == 'far': return (along, -d, z)
        if axis == 'near': return (along, W + d, z)
        if axis == 'left': return (-d, along, z)
        return (L + d, along, z)
    facing = { 'far': math.pi/2, 'near': -math.pi/2, 'left': 0.0, 'right': math.pi }[axis]   # towards the pitch (figures face +x locally)
    def slab(a0, a1, d0, d1, z0, z1, mat, name):
        pts = [P(a0, d0, 0), P(a1, d1, 0)]; xa, xb = sorted([pts[0][0], pts[1][0]]); ya, yb = sorted([pts[0][1], pts[1][1]])
        return box(xa, xb, ya, yb, z0, z1, mat, name)
    slab(frm, to, m - 0.35, m, 0, 0.5, concrete_d, 'frontwall')
    for r in range(rows):
        slab(frm, to, m + r*tread, m + (r + 1)*tread, 0, 0.5 + r*rise, concrete if r % 2 else concrete_d, f'step{r}')
    zBack = 0.5 + rows*rise
    slab(frm, to, m + rows*tread, m + (rows + 1.2)*tread, 0, zBack + 1.1, back, 'backwall')
    for r in range(3, rows, 4):
        z = 0.5 + r*rise; d = m + (r + 0.2)*tread; a = frm + 0.5
        while a < to - 0.5:
            ln = min(3.0, to - 0.5 - a)
            cylinder(P(a, d, z + 1.0), P(a + ln, d, z + 1.0), 0.04, rail, 'bar')
            for pa in (a + 0.1, a + ln - 0.1): cylinder(P(pa, d, z), P(pa, d, z + 1.0), 0.035, rail, 'barpost')
            a += ln + 1.1
    n = 0
    for r in range(rows):
        z = 0.5 + r*rise; d = m + (r + 0.55)*tread; a = frm + 0.25
        while a < to - 0.2:
            if place.rnd.random() > 0.04:
                x, y, _ = P(a + place.rnd.uniform(-0.06, 0.06), d + place.rnd.uniform(-0.17, 0.17), 0); place(x, y, z, facing, r); n += 1
            a += place.rnd.uniform(0.36, 0.46)
    if roof:
        r0, zTop = roof['r0'], roof['zTop']; dFront = m + r0*tread; dBack = m + (rows + 1.5)*tread
        roofm = material('roof', hexrgb('#8E96A0'), 0.6); fascia = material('fascia', hexrgb('#D8DCE2'), 0.7); pillar = material('pillar', hexrgb('#9AA0A6'), 0.7)
        slab(frm, to, dFront, dBack, zTop - 0.3, zTop, roofm, 'roof'); slab(frm, to, dFront - 0.02, dFront + 0.25, zTop - 0.9, zTop, fascia, 'fascia')
        a = int(frm) + 6
        while a < to:
            slab(a - 0.15, a + 0.15, dFront - 0.15, dFront + 0.15, 0.5 + r0*rise, zTop - 0.3, pillar, 'pillar'); a += 12
    return n

CROWD_GEN = 1
def make_place(G, seed, seated_rows=None):
    return spectator_factory2(G, seed, seated_rows) if CROWD_GEN == 2 else spectator_factory(G, seed)
def build_far_stand(G, ref):
    S = G['STAND']; place = make_place(G, ref.get('seed', 1991), seated_rows=lambda r: r >= S['rows'] - S['roofRows'])
    return build_terrace(G, 'far', ref['from'], ref['from'] + ref['metres'], S['rows'], S['rise'], S['tread'], place, roof={ 'r0': S['rows'] - S['roofRows'], 'zTop': ref['zTop'] })

def build_side_stand(G, name, ref):
    S = G['STAND']; place = make_place(G, ref.get('seed', 1991) + { 'near': 1, 'left': 2, 'right': 3 }[name])
    rows = S['nearRows'] if name == 'near' else S['endRows']; rise = { 'near': S['nearRise'], 'left': S['rise'], 'right': S['rightRise'] }[name]
    return build_terrace(G, name, ref['from'], ref['from'] + ref['metres'], rows, rise, S['tread'], place)

# ---- the corners: a quarter terrace in the notch between two stands, a tower at the junction ----
def build_corner(G, c):
    K = G['CORNER']; T, ROWS, FIRST = K['T'], K['ROWS'], K['FIRST']
    concrete = material('concrete', hexrgb('#5C6269'), 0.9); concrete_d = material('concrete_d', hexrgb('#454A50'), 0.9); rail = material('rail', hexrgb('#AEB4BA'), 0.4)
    tl = material('tower_l', hexrgb('#B9BDC2'), 0.8); door = material('door', hexrgb('#3C4148'), 0.8)
    z = lambda r: 0.5 + r*c['rise']
    A = lambda r: (c['x0'] + c['sx']*r*T, c['y0']); B = lambda r: (c['x0'], c['y0'] + c['sy']*r*T)
    def prism(quad, z0, z1, mat, name):
        bm = bmesh.new(); vs = [bm.verts.new((x, y, z1)) for x, y in quad]; f = bm.faces.new(vs)
        r = bmesh.ops.extrude_face_region(bm, geom=[f]); verts = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, 0, z0 - z1), verts=verts); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
        o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o
    for r in range(FIRST, ROWS):
        prism([A(r), B(r), B(r + 1), A(r + 1)], 0, z(r), concrete if r % 2 else concrete_d, f'crow{r}')
    # the front wall along the first row's edge, and a barrier every fourth row
    a, b = A(FIRST), B(FIRST); prism([a, b, (b[0] + c['sx']*0.001, b[1]), (a[0], a[1] + c['sy']*0.001)], 0, 0.5, concrete_d, 'cwall') if False else None
    for r in range(FIRST, ROWS):
        if r % 4 == 1:
            a, b = A(r), B(r); cylinder((a[0], a[1], z(r) + 1.0), (b[0], b[1], z(r) + 1.0), 0.04, rail, 'cbar')
    # the tower at the junction
    side = K['TOWER_SIDE']; xa, xb = sorted([c['x0'], c['x0'] + c['sx']*side]); ya, yb = sorted([c['y0'], c['y0'] + c['sy']*side])
    box(xa, xb, ya, yb, 0, c['tower'], tl, 'tower')
    box(xa + 0.9, xa + 1.7, yb - 0.02, yb + 0.03, 0, 2.1, door, 'door')
    # the people along each row
    place = make_place(G, 1991 + ord(c['id'])); facing = math.atan2(-c['sy'], -c['sx'])   # towards the pitch, roughly
    n = 0
    for r in range(FIRST, ROWS):
        a, b = A(r + 0.5), B(r + 0.5); ln = math.hypot(b[0] - a[0], b[1] - a[1]); k = max(1, int(ln/(0.38 if CROWD_GEN == 2 else 0.42)))
        for i in range(k):
            f = (i + 0.5)/k; x = a[0] + (b[0] - a[0])*f; y = a[1] + (b[1] - a[1])*f
            if place.rnd.random() > 0.05: place(x + place.rnd.uniform(-0.05, 0.05), y + place.rnd.uniform(-0.05, 0.05), z(r), facing, r); n += 1
    far = ROWS*T; corners = [(c['x0'] + c['sx']*dx, c['y0'] + c['sy']*dy, zz) for dx in (0, far) for dy in (0, far) for zz in (0, max(z(ROWS), c['tower']) + 1.8)]
    return corners, (c['x0'], c['y0'], 0), n

# ---- the floodlight pylons: a tapering lattice with a bank of lamps ----
def build_pylon(G, X, Y):
    steel = material('steel', hexrgb('#C9CED4'), 0.5); lamp = material('lamp', (255, 246, 200), 0.3, emission=2.0); housing = material('housing', hexrgb('#E9EDF0'), 0.6)
    H = G['PYLON_H']; b0, b1 = 1.6, 0.5
    legs = []
    for sx_, sy_ in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        a = (X + sx_*b0/2, Y + sy_*b0/2, 0); b = (X + sx_*b1/2, Y + sy_*b1/2, H - 2.0); cylinder(a, b, 0.07, steel, 'leg'); legs.append((a, b))
    zz = 2.0
    while zz < H - 2.5:
        t = zz/(H - 2.0); w = b0 + (b1 - b0)*t
        for sx_, sy_, ex, ey in ((-1, -1, 1, -1), (1, -1, 1, 1), (1, 1, -1, 1), (-1, 1, -1, -1)):
            cylinder((X + sx_*w/2, Y + sy_*w/2, zz), (X + ex*w/2, Y + ey*w/2, zz), 0.035, steel, 'brace')
            cylinder((X + sx_*w/2, Y + sy_*w/2, zz), (X + ex*w/2, Y + ey*w/2, zz + 3.2), 0.03, steel, 'diag')
        zz += 3.2
    box(X - 1.4, X + 1.4, Y - 0.35, Y + 0.35, H - 2.2, H - 0.2, housing, 'head')
    for i in range(4):
        for j in range(2): box(X - 1.2 + i*0.65, X - 0.7 + i*0.65, Y - 0.4, Y - 0.34, H - 2.0 + j*0.95, H - 1.3 + j*0.95, lamp, 'lamp')
    corners = [(X + dx, Y + dy, zz_) for dx in (-1.6, 1.6) for dy in (-1.6, 1.6) for zz_ in (0, H)]
    return corners, (X, Y, 0)

# ---- the goal ----
def surface(name, f, nu, nv, mat, uvf):
    """a smooth grid mesh over the unit square: f(u, v) -> world point, uvf(u, v) -> texture coordinate (strands per metre)"""
    bm = bmesh.new(); uv_layer = bm.loops.layers.uv.new('UVMap')
    verts = [[bm.verts.new(Vector(f(i/nu, j/nv))) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            face = bm.faces.new((verts[i][j], verts[i+1][j], verts[i+1][j+1], verts[i][j+1])); face.smooth = True
            for loop, (ii, jj) in zip(face.loops, ((i, j), (i+1, j), (i+1, j+1), (i, j+1))): loop[uv_layer].uv = uvf(ii/nu, jj/nv)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

def net_material(strand_frac):
    """an off-white net: transparent except along the grid lines of the texture coordinate (one unit = one mesh cell)"""
    if 'netgrid' in MATS: return MATS['netgrid']
    m = bpy.data.materials.new('netgrid'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = srgb((238, 243, 238)); b.inputs['Roughness'].default_value = 0.7
    b.inputs['Emission Color'].default_value = srgb((238, 243, 238)); b.inputs['Emission Strength'].default_value = 0.3
    uv = nt.nodes.new('ShaderNodeUVMap'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(uv.outputs['UV'], sep.inputs['Vector'])
    lines = []
    for axis in ('X', 'Y'):
        fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'; nt.links.new(sep.outputs[axis], fr.inputs[0])
        lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = strand_frac; nt.links.new(fr.outputs[0], lt.inputs[0]); lines.append(lt)
    mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'; nt.links.new(lines[0].outputs[0], mx.inputs[0]); nt.links.new(lines[1].outputs[0], mx.inputs[1])
    # a transparent shader mixed in by the grid (rather than the BSDF's own alpha), so shadow rays pass through the holes too
    out = nt.nodes.get('Material Output'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mx.outputs[0], mix.inputs['Fac']); nt.links.new(tr.outputs['BSDF'], mix.inputs[1]); nt.links.new(b.outputs['BSDF'], mix.inputs[2]); nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    MATS['netgrid'] = m; return m

def build_goal(G, end, part, state=None, spr=24):
    """the goal frame and nets as surfaces: posts and crossbar with rounded joints and ground sockets, angled stanchions
    from the top of each post to the back rail and uprights at the back, the roof and back nets sagging under their own
    weight, the side nets drawn in a little, every strand a line of a procedural grid so the net is one translucent
    sheet rather than a hedge of tubes. part: 'b' (back net, far side net, far post, far stanchion and upright, the back
    rail), 'f' (roof net, near side net, near post, crossbar, near stanchion and upright) or 's' (the goal's shadow on the
    grass alone: a shadow catcher under the whole frame with every object casting but unseen, drawn on the ground before
    anything stands on it). state: None for the still net, or ('bulge'|'settle', lane 0..2) for the back net pushed out
    where a goal went in (lane 0 by the far post, 2 by the near)."""
    g = G['goals'][end]; D = G['DIM']['goalD']; H, HB = g['H'], g['HB']; far, near = g['far'], g['near']; gx, bx, d = g['gx'], g['bx'], g['dir']
    post = material('post', hexrgb('#F8FAF8'), 0.45); steel = material('stanch', hexrgb('#CDD2D4'), 0.5); sock = material('socket', hexrgb('#3C3F42'), 0.9)
    mesh = { 24: 0.25, 16: 0.3, 12: 0.4 }.get(spr, 0.25); strand = 0.6/spr                  # strands about six tenths of a pixel wide at every scale
    net = net_material(min(0.3, strand/mesh)); pr = 0.06
    X = lambda x: gx + d*x; sideZ = lambda x: H - (H - HB)*(x/D); W = near - far; sp = math.sin
    # the back net: hangs from the back rail, pegged at the ground, a slight belly away from the pitch, plus the bulge of a goal
    lanes = (far + 1.3, (far + near)/2, near - 1.3)
    def back_push(u, v):
        belly = 0.06*sp(math.pi*u)**0.6*sp(math.pi*v)**0.5
        if not state: return belly
        amp, sy, sz = (0.65, 0.55, 0.45) if state[0]=='bulge' else (0.26, 0.8, 0.65)
        yy, zz = far + u*W, v*HB; yc, zc = lanes[state[1]], 0.5
        return belly + amp*math.exp(-((yy - yc)**2/(2*sy*sy) + (zz - zc)**2/(2*sz*sz)))*sp(math.pi*u)**0.3*sp(math.pi*v)**0.4
    parts = { 'b': [], 'f': [] }
    parts['b'].append(surface('backnet', lambda u, v: (bx + d*back_push(u, v), far + u*W, v*HB), 40, 16, net, lambda u, v: (u*W/mesh, v*HB/mesh)))
    # the side nets: a trapezoid from the post (full height) to the rear upright (rail height), drawn in a little at the middle
    for y, pname, sgn in ((far, 'b', 1), (near, 'f', -1)):
        parts[pname].append(surface('sidenet', lambda u, v, y=y, sgn=sgn: (X(u*D), y + sgn*0.07*sp(math.pi*u)*sp(math.pi*v), v*sideZ(u*D)), 16, 12, net, lambda u, v: (u*D/mesh, v*sideZ(u*D)/mesh)))
    # the roof net: from the crossbar down to the back rail, sagging in the middle
    slope = math.hypot(D, H - HB)
    parts['f'].append(surface('roofnet', lambda u, v: (X(u*D), far + v*W, sideZ(u*D) - 0.16*sp(math.pi*u)*sp(math.pi*v)), 16, 40, net, lambda u, v: (u*slope/mesh, v*W/mesh)))
    # the frame: posts, crossbar, rounded joints, sockets; stanchions from the post tops to the back rail, uprights at the back
    parts['b'] += [cylinder((gx, far, 0), (gx, far, H), pr, post, 'farpost'), sphere((gx, far, H), pr, post, 'joint'), cylinder((gx, far, 0), (gx, far, 0.03), pr*1.35, sock, 'socket'),
                   cylinder((gx, far, H), (bx, far, HB), 0.035, steel, 'stanchion'), cylinder((bx, far, 0), (bx, far, HB), 0.035, steel, 'upright'), sphere((bx, far, HB), 0.035, steel, 'joint'),
                   cylinder((bx, far, HB), (bx, near, HB), 0.03, steel, 'rail')]
    parts['f'] += [cylinder((gx, near, 0), (gx, near, H), pr, post, 'nearpost'), sphere((gx, near, H), pr, post, 'joint'), cylinder((gx, near, 0), (gx, near, 0.03), pr*1.35, sock, 'socket'),
                   cylinder((gx, far, H), (gx, near, H), pr, post, 'crossbar'),
                   cylinder((gx, near, H), (bx, near, HB), 0.035, steel, 'stanchion'), cylinder((bx, near, 0), (bx, near, HB), 0.035, steel, 'upright'), sphere((bx, near, HB), 0.035, steel, 'joint')]
    for pname in ('b', 'f'):
        if pname != part:
            for o in parts[pname]: o.visible_camera = False                                   # unseen, but it still casts its shadow
    xs = [gx, bx]; ys = [far, near]; zs = [0, H]
    corners = [(x, y, z) for x in xs for y in ys for z in zs]
    if part == 'b': corners += [(bx + d*0.8, y, z) for y in ys for z in zs]                    # room for the bulge
    if part == 's':
        # the shadow on the grass (the light comes from the near side, so the frame's shadow falls past the far post)
        xa, xb = min(gx, bx) - 0.6, max(gx, bx) + 0.6; ya, yb = far - 1.6, near + 0.3
        ground = surface('ground', lambda u, v: (xa + u*(xb - xa), ya + v*(yb - ya), 0), 1, 1, material('grass_sc', (60, 120, 50), 1.0), lambda u, v: (u, v))
        ground.is_shadow_catcher = True
        corners = [(x, y, 0) for x in (xa, xb) for y in (ya, yb)]
    return corners, (gx, far, 0)

def build_goal_v1(G, end, part):
    g = G['goals'][end]; D = G['DIM']['goalD']
    post = material('post', hexrgb('#F7F9F7'), 0.5); net = material('net', (236, 242, 236), 0.6, emission=0.35)
    pr, sr = 0.06, 0.012; mesh = 0.25
    sideZ = lambda x: g['H'] - (g['H'] - g['HB'])*(x/D)
    X = lambda x: g['gx'] + g['dir']*x
    if part == 'b':
        y = g['far']
        while y <= g['near'] + 1e-6: cylinder((g['bx'], y, 0), (g['bx'], y, g['HB']), sr, net, 'net'); y += mesh      # back net
        z = 0
        while z <= g['HB'] + 1e-6: cylinder((g['bx'], g['far'], z), (g['bx'], g['near'], z), sr, net, 'net'); z += mesh
        x = 0
        while x <= D + 1e-6: cylinder((X(x), g['far'], 0), (X(x), g['far'], sideZ(x)), sr, net, 'net'); x += mesh/2       # far side net
        z = 0
        while z <= g['H'] + 1e-6: cylinder((g['gx'], g['far'], min(z, g['H'])), (g['bx'], g['far'], min(z, g['HB'])), sr, net, 'net'); z += mesh
        cylinder((g['bx'], g['far'], g['HB']), (g['bx'], g['near'], g['HB']), 0.025, post, 'rail')                      # the back rail
        cylinder((g['gx'], g['far'], 0), (g['gx'], g['far'], g['H']), pr, post, 'farpost')
    else:
        y = g['far'] + mesh
        while y < g['near'] - 1e-6: cylinder((g['gx'], y, g['H']), (g['bx'], y, g['HB']), sr, net, 'net'); y += mesh*2    # sparse roof strands
        x = 0
        while x <= D + 1e-6: cylinder((X(x), g['near'], 0), (X(x), g['near'], sideZ(x)), sr, net, 'net'); x += mesh/2     # near side net
        z = 0
        while z <= g['H'] + 1e-6: cylinder((g['gx'], g['near'], min(z, g['H'])), (g['bx'], g['near'], min(z, g['HB'])), sr, net, 'net'); z += mesh
        cylinder((g['gx'], g['far'], g['H']), (g['gx'], g['near'], g['H']), pr, post, 'crossbar')
        cylinder((g['gx'], g['near'], 0), (g['gx'], g['near'], g['H']), pr, post, 'nearpost')
    # the world corners of this part, for the canvas
    xs = [g['gx'], g['bx']]; ys = [g['far'], g['near']]; zs = [0, g['H']]
    return [(x, y, z) for x in xs for y in ys for z in zs], (g['gx'], g['far'], 0)

# ---- the dugout ----
def build_dugout(G):
    b = G['dugouts'][0]; h = G['DUGOUT']['h']; roofT = G['DUGOUT']['roofT']
    xa, xb, ya, yb = b['xa'], b['xb'], b['ya'], b['yb']
    wall = material('dwall', hexrgb('#6B7078'), 0.9); wall_d = material('dwall_d', hexrgb('#5A5F66'), 0.9); wall_l = material('dwall_l', hexrgb('#80858C'), 0.9)
    seat = material('seat', hexrgb('#C9A063'), 0.8); seatb = material('seatb', hexrgb('#B08850'), 0.8); roofm = material('droof', hexrgb('#AEB7C2'), 0.6); lip = material('dlip', hexrgb('#E3E8EE'), 0.7)
    box(xa, xb, ya, ya + 0.12, 0, h, wall, 'back'); box(xa, xa + 0.12, ya, yb, 0, h, wall_d, 'left'); box(xb - 0.12, xb, ya, yb, 0, h, wall_l, 'right')
    box(xa + 0.12, xb - 0.12, ya + 0.1, yb - 0.9, 0.4, 0.5, seat, 'seat'); box(xa + 0.12, xb - 0.12, ya + 0.1, ya + 0.2, 0.5, 1.0, seatb, 'seatback')
    box(xa, xb, ya, yb + 0.2, h, h + roofT, roofm, 'roof'); box(xa, xb, yb + 0.1, yb + 0.2, h - 0.02, h + roofT + 0.08, lip, 'lip')
    box(xa + 0.12, xb - 0.12, ya + 0.12, yb - 0.3, 0, 0.05, material('dfloor', hexrgb('#4A4F56'), 0.9), 'floor')
    return [(x, y, z) for x in (xa, xb) for y in (ya, yb) for z in (0, b['zTop'])], (xa, ya, 0)

def canvas_for(corners, P, pad=2):
    pts = [project(*c, P, 0, 0) for c in corners]
    minX = math.floor(min(p[0] for p in pts)) - pad; maxX = math.ceil(max(p[0] for p in pts)) + pad
    minY = math.floor(min(p[1] for p in pts)) - pad; maxY = math.ceil(max(p[1] for p in pts)) + pad
    return maxX - minX, maxY - minY, -minX, -minY

def soften_shadow(path, k):
    """the shadow catcher's pixels (black, part transparent) lightened to k of their darkness, so the goal's shadow sits on the
    grass like the painted shadows do rather than as a hard dark patch; the net and frame pixels are left alone"""
    from PIL import Image; import numpy as np
    arr = np.array(Image.open(path).convert('RGBA')); rgb = arr[..., :3].astype(int); lum = rgb.max(axis=2)
    shadow = (lum < 24) & (arr[..., 3] > 0)
    arr[..., 3] = np.where(shadow, np.round(arr[..., 3]*k/16)*16, arr[..., 3]).clip(0, 255).astype(np.uint8)   # sixteen levels: a third of the bytes
    arr[..., :3] = np.where(shadow[..., None], 0, arr[..., :3])
    Image.fromarray(arr, 'RGBA').save(path)

def to_webp(path, quality=88):
    from PIL import Image
    out = path[:-4] + '.webp'; Image.open(path).convert('RGBA').save(out, 'WEBP', quality=quality, method=6); os.remove(path); return out

def composite_grey(path_in, path_out):
    from PIL import Image
    im = Image.open(path_in).convert('RGBA'); bg = Image.new('RGBA', im.size, BG + (255,)); bg.alpha_composite(im); bg.convert('RGB').save(path_out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--geometry', required=True); ap.add_argument('--out', required=True); ap.add_argument('--only', default='far,near,left,right,corners,pylons,goal,dugout')
    ap.add_argument('--samples', type=int, default=48); ap.add_argument('--sprs', default='24,16,12')
    ap.add_argument('--refs', default=os.path.join(os.path.dirname(__file__), 'refs-pieces')); ap.add_argument('--crowd', type=int, default=1, help='spectator generation: 1 (the R&D figures) or 2 (shoulders, arms, scarves, seated rows)')
    ap.add_argument('--fmt', default='webp', choices=('png', 'webp'), help='the goal net pieces: webp (default) or png')
    ap.add_argument('--net-states', action='store_true', help='also render the back net bulging and settling after a goal, in three lanes (piece-goal<end>b-bulge<k>, -settle<k>)')
    a = ap.parse_args(); G = json.load(open(a.geometry)); os.makedirs(a.out, exist_ok=True)
    global CROWD_GEN; CROWD_GEN = a.crowd
    only = a.only.split(','); sprs = [int(x) for x in a.sprs.split(',')]
    # the stands: rendered into their reference canvases (the converters' layouts), with a crowd mask and a depth map for the painting pass
    if 'far' in only:
        ref = json.load(open(os.path.join(a.refs, 'stand-far-24.json'))); P = ref['P']; W, H = ref['width'], ref['height']
        ox = ref['anchor']['x'] - P*(ref['from'] - ref['yFront']); oy = ref['anchor']['y'] - P*((ref['from'] + ref['yFront'])/2)
        reset_scene(); MATS.clear(); PERSON_MESHES.clear(); PERSON2_MESHES.clear(); camera_canvas(W, H, ox, oy, P); add_sun(2.6, 0.6)
        n = build_far_stand(G, ref); print(f'far stand: {n} spectators', flush=True)
        render(os.path.join(a.out, 'far-blender.png'), a.samples); composite_grey(os.path.join(a.out, 'far-blender.png'), os.path.join(a.out, 'far-painted.png'))
        render_mask(os.path.join(a.out, 'far-crowd.png'))
        m = G['DIM']['runoff'] + G['STAND']['gap']; corners = [(x, y, z) for x in (ref['from'], ref['from'] + ref['metres']) for y in (ref['yBack'], ref['yFront']) for z in (0, ref['zTop'])]
        render_depth_piece(os.path.join(a.out, 'far-depth.png'), corners); print('wrote far-painted.png, far-crowd.png, far-depth.png', flush=True)
    for name in ('near', 'left', 'right'):
        if name not in only: continue
        ref = json.load(open(os.path.join(a.refs, f'piece-{name}-24.json'))); P = ref['P']; W, H = ref['width'], ref['height']; b = ref['box']
        reset_scene(); MATS.clear(); PERSON_MESHES.clear(); PERSON2_MESHES.clear(); camera_canvas(W, H, ref['ox'], ref['oy'], P); add_sun(2.6, 0.6)
        n = build_side_stand(G, name, ref); print(f'{name} stand: {n} spectators', flush=True)
        render(os.path.join(a.out, f'{name}-blender.png'), a.samples); composite_grey(os.path.join(a.out, f'{name}-blender.png'), os.path.join(a.out, f'{name}-painted.png'))
        render_mask(os.path.join(a.out, f'{name}-crowd.png'))
        corners = [(x, y, z) for x in (b['xa'], b['xb']) for y in (b['ya'], b['yb']) for z in (0, b['zTop'])]
        render_depth_piece(os.path.join(a.out, f'{name}-depth.png'), corners); print(f'wrote {name}-painted.png, {name}-crowd.png, {name}-depth.png', flush=True)
    for spr in sprs:
        if 'corners' in only:
            for c in G['CORNERS']:
                reset_scene(); MATS.clear(); PERSON_MESHES.clear(); PERSON2_MESHES.clear(); corners, anchorW, n = build_corner(G, c)
                W, H, ox, oy = canvas_for(corners, spr); camera_canvas(W, H, ox, oy, spr); add_sun(2.6, 0.6)
                name = 'corner' + c['id']; path = os.path.join(a.out, f'piece-{name}-{spr}.png'); render(path, a.samples)
                if spr == 24:   # the painting pass works at the reference scale: the colour on grey, the crowd mask and the depth map
                    composite_grey(path, os.path.join(a.out, f'{name}-painted.png')); render_mask(os.path.join(a.out, f'{name}-crowd.png')); render_depth_piece(os.path.join(a.out, f'{name}-depth.png'), corners)
                ax, ay = project(*anchorW, spr, ox, oy)
                json.dump({ 'piece': name, 'axis': None, 'metres': 0, 'from': 0, 'anchor': { 'x': ax, 'y': ay }, 'anchorWorld': list(anchorW), 'P': spr, 'width': W, 'height': H }, open(os.path.join(a.out, f'piece-{name}-{spr}.json'), 'w'))
                print(f'wrote piece-{name}-{spr}.png {W}x{H} ({n} spectators)', flush=True)
        if 'pylons' in only:
            for c in G['CORNERS']:
                if not c.get('pylon'): continue
                reset_scene(); MATS.clear(); corners, anchorW = build_pylon(G, c['pylon']['X'], c['pylon']['Y'])
                W, H, ox, oy = canvas_for(corners, spr); camera_canvas(W, H, ox, oy, spr); add_sun(2.6, 0.7)
                name = 'pylon' + c['id']; path = os.path.join(a.out, f'piece-{name}-{spr}.png'); render(path, a.samples)
                ax, ay = project(*anchorW, spr, ox, oy)
                json.dump({ 'piece': name, 'axis': None, 'metres': 0, 'from': 0, 'anchor': { 'x': ax, 'y': ay }, 'anchorWorld': list(anchorW), 'P': spr, 'width': W, 'height': H }, open(os.path.join(a.out, f'piece-{name}-{spr}.json'), 'w'))
                print(f'wrote piece-{name}-{spr}.png {W}x{H}', flush=True)
        if 'goal' in only:
            states = [(None, '')] + ([(('bulge', k), f'-bulge{k}') for k in range(3)] + [(('settle', k), f'-settle{k}') for k in range(3)] if a.net_states else [])
            for end in (0, 1):
                for part in ('s', 'b', 'f'):
                    for state, suffix in (states if part == 'b' else states[:1]):
                        reset_scene(); MATS.clear(); corners, anchorW = build_goal(G, end, part, state, spr)
                        W, H, ox, oy = canvas_for(corners, spr); camera_canvas(W, H, ox, oy, spr); add_sun(2.6, 0.7, angle_deg=1.5)   # a sharper sun: the net's shadow stays a net on the grass
                        name = f'goal{end}{part}{suffix}'; path = os.path.join(a.out, f'piece-{name}-{spr}.png'); render(path, max(a.samples, 64))
                        if part == 's': soften_shadow(path, 0.7)
                        elif a.fmt == 'webp': path = to_webp(path)                            # the nets' soft strands: a fifth of the bytes of the PNG
                        ax, ay = project(*anchorW, spr, ox, oy)
                        json.dump({ 'piece': name, 'axis': None, 'metres': 0, 'from': 0, 'anchor': { 'x': ax, 'y': ay }, 'anchorWorld': list(anchorW), 'P': spr, 'width': W, 'height': H }, open(os.path.join(a.out, f'piece-{name}-{spr}.json'), 'w'))
                        print(f'wrote {os.path.basename(path)} {W}x{H}', flush=True)
        if 'dugout' in only:
            reset_scene(); MATS.clear(); corners, anchorW = build_dugout(G)
            W, H, ox, oy = canvas_for(corners, spr); camera_canvas(W, H, ox, oy, spr); add_sun()
            path = os.path.join(a.out, f'piece-dugout-{spr}.png'); render(path, a.samples)
            ax, ay = project(*anchorW, spr, ox, oy); b = G['dugouts'][0]
            json.dump({ 'piece': 'dugout', 'axis': None, 'metres': G['DUGOUT']['metres'], 'from': b['xa'], 'anchor': { 'x': ax, 'y': ay }, 'P': spr, 'width': W, 'height': H }, open(os.path.join(a.out, f'piece-dugout-{spr}.json'), 'w'))
            print(f'wrote piece-dugout-{spr}.png {W}x{H}', flush=True)

if __name__ == '__main__':
    main()
