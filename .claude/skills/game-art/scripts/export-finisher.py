"""Export reviewed Kết liễu paintings to the game.

    python3 export-finisher.py WORK REPO_ROOT id [id...]

Writes WORK/<sect>/raw/finisher-<id>.png to public/art/champions/<id>/finisher.webp: background keyed, cropped to the
figure, longest side 820 px, webp quality 74. Run it only for paintings the lead reviewer has approved.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

work, repo, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
roster = {c["id"]: c for c in json.load(open(os.path.join(repo, "src", "game", "content", "roster.json")))["champions"]}
for cid in ids:
    im = Image.open(os.path.join(work, roster[cid]["sect"], "raw", f"finisher-{cid}.png")).convert("RGBA")
    a = np.asarray(im).copy()
    if a[..., 3].min() > 250:
        green = (a[..., 1] > 180) & (a[..., 0] < 90) & (a[..., 2] < 90)
        a[..., 3] = np.where(green, 0, 255)
        im = Image.fromarray(a)
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox())
    im.thumbnail((820, 820), Image.LANCZOS)
    im.save(os.path.join(repo, "public", "art", "champions", cid, "finisher.webp"), "WEBP", quality=74, method=6)
    print(f"exported finisher {cid} {im.size}")
