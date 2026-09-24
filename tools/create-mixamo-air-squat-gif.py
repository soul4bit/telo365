"""Create an inspectable GIF from original Mixamo Air Squat review frames.

Pillow is used only by the asset-authoring environment; no GIF is placed in the
web bundle.
"""
from pathlib import Path
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) != 1 or args[0] not in {"male", "female"}:
    raise RuntimeError("Pass male or female after --")
avatar = args[0]
frames_path = ROOT / "artifacts" / f"mixamo-air-squat-{avatar}-frames"
frames = sorted(frames_path.glob("frame-*.png"))
if not frames:
    raise RuntimeError(f"No rendered Air Squat frames in {frames_path}")
images = [Image.open(frame).convert("P", palette=Image.Palette.ADAPTIVE) for frame in frames]
output = ROOT / "artifacts" / f"mixamo-air-squat-{avatar}.gif"
images[0].save(output, save_all=True, append_images=images[1:], duration=1000 // 24, loop=0, disposal=2, optimize=False)
print(f"TELO_MIXAMO_AIR_SQUAT_GIF={output} bytes={output.stat().st_size} frames={len(frames)}")
