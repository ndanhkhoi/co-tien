#!/usr/bin/env bash
# Review every gallery pose of a sect one by one, redrawing the ones that fail, then export only the passed ones.
#
#   refine-gallery.sh SECT_ID WORK_DIR [ids...]
#
# Uses refine-image.sh (draw → Codex review → redraw with the reviewer's fix, at most 4 tries). Poses that still
# fail are listed at the end and are not exported; a person reviews them.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
sect="$1"; work="$2/$sect"; shift 2
mkdir -p "$work/raw" "$work/prompts"
python3 "$here/build-prompts.py" "$repo/src/game/content/roster.json" "$sect" "$work/prompts" >/dev/null

ids=("$@")
if [[ ${#ids[@]} -eq 0 ]]; then
  read -r -a ids <<< "$(python3 -c "import json;print(' '.join(c['id'] for c in json.load(open('$repo/src/game/content/roster.json'))['champions'] if c['sect']=='$sect'))")"
fi
first() { for f in "$@"; do [[ -f "$f" ]] && { echo "$f"; return; }; done; }

failed=()
for id in "${ids[@]}"; do
  cut=$(first "$work/raw/cut-$id.png" "$repo/public/art/champions/$id/cutout.webp")
  port=$(first "$work/raw/port-$id.png" "$repo/public/art/champions/$id/portrait.webp")
  for n in 1 2 3 4; do
    out="$work/raw/pose-$id-$n.png"
    if [[ -f "${out%.png}.review.json" ]] && [[ -f "$out" ]] && [[ "$(jq -r .verdict "${out%.png}.review.json")" == ok ]]; then continue; fi
    size=$(python3 -c "import json;c=next(c for c in json.load(open('$repo/src/game/content/roster.json'))['champions'] if c['id']=='$id');print('1536x1024' if c['gallery'][$n-1].get('frame')=='wide' else '1024x1536')")
    "$here/refine-image.sh" "$out" "$work/prompts/pose-$id-$n.txt" "$cut" "$port" "$size" "$id" || failed+=("$id pose-$n")
  done
done
python3 "$here/export-gallery.py" "$work" "$repo"
echo "Refined gallery for $sect. Still failing: ${failed[*]:-none}"
