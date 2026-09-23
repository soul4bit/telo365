"""Read-only audit for a TELO365 squat working scene; run with Blender."""
import bpy
import json

report = {
    "file": bpy.data.filepath,
    "objects": [],
    "materials": [],
    "actions": [],
}
for obj in bpy.data.objects:
    entry = {"name": obj.name, "type": obj.type}
    if obj.type == "MESH":
        entry.update({
            "vertices": len(obj.data.vertices),
            "triangles": sum(len(poly.vertices) - 2 for poly in obj.data.polygons),
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "armatureModifiers": [modifier.object.name if modifier.object else None for modifier in obj.modifiers if modifier.type == "ARMATURE"],
            "vertexGroups": len(obj.vertex_groups),
        })
    elif obj.type == "ARMATURE":
        entry["bones"] = [bone.name for bone in obj.data.bones]
    report["objects"].append(entry)
for material in bpy.data.materials:
    report["materials"].append({"name": material.name, "nodes": material.use_nodes})
for action in bpy.data.actions:
    report["actions"].append({"name": action.name, "frameRange": list(action.frame_range)})
print("TELO_VISUAL_AUDIT=" + json.dumps(report, ensure_ascii=False))
