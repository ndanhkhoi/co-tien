#!/usr/bin/env python3
"""Slice a 4x4 ink UI icon sheet into transparent webp icons.

    slice-ui-icons.py SHEET.png OUT_DIR name1 name2 … name16

The rice-paper background is removed by flood-filling from each cell's edges with the paper
colour sampled at the cell corner, so white objects inside an ink outline (cue balls, a hand,
a lantern) keep their colour. Icons are trimmed and saved at 128 px.
"""
import sys
from collections import deque

from PIL import Image, ImageFilter

sheet, out, *names = sys.argv[1:]
im = Image.open(sheet).convert("RGB")
W, H = im.size
cw, ch = W / 4, H / 4
for i, name in enumerate(names[:16]):
    if not name or name == "-":
        continue
    cell = im.crop((int((i % 4) * cw) + 6, int((i // 4) * ch) + 6, int((i % 4 + 1) * cw) - 6, int((i // 4 + 1) * ch) - 6))
    w, h = cell.size
    px = cell.load()
    ref = px[3, 3]
    paper = lambda p: sum(abs(p[k] - ref[k]) for k in range(3)) < 26
    bg = bytearray(w * h)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if bg[y * w + x] or not paper(px[x, y]):
            continue
        bg[y * w + x] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx]:
                q.append((nx, ny))
    alpha = Image.frombytes("L", (w, h), bytes(0 if b else 255 for b in bg)).filter(ImageFilter.GaussianBlur(0.8))
    icon = cell.convert("RGBA")
    icon.putalpha(alpha)
    icon = icon.crop(icon.getbbox())
    icon.thumbnail((128, 128))
    icon.save(f"{out}/{name}.webp", "WEBP", quality=90, method=6)
    print(f"{out}/{name}.webp")
