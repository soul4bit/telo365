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
