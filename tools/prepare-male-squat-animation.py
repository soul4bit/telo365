"""Build an isolated, male-only squat asset candidate from the existing rig preview.

This never touches the original Blender Human Base Meshes bundle or production viewer
asset paths. The animation is direct FK with explicit foot-pin corrections, so the
export contains only the deformation rig and named animation tracks.
"""
import bpy
import json
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_OUT = os.path.join(ROOT, "public", "media", "exercises", "models", "telo-trainer-male-rig-test.glb")
ANIMATION_OUT = os.path.join(ROOT, "public", "media", "exercises", "animations", "male", "squat-test.glb")
WORKING_OUT = os.path.join(ROOT, "assets-work", "telo-trainer-male-squat-animation-working.blend")
RENDER_DIR = os.path.join(ROOT, "artifacts", "male-squat-keyframes")
VIDEO_OUT = os.path.join(ROOT, "artifacts", "male-squat-preview.mp4")
for path in (os.path.dirname(MODEL_OUT), os.path.dirname(ANIMATION_OUT), os.path.dirname(WORKING_OUT), RENDER_DIR):
    os.makedirs(path, exist_ok=True)

scene = bpy.context.scene
rig = bpy.data.objects.get("TELO_Trainer_Male_Rig")
body = bpy.data.objects.get("TELO_Trainer_Male_Body")
camera = bpy.data.objects.get("Preview Camera")
if rig is None or body is None or camera is None:
    raise RuntimeError("Working male rig scene is missing body, armature or preview camera")

required = [
    "Hips", "Spine", "Chest", "Neck", "Head",
    "LeftUpperArm", "LeftLowerArm", "LeftHand",
    "RightUpperArm", "RightLowerArm", "RightHand",
    "LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "LeftToe",
    "RightUpperLeg", "RightLowerLeg", "RightFoot", "RightToe",
]
missing = [name for name in required if rig.data.bones.get(name) is None]
if missing:
    raise RuntimeError("Required deform bones are missing: " + ", ".join(missing))
if not any(mod.type == "ARMATURE" and mod.object == rig for mod in body.modifiers):
    raise RuntimeError("Body is not bound to the armature")

# The candidate contains no helper controls or live constraints. This makes it
# portable: browser playback binds only the baked named bone tracks.
rig.animation_data_clear()
for bone in rig.pose.bones:
    for constraint in list(bone.constraints):
        bone.constraints.remove(constraint)
    bone.rotation_mode = "XYZ"
    bone.location = (0, 0, 0)
    bone.rotation_euler = (0, 0, 0)
    bone.scale = (1, 1, 1)

scene.render.fps = 24
scene.frame_start = 0
scene.frame_end = 96  # Exactly four seconds at 24 fps, standing pose at both ends.
action = bpy.data.actions.new("squat")
rig.animation_data_create()
rig.animation_data.action = action

# Local Hips axes are X=world X, Y=world Z and Z=-world Y. The imported rig has
# a small leg-rest-pose asymmetry, so each sampled frame uses a solved lateral
# correction. The animation is keyed at every frame: no interpolation overshoot
# can pull the feet away from the floor between the deliberate phases.
target_heel = Vector((-0.115, 0.005, 0.105))
target_toe = Vector((-0.115, -0.135, 0.045))
anchors = [
    (0.0, [0.0, 0.0, 0.0, 0.0]),
    (0.8, [-0.104727, -0.074557, math.radians(63.276040), math.radians(-23.304483)]),
    (1.0, [-0.141325, -0.132327, math.radians(71.126466), math.radians(-21.162467)]),
]

def guide_for(progress):
    for (start, first), (end, second) in zip(anchors, anchors[1:]):
        if progress <= end:
            ratio = (progress - start) / (end - start)
            return [left + (right - left) * ratio for left, right in zip(first, second)]
    return anchors[-1][1][:]

def apply_left_leg(values, upper_angle):
    hips_y, hips_z, lower_angle, foot_angle = values
    rig.pose.bones["Hips"].location = (0.0, hips_y, hips_z)
    rig.pose.bones["LeftUpperLeg"].rotation_euler.x = upper_angle
    rig.pose.bones["LeftLowerLeg"].rotation_euler.x = lower_angle
    rig.pose.bones["LeftFoot"].rotation_euler.x = foot_angle
    scene.view_layers[0].update()
    heel = rig.matrix_world @ rig.pose.bones["LeftFoot"].head
    toe = rig.matrix_world @ rig.pose.bones["LeftFoot"].tail
    return heel, toe

def floor_error(values, upper_angle):
    heel, toe = apply_left_leg(values, upper_angle)
    return ((heel.y - target_heel.y) ** 2 + (heel.z - target_heel.z) ** 2 +
            (toe.y - target_toe.y) ** 2 + (toe.z - target_toe.z) ** 2), heel, toe

def solve_leg_for_frame(progress, upper_angle):
    # Keep the solution on the natural bent-knee branch. An unrestricted inverse
    # solve can technically keep the feet still by leaving the knees straight,
    # which would not be an anatomically credible squat.
    values = guide_for(progress)
    guide = values[:]
    spans = [0.025, 0.040, math.radians(14), math.radians(12)]
    bounds = [(guide[index] - spans[index], guide[index] + spans[index]) for index in range(4)]
    steps = [0.008, 0.010, math.radians(3), math.radians(3)]
    for _ in range(120):
        changed = False
        for index in range(4):
            best_error = floor_error(values, upper_angle)[0]
            best_values = values
            for delta in (-steps[index], steps[index]):
                candidate = values[:]
                candidate[index] = min(bounds[index][1], max(bounds[index][0], candidate[index] + delta))
                candidate_error = floor_error(candidate, upper_angle)[0]
                if candidate_error < best_error:
                    best_error = candidate_error
                    best_values = candidate
            if best_values is not values:
                values = best_values
                changed = True
        if not changed:
            steps = [step * 0.55 for step in steps]
        if max(steps) < 0.00001:
            break
    return values, floor_error(values, upper_angle)

sampled_states = []
for frame in range(scene.frame_start, scene.frame_end + 1):
    phase = frame / 48 if frame <= 48 else (96 - frame) / 48
    progress = phase * phase * (3 - 2 * phase)  # smoothstep descent and ascent
    upper_angle = math.radians(-50 * progress)
    values, (_, heel, _) = solve_leg_for_frame(progress, upper_angle)
    # Positive value moves the left leg outward and the right leg outward.
    lateral_offset = heel.x - target_heel.x
    sampled_states.append((frame, progress, values, upper_angle, lateral_offset))

for frame, progress, values, upper_angle, lateral_offset in sampled_states:
    scene.frame_set(frame)
    hips_y, hips_z, lower_angle, foot_angle = values
    hips = rig.pose.bones["Hips"]
    hips.location = (0.0, hips_y, hips_z)
    hips.rotation_euler = (0.0, 0.0, 0.0)
    hips.keyframe_insert(data_path="location", frame=frame)
    hips.keyframe_insert(data_path="rotation_euler", frame=frame)

    # Controlled torso inclination follows the squat without folding the neck.
    for name, degrees in (("Spine", 8.0 * progress), ("Chest", 4.0 * progress), ("Neck", -2.5 * progress)):
        pose = rig.pose.bones[name]
        pose.rotation_euler = (math.radians(degrees), 0.0, 0.0)
        pose.keyframe_insert(data_path="rotation_euler", frame=frame)

    for side, sign in (("Left", -1.0), ("Right", 1.0)):
        upper = rig.pose.bones[f"{side}UpperLeg"]
        upper.location = (sign * lateral_offset, 0.0, 0.0)
        upper.rotation_euler = (upper_angle, 0.0, 0.0)
        upper.keyframe_insert(data_path="location", frame=frame)
        upper.keyframe_insert(data_path="rotation_euler", frame=frame)
        for suffix, angle in (("LowerLeg", lower_angle), ("Foot", foot_angle)):
            pose = rig.pose.bones[f"{side}{suffix}"]
            pose.rotation_euler = (angle, 0.0, 0.0)
            pose.keyframe_insert(data_path="rotation_euler", frame=frame)

    # Neutral arm hang and toes; all resulting tracks are explicit and portable.
    for name in ("LeftUpperArm", "LeftLowerArm", "LeftHand", "RightUpperArm", "RightLowerArm", "RightHand", "LeftToe", "RightToe"):
        pose = rig.pose.bones[name]
        pose.location = (0.0, 0.0, 0.0)
        pose.rotation_euler = (0.0, 0.0, 0.0)
        pose.keyframe_insert(data_path="location", frame=frame)
        pose.keyframe_insert(data_path="rotation_euler", frame=frame)

scene.view_layers[0].update()
initial = {}
for side in ("Left", "Right"):
    foot = rig.pose.bones[f"{side}Foot"]
    initial[side] = {"heel": (rig.matrix_world @ foot.head).copy(), "toe": (rig.matrix_world @ foot.tail).copy()}
slides = {side: {"heel": [], "toe": []} for side in ("Left", "Right")}
root_locations = []
for frame in range(scene.frame_start, scene.frame_end + 1):
    scene.frame_set(frame)
    scene.view_layers[0].update()
    root_locations.append(tuple(round(value, 7) for value in rig.location))
    for side in ("Left", "Right"):
        foot = rig.pose.bones[f"{side}Foot"]
        for label, coordinate in (("heel", foot.head), ("toe", foot.tail)):
            current = rig.matrix_world @ coordinate
            slides[side][label].append((current - initial[side][label]).length)
max_slide = {side: {label: round(max(values), 7) for label, values in labels.items()} for side, labels in slides.items()}
if any(location != (0.0, 0.0, 0.0) for location in root_locations):
    raise RuntimeError("Armature root moved during squat: " + repr(sorted(set(root_locations))))
if max(max(labels.values()) for labels in max_slide.values()) > 0.008:
    raise RuntimeError("Foot slide exceeds 8 mm: " + repr(max_slide))

# Evidence renders are separate artifacts and never shipped by the site.
def point_at(object_, target):
    object_.rotation_euler = (Vector(target) - object_.location).to_track_quat("-Z", "Y").to_euler()

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
phase_frames = {"standing": 0, "half-squat": 24, "bottom": 48}
for label, frame in phase_frames.items():
    scene.frame_set(frame)
    for view, location in (("front", (2.1, -4.5, 1.55)), ("side", (4.5, -0.2, 1.3))):
        camera.location = location
        point_at(camera, (0.0, 0.0, 0.88))
        scene.render.filepath = os.path.join(RENDER_DIR, f"{label}-{view}.png")
        bpy.ops.render.render(write_still=True)

# Restore first standing pose before exporting the static test model. A browser
# preview validates continuity; rendered stills provide the durable evidence.
scene.frame_set(1)
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=MODEL_OUT,
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

# The animation GLB holds only the armature and the squat action. Its track
# names bind to the static test model's bone nodes through AnimationMixer.
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=ANIMATION_OUT,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_animations=True,
    export_force_sampling=True,
    export_animation_mode="ACTIONS",
    export_nla_strips=False,
    export_cameras=False,
    export_lights=False,
    export_materials="NONE",
)

bpy.ops.wm.save_as_mainfile(filepath=WORKING_OUT, check_existing=False)
report = {
    "workingBlend": WORKING_OUT,
    "modelGlb": MODEL_OUT,
    "animationGlb": ANIMATION_OUT,
    "clip": action.name,
    "frameStart": scene.frame_start,
    "frameEnd": scene.frame_end,
    "fps": scene.render.fps,
    "durationSeconds": (scene.frame_end - scene.frame_start) / scene.render.fps,
    "maxFootSlideMeters": max_slide,
    "rootLocations": sorted(set(root_locations)),
    "bones": [bone.name for bone in rig.data.bones],
    "constraintsRemaining": sum(len(pose.constraints) for pose in rig.pose.bones),
    "renders": RENDER_DIR,
    "video": None,
}
print("TELO_SQUAT_REPORT=" + json.dumps(report, ensure_ascii=False))
