#!/usr/bin/env bash
# Illustrate Cơ Tiên Truyện: one ink-wash painting per scene in src/game/content/story.json.
# Draws only scenes that are missing, then writes public/art/story/<scene>.webp.
#
#   [GEN_TOOL=api] gen-story-art.sh WORK_DIR [scene keys…]
#
# To add a chapter: add its pages (with "art" keys) and the matching "scenes" prompts to
# story.json, then run this script. Raw PNGs stay in WORK_DIR/story/raw.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
work="$1/story"; shift
mkdir -p "$work/raw" "$repo/public/art/story"
tool="${GEN_TOOL:-api}"
keys=("$@")
if [[ ${#keys[@]} -eq 0 ]]; then
  read -r -a keys <<< "$(python3 -c "import json;print(' '.join(json.load(open('$repo/src/game/content/story.json'))['scenes']))")"
fi
STYLE="Book illustration painted in Chinese/Vietnamese ink-wash style (thuỷ mặc) on warm rice paper: black ink brushwork, soft grey washes and mist, delicate light colour washes only on the key figures, generous empty paper, matte, no glow, cinematic composition, figures small in a wide scene. Wide 16:9. No text, no letters, no seals with writing."
run=0
for k in "${keys[@]}"; do
  [[ -f "$work/raw/$k.png" ]] && continue
  scene=$(python3 -c "import json,sys;print(json.load(open('$repo/src/game/content/story.json'))['scenes'][sys.argv[1]])" "$k")
  (
    GEN_NO_FALLBACK=1 "$here/gen-image.sh" --tool "$tool" --out "$work/raw/$k.png" --size 1536x1024 --timeout 600 \
      --prompt "$STYLE Scene: $scene."
  ) &
  run=$((run + 1))
  # Four at a time keeps the image API comfortable.
  if (( run % 4 == 0 )); then wait; fi
done
wait
python3 - "$work/raw" "$repo/public/art/story" <<'EOF'
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(src)):
    if not f.endswith(".png"):
        continue
    out = os.path.join(dst, f[:-4] + ".webp")
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(os.path.join(src, f)):
        continue
    im = Image.open(os.path.join(src, f)).convert("RGB")
    im.thumbnail((1280, 1280))
    im.save(out, "WEBP", quality=80, method=6)
    print(out)
EOF
