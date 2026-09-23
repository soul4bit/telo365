"""Build a visual-only TELO365 squat candidate from an existing working scene.

The script never rewrites an input .blend, canonical test GLB or animation GLB.
It derives garment shells from the supplied Human Base Mesh surface, copies the
existing skin weights, and joins the disconnected garment components back into
one SkinnedMesh for the existing React Three Fiber pipeline.

Run:
  blender -b assets-work/telo-trainer-male-squat-animation-working.blend \
    -P tools/prepare-visual-squat-candidate.py -- male
"""
import bpy
import json
import os
import sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AVATAR = next((value for value in sys.argv[sys.argv.index("--") + 1:] if value in {"male", "female"}), None) if "--" in sys.argv else None
if AVATAR not in {"male", "female"}:
    raise RuntimeError("Pass an avatar after --: male or female")

CONFIG = {
    "male": {
        "body": "TELO_Trainer_Male_Body",
        "rig": "TELO_Trainer_Male_Rig",
        "working": os.path.join(ROOT, "assets-work", "telo-trainer-male-squat-visual-working.blend"),
        "model": os.path.join(ROOT, "public", "media", "exercises", "models", "telo-trainer-male-visual-test.glb"),
        "renders": os.path.join(ROOT, "artifacts", "male-visual-squat-keyframes"),
        "video": os.path.join(ROOT, "artifacts", "male-visual-squat-preview.mp4"),
        "skin": (0.42, 0.19, 0.11, 1.0),
        "shirt": (0.018, 0.155, 0.085, 1.0),
        "bottoms": (0.012, 0.018, 0.016, 1.0),
        "hair": (0.013, 0.009, 0.007, 1.0),
        "shoe": (0.065, 0.085, 0.085, 1.0),
        "top_low": 0.94,
        "top_high": 1.46,
        "bottom_low": 0.66,
        "bottom_high": 1.08,
        "hair_low": 1.67,
        "body_half_width": 0.255,
    },
    "female": {
        "body": "TELO_Trainer_Female_Body",
        "rig": "TELO_Trainer_Female_Rig",
        "working": os.path.join(ROOT, "assets-work", "telo-trainer-female-squat-visual-working.blend"),
        "model": os.path.join(ROOT, "public", "media", "exercises", "models", "telo-trainer-female-visual-test.glb"),
        "renders": os.path.join(ROOT, "artifacts", "female-visual-squat-keyframes"),
        "video": os.path.join(ROOT, "artifacts", "female-visual-squat-preview.mp4"),
        "skin": (0.48, 0.235, 0.15, 1.0),
        "shirt": (0.07, 0.12, 0.075, 1.0),
        "bottoms": (0.017, 0.022, 0.025, 1.0),
        "hair": (0.018, 0.010, 0.006, 1.0),
        "shoe": (0.20, 0.22, 0.21, 1.0),
        "top_low": 0.92,
        "top_high": 1.37,
        "bottom_low": 0.09,
        "bottom_high": 1.035,
        "hair_low": 1.58,
        "body_half_width": 0.235,
    },
}[AVATAR]

for path in (os.path.dirname(CONFIG["working"]), os.path.dirname(CONFIG["model"]), CONFIG["renders"]):
    os.makedirs(path, exist_ok=True)

body = bpy.data.objects.get(CONFIG["body"])
rig = bpy.data.objects.get(CONFIG["rig"])
if body is None or rig is None or body.type != "MESH" or rig.type != "ARMATURE":
    raise RuntimeError(f"{AVATAR}: working scene does not contain the expected body and rig")
if not any(mod.type == "ARMATURE" and mod.object == rig for mod in body.modifiers):
    raise RuntimeError(f"{AVATAR}: body is not bound to its rig")
if len(rig.data.bones) != 19:
    raise RuntimeError(f"{AVATAR}: unexpected canonical skeleton size")

def material(name, colour, roughness, metallic=0.0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = next((node for node in result.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if shader is None:
        raise RuntimeError("Blender did not create a Principled material node")
    shader.inputs["Base Color"].default_value = colour
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return result

skin = material(f"TELO {AVATAR} skin — procedural PBR", CONFIG["skin"], 0.58)
top_mat = material("TELO sport top — forest green", CONFIG["shirt"], 0.72)
bottom_mat = material("TELO sport bottoms — charcoal", CONFIG["bottoms"], 0.79)
hair_mat = material("TELO hair — dark brown", CONFIG["hair"], 0.66)
shoe_mat = material("TELO training shoes", CONFIG["shoe"], 0.52)

# The base body no longer presents vertex-colour clothing as real garments.
body.data.materials.clear()
body.data.materials.append(skin)
for polygon in body.data.polygons:
    polygon.use_smooth = True

def center_of(poly):
    return sum((body.data.vertices[index].co for index in poly.vertices), Vector()) / len(poly.vertices)

def make_surface_garment(name, predicate, mat, thickness=0.012):
    """Copy selected body surface faces, their weights and make a real shell."""
    selected = [polygon for polygon in body.data.polygons if predicate(center_of(polygon))]
    if not selected:
        raise RuntimeError(f"{AVATAR}: no faces selected for {name}")
    old_indices = sorted({index for polygon in selected for index in polygon.vertices})
    remap = {old: new for new, old in enumerate(old_indices)}
    mesh = bpy.data.meshes.new(name + " geometry")
    mesh.from_pydata([body.data.vertices[index].co.copy() for index in old_indices], [], [[remap[index] for index in polygon.vertices] for polygon in selected])
    mesh.materials.append(mat)
    mesh.update()
    garment = bpy.data.objects.new(name, mesh)
    body.users_collection[0].objects.link(garment)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    # Copy every deform influence before solidifying the outer shell.
    groups = {group.index: garment.vertex_groups.new(name=group.name) for group in body.vertex_groups}
    for new_index, old_index in enumerate(old_indices):
        for assignment in body.data.vertices[old_index].groups:
            groups[assignment.group].add([new_index], assignment.weight, "REPLACE")
    solidify = garment.modifiers.new("TELO garment thickness", "SOLIDIFY")
    solidify.thickness = thickness
    solidify.offset = 1.0
    solidify.use_even_offset = True
    solidify.use_quality_normals = True
    solidify.use_rim = True
    bpy.context.view_layer.objects.active = garment
    garment.select_set(True)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    garment.select_set(False)
    armature = garment.modifiers.new("TELO inherited skin weights", "ARMATURE")
    armature.object = rig
    return garment, len(selected)

def shirt_predicate(point):
    sleeve = CONFIG["top_low"] + 0.17 <= point.z <= CONFIG["top_high"] - 0.03 and CONFIG["body_half_width"] < abs(point.x) <= CONFIG["body_half_width"] + 0.12 and abs(point.y) < 0.16
    torso_width = CONFIG["body_half_width"] + max(0.0, min(0.075, (CONFIG["top_high"] - point.z) * 0.22))
    return CONFIG["top_low"] <= point.z <= CONFIG["top_high"] and (abs(point.x) <= torso_width or sleeve)

def bottoms_predicate(point):
    # Both legs have a centre close to the x-axis; the threshold includes the
    # outer thigh surfaces while excluding bare forearms and torso sides.
    return CONFIG["bottom_low"] <= point.z <= CONFIG["bottom_high"] and abs(point.x) <= 0.29

def shoes_predicate(point):
    return point.z <= 0.16 and point.y <= 0.10 and abs(point.x) <= 0.30

def hair_predicate(point):
    return point.z >= CONFIG["hair_low"] and abs(point.x) <= 0.26

components = []
for name, predicate, mat, thickness in (
    ("TELO sport top", shirt_predicate, top_mat, 0.026),
    ("TELO sport bottoms", bottoms_predicate, bottom_mat, 0.008),
    ("TELO training shoes", shoes_predicate, shoe_mat, 0.019),
    ("TELO hair cap", hair_predicate, hair_mat, 0.010),
):
    component, faces = make_surface_garment(name, predicate, mat, thickness)
    components.append(component)
    component["sourceFaceCount"] = faces


# Joining preserves separate disconnected garment geometry and materials while
# exporting a single SkinnedMesh, as expected by the current candidate verifier.
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
for component in components:
    component.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = CONFIG["body"] + " Visual Candidate"
body["teloVisualCandidate"] = True
body["teloClothingGeometry"] = ["sport top", "sport bottoms", "training shoes", "hair cap"]

if sum(1 for modifier in body.modifiers if modifier.type == "ARMATURE") != 1:
    raise RuntimeError(f"{AVATAR}: visual candidate must retain exactly one armature modifier")
if len(body.vertex_groups) < 19:
    raise RuntimeError(f"{AVATAR}: visual candidate lost deformation groups")

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.world.color = (0.035, 0.05, 0.035)
camera = bpy.data.objects.get("Preview Camera")
if camera is None:
    raise RuntimeError("The squash working scene does not contain Preview Camera")

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

def render(label, frame, location, target):
    scene.frame_set(frame)
    camera.location = location
    point_at(camera, target)
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(CONFIG["renders"], label + ".png")
    bpy.ops.render.render(write_still=True)

render("standing-front", 0, (2.1, -4.5, 1.56), (0.0, 0.0, 0.88))
render("half-squat-side", 24, (4.5, -0.2, 1.3), (0.0, 0.0, 0.74))
render("bottom-side", 48, (4.5, -0.2, 1.24), (0.0, 0.0, 0.66))
render("bottom-front", 48, (2.1, -4.5, 1.36), (0.0, 0.0, 0.68))

# A short visual review artefact; failure to access an encoder does not affect
# the GLB or the technical candidate. Key frames still remain available.
video_created = False
try:
    scene.render.resolution_x = 480
    scene.render.resolution_y = 480
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.audio_codec = "NONE"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.filepath = CONFIG["video"]
    camera.location = (3.9, -4.2, 1.45)
    point_at(camera, (0.0, 0.0, 0.75))
    original_start, original_end = scene.frame_start, scene.frame_end
    scene.frame_start, scene.frame_end = 0, 95
    bpy.ops.render.render(animation=True)
    scene.frame_start, scene.frame_end = original_start, original_end
    video_created = os.path.exists(CONFIG["video"])
except Exception as error:
    print("TELO_VISUAL_VIDEO_SKIPPED=" + str(error))
finally:
    scene.render.image_settings.file_format = "PNG"

scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=CONFIG["working"], check_existing=False)

# Export only the single skinned visual candidate and its unchanged 19-bone rig.
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=CONFIG["model"],
    export_format="GLB",
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
    export_materials="EXPORT",
)

mesh_triangles = sum(len(poly.vertices) - 2 for poly in body.data.polygons)
report = {
    "avatar": AVATAR,
    "workingBlend": CONFIG["working"],
    "modelGlb": CONFIG["model"],
    "animationGlb": os.path.join(ROOT, "public", "media", "exercises", "animations", AVATAR, "squat-test.glb"),
    "skinnedMesh": body.name,
    "trianglesBeforeExport": mesh_triangles,
    "verticesBeforeExport": len(body.data.vertices),
    "materials": [slot.material.name if slot.material else None for slot in body.material_slots],
    "components": body["teloClothingGeometry"],
    "renders": CONFIG["renders"],
    "video": CONFIG["video"] if video_created else None,
    "canonicalRigChanged": False,
    "animationChanged": False,
}
print("TELO_VISUAL_CANDIDATE=" + json.dumps(report, ensure_ascii=False))
