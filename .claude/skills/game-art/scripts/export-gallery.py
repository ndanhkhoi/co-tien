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
    return Image.fromarray(a, "RGBA")


def drop_edge_slivers(im):
    """A pose cut from a two-figure sheet can keep a thin strip of its neighbour at the cut edge: clear any opaque
    strip narrower than a quarter of the image that a clear gap of 8 px or more separates from the figure."""
    a = im.getchannel("A")
    w, hgt = im.size
    cols = list((np.asarray(a) > 12).sum(axis=0))
    for order in (range(w), range(w - 1, -1, -1)):
        xs = list(order)
        i = 0
        while i < len(xs) and cols[xs[i]] == 0:
            i += 1
        start = i
        while i < len(xs) and cols[xs[i]] > 0:
            i += 1
        strip = xs[start:i]
        gap = 0
        while i < len(xs) and cols[xs[i]] == 0:
            gap += 1
            i += 1
        if strip and len(strip) < w // 4 and gap >= 8 and i < len(xs):
            x0, x1 = min(strip), max(strip) + 1
            im.paste((0, 0, 0, 0), (x0, 0, x1, hgt))
            for x in strip:
                cols[x] = 0
    return im


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
    fit_height(drop_edge_slivers(keyed(os.path.join(raw, f))), 800).save(dst, "WEBP", quality=78, method=6)
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
