"""Export original Adobe Mixamo Air Squat FBX files as isolated combined GLB candidates.

Each source FBX already contains its matching character and an authored Mixamo
Air Squat action. This tool imports one source FBX into an empty Blender 5.2
scene, preserves its Mixamo skeleton / bind pose / weights / keyframes, and
exports one GLB containing both the textured SkinnedMesh character and `squat`.

No TELO365 19-bone clip is imported, retargeted, or used by this tool.

Usage:
  blender -b -P tools/prepare-mixamo-air-squat-combined.py -- male
  blender -b -P tools/prepare-mixamo-air-squat-combined.py -- female
"""
import hashlib
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
MAX_WEB_TEXTURE_EDGE = 1024
AVATARS = {
    "male": {
        "label": "CH08_NONPBR",
        "source": ROOT / "assets-source/external-characters/mixamo-male/animations/Air Squat.fbx",
        "working": ROOT / "assets-work/mixamo-male-air-squat-combined-working.blend",
        "output": ROOT / "assets-work/mixamo-review/models/mixamo-male-air-squat-combined-test.glb",
        "prefix": "mixamorig7:",
    },
    "female": {
        "label": "Jody",
        "source": ROOT / "assets-source/external-characters/mixamo-female/animations/Air Squat Bent Arms.fbx",
        "working": ROOT / "assets-work/mixamo-female-air-squat-combined-working.blend",
        "output": ROOT / "assets-work/mixamo-review/models/mixamo-female-air-squat-combined-test.glb",
        "prefix": "mixamorig6:",
    },
}


def avatar_from_args():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 1 or args[0] not in AVATARS:
        raise RuntimeError("Pass exactly one avatar after --: male or female")
    return args[0]


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def imported_objects(before):
    return [obj for obj in bpy.context.scene.objects if obj.name not in before]


def texture_nodes(meshes):
    seen = set()
    for material in {material for mesh in meshes for material in mesh.data.materials if material}:
        if not material.use_nodes or not material.node_tree:
            continue
        for node in material.node_tree.nodes:
            image = node.image if node.type == "TEX_IMAGE" else None
            if image is None or image.name in seen:
                continue
            seen.add(image.name)
            yield image


def optimize_working_copy_textures(meshes):
    """Keep source materials/UVs, downscale packed working-copy textures only."""
    optimized = []
    for image in texture_nodes(meshes):
        width, height = image.size
        if max(width, height) <= MAX_WEB_TEXTURE_EDGE:
            continue
        ratio = MAX_WEB_TEXTURE_EDGE / max(width, height)
        target = (max(1, round(width * ratio)), max(1, round(height * ratio)))
        image.scale(*target)
        image.pack()
        optimized.append({"image": image.name, "from": [width, height], "to": list(target)})
    return optimized


def find_action(rig):
    action = rig.animation_data.action if rig.animation_data else None
    if action is None:
        actions = list(bpy.data.actions)
        if len(actions) == 1:
            action = actions[0]
    if action is None:
        raise RuntimeError("The imported FBX does not contain an active animation Action")
    return action


def require_source(rig, meshes, action, prefix):
    if len(rig.data.bones) < 60:
        raise RuntimeError(f"Expected a full Mixamo skeleton, received {len(rig.data.bones)} bones")
    if rig.pose.bones.get(prefix + "Hips") is None:
        raise RuntimeError(f"Expected {prefix}Hips in the imported Mixamo skeleton")
    missing = [mesh.name for mesh in meshes if not any(mod.type == "ARMATURE" and mod.object == rig for mod in mesh.modifiers)]
    if missing:
        raise RuntimeError("Meshes without skinning to the imported rig: " + ", ".join(missing))
    if action.frame_range[1] <= action.frame_range[0]:
        raise RuntimeError(f"Invalid source action frame range: {tuple(action.frame_range)}")


def floor_range(meshes, scene):
    values = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        values.append(min((mesh.evaluated_get(depsgraph).matrix_world @ vertex.co).z for mesh in meshes for vertex in mesh.data.vertices))
    return {"min": round(min(values), 7), "max": round(max(values), 7), "delta": round(max(values) - min(values), 7)}


def terminal_pose_matches(rig, scene):
    first, last = scene.frame_start, scene.frame_end
    snapshots = []
    for frame in (first, last):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        snapshots.append({bone.name: (bone.location.copy(), bone.rotation_quaternion.copy(), bone.scale.copy()) for bone in rig.pose.bones})
    maximum = 0.0
    for name, (location, rotation, scale) in snapshots[0].items():
        other = snapshots[1][name]
        maximum = max(maximum, (location - other[0]).length, rotation.rotation_difference(other[1]).angle, (scale - other[2]).length)
    return {"matches": maximum < 1e-4, "maxPoseDelta": round(maximum, 8)}


def set_selection(rig, meshes):
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig


def export_combined(rig, meshes, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    set_selection(rig, meshes)
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_force_sampling=False,
        export_animation_mode="ACTIONS",
        export_nla_strips=False,
        export_frame_range=True,
        export_skins=True,
        export_morph=True,
        export_cameras=False,
        export_lights=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for part in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def main():
    avatar = avatar_from_args()
    config = AVATARS[avatar]
    if not config["source"].is_file():
        raise RuntimeError(f"Original Air Squat FBX is missing: {config['source']}")

    clean_scene()
    before = {obj.name for obj in bpy.context.scene.objects}
    bpy.ops.import_scene.fbx(filepath=str(config["source"]), use_anim=True, automatic_bone_orientation=False)
    imported = imported_objects(before)
    rigs = [obj for obj in imported if obj.type == "ARMATURE"]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(rigs) != 1 or not meshes:
        raise RuntimeError(f"Expected one armature and skinned meshes, found armatures={len(rigs)}, meshes={len(meshes)}")
    rig = rigs[0]
    action = find_action(rig)
    require_source(rig, meshes, action, config["prefix"])

    # This only gives the exported clip its canonical exercise identifier;
    # timing, keyframes, root motion and bone transforms remain from Mixamo.
    action.name = "squat"
    rig.animation_data_create()
    rig.animation_data.action = action
    scene = bpy.context.scene
    scene.render.fps = 24
    scene.frame_start = round(action.frame_range[0])
    scene.frame_end = round(action.frame_range[1])
    original_floor = floor_range(meshes, scene)
    loop_boundary = terminal_pose_matches(rig, scene)
    texture_optimization = optimize_working_copy_textures(meshes)

    scene.frame_set(scene.frame_start)
    export_combined(rig, meshes, config["output"])
    config["working"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(config["working"]), check_existing=False)

    triangles = sum(sum(len(polygon.vertices) - 2 for polygon in mesh.data.polygons) for mesh in meshes)
    report = {
        "avatar": avatar,
        "label": config["label"],
        "sourceFbx": str(config["source"]),
        "workingBlend": str(config["working"]),
        "combinedGlb": str(config["output"]),
        "combinedGlbSha256": sha256(config["output"]),
        "boneCount": len(rig.data.bones),
        "skinnedMeshes": len(meshes),
        "triangles": triangles,
        "action": action.name,
        "frameRange": [scene.frame_start, scene.frame_end],
        "durationSeconds": round((scene.frame_end - scene.frame_start) / scene.render.fps, 5),
        "floorZ": original_floor,
        "loopBoundary": loop_boundary,
        "textureOptimization": texture_optimization,
        "retargeting": "none — original Mixamo With Skin Air Squat FBX",
    }
    print("TELO_MIXAMO_AIR_SQUAT_COMBINED=" + json.dumps(report, ensure_ascii=False))


main()
