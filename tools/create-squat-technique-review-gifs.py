"""Create review-only GIF loops from deterministic browser PNG samples.

The original Mixamo clip is 2.375 seconds. 72 samples are retained with a
distributed 30/40 ms GIF cadence (2.380 s, about 30.25 fps), the closest
centisecond GIF duration while staying at or above 30 fps. No GLB is read or
modified here.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "artifacts" / "squat-technique-review"
VIEWS = ("front", "side", "back", "three-quarter")
AVATARS = ("male", "female")
FRAME_COUNT = 72
SOURCE_DURATION_MS = 2375
# GIF stores centisecond frame delays. 2,375 ms cannot be expressed exactly;
# 2,380 ms is the closest duration that keeps the 72 supplied samples at
# >=30 fps. A distributed 30/40 ms cadence preserves the original time span.
ENCODED_DURATION_MS = round(SOURCE_DURATION_MS / 10) * 10


def frame_delays() -> list[int]:
    boundaries = [round((index + 1) * ENCODED_DURATION_MS / FRAME_COUNT / 10) * 10 for index in range(FRAME_COUNT)]
    return [boundaries[0], *[current - previous for previous, current in zip(boundaries, boundaries[1:])]]


GIF_DELAYS = frame_delays()

result: dict[str, object] = {
    "encoder": "tools/create-squat-technique-review-gifs.py",
    "format": "GIF",
    "sourceDurationMilliseconds": SOURCE_DURATION_MS,
    "encodedDurationMilliseconds": ENCODED_DURATION_MS,
    "frameDelaysMilliseconds": sorted(set(GIF_DELAYS)),
    "nominalFps": round(FRAME_COUNT / (ENCODED_DURATION_MS / 1000), 3),
    "avatars": {},
}

for avatar in AVATARS:
    loops = OUTPUT / avatar / "loops"
    loops.mkdir(parents=True, exist_ok=True)
    rendered: dict[str, object] = {}
    for view in VIEWS:
        source = OUTPUT / avatar / "source-frames" / view
        frames = sorted(source.glob("frame-*.png"))
        if len(frames) != FRAME_COUNT:
            raise RuntimeError(f"{avatar}/{view}: expected {FRAME_COUNT} PNG frames, found {len(frames)}")
        images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE) for path in frames]
        target = loops / f"squat-{avatar}-{view}.gif"
        images[0].save(target, save_all=True, append_images=images[1:], duration=GIF_DELAYS, loop=0, disposal=2, optimize=False)
        stored = Image.open(target)
        rendered[view] = {
            "file": str(target.relative_to(OUTPUT)).replace("\\", "/"),
            "bytes": target.stat().st_size,
            "sourceFrames": len(images),
            "storedGifFrames": stored.n_frames,
        }
    result["avatars"][avatar] = rendered

(OUTPUT / "gif-manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
