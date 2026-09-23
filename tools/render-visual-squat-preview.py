"""Render a review-only loop sequence from a TELO365 visual squat candidate.

The exported files live in artifacts/ and are never used by the web app.
Run this with Blender 5.2 or newer, for example:

  blender -b assets-work/telo-trainer-male-squat-visual-working.blend \
    -P tools/render-visual-squat-preview.py -- male
"""
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AVATAR = next((value for value in sys.argv[sys.argv.index("--") + 1:]
               if value in {"male", "female"}), None) if "--" in sys.argv else None
if AVATAR not in {"male", "female"}:
    raise RuntimeError("Pass an avatar after --: male or female")

scene = bpy.context.scene
camera = bpy.data.objects.get("Preview Camera")
if camera is None:
    raise RuntimeError("The visual candidate scene does not contain Preview Camera")

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

output = os.path.join(ROOT, "artifacts", f"{AVATAR}-visual-squat-preview-frames")
os.makedirs(output, exist_ok=True)
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 360
scene.render.resolution_y = 360
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
camera.location = (3.9, -4.2, 1.45)
point_at(camera, (0.0, 0.0, 0.75))

# 24 fps source action; one complete 0..95 cycle without duplicating frame 96.
for frame in range(0, 96):
    scene.frame_set(frame)
    scene.render.filepath = os.path.join(output, f"frame-{frame:03d}.png")
    bpy.ops.render.render(write_still=True)

scene.frame_set(0)
print(f"TELO_VISUAL_SQUAT_SEQUENCE={output}")
