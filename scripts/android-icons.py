#!/usr/bin/env python3
# KS_ANDROID_STAFF_v1 - the Android staff app's launcher icons from one square image (the Keystone icon, or a
# licensee's ANDROID_ICON_URL / DESKTOP_ICON_URL in CI):
#
#   python3 scripts/android-icons.py <icon.png> [android/app/src/main/res]
#
# Writes, for every density: ic_launcher_foreground.png (the adaptive-icon foreground: the image inside Android's
# 66dp safe zone of the 108dp layer, so no launcher mask cuts into it; the background is the brand colour from
# brand.properties) plus the legacy square and round icons. A near-white margin around the image (a web icon's
# padding) is trimmed first. Needs Pillow (pip install pillow).
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}


def trimmed(img: Image.Image) -> Image.Image:
    """Crops a plain near-white (or transparent) margin, keeping the result square."""
    rgba = img.convert("RGBA")
    white = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    diff = ImageChops.difference(rgba, white).convert("L").point(lambda v: 255 if v > 24 else 0)
    alpha = rgba.getchannel("A").point(lambda v: 255 if v > 16 else 0)
    box = ImageChops.multiply(diff, alpha).getbbox() or (0, 0, *rgba.size)
    x0, y0, x1, y1 = box
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = side // 2
    return rgba.crop((cx - half, cy - half, cx - half + side, cy - half + side))


def transparent_corners(img: Image.Image) -> Image.Image:
    """Makes a near-white background around a rounded-square icon transparent (flood fill from the corners)."""
    out = img.copy()
    w, h = out.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        r, g, b, a = out.getpixel(seed)
        if a > 16 and min(r, g, b) > 230:
            ImageDraw.floodfill(out, seed, (255, 255, 255, 0), thresh=40)
    return out


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: android-icons.py <icon.png> [res dir]")
    source = transparent_corners(trimmed(Image.open(sys.argv[1])))
    res = Path(sys.argv[2] if len(sys.argv) > 2 else "android/app/src/main/res")
    for name, scale in DENSITIES.items():
        folder = res / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)
        layer = round(108 * scale)
        inner = round(66 * scale)
        fg = Image.new("RGBA", (layer, layer), (0, 0, 0, 0))
        fg.alpha_composite(source.resize((inner, inner), Image.LANCZOS), ((layer - inner) // 2, (layer - inner) // 2))
        fg.save(folder / "ic_launcher_foreground.png", optimize=True)
        legacy = round(48 * scale)
        square = source.resize((legacy, legacy), Image.LANCZOS)
        square.save(folder / "ic_launcher.png", optimize=True)
        mask = Image.new("L", (legacy, legacy), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, legacy - 1, legacy - 1), fill=255)
        round_icon = Image.new("RGBA", (legacy, legacy), (0, 0, 0, 0))
        round_icon.paste(square, (0, 0), mask)
        round_icon.save(folder / "ic_launcher_round.png", optimize=True)
    print(f"Android launcher icons written to {res} from {sys.argv[1]}")


if __name__ == "__main__":
    main()
