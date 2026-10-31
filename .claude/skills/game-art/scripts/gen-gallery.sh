#!/usr/bin/env bash
# Generate gallery full-body pose art for one sect into WORK/<sect>/raw.
#
#   [REDO=1] gen-gallery.sh SECT_ID WORK_DIR [ids...]
#
# Passes the champion cut-out as --ref and style-cutout.png as --style-ref.
# Skips existing raw images unless REDO=1.
# Only uses model cx/gpt-6-sol-image via gen-image.sh.
# Exports game-ready webp files to public/art/champions/<id>/pose-<n>.webp.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
sect="$1"
work="$2/$sect"
shift 2

mkdir -p "$work/raw" "$work/prompts"
python3 "$here/build-prompts.py" "$repo/src/game/content/roster.json" "$sect" "$work/prompts" >/dev/null
G="$here/gen-image.sh"
SC="$here/../references/style-cutout.png"

want() {
  [[ "${REDO:-0}" == 1 ]] || [[ ! -f "$work/raw/$1" ]]
}

ids=("$@")
if [[ ${#ids[@]} -eq 0 ]]; then
  read -r -a ids <<< "$(python3 -c "import json,sys;print(' '.join(c['id'] for c in json.load(open('$repo/src/game/content/roster.json'))['champions'] if c['sect']=='$sect'))")"
fi

for id in "${ids[@]}"; do
  ref="$work/raw/cut-$id.png"
  if [[ ! -f "$ref" ]]; then
    ref="$repo/public/art/champions/$id/cutout.webp"
  fi
  if [[ ! -f "$ref" ]]; then
    echo "skip $id (missing cut-out reference)" >&2
    continue
  fi

  for n in 1 2 3 4; do
    prompt_file="$work/prompts/pose-$id-$n.txt"
    out_file="$work/raw/pose-$id-$n.png"
    if [[ ! -f "$prompt_file" ]]; then
      echo "skip $id pose $n (missing prompt $prompt_file)" >&2
      continue
    fi
    if want "pose-$id-$n.png"; then
      # The image API rate-limits (HTTP 429, resets within a minute): wait and retry instead of skipping.
      for try in 1 2 3 4 5 6; do
        $G --out "$out_file" --prompt-file "$prompt_file" --ref "$ref" --style-ref "$SC" --size 1024x1536 --timeout 600 && break
        echo "retry $id pose $n in $((try * 30))s" >&2
        sleep $((try * 30))
      done
    fi
  done
done

# Export generated images to public/art/champions/<id>/pose-<n>.webp
python3 - "$work" "$repo" <<'PYEOF'
import os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else ".")
work, repo = sys.argv[1], sys.argv[2]
raw = os.path.join(work, "raw")
art = os.path.join(repo, "public", "art")

try:
    from importlib import import_module
    slicer = import_module("slice-grid")
except Exception:
    slicer = None

def keyed(src):
    im = Image.open(src)
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] < 250:
        return im
    rgb = im.convert("RGB")
    r, g, b = rgb.getpixel((4, 4))
    if slicer and g > 180 and r < 90 and b < 90:
        return slicer.green_to_alpha(rgb)
    return im.convert("RGBA")

def fit_height(im, h):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)

for f in sorted(os.listdir(raw)):
    if not (f.startswith("pose-") and f.endswith(".png")):
        continue
    parts = f[5:-4].rsplit("-", 1)
    if len(parts) != 2:
        continue
    cid, n = parts
    dst = os.path.join(art, "champions", cid, f"pose-{n}.webp")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    # Gallery paintings load only on the champion page: 800 px tall keeps each near 120 KB.
    fit_height(keyed(os.path.join(raw, f)), 800).save(dst, "WEBP", quality=78, method=6)
PYEOF

echo "Done gallery for $sect in $work/raw"
