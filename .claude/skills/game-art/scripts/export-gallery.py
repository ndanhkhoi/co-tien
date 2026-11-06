"""Export reviewed gallery poses to the game.

    python3 export-gallery.py WORK/<sect> REPO_ROOT

Exports raw/pose-<id>-<n>.png to public/art/champions/<id>/pose-<n>.webp only when its review file
(pose-<id>-<n>.review.json) says "ok" from mark-pose.py. Gallery paintings load on the champion page, so 800 px tall keeps
each near 150 KB.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

work, repo = sys.argv[1], sys.argv[2]
raw = os.path.join(work, "raw")
art = os.path.join(repo, "public", "art", "champions")


def keyed(src):
    im = Image.open(src).convert("RGBA")
    if im.getchannel("A").getextrema()[0] < 250:
        return im
    a = np.asarray(im).copy()
    green = (a[..., 1] > 180) & (a[..., 0] < 90) & (a[..., 2] < 90)
    a[..., 3] = np.where(green, 0, 255)
    return Image.fromarray(a)


def drop_edge_slivers(im):
    """A pose cut from a two-figure sheet can keep a piece of its neighbour at the cut edge. Split the image into
    runs of opaque columns; any run that touches the left or right edge and is not the widest run is the
    neighbour's, so it is cleared."""
    a = np.asarray(im).copy()
    filled = (a[..., 3] > 12).any(axis=0)
    runs, x, w = [], 0, len(filled)
    while x < w:
        if filled[x]:
            start = x
            while x < w and filled[x]:
                x += 1
            runs.append((start, x))
        else:
            x += 1
    if len(runs) < 2:
        return im
    main = max(runs, key=lambda r: r[1] - r[0])
    for r in runs:
        if r is not main and (r[0] == 0 or r[1] == w):
            a[:, r[0]:r[1], 3] = 0
    return Image.fromarray(a)


def clear_faint_backdrop(im):
    """Some draws bake a faint checkerboard into the alpha (values around 20-40). Clear low-alpha pixels that connect
    to the image border; soft glows and sheer cloth inside the figure are not connected to the border and stay."""
    a = np.asarray(im).copy()
    low = a[..., 3] < 60
    reach = np.zeros_like(low)
    reach[0, :], reach[-1, :], reach[:, 0], reach[:, -1] = low[0, :], low[-1, :], low[:, 0], low[:, -1]
    while True:
        grown = reach.copy()
        grown[1:] |= reach[:-1]
        grown[:-1] |= reach[1:]
        grown[:, 1:] |= reach[:, :-1]
        grown[:, :-1] |= reach[:, 1:]
        grown &= low
        if (grown == reach).all():
            break
        reach = grown
    a[reach, 3] = 0
    return Image.fromarray(a)


def fit_height(im, h):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


done = 0
for f in sorted(os.listdir(raw)):
    if not (f.startswith("pose-") and f.endswith(".png")):
        continue
    review = os.path.join(raw, f[:-4] + ".review.json")
    try:
        r = json.load(open(review))
        ok = r.get("verdict") == "ok" and r.get("reviewer") == "lead"
    except (OSError, ValueError):
        ok = False
    cid, n = f[5:-4].rsplit("-", 1)
    dst = os.path.join(art, cid, f"pose-{n}.webp")
    if not ok:
        if os.path.exists(dst):
            os.remove(dst)
        continue
    fit_height(drop_edge_slivers(clear_faint_backdrop(keyed(os.path.join(raw, f)))), 800).save(dst, "WEBP", quality=78, method=6)
    done += 1
# A pose whose draft was rejected (moved to raw/old) must not linger in the game either.
roster = json.load(open(os.path.join(repo, "src", "game", "content", "roster.json")))
sect = os.path.basename(os.path.normpath(work))
for c in roster["champions"]:
    if c["sect"] != sect:
        continue
    for n in range(1, len(c.get("gallery", [])) + 1):
        review = os.path.join(raw, f"pose-{c['id']}-{n}.review.json")
        try:
            r = json.load(open(review))
            ok = r.get("verdict") == "ok" and r.get("reviewer") == "lead" and os.path.exists(review[:-12] + ".png")
        except (OSError, ValueError):
            ok = False
        dst = os.path.join(art, c["id"], f"pose-{n}.webp")
        if not ok and os.path.exists(dst):
            os.remove(dst)
print(f"exported {done} reviewed poses from {raw}")
