#!/usr/bin/env python3
"""Regenerate icons/icon-{16,32,48,128}.png.

Run from repo root: python3 scripts/make-icons.py

Requires Pillow (pip install pillow). Icons are drawn procedurally — supersample
at 4x then downsample with LANCZOS for antialiasing.
"""

from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
os.makedirs(OUT, exist_ok=True)

BG = (26, 26, 26, 255)
FG = (255, 255, 255, 255)


def make_icon(size):
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    corner = int(s * 0.22)
    d.rounded_rectangle([(0, 0), (s - 1, s - 1)], radius=corner, fill=BG)

    eye_w = int(s * 0.66)
    eye_h = int(s * 0.40)
    eye_x = (s - eye_w) // 2
    eye_y = (s - eye_h) // 2
    stroke = max(int(s * 0.07), 2)
    d.ellipse([(eye_x, eye_y), (eye_x + eye_w, eye_y + eye_h)],
              outline=FG, width=stroke)

    pupil_r = int(s * 0.12)
    d.ellipse([(s // 2 - pupil_r, s // 2 - pupil_r),
               (s // 2 + pupil_r, s // 2 + pupil_r)], fill=FG)

    pad = int(s * 0.18)
    p1 = (pad, s - pad)
    p2 = (s - pad, pad)
    # Dark backing line keeps the slash readable where it crosses the white eye.
    d.line([p1, p2], fill=BG, width=int(s * 0.18))
    d.line([p1, p2], fill=FG, width=int(s * 0.10))

    return img.resize((size, size), Image.LANCZOS)


def main():
    for size in [16, 32, 48, 128]:
        path = os.path.join(OUT, f"icon-{size}.png")
        make_icon(size).save(path)
        print(path)


if __name__ == "__main__":
    main()
