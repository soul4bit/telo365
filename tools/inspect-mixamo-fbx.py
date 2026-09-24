"""Inspect a local Mixamo FBX without modifying it.

Run with Blender in background mode:
  blender -b -P tools/inspect-mixamo-fbx.py -- assets-source/.../character.fbx

The report is intentionally structural. It records the actual imported meshes,
materials, textures, armature and skinning data before a review candidate is made.
"""
import json
import os
import sys

import bpy


def mesh_triangles(mesh):
    return sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)


def material_report(material):
    images = []
    if material and material.use_nodes and material.node_tree:
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                images.append({
                    "name": node.image.name,
                    "filepath": bpy.path.abspath(node.image.filepath),
                    "packed": bool(node.image.packed_file),
                    "size": list(node.image.size),
                })
    return {
        "name": material.name if material else None,
        "useNodes": bool(material and material.use_nodes),
        "images": images,
    }


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(args) != 1:
        raise RuntimeError("Pass exactly one FBX path after --")
    source = os.path.abspath(args[0])
    if not os.path.isfile(source):
        raise RuntimeError(f"FBX is missing: {source}")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=source, use_anim=False, automatic_bone_orientation=False)
    bpy.context.view_layer.update()

    objects = list(bpy.context.scene.objects)
    armatures = [object_ for object_ in objects if object_.type == "ARMATURE"]
    meshes = [object_ for object_ in objects if object_.type == "MESH"]
    skinned = []
    for object_ in meshes:
        modifiers = [modifier for modifier in object_.modifiers if modifier.type == "ARMATURE"]
        skin_groups = [group.name for group in object_.vertex_groups]
        if modifiers or skin_groups:
            skinned.append({
                "name": object_.name,
                "armatureModifiers": [modifier.object.name if modifier.object else None for modifier in modifiers],
                "vertexGroupCount": len(skin_groups),
                "vertexGroups": skin_groups,
            })

    report = {
        "source": source,
        "objects": [{"name": object_.name, "type": object_.type} for object_ in objects],
        "meshCount": len(meshes),
        "meshes": [{
            "name": object_.name,
            "vertices": len(object_.data.vertices),
            "triangles": mesh_triangles(object_.data),
            "uvLayers": len(object_.data.uv_layers),
            "materials": [material_report(material) for material in object_.data.materials],
            "bounds": [round(value, 5) for value in object_.dimensions],
        } for object_ in meshes],
        "triangleCount": sum(mesh_triangles(object_.data) for object_ in meshes),
        "armatures": [{
            "name": armature.name,
            "boneCount": len(armature.data.bones),
            "bones": [bone.name for bone in armature.data.bones],
            "rootBones": [bone.name for bone in armature.data.bones if bone.parent is None],
            "bounds": [round(value, 5) for value in armature.dimensions],
        } for armature in armatures],
        "skinnedMeshes": skinned,
        "floorMinZ": round(min((object_.matrix_world @ vertex.co).z for object_ in meshes for vertex in object_.data.vertices), 5) if meshes else None,
    }
    print("TELO_MIXAMO_FBX_REPORT=" + json.dumps(report, ensure_ascii=False))


main()
