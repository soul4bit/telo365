"""Render review images and a PNG sequence from an original Mixamo Air Squat working blend.

The scene is never exported or published by this script. It adds only temporary
camera/lights/floor objects to the in-memory review session.
"""
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) != 1 or args[0] not in {"male", "female"}:
    raise RuntimeError("Pass male or female after --")
avatar = args[0]
scene = bpy.context.scene
rigs = [obj for obj in scene.objects if obj.type == "ARMATURE"]
if len(rigs) != 1:
    raise RuntimeError("Open a mixamo-*-air-squat-combined-working.blend scene")
meshes = [obj for obj in scene.objects if obj.type == "MESH"]
if not meshes:
    raise RuntimeError("The working scene has no character meshes")

# Character geometry is Z-up in Blender. Bounds are intentionally evaluated
# from the source geometry; the floor below makes any loss of foot contact
# visible in the rendered review rather than being hidden by camera framing.
points = [mesh.matrix_world @ vertex.co for mesh in meshes for vertex in mesh.data.vertices]
lower = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
upper = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
dimensions = upper - lower
center = (lower + upper) * .5 + Vector((0, 0, -dimensions.z * .04))
distance = max(dimensions.z * 2.5, dimensions.x * 2.7)


def aim(object_, location, target):
    object_.location = location
    object_.rotation_euler = (target - location).normalized().to_track_quat("-Z", "Y").to_euler()


def add_light(name, location, power, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = "DISK"
    data.size = size
    object_ = bpy.data.objects.new(name, data)
    scene.collection.objects.link(object_)
    aim(object_, location, center)


camera_data = bpy.data.cameras.new("Mixamo Air Squat Review Camera")
camera_data.lens = 54
camera = bpy.data.objects.new("Mixamo Air Squat Review Camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1080
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new('Mixamo Air Squat Review World')
scene.world.color = (0.925, 0.95, 0.91)
add_light("Mixamo Air Squat Key", center + Vector((-distance * .38, -distance * .55, dimensions.z * .55)), 1150, 4.5)
add_light("Mixamo Air Squat Fill", center + Vector((distance * .42, distance * .35, dimensions.z * .28)), 500, 3.5)

floor_z = lower.z
floor_size = max(dimensions.z, dimensions.x) * 1.45
floor_mesh = bpy.data.meshes.new("Mixamo Air Squat Review Floor")
floor_mesh.from_pydata([(-floor_size, -floor_size, floor_z), (floor_size, -floor_size, floor_z), (floor_size, floor_size, floor_z), (-floor_size, floor_size, floor_z)], [], [[0, 1, 2, 3]])
floor = bpy.data.objects.new("Mixamo Air Squat Review Floor", floor_mesh)
scene.collection.objects.link(floor)
floor_material = bpy.data.materials.new("Mixamo Air Squat Review Floor Material")
floor_material.diffuse_color = (0.91, 0.94, 0.89, 1)
floor_mesh.materials.append(floor_material)

start, end = scene.frame_start, scene.frame_end
bottom = round((start + end) / 2)
half = round((start + bottom) / 2)
keyframes = {
    "standing-front": (start, Vector((0, -distance, 0))),
    "standing-side": (start, Vector((distance, 0, 0))),
    "half-squat-front": (half, Vector((0, -distance, 0))),
    "half-squat-side": (half, Vector((distance, 0, 0))),
    "bottom-side": (bottom, Vector((distance, 0, 0))),
    "bottom-front": (bottom, Vector((0, -distance, 0))),
}
output = ROOT / "artifacts" / f"mixamo-air-squat-{avatar}-keyframes"
output.mkdir(parents=True, exist_ok=True)
for label, (frame, offset) in keyframes.items():
    scene.frame_set(frame)
    aim(camera, center + offset, center)
    scene.render.filepath = str(output / f"{label}.png")
    bpy.ops.render.render(write_still=True)

sequence = ROOT / "artifacts" / f"mixamo-air-squat-{avatar}-frames"
if os.environ.get("TELO_MIXAMO_AIR_SQUAT_KEYFRAMES_ONLY") != "1":
    sequence.mkdir(parents=True, exist_ok=True)
    scene.render.resolution_x = 420
    scene.render.resolution_y = 420
    aim(camera, center + Vector((0, -distance, 0)), center)
    # The terminal frame repeats the standing pose; omit it from the GIF.
    for frame in range(start, end):
        scene.frame_set(frame)
        scene.render.filepath = str(sequence / f"frame-{frame:03d}.png")
        bpy.ops.render.render(write_still=True)

scene.frame_set(start)
print("TELO_MIXAMO_AIR_SQUAT_RENDER=" + str({"avatar": avatar, "keyframes": str(output), "sequence": str(sequence) if sequence.is_dir() else None, "floorZ": round(floor_z, 6), "frames": [start, end]}))
