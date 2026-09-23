
import bpy
import json
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_BLEND = os.path.join(ROOT, "assets-work", "telo-trainer-female-rig-working.blend")
OUT_GLB = os.path.join(ROOT, "assets-work", "telo-trainer-female-rig-preview.glb")
OUT_RENDERS = os.path.join(ROOT, "artifacts", "female-rig-control-poses")
os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
os.makedirs(OUT_RENDERS, exist_ok=True)

source_collection = bpy.data.collections.get("Body Female - Realistic")
source_body = bpy.data.objects.get("GEO-body_female_realistic")
if source_collection is None or source_body is None:
    raise RuntimeError("Required Human Base Meshes female source was not found")

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.color = (0.055, 0.075, 0.055)

working_collection = bpy.data.collections.new("TELO Female Rig Working")
scene.collection.children.link(working_collection)

# This source copy preserves the actual official base mesh and UVs.
body = source_body.copy()
body.data = source_body.data.copy()
body.data.name = "TELO_Trainer_Female_Mesh"
for modifier in list(body.modifiers):
    body.modifiers.remove(modifier)
body.name = "TELO_Trainer_Female_Body"
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
    eye.name = source_eye.name.replace("GEO-body_female_realistic", "TELO_Trainer_Female")
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

# Intentional preview material: no skin texture or photorealism. The sport look
# uses one material plus a per-corner colour palette. It keeps the export as one
# mesh primitive / one SkinnedMesh while preserving the source mesh weights.
sport_preview = bpy.data.materials.new("TELO preview sport look - flat PBR")
sport_preview.use_nodes = True
nodes = sport_preview.node_tree.nodes
principled = nodes.get("Principled BSDF")
principled.inputs["Roughness"].default_value = 0.64
principled.inputs["Specular IOR Level"].default_value = 0.22
palette_node = nodes.new("ShaderNodeVertexColor")
palette_node.layer_name = "TELO_Sport_Palette"
sport_preview.node_tree.links.new(palette_node.outputs["Color"], principled.inputs["Base Color"])
body.data.materials.clear()
body.data.materials.append(sport_preview)
palette = body.data.color_attributes.get("TELO_Sport_Palette")
if palette is not None:
    body.data.color_attributes.remove(palette)
palette = body.data.color_attributes.new("TELO_Sport_Palette", "BYTE_COLOR", "CORNER")
# A deliberately simple athletic top and leggings for web preview. They are
# colour regions on the supplied Human Base Mesh, not garment geometry. The
# selected faces retain their existing weights and the glTF stays one primitive.
palette_colors = {
    "skin": (0.46, 0.235, 0.16, 1.0),
    "top": (0.075, 0.27, 0.16, 1.0),
    "leggings": (0.028, 0.105, 0.06, 1.0),
}
sport_faces = {"top": 0, "leggings": 0}
for polygon in body.data.polygons:
    center = polygon.center
    x, y, z = center.x, center.y, center.z
    torso_width = 0.18 + max(0.0, min(0.055, (1.34 - z) * 0.15))
    sleeve = 1.16 <= z <= 1.34 and torso_width < abs(x) <= torso_width + 0.09 and abs(y) < 0.13
    if 1.01 <= z <= 1.39 and (abs(x) <= torso_width or sleeve):
        colour = palette_colors["top"]
        sport_faces["top"] += 1
    elif 0.10 <= z < 1.025 and abs(x) <= 0.245:
        colour = palette_colors["leggings"]
        sport_faces["leggings"] += 1
    else:
        colour = palette_colors["skin"]
    for loop_index in polygon.loop_indices:
        palette.data[loop_index].color = colour
eye_white = bpy.data.materials.new("TELO preview eye white")
eye_white.use_nodes = True
eye_bsdf = eye_white.node_tree.nodes.get("Principled BSDF")
eye_bsdf.inputs["Base Color"].default_value = (0.78, 0.75, 0.68, 1.0)
eye_bsdf.inputs["Roughness"].default_value = 0.38
for copied in eye_copies:
    copied.data.materials.clear()
    copied.data.materials.append(eye_white)

# Build the same canonical 19-bone hierarchy as the male candidate, with joint
# placement fitted to this actual female source mesh (z: .002..1.641, x: +/- .421).
rig_data = bpy.data.armatures.new("TELO_Female_Humanoid_Armature")
rig = bpy.data.objects.new("TELO_Trainer_Female_Rig", rig_data)
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

bone("Hips", (0, 0.0, 0.80), (0, 0.0, 0.96))
bone("Spine", (0, 0.0, 0.96), (0, 0.0, 1.115), "Hips", True)
bone("Chest", (0, 0.0, 1.115), (0, 0.0, 1.29), "Spine", True)
bone("Neck", (0, -0.004, 1.29), (0, -0.004, 1.415), "Chest", True)
bone("Head", (0, -0.004, 1.415), (0, -0.02, 1.67), "Neck", True)

bone("LeftUpperArm", (-0.17, 0.0, 1.315), (-0.345, 0.0, 1.24), "Chest")
bone("LeftLowerArm", (-0.345, 0.0, 1.24), (-0.475, -0.008, 1.02), "LeftUpperArm", True)
bone("LeftHand", (-0.475, -0.008, 1.02), (-0.535, -0.03, 0.84), "LeftLowerArm", True)

bone("RightUpperArm", (0.17, 0.0, 1.315), (0.345, 0.0, 1.24), "Chest")
bone("RightLowerArm", (0.345, 0.0, 1.24), (0.475, -0.008, 1.02), "RightUpperArm", True)
bone("RightHand", (0.475, -0.008, 1.02), (0.535, -0.03, 0.84), "RightLowerArm", True)

bone("LeftUpperLeg", (-0.102, 0.0, 0.81), (-0.11, 0.01, 0.465), "Hips")
bone("LeftLowerLeg", (-0.11, 0.01, 0.465), (-0.11, 0.005, 0.102), "LeftUpperLeg", True)
bone("LeftFoot", (-0.11, 0.005, 0.102), (-0.11, -0.13, 0.04), "LeftLowerLeg", True)
bone("LeftToe", (-0.11, -0.13, 0.04), (-0.11, -0.21, 0.035), "LeftFoot", True)

bone("RightUpperLeg", (0.102, 0.0, 0.81), (0.11, 0.01, 0.465), "Hips")
bone("RightLowerLeg", (0.11, 0.01, 0.465), (0.11, 0.005, 0.102), "RightUpperLeg", True)
bone("RightFoot", (0.11, 0.005, 0.102), (0.11, -0.13, 0.04), "RightLowerLeg", True)
bone("RightToe", (0.11, -0.13, 0.04), (0.11, -0.21, 0.035), "RightFoot", True)

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

# Export only the deforming female body, head-attached eyes and armature.
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
    "colorAttributes": [attribute.name for attribute in body.data.color_attributes],
    "sportFaceCounts": sport_faces,
    "armatureBones": [bone.name for bone in rig.data.bones],
    "vertexGroupInfluences": groups,
    "missingRequiredGroups": missing_groups,
    "armatureModifiers": [mod.type for mod in body.modifiers if mod.type == 'ARMATURE'],
}
print("TELO_RIG_REPORT=" + json.dumps(report, ensure_ascii=False))
