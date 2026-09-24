# TELO365 Functional Studio v1 - render specification

This document defines one recognizable virtual studio for every future TELO365 exercise demonstration. It does not change animation, skeletons, source models, or authorize publication of raw GLB/FBX files.

## Current release status

All eight current `squat-*.webm` and matching posters have been rendered in `telo365-functional-studio-v1`. They use video-only delivery; raw GLB/FBX files are still excluded.

The active media manifest declares:

```json
"currentId": "telo365-functional-studio-v1",
"currentBranding": "embedded"
```

`TELO365.RU` is embedded as a physical wall sign in the rendered room and posters. The viewer does not render an HTML/CSS watermark over these assets.

## Canonical scene: `telo365-functional-studio-v1`

A compact, premium functional-training studio for an individual TELO365 workout. It is not a large commercial gym.

- Matte dark rubber flooring: warm graphite, subtle large-tile seams, and a soft contact shadow beneath shoes.
- One contemporary dark-metal rack at the rear; one tidy low dumbbell rack in the background.
- A few kettlebells, one plyometric box, and optionally one exercise ball. Equipment stays at the edge of the composition and never intersects the trainer.
- Warm timber slats as a vertical interior accent, with warm beige or natural stone wall surfaces.
- A large side window or a soft natural daylight source, plus subtle greenery near the window.
- Palette: deep green, muted green, graphite, grey, warm beige, and natural wood.
- Lighting: warm daylight key, light fill, soft realistic shadows. Face, clothing folds, and shoes must remain legible.
- Exclude mirrors with visible reflections, people, posters, external brands, neon, red/blue sports colors, cyberpunk, crowded equipment, and visual noise.

### Physical brand treatment

Use `TELO365.RU` once as subtle dimensional or painted lettering on the rear wall. An alternative is a small print on the visible side of the plyometric box. It must be part of scene geometry/materials and visible in posters; it must not be an HTML/CSS overlay. It cannot overlap the trainer or become the main focus.

## Camera and framing

For one exercise, avatar, and view, camera remains fixed throughout the cycle. Lighting, room layout, materials, trainer appearance, and clothing remain the same across all four views; only camera position changes.

- Trainer occupies about 85-90% of safe frame height, approximately 10-15% larger than legacy v0 framing.
- Keep at least 5% safe margin above the head and below shoes in both standing and bottom positions.
- Do not crop head, hands, feet, shoes, mat, or required equipment.
- No zoom, handheld motion, or camera shake during the exercise.
- `threeQuarter` is the default Air Squat view; it must show hip path, knees, and feet. Strict side remains available for profile checking.
- Male and female views use comparable visual scale and safe margins without scaling their skeletons.

## Render prompt

> Premium compact functional training studio for TELO365, warm daylight from a large side window, graphite rubber gym floor with subtle tile seams, one modern dark metal squat rack, a tidy dumbbell rack, three kettlebells, one wooden plyometric box, subtle warm wooden slats, a small plant, dark green graphite warm beige natural material palette, soft realistic shadows, calm high-end wellness fitness aesthetic. One subtle physical `TELO365.RU` wall lettering in the far background, part of the room, not an overlay. No people in background, no mirrors, no posters, no external logos, no neon, no cyberpunk, no crowded commercial gym. Static camera, full-body trainer, head and shoes fully visible throughout the air-squat loop, 5% safe margins.

For each view append only: `front view`, `strict side view`, `back view`, or `three-quarter view`. Do not change the room, equipment layout, materials, lighting, clothing, or trainer appearance between renders.

## Air Squat output files

Render only from approved local sources and export final video. `public` receives WebM and posters only; it never receives GLB, FBX, skeletons, or animation clips.

```
public/media/exercises/videos/squat-male-front.webm
public/media/exercises/videos/squat-male-side.webm
public/media/exercises/videos/squat-male-back.webm
public/media/exercises/videos/squat-male-three-quarter.webm
public/media/exercises/videos/squat-female-front.webm
public/media/exercises/videos/squat-female-side.webm
public/media/exercises/videos/squat-female-back.webm
public/media/exercises/videos/squat-female-three-quarter.webm

public/media/exercises/posters/squat-male-front.png
public/media/exercises/posters/squat-male-side.png
public/media/exercises/posters/squat-male-back.png
public/media/exercises/posters/squat-male-three-quarter.png
public/media/exercises/posters/squat-female-front.png
public/media/exercises/posters/squat-female-side.png
public/media/exercises/posters/squat-female-back.png
public/media/exercises/posters/squat-female-three-quarter.png
```

Use VP9 WebM, 900x900 or another consistent square format, 30 fps or higher, original Mixamo speed at 1x, and a seamless loop with no phase loss. Each poster is the natural standing frame of its matching view.

## Acceptance checklist

1. Every view in the series uses the same room, light, and equipment layout.
2. `TELO365.RU` is physically visible once in scene and no viewer overlay remains.
3. The full trainer fits in standing and bottom positions.
4. There is no cropped shoe, clipped head, blown-out white clothing, or unreadable shadow.
5. The media manifest lists only actually exported `gender x angle` assets; UI does not show missing controls.
6. After replacement, run `npm run verify:squat-video-release`, `npm run verify:public-assets`, build, and browser checks for desktop, mobile, and reduced motion.
7. `specialistTechniqueReview` remains `pending` until a documented specialist conclusion exists.
