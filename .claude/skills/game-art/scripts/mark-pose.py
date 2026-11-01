"""Record the review of one gallery pose.

    python3 mark-pose.py WORK/<sect> ID N ok "what was checked"
    python3 mark-pose.py WORK/<sect> ID N redraw "what is wrong and how to fix it"

ok writes raw/pose-<id>-<n>.review.json so export-gallery.py ships it. redraw moves the pose and its sheet to raw/old
and adds the note to fix/<id>-<a|b>.txt, so the next gen-gallery.sh run draws that sheet again with the correction.
"""
import json
import os
import shutil
import sys
import time

work, cid, n, verdict, note = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
raw = os.path.join(work, "raw")
pose = os.path.join(raw, f"pose-{cid}-{n}")
half = "a" if n <= 2 else "b"
with open(pose + ".review.json", "w") as f:
    json.dump({"verdict": verdict, "issues": [] if verdict == "ok" else [note], "notes": note, "reviewer": "lead"}, f,
              ensure_ascii=False, indent=1)
if verdict != "ok":
    old = os.path.join(raw, "old")
    os.makedirs(old, exist_ok=True)
    stamp = time.strftime("%H%M%S")
    if os.path.exists(pose + ".png"):
        shutil.move(pose + ".png", os.path.join(old, f"pose-{cid}-{n}-{stamp}.png"))
    sheet = os.path.join(work, "sheets", f"sheet-{cid}-{half}.png")
    if os.path.exists(sheet):
        shutil.move(sheet, os.path.join(old, f"sheet-{cid}-{half}-{stamp}.png"))
    os.makedirs(os.path.join(work, "fix"), exist_ok=True)
    with open(os.path.join(work, "fix", f"{cid}-{half}.txt"), "a") as f:
        f.write(f"Pose {n}: {note}\n")
print(f"{cid} pose {n}: {verdict}")
