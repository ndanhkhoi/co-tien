#!/usr/bin/env bash
# Repaint only the background of existing champion portraits / expression sheets, keeping the
# character exactly (the old image is the reference). Old files move to raw/old/.
#
#   [GEN_TOOL=api] rebackground.sh WORK_DIR SECT_ID [champion ids…]   (no ids = every champion of the sect)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
work="$1/$2"; sect="$2"; shift 2
tool="${GEN_TOOL:-api}"
main=$(python3 -c "import json;print(next(s['main'] for s in json.load(open('$repo/src/game/content/roster.json'))['sects'] if s['id']=='$sect'))")
ids=("$@")
if [[ ${#ids[@]} -eq 0 ]]; then
  read -r -a ids <<< "$(python3 -c "import json;print(' '.join(c['id'] for c in json.load(open('$repo/src/game/content/roster.json'))['champions'] if c['sect']=='$sect'))")"
fi
mkdir -p "$work/raw/old"
BG="warm off-white rice paper with a soft ink-wash halo tinted with $main (a pale wash, not a solid colour)"
for id in "${ids[@]}"; do
  for kind in port expr; do
    src="$work/raw/$kind-$id.png"
    [[ -f "$src" ]] || continue
    [[ -f "$work/raw/old/$kind-$id.png" ]] && continue   # already done
    # Already painted on paper (light corners): nothing to repaint.
    if python3 -c "
from PIL import Image
im=Image.open('$src').convert('L'); w,h=im.size
c=[im.getpixel(p) for p in [(4,4),(w-5,4),(4,h-5),(w-5,h-5)]]
raise SystemExit(0 if sum(c)/4 > 170 else 1)"; then continue; fi
    if [[ $kind == port ]]; then
      brief="Reproduce the reference image exactly: the same chibi character, face, expression, pose, outfit, colours, lighting on the character, framing and crop. Change ONLY the background: replace it with $BG. Square 1:1. No text."
    else
      brief="Reproduce the reference image exactly: the same 2x2 expression sheet, the same chibi character and the same four expressions in the same cells, same framing. Change ONLY the background of every cell: replace it with $BG. No text, no grid lines."
    fi
    tmp="$work/raw/.rebg-$kind-$id.png"
    if GEN_NO_FALLBACK=1 "$here/gen-image.sh" --tool "$tool" --out "$tmp" --prompt "$brief" --ref "$src" --size 1024x1024 --timeout 600; then
      mv "$src" "$work/raw/old/$kind-$id.png"
      mv "$tmp" "$src"
    fi
  done &
done
wait
