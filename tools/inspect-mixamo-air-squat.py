import bpy, json, sys
from pathlib import Path

path=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(path), use_anim=True, automatic_bone_orientation=False)
objs=list(bpy.context.scene.objects)
rigs=[o for o in objs if o.type=='ARMATURE']
meshes=[o for o in objs if o.type=='MESH']
rig=rigs[0] if len(rigs)==1 else None
action=(rig.animation_data.action if rig and rig.animation_data else None)
scene=bpy.context.scene
frames=[]
if action:
  lo,hi=(round(v) for v in action.frame_range)
  for f in sorted({lo,round((lo+hi)/2),hi}):
    scene.frame_set(f); bpy.context.view_layer.update()
    floor=min((o.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
    hips=rig.pose.bones.get(next((b.name for b in rig.pose.bones if b.name.endswith(':Hips') or b.name.endswith('Hips')),''))
    frames.append({'frame':f,'floorZ':floor,'hipsLocation':list(hips.location) if hips else None})
report={'file':str(path),'objects':[(o.name,o.type) for o in objs], 'armature':rig.name if rig else None,'bones':len(rig.data.bones) if rig else 0,'action':action.name if action else None,'range':list(action.frame_range) if action else None,'fcurves':sum(len(layer.strips[0].channelbags[0].fcurves) for layer in action.layers if layer.strips and layer.strips[0].channelbags) if action else 0,'meshes':[{'name':m.name,'triangles':sum(len(p.vertices)-2 for p in m.data.polygons),'uvs':len(m.data.uv_layers),'mats':[x.name for x in m.data.materials],'skin':any(mod.type=='ARMATURE' and mod.object==rig for mod in m.modifiers),'vertexGroups':len(m.vertex_groups)} for m in meshes],'rigTransform':{'location':list(rig.location),'rotation':list(rig.rotation_euler),'scale':list(rig.scale)} if rig else None,'frames':frames}
print('TELO_AIR_SQUAT_FBX='+json.dumps(report,ensure_ascii=False))
