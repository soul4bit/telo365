"""Audit the original Mixamo Air Squat working scene without modifying it.

Usage:
  blender -b assets-work/mixamo-male-air-squat-combined-working.blend \
    -P tools/audit-mixamo-air-squat-combined.py -- male
"""
import json
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) != 1 or args[0] not in {"male", "female"}:
    raise RuntimeError("Pass male or female after --")
avatar = args[0]
scene = bpy.context.scene
rigs = [obj for obj in scene.objects if obj.type == "ARMATURE"]
if len(rigs) != 1:
    raise RuntimeError(f"Expected one imported Mixamo armature, found {len(rigs)}")
rig = rigs[0]
action = rig.animation_data.action if rig.animation_data else None
if action is None:
    raise RuntimeError("The imported Mixamo rig has no active Air Squat action")
prefix = "mixamorig7:" if avatar == "male" else "mixamorig6:"
needed = {"hips": prefix + "Hips", "leftFoot": prefix + "LeftFoot", "rightFoot": prefix + "RightFoot"}
if any(rig.pose.bones.get(name) is None for name in needed.values()):
    raise RuntimeError("The expected Mixamo Hips and feet are missing")
meshes = [obj for obj in scene.objects if obj.type == "MESH"]

records = []
for frame in range(scene.frame_start, scene.frame_end + 1):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    positions = {label: tuple((rig.matrix_world @ rig.pose.bones[name].head)) for label, name in needed.items()}
    floor = min((mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world @ vertex.co).z for mesh in meshes for vertex in mesh.data.vertices)
    records.append({"frame": frame, **positions, "floorZ": floor})

def spread(label):
    return {
        axis: round(max(item[label][index] for item in records) - min(item[label][index] for item in records), 7)
        for index, axis in enumerate("XYZ")
    }

first, last = records[0], records[-1]
report = {
    "avatar": avatar,
    "action": action.name,
    "frames": [scene.frame_start, scene.frame_end],
    "floorZ": {"min": round(min(item["floorZ"] for item in records), 7), "max": round(max(item["floorZ"] for item in records), 7)},
    "footTravel": {"left": spread("leftFoot"), "right": spread("rightFoot")},
    "hipsTravel": spread("hips"),
    "terminalPoseDelta": {
        label: round(max(abs(first[label][index] - last[label][index]) for index in range(3)), 8)
        for label in ("hips", "leftFoot", "rightFoot")
    },
    "constraintsRemaining": sum(len(bone.constraints) for bone in rig.pose.bones),
    "interpretation": "Structural source-FBX audit only; it is not specialist technique approval.",
}
print("TELO_MIXAMO_AIR_SQUAT_AUDIT=" + json.dumps(report, ensure_ascii=False))
