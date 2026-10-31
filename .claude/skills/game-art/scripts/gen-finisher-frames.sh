#!/usr/bin/env bash
# Draw the eight Kết liễu keyframes for one sect (or some of its champions) and export them.
#
#   [REDO=1] gen-finisher-frames.sh SECT_ID WORK_DIR [ids...]
#
# References: the champion cut-out (identity) and the still finisher (canvas, scale, ground line).
# Raw frames land in WORK/<sect>/raw/fin-<id>-<n>.png; game files in public/art/champions/<id>/fin-<n>.webp.
# Frames keep one shared canvas (never trimmed one by one) so playback does not jump.
# Only the model cx/gpt-6-sol-image is used (through gen-image.sh).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
sect="$1"
work="$2/$sect"
shift 2
mkdir -p "$work/raw" "$work/prompts"
python3 "$here/build-prompts.py" "$repo/src/game/content/roster.json" "$sect" "$work/prompts" >/dev/null
G="$here/gen-image.sh"

ids=("$@")
if [[ ${#ids[@]} -eq 0 ]]; then
  read -r -a ids <<< "$(python3 -c "import json;print(' '.join(c['id'] for c in json.load(open('$repo/src/game/content/roster.json'))['champions'] if c['sect']=='$sect'))")"
fi

first() { for f in "$@"; do [[ -f "$f" ]] && { echo "$f"; return; }; done; }

for id in "${ids[@]}"; do
  cut=$(first "$work/raw/cut-$id.png" "$repo/public/art/champions/$id/cutout.webp")
  fin=$(first "$work/raw/finisher-$id.png" "$repo/public/art/champions/$id/finisher.webp")
  if [[ -z "$cut" || -z "$fin" ]]; then echo "skip $id (missing cut-out or finisher reference)" >&2; continue; fi
  for n in 1 2 3 4 5 6 7 8; do
    out="$work/raw/fin-$id-$n.png"
    [[ "${REDO:-0}" != 1 && -f "$out" ]] && continue
    # The image API rate-limits (HTTP 429, resets within a minute): wait and retry instead of skipping.
    for try in 1 2 3 4 5 6; do
      $G --out "$out" --prompt-file "$work/prompts/fin-$id-$n.txt" --ref "$cut" --ref "$fin" --size 1536x1024 --timeout 600 && break
      echo "retry $id frame $n in $((try * 30))s" >&2
      sleep $((try * 30))
    done
  done
  python3 "$here/export-finisher-frames.py" "$work/raw" "$repo/public/art/champions/$id" "$id"
done
echo "Done finisher frames for $sect"
