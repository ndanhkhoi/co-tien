"""Cut an N x M sprite sheet into separate images.

    python3 slice-grid.py SHEET.png --rows 5 --cols 5 --out DIR --names a,b,c,... \
        [--key none|black|alpha|green] [--size 256] [--trim] [--pad 0.06] [--format webp|png]

--key black  turns a black background into alpha (good for glows/VFX: keeps soft edges).
--key green  removes a #00ff00 chroma background (characters).
--key alpha  keeps the sheet's own alpha channel.
--trim       crops each cell to its content, then re-centres it on a square canvas.
Names may be fewer than cells; '-' skips a cell. Missing names fall back to cell-RR-CC.
"""
import argparse
import os

import numpy as np
from PIL import Image


def black_to_alpha(im: Image.Image) -> Image.Image:
    """Luminance key: brightness becomes opacity, colour is un-premultiplied from black."""
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    m = rgb.max(axis=2)
    a = np.clip((m - 10) * 255 / 235, 0, 255)
    col = np.clip(rgb * (255 / np.maximum(m, 1))[..., None], 0, 255)
    out = np.dstack([col, a]).astype(np.uint8)
    out[a == 0] = 0
    return Image.fromarray(out, "RGBA")


def green_to_alpha(im: Image.Image) -> Image.Image:
    px = np.asarray(im.convert("RGBA"), dtype=np.float32).copy()
    r, g, b, a = px[..., 0], px[..., 1], px[..., 2], px[..., 3]
    dom = g - np.maximum(r, b)
    k = np.clip((dom - 20) / 40, 0, 1)
    fringe = (dom > 20) & (dom <= 60)
    px[..., 1] = np.where(fringe, np.maximum(r, b), g)
    px[..., 3] = a * (1 - k)
    px[dom > 60] = 0
    return Image.fromarray(px.astype(np.uint8), "RGBA")


def trim_square(im: Image.Image, pad: float, size: int) -> Image.Image:
    bbox = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    side = int(max(im.size) * (1 + 2 * pad)) or 1
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--names", default="")
    ap.add_argument("--key", default="none", choices=["none", "black", "alpha", "green"])
    ap.add_argument("--size", type=int, default=256)
    ap.add_argument("--trim", action="store_true")
    ap.add_argument("--pad", type=float, default=0.06)
    ap.add_argument("--inset", type=float, default=0.0, help="shave this fraction off each cell edge")
    ap.add_argument("--format", default="webp", choices=["webp", "png"])
    a = ap.parse_args()

    sheet = Image.open(a.sheet)
    if a.key == "none":
        sheet = sheet.convert("RGBA")
    elif a.key == "alpha":
        sheet = sheet.convert("RGBA")
    os.makedirs(a.out, exist_ok=True)
    names = [n.strip() for n in a.names.split(",")] if a.names else []
    cw, ch = sheet.width / a.cols, sheet.height / a.rows
    i = 0
    for r in range(a.rows):
        for c in range(a.cols):
            name = names[i] if i < len(names) and names[i] else f"cell-{r:02d}-{c:02d}"
            i += 1
            if name == "-":
                continue
            ix, iy = cw * a.inset, ch * a.inset
            cell = sheet.crop((int(c * cw + ix), int(r * ch + iy), int((c + 1) * cw - ix), int((r + 1) * ch - iy)))
            if a.key == "black":
                cell = black_to_alpha(cell)
            elif a.key == "green":
                cell = green_to_alpha(cell)
            cell = trim_square(cell, a.pad, a.size) if a.trim else cell.resize((a.size, a.size), Image.LANCZOS)
            path = os.path.join(a.out, f"{name}.{a.format}")
            if a.format == "webp":
                cell.save(path, "WEBP", quality=86, method=6)
            else:
                cell.save(path, "PNG", optimize=True)
            print(path)


if __name__ == "__main__":
    main()
