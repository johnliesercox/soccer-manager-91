"""
The game's projection in Blender. The renderer maps a world point (X, Y, Z) in metres to screen pixels
    px = P (X - Y) + ox,   py = P ((X + Y)/2 - Z) + oy          (y down, P px per metre)
That is an orthographic view along (1, 1, 1) with the screen up vector (-1, -1, 2)/sqrt 6, drawn mirrored: a physical camera
on the (1, 1, 1) axis above the ground puts +X on the left, the game puts it on the right. So the scene is built in game
coordinates, every object is then reflected through the X = Y plane (the SWAP matrix) and a physical camera from above
looks at the result: px then comes out as P (X - Y) exactly, with the game's depth order and its light.
Scales: sqrt 2 P px per metre across the view plane, sqrt 1.5 P px per metre up it (a metre of Z is P px, a metre of
ground along X + Y is P/2 px of depth).
"""
import math
import bpy
from mathutils import Vector, Matrix

Z_AXIS = Vector((1, 1, 1)).normalized()                           # from the scene towards the camera
UP = Vector((-1, -1, 2)).normalized()                             # screen up, in world terms
RIGHT = UP.cross(Z_AXIS).normalized()                             # (-1, 1, 0)/sqrt 2: screen right for the physical camera
PX_X = math.sqrt(2.0); PX_Y = math.sqrt(1.5)                     # px per metre, per P, across and up the view plane
SWAP = Matrix(((0, 1, 0, 0), (1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))   # the reflection X <-> Y
LIGHT_GAME = Vector((-0.106, 0.476, 0.873)).normalized()          # the generator's light, in game coordinates

def project(X, Y, Z, P, ox=0.0, oy=0.0):
    return (P*(X - Y) + ox, P*((X + Y)/2 - Z) + oy)

def camera_canvas(W, H, ox, oy, P):
    """an orthographic camera into a W x H canvas in which the game's world origin lands at pixel (ox, oy)"""
    s = bpy.context.scene
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.sensor_fit = 'HORIZONTAL'; cd.ortho_scale = W/(PX_X*P); cd.clip_start = 0.1; cd.clip_end = 600
    cam = bpy.data.objects.new('cam', cd); s.collection.objects.link(cam); s.camera = cam
    rot = Matrix((RIGHT, UP, Z_AXIS)).transposed()                # columns: camera X (right), Y (up), Z (towards the camera)
    target = RIGHT*((W/2 - ox)/(PX_X*P)) + UP*((oy - H/2)/(PX_Y*P))   # the world point at the frame centre
    cam.matrix_world = Matrix.Translation(target + Z_AXIS*250) @ rot.to_4x4()
    s.render.resolution_x = W; s.render.resolution_y = H; s.render.resolution_percentage = 100
    s.render.pixel_aspect_x = PX_Y; s.render.pixel_aspect_y = PX_X
    return cam

def add_sun(strength=3.2, sky=0.55, angle_deg=6):
    """the generator's light, from the same side once the world is reflected"""
    s = bpy.context.scene
    l = bpy.data.lights.new('sun', 'SUN'); l.energy = strength; l.angle = math.radians(angle_deg)
    o = bpy.data.objects.new('sun', l); s.collection.objects.link(o)
    light = Vector((LIGHT_GAME.y, LIGHT_GAME.x, LIGHT_GAME.z))      # SWAP applied to the direction
    o.rotation_euler = light.to_track_quat('Z', 'Y').to_euler()     # a lamp shines along its local -Z, so local Z points at the source
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = (0.55, 0.58, 0.65, 1.0); bg.inputs['Strength'].default_value = sky
    return o

def reflect_world(objs):
    """game coordinates -> Blender coordinates for the physical camera: reflect every object through X = Y"""
    bpy.context.view_layer.update()                               # locations set a moment ago are not in matrix_world until the scene evaluates
    for o in objs: o.matrix_world = SWAP @ o.matrix_world

def reflect_all_but_camera_and_lights():
    reflect_world([o for o in bpy.context.scene.objects if o.type not in ('CAMERA', 'LIGHT')])
