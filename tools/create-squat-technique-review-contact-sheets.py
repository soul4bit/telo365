"""Create compact phase maps for the independent Air Squat review package.

The source review PNGs remain the authoritative full-resolution frames. These
contact sheets only make it easier to choose the right files for ChatGPT.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "artifacts" / "squat-technique-review"
PHASES = ("standing", "descent-start", "half-squat", "bottom", "return-to-standing")
VIEWS = ("front", "side")
TILE = 360
LABEL_HEIGHT = 38
font = ImageFont.load_default()

for avatar in ("male", "female"):
    source = OUTPUT / avatar / "control-frames"
    sheet = Image.new("RGB", (TILE * len(PHASES), (TILE + LABEL_HEIGHT) * len(VIEWS)), "#f7faf5")
    draw = ImageDraw.Draw(sheet)
    for row, view in enumerate(VIEWS):
        for column, phase in enumerate(PHASES):
            image = Image.open(source / f"{phase}-{view}.png").convert("RGB")
            image.thumbnail((TILE, TILE), Image.Resampling.LANCZOS)
            x, y = column * TILE, row * (TILE + LABEL_HEIGHT)
            sheet.paste(image, (x + (TILE - image.width) // 2, y + (TILE - image.height) // 2))
            draw.rectangle((x, y + TILE, x + TILE, y + TILE + LABEL_HEIGHT), fill="#eaf3e7")
            draw.text((x + 10, y + TILE + 12), f"{phase} · {view}", fill="#315333", font=font)
    target = OUTPUT / avatar / f"{avatar}-phase-contact-sheet.png"
    sheet.save(target, optimize=True)
    print(target)
