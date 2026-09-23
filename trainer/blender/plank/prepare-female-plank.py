# Blender 5.2+ template for TELO365 plank (female)
# This template intentionally DOES NOT create an animation or GLB.
# Create and review real key poses before calling export_animation_glb.
import bpy
from pathlib import Path
import sys
def find_repo_root():
    for parent in Path(__file__).resolve().parents:
        if (parent / 'tools' / 'trainer' / 'exercise_animation_pipeline.py').is_file():
            return parent
    raise RuntimeError('TELO365 repository root was not found.')
sys.path.append(str(find_repo_root() / 'tools' / 'trainer'))
from exercise_animation_pipeline import assert_canonical_rig, assert_authored_action, assert_loop, export_animation_glb

EXERCISE_ID = 'plank'
AVATAR = 'female'
# Open the canonical working .blend for the selected avatar. Never modify its armature topology.
# After authoring/retargeting motion, set RIG_NAME and ACTION_NAME and uncomment the export block.
RIG_NAME = 'TeloTrainerRig'
ACTION_NAME = EXERCISE_ID
OUTPUT = find_repo_root() / 'public/media/exercises/animations/female/plank.glb'

raise RuntimeError(
    'No authored motion has been created. Create real plank key poses, manually review technique, then use the pipeline helper to export.'
)

# rig = bpy.data.objects[RIG_NAME]
# assert_canonical_rig(rig)
# action = bpy.data.actions[ACTION_NAME]
# assert_authored_action(action, EXERCISE_ID)
# assert_loop(action)  # only for cyclic movements
# export_animation_glb(rig, action, OUTPUT, EXERCISE_ID)
