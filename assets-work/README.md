# TELO365 — male trainer rig candidate

This folder contains a **pre-animation candidate**, prepared from the official
`Body Male - Realistic` mesh in `assets-source/human_base_meshes_bundle.blend`.
The source bundle is not modified by the preparation script.

## Files

- `telo-trainer-male-rig-working.blend` — editable Blender 5.2.2 working scene.
- `telo-trainer-male-rig-preview.glb` — separate validation export. It must not
  replace `public/media/exercises/models/telo-trainer-male.glb` yet.
- `../tools/prepare-male-trainer-rig.py` — reproducibly creates this candidate
  from the source bundle.

## Verified structure

- Base body: 10,582 vertices and 21,160 triangles; `UVMap` retained.
- GLB: one `SkinnedMesh`, 21,160 triangles, 19 deform bones, normalized four
  influences per exported vertex, and non-singular bind matrices.
- No exercise animation is included.
- Material is a neutral flat PBR preview material only. It has no skin texture,
  clothing, or claim of photorealism.

## Skeleton

`Hips` → `Spine` → `Chest` → `Neck` → `Head`; upper/lower arm and hand chains;
upper/lower leg, foot and toe chains on both sides. The exact bone names are
compatible with the TELO365 asset-verification convention.

## Visual validation status

Control-pose renders are regenerated in
`artifacts/male-rig-control-poses/`: neutral, half squat, bottom squat, raised
arms and elbow flexion from front and side views. They show continuous mesh
deformation without a geometry split. The automatic weights still need manual
artist review around mirrored elbow behaviour and shoulder volume before any
squat clip can be called technically verified.

The candidate is intentionally not wired into the workout execution UI and no
exercise or trainer avatar is marked `verified`.

## First exercise test candidate: male squat

`telo-trainer-male-squat-animation-working.blend` is a separate working file
for the first exercise only. It does not modify the source bundle or replace a
production asset.

- `public/media/exercises/models/telo-trainer-male-rig-test.glb` is the
  skinned male test model.
- `public/media/exercises/animations/male/squat-test.glb` contains the separate
  four-second `squat` clip.
- `tools/prepare-male-squat-animation.py` regenerates both files and the
  front/side key-pose renders under `artifacts/male-squat-keyframes/`.
- `scripts/verify-male-squat-candidate.mjs` checks the model, skin attributes,
  bone names, AnimationMixer bindings, duration and loop boundary.

The exported candidate contains one SkinnedMesh with 21,160 triangles, a
19-bone deformation skeleton and 57 animation tracks. The armature object is
stationary, there are no exported constraints or control bones, heel travel is
below 0.8 mm and toe travel below 5.2 mm across the sampled cycle. The small
toe value is lateral movement from the source rig's rest-pose asymmetry.

This is a technical candidate, not a verified coaching demonstration. It has
no clothing or skin textures, the movement has not received a coach's motion
review and `src/exercise3d.ts` deliberately continues to keep every avatar and
exercise unverified.
