
import bpy
import json
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_BLEND = os.path.join(ROOT, "assets-work", "telo-trainer-male-rig-working.blend")
OUT_GLB = os.path.join(ROOT, "assets-work", "telo-trainer-male-rig-preview.glb")
OUT_RENDERS = os.path.join(ROOT, "artifacts", "male-rig-control-poses")
os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
os.makedirs(OUT_RENDERS, exist_ok=True)

source_collection = bpy.data.collections.get("Body Male - Realistic")
source_body = bpy.data.objects.get("GEO-body_male_realistic")
if source_collection is None or source_body is None:
    raise RuntimeError("Required Human Base Meshes male source was not found")

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.color = (0.055, 0.075, 0.055)

working_collection = bpy.data.collections.new("TELO Male Rig Working")
scene.collection.children.link(working_collection)

# This source copy preserves the actual official base mesh and UVs.
body = source_body.copy()
body.data = source_body.data.copy()
body.data.name = "TELO_Trainer_Male_Mesh"
for modifier in list(body.modifiers):
    body.modifiers.remove(modifier)
body.name = "TELO_Trainer_Male_Body"
body.location = (0.0, 0.0, 0.0)
body.rotation_euler = (0.0, 0.0, 0.0)
body.scale = (1.0, 1.0, 1.0)
working_collection.objects.link(body)

# Copy the matching official eyes and rebase from source body coordinates.
# The body asset is self-contained for this stage. Its separate eye objects are
# not skinned in the source bundle and are deliberately excluded from the rig
# candidate instead of being attached with an unverified offset.
eye_sources = []
eye_copies = []
body_source_world = source_body.matrix_world.copy()
for source_eye in eye_sources:
    eye = source_eye.copy()
    eye.data = source_eye.data.copy()
    eye.name = source_eye.name.replace("GEO-body_male_realistic", "TELO_Trainer_Male")
    relative = body_source_world.inverted() @ source_eye.matrix_world
    eye.matrix_world = relative
    working_collection.objects.link(eye)
    eye_copies.append(eye)

# Remove every original object only after the independent data copies exist.
# The source .blend is never saved from this process.
for obj in list(bpy.data.objects):
    if obj not in {body, *eye_copies}:
        bpy.data.objects.remove(obj, do_unlink=True)
for collection in list(bpy.data.collections):
    if collection != working_collection and collection.users == 0:
        bpy.data.collections.remove(collection)

# Intentional preview material: no claim of skin texture or photorealism.
skin = bpy.data.materials.new("TELO preview skin — flat PBR, no texture")
skin.use_nodes = True
principled = skin.node_tree.nodes.get("Principled BSDF")
principled.inputs["Base Color"].default_value = (0.46, 0.235, 0.16, 1.0)
principled.inputs["Roughness"].default_value = 0.58
principled.inputs["Specular IOR Level"].default_value = 0.28
body.data.materials.clear()
body.data.materials.append(skin)

eye_white = bpy.data.materials.new("TELO preview eye white")
eye_white.use_nodes = True
eye_bsdf = eye_white.node_tree.nodes.get("Principled BSDF")
eye_bsdf.inputs["Base Color"].default_value = (0.78, 0.75, 0.68, 1.0)
eye_bsdf.inputs["Roughness"].default_value = 0.38
for copied in eye_copies:
    copied.data.materials.clear()
    copied.data.materials.append(eye_white)

# Build a compact humanoid deformation skeleton. Coordinates are model-local and
# derived from the actual body bounds (z: 0..1.69, x: +/-0.44).
rig_data = bpy.data.armatures.new("TELO_Male_Humanoid_Armature")
rig = bpy.data.objects.new("TELO_Trainer_Male_Rig", rig_data)
working_collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, head, tail, parent=None, connected=False):
    edit = rig_data.edit_bones.new(name)
    edit.head = head
    edit.tail = tail
    edit.use_deform = True
    if parent:
        edit.parent = rig_data.edit_bones.get(parent)
        edit.use_connect = connected
    return edit

bone("Hips", (0, 0.0, 0.83), (0, 0.0, 1.01))
bone("Spine", (0, 0.0, 1.01), (0, 0.0, 1.19), "Hips", True)
bone("Chest", (0, 0.0, 1.19), (0, 0.0, 1.37), "Spine", True)
bone("Neck", (0, -0.005, 1.37), (0, -0.005, 1.51), "Chest", True)
bone("Head", (0, -0.005, 1.51), (0, -0.025, 1.73), "Neck", True)

bone("LeftUpperArm", (-0.18, 0.0, 1.40), (-0.38, 0.0, 1.31), "Chest")
bone("LeftLowerArm", (-0.38, 0.0, 1.31), (-0.54, -0.01, 1.05), "LeftUpperArm", True)
bone("LeftHand", (-0.54, -0.01, 1.05), (-0.61, -0.035, 0.84), "LeftLowerArm", True)

bone("RightUpperArm", (0.18, 0.0, 1.40), (0.38, 0.0, 1.31), "Chest")
bone("RightLowerArm", (0.38, 0.0, 1.31), (0.54, -0.01, 1.05), "RightUpperArm", True)
bone("RightHand", (0.54, -0.01, 1.05), (0.61, -0.035, 0.84), "RightLowerArm", True)

bone("LeftUpperLeg", (-0.105, 0.0, 0.84), (-0.115, 0.01, 0.49), "Hips")
bone("LeftLowerLeg", (-0.115, 0.01, 0.49), (-0.115, 0.005, 0.105), "LeftUpperLeg", True)
bone("LeftFoot", (-0.115, 0.005, 0.105), (-0.115, -0.135, 0.045), "LeftLowerLeg", True)
bone("LeftToe", (-0.115, -0.135, 0.045), (-0.115, -0.22, 0.04), "LeftFoot", True)

bone("RightUpperLeg", (0.105, 0.0, 0.84), (0.115, 0.01, 0.49), "Hips")
bone("RightLowerLeg", (0.115, 0.01, 0.49), (0.115, 0.005, 0.105), "RightUpperLeg", True)
bone("RightFoot", (0.115, 0.005, 0.105), (0.115, -0.135, 0.045), "RightLowerLeg", True)
bone("RightToe", (0.115, -0.135, 0.045), (0.115, -0.22, 0.04), "RightFoot", True)

bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front = True

# Apply automatic weights to the actual source mesh copy.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
try:
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
except RuntimeError as exc:
    raise RuntimeError("Automatic weighting failed: " + str(exc))

# Eyes follow Head rigidly. They are separate source objects and do not need skinning.
for eye in eye_copies:
    eye.parent = rig
    eye.parent_type = 'BONE'
    eye.parent_bone = 'Head'
    eye.matrix_parent_inverse = rig.matrix_world.inverted()

# Validate all core bones received weights before producing test poses.
required = [
    "Hips", "Spine", "Chest", "Neck", "Head",
    "LeftUpperArm", "LeftLowerArm", "LeftHand", "RightUpperArm", "RightLowerArm", "RightHand",
    "LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "RightUpperLeg", "RightLowerLeg", "RightFoot",
]
missing_groups = [name for name in required if body.vertex_groups.get(name) is None]
if missing_groups:
    raise RuntimeError("Automatic weighting omitted required groups: " + ", ".join(missing_groups))

# Floor, lights and camera are non-export preview helpers.
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
floor = bpy.context.object
floor.name = "Preview Floor (not exported)"
floor_mat = bpy.data.materials.new("TELO pale floor")
floor_mat.use_nodes = True
floor_mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.72, 0.79, 0.69, 1)
floor_mat.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = 0.95
floor.data.materials.append(floor_mat)

def make_area(name, location, energy, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    working_collection.objects.link(obj)
    obj.location = location
    return obj

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

key = make_area("Preview Key", (3.0, -4.0, 4.0), 850, 4)
fill = make_area("Preview Fill", (-3.0, -2.0, 2.5), 500, 3)
rim = make_area("Preview Rim", (1.5, 3.0, 3.0), 700, 3)
for light in (key, fill, rim):
    point_at(light, (0, 0, .85))

camera_data = bpy.data.cameras.new("Preview Camera")
camera = bpy.data.objects.new("Preview Camera", camera_data)
working_collection.objects.link(camera)
scene.camera = camera
camera.data.lens = 55
camera.data.sensor_width = 36

def reset_pose():
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = 'XYZ'
        pose_bone.rotation_euler = (0, 0, 0)
        pose_bone.location = (0, 0, 0)
        pose_bone.scale = (1, 1, 1)
    bpy.ops.object.mode_set(mode='OBJECT')

def pose_squat(amount):
    # Rotations are intentionally conservative. The pose images determine whether
    # automatic weighting is acceptable before any squat animation is authored.
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    deg = math.radians
    # Translate the pelvis down and slightly back; keeping it almost upright
    # avoids the reclined, chair-like pose of an FK-only test skeleton.
    rig.pose.bones["Hips"].location = (0.0, 0.14 if amount < 40 else 0.20, -0.16 if amount < 40 else -0.29)
    rig.pose.bones["Spine"].rotation_euler.x = deg(amount * 0.035)
    rig.pose.bones["Chest"].rotation_euler.x = deg(amount * 0.025)
    for side in ("Left", "Right"):
        rig.pose.bones[f"{side}UpperLeg"].rotation_euler.x = deg(-amount)
        rig.pose.bones[f"{side}LowerLeg"].rotation_euler.x = deg(amount * 1.48)
        rig.pose.bones[f"{side}Foot"].rotation_euler.x = deg(-amount * 0.72)
    bpy.ops.object.mode_set(mode='OBJECT')

def pose_arms():
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    deg = math.radians
    rig.pose.bones["LeftUpperArm"].rotation_euler.y = deg(150)
    rig.pose.bones["RightUpperArm"].rotation_euler.y = deg(-150)
    bpy.ops.object.mode_set(mode='OBJECT')

def pose_elbows():
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    deg = math.radians
    # Both mirrored forearm bones flex with the same local X sign. Using
    # opposite signs caused the asymmetric test pose found in the first audit.
    rig.pose.bones["LeftLowerArm"].rotation_euler.x = deg(-70)
    rig.pose.bones["RightLowerArm"].rotation_euler.x = deg(-70)
    bpy.ops.object.mode_set(mode='OBJECT')

def render(label, pose_fn):
    reset_pose()
    pose_fn()
    for view, location in (("front", (1.8, -4.0, 1.7)), ("side", (4.1, 0.0, 1.35))):
        camera.location = location
        point_at(camera, (0, 0, 0.87))
        scene.render.filepath = os.path.join(OUT_RENDERS, f"{label}-{view}.png")
        bpy.ops.render.render(write_still=True)

render("neutral", lambda: None)
render("half-squat", lambda: pose_squat(28))
render("bottom-squat", lambda: pose_squat(55))
render("arms-raised", pose_arms)
render("elbows-bent", pose_elbows)
reset_pose()

# Save a reproducible working scene before exporting.
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, check_existing=False)

# Export only the deforming male body, head-attached eyes and armature.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
for eye in eye_copies:
    eye.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_skins=True,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
)

# Keep the working file on its neutral rest pose after export.
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, check_existing=False)

# Report data required for post-export validation.
groups = {group.name: 0 for group in body.vertex_groups}
for vertex in body.data.vertices:
    for membership in vertex.groups:
        name = body.vertex_groups[membership.group].name
        groups[name] = groups.get(name, 0) + 1
report = {
    "workingBlend": OUT_BLEND,
    "candidateGlb": OUT_GLB,
    "renders": OUT_RENDERS,
    "bodyVertices": len(body.data.vertices),
    "bodyTriangles": sum(len(poly.vertices)-2 for poly in body.data.polygons),
    "uvLayers": [uv.name for uv in body.data.uv_layers],
    "materials": [mat.name for mat in body.data.materials],
    "armatureBones": [bone.name for bone in rig.data.bones],
    "vertexGroupInfluences": groups,
    "missingRequiredGroups": missing_groups,
    "armatureModifiers": [mod.type for mod in body.modifiers if mod.type == 'ARMATURE'],
}
print("TELO_RIG_REPORT=" + json.dumps(report, ensure_ascii=False))
